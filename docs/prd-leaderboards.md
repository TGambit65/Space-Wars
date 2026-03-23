# PRD: Leaderboard API

## Overview

Build a backend service that provides ranked leaderboards for an MMO space trading game. Players want to see who the top traders, combatants, wealthiest players, and biggest corporations are. All data already exists in the database — this is purely aggregation queries over existing tables.

## Architecture Context

This is a **Node.js/Express backend** using **CommonJS** (`require`/`module.exports`), **Sequelize ORM**, and **SQLite** (dev) / **PostgreSQL** (prod).

### Project Structure
```
server/src/
  routes/          ← Express routers, mounted under /api prefix
  controllers/     ← HTTP req/res handling only
  services/        ← All business logic lives here
  models/          ← Sequelize models
  config/          ← Game constants (index.js)
server/tests/
  services/        ← Unit tests (Jest, SQLite in-memory)
  helpers.js       ← Test factory functions
  setup.js         ← DB sync before tests
```

### Conventions
- All endpoints return `{ success: boolean, data?: object, message?: string }`
- All game routes require JWT auth via `authMiddleware` (attaches `req.userId`)
- Services throw errors with `statusCode` property for HTTP status override
- Tests use Jest with `maxWorkers: 1` (SQLite locking)
- Test helpers: `createTestUser()`, `createTestSector()`, `createTestShip()`, `createTestCorporation()`, `createTestPort()`, `createTestCommodity()`, `addCommodityToPort()`, `cleanDatabase()`

### Route Registration Pattern
```javascript
const express = require('express');
const { authMiddleware } = require('../middleware/auth');
const controller = require('../controllers/leaderboardController');
const router = express.Router();
router.use(authMiddleware);
router.get('/trading', controller.getTradingLeaderboard);
module.exports = router;
```
Then in `server/src/routes/index.js`:
```javascript
const leaderboardRoutes = require('./leaderboardRoutes');
router.use('/leaderboards', leaderboardRoutes);
```

## Existing Models (relevant fields only)

### User
```
user_id: UUID (PK)
username: STRING (unique)
faction: STRING ('terran_alliance'|'zythian_swarm'|'automaton_collective'|'synthesis_accord'|'sylvari_dominion')
credits: INTEGER
level: INTEGER
experience: INTEGER
total_trades: INTEGER
total_combat_wins: INTEGER
total_combat_losses: INTEGER
total_sectors_visited: INTEGER
total_distance_traveled: INTEGER
corporation_id: UUID (FK, nullable)
is_admin: BOOLEAN
created_at: TIMESTAMP
```

### Transaction (trade history)
```
transaction_id: UUID (PK)
user_id: UUID (FK → users)
ship_id: UUID (FK → ships)
port_id: UUID (FK → ports)
commodity_id: UUID (FK → commodities)
transaction_type: STRING ('BUY'|'SELL')
quantity: INTEGER
unit_price: INTEGER
total_price: BIGINT
created_at: TIMESTAMP
```
- Indexes on: `user_id`, `port_id`, `commodity_id`, `created_at`, `transaction_type`

### CombatLog
```
combat_log_id: UUID (PK)
attacker_ship_id: UUID (FK, nullable)
attacker_npc_id: UUID (FK, nullable)
defender_ship_id: UUID (FK, nullable)
defender_npc_id: UUID (FK, nullable)
sector_id: UUID (FK)
combat_type: STRING ('PVE'|'PVP'|'NPC_VS_NPC')
rounds_fought: INTEGER
winner_type: STRING ('attacker'|'defender'|'draw'|'fled')
attacker_damage_dealt: INTEGER
defender_damage_dealt: INTEGER
credits_looted: INTEGER
experience_gained: INTEGER
created_at: TIMESTAMP
```
- Indexes on: `attacker_ship_id`, `defender_ship_id`, `attacker_npc_id`, `defender_npc_id`, `sector_id`, `created_at`

### Corporation
```
corporation_id: UUID (PK)
name: STRING (unique)
ticker: STRING(5)
leader_user_id: UUID (FK → users)
treasury: INTEGER (default 0)
level: INTEGER (default 1)
member_count: INTEGER (default 1)
description: TEXT
created_at: TIMESTAMP
```
- Association: `Corporation.hasMany(User)`, `Corporation.belongsTo(User, { as: 'leader' })`

### Colony
```
colony_id: UUID (PK)
planet_id: UUID (FK → planets)
user_id: UUID (FK → users)
name: STRING
population: INTEGER
infrastructure_level: INTEGER
```
- Association: `User.hasMany(Colony, { foreignKey: 'user_id', as: 'colonies' })`

### Ship
```
ship_id: UUID (PK)
owner_user_id: UUID (FK → users)
name: STRING
ship_type: STRING
is_active: BOOLEAN
```
- Association: `User.hasMany(Ship, { foreignKey: 'owner_user_id', as: 'ships' })`

### Sequelize Operators Available
```javascript
const { Op, fn, col, literal } = require('sequelize');
```

## Deliverables

### 1. Leaderboard Service (`server/src/services/leaderboardService.js`)

All functions accept `options` with `limit` (default 10, max 50) and `timeframe` ('all_time' | 'weekly' | 'daily', default 'all_time').

For `weekly`, filter records to last 7 days. For `daily`, filter to last 24 hours.

#### `getTradingLeaderboard(options)`
- Aggregate `Transaction` table by `user_id`
- Calculate: total trade volume (sum of `total_price`), total trades (count), total profit (sum of SELL `total_price` minus sum of BUY `total_price`)
- Join User for `username`, `faction`
- Sort by total trade volume descending
- Return:
```javascript
{
  leaderboard: [{
    rank: 1,
    user_id, username, faction,
    totalVolume: number,     // sum of all total_price
    totalTrades: number,     // count of transactions
    totalProfit: number,     // sell revenue - buy cost
  }],
  timeframe: string,
  generatedAt: ISO timestamp
}
```

#### `getCombatLeaderboard(options)`
- Aggregate `CombatLog` table for player-involved combat (exclude NPC_VS_NPC)
- For each player (as attacker or defender), count: wins, losses, total damage dealt, total credits looted, total XP earned
- A "win" for attacker: `winner_type === 'attacker'` AND `attacker_ship_id` is player's ship
- A "win" for defender: `winner_type === 'defender'` AND `defender_ship_id` is player's ship
- Need to union/combine attacker and defender stats per user
- Join User for `username`, `faction`
- Sort by wins descending, then KD ratio
- Return:
```javascript
{
  leaderboard: [{
    rank: 1,
    user_id, username, faction,
    wins: number,
    losses: number,
    kdRatio: number,          // wins / max(losses, 1)
    totalDamageDealt: number,
    totalCreditsLooted: number,
    totalXpEarned: number,
  }],
  timeframe, generatedAt
}
```
- **Implementation note**: Since CombatLog tracks ship_id not user_id, you'll need to join through Ship to get `owner_user_id`. Two queries (as attacker, as defender) merged by user_id is the cleanest approach.

#### `getWealthLeaderboard(options)`
- Simple query on `User` table, sorted by `credits` descending
- Exclude admin users (`is_admin = false`)
- Include: `username`, `faction`, `credits`, `level`
- `timeframe` filter not applicable here (wealth is current snapshot)
- Return:
```javascript
{
  leaderboard: [{
    rank: 1,
    user_id, username, faction,
    credits: number,
    level: number,
  }],
  generatedAt
}
```

#### `getCorporationLeaderboard(options)`
- Query `Corporation` table
- Include leader's username via `leader` association
- Calculate total member wealth: sum of `credits` from all Users where `corporation_id` matches
- Sort by `treasury` descending (or optionally by `member_count` or `total_wealth`)
- `options.sortBy`: 'treasury' (default) | 'members' | 'wealth'
- Return:
```javascript
{
  leaderboard: [{
    rank: 1,
    corporation_id, name, ticker,
    leader: { user_id, username },
    treasury: number,
    memberCount: number,
    totalMemberWealth: number,
    level: number,
  }],
  generatedAt
}
```

#### `getExplorerLeaderboard(options)`
- Query `User` table sorted by `total_sectors_visited` descending
- Exclude admin users
- Include: `username`, `faction`, `total_sectors_visited`, `total_distance_traveled`, `level`
- Return:
```javascript
{
  leaderboard: [{
    rank: 1,
    user_id, username, faction,
    sectorsVisited: number,
    distanceTraveled: number,
    level: number,
  }],
  generatedAt
}
```

#### `getPlayerRank(userId, board)`
- Given a user ID and board name ('trading'|'combat'|'wealth'|'explorer'), return that player's rank and stats
- Run the same aggregation but find the user's position
- Return: `{ rank: number, total: number, stats: { ... } }`

### 2. In-Memory Cache (optional but recommended)

Leaderboard queries can be expensive. Cache results for 60 seconds:
```javascript
const CACHE_TTL = 60 * 1000;
const cache = new Map();

const getCached = (key, computeFn) => {
  const entry = cache.get(key);
  if (entry && Date.now() - entry.timestamp < CACHE_TTL) return entry.data;
  // compute, store, return
};
```

### 3. Leaderboard Controller (`server/src/controllers/leaderboardController.js`)

#### `GET /api/leaderboards/trading?limit=10&timeframe=all_time`
#### `GET /api/leaderboards/combat?limit=10&timeframe=weekly`
#### `GET /api/leaderboards/wealth?limit=10`
#### `GET /api/leaderboards/corporations?limit=10&sortBy=treasury`
#### `GET /api/leaderboards/explorers?limit=10`
#### `GET /api/leaderboards/me?board=trading`
- Returns the requesting user's rank on the specified board

All endpoints:
- Validate `limit` is 1-50
- Validate `timeframe` is one of the allowed values
- Return `{ success: true, data: { leaderboard, timeframe, generatedAt } }`

### 4. Routes File (`server/src/routes/leaderboardRoutes.js`)
- Mount all six endpoints under auth middleware
- Register in `server/src/routes/index.js` as: `router.use('/leaderboards', leaderboardRoutes);`

### 5. Tests (`server/tests/services/leaderboard.test.js`)

Create a comprehensive test suite:

**Setup**: Create 3-5 test users with different stats, some transactions, some combat logs, a corporation.

**Trading leaderboard tests:**
- User with most trade volume ranks first
- Profit calculation is correct (sell - buy)
- `timeframe: 'daily'` only includes today's transactions
- `limit` parameter respected
- Empty results return empty array (not error)

**Combat leaderboard tests:**
- User with most wins ranks first
- Attacker wins and defender wins both counted correctly
- NPC_VS_NPC combats excluded
- KD ratio calculated correctly

**Wealth leaderboard tests:**
- Richest user ranks first
- Admin users excluded
- Users with zero credits still appear

**Corporation leaderboard tests:**
- Sort by treasury works
- Sort by members works
- Leader username included

**Explorer leaderboard tests:**
- User with most sectors visited ranks first

**Player rank tests:**
- `getPlayerRank` returns correct position
- Returns `null` for user with no activity on that board

Use `cleanDatabase()` in `beforeEach`. Use test helpers for all entity creation.

## Files to Create
| File | Purpose |
|------|---------|
| `server/src/services/leaderboardService.js` | Aggregation queries + caching |
| `server/src/controllers/leaderboardController.js` | HTTP handlers |
| `server/src/routes/leaderboardRoutes.js` | Express router |
| `server/tests/services/leaderboard.test.js` | Unit tests |

## Files to Modify
| File | Change |
|------|--------|
| `server/src/routes/index.js` | Add `router.use('/leaderboards', leaderboardRoutes)` |

## Non-Goals
- No frontend work (handled separately)
- No WebSocket real-time leaderboard updates
- No new database models or migrations
- Don't modify any existing models or services
- No pagination beyond the `limit` parameter (leaderboards are top-N lists)
