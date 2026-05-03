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
