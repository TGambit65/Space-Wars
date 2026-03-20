const FORMAT_TO_MIME = {
  mp3: 'audio/mpeg',
  mpeg: 'audio/mpeg',
  wav: 'audio/wav',
  wave: 'audio/wav',
  ogg: 'audio/ogg',
  webm: 'audio/webm',
  flac: 'audio/flac',
};

const isBufferJson = (value) =>
  value
  && typeof value === 'object'
  && value.type === 'Buffer'
  && Array.isArray(value.data);

const normalizeAudioBuffer = (audioBuffer) => {
  if (!audioBuffer) {
    return null;
  }

  if (Buffer.isBuffer(audioBuffer)) {
    return audioBuffer;
  }

  if (isBufferJson(audioBuffer)) {
    return Buffer.from(audioBuffer.data);
  }

  if (audioBuffer instanceof Uint8Array) {
    return Buffer.from(audioBuffer);
  }

  if (Array.isArray(audioBuffer)) {
    return Buffer.from(audioBuffer);
  }

  return null;
};

const serializeAudioPayload = (audio) => {
  if (!audio) {
    return null;
  }

  const format = typeof audio.format === 'string' && audio.format
    ? audio.format.toLowerCase()
    : 'mp3';

  if (typeof audio.audio_base64 === 'string' && audio.audio_base64) {
    return {
      audio_base64: audio.audio_base64,
      mime_type: audio.mime_type || FORMAT_TO_MIME[format] || 'application/octet-stream',
      format,
      duration_ms: audio.duration_ms ?? null,
      latency_ms: audio.latency_ms ?? null,
    };
  }

  const audioBuffer = normalizeAudioBuffer(audio.audioBuffer || audio.buffer || audio);
  if (!audioBuffer || audioBuffer.length === 0) {
    return null;
  }

  return {
    audio_base64: audioBuffer.toString('base64'),
    mime_type: FORMAT_TO_MIME[format] || 'application/octet-stream',
    format,
    duration_ms: audio.duration_ms ?? null,
    latency_ms: audio.latency_ms ?? null,
  };
};

const serializeDialogueResult = (result) => {
  if (!result || typeof result !== 'object' || !('response_audio' in result)) {
    return result;
  }

  return {
    ...result,
    response_audio: serializeAudioPayload(result.response_audio),
  };
};

module.exports = {
  FORMAT_TO_MIME,
  serializeAudioPayload,
  serializeDialogueResult,
};
