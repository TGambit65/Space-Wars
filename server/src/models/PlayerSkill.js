const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const PlayerSkill = sequelize.define('PlayerSkill', {
  player_skill_id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  user_id: {
    type: DataTypes.UUID,
    allowNull: false,
    references: { model: 'users', key: 'user_id' }
  },
  skill_name: {
    type: DataTypes.STRING(50),
    allowNull: false
  },
  level: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
    validate: { min: 0, max: 10 }
  },
  xp_current: {
    type: DataTypes.INTEGER,
    defaultValue: 0
  }
}, {
  tableName: 'player_skills',
  timestamps: true,
  indexes: [
    { unique: true, fields: ['user_id', 'skill_name'] },
    { fields: ['user_id'] }
  ]
});

module.exports = PlayerSkill;
