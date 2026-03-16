# Phase 2: NPC Model Extensions + Behavior Trees (Tactical Scripting)

**Goal**: Smart NPC decisions that handle 70-80% of situations without AI calls.
**Dependencies**: Phase 1 (gameSettingsService for difficulty level).
**Estimated files**: 3 new, 3 modified

---

## Task 2.1: Extend NPC Model

**File**: `server/src/models/NPC.js` (MODIFY)

- [ ] Add `behavior_state` field:
  - STRING(20), default 'idle'
  - Validate isIn: ['idle', 'patrolling', 'hunting', 'fleeing', 'trading', 'guarding', 'engaging']
- [ ] Add `ai_personality` field:
  - JSON, nullable
  - Stores personality traits generated once on spawn
- [ ] Add `intelligence_tier` field:
  - INTEGER, default 1, validate min 1 max 3
  - 1=scripted only, 2=scripted+simple AI, 3=full AI
- [ ] Add `movement_target_id` field:
  - UUID, nullable
  - References sector NPC is navigating toward
- [ ] Add `home_sector_id` field:
  - UUID, nullable
  - Sector where NPC was spawned / patrols around
- [ ] Add `dialogue_state` field:
  - JSON, nullable
  - Tracks current conversation state for interactive dialogue
- [ ] Add index on `behavior_state`
- [ ] Note: SQLite stores JSON as TEXT — avoid querying into JSON fields directly

## Task 2.2: Add NPC AI Config Section

**File**: `server/src/config/index.js` (MODIFY)

- [ ] Add `npcAI` section after existing `npcTypes`:
  ```javascript
  npcAI: {
    behaviorStates: ['idle', 'patrolling', 'hunting', 'fleeing', 'trading', 'guarding', 'engaging'],
    intelligenceTiers: {
      1: { name: 'Scripted', usesAI: false },
      2: { name: 'Assisted', usesAI: true },
      3: { name: 'Advanced', usesAI: true }
    },
    difficultyThresholds: {
      1: 0.7,  // Only attacks with overwhelming advantage
      2: 0.6,
      3: 0.5,  // Balanced
      4: 0.4,
      5: 0.3   // Very aggressive, lots of ambiguous situations → more AI calls
    },
    traits: {
      primary: ['greedy', 'honorable', 'cowardly', 'cunning', 'brutal', 'jovial', 'paranoid', 'reckless'],
      secondary: ['patient', 'impulsive', 'calculating', 'superstitious', 'loyal', 'treacherous'],
      speechStyles: ['formal', 'pirate_slang', 'military', 'merchant_polite', 'threatening', 'cryptic'],
      quirks: [
        'always refers to self in third person',
        'ends sentences with space puns',
        'quotes ancient Earth literature',
        'speaks in short clipped sentences',
        'uses excessive nautical terminology',
        'frequently mentions their ship by name',
        'is oddly philosophical about cargo'
      ],
      voiceProfiles: ['deep_gruff', 'smooth_confident', 'nervous_fast', 'commanding', 'raspy_old', 'cheerful']
    }
  }
  ```

## Task 2.3: NPC Personality Service

**File**: `server/src/services/npcPersonalityService.js` (NEW)

- [ ] Implement `generatePersonality(npcType)`:
  - Pick random `trait_primary` from config pool (bias by npcType: pirates → brutal/greedy, traders → greedy/jovial, patrol → honorable)
  - Pick random `trait_secondary`
  - Pick `speech_style` biased by npcType
  - Pick random `quirk`
  - Pick `voice_profile` biased by npcType
  - Return JSON object: `{ trait_primary, trait_secondary, speech_style, quirk, voice_profile }`
- [ ] Implement `buildTacticalPrompt(npc, context, personality)`:
  - Load system prompt template from gameSettings (`ai_llm.prompt.${npc.npc_type}`)
  - Inject NPC state: name, type, hull/shield %, attack/defense, behavior_state
  - Inject context: players in sector (count, ship types), other NPCs, adjacent sectors, port available
  - Inject personality: traits, speech style
  - Inject difficulty level
  - Request structured JSON output: `{ action: string, target_id?: string, reason: string }`
  - Return formatted messages array (system + user)
- [ ] Implement `buildInteractivePrompt(npc, personality, conversationHistory, context)`:
  - System prompt with NPC identity, personality, quirk, speech style
  - Inject game context: port prices (if trader), sector safety (if patrol), target info (if bounty hunter)
  - Include conversation history (last 10 messages)
  - Instruct model to stay in character, keep responses under 150 tokens
  - Return formatted messages array
- [ ] Export all functions

## Task 2.4: Behavior Tree Service (Core Tactical Brain)

**File**: `server/src/services/behaviorTreeService.js` (NEW)

- [ ] Implement `evaluateNPCDecision(npc, context)`:
  - context shape: `{ playersInSector, npcsInSector, adjacentSectors, sectorHasPort, npcConfig, difficulty }`
  - Returns: `{ action, target?, targetSectorId?, reason, needsAI }`
  - Decision priority (evaluated in order, first match wins):
    1. **DEAD CHECK**: `!npc.is_alive` → return `{ action: 'idle', reason: 'dead' }`
    2. **FLEE CRITICAL**: hull % < `flee_threshold` → `{ action: 'flee', targetSectorId: safestAdjacentSector, reason: 'critical hull' }`
    3. **FINISH TARGET**: in combat + target hull < 10% → `{ action: 'finish_target', target: currentTarget, reason: 'finishing blow' }`
    4. **HOSTILE ENCOUNTER**: hostile NPC + player in sector → call `calculateAttackScore()`:
       - Score > threshold (difficulty-adjusted) → `{ action: 'attack_player', target: player, reason: 'advantage' }`
       - Score < (1 - threshold) → `{ action: 'flee', reason: 'outmatched' }`
       - Score in ambiguous range → `{ action: 'attack_player', needsAI: true, reason: 'ambiguous' }`
    5. **TRADER AT PORT**: npcType TRADER + sectorHasPort → `{ action: 'trade', reason: 'at port' }`
    6. **TRADER MOVING**: npcType TRADER + !sectorHasPort → `{ action: 'move_toward_target', targetSectorId: nearestPort, reason: 'seeking port' }`
    7. **PATROL GUARD**: npcType PATROL + sectorHasPort → `{ action: 'guard', reason: 'protecting port' }`
    8. **PATROL RETURN**: npcType PATROL + far from home → `{ action: 'move_toward_target', targetSectorId: nextStepToHome, reason: 'returning home' }`
    9. **BOUNTY_HUNTER HUNT**: player with bounty in adjacent sectors → `{ action: 'move_toward_target', reason: 'tracking bounty' }` (or needsAI if multiple targets)
    10. **WANDER**: → `{ action: 'patrol', targetSectorId: randomAdjacentSector, reason: 'wandering' }`
    11. **IDLE**: default → `{ action: 'idle', reason: 'nothing to do' }`

- [ ] Implement `calculateAttackScore(npc, target, difficulty)`:
  - Factors:
    - Hull ratio: `npc.hull_points / npc.max_hull_points` vs target
    - Shield ratio: same
    - Attack/defense comparison: `npc.attack_power / target.defense_rating`
    - Aggression level: `npc.aggression_level` (0-1)
    - Difficulty modifier: higher difficulty → lower threshold → more likely to attack
  - Returns: score 0-1 (higher = more confident to attack)
  - Threshold lookup: `config.npcAI.difficultyThresholds[difficulty]`

- [ ] Implement `findSafestAdjacentSector(npc, adjacentSectors)`:
  - Score each adjacent sector: fewer hostile NPCs = safer, has port = safer, lower danger_level = safer
  - Return sector_id of safest option

- [ ] Implement `findPathToSector(fromSectorId, toSectorId, maxHops = 10)`:
  - BFS over SectorConnection table
  - Returns next sector_id to move to (first step of path)
  - Returns null if no path found within maxHops

- [ ] Implement `findNearestPortSector(fromSectorId, maxHops = 10)`:
  - BFS looking for sectors with ports
  - Returns sector_id of nearest port sector

- [ ] Export all functions

## Task 2.5: Extend NPC Service

**File**: `server/src/services/npcService.js` (MODIFY)

- [ ] Import `npcPersonalityService`
- [ ] Modify `spawnNPC()`:
  - After creating NPC, generate personality: `const personality = npcPersonalityService.generatePersonality(npcType)`
  - Set `intelligence_tier` based on type: PIRATE_LORD → 3, TRADER → 2, BOUNTY_HUNTER → 2, PIRATE → 1, PATROL → 1
  - Set `home_sector_id` to spawn sector
  - Set `behavior_state` to 'idle'
  - Add all new fields to `NPC.create()` call
- [ ] Add new function `getActiveNPCsNearPlayers()`:
  - Find all sectors with active player ships: `Ship.findAll({ where: { is_active: true }, attributes: ['current_sector_id'] })`
  - Get unique sector IDs
  - Also get adjacent sector IDs for each (via SectorConnection)
  - Find alive NPCs in those sectors: `NPC.findAll({ where: { current_sector_id: [...sectorIds], is_alive: true } })`
  - Return NPC list with sector info included
- [ ] Export new function

## Task 2.6: Phase 2 Verification

- [ ] Delete `server/data/spacewars.sqlite` (schema changed)
- [ ] Start server — universe regenerates with new NPC fields
- [ ] Verify new NPCs have `ai_personality`, `intelligence_tier`, `home_sector_id` populated
- [ ] Write quick test script to call `behaviorTreeService.evaluateNPCDecision()` with mock contexts:
  - NPC at 15% hull → should return 'flee'
  - Pirate in sector with weak player → should return 'attack_player'
  - Trader not at port → should return 'move_toward_target'
  - Ambiguous combat scenario → should return `needsAI: true`
- [ ] Run `npm test` — existing tests pass
