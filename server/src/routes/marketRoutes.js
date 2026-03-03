const express = require('express');
const router = express.Router();
const marketController = require('../controllers/marketController');
const { authMiddleware } = require('../middleware/auth');

router.use(authMiddleware);

router.get('/history/:portId/:commodityId', marketController.getPriceHistory);
router.get('/trends/:commodityId', marketController.getPriceTrends);
router.get('/:portId/overview', marketController.getMarketOverview);

module.exports = router;
