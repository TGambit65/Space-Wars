const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const PlayerProtectionState = sequelize.define('PlayerProtectionState', {
  protection_state_id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  user_id: {
    type: DataTypes.UUID,
    allowNull: false,
    unique: true,
    references: {
      model: 'users',
      key: 'user_id'
    }
  },
  newbie_protection_until: {
    type: DataTypes.DATE,
    allowNull: true
  },
  travel_protection_until: {
    type: DataTypes.DATE,
    allowNull: true
  },
  travel_protection_reason: {
    type: DataTypes.STRING(50),
    allowNull: true
  },
  hostility_until: {
    type: DataTypes.DATE,
    allowNull: true
  },
  last_hostile_action_at: {
    type: DataTypes.DATE,
    allowNull: true
  },
  pvp_toggle_cooldown_until: {
    type: DataTypes.DATE,
    allowNull: true
  },
  created_at: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW
  },
  updated_at: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW
  }
}, {
  tableName: 'player_protection_states',
  timestamps: false,
  indexes: [
    { fields: ['user_id'], unique: true },
    { fields: ['hostility_until'] },
    { fields: ['travel_protection_until'] }
  ]
});

module.exports = PlayerProtectionState;
