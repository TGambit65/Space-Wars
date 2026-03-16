/**
 * Controller for colony surface endpoints.
 * Handles request validation, delegates to colonySurfaceService.
 */
const colonySurfaceService = require('../services/colonySurfaceService');
const dailyQuestService = require('../services/dailyQuestService');

const getSurface = async (req, res) => {
  try {
    const { colonyId } = req.params;
    const result = await colonySurfaceService.getSurface(colonyId, req.userId);
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(error.statusCode || 500).json({ success: false, data: null, message: error.message });
  }
};

const initializeSurface = async (req, res) => {
  try {
    const { colonyId } = req.params;
    const result = await colonySurfaceService.initializeSurface(colonyId, req.userId);
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(error.statusCode || 500).json({ success: false, data: null, message: error.message });
  }
};

const placeBuilding = async (req, res) => {
  try {
    const { colonyId } = req.params;
    const { building_type, grid_x, grid_y } = req.body;

    if (!building_type || grid_x === undefined || grid_y === undefined) {
      return res.status(400).json({ success: false, data: null, message: 'building_type, grid_x, and grid_y are required' });
    }
    if (!Number.isInteger(grid_x) || !Number.isInteger(grid_y) || grid_x < 0 || grid_y < 0) {
      return res.status(400).json({ success: false, data: null, message: 'grid_x and grid_y must be non-negative integers' });
    }

    const result = await colonySurfaceService.placeBuilding(colonyId, req.userId, building_type, grid_x, grid_y);
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(error.statusCode || 500).json({ success: false, data: null, message: error.message });
  }
};

const moveBuilding = async (req, res) => {
  try {
    const { colonyId } = req.params;
    const { building_id, grid_x, grid_y } = req.body;

    if (!building_id || grid_x === undefined || grid_y === undefined) {
      return res.status(400).json({ success: false, data: null, message: 'building_id, grid_x, and grid_y are required' });
    }
    if (!Number.isInteger(grid_x) || !Number.isInteger(grid_y) || grid_x < 0 || grid_y < 0) {
      return res.status(400).json({ success: false, data: null, message: 'grid_x and grid_y must be non-negative integers' });
    }

    const result = await colonySurfaceService.moveBuilding(colonyId, req.userId, building_id, grid_x, grid_y);
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(error.statusCode || 500).json({ success: false, data: null, message: error.message });
  }
};

const undoPlacement = async (req, res) => {
  try {
    const { colonyId } = req.params;
    const { building_id } = req.body;

    if (!building_id) {
      return res.status(400).json({ success: false, data: null, message: 'building_id is required' });
    }

    const result = await colonySurfaceService.undoPlacement(colonyId, req.userId, building_id);
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(error.statusCode || 500).json({ success: false, data: null, message: error.message });
  }
};

const claimAnomaly = async (req, res) => {
  try {
    const { colonyId } = req.params;
    const { anomaly_id } = req.body;

    if (!anomaly_id) {
      return res.status(400).json({ success: false, data: null, message: 'anomaly_id is required' });
    }

    const result = await colonySurfaceService.claimAnomaly(colonyId, req.userId, anomaly_id);
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(error.statusCode || 500).json({ success: false, data: null, message: error.message });
  }
};

const repairBuildings = async (req, res) => {
  try {
    const { colonyId } = req.params;
    const { building_ids, all } = req.body;

    if (!all && (!building_ids || !Array.isArray(building_ids) || building_ids.length === 0)) {
      return res.status(400).json({ success: false, data: null, message: 'Specify building_ids array or all: true' });
    }

    const result = await colonySurfaceService.repairBuildings(colonyId, req.userId, { building_ids, all });
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(error.statusCode || 500).json({ success: false, data: null, message: error.message });
  }
};

const getPublicSurface = async (req, res) => {
  try {
    const { colonyId } = req.params;
    const result = await colonySurfaceService.getPublicSurface(colonyId);
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(error.statusCode || 500).json({ success: false, data: null, message: error.message });
  }
};

const getLeaderboard = async (req, res) => {
  try {
    const sortBy = req.query.sortBy || 'production';
    const limit = parseInt(req.query.limit) || 20;
    const result = await colonySurfaceService.getLeaderboard(sortBy, limit);
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(error.statusCode || 500).json({ success: false, data: null, message: error.message });
  }
};

const getDailyQuests = async (req, res) => {
  try {
    const result = await dailyQuestService.getDailyQuests(req.userId);
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(error.statusCode || 500).json({ success: false, data: null, message: error.message });
  }
};

const claimDailyQuest = async (req, res) => {
  try {
    const { questId } = req.params;
    const result = await dailyQuestService.claimQuest(req.userId, questId);
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(error.statusCode || 500).json({ success: false, data: null, message: error.message });
  }
};

module.exports = {
  getSurface,
  initializeSurface,
  placeBuilding,
  moveBuilding,
  undoPlacement,
  claimAnomaly,
  repairBuildings,
  getPublicSurface,
  getLeaderboard,
  getDailyQuests,
  claimDailyQuest
};
