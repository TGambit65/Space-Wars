const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const ShipCargo = sequelize.define('ShipCargo', {
  ship_cargo_id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  ship_id: {
    type: DataTypes.UUID,
    allowNull: false,
    references: {
      model: 'ships',
      key: 'ship_id'
    }
  },
  commodity_id: {
    type: DataTypes.UUID,
    allowNull: false,
    references: {
      model: 'commodities',
      key: 'commodity_id'
    }
  },
  quantity: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 0,
    validate: {
      min: 0
    }
  }
}, {
  tableName: 'ship_cargo',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at',
  indexes: [
    {
      unique: true,
      fields: ['ship_id', 'commodity_id']
    },
    {
      fields: ['ship_id']
    },
    {
      fields: ['commodity_id']
    }
  ]
});

module.exports = ShipCargo;

