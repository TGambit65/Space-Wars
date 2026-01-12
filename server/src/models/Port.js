const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const Port = sequelize.define('Port', {
  port_id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  sector_id: {
    type: DataTypes.UUID,
    allowNull: false,
    references: {
      model: 'sectors',
      key: 'sector_id'
    }
  },
  name: {
    type: DataTypes.STRING(100),
    allowNull: false
  },
  type: {
    type: DataTypes.STRING(30),
    allowNull: false,
    validate: {
      isIn: [['Trading Hub', 'Mining Outpost', 'Space Station', 'Agricultural Station', 'Tech Center', 'Black Market', 'Fuel Depot', 'Medical Station']]
    }
  },
  description: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  tax_rate: {
    type: DataTypes.FLOAT,
    defaultValue: 0.05,
    validate: {
      min: 0,
      max: 0.5
    }
  },
  is_active: {
    type: DataTypes.BOOLEAN,
    defaultValue: true
  },
  allows_illegal: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  }
}, {
  tableName: 'ports',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at',
  indexes: [
    {
      fields: ['sector_id']
    },
    {
      fields: ['type']
    },
    {
      fields: ['is_active']
    }
  ]
});

module.exports = Port;

