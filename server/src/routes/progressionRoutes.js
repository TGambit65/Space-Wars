const express = require('express');
const router = express.Router();
const progressionController = require('../controllers/progressionController');
const { authMiddleware } = require('../middleware/auth');

router.use(authMiddleware);

router.get('/', progressionController.getProgression);
router.post('/skills/:skillName/upgrade', progressionController.upgradeSkill);
router.get('/tech', progressionController.getTech);
router.post('/tech/:techName/research', progressionController.startResearch);
router.post('/tech/check', progressionController.checkResearch);

module.exports = router;
