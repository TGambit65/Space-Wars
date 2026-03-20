# GPT 5.4 Sprint: Build the OpenClaw Agent Client

> **Target directory:** `agent-client/` (new directory at repo root)
> **Runtime:** Node.js 20+ (CommonJS or ESM — your choice, but be consistent)
> **Goal:** A standalone CLI agent that authenticates with the Space Wars 3000 agent API and autonomously trades commodities for profit.

---

## 1. What You're Building

An autonomous AI trading agent that connects to the Space Wars 3000 game server via its Agent API. The agent:

1. Authenticates using a pre-issued API key (`sw3k_agent_...`)
2. Reads its directive, permissions, and budget from the server
3. Executes a trade loop: scan markets → find profitable routes → navigate → buy low → navigate → sell high → refuel → repeat
4. Respects all server-enforced constraints (permissions, rate limits, daily credit budgets)
5. Handles errors gracefully (403 permission denied, rate limiting, low fuel, no cargo space)

This is **not** a chatbot or LLM wrapper. It's a deterministic decision engine that plays the game via HTTP API calls. Think of it like a bot for a trading game — scan, decide, act, repeat.

---

## 2. Server Context

- **Dev server:** `http://localhost:5080` (configurable via env)
- **API base path:** All agent endpoints are under `/api/agent-api/` and `/api/agents/`
- **Auth:** Every request includes `Authorization: Bearer <AGENT_API_KEY>`
- **Response format:** `{ success: boolean, data?: object, message?: string }`
- **Error codes:** 401 (bad key), 403 (permission denied / budget exceeded / rate limited / agent stopped), 404 (not found), 500 (server error)

The server is already running and fully functional. You don't need to modify any server code.

---

## 3. Complete API Reference

### 3.1 Agent Status (no permission required)

```
GET /api/agents/me
```
Returns: agent config, permissions, budget remaining, rate limits, directive from owner.

Response shape:
```json
{
  "success": true,
  "data": {
    "agent_id": "uuid",
    "owner_id": "uuid",
    "ship_id": "uuid or null",
    "name": "Agent",
    "status": "active|stopped|paused|error",
    "permissions": {
      "navigate": true,
      "trade": true,
      "scan": true,
      "dock": true,
      "combat": false,
      "colony": false,
      "fleet": false,
      "social": false
    },
    "daily_credit_limit": 5000,
    "daily_credits_spent": 0,
    "rate_limit_per_minute": 30,
    "directive": "trade|scout|defend|mine|idle",
    "directive_params": {},
    "total_actions": 0,
    "total_credits_earned": 0,
    "total_credits_spent": 0,
    "last_action_at": null,
    "last_action_type": null,
    "error_message": null
  }
}
```

### 3.2 Ship Status (requires `scan` permission)

```
GET /api/agent-api/ship
```
Returns: hull, shields, fuel, cargo capacity, current sector, ship details.

### 3.3 Ship Cargo (requires `scan` permission)

```
GET /api/agent-api/ship/cargo
```
Returns: current cargo manifest with quantities and estimated values.

### 3.4 Adjacent Sectors (requires `navigate` permission)

```
GET /api/agent-api/adjacent-sectors
```
Returns: sectors connected to current location. You can only navigate to these.

### 3.5 Navigate (requires `navigate` permission)

```
POST /api/agent-api/navigate
Content-Type: application/json

{ "target_sector_id": "UUID" }
```
Moves ship to an adjacent sector. Consumes fuel.

### 3.6 Get Port Info (requires `scan` permission)

```
GET /api/agent-api/port
```
Returns: ports in current sector with commodity listings (what they buy/sell and at what prices). Each port has a `port_id` and each listing has a `commodity_id`.

### 3.7 Get Market Summary (requires `scan` permission)

```
GET /api/agent-api/trade/market
```
Returns: market overview with commodity prices across all known ports. Use this to find price differentials for profitable trades.

### 3.8 Buy Commodity (requires `trade` permission)

```
POST /api/agent-api/trade/buy
Content-Type: application/json

{
  "ship_id": "YOUR_SHIP_UUID",
  "port_id": "PORT_UUID",
  "commodity_id": "COMMODITY_UUID",
  "quantity": 10
}
```
Buy from a port in your current sector. Costs credits (counted against daily budget). You must include `ship_id` (from `/ship`) and `port_id` (from `/port`).

### 3.9 Sell Commodity (requires `trade` permission)

```
POST /api/agent-api/trade/sell
Content-Type: application/json

{
  "ship_id": "YOUR_SHIP_UUID",
  "port_id": "PORT_UUID",
  "commodity_id": "COMMODITY_UUID",
  "quantity": 10
}
```
Sell at a port in your current sector. Earns credits.

### 3.10 Refuel (requires `trade` permission)

```
POST /api/agent-api/trade/refuel
Content-Type: application/json

{ "port_id": "PORT_UUID" }
```
Refuel at current port. Always refuel before long routes.

### 3.11 Galaxy Map (requires `scan` permission)

```
GET /api/agent-api/map
```
Returns: full galaxy map with sector coordinates and hyperlane connections. Use this to plan multi-hop routes.

### 3.12 Activate Ship (requires `navigate` permission)

```
POST /api/agent-api/activate-ship
Content-Type: application/json

{ "ship_id": "SHIP_UUID" }
```
Switch which ship you control. Only works with ships owned by your owner.

---

## 4. Server-Enforced Constraints

The server enforces these — your client does NOT need to reimplement them, but it DOES need to handle the 403 responses they produce:

| Constraint | Default | 403 Response |
|---|---|---|
| **Permissions** | navigate, trade, scan, dock = ON; combat, colony, fleet, social = OFF | `"Permission denied: <family>"` |
| **Rate limit** | 30 actions/minute | `"Rate limit exceeded"` |
| **Daily budget** | 5,000 credits/day | `"Daily budget exceeded"` |
| **Agent status** | Must be `active` | `"Agent is stopped"` / `"Agent is paused"` |
| **Ship assignment** | Must have ship_id set | 400: `"No ship assigned to this agent"` |

### How to Handle 403s

- **Rate limited:** Back off for 10-15 seconds, then retry
- **Budget exceeded:** Stop trading for the day, log the event
- **Permission denied:** Skip that action type entirely, don't retry
- **Agent stopped/paused:** Exit the main loop cleanly

---

## 5. Project Structure

```
agent-client/
├── package.json
├── .env.example
├── README.md
├── src/
│   ├── index.js          # Entry point — parse args, load config, start agent loop
│   ├── api.js            # HTTP client wrapper (axios or fetch) with auth header injection
│   ├── agent.js          # Main agent class — orchestrates the trade loop
│   ├── strategy/
│   │   ├── trader.js     # Trade strategy: find routes, calculate profit margins
│   │   └── navigator.js  # Pathfinding: BFS/Dijkstra over galaxy map for multi-hop routes
│   ├── state.js          # Agent state manager (ship status, cargo, known markets, current plan)
│   └── logger.js         # Structured logging (console with timestamps, optional file output)
├── .env                  # (gitignored) SPACEWARS_API_URL, SPACEWARS_AGENT_KEY
└── .gitignore
```

### Environment Variables

```env
SPACEWARS_API_URL=http://localhost:5080/api
SPACEWARS_AGENT_KEY=sw3k_agent_<your_key_here>
```

### Dependencies (minimal)

- `axios` or `node-fetch` — HTTP client (pick one)
- `dotenv` — env loading
- No other runtime deps needed. This is a simple HTTP client, not an LLM app.

---

## 6. Core Architecture

### 6.1 API Client (`api.js`)

A thin HTTP wrapper that:
- Injects `Authorization: Bearer <key>` on every request
- Parses response JSON
- Throws typed errors for 401/403/404/500
- Has methods matching each endpoint (e.g., `getShip()`, `navigate(sectorId)`, `buy(shipId, portId, commodityId, qty)`)

### 6.2 Agent State (`state.js`)

Tracks:
- Ship status (hull, fuel, cargo capacity, cargo contents, current sector)
- Known market data (prices at each port, keyed by sector+port)
- Agent config (permissions, budget remaining, rate limit)
- Current plan (e.g., "buy Ore at port X, navigate to sector Y, sell at port Z")

### 6.3 Navigator (`strategy/navigator.js`)

- On startup, fetch the full galaxy map via `GET /map`
- Build an adjacency graph in memory
- Implement BFS or Dijkstra shortest-path between any two sectors
- Return the hop-by-hop route as an array of sector UUIDs

### 6.4 Trader (`strategy/trader.js`)

The profit-finding engine:
1. Fetch market summary (`GET /trade/market`)
2. For each commodity, find the port with the lowest buy price and the port with the highest sell price
3. Calculate profit per unit: `sell_price - buy_price`
4. Factor in route distance (fewer hops = better, since each hop costs fuel)
5. Rank trade routes by profit-per-hop (or total profit if cargo is small)
6. Return the best route as: `{ buySector, buyPort, commodity, sellSector, sellPort, expectedProfit, hops }`

### 6.5 Main Loop (`agent.js`)

```
1. GET /agents/me → check directive, permissions, budget
2. If directive !== 'trade' or status !== 'active' → log and exit
3. GET /ship → cache ship status
4. GET /map → build nav graph (once, cache it)
5. Loop:
   a. GET /trade/market → find best trade route
   b. Navigate to buy sector (multi-hop via navigator)
      - At each hop: check fuel, refuel if needed
   c. GET /port → get port_id and commodity_id
   d. POST /trade/buy → buy max quantity within budget and cargo space
   e. Navigate to sell sector (multi-hop)
   f. GET /port → get sell port_id
   g. POST /trade/sell → sell all cargo
   h. Log profit, update state
   i. Check budget remaining — if near limit, stop
   j. Sleep 2-3 seconds between actions (stay under rate limit)
   k. Repeat from (a)
```

### Error Recovery

- **Low fuel:** If fuel < 25%, find nearest port and refuel before continuing
- **No port in sector:** Navigate to next sector on route
- **Cargo full:** Skip buy, go sell
- **Empty cargo after sell attempt:** Re-scan market for new route
- **403 rate limited:** `await sleep(15000)` then retry
- **403 budget exceeded:** Log and exit loop cleanly
- **Network error:** Retry up to 3 times with exponential backoff, then exit

---

## 7. Acceptance Criteria

1. `cd agent-client && npm install && npm start` runs the agent
2. Agent authenticates and logs its config (name, directive, permissions, budget)
3. Agent fetches galaxy map and builds pathfinding graph
4. Agent finds a profitable trade route and logs it
5. Agent navigates to the buy port (logging each hop)
6. Agent buys commodities and logs the purchase
7. Agent navigates to the sell port
8. Agent sells and logs the profit
9. Agent refuels when fuel drops below 25%
10. Agent respects rate limits (no more than ~25 calls/minute to stay safe)
11. Agent stops cleanly on 403 budget exceeded or agent stopped
12. Agent handles all error cases without crashing
13. Logs are clear enough to follow what the agent is doing and why

### Not Required

- No LLM integration — this is pure algorithmic trading
- No WebSocket/real-time — polling via HTTP is fine
- No combat, colony, fleet, or social actions
- No persistence between runs (fresh state each startup is fine)
- No tests required (but welcomed)
- No UI — CLI output only

---

## 8. Game Knowledge (for smarter trading)

The galaxy has ~200 sectors connected by hyperlanes. Ports have different types that determine what they buy/sell:

- **Technology** ports: sell tech goods, buy raw materials
- **Industrial** ports: sell manufactured goods, buy ore/metals
- **Agricultural** ports: sell food/organics, buy technology
- **Mining** ports: sell ore/metals, buy food/equipment
- **Energy** ports: sell fuel/energy, buy various goods
- **Trading Hub** ports: buy and sell everything at moderate prices
- **Black Market** ports: high-risk high-reward commodities
- **Luxury** ports: sell luxury goods, buy exotic materials

Prices are dynamic — supply and demand shift over time. Buy where supply is high (low prices), sell where demand is high (high prices). The best profits come from multi-hop routes between complementary port types (e.g., buy ore at Mining → sell at Industrial).

---

## 9. Getting Started

1. The game server must be running (`cd server && npm run dev` — port 5080)
2. Log in to the game UI at `http://localhost:3080`
3. Navigate to the AI Agent page and create an agent
4. Copy the API key shown (it's only shown once)
5. Paste it into `agent-client/.env` as `SPACEWARS_AGENT_KEY`
6. Assign a ship to the agent and set its directive to `trade`
7. Set agent status to `active`
8. Run `cd agent-client && npm start`

---

## 10. Important Notes

- **Do NOT modify anything outside `agent-client/`** — this is a standalone client
- The server is SQLite-based in dev, so the galaxy is deterministic (same seed = same universe)
- All UUIDs are v4 format (e.g., `550e8400-e29b-41d4-a716-446655440000`)
- The market data from `GET /trade/market` gives you a global view — use it to plan, then use `GET /port` for the specific port/commodity IDs you need for buy/sell calls
- `ship_id` for buy/sell calls comes from `GET /ship` response (your assigned ship's UUID)
- `port_id` and `commodity_id` for buy/sell calls come from `GET /port` response
- Fuel consumption per hop varies by ship type — monitor fuel after each navigation

---

## 11. Quick Reference: All Endpoints

| Method | Endpoint | Permission | Body |
|--------|----------|------------|------|
| GET | `/api/agents/me` | none | — |
| GET | `/api/agent-api/ship` | scan | — |
| GET | `/api/agent-api/ship/cargo` | scan | — |
| GET | `/api/agent-api/adjacent-sectors` | navigate | — |
| POST | `/api/agent-api/navigate` | navigate | `{ target_sector_id }` |
| GET | `/api/agent-api/port` | scan | — |
| GET | `/api/agent-api/trade/market` | scan | — |
| POST | `/api/agent-api/trade/buy` | trade | `{ ship_id, port_id, commodity_id, quantity }` |
| POST | `/api/agent-api/trade/sell` | trade | `{ ship_id, port_id, commodity_id, quantity }` |
| POST | `/api/agent-api/trade/refuel` | trade | `{ port_id }` |
| GET | `/api/agent-api/map` | scan | — |
| POST | `/api/agent-api/activate-ship` | navigate | `{ ship_id }` |
