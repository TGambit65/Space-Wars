const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const CommunityEvent = sequelize.define('CommunityEvent', {
  event_id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  name: {
    type: DataTypes.STRING(100),
    allowNull: false
  },
  description: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  event_type: {
    type: DataTypes.STRING(30),
    allowNull: false,
    comment: 'trade_drive, combat_campaign, colonization_race, exploration_push'
  },
  goal_type: {
    type: DataTypes.STRING(30),
    allowNull: false,
    comment: 'trade_volume, combat_kills, colonies_founded, sectors_explored'
  },
  target_value: {
    type: DataTypes.BIGINT,
    allowNull: false
  },
  current_value: {
    type: DataTypes.BIGINT,
    defaultValue: 0
  },
  rewards: {
    type: DataTypes.JSON,
    allowNull: true,
    comment: 'Reward structure for participants'
  },
  faction_filter: {
    type: DataTypes.STRING(30),
    allowNull: true,
    comment: 'If set, only this faction can participate'
  },
  starts_at: {
    type: DataTypes.DATE,
    allowNull: false
  },
  ends_at: {
    type: DataTypes.DATE,
    allowNull: false
  },
  status: {
    type: DataTypes.STRING(20),
    defaultValue: 'upcoming',
    validate: {
      isIn: [['upcoming', 'active', 'completed', 'failed']]
    }
  }
}, {
  tableName: 'community_events',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at',
  indexes: [
    { fields: ['status'] },
    { fields: ['starts_at', 'ends_at'] }
  ]
});

module.exports = CommunityEvent;
