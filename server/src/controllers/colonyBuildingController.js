const colonyBuildingService = require('../services/colonyBuildingService');
const config = require('../config');

const getBuildingTypes = async (req, res, next) => {
  try {
    res.json({ success: true, data: { types: config.buildings } });
  } catch (error) {
    next(error);
  }
};

const getColonyBuildings = async (req, res, next) => {
  try {
    const { colonyId } = req.params;
    const buildings = await colonyBuildingService.getColonyBuildings(colonyId);
    res.json({ success: true, data: { buildings } });
  } catch (error) {
    next(error);
  }
};

const getAvailableBuildings = async (req, res, next) => {
  try {
    const { colonyId } = req.params;
    const available = await colonyBuildingService.getAvailableBuildings(req.user.user_id, colonyId);
    res.json({ success: true, data: { available } });
  } catch (error) {
    next(error);
  }
};

const constructBuilding = async (req, res, next) => {
  try {
    const { colonyId } = req.params;
    const { building_type } = req.body;
    if (!building_type) {
      return res.status(400).json({ success: false, message: 'building_type is required' });
    }
    const building = await colonyBuildingService.constructBuilding(req.user.user_id, colonyId, building_type);
    res.json({ success: true, data: { building } });
  } catch (error) {
    next(error);
  }
};

const upgradeBuilding = async (req, res, next) => {
  try {
    const { buildingId } = req.params;
    const building = await colonyBuildingService.upgradeBuilding(req.user.user_id, buildingId);
    res.json({ success: true, data: { building } });
  } catch (error) {
    next(error);
  }
};

const demolishBuilding = async (req, res, next) => {
  try {
    const { buildingId } = req.params;
    const result = await colonyBuildingService.demolishBuilding(req.user.user_id, buildingId);
    res.json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
};

const toggleBuilding = async (req, res, next) => {
  try {
    const { buildingId } = req.params;
    const { is_active } = req.body;
    if (typeof is_active !== 'boolean') {
      return res.status(400).json({ success: false, message: 'is_active (boolean) is required' });
    }
    const building = await colonyBuildingService.toggleBuilding(req.user.user_id, buildingId, is_active);
    res.json({ success: true, data: { building } });
  } catch (error) {
    next(error);
  }
};

const repairBuilding = async (req, res, next) => {
  try {
    const { buildingId } = req.params;
    const result = await colonyBuildingService.repairBuilding(req.user.user_id, buildingId);
    res.json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getBuildingTypes,
  getColonyBuildings,
  getAvailableBuildings,
  constructBuilding,
  upgradeBuilding,
  demolishBuilding,
  toggleBuilding,
  repairBuilding
};
