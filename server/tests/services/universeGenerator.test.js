/**
 * Universe Generator Tests
 */
const { generateUniverse, generateFullUniverse, seedCommodities, getStartingSector } = require('../../src/services/universeGenerator');
const { Sector, SectorConnection, Commodity, Port, PortCommodity } = require('../../src/models');
const { cleanDatabase } = require('../helpers');

describe('Universe Generator', () => {
  beforeEach(async () => {
    await cleanDatabase();
  });

  afterAll(async () => {
    await cleanDatabase();
  });

  describe('generateUniverse', () => {
    it('should generate the specified number of sectors', async () => {
      await generateUniverse({ numSystems: 25, seed: 12345 });

      const count = await Sector.count();
      expect(count).toBe(25);
    });

    it('should create connections between sectors', async () => {
      await generateUniverse({ numSystems: 16, seed: 12345 });
      
      const connectionCount = await SectorConnection.count();
      expect(connectionCount).toBeGreaterThan(0);
    });

    it('should create unique sector names', async () => {
      await generateUniverse({ numSystems: 25, seed: 12345 });
      
      const sectors = await Sector.findAll();
      const names = sectors.map(s => s.name);
      const uniqueNames = new Set(names);
      expect(uniqueNames.size).toBe(names.length);
    });

    it('should assign coordinates to all sectors', async () => {
      await generateUniverse({ numSystems: 16, seed: 12345 });

      const sectors = await Sector.findAll();
      sectors.forEach(sector => {
        expect(sector.x_coord).toBeDefined();
        expect(sector.y_coord).toBeDefined();
        expect(typeof sector.x_coord).toBe('number');
        expect(typeof sector.y_coord).toBe('number');
      });
    });

    it('should produce deterministic results with same seed', async () => {
      await generateUniverse({ numSystems: 16, seed: 99999 });
      const sectors1 = await Sector.findAll({ order: [['name', 'ASC']] });
      const names1 = sectors1.map(s => s.name).sort();

      await cleanDatabase();

      await generateUniverse({ numSystems: 16, seed: 99999 });
      const sectors2 = await Sector.findAll({ order: [['name', 'ASC']] });
      const names2 = sectors2.map(s => s.name).sort();

      // Same seed should produce same set of names (order may differ due to UUID generation)
      expect(names1).toEqual(names2);
    });

    it('should assign sector types based on distance from center', async () => {
      await generateUniverse({ numSystems: 100, seed: 12345 });

      const sectors = await Sector.findAll();
      const types = sectors.map(s => s.type);

      expect(types).toContain('Core');
      expect(types).toContain('Outer');
    });
  });

  describe('seedCommodities', () => {
    it('should create all configured commodities', async () => {
      const { sequelize } = require('../../src/models');
      const transaction = await sequelize.transaction();
      
      try {
        await seedCommodities(transaction);
        await transaction.commit();
        
        const count = await Commodity.count();
        expect(count).toBeGreaterThan(0);
      } catch (error) {
        await transaction.rollback();
        throw error;
      }
    });

    it('should include essential commodities', async () => {
      const { sequelize } = require('../../src/models');
      const transaction = await sequelize.transaction();
      
      try {
        await seedCommodities(transaction);
        await transaction.commit();
        
        const fuel = await Commodity.findOne({ where: { name: 'Fuel' } });
        const food = await Commodity.findOne({ where: { name: 'Food' } });
        
        expect(fuel).toBeDefined();
        expect(food).toBeDefined();
      } catch (error) {
        await transaction.rollback();
        throw error;
      }
    });
  });

  describe('generateFullUniverse', () => {
    it('should generate sectors, commodities, and ports', async () => {
      await generateFullUniverse({ numSystems: 25, seed: 12345 });

      const sectorCount = await Sector.count();
      const commodityCount = await Commodity.count();
      const portCount = await Port.count();

      expect(sectorCount).toBe(25);
      expect(commodityCount).toBeGreaterThan(0);
      expect(portCount).toBeGreaterThan(0);
    });

    it('should create port commodities', async () => {
      await generateFullUniverse({ numSystems: 25, seed: 12345 });
      
      const portCommodityCount = await PortCommodity.count();
      expect(portCommodityCount).toBeGreaterThan(0);
    });
  });

  describe('getStartingSector', () => {
    beforeEach(async () => {
      await generateUniverse({ numSystems: 25, seed: 12345 });
    });

    it('should return a Core sector', async () => {
      const sector = await getStartingSector();

      expect(sector).toBeDefined();
      expect(sector.type).toBe('Core');
    });

    it('should return a sector with connections', async () => {
      const sector = await getStartingSector();

      const connections = await SectorConnection.count({
        where: { sector_a_id: sector.sector_id }
      });
      expect(connections).toBeGreaterThan(0);
    });
  });
});

