const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

// Junction table for sector adjacency (bidirectional connections)
const SectorConnection = sequelize.define('SectorConnection', {
  connection_id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  sector_a_id: {
    type: DataTypes.UUID,
    allowNull: false,
    references: {
      model: 'sectors',
      key: 'sector_id'
    }
  },
  sector_b_id: {
    type: DataTypes.UUID,
    allowNull: false,
    references: {
      model: 'sectors',
      key: 'sector_id'
    }
  },
  connection_type: {
    type: DataTypes.STRING(20),
    defaultValue: 'standard',
    validate: {
      isIn: [['standard', 'wormhole', 'gate']]
    }
  },
  travel_time: {
    type: DataTypes.INTEGER,
    defaultValue: 1,
    comment: 'Time units to traverse this connection'
  },
  is_bidirectional: {
    type: DataTypes.BOOLEAN,
    defaultValue: true
  }
}, {
  tableName: 'sector_connections',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: false,
  indexes: [
    {
      fields: ['sector_a_id']
    },
    {
      fields: ['sector_b_id']
    },
    {
      unique: true,
      fields: ['sector_a_id', 'sector_b_id']
    }
  ]
});

module.exports = SectorConnection;

