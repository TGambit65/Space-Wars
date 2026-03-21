const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const PlayerAchievement = sequelize.define('PlayerAchievement', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  user_id: {
    type: DataTypes.UUID,
    allowNull: false,
    references: { model: 'users', key: 'user_id' }
  },
  achievement_id: {
    type: DataTypes.STRING(100),
    allowNull: false,
    references: { model: 'achievements', key: 'achievement_id' }
  },
  current_value: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 0
  },
  unlocked: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  },
  unlocked_at: {
    type: DataTypes.DATE,
    allowNull: true
  },
  reward_claimed: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
    comment: 'Rewards are auto-claimed when unlock rewards are distributed'
  },
  created_at: {
    type: DataTypes.DATE,
    allowNull: false,
    defaultValue: DataTypes.NOW
  },
  updated_at: {
    type: DataTypes.DATE,
    allowNull: false,
    defaultValue: DataTypes.NOW
  }
}, {
  tableName: 'player_achievements',
  timestamps: false,
  indexes: [
    { fields: ['user_id', 'achievement_id'], unique: true, name: 'idx_player_achievement_unique' },
    { fields: ['user_id', 'unlocked'] },
    { fields: ['unlocked_at'] }
  ]
});

module.exports = PlayerAchievement;
