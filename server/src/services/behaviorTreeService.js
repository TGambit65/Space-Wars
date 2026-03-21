const config = require('../config');
const gameSettingsService = require('./gameSettingsService');
const { findPathToSector, findNearestPortSector } = require('./sectorGraphService');

/**
 * Calculate an attack confidence score (0-1) for an NPC vs a target.
 * Higher score = more confident the NPC should attack.
 * @param {Object} npc - NPC instance
 * @param {Object} target - Target with hull_points, max_hull_points, shield_points, max_shield_points, attack_power, defense_rating
 * @param {number} difficulty - 1-5 game difficulty
 * @returns {number} Score 0-1
 */
const calculateAttackScore = (npc, target, difficulty) => {
  // Hull advantage: how much healthier is the NPC relative to target
  const npcHullRatio = npc.max_hull_points > 0 ? npc.hull_points / npc.max_hull_points : 0;
  const targetHullRatio = target.max_hull_points > 0 ? target.hull_points / target.max_hull_points : 0;
  const hullAdvantage = (npcHullRatio - targetHullRatio + 1) / 2; // Normalize to 0-1

  // Shield advantage
  const npcShieldRatio = npc.max_shield_points > 0 ? npc.shield_points / npc.max_shield_points : 0;
  const targetShieldRatio = target.max_shield_points > 0 ? target.shield_points / target.max_shield_points : 0;
  const shieldAdvantage = (npcShieldRatio - targetShieldRatio + 1) / 2;

  // Combat power comparison
  const targetDefense = target.defense_rating || 1;
  const attackRatio = Math.min(npc.attack_power / targetDefense, 2) / 2; // Cap at 2x advantage, normalize

  // Aggression: NPC's innate willingness to fight
  const aggression = npc.aggression_level || 0.5;

  // Difficulty modifier: higher difficulty makes NPCs bolder (slight boost to score)
  // Range: difficulty 1 → -0.05, difficulty 3 → 0, difficulty 5 → +0.05
  const difficultyModifier = ((difficulty || 3) - 3) * 0.025;

  // Weighted score
  const score = (
    hullAdvantage * 0.3 +
    shieldAdvantage * 0.15 +
    attackRatio * 0.3 +
    aggression * 0.25
  ) + difficultyModifier;

  return Math.max(0, Math.min(1, score));
};

/**
 * Find the safest adjacent sector for an NPC to flee to.
 * Scores: fewer hostile NPCs = safer, has port = safer.
 * @param {Array} adjacentSectors - Pre-fetched adjacent sector data with hostileCount, hasPort
 * @returns {string|null} Sector ID of safest option
 */
const findSafestAdjacentSector = (adjacentSectors) => {
  if (!adjacentSectors || adjacentSectors.length === 0) return null;

  let best = null;
  let bestScore = -Infinity;

  for (const sector of adjacentSectors) {
    // Lower hostile count = higher score, having a port adds bonus
    const score = -(sector.hostileCount || 0) * 10 + (sector.hasPort ? 5 : 0);
    if (score > bestScore) {
      bestScore = score;
      best = sector.sector_id;
    }
  }

  return best;
};

/**
 * Core NPC decision engine. Evaluates what an NPC should do given its current state and environment.
 * Decisions are priority-ordered: first matching rule wins.
 *
 * @param {Object} npc - NPC model instance (with all fields)
 * @param {Object} context - Environment context:
 *   - playersInSector: Array of player ship objects in the NPC's sector
 *   - npcsInSector: Array of other NPCs in the sector
 *   - adjacentSectors: Array of { sector_id, name, hasPort, hostileCount, playerCount }
 *   - sectorHasPort: boolean
 *   - difficulty: 1-5
 *   - currentTarget: Object (target in active combat)
 * @returns {Promise<{ action: string, target?: Object, targetSectorId?: string, reason: string, needsAI: boolean }>}
 */
const evaluateNPCDecision = async (npc, context = {}) => {
  const {
    playersInSector = [],
    adjacentSectors = [],
    sectorHasPort = false,
    hostileNpcsAllowed = true
  } = context;
  const difficulty = context.difficulty || gameSettingsService.getSetting('npc.difficulty', 3);
  const npcConfig = config.npcTypes[npc.npc_type] || {};

  // 1. DEAD CHECK
  if (!npc.is_alive) {
    return { action: 'idle', reason: 'dead', needsAI: false };
  }

  // 2. FLEE CRITICAL: hull below flee threshold
  const hullPercent = npc.max_hull_points > 0 ? npc.hull_points / npc.max_hull_points : 0;
  if (hullPercent < (npc.flee_threshold || 0.2)) {
    const safeSector = findSafestAdjacentSector(adjacentSectors);
    return {
      action: 'flee',
      targetSectorId: safeSector,
      reason: `critical hull (${Math.round(hullPercent * 100)}%)`,
      needsAI: false
    };
  }

  // 3. FINISH TARGET: already in combat and target is almost dead
  if (npc.behavior_state === 'engaging' && context.currentTarget) {
    const targetHullPercent = context.currentTarget.max_hull_points > 0
      ? context.currentTarget.hull_points / context.currentTarget.max_hull_points
      : 0;
    if (targetHullPercent < 0.1) {
      return {
        action: 'finish_target',
        target: context.currentTarget,
        reason: 'finishing blow',
        needsAI: false
      };
    }
  }

  // 4. HOSTILE ENCOUNTER: hostile NPC + player in sector
  if (npcConfig.hostility === 'hostile' && !hostileNpcsAllowed) {
    return {
      action: 'idle',
      reason: 'hostile NPC combat disabled in this sector',
      needsAI: false
    };
  }

  if (npcConfig.hostility === 'hostile' && playersInSector.length > 0) {
    // Pick weakest player as target
    const target = playersInSector.reduce((weakest, p) => {
      const pHull = p.max_hull_points > 0 ? p.hull_points / p.max_hull_points : 1;
      const wHull = weakest.max_hull_points > 0 ? weakest.hull_points / weakest.max_hull_points : 1;
      return pHull < wHull ? p : weakest;
    }, playersInSector[0]);

    const score = calculateAttackScore(npc, target, difficulty);
    const threshold = config.npcAI.difficultyThresholds[difficulty] || 0.5;
    const retreatThreshold = 1 - threshold;

    if (score >= threshold) {
      // Clear advantage — attack (scripted)
      return { action: 'attack_player', target, reason: 'advantage', needsAI: false };
    } else if (score <= retreatThreshold) {
      // Clear disadvantage — flee (scripted)
      const safeSector = findSafestAdjacentSector(adjacentSectors);
      return { action: 'flee', targetSectorId: safeSector, reason: 'outmatched', needsAI: false };
    } else {
      // Ambiguous range — default to attack but flag for AI override if eligible
      const canUseAI = (npc.intelligence_tier || 1) >= 2;
      return {
        action: 'attack_player',
        target,
        reason: 'ambiguous',
        needsAI: canUseAI
      };
    }
  }

  // 5. TRADER AT PORT: traders trade when at a port
  if (npc.npc_type === 'TRADER' && sectorHasPort) {
    return { action: 'trade', reason: 'at port', needsAI: false };
  }

  // 6. TRADER MOVING: traders seek ports
  if (npc.npc_type === 'TRADER' && !sectorHasPort) {
    const portSectorStep = await findNearestPortSector(npc.current_sector_id);
    if (portSectorStep && portSectorStep !== npc.current_sector_id) {
      return { action: 'move_toward_target', targetSectorId: portSectorStep, reason: 'seeking port', needsAI: false };
    }
    // No port found — fall through to wander
  }

  // 7. PATROL GUARD: patrol ships guard at port or at home
  if (npc.npc_type === 'PATROL' && sectorHasPort) {
    return { action: 'guard', reason: 'protecting port', needsAI: false };
  }

  // 8. PATROL AT HOME: patrol ships idle at home when no port to guard
  if (npc.npc_type === 'PATROL' && npc.home_sector_id && npc.current_sector_id === npc.home_sector_id) {
    return { action: 'guard', reason: 'holding home sector', needsAI: false };
  }

  // 9. PATROL RETURN: patrol ships return home if away
  if (npc.npc_type === 'PATROL' && npc.home_sector_id && npc.current_sector_id !== npc.home_sector_id) {
    const nextStep = await findPathToSector(npc.current_sector_id, npc.home_sector_id, 10);
    if (nextStep) {
      return { action: 'move_toward_target', targetSectorId: nextStep, reason: 'returning home', needsAI: false };
    }
  }

  // 10. BOUNTY_HUNTER: look for players in adjacent sectors to hunt
  if (npc.npc_type === 'BOUNTY_HUNTER') {
    const adjacentWithPlayers = adjacentSectors.filter(s => s.playerCount > 0);
    if (adjacentWithPlayers.length === 1) {
      return {
        action: 'move_toward_target',
        targetSectorId: adjacentWithPlayers[0].sector_id,
        reason: 'tracking bounty',
        needsAI: false
      };
    }
    if (adjacentWithPlayers.length > 1) {
      // Multiple potential targets — AI can pick if eligible
      const canUseAI = (npc.intelligence_tier || 1) >= 2;
      return {
        action: 'move_toward_target',
        targetSectorId: adjacentWithPlayers[0].sector_id,
        reason: 'tracking bounty (multiple targets)',
        needsAI: canUseAI
      };
    }
  }

  // 11. WANDER: pick a random adjacent sector
  if (adjacentSectors.length > 0) {
    const randomSector = adjacentSectors[Math.floor(Math.random() * adjacentSectors.length)];
    return { action: 'patrol', targetSectorId: randomSector.sector_id, reason: 'wandering', needsAI: false };
  }

  // 12. IDLE: nothing to do (no adjacent sectors, edge case)
  return { action: 'idle', reason: 'nothing to do', needsAI: false };
};

module.exports = {
  evaluateNPCDecision,
  calculateAttackScore,
  findSafestAdjacentSector
};
