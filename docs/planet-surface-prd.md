# Product Requirements Document: Planet Surface View
## Space Wars 3000 — Colony Base Building + Ground Combat

**Version:** 1.0
**Date:** 2026-03-13
**Status:** Draft — Pending External Review

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

---

## 2. Current State

### 2.1 Existing Colony System
- **Colony Model**: `colony_id`, `planet_id`, `user_id`, `name`, `population`, `infrastructure_level` (1-10), `developing_until`, `defense_rating`, `last_raid`, `raid_damage`
- **ColonyBuilding Model**: `building_id`, `colony_id`, `building_type`, `level` (1-3), `is_active`, `workforce`, `condition` (0-1), `last_production` — **NO spatial fields (no grid_x/grid_y)**
- **15 building types** across 4 categories: extraction (mining, hydroponics), infrastructure (power plant, habitat, spaceport, trade hub, academy, command center), manufacturing (factory, ore refinery, weapons factory, shipyard), defense (turret, shield generator)
- **3-tier upgrade chains** per building, production requires power balance and input commodities
- **NPC colony raids**: Passive system in `colonyRaidService.js` — `defense_rating` vs `raid_strength`, no player-controlled ground combat
- **10 planet types**: terrestrial, oceanic, desert, volcanic, arctic, jungle, barren, gas_giant, crystal_world, tomb_world — each with size (1-10), gravity, habitability, temperature

### 2.2 Existing Tech Stack
- **Backend**: Node.js/Express, Sequelize ORM, SQLite (dev) / PostgreSQL (prod), CommonJS
- **Frontend**: React 18, React Router v6, TailwindCSS, Axios
- **Rendering**: Canvas2D (galaxy map), Three.js (3D system orbital view), **PixiJS 8.16 installed but unused**
- **Design system**: Custom dark space theme with holographic CSS effects (`holo-panel`, `holo-glass`, etc.)

### 2.3 Rendering Decision
**PixiJS 2D tile grid** (top-down) was selected over:
- **3D Voxel (Minecraft-literal)**: Scope explosion — requires full 3D engine, mesh generation, camera systems. 10x the development effort for marginal engagement gain in a browser game.
- **2.5D Isometric**: Unnecessary rendering complexity (sorting, z-ordering) without meaningful gameplay benefit.
- **Zone-based (no grid)**: Too abstract — loses the spatial planning and "my base" feeling that drives retention.
- **PixiJS is already installed** (v8.16) and unused — zero new dependencies.

---

## 3. Feature Specification

### Phase 1: Colony Surface Grid + Visual Building Placement (MVP)

#### 3.1.1 Terrain Generation
- **Grid size** scales with planet size: 16x16 (small, size 1-3), 24x24 (medium, 4-6), 32x32 (large, 7-9), 40x40 (huge, size 10)
- **10 terrain types**: plains (buildable), rocky (buildable, extraction bonus), water (unbuildable), lava (unbuildable, hazard), ice (buildable), sand (buildable), mountain (unbuildable, wall), crystal (buildable, research bonus), swamp (buildable, slow), volcanic_vent (unbuildable, power bonus)
- **Planet-type profiles** determine terrain distribution (e.g., volcanic planets: 30% lava, 30% rocky, 15% vents, 15% plains, 10% mountain)
- **Procedural generation** via seeded simplex noise using `planet_id` as seed (deterministic — same planet always generates same terrain)
- **Constraints**: At least 30% contiguous buildable area; 1-3 resource deposit clusters; unbuildable border tiles

#### 3.1.2 Building Placement
- Each of the 15 existing building types gets a defined **footprint** (e.g., mining_facility: 2x2, spaceport: 3x3, defense_turret: 1x1)
- Players select a building from a toolbar, see a **ghost footprint** that follows the cursor (green = valid, red = blocked)
- Placement validates: all tiles under footprint are buildable terrain, no overlap with existing buildings
- Placement triggers existing `constructBuilding` logic (credit cost, workforce, infrastructure requirements) then stores grid coordinates
- Buildings can be **relocated** for a credit cost + cooldown timer

#### 3.1.3 Adjacency Bonus System
- Buildings near compatible buildings or terrain types receive production multipliers:
  - Mining Facility + Ore Refinery: +20% production
  - Research Lab + Academy: +20% research
  - Research Lab on Crystal terrain: +15%
  - Power Plant near Volcanic Vent: +30%
  - Hydroponics Farm near Water: +20%
- Bonuses calculated at production tick time based on actual grid positions
- Visual indicator on buildings showing active adjacency bonuses

#### 3.1.4 Frontend Renderer (PixiJS)
- **Terrain layer**: Colored tiles with subtle texture patterns per terrain type
- **Building layer**: Sprites/rectangles color-coded by category (extraction=orange, infrastructure=blue, manufacturing=yellow, defense=red)
- **Grid overlay**: Faint lines, hover highlights showing buildable/unbuildable
- **Camera**: Pan (drag) + zoom (scroll wheel), same UX pattern as existing galaxy map
- **Toolbar**: Building selector with category tabs, showing cost/requirements/footprint
- **Info tooltips**: Hover any building for name, level, production rate, adjacency bonuses

#### 3.1.5 Data Model Changes
- `Colony.surface_data`: New JSON field storing generated terrain grid
- `ColonyBuilding`: Add `grid_x` (INTEGER, nullable), `grid_y` (INTEGER, nullable), `footprint_w` (INTEGER, default 1), `footprint_h` (INTEGER, default 1)

#### 3.1.6 API Endpoints
```
GET    /api/colonies/:colonyId/surface          — terrain + all placed buildings
POST   /api/colonies/:colonyId/surface/place    — place building at grid position
POST   /api/colonies/:colonyId/surface/move     — relocate existing building
```

---

### Phase 2: Freeform Custom Structures

#### 3.2.1 Block System
- Players can place individual structural blocks: walls, reinforced walls, floors, windows, doors, lamps, antennas, turret mounts, barricades, storage crates
- Each block type has: credit cost, HP (for combat), movement blocking properties, special effects (lamp: light radius, antenna: sensor range, turret_mount: enables automated turret)
- **Max blocks per colony** scales with infrastructure level (level x 50, max 500)
- Blocks occupy single tiles and coexist with the building footprint system

#### 3.2.2 Build Mode UX
- Toggle "Build Mode" in surface view toolbar
- Block palette with color picker for customization
- Click to place, click-drag to paint rows, right-click to remove
- Bulk operations: place/remove up to 50 blocks per API call

#### 3.2.3 Data Model
- New `CustomBlock` model: `block_id`, `colony_id`, `block_type`, `grid_x`, `grid_y`, `rotation` (0/90/180/270), `color` (hex override)
- Unique constraint on `[colony_id, grid_x, grid_y]`

#### 3.2.4 API Endpoints
```
GET    /api/colonies/:colonyId/blocks     — all custom blocks
POST   /api/colonies/:colonyId/blocks     — place block(s)
DELETE /api/colonies/:colonyId/blocks     — remove block(s)
```

---

### Phase 3: Ground Combat + Land Armies

#### 3.3.1 Unit System
- **5 unit types** with distinct roles:
  - **Militia**: Cheap, fast to train, weak. Garrison filler. (Cost: 100, HP: 50, ATK: 8, DEF: 5, Speed: 2, Range: 1)
  - **Marines**: Balanced infantry. Core combat unit. (Cost: 300, HP: 100, ATK: 15, DEF: 12, Speed: 3, Range: 1)
  - **Heavy Armor**: Slow tank. High HP and defense. (Cost: 800, HP: 300, ATK: 25, DEF: 25, Speed: 1, Range: 2)
  - **Mech**: Expensive powerhouse. High damage and range. (Cost: 2000, HP: 500, ATK: 40, DEF: 20, Speed: 2, Range: 3)
  - **Spec Ops**: Glass cannon. Fast, high attack, fragile. (Cost: 1500, HP: 80, ATK: 30, DEF: 8, Speed: 4, Range: 2)
- Max 20 units per colony
- Training requires Command Center building + credits + time

#### 3.3.2 Invasion Flow
1. **Orbital prerequisite**: Attacker must have ship(s) in the same sector as the target planet
2. **Orbital bombardment** (optional): Damages surface buildings/turrets but also terrain — strategic tradeoff if you want to capture infrastructure intact
3. **Landing phase**: Deploy ground units from ship cargo onto surface edge tiles
4. **Turn-based ground combat**: Units move and attack on the existing tile grid
5. **Victory conditions**: Attacker captures Command Center OR defender eliminates all attackers

#### 3.3.3 Combat Mechanics
- Turn-based: each unit gets one move + one attack per turn
- **Cover system**: Units behind walls/barricades take 30% less damage — custom structures have defensive value
- **Terrain effects**: Mountains (+30% defense, -50% speed), swamp (-50% speed), rocky (+10% defense)
- **Fog of war**: Units only see tiles within their sensor range
- Turret mounts (from Phase 2 custom blocks) provide automated defense fire

#### 3.3.4 Data Model
- New `GroundUnit` model: `unit_id`, `owner_user_id`, `colony_id`, `unit_type`, `count`, `hp`, `morale`, `experience`, `grid_x`, `grid_y`, `is_active`
- New `GroundCombatInstance` model: `instance_id`, `planet_id`, `attacker_id`, `defender_id`, `status` (deploying/active/attacker_won/defender_won), `turn_number`, `combat_log` (JSON)

#### 3.3.5 API Endpoints
```
POST   /api/ground-combat/train                — train unit at colony
GET    /api/ground-combat/garrison/:colonyId   — view garrison
POST   /api/ground-combat/invade               — initiate invasion
POST   /api/ground-combat/:instanceId/orders   — submit turn orders
GET    /api/ground-combat/:instanceId          — get combat state
```

---

### Phase 4: Polish + Engagement Loops

- **Construction animations**: Scaffolding sprites during build timers
- **Resource deposit visualization**: Glowing terrain tiles
- **Road/path blocks**: Visual connection between buildings + minor ground unit speed bonus
- **Weather effects**: Ambient overlays per planet type (rain, sandstorms, auroras)
- **Colony leaderboard**: Rank by production, defense, aesthetic score
- **Daily quests**: "Build 3 structures", "Train 5 marines", "Survive a raid" — tied to existing progression system
- **Raid visualization**: Convert passive NPC raids to visual surface grid combat

---

## 4. Technical Architecture

### 4.1 Backend Changes Summary

| Layer | Changes |
|-------|---------|
| **Models** | Modify Colony (add `surface_data`), modify ColonyBuilding (add grid fields), new CustomBlock, new GroundUnit, new GroundCombatInstance |
| **Config** | Add `colonySurface`, `customBlocks`, `groundCombat` sections to `server/src/config/index.js` |
| **Services** | New `colonySurfaceService.js`, `customBlockService.js`, `groundCombatService.js` |
| **Existing Services** | Modify `colonyBuildingService.js` (grid coords in construct, adjacency in production tick) |
| **Routes** | Extend `colonyRoutes.js`, new `groundCombatRoutes.js` |
| **Controllers** | New `groundCombatController.js` |

### 4.2 Frontend Changes Summary

| Component | Changes |
|-----------|---------|
| **New** | `ColonySurface.jsx` (PixiJS renderer), `SurfaceToolbar.jsx`, `GroundCombatView.jsx` |
| **Modified** | `ColoniesPage.jsx` (surface link), `App.jsx` (routes), `api.js` (endpoints) |
| **Rendering** | PixiJS 8.16 `<Application>` with terrain + building + block + unit layers |

### 4.3 Dependencies
- **No new npm packages required** — PixiJS 8.16 already installed
- Simplex noise can be implemented in ~50 lines or use a lightweight utility (no heavy dependency needed)

---

## 5. Phasing Strategy

| Phase | What Ships | Standalone Value? | Risk |
|-------|-----------|-------------------|------|
| **1** | Terrain grid + building placement + adjacency bonuses | **Yes** — transforms colony UX immediately | Low — extends existing models |
| **2** | Custom freeform blocks | **Yes** — creative expression layer | Low — simple CRUD on tiles |
| **3** | Ground units + invasion combat | **Yes** — but most valuable with Phase 2 (fortifications matter) | Medium — new combat system |
| **4** | Polish, weather, leaderboards, quests | Enhances all above | Low — incremental |

**Recommendation**: Ship Phase 1 first, gather player feedback, then decide Phase 2 vs 3 priority. Phase 1 alone delivers ~80% of the engagement value (visual base building is the core retention driver).

---

## 6. Risks and Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| PixiJS performance on large grids (40x40) | Lag on low-end devices | Tile culling (only render visible viewport), sprite batching, LOD for zoom-out |
| Ground combat balance | Frustrating PvP, pay-to-win perception | Start with PvE only (NPC raids), add PvP after balance tuning |
| Scope creep in Phase 3 | Delays the high-value Phase 1-2 | Hard phase boundaries — Phase 3 is independently scoped |
| Terrain generation feels repetitive | Players see "same planet" | 10 planet types x simplex noise variations x resource deposit randomization = high uniqueness |
| SQLite schema migration | Dev DB needs regeneration | Delete SQLite file and restart server (existing pattern) |

---

## 7. Open Questions for Review

1. **Grid size scaling**: Is 16x16 (small planets) too cramped for meaningful base layout? Should minimum be 20x20?
2. **PvP ground combat**: Should Phase 3 launch as PvE-only (NPC invasions) with PvP added later, or both simultaneously?
3. **Block persistence cost**: Should custom blocks have ongoing upkeep (credits per tick) or just one-time placement cost?
4. **Colony visiting**: Should other players be able to view (read-only) your colony surface? Social/showcase value vs. intelligence-gathering risk.
5. **Orbital bombardment**: How destructive should it be? Full terrain scarring (permanent) vs. building damage only (repairable)?
6. **Mobile/touch support**: Is touch-based building placement a priority, or desktop-first?
