const { cleanDatabase, createTestUser, createTestSector, createTestShip } = require('../helpers');
const automationService = require('../../src/services/automationService');
const { AutomatedTask, TechResearch } = require('../../src/models');

describe('Automation Service', () => {
  let user, sector, sector2, ship;

  beforeEach(async () => {
    await cleanDatabase();
    user = await createTestUser({ credits: 50000 });
    sector = await createTestSector();
    sector2 = await createTestSector({ name: 'Sector B' });
    ship = await createTestShip(user.user_id, sector.sector_id);

    // Give user BASIC_AUTOMATION tech (requires BASIC_CRAFTING first)
    await TechResearch.create({
      user_id: user.user_id,
      tech_name: 'BASIC_CRAFTING',
      is_completed: true,
      started_at: new Date(Date.now() - 7200000),
      completes_at: new Date(Date.now() - 3600000),
      credits_spent: 5000
    });
    await TechResearch.create({
      user_id: user.user_id,
      tech_name: 'BASIC_AUTOMATION',
      is_completed: true,
      started_at: new Date(Date.now() - 3600000),
      completes_at: new Date(Date.now() - 1000),
      credits_spent: 20000
    });
  });

  describe('createTradeRoute', () => {
    it('should create a trade route task', async () => {
      const waypoints = [
        { sector_id: sector.sector_id },
        { sector_id: sector2.sector_id }
      ];
      const task = await automationService.createTradeRoute(user.user_id, ship.ship_id, waypoints);
      expect(task.task_type).toBe('trade_route');
      expect(task.status).toBe('active');
      expect(task.total_steps).toBe(2);
    });

    it('should fail without tech', async () => {
      await TechResearch.destroy({ where: { user_id: user.user_id, tech_name: 'BASIC_AUTOMATION' } });
      await expect(
        automationService.createTradeRoute(user.user_id, ship.ship_id, [
          { sector_id: sector.sector_id },
          { sector_id: sector2.sector_id }
        ])
      ).rejects.toThrow('Requires BASIC_AUTOMATION tech');
    });

    it('should fail with less than 2 waypoints', async () => {
      await expect(
        automationService.createTradeRoute(user.user_id, ship.ship_id, [{ sector_id: sector.sector_id }])
      ).rejects.toThrow('at least 2 waypoints');
    });

    it('should fail at max active tasks', async () => {
      // Create 3 ships with tasks
      for (let i = 0; i < 3; i++) {
        const s = await createTestShip(user.user_id, sector.sector_id, { name: `Auto Ship ${i}` });
        await automationService.createTradeRoute(user.user_id, s.ship_id, [
          { sector_id: sector.sector_id },
          { sector_id: sector2.sector_id }
        ]);
      }
      const extraShip = await createTestShip(user.user_id, sector.sector_id, { name: 'Extra Ship' });
      await expect(
        automationService.createTradeRoute(user.user_id, extraShip.ship_id, [
          { sector_id: sector.sector_id },
          { sector_id: sector2.sector_id }
        ])
      ).rejects.toThrow(/Maximum active automation tasks/);
    });

    it('should fail if ship already has active task', async () => {
      await automationService.createTradeRoute(user.user_id, ship.ship_id, [
        { sector_id: sector.sector_id },
        { sector_id: sector2.sector_id }
      ]);
      await expect(
        automationService.createTradeRoute(user.user_id, ship.ship_id, [
          { sector_id: sector.sector_id },
          { sector_id: sector2.sector_id }
        ])
      ).rejects.toThrow('Ship already has an active automation task');
    });
  });

  describe('createMiningRun', () => {
    it('should create a mining run task', async () => {
      const task = await automationService.createMiningRun(user.user_id, ship.ship_id, 'colony-1', 'port-1');
      expect(task.task_type).toBe('mining_run');
      expect(task.status).toBe('active');
      expect(task.total_steps).toBe(4);
      expect(task.task_config.colonyId).toBe('colony-1');
      expect(task.task_config.returnPortId).toBe('port-1');
    });

    it('should fail without tech', async () => {
      await TechResearch.destroy({ where: { user_id: user.user_id, tech_name: 'BASIC_AUTOMATION' } });
      await expect(
        automationService.createMiningRun(user.user_id, ship.ship_id, 'colony-1', 'port-1')
      ).rejects.toThrow('Requires BASIC_AUTOMATION tech');
    });
  });

  describe('pauseTask / resumeTask', () => {
    let task;

    beforeEach(async () => {
      task = await automationService.createTradeRoute(user.user_id, ship.ship_id, [
        { sector_id: sector.sector_id },
        { sector_id: sector2.sector_id }
      ]);
    });

    it('should pause an active task', async () => {
      const paused = await automationService.pauseTask(user.user_id, task.task_id);
      expect(paused.status).toBe('paused');
    });

    it('should resume a paused task', async () => {
      await automationService.pauseTask(user.user_id, task.task_id);
      const resumed = await automationService.resumeTask(user.user_id, task.task_id);
      expect(resumed.status).toBe('active');
    });
  });

  describe('cancelTask', () => {
    it('should cancel an active task', async () => {
      const task = await automationService.createTradeRoute(user.user_id, ship.ship_id, [
        { sector_id: sector.sector_id },
        { sector_id: sector2.sector_id }
      ]);
      const cancelled = await automationService.cancelTask(user.user_id, task.task_id);
      expect(cancelled.status).toBe('completed');
    });
  });

  describe('getActiveTasks', () => {
    it('should return active and paused tasks', async () => {
      await automationService.createTradeRoute(user.user_id, ship.ship_id, [
        { sector_id: sector.sector_id },
        { sector_id: sector2.sector_id }
      ]);
      const tasks = await automationService.getActiveTasks(user.user_id);
      expect(tasks).toHaveLength(1);
      expect(tasks[0].ship).toBeDefined();
    });
  });

  describe('processAutomationTick', () => {
    it('should execute steps for active tasks', async () => {
      const task = await automationService.createTradeRoute(user.user_id, ship.ship_id, [
        { sector_id: sector.sector_id },
        { sector_id: sector2.sector_id }
      ]);

      await automationService.processAutomationTick();

      await task.reload();
      expect(task.current_step).toBe(1);
      expect(task.last_executed_at).not.toBeNull();
    });

    it('should complete task when max_runs reached', async () => {
      const task = await automationService.createTradeRoute(user.user_id, ship.ship_id, [
        { sector_id: sector.sector_id },
        { sector_id: sector2.sector_id }
      ]);
      await task.update({ max_runs: 1, current_step: 1 });

      await automationService.processAutomationTick();
      await task.reload();
      expect(task.status).toBe('completed');
      expect(task.runs_completed).toBe(1);
    });

    it('should set error status on failure', async () => {
      const task = await automationService.createTradeRoute(user.user_id, ship.ship_id, [
        { sector_id: sector.sector_id },
        { sector_id: sector2.sector_id }
      ]);
      // Deactivate ship to trigger error
      await ship.update({ is_active: false });

      await automationService.processAutomationTick();
      await task.reload();
      expect(task.status).toBe('error');
      expect(task.error_message).toBeTruthy();
    });
  });
});
