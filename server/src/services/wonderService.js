const { Wonder, Colony, User } = require('../models');
const { sequelize } = require('../config/database');
const config = require('../config');

/**
 * Start construction of a wonder at a colony
 */
const startWonderConstruction = async (userId, colonyId, wonderType) => {
  const wonderConfig = config.wonders[wonderType];
  if (!wonderConfig) {
    const error = new Error('Invalid wonder type');
    error.statusCode = 400;
    throw error;
  }

  const colony = await Colony.findOne({
    where: { colony_id: colonyId, user_id: userId }
  });
  if (!colony) {
    const error = new Error('Colony not found or not owned');
    error.statusCode = 404;
    throw error;
  }

  if (colony.infrastructure_level < wonderConfig.requiredInfrastructure) {
    const error = new Error(`Requires infrastructure level ${wonderConfig.requiredInfrastructure}`);
    error.statusCode = 400;
    throw error;
  }

  // Check for duplicate wonder type at colony
  const existing = await Wonder.findOne({
    where: { colony_id: colonyId, wonder_type: wonderType }
  });
  if (existing) {
    const error = new Error('This wonder type already exists at this colony');
    error.statusCode = 400;
    throw error;
  }

  const wonder = await Wonder.create({
    colony_id: colonyId,
    wonder_type: wonderType,
    name: wonderConfig.name,
    bonus_type: wonderConfig.bonusType,
    bonus_value: wonderConfig.bonusValue,
    construction_phase: 0,
    max_phases: wonderConfig.maxPhases,
    is_completed: false,
    credits_invested: 0
  });

  return wonder;
};

/**
 * Advance a wonder's construction phase
 */
const advanceWonderPhase = async (userId, wonderId) => {
  const wonder = await Wonder.findByPk(wonderId, {
    include: [{ model: Colony, as: 'colony' }]
  });
  if (!wonder) {
    const error = new Error('Wonder not found');
    error.statusCode = 404;
    throw error;
  }

  if (wonder.colony.user_id !== userId) {
    const error = new Error('Colony not owned by user');
    error.statusCode = 403;
    throw error;
  }

  if (wonder.is_completed) {
    const error = new Error('Wonder is already completed');
    error.statusCode = 400;
    throw error;
  }

  const wonderConfig = config.wonders[wonder.wonder_type];
  if (!wonderConfig) {
    const error = new Error('Invalid wonder configuration');
    error.statusCode = 500;
    throw error;
  }

  const cost = wonderConfig.phaseCost;
  const user = await User.findByPk(userId);
  if (Number(user.credits) < cost) {
    const error = new Error('Insufficient credits');
    error.statusCode = 400;
    throw error;
  }

  const transaction = await sequelize.transaction();
  try {
    await user.update({ credits: Number(user.credits) - cost }, { transaction });

    const newPhase = wonder.construction_phase + 1;
    const isCompleted = newPhase >= wonder.max_phases;

    await wonder.update({
      construction_phase: newPhase,
      credits_invested: Number(wonder.credits_invested) + cost,
      is_completed: isCompleted,
      completed_at: isCompleted ? new Date() : null
    }, { transaction });

    await transaction.commit();

    return wonder.reload();
  } catch (err) {
    await transaction.rollback();
    throw err;
  }
};

/**
 * Get all wonders at a colony
 */
const getColonyWonders = async (colonyId) => {
  return Wonder.findAll({ where: { colony_id: colonyId } });
};

/**
 * Get aggregate bonuses from completed wonders at a colony
 */
const getWonderBonuses = async (colonyId) => {
  const wonders = await Wonder.findAll({
    where: { colony_id: colonyId, is_completed: true }
  });

  const bonuses = {};
  for (const wonder of wonders) {
    bonuses[wonder.bonus_type] = (bonuses[wonder.bonus_type] || 0) + wonder.bonus_value;
  }
  return bonuses;
};

module.exports = {
  startWonderConstruction,
  advanceWonderPhase,
  getColonyWonders,
  getWonderBonuses
};
