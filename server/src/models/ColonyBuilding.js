const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const ColonyBuilding = sequelize.define('ColonyBuilding', {
  building_id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  colony_id: {
    type: DataTypes.UUID,
    allowNull: false,
    references: { model: 'colonies', key: 'colony_id' }
  },
  building_type: {
    type: DataTypes.STRING(50),
    allowNull: false
  },
  level: {
    type: DataTypes.INTEGER,
    defaultValue: 1,
    validate: { min: 1, max: 3 }
  },
  is_active: {
    type: DataTypes.BOOLEAN,
    defaultValue: true
  },
  workforce: {
    type: DataTypes.INTEGER,
    defaultValue: 0
  },
  condition: {
    type: DataTypes.FLOAT,
    defaultValue: 1.0,
    validate: { min: 0.0, max: 1.0 }
  },
  last_production: {
    type: DataTypes.DATE,
    allowNull: true
  }
}, {
  tableName: 'colony_buildings',
  timestamps: true,
  indexes: [
    { fields: ['colony_id'] },
    { fields: ['building_type'] },
    { fields: ['colony_id', 'is_active'] }
  ]
});

module.exports = ColonyBuilding;
