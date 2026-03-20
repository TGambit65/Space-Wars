import { useState, useRef, useCallback, useEffect } from 'react';

/**
 * React hook for voice recording via MediaRecorder and browser-native audio playback.
 * Used by VoiceButton and NPCChatPanel for voice chat with NPCs.
 *
 * @returns {{ isRecording, isPlaying, isVoiceSupported, startRecording, stopRecording, playAudio, stopPlayback }}
 */
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

const inferMimeType = (format, fallback = 'audio/mpeg') =>
  FORMAT_TO_MIME[String(format || '').toLowerCase()] || fallback;

const decodeBase64 = (base64) => {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
};

const normalizeAudioInput = (audioData) => {
  if (!audioData) {
    return null;
  }

  if (audioData instanceof Blob) {
    return new Blob([audioData], { type: audioData.type || 'audio/mpeg' });
  }

  if (audioData instanceof ArrayBuffer) {
    return new Blob([audioData], { type: 'audio/mpeg' });
  }

  if (audioData instanceof Uint8Array) {
    return new Blob([audioData], { type: 'audio/mpeg' });
  }

  if (typeof audioData === 'string') {
    if (audioData.startsWith('data:audio/')) {
      const [header, base64 = ''] = audioData.split(',', 2);
      const mimeType = header.slice(5, header.indexOf(';')) || 'audio/mpeg';
      return new Blob([decodeBase64(base64)], { type: mimeType });
    }

    return new Blob([decodeBase64(audioData)], { type: 'audio/mpeg' });
  }

  if (typeof audioData !== 'object') {
    return null;
  }

  if (typeof audioData.audio_base64 === 'string') {
    const mimeType = audioData.mime_type || audioData.audio_mime_type || inferMimeType(audioData.format);
    return new Blob([decodeBase64(audioData.audio_base64)], { type: mimeType });
  }

  const rawBuffer = audioData.audioBuffer || audioData.buffer || audioData;
  const mimeType = audioData.mime_type || audioData.audio_mime_type || inferMimeType(audioData.format);

  if (rawBuffer instanceof Blob) {
    return new Blob([rawBuffer], { type: rawBuffer.type || mimeType });
  }

  if (rawBuffer instanceof ArrayBuffer) {
    return new Blob([rawBuffer], { type: mimeType });
  }

  if (rawBuffer instanceof Uint8Array) {
    return new Blob([rawBuffer], { type: mimeType });
  }

  if (Array.isArray(rawBuffer)) {
    return new Blob([new Uint8Array(rawBuffer)], { type: mimeType });
  }

  if (isBufferJson(rawBuffer)) {
    return new Blob([new Uint8Array(rawBuffer.data)], { type: mimeType });
  }

  return null;
};

const useVoiceChat = () => {
  const [isRecording, setIsRecording] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const recorderRef = useRef(null);
  const chunksRef = useRef([]);
  const resolveRef = useRef(null);
  const audioRef = useRef(null);
  const objectUrlRef = useRef(null);

  const isVoiceSupported = typeof navigator !== 'undefined'
    && !!navigator.mediaDevices?.getUserMedia
    && typeof MediaRecorder !== 'undefined';

  const startRecording = useCallback(async () => {
    if (!isVoiceSupported) return;

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

      // Prefer webm/opus, fall back to whatever the browser supports
      const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus'
        : MediaRecorder.isTypeSupported('audio/ogg;codecs=opus')
          ? 'audio/ogg;codecs=opus'
        : MediaRecorder.isTypeSupported('audio/webm')
          ? 'audio/webm'
          : MediaRecorder.isTypeSupported('audio/ogg')
            ? 'audio/ogg'
          : undefined;

      const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
      chunksRef.current = [];

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          chunksRef.current.push(e.data);
        }
      };

      recorder.onstop = () => {
        // Stop all tracks to release the microphone
        stream.getTracks().forEach(t => t.stop());

        const blob = new Blob(chunksRef.current, {
          type: recorder.mimeType || 'audio/webm'
        });
        chunksRef.current = [];

        if (resolveRef.current) {
          resolveRef.current(blob);
          resolveRef.current = null;
        }
      };

      recorderRef.current = recorder;
      recorder.start();
      setIsRecording(true);
    } catch (err) {
      console.error('[VoiceChat] Microphone access denied:', err);
      setIsRecording(false);
    }
  }, [isVoiceSupported]);

  const stopRecording = useCallback(() => {
    return new Promise((resolve) => {
      if (!recorderRef.current || recorderRef.current.state === 'inactive') {
        resolve(null);
        return;
      }
      resolveRef.current = resolve;
      recorderRef.current.stop();
      recorderRef.current = null;
      setIsRecording(false);
    });
  }, []);

  const cleanupPlayback = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.onended = null;
      audioRef.current.onerror = null;
      audioRef.current.pause();
      audioRef.current.src = '';
      audioRef.current = null;
    }

    if (objectUrlRef.current) {
      URL.revokeObjectURL(objectUrlRef.current);
      objectUrlRef.current = null;
    }

    setIsPlaying(false);
  }, []);

  useEffect(() => () => {
    cleanupPlayback();
  }, [cleanupPlayback]);

  const playAudio = useCallback(async (audioData) => {
    try {
      const audioBlob = normalizeAudioInput(audioData);
      if (!audioBlob || audioBlob.size === 0) {
        return;
      }

      cleanupPlayback();

      const objectUrl = URL.createObjectURL(audioBlob);
      objectUrlRef.current = objectUrl;

      const audio = new Audio(objectUrl);
      audioRef.current = audio;
      audio.onended = cleanupPlayback;
      audio.onerror = (event) => {
        console.error('[VoiceChat] Audio playback failed:', event);
        cleanupPlayback();
      };

      setIsPlaying(true);
      await audio.play();
    } catch (err) {
      console.error('[VoiceChat] Audio playback failed:', err);
      cleanupPlayback();
    }
  }, [cleanupPlayback]);

  const stopPlayback = useCallback(() => {
    cleanupPlayback();
  }, [cleanupPlayback]);

  return {
    isRecording,
    isPlaying,
    isVoiceSupported,
    startRecording,
    stopRecording,
    playAudio,
    stopPlayback,
  };
};

export default useVoiceChat;
