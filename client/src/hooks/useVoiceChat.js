import { useState, useRef, useCallback } from 'react';

/**
 * React hook for voice recording via MediaRecorder and audio playback via AudioContext.
 * Used by VoiceButton and NPCChatPanel for voice chat with NPCs.
 *
 * @returns {{ isRecording, isPlaying, isVoiceSupported, startRecording, stopRecording, playAudio, stopPlayback }}
 */
const useVoiceChat = () => {
  const [isRecording, setIsRecording] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const recorderRef = useRef(null);
  const chunksRef = useRef([]);
  const audioCtxRef = useRef(null);
  const sourceRef = useRef(null);
  const resolveRef = useRef(null);

  const isVoiceSupported = typeof navigator !== 'undefined'
    && !!navigator.mediaDevices?.getUserMedia
    && typeof MediaRecorder !== 'undefined';

  const getAudioContext = useCallback(() => {
    if (!audioCtxRef.current) {
      audioCtxRef.current = new (window.AudioContext || window.webkitAudioContext)();
    }
    // Resume if suspended (browser autoplay policy)
    if (audioCtxRef.current.state === 'suspended') {
      audioCtxRef.current.resume();
    }
    return audioCtxRef.current;
  }, []);

  const startRecording = useCallback(async () => {
    if (!isVoiceSupported) return;

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

      // Prefer webm/opus, fall back to whatever the browser supports
      const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus'
        : MediaRecorder.isTypeSupported('audio/webm')
          ? 'audio/webm'
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

  const playAudio = useCallback(async (audioData) => {
    try {
      const ctx = getAudioContext();
      let arrayBuffer;

      if (audioData instanceof ArrayBuffer) {
        arrayBuffer = audioData;
      } else if (audioData instanceof Blob) {
        arrayBuffer = await audioData.arrayBuffer();
      } else if (typeof audioData === 'string') {
        // Base64 encoded audio
        const binary = atob(audioData);
        const bytes = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i++) {
          bytes[i] = binary.charCodeAt(i);
        }
        arrayBuffer = bytes.buffer;
      } else {
        return;
      }

      const audioBuffer = await ctx.decodeAudioData(arrayBuffer);
      const source = ctx.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(ctx.destination);

      source.onended = () => {
        setIsPlaying(false);
        sourceRef.current = null;
      };

      // Stop any currently playing audio
      if (sourceRef.current) {
        sourceRef.current.stop();
      }

      sourceRef.current = source;
      setIsPlaying(true);
      source.start(0);
    } catch (err) {
      console.error('[VoiceChat] Audio playback failed:', err);
      setIsPlaying(false);
    }
  }, [getAudioContext]);

  const stopPlayback = useCallback(() => {
    if (sourceRef.current) {
      sourceRef.current.stop();
      sourceRef.current = null;
      setIsPlaying(false);
    }
  }, []);

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
