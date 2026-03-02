const gameSettingsService = require('../gameSettingsService');

// LLM Providers
const AnthropicProvider = require('./providers/anthropicProvider');
const OpenAIProvider = require('./providers/openaiProvider');
const GeminiProvider = require('./providers/geminiProvider');
const GrokProvider = require('./providers/grokProvider');
const OpenRouterProvider = require('./providers/openrouterProvider');
const LocalProvider = require('./providers/localProvider');
const NoneProvider = require('./providers/noneProvider');

// STT Providers
const OpenAISttProvider = require('./providers/stt/openaiSttProvider');
const GoogleSttProvider = require('./providers/stt/googleSttProvider');
const LocalSttProvider = require('./providers/stt/localSttProvider');
const NoneSttProvider = require('./providers/stt/noneSttProvider');

// TTS Providers
const OpenAITtsProvider = require('./providers/tts/openaiTtsProvider');
const ElevenLabsTtsProvider = require('./providers/tts/elevenlabsTtsProvider');
const GoogleTtsProvider = require('./providers/tts/googleTtsProvider');
const LocalTtsProvider = require('./providers/tts/localTtsProvider');
const NoneTtsProvider = require('./providers/tts/noneTtsProvider');

// Cached provider instances keyed by purpose
const providerCache = new Map();

// Track config hashes to know when to recreate providers
const configHashes = new Map();

/**
 * Create an LLM provider instance from type + config.
 */
const createProvider = (providerType, config) => {
  switch (providerType) {
    case 'anthropic': return new AnthropicProvider(config);
    case 'openai': return new OpenAIProvider(config);
    case 'gemini': return new GeminiProvider(config);
    case 'grok': return new GrokProvider(config);
    case 'openrouter': return new OpenRouterProvider(config);
    case 'local': return new LocalProvider(config);
    case 'none': return new NoneProvider(config);
    default: return new NoneProvider(config);
  }
};

/**
 * Create an STT provider instance from type + config.
 */
const createSttProvider = (providerType, config) => {
  switch (providerType) {
    case 'openai': return new OpenAISttProvider(config);
    case 'google': return new GoogleSttProvider(config);
    case 'local': return new LocalSttProvider(config);
    case 'none': return new NoneSttProvider(config);
    default: return new NoneSttProvider(config);
  }
};

/**
 * Create a TTS provider instance from type + config.
 */
const createTtsProvider = (providerType, config) => {
  switch (providerType) {
    case 'openai': return new OpenAITtsProvider(config);
    case 'elevenlabs': return new ElevenLabsTtsProvider(config);
    case 'google': return new GoogleTtsProvider(config);
    case 'local': return new LocalTtsProvider(config);
    case 'none': return new NoneTtsProvider(config);
    default: return new NoneTtsProvider(config);
  }
};

/**
 * Build a simple hash of config values to detect changes.
 * Must include ALL fields that are stored on provider instances,
 * otherwise cached providers will serve stale config.
 */
const buildConfigHash = (prefix, type) => {
  const parts = [
    gameSettingsService.getSetting(`${prefix}.provider`, 'none'),
    gameSettingsService.getSetting(`${prefix}.model`, ''),
    gameSettingsService.getSetting(`${prefix}.api_key`, ''),
    gameSettingsService.getSetting(`${prefix}.base_url`, ''),
  ];
  if (type === 'llm') {
    parts.push(gameSettingsService.getSetting(`${prefix}.temperature`, 0.7));
    parts.push(gameSettingsService.getSetting(`${prefix}.max_tokens`, 200));
  }
  if (type === 'stt') {
    parts.push(gameSettingsService.getSetting(`${prefix}.language`, 'en'));
  }
  if (type === 'tts') {
    parts.push(gameSettingsService.getSetting(`${prefix}.voice_id`, 'alloy'));
  }
  return parts.join('|');
};

/**
 * Get a provider by purpose. Reads current settings and caches instances.
 * Recreates if settings have changed.
 *
 * @param {'tactical'|'interactive'|'stt'|'tts'} purpose
 * @returns {BaseProvider|BaseSttProvider|BaseTtsProvider}
 */
const getProvider = (purpose) => {
  let prefix, type;

  switch (purpose) {
    case 'tactical':
      prefix = 'ai_llm.tactical';
      type = 'llm';
      break;
    case 'interactive':
      prefix = 'ai_llm.interactive';
      type = 'llm';
      break;
    case 'stt':
      prefix = 'ai_stt';
      type = 'stt';
      break;
    case 'tts':
      prefix = 'ai_tts';
      type = 'tts';
      break;
    default:
      throw new Error(`Unknown provider purpose: ${purpose}`);
  }

  // Check if cached provider is still valid
  const currentHash = buildConfigHash(prefix, type);
  const cachedHash = configHashes.get(purpose);

  if (providerCache.has(purpose) && cachedHash === currentHash) {
    return providerCache.get(purpose);
  }

  // Read config from settings
  const providerType = gameSettingsService.getSetting(`${prefix}.provider`, 'none');
  const config = {
    apiKey: gameSettingsService.getSetting(`${prefix}.api_key`, ''),
    model: gameSettingsService.getSetting(`${prefix}.model`, ''),
    baseUrl: gameSettingsService.getSetting(`${prefix}.base_url`, ''),
  };

  // LLM-specific config
  if (type === 'llm') {
    config.temperature = gameSettingsService.getSetting(`${prefix}.temperature`, 0.7);
    config.maxTokens = gameSettingsService.getSetting(`${prefix}.max_tokens`, 200);
  }

  // STT-specific config
  if (type === 'stt') {
    config.language = gameSettingsService.getSetting(`${prefix}.language`, 'en');
  }

  // TTS-specific config
  if (type === 'tts') {
    config.voiceId = gameSettingsService.getSetting(`${prefix}.voice_id`, 'alloy');
  }

  // Create and cache
  let provider;
  if (type === 'llm') provider = createProvider(providerType, config);
  else if (type === 'stt') provider = createSttProvider(providerType, config);
  else provider = createTtsProvider(providerType, config);

  providerCache.set(purpose, provider);
  configHashes.set(purpose, currentHash);

  return provider;
};

/**
 * Test a connection with temporary provider (not cached).
 * Used by admin panel "Test Connection" button.
 */
const testConnection = async (providerType, purpose, config) => {
  let provider;
  if (purpose === 'stt') {
    provider = createSttProvider(providerType, config);
  } else if (purpose === 'tts') {
    provider = createTtsProvider(providerType, config);
  } else {
    provider = createProvider(providerType, config);
  }
  return provider.testConnection();
};

/**
 * Clear all cached providers (call after settings change).
 */
const clearCache = () => {
  providerCache.clear();
  configHashes.clear();
};

module.exports = {
  createProvider,
  createSttProvider,
  createTtsProvider,
  getProvider,
  testConnection,
  clearCache
};
