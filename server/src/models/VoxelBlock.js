const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const VoxelBlock = sequelize.define('VoxelBlock', {
  voxel_id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  colony_id: {
    type: DataTypes.UUID,
    allowNull: false,
    references: { model: 'colonies', key: 'colony_id' }
  },
  chunk_x: {
    type: DataTypes.INTEGER,
    allowNull: false
  },
  chunk_z: {
    type: DataTypes.INTEGER,
    allowNull: false
  },
  local_x: {
    type: DataTypes.SMALLINT,
    allowNull: false,
    validate: { min: 0, max: 15 }
  },
  local_y: {
    type: DataTypes.SMALLINT,
    allowNull: false,
    validate: { min: 0, max: 127 }
  },
  local_z: {
    type: DataTypes.SMALLINT,
    allowNull: false,
    validate: { min: 0, max: 15 }
  },
  block_type: {
    type: DataTypes.SMALLINT,
    allowNull: false,
    comment: '0 = removed natural block, >0 = placed block ID'
  },
  placed_by: {
    type: DataTypes.UUID,
    allowNull: true,
    references: { model: 'users', key: 'user_id' }
  }
}, {
  tableName: 'voxel_blocks',
  timestamps: true,
  indexes: [
    { fields: ['colony_id', 'chunk_x', 'chunk_z'] },
    { unique: true, fields: ['colony_id', 'chunk_x', 'chunk_z', 'local_x', 'local_y', 'local_z'] }
  ]
});

module.exports = VoxelBlock;
