const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const Sector = sequelize.define('Sector', {
  sector_id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  x_coord: {
    type: DataTypes.INTEGER,
    allowNull: false
  },
  y_coord: {
    type: DataTypes.INTEGER,
    allowNull: false
  },
  z_coord: {
    type: DataTypes.INTEGER,
    allowNull: true,
    defaultValue: 0
  },
  name: {
    type: DataTypes.STRING(100),
    allowNull: false
  },
  type: {
    type: DataTypes.STRING(20),
    defaultValue: 'Unknown',
    allowNull: false,
    validate: {
      isIn: [['Core', 'Inner', 'Mid', 'Outer', 'Fringe', 'Unknown']]
    }
  },
  description: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  is_starting_sector: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  },
  hazard_level: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
    validate: {
      min: 0,
      max: 10
    }
  }
}, {
  tableName: 'sectors',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at',
  indexes: [
    {
      unique: true,
      fields: ['x_coord', 'y_coord', 'z_coord']
    }
  ]
});

module.exports = Sector;

