const combatService = require('../services/combatService');

/**
 * Attack an NPC
 */
const attackNPC = async (req, res, next) => {
  try {
    const userId = req.user.user_id;
    const { shipId } = req.params;
    const { npc_id } = req.body;

    if (!npc_id) {
      return res.status(400).json({ success: false, error: 'npc_id required' });
    }

    const result = await combatService.attackNPC(userId, shipId, npc_id);
    res.json(result);
  } catch (error) {
    next(error);
  }
};

/**
 * Attempt to flee from combat
 */
const flee = async (req, res, next) => {
  try {
    const userId = req.user.user_id;
    const { shipId } = req.params;
    const result = await combatService.fleeFromCombat(userId, shipId);
    res.json(result);
  } catch (error) {
    next(error);
  }
};

/**
 * Get combat history
 */
const getCombatHistory = async (req, res, next) => {
  try {
    const userId = req.user.user_id;
    const { limit } = req.query;
    const logs = await combatService.getCombatHistory(userId, limit ? parseInt(limit) : 20);
    res.json({ success: true, combat_logs: logs });
  } catch (error) {
    next(error);
  }
};

/**
 * Get specific combat log details
 */
const getCombatLog = async (req, res, next) => {
  try {
    const userId = req.user.user_id;
    const { combatLogId } = req.params;
    const { CombatLog, Ship, NPC, Sector } = require('../models');

    const log = await CombatLog.findByPk(combatLogId, {
      include: [
        { model: Ship, as: 'attackerShip', attributes: ['ship_id', 'name', 'ship_type', 'owner_user_id'] },
        { model: Ship, as: 'defenderShip', attributes: ['ship_id', 'name', 'ship_type', 'owner_user_id'] },
        { model: NPC, as: 'attackerNpc', attributes: ['npc_id', 'name', 'npc_type'] },
        { model: NPC, as: 'defenderNpc', attributes: ['npc_id', 'name', 'npc_type'] },
        { model: Sector, as: 'sector', attributes: ['sector_id', 'name'] }
      ]
    });

    if (!log) {
      return res.status(404).json({ success: false, error: 'Combat log not found' });
    }

    // Verify ownership - user must own either the attacker or defender ship
    // For PVE logs, only attacker_ship_id is set (defender is NPC)
    // For PVP logs, both attacker and defender ships could be player ships
    const isOwner = (log.attackerShip && log.attackerShip.owner_user_id === userId) ||
                    (log.defenderShip && log.defenderShip.owner_user_id === userId);

    // If neither ship is owned by the user, deny access
    // Note: For PVE (player vs NPC), attackerShip should always be set for player attacks
    if (!isOwner) {
      return res.status(403).json({ success: false, error: 'Access denied to this combat log' });
    }

    res.json({ success: true, combat_log: log });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  attackNPC,
  flee,
  getCombatHistory,
  getCombatLog
};

