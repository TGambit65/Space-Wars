const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const Corporation = sequelize.define('Corporation', {
  corporation_id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  name: {
    type: DataTypes.STRING(100),
    allowNull: false,
    unique: true
  },
  tag: {
    type: DataTypes.STRING(10),
    allowNull: false,
    unique: true
  },
  description: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  leader_user_id: {
    type: DataTypes.UUID,
    allowNull: false,
    references: { model: 'users', key: 'user_id' }
  },
  treasury: {
    type: DataTypes.BIGINT,
    defaultValue: 0
  },
  member_count: {
    type: DataTypes.INTEGER,
    defaultValue: 1
  },
  max_members: {
    type: DataTypes.INTEGER,
    defaultValue: 20
  },
  is_active: {
    type: DataTypes.BOOLEAN,
    defaultValue: true
  }
}, {
  tableName: 'corporations',
  timestamps: true,
  indexes: [
    { fields: ['leader_user_id'] },
    { fields: ['is_active'] }
  ]
});

module.exports = Corporation;
