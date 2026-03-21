const { Mission, PlayerMission, Port, User, Commodity, PortCommodity, NPC } = require('../models');
const { Op } = require('sequelize');
const { sequelize } = require('../config/database');
const config = require('../config');

/**
 * Generate missions for a port based on its type
 */
const generateMissionsForPort = async (portId) => {
  const port = await Port.findByPk(portId, {
    include: [{ model: PortCommodity, as: 'portCommodities', include: [{ model: Commodity, as: 'commodity' }] }]
  });
  if (!port) return [];

  // Delete expired/old inactive missions for this port
  await Mission.destroy({
    where: { port_id: portId, is_active: false }
  });

  // Count existing active missions
  const activeMissions = await Mission.count({ where: { port_id: portId, is_active: true } });
  const toGenerate = config.missions.missionsPerPort - activeMissions;
  if (toGenerate <= 0) return [];

  const missions = [];
  const missionTypes = ['delivery', 'bounty', 'scan', 'trade_volume', 'patrol'];
  const expiresAt = new Date(Date.now() + config.missions.expirationHours * 60 * 60 * 1000);

  for (let i = 0; i < toGenerate; i++) {
    const type = missionTypes[Math.floor(Math.random() * missionTypes.length)];
    const multipliers = config.missions.rewardMultipliers[type];
    const baseReward = 500 + Math.floor(Math.random() * 1500);
    const baseXP = 25 + Math.floor(Math.random() * 75);

    let requirements = {};
    let title = '';
    let description = '';

    switch (type) {
      case 'delivery': {
        const commodities = port.portCommodities || [];
        const commodity = commodities.length > 0
          ? commodities[Math.floor(Math.random() * commodities.length)].commodity
          : null;
        const qty = 5 + Math.floor(Math.random() * 20);
        requirements = { commodity_name: commodity ? commodity.name : 'Iron Ore', quantity: qty };
        title = `Deliver ${qty} ${requirements.commodity_name}`;
        description = `Deliver ${qty} units of ${requirements.commodity_name} to this port.`;
        break;
      }
      case 'bounty':
        requirements = { kills: 1 + Math.floor(Math.random() * 3) };
        title = `Bounty: Eliminate ${requirements.kills} hostile(s)`;
        description = `Destroy ${requirements.kills} hostile NPCs in the area.`;
        break;
      case 'scan':
        requirements = { sectors: 3 + Math.floor(Math.random() * 5) };
        title = `Scan ${requirements.sectors} sectors`;
        description = `Explore and scan ${requirements.sectors} new sectors.`;
        break;
      case 'trade_volume': {
        const volume = 1000 + Math.floor(Math.random() * 4000);
        requirements = { credits_traded: volume };
        title = `Trade ${volume} credits worth`;
        description = `Complete trades totaling at least ${volume} credits.`;
        break;
      }
      case 'patrol':
        requirements = { sectors_visited: 5 + Math.floor(Math.random() * 5) };
        title = `Patrol ${requirements.sectors_visited} sectors`;
        description = `Visit ${requirements.sectors_visited} different sectors.`;
        break;
    }

    const mission = await Mission.create({
      port_id: portId,
      mission_type: type,
      title,
      description,
      requirements,
      reward_credits: Math.round(baseReward * multipliers.credits),
      reward_xp: Math.round(baseXP * multipliers.xp),
      min_level: 1,
      max_level: 100,
      expires_at: expiresAt,
      is_active: true
    });
    missions.push(mission);
  }

  return missions;
};

/**
 * Get available missions at a port for a user
 */
const getAvailableMissions = async (portId, userId) => {
  const user = await User.findByPk(userId);
  if (!user) {
    const error = new Error('User not found');
    error.statusCode = 404;
    throw error;
  }

  // Get missions the user has already accepted (any status)
  const playerMissions = await PlayerMission.findAll({
    where: { user_id: userId },
    attributes: ['mission_id']
  });
  const acceptedMissionIds = playerMissions.map(pm => pm.mission_id);

  const where = {
    port_id: portId,
    is_active: true,
    expires_at: { [Op.gt]: new Date() },
    min_level: { [Op.lte]: user.player_level || 1 },
    max_level: { [Op.gte]: user.player_level || 1 }
  };

  if (acceptedMissionIds.length > 0) {
    where.mission_id = { [Op.notIn]: acceptedMissionIds };
  }

  return Mission.findAll({ where });
};

/**
 * Accept a mission
 */
const acceptMission = async (userId, missionId) => {
  const mission = await Mission.findByPk(missionId);
  if (!mission || !mission.is_active) {
    const error = new Error('Mission not found or inactive');
    error.statusCode = 404;
    throw error;
  }

  if (new Date() > new Date(mission.expires_at)) {
    const error = new Error('Mission has expired');
    error.statusCode = 400;
    throw error;
  }

  // Check max active missions
  const activeCount = await PlayerMission.count({
    where: { user_id: userId, status: 'accepted' }
  });
  if (activeCount >= config.missions.maxActiveMissions) {
    const error = new Error(`Maximum active missions reached (${config.missions.maxActiveMissions})`);
    error.statusCode = 400;
    throw error;
  }

  // Check not already accepted
  const existing = await PlayerMission.findOne({
    where: { user_id: userId, mission_id: missionId }
  });
  if (existing) {
    const error = new Error('Mission already accepted');
    error.statusCode = 400;
    throw error;
  }

  const playerMission = await PlayerMission.create({
    user_id: userId,
    mission_id: missionId,
    status: 'accepted',
    progress: {},
    accepted_at: new Date()
  });

  return playerMission;
};

/**
 * Abandon a mission
 */
const abandonMission = async (userId, playerMissionId) => {
  const pm = await PlayerMission.findOne({
    where: { player_mission_id: playerMissionId, user_id: userId, status: 'accepted' }
  });
  if (!pm) {
    const error = new Error('Active mission not found');
    error.statusCode = 404;
    throw error;
  }

  await pm.update({ status: 'abandoned' });
  return pm;
};

/**
 * Get active missions for a user
 */
const getActiveMissions = async (userId) => {
  return PlayerMission.findAll({
    where: { user_id: userId, status: 'accepted' },
    include: [{ model: Mission, as: 'mission' }]
  });
};

/**
 * Update mission progress based on game events
 */
const updateMissionProgress = async (userId, eventType, eventData) => {
  const activeMissions = await PlayerMission.findAll({
    where: { user_id: userId, status: 'accepted' },
    include: [{ model: Mission, as: 'mission' }]
  });

  for (const pm of activeMissions) {
    const mission = pm.mission;
    // Skip expired missions
    if (mission.expires_at && new Date() > new Date(mission.expires_at)) continue;
    const progress = { ...(pm.progress || {}) };
    let updated = false;

    switch (mission.mission_type) {
      case 'delivery':
        if (eventType === 'trade' && eventData.type === 'sell' &&
            eventData.commodity_name === mission.requirements.commodity_name &&
            eventData.port_id === mission.port_id) {
          progress.delivered = (progress.delivered || 0) + eventData.quantity;
          updated = true;
        }
        break;
      case 'bounty':
        if (eventType === 'combat_kill') {
          progress.kills = (progress.kills || 0) + 1;
          updated = true;
        }
        break;
      case 'scan':
        if (eventType === 'sector_scan') {
          progress.sectors_scanned = (progress.sectors_scanned || 0) + 1;
          updated = true;
        }
        break;
      case 'trade_volume':
        if (eventType === 'trade') {
          progress.credits_traded = (progress.credits_traded || 0) + (eventData.total_value || 0);
          updated = true;
        }
        break;
      case 'patrol':
        if (eventType === 'sector_visit') {
          if (!progress.sectors_visited) progress.sectors_visited = [];
          if (!progress.sectors_visited.includes(eventData.sector_id)) {
            progress.sectors_visited.push(eventData.sector_id);
            updated = true;
          }
        }
        break;
    }

    if (updated) {
      // Save progress and check completion atomically
      // If completeMission fails, progress is still saved (better to track progress
      // than lose it), but we catch to prevent one mission failure blocking others
      try {
        pm.progress = progress;
        pm.changed('progress', true);
        await pm.save();

        if (isMissionComplete(mission, progress)) {
          await completeMission(userId, pm.player_mission_id);
        }
      } catch (e) {
        // Log but don't rethrow — one mission failure shouldn't block others
        console.error(`[MissionProgress] Error updating mission ${pm.player_mission_id}:`, e.message);
      }
    }
  }
};

/**
 * Check if mission requirements are met
 */
const isMissionComplete = (mission, progress) => {
  const req = mission.requirements;
  switch (mission.mission_type) {
    case 'delivery':
      return (progress.delivered || 0) >= req.quantity;
    case 'bounty':
      return (progress.kills || 0) >= req.kills;
    case 'scan':
      return (progress.sectors_scanned || 0) >= req.sectors;
    case 'trade_volume':
      return (progress.credits_traded || 0) >= req.credits_traded;
    case 'patrol':
      return (progress.sectors_visited || []).length >= req.sectors_visited;
    default:
      return false;
  }
};

/**
 * Complete a mission and award rewards
 */
const completeMission = async (userId, playerMissionId) => {
  const pm = await PlayerMission.findOne({
    where: { player_mission_id: playerMissionId, user_id: userId, status: 'accepted' },
    include: [{ model: Mission, as: 'mission' }]
  });
  if (!pm) {
    const error = new Error('Active mission not found');
    error.statusCode = 404;
    throw error;
  }

  const transaction = await sequelize.transaction();
  try {
    // Award credits
    const user = await User.findByPk(userId, { transaction, lock: true });
    await user.update({
      credits: Number(user.credits) + pm.mission.reward_credits
    }, { transaction });

    // Award XP
    if (pm.mission.reward_xp > 0) {
      try {
        const progressionService = require('./progressionService');
        await progressionService.awardXP(userId, pm.mission.reward_xp, 'mission', transaction);
      } catch (e) {
        // XP failure should not block mission completion
      }
    }

    await pm.update({
      status: 'completed',
      completed_at: new Date()
    }, { transaction });

    await transaction.commit();
    return pm.reload({ include: [{ model: Mission, as: 'mission' }] });
  } catch (err) {
    await transaction.rollback();
    throw err;
  }
};

/**
 * Expire old missions
 */
const expireOldMissions = async () => {
  const expired = await Mission.update(
    { is_active: false },
    { where: { is_active: true, expires_at: { [Op.lt]: new Date() } } }
  );

  // Fail active player missions on expired missions
  const expiredMissions = await Mission.findAll({
    where: { is_active: false, expires_at: { [Op.lt]: new Date() } },
    attributes: ['mission_id']
  });
  const expiredIds = expiredMissions.map(m => m.mission_id);

  if (expiredIds.length > 0) {
    await PlayerMission.update(
      { status: 'failed' },
      { where: { mission_id: { [Op.in]: expiredIds }, status: 'accepted' } }
    );
  }

  return expired[0]; // Number of missions expired
};

/**
 * Refresh port missions (generate new ones for ports that need them)
 */
const refreshPortMissions = async () => {
  const ports = await Port.findAll({ where: { is_active: true }, attributes: ['port_id'] });
  let generated = 0;
  for (const port of ports) {
    const missions = await generateMissionsForPort(port.port_id);
    generated += missions.length;
  }
  return generated;
};

/**
 * Create a bounty mission issued by an NPC (patrol or bounty hunter).
 * Returns the created Mission and auto-accepts it for the player.
 * @param {string} npcId - Issuing NPC ID
 * @param {string} userId - Player accepting the mission
 * @param {Object} opts - { kills, sectorName, rewardCredits, rewardXp }
 * @returns {Promise<{ mission: Object, playerMission: Object }>}
 */
const createNPCBountyMission = async (npcId, userId, opts = {}) => {
  const kills = opts.kills || 1 + Math.floor(Math.random() * 3);
  const rewardCredits = opts.rewardCredits || 500 + Math.floor(Math.random() * 1500);
  const rewardXp = opts.rewardXp || 25 + Math.floor(Math.random() * 75);
  const sectorName = opts.sectorName || 'nearby space';

  // Check max active missions
  const activeCount = await PlayerMission.count({
    where: { user_id: userId, status: 'accepted' }
  });
  if (activeCount >= config.missions.maxActiveMissions) {
    const error = new Error(`Maximum active missions reached (${config.missions.maxActiveMissions})`);
    error.statusCode = 400;
    throw error;
  }

  const mission = await Mission.create({
    port_id: null,
    issued_by_npc_id: npcId,
    mission_type: 'bounty',
    title: `Bounty: Eliminate ${kills} hostile(s) near ${sectorName}`,
    description: `Destroy ${kills} hostile NPCs. Contract issued by NPC.`,
    requirements: { kills },
    reward_credits: rewardCredits,
    reward_xp: rewardXp,
    min_level: 1,
    max_level: 100,
    expires_at: new Date(Date.now() + 4 * 60 * 60 * 1000), // 4 hours
    is_active: true
  });

  const playerMission = await PlayerMission.create({
    user_id: userId,
    mission_id: mission.mission_id,
    status: 'accepted',
    progress: {},
    accepted_at: new Date()
  });

  return { mission, playerMission };
};

/**
 * Create a patrol mission issued by a patrol NPC.
 * @param {string} npcId - Issuing patrol NPC ID
 * @param {string} userId - Player accepting the mission
 * @param {Object} opts - { sectorsToVisit, rewardCredits, rewardXp }
 * @returns {Promise<{ mission: Object, playerMission: Object }>}
 */
const createNPCPatrolMission = async (npcId, userId, opts = {}) => {
  const sectors = opts.sectorsToVisit || 3 + Math.floor(Math.random() * 5);
  const rewardCredits = opts.rewardCredits || 300 + Math.floor(Math.random() * 700);
  const rewardXp = opts.rewardXp || 20 + Math.floor(Math.random() * 40);

  // Check max active missions
  const activeCount = await PlayerMission.count({
    where: { user_id: userId, status: 'accepted' }
  });
  if (activeCount >= config.missions.maxActiveMissions) {
    const error = new Error(`Maximum active missions reached (${config.missions.maxActiveMissions})`);
    error.statusCode = 400;
    throw error;
  }

  const mission = await Mission.create({
    port_id: null,
    issued_by_npc_id: npcId,
    mission_type: 'patrol',
    title: `Patrol ${sectors} sectors`,
    description: `Visit ${sectors} different sectors to help maintain order. Contract issued by patrol NPC.`,
    requirements: { sectors_visited: sectors },
    reward_credits: rewardCredits,
    reward_xp: rewardXp,
    min_level: 1,
    max_level: 100,
    expires_at: new Date(Date.now() + 6 * 60 * 60 * 1000), // 6 hours
    is_active: true
  });

  const playerMission = await PlayerMission.create({
    user_id: userId,
    mission_id: mission.mission_id,
    status: 'accepted',
    progress: {},
    accepted_at: new Date()
  });

  return { mission, playerMission };
};

module.exports = {
  generateMissionsForPort,
  getAvailableMissions,
  acceptMission,
  abandonMission,
  getActiveMissions,
  updateMissionProgress,
  completeMission,
  expireOldMissions,
  refreshPortMissions,
  createNPCBountyMission,
  createNPCPatrolMission
};
