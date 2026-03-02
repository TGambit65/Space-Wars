const OpenAIProvider = require('./openaiProvider');

/**
 * Local provider — OpenAI-compatible API at a configurable base URL
 * (e.g., vLLM, llama.cpp, text-generation-webui, LocalAI).
 */
class LocalProvider extends OpenAIProvider {
  constructor(config = {}) {
    if (!config.baseUrl) {
      throw new Error('LocalProvider requires a baseUrl (e.g., http://localhost:8000)');
    }
    super(config);
  }
}

module.exports = LocalProvider;
