const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const Message = sequelize.define('Message', {
  message_id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  sender_user_id: {
    type: DataTypes.UUID,
    allowNull: false,
    references: { model: 'users', key: 'user_id' }
  },
  recipient_user_id: {
    type: DataTypes.UUID,
    allowNull: true,
    references: { model: 'users', key: 'user_id' }
  },
  corporation_id: {
    type: DataTypes.UUID,
    allowNull: true,
    references: { model: 'corporations', key: 'corporation_id' }
  },
  subject: {
    type: DataTypes.STRING(200),
    allowNull: false
  },
  body: {
    type: DataTypes.TEXT,
    allowNull: false
  },
  message_type: {
    type: DataTypes.STRING(20),
    defaultValue: 'direct',
    validate: {
      isIn: [['direct', 'corporation', 'faction', 'system']]
    }
  },
  is_read: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  }
}, {
  tableName: 'messages',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at',
  indexes: [
    { fields: ['recipient_user_id', 'is_read'] },
    { fields: ['sender_user_id'] },
    { fields: ['corporation_id'] },
    { fields: ['message_type'] }
  ]
});

module.exports = Message;
