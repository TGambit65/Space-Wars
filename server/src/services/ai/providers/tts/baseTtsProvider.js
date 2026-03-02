const fetchWithTimeout = require('../fetchWithTimeout');

/**
 * Base class for Text-to-Speech providers.
 */
class BaseTtsProvider {
  constructor(config = {}) {
    this.apiKey = config.apiKey || '';
    this.model = config.model || '';
    this.voiceId = config.voiceId || '';
    this.baseUrl = config.baseUrl || '';
    this.timeoutMs = config.timeoutMs || 60000; // 60s default for audio generation
  }

  /**
   * Fetch with abort timeout. Delegates to shared utility.
   */
  async _fetchWithTimeout(url, fetchOpts, timeout) {
    return fetchWithTimeout(url, fetchOpts, timeout || this.timeoutMs);
  }

  /**
   * Synthesize text to audio.
   * @param {string} text - Text to speak
   * @param {Object} voiceOpts - { voice, speed, format }
   * @returns {{ audioBuffer: Buffer, format: string, duration_ms: number|null, latency_ms: number }}
   */
  async synthesize(text, voiceOpts = {}) {
    throw new Error('synthesize() not implemented');
  }

  /**
   * Test that the TTS provider is reachable.
   * @returns {{ success: boolean, message: string }}
   */
  async testConnection() {
    throw new Error('testConnection() not implemented');
  }
}

module.exports = BaseTtsProvider;
