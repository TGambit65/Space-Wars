/**
 * GroundUnit — persistent ground force roster.
 * Each unit is a distinct row with its own HP.
 * Location tracked via concrete nullable FKs: colony_id, ship_id, combat_instance_id.
 */
const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const GroundUnit = sequelize.define('GroundUnit', {
  unit_id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  owner_user_id: {
    type: DataTypes.UUID,
    allowNull: false,
    references: { model: 'users', key: 'user_id' }
  },
  unit_type: {
    type: DataTypes.STRING(50),
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
  morale: {
    type: DataTypes.FLOAT,
    defaultValue: 1.0,
    validate: { min: 0.0, max: 1.0 }
  },
  experience: {
    type: DataTypes.INTEGER,
    defaultValue: 0
  },
  colony_id: {
    type: DataTypes.UUID,
    allowNull: true,
    defaultValue: null,
    references: { model: 'colonies', key: 'colony_id' },
    comment: 'Set when garrisoned at a colony'
  },
  ship_id: {
    type: DataTypes.UUID,
    allowNull: true,
    defaultValue: null,
    references: { model: 'ships', key: 'ship_id' },
    comment: 'Set when aboard a ship for transport'
  },
  combat_instance_id: {
    type: DataTypes.UUID,
    allowNull: true,
    defaultValue: null,
    comment: 'Set when deployed in active ground combat'
  },
  is_active: {
    type: DataTypes.BOOLEAN,
    defaultValue: true,
    comment: 'False when deactivated due to upkeep failure'
  },
  training_until: {
    type: DataTypes.DATE,
    allowNull: true,
    defaultValue: null,
    comment: 'Null = fully trained; date = still in training'
  }
}, {
  tableName: 'ground_units',
  timestamps: true,
  indexes: [
    { fields: ['owner_user_id'] },
    { fields: ['colony_id'] },
    { fields: ['ship_id'] },
    { fields: ['combat_instance_id'] }
  ]
});

module.exports = GroundUnit;
