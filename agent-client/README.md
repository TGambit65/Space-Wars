# Space Wars Agent Client

A standalone Node.js CLI trading agent for the Space Wars 3000 Agent API.

This client is intentionally **deterministic**. It is not a chatbot and it does not require an LLM to operate. It authenticates with an agent API key, reads the assigned directive and permissions, builds a navigation graph from the galaxy map, scans available market data, and tries to execute a buy → move → sell → refuel loop.

## What is included

- `src/api.js` — authenticated HTTP client with typed errors and request pacing
- `src/agent.js` — main control loop and recovery logic
- `src/strategy/navigator.js` — graph builder + shortest-path routing
- `src/strategy/trader.js` — route selection from observed market/port data
- `src/state.js` — in-memory runtime state and compatibility notes
- `src/logger.js` — timestamped structured logs
- `.env.example` — environment template

## Important compatibility note for the current Space Wars repo

The sprint prompt assumes the agent API can provide enough data to construct a complete autonomous trade loop:

- `GET /api/agent-api/port` should expose `port_id`, `commodity_id`, and per-commodity buy/sell listings
- `GET /api/agent-api/trade/market` should expose enough port-level detail to identify specific profitable routes

The **current repo implementation is close, but not quite there yet**:

- `/api/agent-api/port` currently returns port summaries only (`port_id`, `name`, `type`, `commodity_count`, etc.) rather than commodity listings and IDs.
- `/api/agent-api/trade/market` currently returns an aggregate commodity summary (`min_buy_price`, `max_buy_price`, etc.) rather than full port-by-port route data.

Because of that, the client is built in two layers:

1. **Intended-mode support** — if the agent API is expanded to match the sprint prompt, the client can buy, sell, refuel, and route autonomously.
2. **Current-repo compatibility mode** — when the live agent API does not expose enough commodity detail to place valid orders, the client logs the limitation clearly and exits cleanly instead of crashing or issuing invalid requests.

That behavior is deliberate. It keeps the deliverable honest and production-safe against the repo as it exists today.

## How the client works

1. Authenticates with `Authorization: Bearer <AGENT_API_KEY>`
2. Loads agent profile from `/api/agents/me`
3. Verifies `status === active`, `directive === trade`, and required permissions
4. Loads ship, cargo, and galaxy map
5. Builds an in-memory graph for navigation
6. Scans current ports and the market summary
7. Repeats:
   - refresh agent/ship/cargo state
   - refuel if fuel is below threshold
   - try to sell carried cargo if a known buyer exists
   - otherwise look for a profitable observed buy/sell route
   - otherwise explore another port sector if detailed listings are available
   - otherwise stop cleanly with a compatibility note

## Error handling built in

- 401 authentication failures stop the agent with a clear message
- 403 permission denials disable that action family and stop if it is required
- 403 rate limiting triggers a 15-second backoff and retry
- 403 daily budget exceeded stops the loop cleanly
- stopped/paused agents stop the loop cleanly
- transient network/server failures retry with exponential backoff

## Install

```bash
cd agent-client
npm install
cp .env.example .env
```

Edit `.env`:

```env
SPACEWARS_API_URL=http://localhost:5080/api
SPACEWARS_AGENT_KEY=sw3k_agent_your_key_here
SPACEWARS_LOG_LEVEL=info
SPACEWARS_LOG_FILE=
SPACEWARS_MIN_REQUEST_INTERVAL_MS=2500
SPACEWARS_LOOP_DELAY_MS=3000
SPACEWARS_REFUEL_THRESHOLD=0.25
SPACEWARS_STOP_BUDGET_BUFFER=100
SPACEWARS_MAX_CYCLES=
SPACEWARS_DRY_RUN=false
```

## Run

Continuous mode:

```bash
npm start
```

Single-cycle mode:

```bash
npm run start:once
```

Dry run:

```bash
npm start -- --dry-run --once
```

Verbose logging:

```bash
npm start -- --verbose
```

## CLI options

```text
--once
--dry-run
--verbose
--loop-delay-ms <ms>
--min-request-interval-ms <ms>
--refuel-threshold <ratio>
--stop-budget-buffer <credits>
--max-cycles <n>
--log-file <path>
--api-url <url>
--agent-key <key>
```

## OpenClaw integration notes

This project does **not need** OpenClaw to trade. The core trading engine should remain deterministic and HTTP-driven.

That said, OpenClaw can still fit around it in useful ways:

- Run this CLI from an OpenClaw agent workspace as a tool/skill
- Use OpenClaw for orchestration, operator UX, or log review
- Keep the actual trade execution inside this client so behavior remains predictable and testable

A good split is:

- **This client:** route selection, rate limiting, buying, selling, refueling
- **OpenClaw wrapper:** launch/stop, monitor logs, inject configuration, summarize outcomes

## Recommended server changes to unlock full autopilot

To make the current Space Wars repo fully satisfy the sprint prompt, the best server-side improvements would be:

1. Expand `GET /api/agent-api/port` to include per-commodity listings with `commodity_id`, `can_buy`, `can_sell`, `buy_price`, `sell_price`, and stock values.
2. Expand `GET /api/agent-api/trade/market` to include port-level opportunities or explicit best buy/best sell locations.
3. Return full telemetry from `GET /api/agents/me` to match the richer sprint shape.
4. Optionally expose estimated navigation fuel/travel cost directly for route scoring.

## Project structure

```text
agent-client/
├── package.json
├── .env.example
├── README.md
├── .gitignore
└── src/
    ├── index.js
    ├── api.js
    ├── agent.js
    ├── state.js
    ├── logger.js
    ├── util.js
    └── strategy/
        ├── navigator.js
        └── trader.js
```
