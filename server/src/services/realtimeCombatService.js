const { Ship, NPC, CombatInstance, CombatLog, User, Sector, PvpCooldown, sequelize } = require('../models');
const { Op } = require('sequelize');
const config = require('../config');
const { emitToSector, emitToUser } = require('./socketService');
const worldPolicyService = require('./worldPolicyService');
const shipInteriorService = require('./shipInteriorService');

// ─── Tunables ─────────────────────────────────────────────────────
const COMBAT_EVENT_VERSION = 1;
const TICK_RATE_MS = 100;            // 10 Hz fixed step
const DT = TICK_RATE_MS / 1000;
const ARENA_SIZE = 400;
const ARENA_HALF = ARENA_SIZE / 2;
const WEAPON_RANGE = 200;
const ESCAPE_RADIUS = 200;
const VELOCITY_DAMPING = 0.95;
const WEAPON_COOLDOWN_SECONDS = 1.0;
const SHIELD_RECHARGE_RATE = 0.5;
const PERSIST_EVERY_TICKS = 50;       // checkpoint state every 5 s
const RECONNECT_GRACE_MS = 60_000;    // autopilot for 60 s after disconnect
const SNAPSHOT_EVERY_TICKS = 5;       // delta state snapshot rate (~ 2 Hz over wire)
const PVE_WARNING_GRACE_MS = 5_000;   // 5 s pre-encounter warning window for PvE

const NPC_AI_PROFILES = {
  PIRATE:        { weapons: 0.6, shields: 0.2, engines: 0.2, behavior: 'aggressive' },
  PIRATE_LORD:   { weapons: 0.6, shields: 0.2, engines: 0.2, behavior: 'aggressive' },
  TRADER:        { weapons: 0.2, shields: 0.2, engines: 0.6, behavior: 'flee' },
  PATROL:        { weapons: 0.33, shields: 0.34, engines: 0.33, behavior: 'balanced' },
  BOUNTY_HUNTER: { weapons: 0.5, shields: 0.3, engines: 0.2, behavior: 'aggressive' },
  AUTOPILOT:     { weapons: 0.5, shields: 0.4, engines: 0.1, behavior: 'balanced' }
};

// ─── Module State ─────────────────────────────────────────────────
const activeCombats = new Map(); // Map<combatId, CombatState>
let tickInterval = null;

// ─── Sector Policy Helpers ────────────────────────────────────────
const getSectorPolicy = async (sectorId, transaction = null) => {
  const sector = await Sector.findByPk(sectorId, { transaction });
  if (!sector) {
    const error = new Error('Sector not found');
    error.statusCode = 404;
    throw error;
  }
  return { sector, policy: worldPolicyService.buildDefaultSectorPolicy(sector) };
};

const getRewardMultiplier = (policy) => Number(policy?.rule_flags?.reward_multiplier || 1);

const assertCombatAllowedInSector = async (sectorId, { requirePvp = false, transaction = null } = {}) => {
  const { policy } = await getSectorPolicy(sectorId, transaction);
  if (policy.rule_flags?.safe_harbor) {
    const error = new Error('Combat is not allowed in safe harbor zones');
    error.statusCode = 403;
    throw error;
  }
  if (requirePvp && !policy.rule_flags?.allow_pvp) {
    const error = new Error('PvP combat is not allowed in this security zone');
    error.statusCode = 403;
    throw error;
  }
  return policy;
};

const recordPvpRepeatAttackCooldown = async ({ attackerUserId, victimUserId, transaction = null } = {}) => {
  if (!attackerUserId || !victimUserId || attackerUserId === victimUserId) return null;
  const now = new Date();
  const expiresAt = new Date(now.getTime() + config.antiCheat.pvpRepeatTargetCooldownMs);
  return PvpCooldown.upsert({
    attacker_user_id: attackerUserId,
    victim_user_id: victimUserId,
    expires_at: expiresAt,
    created_at: now
  }, { transaction });
};

// ─── Single Combat Event Channel ──────────────────────────────────
/**
 * Emit a single versioned combat event to the sector room and to each player owner.
 * All combat-related events (snapshot, delta, hit, destroyed, escaped, warning, resolved)
 * flow through this one channel with `type` discriminator.
 */
const emitCombatEvent = (combatState, type, payload = {}) => {
  combatState.seq = (combatState.seq || 0) + 1;
  const evt = {
    v: COMBAT_EVENT_VERSION,
    seq: combatState.seq,
    ts: Date.now(),
    combatId: combatState.combatId,
    type,
    ...payload
  };
  emitToSector(combatState.sectorId, 'combat:event', evt);
  for (const ship of combatState.ships.values()) {
    if (!ship.isNPC && ship.ownerId) {
      emitToUser(ship.ownerId, 'combat:event', evt);
    }
  }
};

/**
 * Send a full state snapshot to one user (used on join/reconnect).
 */
const sendSnapshotToUser = (combatState, userId) => {
  if (!userId) return;
  const evt = {
    v: COMBAT_EVENT_VERSION,
    seq: combatState.seq,
    ts: Date.now(),
    combatId: combatState.combatId,
    type: 'snapshot',
    snapshot: serializeCombatState(combatState)
  };
  emitToUser(userId, 'combat:event', evt);
};

// ─── Tick Lifecycle ───────────────────────────────────────────────
const startCombatTick = () => {
  if (tickInterval) return;
  tickInterval = setInterval(() => {
    for (const [combatId, combatState] of activeCombats) {
      try {
        processTick(combatState);
      } catch (err) {
        console.error(`[RealtimeCombat] Tick error for combat ${combatId}:`, err);
      }
    }
  }, TICK_RATE_MS);
  console.log('[RealtimeCombat] Combat tick started (10 Hz)');
};

const stopCombatTick = () => {
  if (tickInterval) {
    clearInterval(tickInterval);
    tickInterval = null;
    console.log('[RealtimeCombat] Combat tick stopped');
  }
};

// ─── Damage ───────────────────────────────────────────────────────
const applyDamageToTarget = (target, damage, targetSystem) => {
  let remaining = damage;
  if (targetSystem === 'hull') {
    const shieldPortion = Math.floor(remaining * 0.3);
    const hullPortion = remaining - shieldPortion;
    if (target.stats.shields > 0 && shieldPortion > 0) {
      const shieldDmg = Math.min(target.stats.shields, shieldPortion);
      target.stats.shields -= shieldDmg;
    }
    target.stats.hull = Math.max(0, target.stats.hull - hullPortion);
  } else {
    if (target.stats.shields > 0) {
      const shieldDmg = Math.min(target.stats.shields, remaining);
      target.stats.shields -= shieldDmg;
      remaining -= shieldDmg;
    }
    if (remaining > 0) {
      target.stats.hull = Math.max(0, target.stats.hull - remaining);
    }
  }
};

// ─── Tick ─────────────────────────────────────────────────────────
const processTick = (combatState) => {
  combatState.tickCount = (combatState.tickCount || 0) + 1;
  const { ships } = combatState;
  const now = Date.now();

  // ── Pre-encounter warning grace: no weapons fire, no destruction, no end ──
  // The combat instance exists (so it is recoverable & visible to clients) but
  // damage is suppressed until the player has had 5 s to react.
  const pending = !!(combatState.pendingUntil && now < combatState.pendingUntil);
  if (combatState.pendingUntil && !pending && !combatState.pendingExpired) {
    combatState.pendingExpired = true;
    combatState.pendingUntil = null;
    emitCombatEvent(combatState, 'engaged', { sectorId: combatState.sectorId });
  }

  for (const ship of ships.values()) {
    if (!ship.alive) continue;

    // Movement (allowed during pending so positions feel live)
    ship.position.x += ship.velocity.vx * DT;
    ship.position.y += ship.velocity.vy * DT;
    ship.velocity.vx *= VELOCITY_DAMPING;
    ship.velocity.vy *= VELOCITY_DAMPING;
    ship.position.x = Math.max(-ARENA_HALF, Math.min(ARENA_HALF, ship.position.x));
    ship.position.y = Math.max(-ARENA_HALF, Math.min(ARENA_HALF, ship.position.y));

    // Weapon fire — gated entirely while pending
    if (!pending && ship.targetShipId && ship.weaponCooldown <= 0) {
      const target = ships.get(ship.targetShipId);
      if (target && target.alive) {
        const dx = target.position.x - ship.position.x;
        const dy = target.position.y - ship.position.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < WEAPON_RANGE) {
          const damage = ship.stats.attackPower * ship.powerAllocation.weapons * (0.8 + Math.random() * 0.4);
          const roundedDamage = Math.max(1, Math.round(damage));
          applyDamageToTarget(target, roundedDamage, ship.targetSystem);
          ship.weaponCooldown = WEAPON_COOLDOWN_SECONDS;

          emitCombatEvent(combatState, 'hit', {
            attackerId: ship.shipId,
            targetId: target.shipId,
            damage: roundedDamage,
            targetSystem: ship.targetSystem,
            targetHull: target.stats.hull,
            targetShields: target.stats.shields
          });
        }
      }
    }

    // Shield recharge
    if (ship.stats.shields < ship.stats.maxShields) {
      const recharge = SHIELD_RECHARGE_RATE * ship.stats.maxShields * ship.powerAllocation.shields * DT;
      ship.stats.shields = Math.min(ship.stats.maxShields, ship.stats.shields + recharge);
    }

    if (ship.weaponCooldown > 0) ship.weaponCooldown = Math.max(0, ship.weaponCooldown - DT);

    // Destruction (cannot occur while pending since damage was gated)
    if (!pending && ship.stats.hull <= 0) {
      ship.alive = false;
      emitCombatEvent(combatState, 'destroyed', { shipId: ship.shipId, isNPC: ship.isNPC });
    }

    // Disengage check — players are allowed to slip away during the warning
    // window too, otherwise "flee before the fight starts" wouldn't work.
    if (ship.disengaging && ship.alive) {
      const distFromCenter = Math.sqrt(ship.position.x * ship.position.x + ship.position.y * ship.position.y);
      if (distFromCenter > ESCAPE_RADIUS) {
        ship.alive = false;
        ship.escaped = true;
        emitCombatEvent(combatState, 'escaped', { shipId: ship.shipId, isNPC: ship.isNPC });
      }
    }
  }

  // ── AI: NPCs hold fire during pending but still position themselves ──
  for (const ship of ships.values()) {
    if (!ship.alive) continue;
    if (ship.isNPC) {
      processNPCAI(combatState, ship, NPC_AI_PROFILES[ship.npcType] || NPC_AI_PROFILES.PATROL);
    } else if (ship.aiControlled) {
      processNPCAI(combatState, ship, NPC_AI_PROFILES.AUTOPILOT);
    }
  }

  // ── Reconnect grace expiration → permanent autopilot ──
  for (const ship of ships.values()) {
    if (!ship.isNPC && ship.aiControlled && ship.autopilotUntil && now > ship.autopilotUntil) {
      // Grace expired; AI continues fighting until end (do nothing — flag stays set)
    }
  }

  // ── Combat end check ──
  // While pending we still allow resolution if every player escaped (e.g. they
  // hit "flee" during the warning and slipped past the escape radius). But we
  // don't auto-resolve from "no remaining sides" because no real damage has
  // landed yet — that case will only happen via explicit cancellation.
  const remainingSides = new Set();
  let anyAlive = false;
  for (const ship of ships.values()) {
    if (!ship.alive) continue;
    anyAlive = true;
    remainingSides.add(ship.ownerId || `npc_${ship.shipId}`);
  }

  if (anyAlive && remainingSides.size <= 1) {
    resolveCombat(combatState.combatId).catch(err => {
      console.error(`[RealtimeCombat] Resolve failed for ${combatState.combatId}:`, err);
    });
    return;
  }

  // ── Periodic delta snapshot to sector ──
  if (combatState.tickCount % SNAPSHOT_EVERY_TICKS === 0) {
    emitCombatEvent(combatState, 'state', { snapshot: serializeCombatState(combatState) });
  }

  // ── Periodic DB checkpoint for crash recovery ──
  if (combatState.tickCount % PERSIST_EVERY_TICKS === 0) {
    persistSnapshot(combatState).catch(err => {
      console.error(`[RealtimeCombat] Persist failed for ${combatState.combatId}:`, err);
    });
  }
};

// ─── NPC / Autopilot AI ───────────────────────────────────────────
const processNPCAI = (combatState, npcShip, profile) => {
  npcShip.powerAllocation.weapons = profile.weapons;
  npcShip.powerAllocation.shields = profile.shields;
  npcShip.powerAllocation.engines = profile.engines;

  // Find nearest enemy
  let nearestEnemy = null;
  let nearestDist = Infinity;
  for (const ship of combatState.ships.values()) {
    if (!ship.alive || ship.shipId === npcShip.shipId) continue;
    if (ship.ownerId && ship.ownerId === npcShip.ownerId) continue;
    const dx = ship.position.x - npcShip.position.x;
    const dy = ship.position.y - npcShip.position.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist < nearestDist) {
      nearestDist = dist;
      nearestEnemy = ship;
    }
  }
  if (!nearestEnemy) return;

  if (profile.behavior === 'flee') {
    const dx = npcShip.position.x - nearestEnemy.position.x;
    const dy = npcShip.position.y - nearestEnemy.position.y;
    const angle = Math.atan2(dy, dx);
    npcShip.heading = angle;
    const thrust = npcShip.stats.speed * npcShip.powerAllocation.engines;
    npcShip.velocity.vx += Math.cos(angle) * thrust * DT;
    npcShip.velocity.vy += Math.sin(angle) * thrust * DT;
    npcShip.disengaging = true;
    npcShip.targetShipId = nearestEnemy.shipId;
    npcShip.targetSystem = 'shields';
  } else {
    const dx = nearestEnemy.position.x - npcShip.position.x;
    const dy = nearestEnemy.position.y - npcShip.position.y;
    const angle = Math.atan2(dy, dx);
    npcShip.heading = angle;
    if (nearestDist > WEAPON_RANGE * 0.7) {
      const thrust = npcShip.stats.speed * npcShip.powerAllocation.engines;
      npcShip.velocity.vx += Math.cos(angle) * thrust * DT;
      npcShip.velocity.vy += Math.sin(angle) * thrust * DT;
    }
    npcShip.targetShipId = nearestEnemy.shipId;
    npcShip.targetSystem = 'hull';
  }
};

// ─── Initiate ─────────────────────────────────────────────────────
const initiateCombat = async (sectorId, ships, combatType = 'PVE') => {
  const participantIds = ships.map(s => s.shipId);
  const instance = await CombatInstance.create({
    sector_id: sectorId,
    status: 'active',
    combat_type: combatType,
    participants: participantIds,
    started_at: new Date()
  });
  const combatId = instance.combat_id;

  const shipMap = new Map();
  ships.forEach((s, index) => {
    const angle = (2 * Math.PI * index) / ships.length;
    const spawnRadius = ARENA_HALF * 0.6;
    const x = Math.cos(angle) * spawnRadius;
    const y = Math.sin(angle) * spawnRadius;
    shipMap.set(s.shipId, {
      shipId: s.shipId,
      ownerId: s.ownerId || null,
      isNPC: !!s.isNPC,
      npcType: s.npcType || null,
      tier: s.tier || null,
      name: s.name || null,
      shipType: s.shipType || null,
      position: { x, y },
      velocity: { vx: 0, vy: 0 },
      heading: angle + Math.PI,
      powerAllocation: { weapons: 0.4, shields: 0.3, engines: 0.3 },
      targetSystem: 'hull',
      targetShipId: null,
      weaponCooldown: 0,
      stats: {
        maxHull: s.stats.maxHull,
        hull: s.stats.hull,
        maxShields: s.stats.maxShields,
        shields: s.stats.shields,
        attackPower: s.stats.attackPower,
        defenseRating: s.stats.defenseRating,
        speed: s.stats.speed,
        maxEnergy: s.stats.maxEnergy || 100,
        energy: s.stats.energy || 100
      },
      alive: true,
      escaped: false,
      disengaging: false,
      aiControlled: false,
      autopilotUntil: null
    });
  });

  // PvE encounters open with a 5 s warning window during which damage is
  // suppressed; players can flee, engage immediately, or deploy countermeasures.
  // PvP combats remain instant — both sides opted in.
  const pendingUntil = combatType === 'PVE' ? Date.now() + PVE_WARNING_GRACE_MS : null;

  const combatState = {
    combatId,
    sectorId,
    combatType,
    startedAt: new Date(),
    ships: shipMap,
    seq: 0,
    tickCount: 0,
    pendingUntil,
    pendingExpired: !pendingUntil
  };

  activeCombats.set(combatId, combatState);
  startCombatTick();

  // Initial snapshot — clients adopt this and bind to the combatId.
  emitCombatEvent(combatState, 'started', {
    sectorId,
    participants: participantIds,
    pendingUntil,
    snapshot: serializeCombatState(combatState)
  });

  // PvE warning so the targeted player sees the engagement and a real
  // 5 s reaction window before any damage can land.
  if (pendingUntil) {
    const tieredHostiles = Array.from(shipMap.values())
      .filter(s => s.isNPC)
      .map(s => ({ shipId: s.shipId, npcType: s.npcType, tier: s.tier, name: s.name }));
    if (tieredHostiles.length > 0) {
      for (const ship of shipMap.values()) {
        if (!ship.isNPC && ship.ownerId) {
          emitToUser(ship.ownerId, 'combat:event', {
            v: COMBAT_EVENT_VERSION,
            seq: 0,
            ts: Date.now(),
            combatId,
            type: 'warning',
            hostiles: tieredHostiles,
            pendingUntil,
            graceMs: PVE_WARNING_GRACE_MS
          });
        }
      }
    }
  }

  // Persist initial state immediately so a crash before the first periodic checkpoint
  // does not leave participant ships permanently stuck with in_combat=true.
  persistSnapshot(combatState).catch(err => {
    console.error(`[RealtimeCombat] Initial persist failed for ${combatId}:`, err);
  });

  return combatId;
};

const initiatePlayerCombat = async (attackerShipId, defenderShipId, requesterUserId = null) => {
  const attacker = await Ship.findOne({ where: { ship_id: attackerShipId, is_active: true } });
  if (!attacker) throw Object.assign(new Error('Attacker ship not found'), { statusCode: 404 });
  if (requesterUserId && attacker.owner_user_id !== requesterUserId) {
    throw Object.assign(new Error('You do not own the attacking ship'), { statusCode: 403 });
  }
  const defender = await Ship.findOne({ where: { ship_id: defenderShipId, is_active: true } });
  if (!defender) throw Object.assign(new Error('Defender ship not found'), { statusCode: 404 });
  if (attacker.current_sector_id !== defender.current_sector_id) {
    throw Object.assign(new Error('Ships are not in the same sector'), { statusCode: 400 });
  }
  if (attacker.in_combat || defender.in_combat) {
    throw Object.assign(new Error('One or both ships are already in combat'), { statusCode: 400 });
  }
  await assertCombatAllowedInSector(attacker.current_sector_id, { requirePvp: true });

  try {
    await attacker.update({ in_combat: true });
    await defender.update({ in_combat: true });
  } catch (error) {
    await Promise.allSettled([
      attacker.update({ in_combat: false }).catch(() => null),
      defender.update({ in_combat: false }).catch(() => null)
    ]);
    throw error;
  }

  const buildShip = (s, isNPC = false) => ({
    shipId: s.ship_id,
    ownerId: s.owner_user_id,
    isNPC,
    name: s.name,
    stats: {
      maxHull: s.max_hull_points, hull: s.hull_points,
      maxShields: s.max_shield_points, shields: s.shield_points,
      attackPower: s.attack_power, defenseRating: s.defense_rating,
      speed: s.speed, maxEnergy: s.max_energy, energy: s.energy
    }
  });

  return initiateCombat(attacker.current_sector_id, [buildShip(attacker), buildShip(defender)], 'PVP');
};

const initiateNPCCombat = async (shipId, npcId, requesterUserId = null) => {
  const ship = await Ship.findOne({ where: { ship_id: shipId, is_active: true } });
  if (!ship) throw Object.assign(new Error('Ship not found'), { statusCode: 404 });
  if (requesterUserId && ship.owner_user_id !== requesterUserId) {
    throw Object.assign(new Error('You do not own this ship'), { statusCode: 403 });
  }
  const npc = await NPC.findOne({ where: { npc_id: npcId, is_alive: true } });
  if (!npc) throw Object.assign(new Error('NPC not found'), { statusCode: 404 });
  if (ship.current_sector_id !== npc.current_sector_id) {
    throw Object.assign(new Error('Ship and NPC are not in the same sector'), { statusCode: 400 });
  }
  if (ship.in_combat) throw Object.assign(new Error('Ship is already in combat'), { statusCode: 400 });
  await assertCombatAllowedInSector(ship.current_sector_id);

  try { await ship.update({ in_combat: true }); }
  catch (error) {
    await ship.update({ in_combat: false }).catch(() => null);
    throw error;
  }

  const ships = [
    {
      shipId: ship.ship_id, ownerId: ship.owner_user_id, isNPC: false, name: ship.name,
      stats: {
        maxHull: ship.max_hull_points, hull: ship.hull_points,
        maxShields: ship.max_shield_points, shields: ship.shield_points,
        attackPower: ship.attack_power, defenseRating: ship.defense_rating,
        speed: ship.speed, maxEnergy: ship.max_energy, energy: ship.energy
      }
    },
    {
      shipId: npc.npc_id, ownerId: null, isNPC: true,
      npcType: npc.npc_type, tier: npc.intelligence_tier || 'standard', name: npc.name,
      shipType: npc.ship_type,
      stats: {
        maxHull: npc.max_hull_points, hull: npc.hull_points,
        maxShields: npc.max_shield_points, shields: npc.shield_points,
        attackPower: npc.attack_power, defenseRating: npc.defense_rating,
        speed: npc.speed, maxEnergy: 100, energy: 100
      }
    }
  ];
  return initiateCombat(ship.current_sector_id, ships, 'PVE');
};

// ─── Player Commands ──────────────────────────────────────────────
const handleCommand = (combatId, shipId, command) => {
  const combatState = activeCombats.get(combatId);
  if (!combatState) throw Object.assign(new Error('Combat not found'), { statusCode: 404 });
  const ship = combatState.ships.get(shipId);
  if (!ship || !ship.alive) throw Object.assign(new Error('Ship not found in this combat'), { statusCode: 404 });

  // A live player command implicitly resumes manual control
  if (!ship.isNPC && ship.aiControlled) {
    ship.aiControlled = false;
    ship.autopilotUntil = null;
    emitCombatEvent(combatState, 'autopilot_off', { shipId: ship.shipId });
  }

  switch (command.type) {
    case 'set_heading': {
      const heading = parseFloat(command.heading);
      if (!isNaN(heading)) ship.heading = heading;
      break;
    }
    case 'set_thrust': {
      const thrust = Math.max(0, Math.min(1, parseFloat(command.thrust) || 0));
      const thrustForce = ship.stats.speed * ship.powerAllocation.engines * thrust;
      ship.velocity.vx += Math.cos(ship.heading) * thrustForce * DT;
      ship.velocity.vy += Math.sin(ship.heading) * thrustForce * DT;
      break;
    }
    case 'set_power':
    case 'power_allocation': {
      const w = parseFloat(command.weapons) || 0;
      const s = parseFloat(command.shields) || 0;
      const e = parseFloat(command.engines) || 0;
      // Accept either 0–1 fractions or 0–100 percentages
      const total = w + s + e;
      if (total <= 0) break;
      ship.powerAllocation.weapons = w / total;
      ship.powerAllocation.shields = s / total;
      ship.powerAllocation.engines = e / total;
      break;
    }
    case 'set_target':
    case 'select_target': {
      const targetId = command.targetShipId || command.target_id;
      if (targetId) {
        const target = combatState.ships.get(targetId);
        if (target && target.alive) ship.targetShipId = targetId;
      } else {
        ship.targetShipId = null;
      }
      const subsys = command.targetSystem || command.subsystem;
      if (subsys === 'hull' || subsys === 'shields') ship.targetSystem = subsys;
      break;
    }
    case 'target_subsystem': {
      const subsys = command.targetSystem || command.subsystem;
      if (subsys === 'hull' || subsys === 'shields') ship.targetSystem = subsys;
      break;
    }
    case 'disengage': {
      // If we're still in the warning window the player chose "flee" before
      // the fight started — tear the combat down cleanly so they aren't
      // locked in or punished.
      if (combatState.pendingUntil && Date.now() < combatState.pendingUntil) {
        cancelPendingCombat(combatState, ship.ownerId).catch(err => {
          console.error(`[RealtimeCombat] Cancel-pending failed for ${combatState.combatId}:`, err);
        });
        break;
      }
      ship.disengaging = true;
      const angle = Math.atan2(ship.position.y, ship.position.x);
      ship.heading = angle;
      const escapeThrust = ship.stats.speed * ship.powerAllocation.engines;
      ship.velocity.vx += Math.cos(angle) * escapeThrust * DT;
      ship.velocity.vy += Math.sin(angle) * escapeThrust * DT;
      break;
    }
    case 'engage_now': {
      // Player chose to skip the warning window and start firing immediately.
      if (combatState.pendingUntil && Date.now() < combatState.pendingUntil) {
        combatState.pendingUntil = Date.now();
      }
      break;
    }
    case 'countermeasure': {
      // Lightweight countermeasure: full shield top-up + brief weapons-cooldown
      // reset on hostiles. Only valid during the warning window so players are
      // rewarded for reacting quickly.
      if (!combatState.pendingUntil || Date.now() >= combatState.pendingUntil) break;
      ship.stats.shields = ship.stats.maxShields;
      for (const other of combatState.ships.values()) {
        if (other.isNPC && other.alive) other.weaponCooldown = Math.max(other.weaponCooldown, 1.5);
      }
      emitCombatEvent(combatState, 'countermeasure', { shipId: ship.shipId });
      break;
    }
    default:
      break;
  }
};

// ─── Pending-window cancellation ──────────────────────────────────
// Called when a player chooses "flee" during the 5 s warning window. The
// combat instance is marked cancelled, every participant ship has in_combat
// cleared, and listeners get a `cancelled` event so the UI can dismiss.
const cancelPendingCombat = async (combatState, ownerId = null) => {
  if (!activeCombats.has(combatState.combatId)) return;
  activeCombats.delete(combatState.combatId);
  if (activeCombats.size === 0) stopCombatTick();

  const playerShipIds = [];
  for (const ship of combatState.ships.values()) {
    if (!ship.isNPC) playerShipIds.push(ship.shipId);
  }

  try {
    if (playerShipIds.length > 0) {
      await Ship.update({ in_combat: false }, { where: { ship_id: { [Op.in]: playerShipIds } } });
    }
  } catch (err) {
    console.error(`[RealtimeCombat] Failed to clear in_combat on cancel ${combatState.combatId}:`, err);
  }

  try {
    await CombatInstance.update({
      status: 'resolved',
      result: { winnerType: 'cancelled', cancelledBy: ownerId || null, reason: 'fled_warning' },
      ended_at: new Date(),
      state: null
    }, { where: { combat_id: combatState.combatId } });
  } catch (err) {
    console.error(`[RealtimeCombat] Failed to mark cancelled instance ${combatState.combatId}:`, err);
  }

  emitCombatEvent(combatState, 'cancelled', {
    reason: 'fled_warning',
    cancelledBy: ownerId || null
  });
};

// ─── Persistence (write-through cache) ────────────────────────────
const serializeShipsForPersist = (ships) => {
  const out = [];
  for (const ship of ships.values()) {
    out.push({
      shipId: ship.shipId,
      ownerId: ship.ownerId,
      isNPC: ship.isNPC,
      npcType: ship.npcType,
      tier: ship.tier,
      name: ship.name,
      shipType: ship.shipType || null,
      position: { ...ship.position },
      velocity: { ...ship.velocity },
      heading: ship.heading,
      powerAllocation: { ...ship.powerAllocation },
      targetShipId: ship.targetShipId,
      targetSystem: ship.targetSystem,
      weaponCooldown: ship.weaponCooldown,
      stats: { ...ship.stats },
      alive: ship.alive,
      escaped: ship.escaped,
      disengaging: ship.disengaging,
      aiControlled: ship.aiControlled,
      autopilotUntil: ship.autopilotUntil
    });
  }
  return out;
};

const persistSnapshot = async (combatState) => {
  await CombatInstance.update({
    state: {
      ships: serializeShipsForPersist(combatState.ships),
      sectorId: combatState.sectorId,
      combatType: combatState.combatType,
      pendingUntil: combatState.pendingUntil || null,
      pendingExpired: !!combatState.pendingExpired
    },
    tick_seq: combatState.seq,
    last_tick_at: new Date()
  }, { where: { combat_id: combatState.combatId } });
};

const recoverActiveCombats = async () => {
  try {
    const rows = await CombatInstance.findAll({ where: { status: 'active' } });
    if (rows.length === 0) return 0;
    let recovered = 0;
    for (const row of rows) {
      try {
        if (!row.state || !Array.isArray(row.state.ships) || row.state.ships.length === 0) {
          // No usable snapshot — mark as resolved (draw) to prevent zombie rows.
          // Clear in_combat on any participant ships so they are not stuck forever.
          const participantShipIds = Array.isArray(row.participants) ? row.participants.filter(Boolean) : [];
          if (participantShipIds.length > 0) {
            try {
              await Ship.update({ in_combat: false }, { where: { ship_id: { [Op.in]: participantShipIds } } });
            } catch (e) {
              console.error(`[RealtimeCombat] Failed to clear in_combat for stuck participants of ${row.combat_id}:`, e);
            }
          }
          await row.update({ status: 'resolved', result: { winnerType: 'draw', recovered: false }, ended_at: new Date() });
          continue;
        }
        const shipMap = new Map();
        for (const s of row.state.ships) {
          shipMap.set(s.shipId, {
            ...s,
            // Disconnected players come back as autopilot until they reconnect
            aiControlled: !s.isNPC ? true : !!s.aiControlled,
            autopilotUntil: !s.isNPC ? Date.now() + RECONNECT_GRACE_MS : null
          });
        }
        const persistedPendingUntil = row.state && row.state.pendingUntil ? Number(row.state.pendingUntil) : null;
        const combatState = {
          combatId: row.combat_id,
          sectorId: row.sector_id,
          combatType: row.combat_type || 'PVE',
          startedAt: row.started_at,
          ships: shipMap,
          seq: row.tick_seq || 0,
          tickCount: 0,
          // If the warning window survived a restart and is still in the
          // future we honor it; otherwise the encounter is fully engaged.
          pendingUntil: persistedPendingUntil && persistedPendingUntil > Date.now() ? persistedPendingUntil : null,
          pendingExpired: !(persistedPendingUntil && persistedPendingUntil > Date.now())
        };
        activeCombats.set(row.combat_id, combatState);
        recovered += 1;
        emitCombatEvent(combatState, 'recovered', { snapshot: serializeCombatState(combatState) });
      } catch (err) {
        console.error(`[RealtimeCombat] Failed to recover combat ${row.combat_id}:`, err);
      }
    }
    if (recovered > 0) {
      console.log(`[RealtimeCombat] Recovered ${recovered} active combat(s) from DB`);
      startCombatTick();
    }
    return recovered;
  } catch (err) {
    console.error('[RealtimeCombat] recoverActiveCombats failed:', err);
    return 0;
  }
};

// ─── Reconnect / Autopilot Hooks ──────────────────────────────────
const notifyPlayerDisconnect = (userId) => {
  if (!userId) return;
  const now = Date.now();
  for (const combatState of activeCombats.values()) {
    for (const ship of combatState.ships.values()) {
      if (!ship.isNPC && ship.ownerId === userId && ship.alive) {
        ship.aiControlled = true;
        ship.autopilotUntil = now + RECONNECT_GRACE_MS;
        emitCombatEvent(combatState, 'autopilot_on', {
          shipId: ship.shipId,
          autopilotUntil: ship.autopilotUntil
        });
      }
    }
  }
};

const notifyPlayerReconnect = (userId) => {
  if (!userId) return;
  for (const combatState of activeCombats.values()) {
    let touched = false;
    for (const ship of combatState.ships.values()) {
      if (!ship.isNPC && ship.ownerId === userId && ship.aiControlled) {
        ship.aiControlled = false;
        ship.autopilotUntil = null;
        touched = true;
      }
    }
    if (touched) {
      sendSnapshotToUser(combatState, userId);
      emitCombatEvent(combatState, 'autopilot_off', { ownerId: userId });
    }
  }
};

// ─── Resolution ───────────────────────────────────────────────────
const resolveCombat = async (combatId) => {
  const combatState = activeCombats.get(combatId);
  if (!combatState) return;
  const { sectorId, ships, startedAt } = combatState;

  const survivors = [];
  const destroyed = [];
  const escaped = [];
  for (const ship of ships.values()) {
    if (ship.escaped) escaped.push(ship);
    else if (ship.alive) survivors.push(ship);
    else destroyed.push(ship);
  }

  let winnerOwnerId = null;
  let winnerType = 'draw';
  if (survivors.length > 0) {
    winnerOwnerId = survivors[0].ownerId;
    winnerType = survivors[0].isNPC ? 'npc' : 'player';
  }

  const t = await sequelize.transaction();
  try {
    for (const ship of ships.values()) {
      if (ship.isNPC) {
        try {
          if (ship.alive) {
            await NPC.update({
              hull_points: Math.max(0, Math.floor(ship.stats.hull)),
              shield_points: Math.max(0, Math.floor(ship.stats.shields)),
              last_action_at: new Date()
            }, { where: { npc_id: ship.shipId }, transaction: t });
          } else if (!ship.escaped) {
            await NPC.update({
              is_alive: false, hull_points: 0, shield_points: 0,
              respawn_at: new Date(Date.now() + 5 * 60 * 1000)
            }, { where: { npc_id: ship.shipId }, transaction: t });
          }
        } catch (err) { console.error(`[RealtimeCombat] NPC update failed ${ship.shipId}:`, err); }
      } else {
        try {
          const updateData = {
            hull_points: Math.max(0, Math.floor(ship.stats.hull)),
            shield_points: Math.max(0, Math.floor(ship.stats.shields)),
            energy: Math.max(0, Math.floor(ship.stats.energy)),
            in_combat: false
          };
          if (!ship.alive && !ship.escaped) updateData.is_active = false;
          await Ship.update(updateData, { where: { ship_id: ship.shipId }, transaction: t });
        } catch (err) { console.error(`[RealtimeCombat] Ship update failed ${ship.shipId}:`, err); }
      }
    }

    const { policy: resolvedSectorPolicy } = await getSectorPolicy(sectorId, t).catch(() => ({ policy: {} }));
    const rewardMultiplier = getRewardMultiplier(resolvedSectorPolicy);

    let creditsLooted = 0;
    let experienceGained = 0;
    if (winnerType === 'player' && winnerOwnerId) {
      for (const ship of destroyed) {
        if (ship.isNPC) {
          try {
            const npc = await NPC.findByPk(ship.shipId, { transaction: t });
            if (npc) {
              creditsLooted += Math.round((npc.credits_carried || 0) * rewardMultiplier);
              experienceGained += Math.round((npc.experience_value || 0) * rewardMultiplier);
            }
          } catch (err) { console.error(`[RealtimeCombat] NPC loot fetch failed ${ship.shipId}:`, err); }
        }
      }
      if (creditsLooted > 0 || experienceGained > 0) {
        try {
          const user = await User.findByPk(winnerOwnerId, { transaction: t, lock: t.LOCK.UPDATE });
          if (user && creditsLooted > 0) {
            await user.update({ credits: user.credits + creditsLooted }, { transaction: t });
          }
        } catch (err) { console.error(`[RealtimeCombat] Credit award failed:`, err); }
        if (experienceGained > 0) {
          try {
            const progressionService = require('./progressionService');
            await progressionService.awardXP(winnerOwnerId, experienceGained, 'combat', t);
          } catch { /* xp failure is non-fatal */ }
        }
      }
    }

    const allShips = Array.from(ships.values());
    const playerShips = allShips.filter(s => !s.isNPC);
    const npcShips = allShips.filter(s => s.isNPC);

    if (playerShips.length >= 2) {
      try {
        const factionService = require('./factionService');
        const factionWarService = require('./factionWarService');
        for (const winner of survivors.filter(s => !s.isNPC)) {
          for (const loser of destroyed.filter(s => !s.isNPC)) {
            const wu = await User.findByPk(winner.ownerId, { transaction: t });
            const lu = await User.findByPk(loser.ownerId, { transaction: t });
            if (wu && lu) {
              if (wu.faction === lu.faction) {
                await factionService.modifyStanding(winner.ownerId, wu.faction, -50, 'friendly_fire', t);
              } else {
                await factionService.modifyStanding(winner.ownerId, wu.faction, 25, 'pvp_kill', t);
                await factionService.modifyStanding(winner.ownerId, lu.faction, -25, 'pvp_kill', t);
                const activeWar = await factionWarService.checkWarBetweenFactions(wu.faction, lu.faction);
                if (activeWar) {
                  await factionWarService.addWarScore(activeWar.war_id, wu.faction, 10, t);
                }
              }
            }
          }
        }
      } catch (e) { console.error('[RealtimeCombat] Faction scoring failed:', e); }

      for (const winner of survivors.filter(s => !s.isNPC && s.ownerId)) {
        for (const loser of destroyed.filter(s => !s.isNPC && s.ownerId)) {
          try {
            await recordPvpRepeatAttackCooldown({
              attackerUserId: winner.ownerId, victimUserId: loser.ownerId, transaction: t
            });
          } catch (e) { console.error('[RealtimeCombat] PvP cooldown failed:', e); }
        }
      }
    }

    const result = {
      winnerType,
      winnerOwnerId,
      survivors: survivors.map(s => ({ shipId: s.shipId, isNPC: s.isNPC, hull: Math.floor(s.stats.hull) })),
      destroyed: destroyed.map(s => ({ shipId: s.shipId, isNPC: s.isNPC })),
      escaped: escaped.map(s => ({ shipId: s.shipId, isNPC: s.isNPC })),
      duration: Date.now() - new Date(startedAt).getTime(),
      rewardMultiplier,
      credits_looted: creditsLooted,
      experience_gained: experienceGained
    };

    try {
      await CombatInstance.update({
        status: 'resolved', result, ended_at: new Date(),
        state: null // clear hot snapshot once finished
      }, { where: { combat_id: combatId }, transaction: t });
    } catch (err) { console.error(`[RealtimeCombat] CombatInstance update failed ${combatId}:`, err); }

    const roundsFought = Math.max(1, Math.ceil((Date.now() - new Date(startedAt).getTime()) / TICK_RATE_MS));
    for (const pShip of playerShips) {
      for (const nShip of npcShips) {
        try {
          await CombatLog.create({
            attacker_ship_id: pShip.shipId,
            defender_npc_id: nShip.shipId,
            sector_id: sectorId,
            combat_type: 'PVE',
            rounds_fought: roundsFought,
            winner_type: pShip.alive ? 'attacker' : (nShip.alive ? 'defender' : 'draw'),
            attacker_damage_dealt: Math.floor(nShip.stats.maxHull - nShip.stats.hull),
            defender_damage_dealt: Math.floor(pShip.stats.maxHull - pShip.stats.hull),
            attacker_hull_remaining: Math.max(0, Math.floor(pShip.stats.hull)),
            defender_hull_remaining: Math.max(0, Math.floor(nShip.stats.hull)),
            credits_looted: 0, experience_gained: 0, combat_rounds: []
          }, { transaction: t });
        } catch (err) { console.error('[RealtimeCombat] CombatLog PVE failed:', err); }
      }
    }
    if (playerShips.length >= 2) {
      try {
        await CombatLog.create({
          attacker_ship_id: playerShips[0].shipId,
          defender_ship_id: playerShips[1].shipId,
          sector_id: sectorId,
          combat_type: 'PVP',
          rounds_fought: roundsFought,
          winner_type: playerShips[0].alive ? 'attacker' : (playerShips[1].alive ? 'defender' : 'draw'),
          attacker_damage_dealt: Math.floor(playerShips[1].stats.maxHull - playerShips[1].stats.hull),
          defender_damage_dealt: Math.floor(playerShips[0].stats.maxHull - playerShips[0].stats.hull),
          attacker_hull_remaining: Math.max(0, Math.floor(playerShips[0].stats.hull)),
          defender_hull_remaining: Math.max(0, Math.floor(playerShips[1].stats.hull)),
          credits_looted: 0, experience_gained: 0, combat_rounds: []
        }, { transaction: t });
      } catch (err) { console.error('[RealtimeCombat] CombatLog PVP failed:', err); }
    }

    await t.commit();

    // Derelict loot manifests for every destroyed NPC ship — replaces the
    // old placeholder loot blob with a real authored manifest the existing
    // 2D ship-interior boarding view can render directly.
    const derelictManifests = [];
    for (const ship of destroyed) {
      if (!ship.isNPC) continue;
      const manifest = buildDerelictManifest({
        shipId: ship.shipId,
        name: ship.name,
        shipType: ship.shipType,
        sectorId
      });
      if (manifest) derelictManifests.push(manifest);
    }

    emitCombatEvent(combatState, 'resolved', {
      result,
      loot: {
        credits: creditsLooted,
        xp: experienceGained,
        rewardMultiplier,
        derelictManifests
      }
    });
  } catch (err) {
    try { await t.rollback(); } catch (e) { console.error('[RealtimeCombat] Rollback failed:', e); }
    console.error(`[RealtimeCombat] Resolve failed for ${combatId}:`, err);
    throw err;
  }

  activeCombats.delete(combatId);
  if (activeCombats.size === 0) stopCombatTick();
};

// ─── Query Helpers ────────────────────────────────────────────────
const getActiveCombatInSector = (sectorId) => {
  for (const [combatId, state] of activeCombats) {
    if (state.sectorId === sectorId) return combatId;
  }
  return null;
};

const getCombatState = (combatId) => {
  const state = activeCombats.get(combatId);
  if (!state) return null;
  return serializeCombatState(state);
};

const serializeCombatState = (combatState) => {
  const shipList = [];
  for (const ship of combatState.ships.values()) {
    shipList.push({
      shipId: ship.shipId,
      ownerId: ship.ownerId,
      isNPC: ship.isNPC,
      npcType: ship.npcType,
      tier: ship.tier,
      name: ship.name,
      position: { ...ship.position },
      velocity: { ...ship.velocity },
      heading: ship.heading,
      powerAllocation: { ...ship.powerAllocation },
      targetShipId: ship.targetShipId,
      targetSystem: ship.targetSystem,
      stats: {
        maxHull: ship.stats.maxHull, hull: Math.floor(ship.stats.hull),
        maxShields: ship.stats.maxShields, shields: Math.floor(ship.stats.shields),
        speed: ship.stats.speed
      },
      alive: ship.alive,
      escaped: ship.escaped,
      disengaging: ship.disengaging,
      aiControlled: !!ship.aiControlled,
      autopilotUntil: ship.autopilotUntil || null
    });
  }
  return {
    combatId: combatState.combatId,
    sectorId: combatState.sectorId,
    combatType: combatState.combatType,
    startedAt: combatState.startedAt,
    seq: combatState.seq,
    tickCount: combatState.tickCount,
    pendingUntil: combatState.pendingUntil || null,
    pendingExpired: !!combatState.pendingExpired,
    ships: shipList
  };
};

// ─── Derelict Loot Manifest ───────────────────────────────────────
// Builds the structured manifest the 2D ship-interior boarding view consumes
// for a destroyed NPC: a deterministic hull-class layout plus pre-rolled
// crate contents (so the client can show "what's on this wreck" before the
// player actually walks in and triggers the existing /loot endpoint).
const buildDerelictManifest = (npcShip) => {
  try {
    const synthShip = {
      ship_id: `derelict_${npcShip.shipId}`,
      name: npcShip.name || 'Derelict',
      ship_type: npcShip.shipType || 'Fighter'
    };
    const interior = shipInteriorService.buildInterior(synthShip, { mode: 'derelict' });
    const crates = [];
    for (const deck of interior.decks) {
      for (let y = 0; y < deck.height; y++) {
        for (let x = 0; x < deck.width; x++) {
          if (deck.tiles[y][x] === 'L') {
            const roll = shipInteriorService.rollCrateLoot(synthShip, deck.id, x, y);
            crates.push({ deckId: deck.id, x, y, roll });
          }
        }
      }
    }
    return {
      derelict_id: synthShip.ship_id,
      source_npc_id: npcShip.shipId,
      ship_type: synthShip.ship_type,
      hull_class: interior.hull_class,
      sector_id: npcShip.sectorId || null,
      decks: interior.decks.map((d) => ({
        id: d.id, name: d.name, width: d.width, height: d.height,
        tiles: d.tiles.map((row) => row.join(''))
      })),
      tile_meta: interior.tile_meta,
      crates
    };
  } catch (err) {
    console.error('[RealtimeCombat] buildDerelictManifest failed:', err.message);
    return null;
  }
};

module.exports = {
  startCombatTick,
  stopCombatTick,
  processTick,
  initiateCombat,
  initiatePlayerCombat,
  initiateNPCCombat,
  handleCommand,
  resolveCombat,
  recoverActiveCombats,
  notifyPlayerDisconnect,
  notifyPlayerReconnect,
  sendSnapshotToUser,
  getActiveCombatInSector,
  getCombatState
};
