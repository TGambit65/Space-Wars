const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const Artifact = sequelize.define('Artifact', {
  artifact_id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  name: {
    type: DataTypes.STRING(100),
    allowNull: false
  },
  description: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  bonus_type: {
    type: DataTypes.STRING(30),
    allowNull: true,
    comment: 'Type of bonus this artifact provides (placeholder for Phase 5)'
  },
  bonus_value: {
    type: DataTypes.FLOAT,
    defaultValue: 0,
    comment: 'Magnitude of the bonus (placeholder for Phase 5)'
  },
  rarity: {
    type: DataTypes.FLOAT,
    defaultValue: 0.1,
    validate: {
      min: 0.01,
      max: 1.0
    },
    comment: 'Rarity factor (lower = rarer)'
  },
  location_planet_id: {
    type: DataTypes.UUID,
    allowNull: true,
    references: {
      model: 'planets',
      key: 'planet_id'
    },
    comment: 'Planet where artifact is located (null if collected)'
  },
  owner_user_id: {
    type: DataTypes.UUID,
    allowNull: true,
    references: {
      model: 'users',
      key: 'user_id'
    },
    comment: 'User who owns this artifact (null if undiscovered)'
  },
  is_discovered: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
    comment: 'Whether the artifact has been found via scanning'
  },
  discovered_by_user_id: {
    type: DataTypes.UUID,
    allowNull: true,
    references: {
      model: 'users',
      key: 'user_id'
    },
    comment: 'User who first discovered this artifact'
  },
  discovered_at: {
    type: DataTypes.DATE,
    allowNull: true
  }
}, {
  tableName: 'artifacts',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at',
  indexes: [
    {
      fields: ['location_planet_id']
    },
    {
      fields: ['owner_user_id']
    },
    {
      fields: ['is_discovered']
    },
    {
      fields: ['bonus_type']
    }
  ]
});

module.exports = Artifact;

