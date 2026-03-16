/**
 * Custom Block Service — manages freeform structural blocks on colony surfaces.
 * Walls, floors, barricades, turret mounts, etc.
 */
const { Colony, CustomBlock, ColonyBuilding, SurfaceAnomaly, GroundCombatInstance, User, Planet, sequelize } = require('../models');
const { generateTerrain, isBuildable } = require('../utils/terrainGenerator');
const config = require('../config');
const { Op } = require('sequelize');

/**
 * Check if colony has active ground combat. Throws 409 if locked.
 */
async function checkCombatLock(colonyId, transaction) {
  const activeCombat = await GroundCombatInstance.findOne({
    where: { colony_id: colonyId, status: { [Op.in]: ['deploying', 'active'] } },
    transaction
  });
  if (activeCombat) {
    throw Object.assign(new Error('Surface is locked during active combat'), { statusCode: 409 });
  }
}

/**
 * Get all blocks for a colony.
 */
async function getBlocks(colonyId, userId) {
  const colony = await Colony.findOne({
    where: { colony_id: colonyId, user_id: userId }
  });
  if (!colony) {
    throw Object.assign(new Error('Colony not found or not owned'), { statusCode: 404 });
  }

  const blocks = await CustomBlock.findAll({
    where: { colony_id: colonyId },
    order: [['createdAt', 'ASC']]
  });

  return blocks.map(b => b.toJSON());
}

/**
 * Get max block capacity for a colony.
 */
function getBlockCap(colony) {
  const level = colony.infrastructure_level || 1;
  return Math.min(level * config.customBlocks.maxBlocksBase, config.customBlocks.maxBlocksCap);
}

/**
 * Validate a single block placement against terrain, buildings, anomalies, and existing blocks.
 */
async function validateBlockPlacement(colonyId, gridX, gridY, blockType, colony, grid, width, height, transaction, cached = null) {
  const blockConfig = config.customBlocks.blockTypes[blockType];
  if (!blockConfig) {
    return { valid: false, reason: `Unknown block type: ${blockType}` };
  }

  // Bounds check
  if (gridX < 0 || gridX >= width || gridY < 0 || gridY >= height) {
    return { valid: false, reason: `Out of bounds at (${gridX}, ${gridY})` };
  }

  // Terrain check
  if (!isBuildable(grid[gridY]?.[gridX])) {
    return { valid: false, reason: `Tile (${gridX}, ${gridY}) is not buildable` };
  }

  // Floor blocks can coexist under buildings, others cannot
  const isFloor = config.customBlocks.floorCoexistsBuildings && blockType === 'floor';

  if (!isFloor) {
    // Check building footprint collision
    const buildings = cached?.buildings || await ColonyBuilding.findAll({
      where: { colony_id: colonyId, grid_x: { [Op.ne]: null } },
      transaction
    });
    for (const building of buildings) {
      const fp = config.colonySurface.buildingFootprints[building.building_type];
      if (!fp) continue;
      if (
        gridX >= building.grid_x && gridX < building.grid_x + fp.w &&
        gridY >= building.grid_y && gridY < building.grid_y + fp.h
      ) {
        return { valid: false, reason: `Tile occupied by building ${building.building_type}` };
      }
    }
  }

  // Check existing block collision
  const existingBlocks = cached?.blocks || await CustomBlock.findAll({
    where: { colony_id: colonyId },
    transaction
  });
  for (const block of existingBlocks) {
    if (block.grid_x === gridX && block.grid_y === gridY) {
      return { valid: false, reason: `Tile (${gridX}, ${gridY}) already has a block` };
    }
  }

  // Check anomaly collision
  const anomalies = cached?.anomalies || await SurfaceAnomaly.findAll({
    where: { colony_id: colonyId, expires_at: { [Op.gt]: new Date() } },
    transaction
  });
  for (const anomaly of anomalies) {
    if (anomaly.grid_x === gridX && anomaly.grid_y === gridY) {
      return { valid: false, reason: `Tile (${gridX}, ${gridY}) has an unclaimed anomaly` };
    }
  }

  return { valid: true };
}

/**
 * Place a single block.
 */
async function placeBlock(colonyId, userId, blockType, gridX, gridY, rotation = 0, color = null) {
  const transaction = await sequelize.transaction();
  try {
    await checkCombatLock(colonyId, transaction);
    const colony = await Colony.findOne({
      where: { colony_id: colonyId, user_id: userId },
      include: [{ model: Planet, as: 'planet' }],
      lock: transaction.LOCK.UPDATE,
      transaction
    });
    if (!colony) {
      throw Object.assign(new Error('Colony not found or not owned'), { statusCode: 404 });
    }
    if (!colony.surface_initialized) {
      throw Object.assign(new Error('Surface not initialized'), { statusCode: 400 });
    }
    if (!colony.planet) {
      throw Object.assign(new Error('Colony has no associated planet'), { statusCode: 400 });
    }

    // Block cap check
    const currentCount = await CustomBlock.count({
      where: { colony_id: colonyId },
      transaction
    });
    const cap = getBlockCap(colony);
    if (currentCount >= cap) {
      throw Object.assign(new Error(`Block limit reached (${cap}). Upgrade infrastructure for more.`), { statusCode: 400 });
    }

    // Validate placement
    const { grid, width, height } = generateTerrain(colonyId, colony.planet.planet_id, colony.planet.type, colony.planet.size);
    const validation = await validateBlockPlacement(colonyId, gridX, gridY, blockType, colony, grid, width, height, transaction);
    if (!validation.valid) {
      throw Object.assign(new Error(validation.reason), { statusCode: 400 });
    }

    // Deduct credits
    const blockConfig = config.customBlocks.blockTypes[blockType];
    const user = await User.findByPk(userId, { transaction, lock: true });
    if (Number(user.credits) < blockConfig.cost) {
      throw Object.assign(new Error('Insufficient credits'), { statusCode: 400 });
    }
    await user.update({ credits: Number(user.credits) - blockConfig.cost }, { transaction });

    const block = await CustomBlock.create({
      colony_id: colonyId,
      block_type: blockType,
      grid_x: gridX,
      grid_y: gridY,
      rotation: rotation || 0,
      color: color || null
    }, { transaction });

    await transaction.commit();
    return block.toJSON();
  } catch (err) {
    await transaction.rollback();
    throw err;
  }
}

/**
 * Remove a single block with partial refund.
 */
async function removeBlock(colonyId, userId, blockId) {
  const transaction = await sequelize.transaction();
  try {
    await checkCombatLock(colonyId, transaction);
    const colony = await Colony.findOne({
      where: { colony_id: colonyId, user_id: userId },
      lock: transaction.LOCK.UPDATE,
      transaction
    });
    if (!colony) {
      throw Object.assign(new Error('Colony not found or not owned'), { statusCode: 404 });
    }

    const block = await CustomBlock.findOne({
      where: { block_id: blockId, colony_id: colonyId },
      transaction
    });
    if (!block) {
      throw Object.assign(new Error('Block not found'), { statusCode: 404 });
    }

    const blockConfig = config.customBlocks.blockTypes[block.block_type];
    const refund = Math.floor((blockConfig?.cost || 0) * config.customBlocks.refundRatio);

    if (refund > 0) {
      const user = await User.findByPk(userId, { transaction, lock: true });
      await user.update({ credits: Number(user.credits) + refund }, { transaction });
    }

    await block.destroy({ transaction });
    await transaction.commit();
    return { removed: 1, refund };
  } catch (err) {
    await transaction.rollback();
    throw err;
  }
}

/**
 * Place multiple blocks in one transaction.
 */
async function bulkPlace(colonyId, userId, blocks) {
  if (!Array.isArray(blocks) || blocks.length === 0) {
    throw Object.assign(new Error('blocks array is required'), { statusCode: 400 });
  }
  if (blocks.length > config.customBlocks.bulkLimit) {
    throw Object.assign(new Error(`Maximum ${config.customBlocks.bulkLimit} blocks per request`), { statusCode: 400 });
  }

  const transaction = await sequelize.transaction();
  try {
    await checkCombatLock(colonyId, transaction);
    const colony = await Colony.findOne({
      where: { colony_id: colonyId, user_id: userId },
      include: [{ model: Planet, as: 'planet' }],
      lock: transaction.LOCK.UPDATE,
      transaction
    });
    if (!colony) {
      throw Object.assign(new Error('Colony not found or not owned'), { statusCode: 404 });
    }
    if (!colony.surface_initialized) {
      throw Object.assign(new Error('Surface not initialized'), { statusCode: 400 });
    }
    if (!colony.planet) {
      throw Object.assign(new Error('Colony has no associated planet'), { statusCode: 400 });
    }

    const currentCount = await CustomBlock.count({
      where: { colony_id: colonyId },
      transaction
    });
    const cap = getBlockCap(colony);
    if (currentCount + blocks.length > cap) {
      throw Object.assign(new Error(`Would exceed block limit (${cap}). Currently: ${currentCount}`), { statusCode: 400 });
    }

    // Calculate total cost
    let totalCost = 0;
    for (const b of blocks) {
      const bc = config.customBlocks.blockTypes[b.block_type];
      if (!bc) {
        throw Object.assign(new Error(`Unknown block type: ${b.block_type}`), { statusCode: 400 });
      }
      totalCost += bc.cost;
    }

    const user = await User.findByPk(userId, { transaction, lock: true });
    if (Number(user.credits) < totalCost) {
      throw Object.assign(new Error(`Insufficient credits (need ${totalCost})`), { statusCode: 400 });
    }

    const { grid, width, height } = generateTerrain(colonyId, colony.planet.planet_id, colony.planet.type, colony.planet.size);

    // Pre-fetch all collision data once (avoids N+1 queries in validation loop)
    const [cachedBuildings, cachedBlocks, cachedAnomalies] = await Promise.all([
      ColonyBuilding.findAll({
        where: { colony_id: colonyId, grid_x: { [Op.ne]: null } },
        transaction
      }),
      CustomBlock.findAll({
        where: { colony_id: colonyId },
        transaction
      }),
      SurfaceAnomaly.findAll({
        where: { colony_id: colonyId, expires_at: { [Op.gt]: new Date() } },
        transaction
      })
    ]);
    const cached = { buildings: cachedBuildings, blocks: cachedBlocks, anomalies: cachedAnomalies };

    // Validate all placements
    const placedCoords = new Set();
    for (const b of blocks) {
      const key = `${b.grid_x},${b.grid_y}`;
      if (placedCoords.has(key)) {
        throw Object.assign(new Error(`Duplicate position in request: (${b.grid_x}, ${b.grid_y})`), { statusCode: 400 });
      }
      placedCoords.add(key);

      const validation = await validateBlockPlacement(colonyId, b.grid_x, b.grid_y, b.block_type, colony, grid, width, height, transaction, cached);
      if (!validation.valid) {
        throw Object.assign(new Error(`(${b.grid_x}, ${b.grid_y}): ${validation.reason}`), { statusCode: 400 });
      }
    }

    await user.update({ credits: Number(user.credits) - totalCost }, { transaction });

    const created = await CustomBlock.bulkCreate(
      blocks.map(b => ({
        colony_id: colonyId,
        block_type: b.block_type,
        grid_x: b.grid_x,
        grid_y: b.grid_y,
        rotation: b.rotation || 0,
        color: b.color || null
      })),
      { transaction, returning: true }
    );

    await transaction.commit();
    return { placed: created.length, total_cost: totalCost, blocks: created.map(b => b.toJSON()) };
  } catch (err) {
    await transaction.rollback();
    throw err;
  }
}

/**
 * Remove multiple blocks in one transaction.
 */
async function bulkRemove(colonyId, userId, blockIds) {
  if (!Array.isArray(blockIds) || blockIds.length === 0) {
    throw Object.assign(new Error('block_ids array is required'), { statusCode: 400 });
  }
  if (blockIds.length > config.customBlocks.bulkLimit) {
    throw Object.assign(new Error(`Maximum ${config.customBlocks.bulkLimit} blocks per request`), { statusCode: 400 });
  }

  const transaction = await sequelize.transaction();
  try {
    await checkCombatLock(colonyId, transaction);
    const colony = await Colony.findOne({
      where: { colony_id: colonyId, user_id: userId },
      lock: transaction.LOCK.UPDATE,
      transaction
    });
    if (!colony) {
      throw Object.assign(new Error('Colony not found or not owned'), { statusCode: 404 });
    }

    const blocks = await CustomBlock.findAll({
      where: { block_id: { [Op.in]: blockIds }, colony_id: colonyId },
      transaction
    });

    if (blocks.length === 0) {
      await transaction.commit();
      return { removed: 0, refund: 0 };
    }

    let totalRefund = 0;
    for (const block of blocks) {
      const bc = config.customBlocks.blockTypes[block.block_type];
      totalRefund += Math.floor((bc?.cost || 0) * config.customBlocks.refundRatio);
    }

    if (totalRefund > 0) {
      const user = await User.findByPk(userId, { transaction, lock: true });
      await user.update({ credits: Number(user.credits) + totalRefund }, { transaction });
    }

    await CustomBlock.destroy({
      where: { block_id: { [Op.in]: blockIds }, colony_id: colonyId },
      transaction
    });

    await transaction.commit();
    return { removed: blocks.length, refund: totalRefund };
  } catch (err) {
    await transaction.rollback();
    throw err;
  }
}

module.exports = {
  getBlocks,
  placeBlock,
  removeBlock,
  bulkPlace,
  bulkRemove,
  getBlockCap
};
