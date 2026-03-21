const agentService = require('../../src/services/agentService');
const { AgentAccount, AgentActionLog } = require('../../src/models');
const {
  createTestUser,
  createTestSector,
  createTestShip,
  createTestAgent,
  createTestAgentWithKey,
  cleanDatabase,
} = require('../helpers');

const PERMISSION_KEYS = ['navigate', 'trade', 'scan', 'dock', 'combat', 'colony', 'fleet', 'social'];
const denyAllPermissions = Object.fromEntries(PERMISSION_KEYS.map((key) => [key, false]));

const uniqueSeed = (prefix = 'test') => `${prefix.replace(/[^a-zA-Z0-9]/g, '')}${Date.now()}${Math.floor(Math.random() * 1_000_000)}`;
const createUniqueUser = (prefix, overrides = {}) => {
  const seed = uniqueSeed(prefix);
  return createTestUser({ username: seed, email: `${seed}@example.com`, ...overrides });
};

describe('agentService', () => {
  let owner;
  let otherUser;
  let sector;
  let ship;
  let otherShip;

  const createActiveAgent = async (overrides = {}) => createTestAgent(owner.user_id, {
    ship_id: ship.ship_id,
    status: 'active',
    ...overrides,
  });

  beforeEach(async () => {
    await cleanDatabase();
    sector = await createTestSector({ name: uniqueSeed('sector') });
    owner = await createUniqueUser('owner');
    otherUser = await createUniqueUser('other');
    ship = await createTestShip(owner.user_id, sector.sector_id, { name: uniqueSeed('ship') });
    otherShip = await createTestShip(otherUser.user_id, sector.sector_id, { name: uniqueSeed('ship') });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('createAgent', () => {
    it('creates an agent with defaults and returns a raw API key once', async () => {
      const { agent, apiKey } = await agentService.createAgent(owner.user_id, { shipId: ship.ship_id });

      expect(agent.owner_id).toBe(owner.user_id);
      expect(agent.ship_id).toBe(ship.ship_id);
      expect(agent.name).toBe('Agent');
      expect(agent.status).toBe('stopped');
      expect(Number(agent.daily_credit_limit)).toBe(5000);
      expect(agent.permissions).toEqual({
        navigate: true,
        trade: true,
        scan: true,
        dock: true,
        combat: false,
        colony: false,
        fleet: false,
        social: false,
      });
      expect(apiKey).toMatch(/^sw3k_agent_[a-f0-9]{48}$/);
      expect(agent.api_key_hash).toBeTruthy();
      expect(agent.api_key_hash).not.toBe(apiKey);
    });

    it('creates an agent with custom name, ship, budget, and sanitized permissions', async () => {
      const { agent } = await agentService.createAgent(owner.user_id, {
        name: 'TradeBot',
        shipId: ship.ship_id,
        dailyCreditLimit: 9200,
        permissions: {
          trade: true,
          scan: false,
          unknown_permission: true,
        },
      });

      expect(agent.name).toBe('TradeBot');
      expect(agent.ship_id).toBe(ship.ship_id);
      expect(Number(agent.daily_credit_limit)).toBe(9200);
      expect(agent.permissions).toEqual({
        navigate: false,
        trade: true,
        scan: false,
        dock: false,
        combat: false,
        colony: false,
        fleet: false,
        social: false,
      });
      expect(agent.permissions.unknown_permission).toBeUndefined();
    });

    it('rejects a duplicate agent for the same owner', async () => {
      await agentService.createAgent(owner.user_id, { shipId: ship.ship_id });

      await expect(agentService.createAgent(owner.user_id, { shipId: ship.ship_id })).rejects.toMatchObject({
        statusCode: 409,
        message: 'You already have an agent account',
      });
    });

    it('rejects a ship that does not belong to the owner', async () => {
      await expect(agentService.createAgent(owner.user_id, { shipId: otherShip.ship_id })).rejects.toMatchObject({
        statusCode: 404,
        message: 'Ship not found or does not belong to you',
      });
    });
  });

  describe('getters', () => {
    it('getAgentByOwner returns the agent with ship association', async () => {
      const agent = await createTestAgent(owner.user_id, { ship_id: ship.ship_id });

      const found = await agentService.getAgentByOwner(owner.user_id);

      expect(found.agent_id).toBe(agent.agent_id);
      expect(found.ship).toBeTruthy();
      expect(found.ship.ship_id).toBe(ship.ship_id);
    });

    it('getAgentByOwner returns null when no agent exists', async () => {
      const found = await agentService.getAgentByOwner(owner.user_id);

      expect(found).toBeNull();
    });

    it('getAgentById returns the matching agent', async () => {
      const agent = await createTestAgent(owner.user_id, { ship_id: ship.ship_id });

      const found = await agentService.getAgentById(agent.agent_id);

      expect(found).toBeTruthy();
      expect(found.agent_id).toBe(agent.agent_id);
    });
  });

  describe('getAgentByApiKey', () => {
    it('returns the matching agent for a valid API key', async () => {
      const { agent, apiKey } = await agentService.createAgent(owner.user_id, { shipId: ship.ship_id });

      const found = await agentService.getAgentByApiKey(apiKey);

      expect(found).toBeTruthy();
      expect(found.agent_id).toBe(agent.agent_id);
    });

    it('returns null for an invalid API key', async () => {
      const { apiKey } = await agentService.createAgent(owner.user_id, { shipId: ship.ship_id });
      const invalidKey = `${apiKey.slice(0, -1)}${apiKey.endsWith('a') ? 'b' : 'a'}`;

      const found = await agentService.getAgentByApiKey(invalidKey);

      expect(found).toBeNull();
    });

    it('returns null when no candidates match the computed prefix', async () => {
      await agentService.createAgent(owner.user_id, { shipId: ship.ship_id });

      const found = await agentService.getAgentByApiKey('not-an-agent-key');

      expect(found).toBeNull();
    });

    it('verifies the hash across multiple matching candidates', async () => {
      const first = await agentService.createAgent(owner.user_id, { shipId: ship.ship_id });
      const second = await agentService.createAgent(otherUser.user_id, { shipId: otherShip.ship_id });

      const found = await agentService.getAgentByApiKey(second.apiKey);

      expect(found).toBeTruthy();
      expect(found.agent_id).toBe(second.agent.agent_id);
      expect(found.agent_id).not.toBe(first.agent.agent_id);
    });
  });

  describe('updateAgent', () => {
    it('updates name, permissions, directive, budgets, rates, and ship assignment', async () => {
      await createTestAgent(owner.user_id, { ship_id: ship.ship_id });
      const replacementShip = await createTestShip(owner.user_id, sector.sector_id, { name: uniqueSeed('backup-ship') });

      const updated = await agentService.updateAgent(owner.user_id, {
        name: 'Updated Bot',
        permissions: { navigate: true, trade: false, scan: true, ignored: true },
        dailyCreditLimit: 7500,
        rateLimitPerMinute: 12,
        directive: 'trade',
        directiveParams: { commodity: 'ore' },
        shipId: replacementShip.ship_id,
      });

      expect(updated.name).toBe('Updated Bot');
      expect(updated.ship_id).toBe(replacementShip.ship_id);
      expect(Number(updated.daily_credit_limit)).toBe(7500);
      expect(Number(updated.rate_limit_per_minute)).toBe(12);
      expect(updated.directive).toBe('trade');
      expect(updated.directive_params).toEqual({ commodity: 'ore' });
      expect(updated.permissions).toEqual({
        navigate: true,
        trade: false,
        scan: true,
        dock: false,
        combat: false,
        colony: false,
        fleet: false,
        social: false,
      });
    });

    it('can clear a ship assignment by passing null', async () => {
      await createTestAgent(owner.user_id, { ship_id: ship.ship_id });

      const updated = await agentService.updateAgent(owner.user_id, { shipId: null });

      expect(updated.ship_id).toBeNull();
    });

    it('rejects a ship that does not belong to the owner', async () => {
      await createTestAgent(owner.user_id, { ship_id: ship.ship_id });

      await expect(agentService.updateAgent(owner.user_id, { shipId: otherShip.ship_id })).rejects.toMatchObject({
        statusCode: 404,
        message: 'Ship not found or does not belong to you',
      });
    });

    it('returns 404 when no agent exists for the owner', async () => {
      await expect(agentService.updateAgent(owner.user_id, { name: 'Ghost Bot' })).rejects.toMatchObject({
        statusCode: 404,
        message: 'No agent account found',
      });
    });
  });

  describe('setAgentStatus', () => {
    it.each(['active', 'stopped', 'paused'])('updates status to %s', async (status) => {
      await createTestAgent(owner.user_id);

      const updated = await agentService.setAgentStatus(owner.user_id, status);

      expect(updated.status).toBe(status);
    });

    it('clears the error message when re-activating an agent', async () => {
      await createTestAgent(owner.user_id, {
        status: 'error',
        error_message: 'Last run failed',
      });

      const updated = await agentService.setAgentStatus(owner.user_id, 'active');

      expect(updated.status).toBe('active');
      expect(updated.error_message).toBeNull();
    });

    it('rejects an invalid status value', async () => {
      await createTestAgent(owner.user_id);

      await expect(agentService.setAgentStatus(owner.user_id, 'launching')).rejects.toMatchObject({
        statusCode: 400,
        message: 'Invalid status',
      });
    });
  });

  describe('regenerateApiKey', () => {
    it('makes the old key invalid and the new key valid', async () => {
      const { agent, apiKey: originalKey } = await createTestAgentWithKey(owner.user_id, { ship_id: ship.ship_id });

      const { apiKey: newKey } = await agentService.regenerateApiKey(owner.user_id);
      const oldLookup = await agentService.getAgentByApiKey(originalKey);
      const newLookup = await agentService.getAgentByApiKey(newKey);
      const reloaded = await AgentAccount.findByPk(agent.agent_id);

      expect(newKey).toMatch(/^sw3k_agent_[a-f0-9]{48}$/);
      expect(newKey).not.toBe(originalKey);
      expect(oldLookup).toBeNull();
      expect(newLookup.agent_id).toBe(agent.agent_id);
      expect(reloaded.api_key_hash).toBeTruthy();
    });
  });

  describe('deleteAgent', () => {
    it('deletes the agent and all related action logs', async () => {
      const agent = await createActiveAgent();
      await agentService.executeAction(agent.agent_id, {
        actionType: 'navigate',
        actionFamily: 'navigate',
        targetEntity: sector.sector_id,
      });
      await agentService.executeAction(agent.agent_id, {
        actionType: 'scan',
        actionFamily: 'scan',
        targetEntity: sector.sector_id,
      });

      await agentService.deleteAgent(owner.user_id);

      expect(await AgentAccount.count({ where: { owner_id: owner.user_id } })).toBe(0);
      expect(await AgentActionLog.count({ where: { owner_id: owner.user_id } })).toBe(0);
    });

    it('returns an error when no agent exists', async () => {
      await expect(agentService.deleteAgent(owner.user_id)).rejects.toMatchObject({
        statusCode: 404,
        message: 'No agent account found',
      });
    });
  });

  describe('executeAction', () => {
    it('allows an action when the agent is active and has permission', async () => {
      const agent = await createActiveAgent();

      const result = await agentService.executeAction(agent.agent_id, {
        actionType: 'navigate',
        actionFamily: 'navigate',
        targetEntity: sector.sector_id,
        details: { source: 'unit-test' },
      });

      const reloaded = await AgentAccount.findByPk(agent.agent_id);
      expect(result.allowed).toBe(true);
      expect(result.log.result).toBe('allowed');
      expect(result.log.target_entity).toBe(sector.sector_id);
      expect(result.log.details).toEqual({ source: 'unit-test' });
      expect(Number(reloaded.total_actions)).toBe(1);
      expect(reloaded.last_action_type).toBe('navigate');
      expect(reloaded.last_action_at).toBeTruthy();
    });

    it('denies an action when the permission is missing and writes a denied log', async () => {
      const agent = await createActiveAgent({
        permissions: { ...denyAllPermissions, scan: true },
      });

      const result = await agentService.executeAction(agent.agent_id, {
        actionType: 'navigate',
        actionFamily: 'navigate',
        targetEntity: sector.sector_id,
      });

      expect(result.allowed).toBe(false);
      expect(result.reason).toBe('Permission denied: navigate');
      expect(result.log.result).toBe('denied');
      expect(result.log.details.reason).toBe('Permission denied: navigate');
    });

    it('denies an action when the agent is not active', async () => {
      const agent = await createTestAgent(owner.user_id, {
        ship_id: ship.ship_id,
        status: 'stopped',
      });

      const result = await agentService.executeAction(agent.agent_id, {
        actionType: 'navigate',
        actionFamily: 'navigate',
        targetEntity: sector.sector_id,
      });

      expect(result.allowed).toBe(false);
      expect(result.reason).toBe('Agent is stopped');
      expect(result.log.result).toBe('denied');
      expect(result.log.details.reason).toBe('Agent is stopped');
    });

    it('denies an action when the rate limit has already been exhausted', async () => {
      const agent = await createActiveAgent({
        rate_limit_per_minute: 1,
        actions_this_minute: 1,
        last_rate_reset: new Date(),
      });

      const result = await agentService.executeAction(agent.agent_id, {
        actionType: 'scan_adjacent',
        actionFamily: 'navigate',
      });

      const reloaded = await AgentAccount.findByPk(agent.agent_id);
      expect(result.allowed).toBe(false);
      expect(result.reason).toBe('Rate limit exceeded');
      expect(result.log.result).toBe('rate_limited');
      expect(Number(reloaded.actions_this_minute)).toBe(1);
    });

    it('denies an action when the daily budget would be exceeded', async () => {
      const agent = await createActiveAgent({
        daily_credit_limit: 20,
        daily_credits_spent: 20,
        budget_reset_at: new Date(),
      });

      const result = await agentService.executeAction(agent.agent_id, {
        actionType: 'buy',
        actionFamily: 'trade',
        targetEntity: 'commodity-1',
        creditsDelta: -5,
      });

      expect(result.allowed).toBe(false);
      expect(result.reason).toBe('Daily budget exceeded');
      expect(result.log.result).toBe('budget_exceeded');
      expect(result.log.details.attempted_spend).toBe(5);
    });

    it('tracks earned and spent credits separately on allowed actions', async () => {
      const agent = await createActiveAgent();

      await agentService.executeAction(agent.agent_id, {
        actionType: 'sell',
        actionFamily: 'trade',
        creditsDelta: 40,
      });
      await agentService.executeAction(agent.agent_id, {
        actionType: 'buy',
        actionFamily: 'trade',
        creditsDelta: -25,
      });

      const reloaded = await AgentAccount.findByPk(agent.agent_id);
      expect(Number(reloaded.total_actions)).toBe(2);
      expect(Number(reloaded.total_credits_earned)).toBe(40);
      expect(Number(reloaded.total_credits_spent)).toBe(25);
      expect(Number(reloaded.daily_credits_spent)).toBe(25);
      expect(reloaded.last_action_type).toBe('buy');
    });

    it('resets the rate-limit window after 60 seconds have elapsed', async () => {
      const agent = await createActiveAgent({
        rate_limit_per_minute: 1,
        actions_this_minute: 1,
        last_rate_reset: new Date(Date.now() - 61_000),
      });

      const result = await agentService.executeAction(agent.agent_id, {
        actionType: 'scan_adjacent',
        actionFamily: 'navigate',
      });

      const reloaded = await AgentAccount.findByPk(agent.agent_id);
      expect(result.allowed).toBe(true);
      expect(Number(reloaded.actions_this_minute)).toBe(1);
    });

    it('resets the daily budget window after 24 hours have elapsed', async () => {
      const agent = await createActiveAgent({
        daily_credit_limit: 50,
        daily_credits_spent: 50,
        budget_reset_at: new Date(Date.now() - 86_500_000),
      });

      const result = await agentService.executeAction(agent.agent_id, {
        actionType: 'buy',
        actionFamily: 'trade',
        creditsDelta: -20,
      });

      const reloaded = await AgentAccount.findByPk(agent.agent_id);
      expect(result.allowed).toBe(true);
      expect(Number(reloaded.daily_credits_spent)).toBe(20);
      expect(Number(reloaded.total_credits_spent)).toBe(20);
    });
  });

  describe('log retrieval', () => {
    it('getActionLogs returns paginated logs for a single agent', async () => {
      const agent = await createActiveAgent();
      await agentService.executeAction(agent.agent_id, { actionType: 'scan_1', actionFamily: 'scan' });
      await agentService.executeAction(agent.agent_id, { actionType: 'scan_2', actionFamily: 'scan' });
      await agentService.executeAction(agent.agent_id, { actionType: 'scan_3', actionFamily: 'scan' });

      const page = await agentService.getActionLogs(agent.agent_id, { page: 1, limit: 2 });

      expect(page.total).toBe(3);
      expect(page.page).toBe(1);
      expect(page.pages).toBe(2);
      expect(page.logs).toHaveLength(2);
    });

    it('getOwnerActionLogs returns filtered owner logs only', async () => {
      const ownerAgent = await createActiveAgent();
      const otherAgent = await createTestAgent(otherUser.user_id, {
        ship_id: otherShip.ship_id,
        status: 'active',
      });

      await agentService.executeAction(ownerAgent.agent_id, {
        actionType: 'buy',
        actionFamily: 'trade',
        creditsDelta: -5,
      });
      await agentService.executeAction(ownerAgent.agent_id, {
        actionType: 'navigate',
        actionFamily: 'navigate',
      });
      await agentService.executeAction(otherAgent.agent_id, {
        actionType: 'buy',
        actionFamily: 'trade',
        creditsDelta: -5,
      });

      const page = await agentService.getOwnerActionLogs(owner.user_id, {
        page: 1,
        limit: 10,
        actionType: 'buy',
        result: 'allowed',
      });

      expect(page.total).toBe(1);
      expect(page.logs).toHaveLength(1);
      expect(page.logs[0].owner_id).toBe(owner.user_id);
      expect(page.logs[0].action_type).toBe('buy');
      expect(page.logs[0].result).toBe('allowed');
    });
  });
});
