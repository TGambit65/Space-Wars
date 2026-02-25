const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const PlayerDiscovery = sequelize.define('PlayerDiscovery', {
  discovery_id: {
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
  discovery_type: {
    type: DataTypes.STRING(30),
    allowNull: false,
    validate: {
      isIn: [['planet', 'artifact', 'sector', 'anomaly']]
    },
    comment: 'Type of discovery'
  },
  target_id: {
    type: DataTypes.UUID,
    allowNull: false,
    comment: 'ID of the discovered entity (planet_id, artifact_id, etc.)'
  },
  discovery_data: {
    type: DataTypes.JSONB,
    defaultValue: {},
    comment: 'Additional discovery information (scan results, etc.)'
  }
}, {
  tableName: 'player_discoveries',
  timestamps: true,
  createdAt: 'discovered_at',
  updatedAt: false,
  indexes: [
    {
      fields: ['user_id']
    },
    {
      fields: ['discovery_type']
    },
    {
      unique: true,
      fields: ['user_id', 'discovery_type', 'target_id']
    }
  ]
});

module.exports = PlayerDiscovery;

