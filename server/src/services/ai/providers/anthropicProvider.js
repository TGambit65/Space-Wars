const BaseProvider = require('./baseProvider');

/**
 * Anthropic Messages API provider.
 */
class AnthropicProvider extends BaseProvider {
  constructor(config = {}) {
    super(config);
    this.baseUrl = config.baseUrl || 'https://api.anthropic.com';
  }

  async generateText(messages, options = {}) {
    const temperature = options.temperature !== undefined ? options.temperature : this.temperature;
    const maxTokens = options.maxTokens || this.maxTokens;

    // Separate system message from conversation messages
    let systemPrompt;
    const conversationMessages = [];
    for (const msg of messages) {
      if (msg.role === 'system') {
        systemPrompt = msg.content;
      } else {
        conversationMessages.push({ role: msg.role, content: msg.content });
      }
    }

    const body = {
      model: this.model,
      messages: conversationMessages,
      max_tokens: maxTokens,
      temperature
    };
    if (systemPrompt) body.system = systemPrompt;

    const start = Date.now();
    let response;
    try {
      response = await this._fetchWithTimeout(`${this.baseUrl}/v1/messages`, {
        method: 'POST',
        headers: {
          'x-api-key': this.apiKey,
          'anthropic-version': '2023-06-01',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(body)
      });
    } catch (err) {
      throw new Error(`Network error contacting Anthropic: ${err.message}`);
    }
    const latency_ms = Date.now() - start;

    if (!response.ok) {
      const errorBody = await response.text().catch(() => '');
      if (response.status === 401) throw new Error('Invalid API key');
      if (response.status === 429) throw new Error('Rate limit exceeded');
      throw new Error(`Anthropic API error ${response.status}: ${errorBody.slice(0, 200)}`);
    }

    const data = await response.json();
    const text = data.content && data.content[0] ? data.content[0].text : '';

    return {
      text,
      usage: {
        prompt_tokens: data.usage ? data.usage.input_tokens : 0,
        completion_tokens: data.usage ? data.usage.output_tokens : 0
      },
      latency_ms
    };
  }
}

module.exports = AnthropicProvider;
