const factionWarService = require('../services/factionWarService');

/**
 * GET /api/admin/wars
 * All wars, most recent first.
 */
const getWars = async (req, res, next) => {
  try {
    const wars = await factionWarService.getWars();
    res.json({ success: true, data: { wars } });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/admin/wars/active
 * Active wars only.
 */
const getActiveWars = async (req, res, next) => {
  try {
    const wars = await factionWarService.getActiveWars();
    res.json({ success: true, data: { wars } });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/admin/wars/declare
 * Start a war between two factions.
 * Body: { attacker_faction, defender_faction }
 */
const declareWar = async (req, res, next) => {
  try {
    const { attacker_faction, defender_faction } = req.body;
    if (!attacker_faction || !defender_faction) {
      return res.status(400).json({ success: false, message: 'Missing attacker_faction or defender_faction' });
    }
    if (attacker_faction === defender_faction) {
      return res.status(400).json({ success: false, message: 'Cannot declare war on self' });
    }

    const war = await factionWarService.startWar(attacker_faction, defender_faction);
    res.json({ success: true, data: { war } });
  } catch (error) {
    if (error.statusCode) {
      return res.status(error.statusCode).json({ success: false, message: error.message });
    }
    next(error);
  }
};

/**
 * POST /api/admin/wars/:id/resolve
 * Resolve (end) a war.
 */
const resolveWar = async (req, res, next) => {
  try {
    const war = await factionWarService.resolveWar(req.params.id);
    res.json({ success: true, data: { war } });
  } catch (error) {
    if (error.statusCode) {
      return res.status(error.statusCode).json({ success: false, message: error.message });
    }
    next(error);
  }
};

module.exports = {
  getWars,
  getActiveWars,
  declareWar,
  resolveWar
};
