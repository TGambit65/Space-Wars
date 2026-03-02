const fetchWithTimeout = require('../fetchWithTimeout');

/**
 * Base class for Speech-to-Text providers.
 */
class BaseSttProvider {
  constructor(config = {}) {
    this.apiKey = config.apiKey || '';
    this.model = config.model || '';
    this.language = config.language || 'en';
    this.baseUrl = config.baseUrl || '';
    this.timeoutMs = config.timeoutMs || 60000; // 60s default for audio processing
  }

  /**
   * Fetch with abort timeout. Delegates to shared utility.
   */
  async _fetchWithTimeout(url, fetchOpts, timeout) {
    return fetchWithTimeout(url, fetchOpts, timeout || this.timeoutMs);
  }

  /**
   * Transcribe audio to text.
   * @param {Buffer} audioBuffer - Raw audio data
   * @param {string} format - Audio format: 'webm', 'mp3', 'wav'
   * @returns {{ text: string, confidence: number|null, language: string, latency_ms: number }}
   */
  async transcribe(audioBuffer, format) {
    throw new Error('transcribe() not implemented');
  }

  /**
   * Test that the STT provider is reachable.
   * @returns {{ success: boolean, message: string }}
   */
  async testConnection() {
    throw new Error('testConnection() not implemented');
  }
}

module.exports = BaseSttProvider;
