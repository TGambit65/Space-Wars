# Idea Board Gap Audit

## Scope

This audit compares the exported idea board in `/home/thoder/.openclaw/plan_full.json` against:

- `progress.md`
- `tasks.md`
- `Space Wars 3000_ Development Plan (Final).md`
- `docs/ai-npc-plan/*`
- implemented server/client code in `server/src` and `client/src`
- existing automated coverage where it already exists

The board currently contains **79 features across 16 sections**.

Promotion rule used in this document:

- only promote systems that are distinct, product-facing, and span multiple surfaces
- do **not** create separate board cards for internal helpers or implementation details that already clearly belong to an existing board feature

That filter matters. The codebase contains many important new foundations, but not all of them should become standalone planner cards.

## Executive Summary

The current board is missing **six implemented MVP-level features** and **two real in-progress initiatives**:

### Implemented but not on the board

| Feature | Current state | Suggested board section |
| --- | --- | --- |
| Admin Control Plane & Game Settings | Implemented MVP | `ops` |
| Interactive NPC Dialogue, Hails & Voice | Implemented MVP | `social` |
| Ship Interior Traversal | Implemented MVP | `adventure` |
| Daily Quests | Implemented MVP | `progression` |
| Faction Wars | Implemented MVP | `social` |
| Space Phenomena & Hazard Presentation | Implemented MVP | `universe` |

### In progress and still not on the board

| Feature | Current state | Suggested board section |
| --- | --- | --- |
| Full Server-Owner Difficulty & Support Tooling | Partial foundation exists | `ops` |
| AI NPC Tactical Simulation & Tick Orchestration | Partial foundation exists | `npc-clans` |

Title-level comparison against `plan_full.json` confirms there are no explicit board cards for **admin/settings**, **daily quests**, **faction wars**, **dialogue**, **voice**, **ship interiors**, or **space phenomena**. The only close title matches are `derelict-explore` and the generic `ai-agent` card, which do not fully cover the systems below.

---

## Implemented But Missing From The Board

### 1. Admin Control Plane & Game Settings

**Summary**

The repo already contains a real admin control plane, not just scaffolding. It persists game settings, exposes protected admin APIs, and ships a multi-tab UI for universe operations, AI configuration, NPC management, and user-tier administration.

**Strongest evidence**

- `server/src/models/GameSetting.js`
- `server/src/services/gameSettingsService.js`
- `server/src/controllers/gameSettingsController.js`
- `server/src/routes/adminRoutes.js`
- `client/src/components/admin/AdminPage.jsx`
- `client/src/components/admin/AIConfigTab.jsx`
- `client/src/components/admin/NPCManagementTab.jsx`
- `server/tests/services/gameSettingsService.test.js`
- `server/tests/services/aiProviderFactory.test.js`

**Why the current board does not cover it**

The board has broad operations cards, but no explicit feature for a server-owner/admin control plane or persistent runtime settings management.

**Suggested board section**

`ops`

**PRD**

- **Goal:** Give admins a secure in-game control plane for universe setup, AI configuration, NPC operations, tick visibility, and account-tier management.
- **Primary users:** server owner, live-ops admin, trusted game admin.
- **MVP contract:**
  - persist runtime settings in the database
  - expose protected APIs for reading and updating settings
  - provide admin visibility into AI config, NPC population, tick status, and user tiers
  - allow controlled admin actions like NPC respawn and user-tier changes
- **Acceptance criteria:**
  - admin-only routes exist for settings, AI status, NPC operations, tick status, and user management
  - settings survive restart and are available through a single service layer
  - the client exposes a working admin page with `Universe`, `AI Config`, `NPCs`, and `Users` tabs
  - secret settings are masked on read and handled safely in the UI

**Current-state note**

This is already an MVP. The broader difficulty-slider and support-tool vision is still incomplete and appears later in the in-progress section.

---

### 2. Interactive NPC Dialogue, Hails & Voice

**Summary**

The codebase already supports player-facing NPC conversations with scripted menus, free-text fallbacks, proactive hails, websocket-driven dialogue events, and optional voice input/output through provider-backed STT/TTS.

**Strongest evidence**

- `server/src/services/dialogueService.js`
- `server/src/controllers/dialogueController.js`
- `server/src/routes/dialogueRoutes.js`
- `server/src/services/ai/aiProviderFactory.js`
- `server/src/services/voiceService.js`
- `client/src/components/npc/NPCChatPanel.jsx`
- `client/src/components/npc/NPCHailNotification.jsx`
- `client/src/hooks/useNPCEvents.js`
- `client/src/hooks/useVoiceChat.js`
- `server/tests/services/dialogueService.test.js`
- `server/tests/services/voiceService.test.js`
- `server/tests/services/aiProviderFactory.test.js`

**Why the current board does not cover it**

The board contains a generic `ai-agent` card, but that is not an explicit NPC communication feature. It does not capture dialogue routes, hail UX, voice gating, or the player-facing chat surface that already exists in code.

**Suggested board section**

`social`

**PRD**

- **Goal:** Let players communicate with conversational NPCs through menu choices, free text, and optional voice where available.
- **Primary users:** players interacting with traders, patrols, bounty hunters, and future conversational NPCs.
- **MVP contract:**
  - start, continue, and end NPC conversations through authenticated API routes
  - support menu-driven responses first, with AI fallback for free-text prompts
  - support proactive hail notifications and real-time dialogue pushes through sockets
  - support optional STT/TTS providers with graceful degradation
  - gate premium voice features by user tier without blocking text chat
- **Acceptance criteria:**
  - supported NPC types can hail the player or be hailed from the game UI
  - the chat panel renders menu options, free-text messages, and NPC replies
  - voice is optional and never blocks the text path
  - disabled providers or free-tier voice limits fail cleanly with player-visible messaging
  - server-side tests cover the dialogue and voice service contracts

**Current-state note**

This is more than a prototype. The player-facing surface, provider abstraction, and tests are already substantial.

---

### 3. Ship Interior Traversal

**Summary**

The traversal stack now supports player ship interiors as first-class explorable scenes, not just colony surfaces. The ship panel launches interior routes, and the same shared traversal runtime powers both ship interiors and derelict boarding.

**Strongest evidence**

- `progress.md` entries for shared traversal refactor and ship-interior rollout
- `client/src/engine/interiorBlueprints.js`
- `client/src/components/traversal/TraversalScene.jsx`
- `client/src/components/traversal/ShipInteriorView.jsx`
- `client/src/components/traversal/DerelictBoardingView.jsx`
- `client/src/components/ship/ShipPanel.jsx`
- `client/src/App.jsx`

**Why the current board does not cover it**

The board has `derelict-explore`, but there is no explicit feature for traversable player ship interiors or the shared interior traversal layer that now exists.

**Suggested board section**

`adventure`

**PRD**

- **Goal:** Let players physically enter and traverse their own ships using the same input and interaction model used by other explorable spaces.
- **Primary users:** players moving between top-down/space views and first-person interior scenes.
- **MVP contract:**
  - ship panel exposes an interior entry point
  - `/ship/:shipId/interior` loads a ship-specific traversal scene
  - traversal uses the shared controller, interaction prompts, and HUD contract
  - the runtime supports keyboard and gamepad without scene-specific forks
- **Acceptance criteria:**
  - interior scenes load from routed entry points
  - the same traversal controller works across colony, ship-interior, and derelict scenes
  - scene-specific exits and interactions are exposed through a shared overlay model
  - the feature builds cleanly with the rest of the client traversal stack

**Current-state note**

This should be tracked separately from `derelict-explore`. The codebase already treats player interiors as a real feature, not a future stretch goal.

---

### 4. Daily Quests

**Summary**

The colony surface includes a real daily quest loop with generation, progress tracking, reward claiming, and UI rendering. This is a progression feature already present in the game, even if it is currently lightweight.

**Strongest evidence**

- `server/src/models/DailyQuest.js`
- `server/src/services/dailyQuestService.js`
- `server/src/controllers/colonySurfaceController.js`
- `server/src/routes/colonyRoutes.js`
- `client/src/services/api.js`
- `client/src/components/colonies/ColonySurface.jsx`

**Why the current board does not cover it**

The board has missions and progression systems, but it does not have an explicit daily quest feature or card.

**Suggested board section**

`progression`

**PRD**

- **Goal:** Add a lightweight repeatable progression loop that gives players daily reasons to return to colony gameplay.
- **Primary users:** active players with colony access.
- **MVP contract:**
  - generate a daily quest set per player
  - track progress against colony-related actions
  - grant XP and credits on claim
  - render a clear quest panel with progress bars and claim states
- **Acceptance criteria:**
  - daily quests are generated once per day bucket per player
  - active quests persist until expiration or claim
  - completed quests can be claimed exactly once
  - the colony UI shows current progress and reward state

**Current-state note**

This is implemented as an MVP. It looks like a real system, but it has lighter validation coverage than some of the other items in this document.

---

### 5. Faction Wars

**Summary**

Faction wars already exist as a distinct system with persistent war records, active war queries, faction-page presentation, and combat-based score updates.

**Strongest evidence**

- `server/src/models/FactionWar.js`
- `server/src/services/factionWarService.js`
- `server/src/controllers/factionController.js`
- `server/src/routes/factionRoutes.js`
- `server/src/services/realtimeCombatService.js`
- `client/src/services/api.js`
- `client/src/components/factions/FactionPage.jsx`

**Why the current board does not cover it**

The board has a `factions` feature, but not an explicit faction-war system. The current implementation goes beyond flavor text and includes persistent scorekeeping plus UI presentation.

**Suggested board section**

`social`

**PRD**

- **Goal:** Track and surface active wars between factions so combat outcomes feed a visible strategic conflict layer.
- **Primary users:** players aligned with factions and players monitoring faction standings.
- **MVP contract:**
  - create, list, and resolve active wars between factions
  - expose war state to the faction UI
  - award war score from qualifying combat outcomes
  - persist the winning faction and final scoreline on resolution
- **Acceptance criteria:**
  - faction APIs return all wars and active wars
  - the faction page renders active war scoreboards
  - combat integrations can increment war score when a valid faction conflict is present
  - resolved wars preserve result metadata

**Current-state note**

This looks like an implemented MVP, not just a placeholder. If the board wants to keep `factions` broad, this can also be added as a named child card or explicit subfeature under that area.

---

### 6. Space Phenomena & Hazard Presentation

**Summary**

Sector-level space phenomena are already implemented with gameplay effects and player-facing presentation. They influence travel/combat logic and are rendered on the galaxy map and system views.

**Strongest evidence**

- `server/src/models/Sector.js`
- `server/src/services/phenomenaService.js`
- `server/src/services/universeGenerator.js`
- `server/src/services/shipService.js`
- `server/src/services/combatService.js`
- `client/src/components/navigation/GalaxyMapCanvas.jsx`
- `client/src/components/navigation/SystemView.jsx`
- `client/src/components/navigation/ui/SystemInfoPanel.jsx`

**Why the current board does not cover it**

The board has universe and travel cards, but no explicit feature for dynamic sector hazards or space-phenomena presentation.

**Suggested board section**

`universe`

**PRD**

- **Goal:** Make sector-level hazards and environmental modifiers a visible and understandable part of navigation and combat planning.
- **Primary users:** players navigating the galaxy map, traveling between sectors, or fighting in hazardous space.
- **MVP contract:**
  - support permanent and temporary sector phenomena
  - expose effects through sector payloads
  - apply phenomena modifiers during movement and combat
  - visualize active phenomena on galaxy and system views
- **Acceptance criteria:**
  - phenomena can spawn, expire, and be cleaned up
  - sectors return active phenomena data to the client
  - galaxy/system UI renders clear visual indicators and effect text
  - movement/combat services consume the same effect definitions

**Current-state note**

This may be acceptable as a standalone card or as a named subfeature under a broader universe/world-design item, but it is currently missing from the planner either way.

---

## In-Progress Or Partial Features Missing From The Board

### 7. Full Server-Owner Difficulty & Support Tooling

**Summary**

The repo already has the foundation for admin control, but the larger server-owner tooling vision from the development plan is not yet represented as its own board feature and is not complete in implementation.

**Strongest evidence**

- `Space Wars 3000_ Development Plan (Final).md` section 12 and roadmap phases 5-7
- `tasks.md` Task 10: Admin Panel & Game Setup
- `server/src/models/GameSetting.js`
- `server/src/services/gameSettingsService.js`
- `client/src/components/admin/AdminPage.jsx`

**Current state**

Implemented now:

- persistent settings storage
- universe admin actions
- AI config controls
- NPC management surfaces
- user-tier administration

Still missing from the fuller vision:

- broad difficulty sliders for XP, upkeep, fuel, research, market volatility, and related economy knobs
- player-support tools like warn/mute/ban/grant/rollback
- content-management tooling for live operators
- a broader support/admin workflow beyond the current MVP tabs

**Suggested board section**

`ops`

**PRD**

- **Goal:** Expand the current admin MVP into a complete server-owner operations suite with difficulty tuning and player-support tooling.
- **Primary users:** server owners, live-ops staff, support admins.
- **Target contract:**
  - expose the full slider matrix described in the development plan
  - add player-support tools with strong audit requirements
  - add broader live configuration and content-management workflows
  - preserve safe defaults and restart-free runtime updates where appropriate
- **Acceptance criteria:**
  - admins can view and update the full difficulty matrix from the UI
  - support actions are authenticated, audited, and visible in admin logs
  - settings changes propagate through runtime services without unsafe state drift

---

### 8. AI NPC Tactical Simulation & Tick Orchestration

**Summary**

The broader AI NPC runtime is real enough to deserve a dedicated planner feature, but it still looks partial. The codebase already contains behavior trees, action execution, a tick service, websocket batch updates, and admin visibility; however, `progress.md` still treats the broader AI-agent track as mostly architectural, and the board only carries the much narrower `ai-agent` companion idea.

**Strongest evidence**

- `docs/ai-npc-plan/README.md`
- `docs/ai-npc-plan/phase-2-behavior-trees.md`
- `docs/ai-npc-plan/phase-4-game-tick.md`
- `docs/ai-npc-plan/phase-5-websocket.md`
- `server/src/services/behaviorTreeService.js`
- `server/src/services/npcActionExecutor.js`
- `server/src/services/tickService.js`
- `server/src/services/socketService.js`
- `server/src/controllers/gameSettingsController.js`
- `server/tests/services/behaviorTreeService.test.js`
- `server/tests/services/npcActionExecutor.test.js`
- `client/src/hooks/useNPCEvents.js`
- `progress.md` note that the broader AI-agent system is still mostly architectural

**Current state**

Implemented now:

- tactical decision evaluation
- AI-fallback execution path
- background tick service
- socket batch updates and NPC event surfaces
- admin tick-status visibility
- targeted service tests

Still unclear or incomplete as a finished feature:

- end-to-end planner coverage for the whole NPC AI initiative
- clear product framing for how this differs from the existing `ai-agent` card
- likely remaining rollout work around scale, balance, and production-hardening

**Suggested board section**

`npc-clans`

**PRD**

- **Goal:** Track the background NPC AI runtime as its own roadmap feature instead of leaving it buried under chat/admin work or a generic companion card.
- **Primary users:** players interacting with living NPC traffic, patrols, traders, pirates, and future dynamic raid systems.
- **Target contract:**
  - run scheduled NPC tactical evaluation through behavior trees first
  - allow AI fallback only for ambiguous decisions
  - expose runtime status and decision visibility to admins
  - publish world-state changes back to clients through socket events
- **Acceptance criteria:**
  - active NPCs are processed by a defined tick cadence
  - scripted behavior remains the default path, with AI fallback bounded and observable
  - clients receive consistent sector NPC updates from the socket layer
  - admins can inspect tick health and recent decision activity

---

## Systems Intentionally Not Promoted To Standalone Board Cards

These are important, but they read more like foundations for existing cards than missing feature cards of their own:

- `worldPolicyService`, combat-policy hardening, player protection state, raid protection, transfer ledger, and action-audit primitives
  - these are meaningful systems, but they mostly implement or harden existing board areas such as zone rules, PvP gating, anti-abuse, and observability
- `runtimeMonitor` and backend startup diagnostics
  - important for `live-ops-observability`, but not a separate product feature
- `subscription_tier` and voice monetization gates
  - real code exists, but this fits better under the existing store/monetization track than as a separate board card today
- derelict boarding and the voxel colony surface stack
  - both are already represented by existing board features (`derelict-explore`, `colony-surface`), even though the implementation is now richer than the current card wording

---

## Recommended Next Board Actions

1. Add the six implemented MVP features as explicit planner cards.
2. Add the two in-progress initiatives as roadmap cards so they stop hiding inside docs and code.
3. Keep anti-abuse, policy, and audit foundations attached to existing cards unless the planner intentionally wants a more granular technical board.
4. If the board wants fewer new cards, merge `Space Phenomena` into a broader universe/world-design card and keep `Faction Wars` as a named child of `factions`.
