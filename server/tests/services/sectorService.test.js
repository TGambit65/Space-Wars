/**
 * Sector Service Tests
 */
const sectorService = require('../../src/services/sectorService');
const { Sector, SectorConnection, Port } = require('../../src/models');
const { createTestSector, createSectorConnection, createTestPort, cleanDatabase } = require('../helpers');

describe('Sector Service', () => {
  let sector1, sector2, sector3, sector4;

  beforeAll(async () => {
    await cleanDatabase();

    // Create a small network of sectors
    sector1 = await createTestSector({ name: 'Hub Central', type: 'Core' });
    sector2 = await createTestSector({ name: 'Mining Alpha', type: 'Inner' });
    sector3 = await createTestSector({ name: 'Trading Post', type: 'Mid' });
    sector4 = await createTestSector({ name: 'Outer Reach', type: 'Outer' });

    // Create connections: hub connects to all, 2-3 connected
    // Note: is_bidirectional=true by default, so we only need one entry per connection
    await createSectorConnection(sector1.sector_id, sector2.sector_id);
    await createSectorConnection(sector1.sector_id, sector3.sector_id);
    await createSectorConnection(sector1.sector_id, sector4.sector_id);
    await createSectorConnection(sector2.sector_id, sector3.sector_id);

    // Add a port to sector1
    await createTestPort(sector1.sector_id, { name: 'Central Station' });
  });

  afterAll(async () => {
    await cleanDatabase();
  });

  describe('getSectorById', () => {
    it('should return sector details', async () => {
      const sector = await sectorService.getSectorById(sector1.sector_id);

      expect(sector).toBeDefined();
      expect(sector.name).toBe('Hub Central');
      expect(sector.type).toBe('Core');
    });

    it('should include connected sectors', async () => {
      const sector = await sectorService.getSectorById(sector1.sector_id);
      
      expect(sector.connectedSectors).toBeDefined();
      expect(sector.connectedSectors.length).toBe(3); // Connected to 2, 3, and 4
    });

    it('should throw error for non-existent sector', async () => {
      await expect(sectorService.getSectorById('00000000-0000-0000-0000-000000000000'))
        .rejects.toThrow('Sector not found');
    });
  });

  describe('getConnectedSectors', () => {
    it('should return all directly connected sectors', async () => {
      const connected = await sectorService.getConnectedSectors(sector1.sector_id);
      
      expect(connected).toBeInstanceOf(Array);
      expect(connected.length).toBe(3);
    });

    it('should return sector details for each connection', async () => {
      const connected = await sectorService.getConnectedSectors(sector1.sector_id);
      
      const names = connected.map(s => s.name);
      expect(names).toContain('Mining Alpha');
      expect(names).toContain('Trading Post');
      expect(names).toContain('Outer Reach');
    });

    it('should return empty array for isolated sector', async () => {
      const isolated = await createTestSector({ name: 'Isolated' });
      const connected = await sectorService.getConnectedSectors(isolated.sector_id);
      
      expect(connected).toEqual([]);
    });
  });

  describe('getAllSectors', () => {
    it('should return all sectors', async () => {
      const sectors = await sectorService.getAllSectors();

      expect(Array.isArray(sectors)).toBe(true);
      expect(sectors.length).toBeGreaterThanOrEqual(4);
    });

    it('should support pagination', async () => {
      const page1 = await sectorService.getAllSectors({ limit: 2, offset: 0 });
      const page2 = await sectorService.getAllSectors({ limit: 2, offset: 2 });
      
      expect(page1.length).toBeLessThanOrEqual(2);
      expect(page1[0].sector_id).not.toBe(page2[0]?.sector_id);
    });
  });

  describe('getSectorMap', () => {
    it('should return sector map data', async () => {
      const mapData = await sectorService.getSectorMap();
      
      expect(mapData).toHaveProperty('sectors');
      expect(mapData).toHaveProperty('connections');
    });

    it('should include coordinates for each sector', async () => {
      const mapData = await sectorService.getSectorMap();

      mapData.sectors.forEach(sector => {
        expect(sector).toHaveProperty('x_coord');
        expect(sector).toHaveProperty('y_coord');
      });
    });
  });

  describe('isConnected', () => {
    it('should return true for connected sectors', async () => {
      const result = await sectorService.isConnected(sector1.sector_id, sector2.sector_id);
      
      expect(result).toBe(true);
    });

    it('should return false for non-connected sectors', async () => {
      const result = await sectorService.isConnected(sector2.sector_id, sector4.sector_id);
      
      expect(result).toBe(false);
    });

    it('should return false for same sector', async () => {
      const result = await sectorService.isConnected(sector1.sector_id, sector1.sector_id);
      
      expect(result).toBe(false);
    });
  });

  describe('searchSectors', () => {
    it('should find sectors by name', async () => {
      const results = await sectorService.searchSectors('Hub');
      
      expect(results.length).toBeGreaterThan(0);
      expect(results[0].name).toContain('Hub');
    });

    it('should return empty for no matches', async () => {
      const results = await sectorService.searchSectors('ZZZZNONEXISTENT');
      
      expect(results).toEqual([]);
    });
  });
});

