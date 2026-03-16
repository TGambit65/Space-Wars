const { Ship, NPC, CombatLog, User, Sector, sequelize } = require('../models');
const config = require('../config');
const maintenanceService = require('./maintenanceService');
const shipDesignerService = require('./shipDesignerService');

/**
 * Calculate damage with variance
 */
const calculateDamage = (attackPower, defenseRating) => {
  const baseDamage = Math.max(config.combat.minDamage, attackPower - defenseRating);
  const variance = 0.2; // ±20% variance
  const multiplier = 1 + (Math.random() * variance * 2 - variance);
  return Math.floor(baseDamage * multiplier);
};

/**
 * Check for critical hit
 */
const checkCriticalHit = () => {
  return Math.random() < config.combat.criticalHitChance;
};

/**
 * Apply damage to target (shields first, then hull)
 */
const applyDamage = (target, damage) => {
  let remainingDamage = damage;
  const shieldPenetration = Math.floor(damage * config.combat.shieldPenetration);
  
  // Some damage bypasses shields
  if (shieldPenetration > 0 && target.hull_points > 0) {
    target.hull_points = Math.max(0, target.hull_points - shieldPenetration);
    remainingDamage -= shieldPenetration;
  }
  
  // Remaining damage hits shields first
  if (target.shield_points > 0) {
    const shieldDamage = Math.min(target.shield_points, remainingDamage);
    target.shield_points -= shieldDamage;
    remainingDamage -= shieldDamage;
  }
  
  // Leftover hits hull
  if (remainingDamage > 0) {
    target.hull_points = Math.max(0, target.hull_points - remainingDamage);
  }
  
  return damage;
};

/**
 * Calculate flee chance based on speed difference
 */
const calculateFleeChance = (attacker, defender) => {
  const speedDiff = attacker.speed - defender.speed;
  return Math.min(0.9, Math.max(0.1, config.combat.fleeChanceBase + speedDiff * config.combat.fleeChancePerSpeedDiff));
};

/**
 * Calculate accuracy modifier based on scanner level difference
 * Better scanners = higher chance to hit (increases damage)
 */
const calculateScannerAccuracyBonus = (attacker, defender) => {
  const attackerScannerLevel = attacker.scanner_range || 1;
  const defenderScannerLevel = defender.scanner_range || 1;
  const scannerAdvantage = attackerScannerLevel - defenderScannerLevel;
  // Each scanner level difference = 5% accuracy bonus/penalty
  return 1.0 + (scannerAdvantage * 0.05);
};

/**
 * Execute a single combat round
 */
const executeCombatRound = (attacker, defender, roundNum) => {
  const round = { round: roundNum, actions: [] };

  // Calculate accuracy bonuses from scanners
  const attackerAccuracy = calculateScannerAccuracyBonus(attacker, defender);
  const defenderAccuracy = calculateScannerAccuracyBonus(defender, attacker);

  // Attacker attacks (with scanner accuracy bonus)
  let attackerDamage = Math.floor(calculateDamage(attacker.attack_power, defender.defense_rating) * attackerAccuracy);
  const attackerCrit = checkCriticalHit();
  if (attackerCrit) attackerDamage = Math.floor(attackerDamage * config.combat.criticalHitMultiplier);

  const actualAttackerDamage = applyDamage(defender, attackerDamage);
  round.actions.push({
    actor: 'attacker',
    action: 'attack',
    damage: actualAttackerDamage,
    critical: attackerCrit,
    accuracy_bonus: attackerAccuracy,
    target_shields: defender.shield_points,
    target_hull: defender.hull_points
  });

  // Check if defender destroyed
  if (defender.hull_points <= 0) {
    round.defender_destroyed = true;
    return round;
  }

  // Defender counter-attacks (with scanner accuracy bonus)
  let defenderDamage = Math.floor(calculateDamage(defender.attack_power, attacker.defense_rating) * defenderAccuracy);
  const defenderCrit = checkCriticalHit();
  if (defenderCrit) defenderDamage = Math.floor(defenderDamage * config.combat.criticalHitMultiplier);

  const actualDefenderDamage = applyDamage(attacker, defenderDamage);
  round.actions.push({
    actor: 'defender',
    action: 'attack',
    damage: actualDefenderDamage,
    critical: defenderCrit,
    accuracy_bonus: defenderAccuracy,
    target_shields: attacker.shield_points,
    target_hull: attacker.hull_points
  });

  if (attacker.hull_points <= 0) {
    round.attacker_destroyed = true;
  }

  // Consume energy for both combatants
  if (attacker.energy_per_round) {
    attacker.energy = Math.max(0, attacker.energy - attacker.energy_per_round);
    round.attacker_energy = attacker.energy;
  }
  if (defender.energy_per_round) {
    defender.energy = Math.max(0, defender.energy - defender.energy_per_round);
    round.defender_energy = defender.energy;
  }

  return round;
};

/**
 * Initiate combat between player ship and NPC
 */
const attackNPC = async (userId, shipId, npcId) => {
  const t = await sequelize.transaction();
  try {
    const ship = await Ship.findOne({
      where: { ship_id: shipId, owner_user_id: userId, is_active: true },
      transaction: t, lock: t.LOCK.UPDATE
    });
    if (!ship) throw Object.assign(new Error('Ship not found'), { statusCode: 404 });
    if (ship.in_combat) throw Object.assign(new Error('Ship already in combat'), { statusCode: 400 });

    const npc = await NPC.findOne({
      where: { npc_id: npcId, is_alive: true },
      transaction: t, lock: t.LOCK.UPDATE
    });
    if (!npc) throw Object.assign(new Error('Target not found'), { statusCode: 404 });
    if (ship.current_sector_id !== npc.current_sector_id) {
      throw Object.assign(new Error('Target not in same sector'), { statusCode: 400 });
    }

    // Mark ship as in combat
    await ship.update({ in_combat: true }, { transaction: t });

    // Execute combat
    const combatRounds = [];
    let totalAttackerDamage = 0, totalDefenderDamage = 0;
    
    // Apply faction combat bonus to attack power
    let factionAttackPower = ship.attack_power;
    try {
      const user = await User.findByPk(userId, { transaction: t });
      if (user && user.faction) {
        const factionService = require('./factionService');
        factionAttackPower = Math.floor(factionService.applyFactionBonus(ship.attack_power, user.faction, 'combat'));
      }
    } catch (e) { /* faction bonus failure should not block combat */ }

    // Create combat state objects
    const attackerState = {
      hull_points: ship.hull_points,
      shield_points: ship.shield_points,
      attack_power: factionAttackPower,
      defense_rating: ship.defense_rating,
      speed: ship.speed,
      scanner_range: ship.scanner_range || 1,
      energy: ship.energy || ship.max_energy || 100,
      energy_per_round: Math.floor((ship.max_energy || 100) * 0.02) // 2% energy per round
    };
    const defenderState = {
      hull_points: npc.hull_points,
      shield_points: npc.shield_points,
      attack_power: npc.attack_power,
      defense_rating: npc.defense_rating,
      speed: npc.speed,
      scanner_range: npc.scanner_range || 1,
      energy: 100, // NPCs have unlimited effective energy
      energy_per_round: 0
    };

    // Apply sector phenomena effects to combat
    try {
      const phenomenaService = require('./phenomenaService');
      const effects = await phenomenaService.applyPhenomenaEffects(ship.current_sector_id);
      if (effects.shield_recharge) {
        // Ion storm reduces starting shields
        attackerState.shield_points = Math.floor(attackerState.shield_points * (1 + effects.shield_recharge));
        defenderState.shield_points = Math.floor(defenderState.shield_points * (1 + effects.shield_recharge));
      }
      if (effects.weapon_bonus) {
        attackerState.attack_power = Math.floor(attackerState.attack_power * effects.weapon_bonus);
        defenderState.attack_power = Math.floor(defenderState.attack_power * effects.weapon_bonus);
      }
      if (effects.shield_disable_seconds) {
        attackerState.shield_points = 0;
        defenderState.shield_points = 0;
      }
      if (effects.flee_disabled) {
        attackerState.flee_disabled = true;
      }
    } catch (e) { /* phenomena failure should not block combat */ }

    for (let i = 1; i <= config.combat.maxRoundsPerBattle; i++) {
      const round = executeCombatRound(attackerState, defenderState, i);
      combatRounds.push(round);

      // Safely accumulate damage from combat actions
      if (round.actions && round.actions[0]) {
        totalAttackerDamage += round.actions[0].damage;
      }
      if (round.actions && round.actions[1]) {
        totalDefenderDamage += round.actions[1].damage;
      }

      if (round.attacker_destroyed || round.defender_destroyed) break;
    }

    // Determine winner
    let winner = null;
    if (defenderState.hull_points <= 0) winner = 'attacker';
    else if (attackerState.hull_points <= 0) winner = 'defender';
    else winner = 'draw';

    // Calculate rewards
    let creditsLooted = 0, experienceGained = 0;
    if (winner === 'attacker') {
      creditsLooted = npc.credits_carried;
      experienceGained = npc.experience_value;

      // Update NPC - destroyed
      await npc.update({
        is_alive: false,
        hull_points: 0,
        shield_points: 0,
        respawn_at: new Date(Date.now() + 5 * 60 * 1000) // 5 min respawn
      }, { transaction: t });

      // Award player
      const user = await User.findByPk(userId, { transaction: t, lock: t.LOCK.UPDATE });
      await user.update({ credits: user.credits + creditsLooted }, { transaction: t });

      // Phase 5: Award combat XP
      if (experienceGained > 0) {
        try {
          const progressionService = require('./progressionService');
          await progressionService.awardXP(userId, experienceGained, 'combat', t);
        } catch (e) { /* XP failure should not block combat */ }
      }
    } else {
      // NPC survived (won or draw) - save NPC's damaged state
      await npc.update({
        hull_points: Math.max(0, defenderState.hull_points),
        shield_points: Math.max(0, defenderState.shield_points),
        last_action_at: new Date()
      }, { transaction: t });
    }

    // Update ship state including energy consumed during combat
    await ship.update({
      hull_points: Math.max(0, attackerState.hull_points),
      shield_points: Math.max(0, attackerState.shield_points),
      energy: Math.max(0, attackerState.energy),
      in_combat: false
    }, { transaction: t });

    // If player ship destroyed
    if (winner === 'defender') {
      await ship.update({ is_active: false }, { transaction: t });
    }

    // Apply component degradation from combat and recalculate ship stats
    await maintenanceService.degradeComponents(shipId, combatRounds.length, t);
    await shipDesignerService.recalculateShipStats(ship, t);

    // Create combat log
    const combatLog = await CombatLog.create({
      attacker_ship_id: shipId,
      defender_npc_id: npcId,
      sector_id: ship.current_sector_id,
      combat_type: 'PVE',
      rounds_fought: combatRounds.length,
      winner_type: winner,
      attacker_damage_dealt: totalAttackerDamage,
      defender_damage_dealt: totalDefenderDamage,
      attacker_hull_remaining: attackerState.hull_points,
      defender_hull_remaining: defenderState.hull_points,
      credits_looted: creditsLooted,
      experience_gained: experienceGained,
      combat_rounds: combatRounds
    }, { transaction: t });

    await t.commit();

    // Phase 5: Update mission progress for combat kill (outside transaction)
    if (winner === 'attacker') {
      try {
        const missionService = require('./missionService');
        await missionService.updateMissionProgress(userId, 'combat_kill', { npc_id: npcId });
      } catch (e) { /* Mission progress failure should not block combat result */ }
    }

    return {
      success: true,
      combat_log_id: combatLog.combat_log_id,
      winner,
      rounds: combatRounds.length,
      combat_rounds: combatRounds,
      credits_looted: creditsLooted,
      experience_gained: experienceGained,
      ship_status: {
        hull: attackerState.hull_points,
        shields: attackerState.shield_points,
        destroyed: winner === 'defender'
      },
      target_status: {
        hull: defenderState.hull_points,
        shields: defenderState.shield_points,
        destroyed: winner === 'attacker'
      }
    };
  } catch (error) {
    await t.rollback();
    throw error;
  }
};

/**
 * Attempt to flee from combat
 */
const fleeFromCombat = async (userId, shipId) => {
  const ship = await Ship.findOne({
    where: { ship_id: shipId, owner_user_id: userId, is_active: true }
  });
  if (!ship) throw Object.assign(new Error('Ship not found'), { statusCode: 404 });

  // For simplicity, flee is always available outside active combat
  // In real-time combat, this would check combat state
  const fleeChance = config.combat.fleeChanceBase + (ship.speed * config.combat.fleeChancePerSpeedDiff);
  const fled = Math.random() < fleeChance;

  return { success: fled, message: fled ? 'Escaped successfully' : 'Failed to escape' };
};

/**
 * Get combat history for a player
 */
const getCombatHistory = async (userId, limit = 20) => {
  const ships = await Ship.findAll({ where: { owner_user_id: userId }, attributes: ['ship_id'] });
  const shipIds = ships.map(s => s.ship_id);

  const logs = await CombatLog.findAll({
    where: {
      [require('sequelize').Op.or]: [
        { attacker_ship_id: shipIds },
        { defender_ship_id: shipIds }
      ]
    },
    include: [
      { model: NPC, as: 'defenderNpc', attributes: ['name', 'npc_type'] },
      { model: Sector, as: 'sector', attributes: ['name'] }
    ],
    order: [['created_at', 'DESC']],
    limit
  });

  return logs;
};

/**
 * Regenerate shields for a ship (called over time or at port)
 */
const regenerateShields = async (shipId, fullRestore = false) => {
  const ship = await Ship.findByPk(shipId);
  if (!ship || !ship.is_active) return null;

  let newShields;
  if (fullRestore) {
    newShields = ship.max_shield_points;
  } else {
    // Partial regeneration based on time or recharge rate
    const regenAmount = Math.floor(ship.max_shield_points * 0.1); // 10% per call
    newShields = Math.min(ship.max_shield_points, ship.shield_points + regenAmount);
  }

  await ship.update({ shield_points: newShields });
  return { ship_id: shipId, shield_points: newShields, max_shield_points: ship.max_shield_points };
};

/**
 * Get combat statistics summary for a user's ships
 */
const getCombatSummary = async (userId) => {
  const ships = await Ship.findAll({
    where: { owner_user_id: userId },
    attributes: ['ship_id']
  });

  if (ships.length === 0) {
    return { total_battles: 0, wins: 0, losses: 0, draws: 0, total_damage_dealt: 0, total_damage_taken: 0 };
  }

  const shipIds = ships.map(s => s.ship_id);

  const logs = await CombatLog.findAll({
    where: { attacker_ship_id: { [require('sequelize').Op.in]: shipIds } }
  });

  const summary = {
    total_battles: logs.length,
    wins: logs.filter(l => l.winner_type === 'attacker').length,
    losses: logs.filter(l => l.winner_type === 'defender').length,
    draws: logs.filter(l => l.winner_type === 'draw').length,
    total_damage_dealt: logs.reduce((sum, l) => sum + l.attacker_damage_dealt, 0),
    total_damage_taken: logs.reduce((sum, l) => sum + l.defender_damage_dealt, 0),
    avg_rounds_per_battle: logs.length > 0
      ? Math.round(logs.reduce((sum, l) => sum + l.rounds_fought, 0) / logs.length)
      : 0
  };

  return summary;
};

module.exports = {
  calculateDamage,
  checkCriticalHit,
  applyDamage,
  calculateFleeChance,
  calculateScannerAccuracyBonus,
  executeCombatRound,
  attackNPC,
  fleeFromCombat,
  getCombatHistory,
  getCombatSummary,
  regenerateShields
};

