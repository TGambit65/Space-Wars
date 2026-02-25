const express = require('express');
const router = express.Router();
const npcController = require('../controllers/npcController');
const { authMiddleware, adminMiddleware } = require('../middleware/auth');

// Apply auth middleware to all routes
router.use(authMiddleware);

// Get NPCs (any authenticated user)
router.get('/sector/:sectorId', npcController.getNPCsInSector);
router.get('/:npcId', npcController.getNPCById);

// Admin endpoints (require admin role)
router.post('/spawn', adminMiddleware, npcController.spawnNPC);
router.post('/respawn', adminMiddleware, npcController.respawnNPCs);

module.exports = router;

