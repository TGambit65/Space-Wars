/**
 * AI Provider Factory Tests
 * Mocks gameSettingsService.
 */
jest.mock('../../src/services/gameSettingsService');

const aiProviderFactory = require('../../src/services/ai/aiProviderFactory');
const gameSettingsService = require('../../src/services/gameSettingsService');

describe('AI Provider Factory', () => {
  afterEach(() => {
    aiProviderFactory.clearCache();
    jest.restoreAllMocks();
  });

  // Helper: set up mock settings for a given purpose
  const setupMockSettings = (overrides = {}) => {
    const defaults = {
      'ai_llm.tactical.provider': 'none',
      'ai_llm.tactical.model': '',
      'ai_llm.tactical.api_key': '',
      'ai_llm.tactical.base_url': '',
      'ai_llm.tactical.temperature': 0.7,
      'ai_llm.tactical.max_tokens': 200,
      'ai_llm.interactive.provider': 'none',
      'ai_llm.interactive.model': '',
      'ai_llm.interactive.api_key': '',
      'ai_llm.interactive.base_url': '',
      'ai_llm.interactive.temperature': 0.7,
      'ai_llm.interactive.max_tokens': 300,
      'ai_stt.provider': 'none',
      'ai_stt.api_key': '',
      'ai_stt.model': 'whisper-1',
      'ai_stt.base_url': '',
      'ai_stt.language': 'en',
      'ai_tts.provider': 'none',
      'ai_tts.api_key': '',
      'ai_tts.model': 'tts-1',
      'ai_tts.base_url': '',
      'ai_tts.voice_id': 'alloy',
      ...overrides
    };

    gameSettingsService.getSetting.mockImplementation((key, defaultVal) => {
      return key in defaults ? defaults[key] : defaultVal;
    });
  };

  // ─── getProvider ────────────────────────────────────────────────

  describe('getProvider', () => {
    it('should return NoneProvider for "none" provider setting', () => {
      setupMockSettings();
      const provider = aiProviderFactory.getProvider('tactical');
      expect(provider.constructor.name).toBe('NoneProvider');
    });

    it('should return correct provider for "anthropic"', () => {
      setupMockSettings({ 'ai_llm.tactical.provider': 'anthropic' });
      const provider = aiProviderFactory.getProvider('tactical');
      expect(provider.constructor.name).toBe('AnthropicProvider');
    });

    it('should return correct provider for "openai"', () => {
      setupMockSettings({ 'ai_llm.interactive.provider': 'openai' });
      const provider = aiProviderFactory.getProvider('interactive');
      expect(provider.constructor.name).toBe('OpenAIProvider');
    });

    it('should return correct provider for "gemini"', () => {
      setupMockSettings({ 'ai_llm.tactical.provider': 'gemini' });
      const provider = aiProviderFactory.getProvider('tactical');
      expect(provider.constructor.name).toBe('GeminiProvider');
    });

    it('should return correct provider for "local"', () => {
      setupMockSettings({
        'ai_llm.tactical.provider': 'local',
        'ai_llm.tactical.base_url': 'http://localhost:8000'
      });
      const provider = aiProviderFactory.getProvider('tactical');
      expect(provider.constructor.name).toBe('LocalProvider');
    });

    it('should default to NoneProvider for unknown provider type', () => {
      setupMockSettings({ 'ai_llm.tactical.provider': 'unknownxyz' });
      const provider = aiProviderFactory.getProvider('tactical');
      expect(provider.constructor.name).toBe('NoneProvider');
    });

    it('should cache provider instances (same ref on 2nd call)', () => {
      setupMockSettings();
      const first = aiProviderFactory.getProvider('tactical');
      const second = aiProviderFactory.getProvider('tactical');
      expect(first).toBe(second);
    });

    it('should recreate provider when settings change (hash mismatch)', () => {
      setupMockSettings({ 'ai_llm.tactical.provider': 'none' });
      const first = aiProviderFactory.getProvider('tactical');

      // Change settings to a different provider
      setupMockSettings({ 'ai_llm.tactical.provider': 'openai', 'ai_llm.tactical.api_key': 'sk-test' });
      const second = aiProviderFactory.getProvider('tactical');

      expect(first).not.toBe(second);
      expect(second.constructor.name).toBe('OpenAIProvider');
    });

    it('should throw for unknown purpose', () => {
      setupMockSettings();
      expect(() => aiProviderFactory.getProvider('unknown_purpose')).toThrow('Unknown provider purpose');
    });

    it('should return STT provider for "stt" purpose', () => {
      setupMockSettings({ 'ai_stt.provider': 'openai' });
      const provider = aiProviderFactory.getProvider('stt');
      expect(provider.constructor.name).toBe('OpenAISttProvider');
    });

    it('should return TTS provider for "tts" purpose', () => {
      setupMockSettings({ 'ai_tts.provider': 'openai' });
      const provider = aiProviderFactory.getProvider('tts');
      expect(provider.constructor.name).toBe('OpenAITtsProvider');
    });
  });

  // ─── testConnection ─────────────────────────────────────────────

  describe('testConnection', () => {
    it('should create temporary provider and test connection', async () => {
      const result = await aiProviderFactory.testConnection('none', 'tactical', {});
      expect(result).toHaveProperty('success', true);
    });

    it('should handle STT purpose', async () => {
      const result = await aiProviderFactory.testConnection('none', 'stt', {});
      expect(result).toHaveProperty('success', true);
    });

    it('should handle TTS purpose', async () => {
      const result = await aiProviderFactory.testConnection('none', 'tts', {});
      expect(result).toHaveProperty('success', true);
    });
  });

  // ─── clearCache ─────────────────────────────────────────────────

  describe('clearCache', () => {
    it('should clear cached providers and hashes', () => {
      setupMockSettings();
      const first = aiProviderFactory.getProvider('tactical');
      aiProviderFactory.clearCache();
      const second = aiProviderFactory.getProvider('tactical');
      // After clearing, a new provider is created
      expect(first).not.toBe(second);
    });
  });
});
