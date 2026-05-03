# Space Wars 3000

A multiplayer space trading/combat game.

## Project Structure
- `server/` — Node.js Express + Socket.io backend (Sequelize, SQLite for dev, PostgreSQL for prod)
- `client/` — React + Vite frontend (port 5000 in dev, built to `client/dist` for prod)
- `site/` — Static marketing/wiki site served by the backend at `/`
- `agent-client/`, `planner/` — internal tooling

## Replit Setup
- **Backend** workflow: `cd server && node src/index.js` — listens on port 3000 (localhost). Uses SQLite (`server/data/spacewars.sqlite`) in dev.
- **Start application** workflow: `cd client && npm run dev -- --host 0.0.0.0 --port 5000` — Vite dev server on port 5000 (webview). Proxies `/api` and `/socket.io` to `http://localhost:3000`.
- `client/vite.config.js` sets `allowedHosts: true` and HMR over `wss:443` so the iframe proxy works.

## Testing
- `cd server && npm test` runs the full Jest suite (55 test files, ~900 tests, 100% passing).
- Test environment uses **in-memory SQLite** (`NODE_ENV=test` branch in `server/src/config/database.js`) — tests never touch `server/data/spacewars.sqlite` or contend with the running Backend workflow for the file lock.
- Setup file: `server/tests/setup.js` runs one global `sequelize.sync({ force: true })`. Test helpers live in `server/tests/helpers/`.
- Long full runs may exceed bash's 120s timeout; running `npx jest --maxWorkers=2 --silent` in 2-3 grouped batches works around it.

## Environment
- `server/.env` sets `PORT=3000` and `NODE_ENV=development`.
- For production (PostgreSQL): set `JWT_SECRET`, `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, `DB_PASSWORD`, and either `DB_DIALECT=postgres` or `NODE_ENV=production`.

## Deployment
- Autoscale deployment configured:
  - Build: `cd client && npm install && npm run build && cd ../server && npm install`
  - Run: `cd server && node src/index.js`
- The Express server serves the built React app from `/play` and the static site from `/`.

## 2D Surface & Ship Interior System (clean-slate v2)
The old 3D voxel surface + dual-rendering planet view and 3D ship interiors were removed. They have been replaced by **two separate 2D systems** sharing a small `engine2d` primitives library:

- `client/src/engine2d/` — `Camera2D`, `InputController` (WASD), `Avatar`, `TileGridRenderer`, `Pathing` (passability/collision/nearest-interactable), `WeatherOverlay`, `DayNightOverlay`.
- `client/src/components/colonies/PlanetSurfaceView.jsx` — top-down 2D planet surface (terrain + deposits + anomalies + buildings + custom blocks + avatar + weather + day/night).
- `client/src/components/ships/ShipInterior2DView.jsx` — multi-deck 2D ship interior. Decks, layout and interactables come from the server via `GET /api/ships/:shipId/interior?mode=normal|derelict`. Same component handles owned ships and derelict boarding.
- Server: `server/src/services/shipInteriorService.js` returns authored deck templates per hull class (small/medium/large). `server/src/controllers/shipInteriorController.js` is wired at `server/src/routes/ship.js`.
- The startup wipe in `server/src/index.js` runs once per database (tracked by a `surface_v2_wipe_done` row in `game_settings`): drops `voxel_blocks`, clears `custom_blocks` + `surface_anomalies`, nulls `colony_buildings.grid_x/y`, and resets `colonies.surface_initialized`.

## Ship-to-Ship Combat (Task #4 — unified realtime model)
Single ruleset for both PvE and PvP — the legacy auto-resolve `combat.attack` / `combat.flee` REST endpoints and the per-NPC `processCombatTick` were removed. All live combat now flows through `server/src/services/realtimeCombatService.js`:

- 10 Hz fixed-step tick loop, started on demand and stopped when no combats are active.
- One versioned event channel: `combat:event` with `{ v, seq, ts, combatId, type, ... }`. `type` discriminator covers `started | snapshot | state | hit | destroyed | escaped | warning | autopilot_on | autopilot_off | recovered | resolved`.
- `CombatInstance` now persists `state` (JSON snapshot of the live ship map), `tick_seq`, `last_tick_at`, `combat_type`. New columns are added to existing DBs by `patchCombatInstanceSchema` in `server/src/services/schemaPatchService.js`.
- Server checkpoints state to DB every 50 ticks (~5 s). On boot, `realtimeCombatService.recoverActiveCombats()` (called from `server/src/index.js` before tick startup) rebuilds any `status='active'` combats from `state` and resumes them with disconnected players in autopilot.
- `socketService.js` calls `notifyPlayerDisconnect(userId)` when a user's last socket drops and `notifyPlayerReconnect(userId)` on first reconnect; on disconnect the player's ships are flipped to `aiControlled=true` with a 60 s grace timer, then driven by the `AUTOPILOT` AI profile in `processNPCAI`. NPC tier (`npc.intelligence_tier`) is forwarded into combat state for client display.
- Client: `client/src/components/combat/CombatPage.jsx` listens to `combat:event` only (with seq de-dup), shows an autopilot badge when the server flags it, and surfaces the pre-engagement `warning` event to the targeted player. `client/src/hooks/useNPCEvents.js` was migrated off the removed `combat:ended` event to `combat:event` (filtered on terminal types). `combat.attack` and `combat.flee` were removed from `client/src/services/api.js`.

## Combat Shakedown — Derelict Manifest Boarding (Task #8)
The `buildDerelictManifest` produced by `realtimeCombatService.resolveCombat()` for every destroyed NPC is now persisted in-memory and reachable via a dedicated boarding flow:

- `server/src/services/derelictManifestService.js` — TTL'd registry (30 min) keyed by the synthetic `derelict_<npcId>` id. Tracks per-user looted crates so re-entry shows remaining crates.
- `server/src/services/lootAwardService.js` — shared crate-roll → award (credits / commodity / component) used by both the live-ship loot path and the new derelict-manifest path. The original `shipInteriorController.lootCrate` logic is the source of truth.
- `server/src/controllers/derelictController.js` + `server/src/routes/derelictRoutes.js` — `GET /api/derelicts/:derelictId/interior` and `POST /api/derelicts/:derelictId/loot`. Mounted in `server/src/routes/index.js` at `/api/derelicts`.
- `client/src/components/combat/CombatPage.jsx` — each entry in the post-combat **Derelict Wrecks Boardable** panel is now a button that navigates to `/derelict/:derelictId`.
- `client/src/App.jsx` — new `/derelict/:shipId` route reuses `ShipInterior2DView`.
- `client/src/components/ships/ShipInterior2DView.jsx` — when `shipId.startsWith('derelict_')` it dispatches to the new derelict endpoints; the regular `/ships/:id/interior` path is unchanged for owned ships and persisted derelicts.

### Manual smoke-test plan (combat → board loop)
1. Log in, fly into a sector with hostile NPCs, attack one to start PvE combat.
2. During the 5 s warning window, optionally test **disengage** (combat dissolves cleanly) or **engage_now** (skip warning).
3. Drive the tactical map: click an enemy to lock target, click empty space to set a waypoint, right-click to clear; verify the PixiJS `TacticalMap` reflects the server snapshot.
4. Destroy the NPC. The post-combat panel should show **Derelict Wrecks Boardable** with one entry per killed NPC.
5. Click a wreck — you land on `/derelict/derelict_<npcId>` and see the 2D ship-interior boarding view with the manifest's decks + remaining loot crates.
6. Walk over a crate, press **E**, and confirm a credits / commodity / component award appears and that crate disappears on re-fetch.
7. Open Bounty Board (`/bounties`), Arena Lobby (`/arena`), and Spectator View (`/spectate`) from the sidebar; queue/duel and verify spectators receive `combat:event` snapshots.
8. Restart the backend mid-combat; on reconnect, verify `recoverActiveCombats` resumes the fight with the player flagged autopilot until they reconnect.
