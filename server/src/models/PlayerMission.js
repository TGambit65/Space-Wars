const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const PlayerMission = sequelize.define('PlayerMission', {
  player_mission_id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  user_id: {
    type: DataTypes.UUID,
    allowNull: false,
    references: { model: 'users', key: 'user_id' }
  },
  mission_id: {
    type: DataTypes.UUID,
    allowNull: false,
    references: { model: 'missions', key: 'mission_id' }
  },
  status: {
    type: DataTypes.STRING(20),
    defaultValue: 'accepted',
    validate: { isIn: [['accepted', 'completed', 'abandoned', 'failed']] }
  },
  progress: {
    type: DataTypes.JSON,
    defaultValue: {}
  },
  accepted_at: {
    type: DataTypes.DATE,
    allowNull: false,
    defaultValue: DataTypes.NOW
  },
  completed_at: {
    type: DataTypes.DATE,
    allowNull: true
  }
}, {
  tableName: 'player_missions',
  timestamps: true,
  indexes: [
    { unique: true, fields: ['user_id', 'mission_id'] },
    { fields: ['user_id', 'status'] },
    { fields: ['status'] }
  ]
});

module.exports = PlayerMission;
