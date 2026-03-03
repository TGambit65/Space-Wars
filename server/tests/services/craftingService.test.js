const { cleanDatabase, createTestUser, createTestSector, createTestShip, createTestPort, createTestCommodity, addCommodityToPort, addCargoToShip, createTestBlueprint } = require('../helpers');
const craftingService = require('../../src/services/craftingService');
const { Blueprint, CraftingJob, TechResearch, ShipCargo } = require('../../src/models');

describe('Crafting Service', () => {
  let user, sector, ship, port, commodity, blueprint;

  beforeEach(async () => {
    await cleanDatabase();
    user = await createTestUser({ credits: 50000 });
    await user.update({ player_level: 5 });
    sector = await createTestSector();
    port = await createTestPort(sector.sector_id);
    ship = await createTestShip(user.user_id, sector.sector_id);
    commodity = await createTestCommodity({ name: 'Iron Ore' });
    await addCommodityToPort(port.port_id, commodity.commodity_id);

    // Give user BASIC_CRAFTING tech
    await TechResearch.create({
      user_id: user.user_id,
      tech_name: 'BASIC_CRAFTING',
      is_completed: true,
      started_at: new Date(Date.now() - 3600000),
      completes_at: new Date(Date.now() - 1000),
      credits_spent: 5000
    });

    blueprint = await createTestBlueprint({
      name: 'Test Craft Blueprint',
      category: 'commodity',
      output_type: 'commodity',
      output_name: 'Iron Ore',
      required_level: 1,
      required_tech: 'BASIC_CRAFTING',
      ingredients: [{ commodityName: 'Iron Ore', quantity: 5 }],
      credits_cost: 100
    });
  });

  describe('getAvailableBlueprints', () => {
    it('should return blueprints available to the user', async () => {
      const blueprints = await craftingService.getAvailableBlueprints(user.user_id);
      expect(blueprints.length).toBeGreaterThanOrEqual(1);
    });

    it('should filter out blueprints requiring higher level', async () => {
      await createTestBlueprint({
        name: 'High Level Blueprint',
        required_level: 99,
        required_tech: 'BASIC_CRAFTING',
        ingredients: [{ commodityName: 'Iron Ore', quantity: 1 }],
        credits_cost: 10
      });

      const blueprints = await craftingService.getAvailableBlueprints(user.user_id);
      const names = blueprints.map(b => b.name);
      expect(names).not.toContain('High Level Blueprint');
    });
  });

  describe('startCrafting', () => {
    beforeEach(async () => {
      await addCargoToShip(ship.ship_id, commodity.commodity_id, 20);
    });

    it('should create a crafting job', async () => {
      const job = await craftingService.startCrafting(user.user_id, blueprint.blueprint_id, ship.ship_id);
      expect(job.status).toBe('in_progress');
      expect(job.user_id).toBe(user.user_id);
    });

    it('should deduct ingredients from cargo', async () => {
      await craftingService.startCrafting(user.user_id, blueprint.blueprint_id, ship.ship_id);
      const cargo = await ShipCargo.findOne({ where: { ship_id: ship.ship_id, commodity_id: commodity.commodity_id } });
      expect(cargo.quantity).toBe(15); // 20 - 5
    });

    it('should deduct credits', async () => {
      await craftingService.startCrafting(user.user_id, blueprint.blueprint_id, ship.ship_id);
      await user.reload();
      expect(Number(user.credits)).toBe(50000 - 100);
    });

    it('should fail with insufficient ingredients', async () => {
      await ShipCargo.destroy({ where: { ship_id: ship.ship_id } });
      await expect(
        craftingService.startCrafting(user.user_id, blueprint.blueprint_id, ship.ship_id)
      ).rejects.toThrow(/Insufficient/);
    });

    it('should fail with insufficient credits', async () => {
      await user.update({ credits: 0 });
      await expect(
        craftingService.startCrafting(user.user_id, blueprint.blueprint_id, ship.ship_id)
      ).rejects.toThrow('Insufficient credits');
    });

    it('should fail if ship not at port', async () => {
      const remoteSector = await createTestSector({ name: 'Remote Sector' });
      await ship.update({ current_sector_id: remoteSector.sector_id });
      await expect(
        craftingService.startCrafting(user.user_id, blueprint.blueprint_id, ship.ship_id)
      ).rejects.toThrow('Ship must be docked at a port');
    });
  });

  describe('cancelCrafting', () => {
    let job;

    beforeEach(async () => {
      await addCargoToShip(ship.ship_id, commodity.commodity_id, 20);
      job = await craftingService.startCrafting(user.user_id, blueprint.blueprint_id, ship.ship_id);
    });

    it('should cancel the job and refund 50% ingredients', async () => {
      const cancelled = await craftingService.cancelCrafting(user.user_id, job.crafting_job_id);
      expect(cancelled.status).toBe('cancelled');

      const cargo = await ShipCargo.findOne({ where: { ship_id: ship.ship_id, commodity_id: commodity.commodity_id } });
      // Started with 20, used 5, refunded 2 (50% of 5 = 2.5 -> floor = 2)
      expect(cargo.quantity).toBe(15 + 2);
    });
  });

  describe('completeCrafting', () => {
    let job;

    beforeEach(async () => {
      await addCargoToShip(ship.ship_id, commodity.commodity_id, 20);
      job = await craftingService.startCrafting(user.user_id, blueprint.blueprint_id, ship.ship_id);
    });

    it('should fail if crafting not yet complete', async () => {
      await expect(
        craftingService.completeCrafting(user.user_id, job.crafting_job_id)
      ).rejects.toThrow('Crafting not yet complete');
    });

    it('should complete when time has elapsed', async () => {
      // Use commodity output blueprint for verifiable result
      const outputCommodity = await createTestCommodity({ name: `CraftOutput${Date.now()}` });
      const outputBlueprint = await createTestBlueprint({
        name: `Output BP ${Date.now()}`,
        output_type: 'commodity',
        output_name: outputCommodity.name,
        output_quantity: 3,
        ingredients: [{ commodityName: commodity.name, quantity: 1 }],
        credits_cost: 10
      });
      // Ship already has cargo from beforeEach (20 - 5 used by first craft = 15 remaining)
      const outputJob = await craftingService.startCrafting(user.user_id, outputBlueprint.blueprint_id, ship.ship_id);
      await outputJob.update({ completes_at: new Date(Date.now() - 1000) });

      const completed = await craftingService.completeCrafting(user.user_id, outputJob.crafting_job_id);
      expect(completed.status).toBe('completed');
      expect(completed.completed_at).not.toBeNull();

      // Verify output commodity was actually added to ship cargo
      const outputCargo = await ShipCargo.findOne({
        where: { ship_id: ship.ship_id, commodity_id: outputCommodity.commodity_id }
      });
      expect(outputCargo).not.toBeNull();
      expect(outputCargo.quantity).toBe(3);
    });
  });

  describe('getActiveJobs', () => {
    it('should return active crafting jobs', async () => {
      await addCargoToShip(ship.ship_id, commodity.commodity_id, 20);
      await craftingService.startCrafting(user.user_id, blueprint.blueprint_id, ship.ship_id);

      const jobs = await craftingService.getActiveJobs(user.user_id);
      expect(jobs).toHaveLength(1);
      expect(jobs[0].blueprint).not.toBeNull();
      expect(jobs[0].blueprint.blueprint_id).toBe(blueprint.blueprint_id);
      expect(jobs[0].status).toBe('in_progress');
    });
  });

  describe('seedBlueprints', () => {
    it('should seed blueprints from config', async () => {
      await craftingService.seedBlueprints();
      const count = await Blueprint.count();
      expect(count).toBeGreaterThanOrEqual(6); // 6 from config + 1 from test
    });
  });
});
