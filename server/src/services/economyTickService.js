const { PortCommodity, PriceHistory, Commodity, Port } = require('../models');
const { Op } = require('sequelize');
const { sequelize } = require('../config/database');
const pricingService = require('./pricingService');
const config = require('../config');

/**
 * Process one economy tick: production, consumption, and price snapshots
 */
const processEconomyTick = async () => {
  const transaction = await sequelize.transaction();
  try {
    // Get all port commodities with their commodity data
    const portCommodities = await PortCommodity.findAll({
      include: [{ model: Commodity, as: 'commodity' }, { model: Port, as: 'port' }],
      transaction
    });

    for (const pc of portCommodities) {
      const production = pc.production_rate || 0;
      const consumption = pc.consumption_rate || 0;
      const delta = production - consumption;

      if (delta !== 0) {
        const newQuantity = Math.max(0, Math.min(pc.max_quantity, pc.quantity + delta));
        await pc.update({ quantity: newQuantity }, { transaction });
      }
    }

    await transaction.commit();

    // Record price snapshots (outside transaction for perf)
    await recordPriceSnapshot();
  } catch (err) {
    await transaction.rollback();
    console.error('[EconomyTick] Error:', err.message);
    throw err;
  }
};

/**
 * Record current prices for all port commodities
 */
const recordPriceSnapshot = async () => {
  const portCommodities = await PortCommodity.findAll({
    include: [{ model: Commodity, as: 'commodity' }, { model: Port, as: 'port' }]
  });

  const records = [];
  const now = new Date();

  for (const pc of portCommodities) {
    const commodity = pc.commodity;
    const buyPrice = pricingService.calculateBuyPrice(
      commodity.base_price, pc.quantity, pc.max_quantity, commodity.volatility, pc.buy_price_modifier
    );
    const sellPrice = pricingService.calculateSellPrice(
      commodity.base_price, pc.quantity, pc.max_quantity, commodity.volatility, pc.sell_price_modifier
    );

    records.push({
      port_id: pc.port_id,
      commodity_id: pc.commodity_id,
      buy_price: buyPrice,
      sell_price: sellPrice,
      quantity: pc.quantity,
      recorded_at: now
    });
  }

  if (records.length > 0) {
    await PriceHistory.bulkCreate(records);
  }

  // Prune old records
  const retentionHours = config.economy.priceHistoryRetentionHours;
  const cutoff = new Date(Date.now() - retentionHours * 60 * 60 * 1000);
  await PriceHistory.destroy({ where: { recorded_at: { [Op.lt]: cutoff } } });
};

/**
 * Get price history for a specific commodity at a port
 */
const getPriceHistory = async (portId, commodityId, hours = 24) => {
  const since = new Date(Date.now() - hours * 60 * 60 * 1000);
  return PriceHistory.findAll({
    where: {
      port_id: portId,
      commodity_id: commodityId,
      recorded_at: { [Op.gte]: since }
    },
    order: [['recorded_at', 'ASC']]
  });
};

/**
 * Get price trends for a commodity across all ports
 */
const getPriceTrends = async (commodityId, limit = 10) => {
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000);

  const records = await PriceHistory.findAll({
    where: {
      commodity_id: commodityId,
      recorded_at: { [Op.gte]: since }
    },
    order: [['recorded_at', 'ASC']]
  });

  if (records.length === 0) return { trend: 'stable', avgBuy: 0, avgSell: 0, dataPoints: 0 };

  const totalBuy = records.reduce((sum, r) => sum + r.buy_price, 0);
  const totalSell = records.reduce((sum, r) => sum + r.sell_price, 0);
  const avgBuy = Math.round(totalBuy / records.length);
  const avgSell = Math.round(totalSell / records.length);

  // Compare first half vs second half for trend
  const mid = Math.floor(records.length / 2);
  if (mid === 0) return { trend: 'stable', avgBuy, avgSell, dataPoints: records.length };

  const firstHalf = records.slice(0, mid);
  const secondHalf = records.slice(mid);

  const firstAvg = firstHalf.reduce((s, r) => s + r.sell_price, 0) / firstHalf.length;
  const secondAvg = secondHalf.reduce((s, r) => s + r.sell_price, 0) / secondHalf.length;

  if (firstAvg === 0) return { trend: 'stable', avgBuy, avgSell, dataPoints: records.length };
  const changePct = (secondAvg - firstAvg) / firstAvg;
  let trend = 'stable';
  if (changePct > 0.05) trend = 'rising';
  else if (changePct < -0.05) trend = 'falling';

  return { trend, avgBuy, avgSell, dataPoints: records.length };
};

/**
 * Get market overview for a port
 */
const getMarketOverview = async (portId) => {
  const port = await Port.findByPk(portId);
  if (!port) {
    const error = new Error('Port not found');
    error.statusCode = 404;
    throw error;
  }

  const portCommodities = await PortCommodity.findAll({
    where: { port_id: portId },
    include: [{ model: Commodity, as: 'commodity' }]
  });

  const overview = [];
  for (const pc of portCommodities) {
    const commodity = pc.commodity;
    const buyPrice = pricingService.calculateBuyPrice(
      commodity.base_price, pc.quantity, pc.max_quantity, commodity.volatility, pc.buy_price_modifier
    );
    const sellPrice = pricingService.calculateSellPrice(
      commodity.base_price, pc.quantity, pc.max_quantity, commodity.volatility, pc.sell_price_modifier
    );

    // Get 24h trend for this commodity at this port
    const trend = await getPriceTrends(commodity.commodity_id, 10);

    overview.push({
      commodity_id: commodity.commodity_id,
      name: commodity.name,
      category: commodity.category,
      buy_price: buyPrice,
      sell_price: sellPrice,
      quantity: pc.quantity,
      max_quantity: pc.max_quantity,
      can_buy: pc.can_buy,
      can_sell: pc.can_sell,
      trend: trend.trend
    });
  }

  return { port: { port_id: port.port_id, name: port.name, type: port.type }, commodities: overview };
};

module.exports = {
  processEconomyTick,
  recordPriceSnapshot,
  getPriceHistory,
  getPriceTrends,
  getMarketOverview
};
