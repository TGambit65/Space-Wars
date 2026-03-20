const agentService = require('../services/agentService');

// POST /api/agents — Create agent account
async function createAgent(req, res) {
  try {
    const { name, ship_id, permissions, daily_credit_limit } = req.body;
    const { agent, apiKey } = await agentService.createAgent(req.userId, {
      name,
      shipId: ship_id,
      permissions,
      dailyCreditLimit: daily_credit_limit,
    });
    res.status(201).json({
      success: true,
      data: {
        agent: sanitizeAgent(agent),
        api_key: apiKey, // Shown only once
      },
      message: 'Agent created. Save the API key — it will not be shown again.',
    });
  } catch (error) {
    res.status(error.statusCode || 500).json({ success: false, message: error.message });
  }
}

// GET /api/agents — Get my agent
async function getAgent(req, res) {
  try {
    const agent = await agentService.getAgentByOwner(req.userId);
    if (!agent) {
      return res.status(404).json({ success: false, message: 'No agent account found.' });
    }
    res.json({ success: true, data: sanitizeAgent(agent) });
  } catch (error) {
    res.status(error.statusCode || 500).json({ success: false, message: error.message });
  }
}

// PUT /api/agents — Update agent config
async function updateAgent(req, res) {
  try {
    const { name, permissions, daily_credit_limit, rate_limit_per_minute, directive, directive_params, ship_id } = req.body;
    const agent = await agentService.updateAgent(req.userId, {
      name,
      permissions,
      dailyCreditLimit: daily_credit_limit,
      rateLimitPerMinute: rate_limit_per_minute,
      directive,
      directiveParams: directive_params,
      shipId: ship_id,
    });
    res.json({ success: true, data: sanitizeAgent(agent) });
  } catch (error) {
    res.status(error.statusCode || 500).json({ success: false, message: error.message });
  }
}

// POST /api/agents/status — Start/stop/pause agent
async function setStatus(req, res) {
  try {
    const { status } = req.body;
    const agent = await agentService.setAgentStatus(req.userId, status);
    res.json({ success: true, data: sanitizeAgent(agent) });
  } catch (error) {
    res.status(error.statusCode || 500).json({ success: false, message: error.message });
  }
}

// POST /api/agents/regenerate-key — Regenerate API key
async function regenerateKey(req, res) {
  try {
    const { agent, apiKey } = await agentService.regenerateApiKey(req.userId);
    res.json({
      success: true,
      data: {
        agent: sanitizeAgent(agent),
        api_key: apiKey,
      },
      message: 'New API key generated. Save it — it will not be shown again.',
    });
  } catch (error) {
    res.status(error.statusCode || 500).json({ success: false, message: error.message });
  }
}

// DELETE /api/agents — Delete agent account
async function deleteAgent(req, res) {
  try {
    await agentService.deleteAgent(req.userId);
    res.json({ success: true, message: 'Agent account deleted.' });
  } catch (error) {
    res.status(error.statusCode || 500).json({ success: false, message: error.message });
  }
}

// GET /api/agents/logs — Get action logs
async function getLogs(req, res) {
  try {
    const agent = await agentService.getAgentByOwner(req.userId);
    if (!agent) {
      return res.status(404).json({ success: false, message: 'No agent account found.' });
    }
    const { page, limit, action_type, result } = req.query;
    const data = await agentService.getOwnerActionLogs(req.userId, {
      page: parseInt(page) || 1,
      limit: Math.min(parseInt(limit) || 50, 200),
      actionType: action_type,
      result,
    });
    res.json({ success: true, data });
  } catch (error) {
    res.status(error.statusCode || 500).json({ success: false, message: error.message });
  }
}

// --- Agent API key endpoints (called by external agents) ---

// GET /api/agents/me — Agent self-info (called via API key)
async function agentSelf(req, res) {
  try {
    res.json({
      success: true,
      data: {
        agent_id: req.agent.agent_id,
        name: req.agent.name,
        status: req.agent.status,
        directive: req.agent.directive,
        directive_params: req.agent.directive_params,
        permissions: req.agent.permissions,
        ship_id: req.agent.ship_id,
        owner_id: req.agent.owner_id,
        daily_credit_limit: req.agent.daily_credit_limit,
        daily_credits_spent: req.agent.daily_credits_spent,
        rate_limit_per_minute: req.agent.rate_limit_per_minute,
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
}

function sanitizeAgent(agent) {
  const data = agent.toJSON();
  delete data.api_key_hash;
  return data;
}

module.exports = {
  createAgent,
  getAgent,
  updateAgent,
  setStatus,
  regenerateKey,
  deleteAgent,
  getLogs,
  agentSelf,
};
