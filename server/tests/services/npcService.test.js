/**
 * NPC Service Tests
 */
const { sequelize, Sector, SectorConnection, NPC } = require('../../src/models');
const npcService = require('../../src/services/npcService');
const { createTestSector, createSectorConnection, cleanDatabase } = require('../helpers');

describe('NPC Service', () => {
  let testSector, otherSector;

  beforeAll(async () => {
    await sequelize.sync({ force: true });
  });

  beforeEach(async () => {
    await cleanDatabase();

    testSector = await createTestSector({ name: 'Test Sector' });
    otherSector = await createTestSector({ name: 'Other Sector' });
    await createSectorConnection(testSector.sector_id, otherSector.sector_id);
  });

  afterAll(async () => {
    await sequelize.close();
  });

  describe('getNPCStats', () => {
    it('should return stats for valid NPC type and ship', () => {
      const stats = npcService.getNPCStats('PIRATE', 'Fighter');
      expect(stats).toHaveProperty('hull');
      expect(stats).toHaveProperty('attack');
      expect(stats).toHaveProperty('defense');
    });

    it('should return default stats for invalid ship type', () => {
      const stats = npcService.getNPCStats('PIRATE', 'InvalidShip');
      expect(stats).toHaveProperty('hull');
      expect(stats.hull).toBe(100); // default value
    });
  });

  describe('spawnNPC', () => {
    it('should create NPC in sector', async () => {
      const npc = await npcService.spawnNPC(testSector.sector_id, 'PIRATE');

      expect(npc).not.toBeNull();
      expect(npc.npc_type).toBe('PIRATE');
      expect(npc.current_sector_id).toBe(testSector.sector_id);
      expect(npc.is_alive).toBe(true);
    });

    it('should spawn with correct type stats', async () => {
      const npc = await npcService.spawnNPC(testSector.sector_id, 'TRADER');

      expect(npc.npc_type).toBe('TRADER');
      expect(npc.aggression_level).toBeLessThan(0.5); // Traders are not aggressive
    });

    it('should throw error for invalid sector', async () => {
      await expect(npcService.spawnNPC('00000000-0000-0000-0000-000000000000', 'PIRATE'))
        .rejects.toThrow('Sector not found');
    });
  });

  describe('getNPCsInSector', () => {
    beforeEach(async () => {
      await npcService.spawnNPC(testSector.sector_id, 'PIRATE');
      await npcService.spawnNPC(testSector.sector_id, 'TRADER');
    });

    it('should return all NPCs in sector', async () => {
      const npcs = await npcService.getNPCsInSector(testSector.sector_id);
      expect(npcs).toHaveLength(2);
    });

    it('should only return alive NPCs', async () => {
      const npc = await NPC.findOne({ where: { current_sector_id: testSector.sector_id } });
      await npc.update({ is_alive: false });

      const npcs = await npcService.getNPCsInSector(testSector.sector_id);
      expect(npcs).toHaveLength(1);
    });

    it('should return empty array for empty sector', async () => {
      const npcs = await npcService.getNPCsInSector(otherSector.sector_id);
      expect(npcs).toHaveLength(0);
    });
  });

  describe('getNPCById', () => {
    let testNPC;

    beforeEach(async () => {
      testNPC = await npcService.spawnNPC(testSector.sector_id, 'PIRATE');
    });

    it('should return NPC by ID', async () => {
      const npc = await npcService.getNPCById(testNPC.npc_id);
      expect(npc.npc_id).toBe(testNPC.npc_id);
    });

    it('should throw error for non-existent NPC', async () => {
      await expect(npcService.getNPCById('00000000-0000-0000-0000-000000000000'))
        .rejects.toThrow('NPC not found');
    });
  });

  describe('moveNPC', () => {
    let testNPC;

    beforeEach(async () => {
      testNPC = await npcService.spawnNPC(testSector.sector_id, 'PIRATE');
    });

    it('should move NPC to connected sector', async () => {
      const moved = await npcService.moveNPC(testNPC.npc_id, otherSector.sector_id);
      expect(moved.current_sector_id).toBe(otherSector.sector_id);
    });

    it('should throw error for non-adjacent sector', async () => {
      const farSector = await createTestSector({ name: 'Far Sector' });

      await expect(npcService.moveNPC(testNPC.npc_id, farSector.sector_id))
        .rejects.toThrow('Target sector is not adjacent');
    });
  });

  describe('getAggressiveNPCInSector', () => {
    it('should return aggressive NPC in sector', async () => {
      await NPC.create({
        name: 'Hostile Pirate',
        npc_type: 'PIRATE',
        ship_type: 'Fighter',
        current_sector_id: testSector.sector_id,
        hull_points: 100,
        max_hull_points: 100,
        attack_power: 20,
        defense_rating: 10,
        aggression_level: 0.9,
        is_alive: true
      });

      const aggressiveNPC = await npcService.getAggressiveNPCInSector(testSector.sector_id);
      expect(aggressiveNPC).not.toBeNull();
      expect(aggressiveNPC.aggression_level).toBeGreaterThanOrEqual(0.7);
    });

    it('should return null when no aggressive NPCs', async () => {
      await NPC.create({
        name: 'Friendly Trader',
        npc_type: 'TRADER',
        ship_type: 'Merchant Cruiser',
        current_sector_id: testSector.sector_id,
        hull_points: 100,
        max_hull_points: 100,
        attack_power: 5,
        defense_rating: 5,
        aggression_level: 0.2,
        is_alive: true
      });

      const aggressiveNPC = await npcService.getAggressiveNPCInSector(testSector.sector_id);
      expect(aggressiveNPC).toBeNull();
    });
  });
});

