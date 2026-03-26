const gameSettingsService = require('./gameSettingsService');
const npcService = require('./npcService');
const behaviorTreeService = require('./behaviorTreeService');
const npcActionExecutor = require('./npcActionExecutor');
const combatService = require('./combatService');
const dialogueCacheService = require('./dialogueCacheService');
const economyTickService = require('./economyTickService');
const automationService = require('./automationService');
const missionService = require('./missionService');
const npcPresenceService = require('./npcPresenceService');
const npcMemoryService = require('./npcMemoryService');
const worldPolicyService = require('./worldPolicyService');
const { NPC, Ship, Port, User, Sector, NpcConversationSession } = require('../models');
const { Op, col } = require('sequelize');
const { getAdjacentSectorIds, getPortSectorIds, buildAdjacencyMap } = require('./sectorGraphService');
const groupBy = require('../utils/groupBy');
const config = require('../config');

// ─── Module State ────────────────────────────────────────────────

let tacticalInterval = null;
let combatInterval = null;
let maintenanceInterval = null;
let economyInterval = null;
let automationInterval = null;
let presenceInterval = null;
let processingTactical = false;
let processingCombat = false;
let socketService = null;

const stats = {
  tacticalTicks: 0,
  combatTicks: 0,
  maintenanceTicks: 0,
  presenceTicks: 0,
  avgTacticalMs: 0,
  lastTacticalAt: null,
  startedAt: null,
  lastNPCCount: 0,
  lastPresenceBeats: 0
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

  const tickRate = Math.max(5, Number(gameSettingsService.getSetting('npc.tick_rate_seconds', 30)) || 30);
  const combatTickRate = Math.max(5, Number(gameSettingsService.getSetting('npc.combat_tick_rate_seconds', 15)) || 15);

  tacticalInterval = setInterval(processTacticalTick, tickRate * 1000);
  combatInterval = setInterval(processCombatTick, combatTickRate * 1000);
  maintenanceInterval = setInterval(processMaintenanceTick, 5 * 60 * 1000);
  economyInterval = setInterval(processEconomyTick, config.economy.economyTickIntervalMs);
  automationInterval = setInterval(processAutomationTick, config.automation.executionIntervalMs);
  presenceInterval = setInterval(processPresenceTick, 60 * 1000); // Every 60 seconds

  stats.startedAt = Date.now();
  console.log(`[TickService] Game tick system started (tactical: ${tickRate}s, combat: ${combatTickRate}s, maintenance: 300s, economy: ${config.economy.economyTickIntervalMs / 1000}s, automation: ${config.automation.executionIntervalMs / 1000}s, presence: 60s)`);
};

/**
 * Stop all tick intervals. Call during graceful shutdown.
 */
const stopTicks = () => {
  if (tacticalInterval) clearInterval(tacticalInterval);
  if (combatInterval) clearInterval(combatInterval);
  if (maintenanceInterval) clearInterval(maintenanceInterval);
  if (economyInterval) clearInterval(economyInterval);
  if (automationInterval) clearInterval(automationInterval);
  if (presenceInterval) clearInterval(presenceInterval);

  tacticalInterval = null;
  combatInterval = null;
  maintenanceInterval = null;
  economyInterval = null;
  automationInterval = null;
  presenceInterval = null;
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
  presenceTicks: stats.presenceTicks,
  avgTacticalMs: Math.round(stats.avgTacticalMs),
  lastTacticalAt: stats.lastTacticalAt,
  activeNPCCount: stats.lastNPCCount,
  lastPresenceBeats: stats.lastPresenceBeats
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

    // ── Batch pre-fetch all context data (replaces per-NPC queries) ──
    const tickCache = await buildBatchTickCache(npcs, difficulty);

    // Batch-fetch NPCs currently in active dialogue sessions (avoid per-NPC query)
    const npcIds = npcs.map(n => n.npc_id);
    const activeSessions = await NpcConversationSession.findAll({
      where: { npc_id: { [Op.in]: npcIds }, is_active: true },
      attributes: ['npc_id']
    });
    const npcsInDialogue = new Set(activeSessions.map(s => s.npc_id));

    // Process each NPC sequentially (actions may mutate DB)
    for (const npc of npcs) {
      try {
        // Skip NPCs in active dialogue sessions
        if (npcsInDialogue.has(npc.npc_id)) continue;

        // Build context from pre-fetched cache (no DB queries)
        const context = buildTickContextFromCache(npc, tickCache);

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
      where: { behavior_state: 'engaging', is_alive: true },
      include: [{
        model: Sector,
        as: 'currentSector',
        attributes: ['sector_id', 'name', 'zone_class', 'security_class', 'access_mode', 'rule_flags']
      }]
    });

    if (engagingNPCs.length === 0) return;

    // Batch-fetch all relevant ships to avoid N+1 queries in the NPC loop
    const combatSectorIds = [...new Set(engagingNPCs.map(n => n.current_sector_id).filter(Boolean))];
    const combatTargetShipIds = engagingNPCs.map(n => n.target_ship_id).filter(Boolean);

    const [batchTargetShips, batchSectorShips] = await Promise.all([
      combatTargetShipIds.length > 0
        ? Ship.findAll({ where: { ship_id: { [Op.in]: combatTargetShipIds }, is_active: true } })
        : [],
      combatSectorIds.length > 0
        ? Ship.findAll({ where: { current_sector_id: { [Op.in]: combatSectorIds }, is_active: true } })
        : []
    ]);

    const targetShipMap = new Map(batchTargetShips.map(s => [s.ship_id, s]));
    const sectorShipMap = new Map();
    for (const ship of batchSectorShips) {
      if (!sectorShipMap.has(ship.current_sector_id)) sectorShipMap.set(ship.current_sector_id, []);
      sectorShipMap.get(ship.current_sector_id).push(ship);
    }

    for (const npc of engagingNPCs) {
      try {
        // Zone enforcement: disengage hostile NPCs in safe zones
        const sectorPolicy = worldPolicyService.buildDefaultSectorPolicy(npc.currentSector || {});
        const hostileNpcsAllowed = sectorPolicy.rule_flags?.allow_hostile_npcs !== false
          && !sectorPolicy.rule_flags?.safe_harbor;

        if (!hostileNpcsAllowed) {
          await npc.update({
            behavior_state: 'idle',
            target_ship_id: null,
            target_user_id: null,
            last_action_at: new Date()
          });
          continue;
        }

        // Use pre-fetched ship data instead of per-NPC queries
        let playerShip = null;
        if (npc.target_ship_id) {
          const candidate = targetShipMap.get(npc.target_ship_id);
          if (candidate && candidate.current_sector_id === npc.current_sector_id) {
            playerShip = candidate;
          }
        }
        if (!playerShip) {
          const candidates = sectorShipMap.get(npc.current_sector_id) || [];
          playerShip = candidates[0] || null;
        }

        if (!playerShip) {
          // No player in sector — disengage and clear target
          await npc.update({ behavior_state: 'idle', target_ship_id: null, target_user_id: null, last_action_at: new Date() });

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
          const rewardMultiplier = Number(sectorPolicy.rule_flags?.reward_multiplier || 1);
          const creditsLooted = Math.round((npc.credits_carried || 0) * rewardMultiplier);
          const experienceGained = Math.round((npc.experience_value || 0) * rewardMultiplier);

          await npc.update({
            is_alive: false,
            hull_points: 0,
            shield_points: 0,
            behavior_state: 'idle',
            target_ship_id: null,
            target_user_id: null,
            respawn_at: new Date(Date.now() + 5 * 60 * 1000)
          });

          // Reward player
          if (creditsLooted > 0 || experienceGained > 0) {
            const user = await User.findByPk(playerShip.owner_user_id);
            if (user) {
              if (creditsLooted > 0) {
                await user.update({ credits: (user.credits || 0) + creditsLooted });
              }
              if (experienceGained > 0) {
                try {
                  const progressionService = require('./progressionService');
                  await progressionService.awardXP(playerShip.owner_user_id, experienceGained, 'combat');
                } catch (e) {
                  // XP failure should not block combat rewards
                }
              }
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

          // NPC disengages after winning, clear target
          await npc.update({ behavior_state: 'idle', target_ship_id: null, target_user_id: null });

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

    // Phase 5: Expire old missions and refresh port missions
    try {
      const expired = await missionService.expireOldMissions();
      const refreshed = await missionService.refreshPortMissions();
      if (expired > 0 || refreshed > 0) {
        console.log(`[Maintenance] Missions expired: ${expired}, refreshed: ${refreshed}`);
      }
    } catch (err) {
      console.error('[Maintenance] Mission tick error:', err.message);
    }

    // Decay stale NPC memory scores
    try {
      const decayed = await npcMemoryService.decayAllMemories();
      if (decayed > 0) {
        console.log(`[Maintenance] Memory scores decayed: ${decayed}`);
      }
    } catch (err) {
      console.error('[Maintenance] Memory decay error:', err.message);
    }

    stats.maintenanceTicks++;

    if (respawned > 0 || healableNPCs.length > 0 || cacheCleared > 0) {
      console.log(`[Maintenance] Shields healed: ${healableNPCs.length}, Cache cleared: ${cacheCleared}`);
    }
  } catch (err) {
    console.error('[Maintenance] Tick error:', err.message);
  }
};

// ─── Economy Tick ───────────────────────────────────────────────

/**
 * Process economy tick: production/consumption and price snapshots.
 */
const processEconomyTick = async () => {
  try {
    await economyTickService.processEconomyTick();
  } catch (err) {
    console.error('[EconomyTick] Error:', err.message);
  }
};

// ─── Automation Tick ────────────────────────────────────────────

/**
 * Process automation tick: execute active automated tasks.
 */
const processAutomationTick = async () => {
  try {
    await automationService.processAutomationTick();
  } catch (err) {
    console.error('[AutomationTick] Error:', err.message);
  }
};

// ─── Presence Tick ──────────────────────────────────────────────

/**
 * Process one presence tick: generate proactive NPC beats for nearby players.
 */
const processPresenceTick = async () => {
  try {
    const beatsEmitted = await npcPresenceService.processPresenceTick(socketService);
    stats.presenceTicks++;
    stats.lastPresenceBeats = beatsEmitted;
  } catch (err) {
    console.error('[PresenceTick] Error:', err.message);
  }
};

// ─── Batch Context Builder ───────────────────────────────────────

/**
 * Pre-fetch all data needed for NPC tick context in bulk (~5 queries total).
 * Replaces the per-NPC buildTickContext() which ran ~7 queries per NPC.
 *
 * @param {Object[]} activeNPCs - Array of NPC model instances
 * @param {number} difficulty - Game difficulty (1-5)
 * @returns {Promise<Object>} Shared cache for buildTickContextFromCache()
 */
const buildBatchTickCache = async (activeNPCs, difficulty) => {
  // 1. Collect all NPC sector IDs
  const npcSectorIds = new Set(activeNPCs.map(n => n.current_sector_id));

  // 2. Get adjacency for all NPC sectors (1 query via buildAdjacencyMap)
  const adjacencyMap = await buildAdjacencyMap(npcSectorIds);
  const allRelevantSectors = new Set(npcSectorIds);
  for (const [, neighbors] of adjacencyMap) {
    neighbors.forEach(n => allRelevantSectors.add(n));
  }

  // 3. Batch-fetch all player ships in relevant sectors (1 query)
  const allPlayerShips = await Ship.findAll({
    where: { current_sector_id: { [Op.in]: [...allRelevantSectors] }, is_active: true },
    attributes: ['ship_id', 'name', 'owner_user_id', 'hull_points', 'max_hull_points',
      'shield_points', 'max_shield_points', 'attack_power', 'defense_rating', 'speed',
      'current_sector_id']
  });
  const shipsBySector = groupBy(allPlayerShips, 'current_sector_id');

  // 4. Batch-fetch all ports in relevant sectors (1 query)
  const allPorts = await Port.findAll({
    where: { sector_id: { [Op.in]: [...allRelevantSectors] }, is_active: true },
    attributes: ['port_id', 'sector_id']
  });
  const portsBySector = new Set(allPorts.map(p => p.sector_id));

  // 5. Group NPCs by sector from the already-fetched array (no query)
  const npcsBySector = groupBy(activeNPCs, 'current_sector_id');

  // 6. Build sector policies from NPC sector data (no extra query — uses included Sector)
  const sectorPoliciesById = new Map();
  for (const npc of activeNPCs) {
    if (!sectorPoliciesById.has(npc.current_sector_id)) {
      const sectorLike = npc.currentSector || { sector_id: npc.current_sector_id };
      sectorPoliciesById.set(npc.current_sector_id, worldPolicyService.buildDefaultSectorPolicy(sectorLike));
    }
  }

  return { adjacencyMap, shipsBySector, portsBySector, npcsBySector, sectorPoliciesById, difficulty };
};

/**
 * Build context for a single NPC from the pre-fetched batch cache.
 * Zero DB queries — pure in-memory lookups.
 *
 * @param {Object} npc - NPC model instance
 * @param {Object} cache - Cache from buildBatchTickCache()
 * @returns {Object} Context for behavior tree (same shape as old buildTickContext)
 */
const buildTickContextFromCache = (npc, cache) => {
  const sectorId = npc.current_sector_id;
  const adjacentIds = cache.adjacencyMap.get(sectorId) || [];

  const playersInSector = cache.shipsBySector.get(sectorId) || [];
  const npcsInSector = (cache.npcsBySector.get(sectorId) || [])
    .filter(n => n.npc_id !== npc.npc_id);
  const sectorPolicy = cache.sectorPoliciesById.get(sectorId) || null;
  const hostileNpcsAllowed = sectorPolicy
    ? sectorPolicy.rule_flags?.allow_hostile_npcs !== false && !sectorPolicy.rule_flags?.safe_harbor
    : true;

  const adjacentSectors = adjacentIds.map(id => ({
    sector_id: id,
    name: id,
    hasPort: cache.portsBySector.has(id),
    hostileCount: (cache.npcsBySector.get(id) || [])
      .filter(n => n.aggression_level >= 0.7).length,
    playerCount: (cache.shipsBySector.get(id) || []).length
  }));

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
    sectorHasPort: cache.portsBySector.has(sectorId),
    difficulty: cache.difficulty,
    sectorPolicy,
    hostileNpcsAllowed,
    currentTarget
  };
};

module.exports = {
  startTicks,
  stopTicks,
  isRunning,
  getStatus
};
