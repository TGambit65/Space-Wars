const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const PvpCooldown = sequelize.define('PvpCooldown', {
  cooldown_id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  attacker_user_id: {
    type: DataTypes.UUID,
    allowNull: false,
    references: {
      model: 'users',
      key: 'user_id'
    }
  },
  victim_user_id: {
    type: DataTypes.UUID,
    allowNull: false,
    references: {
      model: 'users',
      key: 'user_id'
    }
  },
  expires_at: {
    type: DataTypes.DATE,
    allowNull: false
  },
  created_at: {
    type: DataTypes.DATE,
    allowNull: false,
    defaultValue: DataTypes.NOW
  }
}, {
  tableName: 'pvp_cooldowns',
  timestamps: false,
  indexes: [
    {
      fields: ['attacker_user_id', 'victim_user_id'],
      unique: true,
      name: 'idx_pvp_cooldown_pair'
    },
    {
      fields: ['expires_at']
    }
  ]
});

module.exports = PvpCooldown;
