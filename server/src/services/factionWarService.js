const { FactionWar, User, sequelize } = require('../models');
const { Op } = require('sequelize');
const config = require('../config');

/**
 * Get all wars ordered by most recent first
 */
const getWars = async () => {
  return FactionWar.findAll({
    order: [['started_at', 'DESC']]
  });
};

/**
 * Get all active wars
 */
const getActiveWars = async () => {
  return FactionWar.findAll({
    where: { status: 'active' },
    order: [['started_at', 'DESC']]
  });
};

/**
 * Start a war between two factions
 */
const startWar = async (attackerFaction, defenderFaction) => {
  // Check if an active war already exists between these factions (either direction)
  const existingWar = await checkWarBetweenFactions(attackerFaction, defenderFaction);
  if (existingWar) {
    throw Object.assign(
      new Error('An active war already exists between these factions'),
      { statusCode: 400 }
    );
  }

  const endsAt = new Date();
  endsAt.setDate(endsAt.getDate() + 7);

  return FactionWar.create({
    attacker_faction: attackerFaction,
    defender_faction: defenderFaction,
    status: 'active',
    started_at: new Date(),
    ends_at: endsAt
  });
};

/**
 * Add score to a faction in a war
 */
const addWarScore = async (warId, faction, points, transaction) => {
  const war = await FactionWar.findByPk(warId, { transaction });

  if (!war) {
    throw Object.assign(
      new Error('War not found'),
      { statusCode: 404 }
    );
  }

  if (faction === war.attacker_faction) {
    war.attacker_score += points;
  } else if (faction === war.defender_faction) {
    war.defender_score += points;
  }

  await war.save({ transaction });
  return war;
};

/**
 * Resolve a war and determine the winner
 */
const resolveWar = async (warId) => {
  const war = await FactionWar.findByPk(warId);

  if (!war) {
    throw Object.assign(
      new Error('War not found'),
      { statusCode: 404 }
    );
  }

  const winner = war.attacker_score >= war.defender_score
    ? war.attacker_faction
    : war.defender_faction;

  war.status = 'resolved';
  war.ended_at = new Date();
  war.result = {
    winner,
    attacker_score: war.attacker_score,
    defender_score: war.defender_score
  };

  await war.save();
  return war;
};

/**
 * Check if an active war exists between two factions (in either direction)
 */
const checkWarBetweenFactions = async (faction1, faction2) => {
  return FactionWar.findOne({
    where: {
      status: 'active',
      [Op.or]: [
        { attacker_faction: faction1, defender_faction: faction2 },
        { attacker_faction: faction2, defender_faction: faction1 }
      ]
    }
  });
};

module.exports = {
  getWars,
  getActiveWars,
  startWar,
  addWarScore,
  resolveWar,
  checkWarBetweenFactions
};
