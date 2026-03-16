const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const CorporationAgreement = sequelize.define('CorporationAgreement', {
  agreement_id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  proposer_corp_id: {
    type: DataTypes.UUID,
    allowNull: false,
    references: { model: 'corporations', key: 'corporation_id' }
  },
  target_corp_id: {
    type: DataTypes.UUID,
    allowNull: false,
    references: { model: 'corporations', key: 'corporation_id' }
  },
  agreement_type: {
    type: DataTypes.STRING(30),
    allowNull: false,
    validate: {
      isIn: [['trade_agreement', 'defense_pact', 'non_aggression', 'alliance']]
    }
  },
  status: {
    type: DataTypes.STRING(20),
    defaultValue: 'pending',
    validate: {
      isIn: [['pending', 'active', 'rejected', 'expired', 'broken']]
    }
  },
  terms: {
    type: DataTypes.JSON,
    allowNull: true,
    comment: 'Agreement-specific terms and conditions'
  },
  expires_at: {
    type: DataTypes.DATE,
    allowNull: true
  }
}, {
  tableName: 'corporation_agreements',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at',
  indexes: [
    { fields: ['proposer_corp_id'] },
    { fields: ['target_corp_id'] },
    { fields: ['status'] }
  ]
});

module.exports = CorporationAgreement;
