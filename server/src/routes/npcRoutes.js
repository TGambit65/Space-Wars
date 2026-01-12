const express = require('express');
const router = express.Router();
const npcController = require('../controllers/npcController');
const { authMiddleware } = require('../middleware/auth');

// Apply auth middleware to all routes
router.use(authMiddleware);

// Get NPCs
router.get('/sector/:sectorId', npcController.getNPCsInSector);
router.get('/:npcId', npcController.getNPCById);

// Admin endpoints (could add admin middleware)
router.post('/spawn', npcController.spawnNPC);
router.post('/respawn', npcController.respawnNPCs);

module.exports = router;

