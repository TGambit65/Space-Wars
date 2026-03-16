const express = require('express');
const { authMiddleware } = require('../middleware/auth');
const shipTemplateService = require('../services/shipTemplateService');

const router = express.Router();

// All template routes require authentication
router.use(authMiddleware);

// GET / - Get user's templates
router.get('/', async (req, res) => {
  try {
    const templates = await shipTemplateService.getUserTemplates(req.userId);
    res.json({ success: true, data: templates });
  } catch (error) {
    res.status(error.statusCode || 500).json({ success: false, message: error.message });
  }
});

// POST / - Save a template
router.post('/', async (req, res) => {
  try {
    const { name, ship_type, components, notes } = req.body;

    if (!name || !ship_type) {
      return res.status(400).json({ success: false, message: 'name and ship_type are required' });
    }

    const template = await shipTemplateService.saveTemplate(req.userId, name, ship_type, components, notes);
    res.status(201).json({ success: true, data: template });
  } catch (error) {
    res.status(error.statusCode || 500).json({ success: false, message: error.message });
  }
});

// GET /:id - Load a template
router.get('/:id', async (req, res) => {
  try {
    const template = await shipTemplateService.loadTemplate(req.params.id, req.userId);
    res.json({ success: true, data: template });
  } catch (error) {
    res.status(error.statusCode || 500).json({ success: false, message: error.message });
  }
});

// DELETE /:id - Delete a template
router.delete('/:id', async (req, res) => {
  try {
    const result = await shipTemplateService.deleteTemplate(req.params.id, req.userId);
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(error.statusCode || 500).json({ success: false, message: error.message });
  }
});

module.exports = router;
