const express = require('express');
const router = express.Router();
const wonderController = require('../controllers/wonderController');
const { authMiddleware } = require('../middleware/auth');

router.use(authMiddleware);

router.get('/types', wonderController.getWonderTypes);
router.get('/colony/:colonyId', wonderController.getColonyWonders);
router.post('/colony/:colonyId/build', wonderController.startConstruction);
router.post('/:wonderId/advance', wonderController.advancePhase);

module.exports = router;
