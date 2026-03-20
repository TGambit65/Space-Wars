# Space Wars 3000 Admin Suite Master Plan

## Executive Summary

The repository already ships a real admin MVP, but it is not yet a full live-ops or GM suite. The current product is built around a single `User.is_admin` boolean, a four-tab `/admin` page, a small protected runtime/settings API, NPC spawn and respawn endpoints, and minimal admin-only event creation. Several recovery tasks are still handled by one-off scripts, which is the clearest sign that support tooling is missing from the actual game surface.

Compared with the ideaboard, the codebase already has foundations for admin settings, partial audit logging, community events, and NPC runtime visibility. The board adds future moderation, reporting, observability, anti-cheat, and event systems, but it still does not fully specify a dynamic staff platform with scoped permissions, recovery workflows, world intervention, grant rollback, or a safe "become enemy warlord" mode.

This document recommends turning the current admin MVP into a modular admin suite with:

- dynamic role and permission management
- full player support and recovery tools
- moderation and penalty workflows
- space and land live-event orchestration
- NPC and warlord control
- typed grant and rollback tooling
- full ops observability, queue repair, and audit coverage

## Current Codebase Audit

### Existing Admin Interface and Admin-Only Elements

The main admin surface already exists in the React app:

- `client/src/components/admin/AdminPage.jsx`
- `client/src/components/admin/AIConfigTab.jsx`
- `client/src/components/admin/NPCManagementTab.jsx`
- `client/src/App.jsx`
- `client/src/components/common/Layout.jsx`

The current `/admin` route exposes four tabs:

1. `Universe`
2. `AI Config`
3. `NPCs`
4. `Users`

The backend admin surface already exists here:

- `server/src/routes/adminRoutes.js`
- `server/src/controllers/adminController.js`
- `server/src/controllers/gameSettingsController.js`
- `server/src/middleware/auth.js`
- `server/src/models/User.js`
- `server/src/services/actionAuditService.js`

Current protected admin capabilities in shipped code:

- universe regeneration and universe stats
- AI provider configuration and connection tests
- NPC population stats and forced NPC respawn
- tick-system status
- user search and subscription-tier changes
- recent action-audit retrieval
- admin-only NPC spawn and respawn via `server/src/routes/npcRoutes.js`
- admin-only event creation via `server/src/routes/eventRoutes.js`

There is also a broad admin bypass in world access rules:

- `server/src/services/worldPolicyService.js`

That means admins can already bypass some normal destination restrictions, but the bypass is still based on a single boolean flag and is not modeled as a scoped, auditable permission.

### Operational Evidence of Missing Support Tooling

The repo contains manual scripts that are effectively stand-ins for missing admin tools:

- `server/revive_ships.js`
- `server/fix_thoder.js`
- `server/move_colony_ship.js`
- `server/check_user.js`

Those scripts prove there are already real support scenarios requiring:

- ship resurrection
- active ship repair
- player rescue and unstuck flows
- forced movement
- orphaned account inspection

These actions should not remain ad hoc scripts. They need to become audited, permissioned, first-class admin workflows.

### Legacy or Non-Authoritative Admin Hints

There are also older static-site admin/demo affordances:

- `site/js/demo-mode.js`
- `site/js/auth-common.js`

These are useful only as historical evidence that "admin" was envisioned in the static site. They should not be used as the basis for the real suite because they are client-side and not authoritative.

### Current Limitations

The current admin system is materially incomplete:

- one global `is_admin` flag, no custom roles, no scoped permissions, no temporary elevation
- no unified permission checks across HTTP routes, sockets, background jobs, and UI
- no player support tools for rescue, teleportation, movement, resurrection, unstick, repair, or combat/state reset
- no moderation data model for jail, kick, timed bans, permanent bans, appeals, or case notes
- no item, resource, or asset grant-and-rollback pipeline
- no event lifecycle controls for pause, restart, repair, or recovery
- no land-event orchestration at all
- no admin actor mode or warlord possession mode
- no queue dashboard or safe retry/cancel flows
- audit exists, but coverage is partial and does not yet capture approval chains, rollback lineage, or permission snapshots
- the current admin UI does not expose moderation, audit workbench, event director, incident repair, or support case workflows

## Ideaboard Comparison

### Planner Features That Already Overlap With Admin Needs

The current ideaboard already contains important admin-adjacent cards:

| Board Feature | Planner State | Current Code Reality | Implication |
| --- | --- | --- | --- |
| `action-audit` | planned/new | partial backend exists through `ActionAuditLog` and `/api/admin/action-audit` | expand, do not replace |
| `moderation-tools` | planned/new | not implemented in code | becomes the enforcement module |
| `reporting-appeals` | planned/new | not implemented in code | depends on moderation case model |
| `live-ops-observability` | planned/new | only narrow tick and AI status today | becomes the ops console |
| `community-events` | exists | minimal create/contribute/leaderboard flow exists | extend into full event director |
| `wormholes-unstable` | planned/new | not implemented | manage through event director |
| `difficulty-scaling` | planned/new | settings foundation exists, but not a full difficulty matrix | extend current settings/admin panel |
| warlord-related planner ideas | partial | no live warlord tooling, only NPC spawn/respawn and logs | add NPC/warlord command suite |

### What The Ideaboard Still Does Not Fully Specify

Even with the current planner updates, the following admin capabilities remain missing or underspecified:

- dynamic role-based admin control plane
- owner-managed custom admin archetypes
- GM recovery toolkit for rescue, teleport, movement, resurrection, and unstuck repair
- typed asset grant and rollback tooling
- event restart and event-state repair
- unified space and land event authoring
- admin actor mode to become an enemy warlord during live events
- strict approval rules for destructive staff actions

### Recommended Planner Additions or Adjustments

Keep the existing planner cards, but add or adjust the board so the admin platform is explicit:

1. Add `admin-rbac-control-plane`
2. Add `gm-recovery-toolkit`
3. Add `live-event-director`
4. Add `admin-asset-grants-rollbacks`
5. Expand `moderation-tools` to include jail, kick, fixed ban presets, and case approval rules
6. Expand `community-events` so it becomes one player-facing event type under a larger event-instance system

## Admin Suite Design Principles

The suite should follow these rules:

1. Server-authoritative permissions only. Hidden UI tabs are never security.
2. One admin platform for all systems. Do not create a separate permission model per feature.
3. Owner can create any number of admin types. Presets are optional convenience only.
4. Dangerous actions require explicit reason, diff preview, and audit.
5. Where possible, admin actions should be reversible.
6. Temporary authority is better than permanent authority.
7. Player support actions and punitive moderation actions should be separate workflows.
8. Admin actor mode must obey gameplay rules and be fully visible in audit.
9. Existing one-off repair scripts should be retired behind tested service endpoints.

## Target Admin Operating Model

### Default Role Templates

The owner should be able to create arbitrary roles, but the product should ship with sensible templates:

| Role Template | Purpose | Typical Powers |
| --- | --- | --- |
| Owner | full server control | roles, permissions, destructive world ops, permanent bans, approval override |
| Senior Admin | lead operations | all live-ops controls except owner-only role governance |
| Event Director | live event hosting | spawn space/land events, control warlords, announcements, event repair |
| Support GM | player recovery | inspect accounts, rescue, teleport, move, revive, repair, session reset |
| Moderation GM | behavior enforcement | warn, jail, kick, temp ban, evidence review, appeals |
| Economy Admin | economy and grants | pricing, difficulty sliders, grants, rollback, market controls |
| Security GM | anti-cheat investigation | audit, alerts, abuse profiles, escalated penalties |
| Observer | read-only oversight | dashboards, audit, reports, metrics |

These are only templates. The owner must be able to create custom roles like:

- volunteer helper
- weekend event host
- faction GM
- content QA admin
- read-only investor/reporting role

### Permission Architecture

Use a permission registry with canonical keys, then compose roles from those keys.

Example permission families:

```text
admin.roles.manage
admin.permissions.assign
admin.permissions.approve
admin.workbench.read

config.read
config.write
config.difficulty.write

player.inspect
player.support.rescue
player.support.teleport
player.support.move
player.support.revive_ship
player.support.revive_npc
player.support.repair
player.support.clear_stuck_state

player.moderation.warn
player.moderation.jail
player.moderation.kick
player.moderation.ban.temp
player.moderation.ban.permanent
player.moderation.appeal.resolve

world.events.space.spawn
world.events.land.spawn
world.events.pause
world.events.restart
world.events.force_complete

world.npcs.spawn
world.npcs.control
world.npcs.force_state
world.warlords.spawn
world.warlords.possess

economy.grants.issue
economy.grants.rollback
economy.market.adjust

ops.audit.read
ops.metrics.read
ops.jobs.retry
ops.jobs.cancel
ops.flags.manage
ops.ticks.control
ops.incident.broadcast
```

Permissions must support scopes:

- global
- faction
- corporation
- sector
- event type
- player segment
- resource family

Examples:

- an Event Director can spawn only event instances, but not issue bans
- a Support GM can teleport players but not adjust economy sliders
- a Moderation GM can issue 24h, 7d, and 30d bans, while perma bans require elevated approval

### Required Data Model

Add the following models:

| Model | Purpose |
| --- | --- |
| `AdminRole` | named role created by owner or senior staff |
| `AdminRolePermission` | role-to-permission mapping, with optional scope JSON |
| `AdminUserRole` | user-to-role assignment, with expiry and granted-by metadata |
| `AdminActionPolicy` | rules for reason-required, approval count, cooldown, owner-only |
| `AdminApproval` | approval records for high-risk actions |
| `AdminSessionElevation` | temporary elevated grants with expiry |

Extend `ActionAuditLog` rather than replacing it. Add fields for:

- `actor_type`
- `actor_user_id`
- `target_type`
- `target_id`
- `correlation_id`
- `permission_snapshot`
- `rollback_of_action_id`
- `support_case_id`
- `approval_state`

## Coverage Matrix

Admins need safe, first-class access to every major game surface already present in the codebase.

| Game Surface | Minimum Admin Coverage |
| --- | --- |
| accounts, auth, sessions | inspect account, end sessions, notes, tier changes, penalties |
| ships, fleets, navigation | rescue, move, teleport, revive, repair, refuel, force active ship, clear travel locks |
| NPCs, AI, dialogue | spawn, despawn, respawn, reset behavior, inspect logs, force state, warlord control |
| combat, PvP, faction war | spectate, resolve stuck combat, restore losses, enforce penalties, trigger war phases |
| planets, colonies, voxel, ground combat | teleport, spawn land events, reset invasions, repair state, rollback stuck surface state |
| trade, market, economy, crafting | grant commodities, credits, components, rollback abusive trades, adjust difficulty/economy settings |
| progression, missions, crew, artifacts | inspect and repair stuck mission/progression state, grant or revoke rewards |
| corporations, factions, messaging | resolve deadlocks, fix ownership issues, broadcast, moderation integration |
| events and world systems | create, start, pause, restart, repair, cancel space and land events |
| ops runtime | view audit, queue state, metrics, flags, job failures, incident controls |

## Feature Summary Matrix

| Feature | Type | Summary | Board Relationship |
| --- | --- | --- | --- |
| 1. Dynamic Admin RBAC and Safety Foundation | new | replace single admin boolean with scoped roles, permissions, approvals, and audit lineage | new board card |
| 2. Admin Workbench and Entity Inspectors | adjusted | expand current four-tab admin UI into a permission-driven workbench covering all entities | extends current admin MVP |
| 3. Game Config and Difficulty Matrix | adjusted | expand current settings into full balance, difficulty, and rollout control | extends current admin MVP and `difficulty-scaling` |
| 4. Player Support Recovery Toolkit | new | rescue, movement, teleportation, resurrection, repair, and unstuck workflows | new board card |
| 5. Moderation and Enforcement Suite | new | jail, kick, temp bans, perma bans, appeals, report handling, evidence workflows | extends `moderation-tools` |
| 6. Live Event Director for Space and Land | new | event templates, event instances, spawn, pause, restart, and repair for all live events | extends `community-events` and `wormholes-unstable` |
| 7. NPC and Warlord Command Suite | new | advanced NPC control plus audited admin actor mode to become an enemy warlord | extends warlord planner concepts |
| 8. Grant, Spawn, and Rollback Ledger | new | typed item/resource/asset granting with rollback and compensation | new board card |
| 9. Ops Observability, Audit, and Incident Recovery | adjusted | full audit, queue, tick, flag, and incident console | extends `action-audit`, `job-queue`, `live-ops-observability` |

## PRD 1: Dynamic Admin RBAC and Safety Foundation

### Summary

Replace the current `User.is_admin` gate with a reusable permission engine that supports arbitrary roles, scoped grants, temporary elevation, and action approval rules.

### Goal

Let the owner define any number of admin types without hardcoding role logic into controllers, routes, or UI tabs.

### Primary Users

- owner
- senior admin
- lead operations staff

### Scope

- admin identity
- permission evaluation
- role management
- temporary grants
- action approval
- audit metadata

### Functional Requirements

1. Every admin action must resolve through a shared policy engine.
2. Roles must be created, edited, copied, disabled, and assigned from the admin UI.
3. Roles must support scoped permissions instead of only global allow/deny.
4. High-risk actions must require:
   - explicit reason
   - optional second approval
   - immutable audit entry
5. Temporary elevated grants must expire automatically.
6. The owner role must be immutable and non-removable.
7. HTTP routes, WebSocket actions, background jobs, and workbench controls must all use the same permission checks.

### Data Model

- `AdminRole`
- `AdminRolePermission`
- `AdminUserRole`
- `AdminActionPolicy`
- `AdminApproval`
- `AdminSessionElevation`
- `ActionAuditLog` extension

### API Surface

- `GET /api/admin/me`
- `GET /api/admin/roles`
- `POST /api/admin/roles`
- `PATCH /api/admin/roles/:roleId`
- `POST /api/admin/roles/:roleId/assignments`
- `DELETE /api/admin/assignments/:assignmentId`
- `POST /api/admin/approvals/:actionId/approve`
- `POST /api/admin/approvals/:actionId/reject`

### UI Surface

- new `Roles & Permissions` area inside `/admin`
- role builder with search and permission families
- effective-access viewer for a selected user
- temporary grant modal with expiry
- approval inbox for pending high-risk actions

### Acceptance Criteria

- owner can create custom roles without code changes
- permission changes take effect across API and UI
- all high-risk actions enforce policy rules
- role assignment and approval history is queryable in audit

## PRD 2: Admin Workbench and Entity Inspectors

### Summary

Turn the current four-tab page into a permission-driven workbench with global search, command palette, dashboards, and entity inspectors for users, ships, sectors, colonies, NPCs, events, and cases.

### Goal

Give admins one place to manage any gameplay surface they are authorized to touch.

### Primary Users

- all admin roles

### Scope

- navigation shell
- global admin search
- entity inspectors
- action drawers
- dashboards

### Functional Requirements

1. Navigation must be generated from effective permissions, not hardcoded `is_admin`.
2. The workbench must include global search for:
   - player
   - ship
   - sector
   - colony
   - event
   - NPC
   - corporation
3. Every major entity needs an inspector page with:
   - summary
   - linked systems
   - recent audit trail
   - available actions based on permissions
4. High-risk mutations must show before/after preview where possible.
5. Workbench modules must be pluggable so future planner features attach to the same shell.

### UI Modules

- Overview
- Players
- Support
- Moderation
- Events
- NPCs and Warlords
- Economy and Grants
- Config and Difficulty
- Audit
- Jobs and Incidents
- Roles and Permissions

### API Surface

- `GET /api/admin/search`
- `GET /api/admin/players/:id`
- `GET /api/admin/ships/:id`
- `GET /api/admin/sectors/:id`
- `GET /api/admin/colonies/:id`
- `GET /api/admin/events/:id`
- `GET /api/admin/npcs/:id`

### Acceptance Criteria

- admins only see the modules they are allowed to use
- every supported entity is reachable through search and direct inspection
- current Universe, AI, NPC, and Users tabs are preserved as workbench modules instead of being discarded

## PRD 3: Game Config and Difficulty Matrix

### Summary

Expand the current settings surface into a full game configuration matrix covering difficulty, balance, economy, progression, event frequency, and live rollout controls.

### Goal

Support the development-plan requirement for owner-controlled difficulty sliders and runtime tuning without direct config edits or deploys.

### Primary Users

- owner
- senior admin
- economy admin
- live ops admin

### Scope

- runtime settings
- difficulty profiles
- safe rollout and revert
- preview and validation

### Functional Requirements

1. Reuse the existing `GameSetting` foundation instead of creating a separate settings system.
2. Add grouped controls for:
   - resource abundance
   - NPC spawn rate
   - NPC aggression
   - XP gain multiplier
   - research speed
   - crafting speed and success
   - upkeep costs
   - fuel costs and efficiency
   - market volatility
   - item loss on destruction
   - starting credits and resources
   - wormhole frequency
   - global tax rates
3. Support named profiles:
   - casual
   - standard
   - hardcore
   - event-weekend
4. Every change must produce a change-set entry with reason and rollback path.
5. Certain settings must support scheduled activation instead of immediate mutation.

### Data Model

- extend `GameSetting`
- add `SettingChangeSet`
- add `SettingProfile`

### API Surface

- `GET /api/admin/settings`
- `PUT /api/admin/settings`
- `POST /api/admin/settings/preview`
- `POST /api/admin/settings/profiles`
- `POST /api/admin/settings/apply-profile`
- `POST /api/admin/settings/revert/:changeSetId`

### UI Surface

- `Config & Difficulty` module
- grouped sliders and numeric fields
- profile presets
- diff and preview modal
- scheduled rollout picker
- history and rollback list

### Acceptance Criteria

- existing AI settings remain functional
- full difficulty matrix is configurable in UI
- every config mutation is audited and reversible
- permissions can differentiate between read-only, AI-only, and full balance access

## PRD 4: Player Support Recovery Toolkit

### Summary

Provide first-class support tools for rescue, movement, teleportation, resurrection, repair, and unstuck recovery so staff never need one-off scripts for normal support cases.

### Goal

Replace ad hoc manual database fixes with secure, service-backed admin workflows.

### Primary Users

- support GM
- senior admin
- live ops admin

### Scope

- player inspection
- recovery actions
- state repair
- mass rescue

### Functional Requirements

1. Player support inspectors must show:
   - current sector and instance
   - active ship
   - all ships and fleet membership
   - combat lock state
   - colony and mission state
   - socket/session health
2. Support actions must include:
   - rescue to home sector
   - rescue to safe harbor
   - teleport player or ship to sector, planet, colony, or event
   - move fleet to sector
   - force active ship
   - resurrect destroyed ship
   - resurrect selected NPC
   - repair and refuel selected ship
   - clear stuck combat lock
   - clear stuck traversal or instance assignment
   - refresh live session and subscriptions
3. Each action must record:
   - acting admin
   - target player or entity
   - reason
   - before state snapshot
   - after state snapshot
4. The toolkit must support mass actions during outages, such as rescuing everyone trapped in a broken event instance.

### Data Model

- `SupportCase`
- `SupportAction`
- `SupportSnapshot`

### API Surface

- `GET /api/admin/support/player/:userId`
- `POST /api/admin/support/rescue`
- `POST /api/admin/support/teleport`
- `POST /api/admin/support/move`
- `POST /api/admin/support/revive-ship`
- `POST /api/admin/support/revive-npc`
- `POST /api/admin/support/repair-ship`
- `POST /api/admin/support/clear-stuck-state`
- `POST /api/admin/support/mass-rescue`

### UI Surface

- `Support` module
- player state inspector
- recovery presets
- advanced move/teleport panel
- batch rescue panel
- case notes and history

### Acceptance Criteria

- the existing manual scripts become unnecessary for normal rescue cases
- support actions can be executed without direct database access
- every support action is audited and queryable

## PRD 5: Moderation and Enforcement Suite

### Summary

Build the full GM moderation workflow with reports, case history, chat moderation, appeals, and the exact enforcement presets requested: jail, kick, 24 hour ban, one week ban, one month ban, and permanent ban.

### Goal

Give staff a complete, auditable moderation system separate from non-punitive support actions.

### Primary Users

- moderation GM
- senior admin
- security GM

### Scope

- reports
- penalties
- appeals
- evidence review
- account notes

### Functional Requirements

1. Penalty presets must include:
   - warning
   - jail
   - kick
   - 24 hour ban
   - 7 day ban
   - 30 day ban
   - permanent ban
2. Jail must be a real state with enforced restrictions:
   - no free movement
   - no combat
   - no trade
   - no event participation
   - appeal/support access still allowed
3. Kick must terminate active sessions and sockets immediately.
4. Temporary and permanent bans must block login and active sessions.
5. Permanent bans should require elevated permission and optionally second approval.
6. Moderators must be able to review:
   - player history
   - audit history
   - anti-cheat flags
   - previous penalties
   - appeals
7. Chat moderation must include:
   - flagged message review
   - mute support
   - rule management

### Data Model

- `ModerationCase`
- `ModerationAction`
- `PenaltyRecord`
- `JailRecord`
- `BanRecord`
- `AppealCase`
- `AdminNote`

### API Surface

- `GET /api/admin/moderation/reports`
- `GET /api/admin/moderation/player/:userId`
- `POST /api/admin/moderation/action`
- `POST /api/admin/moderation/jail`
- `POST /api/admin/moderation/kick`
- `POST /api/admin/moderation/ban`
- `POST /api/admin/moderation/unban`
- `PUT /api/admin/moderation/appeals/:appealId`

### UI Surface

- `Moderation` module
- case queue
- player moderation profile
- one-click penalty presets
- evidence and audit drawer
- appeal resolution queue

### Acceptance Criteria

- jail, kick, 24h, 7d, 30d, and perma ban all work through one audited system
- punitive actions are distinct from support actions
- perma ban approval policy is enforceable in code
- penalties are visible in player history and appeal flows

## PRD 6: Live Event Director for Space and Land

### Summary

Create a unified live-event control plane for both space and land gameplay, including spawn, pause, resume, restart, repair, and termination workflows.

### Goal

Let admins create and manage live events anywhere in the game world and recover stuck events safely without raw DB edits.

### Primary Users

- Event Director
- live ops admin
- senior admin

### Scope

- event templates
- event instances
- space events
- land events
- restart and repair flows

### Functional Requirements

1. Replace the current thin community-event creation flow with a true event-instance system.
2. Support event templates for:
   - space warlord incursions
   - unstable wormholes
   - pirate raids
   - convoy defense
   - anomaly storms
   - faction push events
   - colony invasions
   - surface anomaly outbreaks
   - artifact excavation races
   - land boss assaults
3. Every event instance must have a state machine:
   - draft
   - scheduled
   - spawning
   - active
   - paused
   - failed
   - completed
   - cancelled
   - archived
4. Admin controls must include:
   - create
   - schedule
   - start now
   - pause
   - resume
   - restart stage
   - repair stuck stage
   - force complete
   - cancel
   - clone
5. Event repair must show which job, spawn group, or world lock failed.
6. Space and land events must be controlled from the same module with type-specific editors.

### Data Model

- `EventTemplate`
- `EventInstance`
- `EventStage`
- `EventSpawnGroup`
- `EventRepairAction`

### API Surface

- `GET /api/admin/events`
- `POST /api/admin/events`
- `POST /api/admin/events/:eventId/start`
- `POST /api/admin/events/:eventId/pause`
- `POST /api/admin/events/:eventId/resume`
- `POST /api/admin/events/:eventId/restart`
- `POST /api/admin/events/:eventId/repair`
- `POST /api/admin/events/:eventId/complete`
- `POST /api/admin/events/:eventId/cancel`

### UI Surface

- `Events` module
- template browser
- calendar and scheduler
- active instance monitor
- stage timeline
- repair and restart controls
- sector and colony target pickers

### Acceptance Criteria

- admins can spawn both space and land events from UI
- admins can restart or repair stuck events without direct DB edits
- current `community-events` become one supported event template instead of a separate control path

## PRD 7: NPC and Warlord Command Suite

### Summary

Expand the current NPC admin tools into a full command surface for NPC control, named warlord creation, and audited actor mode where an admin can become an enemy warlord during a live event.

### Goal

Let live-ops staff create memorable live encounters while keeping all power bounded, explicit, and audited.

### Primary Users

- Event Director
- senior admin
- live ops admin

### Scope

- NPC command tools
- warlord templates
- admin actor mode

### Functional Requirements

1. NPC controls must include:
   - spawn by type or group
   - despawn
   - respawn
   - heal
   - teleport
   - change target
   - change aggression
   - reset AI
   - force dialogue state
2. Warlord tooling must support:
   - named persona creation
   - faction and loadout selection
   - escort or minion assignment
   - space and land spawn locations
   - scripted objectives
3. Admin actor mode must allow an authorized admin to:
   - possess a spawned warlord or designated enemy NPC
   - control movement, combat, and limited dialogue through the same rules as the actor
   - release control back to AI at any time
4. Admin actor sessions must be:
   - time limited
   - fully audited
   - visible to senior staff in oversight logs
5. Hidden stat boosts must never be implicit. Any power boost must be part of event configuration and visible in audit.

### Data Model

- `WarlordPersona`
- `AdminActorSession`
- `NPCSpawnTemplate`

### API Surface

- `POST /api/admin/npcs/spawn`
- `POST /api/admin/npcs/:npcId/control`
- `POST /api/admin/npcs/:npcId/reset`
- `POST /api/admin/warlords`
- `POST /api/admin/warlords/:warlordId/possess`
- `POST /api/admin/warlords/:warlordId/release`

### UI Surface

- `NPCs and Warlords` module
- NPC roster and filters
- warlord creator
- live control panel
- actor mode banner and timer

### Acceptance Criteria

- admins can create named enemy warlords from the UI
- admins can possess a warlord through a bounded actor session
- every actor-session action is attached to the admin identity and event context in audit

## PRD 8: Grant, Spawn, and Rollback Ledger

### Summary

Build a typed grant service for items, resources, ships, cargo, components, artifacts, crew, XP, and other recoverable assets, with rollback and compensation support.

### Goal

Give staff a safe way to spawn or grant assets without direct DB edits and without creating invisible economy corruption.

### Primary Users

- support GM
- economy admin
- senior admin

### Scope

- grants
- resource spawning
- rollback
- compensation

### Functional Requirements

1. Grants must support the current asset families already present in the game:
   - credits
   - commodities and cargo
   - components
   - artifacts
   - crew
   - blueprints
   - ships
   - XP and progression points
   - colony resources
2. Grants must target valid destinations:
   - player
   - ship
   - colony
   - sector drop
   - event reward bucket
3. The system must validate capacity and destination rules before mutation.
4. Every grant must create a ledger entry with line items and a rollback plan.
5. Rollback must be one click when fully reversible.
6. If a grant is partially consumed, the system must create a compensation workflow instead of silent failure.

### Data Model

- `GrantLedger`
- `GrantLineItem`
- `GrantRollback`

### API Surface

- `POST /api/admin/grants/preview`
- `POST /api/admin/grants`
- `POST /api/admin/grants/:grantId/rollback`
- `GET /api/admin/grants/:grantId`

### UI Surface

- `Economy and Grants` module
- typed grant wizard
- destination picker
- ledger history
- rollback and compensation panel

### Acceptance Criteria

- staff can spawn items and resources without direct SQL or one-off scripts
- grants are always auditable
- rollback is possible for reversible grants
- no asset family bypasses the shared ledger

## PRD 9: Ops Observability, Audit, and Incident Recovery

### Summary

Expand the current admin runtime visibility into a full operations console with complete audit coverage, job inspection, feature flags, incident broadcast, and safe repair controls.

### Goal

Give live operations staff the tools to understand, contain, and repair production issues in real time.

### Primary Users

- live ops admin
- senior admin
- security GM
- observer

### Scope

- audit
- metrics
- job queue
- flags
- incident tools

### Functional Requirements

1. Audit must cover all staff actions, not just selected gameplay actions.
2. Audit queries must support filters for:
   - actor
   - target
   - event
   - permission
   - correlation id
   - rollback chain
3. Add dashboards for:
   - tick health
   - event runner health
   - failed jobs
   - queue backlog
   - WebSocket room load
   - anti-cheat alerts
4. Operational controls must include:
   - retry failed job
   - cancel pending job
   - toggle feature flag
   - issue maintenance broadcast
   - pause or resume selected subsystems
   - inspect stuck event or queue lock
5. Control permissions must be stricter than read-only permissions.

### Data Model

- extend `ActionAuditLog`
- `FeatureFlag`
- `IncidentLog`
- `AdminBroadcast`

### API Surface

- `GET /api/admin/action-audit`
- `GET /api/admin/jobs`
- `POST /api/admin/jobs/:jobId/retry`
- `POST /api/admin/jobs/:jobId/cancel`
- `GET /api/admin/metrics`
- `GET /api/admin/flags`
- `PATCH /api/admin/flags/:flagId`
- `POST /api/admin/incidents/broadcast`

### UI Surface

- `Audit` module
- `Jobs and Incidents` module
- incident timeline
- subsystem status board
- feature flag controls

### Acceptance Criteria

- admins can trace every important staff action end to end
- failed jobs and stuck event steps are visible and repairable
- read-only observer roles cannot execute repair controls
- current tick-status and AI runtime views are preserved as subpanels, not lost

## Implementation Order

Build the suite in this order:

### Phase 1: Foundation

1. Dynamic Admin RBAC and Safety Foundation
2. Admin Workbench and Entity Inspectors
3. Action audit extension

### Phase 2: Core Operational Value

1. Game Config and Difficulty Matrix
2. Player Support Recovery Toolkit
3. Moderation and Enforcement Suite

### Phase 3: Live Content Operations

1. Live Event Director for Space and Land
2. NPC and Warlord Command Suite

### Phase 4: Safe Mutation and Runtime Repair

1. Grant, Spawn, and Rollback Ledger
2. Ops Observability, Audit, and Incident Recovery

## Key Risks and Controls

| Risk | Why It Matters | Required Control |
| --- | --- | --- |
| separate permission systems per feature | creates long-term security drift | one central policy engine |
| direct DB mutation from admin UI | silent corruption and no rollback | service-backed actions only |
| admin abuse of power | high-trust tools need accountability | reasons, approvals, audit, anomaly alerts |
| perma ban mistakes | high player impact | elevated permission plus approval rule |
| event restart causing duplicate rewards | economy corruption | idempotent event stages and repair-aware state machine |
| asset grants without ledger | impossible rollback | typed grant ledger for all asset families |
| actor mode becoming hidden cheating | fairness and trust issue | bounded sessions, visible audit, scenario-defined power only |

## Final Recommendation

Do not treat the current admin page as the admin suite. Treat it as the seed of a broader staff platform.

The most important design decision is to build the foundation first:

1. dynamic RBAC
2. unified admin workbench
3. audit and approval model

Without that foundation, every later feature will invent its own access rules and become harder to trust.

Once that is in place, the highest-value operational additions are:

1. support recovery toolkit
2. moderation suite
3. live event director

That combination gives Space Wars 3000 a real, scalable admin suite instead of a few hardcoded admin pages and emergency scripts.
