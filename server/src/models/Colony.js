const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const Colony = sequelize.define('Colony', {
  colony_id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  planet_id: {
    type: DataTypes.UUID,
    allowNull: false,
    unique: true,
    references: {
      model: 'planets',
      key: 'planet_id'
    },
    comment: 'One colony per planet'
  },
  user_id: {
    type: DataTypes.UUID,
    allowNull: false,
    references: {
      model: 'users',
      key: 'user_id'
    }
  },
  name: {
    type: DataTypes.STRING(100),
    allowNull: false
  },
  population: {
    type: DataTypes.INTEGER,
    defaultValue: 100,
    validate: {
      min: 0
    },
    comment: 'Colony population count'
  },
  infrastructure_level: {
    type: DataTypes.INTEGER,
    defaultValue: 1,
    validate: {
      min: 1,
      max: 10
    },
    comment: 'Simple infrastructure level affecting resource production'
  },
  last_resource_tick: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW,
    comment: 'Last time resources were generated'
  },
  developing_until: {
    type: DataTypes.DATE,
    allowNull: true,
    defaultValue: null,
    comment: 'Colony is locked until this time. Null = fully developed.'
  },
  is_active: {
    type: DataTypes.BOOLEAN,
    defaultValue: true
  },
  defense_rating: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
    comment: 'Colony defense strength from buildings and garrison'
  },
  last_raid: {
    type: DataTypes.DATE,
    allowNull: true,
    defaultValue: null,
    comment: 'Timestamp of most recent raid event'
  },
  raid_damage: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
    comment: 'Accumulated unrepaired damage from raids'
  },
  surface_initialized: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
    comment: 'Whether the colony surface grid has been initialized'
  },
  surface_version: {
    type: DataTypes.INTEGER,
    defaultValue: 1,
    comment: 'Terrain generation algorithm version for seed versioning'
  },
  last_anomaly_spawn: {
    type: DataTypes.DATE,
    allowNull: true,
    defaultValue: null,
    comment: 'Last UTC day bucket when anomalies were spawned'
  },
  defender_policy: {
    type: DataTypes.STRING(50),
    defaultValue: 'hold_the_line',
    comment: 'AI behavior policy when colony is attacked while owner offline'
  }
}, {
  tableName: 'colonies',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at',
  indexes: [
    {
      fields: ['user_id']
    },
    {
      fields: ['is_active']
    }
  ]
});

module.exports = Colony;

