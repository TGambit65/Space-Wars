const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const ActionAuditLog = sequelize.define('ActionAuditLog', {
  action_audit_log_id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  user_id: {
    type: DataTypes.UUID,
    allowNull: true,
    references: {
      model: 'users',
      key: 'user_id'
    }
  },
  action_type: {
    type: DataTypes.STRING(50),
    allowNull: false
  },
  scope_type: {
    type: DataTypes.STRING(30),
    allowNull: false
  },
  scope_id: {
    type: DataTypes.STRING(100),
    allowNull: true
  },
  status: {
    type: DataTypes.STRING(20),
    allowNull: false,
    validate: {
      isIn: [['allow', 'deny', 'throttle', 'error']]
    }
  },
  reason: {
    type: DataTypes.STRING(255),
    allowNull: true
  },
  ip_address: {
    type: DataTypes.STRING(100),
    allowNull: true
  },
  metadata: {
    type: DataTypes.JSON,
    allowNull: false,
    defaultValue: {}
  },
  created_at: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW
  }
}, {
  tableName: 'action_audit_logs',
  timestamps: false,
  indexes: [
    { fields: ['user_id'] },
    { fields: ['action_type'] },
    { fields: ['scope_type', 'scope_id'] },
    { fields: ['status'] },
    { fields: ['created_at'] }
  ]
});

module.exports = ActionAuditLog;
