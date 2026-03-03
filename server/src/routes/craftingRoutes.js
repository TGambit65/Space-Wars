const express = require('express');
const router = express.Router();
const craftingController = require('../controllers/craftingController');
const { authMiddleware } = require('../middleware/auth');

router.use(authMiddleware);

router.get('/blueprints', craftingController.getBlueprints);
router.post('/start', craftingController.startCrafting);
router.post('/:jobId/cancel', craftingController.cancelCrafting);
router.post('/:jobId/complete', craftingController.completeCrafting);
router.post('/check', craftingController.checkCompleted);
router.get('/jobs', craftingController.getJobs);

module.exports = router;
