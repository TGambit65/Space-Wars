const express = require('express');
const router = express.Router();
const { param, query } = require('express-validator');
const portController = require('../controllers/portController');
const { authMiddleware } = require('../middleware/auth');

// Validation middleware
const validateUUID = (field, location = 'params') => {
  const validator = location === 'query' ? query(field) : param(field);
  return validator
    .optional()
    .isUUID()
    .withMessage(`${field} must be a valid UUID`);
};

const validateRequiredUUID = (field) => {
  return param(field)
    .isUUID()
    .withMessage(`${field} must be a valid UUID`);
};

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

/**
 * @route   GET /api/ports
 * @desc    Get all ports (optionally filtered by sector)
 * @access  Private
 */
router.get(
  '/',
  authMiddleware,
  validateUUID('sector_id', 'query'),
  validate,
  portController.getAllPorts
);

/**
 * @route   GET /api/ports/:id
 * @desc    Get port details with commodity prices
 * @access  Private
 */
router.get(
  '/:id',
  authMiddleware,
  validateRequiredUUID('id'),
  validate,
  portController.getPortById
);

module.exports = router;

