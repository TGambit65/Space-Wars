const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const EventContribution = sequelize.define('EventContribution', {
  contribution_id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  event_id: {
    type: DataTypes.UUID,
    allowNull: false,
    references: { model: 'community_events', key: 'event_id' }
  },
  user_id: {
    type: DataTypes.UUID,
    allowNull: false,
    references: { model: 'users', key: 'user_id' }
  },
  amount: {
    type: DataTypes.BIGINT,
    defaultValue: 0
  }
}, {
  tableName: 'event_contributions',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at',
  indexes: [
    { unique: true, fields: ['event_id', 'user_id'] },
    { fields: ['event_id', 'amount'] }
  ]
});

module.exports = EventContribution;
