const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const Commodity = sequelize.define('Commodity', {
  commodity_id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  name: {
    type: DataTypes.STRING(50),
    allowNull: false,
    unique: true
  },
  category: {
    type: DataTypes.STRING(30),
    allowNull: false,
    validate: {
      isIn: [['Essential', 'Industrial', 'Technology', 'Luxury', 'Organic', 'Contraband']]
    }
  },
  base_price: {
    type: DataTypes.INTEGER,
    allowNull: false,
    validate: {
      min: 1
    }
  },
  volume_per_unit: {
    type: DataTypes.INTEGER,
    defaultValue: 1,
    allowNull: false,
    validate: {
      min: 1
    }
  },
  description: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  is_legal: {
    type: DataTypes.BOOLEAN,
    defaultValue: true
  },
  volatility: {
    type: DataTypes.FLOAT,
    defaultValue: 0.3,
    validate: {
      min: 0,
      max: 1
    }
  }
}, {
  tableName: 'commodities',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at'
});

module.exports = Commodity;

