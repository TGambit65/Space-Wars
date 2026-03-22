const npcService = require('./npcService');
const npcPersonalityService = require('./npcPersonalityService');
const aiProviderFactory = require('./ai/aiProviderFactory');
const gameSettingsService = require('./gameSettingsService');
const { findSafestAdjacentSector } = require('./behaviorTreeService');

// ─── Decision Log (Ring Buffer) ──────────────────────────────────

const MAX_LOG_SIZE = 500;
const decisionLog = [];

const logDecision = (entry) => {
  decisionLog.push({
    timestamp: Date.now(),
    ...entry
  });
  if (decisionLog.length > MAX_LOG_SIZE) {
    decisionLog.shift();
  }
};

/**
 * Get recent decision log entries for admin panel.
 * @param {number} limit - Max entries to return
 * @param {number} offset - Start offset
 * @returns {{ entries: Array, total: number }}
 */
const getDecisionLog = (limit = 50, offset = 0) => {
  // Return newest-first
  const reversed = [...decisionLog].reverse();
  return {
    entries: reversed.slice(offset, offset + limit),
    total: decisionLog.length
  };
};

// ─── Action Executor ─────────────────────────────────────────────

/**
 * Execute an NPC's decided action.
 * All actions are wrapped in try-catch — errors logged, never crash.
 *
 * @param {Object} npc - NPC model instance
 * @param {Object} decision - Decision from behaviorTreeService: { action, target?, targetSectorId?, reason, needsAI }
 * @param {Object} context - Tick context: { adjacentSectors }
 * @param {Object|null} socketService - Socket.io service for events (null if not initialized)
 */
const executeAction = async (npc, decision, context = {}, socketService = null) => {
  const { action, target, targetSectorId, reason, was_ai = false, latency_ms = 0 } = decision;
  const oldSectorId = npc.current_sector_id;

  try {
    switch (action) {
      case 'move_toward_target':
      case 'patrol': {
        if (!targetSectorId) {
          await npc.update({ last_action_at: new Date() });
          break;
        }

        const oldMoveState = npc.behavior_state;
        let moved = false;
        try {
          moved = await npcService.moveNPC(npc.npc_id, targetSectorId);
        } catch (moveErr) {
          // Move failed — set NPC to idle to prevent repeated errors on the same bad target
          console.error(`[ActionExecutor] moveNPC failed for ${npc.name}: ${moveErr.message}`);
          await npc.update({ behavior_state: 'idle', last_action_at: new Date() });
          break;
        }
        if (moved) {
          const newMoveState = action === 'patrol' ? 'patrolling' : 'hunting';
          await npc.update({ behavior_state: newMoveState });

          if (socketService) {
            if (oldMoveState !== newMoveState) {
              socketService.emitToSector(targetSectorId, 'npc:state_change', {
                npc_id: npc.npc_id,
                name: npc.name,
                old_state: oldMoveState,
                new_state: newMoveState
              });
            }
            socketService.emitToSector(oldSectorId, 'npc:left_sector', {
              npc_id: npc.npc_id,
              name: npc.name,
              destination_name: targetSectorId
            });
            socketService.emitToSector(targetSectorId, 'npc:entered_sector', {
              npc_id: npc.npc_id,
              name: npc.name,
              npc_type: npc.npc_type,
              ship_type: npc.ship_type,
              behavior_state: newMoveState
            });
          }
        }
        break;
      }

      case 'attack_player':
      case 'finish_target': {
        if (context.hostileNpcsAllowed === false) {
          await npc.update({
            behavior_state: 'idle',
            target_ship_id: null,
            target_user_id: null,
            last_action_at: new Date()
          });
          break;
        }
        const oldState = npc.behavior_state;
        const targetUpdate = {
          behavior_state: 'engaging',
          last_action_at: new Date()
        };
        // Persist combat target for consistent targeting across ticks
        if (target) {
          targetUpdate.target_ship_id = target.ship_id || null;
          targetUpdate.target_user_id = target.owner_user_id || null;
        }
        await npc.update(targetUpdate);

        if (socketService) {
          if (oldState !== 'engaging') {
            socketService.emitToSector(npc.current_sector_id, 'npc:state_change', {
              npc_id: npc.npc_id,
              name: npc.name,
              old_state: oldState,
              new_state: 'engaging'
            });
          }
          if (target) {
            const targetUserId = target.owner_user_id;
            if (targetUserId) {
              socketService.emitToUser(targetUserId, 'npc:attacks_player', {
                npc_id: npc.npc_id,
                name: npc.name,
                npc_type: npc.npc_type,
                finishing_blow: action === 'finish_target'
              });
            }
          }
        }
        break;
      }

      case 'flee': {
        const fleeTarget = targetSectorId
          || findSafestAdjacentSector(context.adjacentSectors || []);
        const oldFleeMovState = npc.behavior_state;

        if (fleeTarget) {
          let moved = false;
          try {
            moved = await npcService.moveNPC(npc.npc_id, fleeTarget);
          } catch (moveErr) {
            console.error(`[ActionExecutor] flee moveNPC failed for ${npc.name}: ${moveErr.message}`);
            await npc.update({ behavior_state: 'fleeing', last_action_at: new Date() });
            break;
          }
          if (moved) {
            await npc.update({ behavior_state: 'fleeing' });

            if (socketService) {
              if (oldFleeMovState !== 'fleeing') {
                socketService.emitToSector(oldSectorId, 'npc:state_change', {
                  npc_id: npc.npc_id,
                  name: npc.name,
                  old_state: oldFleeMovState,
                  new_state: 'fleeing'
                });
              }
              socketService.emitToSector(oldSectorId, 'npc:left_sector', {
                npc_id: npc.npc_id,
                name: npc.name,
                destination_name: fleeTarget
              });
              socketService.emitToSector(fleeTarget, 'npc:entered_sector', {
                npc_id: npc.npc_id,
                name: npc.name,
                npc_type: npc.npc_type,
                ship_type: npc.ship_type,
                behavior_state: 'fleeing'
              });
            }
          }
        } else {
          // No escape route — just update state
          const oldFleeState = npc.behavior_state;
          await npc.update({ behavior_state: 'fleeing', last_action_at: new Date() });
          if (socketService && oldFleeState !== 'fleeing') {
            socketService.emitToSector(npc.current_sector_id, 'npc:state_change', {
              npc_id: npc.npc_id,
              name: npc.name,
              old_state: oldFleeState,
              new_state: 'fleeing'
            });
          }
        }
        break;
      }

      case 'trade': {
        const oldTradeState = npc.behavior_state;
        await npc.update({
          behavior_state: 'trading',
          last_action_at: new Date()
        });
        if (socketService && oldTradeState !== 'trading') {
          socketService.emitToSector(npc.current_sector_id, 'npc:state_change', {
            npc_id: npc.npc_id,
            name: npc.name,
            old_state: oldTradeState,
            new_state: 'trading'
          });
        }
        break;
      }

      case 'guard': {
        const oldGuardState = npc.behavior_state;
        await npc.update({
          behavior_state: 'guarding',
          last_action_at: new Date()
        });
        if (socketService && oldGuardState !== 'guarding') {
          socketService.emitToSector(npc.current_sector_id, 'npc:state_change', {
            npc_id: npc.npc_id,
            name: npc.name,
            old_state: oldGuardState,
            new_state: 'guarding'
          });
        }
        break;
      }

      case 'idle':
      default: {
        const oldIdleState = npc.behavior_state;
        const updates = { last_action_at: new Date() };
        if (action === 'idle' && oldIdleState !== 'idle') {
          updates.behavior_state = 'idle';
        }
        await npc.update(updates);
        if (socketService && action === 'idle' && oldIdleState !== 'idle') {
          socketService.emitToSector(npc.current_sector_id, 'npc:state_change', {
            npc_id: npc.npc_id,
            name: npc.name,
            old_state: oldIdleState,
            new_state: 'idle'
          });
        }
        break;
      }
    }

    // Log the decision (use targetSectorId for move actions since npc object has stale sector)
    const logSectorId = ['move_toward_target', 'patrol', 'flee'].includes(action) && targetSectorId
      ? targetSectorId
      : npc.current_sector_id;

    logDecision({
      npc_id: npc.npc_id,
      npc_name: npc.name,
      npc_type: npc.npc_type,
      action,
      reason,
      was_ai,
      latency_ms,
      sector_id: logSectorId
    });

  } catch (err) {
    console.error(`[ActionExecutor] Error executing ${action} for NPC ${npc.name}:`, err.message);
    logDecision({
      npc_id: npc.npc_id,
      npc_name: npc.name,
      npc_type: npc.npc_type,
      action,
      reason: `ERROR: ${err.message}`,
      was_ai,
      latency_ms,
      sector_id: npc.current_sector_id
    });
  }
};

// ─── AI Decision Executor ────────────────────────────────────────

/**
 * Get an AI-augmented decision for an NPC facing an ambiguous situation.
 * Falls back to the behavior tree's original decision if AI fails.
 *
 * @param {Object} npc - NPC model instance
 * @param {Object} context - Tick context (same as behaviorTreeService context)
 * @param {Object} fallbackDecision - The behavior tree's default decision to fall back to
 * @returns {Promise<Object>} Decision object: { action, target?, targetSectorId?, reason, needsAI: false }
 */
const executeAIDecision = async (npc, context, fallbackDecision) => {
  const start = Date.now();
  const personality = npc.ai_personality || {};

  try {
    const tacticalProvider = gameSettingsService.getSetting('ai_llm.tactical.provider', 'none');
    if (tacticalProvider === 'none') {
      return fallbackDecision;
    }

    const provider = aiProviderFactory.getProvider('tactical');
    if (!provider) return fallbackDecision;

    // Build tactical prompt
    const messages = npcPersonalityService.buildTacticalPrompt(npc, context, personality);
    const result = await provider.generateText(messages);
    const latencyMs = Date.now() - start;

    if (!result || !result.text) {
      return fallbackDecision;
    }

    // Parse AI response — expect JSON: { action, target_id?, reason }
    const parsed = parseAIResponse(result.text, context);

    if (parsed) {
      return {
        action: parsed.action,
        target: parsed.target || fallbackDecision.target,
        targetSectorId: parsed.targetSectorId || fallbackDecision.targetSectorId,
        reason: parsed.reason || 'AI decision',
        needsAI: false,
        was_ai: true,
        latency_ms: latencyMs
      };
    }
  } catch (err) {
    console.error(`[AIDecision] Error for NPC ${npc.name}:`, err.message);
  }

  // Fallback — pass latency through so executeAction logs it
  return {
    ...fallbackDecision,
    reason: `AI failed, fallback: ${fallbackDecision.reason}`,
    was_ai: false,
    latency_ms: Date.now() - start
  };
};

// ─── Helpers ─────────────────────────────────────────────────────

const ALLOWED_ACTIONS = new Set([
  'idle', 'patrol', 'move_toward_target', 'attack_player',
  'flee', 'trade', 'guard', 'finish_target'
]);

/**
 * Parse and validate AI response text into a decision object.
 * Expects JSON: { action: string, target_id?: string, reason?: string }
 * @param {string} text - Raw AI response
 * @param {Object} context - Tick context for target resolution
 * @returns {Object|null} Parsed decision or null if invalid
 */
const parseAIResponse = (text, context) => {
  try {
    // Try to extract JSON from response (might be wrapped in markdown code blocks)
    let jsonStr = text.trim();

    // Strip markdown code fences if present
    const jsonMatch = jsonStr.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (jsonMatch) {
      jsonStr = jsonMatch[1].trim();
    }

    // Try to find a JSON object in the response
    const objMatch = jsonStr.match(/\{[\s\S]*\}/);
    if (!objMatch) return null;

    const parsed = JSON.parse(objMatch[0]);

    // Validate action
    if (!parsed.action || !ALLOWED_ACTIONS.has(parsed.action)) {
      return null;
    }

    const result = {
      action: parsed.action,
      reason: typeof parsed.reason === 'string' ? parsed.reason.slice(0, 200) : undefined
    };

    // Resolve target_id to actual context objects
    if (parsed.target_id && context.playersInSector) {
      result.target = context.playersInSector.find(
        p => p.ship_id === parsed.target_id || p.owner_user_id === parsed.target_id
      );
    }

    // For movement actions, resolve to a sector
    if (['flee', 'move_toward_target', 'patrol'].includes(parsed.action)) {
      if (parsed.target_id && context.adjacentSectors) {
        const sector = context.adjacentSectors.find(s => s.sector_id === parsed.target_id);
        if (sector) {
          result.targetSectorId = sector.sector_id;
        }
      }
    }

    return result;
  } catch (err) {
    // JSON parse failure — expected for non-JSON AI responses
    return null;
  }
};

module.exports = {
  executeAction,
  executeAIDecision,
  getDecisionLog
};
