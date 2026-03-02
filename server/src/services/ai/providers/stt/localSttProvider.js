const OpenAISttProvider = require('./openaiSttProvider');

/**
 * Local STT provider — connects to a local Whisper-compatible HTTP server
 * (faster-whisper, whisper.cpp, etc.) using the OpenAI Whisper API format.
 * Extends OpenAISttProvider since the API format is identical.
 */
class LocalSttProvider extends OpenAISttProvider {
  constructor(config = {}) {
    if (!config.baseUrl) {
      throw new Error('LocalSttProvider requires a baseUrl');
    }
    super(config);
    this.model = config.model || 'whisper';
  }

  // Override: no auth header needed for local server
  _getAuthHeaders() {
    return {};
  }

  async testConnection() {
    try {
      const response = await this._fetchWithTimeout(`${this.baseUrl}/v1/models`, {});
      if (!response.ok) {
        return { success: false, message: `Local STT not reachable: ${response.status}` };
      }
      return { success: true, message: `Local STT connected at ${this.baseUrl}` };
    } catch (err) {
      return { success: false, message: `Cannot reach ${this.baseUrl}: ${err.message}` };
    }
  }
}

module.exports = LocalSttProvider;
