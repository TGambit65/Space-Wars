/**
 * Dialogue Scripts Service Tests
 * Pure functions — no mocks, no DB.
 */
const dialogueScriptsService = require('../../src/services/dialogueScriptsService');

describe('Dialogue Scripts Service', () => {
  // ─── getAvailableScripts ────────────────────────────────────────

  describe('getAvailableScripts', () => {
    it('should return 7 script keys for TRADER', () => {
      const keys = dialogueScriptsService.getAvailableScripts('TRADER');
      expect(keys).toHaveLength(7);
      expect(keys).toEqual(expect.arrayContaining([
        'greet', 'buy', 'sell', 'ask_rumors', 'ask_prices', 'ask_routes', 'farewell'
      ]));
    });

    it('should return 6 script keys for PATROL', () => {
      const keys = dialogueScriptsService.getAvailableScripts('PATROL');
      expect(keys).toHaveLength(6);
      expect(keys).toEqual(expect.arrayContaining([
        'greet', 'report_crime', 'ask_safety', 'ask_bounties', 'request_escort', 'farewell'
      ]));
    });

    it('should return 6 script keys for BOUNTY_HUNTER', () => {
      const keys = dialogueScriptsService.getAvailableScripts('BOUNTY_HUNTER');
      expect(keys).toHaveLength(6);
      expect(keys).toEqual(expect.arrayContaining([
        'greet', 'ask_targets', 'offer_contract', 'ask_price', 'threaten', 'farewell'
      ]));
    });

    it('should return 5 script keys for PIRATE', () => {
      const keys = dialogueScriptsService.getAvailableScripts('PIRATE');
      expect(keys).toHaveLength(5);
      expect(keys).toEqual(expect.arrayContaining([
        'plead', 'bribe', 'threaten_back', 'ask_mercy', 'farewell'
      ]));
    });

    it('should return same scripts for PIRATE_LORD as PIRATE', () => {
      const pirateKeys = dialogueScriptsService.getAvailableScripts('PIRATE');
      const lordKeys = dialogueScriptsService.getAvailableScripts('PIRATE_LORD');
      expect(lordKeys).toEqual(pirateKeys);
    });

    it('should return empty array for unknown NPC type', () => {
      expect(dialogueScriptsService.getAvailableScripts('CIVILIAN')).toEqual([]);
      expect(dialogueScriptsService.getAvailableScripts('')).toEqual([]);
    });
  });

  // ─── getScriptedResponse ────────────────────────────────────────

  describe('getScriptedResponse', () => {
    const mockNpc = {
      name: 'TestNPC',
      npc_type: 'TRADER',
      ai_personality: { speech_style: 'formal', trait_primary: 'greedy' }
    };

    beforeEach(() => {
      // Deterministic random selection (picks first element)
      jest.spyOn(Math, 'random').mockReturnValue(0);
    });

    afterEach(() => {
      jest.restoreAllMocks();
    });

    it('should return null for unknown NPC type', () => {
      expect(dialogueScriptsService.getScriptedResponse('ALIEN', 'greet', mockNpc, {})).toBeNull();
    });

    it('should return null for unknown option key', () => {
      expect(dialogueScriptsService.getScriptedResponse('TRADER', 'dance', mockNpc, {})).toBeNull();
    });

    it('should return TRADER greet with NPC name', () => {
      const result = dialogueScriptsService.getScriptedResponse('TRADER', 'greet', mockNpc, {});
      expect(result).not.toBeNull();
      expect(result.text).toContain('TestNPC');
    });

    it('should return TRADER buy with trade UI data', () => {
      const result = dialogueScriptsService.getScriptedResponse('TRADER', 'buy', mockNpc, {});
      expect(result.data).toEqual({ action: 'open_trade_ui', mode: 'buy' });
    });

    it('should return TRADER sell with trade UI data', () => {
      const result = dialogueScriptsService.getScriptedResponse('TRADER', 'sell', mockNpc, {});
      expect(result.data).toEqual({ action: 'open_trade_ui', mode: 'sell' });
    });

    it('should return TRADER ask_rumors response', () => {
      const result = dialogueScriptsService.getScriptedResponse('TRADER', 'ask_rumors', mockNpc, {
        adjacentSectors: [{ name: 'Alpha', hostileCount: 3, hasPort: false }]
      });
      expect(result.text).toBeTruthy();
    });

    it('should return TRADER ask_prices with port commodities', () => {
      const context = {
        portCommodities: [
          { commodity_name: 'Iron', buy_price: 50, sell_price: 40 },
          { commodity_name: 'Gold', buy_price: 200, sell_price: 180 }
        ]
      };
      const result = dialogueScriptsService.getScriptedResponse('TRADER', 'ask_prices', mockNpc, context);
      expect(result.text).toContain('Iron');
      expect(result.text).toContain('Gold');
    });

    it('should return TRADER farewell with NPC name', () => {
      const result = dialogueScriptsService.getScriptedResponse('TRADER', 'farewell', mockNpc, {});
      expect(result.text).toContain('TestNPC');
    });

    it('should return PIRATE bribe with personality-dependent amount', () => {
      const greedyPirate = {
        name: 'GreedyPete',
        npc_type: 'PIRATE',
        ai_personality: { trait_primary: 'greedy', speech_style: 'pirate_slang' }
      };
      const result = dialogueScriptsService.getScriptedResponse('PIRATE', 'bribe', greedyPirate, {});
      expect(result.data.bribe_accepted).toBe(true);
      // Greedy pirates charge 300-700 range
      expect(result.data.bribe_amount).toBeGreaterThanOrEqual(300);
    });

    it('should return PIRATE threaten_back with backed_down for cowardly pirates', () => {
      const cowardPirate = {
        name: 'ScaredSam',
        npc_type: 'PIRATE',
        ai_personality: { trait_primary: 'cowardly', speech_style: 'pirate_slang' }
      };
      const result = dialogueScriptsService.getScriptedResponse('PIRATE', 'threaten_back', cowardPirate, {});
      expect(result.data.backed_down).toBe(true);
    });

    it('should return PIRATE threaten_back without backed_down for non-cowardly pirates', () => {
      const bravePirate = {
        name: 'BoldBob',
        npc_type: 'PIRATE',
        ai_personality: { trait_primary: 'brutal', speech_style: 'threatening' }
      };
      const result = dialogueScriptsService.getScriptedResponse('PIRATE', 'threaten_back', bravePirate, {});
      expect(result.data.backed_down).toBe(false);
    });

    it('should apply speech style variation based on personality', () => {
      const formalNpc = {
        name: 'FormalFred',
        npc_type: 'TRADER',
        ai_personality: { speech_style: 'formal' }
      };
      const pirateNpc = {
        name: 'PiratePete',
        npc_type: 'TRADER',
        ai_personality: { speech_style: 'pirate_slang' }
      };

      const formalResult = dialogueScriptsService.getScriptedResponse('TRADER', 'greet', formalNpc, {});
      const pirateResult = dialogueScriptsService.getScriptedResponse('TRADER', 'greet', pirateNpc, {});

      // Both should contain the NPC name but with different greeting prefixes
      expect(formalResult.text).toContain('FormalFred');
      expect(pirateResult.text).toContain('PiratePete');
      // With Math.random = 0, formal gets 'Greetings.' and pirate_slang gets 'Ahoy!'
      expect(formalResult.text).toContain('Greetings.');
      expect(pirateResult.text).toContain('Ahoy!');
    });

    it('should return PATROL ask_safety with hostile info', () => {
      const patrolNpc = {
        name: 'Officer Jones',
        npc_type: 'PATROL',
        ai_personality: { speech_style: 'military' }
      };
      const result = dialogueScriptsService.getScriptedResponse('PATROL', 'ask_safety', patrolNpc, {
        sectorInfo: { hostileCount: 2 }
      });
      expect(result.text).toContain('2');
    });

    it('should return BOUNTY_HUNTER threaten — non-cowardly response', () => {
      const hunter = {
        name: 'Hunter X',
        npc_type: 'BOUNTY_HUNTER',
        ai_personality: { trait_primary: 'cunning', speech_style: 'cryptic' }
      };
      const result = dialogueScriptsService.getScriptedResponse('BOUNTY_HUNTER', 'threaten', hunter, {});
      expect(result.text).toBeTruthy();
    });

    it('should return BOUNTY_HUNTER threaten — cowardly response', () => {
      const hunter = {
        name: 'Timid Tim',
        npc_type: 'BOUNTY_HUNTER',
        ai_personality: { trait_primary: 'cowardly', speech_style: 'formal' }
      };
      const result = dialogueScriptsService.getScriptedResponse('BOUNTY_HUNTER', 'threaten', hunter, {});
      expect(result.text).toContain('hasty');
    });

    it('should handle NPC with no ai_personality gracefully', () => {
      const plainNpc = { name: 'PlainNPC', npc_type: 'TRADER', ai_personality: null };
      const result = dialogueScriptsService.getScriptedResponse('TRADER', 'greet', plainNpc, {});
      expect(result).not.toBeNull();
      expect(result.text).toContain('PlainNPC');
    });

    it('should return TRADER ask_routes with adjacent port info', () => {
      const result = dialogueScriptsService.getScriptedResponse('TRADER', 'ask_routes', mockNpc, {
        adjacentSectors: [
          { name: 'Alpha', hasPort: true },
          { name: 'Beta', hasPort: true }
        ]
      });
      expect(result.text).toContain('Alpha');
      expect(result.text).toContain('Beta');
    });

    it('should return PIRATE ask_mercy — honorable pirate shows mercy', () => {
      const honorPirate = {
        name: 'HonorPirate',
        npc_type: 'PIRATE',
        ai_personality: { trait_primary: 'honorable', speech_style: 'formal' }
      };
      const result = dialogueScriptsService.getScriptedResponse('PIRATE', 'ask_mercy', honorPirate, {});
      expect(result.text).toContain('honor');
    });
  });
});
