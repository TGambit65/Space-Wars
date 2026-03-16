const { validationResult } = require('express-validator');
const messagingService = require('../services/messagingService');

const sendMessage = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const { recipient_user_id, recipient_username, subject, body } = req.body;
    const message = await messagingService.sendMessage(req.userId, { recipient_user_id, recipient_username, subject, body });

    res.status(201).json({
      success: true,
      data: message
    });
  } catch (error) {
    next(error);
  }
};

const sendCorporationMessage = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const { corporation_id, subject, body } = req.body;
    const message = await messagingService.sendCorporationMessage(req.userId, corporation_id, subject, body);

    res.status(201).json({
      success: true,
      data: message
    });
  } catch (error) {
    next(error);
  }
};

const getInbox = async (req, res, next) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const result = await messagingService.getInbox(req.userId, { page, limit });

    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    next(error);
  }
};

const getSent = async (req, res, next) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const result = await messagingService.getSent(req.userId, { page, limit });

    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    next(error);
  }
};

const markRead = async (req, res, next) => {
  try {
    const { id } = req.params;
    const message = await messagingService.markRead(req.userId, id);

    res.json({
      success: true,
      data: message
    });
  } catch (error) {
    next(error);
  }
};

const deleteMessage = async (req, res, next) => {
  try {
    const { id } = req.params;
    const result = await messagingService.deleteMessage(req.userId, id);

    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    next(error);
  }
};

const getUnreadCount = async (req, res, next) => {
  try {
    const result = await messagingService.getUnreadCount(req.userId);

    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  sendMessage,
  sendCorporationMessage,
  getInbox,
  getSent,
  markRead,
  deleteMessage,
  getUnreadCount
};
