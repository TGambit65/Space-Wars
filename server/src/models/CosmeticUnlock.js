const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const CosmeticUnlock = sequelize.define('CosmeticUnlock', {
  unlock_id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  user_id: {
    type: DataTypes.UUID,
    allowNull: false,
    references: { model: 'users', key: 'user_id' }
  },
  cosmetic_type: {
    type: DataTypes.STRING(30),
    allowNull: false,
    comment: 'hull_color, accent_color, engine_trail, decal, skin, nameplate_style'
  },
  cosmetic_id: {
    type: DataTypes.STRING(50),
    allowNull: false,
    comment: 'The specific cosmetic item ID'
  },
  unlocked_at: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW
  }
}, {
  tableName: 'cosmetic_unlocks',
  timestamps: false,
  indexes: [
    { unique: true, fields: ['user_id', 'cosmetic_type', 'cosmetic_id'] },
    { fields: ['user_id'] }
  ]
});

module.exports = CosmeticUnlock;
