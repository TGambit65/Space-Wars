const express = require('express');
const router = express.Router();
const colonyBuildingController = require('../controllers/colonyBuildingController');
const { authMiddleware } = require('../middleware/auth');

router.use(authMiddleware);

router.get('/types', colonyBuildingController.getBuildingTypes);
router.get('/colony/:colonyId', colonyBuildingController.getColonyBuildings);
router.get('/colony/:colonyId/available', colonyBuildingController.getAvailableBuildings);
router.post('/colony/:colonyId/build', colonyBuildingController.constructBuilding);
router.post('/:buildingId/upgrade', colonyBuildingController.upgradeBuilding);
router.delete('/:buildingId', colonyBuildingController.demolishBuilding);
router.patch('/:buildingId/toggle', colonyBuildingController.toggleBuilding);
router.post('/:buildingId/repair', colonyBuildingController.repairBuilding);

module.exports = router;
