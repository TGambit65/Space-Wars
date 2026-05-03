const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const DerelictManifest = sequelize.define('DerelictManifest', {
  derelict_id: {
    type: DataTypes.STRING(128),
    primaryKey: true
  },
  manifest: {
    type: DataTypes.JSON,
    allowNull: false
  },
  looted: {
    type: DataTypes.JSON,
    allowNull: false,
    defaultValue: {}
  },
  expires_at: {
    type: DataTypes.DATE,
    allowNull: false
  },
  created_at: {
    type: DataTypes.DATE,
    allowNull: false,
    defaultValue: DataTypes.NOW
  }
}, {
  tableName: 'derelict_manifests',
  timestamps: false,
  indexes: [
    { fields: ['expires_at'] }
  ]
});

module.exports = DerelictManifest;
