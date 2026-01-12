const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

/**
 * CombatLog model - records combat encounters and results
 */
const CombatLog = sequelize.define('CombatLog', {
  combat_log_id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  // Attacker info (can be player or NPC)
  attacker_ship_id: {
    type: DataTypes.UUID,
    allowNull: true,
    references: { model: 'ships', key: 'ship_id' }
  },
  attacker_npc_id: {
    type: DataTypes.UUID,
    allowNull: true,
    references: { model: 'npcs', key: 'npc_id' }
  },
  // Defender info (can be player or NPC)
  defender_ship_id: {
    type: DataTypes.UUID,
    allowNull: true,
    references: { model: 'ships', key: 'ship_id' }
  },
  defender_npc_id: {
    type: DataTypes.UUID,
    allowNull: true,
    references: { model: 'npcs', key: 'npc_id' }
  },
  sector_id: {
    type: DataTypes.UUID,
    allowNull: false,
    references: { model: 'sectors', key: 'sector_id' }
  },
  // Combat details
  combat_type: {
    type: DataTypes.STRING(50),
    allowNull: false,
    validate: {
      isIn: [['PVE', 'PVP', 'NPC_VS_NPC']]
    }
  },
  rounds_fought: {
    type: DataTypes.INTEGER,
    defaultValue: 0
  },
  // Outcome
  winner_type: {
    type: DataTypes.STRING(20),
    allowNull: true,
    validate: {
      isIn: [['attacker', 'defender', 'draw', 'fled', null]]
    }
  },
  // Damage dealt
  attacker_damage_dealt: { type: DataTypes.INTEGER, defaultValue: 0 },
  defender_damage_dealt: { type: DataTypes.INTEGER, defaultValue: 0 },
  attacker_hull_remaining: { type: DataTypes.INTEGER, defaultValue: 0 },
  defender_hull_remaining: { type: DataTypes.INTEGER, defaultValue: 0 },
  // Rewards
  credits_looted: { type: DataTypes.INTEGER, defaultValue: 0 },
  experience_gained: { type: DataTypes.INTEGER, defaultValue: 0 },
  // Combat log details (JSON array of combat actions)
  combat_rounds: {
    type: DataTypes.JSON,
    defaultValue: []
  }
}, {
  tableName: 'combat_logs',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at',
  indexes: [
    { fields: ['attacker_ship_id'] },
    { fields: ['defender_ship_id'] },
    { fields: ['attacker_npc_id'] },
    { fields: ['defender_npc_id'] },
    { fields: ['sector_id'] },
    { fields: ['created_at'] }
  ]
});

module.exports = CombatLog;

