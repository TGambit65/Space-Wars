const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const Crew = sequelize.define('Crew', {
  crew_id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  name: {
    type: DataTypes.STRING(100),
    allowNull: false
  },
  species: {
    type: DataTypes.STRING(30),
    allowNull: false,
    validate: {
      isIn: [['Human', 'Vexian', 'Krynn', 'Zorath', 'Sylphi', 'Grox', 'Nexari', 'Threll', 'Worker Bot', 'Combat Droid', 'Science Unit', 'Crystallid', 'Void Walker']]
    }
  },
  level: {
    type: DataTypes.INTEGER,
    defaultValue: 1,
    validate: {
      min: 1,
      max: 100
    }
  },
  xp: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
    validate: {
      min: 0
    }
  },
  current_ship_id: {
    type: DataTypes.UUID,
    allowNull: true,
    references: {
      model: 'ships',
      key: 'ship_id'
    },
    comment: 'Ship this crew member is assigned to (null if at port)'
  },
  assigned_role: {
    type: DataTypes.STRING(20),
    allowNull: true,
    validate: {
      isIn: [['Pilot', 'Engineer', 'Gunner', 'Scientist', null]]
    },
    comment: 'Current assigned role on ship'
  },
  salary: {
    type: DataTypes.INTEGER,
    defaultValue: 100,
    comment: 'Daily salary cost in credits'
  },
  owner_user_id: {
    type: DataTypes.UUID,
    allowNull: true,
    references: {
      model: 'users',
      key: 'user_id'
    },
    comment: 'User who hired this crew member (null if available for hire)'
  },
  port_id: {
    type: DataTypes.UUID,
    allowNull: true,
    references: {
      model: 'ports',
      key: 'port_id'
    },
    comment: 'Port where this crew member is available (null if hired)'
  },
  is_active: {
    type: DataTypes.BOOLEAN,
    defaultValue: true
  }
}, {
  tableName: 'crew',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at',
  indexes: [
    {
      fields: ['current_ship_id']
    },
    {
      fields: ['owner_user_id']
    },
    {
      fields: ['port_id']
    },
    {
      fields: ['species']
    },
    {
      fields: ['is_active']
    }
  ]
});

module.exports = Crew;

