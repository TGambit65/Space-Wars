const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const DailyQuest = sequelize.define('DailyQuest', {
  quest_id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  user_id: {
    type: DataTypes.UUID,
    allowNull: false,
    references: { model: 'users', key: 'user_id' }
  },
  quest_type: {
    type: DataTypes.STRING(50),
    allowNull: false
  },
  target_count: {
    type: DataTypes.INTEGER,
    allowNull: false
  },
  current_count: {
    type: DataTypes.INTEGER,
    defaultValue: 0
  },
  xp_reward: {
    type: DataTypes.INTEGER,
    allowNull: false
  },
  credit_reward: {
    type: DataTypes.INTEGER,
    allowNull: false
  },
  status: {
    type: DataTypes.STRING(20),
    defaultValue: 'active',
    validate: { isIn: [['active', 'completed', 'claimed']] }
  },
  day_bucket: {
    type: DataTypes.INTEGER,
    allowNull: false,
    comment: 'floor(unix_ms / 86400000) — groups quests by UTC day'
  },
  expires_at: {
    type: DataTypes.DATE,
    allowNull: false
  }
}, {
  tableName: 'daily_quests',
  timestamps: true,
  indexes: [
    { fields: ['user_id'] },
    { fields: ['user_id', 'day_bucket'] },
    { fields: ['status'] }
  ]
});

module.exports = DailyQuest;
