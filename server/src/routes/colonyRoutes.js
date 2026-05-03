const express = require('express');
const router = express.Router();
const colonyController = require('../controllers/colonyController');
const colonySurfaceController = require('../controllers/colonySurfaceController');
const customBlockController = require('../controllers/customBlockController');
const { authMiddleware, optionalAuth } = require('../middleware/auth');

// Public endpoints (no auth required)
router.get('/leaderboard', colonySurfaceController.getLeaderboard);
router.get('/:colonyId/surface/public', colonySurfaceController.getPublicSurface);

// Apply auth middleware to all routes below
router.use(authMiddleware);

// Get all colonies for current user
router.get('/', colonyController.getUserColonies);

// Get recent raids for current user's colonies
router.get('/raids', colonyController.getRecentRaids);

// ============== Daily Quest Endpoints ==============
// Get today's daily quests
router.get('/daily-quests', colonySurfaceController.getDailyQuests);
// Claim a completed daily quest
router.post('/daily-quests/:questId/claim', colonySurfaceController.claimDailyQuest);

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

// ============== Colony Surface Endpoints ==============
// GET surface data (terrain, buildings, anomalies, deposits)
router.get('/:colonyId/surface', colonySurfaceController.getSurface);
// Initialize surface for legacy colonies (auto-place buildings)
router.post('/:colonyId/surface/initialize', colonySurfaceController.initializeSurface);
// Place a building on the surface grid
router.post('/:colonyId/surface/place', colonySurfaceController.placeBuilding);
// Move a building to a new position
router.post('/:colonyId/surface/move', colonySurfaceController.moveBuilding);
// Undo a recent placement (within 10s window)
router.post('/:colonyId/surface/undo', colonySurfaceController.undoPlacement);
// Claim a surface anomaly
router.post('/:colonyId/surface/anomaly', colonySurfaceController.claimAnomaly);
// Repair damaged buildings
router.post('/:colonyId/surface/repair', colonySurfaceController.repairBuildings);

// ============== Custom Block Endpoints ==============
// Get all blocks for a colony
router.get('/:colonyId/blocks', customBlockController.getBlocks);
// Place block(s) — single or bulk via { blocks: [...] }
router.post('/:colonyId/blocks', customBlockController.placeBlock);
// Remove block(s) — single via { block_id } or bulk via { block_ids: [...] }
router.delete('/:colonyId/blocks', customBlockController.removeBlock);

// ============== Voxel Block Endpoints ==============

module.exports = router;

