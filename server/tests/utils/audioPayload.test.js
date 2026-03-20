const {
  serializeAudioPayload,
  serializeDialogueResult,
} = require('../../src/utils/audioPayload');

describe('audioPayload', () => {
  it('serializes provider buffers into a browser-safe payload', () => {
    const result = serializeAudioPayload({
      audioBuffer: Buffer.from('hello world'),
      format: 'wav',
      duration_ms: 1234,
      latency_ms: 56,
    });

    expect(result).toEqual({
      audio_base64: Buffer.from('hello world').toString('base64'),
      mime_type: 'audio/wav',
      format: 'wav',
      duration_ms: 1234,
      latency_ms: 56,
    });
  });

  it('serializes legacy Buffer JSON payloads', () => {
    const result = serializeAudioPayload({
      audioBuffer: { type: 'Buffer', data: [104, 105] },
      format: 'mp3',
    });

    expect(result).toEqual({
      audio_base64: Buffer.from('hi').toString('base64'),
      mime_type: 'audio/mpeg',
      format: 'mp3',
      duration_ms: null,
      latency_ms: null,
    });
  });

  it('preserves pre-serialized base64 audio payloads', () => {
    const result = serializeAudioPayload({
      audio_base64: 'Zm9v',
      mime_type: 'audio/ogg',
      format: 'ogg',
      duration_ms: 200,
      latency_ms: 10,
    });

    expect(result).toEqual({
      audio_base64: 'Zm9v',
      mime_type: 'audio/ogg',
      format: 'ogg',
      duration_ms: 200,
      latency_ms: 10,
    });
  });

  it('serializes response_audio fields in dialogue results', () => {
    const result = serializeDialogueResult({
      response_text: 'Greetings, pilot.',
      response_audio: {
        audioBuffer: Buffer.from('abc'),
        format: 'mp3',
      },
      is_ai_generated: true,
    });

    expect(result).toEqual({
      response_text: 'Greetings, pilot.',
      response_audio: {
        audio_base64: Buffer.from('abc').toString('base64'),
        mime_type: 'audio/mpeg',
        format: 'mp3',
        duration_ms: null,
        latency_ms: null,
      },
      is_ai_generated: true,
    });
  });
});
