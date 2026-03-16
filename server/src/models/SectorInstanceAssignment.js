const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const SectorInstanceAssignment = sequelize.define('SectorInstanceAssignment', {
  sector_instance_assignment_id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  sector_id: {
    type: DataTypes.UUID,
    allowNull: false,
    references: {
      model: 'sectors',
      key: 'sector_id'
    }
  },
  user_id: {
    type: DataTypes.UUID,
    allowNull: false,
    references: {
      model: 'users',
      key: 'user_id'
    }
  },
  instance_key: {
    type: DataTypes.STRING(64),
    allowNull: false
  },
  status: {
    type: DataTypes.STRING(20),
    allowNull: false,
    defaultValue: 'active',
    validate: {
      isIn: [['active', 'released', 'expired']]
    }
  },
  expires_at: {
    type: DataTypes.DATE,
    allowNull: false
  },
  last_seen_at: {
    type: DataTypes.DATE,
    allowNull: false,
    defaultValue: DataTypes.NOW
  },
  created_at: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW
  },
  updated_at: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW
  }
}, {
  tableName: 'sector_instance_assignments',
  timestamps: false,
  indexes: [
    { fields: ['user_id', 'sector_id', 'status'] },
    { fields: ['sector_id', 'instance_key', 'status'] },
    { fields: ['expires_at'] }
  ]
});

module.exports = SectorInstanceAssignment;
