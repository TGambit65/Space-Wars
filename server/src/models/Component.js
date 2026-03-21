const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

/**
 * Component model - defines available ship components (weapons, shields, etc.)
 */
const Component = sequelize.define('Component', {
  component_id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  name: {
    type: DataTypes.STRING(100),
    allowNull: false,
    unique: true
  },
  type: {
    type: DataTypes.STRING(50),
    allowNull: false,
    validate: {
      isIn: [['weapon', 'shield', 'engine', 'scanner', 'cargo_pod', 'armor', 'jump_drive']]
    }
  },
  tier: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 1,
    validate: { min: 1, max: 5 }
  },
  // Weapon stats
  damage: { type: DataTypes.INTEGER, defaultValue: 0 },
  accuracy: { type: DataTypes.INTEGER, defaultValue: 0 },
  // Shield stats
  shield_capacity: { type: DataTypes.INTEGER, defaultValue: 0 },
  recharge_rate: { type: DataTypes.INTEGER, defaultValue: 0 },
  // Engine stats
  speed_bonus: { type: DataTypes.INTEGER, defaultValue: 0 },
  fuel_efficiency: { type: DataTypes.FLOAT, defaultValue: 1.0 },
  // Scanner stats
  scan_range: { type: DataTypes.INTEGER, defaultValue: 0 },
  detail_level: { type: DataTypes.INTEGER, defaultValue: 0 },
  // Cargo stats
  cargo_capacity: { type: DataTypes.INTEGER, defaultValue: 0 },
  // Armor stats
  hull_bonus: { type: DataTypes.INTEGER, defaultValue: 0 },
  damage_reduction: { type: DataTypes.FLOAT, defaultValue: 0 },
  // Common stats
  energy_cost: { type: DataTypes.INTEGER, defaultValue: 0 },
  price: {
    type: DataTypes.INTEGER,
    allowNull: false,
    validate: { min: 0 }
  },
  description: {
    type: DataTypes.STRING(500),
    defaultValue: ''
  },
  // Special flags
  special_properties: {
    type: DataTypes.JSON,
    defaultValue: {}
  }
}, {
  tableName: 'components',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at',
  indexes: [
    { fields: ['type'] },
    { fields: ['tier'] },
    { fields: ['name'] }
  ]
});

module.exports = Component;

