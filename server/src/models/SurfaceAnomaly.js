const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const SurfaceAnomaly = sequelize.define('SurfaceAnomaly', {
  anomaly_id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  colony_id: {
    type: DataTypes.UUID,
    allowNull: false,
    references: { model: 'colonies', key: 'colony_id' }
  },
  grid_x: {
    type: DataTypes.INTEGER,
    allowNull: false
  },
  grid_y: {
    type: DataTypes.INTEGER,
    allowNull: false
  },
  anomaly_type: {
    type: DataTypes.STRING(50),
    allowNull: false
  },
  reward_type: {
    type: DataTypes.STRING(50),
    allowNull: false
  },
  reward_amount: {
    type: DataTypes.INTEGER,
    allowNull: false
  },
  expires_at: {
    type: DataTypes.DATE,
    allowNull: false
  }
}, {
  tableName: 'surface_anomalies',
  timestamps: true,
  indexes: [
    { fields: ['colony_id'] },
    { fields: ['colony_id', 'expires_at'] }
  ]
});

module.exports = SurfaceAnomaly;
