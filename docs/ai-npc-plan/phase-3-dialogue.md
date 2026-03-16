# Phase 3: Dialogue System (Interactive Scripting + AI Fallback)

**Goal**: Menu-driven NPC conversations with scripted responses. Free-text falls through to AI. Voice-ready from day one (text-first, audio optional).
**Dependencies**: Phase 2 (personality service, NPC model extensions).
**Estimated files**: 6 new, 3 modified

---

## Task 3.1: Dialogue Scripts Service

**File**: `server/src/services/dialogueScriptsService.js` (NEW)

- [ ] Create scripted response functions per NPC type. Each function signature: `(npc, context) → { text, data? }`
  - `context` shape: `{ portCommodities?, sectorInfo, adjacentSectors, playerReputation?, recentEvents? }`
- [ ] **Trader scripts**:
  - `greet` — personality-flavored greeting, mention current trade goods
  - `buy` — return `{ text: "What are you looking to buy?", data: { action: 'open_trade_ui', mode: 'buy' } }`
  - `sell` — return `{ text: ..., data: { action: 'open_trade_ui', mode: 'sell' } }`
  - `ask_rumors` — pick from pool of 5-10 contextual rumors (based on nearby sector danger, recent combat logs, commodity price trends)
  - `ask_prices` — format current port prices into conversational text
  - `ask_routes` — suggest profitable trade routes based on adjacent port data
  - `farewell` — personality-flavored goodbye
- [ ] **Patrol scripts**:
  - `greet` — official greeting, mention sector safety status
  - `report_crime` — acknowledge report, update NPC behavior (future: mark sector)
  - `ask_safety` — report danger level of current + adjacent sectors
  - `ask_bounties` — list hostile NPCs in nearby sectors
  - `request_escort` — scripted decline or conditional accept
  - `farewell` — official dismissal
- [ ] **Bounty Hunter scripts**:
  - `greet` — terse, business-like greeting
  - `ask_targets` — mention high-value NPCs or players with bounties
  - `offer_contract` — scripted negotiation template
  - `ask_price` — quote based on target difficulty
  - `threaten` — personality-driven threat response
  - `farewell`
- [ ] **Pirate / Pirate Lord scripts** (for when player is captured or in dialogue):
  - `plead` — pirate's dismissive response
  - `bribe` — calculate bribe amount, accept/reject based on personality
  - `threaten_back` — pirate's reaction (cowardly pirates might back down)
  - `ask_mercy` — personality-dependent response
  - `farewell`
- [ ] Use NPC's `ai_personality.speech_style` to vary phrasing across all scripts
- [ ] Each script should have 3-5 variations to avoid repetition

## Task 3.2: Dialogue Cache Service

**File**: `server/src/services/dialogueCacheService.js` (NEW)

- [ ] Create in-memory `Map` with TTL tracking
- [ ] `getCached(cacheKey)` — returns cached response or null if expired
- [ ] `setCached(cacheKey, response, ttlSeconds)` — store with expiry timestamp
- [ ] `clearExpired()` — remove all expired entries (called by maintenance tick)
- [ ] `clearAll()` — flush cache (called on settings change)
- [ ] `getStats()` — return `{ size, hits, misses, hitRate }` for admin panel
- [ ] Cache key format: `${npcType}:${intentCategory}:${contextHash}`
- [ ] Default TTL values:
  - Price/trade questions: 300 seconds (5 min)
  - Lore/backstory: 86400 seconds (24 hr)
  - Tactical decisions: 60 seconds (1 min)
  - Generic greetings: 3600 seconds (1 hr)
  - Rumor responses: 1800 seconds (30 min)

## Task 3.3: Voice Service

**File**: `server/src/services/voiceService.js` (NEW)

- [ ] `transcribeAudio(audioBuffer, format)`:
  - Get STT provider via `aiProviderFactory.getProvider('stt')`
  - If provider is 'none', return null
  - Call `provider.transcribe(audioBuffer, format)`
  - Return `{ text, confidence }` or null on failure
  - Log errors but don't throw (graceful degradation)
- [ ] `synthesizeSpeech(text, npcPersonality)`:
  - Get TTS provider via `aiProviderFactory.getProvider('tts')`
  - If provider is 'none', return null
  - Map NPC `voice_profile` to provider-specific voice ID
  - Call `provider.synthesize(text, { voice: mappedVoiceId })`
  - Return `{ audioBuffer, format, duration_ms }` or null on failure
- [ ] `isVoiceEnabled()` — check `gameSettingsService.getSetting('npc.voice_enabled')`
- [ ] `isVoiceEnabledForUser(user)` — check both global voice setting AND user's `subscription_tier`:
  - Returns `false` if global `npc.voice_enabled` is false
  - Returns `false` if `user.subscription_tier === 'free'`
  - Returns `true` if `user.subscription_tier` is 'premium' or 'elite'
- [ ] `getVoiceMapping(voiceProfile, provider)` — map personality voice profiles to provider voice IDs:
  - OpenAI: alloy, echo, fable, onyx, nova, shimmer
  - ElevenLabs: configurable voice IDs
  - Local: configurable
- [ ] Export all functions

## Task 3.4: Dialogue Service (Orchestrator)

**File**: `server/src/services/dialogueService.js` (NEW)

- [ ] `startDialogue(userId, npcId)`:
  - Validate NPC exists, is alive, is in same sector as player's ship
  - Validate NPC type supports dialogue (TRADER, PATROL, BOUNTY_HUNTER, PIRATE, PIRATE_LORD)
  - Initialize dialogue_state on NPC: `{ active: true, user_id: userId, started_at: Date.now(), history: [] }`
  - Get menu options via `getMenuOptions(npc.npc_type, context)`
  - Check voice access via `voiceService.isVoiceEnabledForUser(user)` (requires loading User model)
  - Return `{ conversation_id: npc.npc_id, npc: { name, npc_type, personality_summary }, menu_options, voice_enabled, subscription_tier }`
- [ ] `selectMenuOption(userId, npcId, optionKey)`:
  - Validate active dialogue between user and NPC
  - Call appropriate script from dialogueScriptsService
  - Add to conversation history
  - If voice enabled AND user is premium/elite, generate TTS for response text via voiceService
  - Return `{ response_text, response_audio?, new_menu_options, data? }`
- [ ] `processFreeText(userId, npcId, text, conversationHistory)`:
  - Validate active dialogue
  - Check dialogue cache first
  - If AI enabled + NPC intelligence_tier >= 2:
    - Build interactive prompt via npcPersonalityService
    - Call AI provider via aiProviderFactory.getProvider('interactive')
    - Cache the response
    - If voice enabled, generate TTS
  - Else: return scripted fallback ("I don't quite follow. Perhaps try asking about [available topics].")
  - Return `{ response_text, response_audio?, is_ai_generated }`
- [ ] `processVoiceInput(userId, npcId, audioBuffer, format)`:
  - Check user subscription tier — if 'free', return `{ error: 'premium_required', message: 'Voice input requires a premium account. Upgrade to unlock voice features!' }`
  - Call `voiceService.transcribeAudio(audioBuffer, format)`
  - If transcription fails: return `{ error: 'voice_unavailable', message: 'Voice unavailable, please type your message' }`
  - Call `processFreeText(userId, npcId, transcribedText, history)`
  - Return `{ transcribed_text, response_text, response_audio?, is_ai_generated }`
- [ ] `endDialogue(userId, npcId)`:
  - Clear NPC's dialogue_state
  - Return farewell text from scripts
- [ ] `getMenuOptions(npcType, context)`:
  - Return array of `{ key, label, icon?, description }` per NPC type
  - TRADER: greet, buy, sell, ask_rumors, ask_prices, ask_routes, farewell
  - PATROL: greet, report_crime, ask_safety, ask_bounties, request_escort, farewell
  - BOUNTY_HUNTER: greet, ask_targets, offer_contract, ask_price, threaten, farewell
  - PIRATE/PIRATE_LORD: plead, bribe, threaten_back, ask_mercy, farewell

## Task 3.5: Dialogue Controller

**File**: `server/src/controllers/dialogueController.js` (NEW)

- [ ] `startDialogue(req, res, next)`:
  - Extract `npcId` from params
  - Call `dialogueService.startDialogue(req.userId, npcId)`
  - Return `{ success: true, data: result }`
- [ ] `selectOption(req, res, next)`:
  - Extract `npcId` from params, `option` from body
  - Validate option is a non-empty string
  - Call `dialogueService.selectMenuOption(req.userId, npcId, option)`
  - Return `{ success: true, data: result }`
- [ ] `sendMessage(req, res, next)`:
  - Extract `npcId` from params, `text` from body
  - Validate text is non-empty, max 500 chars
  - Call `dialogueService.processFreeText(req.userId, npcId, text)`
  - Return `{ success: true, data: result }`
- [ ] `sendVoice(req, res, next)`:
  - Extract `npcId` from params, audio file from `req.file` (multer)
  - Validate file exists, size < 5MB, format is webm/mp3/wav
  - Call `dialogueService.processVoiceInput(req.userId, npcId, req.file.buffer, format)`
  - Return `{ success: true, data: result }`
- [ ] `endDialogue(req, res, next)`:
  - Call `dialogueService.endDialogue(req.userId, npcId)`
  - Return `{ success: true, data: result }`
- [ ] `getConversationState(req, res, next)`:
  - Call `dialogueService.getConversationState(req.userId, npcId)` (get current dialogue_state from NPC)
  - Return `{ success: true, data: state }`

## Task 3.6: Dialogue Routes

**File**: `server/src/routes/dialogueRoutes.js` (NEW)

- [ ] Import multer for audio upload: `const multer = require('multer')`, configure memory storage, 5MB limit
- [ ] Set up routes:
  ```
  POST /:npcId/start     [authMiddleware]           → startDialogue
  POST /:npcId/option    [authMiddleware]           → selectOption
  POST /:npcId/message   [authMiddleware]           → sendMessage
  POST /:npcId/voice     [authMiddleware, upload]   → sendVoice
  POST /:npcId/end       [authMiddleware]           → endDialogue
  GET  /:npcId/state     [authMiddleware]           → getConversationState
  ```

## Task 3.7: Mount Dialogue Routes

**File**: `server/src/routes/index.js` (MODIFY)

- [ ] Import dialogueRoutes
- [ ] Mount: `router.use('/dialogue', dialogueRoutes)`

## Task 3.8: Add Dialogue API to Frontend Client

**File**: `client/src/services/api.js` (MODIFY)

- [ ] Add `dialogue` export:
  ```javascript
  export const dialogue = {
    start: (npcId) => api.post(`/dialogue/${npcId}/start`),
    selectOption: (npcId, option) => api.post(`/dialogue/${npcId}/option`, { option }),
    sendMessage: (npcId, text) => api.post(`/dialogue/${npcId}/message`, { text }),
    sendVoice: (npcId, audioBlob) => {
      const formData = new FormData();
      formData.append('audio', audioBlob, 'voice.webm');
      return api.post(`/dialogue/${npcId}/voice`, formData, { headers: { 'Content-Type': 'multipart/form-data' } });
    },
    end: (npcId) => api.post(`/dialogue/${npcId}/end`),
    getState: (npcId) => api.get(`/dialogue/${npcId}/state`),
  };
  ```

## Task 3.9: Add multer Dependency

**File**: `server/package.json` (MODIFY)

- [ ] `npm install multer` in server directory

## Task 3.10: Phase 3 Verification

- [ ] Start server with AI provider configured (set one up via direct DB insert or code)
- [ ] Use curl/Postman to test dialogue flow:
  - POST `/api/dialogue/:npcId/start` — get menu options
  - POST `/api/dialogue/:npcId/option` with `{ option: 'greet' }` — get scripted response
  - POST `/api/dialogue/:npcId/option` with `{ option: 'ask_rumors' }` — get contextual rumor
  - POST `/api/dialogue/:npcId/message` with `{ text: 'where can I find cheap fuel?' }` — get AI response (if configured) or fallback
  - POST `/api/dialogue/:npcId/end` — get farewell
- [ ] Verify cache: send same free-text twice, second should be cached (faster)
- [ ] Run `npm test` — existing tests pass
