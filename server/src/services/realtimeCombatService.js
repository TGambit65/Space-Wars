const { Ship, NPC, CombatInstance, CombatLog, User, Sector, PvpCooldown, sequelize } = require('../models');
const config = require('../config');
const { getIO, emitToSector, emitToUser } = require('./socketService');
const { applyDamage } = require('./combatService');
const worldPolicyService = require('./worldPolicyService');

const getSectorPolicy = async (sectorId, transaction = null) => {
  const sector = await Sector.findByPk(sectorId, { transaction });
  if (!sector) {
    const error = new Error('Sector not found');
    error.statusCode = 404;
    throw error;
  }

  return {
    sector,
    policy: worldPolicyService.buildDefaultSectorPolicy(sector)
  };
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

const recordPvpRepeatAttackCooldown = async ({
  attackerUserId,
  victimUserId,
  transaction = null
} = {}) => {
  if (!attackerUserId || !victimUserId || attackerUserId === victimUserId) {
    return null;
  }

  const now = new Date();
  const expiresAt = new Date(now.getTime() + config.antiCheat.pvpRepeatTargetCooldownMs);

  return PvpCooldown.upsert({
    attacker_user_id: attackerUserId,
    victim_user_id: victimUserId,
    expires_at: expiresAt,
    created_at: now
  }, { transaction });
};

// ─── Module-level State ─────────────────────────────────────────

const activeCombats = new Map(); // Map<combatId, CombatState>
let tickInterval = null;

const TICK_RATE_MS = 250; // 4 ticks per second
const DT = TICK_RATE_MS / 1000; // 0.25 seconds
const ARENA_SIZE = 400;
const ARENA_HALF = ARENA_SIZE / 2;
const WEAPON_RANGE = 200;
const ESCAPE_RADIUS = 200; // distance from center to escape
const VELOCITY_DAMPING = 0.95;
const WEAPON_COOLDOWN_SECONDS = 1.0;
const SHIELD_RECHARGE_RATE = 0.5; // fraction of maxShields per second at full power

// ─── NPC AI Power Profiles ──────────────────────────────────────

const NPC_AI_PROFILES = {
  PIRATE:        { weapons: 0.6, shields: 0.2, engines: 0.2, behavior: 'aggressive' },
  PIRATE_LORD:   { weapons: 0.6, shields: 0.2, engines: 0.2, behavior: 'aggressive' },
  TRADER:        { weapons: 0.2, shields: 0.2, engines: 0.6, behavior: 'flee' },
  PATROL:        { weapons: 0.33, shields: 0.34, engines: 0.33, behavior: 'balanced' },
  BOUNTY_HUNTER: { weapons: 0.5, shields: 0.3, engines: 0.2, behavior: 'aggressive' }
};

// ─── Combat Tick Management ─────────────────────────────────────

/**
 * Start the global combat tick interval (4 ticks/sec).
 * Safe to call multiple times - only one interval runs at a time.
 */
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
  console.log('[RealtimeCombat] Combat tick started');
};

/**
 * Stop the global combat tick interval.
 */
const stopCombatTick = () => {
  if (tickInterval) {
    clearInterval(tickInterval);
    tickInterval = null;
    console.log('[RealtimeCombat] Combat tick stopped');
  }
};

// ─── Core Tick Processing ───────────────────────────────────────

/**
 * Process a single tick for one combat instance.
 * Moves ships, fires weapons, recharges shields, checks for kills/end.
 * @param {Object} combatState
 */
const processTick = (combatState) => {
  const { combatId, sectorId, ships } = combatState;
  const aliveShips = [];
  const ownerSides = new Map(); // ownerId -> side tracking

  for (const [shipId, ship] of ships) {
    if (!ship.alive) continue;
    aliveShips.push(ship);

    // ── Movement: apply velocity, then dampen ──
    ship.position.x += ship.velocity.vx * DT;
    ship.position.y += ship.velocity.vy * DT;
    ship.velocity.vx *= VELOCITY_DAMPING;
    ship.velocity.vy *= VELOCITY_DAMPING;

    // Clamp to arena bounds
    ship.position.x = Math.max(-ARENA_HALF, Math.min(ARENA_HALF, ship.position.x));
    ship.position.y = Math.max(-ARENA_HALF, Math.min(ARENA_HALF, ship.position.y));

    // ── Weapon fire ──
    if (ship.targetShipId && ship.weaponCooldown <= 0) {
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

          emitToSector(sectorId, 'combat:hit', {
            combatId,
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

    // ── Shield recharge ──
    if (ship.stats.shields < ship.stats.maxShields) {
      const recharge = SHIELD_RECHARGE_RATE * ship.stats.maxShields * ship.powerAllocation.shields * DT;
      ship.stats.shields = Math.min(ship.stats.maxShields, ship.stats.shields + recharge);
    }

    // ── Cooldown countdown ──
    if (ship.weaponCooldown > 0) {
      ship.weaponCooldown = Math.max(0, ship.weaponCooldown - DT);
    }

    // ── Shield recharge timer (general-purpose counter) ──
    ship.shieldRechargeTimer += DT;

    // ── Check destruction ──
    if (ship.stats.hull <= 0) {
      ship.alive = false;
      emitToSector(sectorId, 'combat:destroyed', {
        combatId,
        shipId: ship.shipId,
        isNPC: ship.isNPC
      });
    }

    // ── Check disengage/escape ──
    if (ship.disengaging) {
      const distFromCenter = Math.sqrt(
        ship.position.x * ship.position.x + ship.position.y * ship.position.y
      );
      if (distFromCenter > ESCAPE_RADIUS) {
        ship.alive = false;
        ship.escaped = true;
        emitToSector(sectorId, 'combat:escaped', {
          combatId,
          shipId: ship.shipId,
          isNPC: ship.isNPC
        });
      }
    }
  }

  // ── NPC AI decisions ──
  for (const [shipId, ship] of ships) {
    if (!ship.alive || !ship.isNPC) continue;
    processNPCAI(combatState, ship);
  }

  // ── Check combat end: only 1 side remaining ──
  const remainingSides = new Set();
  for (const [shipId, ship] of ships) {
    if (!ship.alive) continue;
    // Group by ownerId; NPC ships each count as their own side unless they share an ownerId
    remainingSides.add(ship.ownerId || `npc_${ship.shipId}`);
  }

  if (remainingSides.size <= 1) {
    // Combat is over
    resolveCombat(combatId).catch(err => {
      console.error(`[RealtimeCombat] Failed to resolve combat ${combatId}:`, err);
    });
    return;
  }

  // ── Broadcast state to sector ──
  emitToSector(sectorId, 'combat:state', serializeCombatState(combatState));
};

/**
 * Apply damage to a target ship's shields then hull, respecting targetSystem preference.
 * @param {Object} target - ship state object
 * @param {number} damage - damage amount
 * @param {string} targetSystem - 'hull', 'shields', or null (default shields-first)
 */
const applyDamageToTarget = (target, damage, targetSystem) => {
  let remaining = damage;

  if (targetSystem === 'hull') {
    // Attempt to bypass shields - 30% still hits shields, 70% goes to hull
    const shieldPortion = Math.floor(remaining * 0.3);
    const hullPortion = remaining - shieldPortion;

    if (target.stats.shields > 0 && shieldPortion > 0) {
      const shieldDmg = Math.min(target.stats.shields, shieldPortion);
      target.stats.shields -= shieldDmg;
    }
    target.stats.hull = Math.max(0, target.stats.hull - hullPortion);
  } else {
    // Default: shields absorb first, overflow to hull
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

// ─── NPC AI ─────────────────────────────────────────────────────

/**
 * Simple NPC AI: set power allocation, pick targets, and maneuver.
 * @param {Object} combatState
 * @param {Object} npcShip
 */
const processNPCAI = (combatState, npcShip) => {
  const profile = NPC_AI_PROFILES[npcShip.npcType] || NPC_AI_PROFILES.PATROL;

  // Apply power allocation from profile
  npcShip.powerAllocation.weapons = profile.weapons;
  npcShip.powerAllocation.shields = profile.shields;
  npcShip.powerAllocation.engines = profile.engines;

  // Find nearest enemy (any ship not sharing this NPC's ownerId)
  let nearestEnemy = null;
  let nearestDist = Infinity;
  for (const [id, ship] of combatState.ships) {
    if (!ship.alive || ship.shipId === npcShip.shipId) continue;
    if (ship.ownerId === npcShip.ownerId && npcShip.ownerId !== null) continue;
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
    // Traders: move away from nearest enemy toward arena edge
    const dx = npcShip.position.x - nearestEnemy.position.x;
    const dy = npcShip.position.y - nearestEnemy.position.y;
    const angle = Math.atan2(dy, dx);
    npcShip.heading = angle;
    const thrust = npcShip.stats.speed * npcShip.powerAllocation.engines;
    npcShip.velocity.vx += Math.cos(angle) * thrust * DT;
    npcShip.velocity.vy += Math.sin(angle) * thrust * DT;
    npcShip.disengaging = true;
    // Still target enemy in case they catch up
    npcShip.targetShipId = nearestEnemy.shipId;
    npcShip.targetSystem = 'shields';
  } else {
    // Aggressive or balanced: move toward enemy and attack
    const dx = nearestEnemy.position.x - npcShip.position.x;
    const dy = nearestEnemy.position.y - npcShip.position.y;
    const angle = Math.atan2(dy, dx);
    npcShip.heading = angle;

    // Move toward target if out of range
    if (nearestDist > WEAPON_RANGE * 0.7) {
      const thrust = npcShip.stats.speed * npcShip.powerAllocation.engines;
      npcShip.velocity.vx += Math.cos(angle) * thrust * DT;
      npcShip.velocity.vy += Math.sin(angle) * thrust * DT;
    }

    npcShip.targetShipId = nearestEnemy.shipId;
    npcShip.targetSystem = 'hull';
  }
};

// ─── Combat Lifecycle ───────────────────────────────────────────

/**
 * Create a new real-time combat instance.
 * @param {string} sectorId
 * @param {Array<Object>} ships - array of { shipId, ownerId, isNPC, stats, npcType? }
 * @returns {Promise<string>} combatId
 */
const initiateCombat = async (sectorId, ships) => {
  try {
    // Create DB record
    const participantIds = ships.map(s => s.shipId);
    const instance = await CombatInstance.create({
      sector_id: sectorId,
      status: 'active',
      participants: participantIds,
      started_at: new Date()
    });

    const combatId = instance.combat_id;

    // Build in-memory state
    const shipMap = new Map();
    ships.forEach((s, index) => {
      // Spread ships around the arena in a circle
      const angle = (2 * Math.PI * index) / ships.length;
      const spawnRadius = ARENA_HALF * 0.6;
      const x = Math.cos(angle) * spawnRadius;
      const y = Math.sin(angle) * spawnRadius;

      shipMap.set(s.shipId, {
        shipId: s.shipId,
        ownerId: s.ownerId || null,
        isNPC: !!s.isNPC,
        npcType: s.npcType || null,
        position: { x, y },
        velocity: { vx: 0, vy: 0 },
        heading: angle + Math.PI, // Face center
        powerAllocation: { weapons: 0.4, shields: 0.3, engines: 0.3 },
        targetSystem: 'hull',
        targetShipId: null,
        weaponCooldown: 0,
        shieldRechargeTimer: 0,
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
        disengaging: false
      });
    });

    const combatState = {
      combatId,
      sectorId,
      startedAt: new Date(),
      ships: shipMap
    };

    activeCombats.set(combatId, combatState);

    // Start the tick loop if not already running
    startCombatTick();

    // Notify sector
    emitToSector(sectorId, 'combat:started', {
      combatId,
      sectorId,
      participants: participantIds
    });

    return combatId;
  } catch (err) {
    console.error('[RealtimeCombat] Failed to initiate combat:', err);
    throw err;
  }
};

/**
 * Initiate real-time combat between two player ships.
 * Loads ships from DB, validates same sector, creates combat.
 * @param {string} attackerShipId
 * @param {string} defenderShipId
 * @returns {Promise<string>} combatId
 */
const initiatePlayerCombat = async (attackerShipId, defenderShipId) => {
  const attacker = await Ship.findOne({
    where: { ship_id: attackerShipId, is_active: true }
  });
  if (!attacker) {
    throw Object.assign(new Error('Attacker ship not found'), { statusCode: 404 });
  }

  const defender = await Ship.findOne({
    where: { ship_id: defenderShipId, is_active: true }
  });
  if (!defender) {
    throw Object.assign(new Error('Defender ship not found'), { statusCode: 404 });
  }

  if (attacker.current_sector_id !== defender.current_sector_id) {
    throw Object.assign(new Error('Ships are not in the same sector'), { statusCode: 400 });
  }

  if (attacker.in_combat || defender.in_combat) {
    throw Object.assign(new Error('One or both ships are already in combat'), { statusCode: 400 });
  }

  // Zone enforcement: PvP must be allowed in this sector
  await assertCombatAllowedInSector(attacker.current_sector_id, { requirePvp: true });

  // Mark both ships as in combat
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

  const ships = [
    {
      shipId: attacker.ship_id,
      ownerId: attacker.owner_user_id,
      isNPC: false,
      stats: {
        maxHull: attacker.max_hull_points,
        hull: attacker.hull_points,
        maxShields: attacker.max_shield_points,
        shields: attacker.shield_points,
        attackPower: attacker.attack_power,
        defenseRating: attacker.defense_rating,
        speed: attacker.speed,
        maxEnergy: attacker.max_energy,
        energy: attacker.energy
      }
    },
    {
      shipId: defender.ship_id,
      ownerId: defender.owner_user_id,
      isNPC: false,
      stats: {
        maxHull: defender.max_hull_points,
        hull: defender.hull_points,
        maxShields: defender.max_shield_points,
        shields: defender.shield_points,
        attackPower: defender.attack_power,
        defenseRating: defender.defense_rating,
        speed: defender.speed,
        maxEnergy: defender.max_energy,
        energy: defender.energy
      }
    }
  ];

  return initiateCombat(attacker.current_sector_id, ships);
};

/**
 * Initiate real-time combat between a player ship and an NPC.
 * Loads ship and NPC from DB, validates same sector, creates combat.
 * @param {string} shipId
 * @param {string} npcId
 * @returns {Promise<string>} combatId
 */
const initiateNPCCombat = async (shipId, npcId) => {
  const ship = await Ship.findOne({
    where: { ship_id: shipId, is_active: true }
  });
  if (!ship) {
    throw Object.assign(new Error('Ship not found'), { statusCode: 404 });
  }

  const npc = await NPC.findOne({
    where: { npc_id: npcId, is_alive: true }
  });
  if (!npc) {
    throw Object.assign(new Error('NPC not found'), { statusCode: 404 });
  }

  if (ship.current_sector_id !== npc.current_sector_id) {
    throw Object.assign(new Error('Ship and NPC are not in the same sector'), { statusCode: 400 });
  }

  if (ship.in_combat) {
    throw Object.assign(new Error('Ship is already in combat'), { statusCode: 400 });
  }

  // Zone enforcement: block combat in safe harbors
  await assertCombatAllowedInSector(ship.current_sector_id);

  // Mark ship as in combat
  try {
    await ship.update({ in_combat: true });
  } catch (error) {
    await ship.update({ in_combat: false }).catch(() => null);
    throw error;
  }

  const ships = [
    {
      shipId: ship.ship_id,
      ownerId: ship.owner_user_id,
      isNPC: false,
      stats: {
        maxHull: ship.max_hull_points,
        hull: ship.hull_points,
        maxShields: ship.max_shield_points,
        shields: ship.shield_points,
        attackPower: ship.attack_power,
        defenseRating: ship.defense_rating,
        speed: ship.speed,
        maxEnergy: ship.max_energy,
        energy: ship.energy
      }
    },
    {
      shipId: npc.npc_id,
      ownerId: null,
      isNPC: true,
      npcType: npc.npc_type,
      stats: {
        maxHull: npc.max_hull_points,
        hull: npc.hull_points,
        maxShields: npc.max_shield_points,
        shields: npc.shield_points,
        attackPower: npc.attack_power,
        defenseRating: npc.defense_rating,
        speed: npc.speed,
        maxEnergy: 100,
        energy: 100
      }
    }
  ];

  return initiateCombat(ship.current_sector_id, ships);
};

// ─── Player Commands ────────────────────────────────────────────

/**
 * Handle a player command during combat.
 * @param {string} combatId
 * @param {string} shipId
 * @param {Object} command - { type, ...params }
 */
const handleCommand = (combatId, shipId, command) => {
  const combatState = activeCombats.get(combatId);
  if (!combatState) {
    throw Object.assign(new Error('Combat not found'), { statusCode: 404 });
  }

  const ship = combatState.ships.get(shipId);
  if (!ship || !ship.alive) {
    throw Object.assign(new Error('Ship not found in this combat'), { statusCode: 404 });
  }

  switch (command.type) {
    case 'set_heading': {
      // command.heading in radians
      const heading = parseFloat(command.heading);
      if (isNaN(heading)) break;
      ship.heading = heading;
      break;
    }

    case 'set_thrust': {
      // command.thrust is 0-1
      const thrust = Math.max(0, Math.min(1, parseFloat(command.thrust) || 0));
      const thrustForce = ship.stats.speed * ship.powerAllocation.engines * thrust;
      ship.velocity.vx += Math.cos(ship.heading) * thrustForce * DT;
      ship.velocity.vy += Math.sin(ship.heading) * thrustForce * DT;
      break;
    }

    case 'set_power': {
      // command.weapons, command.shields, command.engines - must sum to ~1.0
      const w = parseFloat(command.weapons) || 0;
      const s = parseFloat(command.shields) || 0;
      const e = parseFloat(command.engines) || 0;
      const total = w + s + e;
      if (total < 0.9 || total > 1.1) break; // Must roughly sum to 1
      // Normalize
      ship.powerAllocation.weapons = w / total;
      ship.powerAllocation.shields = s / total;
      ship.powerAllocation.engines = e / total;
      break;
    }

    case 'set_target': {
      // command.targetShipId, command.targetSystem ('hull' or 'shields')
      if (command.targetShipId) {
        const target = combatState.ships.get(command.targetShipId);
        if (target && target.alive) {
          ship.targetShipId = command.targetShipId;
        }
      } else {
        ship.targetShipId = null;
      }
      if (command.targetSystem === 'hull' || command.targetSystem === 'shields') {
        ship.targetSystem = command.targetSystem;
      }
      break;
    }

    case 'disengage': {
      // Start moving toward the edge of the arena
      ship.disengaging = true;
      // Set heading away from center
      const angle = Math.atan2(ship.position.y, ship.position.x);
      ship.heading = angle;
      // Apply thrust outward
      const escapeThrust = ship.stats.speed * ship.powerAllocation.engines;
      ship.velocity.vx += Math.cos(angle) * escapeThrust * DT;
      ship.velocity.vy += Math.sin(angle) * escapeThrust * DT;
      break;
    }

    default:
      // Unknown command, ignore
      break;
  }
};

// ─── Combat Resolution ──────────────────────────────────────────

/**
 * Resolve a finished combat: determine winner, persist results to DB,
 * award loot/credits, update ship/NPC state, and clean up.
 * @param {string} combatId
 */
const resolveCombat = async (combatId) => {
  const combatState = activeCombats.get(combatId);
  if (!combatState) return;

  const { sectorId, ships, startedAt } = combatState;

  // Determine survivors and casualties
  const survivors = [];
  const destroyed = [];
  const escaped = [];

  for (const [id, ship] of ships) {
    if (ship.escaped) {
      escaped.push(ship);
    } else if (ship.alive) {
      survivors.push(ship);
    } else {
      destroyed.push(ship);
    }
  }

  // Winner is the surviving side (if any)
  let winnerOwnerId = null;
  let winnerType = 'draw';
  if (survivors.length > 0) {
    winnerOwnerId = survivors[0].ownerId;
    winnerType = survivors[0].isNPC ? 'npc' : 'player';
  }

  const t = await sequelize.transaction();
  try {
    // Calculate total damage dealt by each ship for the log
    let totalDamage = 0;

    // Persist ship states to DB
    for (const [id, ship] of ships) {
      if (ship.isNPC) {
        // Update NPC in DB
        try {
          if (ship.alive) {
            await NPC.update({
              hull_points: Math.max(0, Math.floor(ship.stats.hull)),
              shield_points: Math.max(0, Math.floor(ship.stats.shields)),
              last_action_at: new Date()
            }, {
              where: { npc_id: ship.shipId },
              transaction: t
            });
          } else if (!ship.escaped) {
            await NPC.update({
              is_alive: false,
              hull_points: 0,
              shield_points: 0,
              respawn_at: new Date(Date.now() + 5 * 60 * 1000)
            }, {
              where: { npc_id: ship.shipId },
              transaction: t
            });
          }
        } catch (err) {
          console.error(`[RealtimeCombat] Failed to update NPC ${ship.shipId}:`, err);
        }
      } else {
        // Update player ship in DB
        try {
          const updateData = {
            hull_points: Math.max(0, Math.floor(ship.stats.hull)),
            shield_points: Math.max(0, Math.floor(ship.stats.shields)),
            energy: Math.max(0, Math.floor(ship.stats.energy)),
            in_combat: false
          };
          if (!ship.alive && !ship.escaped) {
            updateData.is_active = false;
          }
          await Ship.update(updateData, {
            where: { ship_id: ship.shipId },
            transaction: t
          });
        } catch (err) {
          console.error(`[RealtimeCombat] Failed to update ship ${ship.shipId}:`, err);
        }
      }
    }

    // Get zone reward multiplier
    const { policy: resolvedSectorPolicy } = await getSectorPolicy(sectorId, t).catch(() => ({ policy: {} }));
    const rewardMultiplier = getRewardMultiplier(resolvedSectorPolicy);

    // Award loot/credits to winners
    if (winnerType === 'player' && winnerOwnerId) {
      let creditsLooted = 0;
      let experienceGained = 0;

      // Collect loot from destroyed NPCs (with zone multiplier)
      for (const ship of destroyed) {
        if (ship.isNPC) {
          try {
            const npc = await NPC.findByPk(ship.shipId, { transaction: t });
            if (npc) {
              creditsLooted += Math.round((npc.credits_carried || 0) * rewardMultiplier);
              experienceGained += Math.round((npc.experience_value || 0) * rewardMultiplier);
            }
          } catch (err) {
            console.error(`[RealtimeCombat] Failed to fetch NPC loot for ${ship.shipId}:`, err);
          }
        }
      }

      if (creditsLooted > 0 || experienceGained > 0) {
        try {
          const user = await User.findByPk(winnerOwnerId, { transaction: t, lock: t.LOCK.UPDATE });
          if (user && creditsLooted > 0) {
            await user.update({ credits: user.credits + creditsLooted }, { transaction: t });
          }
        } catch (err) {
          console.error(`[RealtimeCombat] Failed to award credits to user ${winnerOwnerId}:`, err);
        }

        // Award XP
        if (experienceGained > 0) {
          try {
            const progressionService = require('./progressionService');
            await progressionService.awardXP(winnerOwnerId, experienceGained, 'combat', t);
          } catch (e) { /* XP failure should not block combat resolution */ }
        }
      }
    }

    // Categorize ships for logging and faction scoring
    const allShipsList = Array.from(ships.values());
    const playerShips = allShipsList.filter(s => !s.isNPC);
    const npcShips = allShipsList.filter(s => s.isNPC);

    // Update faction standings and war scores for PvP
    if (playerShips.length >= 2) {
      try {
        const factionService = require('./factionService');
        const factionWarService = require('./factionWarService');

        for (const winner of survivors.filter(s => !s.isNPC)) {
          for (const loser of destroyed.filter(s => !s.isNPC)) {
            const winnerUser = await User.findByPk(winner.ownerId, { transaction: t });
            const loserUser = await User.findByPk(loser.ownerId, { transaction: t });

            if (winnerUser && loserUser) {
              if (winnerUser.faction === loserUser.faction) {
                // Same faction kill: big negative
                await factionService.modifyStanding(winner.ownerId, winnerUser.faction, -50, 'friendly_fire', t);
              } else {
                // Enemy faction kill: positive for own, negative for enemy
                await factionService.modifyStanding(winner.ownerId, winnerUser.faction, 25, 'pvp_kill', t);
                await factionService.modifyStanding(winner.ownerId, loserUser.faction, -25, 'pvp_kill', t);

                // Add war score if active war
                const activeWar = await factionWarService.checkWarBetweenFactions(winnerUser.faction, loserUser.faction);
                if (activeWar) {
                  await factionWarService.addWarScore(activeWar.war_id, winnerUser.faction, 10, t);
                }
              }
            }
          }
        }
      } catch (e) {
        console.error('[RealtimeCombat] Faction scoring failed:', e);
      }

      // Record PvP repeat-target cooldowns
      for (const winner of survivors.filter(s => !s.isNPC && s.ownerId)) {
        for (const loser of destroyed.filter(s => !s.isNPC && s.ownerId)) {
          try {
            await recordPvpRepeatAttackCooldown({
              attackerUserId: winner.ownerId,
              victimUserId: loser.ownerId,
              transaction: t
            });
          } catch (cooldownError) {
            console.error('[RealtimeCombat] Failed to record PvP repeat-target cooldown:', cooldownError);
          }
        }
      }
    }

    // Build combat result for CombatInstance
    const result = {
      winnerType,
      winnerOwnerId,
      survivors: survivors.map(s => ({ shipId: s.shipId, isNPC: s.isNPC, hull: Math.floor(s.stats.hull) })),
      destroyed: destroyed.map(s => ({ shipId: s.shipId, isNPC: s.isNPC })),
      escaped: escaped.map(s => ({ shipId: s.shipId, isNPC: s.isNPC })),
      duration: Date.now() - startedAt.getTime(),
      rewardMultiplier
    };

    // Update CombatInstance
    try {
      await CombatInstance.update({
        status: 'resolved',
        result,
        ended_at: new Date()
      }, {
        where: { combat_id: combatId },
        transaction: t
      });
    } catch (err) {
      console.error(`[RealtimeCombat] Failed to update CombatInstance ${combatId}:`, err);
    }

    // Create CombatLog entries for each attacker-defender pair
    // Create a log for each player involved
    for (const pShip of playerShips) {
      for (const nShip of npcShips) {
        try {
          await CombatLog.create({
            attacker_ship_id: pShip.shipId,
            defender_npc_id: nShip.shipId,
            sector_id: sectorId,
            combat_type: 'PVE',
            rounds_fought: Math.ceil((Date.now() - startedAt.getTime()) / TICK_RATE_MS),
            winner_type: pShip.alive ? 'attacker' : (nShip.alive ? 'defender' : 'draw'),
            attacker_damage_dealt: Math.floor(nShip.stats.maxHull - nShip.stats.hull),
            defender_damage_dealt: Math.floor(pShip.stats.maxHull - pShip.stats.hull),
            attacker_hull_remaining: Math.max(0, Math.floor(pShip.stats.hull)),
            defender_hull_remaining: Math.max(0, Math.floor(nShip.stats.hull)),
            credits_looted: 0,
            experience_gained: 0,
            combat_rounds: []
          }, { transaction: t });
        } catch (err) {
          console.error('[RealtimeCombat] Failed to create CombatLog:', err);
        }
      }
    }

    // PVP logs
    if (playerShips.length >= 2) {
      try {
        await CombatLog.create({
          attacker_ship_id: playerShips[0].shipId,
          defender_ship_id: playerShips[1].shipId,
          sector_id: sectorId,
          combat_type: 'PVP',
          rounds_fought: Math.ceil((Date.now() - startedAt.getTime()) / TICK_RATE_MS),
          winner_type: playerShips[0].alive ? 'attacker' : (playerShips[1].alive ? 'defender' : 'draw'),
          attacker_damage_dealt: Math.floor(playerShips[1].stats.maxHull - playerShips[1].stats.hull),
          defender_damage_dealt: Math.floor(playerShips[0].stats.maxHull - playerShips[0].stats.hull),
          attacker_hull_remaining: Math.max(0, Math.floor(playerShips[0].stats.hull)),
          defender_hull_remaining: Math.max(0, Math.floor(playerShips[1].stats.hull)),
          credits_looted: 0,
          experience_gained: 0,
          combat_rounds: []
        }, { transaction: t });
      } catch (err) {
        console.error('[RealtimeCombat] Failed to create PVP CombatLog:', err);
      }
    }

    await t.commit();

    // Notify sector
    emitToSector(sectorId, 'combat:resolved', {
      combatId,
      result
    });

    // Notify individual players
    for (const pShip of playerShips) {
      if (pShip.ownerId) {
        emitToUser(pShip.ownerId, 'combat:ended', {
          combatId,
          shipId: pShip.shipId,
          survived: pShip.alive,
          escaped: pShip.escaped,
          result
        });
      }
    }
  } catch (err) {
    try {
      await t.rollback();
    } catch (rollbackErr) {
      console.error('[RealtimeCombat] Rollback failed:', rollbackErr);
    }
    console.error(`[RealtimeCombat] Failed to resolve combat ${combatId}:`, err);
    throw err;
  }

  // Clean up in-memory state
  activeCombats.delete(combatId);

  // Stop tick if no combats remain
  if (activeCombats.size === 0) {
    stopCombatTick();
  }
};

// ─── Query Helpers ──────────────────────────────────────────────

/**
 * Get the active combat ID in a given sector, if any.
 * @param {string} sectorId
 * @returns {string|null} combatId or null
 */
const getActiveCombatInSector = (sectorId) => {
  for (const [combatId, state] of activeCombats) {
    if (state.sectorId === sectorId) {
      return combatId;
    }
  }
  return null;
};

/**
 * Get a serializable snapshot of combat state for clients.
 * @param {string} combatId
 * @returns {Object|null}
 */
const getCombatState = (combatId) => {
  const state = activeCombats.get(combatId);
  if (!state) return null;
  return serializeCombatState(state);
};

/**
 * Serialize combat state into a plain object for Socket.io emission.
 * @param {Object} combatState
 * @returns {Object}
 */
const serializeCombatState = (combatState) => {
  const shipList = [];
  for (const [id, ship] of combatState.ships) {
    shipList.push({
      shipId: ship.shipId,
      ownerId: ship.ownerId,
      isNPC: ship.isNPC,
      position: { ...ship.position },
      velocity: { ...ship.velocity },
      heading: ship.heading,
      powerAllocation: { ...ship.powerAllocation },
      targetShipId: ship.targetShipId,
      targetSystem: ship.targetSystem,
      stats: {
        maxHull: ship.stats.maxHull,
        hull: Math.floor(ship.stats.hull),
        maxShields: ship.stats.maxShields,
        shields: Math.floor(ship.stats.shields),
        speed: ship.stats.speed
      },
      alive: ship.alive,
      escaped: ship.escaped,
      disengaging: ship.disengaging
    });
  }

  return {
    combatId: combatState.combatId,
    sectorId: combatState.sectorId,
    startedAt: combatState.startedAt,
    ships: shipList
  };
};

// ─── Exports ────────────────────────────────────────────────────

module.exports = {
  startCombatTick,
  stopCombatTick,
  processTick,
  initiateCombat,
  initiatePlayerCombat,
  initiateNPCCombat,
  handleCommand,
  resolveCombat,
  getActiveCombatInSector,
  getCombatState
};
