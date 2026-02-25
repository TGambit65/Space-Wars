/**
 * Crew Bonus Service Tests
 */
const crewBonusService = require('../../src/services/crewBonusService');
const { Crew, Ship, User, Sector } = require('../../src/models');
const { createTestUser, createTestSector, createTestShip, createTestCrew, cleanDatabase } = require('../helpers');

describe('Crew Bonus Service', () => {
  let testUser, testSector, testShip;

  beforeAll(async () => {
    await cleanDatabase();
  });

  afterAll(async () => {
    await cleanDatabase();
  });

  beforeEach(async () => {
    await cleanDatabase();
    testSector = await createTestSector({ name: 'Bonus Test Sector' });
    testUser = await createTestUser({ credits: 50000 });
    testShip = await createTestShip(testUser.user_id, testSector.sector_id);
  });

  describe('calculateShipCrewBonuses', () => {
    it('should return zero bonuses for ship with no crew', async () => {
      const result = await crewBonusService.calculateShipCrewBonuses(testShip.ship_id);

      expect(result.crew_count).toBe(0);
      expect(result.bonuses.piloting).toBe(0);
      expect(result.bonuses.combat).toBe(0);
    });

    it('should calculate bonuses based on crew species', async () => {
      // Human has balanced stats: piloting: 1.0, engineering: 1.0, combat: 1.0, science: 1.0
      await createTestCrew(null, testUser.user_id, testShip.ship_id, {
        name: 'Human Pilot',
        species: 'Human',
        level: 1
      });

      const result = await crewBonusService.calculateShipCrewBonuses(testShip.ship_id);

      expect(result.crew_count).toBe(1);
      expect(result.bonuses.piloting).toBeGreaterThan(0);
      expect(result.bonuses.combat).toBeGreaterThan(0);
      expect(result.bonuses.engineering).toBeGreaterThan(0);
    });

    it('should apply level multiplier to bonuses', async () => {
      // Level 1 crew
      const level1Crew = await createTestCrew(null, testUser.user_id, testShip.ship_id, {
        name: 'Level 1 Crew',
        species: 'Human',
        level: 1
      });

      const result1 = await crewBonusService.calculateShipCrewBonuses(testShip.ship_id);
      
      // Update to level 5
      await level1Crew.update({ level: 5 });

      const result5 = await crewBonusService.calculateShipCrewBonuses(testShip.ship_id);

      // Level 5 should have higher bonuses than level 1
      expect(result5.bonuses.piloting).toBeGreaterThan(result1.bonuses.piloting);
    });

    it('should add role bonuses when crew is assigned a role', async () => {
      await createTestCrew(null, testUser.user_id, testShip.ship_id, {
        name: 'Unassigned Crew',
        species: 'Human',
        level: 3,
        assigned_role: null
      });

      const resultNoRole = await crewBonusService.calculateShipCrewBonuses(testShip.ship_id);

      // Assign as Pilot
      await Crew.update(
        { assigned_role: 'Pilot' },
        { where: { current_ship_id: testShip.ship_id } }
      );

      const resultWithRole = await crewBonusService.calculateShipCrewBonuses(testShip.ship_id);

      expect(resultWithRole.bonuses.speed).toBeGreaterThan(resultNoRole.bonuses.speed);
      expect(resultWithRole.bonuses.flee).toBeGreaterThan(resultNoRole.bonuses.flee);
    });

    it('should accumulate bonuses from multiple crew members', async () => {
      await createTestCrew(null, testUser.user_id, testShip.ship_id, {
        name: 'Crew 1',
        species: 'Human',
        level: 2
      });

      const result1Crew = await crewBonusService.calculateShipCrewBonuses(testShip.ship_id);

      await createTestCrew(null, testUser.user_id, testShip.ship_id, {
        name: 'Crew 2',
        species: 'Human',
        level: 2
      });

      const result2Crew = await crewBonusService.calculateShipCrewBonuses(testShip.ship_id);

      expect(result2Crew.crew_count).toBe(2);
      expect(result2Crew.bonuses.piloting).toBeGreaterThan(result1Crew.bonuses.piloting);
    });

    it('should cap bonuses at maximum value', async () => {
      // Create many high-level crew to test capping
      for (let i = 0; i < 5; i++) {
        await createTestCrew(null, testUser.user_id, testShip.ship_id, {
          name: `Crew ${i}`,
          species: 'Human',
          level: 10,
          assigned_role: 'Gunner'
        });
      }

      const result = await crewBonusService.calculateShipCrewBonuses(testShip.ship_id);

      // Check bonuses are capped at 2.0 (200%)
      expect(result.bonuses.damage).toBeLessThanOrEqual(2.0);
    });
  });

  describe('getCrewEffectivenessSummary', () => {
    it('should return effectiveness percentages', async () => {
      await createTestCrew(null, testUser.user_id, testShip.ship_id, {
        name: 'Test Crew',
        species: 'Human',
        level: 3,
        assigned_role: 'Pilot'
      });

      const summary = await crewBonusService.getCrewEffectivenessSummary(testShip.ship_id);

      expect(summary).toHaveProperty('crew_count', 1);
      expect(summary).toHaveProperty('effectiveness');
      expect(summary.effectiveness).toHaveProperty('combat');
      expect(summary.effectiveness).toHaveProperty('navigation');
      expect(summary.effectiveness).toHaveProperty('engineering');
      expect(summary.effectiveness).toHaveProperty('science');
      expect(summary).toHaveProperty('raw_bonuses');
    });
  });
});

