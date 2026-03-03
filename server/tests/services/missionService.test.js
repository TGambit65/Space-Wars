const { cleanDatabase, createTestUser, createTestSector, createTestPort, createTestCommodity, addCommodityToPort, createTestMission } = require('../helpers');
const missionService = require('../../src/services/missionService');
const { Mission, PlayerMission } = require('../../src/models');

describe('Mission Service', () => {
  let user, sector, port;

  beforeEach(async () => {
    await cleanDatabase();
    user = await createTestUser({ credits: 50000 });
    sector = await createTestSector();
    port = await createTestPort(sector.sector_id);
    const commodity = await createTestCommodity({ name: `MissionComm${Date.now()}` });
    await addCommodityToPort(port.port_id, commodity.commodity_id);
  });

  describe('generateMissionsForPort', () => {
    it('should generate missions for a port', async () => {
      const missions = await missionService.generateMissionsForPort(port.port_id);
      expect(missions.length).toBe(3); // missionsPerPort default
      expect(missions[0]).toHaveProperty('mission_type');
      expect(missions[0]).toHaveProperty('reward_credits');
    });

    it('should not generate more than missionsPerPort', async () => {
      await missionService.generateMissionsForPort(port.port_id);
      const more = await missionService.generateMissionsForPort(port.port_id);
      expect(more.length).toBe(0);
    });
  });

  describe('getAvailableMissions', () => {
    it('should return available missions at a port', async () => {
      await missionService.generateMissionsForPort(port.port_id);
      const missions = await missionService.getAvailableMissions(port.port_id, user.user_id);
      expect(missions.length).toBe(3);
    });

    it('should exclude already accepted missions', async () => {
      await missionService.generateMissionsForPort(port.port_id);
      const allMissions = await Mission.findAll({ where: { port_id: port.port_id } });
      await missionService.acceptMission(user.user_id, allMissions[0].mission_id);

      const available = await missionService.getAvailableMissions(port.port_id, user.user_id);
      expect(available.length).toBe(2);
    });
  });

  describe('acceptMission', () => {
    let mission;

    beforeEach(async () => {
      mission = await createTestMission(port.port_id);
    });

    it('should accept a mission', async () => {
      const pm = await missionService.acceptMission(user.user_id, mission.mission_id);
      expect(pm.status).toBe('accepted');
      expect(pm.user_id).toBe(user.user_id);
    });

    it('should fail when at max active missions', async () => {
      for (let i = 0; i < 5; i++) {
        const m = await createTestMission(port.port_id, { title: `Mission ${i}` });
        await missionService.acceptMission(user.user_id, m.mission_id);
      }
      const extra = await createTestMission(port.port_id, { title: 'Extra Mission' });
      await expect(
        missionService.acceptMission(user.user_id, extra.mission_id)
      ).rejects.toThrow(/Maximum active missions/);
    });

    it('should fail for expired mission', async () => {
      const expired = await createTestMission(port.port_id, {
        title: 'Expired',
        expires_at: new Date(Date.now() - 1000)
      });
      await expect(
        missionService.acceptMission(user.user_id, expired.mission_id)
      ).rejects.toThrow('Mission has expired');
    });

    it('should fail for duplicate acceptance', async () => {
      await missionService.acceptMission(user.user_id, mission.mission_id);
      await expect(
        missionService.acceptMission(user.user_id, mission.mission_id)
      ).rejects.toThrow('Mission already accepted');
    });
  });

  describe('abandonMission', () => {
    it('should abandon an active mission', async () => {
      const mission = await createTestMission(port.port_id);
      const pm = await missionService.acceptMission(user.user_id, mission.mission_id);
      const abandoned = await missionService.abandonMission(user.user_id, pm.player_mission_id);
      expect(abandoned.status).toBe('abandoned');
    });
  });

  describe('getActiveMissions', () => {
    it('should return active missions with mission details', async () => {
      const mission = await createTestMission(port.port_id);
      await missionService.acceptMission(user.user_id, mission.mission_id);

      const active = await missionService.getActiveMissions(user.user_id);
      expect(active).toHaveLength(1);
      expect(active[0].mission).toBeDefined();
    });
  });

  describe('updateMissionProgress', () => {
    it('should update bounty progress on combat kill', async () => {
      const mission = await createTestMission(port.port_id, {
        mission_type: 'bounty',
        requirements: { kills: 2 }
      });
      const pm = await missionService.acceptMission(user.user_id, mission.mission_id);

      await missionService.updateMissionProgress(user.user_id, 'combat_kill', {});
      await pm.reload();
      expect(pm.progress.kills).toBe(1);
    });

    it('should auto-complete mission when requirements met and award credits', async () => {
      const startCredits = Number(user.credits);
      const mission = await createTestMission(port.port_id, {
        mission_type: 'bounty',
        requirements: { kills: 1 },
        reward_credits: 500,
        reward_xp: 25
      });
      await missionService.acceptMission(user.user_id, mission.mission_id);

      await missionService.updateMissionProgress(user.user_id, 'combat_kill', {});

      const pms = await PlayerMission.findAll({ where: { user_id: user.user_id } });
      expect(pms[0].status).toBe('completed');
      expect(pms[0].completed_at).not.toBeNull();

      // Verify credits were awarded
      await user.reload();
      expect(Number(user.credits)).toBe(startCredits + 500);
    });

    it('should update scan progress', async () => {
      const mission = await createTestMission(port.port_id, {
        mission_type: 'scan',
        requirements: { sectors: 3 }
      });
      const pm = await missionService.acceptMission(user.user_id, mission.mission_id);

      await missionService.updateMissionProgress(user.user_id, 'sector_scan', {});
      await pm.reload();
      expect(pm.progress.sectors_scanned).toBe(1);
    });
  });

  describe('expireOldMissions', () => {
    it('should deactivate expired missions and fail accepted player missions', async () => {
      const mission = await createTestMission(port.port_id, {
        title: 'Expired Mission',
        expires_at: new Date(Date.now() - 1000)
      });

      // Accept the expired mission (accepted before expiry in real scenario)
      const pm = await PlayerMission.create({
        user_id: user.user_id,
        mission_id: mission.mission_id,
        status: 'accepted',
        progress: {},
        accepted_at: new Date(Date.now() - 86400000)
      });

      const count = await missionService.expireOldMissions();
      expect(count).toBe(1);

      // Verify mission deactivated
      await mission.reload();
      expect(mission.is_active).toBe(false);

      // Verify player mission was set to failed
      await pm.reload();
      expect(pm.status).toBe('failed');
    });
  });

  describe('refreshPortMissions', () => {
    it('should generate missions for ports that need them', async () => {
      const generated = await missionService.refreshPortMissions();
      expect(generated).toBeGreaterThanOrEqual(0);
    });
  });
});
