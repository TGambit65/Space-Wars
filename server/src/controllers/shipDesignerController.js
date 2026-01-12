const shipDesignerService = require('../services/shipDesignerService');
const maintenanceService = require('../services/maintenanceService');

/**
 * Get all available components
 */
const getComponents = async (req, res, next) => {
  try {
    const { type } = req.query;
    const components = await shipDesignerService.getAvailableComponents(type);
    res.json({ success: true, components });
  } catch (error) {
    next(error);
  }
};

/**
 * Get ship design with installed components
 */
const getShipDesign = async (req, res, next) => {
  try {
    const userId = req.user.user_id;
    const { shipId } = req.params;
    const design = await shipDesignerService.getShipDesign(shipId, userId);
    res.json({ success: true, design });
  } catch (error) {
    next(error);
  }
};

/**
 * Install component on ship
 */
const installComponent = async (req, res, next) => {
  try {
    const userId = req.user.user_id;
    const { shipId } = req.params;
    const { component_id } = req.body;

    if (!component_id) {
      return res.status(400).json({ success: false, error: 'component_id required' });
    }

    const result = await shipDesignerService.installComponent(userId, shipId, component_id);
    res.json(result);
  } catch (error) {
    next(error);
  }
};

/**
 * Uninstall component from ship
 */
const uninstallComponent = async (req, res, next) => {
  try {
    const userId = req.user.user_id;
    const { shipId, componentId } = req.params;
    const result = await shipDesignerService.uninstallComponent(userId, shipId, componentId);
    res.json(result);
  } catch (error) {
    next(error);
  }
};

/**
 * Get repair estimate for ship
 */
const getRepairEstimate = async (req, res, next) => {
  try {
    const userId = req.user.user_id;
    const { shipId } = req.params;
    const estimate = await maintenanceService.getRepairEstimate(shipId, userId);
    res.json({ success: true, estimate });
  } catch (error) {
    next(error);
  }
};

/**
 * Repair ship hull
 */
const repairHull = async (req, res, next) => {
  try {
    const userId = req.user.user_id;
    const { shipId } = req.params;
    const { port_id } = req.body;

    if (!port_id) {
      return res.status(400).json({ success: false, error: 'port_id required' });
    }

    const result = await maintenanceService.repairHull(userId, shipId, port_id);
    res.json(result);
  } catch (error) {
    next(error);
  }
};

/**
 * Repair component
 */
const repairComponent = async (req, res, next) => {
  try {
    const userId = req.user.user_id;
    const { shipId, componentId } = req.params;
    const { port_id } = req.body;

    if (!port_id) {
      return res.status(400).json({ success: false, error: 'port_id required' });
    }

    const result = await maintenanceService.repairComponent(userId, shipId, componentId, port_id);
    res.json(result);
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getComponents,
  getShipDesign,
  installComponent,
  uninstallComponent,
  getRepairEstimate,
  repairHull,
  repairComponent
};

