const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const PortCommodity = sequelize.define('PortCommodity', {
  port_commodity_id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  port_id: {
    type: DataTypes.UUID,
    allowNull: false,
    references: {
      model: 'ports',
      key: 'port_id'
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
    defaultValue: 0,
    validate: {
      min: 0
    }
  },
  max_quantity: {
    type: DataTypes.INTEGER,
    defaultValue: 1000,
    validate: {
      min: 1
    }
  },
  buy_price_modifier: {
    type: DataTypes.FLOAT,
    defaultValue: 1.0,
    validate: {
      min: 0.5,
      max: 2.0
    }
  },
  sell_price_modifier: {
    type: DataTypes.FLOAT,
    defaultValue: 1.0,
    validate: {
      min: 0.5,
      max: 2.0
    }
  },
  production_rate: {
    type: DataTypes.INTEGER,
    defaultValue: 0
  },
  consumption_rate: {
    type: DataTypes.INTEGER,
    defaultValue: 0
  },
  can_buy: {
    type: DataTypes.BOOLEAN,
    defaultValue: true
  },
  can_sell: {
    type: DataTypes.BOOLEAN,
    defaultValue: true
  }
}, {
  tableName: 'port_commodities',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at',
  indexes: [
    {
      unique: true,
      fields: ['port_id', 'commodity_id']
    },
    {
      fields: ['port_id']
    },
    {
      fields: ['commodity_id']
    }
  ]
});

module.exports = PortCommodity;

