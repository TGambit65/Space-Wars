const express = require('express');
const { authMiddleware } = require('../middleware/auth');
const agreementService = require('../services/agreementService');

const router = express.Router();

// All agreement routes require authentication
router.use(authMiddleware);

// GET / - Get all agreements for the user's corporation
router.get('/', async (req, res) => {
  try {
    const user = req.user;
    if (!user.corporation_id) {
      return res.status(400).json({ success: false, message: 'You are not in a corporation' });
    }

    const agreements = await agreementService.getForCorporation(user.corporation_id);
    res.json({ success: true, data: agreements });
  } catch (error) {
    res.status(error.statusCode || 500).json({ success: false, message: error.message });
  }
});

// POST /propose - Propose an agreement
router.post('/propose', async (req, res) => {
  try {
    const user = req.user;
    if (!user.corporation_id) {
      return res.status(400).json({ success: false, message: 'You are not in a corporation' });
    }

    const { target_corp_id, agreement_type, terms } = req.body;

    if (!target_corp_id || !agreement_type) {
      return res.status(400).json({ success: false, message: 'target_corp_id and agreement_type are required' });
    }

    const agreement = await agreementService.propose(user.corporation_id, target_corp_id, agreement_type, terms);
    res.status(201).json({ success: true, data: agreement });
  } catch (error) {
    res.status(error.statusCode || 500).json({ success: false, message: error.message });
  }
});

// POST /:id/respond - Respond to an agreement
router.post('/:id/respond', async (req, res) => {
  try {
    const user = req.user;
    if (!user.corporation_id) {
      return res.status(400).json({ success: false, message: 'You are not in a corporation' });
    }

    const { accept } = req.body;
    if (accept === undefined) {
      return res.status(400).json({ success: false, message: 'accept field is required' });
    }

    const agreement = await agreementService.respond(req.params.id, user.corporation_id, accept);
    res.json({ success: true, data: agreement });
  } catch (error) {
    res.status(error.statusCode || 500).json({ success: false, message: error.message });
  }
});

// POST /:id/break - Break an agreement
router.post('/:id/break', async (req, res) => {
  try {
    const user = req.user;
    if (!user.corporation_id) {
      return res.status(400).json({ success: false, message: 'You are not in a corporation' });
    }

    const agreement = await agreementService.breakAgreement(req.params.id, user.corporation_id);
    res.json({ success: true, data: agreement });
  } catch (error) {
    res.status(error.statusCode || 500).json({ success: false, message: error.message });
  }
});

module.exports = router;
