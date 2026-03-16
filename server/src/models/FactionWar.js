const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const FactionWar = sequelize.define('FactionWar', {
  war_id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  attacker_faction: {
    type: DataTypes.STRING(30),
    allowNull: false,
    validate: {
      isIn: [['terran_alliance', 'zythian_swarm', 'automaton_collective']]
    }
  },
  defender_faction: {
    type: DataTypes.STRING(30),
    allowNull: false,
    validate: {
      isIn: [['terran_alliance', 'zythian_swarm', 'automaton_collective']]
    }
  },
  status: {
    type: DataTypes.STRING(20),
    defaultValue: 'active',
    validate: {
      isIn: [['active', 'ceasefire', 'resolved']]
    }
  },
  attacker_score: {
    type: DataTypes.INTEGER,
    defaultValue: 0
  },
  defender_score: {
    type: DataTypes.INTEGER,
    defaultValue: 0
  },
  started_at: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW
  },
  ends_at: {
    type: DataTypes.DATE,
    allowNull: true
  },
  result: {
    type: DataTypes.JSON,
    allowNull: true,
    comment: 'War outcome details: winner, rewards, territory changes'
  }
}, {
  tableName: 'faction_wars',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at',
  indexes: [
    { fields: ['status'] },
    { fields: ['attacker_faction', 'defender_faction'] }
  ]
});

module.exports = FactionWar;
