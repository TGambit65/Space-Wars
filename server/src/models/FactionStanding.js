const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const FactionStanding = sequelize.define('FactionStanding', {
  standing_id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  user_id: {
    type: DataTypes.UUID,
    allowNull: false,
    references: { model: 'users', key: 'user_id' }
  },
  faction: {
    type: DataTypes.STRING(30),
    allowNull: false,
    validate: {
      isIn: [['terran_alliance', 'zythian_swarm', 'automaton_collective', 'synthesis_accord', 'sylvari_dominion']]
    }
  },
  reputation: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
    validate: { min: -1000, max: 1000 }
  }
}, {
  tableName: 'faction_standings',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at',
  indexes: [
    { unique: true, fields: ['user_id', 'faction'] },
    { fields: ['faction', 'reputation'] }
  ]
});

/**
 * Compute rank from reputation
 */
FactionStanding.prototype.getRank = function() {
  const rep = this.reputation;
  if (rep >= 800) return 'Exalted';
  if (rep >= 500) return 'Revered';
  if (rep >= 200) return 'Honored';
  if (rep >= 0) return 'Neutral';
  if (rep >= -200) return 'Unfriendly';
  if (rep >= -500) return 'Hostile';
  return 'Hated';
};

module.exports = FactionStanding;
