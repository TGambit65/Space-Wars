/**
 * NPC Action Executor Tests
 * Heavily mocked — npcService, aiProviderFactory, gameSettingsService,
 * npcPersonalityService, behaviorTreeService.
 */
jest.mock('../../src/services/npcService');
jest.mock('../../src/services/ai/aiProviderFactory');
jest.mock('../../src/services/gameSettingsService');
jest.mock('../../src/services/npcPersonalityService');
jest.mock('../../src/services/behaviorTreeService');

const npcActionExecutor = require('../../src/services/npcActionExecutor');
const npcService = require('../../src/services/npcService');
const aiProviderFactory = require('../../src/services/ai/aiProviderFactory');
const gameSettingsService = require('../../src/services/gameSettingsService');
const npcPersonalityService = require('../../src/services/npcPersonalityService');
const behaviorTreeService = require('../../src/services/behaviorTreeService');

describe('NPC Action Executor', () => {
  let mockNpc;
  let mockSocketService;

  beforeEach(() => {
    mockNpc = {
      npc_id: 'npc-1',
      name: 'Test Pirate',
      npc_type: 'PIRATE',
      ship_type: 'Fighter',
      current_sector_id: 'sector-1',
      behavior_state: 'idle',
      ai_personality: { trait_primary: 'cunning' },
      intelligence_tier: 1,
      update: jest.fn().mockResolvedValue(true)
    };

    mockSocketService = {
      emitToSector: jest.fn(),
      emitToUser: jest.fn()
    };

    npcService.moveNPC.mockResolvedValue(true);
    gameSettingsService.getSetting.mockReturnValue('none');
    npcPersonalityService.buildTacticalPrompt.mockReturnValue([
      { role: 'system', content: 'test' },
      { role: 'user', content: 'test' }
    ]);
    behaviorTreeService.findSafestAdjacentSector.mockReturnValue('safe-sector');
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  // ─── getDecisionLog ─────────────────────────────────────────────

  describe('getDecisionLog', () => {
    it('should return entries with total', async () => {
      // Execute an action to populate log
      await npcActionExecutor.executeAction(mockNpc, {
        action: 'idle', reason: 'test', needsAI: false
      });

      const log = npcActionExecutor.getDecisionLog(50, 0);
      expect(log).toHaveProperty('entries');
      expect(log).toHaveProperty('total');
      expect(log.total).toBeGreaterThan(0);
    });

    it('should respect limit and offset', async () => {
      // Execute multiple actions
      for (let i = 0; i < 5; i++) {
        await npcActionExecutor.executeAction(mockNpc, {
          action: 'idle', reason: `test ${i}`, needsAI: false
        });
      }

      const limited = npcActionExecutor.getDecisionLog(2, 0);
      expect(limited.entries).toHaveLength(2);

      const offset = npcActionExecutor.getDecisionLog(2, 2);
      expect(offset.entries).toHaveLength(2);
    });
  });

  // ─── executeAction ──────────────────────────────────────────────

  describe('executeAction', () => {
    it('should move NPC and update behavior_state for move actions', async () => {
      await npcActionExecutor.executeAction(mockNpc, {
        action: 'move_toward_target',
        targetSectorId: 'sector-2',
        reason: 'seeking port',
        needsAI: false
      }, {}, mockSocketService);

      expect(npcService.moveNPC).toHaveBeenCalledWith('npc-1', 'sector-2');
      expect(mockNpc.update).toHaveBeenCalledWith({ behavior_state: 'hunting' });
    });

    it('should emit socket events on successful move', async () => {
      await npcActionExecutor.executeAction(mockNpc, {
        action: 'patrol',
        targetSectorId: 'sector-2',
        reason: 'wandering',
        needsAI: false
      }, {}, mockSocketService);

      expect(mockSocketService.emitToSector).toHaveBeenCalledTimes(3);
      // State change (idle → patrolling)
      expect(mockSocketService.emitToSector).toHaveBeenCalledWith(
        'sector-2', 'npc:state_change', expect.objectContaining({ npc_id: 'npc-1', old_state: 'idle', new_state: 'patrolling' })
      );
      // Left old sector
      expect(mockSocketService.emitToSector).toHaveBeenCalledWith(
        'sector-1', 'npc:left_sector', expect.objectContaining({ npc_id: 'npc-1' })
      );
      // Entered new sector
      expect(mockSocketService.emitToSector).toHaveBeenCalledWith(
        'sector-2', 'npc:entered_sector', expect.objectContaining({ npc_id: 'npc-1' })
      );
    });

    it('should set behavior_state to "patrolling" for patrol action', async () => {
      await npcActionExecutor.executeAction(mockNpc, {
        action: 'patrol',
        targetSectorId: 'sector-2',
        reason: 'wandering',
        needsAI: false
      });

      expect(mockNpc.update).toHaveBeenCalledWith({ behavior_state: 'patrolling' });
    });

    it('should update to "engaging" for attack_player action', async () => {
      const target = { owner_user_id: 'user-1' };
      await npcActionExecutor.executeAction(mockNpc, {
        action: 'attack_player',
        target,
        reason: 'advantage',
        needsAI: false
      }, {}, mockSocketService);

      expect(mockNpc.update).toHaveBeenCalledWith(expect.objectContaining({
        behavior_state: 'engaging'
      }));
      expect(mockSocketService.emitToUser).toHaveBeenCalledWith(
        'user-1', 'npc:attacks_player', expect.objectContaining({ npc_id: 'npc-1' })
      );
    });

    it('should move and set "fleeing" for flee action', async () => {
      await npcActionExecutor.executeAction(mockNpc, {
        action: 'flee',
        targetSectorId: 'safe-sector',
        reason: 'critical hull',
        needsAI: false
      });

      expect(npcService.moveNPC).toHaveBeenCalledWith('npc-1', 'safe-sector');
      expect(mockNpc.update).toHaveBeenCalledWith({ behavior_state: 'fleeing' });
    });

    it('should set "trading" for trade action', async () => {
      await npcActionExecutor.executeAction(mockNpc, {
        action: 'trade',
        reason: 'at port',
        needsAI: false
      });

      expect(mockNpc.update).toHaveBeenCalledWith(expect.objectContaining({
        behavior_state: 'trading'
      }));
    });

    it('should set "guarding" for guard action', async () => {
      await npcActionExecutor.executeAction(mockNpc, {
        action: 'guard',
        reason: 'protecting port',
        needsAI: false
      });

      expect(mockNpc.update).toHaveBeenCalledWith(expect.objectContaining({
        behavior_state: 'guarding'
      }));
    });

    it('should handle idle action', async () => {
      await npcActionExecutor.executeAction(mockNpc, {
        action: 'idle',
        reason: 'nothing to do',
        needsAI: false
      });

      expect(mockNpc.update).toHaveBeenCalledWith(expect.objectContaining({
        last_action_at: expect.any(Date)
      }));
    });

    it('should handle moveNPC errors gracefully', async () => {
      npcService.moveNPC.mockRejectedValue(new Error('Connection not found'));

      await npcActionExecutor.executeAction(mockNpc, {
        action: 'move_toward_target',
        targetSectorId: 'bad-sector',
        reason: 'seeking port',
        needsAI: false
      });

      // Should not throw, should set to idle
      expect(mockNpc.update).toHaveBeenCalledWith(expect.objectContaining({
        behavior_state: 'idle'
      }));
    });
  });

  // ─── executeAIDecision ──────────────────────────────────────────

  describe('executeAIDecision', () => {
    const fallback = {
      action: 'attack_player',
      target: { owner_user_id: 'user-1' },
      reason: 'ambiguous',
      needsAI: true
    };

    const context = {
      playersInSector: [{ ship_id: 'ship-1', owner_user_id: 'user-1' }],
      adjacentSectors: [{ sector_id: 'sector-2', name: 'Beta' }]
    };

    it('should return fallback when provider is "none"', async () => {
      gameSettingsService.getSetting.mockReturnValue('none');
      const result = await npcActionExecutor.executeAIDecision(mockNpc, context, fallback);
      expect(result).toEqual(fallback);
    });

    it('should parse valid JSON response from AI', async () => {
      gameSettingsService.getSetting.mockImplementation((key) => {
        if (key === 'ai_llm.tactical.provider') return 'openai';
        return 'none';
      });

      const mockProvider = {
        generateText: jest.fn().mockResolvedValue({
          text: '{"action":"flee","target_id":"sector-2","reason":"too dangerous"}'
        })
      };
      aiProviderFactory.getProvider.mockReturnValue(mockProvider);

      const result = await npcActionExecutor.executeAIDecision(mockNpc, context, fallback);
      expect(result.action).toBe('flee');
      expect(result.was_ai).toBe(true);
      expect(result.needsAI).toBe(false);
    });

    it('should fall back on invalid JSON response', async () => {
      gameSettingsService.getSetting.mockImplementation((key) => {
        if (key === 'ai_llm.tactical.provider') return 'openai';
        return 'none';
      });

      const mockProvider = {
        generateText: jest.fn().mockResolvedValue({
          text: 'I think we should attack but I am not sure...'
        })
      };
      aiProviderFactory.getProvider.mockReturnValue(mockProvider);

      const result = await npcActionExecutor.executeAIDecision(mockNpc, context, fallback);
      expect(result.reason).toContain('AI failed');
      expect(result.was_ai).toBe(false);
    });

    it('should fall back on provider error', async () => {
      gameSettingsService.getSetting.mockImplementation((key) => {
        if (key === 'ai_llm.tactical.provider') return 'openai';
        return 'none';
      });

      const mockProvider = {
        generateText: jest.fn().mockRejectedValue(new Error('Rate limited'))
      };
      aiProviderFactory.getProvider.mockReturnValue(mockProvider);

      const result = await npcActionExecutor.executeAIDecision(mockNpc, context, fallback);
      expect(result.reason).toContain('AI failed');
    });
  });
});
