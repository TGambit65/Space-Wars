const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const ShipDesignTemplate = sequelize.define('ShipDesignTemplate', {
  template_id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  user_id: {
    type: DataTypes.UUID,
    allowNull: false,
    references: { model: 'users', key: 'user_id' }
  },
  name: {
    type: DataTypes.STRING(100),
    allowNull: false
  },
  ship_type: {
    type: DataTypes.STRING(50),
    allowNull: false
  },
  components: {
    type: DataTypes.JSON,
    defaultValue: [],
    comment: 'Array of component IDs for this design'
  },
  notes: {
    type: DataTypes.TEXT,
    allowNull: true
  }
}, {
  tableName: 'ship_design_templates',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at',
  indexes: [
    { fields: ['user_id'] }
  ]
});

module.exports = ShipDesignTemplate;
