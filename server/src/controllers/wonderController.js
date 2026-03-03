const wonderService = require('../services/wonderService');
const config = require('../config');

const getWonderTypes = async (req, res, next) => {
  try {
    res.json({ success: true, data: { types: config.wonders } });
  } catch (error) {
    next(error);
  }
};

const getColonyWonders = async (req, res, next) => {
  try {
    const { colonyId } = req.params;
    const wonders = await wonderService.getColonyWonders(colonyId);
    res.json({ success: true, data: { wonders } });
  } catch (error) {
    next(error);
  }
};

const startConstruction = async (req, res, next) => {
  try {
    const { colonyId } = req.params;
    const { wonder_type } = req.body;
    if (!wonder_type) {
      return res.status(400).json({ success: false, message: 'wonder_type is required' });
    }
    const wonder = await wonderService.startWonderConstruction(req.user.user_id, colonyId, wonder_type);
    res.json({ success: true, data: { wonder } });
  } catch (error) {
    next(error);
  }
};

const advancePhase = async (req, res, next) => {
  try {
    const { wonderId } = req.params;
    const wonder = await wonderService.advanceWonderPhase(req.user.user_id, wonderId);
    res.json({ success: true, data: { wonder } });
  } catch (error) {
    next(error);
  }
};

module.exports = { getWonderTypes, getColonyWonders, startConstruction, advancePhase };
