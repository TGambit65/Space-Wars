const express = require('express');
const router = express.Router();
const { body, param, query } = require('express-validator');
const tradeController = require('../controllers/tradeController');
const { authMiddleware } = require('../middleware/auth');

// Validation error handler
const validate = (req, res, next) => {
  const { validationResult } = require('express-validator');
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      errors: errors.array()
    });
  }
  next();
};

// Trade validation
const tradeValidation = [
  body('ship_id').isUUID().withMessage('ship_id must be a valid UUID'),
  body('port_id').isUUID().withMessage('port_id must be a valid UUID'),
  body('commodity_id').isUUID().withMessage('commodity_id must be a valid UUID'),
  body('quantity').isInt({ min: 1 }).withMessage('quantity must be a positive integer')
];

/**
 * @route   POST /api/trade/buy
 * @desc    Buy commodities from a port
 * @access  Private
 */
router.post(
  '/buy',
  authMiddleware,
  tradeValidation,
  validate,
  tradeController.buyCommodity
);

/**
 * @route   POST /api/trade/sell
 * @desc    Sell commodities to a port
 * @access  Private
 */
router.post(
  '/sell',
  authMiddleware,
  tradeValidation,
  validate,
  tradeController.sellCommodity
);

/**
 * @route   GET /api/trade/commodities
 * @desc    Get all commodities
 * @access  Private
 */
router.get(
  '/commodities',
  authMiddleware,
  tradeController.getAllCommodities
);

/**
 * @route   GET /api/trade/cargo/:shipId
 * @desc    Get ship cargo
 * @access  Private
 */
router.get(
  '/cargo/:shipId',
  authMiddleware,
  param('shipId').isUUID().withMessage('shipId must be a valid UUID'),
  validate,
  tradeController.getShipCargo
);

/**
 * @route   POST /api/trade/refuel/:shipId
 * @desc    Refuel ship at a port
 * @access  Private
 */
router.post(
  '/refuel/:shipId',
  authMiddleware,
  param('shipId').isUUID().withMessage('shipId must be a valid UUID'),
  body('port_id').isUUID().withMessage('port_id must be a valid UUID'),
  body('amount').optional().isInt({ min: 1 }).withMessage('amount must be a positive integer'),
  validate,
  tradeController.refuelShip
);

/**
 * @route   GET /api/trade/history
 * @desc    Get user's transaction history
 * @access  Private
 */
router.get(
  '/history',
  authMiddleware,
  query('page').optional().isInt({ min: 1 }).withMessage('page must be a positive integer'),
  query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('limit must be between 1 and 100'),
  query('type').optional().isIn(['BUY', 'SELL', 'buy', 'sell']).withMessage('type must be BUY or SELL'),
  validate,
  tradeController.getTransactionHistory
);

/**
 * @route   GET /api/trade/market/:commodityId
 * @desc    Get market prices for a commodity across all ports
 * @access  Private
 */
router.get(
  '/market/:commodityId',
  authMiddleware,
  param('commodityId').isUUID().withMessage('commodityId must be a valid UUID'),
  validate,
  tradeController.getMarketData
);

/**
 * @route   GET /api/trade/market
 * @desc    Get market summary for all commodities
 * @access  Private
 */
router.get(
  '/market',
  authMiddleware,
  tradeController.getMarketSummary
);

module.exports = router;

