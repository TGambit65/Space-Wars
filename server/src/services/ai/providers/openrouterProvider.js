const OpenAIProvider = require('./openaiProvider');

/**
 * OpenRouter provider — OpenAI-compatible API with extra required headers.
 */
class OpenRouterProvider extends OpenAIProvider {
  constructor(config = {}) {
    super({
      ...config,
      baseUrl: config.baseUrl || 'https://openrouter.ai/api'
    });
  }

  _getHeaders() {
    return {
      ...super._getHeaders(),
      'HTTP-Referer': 'https://spacewars3000.com',
      'X-Title': 'Space Wars 3000'
    };
  }
}

module.exports = OpenRouterProvider;
