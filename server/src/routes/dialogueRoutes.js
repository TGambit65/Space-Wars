const express = require('express');
const multer = require('multer');
const { authMiddleware } = require('../middleware/auth');
const dialogueController = require('../controllers/dialogueController');

const router = express.Router();

// Configure multer for in-memory audio upload (5MB limit)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowedMimes = [
      'audio/webm', 'audio/mp3', 'audio/mpeg',
      'audio/wav', 'audio/wave', 'audio/x-wav', 'audio/ogg'
    ];
    if (allowedMimes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid audio format. Supported: webm, mp3, wav, ogg'));
    }
  }
});

// All dialogue routes require authentication
router.post('/:npcId/start', authMiddleware, dialogueController.startDialogue);
router.post('/:npcId/option', authMiddleware, dialogueController.selectOption);
router.post('/:npcId/message', authMiddleware, dialogueController.sendMessage);
router.post('/:npcId/voice', authMiddleware, upload.single('audio'), dialogueController.sendVoice);
router.post('/:npcId/end', authMiddleware, dialogueController.endDialogue);
router.get('/:npcId/state', authMiddleware, dialogueController.getConversationState);

// Handle multer errors (file too large, invalid format) with JSON response
router.use((err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    const message = err.code === 'LIMIT_FILE_SIZE'
      ? 'Audio file must be 5MB or less'
      : `Upload error: ${err.message}`;
    return res.status(400).json({ success: false, message });
  }
  if (err.message && err.message.includes('Invalid audio format')) {
    return res.status(400).json({ success: false, message: err.message });
  }
  next(err);
});

module.exports = router;
