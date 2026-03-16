const { Colony, ColonyBuilding, SurfaceAnomaly } = require('../../src/models');
const colonySurfaceService = require('../../src/services/colonySurfaceService');
const { generateTerrain, isBuildable } = require('../../src/utils/terrainGenerator');
const { createTestUser, createTestSector, createTestPlanet, createTestColony, cleanDatabase } = require('../helpers');

let testUser, testSector, testPlanet, testColony;

beforeEach(async () => {
  await cleanDatabase();

  testUser = await createTestUser({ credits: 1000000 });
  testSector = await createTestSector();
  testPlanet = await createTestPlanet(testSector.sector_id, {
    type: 'Terran',
    size: 5,
    owner_user_id: testUser.user_id
  });
  testColony = await createTestColony(testPlanet.planet_id, testUser.user_id, {
    population: 1000,
    infrastructure_level: 5
  });
});

describe('Terrain Generation', () => {
  test('should generate deterministic terrain grid', () => {
    const result1 = generateTerrain('colony1', 'planet1', 'Terran', 5);
    const result2 = generateTerrain('colony1', 'planet1', 'Terran', 5);

    expect(result1.grid).toEqual(result2.grid);
    expect(result1.width).toBe(32);
    expect(result1.height).toBe(32);
  });

  test('should produce different terrain for different seeds', () => {
    const result1 = generateTerrain('colonyA', 'planetA', 'Terran', 5);
    const result2 = generateTerrain('colonyB', 'planetB', 'Terran', 5);

    let different = false;
    for (let y = 1; y < result1.height - 1; y++) {
      for (let x = 1; x < result1.width - 1; x++) {
        if (result1.grid[y][x] !== result2.grid[y][x]) { different = true; break; }
      }
      if (different) break;
    }
    expect(different).toBe(true);
  });

  test('should have landing_zone on edges', () => {
    const { grid, width, height } = generateTerrain('test', 'test', 'Terran', 3);
    for (let x = 0; x < width; x++) {
      expect(grid[0][x]).toBe('landing_zone');
      expect(grid[height - 1][x]).toBe('landing_zone');
    }
    for (let y = 0; y < height; y++) {
      expect(grid[y][0]).toBe('landing_zone');
      expect(grid[y][width - 1]).toBe('landing_zone');
    }
  });

  test('should scale grid size with planet size', () => {
    expect(generateTerrain('c', 'p', 'Terran', 1).width).toBe(24);
    expect(generateTerrain('c', 'p', 'Terran', 5).width).toBe(32);
    expect(generateTerrain('c', 'p', 'Terran', 8).width).toBe(40);
    expect(generateTerrain('c', 'p', 'Terran', 10).width).toBe(48);
  });

  test('should generate terrain for all planet types', () => {
    const types = ['Terran', 'Desert', 'Ice', 'Volcanic', 'Gas Giant', 'Oceanic', 'Barren', 'Jungle', 'Toxic', 'Crystalline'];
    for (const type of types) {
      const result = generateTerrain('test', 'test', type, 5);
      expect(result.grid.length).toBe(32);
      expect(result.grid[0].length).toBe(32);
    }
  });
});

describe('getSurface', () => {
  test('should return needs_initialization for uninitialized colony', async () => {
    const result = await colonySurfaceService.getSurface(testColony.colony_id, testUser.user_id);
    expect(result.needs_initialization).toBe(true);
    expect(result.terrain).toBeDefined();
    expect(result.width).toBeGreaterThan(0);
  });

  test('should return full data for initialized colony', async () => {
    await testColony.update({ surface_initialized: true });
    const result = await colonySurfaceService.getSurface(testColony.colony_id, testUser.user_id);

    expect(result.needs_initialization).toBe(false);
    expect(result.terrain).toBeDefined();
    expect(result.buildings).toBeDefined();
    expect(result.unplaced).toBeDefined();
    expect(result.anomalies).toBeDefined();
    expect(result.colony).toBeDefined();
  });

  test('should reject for non-owner', async () => {
    const otherUser = await createTestUser({ username: 'otheruser' });
    await expect(
      colonySurfaceService.getSurface(testColony.colony_id, otherUser.user_id)
    ).rejects.toThrow('Colony not found or not owned');
  });
});

describe('initializeSurface', () => {
  test('should auto-place existing buildings', async () => {
    await ColonyBuilding.create({
      colony_id: testColony.colony_id, building_type: 'SURFACE_MINE',
      level: 1, workforce: 50, condition: 1.0, is_active: true
    });
    await ColonyBuilding.create({
      colony_id: testColony.colony_id, building_type: 'SOLAR_ARRAY',
      level: 1, workforce: 20, condition: 1.0, is_active: true
    });

    const result = await colonySurfaceService.initializeSurface(testColony.colony_id, testUser.user_id);

    expect(result.auto_placed).toBe(true);
    expect(result.placed_count).toBe(2);
    expect(result.unplaced_count).toBe(0);

    await testColony.reload();
    expect(testColony.surface_initialized).toBe(true);

    const buildings = await ColonyBuilding.findAll({ where: { colony_id: testColony.colony_id } });
    for (const b of buildings) {
      expect(b.grid_x).not.toBeNull();
      expect(b.grid_y).not.toBeNull();
    }
  });

  test('should be idempotent', async () => {
    await testColony.update({ surface_initialized: true });
    const result = await colonySurfaceService.initializeSurface(testColony.colony_id, testUser.user_id);
    expect(result.auto_placed).toBe(false);
  });
});

describe('placeBuilding', () => {
  beforeEach(async () => {
    await testColony.update({ surface_initialized: true });
  });

  test('should place unplaced building at valid position', async () => {
    await ColonyBuilding.create({
      colony_id: testColony.colony_id, building_type: 'DEFENSE_GRID',
      level: 1, workforce: 30, condition: 1.0, is_active: true, grid_x: null, grid_y: null
    });

    const { grid } = generateTerrain(testColony.colony_id, testPlanet.planet_id, testPlanet.type, testPlanet.size);
    let placeX = -1, placeY = -1;
    for (let y = 2; y < grid.length - 2 && placeX < 0; y++) {
      for (let x = 2; x < grid[0].length - 2 && placeX < 0; x++) {
        if (isBuildable(grid[y][x])) { placeX = x; placeY = y; }
      }
    }

    const result = await colonySurfaceService.placeBuilding(
      testColony.colony_id, testUser.user_id, 'DEFENSE_GRID', placeX, placeY
    );
    expect(result.grid_x).toBe(placeX);
    expect(result.grid_y).toBe(placeY);
  });

  test('should reject placement on unbuildable terrain', async () => {
    await ColonyBuilding.create({
      colony_id: testColony.colony_id, building_type: 'DEFENSE_GRID',
      level: 1, workforce: 30, condition: 1.0, is_active: true, grid_x: null
    });
    await expect(
      colonySurfaceService.placeBuilding(testColony.colony_id, testUser.user_id, 'DEFENSE_GRID', 0, 0)
    ).rejects.toThrow();
  });

  test('should reject overlapping placement', async () => {
    const { grid } = generateTerrain(testColony.colony_id, testPlanet.planet_id, testPlanet.type, testPlanet.size);
    let placeX = -1, placeY = -1;
    for (let y = 2; y < grid.length - 4 && placeX < 0; y++) {
      for (let x = 2; x < grid[0].length - 4 && placeX < 0; x++) {
        if (isBuildable(grid[y][x]) && isBuildable(grid[y][x+1]) && isBuildable(grid[y+1][x]) && isBuildable(grid[y+1][x+1])) {
          placeX = x; placeY = y;
        }
      }
    }
    if (placeX < 0) return;

    await ColonyBuilding.create({
      colony_id: testColony.colony_id, building_type: 'SOLAR_ARRAY',
      level: 1, workforce: 20, condition: 1.0, is_active: true,
      grid_x: placeX, grid_y: placeY, placed_at: new Date()
    });

    await ColonyBuilding.create({
      colony_id: testColony.colony_id, building_type: 'SOLAR_ARRAY',
      level: 1, workforce: 20, condition: 1.0, is_active: true, grid_x: null
    });

    await expect(
      colonySurfaceService.placeBuilding(testColony.colony_id, testUser.user_id, 'SOLAR_ARRAY', placeX, placeY)
    ).rejects.toThrow('Overlaps');
  });
});

describe('undoPlacement', () => {
  test('should undo within 10-second window', async () => {
    await testColony.update({ surface_initialized: true });

    const { grid } = generateTerrain(testColony.colony_id, testPlanet.planet_id, testPlanet.type, testPlanet.size);
    let placeX = -1, placeY = -1;
    for (let y = 2; y < grid.length - 2 && placeX < 0; y++) {
      for (let x = 2; x < grid[0].length - 2 && placeX < 0; x++) {
        if (isBuildable(grid[y][x])) { placeX = x; placeY = y; }
      }
    }

    const building = await ColonyBuilding.create({
      colony_id: testColony.colony_id, building_type: 'DEFENSE_GRID',
      level: 1, workforce: 30, condition: 1.0, is_active: true,
      grid_x: placeX, grid_y: placeY, placed_at: new Date()
    });

    const result = await colonySurfaceService.undoPlacement(testColony.colony_id, testUser.user_id, building.building_id);
    expect(result.undone).toBe(true);

    await building.reload();
    expect(building.grid_x).toBeNull();
    expect(building.grid_y).toBeNull();
  });

  test('should reject undo after window expires', async () => {
    await testColony.update({ surface_initialized: true });
    const building = await ColonyBuilding.create({
      colony_id: testColony.colony_id, building_type: 'DEFENSE_GRID',
      level: 1, workforce: 30, condition: 1.0, is_active: true,
      grid_x: 5, grid_y: 5, placed_at: new Date(Date.now() - 30000)
    });

    await expect(
      colonySurfaceService.undoPlacement(testColony.colony_id, testUser.user_id, building.building_id)
    ).rejects.toThrow('Undo window expired');
  });
});

describe('claimAnomaly', () => {
  test('should claim anomaly and award credits', async () => {
    await testColony.update({ surface_initialized: true });
    const anomaly = await SurfaceAnomaly.create({
      colony_id: testColony.colony_id, grid_x: 5, grid_y: 5,
      anomaly_type: 'smuggler_cache', reward_type: 'credits',
      reward_amount: 200, expires_at: new Date(Date.now() + 86400000)
    });

    const initialCredits = Number(testUser.credits);
    const result = await colonySurfaceService.claimAnomaly(testColony.colony_id, testUser.user_id, anomaly.anomaly_id);

    expect(result.claimed).toBe(true);
    expect(result.reward_amount).toBe(200);

    await testUser.reload();
    expect(Number(testUser.credits)).toBe(initialCredits + 200);

    const found = await SurfaceAnomaly.findByPk(anomaly.anomaly_id);
    expect(found).toBeNull();
  });

  test('should reject expired anomaly', async () => {
    await testColony.update({ surface_initialized: true });
    const anomaly = await SurfaceAnomaly.create({
      colony_id: testColony.colony_id, grid_x: 5, grid_y: 5,
      anomaly_type: 'smuggler_cache', reward_type: 'credits',
      reward_amount: 200, expires_at: new Date(Date.now() - 1000)
    });

    await expect(
      colonySurfaceService.claimAnomaly(testColony.colony_id, testUser.user_id, anomaly.anomaly_id)
    ).rejects.toThrow('expired');
  });
});

describe('repairBuildings', () => {
  test('should repair all damaged buildings', async () => {
    await testColony.update({ surface_initialized: true });
    await ColonyBuilding.create({
      colony_id: testColony.colony_id, building_type: 'SURFACE_MINE',
      level: 1, workforce: 50, condition: 0.5, is_active: true, grid_x: 5, grid_y: 5
    });
    await ColonyBuilding.create({
      colony_id: testColony.colony_id, building_type: 'SOLAR_ARRAY',
      level: 1, workforce: 20, condition: 0.75, is_active: true, grid_x: 8, grid_y: 8
    });

    const result = await colonySurfaceService.repairBuildings(testColony.colony_id, testUser.user_id, { all: true });

    expect(result.repaired).toBe(2);
    expect(result.total_cost).toBeGreaterThan(0);

    const buildings = await ColonyBuilding.findAll({ where: { colony_id: testColony.colony_id } });
    for (const b of buildings) {
      expect(b.condition).toBe(1.0);
    }
  });
});
