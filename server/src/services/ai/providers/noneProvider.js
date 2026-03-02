const BaseProvider = require('./baseProvider');

/**
 * Disabled/no-op provider. Returns a sentinel with text: null
 * to signal callers to use scripted fallback behavior.
 * Callers check `result.text === null` rather than `result === null`,
 * avoiding null reference errors on `.text` access.
 */
class NoneProvider extends BaseProvider {
  async generateText() {
    return { text: null, usage: { prompt_tokens: 0, completion_tokens: 0 }, latency_ms: 0 };
  }

  async testConnection() {
    return {
      success: true,
      message: 'AI disabled (none provider)',
      latency_ms: 0
    };
  }
}

module.exports = NoneProvider;
