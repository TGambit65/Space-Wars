const achievementDefinitions = require('../config/achievements');
const { Achievement, PlayerAchievement, User, CosmeticUnlock } = require('../models');

const emitUnlockEvent = async (userId, achievement) => {
  try {
    const socketService = require('./socketService');
    socketService.emitToUser(userId, 'achievement:unlocked', {
      achievement_id: achievement.achievement_id,
      name: achievement.name,
      description: achievement.description,
      rarity: achievement.rarity,
      reward_credits: achievement.reward_credits,
      reward_xp: achievement.reward_xp,
      reward_cosmetic_type: achievement.reward_cosmetic_type,
      reward_cosmetic_id: achievement.reward_cosmetic_id,
      reward_title: achievement.reward_title
    });
  } catch (_) {
    // Socket service is best-effort and may not be initialized in tests.
  }
};

async function seedAchievements() {
  for (const definition of achievementDefinitions) {
    await Achievement.findOrCreate({
      where: { achievement_id: definition.achievement_id },
      defaults: definition
    });
  }
}

async function distributeReward(userId, achievement) {
  if (Number(achievement.reward_credits) > 0) {
    const user = await User.findByPk(userId);
    if (user) {
      await user.update({
        credits: Number(user.credits || 0) + Number(achievement.reward_credits || 0)
      });
    }
  }

  if (achievement.reward_cosmetic_type && achievement.reward_cosmetic_id) {
    await CosmeticUnlock.findOrCreate({
      where: {
        user_id: userId,
        cosmetic_type: achievement.reward_cosmetic_type,
        cosmetic_id: achievement.reward_cosmetic_id
      },
      defaults: {
        unlocked_at: new Date()
      }
    });
  }

  if (Number(achievement.reward_xp) > 0) {
    try {
      const progressionService = require('./progressionService');
      await progressionService.awardXP(userId, Number(achievement.reward_xp), 'achievement_reward');
    } catch (_) {
      // XP rewards are best-effort until achievement rewards are fully integrated.
    }
  }
}

async function incrementProgress(userId, achievementId, amount = 1) {
  const achievement = await Achievement.findByPk(achievementId);
  if (!achievement || !achievement.is_active) return null;

  const [progress] = await PlayerAchievement.findOrCreate({
    where: { user_id: userId, achievement_id: achievementId },
    defaults: { current_value: 0 }
  });

  if (progress.unlocked) {
    return { progress, justUnlocked: false };
  }

  const newValue = progress.current_value + amount;
  const justUnlocked = newValue >= achievement.target_value;

  const updatedProgress = await progress.update({
    current_value: Math.min(newValue, achievement.target_value),
    unlocked: justUnlocked,
    unlocked_at: justUnlocked ? new Date() : null,
    reward_claimed: justUnlocked ? true : progress.reward_claimed,
    updated_at: new Date()
  });

  if (justUnlocked) {
    await distributeReward(userId, achievement);
    await emitUnlockEvent(userId, achievement);
  }

  return { progress: updatedProgress, justUnlocked };
}

async function setProgress(userId, achievementId, value) {
  const achievement = await Achievement.findByPk(achievementId);
  if (!achievement || !achievement.is_active) return null;

  const [progress] = await PlayerAchievement.findOrCreate({
    where: { user_id: userId, achievement_id: achievementId },
    defaults: { current_value: 0 }
  });

  if (progress.unlocked) {
    return { progress, justUnlocked: false };
  }

  const justUnlocked = value >= achievement.target_value;
  const updatedProgress = await progress.update({
    current_value: Math.min(value, achievement.target_value),
    unlocked: justUnlocked,
    unlocked_at: justUnlocked ? new Date() : null,
    reward_claimed: justUnlocked ? true : progress.reward_claimed,
    updated_at: new Date()
  });

  if (justUnlocked) {
    await distributeReward(userId, achievement);
    await emitUnlockEvent(userId, achievement);
  }

  return { progress: updatedProgress, justUnlocked };
}

async function getPlayerAchievements(userId) {
  const achievements = await Achievement.findAll({
    where: { is_active: true },
    order: [['category', 'ASC'], ['sort_order', 'ASC']],
    include: [{
      model: PlayerAchievement,
      as: 'playerProgress',
      where: { user_id: userId },
      required: false
    }]
  });

  return achievements.map((achievement) => {
    const progress = achievement.playerProgress?.[0];
    const unlocked = progress?.unlocked || false;

    return {
      achievement_id: achievement.achievement_id,
      name: achievement.is_hidden && !unlocked ? '???' : achievement.name,
      description: achievement.is_hidden && !unlocked ? 'Hidden achievement' : achievement.description,
      category: achievement.category,
      icon: achievement.icon,
      rarity: achievement.rarity,
      target_value: achievement.target_value,
      current_value: progress?.current_value || 0,
      unlocked,
      unlocked_at: progress?.unlocked_at || null,
      reward_credits: achievement.reward_credits,
      reward_xp: achievement.reward_xp,
      reward_cosmetic_type: achievement.reward_cosmetic_type,
      reward_cosmetic_id: achievement.reward_cosmetic_id,
      reward_title: achievement.reward_title,
      is_hidden: achievement.is_hidden
    };
  });
}

async function getUnlockStats(userId) {
  const total = await Achievement.count({ where: { is_active: true } });
  const unlocked = await PlayerAchievement.count({ where: { user_id: userId, unlocked: true } });
  const recentUnlocks = await PlayerAchievement.findAll({
    where: { user_id: userId, unlocked: true },
    include: [{ model: Achievement, as: 'achievement' }],
    order: [['unlocked_at', 'DESC']],
    limit: 5
  });

  return {
    total,
    unlocked,
    completion_pct: total > 0 ? Math.round((unlocked / total) * 100) : 0,
    recent: recentUnlocks.map((progress) => ({
      achievement_id: progress.achievement_id,
      name: progress.achievement?.name || progress.achievement_id,
      rarity: progress.achievement?.rarity || 'common',
      unlocked_at: progress.unlocked_at
    }))
  };
}

module.exports = {
  seedAchievements,
  incrementProgress,
  setProgress,
  distributeReward,
  getPlayerAchievements,
  getUnlockStats
};
