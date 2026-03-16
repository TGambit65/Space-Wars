/**
 * Game Settings Service Tests
 * Real DB — cleanDatabase() in beforeEach (already clears cache).
 */
const { sequelize, GameSetting } = require('../../src/models');
const gameSettingsService = require('../../src/services/gameSettingsService');
const { cleanDatabase } = require('../helpers');

describe('Game Settings Service', () => {
  beforeAll(async () => {
    await sequelize.sync({ force: true });
  });

  beforeEach(async () => {
    await cleanDatabase();
  });

  // ─── loadAllSettings ────────────────────────────────────────────

  describe('loadAllSettings', () => {
    it('should seed defaults when table is empty', async () => {
      await gameSettingsService.loadAllSettings();
      const count = await GameSetting.count();
      expect(count).toBeGreaterThan(0);
    });

    it('should populate cache after loading', async () => {
      await gameSettingsService.loadAllSettings();
      // Should be able to get a known default setting
      const provider = gameSettingsService.getSetting('ai_llm.tactical.provider');
      expect(provider).toBe('none');
    });

    it('should parse number value types correctly', async () => {
      await gameSettingsService.loadAllSettings();
      const temp = gameSettingsService.getSetting('ai_llm.tactical.temperature');
      expect(typeof temp).toBe('number');
      expect(temp).toBe(0.7);
    });

    it('should parse boolean value types correctly', async () => {
      await gameSettingsService.loadAllSettings();
      const aiEnabled = gameSettingsService.getSetting('npc.ai_enabled');
      expect(typeof aiEnabled).toBe('boolean');
      expect(aiEnabled).toBe(true);
    });
  });

  // ─── getSetting ─────────────────────────────────────────────────

  describe('getSetting', () => {
    it('should return cached value', async () => {
      await gameSettingsService.loadAllSettings();
      const val = gameSettingsService.getSetting('npc.difficulty');
      expect(val).toBe(3);
    });

    it('should return default for missing key', () => {
      expect(gameSettingsService.getSetting('nonexistent.key', 'fallback')).toBe('fallback');
    });

    it('should return null when no default provided and key missing', () => {
      expect(gameSettingsService.getSetting('nonexistent.key')).toBeNull();
    });
  });

  // ─── setSetting ─────────────────────────────────────────────────

  describe('setSetting', () => {
    it('should create a new setting', async () => {
      await gameSettingsService.setSetting('general.new_key', 'hello', {
        category: 'general',
        value_type: 'string'
      });
      expect(gameSettingsService.getSetting('general.new_key')).toBe('hello');
      const row = await GameSetting.findOne({ where: { key: 'general.new_key' } });
      expect(row).not.toBeNull();
      expect(row.value).toBe('hello');
    });

    it('should update an existing setting', async () => {
      await gameSettingsService.loadAllSettings();
      await gameSettingsService.setSetting('npc.difficulty', 5);
      expect(gameSettingsService.getSetting('npc.difficulty')).toBe(5);
    });

    it('should serialize boolean types correctly', async () => {
      await gameSettingsService.setSetting('general.bool', true, {
        category: 'general',
        value_type: 'boolean'
      });
      const row = await GameSetting.findOne({ where: { key: 'general.bool' } });
      expect(row.value).toBe('true');
      expect(gameSettingsService.getSetting('general.bool')).toBe(true);
    });

    it('should serialize number types correctly', async () => {
      await gameSettingsService.setSetting('general.num', 42, {
        category: 'general',
        value_type: 'number'
      });
      const row = await GameSetting.findOne({ where: { key: 'general.num' } });
      expect(row.value).toBe('42');
      expect(gameSettingsService.getSetting('general.num')).toBe(42);
    });
  });

  // ─── setSettings ────────────────────────────────────────────────

  describe('setSettings', () => {
    it('should bulk update settings in a transaction', async () => {
      await gameSettingsService.loadAllSettings();
      await gameSettingsService.setSettings({
        'npc.difficulty': 5,
        'npc.ai_enabled': false
      });
      expect(gameSettingsService.getSetting('npc.difficulty')).toBe(5);
      expect(gameSettingsService.getSetting('npc.ai_enabled')).toBe(false);
    });

    it('should rollback on failure and restore cache', async () => {
      await gameSettingsService.loadAllSettings();
      const originalDifficulty = gameSettingsService.getSetting('npc.difficulty');

      // Force an error mid-transaction by using a bad key scenario
      // We mock GameSetting.findOne to throw partway through
      const originalFindOne = GameSetting.findOne;
      let callCount = 0;
      GameSetting.findOne = async (...args) => {
        callCount++;
        if (callCount > 1) throw new Error('Simulated failure');
        return originalFindOne.apply(GameSetting, args);
      };

      await expect(gameSettingsService.setSettings({
        'npc.difficulty': 99,
        'npc.ai_enabled': false
      })).rejects.toThrow('Simulated failure');

      GameSetting.findOne = originalFindOne;

      // Cache should be restored
      expect(gameSettingsService.getSetting('npc.difficulty')).toBe(originalDifficulty);
    });
  });

  // ─── getSettingsByCategory ──────────────────────────────────────

  describe('getSettingsByCategory', () => {
    it('should return settings for a specific category', async () => {
      await gameSettingsService.loadAllSettings();
      const npcSettings = gameSettingsService.getSettingsByCategory('npc');
      expect(npcSettings['npc.ai_enabled']).toBeDefined();
      expect(npcSettings['npc.difficulty']).toBeDefined();
      expect(npcSettings['npc.voice_enabled']).toBeDefined();
    });

    it('should return empty object for nonexistent category', () => {
      const result = gameSettingsService.getSettingsByCategory('nonexistent');
      expect(result).toEqual({});
    });
  });

  // ─── getPublicSettings ──────────────────────────────────────────

  describe('getPublicSettings', () => {
    it('should mask secret values', async () => {
      await gameSettingsService.loadAllSettings();
      // Set a secret with known value
      await gameSettingsService.setSetting('ai_llm.tactical.api_key', 'sk-12345678', {
        is_secret: true
      });

      const publicSettings = gameSettingsService.getPublicSettings('ai_llm');
      expect(publicSettings['ai_llm.tactical.api_key']).toBe('***5678');
    });

    it('should mask short secrets with ****', async () => {
      await gameSettingsService.setSetting('general.short_secret', 'abc', {
        category: 'general',
        is_secret: true,
        value_type: 'string'
      });
      const publicSettings = gameSettingsService.getPublicSettings('general');
      expect(publicSettings['general.short_secret']).toBe('****');
    });

    it('should pass through non-secret values', async () => {
      await gameSettingsService.loadAllSettings();
      const publicSettings = gameSettingsService.getPublicSettings('npc');
      expect(publicSettings['npc.difficulty']).toBe(3);
    });
  });

  // ─── clearCache ─────────────────────────────────────────────────

  describe('clearCache', () => {
    it('should empty the cache', async () => {
      await gameSettingsService.loadAllSettings();
      expect(gameSettingsService.getSetting('npc.difficulty')).toBe(3);

      gameSettingsService.clearCache();
      // After clearing, getSetting returns default
      expect(gameSettingsService.getSetting('npc.difficulty', 'gone')).toBe('gone');
    });
  });
});
