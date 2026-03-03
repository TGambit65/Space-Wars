const express = require('express');
const router = express.Router();
const missionController = require('../controllers/missionController');
const { authMiddleware } = require('../middleware/auth');

router.use(authMiddleware);

router.get('/available/:portId', missionController.getAvailableMissions);
router.get('/active', missionController.getActiveMissions);
router.post('/:missionId/accept', missionController.acceptMission);
router.post('/:playerMissionId/abandon', missionController.abandonMission);

module.exports = router;
