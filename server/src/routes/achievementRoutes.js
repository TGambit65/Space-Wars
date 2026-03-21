const express = require('express');
const { authMiddleware } = require('../middleware/auth');
const achievementService = require('../services/achievementService');

const router = express.Router();

router.use(authMiddleware);

// GET /api/achievements/stats — unlock summary
router.get('/stats', async (req, res) => {
  try {
    const stats = await achievementService.getUnlockStats(req.userId);
    res.json({ success: true, data: stats });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// GET /api/achievements — list all achievements with player progress
router.get('/', async (req, res) => {
  try {
    const achievements = await achievementService.getPlayerAchievements(req.userId);
    res.json({ success: true, data: achievements });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;
