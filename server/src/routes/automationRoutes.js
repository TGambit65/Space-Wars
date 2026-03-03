const express = require('express');
const router = express.Router();
const automationController = require('../controllers/automationController');
const { authMiddleware } = require('../middleware/auth');

router.use(authMiddleware);

router.post('/trade-route', automationController.createTradeRoute);
router.post('/mining-run', automationController.createMiningRun);
router.get('/tasks', automationController.getTasks);
router.post('/:taskId/pause', automationController.pauseTask);
router.post('/:taskId/resume', automationController.resumeTask);
router.delete('/:taskId', automationController.cancelTask);

module.exports = router;
