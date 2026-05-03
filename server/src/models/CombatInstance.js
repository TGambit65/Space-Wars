const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const CombatInstance = sequelize.define('CombatInstance', {
  combat_id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  sector_id: {
    type: DataTypes.UUID,
    allowNull: false,
    references: { model: 'sectors', key: 'sector_id' }
  },
  status: {
    type: DataTypes.STRING(20),
    defaultValue: 'active',
    validate: {
      isIn: [['active', 'resolved']]
    }
  },
  combat_type: {
    type: DataTypes.STRING(10),
    allowNull: false,
    defaultValue: 'PVE',
    comment: 'PVE | PVP | MIXED'
  },
  participants: {
    type: DataTypes.JSON,
    defaultValue: [],
    comment: 'Array of ship IDs involved'
  },
  result: {
    type: DataTypes.JSON,
    allowNull: true,
    comment: 'Combat outcome: winner, damage dealt, loot'
  },
  state: {
    type: DataTypes.JSON,
    allowNull: true,
    comment: 'Snapshot of live combat state (ships) for crash recovery'
  },
  tick_seq: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 0,
    comment: 'Last persisted server tick sequence number'
  },
  last_tick_at: {
    type: DataTypes.DATE,
    allowNull: true
  },
  started_at: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW
  },
  ended_at: {
    type: DataTypes.DATE,
    allowNull: true
  }
}, {
  tableName: 'combat_instances',
  timestamps: false,
  indexes: [
    { fields: ['sector_id'] },
    { fields: ['status'] }
  ]
});

module.exports = CombatInstance;
