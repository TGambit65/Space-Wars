const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

/**
 * Per-player NPC conversation sessions.
 * Replaces the global dialogue_state JSON on the NPC model so multiple
 * players can talk to the same NPC concurrently.
 */
const NpcConversationSession = sequelize.define('NpcConversationSession', {
  session_id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  npc_id: {
    type: DataTypes.UUID,
    allowNull: false,
    references: { model: 'npcs', key: 'npc_id' }
  },
  user_id: {
    type: DataTypes.UUID,
    allowNull: false,
    references: { model: 'users', key: 'user_id' }
  },
  started_at: {
    type: DataTypes.DATE,
    allowNull: false,
    defaultValue: DataTypes.NOW
  },
  last_message_at: {
    type: DataTypes.DATE,
    allowNull: false,
    defaultValue: DataTypes.NOW
  },
  history: {
    type: DataTypes.JSON,
    allowNull: false,
    defaultValue: [],
    comment: 'Conversation history [{ role, content }]'
  },
  is_active: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: true
  }
}, {
  tableName: 'npc_conversation_sessions',
  timestamps: false,
  indexes: [
    { fields: ['npc_id', 'user_id', 'is_active'], name: 'idx_npc_conv_active' },
    { fields: ['user_id', 'is_active'] },
    { fields: ['last_message_at'] }
  ]
});

module.exports = NpcConversationSession;
