const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const ColonyRaidProtection = sequelize.define('ColonyRaidProtection', {
  colony_raid_protection_id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  colony_id: {
    type: DataTypes.UUID,
    allowNull: false,
    unique: true,
    references: {
      model: 'colonies',
      key: 'colony_id'
    }
  },
  raid_blocked_until: {
    type: DataTypes.DATE,
    allowNull: true
  },
  offline_protection_until: {
    type: DataTypes.DATE,
    allowNull: true
  },
  last_attacker_id: {
    type: DataTypes.UUID,
    allowNull: true,
    references: {
      model: 'users',
      key: 'user_id'
    }
  },
  repeated_attack_count: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 0
  },
  repeated_attack_window_until: {
    type: DataTypes.DATE,
    allowNull: true
  },
  last_attack_at: {
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
  tableName: 'colony_raid_protections',
  timestamps: false,
  indexes: [
    { fields: ['colony_id'], unique: true },
    { fields: ['raid_blocked_until'] },
    { fields: ['offline_protection_until'] }
  ]
});

module.exports = ColonyRaidProtection;
