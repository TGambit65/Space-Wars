const express = require('express');
const { body } = require('express-validator');
const messagingController = require('../controllers/messagingController');
const { authMiddleware } = require('../middleware/auth');

const router = express.Router();

// All messaging routes require authentication
router.use(authMiddleware);

// Validation rules
const sendValidation = [
  body('recipient_user_id')
    .optional()
    .isUUID()
    .withMessage('Invalid recipient user ID'),
  body('recipient_username')
    .optional()
    .isString()
    .trim()
    .isLength({ min: 1, max: 50 })
    .withMessage('Invalid recipient username'),
  body('subject')
    .isString()
    .trim()
    .isLength({ min: 1, max: 200 })
    .withMessage('Subject is required and must be 200 characters or less'),
  body('body')
    .isString()
    .trim()
    .notEmpty()
    .withMessage('Message body is required')
];

// Routes
router.get('/inbox', messagingController.getInbox);
router.get('/sent', messagingController.getSent);
router.get('/unread', messagingController.getUnreadCount);
router.post('/send', sendValidation, messagingController.sendMessage);
router.post('/:id/read', messagingController.markRead);
router.delete('/:id', messagingController.deleteMessage);

module.exports = router;
