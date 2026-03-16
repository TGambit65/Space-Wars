/**
 * Ground combat routes.
 * All endpoints require authentication.
 */
const express = require('express');
const router = express.Router();
const { authMiddleware } = require('../middleware/auth');
const groundCombatController = require('../controllers/groundCombatController');

// Unit training & garrison management
router.post('/train', authMiddleware, groundCombatController.trainUnit);
router.get('/garrison/:colonyId', authMiddleware, groundCombatController.getGarrison);
router.patch('/policy/:colonyId', authMiddleware, groundCombatController.setDefensePolicy);
router.post('/disband/:colonyId', authMiddleware, groundCombatController.disbandUnit);
router.get('/history/:colonyId', authMiddleware, groundCombatController.getCombatHistory);

// Combat operations
router.post('/invade', authMiddleware, groundCombatController.initiateInvasion);
router.get('/:instanceId', authMiddleware, groundCombatController.getCombatState);
router.post('/:instanceId/orders', authMiddleware, groundCombatController.processCombatTurn);
router.post('/:instanceId/retreat', authMiddleware, groundCombatController.retreat);

module.exports = router;
