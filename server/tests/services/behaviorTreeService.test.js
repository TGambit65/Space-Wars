/**
 * Behavior Tree Service Tests
 * Mocks gameSettingsService and sectorGraphService.
 */
jest.mock('../../src/services/gameSettingsService');
jest.mock('../../src/services/sectorGraphService');

const behaviorTreeService = require('../../src/services/behaviorTreeService');
const gameSettingsService = require('../../src/services/gameSettingsService');
const sectorGraphService = require('../../src/services/sectorGraphService');

describe('Behavior Tree Service', () => {
  beforeEach(() => {
    gameSettingsService.getSetting.mockReturnValue(3); // default difficulty
    sectorGraphService.findPathToSector.mockResolvedValue(null);
    sectorGraphService.findNearestPortSector.mockResolvedValue(null);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  // ─── calculateAttackScore ───────────────────────────────────────

  describe('calculateAttackScore', () => {
    const baseNpc = {
      hull_points: 100, max_hull_points: 100,
      shield_points: 50, max_shield_points: 50,
      attack_power: 20, defense_rating: 10,
      aggression_level: 0.5
    };

    const baseTarget = {
      hull_points: 50, max_hull_points: 100,
      shield_points: 20, max_shield_points: 50,
      attack_power: 10, defense_rating: 10
    };

    it('should return a value between 0 and 1', () => {
      const score = behaviorTreeService.calculateAttackScore(baseNpc, baseTarget, 3);
      expect(score).toBeGreaterThanOrEqual(0);
      expect(score).toBeLessThanOrEqual(1);
    });

    it('should score higher with hull advantage', () => {
      const healthyNpc = { ...baseNpc, hull_points: 100 };
      const damagedNpc = { ...baseNpc, hull_points: 20 };
      const target = { ...baseTarget, hull_points: 50 };

      const healthyScore = behaviorTreeService.calculateAttackScore(healthyNpc, target, 3);
      const damagedScore = behaviorTreeService.calculateAttackScore(damagedNpc, target, 3);
      expect(healthyScore).toBeGreaterThan(damagedScore);
    });

    it('should score higher with higher aggression', () => {
      const aggressiveNpc = { ...baseNpc, aggression_level: 0.9 };
      const passiveNpc = { ...baseNpc, aggression_level: 0.1 };

      const aggScore = behaviorTreeService.calculateAttackScore(aggressiveNpc, baseTarget, 3);
      const passScore = behaviorTreeService.calculateAttackScore(passiveNpc, baseTarget, 3);
      expect(aggScore).toBeGreaterThan(passScore);
    });

    it('should score higher at higher difficulty', () => {
      const scoreLow = behaviorTreeService.calculateAttackScore(baseNpc, baseTarget, 1);
      const scoreHigh = behaviorTreeService.calculateAttackScore(baseNpc, baseTarget, 5);
      expect(scoreHigh).toBeGreaterThan(scoreLow);
    });

    it('should score lower against stronger target', () => {
      const weakTarget = { ...baseTarget, defense_rating: 5 };
      const strongTarget = { ...baseTarget, defense_rating: 50 };

      const vsWeak = behaviorTreeService.calculateAttackScore(baseNpc, weakTarget, 3);
      const vsStrong = behaviorTreeService.calculateAttackScore(baseNpc, strongTarget, 3);
      expect(vsWeak).toBeGreaterThan(vsStrong);
    });

    it('should handle zero max_hull gracefully', () => {
      const zeroHull = { ...baseNpc, max_hull_points: 0 };
      const score = behaviorTreeService.calculateAttackScore(zeroHull, baseTarget, 3);
      expect(score).toBeGreaterThanOrEqual(0);
      expect(score).toBeLessThanOrEqual(1);
    });
  });

  // ─── findSafestAdjacentSector ───────────────────────────────────

  describe('findSafestAdjacentSector', () => {
    it('should prefer sector with fewest hostiles', () => {
      const sectors = [
        { sector_id: 'a', hostileCount: 5, hasPort: false },
        { sector_id: 'b', hostileCount: 0, hasPort: false },
        { sector_id: 'c', hostileCount: 2, hasPort: false }
      ];
      expect(behaviorTreeService.findSafestAdjacentSector(sectors)).toBe('b');
    });

    it('should prefer port on tie', () => {
      const sectors = [
        { sector_id: 'a', hostileCount: 0, hasPort: false },
        { sector_id: 'b', hostileCount: 0, hasPort: true }
      ];
      expect(behaviorTreeService.findSafestAdjacentSector(sectors)).toBe('b');
    });

    it('should return null for empty array', () => {
      expect(behaviorTreeService.findSafestAdjacentSector([])).toBeNull();
    });

    it('should return null for null input', () => {
      expect(behaviorTreeService.findSafestAdjacentSector(null)).toBeNull();
    });
  });

  // ─── evaluateNPCDecision ────────────────────────────────────────

  describe('evaluateNPCDecision', () => {
    const makeNpc = (overrides = {}) => ({
      npc_type: 'PIRATE',
      is_alive: true,
      hull_points: 80,
      max_hull_points: 100,
      shield_points: 40,
      max_shield_points: 50,
      attack_power: 20,
      defense_rating: 10,
      aggression_level: 0.5,
      flee_threshold: 0.2,
      behavior_state: 'idle',
      intelligence_tier: 1,
      current_sector_id: 'sector1',
      home_sector_id: null,
      ...overrides
    });

    it('should return idle for dead NPC', async () => {
      const decision = await behaviorTreeService.evaluateNPCDecision(makeNpc({ is_alive: false }));
      expect(decision.action).toBe('idle');
      expect(decision.reason).toBe('dead');
      expect(decision.needsAI).toBe(false);
    });

    it('should flee when hull below flee_threshold', async () => {
      const decision = await behaviorTreeService.evaluateNPCDecision(
        makeNpc({ hull_points: 10, max_hull_points: 100, flee_threshold: 0.2 }),
        { adjacentSectors: [{ sector_id: 'safe', hostileCount: 0, hasPort: true }] }
      );
      expect(decision.action).toBe('flee');
      expect(decision.reason).toContain('critical hull');
    });

    it('should finish near-dead target when engaging', async () => {
      const decision = await behaviorTreeService.evaluateNPCDecision(
        makeNpc({ behavior_state: 'engaging' }),
        { currentTarget: { hull_points: 5, max_hull_points: 100 } }
      );
      expect(decision.action).toBe('finish_target');
    });

    it('should attack when clear advantage against player', async () => {
      const weakPlayer = {
        hull_points: 20, max_hull_points: 100,
        shield_points: 0, max_shield_points: 50,
        attack_power: 5, defense_rating: 5,
        owner_user_id: 'user1'
      };
      const decision = await behaviorTreeService.evaluateNPCDecision(
        makeNpc({ aggression_level: 0.9 }),
        { playersInSector: [weakPlayer] }
      );
      expect(decision.action).toBe('attack_player');
      expect(decision.needsAI).toBe(false);
    });

    it('should flee when clear disadvantage', async () => {
      const strongPlayer = {
        hull_points: 100, max_hull_points: 100,
        shield_points: 50, max_shield_points: 50,
        attack_power: 50, defense_rating: 50,
        owner_user_id: 'user1'
      };
      const decision = await behaviorTreeService.evaluateNPCDecision(
        makeNpc({ hull_points: 30, attack_power: 5, aggression_level: 0.1 }),
        { playersInSector: [strongPlayer], adjacentSectors: [{ sector_id: 'safe', hostileCount: 0, hasPort: false }] }
      );
      expect(decision.action).toBe('flee');
    });

    it('should flag needsAI for ambiguous situation with tier >= 2', async () => {
      // At difficulty 2: threshold=0.6, retreatThreshold=0.4
      // Need score in (0.4, 0.6) range for ambiguous
      // NPC attack=10, target defense=10 → attackRatio=0.5
      // Equal hulls/shields → advantages at 0.5
      // aggression=0.5, difficultyMod=(2-3)*0.025=-0.025
      // score = 0.5*0.3 + 0.5*0.15 + 0.5*0.3 + 0.5*0.25 - 0.025 = 0.475
      gameSettingsService.getSetting.mockReturnValue(2); // difficulty 2
      const evenPlayer = {
        hull_points: 80, max_hull_points: 100,
        shield_points: 40, max_shield_points: 50,
        attack_power: 10, defense_rating: 10,
        owner_user_id: 'user1'
      };
      const decision = await behaviorTreeService.evaluateNPCDecision(
        makeNpc({ intelligence_tier: 2, aggression_level: 0.5, attack_power: 10 }),
        { playersInSector: [evenPlayer], difficulty: 2 }
      );
      expect(decision.needsAI).toBe(true);
    });

    it('should return trade for TRADER at port', async () => {
      const decision = await behaviorTreeService.evaluateNPCDecision(
        makeNpc({ npc_type: 'TRADER' }),
        { sectorHasPort: true }
      );
      expect(decision.action).toBe('trade');
      expect(decision.reason).toBe('at port');
    });

    it('should move TRADER toward port when not at port', async () => {
      sectorGraphService.findNearestPortSector.mockResolvedValue('port_sector');
      const decision = await behaviorTreeService.evaluateNPCDecision(
        makeNpc({ npc_type: 'TRADER', current_sector_id: 'sector1' }),
        { sectorHasPort: false }
      );
      expect(decision.action).toBe('move_toward_target');
      expect(decision.targetSectorId).toBe('port_sector');
      expect(decision.reason).toBe('seeking port');
    });

    it('should return guard for PATROL at port', async () => {
      const decision = await behaviorTreeService.evaluateNPCDecision(
        makeNpc({ npc_type: 'PATROL' }),
        { sectorHasPort: true }
      );
      expect(decision.action).toBe('guard');
      expect(decision.reason).toBe('protecting port');
    });

    it('should return move for PATROL away from home', async () => {
      sectorGraphService.findPathToSector.mockResolvedValue('step1');
      const decision = await behaviorTreeService.evaluateNPCDecision(
        makeNpc({ npc_type: 'PATROL', home_sector_id: 'home', current_sector_id: 'away' }),
        { sectorHasPort: false }
      );
      expect(decision.action).toBe('move_toward_target');
      expect(decision.reason).toBe('returning home');
    });

    it('should wander when no conditions match', async () => {
      const decision = await behaviorTreeService.evaluateNPCDecision(
        makeNpc({ npc_type: 'PIRATE' }),
        { adjacentSectors: [{ sector_id: 'random', hostileCount: 0, hasPort: false, playerCount: 0 }] }
      );
      expect(decision.action).toBe('patrol');
      expect(decision.reason).toBe('wandering');
    });

    it('should return idle when no adjacent sectors', async () => {
      const decision = await behaviorTreeService.evaluateNPCDecision(
        makeNpc({ npc_type: 'PIRATE' }),
        { adjacentSectors: [] }
      );
      expect(decision.action).toBe('idle');
      expect(decision.reason).toBe('nothing to do');
    });
  });
});
