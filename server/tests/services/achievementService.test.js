const achievementService = require('../../src/services/achievementService');
const definitions = require('../../src/config/achievements');
const { Achievement, PlayerAchievement, User, CosmeticUnlock } = require('../../src/models');
const { createTestUser, createTestAchievement, cleanDatabase } = require('../helpers');

describe('achievementService', () => {
  beforeEach(async () => {
    await cleanDatabase();
  });

  describe('seedAchievements', () => {
    it('seeds all definitions into the database', async () => {
      await achievementService.seedAchievements();

      const count = await Achievement.count();
      expect(count).toBe(definitions.length);
    });

    it('is idempotent when run multiple times', async () => {
      await achievementService.seedAchievements();
      await achievementService.seedAchievements();

      const count = await Achievement.count();
      expect(count).toBe(definitions.length);
    });
  });

  describe('incrementProgress', () => {
    let user;

    beforeEach(async () => {
      user = await createTestUser();
    });

    it('increments progress by 1', async () => {
      const achievement = await createTestAchievement({ target_value: 5, reward_credits: 0 });

      const result = await achievementService.incrementProgress(user.user_id, achievement.achievement_id);

      expect(result.justUnlocked).toBe(false);
      expect(result.progress.current_value).toBe(1);
      expect(result.progress.unlocked).toBe(false);
    });

    it('increments progress by a custom amount', async () => {
      const achievement = await createTestAchievement({ target_value: 10, reward_credits: 0 });

      const result = await achievementService.incrementProgress(user.user_id, achievement.achievement_id, 4);

      expect(result.justUnlocked).toBe(false);
      expect(result.progress.current_value).toBe(4);
    });

    it('unlocks when target_value is reached', async () => {
      const achievement = await createTestAchievement({ target_value: 3, reward_credits: 0 });

      await achievementService.incrementProgress(user.user_id, achievement.achievement_id, 2);
      const result = await achievementService.incrementProgress(user.user_id, achievement.achievement_id, 1);

      expect(result.justUnlocked).toBe(true);
      expect(result.progress.current_value).toBe(3);
      expect(result.progress.unlocked).toBe(true);
      expect(result.progress.unlocked_at).toBeTruthy();
      expect(result.progress.reward_claimed).toBe(true);
    });

    it('does not increment past target_value', async () => {
      const achievement = await createTestAchievement({ target_value: 3, reward_credits: 0 });

      const result = await achievementService.incrementProgress(user.user_id, achievement.achievement_id, 10);

      expect(result.justUnlocked).toBe(true);
      expect(result.progress.current_value).toBe(3);
    });

    it('does not re-unlock an already unlocked achievement', async () => {
      const achievement = await createTestAchievement({ target_value: 1, reward_credits: 250 });

      const firstResult = await achievementService.incrementProgress(user.user_id, achievement.achievement_id);
      const creditsAfterFirstUnlock = Number((await User.findByPk(user.user_id)).credits);
      const secondResult = await achievementService.incrementProgress(user.user_id, achievement.achievement_id);
      const creditsAfterSecondCall = Number((await User.findByPk(user.user_id)).credits);

      expect(firstResult.justUnlocked).toBe(true);
      expect(secondResult.justUnlocked).toBe(false);
      expect(creditsAfterFirstUnlock).toBe(10250);
      expect(creditsAfterSecondCall).toBe(creditsAfterFirstUnlock);
    });

    it('distributes credit rewards on unlock', async () => {
      const userWithKnownBalance = await createTestUser({ credits: 5000 });
      const achievement = await createTestAchievement({ target_value: 2, reward_credits: 750 });

      await achievementService.incrementProgress(userWithKnownBalance.user_id, achievement.achievement_id, 1);
      await achievementService.incrementProgress(userWithKnownBalance.user_id, achievement.achievement_id, 1);

      const updatedUser = await User.findByPk(userWithKnownBalance.user_id);
      expect(Number(updatedUser.credits)).toBe(5750);
    });

    it('returns null for a non-existent achievement', async () => {
      const result = await achievementService.incrementProgress(user.user_id, 'missing_achievement');
      expect(result).toBeNull();
    });

    it('returns null for an inactive achievement', async () => {
      const achievement = await createTestAchievement({ is_active: false });

      const result = await achievementService.incrementProgress(user.user_id, achievement.achievement_id);

      expect(result).toBeNull();
    });
  });

  describe('setProgress', () => {
    let user;

    beforeEach(async () => {
      user = await createTestUser();
    });

    it('sets absolute progress value', async () => {
      const achievement = await createTestAchievement({ target_value: 10, reward_credits: 0 });

      const result = await achievementService.setProgress(user.user_id, achievement.achievement_id, 4);

      expect(result.justUnlocked).toBe(false);
      expect(result.progress.current_value).toBe(4);
    });

    it('unlocks when value is greater than or equal to target', async () => {
      const achievement = await createTestAchievement({ target_value: 5, reward_credits: 400 });

      const result = await achievementService.setProgress(user.user_id, achievement.achievement_id, 8);
      const updatedUser = await User.findByPk(user.user_id);

      expect(result.justUnlocked).toBe(true);
      expect(result.progress.current_value).toBe(5);
      expect(Number(updatedUser.credits)).toBe(10400);
    });

    it('updates to the provided lower value before unlock', async () => {
      const achievement = await createTestAchievement({ target_value: 10, reward_credits: 0 });

      await achievementService.setProgress(user.user_id, achievement.achievement_id, 6);
      const result = await achievementService.setProgress(user.user_id, achievement.achievement_id, 2);

      expect(result.justUnlocked).toBe(false);
      expect(result.progress.current_value).toBe(2);
    });
  });

  describe('distributeReward', () => {
    it('adds credits to the user balance', async () => {
      const user = await createTestUser({ credits: 2500 });
      const achievement = await createTestAchievement({ reward_credits: 500, reward_xp: 0 });

      await achievementService.distributeReward(user.user_id, achievement);

      const updatedUser = await User.findByPk(user.user_id);
      expect(Number(updatedUser.credits)).toBe(3000);
    });

    it('grants a cosmetic unlock when type and id are provided', async () => {
      const user = await createTestUser();
      const achievement = await createTestAchievement({
        reward_credits: 0,
        reward_cosmetic_type: 'engine_trail',
        reward_cosmetic_id: 'ion_blue'
      });

      await achievementService.distributeReward(user.user_id, achievement);

      const unlock = await CosmeticUnlock.findOne({
        where: {
          user_id: user.user_id,
          cosmetic_type: 'engine_trail',
          cosmetic_id: 'ion_blue'
        }
      });

      expect(unlock).toBeTruthy();
    });
  });

  describe('getPlayerAchievements', () => {
    let user;

    beforeEach(async () => {
      user = await createTestUser();
    });

    it('returns all active achievements with progress data', async () => {
      const started = await createTestAchievement({ achievement_id: 'started_progress', target_value: 5 });
      const unstarted = await createTestAchievement({ achievement_id: 'unstarted_progress', target_value: 3 });
      await createTestAchievement({ achievement_id: 'inactive_progress', is_active: false });

      await achievementService.incrementProgress(user.user_id, started.achievement_id, 2);

      const achievements = await achievementService.getPlayerAchievements(user.user_id);
      const startedEntry = achievements.find((item) => item.achievement_id === started.achievement_id);
      const unstartedEntry = achievements.find((item) => item.achievement_id === unstarted.achievement_id);

      expect(achievements).toHaveLength(2);
      expect(startedEntry.current_value).toBe(2);
      expect(startedEntry.unlocked).toBe(false);
      expect(unstartedEntry.current_value).toBe(0);
      expect(unstartedEntry.unlocked).toBe(false);
    });

    it('shows ??? for hidden achievements until unlocked', async () => {
      const achievement = await createTestAchievement({
        achievement_id: 'hidden_secret',
        name: 'Secret Name',
        description: 'Secret Description',
        is_hidden: true,
        reward_credits: 0
      });

      const achievements = await achievementService.getPlayerAchievements(user.user_id);
      const entry = achievements.find((item) => item.achievement_id === achievement.achievement_id);

      expect(entry.name).toBe('???');
      expect(entry.description).toBe('Hidden achievement');
    });

    it('shows real hidden achievement details once unlocked', async () => {
      const achievement = await createTestAchievement({
        achievement_id: 'hidden_unlocked',
        name: 'Secret Name',
        description: 'Secret Description',
        is_hidden: true,
        reward_credits: 0
      });

      await achievementService.incrementProgress(user.user_id, achievement.achievement_id, 1);
      const achievements = await achievementService.getPlayerAchievements(user.user_id);
      const entry = achievements.find((item) => item.achievement_id === achievement.achievement_id);

      expect(entry.name).toBe('Secret Name');
      expect(entry.description).toBe('Secret Description');
      expect(entry.unlocked).toBe(true);
    });
  });

  describe('getUnlockStats', () => {
    it('returns total counts, completion percentage, and recent unlocks ordered by date', async () => {
      const user = await createTestUser();
      const first = await createTestAchievement({ achievement_id: 'stats_first', reward_credits: 0 });
      const second = await createTestAchievement({ achievement_id: 'stats_second', reward_credits: 0 });
      await createTestAchievement({ achievement_id: 'stats_third', reward_credits: 0 });

      await PlayerAchievement.create({
        user_id: user.user_id,
        achievement_id: first.achievement_id,
        current_value: 1,
        unlocked: true,
        unlocked_at: new Date('2026-01-01T00:00:00.000Z'),
        reward_claimed: true
      });
      await PlayerAchievement.create({
        user_id: user.user_id,
        achievement_id: second.achievement_id,
        current_value: 1,
        unlocked: true,
        unlocked_at: new Date('2026-02-01T00:00:00.000Z'),
        reward_claimed: true
      });

      const stats = await achievementService.getUnlockStats(user.user_id);

      expect(stats.total).toBe(3);
      expect(stats.unlocked).toBe(2);
      expect(stats.completion_pct).toBe(67);
      expect(stats.recent).toHaveLength(2);
      expect(stats.recent[0].achievement_id).toBe(second.achievement_id);
      expect(stats.recent[1].achievement_id).toBe(first.achievement_id);
    });
  });
});
