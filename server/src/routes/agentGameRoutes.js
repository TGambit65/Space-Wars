const express = require('express');
const { agentAuthMiddleware } = require('../middleware/agentAuth');
const { agentAction } = require('../middleware/agentActionProxy');

// Existing game controllers
const shipController = require('../controllers/shipController');
const tradeController = require('../controllers/tradeController');
const sectorController = require('../controllers/sectorController');
const portController = require('../controllers/portController');

const router = express.Router();

// All routes require agent API key authentication
router.use(agentAuthMiddleware);

/**
 * Middleware: inject req.params.shipId from the agent's assigned ship.
 * Most ship/trade controllers read shipId from req.params.
 */
function injectAgentShip(req, res, next) {
  const shipId = req.agent.ship_id;
  if (!shipId) {
    return res.status(400).json({
      success: false,
      message: 'No ship assigned to this agent. Ask your owner to assign a ship.',
    });
  }
  req.params.shipId = shipId;
  next();
}

// ── Navigation ──
router.post('/navigate', agentAction('navigate', 'navigate', {
  getTarget: (req) => req.body.target_sector_id,
}), injectAgentShip, shipController.moveShip);

router.get('/adjacent-sectors', agentAction('navigate', 'scan_adjacent'), injectAgentShip, shipController.getAdjacentSectors);

// ── Ship Status ──
router.get('/ship', agentAction('scan', 'get_ship'), injectAgentShip, shipController.getShipStatus);
router.get('/ship/cargo', agentAction('scan', 'get_cargo'), injectAgentShip, tradeController.getShipCargo);

// ── Sector Info (read-only, uses scan permission) ──
router.get('/sector', agentAction('scan', 'get_sector'), injectAgentShip, async (req, res, next) => {
  // Resolve the agent's current sector from their ship
  const { Ship } = require('../models');
  try {
    const ship = await Ship.findByPk(req.agent.ship_id, { attributes: ['current_sector_id'] });
    if (!ship) {
      return res.status(404).json({ success: false, message: 'Agent ship not found.' });
    }
    req.params.id = ship.current_sector_id;
    next();
  } catch (err) {
    next(err);
  }
}, sectorController.getSectorById);

router.get('/map', agentAction('scan', 'get_map'), sectorController.getMapData);

// ── Trading ──
router.post('/trade/buy', agentAction('trade', 'buy', {
  getTarget: (req) => req.body.commodity_id,
  getCreditsDelta: (req) => -(req.body.quantity || 0),
}), tradeController.buyCommodity);

router.post('/trade/sell', agentAction('trade', 'sell', {
  getTarget: (req) => req.body.commodity_id,
}), tradeController.sellCommodity);

router.post('/trade/refuel', agentAction('trade', 'refuel'), injectAgentShip, tradeController.refuelShip);

router.get('/trade/market', agentAction('scan', 'get_market'), tradeController.getMarketSummary);

// ── Port Info ──
router.get('/port', agentAction('scan', 'get_port'), injectAgentShip, async (req, res, next) => {
  // Resolve the agent's current sector from their ship
  const { Ship } = require('../models');
  try {
    const ship = await Ship.findByPk(req.agent.ship_id, { attributes: ['current_sector_id'] });
    if (!ship) {
      return res.status(404).json({ success: false, message: 'Agent ship not found.' });
    }
    req.params.sectorId = ship.current_sector_id;
    next();
  } catch (err) {
    next(err);
  }
}, portController.getPortsBySector);

// ── Ship Activation ──
router.post('/activate-ship', agentAction('navigate', 'activate_ship', {
  getTarget: (req) => req.body.ship_id,
}), (req, res, next) => {
  // activateShip reads shipId from req.params
  req.params.shipId = req.body.ship_id;
  next();
}, shipController.activateShip);

module.exports = router;
