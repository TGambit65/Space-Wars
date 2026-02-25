const planetService = require('../services/planetService');

/**
 * GET /api/planets/scan/:sectorId
 * Scan a sector to discover planets
 */
const scanSector = async (req, res, next) => {
  try {
    const { sectorId } = req.params;
    const { ship_id } = req.query;
    const userId = req.user.user_id;

    const result = await planetService.scanSector(sectorId, userId, ship_id);
    res.json(result);
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/planets/:planetId
 * Get detailed planet information
 */
const getPlanetDetails = async (req, res, next) => {
  try {
    const { planetId } = req.params;
    const { ship_id } = req.query;
    const userId = req.user.user_id;

    const planet = await planetService.getPlanetDetails(planetId, userId, ship_id);
    res.json(planet);
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/planets/user/owned
 * Get all planets owned by the current user
 */
const getUserPlanets = async (req, res, next) => {
  try {
    const userId = req.user.user_id;
    const planets = await planetService.getUserPlanets(userId);
    res.json(planets);
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/planets/user/artifacts
 * Get all artifacts discovered by the current user
 */
const getUserArtifacts = async (req, res, next) => {
  try {
    const userId = req.user.user_id;
    const artifacts = await planetService.getUserArtifacts(userId);
    res.json(artifacts);
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/planets/artifacts/:artifactId/claim
 * Claim an artifact from a planet the user owns
 */
const claimArtifact = async (req, res, next) => {
  try {
    const { artifactId } = req.params;
    const userId = req.user.user_id;

    const artifact = await planetService.claimArtifact(artifactId, userId);
    res.json({
      message: 'Artifact claimed successfully',
      artifact
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  scanSector,
  getPlanetDetails,
  getUserPlanets,
  getUserArtifacts,
  claimArtifact
};

