const combatService = require('../services/combatService');
const realtimeCombatService = require('../services/realtimeCombatService');
const combatPolicyService = require('../services/combatPolicyService');

/**
 * Get combat history (read-only — auto-resolve and instant flee endpoints removed in v2;
 * all live engagements now go through the realtime combat service).
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

    if (!log) return res.status(404).json({ success: false, error: 'Combat log not found' });

    const isOwner = (log.attackerShip && log.attackerShip.owner_user_id === userId)
      || (log.defenderShip && log.defenderShip.owner_user_id === userId);
    if (!isOwner) return res.status(403).json({ success: false, error: 'Access denied to this combat log' });

    res.json({ success: true, combat_log: log });
  } catch (error) {
    next(error);
  }
};

const initiateRealtimeCombatNPC = async (req, res) => {
  try {
    const { shipId } = req.params;
    const { npcId } = req.body;
    if (!npcId) return res.status(400).json({ success: false, message: 'npcId is required' });
    const combatId = await realtimeCombatService.initiateNPCCombat(shipId, npcId, req.userId);
    res.json({ success: true, data: { combat_id: combatId } });
  } catch (error) {
    res.status(error.statusCode || 500).json({ success: false, message: error.message });
  }
};

const initiateRealtimeCombatPVP = async (req, res) => {
  try {
    const { shipId } = req.params;
    const { defenderShipId } = req.body;
    if (!defenderShipId) return res.status(400).json({ success: false, message: 'defenderShipId is required' });

    await combatPolicyService.authorizePvpInitiation({
      attackerShipId: shipId,
      defenderShipId,
      attackerUserId: req.userId,
      req
    });

    const combatId = await realtimeCombatService.initiatePlayerCombat(shipId, defenderShipId, req.userId);
    res.json({ success: true, data: { combat_id: combatId } });
  } catch (error) {
    res.status(error.statusCode || 500).json({ success: false, message: error.message });
  }
};

const getRealtimeCombatState = async (req, res) => {
  try {
    const { combatId } = req.params;
    const state = realtimeCombatService.getCombatState(combatId);
    if (!state) return res.status(404).json({ success: false, message: 'No active combat found' });
    // Participant-only access — spectator mode is not yet implemented.
    const isParticipant = Array.isArray(state.ships)
      && state.ships.some(s => !s.isNPC && s.ownerId && s.ownerId === req.userId);
    if (!isParticipant) {
      return res.status(403).json({ success: false, message: 'You are not a participant in this combat' });
    }
    res.json({ success: true, data: state });
  } catch (error) {
    res.status(error.statusCode || 500).json({ success: false, message: error.message });
  }
};

module.exports = {
  getCombatHistory,
  getCombatLog,
  initiateRealtimeCombatNPC,
  initiateRealtimeCombatPVP,
  getRealtimeCombatState
};
