/**
 * NPC Personality Service Tests
 * Mocks gameSettingsService for prompt template lookup.
 */
jest.mock('../../src/services/gameSettingsService');

const npcPersonalityService = require('../../src/services/npcPersonalityService');
const gameSettingsService = require('../../src/services/gameSettingsService');

describe('NPC Personality Service', () => {
  beforeEach(() => {
    jest.spyOn(Math, 'random').mockReturnValue(0);
    gameSettingsService.getSetting.mockReturnValue('');
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  // ─── generatePersonality ────────────────────────────────────────

  describe('generatePersonality', () => {
    it('should return object with 5 expected fields', () => {
      const p = npcPersonalityService.generatePersonality('PIRATE');
      expect(p).toHaveProperty('trait_primary');
      expect(p).toHaveProperty('trait_secondary');
      expect(p).toHaveProperty('speech_style');
      expect(p).toHaveProperty('quirk');
      expect(p).toHaveProperty('voice_profile');
    });

    it('should generate valid personality for PIRATE', () => {
      const p = npcPersonalityService.generatePersonality('PIRATE');
      expect(typeof p.trait_primary).toBe('string');
      expect(typeof p.speech_style).toBe('string');
      expect(p.trait_primary.length).toBeGreaterThan(0);
    });

    it('should generate valid personality for TRADER', () => {
      const p = npcPersonalityService.generatePersonality('TRADER');
      expect(typeof p.trait_primary).toBe('string');
      expect(typeof p.quirk).toBe('string');
    });

    it('should generate valid personality for PATROL', () => {
      const p = npcPersonalityService.generatePersonality('PATROL');
      expect(typeof p.trait_primary).toBe('string');
      expect(typeof p.voice_profile).toBe('string');
    });

    it('should generate valid personality for BOUNTY_HUNTER', () => {
      const p = npcPersonalityService.generatePersonality('BOUNTY_HUNTER');
      expect(typeof p.trait_primary).toBe('string');
      expect(typeof p.trait_secondary).toBe('string');
    });

    it('should handle unknown NPC type gracefully', () => {
      const p = npcPersonalityService.generatePersonality('UNKNOWN');
      // Should still return a valid personality with no bias
      expect(p).toHaveProperty('trait_primary');
      expect(typeof p.trait_primary).toBe('string');
    });
  });

  // ─── buildTacticalPrompt ────────────────────────────────────────

  describe('buildTacticalPrompt', () => {
    const npc = {
      name: 'Test Pirate',
      npc_type: 'PIRATE',
      hull_points: 80,
      max_hull_points: 100,
      shield_points: 30,
      max_shield_points: 50,
      attack_power: 15,
      defense_rating: 8,
      behavior_state: 'idle'
    };

    const context = {
      playersInSector: [{ username: 'Player1', ship_type: 'Scout', hull_points: 50, max_hull_points: 100, shield_points: 20, max_shield_points: 50 }],
      adjacentSectors: [{ name: 'Sector A', hasPort: true, hostileCount: 0 }],
      sectorHasPort: false,
      sectorName: 'Alpha Centauri',
      difficulty: 3
    };

    const personality = { trait_primary: 'cunning', speech_style: 'pirate_slang', quirk: 'ends sentences with space puns' };

    it('should return array of 2 messages (system + user)', () => {
      const messages = npcPersonalityService.buildTacticalPrompt(npc, context, personality);
      expect(messages).toHaveLength(2);
      expect(messages[0].role).toBe('system');
      expect(messages[1].role).toBe('user');
    });

    it('should substitute {npc_name} in system prompt', () => {
      const messages = npcPersonalityService.buildTacticalPrompt(npc, context, personality);
      expect(messages[0].content).toContain('Test Pirate');
    });

    it('should substitute {hull_percent} in system prompt', () => {
      const messages = npcPersonalityService.buildTacticalPrompt(npc, context, personality);
      expect(messages[0].content).toContain('80');
    });

    it('should substitute {nearby_players} in system prompt', () => {
      const messages = npcPersonalityService.buildTacticalPrompt(npc, context, personality);
      expect(messages[0].content).toContain('Player1');
    });

    it('should use default template when getSetting returns empty string', () => {
      gameSettingsService.getSetting.mockReturnValue('');
      const messages = npcPersonalityService.buildTacticalPrompt(npc, context, personality);
      // Default template includes "NPC" text
      expect(messages[0].content).toContain('Test Pirate');
      expect(messages[1].content).toContain('TACTICAL SITUATION');
    });
  });

  // ─── buildInteractivePrompt ─────────────────────────────────────

  describe('buildInteractivePrompt', () => {
    const npc = {
      name: 'Trader Joe',
      npc_type: 'TRADER',
      hull_points: 100,
      max_hull_points: 100,
      shield_points: 50,
      max_shield_points: 50
    };

    const personality = {
      trait_primary: 'jovial',
      trait_secondary: 'patient',
      speech_style: 'merchant_polite',
      quirk: 'is oddly philosophical about cargo'
    };

    it('should include personality traits in system message', () => {
      const messages = npcPersonalityService.buildInteractivePrompt(npc, personality, []);
      expect(messages[0].content).toContain('jovial');
      expect(messages[0].content).toContain('patient');
      expect(messages[0].content).toContain('merchant_polite');
    });

    it('should append conversation history (last 10, user/assistant only)', () => {
      const history = [
        { role: 'user', content: 'Hello' },
        { role: 'assistant', content: 'Greetings!' },
        { role: 'system', content: 'should be filtered' },
        { role: 'user', content: 'How are prices?' }
      ];
      const messages = npcPersonalityService.buildInteractivePrompt(npc, personality, history);
      // system + 3 user/assistant messages (system filtered out)
      expect(messages).toHaveLength(4); // 1 system + 3 history
      expect(messages.some(m => m.content === 'should be filtered')).toBe(false);
    });

    it('should truncate message content to 2000 chars', () => {
      const longMsg = 'x'.repeat(3000);
      const history = [{ role: 'user', content: longMsg }];
      const messages = npcPersonalityService.buildInteractivePrompt(npc, personality, history);
      expect(messages[1].content.length).toBe(2000);
    });

    it('should add TRADER price context when available', () => {
      const context = { portPrices: { Iron: 50, Gold: 200 } };
      const messages = npcPersonalityService.buildInteractivePrompt(npc, personality, [], context);
      expect(messages[0].content).toContain('trade prices');
    });

    it('should add PATROL danger context when available', () => {
      const patrolNpc = { ...npc, npc_type: 'PATROL' };
      const context = { sectorDanger: 5 };
      const messages = npcPersonalityService.buildInteractivePrompt(patrolNpc, personality, [], context);
      expect(messages[0].content).toContain('danger level');
    });
  });
});
