const { cleanDatabase, createTestUser, createTestSector, createTestNPC } = require('../helpers');
const npcMemoryService = require('../../src/services/npcMemoryService');
const { NpcMemory } = require('../../src/models');

describe('npcMemoryService', () => {
  let user, sector, npc;

  beforeEach(async () => {
    await cleanDatabase();
    user = await createTestUser();
    sector = await createTestSector();
    npc = await createTestNPC(sector.sector_id, { name: 'TestTrader', npc_type: 'TRADER' });
  });

  afterAll(async () => {
    await cleanDatabase();
  });

  describe('getOrCreateMemory', () => {
    it('should create a new memory record', async () => {
      const memory = await npcMemoryService.getOrCreateMemory(npc.npc_id, user.user_id);
      expect(memory.npc_id).toBe(npc.npc_id);
      expect(memory.user_id).toBe(user.user_id);
      expect(memory.trust).toBe(0);
      expect(memory.fear).toBe(0);
      expect(memory.respect).toBe(0);
      expect(memory.interaction_count).toBe(0);
    });

    it('should return existing memory on second call', async () => {
      const first = await npcMemoryService.getOrCreateMemory(npc.npc_id, user.user_id);
      await first.update({ trust: 0.5 });
      const second = await npcMemoryService.getOrCreateMemory(npc.npc_id, user.user_id);
      expect(second.memory_id).toBe(first.memory_id);
      expect(second.trust).toBe(0.5);
    });
  });

  describe('recordInteraction', () => {
    it('should increment interaction count', async () => {
      await npcMemoryService.recordInteraction(npc.npc_id, user.user_id, { interactionType: 'greeting' });
      const memory = await NpcMemory.findOne({ where: { npc_id: npc.npc_id, user_id: user.user_id } });
      expect(memory.interaction_count).toBe(1);
      expect(memory.last_interaction_type).toBe('greeting');
    });

    it('should apply score deltas', async () => {
      await npcMemoryService.recordInteraction(npc.npc_id, user.user_id, {
        interactionType: 'trade',
        scoreDeltas: { trust: 0.3, respect: 0.2 }
      });
      const memory = await NpcMemory.findOne({ where: { npc_id: npc.npc_id, user_id: user.user_id } });
      expect(memory.trust).toBeCloseTo(0.3);
      expect(memory.respect).toBeCloseTo(0.2);
    });

    it('should clamp scores to [-1, 1]', async () => {
      await npcMemoryService.recordInteraction(npc.npc_id, user.user_id, {
        interactionType: 'trade',
        scoreDeltas: { trust: 1.5 }
      });
      const memory = await NpcMemory.findOne({ where: { npc_id: npc.npc_id, user_id: user.user_id } });
      expect(memory.trust).toBe(1.0);
    });

    it('should add memory bullets', async () => {
      await npcMemoryService.recordInteraction(npc.npc_id, user.user_id, {
        interactionType: 'trade',
        memoryBullet: 'Traded iron ore for 500 credits'
      });
      const memory = await NpcMemory.findOne({ where: { npc_id: npc.npc_id, user_id: user.user_id } });
      expect(memory.memories).toHaveLength(1);
      expect(memory.memories[0].text).toBe('Traded iron ore for 500 credits');
    });

    it('should cap memory bullets at max', async () => {
      for (let i = 0; i < 12; i++) {
        await npcMemoryService.recordInteraction(npc.npc_id, user.user_id, {
          interactionType: 'trade',
          memoryBullet: `Trade #${i + 1}`
        });
      }
      const memory = await NpcMemory.findOne({ where: { npc_id: npc.npc_id, user_id: user.user_id } });
      expect(memory.memories.length).toBeLessThanOrEqual(10);
      expect(memory.memories[memory.memories.length - 1].text).toBe('Trade #12');
    });

    it('should set notable fact', async () => {
      await npcMemoryService.recordInteraction(npc.npc_id, user.user_id, {
        interactionType: 'trade',
        notableFact: 'Best customer this week.'
      });
      const memory = await NpcMemory.findOne({ where: { npc_id: npc.npc_id, user_id: user.user_id } });
      expect(memory.notable_fact).toBe('Best customer this week.');
    });
  });

  describe('recordStandardInteraction', () => {
    it('should use predefined deltas for trade', async () => {
      await npcMemoryService.recordStandardInteraction(npc.npc_id, user.user_id, 'trade');
      const memory = await NpcMemory.findOne({ where: { npc_id: npc.npc_id, user_id: user.user_id } });
      expect(memory.trust).toBeCloseTo(0.05);
      expect(memory.respect).toBeCloseTo(0.02);
    });

    it('should use predefined deltas for threat', async () => {
      await npcMemoryService.recordStandardInteraction(npc.npc_id, user.user_id, 'threat');
      const memory = await NpcMemory.findOne({ where: { npc_id: npc.npc_id, user_id: user.user_id } });
      expect(memory.fear).toBeCloseTo(0.15);
      expect(memory.trust).toBeCloseTo(-0.1);
    });
  });

  describe('getRelationshipLabel', () => {
    it('should return Stranger for new NPC', () => {
      const label = npcMemoryService.getRelationshipLabel({ trust: 0, fear: 0, respect: 0, interaction_count: 1 });
      expect(label).toBe('Stranger');
    });

    it('should return Trusted Ally for high trust and respect', () => {
      const label = npcMemoryService.getRelationshipLabel({ trust: 0.7, fear: 0, respect: 0.4, interaction_count: 10 });
      expect(label).toBe('Trusted Ally');
    });

    it('should return Hostile for very low trust', () => {
      const label = npcMemoryService.getRelationshipLabel({ trust: -0.7, fear: 0, respect: 0, interaction_count: 5 });
      expect(label).toBe('Hostile');
    });

    it('should return Intimidated for high fear', () => {
      const label = npcMemoryService.getRelationshipLabel({ trust: 0, fear: 0.6, respect: 0, interaction_count: 3 });
      expect(label).toBe('Intimidated');
    });

    it('should return Acquaintance after several neutral interactions', () => {
      const label = npcMemoryService.getRelationshipLabel({ trust: 0.1, fear: 0, respect: 0.1, interaction_count: 6 });
      expect(label).toBe('Acquaintance');
    });
  });

  describe('getRecognition', () => {
    it('should return null for first-time visitor', async () => {
      const result = await npcMemoryService.getRecognition(npc.npc_id, user.user_id, 'TRADER');
      expect(result).toBeNull();
    });

    it('should return null after only 1 interaction', async () => {
      await npcMemoryService.recordStandardInteraction(npc.npc_id, user.user_id, 'greeting');
      const result = await npcMemoryService.getRecognition(npc.npc_id, user.user_id, 'TRADER');
      expect(result).toBeNull();
    });

    it('should return recognition after 2+ interactions', async () => {
      await npcMemoryService.recordStandardInteraction(npc.npc_id, user.user_id, 'greeting');
      await npcMemoryService.recordStandardInteraction(npc.npc_id, user.user_id, 'trade');
      const result = await npcMemoryService.getRecognition(npc.npc_id, user.user_id, 'TRADER');
      expect(result).not.toBeNull();
      expect(result.label).toBeTruthy();
      expect(result.greeting).toBeTruthy();
    });

    it('should include friendly greeting for positive trust', async () => {
      await npcMemoryService.recordInteraction(npc.npc_id, user.user_id, {
        interactionType: 'trade',
        scoreDeltas: { trust: 0.5 }
      });
      // Need at least 2 interactions
      await npcMemoryService.recordStandardInteraction(npc.npc_id, user.user_id, 'trade');
      const result = await npcMemoryService.getRecognition(npc.npc_id, user.user_id, 'TRADER');
      expect(result.greeting).toContain('returning customer');
    });

    it('should include wary greeting for negative trust', async () => {
      await npcMemoryService.recordInteraction(npc.npc_id, user.user_id, {
        interactionType: 'threat',
        scoreDeltas: { trust: -0.5 }
      });
      await npcMemoryService.recordStandardInteraction(npc.npc_id, user.user_id, 'threat');

      const result = await npcMemoryService.getRecognition(npc.npc_id, user.user_id, 'TRADER');
      expect(result.greeting).toContain('professional');
    });
  });

  describe('getRelationship', () => {
    it('should return null for unknown pair', async () => {
      const result = await npcMemoryService.getRelationship(npc.npc_id, user.user_id);
      expect(result).toBeNull();
    });

    it('should return relationship data after interactions', async () => {
      await npcMemoryService.recordStandardInteraction(npc.npc_id, user.user_id, 'trade');
      await npcMemoryService.recordStandardInteraction(npc.npc_id, user.user_id, 'trade');
      const result = await npcMemoryService.getRelationship(npc.npc_id, user.user_id);
      expect(result.trust).toBeGreaterThan(0);
      expect(result.interaction_count).toBe(2);
      expect(result.label).toBeTruthy();
    });
  });
});
