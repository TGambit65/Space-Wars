const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const CorporationMember = sequelize.define('CorporationMember', {
  member_id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  corporation_id: {
    type: DataTypes.UUID,
    allowNull: false,
    references: { model: 'corporations', key: 'corporation_id' }
  },
  user_id: {
    type: DataTypes.UUID,
    allowNull: false,
    unique: true,
    references: { model: 'users', key: 'user_id' }
  },
  role: {
    type: DataTypes.STRING(20),
    defaultValue: 'member',
    validate: { isIn: [['leader', 'officer', 'member']] }
  },
  joined_at: {
    type: DataTypes.DATE,
    allowNull: false,
    defaultValue: DataTypes.NOW
  },
  contribution: {
    type: DataTypes.BIGINT,
    defaultValue: 0
  }
}, {
  tableName: 'corporation_members',
  timestamps: true,
  indexes: [
    { fields: ['corporation_id'] },
    { fields: ['corporation_id', 'role'] }
  ]
});

module.exports = CorporationMember;
