/**
 * Daily Quest Service — manages daily quest generation, progress tracking, and claiming.
 */
const { DailyQuest, User, sequelize } = require('../models');
const progressionService = require('./progressionService');
const config = require('../config');
const { Op } = require('sequelize');

/**
 * Get or generate today's quests for a user.
 * Lazy generation: if no quests exist for today's day_bucket, generate new ones.
 * Deletes expired quests. Returns all active+completed quests for today.
 */
async function getDailyQuests(userId) {
  const dayBucket = Math.floor(Date.now() / 86400000);
  const expiresAt = new Date((dayBucket + 1) * 86400000);

  // Clean up expired quests
  await DailyQuest.destroy({
    where: {
      user_id: userId,
      expires_at: { [Op.lt]: new Date() }
    }
  });

  // Check if quests exist for today
  const existing = await DailyQuest.findAll({
    where: {
      user_id: userId,
      day_bucket: dayBucket
    },
    order: [['createdAt', 'ASC']]
  });

  if (existing.length > 0) {
    return existing.map(q => q.toJSON());
  }

  // Generate new quests for today
  const questConfig = config.colonySurface.dailyQuests;
  const typeKeys = Object.keys(questConfig.types);

  // Pick questsPerDay distinct types
  const shuffled = [...typeKeys].sort(() => Math.random() - 0.5);
  const selected = shuffled.slice(0, Math.min(questConfig.questsPerDay, typeKeys.length));

  const quests = [];
  for (const questType of selected) {
    const typeInfo = questConfig.types[questType];
    const targetCount = typeInfo.minN + Math.floor(Math.random() * (typeInfo.maxN - typeInfo.minN + 1));

    const quest = await DailyQuest.create({
      user_id: userId,
      quest_type: questType,
      target_count: targetCount,
      current_count: 0,
      xp_reward: typeInfo.xpReward,
      credit_reward: typeInfo.creditReward,
      status: 'active',
      day_bucket: dayBucket,
      expires_at: expiresAt
    });
    quests.push(quest.toJSON());
  }

  return quests;
}

/**
 * Increment progress for matching active quests of the given type.
 * Auto-sets status to 'completed' when current_count >= target_count.
 */
async function incrementProgress(userId, questType, amount = 1) {
  const dayBucket = Math.floor(Date.now() / 86400000);

  const quests = await DailyQuest.findAll({
    where: {
      user_id: userId,
      quest_type: questType,
      status: 'active',
      day_bucket: dayBucket
    }
  });

  const updated = [];
  for (const quest of quests) {
    const newCount = Math.min(quest.current_count + amount, quest.target_count);
    const newStatus = newCount >= quest.target_count ? 'completed' : 'active';

    await quest.update({
      current_count: newCount,
      status: newStatus
    });
    updated.push(quest.toJSON());
  }

  return updated;
}

/**
 * Claim a completed quest — award XP and credits, set status to 'claimed'.
 */
async function claimQuest(userId, questId) {
  const transaction = await sequelize.transaction();
  try {
    const quest = await DailyQuest.findOne({
      where: { quest_id: questId, user_id: userId },
      lock: transaction.LOCK.UPDATE,
      transaction
    });

    if (!quest) {
      throw Object.assign(new Error('Quest not found'), { statusCode: 404 });
    }
    if (quest.status === 'claimed') {
      throw Object.assign(new Error('Quest already claimed'), { statusCode: 400 });
    }
    if (quest.status !== 'completed') {
      throw Object.assign(new Error('Quest not yet completed'), { statusCode: 400 });
    }

    // Award credits
    const user = await User.findByPk(userId, { transaction, lock: true });
    await user.update({ credits: Number(user.credits) + quest.credit_reward }, { transaction });

    // Award XP via progression service
    await progressionService.awardXP(userId, quest.xp_reward, 'daily_quest', transaction);

    await quest.update({ status: 'claimed' }, { transaction });

    await transaction.commit();

    return {
      claimed: true,
      quest_id: quest.quest_id,
      quest_type: quest.quest_type,
      xp_reward: quest.xp_reward,
      credit_reward: quest.credit_reward
    };
  } catch (err) {
    await transaction.rollback();
    throw err;
  }
}

module.exports = {
  getDailyQuests,
  incrementProgress,
  claimQuest
};
