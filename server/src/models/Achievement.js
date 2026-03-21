const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const Achievement = sequelize.define('Achievement', {
  achievement_id: {
    type: DataTypes.STRING(100),
    primaryKey: true,
    comment: 'Human-readable key: first_trade, explore_100_sectors, etc.'
  },
  name: {
    type: DataTypes.STRING(200),
    allowNull: false
  },
  description: {
    type: DataTypes.TEXT,
    allowNull: false
  },
  category: {
    type: DataTypes.STRING(50),
    allowNull: false,
    validate: {
      isIn: [['exploration', 'combat', 'trade', 'colony', 'social', 'progression', 'special']]
    }
  },
  icon: {
    type: DataTypes.STRING(100),
    allowNull: true,
    comment: 'Icon key for frontend rendering'
  },
  rarity: {
    type: DataTypes.STRING(20),
    allowNull: false,
    defaultValue: 'common',
    validate: {
      isIn: [['common', 'uncommon', 'rare', 'epic', 'legendary']]
    }
  },
  target_value: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 1,
    comment: 'Target count to unlock (1 for one-shot achievements)'
  },
  reward_credits: {
    type: DataTypes.BIGINT,
    allowNull: false,
    defaultValue: 0
  },
  reward_xp: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 0
  },
  reward_cosmetic_type: {
    type: DataTypes.STRING(30),
    allowNull: true,
    comment: 'Optional cosmetic reward type for CosmeticUnlock compatibility'
  },
  reward_cosmetic_id: {
    type: DataTypes.STRING(50),
    allowNull: true,
    comment: 'Optional cosmetic unlock reward ID'
  },
  reward_title: {
    type: DataTypes.STRING(100),
    allowNull: true,
    comment: 'Optional title reward (e.g., "Master Trader")'
  },
  is_hidden: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
    comment: 'Hidden achievements show as ??? until unlocked'
  },
  is_active: {
    type: DataTypes.BOOLEAN,
    defaultValue: true
  },
  sort_order: {
    type: DataTypes.INTEGER,
    defaultValue: 0
  },
  created_at: {
    type: DataTypes.DATE,
    allowNull: false,
    defaultValue: DataTypes.NOW
  }
}, {
  tableName: 'achievements',
  timestamps: false,
  indexes: [
    { fields: ['category'] },
    { fields: ['rarity'] },
    { fields: ['is_active'] }
  ]
});

module.exports = Achievement;
