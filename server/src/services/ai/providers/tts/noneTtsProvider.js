const BaseTtsProvider = require('./baseTtsProvider');

/**
 * Disabled TTS provider. Returns sentinel with audioBuffer: null
 * to signal voice output is unavailable.
 */
class NoneTtsProvider extends BaseTtsProvider {
  async synthesize() {
    return { audioBuffer: null, format: null, duration_ms: null, latency_ms: 0 };
  }

  async testConnection() {
    return { success: true, message: 'TTS disabled (none provider)' };
  }
}

module.exports = NoneTtsProvider;
