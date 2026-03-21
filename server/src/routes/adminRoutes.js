const express = require('express');
const adminController = require('../controllers/adminController');
const gameSettingsController = require('../controllers/gameSettingsController');
const adminServerController = require('../controllers/adminServerController');
const adminEconomyController = require('../controllers/adminEconomyController');
const adminWarController = require('../controllers/adminWarController');
const adminEventController = require('../controllers/adminEventController');
const { authMiddleware, adminMiddleware } = require('../middleware/auth');

const router = express.Router();

// All admin routes require auth + admin
router.use(authMiddleware);
router.use(adminMiddleware);

// Universe
router.post('/universe/generate', adminController.generateUniverse);
router.get('/universe/config', adminController.getUniverseConfig);

// Audit
router.get('/action-audit', adminController.getActionAuditLogs);
router.get('/audit/summary', adminController.getAuditSummary);

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

// Tick System (legacy endpoint kept for compatibility)
router.get('/ticks/status', gameSettingsController.getTickStatus);

// Server
router.get('/server/status', adminServerController.getServerStatus);
router.get('/server/runtime-log', adminServerController.getRuntimeLog);
router.post('/server/ticks/start', adminServerController.startTicks);
router.post('/server/ticks/stop', adminServerController.stopTicks);

// Economy
router.get('/economy/overview', adminEconomyController.getEconomyOverview);
router.get('/economy/transfers', adminEconomyController.getTransfers);
router.post('/economy/force-tick', adminEconomyController.forceEconomyTick);
router.post('/economy/reset-stocks', adminEconomyController.resetPortStocks);

// Job Queue
router.get('/jobs/stats', adminController.getJobStats);
router.get('/jobs', adminController.getJobs);
router.post('/jobs/cleanup', adminController.cleanupJobs);
router.post('/jobs/:jobId/retry', adminController.retryJob);

// User Management
router.get('/users', gameSettingsController.getUserList);
router.put('/users/tier', gameSettingsController.updateUserTier);
router.get('/users/:id/detail', adminController.getUserDetail);
router.post('/users/:id/credits', adminController.adjustCredits);
router.post('/users/:id/revive-ship', adminController.reviveShip);
router.post('/users/:id/repair-ship', adminController.repairShip);
router.post('/users/:id/move-ship', adminController.moveShip);
router.post('/users/:id/set-active-ship', adminController.setActiveShip);

// Wars
router.get('/wars', adminWarController.getWars);
router.get('/wars/active', adminWarController.getActiveWars);
router.post('/wars/declare', adminWarController.declareWar);
router.post('/wars/:id/resolve', adminWarController.resolveWar);

// Events
router.get('/events', adminEventController.getEvents);
router.post('/events', adminEventController.createEvent);
router.put('/events/:id/end', adminEventController.endEvent);
router.delete('/events/:id', adminEventController.deleteEvent);

module.exports = router;
