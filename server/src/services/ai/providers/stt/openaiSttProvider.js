const BaseSttProvider = require('./baseSttProvider');

/**
 * OpenAI Whisper STT provider.
 * Also serves as reusable base for LocalSttProvider.
 */
class OpenAISttProvider extends BaseSttProvider {
  constructor(config = {}) {
    super(config);
    this.model = config.model || 'whisper-1';
    this.baseUrl = config.baseUrl || 'https://api.openai.com';
  }

  _getAuthHeaders() {
    return { 'Authorization': `Bearer ${this.apiKey}` };
  }

  async transcribe(audioBuffer, format = 'webm') {
    const normalizedFormat = String(format || 'webm').toLowerCase();
    const formatMap = {
      webm: { ext: 'webm', mimeType: 'audio/webm' },
      ogg: { ext: 'ogg', mimeType: 'audio/ogg' },
      mp3: { ext: 'mp3', mimeType: 'audio/mpeg' },
      wav: { ext: 'wav', mimeType: 'audio/wav' },
    };
    const { ext, mimeType } = formatMap[normalizedFormat] || formatMap.wav;

    const formData = new FormData();
    const blob = new Blob([audioBuffer], { type: mimeType });
    formData.append('file', blob, `audio.${ext}`);
    formData.append('model', this.model);
    if (this.language) formData.append('language', this.language);

    const start = Date.now();
    let response;
    try {
      response = await this._fetchWithTimeout(`${this.baseUrl}/v1/audio/transcriptions`, {
        method: 'POST',
        headers: this._getAuthHeaders(),
        body: formData
      });
    } catch (err) {
      throw new Error(`Network error contacting Whisper API: ${err.message}`);
    }
    const latency_ms = Date.now() - start;

    if (!response.ok) {
      const errorBody = await response.text().catch(() => '');
      throw new Error(`Whisper API error ${response.status}: ${errorBody.slice(0, 200)}`);
    }

    const data = await response.json();

    return {
      text: data.text || '',
      confidence: null, // Whisper API doesn't return confidence
      language: this.language,
      latency_ms
    };
  }

  async testConnection() {
    // Verify API key by listing models
    try {
      const response = await this._fetchWithTimeout(`${this.baseUrl}/v1/models`, {
        headers: this._getAuthHeaders()
      });
      if (!response.ok) {
        return { success: false, message: `Auth failed: ${response.status}` };
      }
      return { success: true, message: 'Whisper API connected' };
    } catch (err) {
      return { success: false, message: err.message };
    }
  }
}

module.exports = OpenAISttProvider;
