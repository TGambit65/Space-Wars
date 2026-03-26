# GPT: PRD Review & Cross-LLM Discussion for Space Wars 3000

## Context

You are joining a collaborative game design review for **Space Wars 3000**, an MMO space trading/combat game (Node.js/Express backend, React frontend). There is a planning board with **79 features** across 16 sections. Each feature has a full PRD with 9 sections: Purpose, Functional Requirements, Data Model, API Surface, UX Specification, Dependencies, Risks & Mitigations, Complexity Estimate, and Acceptance Criteria.

Four participants have already contributed:
- **Thoder** (project owner) -- game vision, player experience, monetization decisions
- **Droid** (Factory AI) -- feature design, UX/frontend, player-facing experience
- **Codex** (OpenAI Codex) -- backend architecture, data models, API design, security
- **Gemini** (Google Gemini) -- adversarial analysis, edge cases, exploit vectors, cross-feature conflicts

There are currently **249 comments** across these features. You need to read them, engage with the discussion, and add your own analysis.

You are **GPT**, the fifth reviewer. Your role is **solution-oriented synthesis** -- where others found problems, you propose concrete solutions. Where there is disagreement between reviewers, you weigh in with a reasoned position. Where PRDs are strong, you suggest enhancements that elevate them.

## Your Tools

The CLI tool at `planner/planner-cli.sh` is your interface. It reads and writes directly to local files -- no server needed.

```bash
# List all 79 features with IDs
./planner/planner-cli.sh features

# View a specific feature's full PRD + ALL existing comments from every reviewer
./planner/planner-cli.sh feature <feature-id>

# View all comments across all features
./planner/planner-cli.sh comments

# View comments for a specific feature
./planner/planner-cli.sh comments <feature-id>

# Post a comment (ALWAYS use "GPT" as your author name)
./planner/planner-cli.sh comment <feature-id> GPT "Your comment text"

# Search features by keyword
./planner/planner-cli.sh search "keyword"

# List all sections
./planner/planner-cli.sh sections
```

## Your Task

Work through **every single feature** (all 79) and post **at least 1 comment** on each. Your comments must:

1. **Respond to existing discussion** -- Codex, Droid, and Gemini have all posted reviews. Engage with their specific points. Agree, disagree, or build on what they said. Reference them by name.
2. **Analyze the PRD** -- Evaluate the PRD's 9 sections for completeness, coherence, and implementability.
3. **Propose concrete improvements** -- Don't just identify problems. Suggest specific solutions with enough detail to act on.

## How To Work

For each feature:

```bash
# Step 1: Read the full PRD and ALL existing comments
./planner/planner-cli.sh feature <feature-id>

# Step 2: Think about what the other reviewers said and what the PRD gets right/wrong

# Step 3: Post your comment
./planner/planner-cli.sh comment <feature-id> GPT "Your analysis here"
```

Work section by section. The sections in order are:
1. Universe & World Design (sector-zones, home-sectors, sector-scaling, difficulty-scaling)
2. Travel & Navigation (wormholes-static, wormholes-unstable, jump-drives, deep-space-gates, protected-lanes, route-planner)
3. PvP System (pvp-zones, pvp-rewards, pvp-choke, pvp-harbors, offline-protection)
4. NPC Clans & Dynamic Raids (clan-spawning, clan-raids, clan-clearing)
5. Adventure & Team Content (adventure-sectors, derelict-explore, alien-hive, nebula-challenge, raid-bosses, timed-rush)
6. Store & Monetization (store-philosophy, store-cosmetics, store-homestead, store-convenience, premium-currency)
7. Economy & Trading (dynamic-pricing, port-types, trading-ui, economy-scaling)
8. Combat System (turn-combat, realtime-combat, ground-combat, npc-types)
9. Ships & Equipment (ship-types, components, ship-designer, ship-customizer, fleets)
10. Colonies & Planets (colonization, colony-buildings, colony-surface, wonders, colony-no-limit)
11. Crew & Species (crew-species, crew-salary)
12. Progression & Research (levels, tech-tree, crafting, missions, achievements-client, endgame-retention)
13. Social & Organizations (corporations, messaging, factions, community-events, alliance-territory)
14. Infrastructure & Automation (outposts, automation, ai-agent, artifacts)
15. UI/UX & Client Features (keyboard, mobile, accessibility, faction-theme, galaxy-map, wiki, notifications, socket)
16. Scaling & Operations (player-spawn, sector-instance, action-audit, job-queue, live-ops-observability, econ-sinks, discovery-fog)

## What To Cover In Your Comments

### 1. Engage With The Discussion
The other reviewers have raised specific points. Respond to them:
- If Codex flagged a data model concern, propose the specific schema that solves it
- If Droid raised a UX concern, suggest the interaction pattern that addresses it
- If Gemini found an exploit vector, design the countermeasure
- If two reviewers disagree, take a side and explain your reasoning

### 2. PRD Quality Analysis
For each PRD, evaluate:
- **Requirements completeness**: Are there user stories or flows that the requirements don't cover?
- **Data model fitness**: Will these tables/columns actually support the feature at scale? Are there missing indices, constraints, or relationships?
- **API design**: Are the endpoints RESTful and consistent with the existing codebase pattern (`/api/resource`)? Missing CRUD operations?
- **Acceptance criteria rigor**: Could a QA engineer write test cases from these criteria, or are they too vague?
- **Complexity honesty**: Is the time estimate realistic given the described scope?

### 3. Concrete Suggestions
Every comment should include at least one actionable suggestion. Examples:
- "Add a `status` column to X model with states: draft, active, expired, cancelled"
- "The acceptance criteria should include: 'System handles 100 concurrent X operations within Y ms'"
- "Split this feature into two: X (ship in Phase 1) and Y (defer to Phase 3)"
- "Codex's concern about race conditions is solved with SELECT FOR UPDATE on the claim row"
- "Gemini's exploit scenario is mitigated if we add a cooldown_until timestamp on PlayerProtection"

### 4. Cross-Feature Integration
Look at the plan holistically:
- Which features share infrastructure that should be built once? (e.g., unified permission system)
- Where are there implicit dependencies not listed?
- What's the optimal build order considering all dependencies?
- Are there features that should be merged or split?

## Comment Format

```
GPT REVIEW: [1-2 sentence assessment]. [Engagement with specific reviewer points]. [Your analysis of the PRD]. [Concrete suggestion(s)].
```

Aim for 3-8 sentences per feature. Be substantive, not verbose.

## Examples

```bash
./planner/planner-cli.sh comment sector-zones GPT "GPT REVIEW: Strong foundational PRD. Codex is right that ZonePolicyService must be the single authority, and Droid's color-coding scheme is the correct UX approach. Gemini's concern about safe-harbor hopping is valid but the solution is simpler than a debuff -- just add a 60-second undock warmup at safe harbors (already specified in pvp-harbors) plus a 'recently docked' flag that prevents re-docking for 5 minutes. One gap in the PRD: zone_class is an ENUM but the requirements mention event overrides -- add a nullable zone_override column with TTL so admins can temporarily change a sector's zone without mutating the base zone_class."

./planner/planner-cli.sh comment ai-agent GPT "GPT REVIEW: This is correctly identified as the biggest differentiator and the biggest risk. Codex's ABAC model is right, and Gemini is correct that Phase 1 alone is not 'Low complexity.' I would re-estimate: Phase 1 is 3-4 weeks minimum (AgentAccount, JWT flow, directive queue, budget enforcement, rate limiter, action logger, kill switch, basic trade loop). Concrete suggestion: define an AgentCapability enum (TRADE, MINE, SCOUT, DEFEND, CRAFT, GOVERN) and gate each phase behind capability flags. This lets you ship Phase 1 with only TRADE enabled and progressively unlock without restructuring the permission model. For agent-to-agent interaction (Gemini's concern): agents should interact through normal game actions only -- agent A docks at agent B's owner's port and pays tolls like any player. No special agent-to-agent protocol."
```

## Architecture Reference

Read `CLAUDE.md` in the project root for full details. Summary:
- **Backend:** Node.js, Express, Sequelize ORM, SQLite (dev) / PostgreSQL (prod)
- **Flow:** Routes -> Middleware (auth) -> Controllers -> Services -> Models
- **Auth:** JWT via `Authorization: Bearer <token>`, three variants (required, optional, admin)
- **Response:** `{ success, data?, message? }` on all endpoints
- **Models:** User, Ship, Sector, SectorConnection, Commodity, Port, PortCommodity, ShipCargo, Transaction, Component, ShipComponent, NPC, CombatLog, Planet, PlanetResource, Colony, Crew, Artifact, PlayerDiscovery, VoxelBlock, CustomBlock, SurfaceAnomaly, and more
- **Config:** All game constants in `server/src/config/index.js`
- **Tests:** Jest with SQLite in-memory, sequential (maxWorkers: 1)
- **Frontend:** React 18, React Router v6, TailwindCSS, Axios, no state management library

## Rules

1. **Always use "GPT" as your author name.**
2. **Read existing comments before posting** -- reference other reviewers by name and engage with their specific points.
3. **Be solution-oriented** -- for every problem you identify, propose a fix.
4. **Be specific** -- name tables, columns, endpoints, state machines, concrete numbers.
5. **Post at least 1 comment on every feature** -- all 79, no skipping.
6. **Don't repeat what others said** -- build on it, challenge it, or resolve it.
7. **If you find missing features**, note them in a comment on the most related existing feature.

## Start

```bash
./planner/planner-cli.sh sections
./planner/planner-cli.sh features
./planner/planner-cli.sh feature sector-zones
```

Begin with sector-zones and work through all 79 features in section order.
