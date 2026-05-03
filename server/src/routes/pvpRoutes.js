const express = require('express');
const router = express.Router();
const pvpController = require('../controllers/pvpController');
const { authMiddleware } = require('../middleware/auth');

router.use(authMiddleware);

// Bounty Board
router.get('/bounties', pvpController.listBounties);
router.post('/bounties/:contractId/accept', pvpController.acceptBounty);
router.post('/bounties/:contractId/abandon', pvpController.abandonBounty);

// Arena queue
router.get('/arena/status', pvpController.arenaStatus);
router.post('/arena/join', pvpController.arenaJoin);
router.post('/arena/leave', pvpController.arenaLeave);

// Duels
router.get('/duels/incoming', pvpController.duelIncoming);
router.post('/duels/challenge', pvpController.duelChallenge);
router.post('/duels/:requestId/respond', pvpController.duelRespond);

// Spectator: list of arena/duel combats anyone can watch
router.get('/spectatable', pvpController.listSpectatable);

module.exports = router;
