/**
 * Controller for ground combat endpoints.
 */
const groundCombatService = require('../services/groundCombatService');

const trainUnit = async (req, res) => {
  try {
    const { colony_id, unit_type } = req.body;
    if (!colony_id || !unit_type) {
      return res.status(400).json({ success: false, data: null, message: 'colony_id and unit_type are required' });
    }
    const result = await groundCombatService.trainUnit(colony_id, req.userId, unit_type);
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(error.statusCode || 500).json({ success: false, data: null, message: error.message });
  }
};

const getGarrison = async (req, res) => {
  try {
    const { colonyId } = req.params;
    const result = await groundCombatService.getGarrison(colonyId, req.userId);
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(error.statusCode || 500).json({ success: false, data: null, message: error.message });
  }
};

const setDefensePolicy = async (req, res) => {
  try {
    const { colonyId } = req.params;
    const { policy } = req.body;
    if (!policy) {
      return res.status(400).json({ success: false, data: null, message: 'policy is required' });
    }
    const result = await groundCombatService.setDefensePolicy(colonyId, req.userId, policy);
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(error.statusCode || 500).json({ success: false, data: null, message: error.message });
  }
};

const disbandUnit = async (req, res) => {
  try {
    const { colonyId } = req.params;
    const { unit_id } = req.body;
    if (!unit_id) {
      return res.status(400).json({ success: false, data: null, message: 'unit_id is required' });
    }
    const result = await groundCombatService.disbandUnit(colonyId, req.userId, unit_id);
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(error.statusCode || 500).json({ success: false, data: null, message: error.message });
  }
};

const initiateInvasion = async (req, res) => {
  try {
    const { colony_id, ship_id, unit_ids } = req.body;
    if (!colony_id) {
      return res.status(400).json({ success: false, data: null, message: 'colony_id is required' });
    }
    const result = await groundCombatService.initiateInvasion(req.userId, colony_id, ship_id, unit_ids);
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(error.statusCode || 500).json({ success: false, data: null, message: error.message });
  }
};

const processCombatTurn = async (req, res) => {
  try {
    const { instanceId } = req.params;
    const { orders } = req.body;
    if (!Array.isArray(orders)) {
      return res.status(400).json({ success: false, data: null, message: 'orders array is required' });
    }
    const result = await groundCombatService.processCombatTurn(instanceId, req.userId, orders);
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(error.statusCode || 500).json({ success: false, data: null, message: error.message });
  }
};

const getCombatState = async (req, res) => {
  try {
    const { instanceId } = req.params;
    const result = await groundCombatService.getCombatState(instanceId, req.userId);
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(error.statusCode || 500).json({ success: false, data: null, message: error.message });
  }
};

const retreat = async (req, res) => {
  try {
    const { instanceId } = req.params;
    const result = await groundCombatService.retreat(instanceId, req.userId);
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(error.statusCode || 500).json({ success: false, data: null, message: error.message });
  }
};

const getCombatHistory = async (req, res) => {
  try {
    const { colonyId } = req.params;
    const result = await groundCombatService.getCombatHistory(colonyId, req.userId);
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(error.statusCode || 500).json({ success: false, data: null, message: error.message });
  }
};

module.exports = {
  trainUnit,
  getGarrison,
  setDefensePolicy,
  disbandUnit,
  initiateInvasion,
  processCombatTurn,
  getCombatState,
  retreat,
  getCombatHistory
};
