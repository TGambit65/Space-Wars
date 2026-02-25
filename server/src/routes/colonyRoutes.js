const express = require('express');
const router = express.Router();
const colonyController = require('../controllers/colonyController');
const { authMiddleware } = require('../middleware/auth');

// Apply auth middleware to all routes
router.use(authMiddleware);

// Get all colonies for current user
router.get('/', colonyController.getUserColonies);

// Get colony details
router.get('/:colonyId', colonyController.getColonyDetails);

// Colonize a planet
router.post('/:planetId/colonize', colonyController.colonizePlanet);

// Collect resources from colony
router.post('/:colonyId/collect', colonyController.collectResources);

// Upgrade colony infrastructure
router.post('/:colonyId/upgrade', colonyController.upgradeInfrastructure);

// Abandon colony
router.delete('/:colonyId', colonyController.abandonColony);

module.exports = router;

