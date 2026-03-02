const express = require('express');
const adminController = require('../controllers/adminController');
const gameSettingsController = require('../controllers/gameSettingsController');
const { authMiddleware, adminMiddleware } = require('../middleware/auth');

const router = express.Router();

// All admin routes require auth + admin
router.use(authMiddleware);
router.use(adminMiddleware);

// Universe
router.post('/universe/generate', adminController.generateUniverse);
router.get('/universe/config', adminController.getUniverseConfig);

// Settings
router.get('/settings', gameSettingsController.getSettings);
router.put('/settings', gameSettingsController.updateSettings);

// AI
router.post('/ai/test', gameSettingsController.testAIConnection);
router.get('/ai/stats', gameSettingsController.getAIStats);
router.get('/ai/logs', gameSettingsController.getAIDecisionLogs);

// NPC Management
router.get('/npcs/stats', gameSettingsController.getNPCPopulation);
router.post('/npcs/respawn', gameSettingsController.forceRespawn);

// Tick System
router.get('/ticks/status', gameSettingsController.getTickStatus);

// User Management
router.get('/users', gameSettingsController.getUserList);
router.put('/users/tier', gameSettingsController.updateUserTier);

module.exports = router;
