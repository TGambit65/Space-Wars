# PRD: Route Planner & Trade Advisor API

## Overview

Build a backend service that provides weighted pathfinding between sectors and optimal trade route recommendations for an MMO space trading game. The universe is a graph of ~200 sectors connected by bidirectional hyperlanes, wormholes, portals, and protected lanes. Players need intelligent routing that optimizes for safety, speed, or cost — plus discovery of profitable trade routes.

A client-side BFS pathfinder already exists (unweighted, fewest-hops only). This replaces it with a server-side weighted graph that accounts for travel time, hazards, lane types, access restrictions, and tolls.

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
  integration/     ← Integration tests
  helpers.js       ← Test factory functions
  setup.js         ← DB sync before tests
```

### Conventions
- All endpoints return `{ success: boolean, data?: object, message?: string }`
- All game routes require JWT auth via `authMiddleware` (attaches `req.userId`)
- Services throw errors with `statusCode` property for HTTP status override
- Tests use Jest with `maxWorkers: 1` (SQLite locking)
- Test helpers: `createTestUser()`, `createTestSector()`, `createSectorConnection()`, `createTestPort()`, `createTestCommodity()`, `addCommodityToPort()`, `createTestShip()`, `cleanDatabase()`

### Route Registration Pattern
```javascript
// server/src/routes/routePlannerRoutes.js
const express = require('express');
const { authMiddleware } = require('../middleware/auth');
const routePlannerController = require('../controllers/routePlannerController');
const router = express.Router();
router.use(authMiddleware);
router.get('/path', routePlannerController.findPath);
module.exports = router;
```
Then in `server/src/routes/index.js`:
```javascript
const routePlannerRoutes = require('./routePlannerRoutes');
router.use('/routes', routePlannerRoutes);
```

## Existing Models (relevant fields only)

### Sector
```
sector_id: UUID (PK)
name: STRING
x_coord: FLOAT
y_coord: FLOAT
type: STRING
star_class: STRING (O,B,A,F,G,K,M,Neutron,BlackHole)
hazard_level: INTEGER (0-10)
phenomena: JSON (nullable)
zone_class: STRING
security_class: STRING
```

### SectorConnection (adjacency graph)
```
connection_id: UUID (PK)
sector_a_id: UUID (FK → sectors)
sector_b_id: UUID (FK → sectors)
connection_type: STRING ('standard'|'wormhole'|'gate'|'portal')
lane_class: STRING ('hyperlane'|'protected'|'wormhole'|'gate'|'portal')
access_mode: STRING ('public'|'owner'|'corporation'|'faction'|'locked')
travel_time: INTEGER (default 1, time units to traverse)
is_bidirectional: BOOLEAN (default true)
rule_flags: JSON
```
- Indexed on `[sector_a_id]`, `[sector_b_id]`, unique `[sector_a_id, sector_b_id]`
- Associations: `SectorConnection.belongsTo(Sector, { as: 'sectorA' })` and `sectorB`

### Port
```
port_id: UUID (PK)
sector_id: UUID (FK → sectors)
name: STRING
type: STRING (port type determines commodities stocked)
is_active: BOOLEAN
tax_rate: FLOAT
```
- Association: `Port.hasMany(PortCommodity)`, `Sector.hasMany(Port, { as: 'ports' })`

### PortCommodity
```
port_commodity_id: UUID (PK)
port_id: UUID (FK → ports)
commodity_id: UUID (FK → commodities)
quantity: INTEGER (current stock)
buy_price: INTEGER (what port charges player to buy)
sell_price: INTEGER (what port pays player to sell)
```

### Commodity
```
commodity_id: UUID (PK)
name: STRING
category: STRING
base_price: INTEGER
volume: INTEGER (cargo units per item)
is_illegal: BOOLEAN
```

### Transaction (trade history)
```
transaction_id: UUID (PK)
user_id: UUID
ship_id: UUID
port_id: UUID
commodity_id: UUID
transaction_type: STRING ('BUY'|'SELL')
quantity: INTEGER
unit_price: INTEGER
total_price: BIGINT
created_at: TIMESTAMP
```

### Ship (relevant fields only)
```
ship_id: UUID (PK)
owner_user_id: UUID (FK → users)
current_sector_id: UUID (FK → sectors)
cargo_capacity: INTEGER
fuel: INTEGER
max_fuel: INTEGER
```

## New Model

### SavedRoute
```
saved_route_id: UUID (PK)
user_id: UUID (FK → users)
name: STRING (max 50)
waypoints: JSON (array of sector_id UUIDs, ordered)
mode: STRING ('fast'|'safe'|'cheap')
created_at: TIMESTAMP
```
- Association: `User.hasMany(SavedRoute)`, `SavedRoute.belongsTo(User)`
- Constraint: max 10 saved routes per user (enforce in service, not DB)

## Deliverables

### 1. Route Planner Service (`server/src/services/routePlannerService.js`)

#### `findPath(fromSectorId, toSectorId, options?)`
Weighted pathfinding on the SectorConnection graph using Dijkstra's algorithm.

**Route modes** via `options.mode` (default `'fast'`):
- `'fast'` — minimize hop count (edge weight = 1)
- `'safe'` — prefer protected lanes, avoid PvP/high-hazard sectors (edge weight: protected lane = 1, standard = 3, PvP zone = 10, hazard > 7 = 15)
- `'cheap'` — minimize fuel + toll costs (edge weight = `travel_time` + toll from `rule_flags`)

**Additional options:**
- `options.avoidHazards` (boolean) — hard-exclude sectors with `hazard_level > 7` from graph
- `options.avoidLocked` (boolean, default true) — skip connections with `access_mode === 'locked'`
- `options.maxJumps` (integer, default 50) — circuit breaker, throw if path exceeds this

**Returns:**
```javascript
{
  path: [sectorId, ...],           // ordered sector IDs from origin to destination
  jumps: number,                   // number of hops
  totalTravelTime: number,         // sum of travel_time on edges
  estimatedFuelCost: number,       // jumps × 1 fuel per hop (or weighted if applicable)
  dangerLevel: 'safe'|'mixed'|'dangerous',  // based on worst zone_class on path
  sectors: [{ sector_id, name, star_class, hazard_level, zone_class }]
}
```
- Throw with `statusCode: 404` if no path exists
- **Performance**: Load the full graph into memory once (cache it), rebuild on universe regeneration. ~200 sectors × ~600 connections fits easily in memory.

#### `findTradeRoutes(fromSectorId, options?)`
Find profitable buy→sell opportunities reachable within `options.maxJumps` (default 5).

For each port within range: compare buy prices at origin ports vs sell prices at destination ports for all commodities.

**Returns** top routes sorted by profit-per-jump:
```javascript
{
  routes: [{
    commodity: { commodity_id, name, category, volume },
    buyPort: { port_id, name, sector_id, sector_name },
    sellPort: { port_id, name, sector_id, sector_name },
    buyPrice: number,
    sellPrice: number,
    profitPerUnit: number,
    jumps: number,
    profitPerJump: number,  // profitPerUnit / jumps
    path: [sectorId, ...]
  }],
  origin: { sector_id, name },
  searchRadius: number
}
```

**Options:**
- `options.limit` (default 10) — max routes returned
- `options.minProfit` (default 1) — filter out unprofitable routes
- `options.commodityId` (optional) — filter to specific commodity
- `options.mode` (default `'fast'`) — route mode for path calculation

#### `findMultiStopRoute(sectorIds, options?)`
Given an ordered array of sector IDs (waypoints), compute the chained path visiting each in order.

**Returns:**
```javascript
{
  totalPath: [sectorId, ...],      // full path through all waypoints
  totalJumps: number,
  totalTravelTime: number,
  totalFuelCost: number,
  legs: [{                          // per-leg breakdown
    from: { sector_id, name },
    to: { sector_id, name },
    path: [sectorId, ...],
    jumps: number,
    travelTime: number
  }],
  dangerLevel: 'safe'|'mixed'|'dangerous'
}
```
- `options.mode` (default `'fast'`) — route mode applied to each leg
- Throw with `statusCode: 400` if fewer than 2 waypoints
- Throw with `statusCode: 404` if any leg has no path

#### `getReachablePorts(fromSectorId, maxJumps)`
Return all ports reachable within N jumps with their path distances.
- Used internally by `findTradeRoutes` and useful as a standalone endpoint
- Returns: `{ ports: [{ port_id, name, sector_id, sector_name, type, jumps, path }], origin, searchRadius }`

#### Saved Routes (CRUD)

#### `saveRoute(userId, { name, waypoints, mode })`
- Validate max 10 saved routes per user, throw `statusCode: 400` if exceeded
- Validate waypoints is array of 2+ valid sector UUIDs
- Create and return SavedRoute record

#### `getSavedRoutes(userId)`
- Return all saved routes for user, ordered by `created_at` desc

#### `deleteSavedRoute(userId, savedRouteId)`
- Delete route, throw `statusCode: 404` if not found or not owned by user

### 2. Graph Caching Strategy

The sector graph is static (generated once, rarely changes at runtime). Cache it:
```javascript
let graphCache = null;

const getGraph = async () => {
  if (graphCache) return graphCache;
  const connections = await SectorConnection.findAll({
    include: [
      { model: Sector, as: 'sectorA', attributes: ['sector_id', 'name', 'star_class', 'hazard_level', 'zone_class', 'security_class'] },
      { model: Sector, as: 'sectorB', attributes: ['sector_id', 'name', 'star_class', 'hazard_level', 'zone_class', 'security_class'] }
    ]
  });
  const sectors = await Sector.findAll({
    attributes: ['sector_id', 'name', 'star_class', 'hazard_level', 'zone_class', 'security_class']
  });
  // Build adjacency list: sectorId → [{ neighborId, connection }]
  graphCache = { adjacency, sectorMap };
  return graphCache;
};

const clearGraphCache = () => { graphCache = null; };
```
Export `clearGraphCache` so universe regeneration can invalidate it.

### 3. Route Planner Controller (`server/src/controllers/routePlannerController.js`)

Following the project pattern (controller handles HTTP, delegates to service):

#### `GET /api/routes/path?from={sectorId}&to={sectorId}&mode=fast&avoidHazards=true`
- Validates `from` and `to` are provided
- Validates `mode` is one of `fast`, `safe`, `cheap` (default `fast`)
- Returns path with cost breakdown

#### `GET /api/routes/trades?from={sectorId}&maxJumps=5&limit=10&commodityId={optional}&mode=fast`
- If `from` is omitted, use the requesting user's active ship's `current_sector_id`
- Needs to look up active ship: `Ship.findOne({ where: { owner_user_id: req.userId, is_active: true } })`
- Returns trade route recommendations

#### `GET /api/routes/multi?stops={sectorId1},{sectorId2},{sectorId3}&mode=safe`
- Validates at least 2 stops provided
- Returns chained multi-stop route

#### `GET /api/routes/ports?from={sectorId}&maxJumps=5`
- Returns reachable ports with distances

#### `POST /api/routes/saved` — body: `{ name, waypoints, mode }`
- Save a favorite route for the authenticated user

#### `GET /api/routes/saved`
- List user's saved routes

#### `DELETE /api/routes/saved/:id`
- Delete a saved route (must be owned by requesting user)

### 4. Routes File (`server/src/routes/routePlannerRoutes.js`)
- Mount all seven endpoints under auth middleware
- Register in `server/src/routes/index.js` as: `router.use('/routes', routePlannerRoutes);`

### 5. Tests (`server/tests/services/routePlanner.test.js`)

Test with a small synthetic graph (5-8 sectors, known connections):

**Shortest path tests:**
- A→B→C finds correct path; direct A→C if connected
- No path: disconnected sectors return 404
- Max jumps: paths beyond limit throw error

**Route mode tests:**
- `mode: 'fast'` minimizes hop count
- `mode: 'safe'` prefers protected lanes, avoids PvP zones
- `mode: 'cheap'` factors in travel_time and tolls
- `avoidHazards: true` skips high-hazard sector, takes longer route
- `avoidLocked: true` excludes locked connections

**Trade route tests:**
- Set up two ports with known prices, verify profit calculation
- Sorted by profitPerJump descending
- `minProfit` filter excludes unprofitable routes
- `commodityId` filter returns only matching commodity

**Multi-stop tests:**
- 3-stop route chains legs correctly
- Total jumps = sum of leg jumps
- Fewer than 2 stops throws 400
- Unreachable leg throws 404

**Reachable ports tests:**
- Correct port count and distances
- Ports beyond maxJumps excluded

**Saved route tests:**
- Save and retrieve a route
- Max 10 limit enforced
- Delete works, 404 for wrong owner
- Invalid waypoints rejected

**Graph caching tests:**
- Graph loads once, second call uses cache
- `clearGraphCache()` forces reload

Use test helpers from `server/tests/helpers.js` for setup. Call `cleanDatabase()` in `beforeEach`.

## Files to Create
| File | Purpose |
|------|---------|
| `server/src/services/routePlannerService.js` | Graph algorithms + trade route logic + saved routes |
| `server/src/controllers/routePlannerController.js` | HTTP handlers |
| `server/src/routes/routePlannerRoutes.js` | Express router |
| `server/tests/services/routePlanner.test.js` | Unit tests |

## Files to Modify
| File | Change |
|------|--------|
| `server/src/routes/index.js` | Add `router.use('/routes', routePlannerRoutes)` |
| `server/src/models/index.js` | Add SavedRoute model + associations |

## Risks & Mitigations
- **Risk:** Server pathfinding too slow for large galaxy. **Mitigation:** Dijkstra with in-memory adjacency list; A* with Euclidean heuristic from x_coord/y_coord if needed. ~200 sectors is trivial.
- **Risk:** Route stale if portals change. **Mitigation:** `clearGraphCache()` called on universe regeneration. Trade prices are live (not cached).
- **Risk:** Safe/Cheap mode weights need tuning. **Mitigation:** Put weights in config constants so they're easy to adjust without code changes.

## Non-Goals
- No frontend work (handled separately)
- No real-time route updates via WebSocket
- No Redis (in-memory cache is sufficient for ~200 sectors)
- Don't modify any existing models or services (except models/index.js for SavedRoute)
