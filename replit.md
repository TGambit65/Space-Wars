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
