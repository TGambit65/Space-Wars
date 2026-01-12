const tradeService = require('../services/tradeService');
const { Commodity, Transaction, Port, PortCommodity, Sector } = require('../models');
const pricingService = require('../services/pricingService');

const getShipCargo = async (req, res, next) => {
  try {
    const { shipId } = req.params;
    const userId = req.user.user_id;
    const cargo = await tradeService.getShipCargo(shipId, userId);
    res.json({
      success: true,
      data: {
        ...cargo
      }
    });
  } catch (error) {
    next(error);
  }
};

const buyCommodity = async (req, res, next) => {
  try {
    const userId = req.user.user_id;
    const { ship_id, port_id, commodity_id, quantity } = req.body;

    const result = await tradeService.buyCommodity(
      userId, ship_id, port_id, commodity_id, quantity
    );

    res.json({
      success: true,
      message: `Successfully purchased ${quantity} units`,
      data: {
        transaction: result
      }
    });
  } catch (error) {
    next(error);
  }
};

const sellCommodity = async (req, res, next) => {
  try {
    const userId = req.user.user_id;
    const { ship_id, port_id, commodity_id, quantity } = req.body;

    const result = await tradeService.sellCommodity(
      userId, ship_id, port_id, commodity_id, quantity
    );

    res.json({
      success: true,
      message: `Successfully sold ${quantity} units`,
      data: {
        transaction: result
      }
    });
  } catch (error) {
    next(error);
  }
};

const refuelShip = async (req, res, next) => {
  try {
    const userId = req.user.user_id;
    const { shipId } = req.params;
    const { port_id, amount } = req.body;

    const result = await tradeService.refuelShip(
      userId, shipId, port_id, amount || null
    );

    res.json({
      success: true,
      message: `Successfully refueled ${result.fuel_purchased} units`,
      data: {
        refuel: result
      }
    });
  } catch (error) {
    next(error);
  }
};

const getAllCommodities = async (req, res, next) => {
  try {
    const commodities = await Commodity.findAll({
      order: [['category', 'ASC'], ['name', 'ASC']]
    });

    res.json({
      success: true,
      data: {
        commodities,
        count: commodities.length
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get transaction history for a user
 */
const getTransactionHistory = async (req, res, next) => {
  try {
    const userId = req.user.user_id;
    const { page = 1, limit = 50, type } = req.query;
    const offset = (page - 1) * limit;

    const whereClause = { user_id: userId };
    if (type) {
      whereClause.transaction_type = type.toUpperCase();
    }

    const { count, rows: transactions } = await Transaction.findAndCountAll({
      where: whereClause,
      include: [
        { model: Port, as: 'port', attributes: ['name', 'type'] },
        { model: Commodity, as: 'commodity', attributes: ['name', 'category'] }
      ],
      order: [['created_at', 'DESC']],
      limit: parseInt(limit),
      offset: parseInt(offset)
    });

    res.json({
      success: true,
      data: {
        transactions,
        pagination: {
          total: count,
          page: parseInt(page),
          limit: parseInt(limit),
          pages: Math.ceil(count / limit)
        }
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get market data - prices for a commodity across all ports
 */
const getMarketData = async (req, res, next) => {
  try {
    const { commodityId } = req.params;

    const commodity = await Commodity.findByPk(commodityId);
    if (!commodity) {
      return res.status(404).json({ success: false, message: 'Commodity not found' });
    }

    const portCommodities = await PortCommodity.findAll({
      where: { commodity_id: commodityId },
      include: [{
        model: Port,
        as: 'port',
        where: { is_active: true },
        include: [{ model: Sector, as: 'sector', attributes: ['sector_id', 'name', 'x_coord', 'y_coord'] }]
      }]
    });

    const marketPrices = portCommodities.map(pc => {
      const buyPrice = pc.can_sell ? pricingService.calculateBuyPrice(
        commodity.base_price, pc.quantity, pc.max_quantity, commodity.volatility, pc.buy_price_modifier
      ) : null;
      const sellPrice = pc.can_buy ? pricingService.calculateSellPrice(
        commodity.base_price, pc.quantity, pc.max_quantity, commodity.volatility, pc.sell_price_modifier
      ) : null;

      return {
        port_id: pc.port.port_id,
        port_name: pc.port.name,
        port_type: pc.port.type,
        sector: pc.port.sector,
        quantity: pc.quantity,
        max_quantity: pc.max_quantity,
        stock_level: pc.quantity / pc.max_quantity,
        can_buy: pc.can_buy,
        can_sell: pc.can_sell,
        buy_price: buyPrice,
        sell_price: sellPrice,
        profit_margin: buyPrice && sellPrice ? sellPrice - buyPrice : null
      };
    });

    // Sort by profit potential
    marketPrices.sort((a, b) => (b.buy_price || 0) - (a.buy_price || 0));

    res.json({
      success: true,
      data: {
        commodity: {
          commodity_id: commodity.commodity_id,
          name: commodity.name,
          category: commodity.category,
          base_price: commodity.base_price,
          is_legal: commodity.is_legal
        },
        market_data: marketPrices
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get overall market summary
 */
const getMarketSummary = async (req, res, next) => {
  try {
    const commodities = await Commodity.findAll({
      include: [{
        model: PortCommodity,
        as: 'portCommodities',
        include: [{ model: Port, as: 'port', where: { is_active: true } }]
      }],
      order: [['category', 'ASC'], ['name', 'ASC']]
    });

    const summary = commodities.map(c => {
      const prices = c.portCommodities.map(pc => {
        const buyPrice = pricingService.calculateBuyPrice(
          c.base_price, pc.quantity, pc.max_quantity, c.volatility, pc.buy_price_modifier
        );
        const sellPrice = pricingService.calculateSellPrice(
          c.base_price, pc.quantity, pc.max_quantity, c.volatility, pc.sell_price_modifier
        );
        return { buyPrice, sellPrice };
      });

      const buyPrices = prices.map(p => p.buyPrice).filter(p => p);
      const sellPrices = prices.map(p => p.sellPrice).filter(p => p);

      return {
        commodity_id: c.commodity_id,
        name: c.name,
        category: c.category,
        base_price: c.base_price,
        is_legal: c.is_legal,
        ports_trading: c.portCommodities.length,
        avg_buy_price: buyPrices.length ? Math.round(buyPrices.reduce((a,b) => a+b, 0) / buyPrices.length) : null,
        avg_sell_price: sellPrices.length ? Math.round(sellPrices.reduce((a,b) => a+b, 0) / sellPrices.length) : null,
        min_buy_price: buyPrices.length ? Math.min(...buyPrices) : null,
        max_buy_price: buyPrices.length ? Math.max(...buyPrices) : null
      };
    });

    res.json({
      success: true,
      data: {
        market_summary: summary
      }
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getShipCargo,
  buyCommodity,
  sellCommodity,
  refuelShip,
  getAllCommodities,
  getTransactionHistory,
  getMarketData,
  getMarketSummary
};

