const express = require('express');
const router = express.Router();
const combatController = require('../controllers/combatController');
const { authMiddleware } = require('../middleware/auth');

router.use(authMiddleware);

// Combat history (read-only)
router.get('/history', combatController.getCombatHistory);
router.get('/log/:combatLogId', combatController.getCombatLog);

// Real-time combat (single source of truth — no auto-resolve fallback)
router.post('/realtime/attack-npc/:shipId', combatController.initiateRealtimeCombatNPC);
router.post('/realtime/attack-player/:shipId', combatController.initiateRealtimeCombatPVP);
router.get('/realtime/state/:combatId', combatController.getRealtimeCombatState);

module.exports = router;
