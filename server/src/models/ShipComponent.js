const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

/**
 * ShipComponent model - installed components on a ship
 */
const ShipComponent = sequelize.define('ShipComponent', {
  ship_component_id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  ship_id: {
    type: DataTypes.UUID,
    allowNull: false,
    references: {
      model: 'ships',
      key: 'ship_id'
    }
  },
  component_id: {
    type: DataTypes.UUID,
    allowNull: false,
    references: {
      model: 'components',
      key: 'component_id'
    }
  },
  slot_index: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 0,
    comment: 'Which slot of this component type (0-indexed)'
  },
  condition: {
    type: DataTypes.FLOAT,
    allowNull: false,
    defaultValue: 1.0,
    validate: { min: 0, max: 1 },
    comment: '1.0 = perfect, 0.0 = destroyed'
  },
  is_active: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: true
  }
}, {
  tableName: 'ship_components',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at',
  indexes: [
    { fields: ['ship_id'] },
    { fields: ['component_id'] },
    { 
      unique: true,
      fields: ['ship_id', 'component_id', 'slot_index'],
      name: 'unique_ship_component_slot'
    }
  ]
});

module.exports = ShipComponent;

