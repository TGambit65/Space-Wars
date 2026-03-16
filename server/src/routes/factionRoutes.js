const express = require('express');
const router = express.Router();
const factionController = require('../controllers/factionController');
const { authMiddleware } = require('../middleware/auth');

router.get('/', factionController.listFactions);
router.get('/standings', authMiddleware, factionController.getStandings);
router.get('/leaderboard', factionController.getLeaderboard);
router.get('/wars', factionController.getWars);
router.get('/wars/active', factionController.getActiveWar);

module.exports = router;
