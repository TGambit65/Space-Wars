const { User, PlayerSkill, TechResearch } = require('../models');
const { Op } = require('sequelize');
const { sequelize } = require('../config/database');
const config = require('../config');

/**
 * Award XP to a player, checking for level-ups
 */
const awardXP = async (userId, amount, source, transaction = null) => {
  const user = await User.findByPk(userId, { transaction });
  if (!user) {
    const error = new Error('User not found');
    error.statusCode = 404;
    throw error;
  }

  const newXP = Number(user.total_xp || 0) + amount;
  const oldLevel = user.player_level || 1;
  const newLevel = calculateLevel(newXP);
  const levelsGained = newLevel - oldLevel;
  const newSkillPoints = (user.available_skill_points || 0) + (levelsGained * config.progression.skillPointsPerLevel);

  await user.update({
    total_xp: newXP,
    player_level: newLevel,
    available_skill_points: newSkillPoints
  }, { transaction });

  // Emit level-up event via socket if player gained levels
  if (levelsGained > 0) {
    try {
      const socketService = require('./socketService');
      socketService.emitToUser(userId, 'player:level_up', {
        old_level: oldLevel,
        new_level: newLevel,
        levels_gained: levelsGained,
        available_skill_points: newSkillPoints,
        source
      });
    } catch (_) { /* socket emission should not block XP award */ }
  }

  return {
    xp_gained: amount,
    total_xp: newXP,
    old_level: oldLevel,
    new_level: newLevel,
    levels_gained: levelsGained,
    available_skill_points: newSkillPoints,
    source
  };
};

/**
 * Calculate player level from total XP
 */
const calculateLevel = (totalXP) => {
  const table = config.progression.xpPerLevel;
  let level = 1;
  let cumulative = 0;
  for (let i = 1; i < table.length; i++) {
    cumulative += table[i];
    if (totalXP >= cumulative) {
      level = i + 1;
    } else {
      break;
    }
  }
  return Math.min(level, config.progression.maxPlayerLevel);
};

/**
 * Get full progression summary for a player
 */
const getPlayerProgression = async (userId) => {
  const user = await User.findByPk(userId);
  if (!user) {
    const error = new Error('User not found');
    error.statusCode = 404;
    throw error;
  }

  const skills = await PlayerSkill.findAll({ where: { user_id: userId } });
  const techs = await TechResearch.findAll({ where: { user_id: userId } });

  const currentLevel = user.player_level || 1;
  const xpForCurrentLevel = getXPForLevel(currentLevel);
  const xpForNextLevel = getXPForLevel(currentLevel + 1);

  return {
    user_id: userId,
    total_xp: Number(user.total_xp || 0),
    player_level: currentLevel,
    available_skill_points: user.available_skill_points || 0,
    xp_to_next_level: xpForNextLevel !== null ? xpForNextLevel - Number(user.total_xp || 0) : null,
    skills: skills.map(s => ({
      skill_name: s.skill_name,
      level: s.level,
      xp_current: s.xp_current
    })),
    tech_research: techs.map(t => ({
      tech_name: t.tech_name,
      is_completed: t.is_completed,
      completes_at: t.completes_at
    }))
  };
};

/**
 * Get cumulative XP needed to reach a level
 */
const getXPForLevel = (level) => {
  const table = config.progression.xpPerLevel;
  if (level <= 1) return 0;
  if (level > config.progression.maxPlayerLevel) return null;
  let cumulative = 0;
  for (let i = 1; i < level && i < table.length; i++) {
    cumulative += table[i];
  }
  return cumulative;
};

/**
 * Upgrade a skill using available skill points
 */
const upgradeSkill = async (userId, skillName) => {
  const skillConfig = config.skills[skillName];
  if (!skillConfig) {
    const error = new Error('Invalid skill name');
    error.statusCode = 400;
    throw error;
  }

  const transaction = await sequelize.transaction();
  try {
    const user = await User.findByPk(userId, { transaction, lock: true });
    if (!user) {
      const error = new Error('User not found');
      error.statusCode = 404;
      throw error;
    }

    if ((user.available_skill_points || 0) < 1) {
      const error = new Error('No available skill points');
      error.statusCode = 400;
      throw error;
    }

    const [skill] = await PlayerSkill.findOrCreate({
      where: { user_id: userId, skill_name: skillName },
      defaults: { user_id: userId, skill_name: skillName, level: 0, xp_current: 0 },
      transaction
    });

    if (skill.level >= config.progression.maxSkillLevel) {
      const error = new Error('Skill already at max level');
      error.statusCode = 400;
      throw error;
    }

    await skill.update({ level: skill.level + 1 }, { transaction });
    await user.update({ available_skill_points: user.available_skill_points - 1 }, { transaction });

    await transaction.commit();

    return {
      skill_name: skillName,
      new_level: skill.level,
      remaining_points: user.available_skill_points
    };
  } catch (err) {
    await transaction.rollback();
    throw err;
  }
};

/**
 * Get aggregated skill effects for a user
 */
const getSkillEffects = async (userId) => {
  const skills = await PlayerSkill.findAll({ where: { user_id: userId } });
  const effects = {};

  for (const skill of skills) {
    const skillConfig = config.skills[skill.skill_name];
    if (!skillConfig) continue;

    for (const [effectName, perLevel] of Object.entries(skillConfig.effectPerLevel)) {
      effects[effectName] = (effects[effectName] || 0) + (perLevel * skill.level);
    }
  }

  return effects;
};

/**
 * Start researching a tech
 */
const startResearch = async (userId, techName) => {
  const techConfig = config.techTree[techName];
  if (!techConfig) {
    const error = new Error('Invalid tech name');
    error.statusCode = 400;
    throw error;
  }

  const transaction = await sequelize.transaction();
  try {
    const user = await User.findByPk(userId, { transaction, lock: true });
    if (!user) {
      const error = new Error('User not found');
      error.statusCode = 404;
      throw error;
    }

    // Check prerequisites
    for (const prereq of techConfig.prerequisites) {
      const completed = await TechResearch.findOne({
        where: { user_id: userId, tech_name: prereq, is_completed: true },
        transaction
      });
      if (!completed) {
        const error = new Error(`Prerequisite not met: ${prereq}`);
        error.statusCode = 400;
        throw error;
      }
    }

    // Check if already researched or in progress
    const existing = await TechResearch.findOne({
      where: { user_id: userId, tech_name: techName },
      transaction
    });
    if (existing) {
      const error = new Error(existing.is_completed ? 'Tech already researched' : 'Research already in progress');
      error.statusCode = 400;
      throw error;
    }

    // Check credits
    if (Number(user.credits) < techConfig.creditsCost) {
      const error = new Error('Insufficient credits');
      error.statusCode = 400;
      throw error;
    }

    await user.update({ credits: Number(user.credits) - techConfig.creditsCost }, { transaction });

    // Apply faction technology bonus to research speed
    let researchTimeMs = techConfig.researchTimeMs;
    try {
      const factionConfig = config.factions[user.faction];
      if (factionConfig) {
        const techBonus = factionConfig.bonuses.technology || 1.0;
        const extraSpeedBonus = factionConfig.researchSpeedBonus || 0;
        researchTimeMs = Math.floor(researchTimeMs / (techBonus + extraSpeedBonus));
      }
    } catch (e) { /* faction bonus failure should not block research */ }

    const now = new Date();
    const research = await TechResearch.create({
      user_id: userId,
      tech_name: techName,
      is_completed: false,
      started_at: now,
      completes_at: new Date(now.getTime() + researchTimeMs),
      credits_spent: techConfig.creditsCost
    }, { transaction });

    await transaction.commit();
    return research;
  } catch (err) {
    await transaction.rollback();
    throw err;
  }
};

/**
 * Complete a specific research if time has elapsed
 */
const completeResearch = async (userId, techName) => {
  const research = await TechResearch.findOne({
    where: { user_id: userId, tech_name: techName, is_completed: false }
  });
  if (!research) {
    const error = new Error('No active research found for this tech');
    error.statusCode = 404;
    throw error;
  }

  if (new Date() < new Date(research.completes_at)) {
    const error = new Error('Research not yet complete');
    error.statusCode = 400;
    throw error;
  }

  await research.update({ is_completed: true });
  return research;
};

/**
 * Check and complete all ready research for a user
 */
const checkResearchCompletion = async (userId) => {
  const ready = await TechResearch.findAll({
    where: {
      user_id: userId,
      is_completed: false,
      completes_at: { [Op.lte]: new Date() }
    }
  });

  const completed = [];
  for (const research of ready) {
    await research.update({ is_completed: true });
    completed.push(research.tech_name);
  }

  return completed;
};

/**
 * Check if a user has completed a specific tech
 */
const hasCompletedTech = async (userId, techName) => {
  const research = await TechResearch.findOne({
    where: { user_id: userId, tech_name: techName, is_completed: true }
  });
  return !!research;
};

/**
 * Get available techs (prerequisites met, not started)
 */
const getAvailableTechs = async (userId) => {
  const completedTechs = await TechResearch.findAll({
    where: { user_id: userId, is_completed: true }
  });
  const completedNames = new Set(completedTechs.map(t => t.tech_name));

  const allTechs = await TechResearch.findAll({ where: { user_id: userId } });
  const startedNames = new Set(allTechs.map(t => t.tech_name));

  const available = [];
  for (const [techName, techConfig] of Object.entries(config.techTree)) {
    if (startedNames.has(techName)) continue;

    const prereqsMet = techConfig.prerequisites.every(p => completedNames.has(p));
    if (prereqsMet) {
      available.push({ tech_name: techName, ...techConfig });
    }
  }

  return available;
};

module.exports = {
  awardXP,
  calculateLevel,
  getPlayerProgression,
  upgradeSkill,
  getSkillEffects,
  startResearch,
  completeResearch,
  checkResearchCompletion,
  hasCompletedTech,
  getAvailableTechs
};
