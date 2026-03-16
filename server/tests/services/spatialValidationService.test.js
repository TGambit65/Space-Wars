const { Colony, ColonyBuilding, SurfaceAnomaly, Planet, sequelize } = require('../../src/models');
const { validatePlacement, isTileEmpty } = require('../../src/services/spatialValidationService');
const { generateTerrain, isBuildable } = require('../../src/utils/terrainGenerator');
const { createTestUser, createTestSector, createTestPlanet, createTestColony, cleanDatabase } = require('../helpers');

let testUser, testSector, testPlanet, testColony;

beforeEach(async () => {
  await cleanDatabase();

  testUser = await createTestUser({ credits: 1000000 });
  testSector = await createTestSector();
  testPlanet = await createTestPlanet(testSector.sector_id, {
    type: 'Terran', size: 5, owner_user_id: testUser.user_id
  });
  testColony = await createTestColony(testPlanet.planet_id, testUser.user_id, {
    population: 1000, infrastructure_level: 5, surface_initialized: true
  });
});

describe('validatePlacement', () => {
  test('should accept valid placement on buildable terrain', async () => {
    const { grid } = generateTerrain(testColony.colony_id, testPlanet.planet_id, 'Terran', 5);
    let validX = -1, validY = -1;
    for (let y = 2; y < grid.length - 2 && validX < 0; y++) {
      for (let x = 2; x < grid[0].length - 2 && validX < 0; x++) {
        if (isBuildable(grid[y][x])) { validX = x; validY = y; }
      }
    }

    const colony = await Colony.findByPk(testColony.colony_id, {
      include: [{ model: Planet, as: 'planet' }]
    });

    const transaction = await sequelize.transaction();
    try {
      const result = await validatePlacement(testColony.colony_id, validX, validY, 'DEFENSE_GRID', colony, transaction);
      expect(result.valid).toBe(true);
      await transaction.commit();
    } catch (err) {
      await transaction.rollback();
      throw err;
    }
  });

  test('should reject placement on landing_zone (edge)', async () => {
    const colony = await Colony.findByPk(testColony.colony_id, {
      include: [{ model: Planet, as: 'planet' }]
    });

    const transaction = await sequelize.transaction();
    try {
      const result = await validatePlacement(testColony.colony_id, 0, 0, 'DEFENSE_GRID', colony, transaction);
      expect(result.valid).toBe(false);
      expect(result.reason).toContain('not buildable');
      await transaction.commit();
    } catch (err) {
      await transaction.rollback();
      throw err;
    }
  });

  test('should reject overlapping buildings', async () => {
    const { grid } = generateTerrain(testColony.colony_id, testPlanet.planet_id, 'Terran', 5);
    let validX = -1, validY = -1;
    outer: for (let y = 2; y < grid.length - 4; y++) {
      for (let x = 2; x < grid[0].length - 4; x++) {
        let allBuildable = true;
        for (let dy = 0; dy < 3 && allBuildable; dy++) {
          for (let dx = 0; dx < 3 && allBuildable; dx++) {
            if (!isBuildable(grid[y + dy][x + dx])) allBuildable = false;
          }
        }
        if (allBuildable) { validX = x; validY = y; break outer; }
      }
    }
    if (validX < 0) return;

    await ColonyBuilding.create({
      colony_id: testColony.colony_id, building_type: 'SOLAR_ARRAY',
      level: 1, workforce: 20, condition: 1.0, is_active: true,
      grid_x: validX, grid_y: validY, placed_at: new Date()
    });

    const colony = await Colony.findByPk(testColony.colony_id, {
      include: [{ model: Planet, as: 'planet' }]
    });

    const transaction = await sequelize.transaction();
    try {
      const result = await validatePlacement(testColony.colony_id, validX + 1, validY + 1, 'HABITAT_MODULE', colony, transaction);
      expect(result.valid).toBe(false);
      expect(result.reason).toContain('Overlaps');
      await transaction.commit();
    } catch (err) {
      await transaction.rollback();
      throw err;
    }
  });

  test('should reject placement on anomaly tile', async () => {
    const { grid } = generateTerrain(testColony.colony_id, testPlanet.planet_id, 'Terran', 5);
    let validX = -1, validY = -1;
    for (let y = 2; y < grid.length - 2 && validX < 0; y++) {
      for (let x = 2; x < grid[0].length - 2 && validX < 0; x++) {
        if (isBuildable(grid[y][x])) { validX = x; validY = y; }
      }
    }

    await SurfaceAnomaly.create({
      colony_id: testColony.colony_id, grid_x: validX, grid_y: validY,
      anomaly_type: 'smuggler_cache', reward_type: 'credits',
      reward_amount: 100, expires_at: new Date(Date.now() + 86400000)
    });

    const colony = await Colony.findByPk(testColony.colony_id, {
      include: [{ model: Planet, as: 'planet' }]
    });

    const transaction = await sequelize.transaction();
    try {
      const result = await validatePlacement(testColony.colony_id, validX, validY, 'DEFENSE_GRID', colony, transaction);
      expect(result.valid).toBe(false);
      expect(result.reason).toContain('anomaly');
      await transaction.commit();
    } catch (err) {
      await transaction.rollback();
      throw err;
    }
  });

  test('should accept placement excluding self (for move)', async () => {
    const { grid } = generateTerrain(testColony.colony_id, testPlanet.planet_id, 'Terran', 5);
    let validX = -1, validY = -1;
    for (let y = 2; y < grid.length - 2 && validX < 0; y++) {
      for (let x = 2; x < grid[0].length - 2 && validX < 0; x++) {
        if (isBuildable(grid[y][x])) { validX = x; validY = y; }
      }
    }

    const building = await ColonyBuilding.create({
      colony_id: testColony.colony_id, building_type: 'DEFENSE_GRID',
      level: 1, workforce: 30, condition: 1.0, is_active: true,
      grid_x: validX, grid_y: validY, placed_at: new Date()
    });

    const colony = await Colony.findByPk(testColony.colony_id, {
      include: [{ model: Planet, as: 'planet' }]
    });

    const transaction = await sequelize.transaction();
    try {
      const result = await validatePlacement(
        testColony.colony_id, validX, validY, 'DEFENSE_GRID', colony, transaction, building.building_id
      );
      expect(result.valid).toBe(true);
      await transaction.commit();
    } catch (err) {
      await transaction.rollback();
      throw err;
    }
  });
});

describe('isTileEmpty', () => {
  test('should return true for empty buildable tile', async () => {
    const { grid } = generateTerrain(testColony.colony_id, testPlanet.planet_id, 'Terran', 5);
    let validX = -1, validY = -1;
    for (let y = 2; y < grid.length - 2 && validX < 0; y++) {
      for (let x = 2; x < grid[0].length - 2 && validX < 0; x++) {
        if (isBuildable(grid[y][x])) { validX = x; validY = y; }
      }
    }

    const colony = await Colony.findByPk(testColony.colony_id, {
      include: [{ model: Planet, as: 'planet' }]
    });

    const transaction = await sequelize.transaction();
    try {
      const result = await isTileEmpty(testColony.colony_id, validX, validY, colony, transaction);
      expect(result).toBe(true);
      await transaction.commit();
    } catch (err) {
      await transaction.rollback();
      throw err;
    }
  });

  test('should return false for tile occupied by building', async () => {
    const { grid } = generateTerrain(testColony.colony_id, testPlanet.planet_id, 'Terran', 5);
    let validX = -1, validY = -1;
    for (let y = 2; y < grid.length - 2 && validX < 0; y++) {
      for (let x = 2; x < grid[0].length - 2 && validX < 0; x++) {
        if (isBuildable(grid[y][x])) { validX = x; validY = y; }
      }
    }

    await ColonyBuilding.create({
      colony_id: testColony.colony_id, building_type: 'DEFENSE_GRID',
      level: 1, workforce: 30, condition: 1.0, is_active: true,
      grid_x: validX, grid_y: validY, placed_at: new Date()
    });

    const colony = await Colony.findByPk(testColony.colony_id, {
      include: [{ model: Planet, as: 'planet' }]
    });

    const transaction = await sequelize.transaction();
    try {
      const result = await isTileEmpty(testColony.colony_id, validX, validY, colony, transaction);
      expect(result).toBe(false);
      await transaction.commit();
    } catch (err) {
      await transaction.rollback();
      throw err;
    }
  });

  test('should return false for unbuildable terrain', async () => {
    const colony = await Colony.findByPk(testColony.colony_id, {
      include: [{ model: Planet, as: 'planet' }]
    });

    const transaction = await sequelize.transaction();
    try {
      const result = await isTileEmpty(testColony.colony_id, 0, 0, colony, transaction);
      expect(result).toBe(false);
      await transaction.commit();
    } catch (err) {
      await transaction.rollback();
      throw err;
    }
  });
});
