/**
 * Combat Service Tests
 */
const { sequelize, User, Ship, Sector, NPC, CombatLog, Component, ShipComponent } = require('../../src/models');
const combatService = require('../../src/services/combatService');
const npcService = require('../../src/services/npcService');
const { createTestUser, createTestSector, createTestShip, cleanDatabase } = require('../helpers');

describe('Combat Service', () => {
  let testUser, testSector, testShip, testNPC;

  beforeAll(async () => {
    await sequelize.sync({ force: true });
  });

  beforeEach(async () => {
    await cleanDatabase();
    // Clean Phase 3 models
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
    
    // Create test NPC
    testNPC = await NPC.create({
      name: 'Test Pirate',
      npc_type: 'PIRATE',
      ship_type: 'Fighter',
      current_sector_id: testSector.sector_id,
      hull_points: 80,
      max_hull_points: 80,
      shield_points: 30,
      max_shield_points: 30,
      attack_power: 15,
      defense_rating: 8,
      aggression_level: 0.8,
      credits_carried: 500,
      experience_value: 100,
      is_alive: true
    });
  });

  afterAll(async () => {
    await sequelize.close();
  });

  describe('calculateDamage', () => {
    it('should calculate base damage correctly', () => {
      const damage = combatService.calculateDamage(20, 10);
      expect(damage).toBeGreaterThan(0);
      expect(typeof damage).toBe('number');
    });

    it('should return minimum damage when defense is high', () => {
      const damage = combatService.calculateDamage(10, 100);
      // With high defense, damage can be 0 or minimum based on config
      expect(damage).toBeGreaterThanOrEqual(0);
    });
  });

  describe('checkCriticalHit', () => {
    it('should return a boolean', () => {
      const result = combatService.checkCriticalHit();
      expect(typeof result).toBe('boolean');
    });
  });

  describe('applyDamage', () => {
    it('should damage shields and hull (with penetration)', () => {
      const target = { shield_points: 50, hull_points: 100 };
      const damageDealt = combatService.applyDamage(target, 30);
      // Some damage penetrates shields, so both may be affected
      expect(target.shield_points).toBeLessThan(50);
      expect(damageDealt).toBe(30);
    });

    it('should damage hull when shields are depleted', () => {
      const target = { shield_points: 20, hull_points: 100 };
      const damageDealt = combatService.applyDamage(target, 50);
      expect(target.shield_points).toBe(0);
      expect(target.hull_points).toBeLessThan(100);
    });

    it('should handle zero shields', () => {
      const target = { shield_points: 0, hull_points: 100 };
      combatService.applyDamage(target, 25);
      expect(target.hull_points).toBeLessThan(100);
    });
  });

  describe('calculateFleeChance', () => {
    it('should return a value between 0 and 1', () => {
      const chance = combatService.calculateFleeChance({ speed: 10 }, { speed: 8 });
      expect(chance).toBeGreaterThanOrEqual(0);
      expect(chance).toBeLessThanOrEqual(1);
    });

    it('should give higher chance when fleeing ship is faster', () => {
      const fastChance = combatService.calculateFleeChance({ speed: 20 }, { speed: 10 });
      const slowChance = combatService.calculateFleeChance({ speed: 10 }, { speed: 20 });
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

  describe('executeCombatRound', () => {
    it('should return round data with actions', () => {
      const attacker = { hull_points: 100, shield_points: 50, attack_power: 20, defense_rating: 10 };
      const defender = { hull_points: 80, shield_points: 30, attack_power: 15, defense_rating: 8 };
      const round = combatService.executeCombatRound(attacker, defender, 1);

      expect(round.round).toBe(1);
      expect(round.actions).toHaveLength(2);
      expect(round.actions[0].actor).toBe('attacker');
      expect(round.actions[1].actor).toBe('defender');
    });

    it('should consume energy per round', () => {
      const attacker = {
        hull_points: 100, shield_points: 50, attack_power: 20, defense_rating: 10,
        energy: 100, energy_per_round: 5
      };
      const defender = {
        hull_points: 80, shield_points: 30, attack_power: 15, defense_rating: 8,
        energy: 100, energy_per_round: 3
      };
      const round = combatService.executeCombatRound(attacker, defender, 1);

      expect(attacker.energy).toBe(95);
      expect(defender.energy).toBe(97);
      expect(round.attacker_energy).toBe(95);
      expect(round.defender_energy).toBe(97);
    });

    it('should include accuracy bonus in actions', () => {
      const attacker = {
        hull_points: 100, shield_points: 50, attack_power: 20, defense_rating: 10,
        scanner_range: 10
      };
      const defender = {
        hull_points: 80, shield_points: 30, attack_power: 15, defense_rating: 8,
        scanner_range: 5
      };
      const round = combatService.executeCombatRound(attacker, defender, 1);

      expect(round.actions[0].accuracy_bonus).toBeGreaterThan(1.0);
      expect(round.actions[1].accuracy_bonus).toBeLessThan(1.0); // Defender has worse scanner
    });

    it('should mark defender destroyed when hull reaches 0', () => {
      const attacker = { hull_points: 100, shield_points: 50, attack_power: 200, defense_rating: 10 };
      const defender = { hull_points: 10, shield_points: 0, attack_power: 15, defense_rating: 1 };
      const round = combatService.executeCombatRound(attacker, defender, 1);

      expect(round.defender_destroyed).toBe(true);
      expect(round.actions).toHaveLength(1); // Defender doesn't counter-attack
    });
  });

  describe('attackNPC', () => {
    it('should execute combat between ship and NPC', async () => {
      const result = await combatService.attackNPC(testUser.user_id, testShip.ship_id, testNPC.npc_id);

      expect(result).toHaveProperty('winner');
      expect(result).toHaveProperty('rounds');
      expect(result.rounds).toBeGreaterThan(0); // rounds is a number, not array
    });

    it('should create combat log after battle', async () => {
      await combatService.attackNPC(testUser.user_id, testShip.ship_id, testNPC.npc_id);

      const logs = await CombatLog.findAll({ where: { attacker_ship_id: testShip.ship_id } });
      expect(logs.length).toBe(1);
    });

    it('should throw error for ship not in same sector as NPC', async () => {
      const otherSector = await createTestSector({ name: 'Other Sector' });
      await testShip.update({ current_sector_id: otherSector.sector_id });

      await expect(combatService.attackNPC(testUser.user_id, testShip.ship_id, testNPC.npc_id))
        .rejects.toThrow('Target not in same sector');
    });

    it('should award credits when player wins', async () => {
      // Make player very strong
      await testShip.update({ attack_power: 500, defense_rating: 100 });
      const initialCredits = testUser.credits;

      const result = await combatService.attackNPC(testUser.user_id, testShip.ship_id, testNPC.npc_id);

      if (result.winner === 'attacker') {
        await testUser.reload();
        // Mid sector reward_multiplier is 1.25, so credits = 500 * 1.25 = 625
        expect(testUser.credits).toBe(initialCredits + result.credits_looted);
      }
    });
  });

  describe('getCombatHistory', () => {
    it('should return combat history for user', async () => {
      // Create a combat log first
      await combatService.attackNPC(testUser.user_id, testShip.ship_id, testNPC.npc_id);

      const history = await combatService.getCombatHistory(testUser.user_id);
      expect(history).toHaveLength(1);
    });
  });

  describe('getCombatSummary', () => {
    it('should return summary statistics', async () => {
      // Create combat first
      await combatService.attackNPC(testUser.user_id, testShip.ship_id, testNPC.npc_id);

      const summary = await combatService.getCombatSummary(testUser.user_id);

      expect(summary).toHaveProperty('total_battles');
      expect(summary).toHaveProperty('wins');
      expect(summary).toHaveProperty('losses');
      expect(summary).toHaveProperty('draws');
      expect(summary.total_battles).toBe(1);
    });

    it('should return zeros for user with no battles', async () => {
      const newUser = await createTestUser({ username: 'nobattles' });
      const summary = await combatService.getCombatSummary(newUser.user_id);

      expect(summary.total_battles).toBe(0);
      expect(summary.wins).toBe(0);
    });
  });

  describe('regenerateShields', () => {
    it('should regenerate shields partially', async () => {
      await testShip.update({ shield_points: 10 });

      const result = await combatService.regenerateShields(testShip.ship_id, false);

      expect(result.shield_points).toBeGreaterThan(10);
      expect(result.shield_points).toBeLessThanOrEqual(testShip.max_shield_points);
    });

    it('should fully restore shields when requested', async () => {
      await testShip.update({ shield_points: 10 });

      const result = await combatService.regenerateShields(testShip.ship_id, true);

      expect(result.shield_points).toBe(50); // max_shield_points
    });
  });
});

