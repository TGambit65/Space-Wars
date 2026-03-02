const gameSettingsService = require('./gameSettingsService');
const aiProviderFactory = require('./ai/aiProviderFactory');

/**
 * Voice profile → provider-specific voice ID mappings.
 * Each NPC has a voice_profile in ai_personality; this maps it to a real voice.
 */
const VOICE_MAPPINGS = {
  openai: {
    deep_gruff: 'onyx',
    smooth_confident: 'alloy',
    nervous_fast: 'shimmer',
    commanding: 'echo',
    raspy_old: 'fable',
    cheerful: 'nova'
  },
  elevenlabs: {
    deep_gruff: 'adam',
    smooth_confident: 'rachel',
    nervous_fast: 'josh',
    commanding: 'arnold',
    raspy_old: 'sam',
    cheerful: 'elli'
  },
  google: {
    deep_gruff: 'en-US-Wavenet-D',
    smooth_confident: 'en-US-Wavenet-A',
    nervous_fast: 'en-US-Wavenet-B',
    commanding: 'en-US-Wavenet-J',
    raspy_old: 'en-US-Wavenet-I',
    cheerful: 'en-US-Wavenet-F'
  }
};

/**
 * Transcribe audio buffer to text using the configured STT provider.
 * Returns null on failure (graceful degradation).
 * @param {Buffer} audioBuffer
 * @param {string} format - 'webm', 'mp3', 'wav'
 * @returns {Promise<{ text: string, confidence: number }|null>}
 */
const transcribeAudio = async (audioBuffer, format) => {
  try {
    const sttProvider = gameSettingsService.getSetting('ai_stt.provider', 'none');
    if (sttProvider === 'none') return null;

    const provider = aiProviderFactory.getProvider('stt');
    if (!provider) return null;

    const result = await provider.transcribe(audioBuffer, format);
    return result;
  } catch (err) {
    console.error('Voice STT error:', err.message);
    return null;
  }
};

/**
 * Synthesize text to speech using the configured TTS provider.
 * Voice selection is based on the NPC's personality voice_profile.
 * Returns null on failure (graceful degradation).
 * @param {string} text
 * @param {Object} npcPersonality - ai_personality JSON with voice_profile field
 * @returns {Promise<{ audioBuffer: Buffer, format: string, duration_ms: number }|null>}
 */
const synthesizeSpeech = async (text, npcPersonality = {}) => {
  try {
    const ttsProviderType = gameSettingsService.getSetting('ai_tts.provider', 'none');
    if (ttsProviderType === 'none') return null;

    const provider = aiProviderFactory.getProvider('tts');
    if (!provider) return null;

    const voiceProfile = npcPersonality.voice_profile || 'smooth_confident';
    const mappedVoiceId = getVoiceMapping(voiceProfile, ttsProviderType);

    const result = await provider.synthesize(text, { voice: mappedVoiceId });
    return result;
  } catch (err) {
    console.error('Voice TTS error:', err.message);
    return null;
  }
};

/**
 * Check if voice features are globally enabled.
 * @returns {boolean}
 */
const isVoiceEnabled = () => {
  return gameSettingsService.getSetting('npc.voice_enabled', false);
};

/**
 * Check if voice is enabled for a specific user.
 * Requires both global voice setting AND premium/elite subscription tier.
 * @param {Object} user - User model instance (needs subscription_tier field)
 * @returns {boolean}
 */
const isVoiceEnabledForUser = (user) => {
  if (!isVoiceEnabled()) return false;
  if (!user) return false;

  const tier = user.subscription_tier || 'free';
  return tier === 'premium' || tier === 'elite';
};

/**
 * Map an NPC voice_profile to a provider-specific voice ID.
 * @param {string} voiceProfile - NPC personality voice_profile
 * @param {string} providerType - TTS provider type (openai, elevenlabs, google, local)
 * @returns {string} Provider-specific voice ID
 */
const getVoiceMapping = (voiceProfile, providerType) => {
  const mapping = VOICE_MAPPINGS[providerType];
  if (mapping && mapping[voiceProfile]) {
    return mapping[voiceProfile];
  }

  // For local/unknown providers, use the configured default or the profile name directly
  const defaultVoiceId = gameSettingsService.getSetting('ai_tts.voice_id', 'alloy');
  return defaultVoiceId;
};

module.exports = {
  transcribeAudio,
  synthesizeSpeech,
  isVoiceEnabled,
  isVoiceEnabledForUser,
  getVoiceMapping
};
