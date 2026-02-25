const express = require('express');
const adminController = require('../controllers/adminController');
const { authMiddleware, adminMiddleware } = require('../middleware/auth');

const router = express.Router();

// All admin routes require auth + admin
router.use(authMiddleware);
router.use(adminMiddleware);

router.post('/universe/generate', adminController.generateUniverse);
router.get('/universe/config', adminController.getUniverseConfig);

module.exports = router;
