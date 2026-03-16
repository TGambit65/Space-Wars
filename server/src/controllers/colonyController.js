const colonyService = require('../services/colonyService');

/**
 * POST /api/colonies/:planetId/colonize
 * Colonize a planet
 */
const colonizePlanet = async (req, res, next) => {
  try {
    const { planetId } = req.params;
    const { ship_id, colony_name } = req.body;
    const userId = req.user.user_id;

    if (!ship_id) {
      return res.status(400).json({ error: 'ship_id is required' });
    }

    const result = await colonyService.colonizePlanet(planetId, userId, ship_id, colony_name);
    res.status(201).json({
      message: 'Colony established successfully',
      ...result
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/colonies
 * Get all colonies for the current user
 */
const getUserColonies = async (req, res, next) => {
  try {
    const userId = req.user.user_id;
    const colonies = await colonyService.getUserColonies(userId);
    res.json(colonies);
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/colonies/:colonyId
 * Get colony details
 */
const getColonyDetails = async (req, res, next) => {
  try {
    const { colonyId } = req.params;
    const userId = req.user.user_id;

    const colony = await colonyService.getColonyDetails(colonyId, userId);
    res.json(colony);
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/colonies/:colonyId/collect
 * Collect generated resources from a colony
 * If ship_id is provided, resources are transferred to that ship's cargo
 */
const collectResources = async (req, res, next) => {
  try {
    const { colonyId } = req.params;
    const { ship_id } = req.body;
    const userId = req.user.user_id;

    const result = await colonyService.processResourceGeneration(colonyId, userId, ship_id);
    res.json(result);
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/colonies/:colonyId/upgrade
 * Upgrade colony infrastructure
 */
const upgradeInfrastructure = async (req, res, next) => {
  try {
    const { colonyId } = req.params;
    const userId = req.user.user_id;

    const result = await colonyService.upgradeInfrastructure(colonyId, userId);
    res.json({
      message: 'Infrastructure upgraded successfully',
      ...result
    });
  } catch (error) {
    next(error);
  }
};

/**
 * DELETE /api/colonies/:colonyId
 * Abandon a colony
 */
const abandonColony = async (req, res, next) => {
  try {
    const { colonyId } = req.params;
    const userId = req.user.user_id;

    const result = await colonyService.abandonColony(colonyId, userId);
    res.json(result);
  } catch (error) {
    next(error);
  }
};

const getRecentRaids = async (req, res) => {
  try {
    const colonyRaidService = require('../services/colonyRaidService');
    const raids = await colonyRaidService.getRecentRaids(req.userId);
    res.json({ success: true, data: raids });
  } catch (error) {
    res.status(error.statusCode || 500).json({ success: false, message: error.message });
  }
};

module.exports = {
  colonizePlanet,
  getUserColonies,
  getColonyDetails,
  collectResources,
  upgradeInfrastructure,
  abandonColony,
  getRecentRaids
};

