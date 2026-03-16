/**
 * GroundCombatInstance — tracks an active or resolved ground combat encounter.
 * One active instance per colony at a time.
 */
const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const GroundCombatInstance = sequelize.define('GroundCombatInstance', {
  instance_id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  planet_id: {
    type: DataTypes.UUID,
    allowNull: false,
    comment: 'Denormalized for query efficiency — avoids Colony join'
  },
  colony_id: {
    type: DataTypes.UUID,
    allowNull: false,
    references: { model: 'colonies', key: 'colony_id' }
  },
  attacker_id: {
    type: DataTypes.UUID,
    allowNull: true,
    references: { model: 'users', key: 'user_id' },
    comment: 'Null for NPC raids (system-generated attackers)'
  },
  defender_id: {
    type: DataTypes.UUID,
    allowNull: true,
    references: { model: 'users', key: 'user_id' },
    comment: 'Null for NPC-defended colonies'
  },
  attacker_ship_id: {
    type: DataTypes.UUID,
    allowNull: true,
    references: { model: 'ships', key: 'ship_id' },
    comment: 'Ship used for orbital deployment'
  },
  status: {
    type: DataTypes.STRING(20),
    defaultValue: 'deploying',
    validate: { isIn: [['deploying', 'active', 'attacker_won', 'defender_won', 'attacker_retreated']] }
  },
  turn_number: {
    type: DataTypes.INTEGER,
    defaultValue: 0
  },
  max_turns: {
    type: DataTypes.INTEGER,
    defaultValue: 30,
    comment: 'Global turn limit — attacker forfeits if exceeded'
  },
  combat_log: {
    type: DataTypes.JSON,
    defaultValue: []
  },
  defender_policy: {
    type: DataTypes.STRING(50),
    defaultValue: 'hold_the_line',
    validate: { isIn: [['hold_the_line', 'aggressive', 'fallback_to_center', 'guerrilla']] }
  },
  started_at: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW
  },
  last_turn_at: {
    type: DataTypes.DATE,
    allowNull: true,
    defaultValue: null
  }
}, {
  tableName: 'ground_combat_instances',
  timestamps: true,
  indexes: [
    { fields: ['colony_id'] },
    { fields: ['attacker_id'] },
    { fields: ['status'] },
    { fields: ['colony_id', 'status'] }
  ]
});

module.exports = GroundCombatInstance;
