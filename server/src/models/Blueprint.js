const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const Blueprint = sequelize.define('Blueprint', {
  blueprint_id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  name: {
    type: DataTypes.STRING(100),
    allowNull: false,
    unique: true
  },
  category: {
    type: DataTypes.STRING(30),
    allowNull: false,
    validate: { isIn: [['component', 'commodity']] }
  },
  output_type: {
    type: DataTypes.STRING(50),
    allowNull: false
  },
  output_name: {
    type: DataTypes.STRING(100),
    allowNull: false
  },
  output_quantity: {
    type: DataTypes.INTEGER,
    defaultValue: 1
  },
  crafting_time: {
    type: DataTypes.INTEGER,
    allowNull: false,
    comment: 'Crafting time in milliseconds'
  },
  required_level: {
    type: DataTypes.INTEGER,
    defaultValue: 1
  },
  required_tech: {
    type: DataTypes.STRING(80),
    allowNull: true
  },
  ingredients: {
    type: DataTypes.JSON,
    allowNull: false
  },
  credits_cost: {
    type: DataTypes.INTEGER,
    defaultValue: 0
  },
  description: {
    type: DataTypes.STRING(500),
    allowNull: true
  }
}, {
  tableName: 'blueprints',
  timestamps: true,
  indexes: [
    { fields: ['category'] },
    { fields: ['required_level'] }
  ]
});

module.exports = Blueprint;
