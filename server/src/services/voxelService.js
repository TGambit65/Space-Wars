/**
 * Voxel Service — manages voxel block modifications (delta storage) on colony surfaces.
 * Only stores blocks that differ from procedural generation.
 */
const { Colony, GroundCombatInstance, sequelize } = require('../models');
const VoxelBlock = require('../models/VoxelBlock');
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
 * Get voxel block capacity for a colony.
 */
function getBlockCap(colony) {
  const level = colony.infrastructure_level || 1;
  return Math.min(level * config.voxels.maxBlocksBase, config.voxels.maxBlocksCap);
}

/**
 * Get all voxel block modifications for a given chunk.
 * No ownership check — public read for rendering.
 */
async function getChunkModifications(colonyId, chunkX, chunkZ) {
  const blocks = await VoxelBlock.findAll({
    where: { colony_id: colonyId, chunk_x: chunkX, chunk_z: chunkZ },
    order: [['createdAt', 'ASC']]
  });

  return blocks.map(b => b.toJSON());
}

/**
 * Place a single voxel block (or update if one exists at the same position).
 */
async function placeBlock(colonyId, userId, { chunk_x, chunk_z, local_x, local_y, local_z, block_type }) {
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

    // Block cap check — only count placed blocks (block_type > 0), not removals
    const currentCount = await VoxelBlock.count({
      where: { colony_id: colonyId, block_type: { [Op.gt]: 0 } },
      transaction
    });
    const cap = getBlockCap(colony);
    if (currentCount >= cap) {
      throw Object.assign(new Error(`Voxel block limit reached (${cap}). Upgrade infrastructure for more.`), { statusCode: 400 });
    }

    // Upsert: create or update if a block already exists at this position
    const [block, created] = await VoxelBlock.findOrCreate({
      where: {
        colony_id: colonyId,
        chunk_x, chunk_z,
        local_x, local_y, local_z
      },
      defaults: {
        colony_id: colonyId,
        chunk_x, chunk_z,
        local_x, local_y, local_z,
        block_type,
        placed_by: userId
      },
      transaction
    });

    if (!created) {
      await block.update({ block_type, placed_by: userId }, { transaction });
    }

    await transaction.commit();
    return block.toJSON();
  } catch (err) {
    try { await transaction.rollback(); } catch (_) { /* already committed or connection lost */ }
    throw err;
  }
}

/**
 * Remove a voxel block by storing a delta (block_type = 0 means natural block was removed).
 */
async function removeBlock(colonyId, userId, { chunk_x, chunk_z, local_x, local_y, local_z }) {
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

    // Upsert with block_type = 0 (removed natural block)
    const [block, created] = await VoxelBlock.findOrCreate({
      where: {
        colony_id: colonyId,
        chunk_x, chunk_z,
        local_x, local_y, local_z
      },
      defaults: {
        colony_id: colonyId,
        chunk_x, chunk_z,
        local_x, local_y, local_z,
        block_type: 0,
        placed_by: userId
      },
      transaction
    });

    if (!created) {
      await block.update({ block_type: 0, placed_by: userId }, { transaction });
    }

    await transaction.commit();
    return block.toJSON();
  } catch (err) {
    try { await transaction.rollback(); } catch (_) { /* already committed or connection lost */ }
    throw err;
  }
}

/**
 * Process multiple voxel operations in a single transaction.
 * @param {string} colonyId
 * @param {string} userId
 * @param {Array<{action: 'place'|'remove', chunk_x, chunk_z, local_x, local_y, local_z, block_type?}>} operations
 */
async function bulkOperation(colonyId, userId, operations) {
  if (!Array.isArray(operations) || operations.length === 0) {
    throw Object.assign(new Error('operations array is required'), { statusCode: 400 });
  }
  if (operations.length > config.voxels.bulkLimit) {
    throw Object.assign(new Error(`Maximum ${config.voxels.bulkLimit} operations per request`), { statusCode: 400 });
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

    const cap = getBlockCap(colony);
    let placed = 0;
    let removed = 0;

    for (const op of operations) {
      const { action, chunk_x, chunk_z, local_x, local_y, local_z, block_type } = op;

      if (action === 'place') {
        if (block_type === undefined || block_type === null) {
          throw Object.assign(new Error('block_type required for place action'), { statusCode: 400 });
        }

        // Check cap before each placement (only count placed blocks, not removals)
        const currentCount = await VoxelBlock.count({
          where: { colony_id: colonyId, block_type: { [Op.gt]: 0 } },
          transaction
        });
        if (currentCount >= cap) {
          throw Object.assign(new Error(`Voxel block limit reached (${cap}). Upgrade infrastructure for more.`), { statusCode: 400 });
        }

        const [block, created] = await VoxelBlock.findOrCreate({
          where: {
            colony_id: colonyId,
            chunk_x, chunk_z,
            local_x, local_y, local_z
          },
          defaults: {
            colony_id: colonyId,
            chunk_x, chunk_z,
            local_x, local_y, local_z,
            block_type,
            placed_by: userId
          },
          transaction
        });

        if (!created) {
          await block.update({ block_type, placed_by: userId }, { transaction });
        }
        placed++;
      } else if (action === 'remove') {
        const [block, created] = await VoxelBlock.findOrCreate({
          where: {
            colony_id: colonyId,
            chunk_x, chunk_z,
            local_x, local_y, local_z
          },
          defaults: {
            colony_id: colonyId,
            chunk_x, chunk_z,
            local_x, local_y, local_z,
            block_type: 0,
            placed_by: userId
          },
          transaction
        });

        if (!created) {
          await block.update({ block_type: 0, placed_by: userId }, { transaction });
        }
        removed++;
      } else {
        throw Object.assign(new Error(`Unknown action: ${action}. Use 'place' or 'remove'.`), { statusCode: 400 });
      }
    }

    await transaction.commit();
    return { placed, removed, total: placed + removed };
  } catch (err) {
    try { await transaction.rollback(); } catch (_) { /* already committed or connection lost */ }
    throw err;
  }
}

module.exports = {
  getChunkModifications,
  placeBlock,
  removeBlock,
  bulkOperation,
  getBlockCap
};
