const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const AutomatedTask = sequelize.define('AutomatedTask', {
  task_id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  user_id: {
    type: DataTypes.UUID,
    allowNull: false,
    references: { model: 'users', key: 'user_id' }
  },
  ship_id: {
    type: DataTypes.UUID,
    allowNull: false,
    references: { model: 'ships', key: 'ship_id' }
  },
  task_type: {
    type: DataTypes.STRING(30),
    allowNull: false,
    validate: { isIn: [['trade_route', 'mining_run', 'patrol_route']] }
  },
  status: {
    type: DataTypes.STRING(20),
    defaultValue: 'active',
    validate: { isIn: [['active', 'paused', 'completed', 'error']] }
  },
  task_config: {
    type: DataTypes.JSON,
    allowNull: false
  },
  current_step: {
    type: DataTypes.INTEGER,
    defaultValue: 0
  },
  total_steps: {
    type: DataTypes.INTEGER,
    allowNull: false
  },
  runs_completed: {
    type: DataTypes.INTEGER,
    defaultValue: 0
  },
  max_runs: {
    type: DataTypes.INTEGER,
    defaultValue: -1,
    comment: '-1 means infinite'
  },
  credits_earned: {
    type: DataTypes.BIGINT,
    defaultValue: 0
  },
  last_executed_at: {
    type: DataTypes.DATE,
    allowNull: true
  },
  error_message: {
    type: DataTypes.STRING(500),
    allowNull: true
  },
  required_tech: {
    type: DataTypes.STRING(80),
    defaultValue: 'AUTOMATION_I'
  }
}, {
  tableName: 'automated_tasks',
  timestamps: true,
  indexes: [
    { fields: ['user_id', 'status'] },
    { fields: ['status'] },
    { fields: ['ship_id'] }
  ]
});

module.exports = AutomatedTask;
