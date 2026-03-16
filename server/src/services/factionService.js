const { User, FactionStanding, sequelize } = require('../models');
const { Op } = require('sequelize');
const config = require('../config');

const FACTION_KEYS = Object.keys(config.factions);

/**
 * Return the config block for a single faction.
 */
const getFactionConfig = (faction) => {
  const cfg = config.factions[faction];
  if (!cfg) {
    const error = new Error(`Unknown faction: ${faction}`);
    error.statusCode = 404;
    throw error;
  }
  return cfg;
};

/**
 * Multiply a base value by the faction's bonus for the given type.
 * Returns the unmodified base if the faction is not found.
 */
const applyFactionBonus = (baseValue, faction, bonusType) => {
  const cfg = config.factions[faction];
  if (!cfg || !cfg.bonuses || cfg.bonuses[bonusType] === undefined) {
    return baseValue;
  }
  return baseValue * cfg.bonuses[bonusType];
};

/**
 * Create the initial FactionStanding rows for a newly-registered user.
 * Own faction starts at 200 reputation; the other two start at 0.
 */
const initializeStandings = async (userId, userFaction, transaction) => {
  const rows = FACTION_KEYS.map((faction) => ({
    user_id: userId,
    faction,
    reputation: faction === userFaction ? 200 : 0
  }));

  await FactionStanding.bulkCreate(rows, { transaction });
};

/**
 * Adjust a user's reputation with a faction, clamped to [-1000, 1000].
 * Returns the updated FactionStanding instance.
 */
const modifyStanding = async (userId, faction, amount, reason, transaction) => {
  const standing = await FactionStanding.findOne({
    where: { user_id: userId, faction },
    ...(transaction ? { transaction, lock: transaction.LOCK.UPDATE } : {})
  });

  if (!standing) {
    const error = new Error(`No standing found for user ${userId} with faction ${faction}`);
    error.statusCode = 404;
    throw error;
  }

  const newRep = Math.max(-1000, Math.min(1000, standing.reputation + amount));
  standing.reputation = newRep;
  await standing.save({ transaction });

  return standing;
};

/**
 * Return all three faction standings for a user, with computed rank.
 */
const getStandings = async (userId) => {
  const standings = await FactionStanding.findAll({
    where: { user_id: userId },
    order: [['faction', 'ASC']]
  });

  return standings.map((s) => ({
    faction: s.faction,
    reputation: s.reputation,
    rank: s.getRank()
  }));
};

/**
 * Aggregate leaderboard: for each faction, count of users, total credits,
 * and average player level.
 */
const getLeaderboard = async () => {
  const results = await User.findAll({
    attributes: [
      'faction',
      [sequelize.fn('COUNT', sequelize.col('user_id')), 'userCount'],
      [sequelize.fn('SUM', sequelize.col('credits')), 'totalCredits'],
      [sequelize.fn('AVG', sequelize.col('player_level')), 'avgLevel']
    ],
    group: ['faction']
  });

  return results.map((r) => ({
    faction: r.faction,
    userCount: parseInt(r.getDataValue('userCount'), 10) || 0,
    totalCredits: parseInt(r.getDataValue('totalCredits'), 10) || 0,
    avgLevel: parseFloat(r.getDataValue('avgLevel')) || 0
  }));
};

/**
 * Return all three faction configs with name, description, lore, bonuses, and color.
 */
const listFactions = () => {
  return FACTION_KEYS.map((key) => {
    const f = config.factions[key];
    return {
      key,
      name: f.name,
      description: f.description,
      lore: f.lore,
      bonuses: f.bonuses,
      color: f.color
    };
  });
};

module.exports = {
  getFactionConfig,
  applyFactionBonus,
  initializeStandings,
  modifyStanding,
  getStandings,
  getLeaderboard,
  listFactions
};
