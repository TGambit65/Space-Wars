const economyTickService = require('../services/economyTickService');

const getPriceHistory = async (req, res, next) => {
  try {
    const { portId, commodityId } = req.params;
    const hours = parseInt(req.query.hours) || 24;
    const history = await economyTickService.getPriceHistory(portId, commodityId, hours);
    res.json({ success: true, data: { history } });
  } catch (error) {
    next(error);
  }
};

const getPriceTrends = async (req, res, next) => {
  try {
    const { commodityId } = req.params;
    const limit = parseInt(req.query.limit) || 10;
    const trends = await economyTickService.getPriceTrends(commodityId, limit);
    res.json({ success: true, data: trends });
  } catch (error) {
    next(error);
  }
};

const getMarketOverview = async (req, res, next) => {
  try {
    const { portId } = req.params;
    const overview = await economyTickService.getMarketOverview(portId);
    res.json({ success: true, data: overview });
  } catch (error) {
    next(error);
  }
};

module.exports = { getPriceHistory, getPriceTrends, getMarketOverview };
