const { ColonyRaidProtection, User } = require('../models');
const config = require('../config');
const actionAuditService = require('./actionAuditService');

const toDate = (value) => value ? new Date(value) : null;

const hasFutureTimestamp = (value) => {
  const parsed = toDate(value);
  return Boolean(parsed && parsed.getTime() > Date.now());
};

const ensureProtectionState = async (colonyId, transaction = null) => {
  const existing = await ColonyRaidProtection.findOne({
    where: { colony_id: colonyId },
    transaction
  });
  if (existing) {
    return existing;
  }

  try {
    return await ColonyRaidProtection.create({
      colony_id: colonyId
    }, { transaction });
  } catch (_) {
    return ColonyRaidProtection.findOne({
      where: { colony_id: colonyId },
      transaction
    });
  }
};

const isOwnerOfflineProtected = (owner) => {
  const lastLoginMs = toDate(owner?.last_login)?.getTime() || 0;
  return !lastLoginMs || (Date.now() - lastLoginMs) >= config.antiCheat.raidOfflineThresholdMs;
};

const authorizePlayerRaid = async ({
  attackerUserId,
  colony,
  transaction = null
} = {}) => {
  if (!attackerUserId || !colony) {
    const error = new Error('Invalid raid request');
    error.statusCode = 400;
    throw error;
  }

  if (attackerUserId === colony.user_id) {
    const error = new Error('Cannot raid your own colony');
    error.statusCode = 400;
    throw error;
  }

  const [state, owner] = await Promise.all([
    ensureProtectionState(colony.colony_id, transaction),
    User.findByPk(colony.user_id, {
      attributes: ['user_id', 'last_login'],
      transaction
    })
  ]);

  const deny = async (reason, metadata = {}) => {
    await actionAuditService.record({
      userId: attackerUserId,
      actionType: 'raid_initiation',
      scopeType: 'colony',
      scopeId: colony.colony_id,
      status: 'deny',
      reason,
      metadata: {
        colony_id: colony.colony_id,
        defender_id: colony.user_id,
        ...metadata
      },
      transaction
    });
    const error = new Error(reason);
    error.statusCode = 409;
    throw error;
  };

  if (isOwnerOfflineProtected(owner)) {
    const offlineUntil = new Date(Date.now() + config.antiCheat.raidOfflineProtectionMs);
    await state.update({
      offline_protection_until: offlineUntil,
      updated_at: new Date()
    }, { transaction });
    await deny('Colony is under offline protection', {
      offline_protection_until: offlineUntil
    });
  }

  if (hasFutureTimestamp(state.raid_blocked_until)) {
    await deny('Colony raid is cooling down', {
      raid_blocked_until: state.raid_blocked_until
    });
  }

  const windowActive = hasFutureTimestamp(state.repeated_attack_window_until);
  const sameAttacker = state.last_attacker_id && state.last_attacker_id === attackerUserId;
  const currentCount = windowActive && sameAttacker ? state.repeated_attack_count : 0;
  if (windowActive && sameAttacker && currentCount >= config.antiCheat.maxRepeatedRaidAttacksPerWindow) {
    await deny('Repeated raid attempts against this colony are temporarily blocked', {
      repeated_attack_window_until: state.repeated_attack_window_until,
      repeated_attack_count: state.repeated_attack_count
    });
  }

  const raidBlockedUntil = new Date(Date.now() + config.antiCheat.playerRaidCooldownMs);
  const repeatedWindowUntil = new Date(Date.now() + config.antiCheat.repeatedRaidWindowMs);

  await state.update({
    raid_blocked_until: raidBlockedUntil,
    last_attacker_id: attackerUserId,
    repeated_attack_count: currentCount + 1,
    repeated_attack_window_until: repeatedWindowUntil,
    last_attack_at: new Date(),
    updated_at: new Date()
  }, { transaction });

  await actionAuditService.record({
    userId: attackerUserId,
    actionType: 'raid_initiation',
    scopeType: 'colony',
    scopeId: colony.colony_id,
    status: 'allow',
    reason: 'authorized',
    metadata: {
      colony_id: colony.colony_id,
      defender_id: colony.user_id,
      raid_blocked_until: raidBlockedUntil,
      repeated_attack_window_until: repeatedWindowUntil,
      repeated_attack_count: currentCount + 1
    },
    transaction
  });

  return state;
};

module.exports = {
  ensureProtectionState,
  isOwnerOfflineProtected,
  authorizePlayerRaid
};
