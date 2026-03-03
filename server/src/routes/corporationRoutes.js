const express = require('express');
const router = express.Router();
const corporationController = require('../controllers/corporationController');
const { authMiddleware } = require('../middleware/auth');

router.use(authMiddleware);

router.post('/', corporationController.create);
router.get('/mine', corporationController.getMine);
router.get('/leaderboard', corporationController.leaderboard);
router.get('/:id', corporationController.getById);
router.post('/:id/join', corporationController.join);
router.post('/leave', corporationController.leave);
router.post('/members/:userId/promote', corporationController.promote);
router.post('/transfer/:userId', corporationController.transfer);
router.delete('/', corporationController.disband);
router.post('/treasury/contribute', corporationController.contribute);
router.post('/treasury/withdraw', corporationController.withdraw);

module.exports = router;
