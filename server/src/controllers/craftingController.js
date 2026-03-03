const craftingService = require('../services/craftingService');

const getBlueprints = async (req, res, next) => {
  try {
    const blueprints = await craftingService.getAvailableBlueprints(req.user.user_id);
    res.json({ success: true, data: { blueprints } });
  } catch (error) {
    next(error);
  }
};

const startCrafting = async (req, res, next) => {
  try {
    const { blueprint_id, ship_id } = req.body;
    if (!blueprint_id || !ship_id) {
      return res.status(400).json({ success: false, message: 'blueprint_id and ship_id are required' });
    }
    const job = await craftingService.startCrafting(req.user.user_id, blueprint_id, ship_id);
    res.json({ success: true, data: { job } });
  } catch (error) {
    next(error);
  }
};

const cancelCrafting = async (req, res, next) => {
  try {
    const { jobId } = req.params;
    const job = await craftingService.cancelCrafting(req.user.user_id, jobId);
    res.json({ success: true, data: { job } });
  } catch (error) {
    next(error);
  }
};

const completeCrafting = async (req, res, next) => {
  try {
    const { jobId } = req.params;
    const job = await craftingService.completeCrafting(req.user.user_id, jobId);
    res.json({ success: true, data: { job } });
  } catch (error) {
    next(error);
  }
};

const checkCompleted = async (req, res, next) => {
  try {
    const completed = await craftingService.checkCompletedJobs(req.user.user_id);
    res.json({ success: true, data: { completed } });
  } catch (error) {
    next(error);
  }
};

const getJobs = async (req, res, next) => {
  try {
    const jobs = await craftingService.getActiveJobs(req.user.user_id);
    res.json({ success: true, data: { jobs } });
  } catch (error) {
    next(error);
  }
};

module.exports = { getBlueprints, startCrafting, cancelCrafting, completeCrafting, checkCompleted, getJobs };
