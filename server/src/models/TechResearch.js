const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const TechResearch = sequelize.define('TechResearch', {
  tech_research_id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  user_id: {
    type: DataTypes.UUID,
    allowNull: false,
    references: { model: 'users', key: 'user_id' }
  },
  tech_name: {
    type: DataTypes.STRING(80),
    allowNull: false
  },
  is_completed: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  },
  started_at: {
    type: DataTypes.DATE,
    allowNull: false
  },
  completes_at: {
    type: DataTypes.DATE,
    allowNull: true
  },
  credits_spent: {
    type: DataTypes.INTEGER,
    defaultValue: 0
  }
}, {
  tableName: 'tech_research',
  timestamps: true,
  indexes: [
    { unique: true, fields: ['user_id', 'tech_name'] },
    { fields: ['user_id', 'is_completed'] }
  ]
});

module.exports = TechResearch;
