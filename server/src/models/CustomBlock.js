const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const CustomBlock = sequelize.define('CustomBlock', {
  block_id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  colony_id: {
    type: DataTypes.UUID,
    allowNull: false,
    references: { model: 'colonies', key: 'colony_id' }
  },
  block_type: {
    type: DataTypes.STRING(50),
    allowNull: false
  },
  grid_x: {
    type: DataTypes.INTEGER,
    allowNull: false
  },
  grid_y: {
    type: DataTypes.INTEGER,
    allowNull: false
  },
  rotation: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
    validate: { isIn: [[0, 90, 180, 270]] }
  },
  color: {
    type: DataTypes.STRING(7),
    allowNull: true,
    defaultValue: null,
    validate: { is: /^#[0-9a-fA-F]{6}$/ }
  }
}, {
  tableName: 'custom_blocks',
  timestamps: true,
  indexes: [
    { fields: ['colony_id'] },
    { unique: true, fields: ['colony_id', 'grid_x', 'grid_y'] }
  ]
});

module.exports = CustomBlock;
