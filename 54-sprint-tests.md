# GPT 5.4 Sprint: Fix Test Infrastructure & Add Agent System Test Coverage

> **Working directory:** `server/` (within the Space Wars repo)
> **Runtime:** Node.js 20+, Jest, SQLite in-memory
> **Goal:** Fix the batch test failure, then write comprehensive tests for the untested AI Agent system.

---

## 1. What You're Doing

Two tasks:

### Task A: Fix the Batch Test Failure

When tests run individually, they pass. When all 46 test suites run together via `npm test`, approximately 310 tests fail — all with the same root cause: `sequelize.sync({ force: true })` in `tests/setup.js:20` throws an SQLite error during the `beforeAll` hook of whichever test file runs second (or later).

The error manifests as a SQLite index/constraint creation failure during schema sync. Individual suites pass because the `dbInitialized` flag prevents re-sync within a single process — but something about the model definitions creates a conflict when `force: true` tries to drop and recreate all tables.

**Your job:** Diagnose the exact root cause and fix it. The fix should be minimal — do not rewrite the test infrastructure, just fix the bug.

**Key files:**
- `server/tests/setup.js` — global test setup, runs `sequelize.sync({ force: true })`
- `server/jest.config.js` — `maxWorkers: 1`, `setupFilesAfterEnv: ['<rootDir>/tests/setup.js']`
- `server/src/models/index.js` — all Sequelize model imports and associations
- `server/src/config/database.js` — SQLite connection config for test/dev

**Investigation hints:**
- The `dbInitialized` flag in setup.js is module-scoped, and with `maxWorkers: 1` all files share one process. So `sync({ force: true })` should only run once. Verify this assumption.
- Check if any model files define duplicate index names or conflicting composite indexes
- Check if any model uses `indexes` with names that collide across tables
- Check if the two newest models (`AgentAccount`, `AgentActionLog`) introduced a duplicate index name — they were added recently
- The `force: true` drops tables in dependency order and recreates them — check if foreign key ordering causes issues with the agent models' references to `users` and `ships`
- Run `npx jest --forceExit --verbose 2>&1 | head -100` to see which suite fails first and the exact error

**Verification:**
```bash
cd server && npx jest --forceExit
```
All 739+ tests should pass with 0 failures.

### Task B: Write Agent System Tests

The entire AI Agent subsystem has zero test coverage. Write comprehensive tests for:

1. **`agentService.js`** — the core service
2. **`agentAuth.js`** — the authentication middleware
3. **`agentActionProxy.js`** — the permission/budget/rate-limit enforcement middleware
4. **Agent API routes** — integration tests for both player-facing and agent-facing endpoints

---

## 2. Test Infrastructure Context

### How Tests Work

- **Database:** SQLite in-memory (`:memory:`) via Sequelize
- **Setup:** `tests/setup.js` runs `sequelize.sync({ force: true })` once before all tests
- **Helpers:** `tests/helpers.js` has factory functions: `createTestUser()`, `createTestShip()`, `cleanDatabase()`, etc.
- **Sequential:** `maxWorkers: 1` to avoid SQLite locking
- **Cleanup:** Each test file calls `cleanDatabase()` in its own `beforeEach` or `afterEach`
- **Timeout:** 30 seconds per test

### Running Tests

```bash
cd server
npm test                    # All tests with coverage
npx jest --forceExit        # All tests, force exit
npx jest -- tests/services/agentService.test.js   # Single file
```

### Test File Conventions

Tests live in `server/tests/services/` (unit) and `server/tests/integration/` (API).

Pattern for service tests:
```javascript
const { sequelize } = require('../../src/models');
const { createTestUser, createTestShip, cleanDatabase } = require('../helpers');
const agentService = require('../../src/services/agentService');

describe('Agent Service', () => {
  let testUser, testShip;

  beforeEach(async () => {
    await cleanDatabase();
    testUser = await createTestUser();
    testShip = await createTestShip(testUser.user_id);
  });

  describe('createAgent', () => {
    it('should create an agent account', async () => {
      const { agent, apiKey } = await agentService.createAgent(testUser.user_id, {
        name: 'TestBot',
        shipId: testShip.ship_id,
      });
      expect(agent.name).toBe('TestBot');
      expect(apiKey).toMatch(/^sw3k_agent_/);
    });
  });
});
```

### Existing Helper Functions (in `tests/helpers.js`)

Check the file for the full list, but key ones:
- `createTestUser(overrides)` — creates a User with defaults
- `createTestShip(userId, overrides)` — creates a Ship for a user
- `createTestSector(overrides)` — creates a Sector
- `createTestPort(sectorId, overrides)` — creates a Port
- `createTestCommodity(overrides)` — creates a Commodity
- `createTestPortCommodity(portId, commodityId, overrides)` — creates a PortCommodity
- `cleanDatabase()` — truncates all tables in dependency order

You may need to **add new helpers** for agent-specific factories:
- `createTestAgent(userId, overrides)` — creates an AgentAccount
- `createTestAgentWithKey(userId, overrides)` — creates an agent and returns both the agent and the raw API key

Add these to `tests/helpers.js`.

---

## 3. Agent System Architecture (What You're Testing)

### Models

**`AgentAccount`** (`server/src/models/AgentAccount.js`)
- UUID primary key `agent_id`
- `owner_id` FK → users, `ship_id` FK → ships (nullable)
- `status` ENUM: active, stopped, paused, error
- `permissions` JSON: `{ navigate: bool, trade: bool, scan: bool, dock: bool, combat: bool, colony: bool, fleet: bool, social: bool }`
- `daily_credit_limit` BIGINT (default 5000), `daily_credits_spent` BIGINT
- `rate_limit_per_minute` INTEGER (default 30), `actions_this_minute` INTEGER
- `directive` ENUM: trade, scout, defend, mine, idle
- API key: `api_key_hash` (SHA-256), `api_key_prefix` (first 8 chars)
- Prototype methods: `generateApiKey()`, `verifyApiKey(key)`, `hasPermission(family)`, `checkRateLimit()`, `checkBudget(amount)`

**`AgentActionLog`** (`server/src/models/AgentActionLog.js`)
- UUID primary key `log_id`
- `agent_id` FK, `owner_id` FK (denormalized)
- `action_type`, `action_family`, `target_entity`
- `result` ENUM: allowed, denied, rate_limited, budget_exceeded
- `credits_delta` BIGINT, `details` JSON

### Service (`server/src/services/agentService.js`)

| Function | What to Test |
|----------|-------------|
| `createAgent(ownerId, opts)` | Creates agent, generates API key, validates ship ownership, rejects duplicate agents |
| `getAgentByOwner(ownerId)` | Returns agent with ship association, returns null if none |
| `getAgentById(agentId)` | Simple PK lookup |
| `getAgentByApiKey(apiKey)` | Prefix-based lookup + hash verification, returns null for bad keys |
| `updateAgent(ownerId, updates)` | Updates name, permissions, directive, ship, budget, rate limit |
| `setAgentStatus(ownerId, status)` | Sets active/stopped/paused, clears error on activate, rejects invalid status |
| `regenerateApiKey(ownerId)` | Generates new key, old key stops working |
| `deleteAgent(ownerId)` | Deletes agent + all action logs |
| `executeAction(agentId, opts)` | **Most critical** — tests permission check, rate limit check, budget check, action logging, telemetry updates |
| `getActionLogs(agentId, opts)` | Paginated log retrieval |
| `getOwnerActionLogs(ownerId, opts)` | Paginated with filters |

### Middleware

**`agentAuth.js`** (`server/src/middleware/agentAuth.js`)
- Validates `Authorization: Bearer sw3k_agent_...` header
- Looks up agent by API key
- Blocks non-active agents
- Loads owner User record
- Sets `req.agent`, `req.user`, `req.userId`, `req.isAgent = true`

**`agentActionProxy.js`** (`server/src/middleware/agentActionProxy.js`)
- Factory function `agentAction(family, type, opts)` returns middleware
- Skips if `!req.isAgent` (passes through for regular JWT users)
- Calls `agentService.executeAction()` with action details
- Returns 403 with reason if blocked
- Sets `req.agentActionLog` if allowed

### Routes

**Player-facing** (`server/src/routes/agentRoutes.js`) — JWT auth:
- `POST /api/agents` — create agent
- `GET /api/agents` — get my agent
- `PUT /api/agents` — update config
- `POST /api/agents/status` — start/stop/pause
- `POST /api/agents/regenerate-key` — new API key
- `DELETE /api/agents` — delete agent
- `GET /api/agents/logs` — action logs

**Agent-facing** (`server/src/routes/agentGameRoutes.js`) — API key auth:
- `GET /api/agents/me` — agent self-info
- `GET /api/agent-api/ship` — ship status
- `GET /api/agent-api/ship/cargo` — cargo manifest
- `GET /api/agent-api/adjacent-sectors` — navigation options
- `POST /api/agent-api/navigate` — move ship
- `GET /api/agent-api/port` — port info with commodity listings
- `GET /api/agent-api/trade/market` — market summary
- `POST /api/agent-api/trade/buy` — buy commodity
- `POST /api/agent-api/trade/sell` — sell commodity
- `POST /api/agent-api/trade/refuel` — refuel ship
- `GET /api/agent-api/map` — galaxy map
- `POST /api/agent-api/activate-ship` — switch ship

---

## 4. Test Files to Create

### `server/tests/services/agentService.test.js` (~300-400 lines)

Test every exported function. Key scenarios:

**createAgent:**
- Creates agent with default permissions
- Creates agent with custom permissions, ship, name
- Generates valid `sw3k_agent_` prefixed API key
- Rejects duplicate agent for same owner
- Rejects if specified ship doesn't belong to owner
- Sets default daily_credit_limit to 5000
- Sets default status to 'stopped'

**getAgentByApiKey:**
- Finds agent by valid API key
- Returns null for wrong API key
- Returns null for non-existent prefix
- Handles multiple agents with different prefixes

**updateAgent:**
- Updates name
- Updates permissions (validates whitelist — unknown keys stripped)
- Updates directive
- Updates ship assignment (validates ownership)
- Rejects ship that doesn't belong to owner
- Returns 404 if no agent exists

**setAgentStatus:**
- Sets to active, stopped, paused
- Clears error_message when setting to active
- Rejects invalid status string

**executeAction (most important):**
- Allows action when permission granted
- Denies action when permission missing → logs with result='denied'
- Denies action when agent is stopped → result='denied'
- Denies action when rate limit exceeded → result='rate_limited'
- Denies action when budget exceeded → result='budget_exceeded'
- Increments telemetry: total_actions, last_action_at, last_action_type
- Tracks credits earned and spent separately
- Rate limit resets after 60 seconds
- Budget resets after 24 hours

**regenerateApiKey:**
- New key works, old key doesn't
- Prefix changes

**deleteAgent:**
- Deletes agent and all action logs
- Returns error if no agent

### `server/tests/services/agentAuth.test.js` (~150-200 lines)

Test the middleware directly by creating mock req/res/next objects.

- Passes through requests without `Authorization` header with 401
- Passes through requests with non-`sw3k_agent_` bearer tokens with 401
- Authenticates valid API key, sets req.agent, req.user, req.userId, req.isAgent
- Rejects invalid API key with 401
- Rejects stopped agent with 403
- Rejects paused agent with 403
- Loads owner User and attaches to req.user

### `server/tests/services/agentActionProxy.test.js` (~150-200 lines)

Test the middleware factory.

- Skips entirely if `req.isAgent` is false (calls next immediately)
- Allows action when permissions/budget/rate OK, sets req.agentActionLog
- Returns 403 with reason when permission denied
- Returns 403 when rate limited
- Returns 403 when budget exceeded
- Returns 403 when agent is stopped
- Passes correct actionType, actionFamily, and target to executeAction
- Uses opts.getTarget and opts.getCreditsDelta when provided

### `server/tests/integration/agentRoutes.test.js` (~200-300 lines)

Integration tests using supertest (or the app directly).

Check `tests/integration/api.test.js` for the existing pattern — it likely uses:
```javascript
const app = require('../../src/app');
const request = require('supertest');
```

Test the full HTTP flow:
- POST /api/agents — creates agent, returns API key
- GET /api/agents — returns agent config
- PUT /api/agents — updates config
- POST /api/agents/status — start/stop
- GET /api/agents/me (with API key auth) — returns self-info
- GET /api/agent-api/ship (with API key auth) — returns ship data
- POST /api/agent-api/navigate — moves ship
- 401 for missing/bad API key
- 403 for stopped agent
- 403 for missing permission

---

## 5. Acceptance Criteria

### Task A (Fix Batch Test Failure)
1. `cd server && npx jest --forceExit` passes all test suites
2. No test suite shows failures from `setup.js:20`
3. The fix is minimal — no unnecessary refactoring of test infrastructure

### Task B (Agent Test Coverage)
1. All new test files are created in the correct directories
2. All tests pass when run individually AND as part of the full suite
3. Agent helper factories are added to `tests/helpers.js`
4. Tests cover: happy paths, error paths, edge cases (rate limits, budget, permissions)
5. `executeAction` has the most thorough coverage (it's the core enforcement function)
6. Tests follow existing conventions (describe/it nesting, cleanDatabase in beforeEach)

### Verification
```bash
cd server
npx jest --forceExit                              # All tests pass
npx jest -- tests/services/agentService.test.js   # Agent tests pass alone
npx jest -- tests/services/agentAuth.test.js
npx jest -- tests/services/agentActionProxy.test.js
npx jest -- tests/integration/agentRoutes.test.js
```

---

## 6. Important Notes

- **Do NOT modify any source code** outside of `server/tests/` and `server/tests/helpers.js` (except for the minimal fix to resolve the batch test failure, which may touch `tests/setup.js` or a model file)
- The agent models use `timestamps: false` — they manage `created_at` manually
- API keys are prefixed `sw3k_agent_` followed by 48 hex chars
- `AgentAccount.generateApiKey()` stores the SHA-256 hash, returns the raw key once
- `verifyApiKey()` hashes the provided key and compares to stored hash
- `checkRateLimit()` mutates `actions_this_minute` and `last_rate_reset` in memory (needs `.save()` to persist)
- `checkBudget()` mutates `daily_credits_spent` and `budget_reset_at` in memory
- Permission validation whitelist: `navigate`, `trade`, `scan`, `dock`, `combat`, `colony`, `fleet`, `social`
- The test database is SQLite in-memory — no file on disk, no cleanup needed between runs

---

## 7. Quick Reference: Key File Paths

```
server/
├── jest.config.js
├── tests/
│   ├── setup.js                          # Global test setup (TASK A fix target)
│   ├── helpers.js                        # Factory functions (add agent helpers here)
│   ├── services/
│   │   ├── agentService.test.js          # NEW — create this
│   │   ├── agentAuth.test.js             # NEW — create this
│   │   ├── agentActionProxy.test.js      # NEW — create this
│   │   └── ... (46 existing test files)
│   └── integration/
│       ├── agentRoutes.test.js           # NEW — create this
│       └── api.test.js                   # Existing — reference for patterns
├── src/
│   ├── models/
│   │   ├── index.js                      # All associations
│   │   ├── AgentAccount.js               # Agent model
│   │   └── AgentActionLog.js             # Action log model
│   ├── services/
│   │   └── agentService.js               # Agent service
│   ├── middleware/
│   │   ├── agentAuth.js                  # API key auth middleware
│   │   └── agentActionProxy.js           # Action enforcement middleware
│   ├── controllers/
│   │   └── agentController.js            # HTTP handlers
│   └── routes/
│       ├── agentRoutes.js                # Player-facing routes
│       └── agentGameRoutes.js            # Agent-facing game routes
```
