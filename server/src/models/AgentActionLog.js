const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const AgentActionLog = sequelize.define('AgentActionLog', {
  log_id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  agent_id: {
    type: DataTypes.UUID,
    allowNull: false,
    references: { model: 'agent_accounts', key: 'agent_id' },
  },
  owner_id: {
    type: DataTypes.UUID,
    allowNull: false,
    references: { model: 'users', key: 'user_id' },
    comment: 'Denormalized for fast owner queries',
  },
  action_type: {
    type: DataTypes.STRING(50),
    allowNull: false,
    comment: 'e.g., navigate, buy, sell, scan, dock, attack, flee',
  },
  action_family: {
    type: DataTypes.STRING(30),
    allowNull: false,
    comment: 'Permission family: navigate, trade, combat, scan, etc.',
  },
  target_entity: {
    type: DataTypes.STRING(100),
    allowNull: true,
    comment: 'What the action targeted (sector ID, port ID, ship ID, etc.)',
  },
  result: {
    type: DataTypes.ENUM('allowed', 'denied', 'error', 'budget_exceeded', 'rate_limited'),
    allowNull: false,
  },
  credits_delta: {
    type: DataTypes.BIGINT,
    defaultValue: 0,
    comment: 'Credits gained (+) or spent (-) by this action',
  },
  details: {
    type: DataTypes.JSON,
    defaultValue: {},
    comment: 'Additional context (error message, trade details, etc.)',
  },
  created_at: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW,
  },
}, {
  tableName: 'agent_action_logs',
  timestamps: false,
  indexes: [
    { fields: ['agent_id', 'created_at'] },
    { fields: ['owner_id', 'created_at'] },
    { fields: ['result'] },
  ],
});

module.exports = AgentActionLog;
