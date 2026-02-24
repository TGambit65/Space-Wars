# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Space Wars 3000 is an MMO space trading/combat game with a Node.js/Express backend and React frontend. The backend is feature-complete across 4 development phases; the frontend is partially implemented.

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
npm run dev              # Vite dev server (port 3080, proxies /api to :5080)
npm run build            # Production build
```

## Architecture

### Backend: Layered Service Architecture (CommonJS)

**Request flow:** Routes → Middleware (auth) → Controllers → Services → Models (Sequelize)

- **Routes** (`server/src/routes/`): Mounted under `/api` prefix. All game routes require JWT auth via `authMiddleware`.
- **Controllers** (`server/src/controllers/`): Handle HTTP request/response only. Delegate business logic to services.
- **Services** (`server/src/services/`): All game logic lives here. Services call other services for complex operations. Errors thrown with a `statusCode` property for HTTP status override.
- **Models** (`server/src/models/`): Sequelize models. All associations defined centrally in `models/index.js`.

### API Response Convention

All endpoints return `{ success: boolean, data?: object, message?: string }`. Controllers catch service errors and use `error.statusCode || 500`.

### Authentication

JWT tokens via `Authorization: Bearer <token>`. Three middleware variants in `middleware/auth.js`:
- `authMiddleware` — required auth, attaches `req.user` and `req.userId`
- `optionalAuth` — populates user if token present, continues without
- `adminMiddleware` — must chain after `authMiddleware`

### Database

- **Development:** SQLite at `server/data/spacewars.sqlite` (no setup needed)
- **Production:** PostgreSQL via env vars
- Universe auto-generates on first startup via seeded RNG (`universeGenerator.js`)
- Models: User, Ship, Sector, SectorConnection, Commodity, Port, PortCommodity, ShipCargo, Transaction, Component, ShipComponent, NPC, CombatLog, Planet, PlanetResource, Colony, Crew, Artifact, PlayerDiscovery

### Frontend: React SPA

- React 18 + React Router v6 + TailwindCSS + Axios
- API client with auto JWT injection and 401 redirect in `client/src/services/api.js`
- Custom dark space theme with component classes (`card`, `btn`, `badge-*`) defined in `client/src/styles/index.css`
- No state management library — React hooks + props only

### Testing

- Jest with SQLite in-memory. Tests run sequentially (`maxWorkers: 1`) to avoid SQLite locking.
- Test helpers in `server/tests/helpers.js` provide factory functions (`createTestUser`, `createTestShip`, etc.) and `cleanDatabase()`.
- Setup in `server/tests/setup.js` syncs DB with `force: true` before all tests.
- Tests live in `server/tests/services/` (unit) and `server/tests/integration/`.

### Key Game Systems

- **Economy:** Dynamic pricing with supply/demand. 25+ commodities, 8 port types. Pricing logic in `pricingService.js`.
- **Combat:** Turn-based with shields, armor, critical hits, flee mechanics. Logic in `combatService.js`.
- **Ship Designer:** Component slots vary by ship type. Stat recalculation in `shipDesignerService.js`.
- **NPCs:** Spawn/behavior/movement in `npcService.js`. Component degradation via `maintenanceService.js`.
- **Crew:** Species-specific bonuses calculated by `crewBonusService.js`, applied to ship stats.
- **Colonies:** Resource generation ticks, population growth, infrastructure upgrades in `colonyService.js`.
- **Config:** All game constants (ship types, components, commodities, NPC types, planet types, crew species) centralized in `server/src/config/index.js`.
