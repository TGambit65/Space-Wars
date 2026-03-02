const fetchWithTimeout = require('./fetchWithTimeout');

/**
 * Base class for all LLM providers.
 * All providers must implement generateText().
 */
class BaseProvider {
  constructor(config = {}) {
    this.apiKey = config.apiKey || '';
    this.model = config.model || '';
    this.baseUrl = config.baseUrl || '';
    this.temperature = config.temperature !== undefined ? config.temperature : 0.7;
    this.maxTokens = config.maxTokens || 200;
    this.timeoutMs = config.timeoutMs || 30000; // 30s default for LLM calls
  }

  /**
   * Fetch with abort timeout. Delegates to shared utility.
   */
  async _fetchWithTimeout(url, fetchOpts, timeout) {
    return fetchWithTimeout(url, fetchOpts, timeout || this.timeoutMs);
  }

  /**
   * Generate text from a list of messages.
   * @param {Array} messages - [{ role: 'system'|'user'|'assistant', content: string }]
   * @param {Object} options - Override defaults: { temperature, maxTokens }
   * @returns {{ text: string, usage: { prompt_tokens: number, completion_tokens: number }, latency_ms: number }}
   */
  async generateText(messages, options = {}) {
    throw new Error('generateText() not implemented');
  }

  /**
   * Test that the provider is reachable and credentials are valid.
   * Default implementation sends a minimal generateText call.
   * Override in subclasses that need a different test strategy.
   * @returns {{ success: boolean, message: string, latency_ms: number }}
   */
  async testConnection() {
    const start = Date.now();
    try {
      const result = await this.generateText(
        [{ role: 'user', content: 'ping' }],
        { maxTokens: 5 }
      );
      return {
        success: true,
        message: `Connected to ${this.model}. Response: "${result.text.slice(0, 50)}"`,
        latency_ms: result.latency_ms
      };
    } catch (err) {
      return {
        success: false,
        message: err.message,
        latency_ms: Date.now() - start
      };
    }
  }
}

module.exports = BaseProvider;
