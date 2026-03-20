const express = require('express');
const { authMiddleware } = require('../middleware/auth');
const { agentAuthMiddleware } = require('../middleware/agentAuth');
const agentController = require('../controllers/agentController');

const router = express.Router();

// ── Player-facing endpoints (JWT auth) ──
// Manage your agent account from the game UI
router.post('/', authMiddleware, agentController.createAgent);
router.get('/', authMiddleware, agentController.getAgent);
router.put('/', authMiddleware, agentController.updateAgent);
router.delete('/', authMiddleware, agentController.deleteAgent);
router.post('/status', authMiddleware, agentController.setStatus);
router.post('/regenerate-key', authMiddleware, agentController.regenerateKey);
router.get('/logs', authMiddleware, agentController.getLogs);

// ── Agent-facing endpoints (API key auth) ──
// Called by external agent runtimes (OpenClaw, etc.)
router.get('/me', agentAuthMiddleware, agentController.agentSelf);

module.exports = router;
