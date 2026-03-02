const BaseProvider = require('./baseProvider');

/**
 * OpenAI-compatible provider. Also serves as reusable base for
 * Grok, OpenRouter, and Local providers (all OpenAI-compatible APIs).
 */
class OpenAIProvider extends BaseProvider {
  constructor(config = {}) {
    super(config);
    this.baseUrl = config.baseUrl || 'https://api.openai.com';
  }

  _getHeaders() {
    return {
      'Authorization': `Bearer ${this.apiKey}`,
      'Content-Type': 'application/json'
    };
  }

  async generateText(messages, options = {}) {
    const temperature = options.temperature !== undefined ? options.temperature : this.temperature;
    const maxTokens = options.maxTokens || this.maxTokens;

    const start = Date.now();
    let response;
    try {
      response = await this._fetchWithTimeout(`${this.baseUrl}/v1/chat/completions`, {
        method: 'POST',
        headers: this._getHeaders(),
        body: JSON.stringify({
          model: this.model,
          messages,
          temperature,
          max_tokens: maxTokens
        })
      });
    } catch (err) {
      throw new Error(`Network error contacting ${this.baseUrl}: ${err.message}`);
    }
    const latency_ms = Date.now() - start;

    if (!response.ok) {
      const errorBody = await response.text().catch(() => '');
      if (response.status === 401) throw new Error('Invalid API key');
      if (response.status === 429) throw new Error('Rate limit exceeded');
      throw new Error(`API error ${response.status}: ${errorBody.slice(0, 200)}`);
    }

    const data = await response.json();
    const choice = data.choices && data.choices[0];
    if (!choice) throw new Error('No response from model');

    return {
      text: choice.message.content,
      usage: data.usage || { prompt_tokens: 0, completion_tokens: 0 },
      latency_ms
    };
  }
}

module.exports = OpenAIProvider;
