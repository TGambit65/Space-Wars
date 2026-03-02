const gameSettingsService = require('./gameSettingsService');
const npcService = require('./npcService');
const behaviorTreeService = require('./behaviorTreeService');
const npcActionExecutor = require('./npcActionExecutor');
const combatService = require('./combatService');
const dialogueCacheService = require('./dialogueCacheService');
const { NPC, Ship, Port, User } = require('../models');
const { Op, col } = require('sequelize');
const { getAdjacentSectorIds, getPortSectorIds } = require('./sectorGraphService');

// ─── Module State ────────────────────────────────────────────────

let tacticalInterval = null;
let combatInterval = null;
let maintenanceInterval = null;
let processingTactical = false;
let processingCombat = false;
let socketService = null;

const stats = {
  tacticalTicks: 0,
  combatTicks: 0,
  maintenanceTicks: 0,
  avgTacticalMs: 0,
  lastTacticalAt: null,
  startedAt: null,
  lastNPCCount: 0
};

// ─── Tick Lifecycle ──────────────────────────────────────────────

/**
 * Start the game tick system. Call after server is listening.
 * @param {Object} [io] - Socket.io service for real-time events (optional)
 */
const startTicks = (io = null) => {
  if (tacticalInterval) {
    console.warn('[TickService] Ticks already running');
    return;
  }

  socketService = io;

  const tickRate = Number(gameSettingsService.getSetting('npc.tick_rate_seconds', 30));
  const combatTickRate = Number(gameSettingsService.getSetting('npc.combat_tick_rate_seconds', 15));

  tacticalInterval = setInterval(processTacticalTick, tickRate * 1000);
  combatInterval = setInterval(processCombatTick, combatTickRate * 1000);
  maintenanceInterval = setInterval(processMaintenanceTick, 5 * 60 * 1000);

  stats.startedAt = Date.now();
  console.log(`[TickService] Game tick system started (tactical: ${tickRate}s, combat: ${combatTickRate}s, maintenance: 300s)`);
};

/**
 * Stop all tick intervals. Call during graceful shutdown.
 */
const stopTicks = () => {
  if (tacticalInterval) clearInterval(tacticalInterval);
  if (combatInterval) clearInterval(combatInterval);
  if (maintenanceInterval) clearInterval(maintenanceInterval);

  tacticalInterval = null;
  combatInterval = null;
  maintenanceInterval = null;
  socketService = null;

  console.log('[TickService] Game tick system stopped');
};

/**
 * Check if ticks are running.
 * @returns {boolean}
 */
const isRunning = () => tacticalInterval !== null;

/**
 * Get tick system status for admin panel.
 * @returns {Object}
 */
const getStatus = () => ({
  running: isRunning(),
  startedAt: stats.startedAt,
  tacticalTicks: stats.tacticalTicks,
  combatTicks: stats.combatTicks,
  maintenanceTicks: stats.maintenanceTicks,
  avgTacticalMs: Math.round(stats.avgTacticalMs),
  lastTacticalAt: stats.lastTacticalAt,
  activeNPCCount: stats.lastNPCCount
});

// ─── Tactical Tick ───────────────────────────────────────────────

/**
 * Process one tactical tick: evaluate NPC decisions and execute actions.
 * Sequential NPC processing to avoid SQLite locking issues.
 */
const processTacticalTick = async () => {
  if (processingTactical) {
    console.warn('[TickService] Tactical tick overlap — skipping');
    return;
  }

  processingTactical = true;
  const tickStart = Date.now();

  try {
    const aiEnabled = gameSettingsService.getSetting('npc.ai_enabled', true);
    if (!aiEnabled) {
      stats.lastNPCCount = 0;
      return;
    }

    // Get NPCs near active players
    const npcs = await npcService.getActiveNPCsNearPlayers();
    stats.lastNPCCount = npcs.length;

    if (npcs.length === 0) return;

    const difficulty = Number(gameSettingsService.getSetting('npc.difficulty', 3));

    // Process each NPC sequentially
    for (const npc of npcs) {
      try {
        // Skip NPCs in active dialogue
        if (npc.dialogue_state && npc.dialogue_state.active) continue;

        // Build context for this NPC
        const context = await buildTickContext(npc, difficulty);

        // Get scripted decision from behavior tree
        let decision = await behaviorTreeService.evaluateNPCDecision(npc, context);

        // If behavior tree flags for AI and NPC qualifies, try AI override
        if (decision.needsAI && (npc.intelligence_tier || 1) >= 2) {
          decision = await npcActionExecutor.executeAIDecision(npc, context, decision);
        }

        // Execute the decided action
        await npcActionExecutor.executeAction(npc, decision, context, socketService);

      } catch (err) {
        console.error(`[TickService] Error processing NPC ${npc.name}:`, err.message);
      }
    }
  } catch (err) {
    console.error('[TickService] Tactical tick error:', err.message);
  } finally {
    processingTactical = false;
    const duration = Date.now() - tickStart;

    stats.tacticalTicks++;
    stats.lastTacticalAt = Date.now();
    // Running average: new_avg = old_avg + (value - old_avg) / count
    stats.avgTacticalMs += (duration - stats.avgTacticalMs) / stats.tacticalTicks;
  }
};

// ─── Combat Tick ─────────────────────────────────────────────────

/**
 * Process one combat tick: advance ongoing NPC-vs-player combats.
 * Finds NPCs in 'engaging' state and executes combat rounds.
 */
const processCombatTick = async () => {
  if (processingCombat) return;
  processingCombat = true;

  try {
    // Find all NPCs currently engaging in combat
    const engagingNPCs = await NPC.findAll({
      where: { behavior_state: 'engaging', is_alive: true }
    });

    if (engagingNPCs.length === 0) return;

    for (const npc of engagingNPCs) {
      try {
        // Find a player ship in the same sector to fight
        const playerShip = await Ship.findOne({
          where: {
            current_sector_id: npc.current_sector_id,
            is_active: true
          }
        });

        if (!playerShip) {
          // No player in sector — disengage
          await npc.update({ behavior_state: 'idle', last_action_at: new Date() });

          if (socketService) {
            socketService.emitToSector(npc.current_sector_id, 'npc:state_change', {
              npc_id: npc.npc_id,
              old_state: 'engaging',
              new_state: 'idle'
            });
          }
          continue;
        }

        // Build combat states
        const npcState = {
          hull_points: npc.hull_points,
          shield_points: npc.shield_points,
          attack_power: npc.attack_power,
          defense_rating: npc.defense_rating,
          speed: npc.speed,
          scanner_range: npc.scanner_range || 1,
          energy: 100,
          energy_per_round: 0
        };
        const playerState = {
          hull_points: playerShip.hull_points,
          shield_points: playerShip.shield_points,
          attack_power: playerShip.attack_power,
          defense_rating: playerShip.defense_rating,
          speed: playerShip.speed,
          scanner_range: playerShip.scanner_range || 1,
          energy: playerShip.energy || playerShip.max_energy || 100,
          energy_per_round: Math.floor((playerShip.max_energy || 100) * 0.02)
        };

        // Execute one combat round (NPC attacks, player counters)
        const round = combatService.executeCombatRound(npcState, playerState, 1);

        // Apply damage to NPC
        await npc.update({
          hull_points: npcState.hull_points,
          shield_points: npcState.shield_points,
          last_action_at: new Date()
        });

        // Apply damage to player ship
        await playerShip.update({
          hull_points: playerState.hull_points,
          shield_points: playerState.shield_points
        });

        // Emit combat round event to player
        if (socketService && playerShip.owner_user_id) {
          socketService.emitToUser(playerShip.owner_user_id, 'combat:round', {
            npc_id: npc.npc_id,
            npc_name: npc.name,
            round: round
          });
        }

        // Check if NPC destroyed
        if (round.attacker_destroyed || npcState.hull_points <= 0) {
          const creditsLooted = npc.credits_carried || 0;
          const experienceGained = npc.experience_value || 0;

          await npc.update({
            is_alive: false,
            hull_points: 0,
            shield_points: 0,
            behavior_state: 'idle',
            respawn_at: new Date(Date.now() + 5 * 60 * 1000)
          });

          // Reward player
          if (creditsLooted > 0 || experienceGained > 0) {
            const user = await User.findByPk(playerShip.owner_user_id);
            if (user) {
              await user.update({
                credits: (user.credits || 0) + creditsLooted,
                experience: (user.experience || 0) + experienceGained
              });
            }
          }

          if (socketService) {
            socketService.emitToSector(npc.current_sector_id, 'npc:destroyed', {
              npc_id: npc.npc_id,
              name: npc.name,
              destroyed_by: playerShip.name || 'player'
            });
            if (playerShip.owner_user_id) {
              socketService.emitToUser(playerShip.owner_user_id, 'combat:ended', {
                winner: 'player',
                npc_id: npc.npc_id,
                npc_name: npc.name,
                rewards: { credits: creditsLooted, experience: experienceGained }
              });
            }
          }
          continue;
        }

        // Check if player destroyed
        if (round.defender_destroyed || playerState.hull_points <= 0) {
          await playerShip.update({
            hull_points: 0,
            shield_points: 0,
            is_active: false
          });

          // NPC disengages after winning
          await npc.update({ behavior_state: 'idle' });

          if (socketService && playerShip.owner_user_id) {
            socketService.emitToUser(playerShip.owner_user_id, 'combat:ended', {
              winner: 'npc',
              npc_id: npc.npc_id,
              npc_name: npc.name,
              rewards: null
            });
          }
        }

      } catch (err) {
        console.error(`[TickService] Combat tick error for NPC ${npc.name}:`, err.message);
      }
    }
  } catch (err) {
    console.error('[TickService] Combat tick error:', err.message);
  } finally {
    processingCombat = false;
    stats.combatTicks++;
  }
};

// ─── Maintenance Tick ────────────────────────────────────────────

/**
 * Periodic maintenance: respawn dead NPCs, heal shields, clear expired caches.
 */
const processMaintenanceTick = async () => {
  try {
    // Respawn dead NPCs whose respawn timer has elapsed
    const respawned = await npcService.respawnNPCs();
    if (respawned > 0) {
      console.log(`[Maintenance] Respawned ${respawned} NPCs`);
    }

    // Heal shields for non-combat NPCs (+5% per maintenance tick)
    const healableNPCs = await NPC.findAll({
      where: {
        is_alive: true,
        behavior_state: { [Op.notIn]: ['engaging', 'fleeing'] },
        shield_points: { [Op.lt]: col('max_shield_points') }
      },
      attributes: ['npc_id', 'shield_points', 'max_shield_points']
    });

    for (const npc of healableNPCs) {
      const healAmount = Math.ceil(npc.max_shield_points * 0.05);
      const newShields = Math.min(npc.shield_points + healAmount, npc.max_shield_points);
      if (newShields > npc.shield_points) {
        await npc.update({ shield_points: newShields });
      }
    }

    // Clear expired dialogue cache entries
    const cacheCleared = dialogueCacheService.clearExpired();

    stats.maintenanceTicks++;

    if (respawned > 0 || healableNPCs.length > 0 || cacheCleared > 0) {
      console.log(`[Maintenance] Shields healed: ${healableNPCs.length}, Cache cleared: ${cacheCleared}`);
    }
  } catch (err) {
    console.error('[Maintenance] Tick error:', err.message);
  }
};

// ─── Context Builder ─────────────────────────────────────────────

/**
 * Build the context object needed by behaviorTreeService.evaluateNPCDecision().
 * @param {Object} npc - NPC model instance
 * @param {number} difficulty - Game difficulty (1-5)
 * @returns {Promise<Object>} Context for behavior tree
 */
const buildTickContext = async (npc, difficulty) => {
  const sectorId = npc.current_sector_id;

  // Get player ships in the NPC's sector
  const playersInSector = await Ship.findAll({
    where: { current_sector_id: sectorId, is_active: true },
    attributes: ['ship_id', 'name', 'owner_user_id', 'hull_points', 'max_hull_points',
      'shield_points', 'max_shield_points', 'attack_power', 'defense_rating', 'speed']
  });

  // Get other NPCs in sector
  const npcsInSector = await NPC.findAll({
    where: {
      current_sector_id: sectorId,
      is_alive: true,
      npc_id: { [Op.ne]: npc.npc_id }
    },
    attributes: ['npc_id', 'name', 'npc_type', 'hull_points', 'max_hull_points',
      'shield_points', 'attack_power', 'behavior_state']
  });

  // Check if current sector has a port
  const portInSector = await Port.findOne({
    where: { sector_id: sectorId, is_active: true },
    attributes: ['port_id']
  });

  // Get adjacent sector info
  const adjacentIds = await getAdjacentSectorIds(sectorId);
  let adjacentSectors = [];

  if (adjacentIds.length > 0) {
    // Batch-fetch port sectors
    const portSectorSet = await getPortSectorIds(adjacentIds);

    // Count hostiles per adjacent sector
    const hostileNpcs = await NPC.findAll({
      where: {
        current_sector_id: { [Op.in]: adjacentIds },
        is_alive: true,
        aggression_level: { [Op.gte]: 0.7 }
      },
      attributes: ['current_sector_id']
    });
    const hostileCounts = {};
    hostileNpcs.forEach(n => {
      hostileCounts[n.current_sector_id] = (hostileCounts[n.current_sector_id] || 0) + 1;
    });

    // Count players per adjacent sector
    const adjacentPlayers = await Ship.findAll({
      where: {
        current_sector_id: { [Op.in]: adjacentIds },
        is_active: true
      },
      attributes: ['current_sector_id']
    });
    const playerCounts = {};
    adjacentPlayers.forEach(s => {
      playerCounts[s.current_sector_id] = (playerCounts[s.current_sector_id] || 0) + 1;
    });

    adjacentSectors = adjacentIds.map(id => ({
      sector_id: id,
      name: id, // Name not critical for decision-making
      hasPort: portSectorSet.has(id),
      hostileCount: hostileCounts[id] || 0,
      playerCount: playerCounts[id] || 0
    }));
  }

  // For engaging NPCs, identify the weakest player ship as their combat target
  let currentTarget = null;
  if (npc.behavior_state === 'engaging' && playersInSector.length > 0) {
    currentTarget = playersInSector.reduce((weakest, ship) => {
      const hullPct = ship.max_hull_points > 0 ? ship.hull_points / ship.max_hull_points : 1;
      const weakestPct = weakest.max_hull_points > 0 ? weakest.hull_points / weakest.max_hull_points : 1;
      return hullPct < weakestPct ? ship : weakest;
    });
  }

  return {
    playersInSector,
    npcsInSector,
    adjacentSectors,
    sectorHasPort: !!portInSector,
    difficulty,
    currentTarget
  };
};

module.exports = {
  startTicks,
  stopTicks,
  isRunning,
  getStatus
};
