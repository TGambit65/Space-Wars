const { CorporationAgreement, Corporation, sequelize } = require('../models');
const { Op } = require('sequelize');

const propose = async (proposerCorpId, targetCorpId, agreementType, terms) => {
  if (proposerCorpId === targetCorpId) {
    const error = new Error('Cannot propose an agreement with your own corporation');
    error.statusCode = 400;
    throw error;
  }

  // Validate both corporations exist
  const [proposer, target] = await Promise.all([
    Corporation.findByPk(proposerCorpId),
    Corporation.findByPk(targetCorpId)
  ]);

  if (!proposer) {
    const error = new Error('Proposer corporation not found');
    error.statusCode = 404;
    throw error;
  }

  if (!target) {
    const error = new Error('Target corporation not found');
    error.statusCode = 404;
    throw error;
  }

  // Check for duplicate active agreement
  const existing = await CorporationAgreement.findOne({
    where: {
      agreement_type: agreementType,
      status: { [Op.in]: ['pending', 'active'] },
      [Op.or]: [
        { proposer_corp_id: proposerCorpId, target_corp_id: targetCorpId },
        { proposer_corp_id: targetCorpId, target_corp_id: proposerCorpId }
      ]
    }
  });

  if (existing) {
    const error = new Error('An active or pending agreement of this type already exists between these corporations');
    error.statusCode = 409;
    throw error;
  }

  const agreement = await CorporationAgreement.create({
    proposer_corp_id: proposerCorpId,
    target_corp_id: targetCorpId,
    agreement_type: agreementType,
    terms: terms || {},
    status: 'pending'
  });

  return agreement;
};

const respond = async (agreementId, corpId, accept) => {
  const agreement = await CorporationAgreement.findByPk(agreementId);

  if (!agreement) {
    const error = new Error('Agreement not found');
    error.statusCode = 404;
    throw error;
  }

  if (agreement.target_corp_id !== corpId) {
    const error = new Error('Only the target corporation can respond to this agreement');
    error.statusCode = 403;
    throw error;
  }

  if (agreement.status !== 'pending') {
    const error = new Error('Agreement is no longer pending');
    error.statusCode = 400;
    throw error;
  }

  await agreement.update({
    status: accept ? 'active' : 'rejected'
  });

  return agreement;
};

const getForCorporation = async (corpId) => {
  const agreements = await CorporationAgreement.findAll({
    where: {
      [Op.or]: [
        { proposer_corp_id: corpId },
        { target_corp_id: corpId }
      ]
    },
    include: [
      { model: Corporation, as: 'proposer', attributes: ['corporation_id', 'name'] },
      { model: Corporation, as: 'target', attributes: ['corporation_id', 'name'] }
    ],
    order: [['created_at', 'DESC']]
  });

  return agreements;
};

const breakAgreement = async (agreementId, corpId) => {
  const agreement = await CorporationAgreement.findByPk(agreementId);

  if (!agreement) {
    const error = new Error('Agreement not found');
    error.statusCode = 404;
    throw error;
  }

  if (agreement.proposer_corp_id !== corpId && agreement.target_corp_id !== corpId) {
    const error = new Error('You are not a party to this agreement');
    error.statusCode = 403;
    throw error;
  }

  if (agreement.status !== 'active') {
    const error = new Error('Only active agreements can be broken');
    error.statusCode = 400;
    throw error;
  }

  await agreement.update({ status: 'broken' });

  return agreement;
};

module.exports = {
  propose,
  respond,
  getForCorporation,
  breakAgreement
};
