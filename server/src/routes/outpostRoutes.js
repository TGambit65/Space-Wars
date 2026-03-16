const express = require('express');
const { authMiddleware } = require('../middleware/auth');
const outpostService = require('../services/outpostService');

const router = express.Router();

// All outpost routes require authentication
router.use(authMiddleware);

// GET / - Get user's outposts
router.get('/', async (req, res) => {
  try {
    const outposts = await outpostService.getUserOutposts(req.userId);
    res.json({ success: true, data: outposts });
  } catch (error) {
    res.status(error.statusCode || 500).json({ success: false, message: error.message });
  }
});

// GET /sector/:sectorId - Get outposts in a sector
router.get('/sector/:sectorId', async (req, res) => {
  try {
    const outposts = await outpostService.getOutpostsInSector(req.params.sectorId);
    res.json({ success: true, data: outposts });
  } catch (error) {
    res.status(error.statusCode || 500).json({ success: false, message: error.message });
  }
});

// POST / - Build an outpost
router.post('/', async (req, res) => {
  try {
    const { sector_id, outpost_type, name } = req.body;

    if (!sector_id || !outpost_type) {
      return res.status(400).json({ success: false, message: 'sector_id and outpost_type are required' });
    }

    const outpost = await outpostService.buildOutpost(req.userId, sector_id, outpost_type, name);
    res.status(201).json({ success: true, data: outpost });
  } catch (error) {
    res.status(error.statusCode || 500).json({ success: false, message: error.message });
  }
});

// POST /:id/upgrade - Upgrade an outpost
router.post('/:id/upgrade', async (req, res) => {
  try {
    const outpost = await outpostService.upgradeOutpost(req.params.id, req.userId);
    res.json({ success: true, data: outpost });
  } catch (error) {
    res.status(error.statusCode || 500).json({ success: false, message: error.message });
  }
});

// DELETE /:id - Destroy an outpost
router.delete('/:id', async (req, res) => {
  try {
    const result = await outpostService.destroyOutpost(req.params.id, req.userId);
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(error.statusCode || 500).json({ success: false, message: error.message });
  }
});

module.exports = router;
