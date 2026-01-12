const express = require('express');
const router = express.Router();
const combatController = require('../controllers/combatController');
const { authMiddleware } = require('../middleware/auth');

// Apply auth middleware to all routes
router.use(authMiddleware);

// Combat actions
router.post('/attack/:shipId', combatController.attackNPC);
router.post('/flee/:shipId', combatController.flee);

// Combat history
router.get('/history', combatController.getCombatHistory);
router.get('/log/:combatLogId', combatController.getCombatLog);

module.exports = router;

