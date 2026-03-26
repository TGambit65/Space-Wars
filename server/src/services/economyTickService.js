const { PortCommodity, PriceHistory, Commodity, Port } = require('../models');
const { Op } = require('sequelize');
const { sequelize } = require('../config/database');
const pricingService = require('./pricingService');
const config = require('../config');

/**
 * Process one economy tick: production, consumption, and price snapshots.
 *
 * PostgreSQL: uses a single batch UPDATE (milliseconds).
 * SQLite: falls back to row-by-row updates (compatible but slower).
 */
const processEconomyTick = async () => {
  const dialect = sequelize.getDialect();

  if (dialect === 'postgres') {
    // ── PostgreSQL batch update: single query, no row-by-row loop ──
    await sequelize.query(`
      UPDATE port_commodities
      SET quantity = LEAST(max_quantity, GREATEST(0, quantity + production_rate - consumption_rate))
      WHERE production_rate != 0 OR consumption_rate != 0
    `);
  } else {
    // ── SQLite: single batch UPDATE (avoids row-by-row lock contention) ──
    await sequelize.query(`
      UPDATE port_commodities
      SET quantity = MIN(max_quantity, MAX(0, quantity + production_rate - consumption_rate))
      WHERE production_rate != 0 OR consumption_rate != 0
    `);
  }

  // Record price snapshots (outside transaction for perf)
  await recordPriceSnapshot();
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
    order: [['recorded_at', 'ASC']],
    limit: limit || 10
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

  // Batch-fetch all price trends for this port's commodities (avoids N+1)
  const commodityIds = portCommodities.map(pc => pc.commodity.commodity_id);
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const allHistory = commodityIds.length > 0 ? await PriceHistory.findAll({
    where: { commodity_id: { [Op.in]: commodityIds }, recorded_at: { [Op.gte]: since } },
    order: [['commodity_id', 'ASC'], ['recorded_at', 'ASC']],
    limit: commodityIds.length * 10
  }) : [];

  // Group by commodity_id and compute trends in-memory
  const historyMap = new Map();
  for (const rec of allHistory) {
    if (!historyMap.has(rec.commodity_id)) historyMap.set(rec.commodity_id, []);
    historyMap.get(rec.commodity_id).push(rec);
  }

  const computeTrend = (records) => {
    if (!records || records.length === 0) return 'stable';
    const mid = Math.floor(records.length / 2);
    if (mid === 0) return 'stable';
    const firstAvg = records.slice(0, mid).reduce((s, r) => s + r.sell_price, 0) / mid;
    const secondAvg = records.slice(mid).reduce((s, r) => s + r.sell_price, 0) / (records.length - mid);
    if (firstAvg === 0) return 'stable';
    const changePct = (secondAvg - firstAvg) / firstAvg;
    if (changePct > 0.05) return 'rising';
    if (changePct < -0.05) return 'falling';
    return 'stable';
  };

  const overview = [];
  for (const pc of portCommodities) {
    const commodity = pc.commodity;
    const buyPrice = pricingService.calculateBuyPrice(
      commodity.base_price, pc.quantity, pc.max_quantity, commodity.volatility, pc.buy_price_modifier
    );
    const sellPrice = pricingService.calculateSellPrice(
      commodity.base_price, pc.quantity, pc.max_quantity, commodity.volatility, pc.sell_price_modifier
    );

    const trend = computeTrend(historyMap.get(commodity.commodity_id));

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
      trend
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
