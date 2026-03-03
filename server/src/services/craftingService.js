const { Blueprint, CraftingJob, Ship, ShipCargo, Commodity, User, Port } = require('../models');
const { sequelize } = require('../config/database');
const config = require('../config');

/**
 * Get available blueprints for a user (filtered by level and tech)
 */
const getAvailableBlueprints = async (userId) => {
  const user = await User.findByPk(userId);
  if (!user) {
    const error = new Error('User not found');
    error.statusCode = 404;
    throw error;
  }

  const blueprints = await Blueprint.findAll();

  // Filter by level
  const filtered = blueprints.filter(bp => (user.player_level || 1) >= bp.required_level);

  // If tech is required, check it (lazy require to avoid circular dependency)
  const progressionService = require('./progressionService');
  const results = [];
  for (const bp of filtered) {
    if (bp.required_tech) {
      const hasTech = await progressionService.hasCompletedTech(userId, bp.required_tech);
      if (!hasTech) continue;
    }
    results.push(bp);
  }

  return results;
};

/**
 * Start a crafting job
 */
const startCrafting = async (userId, blueprintId, shipId) => {
  const blueprint = await Blueprint.findByPk(blueprintId);
  if (!blueprint) {
    const error = new Error('Blueprint not found');
    error.statusCode = 404;
    throw error;
  }

  const user = await User.findByPk(userId);
  if (!user) {
    const error = new Error('User not found');
    error.statusCode = 404;
    throw error;
  }

  // Check level
  if ((user.player_level || 1) < blueprint.required_level) {
    const error = new Error(`Requires level ${blueprint.required_level}`);
    error.statusCode = 400;
    throw error;
  }

  // Check tech
  if (blueprint.required_tech) {
    const progressionService = require('./progressionService');
    const hasTech = await progressionService.hasCompletedTech(userId, blueprint.required_tech);
    if (!hasTech) {
      const error = new Error(`Requires tech: ${blueprint.required_tech}`);
      error.statusCode = 400;
      throw error;
    }
  }

  const ship = await Ship.findOne({
    where: { ship_id: shipId, owner_user_id: userId }
  });
  if (!ship) {
    const error = new Error('Ship not found or not owned');
    error.statusCode = 404;
    throw error;
  }

  // Ship must be at a port
  const port = await Port.findOne({ where: { sector_id: ship.current_sector_id, is_active: true } });
  if (!port) {
    const error = new Error('Ship must be docked at a port');
    error.statusCode = 400;
    throw error;
  }

  // Check credits
  if (Number(user.credits) < blueprint.credits_cost) {
    const error = new Error('Insufficient credits');
    error.statusCode = 400;
    throw error;
  }

  const transaction = await sequelize.transaction();
  try {
    // Check and deduct ingredients from ship cargo
    const ingredients = blueprint.ingredients;
    for (const ingredient of ingredients) {
      const commodity = await Commodity.findOne({ where: { name: ingredient.commodityName }, transaction });
      if (!commodity) {
        const error = new Error(`Ingredient not found: ${ingredient.commodityName}`);
        error.statusCode = 400;
        throw error;
      }

      const cargo = await ShipCargo.findOne({
        where: { ship_id: shipId, commodity_id: commodity.commodity_id },
        transaction
      });

      if (!cargo || cargo.quantity < ingredient.quantity) {
        const error = new Error(`Insufficient ${ingredient.commodityName}: need ${ingredient.quantity}`);
        error.statusCode = 400;
        throw error;
      }

      const newQty = cargo.quantity - ingredient.quantity;
      if (newQty === 0) {
        await cargo.destroy({ transaction });
      } else {
        await cargo.update({ quantity: newQty }, { transaction });
      }
    }

    // Deduct credits
    await user.update({ credits: Number(user.credits) - blueprint.credits_cost }, { transaction });

    // Create crafting job
    const now = new Date();
    const job = await CraftingJob.create({
      user_id: userId,
      blueprint_id: blueprintId,
      ship_id: shipId,
      status: 'in_progress',
      started_at: now,
      completes_at: new Date(now.getTime() + blueprint.crafting_time)
    }, { transaction });

    await transaction.commit();
    return job;
  } catch (err) {
    await transaction.rollback();
    throw err;
  }
};

/**
 * Cancel a crafting job (50% ingredient refund)
 */
const cancelCrafting = async (userId, jobId) => {
  const job = await CraftingJob.findOne({
    where: { crafting_job_id: jobId, user_id: userId, status: 'in_progress' },
    include: [{ model: Blueprint, as: 'blueprint' }]
  });
  if (!job) {
    const error = new Error('Active crafting job not found');
    error.statusCode = 404;
    throw error;
  }

  const transaction = await sequelize.transaction();
  try {
    // Refund 50% ingredients to ship cargo
    const ingredients = job.blueprint.ingredients;
    for (const ingredient of ingredients) {
      const refundQty = Math.floor(ingredient.quantity * 0.5);
      if (refundQty === 0) continue;

      const commodity = await Commodity.findOne({ where: { name: ingredient.commodityName }, transaction });
      if (!commodity) continue;

      const [cargo, created] = await ShipCargo.findOrCreate({
        where: { ship_id: job.ship_id, commodity_id: commodity.commodity_id },
        defaults: { ship_id: job.ship_id, commodity_id: commodity.commodity_id, quantity: 0 },
        transaction
      });

      await cargo.update({ quantity: cargo.quantity + refundQty }, { transaction });
    }

    await job.update({ status: 'cancelled' }, { transaction });
    await transaction.commit();
    return job.reload({ include: [{ model: Blueprint, as: 'blueprint' }] });
  } catch (err) {
    await transaction.rollback();
    throw err;
  }
};

/**
 * Complete a crafting job (must be past completes_at)
 */
const completeCrafting = async (userId, jobId) => {
  const job = await CraftingJob.findOne({
    where: { crafting_job_id: jobId, user_id: userId, status: 'in_progress' },
    include: [{ model: Blueprint, as: 'blueprint' }]
  });
  if (!job) {
    const error = new Error('Active crafting job not found');
    error.statusCode = 404;
    throw error;
  }

  if (new Date() < new Date(job.completes_at)) {
    const error = new Error('Crafting not yet complete');
    error.statusCode = 400;
    throw error;
  }

  const transaction = await sequelize.transaction();
  try {
    // Add output to ship cargo
    if (job.blueprint.output_type === 'commodity') {
      const commodity = await Commodity.findOne({ where: { name: job.blueprint.output_name }, transaction });
      if (!commodity) {
        const error = new Error(`Output commodity not found: ${job.blueprint.output_name}`);
        error.statusCode = 500;
        throw error;
      }
      const [cargo] = await ShipCargo.findOrCreate({
        where: { ship_id: job.ship_id, commodity_id: commodity.commodity_id },
        defaults: { ship_id: job.ship_id, commodity_id: commodity.commodity_id, quantity: 0 },
        transaction
      });
      await cargo.update({ quantity: cargo.quantity + job.blueprint.output_quantity }, { transaction });
    }
    // Component outputs would create ShipComponent entries - deferred for now

    await job.update({ status: 'completed', completed_at: new Date() }, { transaction });

    // Award XP
    try {
      const progressionService = require('./progressionService');
      await progressionService.awardXP(userId, 25, 'crafting', transaction);
    } catch (e) {
      // XP award failure should not block crafting completion
    }

    await transaction.commit();
    return job.reload();
  } catch (err) {
    await transaction.rollback();
    throw err;
  }
};

/**
 * Check and auto-complete all ready jobs for a user
 */
const checkCompletedJobs = async (userId) => {
  const { Op } = require('sequelize');
  const readyJobs = await CraftingJob.findAll({
    where: {
      user_id: userId,
      status: 'in_progress',
      completes_at: { [Op.lte]: new Date() }
    }
  });

  const completed = [];
  for (const job of readyJobs) {
    try {
      await completeCrafting(userId, job.crafting_job_id);
      completed.push(job.crafting_job_id);
    } catch (e) {
      // Skip individual failures
    }
  }
  return completed;
};

/**
 * Get active crafting jobs for a user
 */
const getActiveJobs = async (userId) => {
  return CraftingJob.findAll({
    where: { user_id: userId, status: 'in_progress' },
    include: [{ model: Blueprint, as: 'blueprint' }],
    order: [['completes_at', 'ASC']]
  });
};

/**
 * Seed blueprints from config into the database
 */
const seedBlueprints = async (transaction = null) => {
  for (const bp of config.blueprints) {
    await Blueprint.findOrCreate({
      where: { name: bp.name },
      defaults: {
        name: bp.name,
        category: bp.category,
        output_type: bp.outputType,
        output_name: bp.outputName,
        output_quantity: bp.outputQuantity || 1,
        crafting_time: bp.craftingTime,
        required_level: bp.requiredLevel,
        required_tech: bp.requiredTech || null,
        ingredients: bp.ingredients,
        credits_cost: bp.creditsCost,
        description: bp.description || null
      },
      transaction
    });
  }
};

module.exports = {
  getAvailableBlueprints,
  startCrafting,
  cancelCrafting,
  completeCrafting,
  checkCompletedJobs,
  getActiveJobs,
  seedBlueprints
};
