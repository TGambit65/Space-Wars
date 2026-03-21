const agentService = require('../../src/services/agentService');
const { agentAction } = require('../../src/middleware/agentActionProxy');

const makeRes = () => {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
};

describe('agentAction middleware factory', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('skips entirely for non-agent requests', async () => {
    const middleware = agentAction('scan', 'get_ship');
    const req = {
      isAgent: false,
      body: {},
      params: {},
      originalUrl: '/api/agent-api/ship',
      method: 'GET',
    };
    const res = makeRes();
    const next = jest.fn();
    const executeSpy = jest.spyOn(agentService, 'executeAction');

    await middleware(req, res, next);

    expect(executeSpy).not.toHaveBeenCalled();
    expect(next).toHaveBeenCalledTimes(1);
  });

  it('allows an action, attaches req.agentActionLog, and calls next', async () => {
    const middleware = agentAction('scan', 'get_ship');
    const log = { log_id: 'log-1', result: 'allowed' };
    jest.spyOn(agentService, 'executeAction').mockResolvedValue({ allowed: true, log });
    const req = {
      isAgent: true,
      agent: { agent_id: 'agent-1' },
      body: {},
      params: {},
      originalUrl: '/api/agent-api/ship',
      method: 'GET',
    };
    const res = makeRes();
    const next = jest.fn();

    await middleware(req, res, next);

    expect(req.agentActionLog).toBe(log);
    expect(next).toHaveBeenCalledTimes(1);
    expect(res.status).not.toHaveBeenCalled();
  });

  it('returns 403 with the agent log id when permission is denied', async () => {
    const middleware = agentAction('trade', 'buy');
    jest.spyOn(agentService, 'executeAction').mockResolvedValue({
      allowed: false,
      reason: 'Permission denied: trade',
      log: { log_id: 'log-denied' },
    });
    const req = {
      isAgent: true,
      agent: { agent_id: 'agent-1' },
      body: {},
      params: {},
      originalUrl: '/api/agent-api/trade/buy',
      method: 'POST',
    };
    const res = makeRes();
    const next = jest.fn();

    await middleware(req, res, next);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith({
      success: false,
      message: 'Agent action blocked: Permission denied: trade',
      agent_log_id: 'log-denied',
    });
    expect(next).not.toHaveBeenCalled();
  });

  it('returns 403 when the action is rate limited', async () => {
    const middleware = agentAction('scan', 'get_ship');
    jest.spyOn(agentService, 'executeAction').mockResolvedValue({
      allowed: false,
      reason: 'Rate limit exceeded',
      log: { log_id: 'log-rate-limit' },
    });
    const req = {
      isAgent: true,
      agent: { agent_id: 'agent-1' },
      body: {},
      params: {},
      originalUrl: '/api/agent-api/ship',
      method: 'GET',
    };
    const res = makeRes();

    await middleware(req, res, jest.fn());

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith({
      success: false,
      message: 'Agent action blocked: Rate limit exceeded',
      agent_log_id: 'log-rate-limit',
    });
  });

  it('returns 403 when the action would exceed budget', async () => {
    const middleware = agentAction('trade', 'buy');
    jest.spyOn(agentService, 'executeAction').mockResolvedValue({
      allowed: false,
      reason: 'Daily budget exceeded',
      log: { log_id: 'log-budget' },
    });
    const req = {
      isAgent: true,
      agent: { agent_id: 'agent-1' },
      body: { commodity_id: 'commodity-1', quantity: 5 },
      params: {},
      originalUrl: '/api/agent-api/trade/buy',
      method: 'POST',
    };
    const res = makeRes();

    await middleware(req, res, jest.fn());

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith({
      success: false,
      message: 'Agent action blocked: Daily budget exceeded',
      agent_log_id: 'log-budget',
    });
  });

  it('returns 403 when the agent is stopped', async () => {
    const middleware = agentAction('navigate', 'navigate');
    jest.spyOn(agentService, 'executeAction').mockResolvedValue({
      allowed: false,
      reason: 'Agent is stopped',
      log: { log_id: 'log-stopped' },
    });
    const req = {
      isAgent: true,
      agent: { agent_id: 'agent-1' },
      body: { target_sector_id: 'sector-2' },
      params: {},
      originalUrl: '/api/agent-api/navigate',
      method: 'POST',
    };
    const res = makeRes();

    await middleware(req, res, jest.fn());

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith({
      success: false,
      message: 'Agent action blocked: Agent is stopped',
      agent_log_id: 'log-stopped',
    });
  });

  it('passes the correct action family, type, target, credits delta, and request metadata', async () => {
    const middleware = agentAction('trade', 'buy', {
      getTarget: (req) => req.body.commodity_id,
      getCreditsDelta: (req) => -(req.body.quantity * 5),
    });
    const executeSpy = jest.spyOn(agentService, 'executeAction').mockResolvedValue({
      allowed: true,
      log: { log_id: 'log-allow' },
    });
    const req = {
      isAgent: true,
      agent: { agent_id: 'agent-42' },
      body: { commodity_id: 'commodity-7', quantity: 3, port_id: 'port-9' },
      params: {},
      originalUrl: '/api/agent-api/trade/buy',
      method: 'POST',
    };
    const res = makeRes();
    const next = jest.fn();

    await middleware(req, res, next);

    expect(executeSpy).toHaveBeenCalledWith('agent-42', {
      actionType: 'buy',
      actionFamily: 'trade',
      targetEntity: 'commodity-7',
      creditsDelta: -15,
      details: {
        method: 'POST',
        path: '/api/agent-api/trade/buy',
        body_keys: ['commodity_id', 'quantity', 'port_id'],
      },
    });
    expect(next).toHaveBeenCalledTimes(1);
  });

  it('falls back to req.body.sector_id when no getTarget callback is provided', async () => {
    const middleware = agentAction('navigate', 'navigate');
    const executeSpy = jest.spyOn(agentService, 'executeAction').mockResolvedValue({
      allowed: true,
      log: { log_id: 'log-default-target' },
    });
    const req = {
      isAgent: true,
      agent: { agent_id: 'agent-77' },
      body: { sector_id: 'sector-11' },
      params: {},
      originalUrl: '/api/agent-api/sector',
      method: 'GET',
    };
    const res = makeRes();

    await middleware(req, res, jest.fn());

    expect(executeSpy).toHaveBeenCalledWith('agent-77', expect.objectContaining({
      targetEntity: 'sector-11',
    }));
  });
});
