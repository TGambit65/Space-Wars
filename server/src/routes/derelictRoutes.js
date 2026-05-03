const express = require('express');
const { param } = require('express-validator');
const derelictController = require('../controllers/derelictController');
const { authMiddleware } = require('../middleware/auth');

const router = express.Router();
router.use(authMiddleware);

const derelictIdValidation = [
  param('derelictId').isString().matches(/^derelict_[A-Za-z0-9_-]+$/).withMessage('Invalid derelict id')
];

router.get('/:derelictId/interior', derelictIdValidation, derelictController.getInterior);
router.post('/:derelictId/loot', derelictIdValidation, derelictController.lootCrate);

module.exports = router;
