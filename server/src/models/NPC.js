const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

/**
 * NPC model - AI-controlled ships in the universe
 */
const NPC = sequelize.define('NPC', {
  npc_id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  name: {
    type: DataTypes.STRING(100),
    allowNull: false
  },
  npc_type: {
    type: DataTypes.STRING(50),
    allowNull: false,
    validate: {
      isIn: [['PIRATE', 'PIRATE_LORD', 'TRADER', 'PATROL', 'BOUNTY_HUNTER']]
    }
  },
  ship_type: {
    type: DataTypes.STRING(50),
    allowNull: false,
    validate: {
      isIn: [['Scout', 'Merchant Cruiser', 'Freighter', 'Fighter', 'Corvette', 'Destroyer', 'Carrier', 'Colony Ship', 'Battlecruiser', 'Interceptor', 'Mining Barge', 'Explorer']]
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
  // Combat stats
  hull_points: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 100 },
  max_hull_points: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 100 },
  shield_points: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 50 },
  max_shield_points: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 50 },
  attack_power: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 10 },
  defense_rating: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 5 },
  speed: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 10 },
  // AI behavior
  aggression_level: {
    type: DataTypes.FLOAT,
    defaultValue: 0.5,
    validate: { min: 0, max: 1 }
  },
  flee_threshold: {
    type: DataTypes.FLOAT,
    defaultValue: 0.2,
    comment: 'Flee when hull below this percentage'
  },
  // Loot and rewards
  credits_carried: { type: DataTypes.INTEGER, defaultValue: 0 },
  experience_value: { type: DataTypes.INTEGER, defaultValue: 50 },
  // AI behavior extensions
  behavior_state: {
    type: DataTypes.STRING(20),
    defaultValue: 'idle',
    validate: {
      isIn: [['idle', 'patrolling', 'hunting', 'fleeing', 'trading', 'guarding', 'engaging']]
    }
  },
  ai_personality: {
    type: DataTypes.JSON,
    allowNull: true,
    comment: 'Generated personality traits { trait_primary, trait_secondary, speech_style, quirk, voice_profile }'
  },
  intelligence_tier: {
    type: DataTypes.INTEGER,
    defaultValue: 1,
    validate: { min: 1, max: 3 },
    comment: '1=scripted only, 2=scripted+simple AI, 3=full AI'
  },
  movement_target_id: {
    type: DataTypes.UUID,
    allowNull: true,
    comment: 'Sector ID this NPC is navigating toward'
  },
  home_sector_id: {
    type: DataTypes.UUID,
    allowNull: true,
    comment: 'Sector where NPC was spawned / patrols around'
  },
  target_ship_id: {
    type: DataTypes.UUID,
    allowNull: true,
    comment: 'Persisted combat target ship ID (cleared on disengage)'
  },
  target_user_id: {
    type: DataTypes.UUID,
    allowNull: true,
    comment: 'Persisted combat target user ID (cleared on disengage)'
  },
  dialogue_state: {
    type: DataTypes.JSON,
    allowNull: true,
    comment: 'Legacy conversation state — sessions now in NpcConversationSession table'
  },
  last_hail_at: {
    type: DataTypes.DATE,
    allowNull: true,
    comment: 'Last time this NPC proactively hailed a player (presence pacing)'
  },
  last_presence_beat_at: {
    type: DataTypes.DATE,
    allowNull: true,
    comment: 'Last ambient presence event timestamp'
  },
  // Status
  is_alive: { type: DataTypes.BOOLEAN, defaultValue: true },
  respawn_at: { type: DataTypes.DATE, allowNull: true },
  last_action_at: { type: DataTypes.DATE, defaultValue: DataTypes.NOW }
}, {
  tableName: 'npcs',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at',
  indexes: [
    { fields: ['current_sector_id'] },
    { fields: ['npc_type'] },
    { fields: ['is_alive'] },
    { fields: ['respawn_at'] },
    { fields: ['behavior_state'] }
  ]
});

module.exports = NPC;

