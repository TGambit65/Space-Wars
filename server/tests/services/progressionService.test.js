const { cleanDatabase, createTestUser } = require('../helpers');
const progressionService = require('../../src/services/progressionService');
const { User, PlayerSkill, TechResearch } = require('../../src/models');

describe('Progression Service', () => {
  let user;

  beforeEach(async () => {
    await cleanDatabase();
    user = await createTestUser({ credits: 100000 });
  });

  describe('awardXP', () => {
    it('should add XP to the user', async () => {
      const result = await progressionService.awardXP(user.user_id, 50, 'test');
      expect(result.xp_gained).toBe(50);
      expect(result.total_xp).toBe(50);
    });

    it('should level up when XP threshold reached', async () => {
      // Level 2 requires 100 XP
      const result = await progressionService.awardXP(user.user_id, 150, 'test');
      expect(result.new_level).toBe(2);
      expect(result.levels_gained).toBe(1);
      expect(result.available_skill_points).toBe(1);
    });

    it('should handle multiple level-ups at once', async () => {
      // Level 2=100, Level 3=250 total (100+150). Give 300 XP = level 3
      const result = await progressionService.awardXP(user.user_id, 400, 'test');
      expect(result.new_level).toBeGreaterThanOrEqual(3);
      expect(result.levels_gained).toBeGreaterThanOrEqual(2);
    });

    it('should throw for invalid user', async () => {
      await expect(
        progressionService.awardXP('00000000-0000-0000-0000-000000000000', 50, 'test')
      ).rejects.toThrow('User not found');
    });
  });

  describe('calculateLevel', () => {
    it('should return level 1 for 0 XP', () => {
      expect(progressionService.calculateLevel(0)).toBe(1);
    });

    it('should return level 2 for 100 XP', () => {
      expect(progressionService.calculateLevel(100)).toBe(2);
    });
  });

  describe('upgradeSkill', () => {
    beforeEach(async () => {
      // Give the user a skill point
      await user.update({ available_skill_points: 3 });
    });

    it('should upgrade a skill and consume a skill point', async () => {
      const result = await progressionService.upgradeSkill(user.user_id, 'COMBAT_MASTERY');
      expect(result.skill_name).toBe('COMBAT_MASTERY');
      expect(result.new_level).toBe(1);
      expect(result.remaining_points).toBe(2);
    });

    it('should fail with no skill points', async () => {
      await user.update({ available_skill_points: 0 });
      await expect(
        progressionService.upgradeSkill(user.user_id, 'COMBAT_MASTERY')
      ).rejects.toThrow('No available skill points');
    });

    it('should fail for invalid skill name', async () => {
      await expect(
        progressionService.upgradeSkill(user.user_id, 'INVALID_SKILL')
      ).rejects.toThrow('Invalid skill name');
    });

    it('should fail when skill at max level', async () => {
      await user.update({ available_skill_points: 15 });
      // Upgrade to max (10)
      for (let i = 0; i < 10; i++) {
        await progressionService.upgradeSkill(user.user_id, 'COMBAT_MASTERY');
      }
      await expect(
        progressionService.upgradeSkill(user.user_id, 'COMBAT_MASTERY')
      ).rejects.toThrow('Skill already at max level');
    });
  });

  describe('getSkillEffects', () => {
    it('should aggregate skill effects', async () => {
      await PlayerSkill.create({ user_id: user.user_id, skill_name: 'COMBAT_MASTERY', level: 5, xp_current: 0 });
      await PlayerSkill.create({ user_id: user.user_id, skill_name: 'SHIELD_EXPERTISE', level: 3, xp_current: 0 });

      const effects = await progressionService.getSkillEffects(user.user_id);
      expect(effects.damage_bonus).toBeCloseTo(0.15); // 5 * 0.03
      expect(effects.shield_bonus).toBeCloseTo(0.12); // 3 * 0.04
    });

    it('should return empty for no skills', async () => {
      const effects = await progressionService.getSkillEffects(user.user_id);
      expect(Object.keys(effects)).toHaveLength(0);
    });
  });

  describe('Tech Research', () => {
    it('should start research and deduct credits', async () => {
      const research = await progressionService.startResearch(user.user_id, 'BASIC_CRAFTING');
      expect(research.tech_name).toBe('BASIC_CRAFTING');
      expect(research.is_completed).toBe(false);

      await user.reload();
      expect(Number(user.credits)).toBe(100000 - 5000); // BASIC_CRAFTING costs 5000
    });

    it('should fail with insufficient credits', async () => {
      await user.update({ credits: 100 });
      await expect(
        progressionService.startResearch(user.user_id, 'BASIC_CRAFTING')
      ).rejects.toThrow('Insufficient credits');
    });

    it('should fail when prerequisites not met', async () => {
      await expect(
        progressionService.startResearch(user.user_id, 'CAPITAL_CLASS_SHIPS')
      ).rejects.toThrow(/Prerequisite not met/);
    });

    it('should fail when already researching', async () => {
      await progressionService.startResearch(user.user_id, 'BASIC_CRAFTING');
      await expect(
        progressionService.startResearch(user.user_id, 'BASIC_CRAFTING')
      ).rejects.toThrow('Research already in progress');
    });

    it('should complete research when time has elapsed', async () => {
      await TechResearch.create({
        user_id: user.user_id,
        tech_name: 'BASIC_CRAFTING',
        is_completed: false,
        started_at: new Date(Date.now() - 3600000),
        completes_at: new Date(Date.now() - 1000), // Already elapsed
        credits_spent: 5000
      });

      const research = await progressionService.completeResearch(user.user_id, 'BASIC_CRAFTING');
      expect(research.is_completed).toBe(true);
    });

    it('should not complete research before time', async () => {
      await TechResearch.create({
        user_id: user.user_id,
        tech_name: 'BASIC_CRAFTING',
        is_completed: false,
        started_at: new Date(),
        completes_at: new Date(Date.now() + 9999999),
        credits_spent: 5000
      });

      await expect(
        progressionService.completeResearch(user.user_id, 'BASIC_CRAFTING')
      ).rejects.toThrow('Research not yet complete');
    });

    it('should check and complete all ready research', async () => {
      await TechResearch.create({
        user_id: user.user_id,
        tech_name: 'BASIC_CRAFTING',
        is_completed: false,
        started_at: new Date(Date.now() - 7200000),
        completes_at: new Date(Date.now() - 1000),
        credits_spent: 5000
      });

      const completed = await progressionService.checkResearchCompletion(user.user_id);
      expect(completed).toContain('BASIC_CRAFTING');
    });

    it('should list available techs with met prerequisites', async () => {
      const available = await progressionService.getAvailableTechs(user.user_id);
      // Should include techs with no prerequisites
      const names = available.map(t => t.tech_name);
      expect(names).toContain('BASIC_CRAFTING');
      expect(names).toContain('DEEP_SCANNING');
      // Should not include techs with prerequisites
      expect(names).not.toContain('CAPITAL_CLASS_SHIPS');
    });
  });

  describe('getPlayerProgression', () => {
    it('should return full progression summary', async () => {
      const progression = await progressionService.getPlayerProgression(user.user_id);
      expect(progression.user_id).toBe(user.user_id);
      expect(progression.total_xp).toBe(0);
      expect(progression.player_level).toBe(1);
      expect(progression.skills).toEqual([]);
      expect(progression.tech_research).toEqual([]);
    });
  });
});
