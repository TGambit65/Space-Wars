const BaseTtsProvider = require('./baseTtsProvider');

/**
 * Local TTS provider — connects to a local TTS HTTP server
 * (Piper TTS, Coqui, etc.) using OpenAI-compatible API format.
 */
class LocalTtsProvider extends BaseTtsProvider {
  constructor(config = {}) {
    if (!config.baseUrl) {
      throw new Error('LocalTtsProvider requires a baseUrl');
    }
    super(config);
  }

  async synthesize(text, voiceOpts = {}) {
    const voice = voiceOpts.voice || this.voiceId;

    const start = Date.now();
    let response;
    try {
      response = await this._fetchWithTimeout(`${this.baseUrl}/v1/audio/speech`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: this.model || 'tts',
          input: text,
          voice,
          response_format: 'mp3'
        })
      });
    } catch (err) {
      throw new Error(`Network error contacting local TTS at ${this.baseUrl}: ${err.message}`);
    }
    const latency_ms = Date.now() - start;

    if (!response.ok) {
      const errorBody = await response.text().catch(() => '');
      throw new Error(`Local TTS error ${response.status}: ${errorBody.slice(0, 200)}`);
    }

    const arrayBuffer = await response.arrayBuffer();
    const audioBuffer = Buffer.from(arrayBuffer);

    return {
      audioBuffer,
      format: 'mp3',
      duration_ms: null,
      latency_ms
    };
  }

  async testConnection() {
    try {
      const response = await this._fetchWithTimeout(`${this.baseUrl}/v1/models`, {});
      if (!response.ok) {
        return { success: false, message: `Local TTS not reachable: ${response.status}` };
      }
      return { success: true, message: `Local TTS connected at ${this.baseUrl}` };
    } catch (err) {
      return { success: false, message: `Cannot reach ${this.baseUrl}: ${err.message}` };
    }
  }
}

module.exports = LocalTtsProvider;
