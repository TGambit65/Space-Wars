const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const PlanetResource = sequelize.define('PlanetResource', {
  planet_resource_id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  planet_id: {
    type: DataTypes.UUID,
    allowNull: false,
    references: {
      model: 'planets',
      key: 'planet_id'
    }
  },
  resource_type: {
    type: DataTypes.STRING(50),
    allowNull: false,
    comment: 'Type of resource (e.g., Iron Ore, Water, Silicon)'
  },
  abundance: {
    type: DataTypes.FLOAT,
    defaultValue: 1.0,
    validate: {
      min: 0.1,
      max: 10.0
    },
    comment: 'Resource abundance multiplier for extraction rate'
  },
  total_quantity: {
    type: DataTypes.INTEGER,
    defaultValue: 10000,
    comment: 'Total extractable quantity (can be depleted)'
  },
  extracted_quantity: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
    comment: 'Amount already extracted'
  }
}, {
  tableName: 'planet_resources',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at',
  indexes: [
    {
      fields: ['planet_id']
    },
    {
      fields: ['resource_type']
    },
    {
      unique: true,
      fields: ['planet_id', 'resource_type']
    }
  ]
});

module.exports = PlanetResource;

