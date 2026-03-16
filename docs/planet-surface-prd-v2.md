# Product Requirements Document: Planet Surface View
## Space Wars 3000 — Colony Base Building + Ground Combat

**Version:** 2.0
**Date:** 2026-03-13
**Status:** Post-Review — 6 adversarial review cycles completed (3 on v1.0, 3 on v2.0)
**Changelog:** v1.0 → v2.0: Resolved all 6 open questions. Fixed terrain model (buildable/passable independence, highland rename, landing_zone type). Removed DB terrain storage in favor of deterministic generation. Removed per-instance footprint fields. Added daily anomaly retention system. Added cached adjacency multiplier. Added spatial validation service. Split combat persistence (roster vs snapshot). Added async combat design. Added onboarding flow. Added security requirements. Added telemetry plan. Bumped grid sizes. Added undo mechanic. Added legacy migration strategy. Review 4: Fixed TOCTOU race in spatial validation (Colony FOR UPDATE lock-first), added adjacency cascade recalculation, replaced polymorphic GroundUnit FK with concrete nullable FKs, added repair mechanic spec, specified anomaly lazy-spawn/cleanup, simplified block cap formula, fixed terrain seed hash, added anomalies to spatial validation, added combat surface lock on block endpoints. Review 5: Gas giant Atmospheric Platform terrain profile, targetable blocks in combat, AFK griefing timers, seeded PRNG requirement. Review 6: Split GET /surface from POST /initialize for REST purity, defined adjacency stacking semantics, per-turn auto-end-turn vs global forfeit distinction, repair accessible from colony management page, onboarding branching for legacy vs new, resource deposit formalization, Phase 3 independence from Phase 2, performance budget, Phase 3 sub-phasing (3A NPC / 3B PvP).

---

## 1. Overview

### 1.1 Problem Statement
Players currently manage colonies as abstract lists of buildings with no spatial element. The colony screen is functional but lacks engagement — buildings are database records with no visual placement, no layout strategy, and no sense of ownership. Players have no reason to return to colonies after initial setup beyond checking passive production numbers.

### 1.2 Proposed Solution
Add a 2D tile-grid planet surface view where players visually place buildings on procedurally generated terrain, build custom freeform structures, and defend against ground invasions. This transforms colonies from a passive income mechanic into an active gameplay loop that drives daily retention.

### 1.3 Success Metrics
- **Daily Active Users (DAU)**: 20%+ increase in return visits within 7 days of launch
- **Session Duration**: Average session length increases by 30%+ (base building is time-sink gameplay)
- **Colony Interaction Rate**: 50%+ of players with colonies visit the surface view at least once per session
- **Retention (D7)**: Improvement from baseline after Phase 1 ships

**Validation requirement**: These metrics are hypotheses to be validated by A/B testing within 14 days of Phase 1 launch. If D7 retention does not show statistically significant improvement, escalate anomaly/deposit rotation rates before proceeding to Phase 2.

### 1.4 Telemetry Events
Instrument these to validate success metrics:
- `surface_view_open` (colony_id, is_first_visit)
- `building_placed` / `building_relocated` (colony_id, building_type, coordinates)
- `anomaly_claimed` / `anomaly_expired` (colony_id, anomaly_type, reward)
- `block_placed` / `block_removed` (colony_id, block_type)
- `combat_initiated` / `combat_resolved` (colony_id, attacker_id, outcome)
- `surface_session_duration` (colony_id, seconds_active — measured via Page Visibility API, timer runs only while visible and user interacted within last 60s)

---

## 2. Current State

### 2.1 Existing Colony System
- **Colony Model**: `colony_id`, `planet_id`, `user_id`, `name`, `population`, `infrastructure_level` (1-10), `developing_until`, `defense_rating`, `last_raid`, `raid_damage`
- **ColonyBuilding Model**: `building_id`, `colony_id`, `building_type`, `level` (1-3), `is_active`, `workforce`, `condition` (0-1), `last_production` — **NO spatial fields (no grid_x/grid_y)**
- **15 building types** across 4 categories: extraction (mining, hydroponics), infrastructure (power plant, habitat, spaceport, trade hub, academy, command center), manufacturing (factory, ore refinery, weapons factory, shipyard), defense (turret, shield generator)
- **3-tier upgrade chains** per building, production requires power balance and input commodities
- **NPC colony raids**: Passive system — `defense_rating` vs `raid_strength`, no player-controlled ground combat
- **10 planet types**: terrestrial, oceanic, desert, volcanic, arctic, jungle, barren, gas_giant, crystal_world, tomb_world — each with size (1-10), gravity, habitability, temperature

### 2.2 Existing Tech Stack
- **Backend**: Node.js/Express, Sequelize ORM, SQLite (dev) / PostgreSQL (prod), CommonJS
- **Frontend**: React 18, React Router v6, TailwindCSS, Axios
- **Rendering**: Canvas2D (galaxy map), Three.js (3D system orbital view), **PixiJS 8.16 installed but unused**
- **Design system**: Custom dark space theme with holographic CSS effects (`holo-panel`, `holo-glass`, etc.)

### 2.3 Rendering Decision
**PixiJS 2D tile grid** (top-down) was selected over:
- **3D Voxel (Minecraft-literal)**: Scope explosion — 10x effort for marginal engagement gain in a browser game.
- **2.5D Isometric**: Unnecessary rendering complexity (sorting, z-ordering) without meaningful gameplay benefit.
- **Zone-based (no grid)**: Too abstract — loses the spatial planning and "my base" feeling that drives retention.
- **PixiJS is already installed** (v8.16) and unused — zero new render dependencies.

---

## 3. Feature Specification

### Phase 1: Colony Surface Grid + Visual Building Placement + Daily Loop (MVP)

#### 3.1.1 Terrain Generation
- **Grid size** scales with planet size (bumped from v1.0 to support max buildings + 500 blocks):
  - Small (size 1-3): 24x24
  - Medium (size 4-6): 32x32
  - Large (size 7-9): 40x40
  - Huge (size 10): 48x48
- **13 terrain types** with independent `buildable` and `passable` properties:

| Terrain | Buildable | Passable | Special |
|---------|-----------|----------|---------|
| plains | Yes | Yes | — |
| rocky | Yes | Yes | +15% extraction bonus |
| water | No | No | Adjacency bonus for hydroponics |
| lava | No | No | Adjacency hazard |
| ice | Yes | Yes | — |
| sand | Yes | Yes | — |
| highland | No | Yes | +30% defense, -50% speed (combat) |
| crystal | Yes | Yes | +20% research bonus |
| swamp | Yes | Yes | -50% speed (combat) |
| volcanic_vent | No | No | +30% power bonus (adjacency) |
| landing_zone | No | Yes | Edge tiles reserved for Phase 3 invasion entry |
| metal_grating | Yes | Yes | Gas giant atmospheric platform |
| open_sky | No | No | Gas giant void (replaces water/lava) |

- **Buildable vs passable are independent**: Highland is not buildable but IS passable with combat penalties. Landing zones are not buildable but ARE passable. This distinction matters for Phase 3 ground combat pathfinding.
- **Gas giants**: Use "Atmospheric Platform" terrain profile — `metal_grating` (buildable/passable) replaces plains, `open_sky` (unbuildable/impassable) replaces water/lava. Ensures existing gas giant colonies get full surface grid parity (adjacency bonuses, anomalies, combat).
- **Planet-type profiles** determine terrain distribution (10 profiles for 10 planet types)
- **Procedural generation** via seeded simplex noise using hash of `colony_id + ':' + planet_id` as seed (NOT arithmetic addition — `a+b == b+a` causes collisions). Deterministic: same inputs always produce same grid.
- **PRNG requirement**: `simplex-noise` requires a `random` function parameter — its default is `Math.random()` which is NOT deterministic. Shared utility MUST include a seeded PRNG (e.g., mulberry32) that converts the seed hash into a deterministic random function.
- **No DB terrain storage** — terrain generated on-the-fly by both server (validation) and client (rendering) from shared utility. Avoids DB bloat and ensures consistency.
- **Seed versioning**: `surface_version` INTEGER on Colony model tracks algorithm version. If terrain generation changes in a future release, bump version and regenerate.
- **Floating-point parity**: Round noise values to 4 decimal places before threshold comparison. Pin `simplex-noise` to exact version in both server and client.
- **Constraints**: At least 30% contiguous buildable area; 1-3 resource deposit clusters with visible markers; landing_zone tiles on grid edges

#### 3.1.2 Building Placement
- Each of the 15 existing building types gets a defined **footprint** stored in config (NOT per-instance):

| Building | Footprint | Building | Footprint |
|----------|-----------|----------|-----------|
| mining_facility | 2x2 | trade_hub | 2x2 |
| power_plant | 2x2 | academy | 2x2 |
| hydroponics_farm | 2x1 | shipyard | 3x3 |
| research_lab | 2x2 | command_center | 2x2 |
| defense_turret | 1x1 | factory | 3x2 |
| shield_generator | 2x2 | weapons_factory | 3x2 |
| spaceport | 3x3 | ore_refinery | 2x2 |
| habitat_dome | 2x2 | | |

- **No `footprint_w`/`footprint_h` on the database model** — footprint is a property of the building *type* in config. Per-instance storage would be redundant, risk stale data on balance patches, and mask bugs.
- **All building type IDs must match canonical keys in `config.colonyBuildings` exactly** — never hand-write building lists; generate from the existing config registry.
- Players select a building from a toolbar, see a **ghost footprint** that follows the cursor (green = valid, red = blocked)
- Placement validates via centralized **spatial validation service**: all tiles under footprint are (a) buildable terrain, (b) no overlap with existing building footprints, (c) no overlap with custom blocks except `floor` type (Phase 2), and (d) no overlap with active (unexpired) anomalies
- **Concurrent mutation prevention**: Every surface mutation is wrapped in a Sequelize transaction. The FIRST operation is `Colony.findOne({ lock: FOR UPDATE })` — this acquires an exclusive row lock that serializes all surface mutations for that colony. All spatial validation reads happen AFTER this lock, within the same transaction. Prevents TOCTOU races.
- Placement triggers existing `constructBuilding` logic (credit cost, workforce, infrastructure requirements) then stores grid coordinates
- Buildings can be **relocated** for 25% of original build cost + 10-minute cooldown per building. **Exception**: Relocating an extraction building onto an active rotated resource deposit costs 10% and bypasses cooldown.

#### 3.1.3 Undo Mechanic
- 10-second free undo window after building placement — cancel construction for full refund, tiles freed
- **Server-side validation**: Enforced via `placed_at` timestamp on `ColonyBuilding`. The `/undo` endpoint rejects requests where `Date.now() - placed_at > 10000ms`.
- After 10 seconds, relocation rules apply (credit cost + cooldown)
- Cannot relocate buildings under construction
- First relocation free for auto-placed legacy buildings (see 3.1.8)

#### 3.1.4 Adjacency Bonus System
- **Adjacency multipliers affect OUTPUT production only** — they do NOT scale input consumption (power, materials). Prevents placement-triggered power blackouts. Ghost footprint UI displays projected power delta.
- **Adjacency = Manhattan distance ≤ 2** from any tile of the building's footprint to any tile of the bonus source (building footprint or terrain tile)
- For multi-tile buildings, the closest edge tiles are used
- **Stacking semantics**: Same-rule bonuses do NOT stack (Mining Facility near two Ore Refineries = 1.2x, not 1.44x). Different-rule bonuses multiply (Research Lab near Academy AND on Crystal = 1.2 × 1.15 = 1.38x).
- Bonuses:

| Building | Adjacent To | Multiplier |
|----------|------------|------------|
| Mining Facility | Ore Refinery | 1.20x |
| Ore Refinery | Factory | 1.15x |
| Ore Refinery | Mining Facility | 1.10x |
| Factory | Ore Refinery | 1.15x |
| Factory | Weapons Factory | 1.10x |
| Research Lab | Academy | 1.20x |
| Research Lab | Crystal terrain | 1.15x |
| Power Plant | Volcanic Vent | 1.30x |
| Hydroponics Farm | Water terrain | 1.20x |

- **Cached multiplier**: `cached_multiplier` FLOAT column on ColonyBuilding, recalculated only on place/move/demolish — NOT during production tick. Production tick reads `base_production * cached_multiplier`. This prevents O(N²) adjacency calculation from blocking the Node.js event loop during global production ticks across thousands of colonies.
- **Cascade recalculation**: When any building is placed, moved, or demolished, recalculate `cached_multiplier` for ALL buildings whose footprint falls within Manhattan distance ≤ 4 of any affected tile. (Distance 4 = adjacency range 2 + max footprint 3 - 1.) Bounded to ~80 tile checks per event, user-initiated frequency — negligible cost.
- Buildings not listed in the adjacency table have no adjacency bonuses. May be expanded in future balance patches.
- Visual indicator on buildings showing active adjacency bonuses

#### 3.1.5 Daily Surface Anomalies (Core Retention Mechanic)
Without a daily return mechanic, building placement is a one-time optimization puzzle — players arrange buildings once and never return.

**Solution**: 1-3 anomalies spawn daily on random empty buildable tiles per colony:

| Anomaly Type | Reward | Amount Range |
|-------------|--------|-------------|
| Meteorite Debris | Materials | 50-200 |
| Smuggler Cache | Credits | 100-500 |
| Alien Flora | Experience | 20-80 |
| Mineral Vein | Materials | 100-400 |
| Escape Pod | Rare Component | 1 |

- Players must visit the surface to claim them
- Unclaimed anomalies block building placement on those tiles (enforced by spatial validation)
- Anomalies expire after 48 hours if unclaimed

**Spawning**: Lazy, on `GET /surface`. Check if anomalies spawned in current 24-hour UTC window (bucket = `floor(unix_ms / 86400000)`). If not, generate 1-3 new anomalies with `expires_at = now + 48h`. Max 5 active (unexpired) anomalies per colony — caps accumulation for infrequent visitors.

**Cleanup**: Expired anomalies deleted during spawn check, same transaction. No cron needed. Fire `anomaly_expired` telemetry event.

**Additional engagement hooks:**
- **Resource deposit rotation**: Bonus resource deposits shift on a weekly cycle aligned to Monday 00:00 UTC. Bucket = `floor(unix_seconds / 604800)`. Deposits regenerated from seed `colony_id + '_deposit_' + bucket`. Players who rearrange buildings to match get +10% production. Weekly rhythm is more habit-forming than arbitrary intervals.
- **Building condition visualization**: Building sprites degrade visually as `condition` drops below 0.75 / 0.50 / 0.25 thresholds. Repairs require a surface view visit (click-to-repair).
- **NPC raid surface notification**: When NPC raids trigger, surface view shows damage indicators on affected buildings. Players must visit surface to initiate repairs.

#### 3.1.5a Repair Mechanic
- **Cost**: 10% of original build cost per 0.25 condition restored (rounded up to nearest 0.25)
- **Execution**: Instant on click — engagement is in visiting and deciding, not waiting
- **Production impact**: Condition ≥ 0.5 = full rate. 0.25-0.5 = 50%. Below 0.25 = 0% ("critical" visual)
- **Raid damage**: NPC raids reduce condition by 0.1-0.3 based on `raid_strength - defense_rating` delta
- **Batch repair**: "Repair All" button shows total cost, repairs all in one click
- **API**: `POST /api/colonies/:colonyId/surface/repair` (body: `{ building_ids: [] }` or `{ all: true }`)
- **Accessibility**: Repair available from both surface view (visual click-to-repair) AND colony management page ("Repair All" button). Surface view is incentivized, not mandatory.

#### 3.1.6 Frontend Renderer (PixiJS)
- **React/PixiJS lifecycle**: PixiJS `Application` managed via `useRef`, NOT React state. `useEffect` cleanup calls `app.destroy(true, true)` to prevent WebGL context leaks. Data pushed to PixiJS imperatively via method calls, decoupled from React render cycle.
- **Terrain layer**: Generated client-side from shared seed utility. Colored tiles with subtle texture patterns. Resource deposits rendered with glowing markers visible at placement time.
- **Building layer**: Sprites color-coded by category (extraction=orange, infrastructure=blue, manufacturing=yellow, defense=red)
- **Anomaly layer**: Animated glowing markers on anomaly tiles (pulsing effect)
- **Grid overlay**: Faint lines, hover highlights showing buildable/unbuildable
- **Ghost placement**: Translucent footprint following cursor, green if valid / red if blocked
- **Info tooltips**: Hover building → name, level, production, adjacency bonus indicator
- **Unplaced Inventory tray**: Side panel showing buildings with no grid position, drag-to-place
- **Camera**: Pan (drag) + zoom (scroll), same UX pattern as existing galaxy map
- **Toolbar**: Building selector with category tabs, showing cost/requirements/footprint

#### 3.1.7 Data Model Changes
- `ColonyBuilding`: Add `grid_x` (INTEGER, nullable), `grid_y` (INTEGER, nullable), `cached_multiplier` (FLOAT, default 1.0), `placed_at` (TIMESTAMP, nullable — for undo validation)
- `Colony`: Add `surface_initialized` (BOOLEAN, default false), `surface_version` (INTEGER, default 1)
- New `SurfaceAnomaly` model: `anomaly_id`, `colony_id`, `grid_x`, `grid_y`, `anomaly_type`, `reward_type`, `reward_amount`, `expires_at`
- **No `Colony.surface_data` field** — terrain generated deterministically, not stored

#### 3.1.8 Legacy Migration: Existing Colonies
Existing colonies have buildings with `grid_x = null`. Migration via explicit `POST /surface/initialize` (NOT triggered by GET — avoids mutating state on a read endpoint):

1. `GET /surface` for uninitialized colonies returns `{ needs_initialization: true, terrain: [...] }` — terrain preview without auto-placement
2. `POST /surface/initialize` triggers **best-effort auto-placement**: Iterate buildings in priority order (Command Center → infrastructure → extraction → manufacturing → defense), place each at first valid position using spiral-out search from grid center. Seeded by `colony_id` for reproducibility. **Buildings that cannot be placed** remain in Unplaced Inventory producing at baseline.
3. Set `Colony.surface_initialized = true`
4. **First relocation is free** — players can rearrange without credit cost on first session
5. API returns `{ auto_placed: true, placed_count, unplaced_count }` so frontend shows "Welcome to your surface view — rearrange your buildings" prompt
6. Adjacency bonuses activate immediately upon auto-placement — `cached_multiplier` calculated as part of initialization. No manual "confirm" step.
7. "Reset Layout" button returns all buildings to Unplaced Inventory tray

#### 3.1.9 Onboarding Flow
First-time surface view triggers a brief guided tutorial, branched by colony state:

**New colony** (no existing buildings):
1. Show toolbar → prompt to select and place first building
2. Show ghost footprint and green/red placement indicator
3. After first placement, show adjacency bonus indicator with tooltip
4. Point out anomaly markers and explain daily spawns
5. Colony management screen gets a prominent "View Surface" button/banner for first 3 sessions

**Legacy colony** (existing buildings, first initialization):
1. Show "Welcome back" prompt explaining the new surface view
2. Highlight auto-placed buildings and adjacency bonuses achieved
3. Point out Unplaced Inventory tray (if any buildings couldn't be placed)
4. Explain "first relocation free" — encourage rearrangement
5. Point out anomaly markers and explain daily spawns

#### 3.1.10 API Endpoints
```
GET    /api/colonies/:colonyId/surface            — terrain + buildings + anomalies + deposits (read-only; returns needs_initialization for legacy)
POST   /api/colonies/:colonyId/surface/initialize — auto-place legacy buildings (idempotent)
POST   /api/colonies/:colonyId/surface/place      — place building at grid position
POST   /api/colonies/:colonyId/surface/move       — relocate existing building
POST   /api/colonies/:colonyId/surface/undo       — undo placement (validates placed_at <= 10s)
POST   /api/colonies/:colonyId/surface/anomaly    — claim anomaly (body: anomaly_id)
POST   /api/colonies/:colonyId/surface/repair     — repair buildings (body: { building_ids } or { all: true })
```

---

### Phase 2: Freeform Custom Structures

#### 3.2.1 Block System
Players can place individual structural blocks to create custom bases — walls, reinforced walls, floors, windows, doors, lamps, antennas, turret mounts, barricades, storage crates.

| Block Type | Cost | HP | Movement | Special |
|-----------|------|-----|----------|---------|
| wall | 10 | 100 | Blocks | — |
| reinforced_wall | 50 | 500 | Blocks | — |
| floor | 5 | 50 | — | Decorative underlay |
| window | 15 | 30 | Blocks | Doesn't block line-of-sight |
| door | 20 | 80 | — | — |
| lamp | 10 | 20 | — | Light radius: 3 |
| antenna | 30 | 40 | — | Sensor range: 5 |
| turret_mount | 100 | 200 | Blocks | Enables automated turret |
| barricade | 25 | 150 | Blocks | Half cover |
| storage_crate | 15 | 60 | Blocks | — |

- **Cost model**: One-time placement cost only. No persistent upkeep — upkeep on 500 blocks bloats production tick and punishes creativity.
- **Max blocks per colony**: `infrastructure_level × 50` (hard cap: 500 at level 10). If infra level decreases, existing blocks above new cap are grandfathered — no forced deletion — but no new blocks until count drops below cap.

#### 3.2.2 Block Occupancy Rules
Enforced by the same spatial validation service from Phase 1:
- `floor` blocks CAN coexist under a building footprint (decorative underlay)
- All other block types CANNOT occupy tiles within a building footprint
- Blocks CANNOT overlap other blocks (unique constraint on `[colony_id, grid_x, grid_y]`)
- Blocks can only be placed on buildable terrain tiles
- The unique constraint alone is insufficient — the spatial validation service checks both ColonyBuilding footprints and CustomBlock rows in a transaction

#### 3.2.3 Build Mode UX
- Toggle "Build Mode" in surface view toolbar
- Block palette with color picker for customization
- Click to place, click-drag to paint rows, right-click to remove
- Bulk operations: place/remove up to 50 blocks per API call (rate-limited: 15 requests/min for fluid creative painting)

#### 3.2.4 Data Model
- New `CustomBlock` model: `block_id` (UUID PK), `colony_id` (UUID FK), `block_type` (STRING), `grid_x` (INT), `grid_y` (INT), `rotation` (INT: 0/90/180/270), `color` (STRING: hex override)
- Unique constraint on `[colony_id, grid_x, grid_y]`

#### 3.2.5 API Endpoints
```
GET    /api/colonies/:colonyId/blocks     — all custom blocks
POST   /api/colonies/:colonyId/blocks     — place block(s), max 50 per call
DELETE /api/colonies/:colonyId/blocks     — remove block(s), 50% credit refund
```

**Combat lock**: During active ground combat on a colony, all surface mutation endpoints (building place/move/demolish, block place/remove) return `409 Conflict`. Read-only endpoints remain available.

---

### Phase 3: Ground Combat + Land Armies

**Phase 2 dependency**: Phase 3 works WITHOUT Phase 2. Buildings provide cover and defense_turrets provide automated fire. Custom blocks enhance defense but aren't required.

**Sub-phasing**: Phase 3A (NPC raid defense — convert passive raids to surface grid PvE) ships independently of Phase 3B (player-initiated invasion with orbital bombardment + landing phase).

#### 3.3.1 Unit System
5 unit types with distinct roles (stats are initial balance targets pending playtesting):

| Unit | Cost | HP | ATK | DEF | Speed | Range | Upkeep | Train Time |
|------|------|----|-----|-----|-------|-------|--------|------------|
| Militia | 100 | 50 | 8 | 5 | 2 | 1 | 5/tick | 60s |
| Marines | 300 | 100 | 15 | 12 | 3 | 1 | 15/tick | 180s |
| Heavy Armor | 800 | 300 | 25 | 25 | 1 | 2 | 40/tick | 600s |
| Mech | 2000 | 500 | 40 | 20 | 2 | 3 | 100/tick | 1200s |
| Spec Ops | 1500 | 80 | 30 | 8 | 4 | 2 | 60/tick | 900s |

- Max 50 units per colony (bumped from v1.0's 20)
- Each unit is a distinct row with its own HP — no `count` column / stacking
- Training requires Command Center building + credits + time
- **Upkeep failure**: If owner can't afford total unit upkeep at production tick, deactivate most expensive units first (`is_active = false`) until upkeep fits budget. Inactive units don't participate in defense. Reactivate automatically when budget allows.

#### 3.3.2 Combat Persistence: Roster vs Snapshot

**Persistent Roster** (`GroundUnit` model):
- Tracks each unit's location via concrete nullable FKs: `colony_id` (FK → Colony), `ship_id` (FK → Ship), `combat_instance_id` (FK → GroundCombatInstance). Exactly one must be non-null (CHECK constraint in PostgreSQL, app-level in SQLite).
- No polymorphic `location_type`/`location_id` — Sequelize cannot enforce polymorphic FKs at DB level, leading to orphaned rows.
- No `grid_x`/`grid_y` on the persistent model — grid position only exists during combat
- Survives across combat instances, accumulates experience

**Combat Snapshot** (`GroundCombatUnit` model):
- Created when combat starts — snapshots each participating unit's stats
- Has `grid_x`/`grid_y` for tactical movement
- Has `side` (attacker/defender) and `status` (active/retreated/destroyed)
- When combat ends, surviving unit HP is written back to the persistent `GroundUnit`

This separation prevents combat state from polluting the persistent roster and vice versa.

#### 3.3.3 Asynchronous Combat Design
**Problem**: In a browser MMO, defenders are offline 90% of the time. Turn-based PvP requiring live input from both sides causes infinite hangs or forced auto-forfeits.

**Solution**: Combat is **Attacker (live) vs Defender (AI)**:
- Defender sets a **defense policy** in advance:
  - **Hold the Line**: Units stay near buildings
  - **Aggressive**: Units advance toward attackers
  - **Fallback to Center**: Retreat toward command center
  - **Guerrilla**: Hit-and-run tactics
- Custom walls, barricades, and turret mounts (Phase 2) provide passive defensive modifiers
- Defender's garrison is controlled by deterministic AI based on the selected policy
- **PvE first**: Launch exclusively with NPC pirate/alien invasions. PvP added after balance tuning.
- **Disconnect handling**: If attacker disconnects, 60-second reconnect timer starts. If not reconnected, attacker's units auto-retreat (invasion fails, units return to ship). No auto-forfeit of defender's colony.
- **Concurrent invasion lock**: Only one active combat instance per colony. Second invasion returns 409 Conflict. Surface locked to read-only during active combat.
- **Per-turn timer (60s)**: When expired, attacker's turn auto-ends — unmoved units hold position, uncommitted attacks skipped. Defender AI then takes its turn. Advances combat without forfeiting.
- **Global instance timer (15min)**: When expired, attacker auto-forfeits — units retreat to ship, colony lock lifted.
- **Targetable blocks**: Custom blocks (walls, barricades, turret mounts) are explicitly targetable in combat. When HP reaches 0, tile becomes passable. Prevents invincible wall loops around Command Center.

#### 3.3.4 Invasion Flow
1. **Orbital prerequisite**: Attacker must have ship(s) in the same sector as the target planet
2. **Orbital bombardment** (optional): Damages building `condition` and unit HP (both repairable). Does NOT scar terrain — terrain is deterministic from seed. Strategic tradeoff: bombardment weakens defenses but damages infrastructure you want to capture.
3. **Landing phase**: Deploy ground units from ship cargo onto surface edge tiles (landing_zone terrain)
4. **Turn-based ground combat**: Attacker submits live orders, defender AI acts based on policy. Each unit gets one move + one attack per turn.
5. **Victory**: Attacker captures Command Center OR defender AI eliminates all attackers

#### 3.3.5 Damage Formula
```
damage = max(1, attacker.attack × (100 / (100 + defender.defense)) × cover_modifier × terrain_modifier)
```
- `cover_modifier`: 0.7 if defender behind wall/barricade (30% damage reduction), 1.0 otherwise
- `terrain_modifier`: rocky = 0.91 (1.1x defense), highland = 0.77 (1.3x defense)
- Minimum 1 damage ensures fights always resolve

#### 3.3.6 Combat Mechanics
- **Cover system**: Units behind walls/barricades take 30% less damage — custom structures from Phase 2 have real defensive value
- **Terrain effects**: Highland (+30% defense, -50% speed), swamp (-50% speed), rocky (+10% defense), landing_zone (neutral)
- **Fog of war**: Units only see tiles within their sensor range (antenna blocks extend range)
- **Turret mounts**: From Phase 2 custom blocks, provide automated defense fire

#### 3.3.7 Data Models
- `GroundUnit`: `unit_id`, `owner_user_id`, `unit_type`, `hp_max`, `hp_remaining`, `morale`, `experience`, `colony_id` (nullable FK), `ship_id` (nullable FK), `combat_instance_id` (nullable FK), `is_active`, `training_until`
- `GroundCombatUnit`: `id`, `combat_instance_id`, `source_unit_id`, `side`, `grid_x`, `grid_y`, `hp_remaining`, `status`
- `GroundCombatInstance`: `instance_id`, `planet_id` (denormalized for query efficiency), `colony_id`, `attacker_id`, `defender_id`, `status`, `turn_number`, `combat_log` (JSON), `defender_policy`

#### 3.3.8 API Endpoints
```
POST   /api/ground-combat/train                — train unit at colony (body: colony_id, unit_type)
GET    /api/ground-combat/garrison/:colonyId   — view garrison
PATCH  /api/ground-combat/policy/:colonyId     — set defense policy (body: policy)
POST   /api/ground-combat/invade               — initiate invasion (body: planet_id, colony_id, ship_id, unit_ids)
POST   /api/ground-combat/:instanceId/orders   — submit turn orders (body: orders[])
GET    /api/ground-combat/:instanceId          — get combat state
```

---

### Phase 4: Polish + Engagement Loops

- **Construction animations**: Buildings show scaffolding while under construction (use `developing_until` timer)
- **Road/path blocks**: Visual connection between buildings + minor ground unit speed bonus
- **Weather effects**: Per-planet type ambient overlays (rain on jungle, sandstorms on desert, auroras on arctic)
- **Colony leaderboard**: Rank colonies by production output, defense rating, aesthetic score (custom block count)
- **Colony visiting**: Read-only public URLs to showcase bases. Troop counts hidden via fog of war.
- **Daily quests**: "Build 3 structures", "Train 5 marines", "Survive a raid" — ties into existing progression system
- **Raid visualization**: Convert passive NPC raids to visual surface grid combat

---

## 4. Technical Architecture

### 4.1 Backend Changes Summary

| Layer | Changes |
|-------|---------|
| **Models** | Modify Colony (add `surface_initialized`, `surface_version`), modify ColonyBuilding (add `grid_x`, `grid_y`, `cached_multiplier`), new SurfaceAnomaly, new CustomBlock, new GroundUnit, new GroundCombatUnit, new GroundCombatInstance |
| **Config** | Add `colonySurface`, `customBlocks`, `groundCombat` sections |
| **Services** | New `colonySurfaceService`, `spatialValidationService`, `customBlockService`, `groundCombatService` |
| **Existing Services** | Modify `colonyBuildingService` (accept grid coords, use `cached_multiplier` in tick) |
| **Controllers** | New `colonySurfaceController`, `customBlockController`, `groundCombatController` |
| **Routes** | Extend `colonyRoutes` (surface + block endpoints), new `groundCombatRoutes` |
| **Utilities** | New shared `terrainGenerator` (server + client mirror) |

### 4.2 Frontend Changes Summary

| Component | Changes |
|-----------|---------|
| **New** | `ColonySurface.jsx` (PixiJS renderer), `SurfaceToolbar.jsx`, `GroundCombatView.jsx` |
| **Modified** | `ColoniesPage.jsx` (surface link + anomaly badge), `App.jsx` (routes), `api.js` (endpoints) |
| **Rendering** | PixiJS 8.16 via `useRef` — imperative rendering decoupled from React lifecycle |

### 4.3 Dependencies
- **PixiJS 8.16**: Already installed, unused — zero new render dependencies
- **`simplex-noise`** (~3KB): Lightweight noise utility for terrain generation. Pin to exact version in both server and client for cross-engine parity.

### 4.4 Security Requirements
- **Ownership middleware**: All colony-scoped mutation endpoints verify `req.userId === colony.user_id`
- **Rate limiting**: Bulk block operations limited to 5 requests/minute/user. Combat orders limited to 1 per turn per participant.
- **Input validation**: Grid coordinates (integer, `0 ≤ value < grid_dimension`), building/block types (validated against config enums), color hex (`/^#[0-9a-fA-F]{6}$/`), rotation (enum `{0, 90, 180, 270}`), array length (max 50 per bulk request)
- **Combat authorization**: Only `attacker_id` and `defender_id` may submit orders or view detailed combat state
- **Error responses**: Standard `{ success: false, data: null, message: string }` format. The `data` field is always present, set to `null` on errors. HTTP codes: 400 (validation), 403 (authorization), 404 (not found), 409 (placement conflict / concurrent invasion)

---

## 5. Phasing Strategy

| Phase | What Ships | Standalone Value? | Effort |
|-------|-----------|-------------------|--------|
| **1** | Terrain grid + building placement + adjacency caching + daily anomalies + PixiJS renderer | **Yes** — transforms colony UX immediately | Medium |
| **2** | Custom freeform blocks (extends spatial validation from Phase 1) | **Yes** — creative expression layer | Small |
| **3** | Ground units + async invasion combat (PvE first) | **Yes** — but most valuable with Phase 2 (fortifications matter) | Large |
| **4** | Polish, weather, leaderboards, colony visiting, daily quests | Enhances all above | Small-Medium |

**Recommendation**: Ship Phase 1 first, playtest, then decide Phase 2 vs 3 based on player feedback. Phase 1 delivers core engagement value through building placement + daily anomaly return loop.

### Schema Migration Strategy
- **Development**: Delete SQLite file and restart server (existing pattern)
- **Production**: Sequelize migrations with explicit up/down for each phase. Each migration must be reversible.

---

## 6. Risks and Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| Simplex noise floating-point parity across V8/browser engines | Terrain mismatch between server validation and client rendering | Round to 4 decimal places; pin exact `simplex-noise` version |
| PixiJS performance on 48x48 grids with 500+ sprites | Lag on low-end devices | **Target: 60fps at 32x32 on mid-range hardware.** Tile culling (viewport + 2-tile buffer), sprite sheets, batch renderer, LOD on zoom-out. Profile during implementation. |
| React 18 Strict Mode double-invoking effects | PixiJS double-init, WebGL context leaks | PixiJS app in `useRef` with `app.destroy(true, true)` cleanup |
| Ground combat balance | Frustrating PvP, pay-to-win perception | PvE first (NPC raids), 3+ rounds internal playtesting, PvP added after tuning |
| Economy inflation from adjacency multipliers + anomaly rewards | Credits devalued | Custom blocks and unit training as credit sinks; monitor and tune |
| SQLite JSON for combat_log under concurrent writes | Data corruption | Recommend PostgreSQL migration before Phase 3; combat_log writes are per-instance |
| Fog of war implementation complexity (Phase 3) | Engineering delay | Per-unit sensor range on tile grid needs dedicated technical design |
| PixiJS 8.x API stability | Breaking changes | Pin exact version in package.json |
| No telemetry at launch | Can't validate success metrics | Telemetry events are Phase 1 requirement, not Phase 4 |
| Anomaly engagement decay after week 2 | Mechanic stops pulling players back | Monitor claimed/expired ratio — if expired > 50%, escalate rarity tiers or add narrative chains |
| Adjacency layout gamability | Spatial strategy collapses if one "best" layout exists | Deposit rotation + Phase 2 blocks compete for space; monitor layout convergence |
| `simplex-noise` exact version not named | Cross-engine drift | Name version (e.g., `4.0.1`) and lock in both package.json during implementation |

---

## 7. Resolved Design Decisions

All open questions from v1.0 have been resolved through 5 adversarial review cycles (3 + 2 on v2):

| Question | Decision | Reasoning |
|----------|----------|-----------|
| Grid size scaling | Min 24x24, max 48x48 | 16x16 too cramped after 30% unbuildable + large footprints + 500 blocks |
| PvP ground combat | PvE first, async PvP later | Offline defenders need AI proxy; balance tuning required before PvP |
| Block upkeep cost | One-time only, no upkeep | Upkeep on 500 blocks bloats tick and punishes creativity |
| Colony visiting | Yes, read-only with fog of war | Social/showcase value; hide troop counts for strategy |
| Orbital bombardment | Building damage only, repairable | Terrain scarring breaks deterministic seed; requires massive DB delta storage |
| Mobile/touch support | Desktop-first | Complex multi-tile dragging performs poorly on mobile browser canvases |
| Terrain storage | No DB storage; shared deterministic gen | Avoids DB bloat; `colony_id + planet_id` seed ensures unique terrain per colony |
| Adjacency calculation | Cached on place/move, not per-tick | Prevents O(N²) event loop blocking during global production tick |
| Existing building migration | Unplaced Inventory tray + auto-placement | Baseline production continues; auto-place on first visit, free first rearrange |
| Building IDs | Must match canonical config keys | Never hand-write building lists; generate from config registry |
| Gas giant planets (superseded) | ~~Block at API level~~ → Atmospheric Platform | See gas giant Atmospheric Platform entry below |
| Terrain buildable vs passable | Independent properties | Highland: not buildable but passable with combat penalties. Landing_zone: not buildable but passable |
| PvP protection (future) | Repairable damage + protection windows | 24h shield after colony creation, 8h after successful defense |
| Combat persistence | Separate roster from combat state | GroundUnit = persistent; GroundCombatUnit = per-instance snapshot; HP written back on end |
| Unit location tracking | Concrete nullable FKs, not polymorphic | Polymorphic `location_type`/`location_id` unenforceable as FK in Sequelize |
| Block cap formula | Simple `infra_level × 50`, no dynamic calc | Dynamic usable-tiles formula is recursive/confusing; hard cap sufficient |
| Spatial validation locking | Colony FOR UPDATE lock acquired FIRST | Prevents TOCTOU races; serializes all surface mutations per colony |
| Terrain seed | Hash of `colony_id:planet_id`, not addition | `a + b == b + a` causes seed collisions |
| Anomaly spawning | Lazy on GET /surface, max 5 active | Avoids cron iterating all colonies; caps accumulation |
| Repair mechanic | Instant click, 10% cost per 0.25 condition | Engagement is in visiting, not waiting on timer |
| Deposit rotation | Weekly Monday 00:00 UTC | More habit-forming than arbitrary 72h cycle |
| Legacy confirm placement | No confirm; adjacency bonuses activate immediately | Simpler UX; avoids invisible reduced-production state |
| Gas giant planets | Atmospheric Platform terrain (metal_grating + open_sky) | Existing colonies must have grid parity; denying them breaks economy |
| Blocks in combat | Targetable, destroyed at 0 HP, tiles become passable | Prevents invincible wall loops around Command Center |
| AFK griefing | 60s/turn + 15min global timer, auto-forfeit | Prevents permanent colony lock |
| Simplex-noise seeding | Requires seeded PRNG (mulberry32) | Default Math.random() is non-deterministic |
| Undo validation | Server-side `placed_at` timestamp + `/undo` endpoint | Prevents client manipulation |
| Deposit rotation cost | 10% relocation (reduced from 25%), no cooldown | 25% makes feature economically unviable |
| Auto-placement | Best-effort with overflow to Unplaced Inventory | NP-hard bin-packing risk on dense grids |
| Adjacency scope | Output only — no input consumption scaling | Prevents placement-triggered power blackouts |
| Adjacency stacking | Strongest-per-rule, different rules multiply | Prevents degenerate duplicate stacking; rewards diverse layouts |
| GET /surface purity | GET is read-only; legacy auto-placement via POST /initialize | REST compliance; anomaly spawn is acceptable lazy side-effect |
| Per-turn timer | 60s auto-ends turn (hold); distinct from 15min global forfeit | Keeps combat progressing without punishing slow play |
| Repair accessibility | Both surface view AND colony management page | Surface view incentivized, not mandatory |
| Onboarding branching | Separate flows for new vs legacy colonies | Different starting states need different tutorials |
| Phase 3 independence | Works without Phase 2; buildings provide cover | Custom blocks enhance but don't gate combat |
| Phase 3 sub-phasing | 3A = NPC raids (PvE), 3B = player invasion (PvP) | Incremental complexity |
| Resource deposits | Computed from seed, weekly rotation, in getSurface response | No additional DB model |
| Performance budget | 60fps at 32x32 on mid-range hardware | Tile culling + sprite sheets + batch renderer |
