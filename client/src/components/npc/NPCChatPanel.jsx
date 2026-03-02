import { useState, useEffect, useRef, useCallback } from 'react';
import { X, Send, Volume2, Loader } from 'lucide-react';
import { dialogue } from '../../services/api';
import useVoiceChat from '../../hooks/useVoiceChat';
import NPCPortrait from './NPCPortrait';
import VoiceButton from './VoiceButton';

const TYPE_BADGE = {
  PIRATE: 'badge-red',
  PIRATE_LORD: 'badge-purple',
  TRADER: 'badge-green',
  PATROL: 'badge-cyan',
  BOUNTY_HUNTER: 'badge-orange',
};

const NPCChatPanel = ({ npc, socket, onClose, user }) => {
  const [messages, setMessages] = useState([]);
  const [menuOptions, setMenuOptions] = useState([]);
  const [inputText, setInputText] = useState('');
  const [isThinking, setIsThinking] = useState(false);
  const [sending, setSending] = useState(false);
  const [voiceEnabled, setVoiceEnabled] = useState(false);
  const [subscriptionTier, setSubscriptionTier] = useState(user?.subscription_tier || 'free');
  const [error, setError] = useState(null);

  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);
  const initializedRef = useRef(false);
  const { playAudio, isPlaying, stopPlayback } = useVoiceChat();

  const isPremium = subscriptionTier === 'premium' || subscriptionTier === 'elite';

  // Scroll to bottom when messages change
  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  useEffect(() => { scrollToBottom(); }, [messages, isThinking, scrollToBottom]);

  // Start dialogue on mount
  useEffect(() => {
    if (initializedRef.current) return;
    initializedRef.current = true;

    const init = async () => {
      try {
        setIsThinking(true);
        const res = await dialogue.start(npc.npc_id);
        const data = res.data.data;

        setMenuOptions(data.menu_options || []);
        setVoiceEnabled(!!data.voice_enabled);
        if (data.subscription_tier) setSubscriptionTier(data.subscription_tier);

        // Add NPC greeting
        const greeting = data.npc?.personality_summary
          ? `*${data.npc.personality_summary}*\n\nWhat would you like to discuss?`
          : 'What would you like to discuss?';

        setMessages([{
          sender: 'npc',
          text: greeting,
          timestamp: Date.now()
        }]);
      } catch (err) {
        setError(err.response?.data?.message || 'Failed to start dialogue');
      } finally {
        setIsThinking(false);
      }
    };

    init();
  }, [npc.npc_id]);

  // Listen for WebSocket dialogue events
  useEffect(() => {
    if (!socket) return;

    const onDialogueMessage = (data) => {
      if (data.npc_id !== npc.npc_id) return;

      setMessages(prev => [...prev, {
        sender: 'npc',
        text: data.text,
        audio: data.audio_base64 || null,
        isAI: data.is_ai,
        timestamp: Date.now()
      }]);

      if (data.menu_options) {
        setMenuOptions(data.menu_options);
      }
    };

    socket.on('npc:dialogue', onDialogueMessage);
    return () => { socket.off('npc:dialogue', onDialogueMessage); };
  }, [socket, npc.npc_id]);

  // Add NPC response to messages + handle audio
  const addNPCResponse = useCallback((text, audio, isAI) => {
    setMessages(prev => [...prev, {
      sender: 'npc',
      text,
      audio: audio || null,
      isAI: !!isAI,
      timestamp: Date.now()
    }]);

    // Auto-play TTS audio if available
    if (audio) {
      playAudio(audio);
    }
  }, [playAudio]);

  // Handle menu option selection
  const handleMenuOption = async (optionKey) => {
    if (sending) return;

    const option = menuOptions.find(o => o.key === optionKey);
    setMessages(prev => [...prev, {
      sender: 'player',
      text: option?.label || optionKey,
      timestamp: Date.now()
    }]);

    // Special: farewell closes the panel
    if (optionKey === 'farewell') {
      try {
        setSending(true);
        setIsThinking(true);
        const res = await dialogue.end(npc.npc_id);
        const data = res.data.data;
        addNPCResponse(data.response_text, data.response_audio);
        // Brief delay so user sees farewell before closing
        setTimeout(() => onClose(), 1500);
      } catch {
        onClose();
      } finally {
        setSending(false);
        setIsThinking(false);
      }
      return;
    }

    try {
      setSending(true);
      setIsThinking(true);
      const res = await dialogue.selectOption(npc.npc_id, optionKey);
      const data = res.data.data;
      addNPCResponse(data.response_text, data.response_audio);
      if (data.new_menu_options) setMenuOptions(data.new_menu_options);
    } catch (err) {
      addNPCResponse(err.response?.data?.message || 'The NPC seems distracted...');
    } finally {
      setSending(false);
      setIsThinking(false);
    }
  };

  // Handle free-text message
  const handleSendText = async () => {
    const text = inputText.trim();
    if (!text || sending) return;

    setInputText('');
    setMessages(prev => [...prev, {
      sender: 'player',
      text,
      timestamp: Date.now()
    }]);

    try {
      setSending(true);
      setIsThinking(true);
      const res = await dialogue.sendMessage(npc.npc_id, text);
      const data = res.data.data;
      addNPCResponse(data.response_text, data.response_audio, data.is_ai_generated);
    } catch (err) {
      addNPCResponse(err.response?.data?.message || 'The NPC doesn\'t respond...');
    } finally {
      setSending(false);
      setIsThinking(false);
      inputRef.current?.focus();
    }
  };

  // Handle voice input
  const handleAudioCaptured = async (audioBlob) => {
    if (sending) return;

    setMessages(prev => [...prev, {
      sender: 'player',
      text: '(voice message)',
      isVoice: true,
      timestamp: Date.now()
    }]);

    try {
      setSending(true);
      setIsThinking(true);
      const res = await dialogue.sendVoice(npc.npc_id, audioBlob);
      const data = res.data.data;

      if (data.error) {
        addNPCResponse(data.message || 'Voice unavailable, please type your message');
        return;
      }

      // Update the player's message with transcription
      if (data.transcribed_text) {
        setMessages(prev => {
          const updated = [...prev];
          // Find last player voice message
          for (let i = updated.length - 1; i >= 0; i--) {
            if (updated[i].sender === 'player' && updated[i].isVoice) {
              updated[i] = { ...updated[i], text: data.transcribed_text };
              break;
            }
          }
          return updated;
        });
      }

      addNPCResponse(data.response_text, data.response_audio, data.is_ai_generated);
    } catch (err) {
      addNPCResponse(err.response?.data?.message || 'Voice processing failed. Try typing instead.');
    } finally {
      setSending(false);
      setIsThinking(false);
    }
  };

  // Handle close
  const handleClose = async () => {
    try {
      await dialogue.end(npc.npc_id);
    } catch {
      // Ignore end errors on close
    }
    stopPlayback();
    onClose();
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendText();
    }
  };

  return (
    <div className="fixed right-0 top-0 h-full w-full sm:w-96 bg-space-900 border-l border-space-700 z-50 flex flex-col shadow-2xl">
      {/* Header */}
      <div className="flex items-center gap-3 p-3 border-b border-space-700 bg-space-800/50">
        <NPCPortrait npcType={npc.npc_type} size="md" />
        <div className="flex-1 min-w-0">
          <div className="text-white font-bold text-sm truncate">{npc.name}</div>
          <span className={`badge ${TYPE_BADGE[npc.npc_type] || 'badge-cyan'} text-[10px]`}>
            {npc.npc_type?.replace('_', ' ')}
          </span>
        </div>
        <button onClick={handleClose} className="text-gray-400 hover:text-white p-1">
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Error */}
      {error && (
        <div className="px-3 py-2 bg-accent-red/10 border-b border-accent-red/30 text-accent-red text-xs">
          {error}
        </div>
      )}

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-3 space-y-3">
        {messages.map((msg, i) => (
          <MessageBubble key={i} message={msg} npcType={npc.npc_type} onPlayAudio={playAudio} isPlaying={isPlaying} />
        ))}
        {isThinking && (
          <div className="flex items-start gap-2">
            <NPCPortrait npcType={npc.npc_type} size="sm" />
            <div className="bg-space-800 rounded-lg rounded-tl-none px-3 py-2 border border-space-700">
              <ThinkingDots />
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Menu Options */}
      {menuOptions.length > 0 && !isThinking && (
        <div className="px-3 py-2 border-t border-space-700 bg-space-800/30">
          <div className="grid grid-cols-2 gap-1.5">
            {menuOptions.map(opt => (
              <button
                key={opt.key}
                onClick={() => handleMenuOption(opt.key)}
                disabled={sending}
                className={`text-xs py-1.5 px-2 rounded border text-left transition-colors disabled:opacity-50 ${
                  opt.key === 'farewell'
                    ? 'bg-space-700/50 border-space-600 text-gray-400 hover:text-gray-200 hover:border-space-500'
                    : 'bg-space-800 border-space-600 text-gray-300 hover:border-accent-cyan/50 hover:text-white'
                }`}
                title={opt.description}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Input Area */}
      <div className="p-3 border-t border-space-700 bg-space-800/50">
        <div className="flex gap-2">
          <input
            ref={inputRef}
            type="text"
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Type a message..."
            disabled={sending}
            maxLength={500}
            className="input flex-1 text-sm py-2"
          />
          <button
            onClick={handleSendText}
            disabled={!inputText.trim() || sending}
            className="p-2 rounded-lg bg-accent-cyan/20 text-accent-cyan border border-accent-cyan/30 hover:bg-accent-cyan/30 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {sending ? <Loader className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
          </button>
          <VoiceButton
            onAudioCaptured={handleAudioCaptured}
            disabled={sending}
            voiceEnabled={voiceEnabled}
            isPremium={isPremium}
          />
        </div>
      </div>
    </div>
  );
};

// ─── Message Bubble ──────────────────────────────────────────────────

const MessageBubble = ({ message, npcType, onPlayAudio, isPlaying }) => {
  const isNPC = message.sender === 'npc';

  if (isNPC) {
    return (
      <div className="flex items-start gap-2">
        <NPCPortrait npcType={npcType} size="sm" />
        <div className="max-w-[80%]">
          <div className="bg-space-800 rounded-lg rounded-tl-none px-3 py-2 border border-space-700">
            <p className="text-sm text-gray-200 whitespace-pre-wrap">{message.text}</p>
            {message.isAI && (
              <span className="text-[9px] text-accent-purple mt-1 block">AI response</span>
            )}
          </div>
          {message.audio && (
            <button
              onClick={() => onPlayAudio(message.audio)}
              className="mt-1 text-[10px] text-gray-500 hover:text-accent-cyan flex items-center gap-1"
            >
              <Volume2 className="w-3 h-3" />
              {isPlaying ? 'Playing...' : 'Play audio'}
            </button>
          )}
        </div>
      </div>
    );
  }

  // Player message
  return (
    <div className="flex justify-end">
      <div className="max-w-[80%]">
        <div className="bg-accent-cyan/15 rounded-lg rounded-tr-none px-3 py-2 border border-accent-cyan/20">
          <p className="text-sm text-gray-200">{message.text}</p>
        </div>
      </div>
    </div>
  );
};

// ─── Thinking Dots ───────────────────────────────────────────────────

const ThinkingDots = () => (
  <div className="flex gap-1 items-center h-5">
    <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
    <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
    <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
  </div>
);

export default NPCChatPanel;
