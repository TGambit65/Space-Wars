const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const CraftingJob = sequelize.define('CraftingJob', {
  crafting_job_id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  user_id: {
    type: DataTypes.UUID,
    allowNull: false,
    references: { model: 'users', key: 'user_id' }
  },
  blueprint_id: {
    type: DataTypes.UUID,
    allowNull: false,
    references: { model: 'blueprints', key: 'blueprint_id' }
  },
  ship_id: {
    type: DataTypes.UUID,
    allowNull: false,
    references: { model: 'ships', key: 'ship_id' }
  },
  status: {
    type: DataTypes.STRING(20),
    defaultValue: 'in_progress',
    validate: { isIn: [['in_progress', 'completed', 'cancelled']] }
  },
  started_at: {
    type: DataTypes.DATE,
    allowNull: false
  },
  completes_at: {
    type: DataTypes.DATE,
    allowNull: false
  },
  completed_at: {
    type: DataTypes.DATE,
    allowNull: true
  }
}, {
  tableName: 'crafting_jobs',
  timestamps: true,
  indexes: [
    { fields: ['user_id', 'status'] },
    { fields: ['completes_at'] },
    { fields: ['status'] }
  ]
});

module.exports = CraftingJob;
