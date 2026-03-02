const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const GameSetting = sequelize.define('GameSetting', {
  setting_id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  category: {
    type: DataTypes.STRING(50),
    allowNull: false,
    validate: {
      isIn: [['ai_llm', 'ai_stt', 'ai_tts', 'npc', 'tick', 'general']]
    }
  },
  key: {
    type: DataTypes.STRING(100),
    allowNull: false,
    unique: true
  },
  value: {
    type: DataTypes.TEXT,
    allowNull: true,
    comment: 'JSON-encoded value'
  },
  value_type: {
    type: DataTypes.STRING(20),
    defaultValue: 'string',
    allowNull: false,
    validate: {
      isIn: [['string', 'number', 'boolean', 'json']]
    }
  },
  is_secret: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
    allowNull: false,
    comment: 'If true, value is masked in API responses'
  },
  description: {
    type: DataTypes.STRING(500),
    allowNull: true
  }
}, {
  tableName: 'game_settings',
  createdAt: 'created_at',
  updatedAt: 'updated_at',
  indexes: [
    { fields: ['category'] }
  ]
});

module.exports = GameSetting;
