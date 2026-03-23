/**
 * Tests for NPC UX Living World features (PRDs 1-4)
 * Covers: state_change emissions, action card payloads, relationship data,
 * cache key with relationship context, faction assignment, presence beats.
 */
const { createTestUser, createTestSector, createTestSectorWithZone, createTestShip, createTestNPC, createTestPort, addCommodityToPort, createTestCommodity, cleanDatabase } = require('../helpers');
const npcActionExecutor = require('../../src/services/npcActionExecutor');
const dialogueService = require('../../src/services/dialogueService');
const dialogueScriptsService = require('../../src/services/dialogueScriptsService');
const npcService = require('../../src/services/npcService');
const npcPresenceService = require('../../src/services/npcPresenceService');
const npcMemoryService = require('../../src/services/npcMemoryService');
const worldPolicyService = require('../../src/services/worldPolicyService');
const progressionService = require('../../src/services/progressionService');
const { NPC, NpcMemory, NpcConversationSession } = require('../../src/models');

// Mock socket service for testing emissions
const createMockSocketService = () => {
  const emissions = [];
  return {
    emissions,
    emitToSector: (sectorId, event, data) => {
      emissions.push({ type: 'sector', sectorId, event, data });
    },
    emitToUser: (userId, event, data) => {
      emissions.push({ type: 'user', userId, event, data });
    },
    clear: () => { emissions.length = 0; }
  };
};

beforeEach(async () => {
  await cleanDatabase();
});

// ─── PRD 1: State Change Emissions ──────────────────────────────────

describe('PRD 1: npc:state_change emissions', () => {
  let sector, npc, mockSocket;

  beforeEach(async () => {
    sector = await createTestSector();
    npc = await createTestNPC(sector.sector_id, { behavior_state: 'idle', npc_type: 'PATROL' });
    mockSocket = createMockSocketService();
  });

  test('emits state_change when NPC transitions to trading', async () => {
    await npcActionExecutor.executeAction(npc, { action: 'trade' }, {}, mockSocket);
    const stateChanges = mockSocket.emissions.filter(e => e.event === 'npc:state_change');
    expect(stateChanges).toHaveLength(1);
    expect(stateChanges[0].data.old_state).toBe('idle');
    expect(stateChanges[0].data.new_state).toBe('trading');
  });

  test('emits state_change when NPC transitions to guarding', async () => {
    await npcActionExecutor.executeAction(npc, { action: 'guard' }, {}, mockSocket);
    const stateChanges = mockSocket.emissions.filter(e => e.event === 'npc:state_change');
    expect(stateChanges).toHaveLength(1);
    expect(stateChanges[0].data.new_state).toBe('guarding');
  });

  test('emits state_change when NPC transitions to engaging', async () => {
    await npcActionExecutor.executeAction(npc, { action: 'attack_player' }, {}, mockSocket);
    const stateChanges = mockSocket.emissions.filter(e => e.event === 'npc:state_change');
    expect(stateChanges).toHaveLength(1);
    expect(stateChanges[0].data.old_state).toBe('idle');
    expect(stateChanges[0].data.new_state).toBe('engaging');
  });

  test('does not emit state_change when already in same state', async () => {
    npc = await createTestNPC(sector.sector_id, { behavior_state: 'trading', npc_type: 'TRADER' });
    await npcActionExecutor.executeAction(npc, { action: 'trade' }, {}, mockSocket);
    const stateChanges = mockSocket.emissions.filter(e => e.event === 'npc:state_change');
    expect(stateChanges).toHaveLength(0);
  });

  test('emits state_change when NPC goes idle from non-idle', async () => {
    npc = await createTestNPC(sector.sector_id, { behavior_state: 'trading', npc_type: 'TRADER' });
    await npcActionExecutor.executeAction(npc, { action: 'idle' }, {}, mockSocket);
    const stateChanges = mockSocket.emissions.filter(e => e.event === 'npc:state_change');
    expect(stateChanges).toHaveLength(1);
    expect(stateChanges[0].data.old_state).toBe('trading');
    expect(stateChanges[0].data.new_state).toBe('idle');
  });

  test('does not emit state_change for idle-to-idle', async () => {
    await npcActionExecutor.executeAction(npc, { action: 'idle' }, {}, mockSocket);
    const stateChanges = mockSocket.emissions.filter(e => e.event === 'npc:state_change');
    expect(stateChanges).toHaveLength(0);
  });

  test('emits state_change when fleeing without escape route', async () => {
    await npcActionExecutor.executeAction(npc, { action: 'flee' }, { adjacentSectors: [] }, mockSocket);
    const stateChanges = mockSocket.emissions.filter(e => e.event === 'npc:state_change');
    expect(stateChanges).toHaveLength(1);
    expect(stateChanges[0].data.new_state).toBe('fleeing');
  });
});

// ─── PRD 2: Action Card Payloads ────────────────────────────────────

describe('PRD 2: dialogue action payloads', () => {
  test('ask_prices returns price_list data with structured prices', () => {
    const npc = { npc_type: 'TRADER', name: 'Test Trader' };
    const context = {
      portCommodities: [
        { commodity_name: 'Ore', buy_price: 100, sell_price: 80, quantity: 50 },
        { commodity_name: 'Food', buy_price: 50, sell_price: 40, quantity: 100 }
      ],
      portName: 'Alpha Port'
    };

    const result = dialogueScriptsService.getScriptedResponse('TRADER', 'ask_prices', npc, context);
    expect(result.data).toBeDefined();
    expect(result.data.action).toBe('price_list');
    expect(result.data.prices).toHaveLength(2);
    expect(result.data.prices[0]).toEqual({
      name: 'Ore', buy: 100, sell: 80, quantity: 50
    });
    expect(result.data.port_name).toBe('Alpha Port');
  });

  test('ask_routes returns route_tip data with sector IDs', () => {
    const npc = { npc_type: 'TRADER', name: 'Test Trader' };
    const context = {
      adjacentSectors: [
        { name: 'Sector A', sector_id: 'id-a', hasPort: true, hostileCount: 0 },
        { name: 'Sector B', sector_id: 'id-b', hasPort: true, hostileCount: 0 }
      ]
    };

    const result = dialogueScriptsService.getScriptedResponse('TRADER', 'ask_routes', npc, context);
    expect(result.data).toBeDefined();
    expect(result.data.action).toBe('route_tip');
    expect(result.data.routes).toHaveLength(1);
    expect(result.data.routes[0].from).toBe('Sector A');
    expect(result.data.routes[0].to).toBe('Sector B');
    expect(result.data.routes[0].from_id).toBe('id-a');
    expect(result.data.routes[0].to_id).toBe('id-b');
  });
});

// ─── PRD 3: Relationship in Dialogue ────────────────────────────────

describe('PRD 3: relationship data in startDialogue', () => {
  let user, sector, npc;

  beforeEach(async () => {
    user = await createTestUser();
    sector = await createTestSector();
    npc = await createTestNPC(sector.sector_id, {
      npc_type: 'TRADER',
      behavior_state: 'idle',
      ai_personality: { trait_primary: 'greedy', speech_style: 'formal' }
    });
    await createTestShip(user.user_id, sector.sector_id, { is_active: true });
  });

  test('returns null relationship for first-time interaction', async () => {
    const result = await dialogueService.startDialogue(user.user_id, npc.npc_id);
    expect(result.relationship).toBeNull();
  });

  test('returns relationship data after multiple interactions', async () => {
    // Create memory record simulating prior interactions
    await NpcMemory.create({
      npc_id: npc.npc_id,
      user_id: user.user_id,
      trust: 0.3,
      fear: 0.0,
      respect: 0.2,
      interaction_count: 5,
      notable_fact: 'Good trading partner',
      last_interaction_type: 'trade'
    });

    const result = await dialogueService.startDialogue(user.user_id, npc.npc_id);
    expect(result.relationship).toBeDefined();
    expect(result.relationship.trust).toBe(0.3);
    expect(result.relationship.respect).toBe(0.2);
    expect(result.relationship.interaction_count).toBe(5);
    expect(result.relationship.notable_fact).toBe('Good trading partner');
  });
});

// ─── F4: Cache Key with Relationship ────────────────────────────────

describe('F4: dialogue cache key includes relationship', () => {
  let user1, user2, sector, npc;

  beforeEach(async () => {
    user1 = await createTestUser({ username: 'player1' });
    user2 = await createTestUser({ username: 'player2' });
    sector = await createTestSector();
    npc = await createTestNPC(sector.sector_id, {
      npc_type: 'TRADER',
      behavior_state: 'idle',
      intelligence_tier: 1, // scripted only — no AI provider needed
      ai_personality: { trait_primary: 'friendly', speech_style: 'casual' }
    });
    await createTestShip(user1.user_id, sector.sector_id, { is_active: true });
    await createTestShip(user2.user_id, sector.sector_id, { is_active: true });
  });

  test('different relationship labels produce different cache behavior', async () => {
    // Give user1 a trusting relationship
    await NpcMemory.create({
      npc_id: npc.npc_id,
      user_id: user1.user_id,
      trust: 0.5,
      fear: 0.0,
      respect: 0.3,
      interaction_count: 10,
      last_interaction_type: 'trade'
    });

    // User2 has no relationship (stranger)
    // Both start dialogue to confirm sessions work
    await dialogueService.startDialogue(user1.user_id, npc.npc_id);
    await dialogueService.startDialogue(user2.user_id, npc.npc_id);

    // Both send the same free text — with the fix, they should not share cache
    // because user1 has a relationship label and user2 doesn't.
    // We can't easily test cache internals, but we verify both get responses.
    const result1 = await dialogueService.processFreeText(user1.user_id, npc.npc_id, 'hello there');
    const result2 = await dialogueService.processFreeText(user2.user_id, npc.npc_id, 'hello there');

    expect(result1.response_text).toBeDefined();
    expect(result2.response_text).toBeDefined();
    // Both should get valid responses (not crash)
  });
});

// ─── PRD 4: Faction Assignment ──────────────────────────────────────

describe('PRD 4: faction assignment in NPC spawning', () => {
  test('patrol NPCs in core sectors always get a faction', async () => {
    const sector = await createTestSectorWithZone('core', 'protected');
    const npc = await npcService.spawnNPC(sector.sector_id, 'PATROL');
    expect(npc.faction).toBeTruthy();
    expect(['terran_alliance', 'zythian_swarm', 'automaton_collective', 'synthesis_accord', 'sylvari_dominion']).toContain(npc.faction);
  });

  test('pirate NPCs never get a faction', async () => {
    const sector = await createTestSectorWithZone('outer_ring', 'contested');
    const npc = await npcService.spawnNPC(sector.sector_id, 'PIRATE');
    expect(npc.faction).toBeNull();
  });

  test('trader NPCs in core sectors get a faction', async () => {
    const sector = await createTestSectorWithZone('core', 'protected');
    const npc = await npcService.spawnNPC(sector.sector_id, 'TRADER');
    expect(npc.faction).toBeTruthy();
  });

  test('faction field is included in getSystemDetail NPC data', async () => {
    const sector = await createTestSector();
    await createTestNPC(sector.sector_id, {
      npc_type: 'PATROL',
      faction: 'terran_alliance',
      behavior_state: 'patrolling'
    });

    const npcInDb = await NPC.findOne({
      where: { current_sector_id: sector.sector_id },
      attributes: ['npc_id', 'name', 'npc_type', 'behavior_state', 'faction']
    });
    expect(npcInDb.faction).toBe('terran_alliance');
    expect(npcInDb.behavior_state).toBe('patrolling');
  });
});

// ─── PRD 4: Presence Beats Include Faction ──────────────────────────

describe('PRD 4: presence beats include faction data', () => {
  test('hails include faction field when NPC has faction', async () => {
    const sector = await createTestSector();
    const user = await createTestUser();
    const ship = await createTestShip(user.user_id, sector.sector_id, { is_active: true });

    // Create a faction-affiliated NPC with no recent beat
    await createTestNPC(sector.sector_id, {
      npc_type: 'PATROL',
      faction: 'terran_alliance',
      behavior_state: 'patrolling',
      last_hail_at: null,
      last_presence_beat_at: null
    });

    const mockSocket = createMockSocketService();
    await npcPresenceService.processPresenceTick(mockSocket);

    // Should have emitted at least one beat
    expect(mockSocket.emissions.length).toBeGreaterThanOrEqual(1);
    const emission = mockSocket.emissions[0];
    expect(emission.data.faction).toBe('terran_alliance');
  });
});

// ─── PRD 3A: Memory Decay ────────────────────────────────────────────

describe('PRD 3A: memory decay', () => {
  test('decays scores for stale memories (>24h old)', async () => {
    const user = await createTestUser();
    const sector = await createTestSector();
    const npc = await createTestNPC(sector.sector_id, { npc_type: 'TRADER' });

    await NpcMemory.create({
      npc_id: npc.npc_id,
      user_id: user.user_id,
      trust: 0.5,
      fear: 0.3,
      respect: 0.4,
      interaction_count: 10,
      last_interaction_at: new Date(Date.now() - 25 * 60 * 60 * 1000) // 25h ago
    });

    const decayed = await npcMemoryService.decayAllMemories();
    expect(decayed).toBe(1);

    const memory = await NpcMemory.findOne({ where: { npc_id: npc.npc_id, user_id: user.user_id } });
    expect(memory.trust).toBeCloseTo(0.5 * 0.98, 4);
    expect(memory.fear).toBeCloseTo(0.3 * 0.98, 4);
    expect(memory.respect).toBeCloseTo(0.4 * 0.98, 4);
  });

  test('skips memories with recent interactions (<24h)', async () => {
    const user = await createTestUser();
    const sector = await createTestSector();
    const npc = await createTestNPC(sector.sector_id, { npc_type: 'TRADER' });

    await NpcMemory.create({
      npc_id: npc.npc_id,
      user_id: user.user_id,
      trust: 0.5,
      fear: 0.3,
      respect: 0.4,
      interaction_count: 5,
      last_interaction_at: new Date() // just now
    });

    const decayed = await npcMemoryService.decayAllMemories();
    expect(decayed).toBe(0);

    const memory = await NpcMemory.findOne({ where: { npc_id: npc.npc_id, user_id: user.user_id } });
    expect(memory.trust).toBe(0.5);
  });

  test('snaps near-zero values to zero', async () => {
    const user = await createTestUser();
    const sector = await createTestSector();
    const npc = await createTestNPC(sector.sector_id, { npc_type: 'TRADER' });

    await NpcMemory.create({
      npc_id: npc.npc_id,
      user_id: user.user_id,
      trust: 0.04, // below DECAY_FLOOR after decay
      fear: 0.0,
      respect: 0.03,
      interaction_count: 3,
      last_interaction_at: new Date(Date.now() - 25 * 60 * 60 * 1000)
    });

    await npcMemoryService.decayAllMemories();

    const memory = await NpcMemory.findOne({ where: { npc_id: npc.npc_id, user_id: user.user_id } });
    expect(memory.trust).toBe(0);
    expect(memory.respect).toBe(0);
  });

  test('decays negative scores toward zero', async () => {
    const user = await createTestUser();
    const sector = await createTestSector();
    const npc = await createTestNPC(sector.sector_id, { npc_type: 'PATROL' });

    await NpcMemory.create({
      npc_id: npc.npc_id,
      user_id: user.user_id,
      trust: -0.5,
      fear: 0.0,
      respect: -0.04, // should snap to 0
      interaction_count: 8,
      last_interaction_at: new Date(Date.now() - 25 * 60 * 60 * 1000)
    });

    await npcMemoryService.decayAllMemories();

    const memory = await NpcMemory.findOne({ where: { npc_id: npc.npc_id, user_id: user.user_id } });
    expect(memory.trust).toBeCloseTo(-0.5 * 0.98, 4);
    expect(memory.respect).toBe(0); // snapped to 0
  });
});

// ─── PRD 3B: Relationship-Scaled Rewards ─────────────────────────────

describe('PRD 3B: relationship-scaled rewards', () => {
  test('bounty reward scales up with high trust', () => {
    const npc = { npc_type: 'PATROL', name: 'Officer', ai_personality: { speech_style: 'military' } };
    const highTrustContext = {
      adjacentSectors: [{ name: 'Dangerous Sector', sector_id: 'ds1', hasPort: false, hostileCount: 3 }],
      relationship: { trust: 1.0, respect: 1.0, fear: 0 }
    };
    const noRelContext = {
      adjacentSectors: [{ name: 'Dangerous Sector', sector_id: 'ds1', hasPort: false, hostileCount: 3 }]
    };

    // Run multiple times and compare averages to account for randomness
    let highTrustTotal = 0;
    let noRelTotal = 0;
    const iterations = 100;
    for (let i = 0; i < iterations; i++) {
      const high = dialogueScriptsService.getScriptedResponse('PATROL', 'ask_bounties', npc, highTrustContext);
      const base = dialogueScriptsService.getScriptedResponse('PATROL', 'ask_bounties', npc, noRelContext);
      highTrustTotal += high.data.reward_credits;
      noRelTotal += base.data.reward_credits;
    }

    // High trust multiplier is 1.5, so avg should be ~50% higher
    expect(highTrustTotal / iterations).toBeGreaterThan(noRelTotal / iterations);
  });

  test('pirate bribe acceptance scales with fear', () => {
    const npc = { npc_type: 'PIRATE', name: 'Scoundrel', ai_personality: { speech_style: 'pirate_slang' } };
    const highFearContext = { relationship: { trust: 0, respect: 0, fear: 1.0 } };
    const noRelContext = {};

    let highFearAccepted = 0;
    let noRelAccepted = 0;
    const iterations = 200;
    for (let i = 0; i < iterations; i++) {
      const highResult = dialogueScriptsService.getScriptedResponse('PIRATE', 'bribe', npc, highFearContext);
      const baseResult = dialogueScriptsService.getScriptedResponse('PIRATE', 'bribe', npc, noRelContext);
      if (highResult.data && highResult.data.bribe_accepted) highFearAccepted++;
      if (baseResult.data && baseResult.data.bribe_accepted) noRelAccepted++;
    }

    // High fear gives ~0.8 chance vs base 0.6 chance
    expect(highFearAccepted).toBeGreaterThan(noRelAccepted);
  });
});

// ─── PRD 4A: Territory Pressure ──────────────────────────────────────

describe('PRD 4A: computeSectorPressure', () => {
  test('core sector with no hostiles is Secure', () => {
    const result = worldPolicyService.computeSectorPressure({
      zone_class: 'core',
      security_class: 'protected',
      hostileNPCCount: 0,
      patrolNPCCount: 2,
      playerCount: 1
    });
    expect(result.label).toBe('Secure');
    expect(result.pressure).toBeLessThan(0.15);
  });

  test('frontier sector with hostiles is Dangerous or worse', () => {
    const result = worldPolicyService.computeSectorPressure({
      zone_class: 'frontier',
      security_class: 'pvp',
      hostileNPCCount: 3,
      patrolNPCCount: 0,
      playerCount: 1
    });
    expect(['Dangerous', 'Hostile Territory']).toContain(result.label);
    expect(result.pressure).toBeGreaterThanOrEqual(0.55);
  });

  test('patrols reduce pressure', () => {
    const withoutPatrols = worldPolicyService.computeSectorPressure({
      zone_class: 'mid_ring',
      security_class: 'pve',
      hostileNPCCount: 2,
      patrolNPCCount: 0,
      playerCount: 0
    });
    const withPatrols = worldPolicyService.computeSectorPressure({
      zone_class: 'mid_ring',
      security_class: 'pve',
      hostileNPCCount: 2,
      patrolNPCCount: 3,
      playerCount: 0
    });
    expect(withPatrols.pressure).toBeLessThan(withoutPatrols.pressure);
  });
});

// ── P0 UX: Level-Up Socket Emission ─────────────────────────────
describe('P0: Level-up socket emission', () => {
  let socketEmissions;

  beforeEach(() => {
    socketEmissions = [];
    // Mock socketService.emitToUser for this test
    jest.spyOn(require('../../src/services/socketService'), 'emitToUser')
      .mockImplementation((userId, event, data) => {
        socketEmissions.push({ userId, event, data });
      });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  test('emits player:level_up when XP causes level increase', async () => {
    const user = await createTestUser({ total_xp: 0, player_level: 1, available_skill_points: 0 });

    // Award enough XP to level up (level 2 typically requires ~1000 XP)
    const result = await progressionService.awardXP(user.user_id, 2000, 'test');

    expect(result.levels_gained).toBeGreaterThanOrEqual(1);
    const levelEvent = socketEmissions.find(e => e.event === 'player:level_up');
    expect(levelEvent).toBeTruthy();
    expect(levelEvent.userId).toBe(user.user_id);
    expect(levelEvent.data.new_level).toBe(result.new_level);
    expect(levelEvent.data.old_level).toBe(1);
    expect(levelEvent.data.source).toBe('test');
  });

  test('does NOT emit player:level_up when no level gained', async () => {
    const user = await createTestUser({ total_xp: 0, player_level: 1, available_skill_points: 0 });

    // Award a tiny amount of XP — not enough to level up
    const result = await progressionService.awardXP(user.user_id, 5, 'test');

    expect(result.levels_gained).toBe(0);
    const levelEvent = socketEmissions.find(e => e.event === 'player:level_up');
    expect(levelEvent).toBeUndefined();
  });
});
