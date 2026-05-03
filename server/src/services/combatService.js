/**
 * combatService — historical/statistics helpers only.
 *
 * The full auto-resolve combat path (attackNPC, fleeFromCombat, executeCombatRound,
 * applyDamage) was removed when Task #4 unified all live combat under
 * realtimeCombatService.js. Calculation primitives (damage formula, crit chance,
 * flee chance, scanner accuracy) remain here for reuse by other systems
 * (e.g. boarding, faction war scoring previews) and for combat history queries.
 */
const config = require('../config');
const { Ship, NPC, CombatLog, Sector } = require('../models');

// ─── Pure Combat Math ─────────────────────────────────────────────
const calculateDamage = (attackPower, defenseRating) => {
  const baseDamage = attackPower * (1 - defenseRating / (defenseRating + config.combat.defenseScalingConstant));
  return Math.max(1, Math.floor(baseDamage));
};

const checkCriticalHit = () => Math.random() < config.combat.criticalHitChance;

const calculateFleeChance = (attackerSpeed, defenderSpeed) => {
  const speedDiff = attackerSpeed - defenderSpeed;
  return Math.min(0.95, Math.max(0.05,
    config.combat.fleeChanceBase + (speedDiff * config.combat.fleeChancePerSpeedDiff)
  ));
};

const calculateScannerAccuracyBonus = (attacker, defender) => {
  const attackerScanner = attacker.scanner_range || 1;
  const defenderScanner = defender.scanner_range || 1;
  const scannerAdvantage = attackerScanner - defenderScanner;
  return 1.0 + (scannerAdvantage * 0.05);
};

// ─── Combat History / Stats ───────────────────────────────────────
const getCombatHistory = async (userId, limit = 20) => {
  const ships = await Ship.findAll({ where: { owner_user_id: userId }, attributes: ['ship_id'] });
  const shipIds = ships.map(s => s.ship_id);
  const { Op } = require('sequelize');
  return CombatLog.findAll({
    where: {
      [Op.or]: [
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
};

const regenerateShields = async (shipId, fullRestore = false) => {
  const ship = await Ship.findByPk(shipId);
  if (!ship || !ship.is_active) return null;
  const newShields = fullRestore
    ? ship.max_shield_points
    : Math.min(ship.max_shield_points, ship.shield_points + Math.floor(ship.max_shield_points * 0.1));
  await ship.update({ shield_points: newShields });
  return { ship_id: shipId, shield_points: newShields, max_shield_points: ship.max_shield_points };
};

const getCombatSummary = async (userId) => {
  const ships = await Ship.findAll({ where: { owner_user_id: userId }, attributes: ['ship_id'] });
  if (ships.length === 0) {
    return { total_battles: 0, wins: 0, losses: 0, draws: 0, total_damage_dealt: 0, total_damage_taken: 0 };
  }
  const { Op } = require('sequelize');
  const shipIds = ships.map(s => s.ship_id);
  const logs = await CombatLog.findAll({
    where: { attacker_ship_id: { [Op.in]: shipIds } }
  });
  return {
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
};

module.exports = {
  calculateDamage,
  checkCriticalHit,
  calculateFleeChance,
  calculateScannerAccuracyBonus,
  getCombatHistory,
  getCombatSummary,
  regenerateShields
};
