# Claude Code: Consolidate All Comments Into Summaries & PRDs

## Context

You are working on the Space Wars 3000 game design planning board (`planner/`). There are **79 features** across 16 sections. Each feature has:
- A **summary** (the `desc` field -- a 1-3 sentence overview)
- A **PRD** (the `details` field -- structured with Purpose, Functional Requirements, Data Model, API Surface, UX Specification, Dependencies, Risks & Mitigations, Complexity Estimate, and Acceptance Criteria)
- **Discussion comments** from 4 reviewers: Codex (backend architecture), Droid (UX/design), Gemini (adversarial analysis), and occasionally Thoder (project owner)

There are currently **249 comments** in `planner/comments.json`. These comments contain valuable insights, corrections, design decisions, exploit mitigations, and architectural guidance that are NOT yet reflected in the summaries or PRDs.

## Your Task

For **every single feature** (all 79), do the following:

### Step 1: Read the feature and its comments
```bash
./planner/planner-cli.sh feature <feature-id>
```

### Step 2: Identify comment insights worth consolidating

For each comment, determine if it contains:
- **Design decisions** that should update the PRD requirements (e.g., "Use ABAC-style permissions" -> add to Functional Requirements)
- **Data model additions** that should update the Data Model table (e.g., "Add cooldown_until timestamp" -> add row)
- **New risks** identified by Gemini or Codex that should update Risks & Mitigations
- **UX refinements** from Droid that should update UX Specification
- **Complexity corrections** (e.g., reviewer says "this is actually Massive, not Medium")
- **New acceptance criteria** implied by the discussion
- **Exploit mitigations** that should become requirements or risks
- **Cross-feature dependencies** that should update Dependencies
- **Summary corrections** that make the desc more accurate

Skip comments that are:
- Already reflected in the PRD
- Pure agreement without new information ("Agree with Codex")
- Tangential to the feature's scope

### Step 3: Update the summary (desc)

If comments revealed important aspects not captured in the summary, update it using:
```bash
./planner/planner-cli.sh update-desc <feature-id> "Updated summary text"
```

The summary should be 1-3 sentences capturing the essence of the feature INCLUDING key design decisions from the discussion.

### Step 4: Update the PRD (details)

Edit `planner/index.html` directly to update the feature's `details` field. For each PRD section, integrate relevant comment insights:

- **Purpose**: Unchanged unless comments revealed a different core motivation
- **Functional Requirements**: Add requirements surfaced by comments (exploit mitigations, edge cases, architectural decisions)
- **Data Model**: Add columns/models/indices identified in discussion
- **API Surface**: Add endpoints identified as missing
- **UX Specification**: Integrate Droid's interaction design suggestions
- **Dependencies**: Add cross-feature dependencies flagged by reviewers
- **Risks & Mitigations**: Add risks found by Gemini and Codex with their proposed mitigations
- **Complexity & Estimate**: Update if reviewers argued convincingly for a different estimate
- **Acceptance Criteria**: Add testable criteria implied by the discussion

### Step 5: Clear processed comments

After consolidating a feature's comments into its summary and PRD, clear ALL comments for that feature from `planner/comments.json`. The insights now live in the PRD where they belong. Start fresh for the next round of discussion.

## Important Rules

1. **Do NOT discard information** -- every substantive insight from a comment must land somewhere in the summary or PRD.
2. **Resolve contradictions** -- if Gemini says one thing and Codex says another, pick the better approach and note why in the PRD.
3. **Keep PRD format consistent** -- same 9 section divs with same class names across all features.
4. **Preserve HTML structure** -- the details field uses HTML inside JavaScript template literals. Don't break the syntax.
5. **Work feature by feature** -- read, consolidate, update, then move to the next. Don't batch.
6. **Verify after each batch** -- periodically run the verification to make sure the plan still parses:
```bash
cd planner && node -e "
const fs=require('fs');const h=fs.readFileSync('index.html','utf8');
const s=h.indexOf('const PLAN=[');const e=h.indexOf('];',s)+2;
eval(h.substring(s,e).replace('const PLAN=','var P='));
console.log('OK:',P.reduce((a,s)=>a+s.features.length,0),'features');
"
```
7. **After ALL 79 features are done**, the `comments.json` should be `{}` (empty object) -- all insights consolidated.

## Architecture Reference

Read `CLAUDE.md` for full technical context. Key points:
- Backend: Node.js, Express, Sequelize, SQLite (dev) / PostgreSQL (prod)
- Auth: JWT, three middleware variants
- Models: 20+ Sequelize models
- Frontend: React 18, TailwindCSS, Vite
- Real-time: WebSocket
- Config: `server/src/config/index.js`

## Example Consolidation

**Before** (sector-zones has 3 comments):
- Codex: "Sector must be policy-driven with zone_class, security_class..."
- Droid: "Color-coded rings, entry warning modals, build priority #1"
- Gemini: "Safe harbors create tactical hopping exploit, add debuff"

**After** (PRD updated, no comments remain):
- Functional Requirements gains: "Zone policy evaluated by single ZonePolicyService" (from Codex), "Safe harbor re-dock cooldown of 5 minutes after undocking prevents tactical hopping" (from Gemini)
- UX Specification gains: "Color-coded zone rings: green=core, blue=inner, yellow=outer, orange=frontier, red=deep_space, purple=adventure" and "Entry warning modal on zone boundary crossing" (from Droid)
- Risks gains: "Safe harbor tactical hopping. Mitigation: 5-minute re-dock cooldown after undocking" (from Gemini)
- Complexity updated if reviewers argued for different estimate

## Start

```bash
./planner/planner-cli.sh features
./planner/planner-cli.sh feature sector-zones
```

Work through all 79 features in section order. Take your time -- accuracy matters more than speed.
