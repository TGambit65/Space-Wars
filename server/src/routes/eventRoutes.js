const express = require('express');
const { authMiddleware, adminMiddleware } = require('../middleware/auth');
const communityEventService = require('../services/communityEventService');

const router = express.Router();

// GET / - Get all events (paginated)
router.get('/', async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;

    const result = await communityEventService.getAllEvents({ page, limit });
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(error.statusCode || 500).json({ success: false, message: error.message });
  }
});

// GET /active - Get active events
router.get('/active', async (req, res) => {
  try {
    const events = await communityEventService.getActiveEvents();
    res.json({ success: true, data: events });
  } catch (error) {
    res.status(error.statusCode || 500).json({ success: false, message: error.message });
  }
});

// POST / - Create event (admin only)
router.post('/', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const event = await communityEventService.createEvent(req.body);
    res.status(201).json({ success: true, data: event });
  } catch (error) {
    res.status(error.statusCode || 500).json({ success: false, message: error.message });
  }
});

// POST /:id/contribute - Contribute to an event
router.post('/:id/contribute', authMiddleware, async (req, res) => {
  try {
    const { amount } = req.body;

    if (!amount || amount <= 0) {
      return res.status(400).json({ success: false, message: 'A positive amount is required' });
    }

    const result = await communityEventService.contribute(req.params.id, req.userId, amount);
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(error.statusCode || 500).json({ success: false, message: error.message });
  }
});

// GET /:id/leaderboard - Get event leaderboard
router.get('/:id/leaderboard', async (req, res) => {
  try {
    const leaderboard = await communityEventService.getLeaderboard(req.params.id);
    res.json({ success: true, data: leaderboard });
  } catch (error) {
    res.status(error.statusCode || 500).json({ success: false, message: error.message });
  }
});

module.exports = router;
