const BaseTtsProvider = require('./baseTtsProvider');

/**
 * Google Cloud Text-to-Speech provider.
 */
class GoogleTtsProvider extends BaseTtsProvider {
  constructor(config = {}) {
    super(config);
    this.baseUrl = config.baseUrl || 'https://texttospeech.googleapis.com';
  }

  async synthesize(text, voiceOpts = {}) {
    const voiceName = voiceOpts.voice || this.voiceId || 'en-US-Standard-A';
    // Extract language code from Google voice names (format: 'en-US-Standard-A').
    // Falls back to 'en-US' if voice name doesn't match expected pattern.
    const parts = voiceName.split('-');
    const languageCode = (parts.length >= 2 && parts[0].length === 2 && parts[1].length === 2)
      ? `${parts[0]}-${parts[1]}`
      : 'en-US';

    const body = {
      input: { text },
      voice: {
        languageCode,
        name: voiceName
      },
      audioConfig: {
        audioEncoding: 'MP3'
      }
    };

    const start = Date.now();
    let response;
    try {
      response = await this._fetchWithTimeout(`${this.baseUrl}/v1/text:synthesize?key=${this.apiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
    } catch (err) {
      throw new Error(`Network error contacting Google TTS: ${err.message}`);
    }
    const latency_ms = Date.now() - start;

    if (!response.ok) {
      const errorBody = await response.text().catch(() => '');
      throw new Error(`Google TTS error ${response.status}: ${errorBody.slice(0, 200)}`);
    }

    const data = await response.json();
    const audioBuffer = Buffer.from(data.audioContent, 'base64');

    return {
      audioBuffer,
      format: 'mp3',
      duration_ms: null,
      latency_ms
    };
  }

  async testConnection() {
    try {
      const response = await this._fetchWithTimeout(`${this.baseUrl}/v1/voices?key=${this.apiKey}`, {});
      if (!response.ok) {
        return { success: false, message: `Auth failed: ${response.status}` };
      }
      return { success: true, message: 'Google TTS connected' };
    } catch (err) {
      return { success: false, message: err.message };
    }
  }
}

module.exports = GoogleTtsProvider;
