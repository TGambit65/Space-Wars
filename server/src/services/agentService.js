const { AgentAccount, AgentActionLog, Ship, User } = require('../models');

const VALID_PERMISSIONS = ['navigate', 'trade', 'scan', 'dock', 'combat', 'colony', 'fleet', 'social'];

function validatePermissions(perms) {
  if (!perms || typeof perms !== 'object') return;
  const cleaned = {};
  for (const key of VALID_PERMISSIONS) {
    cleaned[key] = Boolean(perms[key]);
  }
  return cleaned;
}

/**
 * Create an agent account for a player. One agent per player.
 */
async function createAgent(ownerId, { name = 'Agent', shipId = null, permissions, dailyCreditLimit } = {}) {
  const existing = await AgentAccount.findOne({ where: { owner_id: ownerId } });
  if (existing) {
    const err = new Error('You already have an agent account');
    err.statusCode = 409;
    throw err;
  }

  // If a ship is specified, verify it belongs to the owner
  if (shipId) {
    const ship = await Ship.findOne({ where: { ship_id: shipId, owner_user_id: ownerId } });
    if (!ship) {
      const err = new Error('Ship not found or does not belong to you');
      err.statusCode = 404;
      throw err;
    }
  }

  const agent = await AgentAccount.create({
    owner_id: ownerId,
    ship_id: shipId,
    name,
    ...(permissions && { permissions: validatePermissions(permissions) }),
    ...(dailyCreditLimit != null && { daily_credit_limit: dailyCreditLimit }),
  });

  // Generate and return the API key (shown once)
  const rawKey = agent.generateApiKey();
  await agent.save();

  return { agent, apiKey: rawKey };
}

/**
 * Get agent account for a player (with optional action log stats).
 */
async function getAgentByOwner(ownerId) {
  const agent = await AgentAccount.findOne({
    where: { owner_id: ownerId },
    include: [{ model: Ship, as: 'ship', attributes: ['ship_id', 'name', 'ship_type', 'current_sector_id'] }],
  });
  return agent;
}

/**
 * Get agent by ID (for internal use / middleware).
 */
async function getAgentById(agentId) {
  return AgentAccount.findByPk(agentId);
}

/**
 * Find an agent by API key (for authentication).
 */
async function getAgentByApiKey(apiKey) {
  const prefix = apiKey.slice(0, 8);
  const candidates = await AgentAccount.findAll({
    where: { api_key_prefix: prefix },
  });
  for (const agent of candidates) {
    if (agent.verifyApiKey(apiKey)) {
      return agent;
    }
  }
  return null;
}

/**
 * Update agent configuration.
 */
async function updateAgent(ownerId, updates) {
  const agent = await AgentAccount.findOne({ where: { owner_id: ownerId } });
  if (!agent) {
    const err = new Error('No agent account found');
    err.statusCode = 404;
    throw err;
  }

  if (updates.name != null) agent.name = updates.name;
  if (updates.permissions != null) agent.permissions = validatePermissions(updates.permissions);
  if (updates.dailyCreditLimit != null) agent.daily_credit_limit = updates.dailyCreditLimit;
  if (updates.rateLimitPerMinute != null) agent.rate_limit_per_minute = updates.rateLimitPerMinute;
  if (updates.directive != null) agent.directive = updates.directive;
  if (updates.directiveParams != null) agent.directive_params = updates.directiveParams;

  // Ship assignment
  if (updates.shipId !== undefined) {
    if (updates.shipId) {
      const ship = await Ship.findOne({ where: { ship_id: updates.shipId, owner_user_id: ownerId } });
      if (!ship) {
        const err = new Error('Ship not found or does not belong to you');
        err.statusCode = 404;
        throw err;
      }
    }
    agent.ship_id = updates.shipId || null;
  }

  await agent.save();
  return agent;
}

/**
 * Start or stop an agent.
 */
async function setAgentStatus(ownerId, status) {
  const agent = await AgentAccount.findOne({ where: { owner_id: ownerId } });
  if (!agent) {
    const err = new Error('No agent account found');
    err.statusCode = 404;
    throw err;
  }

  if (!['active', 'stopped', 'paused'].includes(status)) {
    const err = new Error('Invalid status');
    err.statusCode = 400;
    throw err;
  }

  agent.status = status;
  if (status === 'active') {
    agent.error_message = null;
  }
  await agent.save();
  return agent;
}

/**
 * Regenerate API key. Returns the new raw key (shown once).
 */
async function regenerateApiKey(ownerId) {
  const agent = await AgentAccount.findOne({ where: { owner_id: ownerId } });
  if (!agent) {
    const err = new Error('No agent account found');
    err.statusCode = 404;
    throw err;
  }

  const rawKey = agent.generateApiKey();
  await agent.save();
  return { agent, apiKey: rawKey };
}

/**
 * Delete an agent account.
 */
async function deleteAgent(ownerId) {
  const agent = await AgentAccount.findOne({ where: { owner_id: ownerId } });
  if (!agent) {
    const err = new Error('No agent account found');
    err.statusCode = 404;
    throw err;
  }

  // Delete action logs first
  await AgentActionLog.destroy({ where: { agent_id: agent.agent_id } });
  await agent.destroy();
  return true;
}

/**
 * Log an agent action and enforce permission/budget/rate checks.
 * Returns { allowed: true, log } or { allowed: false, reason, log }.
 */
async function executeAction(agentId, { actionType, actionFamily, targetEntity, creditsDelta = 0, details = {} }) {
  const agent = await AgentAccount.findByPk(agentId);
  if (!agent) {
    const err = new Error('Agent not found');
    err.statusCode = 404;
    throw err;
  }

  if (agent.status !== 'active') {
    const log = await AgentActionLog.create({
      agent_id: agentId,
      owner_id: agent.owner_id,
      action_type: actionType,
      action_family: actionFamily,
      target_entity: targetEntity,
      result: 'denied',
      credits_delta: 0,
      details: { ...details, reason: `Agent is ${agent.status}` },
    });
    return { allowed: false, reason: `Agent is ${agent.status}`, log };
  }

  // Permission check
  if (!agent.hasPermission(actionFamily)) {
    const log = await AgentActionLog.create({
      agent_id: agentId,
      owner_id: agent.owner_id,
      action_type: actionType,
      action_family: actionFamily,
      target_entity: targetEntity,
      result: 'denied',
      details: { ...details, reason: `Permission denied: ${actionFamily}` },
    });
    return { allowed: false, reason: `Permission denied: ${actionFamily}`, log };
  }

  // Rate limit check
  if (!agent.checkRateLimit()) {
    const log = await AgentActionLog.create({
      agent_id: agentId,
      owner_id: agent.owner_id,
      action_type: actionType,
      action_family: actionFamily,
      target_entity: targetEntity,
      result: 'rate_limited',
      details,
    });
    await agent.save();
    return { allowed: false, reason: 'Rate limit exceeded', log };
  }

  // Budget check (only for spending actions)
  if (creditsDelta < 0 && !agent.checkBudget(Math.abs(creditsDelta))) {
    const log = await AgentActionLog.create({
      agent_id: agentId,
      owner_id: agent.owner_id,
      action_type: actionType,
      action_family: actionFamily,
      target_entity: targetEntity,
      result: 'budget_exceeded',
      details: { ...details, attempted_spend: Math.abs(creditsDelta) },
    });
    await agent.save();
    return { allowed: false, reason: 'Daily budget exceeded', log };
  }

  // Action allowed — log and update telemetry
  const log = await AgentActionLog.create({
    agent_id: agentId,
    owner_id: agent.owner_id,
    action_type: actionType,
    action_family: actionFamily,
    target_entity: targetEntity,
    result: 'allowed',
    credits_delta: creditsDelta,
    details,
  });

  agent.last_action_at = new Date();
  agent.last_action_type = actionType;
  agent.total_actions = (parseInt(agent.total_actions) || 0) + 1;
  if (creditsDelta > 0) {
    agent.total_credits_earned = (parseInt(agent.total_credits_earned) || 0) + creditsDelta;
  } else if (creditsDelta < 0) {
    agent.total_credits_spent = (parseInt(agent.total_credits_spent) || 0) + Math.abs(creditsDelta);
    agent.daily_credits_spent = (parseInt(agent.daily_credits_spent) || 0) + Math.abs(creditsDelta);
  }
  await agent.save();

  return { allowed: true, log };
}

/**
 * Get recent action logs for an agent.
 */
async function getActionLogs(agentId, { page = 1, limit = 50 } = {}) {
  const offset = (page - 1) * limit;
  const { count, rows } = await AgentActionLog.findAndCountAll({
    where: { agent_id: agentId },
    order: [['created_at', 'DESC']],
    limit,
    offset,
  });
  return { logs: rows, total: count, page, pages: Math.ceil(count / limit) };
}

/**
 * Get action logs for an owner (all their agents).
 */
async function getOwnerActionLogs(ownerId, { page = 1, limit = 50, actionType, result } = {}) {
  const where = { owner_id: ownerId };
  if (actionType) where.action_type = actionType;
  if (result) where.result = result;

  const offset = (page - 1) * limit;
  const { count, rows } = await AgentActionLog.findAndCountAll({
    where,
    order: [['created_at', 'DESC']],
    limit,
    offset,
  });
  return { logs: rows, total: count, page, pages: Math.ceil(count / limit) };
}

module.exports = {
  createAgent,
  getAgentByOwner,
  getAgentById,
  getAgentByApiKey,
  updateAgent,
  setAgentStatus,
  regenerateApiKey,
  deleteAgent,
  executeAction,
  getActionLogs,
  getOwnerActionLogs,
};
