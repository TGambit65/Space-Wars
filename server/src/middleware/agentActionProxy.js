const agentService = require('../services/agentService');

/**
 * Factory that creates middleware to gate agent actions through permission/budget/rate checks.
 *
 * Usage in routes:
 *   router.post('/navigate', agentAuthMiddleware, agentAction('navigate', 'navigate'), sectorController.navigate);
 *
 * @param {string} actionFamily - Permission family (navigate, trade, scan, dock, combat, etc.)
 * @param {string} actionType - Specific action name for logging (navigate, buy, sell, scan, etc.)
 * @param {object} [opts]
 * @param {function} [opts.getCreditsDelta] - (req) => number, returns credits delta for budget tracking
 * @param {function} [opts.getTarget] - (req) => string, returns target entity for logging
 */
function agentAction(actionFamily, actionType, opts = {}) {
  return async (req, res, next) => {
    // Skip if this isn't an agent request (regular player JWT auth)
    if (!req.isAgent) {
      return next();
    }

    const agent = req.agent;
    const creditsDelta = opts.getCreditsDelta ? opts.getCreditsDelta(req) : 0;
    const targetEntity = opts.getTarget ? opts.getTarget(req) : (req.params.id || req.body.sector_id || null);

    try {
      const result = await agentService.executeAction(agent.agent_id, {
        actionType,
        actionFamily,
        targetEntity: targetEntity ? String(targetEntity) : null,
        creditsDelta,
        details: {
          method: req.method,
          path: req.originalUrl,
          body_keys: Object.keys(req.body || {}),
        },
      });

      if (!result.allowed) {
        return res.status(403).json({
          success: false,
          message: `Agent action blocked: ${result.reason}`,
          agent_log_id: result.log.log_id,
        });
      }

      // Attach log for downstream use if needed
      req.agentActionLog = result.log;
      next();
    } catch (error) {
      console.error('Agent action proxy error:', error);
      return res.status(500).json({ success: false, message: 'Agent action proxy error.' });
    }
  };
}

module.exports = { agentAction };
