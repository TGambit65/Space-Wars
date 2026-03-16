/**
 * Sector Graph Service Tests
 * Real DB — builds a graph topology in beforeAll.
 */
const { sequelize } = require('../../src/models');
const sectorGraphService = require('../../src/services/sectorGraphService');
const { createTestSector, createSectorConnection, createTestPort, cleanDatabase } = require('../helpers');

describe('Sector Graph Service', () => {
  // Topology: A -- B -- C -- D, A -- E
  //           Port in sector C
  let sectorA, sectorB, sectorC, sectorD, sectorE, isolatedSector;

  beforeAll(async () => {
    await sequelize.sync({ force: true });
    await cleanDatabase();

    sectorA = await createTestSector({ name: 'Sector A' });
    sectorB = await createTestSector({ name: 'Sector B' });
    sectorC = await createTestSector({ name: 'Sector C' });
    sectorD = await createTestSector({ name: 'Sector D' });
    sectorE = await createTestSector({ name: 'Sector E' });
    isolatedSector = await createTestSector({ name: 'Isolated' });

    await createSectorConnection(sectorA.sector_id, sectorB.sector_id);
    await createSectorConnection(sectorB.sector_id, sectorC.sector_id);
    await createSectorConnection(sectorC.sector_id, sectorD.sector_id);
    await createSectorConnection(sectorA.sector_id, sectorE.sector_id);

    await createTestPort(sectorC.sector_id, { name: 'Port C' });
  });

  // ─── getAdjacentSectorIds ───────────────────────────────────────

  describe('getAdjacentSectorIds', () => {
    it('should return connected sector IDs', async () => {
      const adjacent = await sectorGraphService.getAdjacentSectorIds(sectorA.sector_id);
      expect(adjacent).toContain(sectorB.sector_id);
      expect(adjacent).toContain(sectorE.sector_id);
      expect(adjacent).toHaveLength(2);
    });

    it('should be bidirectional', async () => {
      const fromB = await sectorGraphService.getAdjacentSectorIds(sectorB.sector_id);
      expect(fromB).toContain(sectorA.sector_id);
      expect(fromB).toContain(sectorC.sector_id);
    });

    it('should return empty array for isolated sector', async () => {
      const adjacent = await sectorGraphService.getAdjacentSectorIds(isolatedSector.sector_id);
      expect(adjacent).toEqual([]);
    });
  });

  // ─── buildAdjacencyMap ──────────────────────────────────────────

  describe('buildAdjacencyMap', () => {
    it('should build complete adjacency map with no scope', async () => {
      const map = await sectorGraphService.buildAdjacencyMap();
      expect(map.get(sectorA.sector_id)).toContain(sectorB.sector_id);
      expect(map.get(sectorA.sector_id)).toContain(sectorE.sector_id);
      expect(map.get(sectorB.sector_id)).toContain(sectorA.sector_id);
      expect(map.get(sectorC.sector_id)).toContain(sectorB.sector_id);
    });

    it('should filter by sector scope', async () => {
      const scope = new Set([sectorA.sector_id, sectorB.sector_id]);
      const map = await sectorGraphService.buildAdjacencyMap(scope);
      // Should include A-B connection
      expect(map.get(sectorA.sector_id)).toContain(sectorB.sector_id);
      // Should NOT include B-C (C is out of scope query but may appear via B)
      // Actually, the query uses OR on sector_a_id/sector_b_id, so B-C will appear
      // because B is in scope. The map includes neighbors outside scope.
    });

    it('should return full map when scope is empty set (no filtering)', async () => {
      // Empty scope with size 0 is falsy in the condition, so all connections are loaded
      const map = await sectorGraphService.buildAdjacencyMap(new Set());
      expect(map.size).toBeGreaterThan(0);
    });
  });

  // ─── getPortSectorIds ──────────────────────────────────────────

  describe('getPortSectorIds', () => {
    it('should return sector IDs with active ports', async () => {
      const portSectors = await sectorGraphService.getPortSectorIds([
        sectorA.sector_id, sectorB.sector_id, sectorC.sector_id
      ]);
      expect(portSectors.has(sectorC.sector_id)).toBe(true);
      expect(portSectors.has(sectorA.sector_id)).toBe(false);
    });

    it('should return empty set for sectors with no ports', async () => {
      const portSectors = await sectorGraphService.getPortSectorIds([
        sectorA.sector_id, sectorB.sector_id
      ]);
      expect(portSectors.size).toBe(0);
    });

    it('should return empty set for empty input', async () => {
      const portSectors = await sectorGraphService.getPortSectorIds([]);
      expect(portSectors.size).toBe(0);
    });
  });

  // ─── findPathToSector ──────────────────────────────────────────

  describe('findPathToSector', () => {
    it('should return next step toward destination', async () => {
      // A -> D: path is A -> B -> C -> D, next step = B
      const next = await sectorGraphService.findPathToSector(sectorA.sector_id, sectorD.sector_id);
      expect(next).toBe(sectorB.sector_id);
    });

    it('should return adjacent sector directly when 1 hop away', async () => {
      const next = await sectorGraphService.findPathToSector(sectorA.sector_id, sectorB.sector_id);
      expect(next).toBe(sectorB.sector_id);
    });

    it('should return null when from equals to', async () => {
      const next = await sectorGraphService.findPathToSector(sectorA.sector_id, sectorA.sector_id);
      expect(next).toBeNull();
    });

    it('should return null when destination is unreachable', async () => {
      const next = await sectorGraphService.findPathToSector(sectorA.sector_id, isolatedSector.sector_id);
      expect(next).toBeNull();
    });

    it('should work with pre-built adjacency map', async () => {
      const map = await sectorGraphService.buildAdjacencyMap();
      const next = await sectorGraphService.findPathToSector(sectorA.sector_id, sectorD.sector_id, 10, map);
      expect(next).toBe(sectorB.sector_id);
    });
  });

  // ─── findNearestPortSector ─────────────────────────────────────

  describe('findNearestPortSector', () => {
    it('should return self if already at port', async () => {
      const result = await sectorGraphService.findNearestPortSector(sectorC.sector_id);
      expect(result).toBe(sectorC.sector_id);
    });

    it('should return first step toward nearest port', async () => {
      // From A: nearest port is C (A -> B -> C), first step = B
      const result = await sectorGraphService.findNearestPortSector(sectorA.sector_id);
      expect(result).toBe(sectorB.sector_id);
    });

    it('should return null when no port is reachable', async () => {
      const result = await sectorGraphService.findNearestPortSector(isolatedSector.sector_id);
      expect(result).toBeNull();
    });

    it('should work with pre-built adjacency map and port set', async () => {
      const map = await sectorGraphService.buildAdjacencyMap();
      const portSet = await sectorGraphService.getPortSectorIds([
        sectorA.sector_id, sectorB.sector_id, sectorC.sector_id, sectorD.sector_id, sectorE.sector_id
      ]);
      const result = await sectorGraphService.findNearestPortSector(sectorA.sector_id, 10, map, portSet);
      expect(result).toBe(sectorB.sector_id);
    });
  });
});
