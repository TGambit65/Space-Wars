const express = require('express');
const { body, param } = require('express-validator');
const shipController = require('../controllers/shipController');
const { authMiddleware } = require('../middleware/auth');

const router = express.Router();

// All ship routes require authentication
router.use(authMiddleware);

// Validation rules
const moveValidation = [
  param('shipId')
    .isUUID()
    .withMessage('Invalid ship ID'),
  body('target_sector_id')
    .isUUID()
    .withMessage('Invalid target sector ID')
];

const shipIdValidation = [
  param('shipId')
    .isUUID()
    .withMessage('Invalid ship ID')
];

// Routes
router.get('/', shipController.getShips);
router.get('/:shipId', shipIdValidation, shipController.getShipStatus);
router.get('/:shipId/adjacent', shipIdValidation, shipController.getAdjacentSectors);
router.post('/:shipId/move', moveValidation, shipController.moveShip);

module.exports = router;

