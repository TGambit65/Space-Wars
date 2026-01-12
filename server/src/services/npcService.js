const { NPC, Sector, sequelize } = require('../models');
const config = require('../config');
const { Op } = require('sequelize');

// NPC name prefixes for generation
const namePrefixes = {
  PIRATE: ['Dread', 'Black', 'Shadow', 'Rogue', 'Crimson', 'Blood'],
  PIRATE_LORD: ['Admiral', 'Captain', 'Lord', 'Baron'],
  TRADER: ['Merchant', 'Trader', 'Captain', 'Master'],
  PATROL: ['Officer', 'Lieutenant', 'Commander', 'Sergeant'],
  BOUNTY_HUNTER: ['Hunter', 'Tracker', 'Seeker', 'Stalker']
};

const namePostfixes = ['Vex', 'Kira', 'Rex', 'Nova', 'Zane', 'Luna', 'Drake', 'Hawk', 'Storm', 'Blaze'];

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
const getNPCStats = (npcType, shipType) => {
  const npcConfig = config.npcTypes[npcType];
  const shipConfig = Object.values(config.shipTypes).find(s => s.name === shipType);
  
  if (!shipConfig) {
    return { hull: 100, shields: 50, attack: 10, defense: 5, speed: 10 };
  }

  // Scale stats based on NPC type
  const statMultiplier = npcConfig.isBoss ? 2.0 : 1.0;
  return {
    hull: Math.floor(shipConfig.hull * statMultiplier),
    shields: Math.floor(shipConfig.shields * statMultiplier),
    attack: Math.floor((shipType === 'Fighter' ? 20 : shipType === 'Destroyer' ? 35 : 15) * statMultiplier),
    defense: Math.floor((shipType === 'Freighter' ? 10 : 8) * statMultiplier),
    speed: Math.floor((shipType === 'Fighter' ? 15 : shipType === 'Freighter' ? 5 : 10))
  };
};

/**
 * Spawn a single NPC in a sector
 */
const spawnNPC = async (sectorId, npcType = null, transaction = null) => {
  // Random type if not specified
  if (!npcType) {
    const types = Object.keys(config.npcTypes);
    const weights = types.map(t => config.npcTypes[t].spawnChance);
    const totalWeight = weights.reduce((a, b) => a + b, 0);
    let random = Math.random() * totalWeight;
    
    for (let i = 0; i < types.length; i++) {
      random -= weights[i];
      if (random <= 0) {
        npcType = types[i];
        break;
      }
    }
    npcType = npcType || 'PIRATE';
  }

  const npcConfig = config.npcTypes[npcType];
  const shipType = npcConfig.ships[Math.floor(Math.random() * npcConfig.ships.length)];
  const stats = getNPCStats(npcType, shipType);
  
  // Calculate credits based on type
  const baseCredits = npcConfig.isBoss ? 1000 : npcType === 'TRADER' ? 500 : 200;
  const credits = Math.floor(baseCredits * (0.8 + Math.random() * 0.4));

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
    is_alive: true
  }, { transaction });

  return npc;
};

/**
 * Get NPCs in a sector
 */
const getNPCsInSector = async (sectorId) => {
  return NPC.findAll({
    where: { current_sector_id: sectorId, is_alive: true },
    attributes: ['npc_id', 'name', 'npc_type', 'ship_type', 'hull_points', 'max_hull_points', 'shield_points', 'max_shield_points']
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
      respawn_at: null
    });
  }

  return deadNPCs.length;
};

/**
 * Move NPC to adjacent sector (AI behavior)
 */
const moveNPC = async (npcId, targetSectorId, transaction = null) => {
  const npc = await NPC.findByPk(npcId, { transaction });
  if (!npc || !npc.is_alive) return null;
  
  await npc.update({ current_sector_id: targetSectorId, last_action_at: new Date() }, { transaction });
  return npc;
};

module.exports = {
  generateNPCName,
  getNPCStats,
  spawnNPC,
  getNPCsInSector,
  getNPCById,
  respawnNPCs,
  moveNPC
};

