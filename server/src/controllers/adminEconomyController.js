const economyTickService = require('../services/economyTickService');
const { PortCommodity, Commodity, Port, TransferLedger } = require('../models');
const { Op, fn, col } = require('sequelize');
const pricingService = require('../services/pricingService');

/**
 * GET /api/admin/economy/overview
 * Global market stats: total ports, commodities, avg stock levels, recent tick info.
 */
const getEconomyOverview = async (req, res, next) => {
  try {
    const totalPorts = await Port.count({ where: { is_active: true } });
    const totalCommodities = await Commodity.count();
    const totalPortCommodities = await PortCommodity.count();

    // Average stock level across all port commodities
    const stockStats = await PortCommodity.findOne({
      attributes: [
        [fn('AVG', col('quantity')), 'avg_quantity'],
        [fn('AVG', col('max_quantity')), 'avg_max_quantity'],
        [fn('SUM', col('quantity')), 'total_stock'],
        [fn('SUM', col('max_quantity')), 'total_capacity']
      ],
      raw: true
    });

    // Recent transfer counts
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const recentTransfers = await TransferLedger.count({
      where: { created_at: { [Op.gte]: oneDayAgo } }
    });
    const flaggedTransfers = await TransferLedger.count({
      where: {
        created_at: { [Op.gte]: oneDayAgo },
        risk_flags: { [Op.ne]: '[]' }
      }
    });

    res.json({
      success: true,
      data: {
        ports: totalPorts,
        commodities: totalCommodities,
        portCommodities: totalPortCommodities,
        avgStockLevel: stockStats.avg_quantity ? Math.round(stockStats.avg_quantity) : 0,
        avgMaxStock: stockStats.avg_max_quantity ? Math.round(stockStats.avg_max_quantity) : 0,
        totalStock: stockStats.total_stock || 0,
        totalCapacity: stockStats.total_capacity || 0,
        recentTransfers24h: recentTransfers,
        flaggedTransfers24h: flaggedTransfers
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/admin/economy/transfers
 * Paginated TransferLedger with optional filters.
 * Query: ?page=1&limit=25&user_id=&transfer_type=&flagged_only=true
 */
const getTransfers = async (req, res, next) => {
  try {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 25));
    const offset = (page - 1) * limit;

    const where = {};
    if (req.query.user_id) {
      where[Op.or] = [
        { source_id: req.query.user_id, source_type: 'user' },
        { destination_id: req.query.user_id, destination_type: 'user' }
      ];
    }
    if (req.query.transfer_type) {
      where.transfer_type = req.query.transfer_type;
    }
    if (req.query.flagged_only === 'true') {
      where.risk_flags = { [Op.ne]: '[]' };
    }

    const { count, rows } = await TransferLedger.findAndCountAll({
      where,
      order: [['created_at', 'DESC']],
      limit,
      offset
    });

    res.json({
      success: true,
      data: {
        transfers: rows,
        total: count,
        page,
        pages: Math.ceil(count / limit)
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/admin/economy/force-tick
 * Trigger an economy tick immediately.
 */
const forceEconomyTick = async (req, res, next) => {
  try {
    await economyTickService.processEconomyTick();
    res.json({ success: true, message: 'Economy tick processed' });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/admin/economy/reset-stocks
 * Reset all port commodity quantities to max_quantity / 2.
 */
const resetPortStocks = async (req, res, next) => {
  try {
    const portCommodities = await PortCommodity.findAll();
    let updated = 0;

    for (const pc of portCommodities) {
      const resetQty = Math.floor(pc.max_quantity / 2);
      await pc.update({ quantity: resetQty });
      updated++;
    }

    res.json({ success: true, message: `Reset ${updated} port commodity stocks`, data: { updated } });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getEconomyOverview,
  getTransfers,
  forceEconomyTick,
  resetPortStocks
};
