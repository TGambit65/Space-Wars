const { User } = require('../../src/models');
const { agentAuthMiddleware } = require('../../src/middleware/agentAuth');
const {
  createTestUser,
  createTestSector,
  createTestShip,
  createTestAgentWithKey,
  cleanDatabase,
} = require('../helpers');

const uniqueSeed = (prefix = 'test') => `${prefix.replace(/[^a-zA-Z0-9]/g, '')}${Date.now()}${Math.floor(Math.random() * 1_000_000)}`;
const createUniqueUser = (prefix, overrides = {}) => {
  const seed = uniqueSeed(prefix);
  return createTestUser({ username: seed, email: `${seed}@example.com`, ...overrides });
};

const makeRes = () => {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
};

describe('agentAuthMiddleware', () => {
  let owner;
  let sector;
  let ship;
  let activeApiKey;
  let stoppedApiKey;
  let pausedApiKey;

  beforeEach(async () => {
    await cleanDatabase();
    sector = await createTestSector({ name: uniqueSeed('sector') });
    owner = await createUniqueUser('owner');
    ship = await createTestShip(owner.user_id, sector.sector_id, { name: uniqueSeed('ship') });

    ({ apiKey: activeApiKey } = await createTestAgentWithKey(owner.user_id, {
      ship_id: ship.ship_id,
      status: 'active',
    }));
    ({ apiKey: stoppedApiKey } = await createTestAgentWithKey((await createUniqueUser('stopped-owner')).user_id, {
      status: 'stopped',
    }));
    ({ apiKey: pausedApiKey } = await createTestAgentWithKey((await createUniqueUser('paused-owner')).user_id, {
      status: 'paused',
    }));
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('returns 401 when the Authorization header is missing', async () => {
    const req = { headers: {} };
    const res = makeRes();
    const next = jest.fn();

    await agentAuthMiddleware(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ success: false, message: 'No authorization token provided.' });
    expect(next).not.toHaveBeenCalled();
  });

  it('returns 401 for a bearer token that is not an agent API key', async () => {
    const req = { headers: { authorization: 'Bearer regular-user-token' } };
    const res = makeRes();
    const next = jest.fn();

    await agentAuthMiddleware(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ success: false, message: 'Invalid agent API key format.' });
    expect(next).not.toHaveBeenCalled();
  });

  it('authenticates a valid active agent and populates req.agent, req.user, req.userId, and req.isAgent', async () => {
    const req = { headers: { authorization: `Bearer ${activeApiKey}` } };
    const res = makeRes();
    const next = jest.fn();

    await agentAuthMiddleware(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(req.agent).toBeTruthy();
    expect(req.user).toBeTruthy();
    expect(req.user.user_id).toBe(owner.user_id);
    expect(req.userId).toBe(owner.user_id);
    expect(req.isAgent).toBe(true);
  });

  it('returns 401 for an invalid API key', async () => {
    const invalidKey = `${activeApiKey.slice(0, -1)}${activeApiKey.endsWith('a') ? 'b' : 'a'}`;
    const req = { headers: { authorization: `Bearer ${invalidKey}` } };
    const res = makeRes();
    const next = jest.fn();

    await agentAuthMiddleware(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ success: false, message: 'Invalid agent API key.' });
    expect(next).not.toHaveBeenCalled();
  });

  it('returns 403 for a stopped agent', async () => {
    const req = { headers: { authorization: `Bearer ${stoppedApiKey}` } };
    const res = makeRes();
    const next = jest.fn();

    await agentAuthMiddleware(req, res, next);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith({
      success: false,
      message: 'Agent is stopped. Only active agents can make API calls.',
    });
    expect(next).not.toHaveBeenCalled();
  });

  it('returns 403 for a paused agent', async () => {
    const req = { headers: { authorization: `Bearer ${pausedApiKey}` } };
    const res = makeRes();
    const next = jest.fn();

    await agentAuthMiddleware(req, res, next);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith({
      success: false,
      message: 'Agent is paused. Only active agents can make API calls.',
    });
    expect(next).not.toHaveBeenCalled();
  });

  it('loads the owner record and attaches it to req.user', async () => {
    const req = { headers: { authorization: `Bearer ${activeApiKey}` } };
    const res = makeRes();
    const next = jest.fn();

    await agentAuthMiddleware(req, res, next);

    expect(req.user).toBeInstanceOf(User);
    expect(req.user.user_id).toBe(owner.user_id);
  });

  it('returns 401 when the agent owner record cannot be loaded', async () => {
    const req = { headers: { authorization: `Bearer ${activeApiKey}` } };
    const res = makeRes();
    const next = jest.fn();
    jest.spyOn(User, 'findByPk').mockResolvedValueOnce(null);

    await agentAuthMiddleware(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ success: false, message: 'Agent owner account not found.' });
    expect(next).not.toHaveBeenCalled();
  });
});
