const { Colony, Planet, User, sequelize } = require('../models');
const config = require('../config');

/**
 * Calculate total defense rating for a colony from its buildings
 */
const calculateDefenseRating = (colony) => {
  // Base defense from colony level
  let defense = colony.infrastructure_level * 5;
  // Add the stored defense_rating (from buildings via colonyBuildingService)
  defense += colony.defense_rating || 0;
  return defense;
};

/**
 * Trigger a pirate raid on a colony
 */
const triggerRaid = async (colonyId) => {
  const transaction = await sequelize.transaction();
  try {
    const colony = await Colony.findByPk(colonyId, {
      include: [{ model: Planet, as: 'planet' }],
      transaction,
      lock: transaction.LOCK.UPDATE
    });

    if (!colony || !colony.is_active) {
      await transaction.rollback();
      return null;
    }

    // Don't raid colonies that were raided in the last hour
    if (colony.last_raid && (Date.now() - new Date(colony.last_raid).getTime()) < 3600000) {
      await transaction.rollback();
      return null;
    }

    const defenseRating = calculateDefenseRating(colony);

    // Raid strength scales with colony infrastructure level
    const baseRaidStrength = 10 + colony.infrastructure_level * 8;
    const raidStrength = baseRaidStrength + Math.floor(Math.random() * 20);

    const outcome = calculateRaidOutcome(raidStrength, defenseRating);
    await processRaidDamage(colony, outcome, transaction);

    await colony.update({ last_raid: new Date() }, { transaction });
    await transaction.commit();

    return {
      colony_id: colony.colony_id,
      colony_name: colony.name,
      raid_strength: raidStrength,
      defense_rating: defenseRating,
      outcome
    };
  } catch (error) {
    await transaction.rollback();
    throw error;
  }
};

/**
 * Calculate raid outcome based on strength vs defense
 */
const calculateRaidOutcome = (raidStrength, defenseRating) => {
  const ratio = defenseRating / Math.max(1, raidStrength);

  if (ratio >= 2.0) {
    // Overwhelming defense - raid repelled completely
    return { result: 'repelled', populationLoss: 0, resourcesStolen: 0, damage: 0, message: 'Colony defenses easily repelled the pirate raid!' };
  } else if (ratio >= 1.0) {
    // Strong defense - minor damage
    const damage = Math.floor(5 * (2 - ratio));
    return { result: 'minor_damage', populationLoss: Math.floor(Math.random() * 5), resourcesStolen: 0, damage, message: 'Colony defenses held but sustained minor damage.' };
  } else if (ratio >= 0.5) {
    // Moderate defense - significant damage
    const damage = Math.floor(15 + Math.random() * 10);
    const popLoss = Math.floor(10 + Math.random() * 15);
    return { result: 'moderate_damage', populationLoss: popLoss, resourcesStolen: Math.floor(500 + Math.random() * 1000), damage, message: 'Pirates breached outer defenses. Colony sustained moderate damage.' };
  } else {
    // Weak defense - heavy damage
    const damage = Math.floor(25 + Math.random() * 20);
    const popLoss = Math.floor(20 + Math.random() * 30);
    return { result: 'heavy_damage', populationLoss: popLoss, resourcesStolen: Math.floor(1000 + Math.random() * 2000), damage, message: 'Pirates overwhelmed colony defenses! Heavy damage sustained.' };
  }
};

/**
 * Apply raid damage to colony
 */
const processRaidDamage = async (colony, outcome, transaction) => {
  const updates = {};

  if (outcome.populationLoss > 0) {
    updates.population = Math.max(10, colony.population - outcome.populationLoss);
  }

  if (outcome.damage > 0) {
    updates.raid_damage = (colony.raid_damage || 0) + outcome.damage;
  }

  if (outcome.resourcesStolen > 0) {
    // Deduct credits from colony owner
    const user = await User.findByPk(colony.user_id, { transaction, lock: transaction.LOCK.UPDATE });
    if (user) {
      const stolen = Math.min(user.credits, outcome.resourcesStolen);
      await user.update({ credits: user.credits - stolen }, { transaction });
      outcome.creditsStolen = stolen;
    }
  }

  if (Object.keys(updates).length > 0) {
    await colony.update(updates, { transaction });
  }
};

/**
 * Get recent raids for a user's colonies
 */
const getRecentRaids = async (userId) => {
  const colonies = await Colony.findAll({
    where: { user_id: userId, is_active: true },
    attributes: ['colony_id', 'name', 'last_raid', 'raid_damage', 'defense_rating', 'infrastructure_level'],
    order: [['last_raid', 'DESC']]
  });

  return colonies
    .filter(c => c.last_raid)
    .map(c => ({
      colony_id: c.colony_id,
      colony_name: c.name,
      last_raid: c.last_raid,
      raid_damage: c.raid_damage,
      defense_rating: calculateDefenseRating(c)
    }));
};

module.exports = {
  calculateDefenseRating,
  triggerRaid,
  calculateRaidOutcome,
  processRaidDamage,
  getRecentRaids
};
