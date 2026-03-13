const fleetService = require('../services/fleetService');

const createFleet = async (req, res, next) => {
  try {
    const { name, ship_ids } = req.body;
    const fleet = await fleetService.createFleet(req.userId, name, ship_ids);
    res.status(201).json({ success: true, data: { fleet } });
  } catch (error) {
    next(error);
  }
};

const getUserFleets = async (req, res, next) => {
  try {
    const fleets = await fleetService.getUserFleets(req.userId);
    res.json({ success: true, data: { fleets } });
  } catch (error) {
    next(error);
  }
};

const getFleet = async (req, res, next) => {
  try {
    const fleet = await fleetService.getFleet(req.params.fleetId, req.userId);
    res.json({ success: true, data: { fleet } });
  } catch (error) {
    next(error);
  }
};

const renameFleet = async (req, res, next) => {
  try {
    const { name } = req.body;
    const fleet = await fleetService.renameFleet(req.params.fleetId, req.userId, name);
    res.json({ success: true, data: { fleet } });
  } catch (error) {
    next(error);
  }
};

const addShips = async (req, res, next) => {
  try {
    const { ship_ids } = req.body;
    const fleet = await fleetService.addShipsToFleet(req.params.fleetId, req.userId, ship_ids);
    res.json({ success: true, data: { fleet } });
  } catch (error) {
    next(error);
  }
};

const removeShips = async (req, res, next) => {
  try {
    const { ship_ids } = req.body;
    const result = await fleetService.removeShipsFromFleet(req.params.fleetId, req.userId, ship_ids);
    res.json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
};

const disbandFleet = async (req, res, next) => {
  try {
    const result = await fleetService.disbandFleet(req.params.fleetId, req.userId);
    res.json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
};

const moveFleet = async (req, res, next) => {
  try {
    const { target_sector_id } = req.body;
    if (!target_sector_id) {
      return res.status(400).json({ success: false, message: 'target_sector_id is required' });
    }
    const result = await fleetService.moveFleet(req.params.fleetId, target_sector_id, req.userId);
    res.json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  createFleet,
  getUserFleets,
  getFleet,
  renameFleet,
  addShips,
  removeShips,
  disbandFleet,
  moveFleet
};
