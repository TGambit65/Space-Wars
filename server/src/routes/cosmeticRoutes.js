const express = require('express');
const { authMiddleware } = require('../middleware/auth');
const cosmeticService = require('../services/cosmeticService');

const router = express.Router();

// All cosmetic routes require authentication
router.use(authMiddleware);

// GET /catalog - Get available cosmetics with unlock status
router.get('/catalog', async (req, res) => {
  try {
    const catalog = await cosmeticService.getAvailableCosmetics(req.userId);
    res.json({ success: true, data: catalog });
  } catch (error) {
    res.status(error.statusCode || 500).json({ success: false, message: error.message });
  }
});

// PUT /ships/:shipId/visual - Update ship visual config
router.put('/ships/:shipId/visual', async (req, res) => {
  try {
    const { visual_config } = req.body;

    if (!visual_config) {
      return res.status(400).json({ success: false, message: 'visual_config is required' });
    }

    const ship = await cosmeticService.updateShipVisual(req.params.shipId, req.userId, visual_config);
    res.json({ success: true, data: ship });
  } catch (error) {
    res.status(error.statusCode || 500).json({ success: false, message: error.message });
  }
});

// POST /check-milestones - Check and unlock milestone cosmetics
router.post('/check-milestones', async (req, res) => {
  try {
    const newUnlocks = await cosmeticService.checkMilestoneUnlocks(req.userId);
    res.json({ success: true, data: { new_unlocks: newUnlocks } });
  } catch (error) {
    res.status(error.statusCode || 500).json({ success: false, message: error.message });
  }
});

module.exports = router;
