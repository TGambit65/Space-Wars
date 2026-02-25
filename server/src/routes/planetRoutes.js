const express = require('express');
const router = express.Router();
const planetController = require('../controllers/planetController');
const { authMiddleware } = require('../middleware/auth');

// Apply auth middleware to all routes
router.use(authMiddleware);

// Scan sector to discover planets
router.get('/scan/:sectorId', planetController.scanSector);

// Get user's owned planets
router.get('/user/owned', planetController.getUserPlanets);

// Get user's discovered artifacts
router.get('/user/artifacts', planetController.getUserArtifacts);

// Get detailed planet information
router.get('/:planetId', planetController.getPlanetDetails);

// Claim an artifact from an owned planet
router.post('/artifacts/:artifactId/claim', planetController.claimArtifact);

module.exports = router;

