const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const Planet = sequelize.define('Planet', {
  planet_id: {
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
    type: DataTypes.STRING(20),
    allowNull: false,
    validate: {
      isIn: [['Terran', 'Desert', 'Ice', 'Volcanic', 'Gas Giant', 'Oceanic', 'Barren', 'Jungle', 'Toxic', 'Crystalline']]
    }
  },
  size: {
    type: DataTypes.INTEGER,
    defaultValue: 5,
    validate: {
      min: 1,
      max: 10
    },
    comment: 'Planet size 1-10, affects resource capacity'
  },
  gravity: {
    type: DataTypes.FLOAT,
    defaultValue: 1.0,
    validate: {
      min: 0.1,
      max: 5.0
    },
    comment: 'Gravity multiplier (1.0 = Earth-like)'
  },
  habitability: {
    type: DataTypes.FLOAT,
    defaultValue: 0.5,
    validate: {
      min: 0.0,
      max: 1.0
    },
    comment: 'How suitable for colonization (0-1)'
  },
  temperature: {
    type: DataTypes.INTEGER,
    defaultValue: 15,
    validate: {
      min: -273,
      max: 1000
    },
    comment: 'Average surface temperature in Celsius'
  },
  owner_user_id: {
    type: DataTypes.UUID,
    allowNull: true,
    references: {
      model: 'users',
      key: 'user_id'
    },
    comment: 'User who colonized this planet (null if uncolonized)'
  },
  has_artifact: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
    comment: 'Whether this planet contains an undiscovered artifact'
  },
  description: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  is_scanned: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
    comment: 'Whether the planet has been scanned to reveal details'
  },
  orbital_position: {
    type: DataTypes.INTEGER,
    allowNull: true,
    validate: {
      min: 1,
      max: 15
    },
    comment: 'Orbital position from star (1=closest, 15=farthest)'
  }
}, {
  tableName: 'planets',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at',
  indexes: [
    {
      fields: ['sector_id']
    },
    {
      fields: ['owner_user_id']
    },
    {
      fields: ['type']
    },
    {
      fields: ['has_artifact']
    }
  ]
});

module.exports = Planet;

