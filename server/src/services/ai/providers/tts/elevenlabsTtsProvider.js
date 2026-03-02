const BaseTtsProvider = require('./baseTtsProvider');

/**
 * ElevenLabs TTS provider.
 */
class ElevenLabsTtsProvider extends BaseTtsProvider {
  constructor(config = {}) {
    super(config);
    this.baseUrl = config.baseUrl || 'https://api.elevenlabs.io';
  }

  async synthesize(text, voiceOpts = {}) {
    const voiceId = voiceOpts.voice || this.voiceId;
    if (!voiceId) throw new Error('ElevenLabs requires a voice ID');

    const start = Date.now();
    let response;
    try {
      response = await this._fetchWithTimeout(`${this.baseUrl}/v1/text-to-speech/${voiceId}`, {
        method: 'POST',
        headers: {
          'xi-api-key': this.apiKey,
          'Content-Type': 'application/json',
          'Accept': 'audio/mpeg'
        },
        body: JSON.stringify({
          text,
          model_id: this.model || 'eleven_monolingual_v1',
          voice_settings: {
            stability: 0.5,
            similarity_boost: 0.5
          }
        })
      });
    } catch (err) {
      throw new Error(`Network error contacting ElevenLabs: ${err.message}`);
    }
    const latency_ms = Date.now() - start;

    if (!response.ok) {
      const errorBody = await response.text().catch(() => '');
      throw new Error(`ElevenLabs error ${response.status}: ${errorBody.slice(0, 200)}`);
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
      const response = await this._fetchWithTimeout(`${this.baseUrl}/v1/voices`, {
        headers: { 'xi-api-key': this.apiKey }
      });
      if (!response.ok) {
        return { success: false, message: `Auth failed: ${response.status}` };
      }
      return { success: true, message: 'ElevenLabs connected' };
    } catch (err) {
      return { success: false, message: err.message };
    }
  }
}

module.exports = ElevenLabsTtsProvider;
