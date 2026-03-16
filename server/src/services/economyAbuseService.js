const { TransferLedger } = require('../models');
const config = require('../config');
const actionAuditService = require('./actionAuditService');

const normalizeIdempotencyKey = (value) => {
  if (typeof value !== 'string') {
    return null;
  }
  const normalized = value.trim();
  return normalized.length > 0 ? normalized.slice(0, 120) : null;
};

const classifyRiskFlags = ({
  creditsAmount = 0,
  commodityQuantity = 0
} = {}) => {
  const flags = [];

  if (Math.abs(Number(creditsAmount) || 0) >= config.antiCheat.suspiciousCreditThreshold) {
    flags.push('large_credit_transfer');
  }

  if (Math.abs(Number(commodityQuantity) || 0) >= config.antiCheat.suspiciousCommodityThreshold) {
    flags.push('large_commodity_transfer');
  }

  return flags;
};

const getReplayResult = async ({
  userId = null,
  idempotencyKey = null,
  transferType = null
} = {}) => {
  const normalizedKey = normalizeIdempotencyKey(idempotencyKey);
  if (!normalizedKey) {
    return null;
  }

  const existing = await TransferLedger.findOne({
    where: { idempotency_key: normalizedKey }
  });

  if (!existing) {
    return null;
  }

  if (
    (userId && existing.user_id && existing.user_id !== userId) ||
    (transferType && existing.transfer_type !== transferType)
  ) {
    const error = new Error('Idempotency key already used for a different operation');
    error.statusCode = 409;
    throw error;
  }

  return existing.result_payload || null;
};

const recordTransfer = async ({
  userId = null,
  transferType,
  sourceType,
  sourceId = null,
  destinationType,
  destinationId = null,
  creditsAmount = 0,
  commodityId = null,
  commodityQuantity = 0,
  idempotencyKey = null,
  metadata = {},
  resultPayload = null
} = {}) => {
  const normalizedKey = normalizeIdempotencyKey(idempotencyKey);
  const riskFlags = classifyRiskFlags({ creditsAmount, commodityQuantity });

  try {
    const entry = await TransferLedger.create({
      user_id: userId,
      transfer_type: transferType,
      source_type: sourceType,
      source_id: sourceId,
      destination_type: destinationType,
      destination_id: destinationId,
      credits_amount: creditsAmount,
      commodity_id: commodityId,
      commodity_quantity: commodityQuantity,
      status: 'completed',
      idempotency_key: normalizedKey,
      risk_flags: riskFlags,
      metadata,
      result_payload: resultPayload
    });

    if (riskFlags.length > 0) {
      await actionAuditService.record({
        userId,
        actionType: 'economy_transfer',
        scopeType: 'economy',
        scopeId: entry.transfer_ledger_id,
        status: 'allow',
        reason: 'suspicious_transfer_flagged',
        metadata: {
          transfer_type: transferType,
          risk_flags: riskFlags,
          credits_amount: creditsAmount,
          commodity_quantity: commodityQuantity
        }
      }).catch(() => null);
    }

    return entry;
  } catch (error) {
    if (normalizedKey && error.name === 'SequelizeUniqueConstraintError') {
      return TransferLedger.findOne({
        where: { idempotency_key: normalizedKey }
      });
    }
    throw error;
  }
};

module.exports = {
  normalizeIdempotencyKey,
  classifyRiskFlags,
  getReplayResult,
  recordTransfer
};
