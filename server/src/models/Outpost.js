const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const Outpost = sequelize.define('Outpost', {
  outpost_id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  user_id: {
    type: DataTypes.UUID,
    allowNull: true,
    references: { model: 'users', key: 'user_id' }
  },
  corporation_id: {
    type: DataTypes.UUID,
    allowNull: true,
    references: { model: 'corporations', key: 'corporation_id' }
  },
  sector_id: {
    type: DataTypes.UUID,
    allowNull: false,
    references: { model: 'sectors', key: 'sector_id' }
  },
  name: {
    type: DataTypes.STRING(100),
    allowNull: false
  },
  outpost_type: {
    type: DataTypes.STRING(30),
    allowNull: false,
    validate: {
      isIn: [['trade_relay', 'scanner_post', 'defense_platform', 'fuel_cache']]
    }
  },
  level: {
    type: DataTypes.INTEGER,
    defaultValue: 1
  },
  resources: {
    type: DataTypes.JSON,
    defaultValue: {},
    comment: 'Stored resources for outpost operation'
  },
  is_active: {
    type: DataTypes.BOOLEAN,
    defaultValue: true
  }
}, {
  tableName: 'outposts',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at',
  indexes: [
    { fields: ['sector_id'] },
    { fields: ['user_id'] },
    { fields: ['corporation_id'] }
  ]
});

module.exports = Outpost;
