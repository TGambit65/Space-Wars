# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Space Wars 3000 is an MMO space trading/combat game with a Node.js/Express v5 backend and React frontend. The backend is feature-complete across 4 development phases; the frontend is partially implemented.

## Commands

### Server (from `server/`)
```bash
npm run dev              # Start dev server with nodemon (port 5080)
npm start                # Start production server
npm test                 # Run all tests with coverage
npm run test:verbose     # Tests with verbose output
npx jest --testPathPattern=services/combatService  # Run a single test file
npx jest --testNamePattern="should calculate damage"  # Run tests matching name
```

### Client (from `client/`)
```bash
npm run dev              # Vite dev server (port 3080, proxies /api and socket.io to :5080)
npm run build            # Production build (outputs to dist/, served at /play/)
```

## Architecture

### Backend: Layered Service Architecture (CommonJS)

**Entry point:** `server/src/index.js` — handles startup sequence, port resolution, DB init, socket.io setup.

**Request flow:** Routes → Middleware (auth, rate limiting) → Controllers → Services → Models (Sequelize)

- **Routes** (`server/src/routes/`): 35+ route files mounted under `/api` prefix. All game routes require JWT auth via `authMiddleware`. Admin routes at `/api/admin` require `authMiddleware` + `adminMiddleware`.
- **Controllers** (`server/src/controllers/`): Handle HTTP request/response only. Delegate business logic to services.
- **Services** (`server/src/services/`): 70+ service files. All game logic lives here. Services call other services for complex operations. Errors thrown with a `statusCode` property for HTTP status override.
- **Models** (`server/src/models/`): Sequelize models. All associations defined centrally in `models/index.js`.

### Middleware Stack

Applied in order in `app.js`:
1. **Helmet** — security headers with CSP (relaxed for CDN resources)
2. **CORS** — dynamic origin checking, WebSocket support, rate limit headers exposed
3. **Rate limiting** — general (600 req/15min prod, 1000 dev) + stricter auth limiter (100/15min). Token-aware keying (user_id if JWT valid, else IP)
4. **Body parser** — 10kb size limits (JSON and urlencoded)
5. **Auth middleware** — JWT from `Authorization: Bearer` header or cookies
6. **Error handler** (`middleware/errorHandler.js`) — transforms Sequelize errors (ValidationError→400, UniqueConstraint→409, ConnectionError→503), JWT errors→401

### API Response Convention

All endpoints return `{ success: boolean, data?: object, message?: string }`. Controllers catch service errors and use `error.statusCode || 500`. Health check at `GET /api/health`.

### Authentication

JWT tokens via `Authorization: Bearer <token>` or cookies. Three middleware variants in `middleware/auth.js`:
- `authMiddleware` — required auth, attaches `req.user` and `req.userId`
- `optionalAuth` — populates user if token present, continues without
- `adminMiddleware` — must chain after `authMiddleware`

User model has `subscription_tier` field (free/premium/elite). Voice responses require premium+.

### Database

- **Development:** SQLite at `server/data/spacewars.sqlite` (WAL mode, single connection pool, 5s busy timeout)
- **Production:** PostgreSQL via env vars (`DB_DIALECT`, `DB_POOL_MAX`, `DB_POOL_MIN`)
- **Initialization:** Checks `Sector.count()` — if new DB: `force: true` sync; if existing: `alter: false` sync. Then seeds universe, economy, achievements, and game settings.
- Universe auto-generates on first startup via seeded RNG (`universeGenerator.js`). Delete the SQLite file to regenerate.

### Real-time: Socket.io

Initialized in `index.js` via `socketService.initialize(httpServer)`. JWT auth on connection, max 3 sockets/user, chat rate limit (5 msg/10s). Room-based broadcasting (sector, faction). Custom events for NPC hails, combat alerts, level-ups, achievements.

### AI NPC System

Provider-agnostic AI system in `server/src/services/ai/`:
- **LLM providers** (8): Anthropic, OpenAI, Gemini, Grok, NVIDIA, OpenRouter, Local, None
- **STT providers** (3): OpenAI, Google, Local, None
- **TTS providers** (5): OpenAI, ElevenLabs, Google, Local, None
- Behavior trees handle 70-80% of NPC decisions; AI used for ambiguous situations
- Text-first: `response_text` always returned, `response_audio` nullable (premium+ only)
- GameSetting model (70+ defaults) with in-memory cache via `gameSettingsService`

### Static Serving (Production)

- `/play/*` — React client SPA (fallback to index.html)
- `/` — marketing site from `server/site/`
- `/wiki/*` — wiki SPA from `server/site/wiki/`

### Frontend: React SPA

- React 18 + React Router v6 + TailwindCSS + Axios
- **Lazy loading**: All 32+ routes use `React.lazy()` + Suspense with LoadingScreen fallback
- **Contexts**: `GameSessionContext` (active ship, progression, unread messages) and `NotificationContext` (toast system, max 5, auto-dismiss)
- **API client** (`client/src/services/api.js`): Axios instance with auto JWT injection, 401 redirect (except auth endpoints), 22 export objects covering 30+ API domains
- **Socket.io hooks**: `useSocket` (connection management, sector rooms), `useNPCEvents` (hails, NPC tracking, combat alerts)
- **Sound effects**: `useSoundEffects` hook — synthesized via Web Audio API (no audio files)
- **Session**: Token in `localStorage['token']`, route persistence via `localStorage['sw3k_last_page']`, cross-component communication via `window.dispatchEvent(new CustomEvent('sw3k:...'))`

### Faction Theming

CSS variables on `body[data-faction=""]` drive per-faction colors and border-radius:
- **Terran** (blue, sharp), **Zythian** (red, organic), **Automaton** (purple, technical), **Synthesis** (gold, minimal), **Sylvari** (green, soft)

### Holographic UI

`client/src/styles/effects.css` provides `.holo-panel`, `.holo-glass`, `.holo-button`, `.holo-text`, `.holo-scanlines`, `.holo-border` — sweep animations, glassmorphism, CRT effects. Used alongside Tailwind utility classes.

### Voxel Engine

`client/src/engine/` — colony surface rendering with voxel raycasting, chunk streaming, procedural terrain, building generation. Web Workers for expensive operations. Used by colony and traversal views.

### Testing

- Jest with SQLite in-memory. Tests run sequentially (`maxWorkers: 1`) to avoid SQLite locking.
- Test timeout: 30 seconds. Coverage collected from `src/` (except `index.js` and `database.js`).
- `jest.config.js` transforms ESM packages (`delaunator`, `robust-predicates`) for Jest compatibility.
- Test helpers in `server/tests/helpers.js` provide factory functions (`createTestUser`, `createTestShip`, etc.) and `cleanDatabase()`.
- Setup in `server/tests/setup.js` syncs DB with `force: true` before all tests.
- 30+ test files in `server/tests/services/` (unit) and `server/tests/integration/`.

### Key Game Systems

- **Economy:** Dynamic pricing with supply/demand. 127 commodities in 6 categories, 8 port types. Pricing logic in `pricingService.js`. Economy ticks via `economyTickService.js`.
- **Combat:** Turn-based with shields, armor, critical hits, flee mechanics. Logic in `combatService.js`. Also: `realtimeCombatService`, `groundCombatService`, `combatPolicyService`.
- **Factions:** 5 factions with bonuses, starting credits, colors, emblems. Wars via `factionWarService.js`.
- **Ship Designer:** Component slots vary by ship type. Stat recalculation in `shipDesignerService.js`.
- **NPCs:** Spawn/behavior/movement in `npcService.js`. Component degradation via `maintenanceService.js`. AI dialogue via `dialogueService.js`.
- **Crew:** Species-specific bonuses calculated by `crewBonusService.js`, applied to ship stats.
- **Colonies:** Resource generation ticks, population growth, infrastructure upgrades in `colonyService.js`. Surface editing, buildings, raids, wonders.
- **Progression:** Leveling, skills, tech tree in `progressionService.js`. Crafting, missions, corporations, automation.
- **Config:** All game constants centralized in `server/src/config/index.js` — ship types, components, commodities, NPC types, planet types, crew species, star classes, zone classes, anti-cheat thresholds.

### Startup Sequence

1. Port resolution (dev tries +0 to +9 if busy; prod fails immediately)
2. Database connection + sync
3. Schema patch (`ensureSprintWorldSchema()`)
4. Universe generation (if no sectors exist)
5. Economy seeding (if no commodities/ports)
6. Achievement catalog + game settings cache
7. HTTP server + Socket.io initialization
8. Tick system start
