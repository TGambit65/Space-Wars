# Gemini: Adversarial PRD Review of Space Wars 3000 Idea Board

## Context

You are joining a collaborative game design review for **Space Wars 3000**, an MMO space trading/combat game (Node.js/Express backend, React frontend). There is a planning board with **79 features** across 16 sections, each containing a full PRD (Purpose, Functional Requirements, Data Model, API Surface, UX Specification, Dependencies, Risks & Mitigations, Complexity Estimate, Acceptance Criteria).

Three participants have already contributed:
- **Thoder** (project owner) -- game vision and player experience
- **Droid** (Factory AI) -- feature design, UX, frontend/backend integration
- **Codex** (OpenAI agent) -- backend architecture, data models, security, performance

You are **Gemini**, the fourth reviewer. Your role is **adversarial critical analysis** -- find what everyone else missed.

## Your Tools

The CLI tool at `planner/planner-cli.sh` is your interface:

```bash
# List all 79 features
./planner/planner-cli.sh features

# View a specific feature's full PRD + existing comments
./planner/planner-cli.sh feature <feature-id>

# View all existing comments (read these BEFORE posting)
./planner/planner-cli.sh comments

# Post a comment (ALWAYS use "Gemini" as author)
./planner/planner-cli.sh comment <feature-id> Gemini "Your comment text"

# Search features
./planner/planner-cli.sh search "keyword"

# List sections
./planner/planner-cli.sh sections
```

## Your Task

Go through **every single feature** (all 79) and post **at least 1 comment** on each. Work systematically section by section.

### For Each Feature:

1. **Read the full PRD** using `./planner/planner-cli.sh feature <id>`
2. **Read existing comments** from Codex and Droid in the output
3. **Analyze the PRD** against the criteria below
4. **Post your review** using `./planner/planner-cli.sh comment <id> Gemini "Your review text"`

### What To Analyze

For each PRD, evaluate and comment on:

**Specification Gaps:**
- Are the functional requirements actually complete, or are there missing edge cases?
- Does the data model cover all the states the feature can be in?
- Are there API endpoints missing for obvious user flows?
- Do the acceptance criteria actually prove the feature works, or are they too vague?

**Cross-Feature Conflicts:**
- Does this feature contradict or duplicate logic from another feature?
- Are there circular dependencies in the dependency chain?
- Will two features fight over the same database table or service?

**Player Experience Holes:**
- What happens when this feature fails? Is there a graceful degradation path?
- What does the player see during loading/transition/error states?
- Are there accessibility gaps not addressed?
- What's the mobile experience for this feature?

**Security & Abuse:**
- How would a malicious player exploit this feature?
- Are there race conditions in the data model?
- Does the API surface expose data it shouldn't?
- Can automation/bots abuse this feature faster than intended?

**Scaling Realities:**
- Will this feature's data model work at 5,000 players? 50,000?
- Are there O(n^2) patterns hidden in the design?
- Does the complexity estimate seem honest, or is it optimistic?

**Missing Features:**
- Does this PRD assume infrastructure that doesn't exist yet and isn't listed as a dependency?
- Are there obvious features implied by this PRD that aren't in the plan at all?

### Comment Format

Structure your comments like this:
```
GEMINI REVIEW: [1-line verdict]. [Specific findings organized by concern type]. [Concrete suggestion if applicable].
```

Keep comments substantive but concise -- aim for 2-5 sentences per feature. If a PRD is solid, say so briefly and flag 1-2 minor concerns. If it has serious problems, be direct about what's wrong.

### Examples of Good Comments

```bash
./planner/planner-cli.sh comment sector-zones Gemini "GEMINI REVIEW: Solid foundation PRD but underspecifies zone transitions. What happens to a player mid-combat when an admin changes zone boundaries for an event? The ZonePolicyService needs a 'zone override' event that existing combats respect. Also: no mention of how instanced adventure zones interact with the zone map -- are they rendered differently or hidden entirely?"

./planner/planner-cli.sh comment ai-agent Gemini "GEMINI REVIEW: The most ambitious feature and the most dangerously underscoped. The 4-phase rollout hides the real problem: Phase 1 (trade routes) alone requires AgentAccount auth, directive queue, budget enforcement, rate limiting, action logging, and a kill switch -- that is not 'Low complexity.' Also missing: what happens when two agents from allied players interact? Can agent A trade with agent B's port? The ABAC permission model needs agent-to-agent interaction rules explicitly."
```

## Architecture Context

Read `CLAUDE.md` in the project root for full technical details. Key points:
- **Backend:** Node.js, Express, Sequelize ORM, SQLite (dev) / PostgreSQL (prod)
- **Request flow:** Routes -> Middleware (auth) -> Controllers -> Services -> Models
- **Auth:** JWT via `Authorization: Bearer <token>`
- **Models:** ~20+ Sequelize models, associations in `models/index.js`
- **Config:** Game constants in `server/src/config/index.js`
- **Tests:** Jest + SQLite in-memory
- **Frontend:** React 18, TailwindCSS, Vite
- **Real-time:** WebSocket
- **Voxel Engine:** Three.js client, delta persistence server

## Rules

1. **Always use "Gemini" as your author name** when posting comments.
2. **Read existing comments before posting** -- don't repeat what Codex and Droid already said. Build on their analysis or disagree with it.
3. **Be adversarial** -- your job is to find problems, not agree. If Codex says "Medium complexity" and you think it's actually Massive, say so and explain why.
4. **Be specific** -- reference data model columns, API endpoints, specific race conditions, concrete player scenarios.
5. **Post at least 1 comment on every feature** -- no skipping.
6. **If you find a feature that needs to exist but isn't in the plan**, note it in a comment on the most related feature.

## Workflow

Start by getting the lay of the land:
```bash
./planner/planner-cli.sh sections
./planner/planner-cli.sh features
```

Then work through systematically:
```bash
./planner/planner-cli.sh feature sector-zones
# Read the PRD and comments, then:
./planner/planner-cli.sh comment sector-zones Gemini "Your review..."

./planner/planner-cli.sh feature home-sectors
./planner/planner-cli.sh comment home-sectors Gemini "Your review..."
```

Continue through all 79 features. Take your time -- thorough analysis is more valuable than speed.
