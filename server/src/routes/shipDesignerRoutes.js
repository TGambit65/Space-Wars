const express = require('express');
const router = express.Router();
const shipDesignerController = require('../controllers/shipDesignerController');
const { authMiddleware } = require('../middleware/auth');

// Apply auth middleware to all routes
router.use(authMiddleware);

// Component catalog
router.get('/components', shipDesignerController.getComponents);

// Ship design
router.get('/design/:shipId', shipDesignerController.getShipDesign);

// Install/uninstall components
router.post('/install/:shipId', shipDesignerController.installComponent);
router.delete('/uninstall/:shipId/:componentId', shipDesignerController.uninstallComponent);

// Repair
router.get('/repair/:shipId', shipDesignerController.getRepairEstimate);
router.post('/repair/:shipId/hull', shipDesignerController.repairHull);
router.post('/repair/:shipId/component/:componentId', shipDesignerController.repairComponent);

module.exports = router;

