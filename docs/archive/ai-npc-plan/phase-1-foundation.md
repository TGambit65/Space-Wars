# Phase 1: Foundation — GameSettings Model + AI Provider Abstraction

**Goal**: Persistent settings in DB and a pluggable provider layer for LLM, STT, and TTS.
**Dependencies**: None — this phase has zero dependencies on other new code.
**Estimated files**: 22 new, 4 modified

---

## Task 1.1: GameSetting Sequelize Model

**File**: `server/src/models/GameSetting.js` (NEW)

- [ ] Create model with fields:
  - `setting_id` UUID primary key (auto-generated)
  - `category` STRING(50) not null — values: 'ai_llm', 'ai_stt', 'ai_tts', 'npc', 'tick', 'general'
  - `key` STRING(100) not null, unique — dot-notation keys like `ai_llm.tactical.provider`
  - `value` TEXT nullable — JSON-encoded value
  - `value_type` STRING(20) default 'string' — 'string', 'number', 'boolean', 'json'
  - `is_secret` BOOLEAN default false — mask on GET endpoints
  - `description` STRING(500) nullable — human-readable description
- [ ] Add indexes: `category`, unique on `key`
- [ ] Use existing timestamp pattern: `created_at`, `updated_at`

## Task 1.2: Add Subscription Tier to User Model

**File**: `server/src/models/User.js` (MODIFY)

- [ ] Add `subscription_tier` field:
  ```javascript
  subscription_tier: {
    type: DataTypes.STRING(20),
    defaultValue: 'free',
    allowNull: false,
    validate: {
      isIn: [['free', 'premium', 'elite']]
    },
    comment: 'Account tier: free (text-only), premium (voice + priority), elite (all features + custom voices)'
  }
  ```
- [ ] Field auto-included in `toJSON()` output (no exclusion needed)
- [ ] Tiers define feature access:
  - **free**: Text-only NPC dialogue, menu options, free-text AI (when enabled)
  - **premium**: All free features + voice input (STT) + voice output (TTS) + priority AI queue
  - **elite**: All premium features + custom voice profiles + extended conversation history

## Task 1.3: Register GameSetting in Models Index

**File**: `server/src/models/index.js` (MODIFY)

- [ ] Import GameSetting model
- [ ] Add to `module.exports` alongside existing models
- [ ] No associations needed (standalone table)

## Task 1.4: GameSettings Service (In-Memory Cache)

**File**: `server/src/services/gameSettingsService.js` (NEW)

- [ ] Create in-memory `Map` cache
- [ ] Implement `loadAllSettings()`:
  - Fetch all rows from GameSetting table
  - Populate cache map (key → parsed value)
  - If table is empty, call `seedDefaults()` first
- [ ] Implement `seedDefaults()` — insert all default settings:
  - **LLM Tactical**: `ai_llm.tactical.provider` ('none'), `.model` (''), `.api_key` ('' + is_secret), `.base_url` (''), `.temperature` (0.7), `.max_tokens` (200)
  - **LLM Interactive**: `ai_llm.interactive.provider` ('none'), same sub-keys
  - **STT**: `ai_stt.provider` ('none'), `.api_key` (secret), `.model` ('whisper-1'), `.language` ('en')
  - **TTS**: `ai_tts.provider` ('none'), `.api_key` (secret), `.model` ('tts-1'), `.voice_id` ('alloy')
  - **NPC**: `npc.ai_enabled` (true), `npc.voice_enabled` (false), `npc.difficulty` (3), `npc.tick_rate_seconds` (30), `npc.combat_tick_rate_seconds` (15), `npc.spawn_rate_multiplier` (1.0)
  - **Prompt Templates**: `ai_llm.prompt.PIRATE`, `.TRADER`, `.PATROL`, `.BOUNTY_HUNTER`, `.PIRATE_LORD` — each with a default system prompt template string
- [ ] Implement `getSetting(key, defaultValue)` — read from cache, return parsed value
- [ ] Implement `setSetting(key, value, opts)` — write to DB + update cache. opts: `{ category, value_type, is_secret, description }`
- [ ] Implement `setSettings(keyValueMap)` — bulk update (used by admin PUT)
- [ ] Implement `getSettingsByCategory(category)` — all settings in a category from cache
- [ ] Implement `getPublicSettings(category)` — same but mask `is_secret` values (show `***...` + last 4 chars of actual value)
- [ ] Export all functions

## Task 1.5: Load Settings on Server Startup

**File**: `server/src/index.js` (MODIFY)

- [ ] Import `gameSettingsService`
- [ ] After database sync and universe generation, call `await gameSettingsService.loadAllSettings()`
- [ ] Add console log: `'  Game settings loaded from database'`

## Task 1.6: Base LLM Provider Class

**File**: `server/src/services/ai/providers/baseProvider.js` (NEW)

- [ ] Create `BaseProvider` class:
  ```javascript
  class BaseProvider {
    constructor(config) // { apiKey, model, baseUrl, temperature, maxTokens }
    async generateText(messages, options) // → { text, usage: { prompt_tokens, completion_tokens }, latency_ms }
    async testConnection() // → { success: boolean, message: string, latency_ms }
  }
  ```
- [ ] Both methods throw 'Not implemented' by default
- [ ] Constructor validates required config fields

## Task 1.7: OpenAI-Compatible Provider (Reusable Base)

**File**: `server/src/services/ai/providers/openaiProvider.js` (NEW)

- [ ] Extends `BaseProvider`
- [ ] `generateText(messages, options)`:
  - POST to `${baseUrl}/v1/chat/completions` (default: `https://api.openai.com`)
  - Headers: `Authorization: Bearer ${apiKey}`, `Content-Type: application/json`
  - Body: `{ model, messages, temperature, max_tokens }` + any options overrides
  - Parse response: extract `choices[0].message.content`, `usage`
  - Calculate latency with `Date.now()` before/after
  - Handle errors: network, 401, 429 rate limit, 500
- [ ] `testConnection()`:
  - Send minimal prompt: `[{ role: 'user', content: 'ping' }]` with `max_tokens: 5`
  - Return success/failure with latency
- [ ] Use Node 18+ built-in `fetch` (no new dependencies)

## Task 1.8: Anthropic Provider

**File**: `server/src/services/ai/providers/anthropicProvider.js` (NEW)

- [ ] Extends `BaseProvider`
- [ ] `generateText(messages, options)`:
  - POST to `https://api.anthropic.com/v1/messages`
  - Headers: `x-api-key: ${apiKey}`, `anthropic-version: 2023-06-01`, `Content-Type: application/json`
  - Convert messages array to Anthropic format (separate system from user/assistant)
  - Body: `{ model, messages, system?, max_tokens, temperature }`
  - Parse response: extract `content[0].text`, `usage`
- [ ] `testConnection()` — same pattern, minimal prompt

## Task 1.9: Gemini Provider

**File**: `server/src/services/ai/providers/geminiProvider.js` (NEW)

- [ ] Extends `BaseProvider`
- [ ] `generateText(messages, options)`:
  - POST to `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`
  - Convert messages to Gemini `contents` format (`role: 'user'/'model'`, `parts: [{ text }]`)
  - Extract system message as `systemInstruction` if present
  - Parse response: extract `candidates[0].content.parts[0].text`, `usageMetadata`
- [ ] `testConnection()`

## Task 1.10: Grok Provider

**File**: `server/src/services/ai/providers/grokProvider.js` (NEW)

- [ ] Extends `OpenAIProvider` (OpenAI-compatible API)
- [ ] Override constructor to set `baseUrl` to `https://api.x.ai` if not provided
- [ ] Everything else inherited from openaiProvider

## Task 1.11: OpenRouter Provider

**File**: `server/src/services/ai/providers/openrouterProvider.js` (NEW)

- [ ] Extends `OpenAIProvider`
- [ ] Override constructor to set `baseUrl` to `https://openrouter.ai/api` if not provided
- [ ] Add `HTTP-Referer` and `X-Title` headers (OpenRouter requires these)
- [ ] Everything else inherited

## Task 1.12: Local Provider

**File**: `server/src/services/ai/providers/localProvider.js` (NEW)

- [ ] Extends `OpenAIProvider`
- [ ] Constructor requires `baseUrl` (e.g., `http://localhost:8000` for vLLM)
- [ ] No default baseUrl — must be configured by admin
- [ ] Everything else inherited

## Task 1.13: None Provider (Disabled Fallback)

**File**: `server/src/services/ai/providers/noneProvider.js` (NEW)

- [ ] Extends `BaseProvider`
- [ ] `generateText()` — returns `null` immediately (signals caller to use scripted fallback)
- [ ] `testConnection()` — returns `{ success: true, message: 'AI disabled (none provider)' }`

## Task 1.14: Base STT Provider

**File**: `server/src/services/ai/providers/stt/baseSttProvider.js` (NEW)

- [ ] Create `BaseSttProvider` class:
  ```javascript
  class BaseSttProvider {
    constructor(config) // { apiKey, model, language }
    async transcribe(audioBuffer, format) // → { text, confidence, language, latency_ms }
    async testConnection() // → { success, message }
  }
  ```

## Task 1.15: OpenAI STT Provider (Whisper API)

**File**: `server/src/services/ai/providers/stt/openaiSttProvider.js` (NEW)

- [ ] Extends `BaseSttProvider`
- [ ] `transcribe(audioBuffer, format)`:
  - POST to `https://api.openai.com/v1/audio/transcriptions`
  - Multipart form data: `file` (audio buffer), `model` ('whisper-1'), `language`
  - Parse response: `{ text }`
  - Use `FormData` with built-in `fetch`
- [ ] `testConnection()` — verify API key is valid (list models or minimal test)

## Task 1.16: Google STT Provider

**File**: `server/src/services/ai/providers/stt/googleSttProvider.js` (NEW)

- [ ] Extends `BaseSttProvider`
- [ ] Google Cloud Speech-to-Text REST API
- [ ] Convert audio to base64, send with encoding/sampleRate config

## Task 1.17: Local STT Provider

**File**: `server/src/services/ai/providers/stt/localSttProvider.js` (NEW)

- [ ] Extends `BaseSttProvider`
- [ ] POST to configurable local endpoint (faster-whisper or whisper.cpp HTTP server)
- [ ] OpenAI-compatible Whisper API format (many local servers implement this)

## Task 1.18: None STT Provider

**File**: `server/src/services/ai/providers/stt/noneSttProvider.js` (NEW)

- [ ] Returns `null` — voice input disabled

## Task 1.19: Base TTS Provider

**File**: `server/src/services/ai/providers/tts/baseTtsProvider.js` (NEW)

- [ ] Create `BaseTtsProvider` class:
  ```javascript
  class BaseTtsProvider {
    constructor(config) // { apiKey, model, voiceId }
    async synthesize(text, voiceOpts) // → { audioBuffer, format, duration_ms, latency_ms }
    async testConnection() // → { success, message }
  }
  ```

## Task 1.20: OpenAI TTS Provider

**File**: `server/src/services/ai/providers/tts/openaiTtsProvider.js` (NEW)

- [ ] Extends `BaseTtsProvider`
- [ ] `synthesize(text, voiceOpts)`:
  - POST to `https://api.openai.com/v1/audio/speech`
  - Body: `{ model: 'tts-1', input: text, voice: voiceId, response_format: 'mp3' }`
  - Return audio buffer from response

## Task 1.21: ElevenLabs TTS Provider

**File**: `server/src/services/ai/providers/tts/elevenlabsTtsProvider.js` (NEW)

- [ ] Extends `BaseTtsProvider`
- [ ] POST to `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`
- [ ] `xi-api-key` header

## Task 1.22: Google TTS Provider

**File**: `server/src/services/ai/providers/tts/googleTtsProvider.js` (NEW)

- [ ] Extends `BaseTtsProvider`
- [ ] Google Cloud Text-to-Speech REST API

## Task 1.23: Local TTS Provider

**File**: `server/src/services/ai/providers/tts/localTtsProvider.js` (NEW)

- [ ] POST to configurable local endpoint (Piper TTS HTTP server)

## Task 1.24: None TTS Provider

**File**: `server/src/services/ai/providers/tts/noneTtsProvider.js` (NEW)

- [ ] Returns `null` — voice output disabled

## Task 1.25: AI Provider Factory

**File**: `server/src/services/ai/aiProviderFactory.js` (NEW)

- [ ] `createProvider(providerType, config)` — switch on type, return new instance:
  - 'anthropic' → AnthropicProvider
  - 'openai' → OpenAIProvider
  - 'gemini' → GeminiProvider
  - 'grok' → GrokProvider
  - 'openrouter' → OpenRouterProvider
  - 'local' → LocalProvider
  - 'none' → NoneProvider
- [ ] `createSttProvider(providerType, config)` — same pattern for STT
- [ ] `createTtsProvider(providerType, config)` — same pattern for TTS
- [ ] `getProvider(purpose)` — purpose: 'tactical'|'interactive'|'stt'|'tts'
  - Reads current config from `gameSettingsService`
  - Creates and returns provider instance
  - Caches instances, recreates on settings change
- [ ] `testConnection(providerType, purpose, config)` — creates temporary provider, calls testConnection(), returns result

## Task 1.26: Update Test Helpers

**File**: `server/tests/helpers.js` (MODIFY)

- [ ] Add `GameSetting` to the `cleanDatabase()` destroy list
- [ ] Add `createTestGameSetting(overrides)` factory function

## Task 1.27: Phase 1 Verification

- [ ] Delete `server/data/spacewars.sqlite` to force schema recreation
- [ ] Start server: `cd server && npm run dev`
- [ ] Verify GameSetting table created and seeded with defaults
- [ ] Verify settings loaded message in console
- [ ] Run existing tests: `cd server && npm test` — all pass
- [ ] Manual test: query settings via a quick script or future admin API
