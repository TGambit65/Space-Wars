const { cleanDatabase, createTestUser, createTestSector, createTestPlanet, createTestColony } = require('../helpers');
const wonderService = require('../../src/services/wonderService');
const { Wonder } = require('../../src/models');

describe('Wonder Service', () => {
  let user, sector, planet, colony;

  beforeEach(async () => {
    await cleanDatabase();
    user = await createTestUser({ credits: 500000 });
    sector = await createTestSector();
    planet = await createTestPlanet(sector.sector_id);
    colony = await createTestColony(planet.planet_id, user.user_id, { infrastructure_level: 5 });
  });

  describe('startWonderConstruction', () => {
    it('should create a wonder at a colony', async () => {
      const wonder = await wonderService.startWonderConstruction(user.user_id, colony.colony_id, 'TRADE_NEXUS');
      expect(wonder.wonder_type).toBe('TRADE_NEXUS');
      expect(wonder.construction_phase).toBe(0);
      expect(wonder.is_completed).toBe(false);
    });

    it('should fail for invalid wonder type', async () => {
      await expect(
        wonderService.startWonderConstruction(user.user_id, colony.colony_id, 'INVALID_TYPE')
      ).rejects.toThrow('Invalid wonder type');
    });

    it('should fail if infrastructure too low', async () => {
      await colony.update({ infrastructure_level: 1 });
      await expect(
        wonderService.startWonderConstruction(user.user_id, colony.colony_id, 'GENESIS_DEVICE')
      ).rejects.toThrow(/Requires infrastructure level/);
    });

    it('should fail for duplicate wonder type at colony', async () => {
      await wonderService.startWonderConstruction(user.user_id, colony.colony_id, 'TRADE_NEXUS');
      await expect(
        wonderService.startWonderConstruction(user.user_id, colony.colony_id, 'TRADE_NEXUS')
      ).rejects.toThrow('This wonder type already exists');
    });

    it('should fail if colony not owned', async () => {
      const other = await createTestUser({ username: 'otherwonder' });
      await expect(
        wonderService.startWonderConstruction(other.user_id, colony.colony_id, 'TRADE_NEXUS')
      ).rejects.toThrow('Colony not found or not owned');
    });
  });

  describe('advanceWonderPhase', () => {
    let wonder;

    beforeEach(async () => {
      wonder = await wonderService.startWonderConstruction(user.user_id, colony.colony_id, 'TRADE_NEXUS');
    });

    it('should advance construction phase', async () => {
      const updated = await wonderService.advanceWonderPhase(user.user_id, wonder.wonder_id);
      expect(updated.construction_phase).toBe(1);
    });

    it('should deduct credits for each phase', async () => {
      const creditsBefore = Number(user.credits);
      await wonderService.advanceWonderPhase(user.user_id, wonder.wonder_id);
      await user.reload();
      expect(Number(user.credits)).toBe(creditsBefore - 15000); // TRADE_NEXUS phaseCost
    });

    it('should complete wonder at max phases', async () => {
      // Advance through all 5 phases
      for (let i = 0; i < 5; i++) {
        await wonderService.advanceWonderPhase(user.user_id, wonder.wonder_id);
      }
      await wonder.reload();
      expect(wonder.is_completed).toBe(true);
      expect(wonder.completed_at).not.toBeNull();
    });

    it('should fail when already completed', async () => {
      for (let i = 0; i < 5; i++) {
        await wonderService.advanceWonderPhase(user.user_id, wonder.wonder_id);
      }
      await expect(
        wonderService.advanceWonderPhase(user.user_id, wonder.wonder_id)
      ).rejects.toThrow('Wonder is already completed');
    });

    it('should fail with insufficient credits', async () => {
      await user.update({ credits: 0 });
      await expect(
        wonderService.advanceWonderPhase(user.user_id, wonder.wonder_id)
      ).rejects.toThrow('Insufficient credits');
    });
  });

  describe('getColonyWonders', () => {
    it('should return all wonders at a colony', async () => {
      await wonderService.startWonderConstruction(user.user_id, colony.colony_id, 'TRADE_NEXUS');
      await wonderService.startWonderConstruction(user.user_id, colony.colony_id, 'ORBITAL_ARRAY');

      const wonders = await wonderService.getColonyWonders(colony.colony_id);
      expect(wonders).toHaveLength(2);
    });
  });

  describe('getWonderBonuses', () => {
    it('should aggregate bonuses from completed wonders', async () => {
      const wonder = await wonderService.startWonderConstruction(user.user_id, colony.colony_id, 'TRADE_NEXUS');
      // Complete it
      for (let i = 0; i < 5; i++) {
        await wonderService.advanceWonderPhase(user.user_id, wonder.wonder_id);
      }

      const bonuses = await wonderService.getWonderBonuses(colony.colony_id);
      expect(bonuses.trade_bonus).toBe(0.15);
    });

    it('should not include incomplete wonders', async () => {
      await wonderService.startWonderConstruction(user.user_id, colony.colony_id, 'TRADE_NEXUS');
      const bonuses = await wonderService.getWonderBonuses(colony.colony_id);
      expect(Object.keys(bonuses)).toHaveLength(0);
    });
  });
});
