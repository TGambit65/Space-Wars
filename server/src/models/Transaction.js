const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const Transaction = sequelize.define('Transaction', {
  transaction_id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  user_id: {
    type: DataTypes.UUID,
    allowNull: false,
    references: {
      model: 'users',
      key: 'user_id'
    }
  },
  ship_id: {
    type: DataTypes.UUID,
    allowNull: false,
    references: {
      model: 'ships',
      key: 'ship_id'
    }
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
  transaction_type: {
    type: DataTypes.STRING(10),
    allowNull: false,
    validate: {
      isIn: [['BUY', 'SELL']]
    }
  },
  quantity: {
    type: DataTypes.INTEGER,
    allowNull: false,
    validate: {
      min: 1
    }
  },
  unit_price: {
    type: DataTypes.INTEGER,
    allowNull: false
  },
  tax_amount: {
    type: DataTypes.INTEGER,
    defaultValue: 0
  },
  total_price: {
    type: DataTypes.BIGINT,
    allowNull: false
  }
}, {
  tableName: 'transactions',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: false,
  indexes: [
    {
      fields: ['user_id']
    },
    {
      fields: ['port_id']
    },
    {
      fields: ['commodity_id']
    },
    {
      fields: ['created_at']
    },
    {
      fields: ['transaction_type']
    }
  ]
});

module.exports = Transaction;

