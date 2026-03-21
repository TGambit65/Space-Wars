const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const Mission = sequelize.define('Mission', {
  mission_id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  port_id: {
    type: DataTypes.UUID,
    allowNull: true,
    references: { model: 'ports', key: 'port_id' }
  },
  issued_by_npc_id: {
    type: DataTypes.UUID,
    allowNull: true,
    references: { model: 'npcs', key: 'npc_id' }
  },
  mission_type: {
    type: DataTypes.STRING(30),
    allowNull: false,
    validate: { isIn: [['delivery', 'bounty', 'scan', 'trade_volume', 'patrol']] }
  },
  title: {
    type: DataTypes.STRING(200),
    allowNull: false
  },
  description: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  requirements: {
    type: DataTypes.JSON,
    allowNull: false
  },
  reward_credits: {
    type: DataTypes.INTEGER,
    allowNull: false
  },
  reward_xp: {
    type: DataTypes.INTEGER,
    defaultValue: 0
  },
  min_level: {
    type: DataTypes.INTEGER,
    defaultValue: 1
  },
  max_level: {
    type: DataTypes.INTEGER,
    defaultValue: 100
  },
  expires_at: {
    type: DataTypes.DATE,
    allowNull: false
  },
  is_active: {
    type: DataTypes.BOOLEAN,
    defaultValue: true
  }
}, {
  tableName: 'missions',
  timestamps: true,
  indexes: [
    { fields: ['port_id', 'is_active'] },
    { fields: ['issued_by_npc_id'] },
    { fields: ['mission_type'] },
    { fields: ['expires_at'] }
  ]
});

module.exports = Mission;
