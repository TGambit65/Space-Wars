const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const BountyContract = sequelize.define('BountyContract', {
  contract_id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  tier: {
    type: DataTypes.INTEGER,
    allowNull: false,
    validate: { min: 1, max: 5 }
  },
  target_npc_type: {
    type: DataTypes.STRING(40),
    allowNull: false,
    comment: 'NPC type to hunt: PIRATE, PIRATE_LORD, BOUNTY_HUNTER, etc.'
  },
  kill_count: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 1
  },
  reward_credits: {
    type: DataTypes.INTEGER,
    allowNull: false
  },
  reward_xp: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 0
  },
  expires_at: {
    type: DataTypes.DATE,
    allowNull: false
  },
  status: {
    type: DataTypes.STRING(20),
    allowNull: false,
    defaultValue: 'open',
    validate: { isIn: [['open', 'accepted', 'completed', 'expired', 'abandoned']] }
  },
  accepted_by_user_id: {
    type: DataTypes.UUID,
    allowNull: true,
    references: { model: 'users', key: 'user_id' }
  },
  kills_recorded: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 0
  },
  accepted_at: {
    type: DataTypes.DATE,
    allowNull: true
  },
  completed_at: {
    type: DataTypes.DATE,
    allowNull: true
  },
  created_at: {
    type: DataTypes.DATE,
    allowNull: false,
    defaultValue: DataTypes.NOW
  }
}, {
  tableName: 'bounty_contracts',
  timestamps: false,
  indexes: [
    { fields: ['status'] },
    { fields: ['accepted_by_user_id', 'status'] },
    { fields: ['expires_at'] }
  ]
});

module.exports = BountyContract;
