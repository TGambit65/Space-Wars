const BaseProvider = require('./baseProvider');

/**
 * Google Gemini (Generative Language API) provider.
 */
class GeminiProvider extends BaseProvider {
  constructor(config = {}) {
    super(config);
    this.baseUrl = config.baseUrl || 'https://generativelanguage.googleapis.com';
  }

  async generateText(messages, options = {}) {
    const temperature = options.temperature !== undefined ? options.temperature : this.temperature;
    const maxTokens = options.maxTokens || this.maxTokens;

    // Convert messages to Gemini format
    let systemInstruction;
    const contents = [];
    for (const msg of messages) {
      if (msg.role === 'system') {
        systemInstruction = { parts: [{ text: msg.content }] };
      } else {
        contents.push({
          role: msg.role === 'assistant' ? 'model' : 'user',
          parts: [{ text: msg.content }]
        });
      }
    }

    const body = {
      contents,
      generationConfig: {
        temperature,
        maxOutputTokens: maxTokens
      }
    };
    if (systemInstruction) body.systemInstruction = systemInstruction;

    const url = `${this.baseUrl}/v1beta/models/${this.model}:generateContent?key=${this.apiKey}`;

    const start = Date.now();
    let response;
    try {
      response = await this._fetchWithTimeout(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
    } catch (err) {
      throw new Error(`Network error contacting Gemini: ${err.message}`);
    }
    const latency_ms = Date.now() - start;

    if (!response.ok) {
      const errorBody = await response.text().catch(() => '');
      if (response.status === 401 || response.status === 403) throw new Error('Invalid API key');
      if (response.status === 429) throw new Error('Rate limit exceeded');
      throw new Error(`Gemini API error ${response.status}: ${errorBody.slice(0, 200)}`);
    }

    const data = await response.json();
    const candidate = data.candidates && data.candidates[0];
    const text = candidate && candidate.content && candidate.content.parts
      ? candidate.content.parts.map(p => p.text).join('')
      : '';

    const usage = data.usageMetadata || {};

    return {
      text,
      usage: {
        prompt_tokens: usage.promptTokenCount || 0,
        completion_tokens: usage.candidatesTokenCount || 0
      },
      latency_ms
    };
  }
}

module.exports = GeminiProvider;
