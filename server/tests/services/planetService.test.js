/**
 * Planet Service Tests
 */
const planetService = require('../../src/services/planetService');
const { Planet, PlanetResource, Artifact, Sector, Ship, PlayerDiscovery, User } = require('../../src/models');
const { createTestUser, createTestSector, createTestShip, createTestPlanet, createTestPlanetResource, createTestArtifact, cleanDatabase } = require('../helpers');

describe('Planet Service', () => {
  let testUser, testSector, testShip, testPlanet;

  beforeAll(async () => {
    await cleanDatabase();
  });

  afterAll(async () => {
    await cleanDatabase();
  });

  beforeEach(async () => {
    testSector = await createTestSector({ name: 'Planet Test Sector' });
    testUser = await createTestUser({ credits: 50000 });
    testShip = await createTestShip(testUser.user_id, testSector.sector_id);
    testPlanet = await createTestPlanet(testSector.sector_id, { name: 'Test Planet Alpha' });
    await createTestPlanetResource(testPlanet.planet_id, { resource_type: 'Iron Ore', abundance: 2.0 });
    await createTestPlanetResource(testPlanet.planet_id, { resource_type: 'Water', abundance: 1.5 });
  });

  describe('scanSector', () => {
    it('should discover planets in a sector', async () => {
      const result = await planetService.scanSector(testSector.sector_id, testUser.user_id, testShip.ship_id);

      expect(result).toHaveProperty('sector_id', testSector.sector_id);
      expect(result).toHaveProperty('planets');
      expect(result.planets.length).toBeGreaterThan(0);
      expect(result.planets[0]).toHaveProperty('planet_id');
      expect(result.planets[0]).toHaveProperty('name', 'Test Planet Alpha');
      expect(result.planets[0]).toHaveProperty('type', 'Terran');
    });

    it('should create player discovery records', async () => {
      await planetService.scanSector(testSector.sector_id, testUser.user_id, testShip.ship_id);

      const discovery = await PlayerDiscovery.findOne({
        where: { user_id: testUser.user_id, discovery_type: 'planet', target_id: testPlanet.planet_id }
      });

      expect(discovery).not.toBeNull();
      expect(discovery.discovery_data).toHaveProperty('basic_scan', true);
    });

    it('should throw error for non-existent sector', async () => {
      await expect(planetService.scanSector('00000000-0000-0000-0000-000000000000', testUser.user_id, testShip.ship_id))
        .rejects.toThrow('Sector not found');
    });

    it('should throw error if ship is not in the sector', async () => {
      const otherSector = await createTestSector({ name: 'Other Sector' });
      const otherShip = await createTestShip(testUser.user_id, otherSector.sector_id);

      await expect(planetService.scanSector(testSector.sector_id, testUser.user_id, otherShip.ship_id))
        .rejects.toThrow('Ship must be in the sector to scan it');
    });
  });

  describe('getPlanetDetails', () => {
    it('should return planet details', async () => {
      // First scan to discover
      await planetService.scanSector(testSector.sector_id, testUser.user_id, testShip.ship_id);

      const details = await planetService.getPlanetDetails(testPlanet.planet_id, testUser.user_id, testShip.ship_id);

      expect(details).toHaveProperty('planet_id', testPlanet.planet_id);
      expect(details).toHaveProperty('name', 'Test Planet Alpha');
      expect(details).toHaveProperty('type', 'Terran');
      expect(details).toHaveProperty('size');
      expect(details).toHaveProperty('gravity');
      expect(details).toHaveProperty('habitability');
    });

    it('should show resources when ship is in sector (deep scan)', async () => {
      await planetService.scanSector(testSector.sector_id, testUser.user_id, testShip.ship_id);
      const details = await planetService.getPlanetDetails(testPlanet.planet_id, testUser.user_id, testShip.ship_id);

      expect(details.resources).toBeDefined();
      expect(details.resources.length).toBe(2);
      expect(details.resources[0]).toHaveProperty('resource_type');
      expect(details.resources[0]).toHaveProperty('abundance');
    });

    it('should throw error for non-existent planet', async () => {
      await expect(planetService.getPlanetDetails('00000000-0000-0000-0000-000000000000', testUser.user_id))
        .rejects.toThrow('Planet not found');
    });
  });

  describe('artifact discovery', () => {
    it('should discover artifact on deep scan of planet with artifact', async () => {
      // Create planet with artifact
      const artifactPlanet = await createTestPlanet(testSector.sector_id, { name: 'Artifact Planet', has_artifact: true });
      const artifact = await createTestArtifact(artifactPlanet.planet_id, { name: 'Ancient Star Map' });

      // Do deep scan (ship in sector)
      const details = await planetService.getPlanetDetails(artifactPlanet.planet_id, testUser.user_id, testShip.ship_id);

      expect(details.artifact_detected).toBe(true);

      // Check artifact was marked as discovered
      const updatedArtifact = await Artifact.findByPk(artifact.artifact_id);
      expect(updatedArtifact.is_discovered).toBe(true);
      expect(updatedArtifact.discovered_by_user_id).toBe(testUser.user_id);
    });
  });

  describe('getUserPlanets', () => {
    it('should return empty array for user with no planets', async () => {
      const planets = await planetService.getUserPlanets(testUser.user_id);
      expect(planets).toEqual([]);
    });

    it('should return owned planets', async () => {
      await testPlanet.update({ owner_user_id: testUser.user_id });
      const planets = await planetService.getUserPlanets(testUser.user_id);

      expect(planets.length).toBe(1);
      expect(planets[0].planet_id).toBe(testPlanet.planet_id);
    });
  });

  describe('claimArtifact', () => {
    it('should allow claiming artifact from owned planet', async () => {
      // Create owned planet with discovered artifact
      const ownedPlanet = await createTestPlanet(testSector.sector_id, { 
        name: 'Owned Planet', 
        owner_user_id: testUser.user_id,
        has_artifact: true 
      });
      const artifact = await createTestArtifact(ownedPlanet.planet_id, { 
        name: 'Claimed Artifact',
        is_discovered: true,
        discovered_by_user_id: testUser.user_id
      });

      const claimed = await planetService.claimArtifact(artifact.artifact_id, testUser.user_id);

      expect(claimed.owner_user_id).toBe(testUser.user_id);
      expect(claimed.location_planet_id).toBeNull();
    });

    it('should throw error if artifact not discovered', async () => {
      const planet = await createTestPlanet(testSector.sector_id, { owner_user_id: testUser.user_id });
      const artifact = await createTestArtifact(planet.planet_id, { is_discovered: false });

      await expect(planetService.claimArtifact(artifact.artifact_id, testUser.user_id))
        .rejects.toThrow('Artifact has not been discovered yet');
    });
  });
});

