const { Message, User, sequelize } = require('../models');
const { Op } = require('sequelize');

/**
 * Send a direct message to another player (by user_id or username)
 */
const sendMessage = async (senderUserId, { recipient_user_id, recipient_username, subject, body }) => {
  let recipient;
  if (recipient_user_id) {
    recipient = await User.findByPk(recipient_user_id);
  } else if (recipient_username) {
    recipient = await User.findOne({ where: { username: recipient_username } });
  }
  if (!recipient) {
    throw Object.assign(new Error('Recipient not found'), { statusCode: 404 });
  }

  const message = await Message.create({
    sender_user_id: senderUserId,
    recipient_user_id: recipient.user_id,
    subject,
    body,
    message_type: 'direct'
  });

  return message;
};

/**
 * Send a message to all members of a corporation
 */
const sendCorporationMessage = async (senderUserId, corporationId, subject, body) => {
  const message = await Message.create({
    sender_user_id: senderUserId,
    corporation_id: corporationId,
    subject,
    body,
    message_type: 'corporation'
  });

  return message;
};

/**
 * Get inbox messages for a user (direct + faction messages)
 */
const getInbox = async (userId, { page = 1, limit = 20 } = {}) => {
  const offset = (page - 1) * limit;

  // Get user's faction for faction messages
  const user = await User.findByPk(userId, { attributes: ['faction'] });
  if (!user) {
    throw Object.assign(new Error('User not found'), { statusCode: 404 });
  }

  const where = {
    [Op.or]: [
      { recipient_user_id: userId },
      { message_type: 'faction' }
    ]
  };

  const { count, rows } = await Message.findAndCountAll({
    where,
    order: [['created_at', 'DESC']],
    limit,
    offset,
    include: [{
      model: User,
      as: 'sender',
      attributes: ['username']
    }]
  });

  return {
    messages: rows,
    total: count,
    page,
    totalPages: Math.ceil(count / limit)
  };
};

/**
 * Get sent messages for a user
 */
const getSent = async (userId, { page = 1, limit = 20 } = {}) => {
  const offset = (page - 1) * limit;

  const { count, rows } = await Message.findAndCountAll({
    where: { sender_user_id: userId },
    order: [['created_at', 'DESC']],
    limit,
    offset,
    include: [{
      model: User,
      as: 'sender',
      attributes: ['username']
    }]
  });

  return {
    messages: rows,
    total: count,
    page,
    totalPages: Math.ceil(count / limit)
  };
};

/**
 * Mark a message as read
 */
const markRead = async (userId, messageId) => {
  const message = await Message.findOne({
    where: {
      message_id: messageId,
      recipient_user_id: userId
    }
  });

  if (!message) {
    throw Object.assign(new Error('Message not found'), { statusCode: 404 });
  }

  message.is_read = true;
  await message.save();

  return message;
};

/**
 * Delete a message (sender or recipient can delete)
 */
const deleteMessage = async (userId, messageId) => {
  const message = await Message.findOne({
    where: {
      message_id: messageId,
      [Op.or]: [
        { sender_user_id: userId },
        { recipient_user_id: userId }
      ]
    }
  });

  if (!message) {
    throw Object.assign(new Error('Message not found'), { statusCode: 404 });
  }

  await message.destroy();

  return { deleted: true };
};

/**
 * Get count of unread messages for a user
 */
const getUnreadCount = async (userId) => {
  const count = await Message.count({
    where: {
      recipient_user_id: userId,
      is_read: false
    }
  });

  return { unread: count };
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
