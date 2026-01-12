const express = require('express');
const { param, query } = require('express-validator');
const sectorController = require('../controllers/sectorController');
const { optionalAuth } = require('../middleware/auth');

const router = express.Router();

// Sector routes use optional auth
router.use(optionalAuth);

// Validation rules
const sectorIdValidation = [
  param('sectorId')
    .isUUID()
    .withMessage('Invalid sector ID')
];

const paginationValidation = [
  query('page')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Page must be a positive integer')
    .toInt(),
  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('Limit must be between 1 and 100')
    .toInt(),
  query('type')
    .optional()
    .isIn(['Core', 'Inner', 'Mid', 'Outer', 'Fringe', 'Unknown'])
    .withMessage('Invalid sector type')
];

// Routes
router.get('/', paginationValidation, sectorController.getSectors);
router.get('/stats', sectorController.getUniverseStats);
router.get('/:sectorId', sectorIdValidation, sectorController.getSectorById);

module.exports = router;

