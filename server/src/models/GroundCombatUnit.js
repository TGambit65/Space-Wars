/**
 * GroundCombatUnit — per-instance combat snapshot.
 * Created from GroundUnit records when combat starts.
 * HP written back to persistent GroundUnit on combat end.
 */
const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const GroundCombatUnit = sequelize.define('GroundCombatUnit', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  combat_instance_id: {
    type: DataTypes.UUID,
    allowNull: false,
    references: { model: 'ground_combat_instances', key: 'instance_id' }
  },
  source_unit_id: {
    type: DataTypes.UUID,
    allowNull: true,
    defaultValue: null,
    references: { model: 'ground_units', key: 'unit_id' },
    comment: 'Null for NPC raid units (no persistent roster entry)'
  },
  owner_user_id: {
    type: DataTypes.UUID,
    allowNull: true,
    defaultValue: null,
    references: { model: 'users', key: 'user_id' },
    comment: 'Null for NPC raid units'
  },
  unit_type: {
    type: DataTypes.STRING(50),
    allowNull: false
  },
  side: {
    type: DataTypes.STRING(20),
    allowNull: false,
    validate: { isIn: [['attacker', 'defender']] }
  },
  grid_x: {
    type: DataTypes.INTEGER,
    allowNull: false
  },
  grid_y: {
    type: DataTypes.INTEGER,
    allowNull: false
  },
  hp_max: {
    type: DataTypes.INTEGER,
    allowNull: false
  },
  hp_remaining: {
    type: DataTypes.INTEGER,
    allowNull: false
  },
  attack: {
    type: DataTypes.INTEGER,
    allowNull: false
  },
  defense: {
    type: DataTypes.INTEGER,
    allowNull: false
  },
  speed: {
    type: DataTypes.INTEGER,
    allowNull: false
  },
  range: {
    type: DataTypes.INTEGER,
    allowNull: false
  },
  status: {
    type: DataTypes.STRING(20),
    defaultValue: 'active',
    validate: { isIn: [['active', 'retreated', 'destroyed']] }
  },
  has_moved: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
    comment: 'Whether unit has moved this turn'
  },
  has_attacked: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
    comment: 'Whether unit has attacked this turn'
  }
}, {
  tableName: 'ground_combat_units',
  timestamps: true,
  indexes: [
    { fields: ['combat_instance_id'] },
    { fields: ['source_unit_id'] },
    { fields: ['combat_instance_id', 'side'] }
  ]
});

module.exports = GroundCombatUnit;
