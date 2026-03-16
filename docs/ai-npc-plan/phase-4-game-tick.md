# Phase 4: Game Tick System

**Goal**: Background loop processing NPC decisions at configurable intervals.
**Dependencies**: Phase 2 (behaviorTreeService, npcService extensions).
**Estimated files**: 2 new, 1 modified

---

## Task 4.1: NPC Action Executor

**File**: `server/src/services/npcActionExecutor.js` (NEW)

- [x] Implement `executeAction(npc, decision, socketService)`:
  - Switch on `decision.action`:
  - **'move_toward_target'** / **'patrol'**:
    - Call `npcService.moveNPC(npc.npc_id, decision.targetSectorId)`
    - Update `npc.behavior_state` to 'patrolling'
    - Emit `npc:left_sector` to old sector room
    - Emit `npc:entered_sector` to new sector room
  - **'attack_player'**:
    - Update `npc.behavior_state` to 'engaging'
    - Emit `npc:attacks_player` to target user
    - Note: actual combat handled by combat tick or existing combatService
  - **'flee'**:
    - Find safest adjacent sector (from behaviorTreeService)
    - Call `npcService.moveNPC()`
    - Update `npc.behavior_state` to 'fleeing'
    - Emit sector events
  - **'trade'**:
    - Simulate NPC trading at port (optional: affect port commodity quantities)
    - Update `npc.behavior_state` to 'trading'
    - Update `npc.last_action_at`
  - **'guard'**:
    - Update `npc.behavior_state` to 'guarding'
    - Update `npc.last_action_at`
  - **'finish_target'**:
    - Same as attack_player, but with more aggressive behavior flag
  - **'idle'**:
    - Update `npc.last_action_at`
  - All actions wrapped in try-catch — log errors, never crash
- [x] Implement `executeAIDecision(npc, context)`:
  - Build tactical prompt via `npcPersonalityService.buildTacticalPrompt()`
  - Call `aiProviderFactory.getProvider('tactical').generateText()`
  - Parse JSON response: extract `{ action, target_id, reason }`
  - Validate action is in allowed set
  - If parsing fails or provider returns null → fall back to behavior tree's best guess
  - Log decision for admin panel: `{ npc_id, action, reason, was_ai: true, latency_ms }`
  - Return validated decision object
- [x] Export both functions

## Task 4.2: Tick Service (Game Loop Coordinator)

**File**: `server/src/services/tickService.js` (NEW)

- [x] Module-level state:
  ```javascript
  let tacticalInterval = null;
  let combatInterval = null;
  let maintenanceInterval = null;
  let processingTactical = false;
  let processingCombat = false;
  let stats = { tacticalTicks: 0, combatTicks: 0, avgTacticalMs: 0, lastTacticalAt: null, startedAt: null };
  ```
- [x] Implement `startTicks()`:
  - Read tick rates from gameSettingsService: `npc.tick_rate_seconds`, `npc.combat_tick_rate_seconds`
  - Start tactical interval: `setInterval(processTacticalTick, tickRate * 1000)`
  - Start combat interval: `setInterval(processCombatTick, combatTickRate * 1000)`
  - Start maintenance interval: `setInterval(processMaintenanceTick, 5 * 60 * 1000)` (every 5 min)
  - Set `stats.startedAt = Date.now()`
  - Log: 'Game tick system started'
- [x] Implement `stopTicks()`:
  - clearInterval on all three intervals
  - Set all to null
  - Log: 'Game tick system stopped'
- [x] Implement `processTacticalTick()`:
  - Guard: if `processingTactical` is true, log warning and return (prevent overlap)
  - Set `processingTactical = true`
  - Try:
    1. Check `gameSettingsService.getSetting('npc.ai_enabled')` — if false, return early
    2. Call `npcService.getActiveNPCsNearPlayers()` to get relevant NPCs
    3. For each NPC (sequentially to avoid SQLite locking):
       a. Build context: get players in sector, other NPCs, adjacent sectors, port info
       b. Call `behaviorTreeService.evaluateNPCDecision(npc, context)`
       c. If `decision.needsAI` and NPC `intelligence_tier >= 2`:
          - Call `npcActionExecutor.executeAIDecision(npc, context)`
          - If AI returns a decision, use it; otherwise use behavior tree decision
       d. Call `npcActionExecutor.executeAction(npc, finalDecision, socketService)`
    4. Update stats: increment tick count, calculate running average duration
  - Catch: log error, continue
  - Finally: set `processingTactical = false`
- [x] Implement `processCombatTick()`:
  - Guard: if `processingCombat` return
  - Find NPCs with `behavior_state === 'engaging'`
  - For each engaging NPC:
    - Find their combat target (player ship in same sector)
    - Execute one combat round via combatService
    - Emit `combat:round` via socketService
    - If combat ends: emit `combat:ended`, update NPC state, handle loot/death
  - Update stats
- [x] Implement `processMaintenanceTick()`:
  - Call `npcService.respawnNPCs()`
  - Heal shields: NPCs not in combat get +5% shields per maintenance tick
  - Call `dialogueCacheService.clearExpired()`
  - Log maintenance stats
- [x] Implement `isRunning()` — returns boolean
- [x] Implement `getStatus()`:
  - Return `{ running, startedAt, tacticalTicks, combatTicks, avgTacticalMs, lastTacticalAt, activeNPCCount }`
- [x] Export: `startTicks, stopTicks, isRunning, getStatus`

## Task 4.3: Wire Tick System into Server Lifecycle

**File**: `server/src/index.js` (MODIFY)

- [x] Import tickService
- [x] After `app.listen` callback (server is listening):
  ```javascript
  tickService.startTicks();
  console.log('  Game tick system started');
  ```
- [x] In graceful shutdown handler (before closing DB):
  ```javascript
  tickService.stopTicks();
  ```

## Task 4.4: AI Decision Logging

- [x] In `npcActionExecutor.executeAIDecision()` and `executeAction()`:
  - Log each decision to an in-memory ring buffer (last 500 entries)
  - Entry: `{ timestamp, npc_id, npc_name, npc_type, action, reason, was_ai, latency_ms, sector_id }`
  - Expose via `getDecisionLog(limit, offset)` for admin panel

## Task 4.5: Phase 4 Verification

- [x] Start server with at least one AI provider configured (or test with 'none' provider)
- [x] Spawn NPCs near a player ship (or use existing NPCs)
- [x] Watch server console: should see tactical tick logs every 30 seconds
- [x] Verify NPCs are moving between sectors (check DB or log output)
- [x] Verify NPCs with low hull flee (manually set an NPC's hull_points low, observe behavior)
- [x] Verify maintenance tick: kill an NPC, wait 5+ minutes, verify it respawns
- [x] Check tick stats via `tickService.getStatus()`
- [x] Run `npm test` — existing tests pass
