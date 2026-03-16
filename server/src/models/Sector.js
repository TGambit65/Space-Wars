const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const clearSectorMapCache = () => {
  try {
    require('../controllers/sectorController').clearMapCache();
  } catch (_) {
    // Cache invalidation is best-effort during model bootstrap.
  }
};

const Sector = sequelize.define('Sector', {
  sector_id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  x_coord: {
    type: DataTypes.FLOAT,
    allowNull: false
  },
  y_coord: {
    type: DataTypes.FLOAT,
    allowNull: false
  },
  z_coord: {
    type: DataTypes.FLOAT,
    allowNull: true,
    defaultValue: 0
  },
  name: {
    type: DataTypes.STRING(100),
    allowNull: false
  },
  type: {
    type: DataTypes.STRING(20),
    defaultValue: 'Unknown',
    allowNull: false,
    validate: {
      isIn: [['Core', 'Inner', 'Mid', 'Outer', 'Fringe', 'Unknown']]
    }
  },
  star_class: {
    type: DataTypes.STRING(20),
    defaultValue: 'G',
    allowNull: false,
    validate: {
      isIn: [['O', 'B', 'A', 'F', 'G', 'K', 'M', 'Neutron', 'BlackHole']]
    }
  },
  description: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  zone_class: {
    type: DataTypes.STRING(30),
    allowNull: false,
    defaultValue: 'core',
    validate: {
      isIn: [[
        'core',
        'inner_ring',
        'mid_ring',
        'outer_ring',
        'frontier',
        'deep_space',
        'home',
        'adventure',
        'transit'
      ]]
    }
  },
  security_class: {
    type: DataTypes.STRING(20),
    allowNull: false,
    defaultValue: 'pve',
    validate: {
      isIn: [['protected', 'pve', 'contested', 'pvp']]
    }
  },
  access_mode: {
    type: DataTypes.STRING(30),
    allowNull: false,
    defaultValue: 'public',
    validate: {
      isIn: [['public', 'owner', 'corporation', 'corporation_allies', 'faction', 'locked']]
    }
  },
  owner_user_id: {
    type: DataTypes.UUID,
    allowNull: true,
    references: {
      model: 'users',
      key: 'user_id'
    }
  },
  owner_corporation_id: {
    type: DataTypes.UUID,
    allowNull: true,
    references: {
      model: 'corporations',
      key: 'corporation_id'
    }
  },
  is_starting_sector: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  },
  hazard_level: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
    validate: {
      min: 0,
      max: 10
    }
  },
  phenomena: {
    type: DataTypes.JSON,
    allowNull: true,
    defaultValue: null,
    comment: 'Active space phenomenon: { type, intensity, expires_at }'
  },
  rule_flags: {
    type: DataTypes.JSON,
    allowNull: false,
    defaultValue: {},
    comment: 'Sprint world policy metadata: safe harbors, reward multipliers, jump/travel rules, and zone flags'
  }
}, {
  tableName: 'sectors',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at',
  hooks: {
    beforeValidate: (sector) => {
      const worldPolicyService = require('../services/worldPolicyService');
      const policy = worldPolicyService.buildDefaultSectorPolicy({
        type: sector.type,
        owner_user_id: sector.owner_user_id,
        owner_corporation_id: sector.owner_corporation_id,
        rule_flags: sector.rule_flags
      });

      if (!sector.zone_class || (sector.zone_class === 'core' && policy.zone_class !== 'core')) {
        sector.zone_class = policy.zone_class;
      }
      if (!sector.security_class || (sector.security_class === 'pve' && policy.security_class !== 'pve')) {
        sector.security_class = policy.security_class;
      }
      if (!sector.access_mode || (sector.access_mode === 'public' && policy.access_mode !== 'public')) {
        sector.access_mode = policy.access_mode;
      }
      if (!sector.rule_flags || Object.keys(sector.rule_flags).length === 0) {
        sector.rule_flags = policy.rule_flags;
      }
    },
    afterCreate: clearSectorMapCache,
    afterUpdate: clearSectorMapCache,
    afterDestroy: clearSectorMapCache
  },
  indexes: [
    { fields: ['zone_class'] },
    { fields: ['security_class'] },
    { fields: ['access_mode'] },
    { fields: ['owner_user_id'] },
    { fields: ['owner_corporation_id'] }
  ]
});

module.exports = Sector;
