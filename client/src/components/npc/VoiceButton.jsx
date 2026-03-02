import { useEffect } from 'react';
import { Mic, MicOff, Lock } from 'lucide-react';
import useVoiceChat from '../../hooks/useVoiceChat';

const VoiceButton = ({ onAudioCaptured, disabled, voiceEnabled, isPremium }) => {
  const { isRecording, isVoiceSupported, startRecording, stopRecording } = useVoiceChat();

  // Stop recording if window loses focus (e.g., Alt+Tab) to release the microphone
  useEffect(() => {
    if (!isRecording) return;
    const cancel = () => { stopRecording(); };
    window.addEventListener('blur', cancel);
    document.addEventListener('visibilitychange', cancel);
    return () => {
      window.removeEventListener('blur', cancel);
      document.removeEventListener('visibilitychange', cancel);
    };
  }, [isRecording, stopRecording]);

  const handlePointerDown = (e) => {
    e.preventDefault();
    if (disabled || !voiceEnabled || !isPremium || !isVoiceSupported) return;
    startRecording();
  };

  const handlePointerUp = async (e) => {
    e.preventDefault();
    if (!isRecording) return;
    const blob = await stopRecording();
    if (blob && blob.size > 0) {
      onAudioCaptured(blob);
    }
  };

  // Free user — show locked state
  if (!isPremium) {
    return (
      <div className="relative group">
        <button disabled className="p-2 rounded-lg bg-space-700 text-gray-600 cursor-not-allowed border border-space-600">
          <Lock className="w-5 h-5" />
        </button>
        <div className="absolute bottom-full right-0 mb-2 px-2 py-1 bg-space-700 border border-space-600 rounded text-[10px] text-gray-400 whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
          Upgrade to Premium for voice chat
        </div>
      </div>
    );
  }

  // Voice not supported by browser
  if (!isVoiceSupported) {
    return (
      <button disabled className="p-2 rounded-lg bg-space-700 text-gray-600 cursor-not-allowed border border-space-600" title="Voice not supported in this browser">
        <MicOff className="w-5 h-5" />
      </button>
    );
  }

  // Voice disabled by admin
  if (!voiceEnabled) {
    return (
      <button disabled className="p-2 rounded-lg bg-space-700 text-gray-600 cursor-not-allowed border border-space-600" title="Voice chat is disabled">
        <MicOff className="w-5 h-5" />
      </button>
    );
  }

  return (
    <button
      onPointerDown={handlePointerDown}
      onPointerUp={handlePointerUp}
      onPointerLeave={handlePointerUp}
      disabled={disabled}
      className={`p-2 rounded-lg border transition-all select-none touch-none ${
        isRecording
          ? 'bg-accent-red/30 border-accent-red text-accent-red'
          : 'bg-space-700 border-space-600 text-gray-400 hover:text-white hover:border-space-500'
      } disabled:opacity-50 disabled:cursor-not-allowed`}
      title={isRecording ? 'Release to send' : 'Hold to record'}
    >
      <div className="relative">
        {isRecording && (
          <span className="absolute inset-0 rounded-full voice-recording bg-accent-red/30" />
        )}
        <Mic className="w-5 h-5 relative z-10" />
      </div>
    </button>
  );
};

export default VoiceButton;
