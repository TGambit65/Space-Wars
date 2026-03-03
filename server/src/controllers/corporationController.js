const corporationService = require('../services/corporationService');

const create = async (req, res, next) => {
  try {
    const { name, tag, description } = req.body;
    if (!name || !tag) {
      return res.status(400).json({ success: false, message: 'name and tag are required' });
    }
    const corp = await corporationService.createCorporation(req.user.user_id, name, tag, description);
    res.status(201).json({ success: true, data: { corporation: corp } });
  } catch (error) {
    next(error);
  }
};

const getMine = async (req, res, next) => {
  try {
    const corp = await corporationService.getCorporationByUser(req.user.user_id);
    res.json({ success: true, data: { corporation: corp } });
  } catch (error) {
    next(error);
  }
};

const getById = async (req, res, next) => {
  try {
    const corp = await corporationService.getCorporation(req.params.id);
    res.json({ success: true, data: { corporation: corp } });
  } catch (error) {
    next(error);
  }
};

const join = async (req, res, next) => {
  try {
    const corp = await corporationService.joinCorporation(req.user.user_id, req.params.id);
    res.json({ success: true, data: { corporation: corp } });
  } catch (error) {
    next(error);
  }
};

const leave = async (req, res, next) => {
  try {
    await corporationService.leaveCorporation(req.user.user_id);
    res.json({ success: true, message: 'Left corporation' });
  } catch (error) {
    next(error);
  }
};

const promote = async (req, res, next) => {
  try {
    const { userId } = req.params;
    const { role } = req.body;
    if (!role) {
      return res.status(400).json({ success: false, message: 'role is required' });
    }
    const member = await corporationService.promoteMember(req.user.user_id, userId, role);
    res.json({ success: true, data: { member } });
  } catch (error) {
    next(error);
  }
};

const transfer = async (req, res, next) => {
  try {
    await corporationService.transferLeadership(req.user.user_id, req.params.userId);
    res.json({ success: true, message: 'Leadership transferred' });
  } catch (error) {
    next(error);
  }
};

const disband = async (req, res, next) => {
  try {
    await corporationService.disbandCorporation(req.user.user_id);
    res.json({ success: true, message: 'Corporation disbanded' });
  } catch (error) {
    next(error);
  }
};

const contribute = async (req, res, next) => {
  try {
    const { amount } = req.body;
    if (!amount || typeof amount !== 'number' || amount <= 0) {
      return res.status(400).json({ success: false, message: 'amount must be a positive number' });
    }
    const result = await corporationService.contributeToTreasury(req.user.user_id, amount);
    res.json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
};

const withdraw = async (req, res, next) => {
  try {
    const { amount } = req.body;
    if (!amount || typeof amount !== 'number' || amount <= 0) {
      return res.status(400).json({ success: false, message: 'amount must be a positive number' });
    }
    const result = await corporationService.withdrawFromTreasury(req.user.user_id, amount);
    res.json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
};

const leaderboard = async (req, res, next) => {
  try {
    const limit = parseInt(req.query.limit) || 10;
    const corps = await corporationService.getCorporationLeaderboard(limit);
    res.json({ success: true, data: { corporations: corps } });
  } catch (error) {
    next(error);
  }
};

module.exports = { create, getMine, getById, join, leave, promote, transfer, disband, contribute, withdraw, leaderboard };
