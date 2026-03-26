# Codex: Join the Space Wars 3000 Idea Board

## What's Happening

We have a collaborative game design planning board for Space Wars 3000 -- an MMO space trading/combat game. The board has **76 features across 16 sections** covering everything from universe design to PvP systems to AI agent companions. Three participants are contributing:

- **Thoder** (project owner) -- game vision, player experience, monetization
- **Droid** (Factory AI) -- feature design, UX, frontend/backend integration
- **Codex** (you) -- backend architecture, data models, API design, performance, security

The planning board lives in `planner/` in this project directory. You share this working directory with the other agents.

## How to Access the Idea Board

### CLI Tool (your primary interface)

```bash
# List all 76 features
./planner/planner-cli.sh features

# View a specific feature with full details, workflow, and comments
./planner/planner-cli.sh feature <feature-id>

# See all current comments/discussion
./planner/planner-cli.sh comments

# Post a comment (ALWAYS use "Codex" as author)
./planner/planner-cli.sh comment <feature-id> Codex "Your comment text"

# Search for features by keyword
./planner/planner-cli.sh search "agent"

# Update a feature's summary description
./planner/planner-cli.sh update-desc <feature-id> "New description"

# List sections
./planner/planner-cli.sh sections
```

### Direct File Access

- **Feature data**: `planner/index.html` -- contains the `PLAN` JavaScript array with all 76 features (id, title, desc, details, tags, workflow)
- **Comments**: `planner/comments.json` -- all discussion comments, keyed by feature-id. You can read and write this file directly.
- **CLI tool**: `planner/planner-cli.sh` -- shell wrapper for common operations

### Web UI (read-only for context)

The board is also viewable at http://localhost:4000 and via Tailscale at http://thoder-main:4000. Comments you post via CLI show up on the web UI instantly.

## Your Tasks

### 1. Review EVERY Feature Summary (Adversarial Critical Review)

Go through all 76 features and post comments with an adversarial critical review of each summary. For each feature, evaluate:

- **Feasibility**: Can this be built with our current stack (Node.js/Express/Sequelize/SQLite->PostgreSQL)? What's the real complexity?
- **Data Model Gaps**: What models/tables/columns are missing? What associations need to exist?
- **API Surface**: What endpoints are needed? Are there auth/permission concerns?
- **Performance Risks**: Will this feature cause scaling problems? N+1 queries? Memory issues? Tick processing bottlenecks?
- **Security Concerns**: Can this be exploited? Race conditions? Data leaks?
- **Dependencies**: What other features must be built first?
- **Vague Specs**: What's underspecified that will bite us during implementation?

Post your review as a comment on each feature. Be direct and specific. If a feature is well-specified, say so briefly. If it has problems, explain exactly what they are.

Format your comments like:
```
./planner/planner-cli.sh comment <feature-id> Codex "REVIEW: [brief assessment]. [specific concerns]. [suggested approach]."
```

### 2. Expand the AI Agent Companion System

The `ai-agent` feature is a key differentiator. Review it (`./planner/planner-cli.sh feature ai-agent`) and then:

- **Post detailed comments** on how YOU would architect the agent system from a backend perspective
- Cover: agent authentication (sub-account model), rate limiting strategy, which API endpoints agents need access to, how to scope agent permissions, how to log/audit agent actions, how to handle agent-to-agent interactions
- Address the agent crew management (agents have their own ships with crew members)
- Think about the agent marketplace concept (sharing/selling agent configurations)
- Consider the autonomous sector governor system where agents can be placed as governors
- Update the feature description if you have a better architectural vision

### 3. Read Existing Comments

Before posting, read the existing discussion:
```bash
./planner/planner-cli.sh comments
```

Droid has left comments on several features specifically calling out backend questions for you. Address these directly.

### 4. Add New Features If Needed

If your review reveals features that are missing from the plan (e.g., a Rate Limiting System, an Audit Log System, a Migration Strategy), add them by:

1. Editing `planner/index.html` to add a new feature object to the appropriate section in the PLAN array
2. Posting a comment explaining why you added it

## Architecture Context

Read `CLAUDE.md` and `CODEX.md` in the project root for full architecture details. Key points:

- **Backend**: Node.js, Express, Sequelize ORM, SQLite (dev) / PostgreSQL (prod)
- **Request flow**: Routes -> Middleware (auth) -> Controllers -> Services -> Models
- **Auth**: JWT via `Authorization: Bearer <token>`, `authMiddleware` in `middleware/auth.js`
- **Models**: ~20 Sequelize models, associations in `models/index.js`
- **Config**: Game constants in `server/src/config/index.js`
- **Tests**: Jest + SQLite in-memory, helpers in `server/tests/helpers.js`
- **Real-time**: WebSocket for live updates
- **Voxel Engine**: 3D Minecraft-style colony surfaces (Three.js client, delta persistence server)

## Important Rules

1. **Always use "Codex" as your author name** when posting comments.
2. **Be specific and technical** -- reference actual model names, endpoint patterns, Sequelize features.
3. **Don't hold back on criticism** -- if a feature is underspecified, unrealistic, or has security holes, say so.
4. **Suggest implementation approaches** -- don't just point out problems, propose solutions.
5. **Flag dependencies** between features and suggest build order.
6. **Estimate complexity** where possible: Simple (1-2 days), Medium (3-5 days), Complex (1-2 weeks), Massive (1+ month).

Start by running `./planner/planner-cli.sh features` to see the full list, then work through them systematically.
