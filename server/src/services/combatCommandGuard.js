const config = require('../config');

const commandState = new Map();

const getActorKey = ({ actorId, socketId }) => actorId || socketId || null;

const getKey = ({ actorId, socketId, combatId, shipId }) => {
  const actorKey = getActorKey({ actorId, socketId });
  return actorKey ? `${actorKey}:${combatId}:${shipId}` : null;
};

const resetCombatCommandGuardState = () => {
  commandState.clear();
};

const clearCombatCommandSocketState = (socketId) => {
  if (!socketId) return;
  for (const key of commandState.keys()) {
    if (key.startsWith(`${socketId}:`)) {
      commandState.delete(key);
    }
  }
};

const evaluateCombatCommand = ({
  actorId = null,
  socketId,
  combatId,
  shipId,
  sequence = null,
  now = Date.now()
} = {}) => {
  const key = getKey({ actorId, socketId, combatId, shipId });
  if (!key || !combatId || !shipId) {
    return { allowed: false, status: 'deny', reason: 'invalid_command_context' };
  }

  const windowMs = config.antiCheat.combatCommandWindowMs;
  const maxCommands = config.antiCheat.combatCommandsPerWindow;
  let state = commandState.get(key);

  if (!state || now >= state.resetAt) {
    state = {
      count: 0,
      resetAt: now + windowMs,
      lastSequence: null
    };
    commandState.set(key, state);
  }

  if (sequence !== null && sequence !== undefined) {
    const normalizedSequence = Number.parseInt(sequence, 10);
    if (Number.isNaN(normalizedSequence)) {
      return { allowed: false, status: 'deny', reason: 'invalid_sequence' };
    }
    if (state.lastSequence !== null && normalizedSequence <= state.lastSequence) {
      return { allowed: false, status: 'deny', reason: 'stale_sequence' };
    }
    state.lastSequence = normalizedSequence;
  }

  state.count += 1;
  if (state.count > maxCommands) {
    return { allowed: false, status: 'throttle', reason: 'combat_command_rate_limited' };
  }

  return { allowed: true, status: 'allow', reason: null };
};

module.exports = {
  evaluateCombatCommand,
  resetCombatCommandGuardState,
  clearCombatCommandSocketState
};
