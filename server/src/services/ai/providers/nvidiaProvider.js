const OpenAIProvider = require('./openaiProvider');

/**
 * NVIDIA NIM provider — OpenAI-compatible API.
 */
class NvidiaProvider extends OpenAIProvider {
  constructor(config = {}) {
    super({
      ...config,
      baseUrl: config.baseUrl || 'https://integrate.api.nvidia.com'
    });
  }
}

module.exports = NvidiaProvider;
