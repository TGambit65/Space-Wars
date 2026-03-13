const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const Ship = sequelize.define('Ship', {
  ship_id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  owner_user_id: {
    type: DataTypes.UUID,
    allowNull: false,
    references: {
      model: 'users',
      key: 'user_id'
    }
  },
  current_sector_id: {
    type: DataTypes.UUID,
    allowNull: false,
    references: {
      model: 'sectors',
      key: 'sector_id'
    }
  },
  ship_type: {
    type: DataTypes.STRING(50),
    defaultValue: 'Scout',
    allowNull: false,
    validate: {
      isIn: [['Scout', 'Merchant Cruiser', 'Freighter', 'Fighter', 'Corvette', 'Destroyer', 'Carrier', 'Colony Ship', 'Insta Colony Ship', 'Battlecruiser', 'Interceptor', 'Mining Barge', 'Explorer']]
    }
  },
  name: {
    type: DataTypes.STRING(100),
    allowNull: false
  },
  hull_points: {
    type: DataTypes.INTEGER,
    defaultValue: 100
  },
  max_hull_points: {
    type: DataTypes.INTEGER,
    defaultValue: 100
  },
  shield_points: {
    type: DataTypes.INTEGER,
    defaultValue: 50
  },
  max_shield_points: {
    type: DataTypes.INTEGER,
    defaultValue: 50
  },
  fuel: {
    type: DataTypes.INTEGER,
    defaultValue: 100
  },
  max_fuel: {
    type: DataTypes.INTEGER,
    defaultValue: 100
  },
  cargo_capacity: {
    type: DataTypes.INTEGER,
    defaultValue: 50
  },
  // Phase 3: Combat stats
  attack_power: {
    type: DataTypes.INTEGER,
    defaultValue: 10,
    comment: 'Base attack power from weapons'
  },
  defense_rating: {
    type: DataTypes.INTEGER,
    defaultValue: 5,
    comment: 'Damage reduction from armor'
  },
  speed: {
    type: DataTypes.INTEGER,
    defaultValue: 10,
    comment: 'Ship speed for combat initiative and fleeing'
  },
  energy: {
    type: DataTypes.INTEGER,
    defaultValue: 100,
    comment: 'Energy for weapon systems'
  },
  max_energy: {
    type: DataTypes.INTEGER,
    defaultValue: 100
  },
  // Phase 3: Maintenance
  maintenance_cost: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
    comment: 'Daily maintenance cost in credits'
  },
  last_maintenance_at: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW
  },
  // Combat state
  in_combat: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  },
  combat_target_id: {
    type: DataTypes.UUID,
    allowNull: true,
    comment: 'Current combat target (NPC or player ship)'
  },
  is_active: {
    type: DataTypes.BOOLEAN,
    defaultValue: true
  },
  // Fleet membership
  fleet_id: {
    type: DataTypes.UUID,
    allowNull: true,
    defaultValue: null,
    references: {
      model: 'fleets',
      key: 'fleet_id'
    }
  },
  // Phase 6: Visual customization
  visual_config: {
    type: DataTypes.JSON,
    defaultValue: {
      hull_color: '#2244aa',
      accent_color: '#00ffff',
      engine_trail: 'cyan',
      decal: 'none',
      skin: 'default',
      nameplate_style: 'default'
    },
    comment: 'Ship visual customization settings'
  }
}, {
  tableName: 'ships',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at',
  indexes: [
    {
      fields: ['owner_user_id']
    },
    {
      fields: ['current_sector_id']
    },
    {
      fields: ['is_active']
    },
    {
      fields: ['fleet_id']
    }
  ]
});

module.exports = Ship;

