# Phase 6: Admin Panel — AI Configuration + NPC Management

**Goal**: Full admin control over providers, models, prompts, difficulty, and NPC population.
**Dependencies**: Phase 1 (gameSettingsService API), Phase 4 (tick system status). Can start frontend work after Phase 1.
**Estimated files**: 4 new, 4 modified

---

## Task 6.1: Game Settings Controller

**File**: `server/src/controllers/gameSettingsController.js` (NEW)

- [ ] `getSettings(req, res, next)`:
  - Get all settings via `gameSettingsService.getPublicSettings()` (secrets masked)
  - Group by category for frontend consumption
  - Return `{ success: true, data: { ai_llm: {...}, ai_stt: {...}, ai_tts: {...}, npc: {...} } }`
- [ ] `updateSettings(req, res, next)`:
  - Body: `{ settings: { 'ai_llm.tactical.provider': 'openai', 'npc.difficulty': 4, ... } }`
  - Validate keys exist in known settings list
  - Call `gameSettingsService.setSettings(body.settings)`
  - Return `{ success: true, message: 'Settings updated' }`
- [ ] `testAIConnection(req, res, next)`:
  - Body: `{ provider_type, purpose, config: { api_key, model, base_url } }`
  - `purpose`: 'tactical', 'interactive', 'stt', 'tts'
  - Call `aiProviderFactory.testConnection(provider_type, purpose, config)`
  - Return `{ success: true, data: { connected: boolean, message, latency_ms } }`
- [ ] `getAIStats(req, res, next)`:
  - Get stats from aiProviderFactory: total calls, tokens used, avg latency, errors
  - Get cache stats from dialogueCacheService
  - Return `{ success: true, data: { llm_calls, tokens_used, avg_latency_ms, cache_hit_rate } }`
- [ ] `getAIDecisionLogs(req, res, next)`:
  - Query params: `page`, `limit` (default 50)
  - Get from npcActionExecutor's in-memory ring buffer
  - Return `{ success: true, data: { logs: [...], total } }`
- [ ] `getNPCPopulation(req, res, next)`:
  - Aggregate NPC counts by type and behavior_state
  - Query: `NPC.findAll({ attributes: ['npc_type', 'behavior_state', 'is_alive', [fn('COUNT'), 'count']], group: [...] })`
  - Also: total alive, total dead, avg hull %, avg intelligence_tier
  - Return `{ success: true, data: { by_type: {...}, by_state: {...}, totals: {...} } }`
- [ ] `forceRespawn(req, res, next)`:
  - Call `npcService.respawnNPCs()` (existing function — respawns all eligible)
  - Also force-respawn NPCs whose respawn_at is in the future (override timer)
  - Return `{ success: true, data: { respawned_count } }`
- [ ] `getTickStatus(req, res, next)`:
  - Call `tickService.getStatus()`
  - Return `{ success: true, data: status }`

## Task 6.2: Add Admin Routes

**File**: `server/src/routes/adminRoutes.js` (MODIFY)

- [ ] Import `gameSettingsController`
- [ ] Add routes (all protected by existing authMiddleware + adminMiddleware):
  ```javascript
  // Settings
  router.get('/settings', gameSettingsController.getSettings);
  router.put('/settings', gameSettingsController.updateSettings);

  // AI
  router.post('/ai/test', gameSettingsController.testAIConnection);
  router.get('/ai/stats', gameSettingsController.getAIStats);
  router.get('/ai/logs', gameSettingsController.getAIDecisionLogs);

  // NPC Management
  router.get('/npcs/stats', gameSettingsController.getNPCPopulation);
  router.post('/npcs/respawn', gameSettingsController.forceRespawn);

  // Tick System
  router.get('/ticks/status', gameSettingsController.getTickStatus);
  ```

## Task 6.3: Extend Frontend API Client

**File**: `client/src/services/api.js` (MODIFY)

- [ ] Extend `admin` export:
  ```javascript
  export const admin = {
    // Existing:
    generateUniverse: (params) => api.post('/admin/universe/generate', params),
    getConfig: () => api.get('/admin/universe/config'),
    // New:
    getSettings: () => api.get('/admin/settings'),
    updateSettings: (settings) => api.put('/admin/settings', { settings }),
    testAIConnection: (config) => api.post('/admin/ai/test', config),
    getAIStats: () => api.get('/admin/ai/stats'),
    getAILogs: (params) => api.get('/admin/ai/logs', { params }),
    getNPCStats: () => api.get('/admin/npcs/stats'),
    forceRespawn: () => api.post('/admin/npcs/respawn'),
    getTickStatus: () => api.get('/admin/ticks/status'),
  };
  ```

## Task 6.4: AI Configuration Tab Component

**File**: `client/src/components/admin/AIConfigTab.jsx` (NEW)

- [ ] Fetch settings on mount via `admin.getSettings()`
- [ ] **LLM Configuration Section** — two-column layout:
  - Left column: **Tactical AI**
  - Right column: **Interactive AI**
  - Each column contains:
    - [ ] Provider dropdown: None, Anthropic, OpenAI, Gemini, Grok, OpenRouter, Local
    - [ ] Model name input (text)
    - [ ] API key input (`type="password"`, show masked value from server, only save if changed)
    - [ ] Base URL input (shown only for Local and OpenRouter providers)
    - [ ] Temperature slider: 0.0 to 2.0, step 0.1, default 0.7
    - [ ] Max tokens input: number, default 200 (tactical) / 300 (interactive)
    - [ ] Test Connection button:
      - On click: call `admin.testAIConnection({ provider_type, purpose, config })`
      - Show result: green check + latency or red X + error message
      - Loading spinner during test

- [ ] **Voice Configuration Section** — two-column layout:
  - Left column: **Speech-to-Text**
    - [ ] Provider dropdown: None, OpenAI (Whisper), Google, Local
    - [ ] API key input
    - [ ] Model input (default: 'whisper-1')
    - [ ] Language input (default: 'en')
    - [ ] Test button (record 3 seconds of audio, transcribe, show result)
  - Right column: **Text-to-Speech**
    - [ ] Provider dropdown: None, OpenAI, ElevenLabs, Google, Local
    - [ ] API key input
    - [ ] Model input
    - [ ] Voice ID dropdown/input
    - [ ] Test button (synthesize "Hello, I am a trader from Port Nexus", play audio)
  - [ ] Voice enable/disable toggle

- [ ] **Prompt Templates Section**:
  - [ ] Tab row: PIRATE | TRADER | PATROL | BOUNTY_HUNTER | PIRATE_LORD
  - [ ] For each tab:
    - Textarea for system prompt template (monospace font, min height 200px)
    - Document available variables: `{npc_name}`, `{npc_type}`, `{trait_primary}`, `{trait_secondary}`, `{speech_style}`, `{quirk}`, `{sector_name}`, `{hull_percent}`, `{nearby_players}`
    - "Reset to Default" button per template
  - [ ] Preview button: show example prompt with variables filled in

- [ ] **Difficulty Section**:
  - [ ] Slider: 1-5 with labels below: Passive (1), Easy (2), Normal (3), Hard (4), Brutal (5)
  - [ ] Description text updates based on selected level:
    - 1: "NPCs rarely attack. AI almost never consulted."
    - 3: "Balanced combat. AI consulted for ambiguous situations."
    - 5: "NPCs are highly aggressive. AI frequently drives tactical decisions."

- [ ] **Global Toggles**:
  - [ ] AI Enabled (master toggle)
  - [ ] Per-NPC-type AI toggles: PIRATE, TRADER, PATROL, BOUNTY_HUNTER, PIRATE_LORD

- [ ] **Save Button**:
  - Collects all changed settings into key-value map
  - Calls `admin.updateSettings(changedSettings)`
  - Shows success/error toast
  - Only sends changed values (diff from original)

## Task 6.5: NPC Management Tab Component

**File**: `client/src/components/admin/NPCManagementTab.jsx` (NEW)

- [ ] Fetch NPC stats on mount via `admin.getNPCStats()`
- [ ] Fetch tick status via `admin.getTickStatus()`
- [ ] Auto-refresh every 30 seconds

- [ ] **Population Stats Grid**:
  - Card per NPC type (5 cards in a grid)
  - Each card shows: type name, alive count, dead count, avg hull %, primary behavior state
  - Color-coded: pirates red, traders green, patrol cyan, bounty hunter orange, pirate lord purple

- [ ] **Controls Row**:
  - [ ] Spawn Rate Multiplier slider: 0.1 to 3.0, step 0.1, default 1.0
  - [ ] Force Respawn All button with confirmation dialog ("This will respawn all dead NPCs immediately. Continue?")
  - [ ] Show respawn result count

- [ ] **AI Decision Log Table**:
  - Fetch via `admin.getAILogs({ page, limit: 50 })`
  - Columns: Timestamp, NPC Name, Type, Action, Reason, AI Used (badge), Latency (ms)
  - AI Used column: green badge "AI" or gray badge "Scripted"
  - Sortable by timestamp (newest first)
  - Pagination controls
  - Auto-refresh toggle

- [ ] **Tick System Status Card**:
  - Running/Stopped indicator (green/red dot)
  - Started at timestamp
  - Total tactical ticks since start
  - Average tick duration (ms)
  - Last tick timestamp
  - Active NPC count (NPCs being processed per tick)

## Task 6.6: Add User Subscription Management to Admin

**File**: `server/src/controllers/gameSettingsController.js` (extend from Task 6.1)

- [ ] `getUserList(req, res, next)`:
  - Query users with `attributes: ['user_id', 'username', 'email', 'subscription_tier', 'is_admin', 'created_at', 'last_login']`
  - Support query params: `page`, `limit` (default 25), `search` (username/email), `tier` (filter by tier)
  - Return `{ success: true, data: { users, total, page, pages } }`
- [ ] `updateUserTier(req, res, next)`:
  - Body: `{ user_id, subscription_tier }` — validate tier is 'free', 'premium', or 'elite'
  - Update user record
  - Return `{ success: true, message: 'User tier updated' }`

**File**: `server/src/routes/adminRoutes.js` (extend from Task 6.2)

- [ ] Add routes:
  ```javascript
  router.get('/users', gameSettingsController.getUserList);
  router.put('/users/tier', gameSettingsController.updateUserTier);
  ```

**File**: `client/src/services/api.js` (extend from Task 6.3)

- [ ] Add to `admin` export:
  ```javascript
  getUsers: (params) => api.get('/admin/users', { params }),
  updateUserTier: (userId, tier) => api.put('/admin/users/tier', { user_id: userId, subscription_tier: tier }),
  ```

## Task 6.7: Refactor Admin Page to Tabbed Layout

**File**: `client/src/components/admin/AdminPage.jsx` (MODIFY)

- [ ] Add tab state: `const [activeTab, setActiveTab] = useState('universe')`
- [ ] Create tab navigation bar:
  ```jsx
  const tabs = [
    { key: 'universe', label: 'Universe', icon: Globe },
    { key: 'ai', label: 'AI Configuration', icon: Cpu },
    { key: 'npcs', label: 'NPC Management', icon: Users },
    { key: 'users', label: 'Users', icon: UserCog },
  ];
  ```
- [ ] Tab styling: use existing card/btn patterns, active tab with `bg-accent-cyan/20 border-accent-cyan`
- [ ] Move existing universe generation JSX into a conditional render for `activeTab === 'universe'`
- [ ] Render `<AIConfigTab />` when `activeTab === 'ai'`
- [ ] Render `<NPCManagementTab />` when `activeTab === 'npcs'`
- [ ] Render user management section when `activeTab === 'users'`:
  - User search input
  - Table: username, email, tier (dropdown: free/premium/elite), last login
  - Tier dropdown changes call `admin.updateUserTier()` immediately
  - Pagination controls
- [ ] Import new components and icons

## Task 6.8: Phase 6 Verification

- [ ] Start server and log in as admin
- [ ] Navigate to `/admin` — verify tabbed layout with 4 tabs
- [ ] **Universe tab**: existing functionality still works
- [ ] **AI Configuration tab**:
  - [ ] Change tactical provider to OpenAI, enter API key and model name
  - [ ] Click Test Connection — verify it shows success/error with latency
  - [ ] Change difficulty to 4, toggle voice off
  - [ ] Edit PIRATE prompt template
  - [ ] Click Save — verify settings persisted (refresh page, values still there)
  - [ ] API keys show masked (not full key)
- [ ] **NPC Management tab**:
  - [ ] See population stats per NPC type
  - [ ] Click Force Respawn — verify count updates
  - [ ] See AI Decision Log entries (may be empty if tick hasn't run yet with AI)
  - [ ] See tick status showing running
- [ ] **Users tab**:
  - [ ] See list of registered users with their subscription tier
  - [ ] Search for a user by username
  - [ ] Change a user's tier from 'free' to 'premium' — verify it saves
  - [ ] Verify the upgraded user can now access voice features in NPC chat
- [ ] Run `npm test` — existing tests pass
