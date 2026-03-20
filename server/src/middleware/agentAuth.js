const agentService = require('../services/agentService');
const { User } = require('../models');

/**
 * Agent authentication middleware for external API key auth.
 * Expects header: Authorization: Bearer sw3k_agent_<key>
 *
 * On success, attaches:
 *   req.agent    — AgentAccount instance
 *   req.user     — Owner User instance
 *   req.userId   — Owner user_id (so existing services work transparently)
 *   req.isAgent  — true (flag for downstream logic)
 */
const agentAuthMiddleware = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ success: false, message: 'No authorization token provided.' });
    }

    const token = authHeader.slice(7);

    // Only handle agent API keys (sw3k_agent_ prefix)
    if (!token.startsWith('sw3k_agent_')) {
      return res.status(401).json({ success: false, message: 'Invalid agent API key format.' });
    }

    const agent = await agentService.getAgentByApiKey(token);
    if (!agent) {
      return res.status(401).json({ success: false, message: 'Invalid agent API key.' });
    }

    if (agent.status !== 'active') {
      return res.status(403).json({ success: false, message: `Agent is ${agent.status}. Only active agents can make API calls.` });
    }

    // Load the owner user so existing services can use req.user / req.userId
    const owner = await User.findByPk(agent.owner_id);
    if (!owner) {
      return res.status(401).json({ success: false, message: 'Agent owner account not found.' });
    }

    req.agent = agent;
    req.user = owner;
    req.userId = owner.user_id;
    req.isAgent = true;

    next();
  } catch (error) {
    console.error('Agent auth middleware error:', error);
    return res.status(500).json({ success: false, message: 'Internal server error during agent authentication.' });
  }
};

module.exports = { agentAuthMiddleware };
