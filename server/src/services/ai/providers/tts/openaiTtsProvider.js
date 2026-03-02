const BaseTtsProvider = require('./baseTtsProvider');

/**
 * OpenAI TTS provider.
 */
class OpenAITtsProvider extends BaseTtsProvider {
  constructor(config = {}) {
    super(config);
    this.model = config.model || 'tts-1';
    this.voiceId = config.voiceId || 'alloy';
    this.baseUrl = config.baseUrl || 'https://api.openai.com';
  }

  async synthesize(text, voiceOpts = {}) {
    const voice = voiceOpts.voice || this.voiceId;
    const responseFormat = voiceOpts.format || 'mp3';

    const start = Date.now();
    let response;
    try {
      response = await this._fetchWithTimeout(`${this.baseUrl}/v1/audio/speech`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: this.model,
          input: text,
          voice,
          response_format: responseFormat
        })
      });
    } catch (err) {
      throw new Error(`Network error contacting OpenAI TTS: ${err.message}`);
    }
    const latency_ms = Date.now() - start;

    if (!response.ok) {
      const errorBody = await response.text().catch(() => '');
      throw new Error(`OpenAI TTS error ${response.status}: ${errorBody.slice(0, 200)}`);
    }

    const arrayBuffer = await response.arrayBuffer();
    const audioBuffer = Buffer.from(arrayBuffer);

    return {
      audioBuffer,
      format: responseFormat,
      duration_ms: null, // OpenAI doesn't return duration
      latency_ms
    };
  }

  async testConnection() {
    // Verify API key by listing models (no billable TTS generation)
    try {
      const response = await this._fetchWithTimeout(`${this.baseUrl}/v1/models`, {
        headers: { 'Authorization': `Bearer ${this.apiKey}` }
      });
      if (!response.ok) {
        return { success: false, message: `Auth failed: ${response.status}` };
      }
      return { success: true, message: 'OpenAI TTS connected' };
    } catch (err) {
      return { success: false, message: err.message };
    }
  }
}

module.exports = OpenAITtsProvider;
