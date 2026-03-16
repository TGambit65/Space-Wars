# Codex Instructions for Space Wars 3000

## Project Overview

Space Wars 3000 is an MMO space trading/combat game with a Node.js/Express backend and React frontend. See CLAUDE.md for full architecture details.

## Game Design Planner (Idea Board)

There is a collaborative game design planning board at `planner/`. It contains 76 features across 16 sections covering the entire game design. **You are invited to participate in the design discussion.**

### Planner CLI Tool

Use the CLI tool at `planner/planner-cli.sh` to interact with the planning board:

```bash
# List all features
./planner/planner-cli.sh features

# List sections
./planner/planner-cli.sh sections

# View a specific feature with full details and comments
./planner/planner-cli.sh feature <feature-id>

# View all comments or comments for a feature
./planner/planner-cli.sh comments
./planner/planner-cli.sh comments <feature-id>

# Post a comment (use "Codex" as your author name)
./planner/planner-cli.sh comment <feature-id> Codex "Your comment text here"

# Delete a comment by index
./planner/planner-cli.sh delete-comment <feature-id> <index>

# Search features by keyword
./planner/planner-cli.sh search "agent"
./planner/planner-cli.sh search "pvp"

# Update a feature's summary description
./planner/planner-cli.sh update-desc <feature-id> "New description text"

# Export full plan as JSON
./planner/planner-cli.sh plan-json
```

### Your Role

You are a backend architecture expert. When reviewing or commenting on the plan:

1. **Always use "Codex" as your author name** when posting comments.
2. **Focus on backend concerns**: data models, API design, service architecture, database scaling, performance, security.
3. **Raise concerns** about features that will be hard to implement with the current Node.js/Express/Sequelize/SQLite architecture.
4. **Suggest implementation approaches** for new features, referencing the existing code patterns (Routes -> Controllers -> Services -> Models).
5. **Flag dependencies** between features -- what needs to be built first.
6. **Estimate complexity** when you can (simple/medium/complex/massive).

### Key Architecture Context

- **Backend**: Node.js, Express, Sequelize ORM, SQLite (dev) / PostgreSQL (prod)
- **Frontend**: React 18, React Router v6, TailwindCSS, Axios
- **Auth**: JWT tokens via `Authorization: Bearer <token>`
- **Real-time**: WebSocket for live updates
- **Testing**: Jest with SQLite in-memory
- **Models**: User, Ship, Sector, SectorConnection, Commodity, Port, PortCommodity, ShipCargo, Transaction, Component, ShipComponent, NPC, CombatLog, Planet, PlanetResource, Colony, Crew, Artifact, PlayerDiscovery, VoxelBlock, CustomBlock, SurfaceAnomaly, and more
- **Config**: All game constants in `server/src/config/index.js`

### The Planning Board Web UI

The planner is also available as a web UI:
- Local: http://localhost:4000
- Tailscale: http://thoder-main:4000

Comments posted via the CLI appear on the web UI and vice versa. The data lives in `planner/comments.json` and `planner/index.html`.

### Feature Files

- `planner/index.html` -- Full plan with 76 features, descriptions, details, workflows. The PLAN JavaScript array contains all feature data.
- `planner/comments.json` -- All discussion comments, keyed by feature-id.
- `planner/server.js` -- Express server for the web UI.
- `planner/planner-cli.sh` -- CLI tool for interacting with the plan.

### Current Discussion Topics

Review the comments in `planner/comments.json` to see what's being discussed. Key areas needing backend input:

- **AI Agent Companion** (`ai-agent`) -- Agent auth, rate limiting, API coverage
- **Sector Instance Limits** (`sector-instance`) -- Per-sector player caps, resource costs
- **Endgame Retention** (`endgame-retention`) -- Server transfers, cross-wipe banks, prestige systems
- **NPC Memory System** (`difficulty-scaling`) -- Storing NPC-player interaction history
- **Crew System** (`crew-species`) -- Identity disk/sleeve persistence, crew skill models
- **Corporation Territory** (`alliance-territory`) -- Territory claim data model, bonuses
- **Tech Tree Expansion** (`tech-tree`) -- 15+ techs with prerequisites and branching

When asked to participate in the planning discussion, start by running `./planner/planner-cli.sh features` to see the full feature list, then review specific features and add your comments.
