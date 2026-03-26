const { NPC, Sector, SectorConnection, Ship, sequelize } = require('../models');
const config = require('../config');
const { Op } = require('sequelize');
const npcPersonalityService = require('./npcPersonalityService');
const worldPolicyService = require('./worldPolicyService');
const { getAdjacentSectorIds, buildAdjacencyMap } = require('./sectorGraphService');

const HOSTILE_NPC_TYPES = new Set(
  Object.entries(config.npcTypes || {})
    .filter(([, npcTypeConfig]) => npcTypeConfig?.hostility === 'hostile')
    .map(([npcType]) => npcType)
);

const getZoneDifficultyForSector = (sectorLikeOrZoneClass = null) => {
  const zoneClass = typeof sectorLikeOrZoneClass === 'string'
    ? sectorLikeOrZoneClass
    : sectorLikeOrZoneClass?.zone_class;

  return config.zoneDifficulty?.[zoneClass]
    || config.zoneDifficulty?.mid_ring
    || { npcStatMultiplier: 1, npcLevelRange: [1, 5], spawnDensity: 1 };
};

const getSpawnDensityForSector = (sectorLikeOrZoneClass = null) => {
  return Number(getZoneDifficultyForSector(sectorLikeOrZoneClass)?.spawnDensity || 1);
};

const getSectorPolicy = (sectorLike = null) => worldPolicyService.buildDefaultSectorPolicy(sectorLike || {});

// NPC name prefixes for generation
const namePrefixes = {
  PIRATE: ['Dread', 'Black', 'Shadow', 'Rogue', 'Crimson', 'Blood'],
  PIRATE_LORD: ['Admiral', 'Captain', 'Lord', 'Baron'],
  TRADER: ['Merchant', 'Trader', 'Captain', 'Master'],
  PATROL: ['Officer', 'Lieutenant', 'Commander', 'Sergeant'],
  BOUNTY_HUNTER: ['Hunter', 'Tracker', 'Seeker', 'Stalker']
};

const namePostfixes = ['Vex', 'Kira', 'Rex', 'Nova', 'Zane', 'Luna', 'Drake', 'Hawk', 'Storm', 'Blaze'];

const FACTIONS = ['terran_alliance', 'zythian_swarm', 'automaton_collective', 'synthesis_accord', 'sylvari_dominion'];

/**
 * Assign a faction to a newly spawned NPC based on type and sector zone.
 * - Patrols and Traders in core/inner sectors get a faction.
 * - Pirates and bounty hunters in frontier/outer sectors are independent (null).
 * - Mid-ring is mixed.
 */
const assignFaction = (npcType, sector) => {
  const zone = sector.zone_class || 'mid_ring';

  // Pirates and pirate lords are always independent
  if (npcType === 'PIRATE' || npcType === 'PIRATE_LORD') return null;

  // Bounty hunters are independent in outer/frontier, faction-aligned in core/inner
  if (npcType === 'BOUNTY_HUNTER') {
    if (zone === 'core' || zone === 'inner_ring' || zone === 'home') {
      return FACTIONS[Math.floor(Math.random() * FACTIONS.length)];
    }
    return null;
  }

  // Patrols and Traders: high faction affiliation in secure zones
  if (zone === 'core' || zone === 'inner_ring' || zone === 'home') {
    return FACTIONS[Math.floor(Math.random() * FACTIONS.length)];
  }
  if (zone === 'mid_ring' || zone === 'transit') {
    // 60% chance of faction alignment in mid-ring
    return Math.random() < 0.6 ? FACTIONS[Math.floor(Math.random() * FACTIONS.length)] : null;
  }
  // Outer/frontier/deep_space: 20% chance
  if (Math.random() < 0.2) {
    return FACTIONS[Math.floor(Math.random() * FACTIONS.length)];
  }
  return null;
};

/**
 * Generate a random NPC name
 */
const generateNPCName = (npcType) => {
  const prefixes = namePrefixes[npcType] || namePrefixes.PIRATE;
  const prefix = prefixes[Math.floor(Math.random() * prefixes.length)];
  const name = namePostfixes[Math.floor(Math.random() * namePostfixes.length)];
  return `${prefix} ${name}`;
};

/**
 * Get NPC stats based on type and ship
 */
const getNPCStats = (npcType, shipType, zoneDifficulty = null) => {
  const npcConfig = config.npcTypes[npcType] || {};
  const shipConfig = Object.values(config.shipTypes).find(s => s.name === shipType);

  if (!shipConfig) {
    return { hull: 100, shields: 50, attack: 10, defense: 5, speed: 10 };
  }

  // Scale stats based on NPC type and zone difficulty
  const bossMultiplier = npcConfig.isBoss ? 2.0 : 1.0;
  const zoneMultiplier = Number(zoneDifficulty?.npcStatMultiplier || 1);
  const statMultiplier = bossMultiplier * zoneMultiplier;
  return {
    hull: Math.max(1, Math.floor(shipConfig.hull * statMultiplier)),
    shields: Math.max(0, Math.floor(shipConfig.shields * statMultiplier)),
    attack: Math.max(1, Math.floor((shipType === 'Fighter' ? 20 : shipType === 'Destroyer' ? 35 : 15) * statMultiplier)),
    defense: Math.max(0, Math.floor((shipType === 'Freighter' ? 10 : 8) * statMultiplier)),
    speed: Math.max(1, Math.floor((shipType === 'Fighter' ? 15 : shipType === 'Freighter' ? 5 : 10)))
  };
};

/**
 * Spawn a single NPC in a sector
 */
const spawnNPC = async (sectorId, npcType = null, transaction = null) => {
  // Validate sector exists
  const sector = await Sector.findByPk(sectorId, { transaction });
  if (!sector) {
    throw Object.assign(new Error('Sector not found'), { statusCode: 404 });
  }

  // Enforce per-sector NPC population cap
  const MAX_NPCS_PER_SECTOR = 50;
  const existingCount = await NPC.count({ where: { current_sector_id: sectorId, is_alive: true }, transaction });
  if (existingCount >= MAX_NPCS_PER_SECTOR) {
    throw Object.assign(new Error(`Sector at NPC capacity (${MAX_NPCS_PER_SECTOR})`), { statusCode: 429 });
  }

  const sectorPolicy = getSectorPolicy(sector);
  const zoneDifficulty = getZoneDifficultyForSector(sector);

  // Random type if not specified (respecting zone policy)
  if (!npcType) {
    const types = Object.keys(config.npcTypes).filter((type) => {
      if (sectorPolicy.rule_flags?.allow_hostile_npcs === false) {
        return !HOSTILE_NPC_TYPES.has(type);
      }
      return true;
    });
    const candidateTypes = types.length > 0 ? types : Object.keys(config.npcTypes);
    const weights = candidateTypes.map(t => config.npcTypes[t].spawnChance);
    const totalWeight = weights.reduce((a, b) => a + b, 0);
    let random = Math.random() * totalWeight;

    for (let i = 0; i < candidateTypes.length; i++) {
      random -= weights[i];
      if (random <= 0) {
        npcType = candidateTypes[i];
        break;
      }
    }
    npcType = npcType || candidateTypes[0] || 'PIRATE';
  }

  const npcConfig = config.npcTypes[npcType];
  const shipType = npcConfig.ships[Math.floor(Math.random() * npcConfig.ships.length)];
  const stats = getNPCStats(npcType, shipType, zoneDifficulty);
  
  // Calculate credits based on type
  const baseCredits = npcConfig.isBoss ? 1000 : npcType === 'TRADER' ? 500 : 200;
  const credits = Math.floor(baseCredits * (0.8 + Math.random() * 0.4));

  // Generate personality and determine intelligence tier
  const personality = npcPersonalityService.generatePersonality(npcType);
  const intelligenceTier = config.npcAI.defaultIntelligenceTier[npcType] || 1;

  // Assign faction based on NPC type and sector zone
  const faction = assignFaction(npcType, sector);

  const npc = await NPC.create({
    name: generateNPCName(npcType),
    npc_type: npcType,
    ship_type: shipType,
    current_sector_id: sectorId,
    hull_points: stats.hull,
    max_hull_points: stats.hull,
    shield_points: stats.shields,
    max_shield_points: stats.shields,
    attack_power: stats.attack,
    defense_rating: stats.defense,
    speed: stats.speed,
    aggression_level: npcConfig.hostility === 'hostile' ? 0.8 : npcConfig.hostility === 'neutral' ? 0.3 : 0.1,
    flee_threshold: npcConfig.behavior === 'flee' ? 0.5 : 0.2,
    credits_carried: credits,
    experience_value: npcConfig.isBoss ? 500 : 50 + stats.hull / 2,
    is_alive: true,
    // Phase 2: AI behavior fields
    behavior_state: 'idle',
    ai_personality: personality,
    intelligence_tier: intelligenceTier,
    home_sector_id: sectorId,
    faction
  }, { transaction });

  return npc;
};

/**
 * Get NPCs in a sector
 */
const getNPCsInSector = async (sectorId) => {
  return NPC.findAll({
    where: { current_sector_id: sectorId, is_alive: true },
    attributes: [
      'npc_id', 'name', 'npc_type', 'ship_type',
      'hull_points', 'max_hull_points', 'shield_points', 'max_shield_points',
      'attack_power', 'defense_rating',
      'behavior_state', 'intelligence_tier', 'ai_personality', 'faction'
    ]
  });
};

/**
 * Get NPC details
 */
const getNPCById = async (npcId) => {
  const npc = await NPC.findByPk(npcId, {
    include: [{ model: Sector, as: 'currentSector', attributes: ['sector_id', 'name'] }]
  });
  if (!npc) throw Object.assign(new Error('NPC not found'), { statusCode: 404 });
  return npc;
};

/**
 * Respawn dead NPCs
 */
const respawnNPCs = async () => {
  const now = new Date();
  const deadNPCs = await NPC.findAll({
    where: { is_alive: false, respawn_at: { [Op.lte]: now } }
  });

  for (const npc of deadNPCs) {
    const stats = getNPCStats(npc.npc_type, npc.ship_type);
    await npc.update({
      is_alive: true,
      hull_points: stats.hull,
      shield_points: stats.shields,
      respawn_at: null,
      // Reset AI and combat state
      behavior_state: 'idle',
      movement_target_id: null,
      dialogue_state: null,
      target_ship_id: null,
      target_user_id: null
    });
  }

  return deadNPCs.length;
};

/**
 * Check if two sectors are connected
 */
const areSectorsConnected = async (sectorAId, sectorBId, transaction = null) => {
  if (sectorAId === sectorBId) return false;

  const connection = await SectorConnection.findOne({
    where: {
      [Op.or]: [
        { sector_a_id: sectorAId, sector_b_id: sectorBId },
        { sector_a_id: sectorBId, sector_b_id: sectorAId }
      ]
    },
    ...(transaction && { transaction })
  });

  return !!connection;
};

/**
 * Move NPC to adjacent sector (AI behavior)
 */
const moveNPC = async (npcId, targetSectorId, transaction = null) => {
  const npc = await NPC.findByPk(npcId, { transaction });
  if (!npc || !npc.is_alive) return null;

  // Validate target sector exists
  const targetSector = await Sector.findByPk(targetSectorId, { transaction });
  if (!targetSector) {
    throw Object.assign(new Error('Target sector not found'), { statusCode: 404 });
  }

  // Validate sectors are connected
  const connected = await areSectorsConnected(npc.current_sector_id, targetSectorId, transaction);
  if (!connected) {
    throw Object.assign(new Error('Target sector is not adjacent'), { statusCode: 400 });
  }

  await npc.update({ current_sector_id: targetSectorId, last_action_at: new Date() }, { transaction });
  return npc;
};

/**
 * Check for hostile NPCs in a sector that would attack a player
 * Returns the most aggressive hostile NPC if found
 */
const getAggressiveNPCInSector = async (sectorId, transaction = null) => {
  const sector = await Sector.findByPk(sectorId, { ...(transaction && { transaction }) });
  if (!sector) return null;

  const sPolicy = getSectorPolicy(sector);
  if (sPolicy.rule_flags?.safe_harbor || sPolicy.rule_flags?.allow_hostile_npcs === false) {
    return null;
  }

  // Find hostile NPCs ordered by aggression level (descending)
  const hostileNPC = await NPC.findOne({
    where: {
      current_sector_id: sectorId,
      is_alive: true,
      aggression_level: { [Op.gte]: 0.7 } // Aggressive or higher
    },
    order: [['aggression_level', 'DESC'], ['attack_power', 'DESC']],
    ...(transaction && { transaction })
  });

  return hostileNPC;
};

/**
 * Determine if an NPC will initiate combat based on aggression
 * Higher aggression = higher chance of attacking
 */
const willNPCAttack = (npc) => {
  if (!npc || !npc.is_alive) return false;

  // Random roll vs aggression level (aggressive NPCs have 70%+ chance)
  return Math.random() < npc.aggression_level;
};

/**
 * Get all alive NPCs in sectors with active player ships (and their adjacent sectors).
 * Used by the tick system to only process NPCs near players.
 * @returns {Promise<NPC[]>}
 */
const getActiveNPCsNearPlayers = async () => {
  // Find all sectors with active player ships
  const activeShips = await Ship.findAll({
    where: { is_active: true },
    attributes: ['current_sector_id']
  });

  const playerSectorIds = new Set(activeShips.map(s => s.current_sector_id));
  if (playerSectorIds.size === 0) return [];

  // Batch-fetch adjacency for all player sectors in a single query
  const adjacencyMap = await buildAdjacencyMap(playerSectorIds);
  const allRelevantSectorIds = new Set(playerSectorIds);
  for (const sectorId of playerSectorIds) {
    const neighbors = adjacencyMap.get(sectorId) || [];
    for (const id of neighbors) {
      allRelevantSectorIds.add(id);
    }
  }

  return NPC.findAll({
    where: {
      current_sector_id: { [Op.in]: [...allRelevantSectorIds] },
      is_alive: true
    },
    include: [{
      model: Sector,
      as: 'currentSector',
      attributes: ['sector_id', 'name', 'zone_class', 'security_class', 'access_mode', 'rule_flags']
    }]
  });
};

module.exports = {
  generateNPCName,
  getNPCStats,
  getZoneDifficultyForSector,
  getSpawnDensityForSector,
  spawnNPC,
  getNPCsInSector,
  getNPCById,
  respawnNPCs,
  moveNPC,
  getAggressiveNPCInSector,
  willNPCAttack,
  getActiveNPCsNearPlayers
};

