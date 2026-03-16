const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const TransferLedger = sequelize.define('TransferLedger', {
  transfer_ledger_id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  user_id: {
    type: DataTypes.UUID,
    allowNull: true,
    references: {
      model: 'users',
      key: 'user_id'
    }
  },
  transfer_type: {
    type: DataTypes.STRING(50),
    allowNull: false
  },
  source_type: {
    type: DataTypes.STRING(30),
    allowNull: false
  },
  source_id: {
    type: DataTypes.STRING(100),
    allowNull: true
  },
  destination_type: {
    type: DataTypes.STRING(30),
    allowNull: false
  },
  destination_id: {
    type: DataTypes.STRING(100),
    allowNull: true
  },
  credits_amount: {
    type: DataTypes.BIGINT,
    allowNull: false,
    defaultValue: 0
  },
  commodity_id: {
    type: DataTypes.UUID,
    allowNull: true,
    references: {
      model: 'commodities',
      key: 'commodity_id'
    }
  },
  commodity_quantity: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 0
  },
  status: {
    type: DataTypes.STRING(20),
    allowNull: false,
    defaultValue: 'completed',
    validate: {
      isIn: [['completed', 'denied', 'replayed']]
    }
  },
  idempotency_key: {
    type: DataTypes.STRING(120),
    allowNull: true,
    unique: true
  },
  risk_flags: {
    type: DataTypes.JSON,
    allowNull: false,
    defaultValue: []
  },
  metadata: {
    type: DataTypes.JSON,
    allowNull: false,
    defaultValue: {}
  },
  result_payload: {
    type: DataTypes.JSON,
    allowNull: true,
    defaultValue: null
  },
  created_at: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW
  }
}, {
  tableName: 'transfer_ledgers',
  timestamps: false,
  indexes: [
    { fields: ['user_id'] },
    { fields: ['transfer_type'] },
    { fields: ['created_at'] },
    { fields: ['status'] }
  ]
});

module.exports = TransferLedger;
