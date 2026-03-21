const { Op } = require('sequelize');
const { User, Ship, Sector, PlayerProtectionState, PvpCooldown } = require('../models');
const config = require('../config');
const worldPolicyService = require('./worldPolicyService');
const actionAuditService = require('./actionAuditService');

const toDate = (value) => value ? new Date(value) : null;
const ENTRY_PROTECTION_LANES = new Set(['portal', 'wormhole', 'gate']);

const describeTravelProtection = (reason = null) => {
  switch (reason) {
    case 'portal_entry':
      return 'portal entry protection';
    case 'wormhole_entry':
      return 'wormhole entry protection';
    case 'gate_entry':
      return 'gate entry protection';
    case 'home_sector_entry':
      return 'home-sector entry protection';
    case 'safe_harbor_entry':
      return 'safe-harbor entry protection';
    case 'fleet_portal_entry':
      return 'fleet portal entry protection';
    case 'fleet_wormhole_entry':
      return 'fleet wormhole entry protection';
    case 'fleet_gate_entry':
      return 'fleet gate entry protection';
    case 'fleet_home_sector_entry':
      return 'fleet home-sector entry protection';
    case 'fleet_safe_harbor_entry':
      return 'fleet safe-harbor entry protection';
    default:
      return 'temporary entry protection';
  }
};

const resolveEntryProtection = ({
  connectionPolicy = null,
  toPolicy = null,
  fleet = false
} = {}) => {
  const explicitSeconds = Number.parseInt(toPolicy?.rule_flags?.protected_entry_buffer_seconds, 10);
  const laneClass = connectionPolicy?.lane_class || null;
  const prefix = fleet ? 'fleet_' : '';
  let reason = 'sector_entry';

  if (laneClass === 'portal') {
    reason = `${prefix}portal_entry`;
  } else if (laneClass === 'wormhole') {
    reason = `${prefix}wormhole_entry`;
  } else if (laneClass === 'gate') {
    reason = `${prefix}gate_entry`;
  } else if (toPolicy?.access_mode === 'owner' || toPolicy?.access_mode === 'corporation' || toPolicy?.access_mode === 'corporation_allies') {
    reason = `${prefix}home_sector_entry`;
  } else if (toPolicy?.rule_flags?.safe_harbor || toPolicy?.security_class === 'protected') {
    reason = `${prefix}safe_harbor_entry`;
  }

  if (Number.isFinite(explicitSeconds) && explicitSeconds > 0) {
    return {
      durationMs: explicitSeconds * 1000,
      reason
    };
  }

  if (
    ENTRY_PROTECTION_LANES.has(laneClass) ||
    toPolicy?.rule_flags?.safe_harbor ||
    toPolicy?.security_class === 'protected'
  ) {
    return {
      durationMs: config.antiCheat.travelProtectionDefaultMs,
      reason
    };
  }

  return null;
};

const ensureProtectionState = async (userId, transaction = null) => {
  const existing = await PlayerProtectionState.findOne({
    where: { user_id: userId },
    transaction
  });
  if (existing) {
    return existing;
  }

  const user = await User.findByPk(userId, {
    attributes: ['user_id', 'created_at'],
    transaction
  });
  if (!user) {
    throw new Error('User not found');
  }

  const createdAtMs = toDate(user.created_at)?.getTime() || Date.now();
  const newbieUntilMs = createdAtMs + config.antiCheat.newbieProtectionMs;
  const newbieProtectionUntil = newbieUntilMs > Date.now()
    ? new Date(newbieUntilMs)
    : null;

  try {
    return await PlayerProtectionState.create({
      user_id: userId,
      newbie_protection_until: newbieProtectionUntil
    }, { transaction });
  } catch (error) {
    return PlayerProtectionState.findOne({
      where: { user_id: userId },
      transaction
    });
  }
};

const hasFutureTimestamp = (value, now = Date.now()) => {
  const parsed = toDate(value);
  return Boolean(parsed && parsed.getTime() > now);
};

const buildProtectionSnapshot = (state, now = Date.now()) => ({
  newbieProtected: hasFutureTimestamp(state?.newbie_protection_until, now),
  travelProtected: hasFutureTimestamp(state?.travel_protection_until, now),
  hostile: hasFutureTimestamp(state?.hostility_until, now),
  toggleCoolingDown: hasFutureTimestamp(state?.pvp_toggle_cooldown_until, now)
});

const grantTravelProtection = async ({
  userId,
  durationMs,
  reason = 'travel',
  transaction = null
} = {}) => {
  if (!userId || !durationMs || durationMs <= 0) {
    return null;
  }

  const state = await ensureProtectionState(userId, transaction);
  const currentUntil = toDate(state.travel_protection_until)?.getTime() || 0;
  const nextUntil = new Date(Math.max(currentUntil, Date.now() + durationMs));

  await state.update({
    travel_protection_until: nextUntil,
    travel_protection_reason: reason,
    updated_at: new Date()
  }, { transaction });

  return state;
};

const recordHostility = async ({
  attackerUserId,
  defenderUserId,
  transaction = null
} = {}) => {
  const until = new Date(Date.now() + config.antiCheat.hostilityDurationMs);
  const touchedUsers = [attackerUserId, defenderUserId].filter(Boolean);

  for (const userId of touchedUsers) {
    const state = await ensureProtectionState(userId, transaction);
    await state.update({
      hostility_until: until,
      last_hostile_action_at: new Date(),
      travel_protection_until: null,
      travel_protection_reason: null,
      updated_at: new Date()
    }, { transaction });
  }
};

const getCombatZonePolicy = async (sectorId, transaction = null) => {
  const sector = await Sector.findByPk(sectorId, { transaction });
  if (!sector) {
    const error = new Error('Sector not found');
    error.statusCode = 404;
    throw error;
  }

  const sectorPolicy = worldPolicyService.buildDefaultSectorPolicy(sector);
  return { sector, sectorPolicy };
};

const getRepeatAttackCooldown = async ({
  attackerUserId,
  victimUserId,
  transaction = null
} = {}) => PvpCooldown.findOne({
  where: {
    attacker_user_id: attackerUserId,
    victim_user_id: victimUserId,
    expires_at: {
      [Op.gt]: new Date()
    }
  },
  transaction
});

const canTogglePvp = async ({
  userId,
  req = null,
  transaction = null
} = {}) => {
  const [user, state, activeCombatShip] = await Promise.all([
    User.findByPk(userId, { transaction }),
    ensureProtectionState(userId, transaction),
    Ship.findOne({
      where: {
        owner_user_id: userId,
        is_active: true,
        in_combat: true
      },
      attributes: ['ship_id'],
      transaction
    })
  ]);

  if (!user) {
    return { allowed: false, reason: 'User not found', user: null, state: null };
  }

  if (activeCombatShip) {
    return { allowed: false, reason: 'Cannot change PvP state while one of your ships is in combat', user, state };
  }

  if (hasFutureTimestamp(state.hostility_until)) {
    return { allowed: false, reason: 'Cannot change PvP state while hostility protection is active', user, state };
  }

  if (hasFutureTimestamp(state.pvp_toggle_cooldown_until)) {
    return { allowed: false, reason: 'PvP toggle is cooling down', user, state };
  }

  return { allowed: true, reason: null, user, state };
};

const togglePvp = async ({
  userId,
  req = null,
  transaction = null
} = {}) => {
  const decision = await canTogglePvp({ userId, req, transaction });

  if (!decision.allowed) {
    await actionAuditService.record({
      userId,
      actionType: 'pvp_toggle',
      scopeType: 'auth',
      scopeId: userId,
      status: 'deny',
      reason: decision.reason,
      ipAddress: req?.ip || req?.socket?.remoteAddress || null,
      metadata: {},
      transaction
    });
    const error = new Error(decision.reason);
    error.statusCode = 409;
    throw error;
  }

  const nextValue = !decision.user.pvp_enabled;
  const cooldownUntil = new Date(Date.now() + config.antiCheat.pvpToggleCooldownMs);

  await decision.user.update({ pvp_enabled: nextValue }, { transaction });
  await decision.state.update({
    pvp_toggle_cooldown_until: cooldownUntil,
    updated_at: new Date()
  }, { transaction });

  await actionAuditService.record({
    userId,
    actionType: 'pvp_toggle',
    scopeType: 'auth',
    scopeId: userId,
    status: 'allow',
    reason: nextValue ? 'enabled' : 'disabled',
    ipAddress: req?.ip || req?.socket?.remoteAddress || null,
    metadata: { pvp_enabled: nextValue, cooldown_until: cooldownUntil.toISOString() },
    transaction
  });

  return {
    pvp_enabled: nextValue,
    cooldown_until: cooldownUntil
  };
};

const authorizePvpInitiation = async ({
  attackerShipId,
  defenderShipId,
  attackerUserId,
  req = null,
  transaction = null
} = {}) => {
  const [attackerShip, defenderShip] = await Promise.all([
    Ship.findByPk(attackerShipId, { transaction }),
    Ship.findByPk(defenderShipId, { transaction })
  ]);

  if (!attackerShip) {
    const error = new Error('Attacker ship not found');
    error.statusCode = 404;
    throw error;
  }

  if (!defenderShip) {
    const error = new Error('Defender ship not found');
    error.statusCode = 404;
    throw error;
  }

  if (attackerShip.owner_user_id !== attackerUserId) {
    const error = new Error('You do not own the attacking ship');
    error.statusCode = 403;
    throw error;
  }

  if (attackerShip.owner_user_id === defenderShip.owner_user_id) {
    const error = new Error('You cannot attack your own ship');
    error.statusCode = 400;
    throw error;
  }

  if (attackerShip.current_sector_id !== defenderShip.current_sector_id) {
    const error = new Error('Ships are not in the same sector');
    error.statusCode = 400;
    throw error;
  }

  if (attackerShip.in_combat || defenderShip.in_combat) {
    const error = new Error('One or both ships are already in combat');
    error.statusCode = 400;
    throw error;
  }

  const [attackerUser, defenderUser, zone] = await Promise.all([
    User.findByPk(attackerShip.owner_user_id, { transaction }),
    User.findByPk(defenderShip.owner_user_id, { transaction }),
    getCombatZonePolicy(attackerShip.current_sector_id, transaction)
  ]);
  const attackerProtection = await ensureProtectionState(attackerShip.owner_user_id, transaction);
  const defenderProtection = await ensureProtectionState(defenderShip.owner_user_id, transaction);

  const deny = async (reason, statusCode = 403, metadata = {}) => {
    await actionAuditService.record({
      userId: attackerUserId,
      actionType: 'pvp_initiation',
      scopeType: 'combat',
      scopeId: `${attackerShipId}:${defenderShipId}`,
      status: 'deny',
      reason,
      ipAddress: req?.ip || req?.socket?.remoteAddress || null,
      metadata: {
        sector_id: attackerShip.current_sector_id,
        attacker_ship_id: attackerShipId,
        defender_ship_id: defenderShipId,
        ...metadata
      },
      transaction
    });
    const error = new Error(reason);
    error.statusCode = statusCode;
    throw error;
  };

  if (!zone.sectorPolicy.rule_flags?.allow_pvp) {
    await deny('PvP is not allowed in this sector');
  }

  if (zone.sectorPolicy.rule_flags?.safe_harbor || zone.sectorPolicy.security_class === 'protected') {
    await deny('Hostile actions are blocked in this protected sector');
  }

  if (hasFutureTimestamp(defenderProtection.newbie_protection_until)) {
    await deny('Target player is under newbie protection');
  }

  if (hasFutureTimestamp(defenderProtection.travel_protection_until)) {
    await deny(
      `Target player is under ${describeTravelProtection(defenderProtection.travel_protection_reason)}`,
      403,
      {
        defender_travel_protection_reason: defenderProtection.travel_protection_reason,
        defender_travel_protection_until: defenderProtection.travel_protection_until
      }
    );
  }

  const defenderLastActiveAtMs = toDate(defenderUser?.last_active_at)?.getTime() || 0;
  if (
    defenderLastActiveAtMs > 0 &&
    (Date.now() - defenderLastActiveAtMs) > config.antiCheat.offlinePvpThresholdMs
  ) {
    await deny('This player is offline and protected from PvP', 403, {
      defender_last_active_at: defenderUser.last_active_at
    });
  }

  const repeatAttackCooldown = await getRepeatAttackCooldown({
    attackerUserId: attackerShip.owner_user_id,
    victimUserId: defenderShip.owner_user_id,
    transaction
  });
  if (repeatAttackCooldown) {
    const expiresAtMs = toDate(repeatAttackCooldown.expires_at)?.getTime() || Date.now();
    const minutesLeft = Math.max(1, Math.ceil((expiresAtMs - Date.now()) / 60000));
    await deny(
      `Anti-griefing cooldown: you cannot attack this player for ${minutesLeft} more minutes`,
      403,
      {
        cooldown_expires_at: repeatAttackCooldown.expires_at
      }
    );
  }

  if (attackerUser?.faction === defenderUser?.faction) {
    if (!attackerUser?.pvp_enabled || !defenderUser?.pvp_enabled) {
      await deny('Both players must have PvP enabled for same-faction combat', 400);
    }
  }

  await recordHostility({
    attackerUserId: attackerShip.owner_user_id,
    defenderUserId: defenderShip.owner_user_id,
    transaction
  });

  await actionAuditService.record({
    userId: attackerUserId,
    actionType: 'pvp_initiation',
    scopeType: 'combat',
    scopeId: `${attackerShipId}:${defenderShipId}`,
    status: 'allow',
    reason: 'authorized',
    ipAddress: req?.ip || req?.socket?.remoteAddress || null,
    metadata: {
      sector_id: attackerShip.current_sector_id,
      security_class: zone.sectorPolicy.security_class,
      attacker_ship_id: attackerShipId,
      defender_ship_id: defenderShipId
    },
    transaction
  });

  return {
    attackerShip,
    defenderShip,
    attackerUser,
    defenderUser,
    attackerProtection: buildProtectionSnapshot(attackerProtection),
    defenderProtection: buildProtectionSnapshot(defenderProtection),
    sectorPolicy: zone.sectorPolicy
  };
};

module.exports = {
  ensureProtectionState,
  grantTravelProtection,
  recordHostility,
  canTogglePvp,
  togglePvp,
  authorizePvpInitiation,
  buildProtectionSnapshot,
  resolveEntryProtection,
  describeTravelProtection
};
