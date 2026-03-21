const request = require('supertest');
const app = require('../../src/app');
const shipService = require('../../src/services/shipService');
const {
  createTestUser,
  createTestSector,
  createTestShip,
  createSectorConnection,
  generateTestToken,
  cleanDatabase,
} = require('../helpers');

const uniqueSeed = (prefix = 'test') => `${prefix.replace(/[^a-zA-Z0-9]/g, '')}${Date.now()}${Math.floor(Math.random() * 1_000_000)}`;
const createUniqueUser = (prefix, overrides = {}) => {
  const seed = uniqueSeed(prefix);
  return createTestUser({ username: seed, email: `${seed}@example.com`, ...overrides });
};

describe('Agent route integration', () => {
  let owner;
  let token;
  let homeSector;
  let adjacentSector;
  let ship;
  let backupShip;

  const authHeader = () => ({ Authorization: `Bearer ${token}` });

  const createAgent = async (overrides = {}) => {
    const payload = {
      name: 'Runner Bot',
      ship_id: ship.ship_id,
      ...overrides,
    };

    return request(app)
      .post('/api/agents')
      .set(authHeader())
      .send(payload);
  };

  const setAgentStatus = async (status) => request(app)
    .post('/api/agents/status')
    .set(authHeader())
    .send({ status });

  beforeEach(async () => {
    await cleanDatabase();
    homeSector = await createTestSector({ name: uniqueSeed('home-sector') });
    adjacentSector = await createTestSector({ name: uniqueSeed('adjacent-sector') });
    await createSectorConnection(homeSector.sector_id, adjacentSector.sector_id, { travel_time: 1 });
    owner = await createUniqueUser('owner', { credits: 100_000 });
    ship = await createTestShip(owner.user_id, homeSector.sector_id, { name: uniqueSeed('primary-ship') });
    backupShip = await createTestShip(owner.user_id, homeSector.sector_id, { name: uniqueSeed('backup-ship') });
    token = generateTestToken(owner);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  afterAll(async () => {
    await cleanDatabase();
  });

  describe('player-facing agent endpoints', () => {
    it('POST /api/agents creates an agent and returns the raw API key once', async () => {
      const res = await createAgent();

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.agent.name).toBe('Runner Bot');
      expect(res.body.data.agent.ship_id).toBe(ship.ship_id);
      expect(res.body.data.agent.status).toBe('stopped');
      expect(res.body.data.agent).not.toHaveProperty('api_key_hash');
      expect(res.body.data.api_key).toMatch(/^sw3k_agent_[a-f0-9]{48}$/);
    });

    it('GET /api/agents returns the current owner agent config', async () => {
      await createAgent();

      const res = await request(app)
        .get('/api/agents')
        .set(authHeader());

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.name).toBe('Runner Bot');
      expect(res.body.data.ship).toBeTruthy();
      expect(res.body.data.ship.ship_id).toBe(ship.ship_id);
    });

    it('PUT /api/agents updates agent configuration', async () => {
      await createAgent();

      const res = await request(app)
        .put('/api/agents')
        .set(authHeader())
        .send({
          name: 'Updated Route Bot',
          directive: 'trade',
          directive_params: { focus: 'ore' },
          ship_id: backupShip.ship_id,
          daily_credit_limit: 8800,
          rate_limit_per_minute: 9,
          permissions: {
            navigate: true,
            scan: false,
          },
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.name).toBe('Updated Route Bot');
      expect(res.body.data.directive).toBe('trade');
      expect(res.body.data.directive_params).toEqual({ focus: 'ore' });
      expect(res.body.data.ship_id).toBe(backupShip.ship_id);
      expect(Number(res.body.data.daily_credit_limit)).toBe(8800);
      expect(Number(res.body.data.rate_limit_per_minute)).toBe(9);
      expect(res.body.data.permissions.navigate).toBe(true);
      expect(res.body.data.permissions.scan).toBe(false);
    });

    it('POST /api/agents/status updates agent status', async () => {
      await createAgent();

      const active = await setAgentStatus('active');
      const paused = await setAgentStatus('paused');

      expect(active.status).toBe(200);
      expect(active.body.data.status).toBe('active');
      expect(paused.status).toBe(200);
      expect(paused.body.data.status).toBe('paused');
    });
  });

  describe('agent-facing endpoints', () => {
    it('GET /api/agents/me returns self info for an active agent API key', async () => {
      const createRes = await createAgent();
      const apiKey = createRes.body.data.api_key;
      await setAgentStatus('active');

      const res = await request(app)
        .get('/api/agents/me')
        .set('Authorization', `Bearer ${apiKey}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.ship_id).toBe(ship.ship_id);
      expect(res.body.data.owner_id).toBe(owner.user_id);
      expect(res.body.data.status).toBe('active');
    });

    it('GET /api/agent-api/ship returns the assigned ship status for an active agent', async () => {
      const createRes = await createAgent();
      const apiKey = createRes.body.data.api_key;
      await setAgentStatus('active');

      const res = await request(app)
        .get('/api/agent-api/ship')
        .set('Authorization', `Bearer ${apiKey}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.ship.ship_id).toBe(ship.ship_id);
      expect(res.body.data.ship.owner_user_id).toBe(owner.user_id);
      expect(Array.isArray(res.body.data.adjacentSectors)).toBe(true);
    });

    it('POST /api/agent-api/navigate routes the request through agent auth, action proxy, and ship controller', async () => {
      const createRes = await createAgent();
      const apiKey = createRes.body.data.api_key;
      await setAgentStatus('active');

      const moveSpy = jest.spyOn(shipService, 'moveShip').mockResolvedValue({
        ship_id: ship.ship_id,
        current_sector_id: adjacentSector.sector_id,
        fuel: 99,
        toJSON() { return { ship_id: this.ship_id, current_sector_id: this.current_sector_id, fuel: this.fuel }; },
      });
      const adjacentSpy = jest.spyOn(shipService, 'getAdjacentSectors').mockResolvedValue([
        { sector_id: homeSector.sector_id, name: homeSector.name },
      ]);

      const res = await request(app)
        .post('/api/agent-api/navigate')
        .set('Authorization', `Bearer ${apiKey}`)
        .send({ target_sector_id: adjacentSector.sector_id });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.message).toBe('Ship moved successfully');
      expect(res.body.data.ship.current_sector_id).toBe(adjacentSector.sector_id);
      expect(moveSpy).toHaveBeenCalledWith(ship.ship_id, adjacentSector.sector_id, owner.user_id);
      expect(adjacentSpy).toHaveBeenCalledWith(adjacentSector.sector_id, owner.user_id);
    });

    it('returns 401 when the agent API key is missing', async () => {
      const res = await request(app).get('/api/agent-api/ship');

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
    });

    it('returns 401 when the Authorization bearer token is not an agent key', async () => {
      const res = await request(app)
        .get('/api/agent-api/ship')
        .set('Authorization', 'Bearer regular-user-token');

      expect(res.status).toBe(401);
      expect(res.body.message).toBe('Invalid agent API key format.');
    });

    it('returns 403 when the agent is stopped', async () => {
      const createRes = await createAgent();
      const apiKey = createRes.body.data.api_key;

      const res = await request(app)
        .get('/api/agent-api/ship')
        .set('Authorization', `Bearer ${apiKey}`);

      expect(res.status).toBe(403);
      expect(res.body.message).toMatch(/Agent is stopped/i);
    });

    it('returns 403 when the required permission is missing', async () => {
      const createRes = await createAgent({
        permissions: {
          scan: false,
        },
      });
      const apiKey = createRes.body.data.api_key;
      await setAgentStatus('active');

      const res = await request(app)
        .get('/api/agent-api/ship')
        .set('Authorization', `Bearer ${apiKey}`);

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toMatch(/Permission denied: scan/i);
      expect(res.body).toHaveProperty('agent_log_id');
    });
  });
});
