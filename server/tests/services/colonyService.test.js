/**
 * Colony Service Tests
 */
const colonyService = require('../../src/services/colonyService');
const { Colony, Planet, PlanetResource, Ship, User, Commodity, ShipCargo } = require('../../src/models');
const { createTestUser, createTestSector, createTestShip, createTestPlanet, createTestPlanetResource, createTestColony, createTestCommodity, cleanDatabase } = require('../helpers');

describe('Colony Service', () => {
  let testUser, testSector, testShip, testPlanet;

  beforeAll(async () => {
    await cleanDatabase();
  });

  afterAll(async () => {
    await cleanDatabase();
  });

  beforeEach(async () => {
    testSector = await createTestSector({ name: 'Colony Test Sector' });
    testUser = await createTestUser({ credits: 50000 });
    testShip = await createTestShip(testUser.user_id, testSector.sector_id, { ship_type: 'Colony Ship', cargo_capacity: 100 });
    testPlanet = await createTestPlanet(testSector.sector_id, { name: 'Colonizable Planet', habitability: 0.8 });
    await createTestPlanetResource(testPlanet.planet_id, { resource_type: 'Iron Ore', abundance: 2.0, total_quantity: 10000 });
  });

  describe('colonizePlanet', () => {
    it('should successfully colonize a planet', async () => {
      const result = await colonyService.colonizePlanet(testPlanet.planet_id, testUser.user_id, testShip.ship_id, 'New Colony');

      expect(result).toHaveProperty('colony');
      expect(result.colony.name).toBe('New Colony');
      expect(result.colony.user_id).toBe(testUser.user_id);
      expect(result).toHaveProperty('credits_spent', 10000);
    });

    it('should deduct colonization cost from user', async () => {
      const initialCredits = testUser.credits;
      await colonyService.colonizePlanet(testPlanet.planet_id, testUser.user_id, testShip.ship_id);

      const updatedUser = await User.findByPk(testUser.user_id);
      expect(Number(updatedUser.credits)).toBe(initialCredits - 10000);
    });

    it('should set planet owner', async () => {
      await colonyService.colonizePlanet(testPlanet.planet_id, testUser.user_id, testShip.ship_id);

      const updatedPlanet = await Planet.findByPk(testPlanet.planet_id);
      expect(updatedPlanet.owner_user_id).toBe(testUser.user_id);
    });

    it('should throw error if planet already colonized', async () => {
      await colonyService.colonizePlanet(testPlanet.planet_id, testUser.user_id, testShip.ship_id);

      const anotherUser = await createTestUser({ credits: 50000 });
      const anotherShip = await createTestShip(anotherUser.user_id, testSector.sector_id, { ship_type: 'Colony Ship' });

      await expect(colonyService.colonizePlanet(testPlanet.planet_id, anotherUser.user_id, anotherShip.ship_id))
        .rejects.toThrow('Planet is already colonized');
    });

    it('should throw error if insufficient credits', async () => {
      const poorUser = await createTestUser({ credits: 100 });
      const poorShip = await createTestShip(poorUser.user_id, testSector.sector_id, { ship_type: 'Colony Ship' });

      await expect(colonyService.colonizePlanet(testPlanet.planet_id, poorUser.user_id, poorShip.ship_id))
        .rejects.toThrow('Insufficient credits');
    });

    it('should throw error if ship not in same sector', async () => {
      const otherSector = await createTestSector({ name: 'Other Sector' });
      const farShip = await createTestShip(testUser.user_id, otherSector.sector_id, { ship_type: 'Colony Ship' });

      await expect(colonyService.colonizePlanet(testPlanet.planet_id, testUser.user_id, farShip.ship_id))
        .rejects.toThrow('Ship must be in the same sector as the planet');
    });

    it('should require Colony Ship hull type', async () => {
      const scoutShip = await createTestShip(testUser.user_id, testSector.sector_id, { ship_type: 'Scout' });

      await expect(colonyService.colonizePlanet(testPlanet.planet_id, testUser.user_id, scoutShip.ship_id))
        .rejects.toThrow('Colony Ship required');
    });
  });

  describe('getUserColonies', () => {
    it('should return empty array for user with no colonies', async () => {
      const colonies = await colonyService.getUserColonies(testUser.user_id);
      expect(colonies).toEqual([]);
    });

    it('should return user colonies with planet data', async () => {
      await colonyService.colonizePlanet(testPlanet.planet_id, testUser.user_id, testShip.ship_id, 'My Colony');

      const colonies = await colonyService.getUserColonies(testUser.user_id);

      expect(colonies.length).toBe(1);
      expect(colonies[0].name).toBe('My Colony');
      expect(colonies[0].planet).toBeDefined();
      expect(colonies[0].planet.name).toBe('Colonizable Planet');
    });
  });

  describe('getColonyDetails', () => {
    it('should return colony details', async () => {
      const { colony } = await colonyService.colonizePlanet(testPlanet.planet_id, testUser.user_id, testShip.ship_id);

      const details = await colonyService.getColonyDetails(colony.colony_id, testUser.user_id);

      expect(details.colony_id).toBe(colony.colony_id);
      expect(details.planet).toBeDefined();
      expect(details.planet.resources).toBeDefined();
    });

    it('should throw error for non-existent colony', async () => {
      await expect(colonyService.getColonyDetails('00000000-0000-0000-0000-000000000000', testUser.user_id))
        .rejects.toThrow('Colony not found');
    });
  });

  describe('processResourceGeneration', () => {
    let colony, metalsCommodity;

    beforeEach(async () => {
      // Find or create a metals commodity for resource transfer (may exist from seeder)
      const { Commodity } = require('../../src/models');
      [metalsCommodity] = await Commodity.findOrCreate({
        where: { name: 'Metals' },
        defaults: { base_price: 50, volume_per_unit: 1, category: 'Essential', volatility: 0.2, description: 'Metals commodity' }
      });

      // Create colony with old last_resource_tick
      const result = await colonyService.colonizePlanet(testPlanet.planet_id, testUser.user_id, testShip.ship_id);
      colony = result.colony;
      // Set last_resource_tick to 2 hours ago
      await colony.update({ last_resource_tick: new Date(Date.now() - 2 * 60 * 60 * 1000) });
    });

    it('should generate resources', async () => {
      const result = await colonyService.processResourceGeneration(colony.colony_id, testUser.user_id);

      expect(result).toHaveProperty('hours_passed');
      expect(result).toHaveProperty('resources_generated');
      expect(result.resources_generated.length).toBeGreaterThan(0);
    });

    it('should transfer resources to ship cargo when ship_id provided', async () => {
      const result = await colonyService.processResourceGeneration(colony.colony_id, testUser.user_id, testShip.ship_id);

      expect(result.resources_transferred).toBeDefined();
      expect(result.ship_id).toBe(testShip.ship_id);
    });

    it('should throw error if less than 1 hour since last collection', async () => {
      await colony.update({ last_resource_tick: new Date() });

      await expect(colonyService.processResourceGeneration(colony.colony_id, testUser.user_id))
        .rejects.toThrow('Resources can only be collected once per hour');
    });
  });

  describe('upgradeInfrastructure', () => {
    let colony;

    beforeEach(async () => {
      const result = await colonyService.colonizePlanet(testPlanet.planet_id, testUser.user_id, testShip.ship_id);
      colony = result.colony;
    });

    it('should upgrade infrastructure level', async () => {
      const result = await colonyService.upgradeInfrastructure(colony.colony_id, testUser.user_id);

      expect(result.new_infrastructure_level).toBe(2);
      expect(result).toHaveProperty('credits_spent');
    });

    it('should deduct upgrade cost from user', async () => {
      const userBefore = await User.findByPk(testUser.user_id);
      const creditsBefore = Number(userBefore.credits);

      await colonyService.upgradeInfrastructure(colony.colony_id, testUser.user_id);

      const userAfter = await User.findByPk(testUser.user_id);
      expect(Number(userAfter.credits)).toBeLessThan(creditsBefore);
    });

    it('should throw error if insufficient credits', async () => {
      await testUser.update({ credits: 0 });

      await expect(colonyService.upgradeInfrastructure(colony.colony_id, testUser.user_id))
        .rejects.toThrow('Insufficient credits');
    });

    it('should throw error at max infrastructure level', async () => {
      await colony.update({ infrastructure_level: 10 });

      await expect(colonyService.upgradeInfrastructure(colony.colony_id, testUser.user_id))
        .rejects.toThrow('Colony is at maximum infrastructure level');
    });
  });

  describe('abandonColony', () => {
    let colony;

    beforeEach(async () => {
      const result = await colonyService.colonizePlanet(testPlanet.planet_id, testUser.user_id, testShip.ship_id);
      colony = result.colony;
    });

    it('should abandon colony successfully', async () => {
      const result = await colonyService.abandonColony(colony.colony_id, testUser.user_id);

      expect(result.message).toBe('Colony abandoned successfully');
    });

    it('should clear planet ownership', async () => {
      await colonyService.abandonColony(colony.colony_id, testUser.user_id);

      const planet = await Planet.findByPk(testPlanet.planet_id);
      expect(planet.owner_user_id).toBeNull();
    });

    it('should delete colony record', async () => {
      await colonyService.abandonColony(colony.colony_id, testUser.user_id);

      const deletedColony = await Colony.findByPk(colony.colony_id);
      expect(deletedColony).toBeNull();
    });

    it('should throw error for non-existent colony', async () => {
      await expect(colonyService.abandonColony('00000000-0000-0000-0000-000000000000', testUser.user_id))
        .rejects.toThrow('Colony not found');
    });
  });
});

