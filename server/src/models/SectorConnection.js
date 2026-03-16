const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const clearSectorMapCache = () => {
  try {
    require('../controllers/sectorController').clearMapCache();
  } catch (_) {
    // Cache invalidation is best-effort during model bootstrap.
  }
};

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
      isIn: [['standard', 'wormhole', 'gate', 'portal']]
    }
  },
  lane_class: {
    type: DataTypes.STRING(30),
    allowNull: false,
    defaultValue: 'hyperlane',
    validate: {
      isIn: [['hyperlane', 'protected', 'wormhole', 'gate', 'portal']]
    }
  },
  access_mode: {
    type: DataTypes.STRING(30),
    allowNull: false,
    defaultValue: 'public',
    validate: {
      isIn: [['public', 'owner', 'corporation', 'corporation_allies', 'faction', 'locked']]
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
  },
  rule_flags: {
    type: DataTypes.JSON,
    allowNull: false,
    defaultValue: {},
    comment: 'Sprint travel metadata: safe route preference, cooldowns, tolls, and gating'
  }
}, {
  tableName: 'sector_connections',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: false,
  hooks: {
    afterCreate: clearSectorMapCache,
    afterUpdate: clearSectorMapCache,
    afterDestroy: clearSectorMapCache
  },
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
    },
    {
      fields: ['lane_class']
    },
    {
      fields: ['access_mode']
    }
  ]
});

module.exports = SectorConnection;
