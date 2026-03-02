const BaseSttProvider = require('./baseSttProvider');

/**
 * Google Cloud Speech-to-Text provider.
 */
class GoogleSttProvider extends BaseSttProvider {
  constructor(config = {}) {
    super(config);
    this.baseUrl = config.baseUrl || 'https://speech.googleapis.com';
  }

  async transcribe(audioBuffer, format = 'webm') {
    const encodingMap = {
      webm: 'WEBM_OPUS',
      mp3: 'MP3',
      wav: 'LINEAR16'
    };
    const encoding = encodingMap[format] || 'WEBM_OPUS';

    // Google expects BCP-47 (e.g., 'en-US'). If only ISO 639-1 given (e.g., 'en'),
    // expand to a region-qualified code.
    let languageCode = this.language || 'en-US';
    if (languageCode.length === 2) {
      const regionMap = { en: 'en-US', es: 'es-ES', fr: 'fr-FR', de: 'de-DE', ja: 'ja-JP', zh: 'zh-CN', ko: 'ko-KR', pt: 'pt-BR', it: 'it-IT', ru: 'ru-RU' };
      languageCode = regionMap[languageCode] || `${languageCode}-${languageCode.toUpperCase()}`;
    }

    const body = {
      config: {
        encoding,
        languageCode,
        model: this.model || 'default'
      },
      audio: {
        content: audioBuffer.toString('base64')
      }
    };

    const start = Date.now();
    let response;
    try {
      response = await this._fetchWithTimeout(`${this.baseUrl}/v1/speech:recognize?key=${this.apiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
    } catch (err) {
      throw new Error(`Network error contacting Google STT: ${err.message}`);
    }
    const latency_ms = Date.now() - start;

    if (!response.ok) {
      const errorBody = await response.text().catch(() => '');
      throw new Error(`Google STT error ${response.status}: ${errorBody.slice(0, 200)}`);
    }

    const data = await response.json();
    const result = data.results && data.results[0];
    const alt = result && result.alternatives && result.alternatives[0];

    return {
      text: alt ? alt.transcript : '',
      confidence: alt ? alt.confidence : null,
      language: this.language,
      latency_ms
    };
  }

  async testConnection() {
    try {
      // Minimal test — send empty audio to verify credentials
      const response = await this._fetchWithTimeout(`${this.baseUrl}/v1/speech:recognize?key=${this.apiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ config: { encoding: 'LINEAR16', languageCode: 'en-US' }, audio: { content: '' } })
      });
      // 400 is expected (empty audio) but means auth works. 401/403 means bad key.
      if (response.status === 401 || response.status === 403) {
        return { success: false, message: 'Invalid API key' };
      }
      return { success: true, message: 'Google STT connected' };
    } catch (err) {
      return { success: false, message: err.message };
    }
  }
}

module.exports = GoogleSttProvider;
