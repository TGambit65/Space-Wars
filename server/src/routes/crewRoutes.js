const express = require('express');
const router = express.Router();
const crewController = require('../controllers/crewController');
const { authMiddleware } = require('../middleware/auth');

// Apply auth middleware to all routes
router.use(authMiddleware);

// Get all crew hired by current user
router.get('/', crewController.getUserCrew);

// Get available crew at a port
router.get('/port/:portId', crewController.getCrewAtPort);

// Get crew on a specific ship
router.get('/ship/:shipId', crewController.getShipCrew);

// Hire a crew member
router.post('/hire', crewController.hireCrew);

// Assign role to crew member
router.post('/:crewId/assign', crewController.assignRole);

// Transfer crew member to another ship
router.post('/:crewId/transfer', crewController.transferCrew);

// Process salary payments
router.post('/salaries/process', crewController.processSalaries);

// Pay off salary debt
router.post('/salaries/pay-debt', crewController.paySalaryDebt);

// Dismiss a crew member
router.delete('/:crewId', crewController.dismissCrew);

module.exports = router;

