const OpenAIProvider = require('./openaiProvider');

/**
 * Grok (xAI) provider — OpenAI-compatible API.
 */
class GrokProvider extends OpenAIProvider {
  constructor(config = {}) {
    super({
      ...config,
      baseUrl: config.baseUrl || 'https://api.x.ai'
    });
  }
}

module.exports = GrokProvider;
