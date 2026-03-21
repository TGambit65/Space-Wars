const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const NpcMemory = sequelize.define('NpcMemory', {
  memory_id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  npc_id: {
    type: DataTypes.UUID,
    allowNull: false,
    references: { model: 'npcs', key: 'npc_id' }
  },
  user_id: {
    type: DataTypes.UUID,
    allowNull: false,
    references: { model: 'users', key: 'user_id' }
  },
  // Relationship scores (-1.0 to 1.0)
  trust: {
    type: DataTypes.FLOAT,
    defaultValue: 0,
    validate: { min: -1, max: 1 }
  },
  fear: {
    type: DataTypes.FLOAT,
    defaultValue: 0,
    validate: { min: -1, max: 1 }
  },
  respect: {
    type: DataTypes.FLOAT,
    defaultValue: 0,
    validate: { min: -1, max: 1 }
  },
  // Interaction tracking
  interaction_count: {
    type: DataTypes.INTEGER,
    defaultValue: 0
  },
  last_interaction_type: {
    type: DataTypes.STRING(50),
    allowNull: true
  },
  // Bounded memory bullets (max ~10 entries)
  memories: {
    type: DataTypes.JSON,
    defaultValue: []
  },
  // Notable fact for quick reference
  notable_fact: {
    type: DataTypes.STRING(200),
    allowNull: true
  },
  last_interaction_at: {
    type: DataTypes.DATE,
    allowNull: true
  }
}, {
  tableName: 'npc_memories',
  timestamps: true,
  indexes: [
    { unique: true, fields: ['npc_id', 'user_id'] },
    { fields: ['user_id'] },
    { fields: ['last_interaction_at'] }
  ]
});

module.exports = NpcMemory;
