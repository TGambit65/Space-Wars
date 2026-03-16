const { Colony, ColonyBuilding, CustomBlock, User, Planet } = require('../../src/models');
const customBlockService = require('../../src/services/customBlockService');
const { generateTerrain, isBuildable } = require('../../src/utils/terrainGenerator');
const { createTestUser, createTestSector, createTestPlanet, createTestColony, cleanDatabase } = require('../helpers');
const config = require('../../src/config');

let testUser, testSector, testPlanet, testColony;
let validX, validY; // a known buildable tile

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
    infrastructure_level: 5,
    surface_initialized: true
  });

  // Find a valid buildable tile (not on edge)
  const { grid, width, height } = generateTerrain(testColony.colony_id, testPlanet.planet_id, testPlanet.type, testPlanet.size);
  validX = -1;
  validY = -1;
  for (let y = 2; y < height - 2 && validX < 0; y++) {
    for (let x = 2; x < width - 2 && validX < 0; x++) {
      if (isBuildable(grid[y][x])) { validX = x; validY = y; }
    }
  }
});

describe('getBlocks', () => {
  test('should return empty array for colony with no blocks', async () => {
    const blocks = await customBlockService.getBlocks(testColony.colony_id, testUser.user_id);
    expect(blocks).toEqual([]);
  });

  test('should return blocks for colony', async () => {
    await CustomBlock.create({
      colony_id: testColony.colony_id,
      block_type: 'wall',
      grid_x: validX,
      grid_y: validY
    });

    const blocks = await customBlockService.getBlocks(testColony.colony_id, testUser.user_id);
    expect(blocks).toHaveLength(1);
    expect(blocks[0].block_type).toBe('wall');
  });

  test('should reject for non-owner', async () => {
    const otherUser = await createTestUser({ username: 'other' });
    await expect(
      customBlockService.getBlocks(testColony.colony_id, otherUser.user_id)
    ).rejects.toThrow('Colony not found or not owned');
  });
});

describe('placeBlock', () => {
  test('should place a wall block', async () => {
    const block = await customBlockService.placeBlock(
      testColony.colony_id, testUser.user_id, 'wall', validX, validY
    );

    expect(block.block_type).toBe('wall');
    expect(block.grid_x).toBe(validX);
    expect(block.grid_y).toBe(validY);
    expect(block.rotation).toBe(0);

    // Verify credits deducted
    await testUser.reload();
    expect(Number(testUser.credits)).toBe(1000000 - config.customBlocks.blockTypes.wall.cost);
  });

  test('should place a floor block under a building footprint', async () => {
    // Place a building first
    await ColonyBuilding.create({
      colony_id: testColony.colony_id,
      building_type: 'DEFENSE_GRID',
      level: 1, workforce: 30, condition: 1.0, is_active: true,
      grid_x: validX, grid_y: validY, placed_at: new Date()
    });

    // Floor block should succeed under building
    const block = await customBlockService.placeBlock(
      testColony.colony_id, testUser.user_id, 'floor', validX, validY
    );
    expect(block.block_type).toBe('floor');
  });

  test('should reject non-floor block under building footprint', async () => {
    await ColonyBuilding.create({
      colony_id: testColony.colony_id,
      building_type: 'DEFENSE_GRID',
      level: 1, workforce: 30, condition: 1.0, is_active: true,
      grid_x: validX, grid_y: validY, placed_at: new Date()
    });

    await expect(
      customBlockService.placeBlock(testColony.colony_id, testUser.user_id, 'wall', validX, validY)
    ).rejects.toThrow('occupied by building');
  });

  test('should reject placement on same tile', async () => {
    await customBlockService.placeBlock(testColony.colony_id, testUser.user_id, 'wall', validX, validY);

    // Same tile should fail
    await expect(
      customBlockService.placeBlock(testColony.colony_id, testUser.user_id, 'floor', validX, validY)
    ).rejects.toThrow('already has a block');
  });

  test('should reject unknown block type', async () => {
    await expect(
      customBlockService.placeBlock(testColony.colony_id, testUser.user_id, 'nonexistent', validX, validY)
    ).rejects.toThrow('Unknown block type');
  });

  test('should reject on unbuildable terrain (edge/landing_zone)', async () => {
    await expect(
      customBlockService.placeBlock(testColony.colony_id, testUser.user_id, 'wall', 0, 0)
    ).rejects.toThrow('not buildable');
  });

  test('should reject when surface not initialized', async () => {
    await testColony.update({ surface_initialized: false });
    await expect(
      customBlockService.placeBlock(testColony.colony_id, testUser.user_id, 'wall', validX, validY)
    ).rejects.toThrow('Surface not initialized');
  });

  test('should reject when block cap is reached', async () => {
    // Set infrastructure_level to 1 → cap = 50
    await testColony.update({ infrastructure_level: 1 });
    const { grid, width, height } = generateTerrain(testColony.colony_id, testPlanet.planet_id, testPlanet.type, testPlanet.size);

    // Create 50 blocks directly to reach cap
    const blocks = [];
    let count = 0;
    for (let y = 2; y < height - 2 && count < 50; y++) {
      for (let x = 2; x < width - 2 && count < 50; x++) {
        if (isBuildable(grid[y][x])) {
          blocks.push({ colony_id: testColony.colony_id, block_type: 'floor', grid_x: x, grid_y: y });
          count++;
        }
      }
    }
    await CustomBlock.bulkCreate(blocks);

    // 51st should fail
    await expect(
      customBlockService.placeBlock(testColony.colony_id, testUser.user_id, 'wall', validX + 20, validY + 20)
    ).rejects.toThrow('Block limit reached');
  });

  test('should reject with insufficient credits', async () => {
    await testUser.update({ credits: 0 });
    await expect(
      customBlockService.placeBlock(testColony.colony_id, testUser.user_id, 'wall', validX, validY)
    ).rejects.toThrow('Insufficient credits');
  });

  test('should apply rotation and color', async () => {
    const block = await customBlockService.placeBlock(
      testColony.colony_id, testUser.user_id, 'wall', validX, validY, 90, '#ff0000'
    );
    expect(block.rotation).toBe(90);
    expect(block.color).toBe('#ff0000');
  });
});

describe('removeBlock', () => {
  test('should remove block and refund 50%', async () => {
    const block = await customBlockService.placeBlock(
      testColony.colony_id, testUser.user_id, 'wall', validX, validY
    );

    const creditsAfterPlace = 1000000 - config.customBlocks.blockTypes.wall.cost;
    await testUser.reload();
    expect(Number(testUser.credits)).toBe(creditsAfterPlace);

    const result = await customBlockService.removeBlock(testColony.colony_id, testUser.user_id, block.block_id);
    expect(result.removed).toBe(1);
    expect(result.refund).toBe(Math.floor(config.customBlocks.blockTypes.wall.cost * 0.5));

    await testUser.reload();
    expect(Number(testUser.credits)).toBe(creditsAfterPlace + result.refund);

    const found = await CustomBlock.findByPk(block.block_id);
    expect(found).toBeNull();
  });

  test('should reject for non-owner', async () => {
    const block = await CustomBlock.create({
      colony_id: testColony.colony_id,
      block_type: 'wall',
      grid_x: validX,
      grid_y: validY
    });
    const otherUser = await createTestUser({ username: 'other2' });
    await expect(
      customBlockService.removeBlock(testColony.colony_id, otherUser.user_id, block.block_id)
    ).rejects.toThrow('Colony not found or not owned');
  });

  test('should reject for non-existent block', async () => {
    await expect(
      customBlockService.removeBlock(testColony.colony_id, testUser.user_id, '00000000-0000-0000-0000-000000000000')
    ).rejects.toThrow('Block not found');
  });
});

describe('bulkPlace', () => {
  test('should place multiple blocks in one transaction', async () => {
    const { grid, width, height } = generateTerrain(testColony.colony_id, testPlanet.planet_id, testPlanet.type, testPlanet.size);

    // Find 3 valid tiles
    const tiles = [];
    for (let y = 2; y < height - 2 && tiles.length < 3; y++) {
      for (let x = 2; x < width - 2 && tiles.length < 3; x++) {
        if (isBuildable(grid[y][x])) {
          tiles.push({ block_type: 'wall', grid_x: x, grid_y: y });
        }
      }
    }

    const result = await customBlockService.bulkPlace(testColony.colony_id, testUser.user_id, tiles);

    expect(result.placed).toBe(3);
    expect(result.total_cost).toBe(config.customBlocks.blockTypes.wall.cost * 3);
    expect(result.blocks).toHaveLength(3);
  });

  test('should reject duplicate positions in request', async () => {
    await expect(
      customBlockService.bulkPlace(testColony.colony_id, testUser.user_id, [
        { block_type: 'wall', grid_x: validX, grid_y: validY },
        { block_type: 'floor', grid_x: validX, grid_y: validY }
      ])
    ).rejects.toThrow('Duplicate position');
  });

  test('should reject if exceeds bulk limit', async () => {
    const blocks = Array.from({ length: 51 }, (_, i) => ({
      block_type: 'wall', grid_x: i + 2, grid_y: 2
    }));
    await expect(
      customBlockService.bulkPlace(testColony.colony_id, testUser.user_id, blocks)
    ).rejects.toThrow(`Maximum ${config.customBlocks.bulkLimit}`);
  });

  test('should reject if would exceed block cap', async () => {
    await testColony.update({ infrastructure_level: 1 }); // cap = 50
    const { grid, width, height } = generateTerrain(testColony.colony_id, testPlanet.planet_id, testPlanet.type, testPlanet.size);

    // Create 49 blocks directly
    const existing = [];
    let count = 0;
    for (let y = 2; y < height - 2 && count < 49; y++) {
      for (let x = 2; x < width - 2 && count < 49; x++) {
        if (isBuildable(grid[y][x])) {
          existing.push({ colony_id: testColony.colony_id, block_type: 'floor', grid_x: x, grid_y: y });
          count++;
        }
      }
    }
    await CustomBlock.bulkCreate(existing);

    // Try to add 2 more (would be 51, exceeding cap of 50)
    const newTiles = [];
    for (let y = 2; y < height - 2 && newTiles.length < 2; y++) {
      for (let x = 2; x < width - 2 && newTiles.length < 2; x++) {
        if (isBuildable(grid[y][x]) && !existing.some(e => e.grid_x === x && e.grid_y === y)) {
          newTiles.push({ block_type: 'wall', grid_x: x, grid_y: y });
        }
      }
    }

    await expect(
      customBlockService.bulkPlace(testColony.colony_id, testUser.user_id, newTiles)
    ).rejects.toThrow('exceed block limit');
  });
});

describe('bulkRemove', () => {
  test('should remove multiple blocks with refund', async () => {
    const b1 = await customBlockService.placeBlock(testColony.colony_id, testUser.user_id, 'wall', validX, validY);
    const b2 = await customBlockService.placeBlock(testColony.colony_id, testUser.user_id, 'wall', validX + 1, validY);

    const wallCost = config.customBlocks.blockTypes.wall.cost;
    const expectedRefund = Math.floor(wallCost * 0.5) * 2;

    const result = await customBlockService.bulkRemove(testColony.colony_id, testUser.user_id, [b1.block_id, b2.block_id]);

    expect(result.removed).toBe(2);
    expect(result.refund).toBe(expectedRefund);

    const remaining = await CustomBlock.count({ where: { colony_id: testColony.colony_id } });
    expect(remaining).toBe(0);
  });

  test('should handle non-existent block IDs gracefully', async () => {
    const result = await customBlockService.bulkRemove(
      testColony.colony_id, testUser.user_id,
      ['00000000-0000-0000-0000-000000000000']
    );
    expect(result.removed).toBe(0);
    expect(result.refund).toBe(0);
  });

  test('should reject empty array', async () => {
    await expect(
      customBlockService.bulkRemove(testColony.colony_id, testUser.user_id, [])
    ).rejects.toThrow('block_ids array is required');
  });
});

describe('getBlockCap', () => {
  test('should scale with infrastructure level', () => {
    expect(customBlockService.getBlockCap({ infrastructure_level: 1 })).toBe(50);
    expect(customBlockService.getBlockCap({ infrastructure_level: 5 })).toBe(250);
    expect(customBlockService.getBlockCap({ infrastructure_level: 10 })).toBe(500);
    expect(customBlockService.getBlockCap({ infrastructure_level: 15 })).toBe(500); // capped
  });
});
