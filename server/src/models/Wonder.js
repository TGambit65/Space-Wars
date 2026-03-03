const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const Wonder = sequelize.define('Wonder', {
  wonder_id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  colony_id: {
    type: DataTypes.UUID,
    allowNull: false,
    references: { model: 'colonies', key: 'colony_id' }
  },
  wonder_type: {
    type: DataTypes.STRING(50),
    allowNull: false
  },
  name: {
    type: DataTypes.STRING(100),
    allowNull: false
  },
  bonus_type: {
    type: DataTypes.STRING(30),
    allowNull: false
  },
  bonus_value: {
    type: DataTypes.FLOAT,
    defaultValue: 0
  },
  construction_phase: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
    validate: { min: 0 }
  },
  max_phases: {
    type: DataTypes.INTEGER,
    defaultValue: 5
  },
  is_completed: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  },
  credits_invested: {
    type: DataTypes.BIGINT,
    defaultValue: 0
  },
  completed_at: {
    type: DataTypes.DATE,
    allowNull: true
  }
}, {
  tableName: 'wonders',
  timestamps: true,
  indexes: [
    { fields: ['colony_id'] },
    { fields: ['is_completed'] },
    { fields: ['wonder_type'] }
  ]
});

module.exports = Wonder;
