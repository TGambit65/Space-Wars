/**
 * Voice Service Tests
 * Mocks gameSettingsService and aiProviderFactory.
 */
jest.mock('../../src/services/gameSettingsService');
jest.mock('../../src/services/ai/aiProviderFactory');

const voiceService = require('../../src/services/voiceService');
const gameSettingsService = require('../../src/services/gameSettingsService');
const aiProviderFactory = require('../../src/services/ai/aiProviderFactory');

describe('Voice Service', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  // ─── isVoiceEnabled ─────────────────────────────────────────────

  describe('isVoiceEnabled', () => {
    it('should return true when npc.voice_enabled is true', () => {
      gameSettingsService.getSetting.mockReturnValue(true);
      expect(voiceService.isVoiceEnabled()).toBe(true);
    });

    it('should return false when npc.voice_enabled is false', () => {
      gameSettingsService.getSetting.mockReturnValue(false);
      expect(voiceService.isVoiceEnabled()).toBe(false);
    });
  });

  // ─── isVoiceEnabledForUser ──────────────────────────────────────

  describe('isVoiceEnabledForUser', () => {
    it('should return false when globally disabled', () => {
      gameSettingsService.getSetting.mockReturnValue(false);
      expect(voiceService.isVoiceEnabledForUser({ subscription_tier: 'premium' })).toBe(false);
    });

    it('should return false for null user', () => {
      gameSettingsService.getSetting.mockReturnValue(true);
      expect(voiceService.isVoiceEnabledForUser(null)).toBe(false);
    });

    it('should return false for free tier user', () => {
      gameSettingsService.getSetting.mockReturnValue(true);
      expect(voiceService.isVoiceEnabledForUser({ subscription_tier: 'free' })).toBe(false);
    });

    it('should return true for premium user when enabled', () => {
      gameSettingsService.getSetting.mockReturnValue(true);
      expect(voiceService.isVoiceEnabledForUser({ subscription_tier: 'premium' })).toBe(true);
    });

    it('should return true for elite user when enabled', () => {
      gameSettingsService.getSetting.mockReturnValue(true);
      expect(voiceService.isVoiceEnabledForUser({ subscription_tier: 'elite' })).toBe(true);
    });

    it('should return false for user with no subscription_tier', () => {
      gameSettingsService.getSetting.mockReturnValue(true);
      expect(voiceService.isVoiceEnabledForUser({})).toBe(false);
    });
  });

  // ─── getVoiceMapping ────────────────────────────────────────────

  describe('getVoiceMapping', () => {
    beforeEach(() => {
      gameSettingsService.getSetting.mockReturnValue('alloy');
    });

    it('should return correct openai voice for known profile', () => {
      expect(voiceService.getVoiceMapping('deep_gruff', 'openai')).toBe('onyx');
      expect(voiceService.getVoiceMapping('smooth_confident', 'openai')).toBe('alloy');
      expect(voiceService.getVoiceMapping('commanding', 'openai')).toBe('echo');
    });

    it('should return correct elevenlabs voice for known profile', () => {
      expect(voiceService.getVoiceMapping('deep_gruff', 'elevenlabs')).toBe('adam');
      expect(voiceService.getVoiceMapping('smooth_confident', 'elevenlabs')).toBe('rachel');
    });

    it('should return correct google voice for known profile', () => {
      expect(voiceService.getVoiceMapping('deep_gruff', 'google')).toBe('en-US-Wavenet-D');
      expect(voiceService.getVoiceMapping('cheerful', 'google')).toBe('en-US-Wavenet-F');
    });

    it('should return fallback default for unknown provider', () => {
      expect(voiceService.getVoiceMapping('deep_gruff', 'unknown_provider')).toBe('alloy');
    });

    it('should return fallback default for unknown profile', () => {
      expect(voiceService.getVoiceMapping('unknown_profile', 'openai')).toBe('alloy');
    });
  });

  // ─── transcribeAudio ────────────────────────────────────────────

  describe('transcribeAudio', () => {
    it('should return null when provider is "none"', async () => {
      gameSettingsService.getSetting.mockReturnValue('none');
      const result = await voiceService.transcribeAudio(Buffer.from('test'), 'webm');
      expect(result).toBeNull();
    });

    it('should call provider.transcribe when provider is active', async () => {
      gameSettingsService.getSetting.mockReturnValue('openai');
      const mockProvider = {
        transcribe: jest.fn().mockResolvedValue({ text: 'hello', confidence: 0.95 })
      };
      aiProviderFactory.getProvider.mockReturnValue(mockProvider);

      const result = await voiceService.transcribeAudio(Buffer.from('audio'), 'webm');
      expect(mockProvider.transcribe).toHaveBeenCalledWith(Buffer.from('audio'), 'webm');
      expect(result).toEqual({ text: 'hello', confidence: 0.95 });
    });

    it('should return null on error', async () => {
      gameSettingsService.getSetting.mockReturnValue('openai');
      const mockProvider = {
        transcribe: jest.fn().mockRejectedValue(new Error('API down'))
      };
      aiProviderFactory.getProvider.mockReturnValue(mockProvider);

      const result = await voiceService.transcribeAudio(Buffer.from('audio'), 'webm');
      expect(result).toBeNull();
    });
  });

  // ─── synthesizeSpeech ───────────────────────────────────────────

  describe('synthesizeSpeech', () => {
    it('should return null when provider is "none"', async () => {
      gameSettingsService.getSetting.mockReturnValue('none');
      const result = await voiceService.synthesizeSpeech('Hello world', {});
      expect(result).toBeNull();
    });

    it('should call provider.synthesize with mapped voice', async () => {
      gameSettingsService.getSetting.mockImplementation((key, defaultVal) => {
        if (key === 'ai_tts.provider') return 'openai';
        if (key === 'ai_tts.voice_id') return 'alloy';
        return defaultVal;
      });
      const mockProvider = {
        synthesize: jest.fn().mockResolvedValue({
          audioBuffer: Buffer.from('audio'),
          format: 'mp3',
          duration_ms: 1500
        })
      };
      aiProviderFactory.getProvider.mockReturnValue(mockProvider);

      const result = await voiceService.synthesizeSpeech('Hello', { voice_profile: 'deep_gruff' });
      expect(mockProvider.synthesize).toHaveBeenCalledWith('Hello', { voice: 'onyx' });
      expect(result.format).toBe('mp3');
    });

    it('should return null on error', async () => {
      gameSettingsService.getSetting.mockImplementation((key, defaultVal) => {
        if (key === 'ai_tts.provider') return 'openai';
        return defaultVal;
      });
      const mockProvider = {
        synthesize: jest.fn().mockRejectedValue(new Error('TTS failure'))
      };
      aiProviderFactory.getProvider.mockReturnValue(mockProvider);

      const result = await voiceService.synthesizeSpeech('Hello', {});
      expect(result).toBeNull();
    });
  });
});
