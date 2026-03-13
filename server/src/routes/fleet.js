const express = require('express');
const router = express.Router();
const fleetController = require('../controllers/fleetController');
const { authMiddleware } = require('../middleware/auth');

router.use(authMiddleware);

router.post('/', fleetController.createFleet);
router.get('/', fleetController.getUserFleets);
router.get('/:fleetId', fleetController.getFleet);
router.patch('/:fleetId', fleetController.renameFleet);
router.post('/:fleetId/ships', fleetController.addShips);
router.delete('/:fleetId/ships', fleetController.removeShips);
router.delete('/:fleetId', fleetController.disbandFleet);
router.post('/:fleetId/move', fleetController.moveFleet);

module.exports = router;
