const automationService = require('../services/automationService');

const createTradeRoute = async (req, res, next) => {
  try {
    const { ship_id, waypoints } = req.body;
    if (!ship_id || !waypoints || !Array.isArray(waypoints)) {
      return res.status(400).json({ success: false, message: 'ship_id and waypoints array are required' });
    }
    const task = await automationService.createTradeRoute(req.user.user_id, ship_id, waypoints);
    res.status(201).json({ success: true, data: { task } });
  } catch (error) {
    next(error);
  }
};

const createMiningRun = async (req, res, next) => {
  try {
    const { ship_id, colony_id, return_port_id } = req.body;
    if (!ship_id || !colony_id || !return_port_id) {
      return res.status(400).json({ success: false, message: 'ship_id, colony_id, and return_port_id are required' });
    }
    const task = await automationService.createMiningRun(req.user.user_id, ship_id, colony_id, return_port_id);
    res.status(201).json({ success: true, data: { task } });
  } catch (error) {
    next(error);
  }
};

const getTasks = async (req, res, next) => {
  try {
    const tasks = await automationService.getActiveTasks(req.user.user_id);
    res.json({ success: true, data: { tasks } });
  } catch (error) {
    next(error);
  }
};

const pauseTask = async (req, res, next) => {
  try {
    const task = await automationService.pauseTask(req.user.user_id, req.params.taskId);
    res.json({ success: true, data: { task } });
  } catch (error) {
    next(error);
  }
};

const resumeTask = async (req, res, next) => {
  try {
    const task = await automationService.resumeTask(req.user.user_id, req.params.taskId);
    res.json({ success: true, data: { task } });
  } catch (error) {
    next(error);
  }
};

const cancelTask = async (req, res, next) => {
  try {
    const task = await automationService.cancelTask(req.user.user_id, req.params.taskId);
    res.json({ success: true, data: { task } });
  } catch (error) {
    next(error);
  }
};

module.exports = { createTradeRoute, createMiningRun, getTasks, pauseTask, resumeTask, cancelTask };
