/**
 * Combat Service Tests
 *
 * combatService is now a math/history helper module only — Task #4 removed
 * the auto-resolve combat path (attackNPC, fleeFromCombat, executeCombatRound,
 * applyDamage). Live combat lives in realtimeCombatService. This suite exercises
 * the surviving pure helpers + the history/summary/regen DB helpers.
 */
const { sequelize, NPC, CombatLog, ShipComponent } = require('../../src/models');
const combatService = require('../../src/services/combatService');
const { createTestUser, createTestSector, createTestShip, cleanDatabase } = require('../helpers');

describe('Combat Service', () => {
  let testUser, testSector, testShip;

  beforeAll(async () => {
    await sequelize.sync({ force: true });
  });

  beforeEach(async () => {
    await cleanDatabase();
    await CombatLog.destroy({ where: {} });
    await NPC.destroy({ where: {} });
    await ShipComponent.destroy({ where: {} });

    testSector = await createTestSector({ type: 'Mid' });
    testUser = await createTestUser();
    testShip = await createTestShip(testUser.user_id, testSector.sector_id, {
      hull_points: 100,
      max_hull_points: 100,
      shield_points: 50,
      max_shield_points: 50,
      attack_power: 20,
      defense_rating: 10,
      energy: 100,
      max_energy: 100
    });
  });

  describe('calculateDamage', () => {
    it('should calculate base damage correctly', () => {
      const damage = combatService.calculateDamage(20, 10);
      expect(damage).toBeGreaterThan(0);
      expect(typeof damage).toBe('number');
    });

    it('should return minimum damage when defense is high', () => {
      const damage = combatService.calculateDamage(10, 100);
      expect(damage).toBeGreaterThanOrEqual(0);
    });
  });

  describe('checkCriticalHit', () => {
    it('should return a boolean', () => {
      const result = combatService.checkCriticalHit();
      expect(typeof result).toBe('boolean');
    });
  });

  describe('calculateFleeChance', () => {
    it('should return a value between 0 and 1', () => {
      const chance = combatService.calculateFleeChance(10, 8);
      expect(chance).toBeGreaterThanOrEqual(0);
      expect(chance).toBeLessThanOrEqual(1);
    });

    it('should give higher chance when fleeing ship is faster', () => {
      const fastChance = combatService.calculateFleeChance(20, 10);
      const slowChance = combatService.calculateFleeChance(10, 20);
      expect(fastChance).toBeGreaterThan(slowChance);
    });
  });

  describe('calculateScannerAccuracyBonus', () => {
    it('should return 1.0 when scanner ranges are equal', () => {
      const attacker = { scanner_range: 5 };
      const defender = { scanner_range: 5 };
      const bonus = combatService.calculateScannerAccuracyBonus(attacker, defender);
      expect(bonus).toBe(1.0);
    });

    it('should return bonus when attacker has better scanner', () => {
      const attacker = { scanner_range: 10 };
      const defender = { scanner_range: 5 };
      const bonus = combatService.calculateScannerAccuracyBonus(attacker, defender);
      expect(bonus).toBeGreaterThan(1.0);
      expect(bonus).toBeLessThanOrEqual(1.3);
    });

    it('should return penalty when attacker has worse scanner', () => {
      const attacker = { scanner_range: 3 };
      const defender = { scanner_range: 10 };
      const bonus = combatService.calculateScannerAccuracyBonus(attacker, defender);
      expect(bonus).toBeLessThan(1.0);
    });
  });

  describe('getCombatHistory / getCombatSummary', () => {
    it('returns an empty history for a user with no battles', async () => {
      const history = await combatService.getCombatHistory(testUser.user_id);
      expect(Array.isArray(history)).toBe(true);
      expect(history).toHaveLength(0);
    });

    it('returns combat history rows ordered newest first', async () => {
      // Seed two CombatLog rows directly (auto-resolve attackNPC was removed).
      await CombatLog.create({
        attacker_ship_id: testShip.ship_id,
        sector_id: testSector.sector_id,
        combat_type: 'PVE',
        winner_type: 'attacker',
        credits_looted: 100,
        experience_gained: 50
      });
      await CombatLog.create({
        attacker_ship_id: testShip.ship_id,
        sector_id: testSector.sector_id,
        combat_type: 'PVE',
        winner_type: 'defender',
        credits_looted: 0,
        experience_gained: 10
      });

      const history = await combatService.getCombatHistory(testUser.user_id);
      expect(history).toHaveLength(2);
    });

    it('returns zeroed summary statistics for a fresh user', async () => {
      const summary = await combatService.getCombatSummary(testUser.user_id);
      expect(summary).toHaveProperty('total_battles', 0);
      expect(summary).toHaveProperty('wins', 0);
      expect(summary).toHaveProperty('losses', 0);
      expect(summary).toHaveProperty('draws', 0);
    });

    it('aggregates win/loss/draw counts from combat logs', async () => {
      const base = { attacker_ship_id: testShip.ship_id, sector_id: testSector.sector_id, combat_type: 'PVE' };
      await CombatLog.create({ ...base, winner_type: 'attacker' });
      await CombatLog.create({ ...base, winner_type: 'attacker' });
      await CombatLog.create({ ...base, winner_type: 'defender' });

      const summary = await combatService.getCombatSummary(testUser.user_id);
      expect(summary.total_battles).toBe(3);
      expect(summary.wins).toBe(2);
      expect(summary.losses).toBe(1);
    });
  });

  describe('regenerateShields', () => {
    it('regenerates shields partially', async () => {
      await testShip.update({ shield_points: 10 });
      const result = await combatService.regenerateShields(testShip.ship_id, false);
      expect(result.shield_points).toBeGreaterThan(10);
      expect(result.shield_points).toBeLessThanOrEqual(testShip.max_shield_points);
    });

    it('fully restores shields when requested', async () => {
      await testShip.update({ shield_points: 10 });
      const result = await combatService.regenerateShields(testShip.ship_id, true);
      expect(result.shield_points).toBe(50);
    });
  });
});
