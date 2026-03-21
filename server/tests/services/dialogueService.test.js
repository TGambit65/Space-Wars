/**
 * Dialogue Service Tests
 * Real DB + mocked voiceService, aiProviderFactory, dialogueCacheService.
 * Uses real dialogueScriptsService and npcPersonalityService.
 */
jest.mock('../../src/services/voiceService');
jest.mock('../../src/services/ai/aiProviderFactory');
jest.mock('../../src/services/dialogueCacheService');
jest.mock('../../src/services/gameSettingsService');

const { sequelize } = require('../../src/models');
const dialogueService = require('../../src/services/dialogueService');
const voiceService = require('../../src/services/voiceService');
const aiProviderFactory = require('../../src/services/ai/aiProviderFactory');
const dialogueCacheService = require('../../src/services/dialogueCacheService');
const gameSettingsService = require('../../src/services/gameSettingsService');
const { NpcConversationSession } = require('../../src/models');
const {
  createTestUser, createTestSector, createTestShip, createTestNPC,
  cleanDatabase
} = require('../helpers');

describe('Dialogue Service', () => {
  let testUser, testSector, testShip, testNpc;

  beforeAll(async () => {
    await sequelize.sync({ force: true });
  });

  beforeEach(async () => {
    await cleanDatabase();
    jest.spyOn(Math, 'random').mockReturnValue(0);

    // Default mocks
    voiceService.isVoiceEnabledForUser.mockReturnValue(false);
    voiceService.synthesizeSpeech.mockResolvedValue(null);
    dialogueCacheService.getCached.mockReturnValue(null);
    dialogueCacheService.setCached.mockReturnValue(undefined);
    gameSettingsService.getSetting.mockImplementation((key, defaultVal) => {
      if (key === 'npc.ai_enabled') return false;
      if (key === 'ai_llm.interactive.provider') return 'none';
      return defaultVal !== undefined ? defaultVal : null;
    });

    testSector = await createTestSector();
    testUser = await createTestUser();
    testShip = await createTestShip(testUser.user_id, testSector.sector_id);
    testNpc = await createTestNPC(testSector.sector_id, {
      npc_type: 'TRADER',
      ai_personality: {
        trait_primary: 'jovial',
        trait_secondary: 'patient',
        speech_style: 'merchant_polite',
        quirk: 'is oddly philosophical about cargo',
        voice_profile: 'cheerful'
      }
    });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  // ─── getMenuOptions ─────────────────────────────────────────────

  describe('getMenuOptions', () => {
    it('should return correct options for TRADER', () => {
      const options = dialogueService.getMenuOptions('TRADER');
      expect(options).toHaveLength(7);
      expect(options[0].key).toBe('greet');
    });

    it('should return correct options for PATROL', () => {
      const options = dialogueService.getMenuOptions('PATROL');
      expect(options).toHaveLength(6);
    });

    it('should return correct options for PIRATE', () => {
      const options = dialogueService.getMenuOptions('PIRATE');
      expect(options).toHaveLength(5);
    });

    it('should return empty array for unknown type', () => {
      expect(dialogueService.getMenuOptions('ALIEN')).toEqual([]);
    });
  });

  // ─── startDialogue ──────────────────────────────────────────────

  describe('startDialogue', () => {
    it('should return conversation data', async () => {
      const result = await dialogueService.startDialogue(testUser.user_id, testNpc.npc_id);
      expect(result).toHaveProperty('conversation_id', testNpc.npc_id);
      expect(result).toHaveProperty('npc');
      expect(result.npc.name).toBe(testNpc.name);
      expect(result.npc.npc_type).toBe('TRADER');
      expect(result).toHaveProperty('menu_options');
      expect(result.menu_options).toHaveLength(7);
    });

    it('should create a conversation session', async () => {
      const result = await dialogueService.startDialogue(testUser.user_id, testNpc.npc_id);
      expect(result.session_id).toBeDefined();
      const { NpcConversationSession } = require('../../src/models');
      const session = await NpcConversationSession.findOne({
        where: { npc_id: testNpc.npc_id, user_id: testUser.user_id, is_active: true }
      });
      expect(session).not.toBeNull();
      expect(session.is_active).toBe(true);
    });

    it('should throw 404 for missing NPC', async () => {
      await expect(
        dialogueService.startDialogue(testUser.user_id, '00000000-0000-0000-0000-000000000000')
      ).rejects.toHaveProperty('statusCode', 404);
    });

    it('should throw 400 for dead NPC', async () => {
      await testNpc.update({ is_alive: false });
      await expect(
        dialogueService.startDialogue(testUser.user_id, testNpc.npc_id)
      ).rejects.toHaveProperty('statusCode', 400);
    });

    it('should throw 400 when player has no active ship', async () => {
      await testShip.update({ is_active: false });
      await expect(
        dialogueService.startDialogue(testUser.user_id, testNpc.npc_id)
      ).rejects.toHaveProperty('statusCode', 400);
    });

    it('should throw 400 when player is in wrong sector', async () => {
      const otherSector = await createTestSector({ name: 'Other Sector' });
      await testShip.update({ current_sector_id: otherSector.sector_id });
      await expect(
        dialogueService.startDialogue(testUser.user_id, testNpc.npc_id)
      ).rejects.toHaveProperty('statusCode', 400);
    });

    it('should allow concurrent conversations with same NPC (per-player sessions)', async () => {
      const otherUser = await createTestUser({ username: 'otherplayer' });
      const otherShip = await createTestShip(otherUser.user_id, testNpc.current_sector_id);
      // First user starts dialogue
      const result1 = await dialogueService.startDialogue(testUser.user_id, testNpc.npc_id);
      expect(result1.session_id).toBeTruthy();
      // Second user can also start dialogue (concurrent sessions)
      const result2 = await dialogueService.startDialogue(otherUser.user_id, testNpc.npc_id);
      expect(result2.session_id).toBeTruthy();
      expect(result2.session_id).not.toBe(result1.session_id);
    });

    it('should clear stale session and allow new one', async () => {
      // Create a stale session for this user
      await NpcConversationSession.create({
        npc_id: testNpc.npc_id,
        user_id: testUser.user_id,
        started_at: new Date(Date.now() - 10 * 60 * 1000),
        last_message_at: new Date(Date.now() - 10 * 60 * 1000),
        history: [],
        is_active: true
      });
      const result = await dialogueService.startDialogue(testUser.user_id, testNpc.npc_id);
      expect(result.conversation_id).toBe(testNpc.npc_id);
      // Stale session should be closed, only the new one active
      const activeSessions = await NpcConversationSession.findAll({
        where: { user_id: testUser.user_id, npc_id: testNpc.npc_id, is_active: true }
      });
      expect(activeSessions).toHaveLength(1);
      expect(activeSessions[0].session_id).toBe(result.session_id);
    });
  });

  // ─── selectMenuOption ───────────────────────────────────────────

  describe('selectMenuOption', () => {
    beforeEach(async () => {
      await dialogueService.startDialogue(testUser.user_id, testNpc.npc_id);
    });

    it('should return scripted response', async () => {
      const result = await dialogueService.selectMenuOption(testUser.user_id, testNpc.npc_id, 'greet');
      expect(result).toHaveProperty('response_text');
      expect(result.response_text).toContain(testNpc.name);
    });

    it('should keep dialogue active after menu selection', async () => {
      // First selection
      const result1 = await dialogueService.selectMenuOption(testUser.user_id, testNpc.npc_id, 'greet');
      expect(result1.response_text).toBeTruthy();

      // Second selection should also work (dialogue state maintained)
      const result2 = await dialogueService.selectMenuOption(testUser.user_id, testNpc.npc_id, 'buy');
      expect(result2.response_text).toBeTruthy();
      expect(result2.data).toEqual({ action: 'open_trade_ui', mode: 'buy' });
    });

    it('should throw 400 when no active dialogue', async () => {
      await NpcConversationSession.update({ is_active: false }, { where: { npc_id: testNpc.npc_id } });
      await testNpc.update({ dialogue_state: null });
      await expect(
        dialogueService.selectMenuOption(testUser.user_id, testNpc.npc_id, 'greet')
      ).rejects.toHaveProperty('statusCode', 400);
    });

    it('should throw 400 for wrong user', async () => {
      const otherUser = await createTestUser({ username: 'wronguser' });
      await expect(
        dialogueService.selectMenuOption(otherUser.user_id, testNpc.npc_id, 'greet')
      ).rejects.toHaveProperty('statusCode', 400);
    });

    it('should throw 400 for invalid option', async () => {
      await expect(
        dialogueService.selectMenuOption(testUser.user_id, testNpc.npc_id, 'invalid_option')
      ).rejects.toHaveProperty('statusCode', 400);
    });
  });

  // ─── processFreeText ────────────────────────────────────────────

  describe('processFreeText', () => {
    beforeEach(async () => {
      await dialogueService.startDialogue(testUser.user_id, testNpc.npc_id);
    });

    it('should return cached response when available', async () => {
      dialogueCacheService.getCached.mockReturnValue({ text: 'Cached hello!' });
      const result = await dialogueService.processFreeText(testUser.user_id, testNpc.npc_id, 'hello');
      expect(result.response_text).toBe('Cached hello!');
      expect(result.is_ai_generated).toBe(true);
    });

    it('should fall back to scripted when AI is disabled', async () => {
      const result = await dialogueService.processFreeText(testUser.user_id, testNpc.npc_id, 'something random');
      expect(result.response_text).toContain("don't quite follow");
      expect(result.is_ai_generated).toBe(false);
    });

    it('should include available topics in fallback response', async () => {
      const result = await dialogueService.processFreeText(testUser.user_id, testNpc.npc_id, 'what?');
      // TRADER scripts include greet, buy, sell, etc.
      expect(result.response_text).toContain('greet');
    });

    it('should throw 400 for no active dialogue', async () => {
      await NpcConversationSession.update({ is_active: false }, { where: { npc_id: testNpc.npc_id } });
      await testNpc.update({ dialogue_state: null });
      await expect(
        dialogueService.processFreeText(testUser.user_id, testNpc.npc_id, 'hello')
      ).rejects.toHaveProperty('statusCode', 400);
    });
  });

  // ─── endDialogue ────────────────────────────────────────────────

  describe('endDialogue', () => {
    beforeEach(async () => {
      await dialogueService.startDialogue(testUser.user_id, testNpc.npc_id);
    });

    it('should clear dialogue_state and return farewell', async () => {
      const result = await dialogueService.endDialogue(testUser.user_id, testNpc.npc_id);
      expect(result).toHaveProperty('response_text');
      expect(result.response_text).toBeTruthy();

      await testNpc.reload();
      expect(testNpc.dialogue_state).toBeNull();
    });

    it('should throw 404 for missing NPC', async () => {
      await expect(
        dialogueService.endDialogue(testUser.user_id, '00000000-0000-0000-0000-000000000000')
      ).rejects.toHaveProperty('statusCode', 404);
    });

    it('should throw 400 when no active dialogue', async () => {
      await NpcConversationSession.update({ is_active: false }, { where: { npc_id: testNpc.npc_id } });
      await testNpc.update({ dialogue_state: null });
      await expect(
        dialogueService.endDialogue(testUser.user_id, testNpc.npc_id)
      ).rejects.toHaveProperty('statusCode', 400);
    });
  });

  // ─── getConversationState ───────────────────────────────────────

  describe('getConversationState', () => {
    it('should return active state when dialogue exists', async () => {
      await dialogueService.startDialogue(testUser.user_id, testNpc.npc_id);
      const state = await dialogueService.getConversationState(testUser.user_id, testNpc.npc_id);
      expect(state.active).toBe(true);
      expect(state.npc_name).toBe(testNpc.name);
      expect(state.npc_type).toBe('TRADER');
      expect(state).toHaveProperty('menu_options');
    });

    it('should return inactive state when no dialogue', async () => {
      const state = await dialogueService.getConversationState(testUser.user_id, testNpc.npc_id);
      expect(state.active).toBe(false);
    });

    it('should return inactive for different user', async () => {
      await dialogueService.startDialogue(testUser.user_id, testNpc.npc_id);
      const otherUser = await createTestUser({ username: 'other' });
      const state = await dialogueService.getConversationState(otherUser.user_id, testNpc.npc_id);
      expect(state.active).toBe(false);
    });

    it('should throw 404 for missing NPC', async () => {
      await expect(
        dialogueService.getConversationState(testUser.user_id, '00000000-0000-0000-0000-000000000000')
      ).rejects.toHaveProperty('statusCode', 404);
    });
  });

  // ─── Action Payload Execution ─────────────────────────────────────

  describe('action payload execution', () => {
    it('should deduct credits on accepted pirate bribe', async () => {
      // Create a pirate NPC with cowardly trait (bribe always accepted)
      const pirate = await createTestNPC(testSector.sector_id, {
        npc_type: 'PIRATE',
        ai_personality: {
          trait_primary: 'greedy',
          trait_secondary: 'cunning',
          speech_style: 'pirate_slang',
          quirk: 'counts coins',
          voice_profile: 'gruff'
        }
      });

      await dialogueService.startDialogue(testUser.user_id, pirate.npc_id);
      const result = await dialogueService.selectMenuOption(testUser.user_id, pirate.npc_id, 'bribe');

      // Greedy pirates always accept bribes
      expect(result.data.bribe_accepted).toBe(true);
      expect(result.data.credits_deducted).toBeTruthy();
      expect(result.data.npc_disengaged).toBe(true);

      // Verify credits were deducted
      await testUser.reload();
      expect(testUser.credits).toBeLessThan(10000);

      // Verify NPC disengaged
      await pirate.reload();
      expect(pirate.behavior_state).toBe('idle');
      expect(pirate.target_ship_id).toBeNull();
    });

    it('should return trade UI action data without side effects', async () => {
      await dialogueService.startDialogue(testUser.user_id, testNpc.npc_id);
      const result = await dialogueService.selectMenuOption(testUser.user_id, testNpc.npc_id, 'buy');

      expect(result.data).toHaveProperty('action', 'open_trade_ui');
      expect(result.data).toHaveProperty('mode', 'buy');

      // Credits unchanged
      await testUser.reload();
      expect(testUser.credits).toBe(10000);
    });
  });
});
