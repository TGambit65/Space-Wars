/**
 * Port Service Tests
 */
const portService = require('../../src/services/portService');
const { Port, Commodity, PortCommodity, Sector } = require('../../src/models');
const { createTestSector, createTestPort, createTestCommodity, addCommodityToPort, cleanDatabase } = require('../helpers');

describe('Port Service', () => {
  let testSector, testPort, testCommodity;

  beforeAll(async () => {
    await cleanDatabase();
    
    // Create test sector and port
    testSector = await createTestSector({ name: 'Port Test Sector' });
    testPort = await createTestPort(testSector.sector_id, {
      name: 'Test Trading Hub',
      type: 'Trading Hub',
      tax_rate: 0.05
    });
    
    // Create test commodity and add to port
    testCommodity = await createTestCommodity({ name: 'Test Fuel', base_price: 50 });
    await addCommodityToPort(testPort.port_id, testCommodity.commodity_id, {
      quantity: 500,
      max_quantity: 1000,
      can_buy: true,
      can_sell: true
    });
  });

  afterAll(async () => {
    await cleanDatabase();
  });

  describe('getPortById', () => {
    it('should return port details', async () => {
      const port = await portService.getPortById(testPort.port_id);

      expect(port).toBeDefined();
      expect(port.name).toBe('Test Trading Hub');
      expect(port.type).toBe('Trading Hub');
    });

    it('should include sector information', async () => {
      const port = await portService.getPortById(testPort.port_id);

      expect(port.sector).toBeDefined();
      expect(port.sector.name).toBe('Port Test Sector');
    });

    it('should throw error for non-existent port', async () => {
      await expect(portService.getPortById('00000000-0000-0000-0000-000000000000'))
        .rejects.toThrow('Port not found');
    });

    it('should include port commodities', async () => {
      const port = await portService.getPortById(testPort.port_id);

      expect(port.portCommodities).toBeDefined();
      expect(Array.isArray(port.portCommodities)).toBe(true);
    });
  });

  describe('getPortWithPrices', () => {
    it('should return port with commodities list', async () => {
      const result = await portService.getPortWithPrices(testPort.port_id);

      expect(Array.isArray(result.commodities)).toBe(true);
      expect(result.commodities.length).toBeGreaterThan(0);
    });

    it('should include price information for each commodity', async () => {
      const result = await portService.getPortWithPrices(testPort.port_id);

      result.commodities.forEach(c => {
        expect(c).toHaveProperty('buy_price');
        expect(c).toHaveProperty('sell_price');
        expect(c).toHaveProperty('quantity');
      });
    });

    it('should include commodity details', async () => {
      const result = await portService.getPortWithPrices(testPort.port_id);

      const fuel = result.commodities.find(c => c.name === 'Test Fuel');
      expect(fuel).toBeDefined();
      expect(fuel.base_price).toBe(50);
    });
  });

  describe('getPortsBySector', () => {
    it('should return ports in the sector', async () => {
      const ports = await portService.getPortsBySector(testSector.sector_id);

      expect(Array.isArray(ports)).toBe(true);
      expect(ports.length).toBeGreaterThan(0);
      expect(ports[0].port_id).toBeDefined();
    });

    it('should include port type info', async () => {
      const ports = await portService.getPortsBySector(testSector.sector_id);

      ports.forEach(port => {
        expect(port).toHaveProperty('type');
        expect(port).toHaveProperty('commodity_count');
      });
    });

    it('should return empty array for sector with no ports', async () => {
      const emptySector = await createTestSector({ name: 'Empty Sector' });
      const ports = await portService.getPortsBySector(emptySector.sector_id);

      expect(ports).toEqual([]);
    });
  });

  describe('getPortWithPrices advanced', () => {
    it('should return port with port_id and name', async () => {
      const result = await portService.getPortWithPrices(testPort.port_id);

      expect(result).toHaveProperty('port_id');
      expect(result).toHaveProperty('name');
      expect(result).toHaveProperty('commodities');
    });

    it('should calculate dynamic prices', async () => {
      const result = await portService.getPortWithPrices(testPort.port_id);

      result.commodities.forEach(c => {
        if (c.can_buy) expect(c.sell_price).toBeGreaterThan(0);
        if (c.can_sell) expect(c.buy_price).toBeGreaterThan(0);
      });
    });
  });

  describe('updatePortCommodityQuantity', () => {
    let stockPort, stockCommodity;

    beforeEach(async () => {
      stockPort = await createTestPort(testSector.sector_id, { name: 'Stock Test Port' });
      stockCommodity = await createTestCommodity({ name: `Stock${Date.now()}` });
      await addCommodityToPort(stockPort.port_id, stockCommodity.commodity_id, {
        quantity: 500,
        max_quantity: 1000
      });
    });

    it('should update commodity quantity', async () => {
      await portService.updatePortCommodityQuantity(stockPort.port_id, stockCommodity.commodity_id, -100);

      const pc = await PortCommodity.findOne({
        where: { port_id: stockPort.port_id, commodity_id: stockCommodity.commodity_id }
      });
      expect(pc.quantity).toBe(400);
    });

    it('should not go below zero', async () => {
      await portService.updatePortCommodityQuantity(stockPort.port_id, stockCommodity.commodity_id, -1000);

      const pc = await PortCommodity.findOne({
        where: { port_id: stockPort.port_id, commodity_id: stockCommodity.commodity_id }
      });
      expect(pc.quantity).toBe(0);
    });

    it('should not exceed max quantity', async () => {
      await portService.updatePortCommodityQuantity(stockPort.port_id, stockCommodity.commodity_id, 1000);

      const pc = await PortCommodity.findOne({
        where: { port_id: stockPort.port_id, commodity_id: stockCommodity.commodity_id }
      });
      expect(pc.quantity).toBe(1000);
    });
  });
});

