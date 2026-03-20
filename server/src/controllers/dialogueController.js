const dialogueService = require('../services/dialogueService');
const { serializeDialogueResult } = require('../utils/audioPayload');

/**
 * POST /api/dialogue/:npcId/start
 */
const startDialogue = async (req, res) => {
  try {
    const result = await dialogueService.startDialogue(req.userId, req.params.npcId);
    res.json({ success: true, data: result });
  } catch (err) {
    res.status(err.statusCode || 500).json({ success: false, message: err.message });
  }
};

/**
 * POST /api/dialogue/:npcId/option
 * Body: { option: string }
 */
const selectOption = async (req, res) => {
  try {
    const { option } = req.body;
    if (!option || typeof option !== 'string') {
      return res.status(400).json({ success: false, message: 'option is required and must be a string' });
    }

    const result = await dialogueService.selectMenuOption(req.userId, req.params.npcId, option);
    res.json({ success: true, data: serializeDialogueResult(result) });
  } catch (err) {
    res.status(err.statusCode || 500).json({ success: false, message: err.message });
  }
};

/**
 * POST /api/dialogue/:npcId/message
 * Body: { text: string }
 */
const sendMessage = async (req, res) => {
  try {
    const { text } = req.body;
    if (!text || typeof text !== 'string') {
      return res.status(400).json({ success: false, message: 'text is required and must be a string' });
    }
    if (text.length > 500) {
      return res.status(400).json({ success: false, message: 'Message must be 500 characters or less' });
    }

    const result = await dialogueService.processFreeText(req.userId, req.params.npcId, text);
    res.json({ success: true, data: serializeDialogueResult(result) });
  } catch (err) {
    res.status(err.statusCode || 500).json({ success: false, message: err.message });
  }
};

/**
 * POST /api/dialogue/:npcId/voice
 * Multipart: audio file
 */
const sendVoice = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'Audio file is required' });
    }

    // Validate file size (5MB max, enforced by multer but double-check)
    if (req.file.size > 5 * 1024 * 1024) {
      return res.status(400).json({ success: false, message: 'Audio file must be 5MB or less' });
    }

    // Determine format from mimetype
    const mimeToFormat = {
      'audio/webm': 'webm',
      'audio/mp3': 'mp3',
      'audio/mpeg': 'mp3',
      'audio/wav': 'wav',
      'audio/wave': 'wav',
      'audio/x-wav': 'wav',
      'audio/ogg': 'ogg'
    };
    const format = mimeToFormat[req.file.mimetype] || 'webm';

    const result = await dialogueService.processVoiceInput(
      req.userId,
      req.params.npcId,
      req.file.buffer,
      format
    );

    // If voice returned an error object (not thrown), still return 200 with error data
    if (result.error) {
      return res.json({ success: false, data: serializeDialogueResult(result) });
    }

    res.json({ success: true, data: serializeDialogueResult(result) });
  } catch (err) {
    res.status(err.statusCode || 500).json({ success: false, message: err.message });
  }
};

/**
 * POST /api/dialogue/:npcId/end
 */
const endDialogue = async (req, res) => {
  try {
    const result = await dialogueService.endDialogue(req.userId, req.params.npcId);
    res.json({ success: true, data: serializeDialogueResult(result) });
  } catch (err) {
    res.status(err.statusCode || 500).json({ success: false, message: err.message });
  }
};

/**
 * GET /api/dialogue/:npcId/state
 */
const getConversationState = async (req, res) => {
  try {
    const result = await dialogueService.getConversationState(req.userId, req.params.npcId);
    res.json({ success: true, data: result });
  } catch (err) {
    res.status(err.statusCode || 500).json({ success: false, message: err.message });
  }
};

module.exports = {
  startDialogue,
  selectOption,
  sendMessage,
  sendVoice,
  endDialogue,
  getConversationState
};
