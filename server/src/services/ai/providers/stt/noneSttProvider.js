const BaseSttProvider = require('./baseSttProvider');

/**
 * Disabled STT provider. Returns sentinel with text: null
 * to signal voice input is unavailable.
 */
class NoneSttProvider extends BaseSttProvider {
  async transcribe() {
    return { text: null, confidence: null, language: null, latency_ms: 0 };
  }

  async testConnection() {
    return { success: true, message: 'STT disabled (none provider)' };
  }
}

module.exports = NoneSttProvider;
