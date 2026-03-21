const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const Job = sequelize.define('Job', {
  job_id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  type: {
    type: DataTypes.STRING(100),
    allowNull: false,
    comment: 'Handler key: economy_tick, crafting_complete, npc_spawn, etc.'
  },
  status: {
    type: DataTypes.STRING(20),
    allowNull: false,
    defaultValue: 'pending',
    validate: {
      isIn: [['pending', 'processing', 'completed', 'failed', 'dead']]
    }
  },
  payload: {
    type: DataTypes.JSON,
    allowNull: false,
    defaultValue: {}
  },
  result: {
    type: DataTypes.JSON,
    allowNull: true,
    defaultValue: null
  },
  priority: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 0,
    comment: 'Higher = processed first'
  },
  attempts: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 0
  },
  max_attempts: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 3
  },
  last_error: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  run_at: {
    type: DataTypes.DATE,
    allowNull: false,
    defaultValue: DataTypes.NOW,
    comment: 'Earliest time this job can run (for scheduling)'
  },
  started_at: {
    type: DataTypes.DATE,
    allowNull: true
  },
  completed_at: {
    type: DataTypes.DATE,
    allowNull: true
  },
  created_at: {
    type: DataTypes.DATE,
    allowNull: false,
    defaultValue: DataTypes.NOW
  }
}, {
  tableName: 'jobs',
  timestamps: false,
  indexes: [
    { fields: ['status', 'run_at', 'priority'], name: 'idx_jobs_pending_queue' },
    { fields: ['type'] },
    { fields: ['status'] },
    { fields: ['created_at'] }
  ]
});

module.exports = Job;
