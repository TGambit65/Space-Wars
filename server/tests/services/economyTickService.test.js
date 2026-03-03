const { cleanDatabase, createTestSector, createTestPort, createTestCommodity, addCommodityToPort } = require('../helpers');
const economyTickService = require('../../src/services/economyTickService');
const { PriceHistory, PortCommodity } = require('../../src/models');

describe('Economy Tick Service', () => {
  let sector, port, commodity, portCommodity;

  beforeEach(async () => {
    await cleanDatabase();
    sector = await createTestSector();
    port = await createTestPort(sector.sector_id);
    commodity = await createTestCommodity({ name: `EconCommodity${Date.now()}` });
    portCommodity = await addCommodityToPort(port.port_id, commodity.commodity_id, {
      quantity: 500,
      max_quantity: 1000,
      production_rate: 10,
      consumption_rate: 5
    });
  });

  describe('processEconomyTick', () => {
    it('should update quantities based on production and consumption rates', async () => {
      await economyTickService.processEconomyTick();

      await portCommodity.reload();
      // production_rate=10, consumption_rate=5, delta=5, so 500+5=505
      expect(portCommodity.quantity).toBe(505);
    });

    it('should clamp quantity to max_quantity', async () => {
      await portCommodity.update({ quantity: 998, production_rate: 10, consumption_rate: 0 });
      await economyTickService.processEconomyTick();

      await portCommodity.reload();
      expect(portCommodity.quantity).toBe(1000);
    });

    it('should clamp quantity to 0 minimum', async () => {
      await portCommodity.update({ quantity: 3, production_rate: 0, consumption_rate: 10 });
      await economyTickService.processEconomyTick();

      await portCommodity.reload();
      expect(portCommodity.quantity).toBe(0);
    });

    it('should record price snapshots', async () => {
      await economyTickService.processEconomyTick();

      const history = await PriceHistory.findAll({
        where: { port_id: port.port_id, commodity_id: commodity.commodity_id }
      });
      expect(history.length).toBeGreaterThan(0);
      expect(history[0].buy_price).toBeGreaterThan(0);
      expect(history[0].sell_price).toBeGreaterThan(0);
    });
  });

  describe('getPriceHistory', () => {
    it('should return price history for a commodity at a port', async () => {
      await economyTickService.recordPriceSnapshot();

      const history = await economyTickService.getPriceHistory(
        port.port_id, commodity.commodity_id, 24
      );
      expect(history.length).toBeGreaterThan(0);
      expect(history[0].port_id).toBe(port.port_id);
    });

    it('should return empty array when no history exists', async () => {
      const history = await economyTickService.getPriceHistory(
        port.port_id, commodity.commodity_id, 1
      );
      expect(history).toEqual([]);
    });
  });

  describe('getPriceTrends', () => {
    it('should return stable trend when only one data point', async () => {
      await economyTickService.recordPriceSnapshot();

      const trends = await economyTickService.getPriceTrends(commodity.commodity_id);
      expect(trends.trend).toBe('stable');
      expect(trends.avgBuy).toBeGreaterThan(0);
      expect(trends.avgSell).toBeGreaterThan(0);
    });

    it('should return stable with no data', async () => {
      const trends = await economyTickService.getPriceTrends(commodity.commodity_id);
      expect(trends.trend).toBe('stable');
      expect(trends.dataPoints).toBe(0);
    });
  });

  describe('getMarketOverview', () => {
    it('should return overview with commodity data and trends', async () => {
      const overview = await economyTickService.getMarketOverview(port.port_id);
      expect(overview.port.port_id).toBe(port.port_id);
      expect(overview.commodities.length).toBeGreaterThan(0);
      expect(overview.commodities[0]).toHaveProperty('buy_price');
      expect(overview.commodities[0]).toHaveProperty('sell_price');
      expect(overview.commodities[0]).toHaveProperty('trend');
    });

    it('should throw for non-existent port', async () => {
      await expect(
        economyTickService.getMarketOverview('00000000-0000-0000-0000-000000000000')
      ).rejects.toThrow('Port not found');
    });
  });
});
