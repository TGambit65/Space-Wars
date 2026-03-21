import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { X, Send, Volume2, Loader, History, ShoppingCart, Target, Shield, Coins, Navigation, AlertTriangle, CheckCircle, XCircle } from 'lucide-react';
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

const FACTION_COLORS = {
  terran_alliance: '#3498db',
  zythian_swarm: '#e74c3c',
  automaton_collective: '#9b59b6',
  synthesis_accord: '#d4a017',
  sylvari_dominion: '#2ecc71'
};

const FACTION_LABELS = {
  terran_alliance: 'Terran',
  zythian_swarm: 'Zythian',
  automaton_collective: 'Automaton',
  synthesis_accord: 'Synthesis',
  sylvari_dominion: 'Sylvari'
};

const NPCChatPanel = ({ npc, socket, onClose, user }) => {
  const navigate = useNavigate();
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
  const [playingMsgTs, setPlayingMsgTs] = useState(null);

  const [showHistory, setShowHistory] = useState(false);
  const [history, setHistory] = useState([]);
  const [relationshipLabel, setRelationshipLabel] = useState(null);
  const [relationship, setRelationship] = useState(null);

  const isPremium = subscriptionTier === 'premium' || subscriptionTier === 'elite';

  const HISTORY_KEY = useMemo(() => `npc_history_${npc.npc_id}`, [npc.npc_id]);
  const MAX_HISTORY = 50;

  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(HISTORY_KEY) || '[]');
      setHistory(saved);
    } catch { setHistory([]); }
  }, [npc.npc_id]);

  const saveHistory = useCallback((msgs) => {
    try {
      const toSave = msgs.filter(m => m.text && m.text !== '(voice message)').map(m => ({
        sender: m.sender,
        text: m.text,
        timestamp: m.timestamp,
      }));
      const prev = JSON.parse(localStorage.getItem(HISTORY_KEY) || '[]');
      const existingTimestamps = new Set(prev.map(m => m.timestamp));
      const newOnly = toSave.filter(m => !existingTimestamps.has(m.timestamp));
      const merged = [...prev, ...newOnly].slice(-MAX_HISTORY);
      localStorage.setItem(HISTORY_KEY, JSON.stringify(merged));
    } catch { /* storage full — ignore */ }
  }, [HISTORY_KEY]);

  // Scroll to bottom when messages change
  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  useEffect(() => { scrollToBottom(); }, [messages, isThinking, scrollToBottom]);

  // Clear playing indicator when audio finishes or playback fails to start
  useEffect(() => {
    if (!isPlaying) setPlayingMsgTs(null);
  }, [isPlaying, playingMsgTs]);

  const handlePlayAudio = useCallback((audio, timestamp) => {
    setPlayingMsgTs(timestamp);
    playAudio(audio);
  }, [playAudio]);

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
        if (data.recognition?.relationship_label) setRelationshipLabel(data.recognition.relationship_label);
        if (data.relationship) setRelationship(data.relationship);

        // Add NPC greeting — prefer hail text > recognition > personality summary
        let greeting;
        if (npc.hail_greeting) {
          greeting = npc.hail_greeting;
        } else if (data.recognition?.greeting) {
          greeting = data.recognition.greeting;
        } else {
          greeting = data.npc?.personality_summary
            ? `*${data.npc.personality_summary}*\n\nWhat would you like to discuss?`
            : 'What would you like to discuss?';
        }

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

      const audioPayload = data.response_audio || (
        data.audio_base64
          ? {
              audio_base64: data.audio_base64,
              mime_type: data.mime_type || data.audio_mime_type || null,
              format: data.format || data.audio_format || null,
            }
          : null
      );

      setMessages(prev => [...prev, {
        sender: 'npc',
        text: data.text,
        audio: audioPayload,
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
  const addNPCResponse = useCallback((text, audio, isAI, card) => {
    setMessages(prev => [...prev, {
      sender: 'npc',
      text,
      audio: audio || null,
      isAI: !!isAI,
      card: card || null,
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

      // Execute client-side action payloads with rich cards
      if (data.data) {
        const { action } = data.data;

        if (action === 'open_trade_ui') {
          addNPCResponse(null, null, false, {
            type: 'trade_shortcut',
            mode: data.data.mode,
            onAction: () => navigate('/trading')
          });
        }

        if (data.data.credits_deducted) {
          addNPCResponse(null, null, false, {
            type: 'credits_change',
            amount: -data.data.credits_deducted
          });
        }

        if (data.data.bribe_failed) {
          addNPCResponse(null, null, false, {
            type: 'status',
            variant: 'error',
            text: "You don't have enough credits for the bribe"
          });
        }

        if (action === 'mission_accepted') {
          addNPCResponse(null, null, false, {
            type: 'mission_accepted',
            title: data.data.mission_title,
            credits: data.data.reward_credits,
            xp: data.data.reward_xp,
            onView: () => navigate('/missions')
          });
        }

        if (action === 'mission_failed') {
          addNPCResponse(null, null, false, {
            type: 'status',
            variant: 'error',
            text: `Cannot accept mission: ${data.data.reason}`
          });
        }

        if (action === 'bounty_info' && data.data.targets?.length > 0 && !data.data.mission_id) {
          addNPCResponse(null, null, false, {
            type: 'bounty_intel',
            targets: data.data.targets
          });
        }

        if (action === 'report_crime' && data.data.patrols_alerted > 0) {
          addNPCResponse(null, null, false, {
            type: 'status',
            variant: 'success',
            text: `${data.data.patrols_alerted} patrol(s) alerted in sector`
          });
        }

        if (action === 'price_quote' && data.data.rate) {
          addNPCResponse(null, null, false, {
            type: 'price_quote',
            rate: data.data.rate
          });
        }

        if (action === 'price_list' && data.data.prices?.length > 0) {
          addNPCResponse(null, null, false, {
            type: 'price_list',
            prices: data.data.prices,
            portName: data.data.port_name
          });
        }

        if (action === 'route_tip' && data.data.routes?.length > 0) {
          addNPCResponse(null, null, false, {
            type: 'route_tip',
            routes: data.data.routes,
            onNavigate: (sectorId) => navigate(`/map`)
          });
        }

        if (data.data.npc_disengaged) {
          addNPCResponse(null, null, false, {
            type: 'status',
            variant: 'info',
            text: 'NPC has disengaged'
          });
        }
      }
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
    saveHistory(messages);
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
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className={`badge ${TYPE_BADGE[npc.npc_type] || 'badge-cyan'} text-[10px]`}>
              {npc.npc_type?.replace('_', ' ')}
            </span>
            {npc.faction && (
              <span className="text-[10px] font-medium px-1 rounded" style={{ color: FACTION_COLORS[npc.faction] || '#888', borderColor: FACTION_COLORS[npc.faction] || '#888', border: '1px solid' }}>
                {FACTION_LABELS[npc.faction] || npc.faction}
              </span>
            )}
            {npc.ai_personality?.trait_primary && (
              <span className="text-[10px] text-gray-500 italic truncate">
                {npc.ai_personality.trait_primary}{npc.ai_personality.trait_secondary ? `, ${npc.ai_personality.trait_secondary}` : ''}
              </span>
            )}
            {relationshipLabel && (
              <span className={`text-[10px] font-medium ${
                relationship?.trust > 0.3 ? 'text-green-400' :
                relationship?.trust < -0.3 ? 'text-red-400' :
                'text-accent-cyan/70'
              }`}>{relationshipLabel}</span>
            )}
          </div>
        </div>
        {history.length > 0 && (
          <button onClick={() => setShowHistory(!showHistory)} className={`p-1 transition-colors ${showHistory ? 'text-accent-cyan' : 'text-gray-400 hover:text-white'}`} title="View History">
            <History className="w-5 h-5" />
          </button>
        )}
        <button onClick={handleClose} className="text-gray-400 hover:text-white p-1">
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* History Panel */}
      {showHistory && history.length > 0 && (
        <div className="border-b border-space-700 max-h-48 overflow-y-auto p-3 space-y-2" style={{ background: 'rgba(0,0,0,0.3)' }}>
          <div className="text-[10px] text-gray-500 uppercase font-bold tracking-widest mb-1">Previous Conversations</div>
          {history.map((msg, i) => (
            <div key={i} className={`text-xs ${msg.sender === 'npc' ? 'text-gray-400' : 'text-accent-cyan'}`}>
              <span className="text-gray-600 font-mono text-[10px] mr-1.5">
                {new Date(msg.timestamp).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}
              </span>
              <span className="font-medium">{msg.sender === 'npc' ? npc.name : 'You'}:</span>{' '}
              <span className="text-gray-400">{msg.text.length > 120 ? msg.text.slice(0, 120) + '...' : msg.text}</span>
            </div>
          ))}
        </div>
      )}

      {/* Relationship Summary */}
      {relationship && relationship.interaction_count >= 2 && (
        <div className="px-3 py-2 border-b border-space-700 bg-space-800/30">
          <div className="flex items-center gap-3 text-[10px]">
            <RelationshipBar label="Trust" value={relationship.trust} color="cyan" />
            <RelationshipBar label="Respect" value={relationship.respect} color="green" />
            <RelationshipBar label="Fear" value={relationship.fear} color="red" />
            <span className="text-gray-600 ml-auto">{relationship.interaction_count} encounters</span>
          </div>
          {relationship.notable_fact && (
            <div className="text-[10px] text-gray-500 mt-1 italic truncate">
              Remembers: {relationship.notable_fact}
            </div>
          )}
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="px-3 py-2 bg-accent-red/10 border-b border-accent-red/30 text-accent-red text-xs">
          {error}
        </div>
      )}

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-3 space-y-3">
        {messages.map((msg, i) => (
          <MessageBubble key={i} message={msg} npcType={npc.npc_type} onPlayAudio={handlePlayAudio} playingMsgTs={playingMsgTs} />
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

const MessageBubble = ({ message, npcType, onPlayAudio, playingMsgTs }) => {
  const isNPC = message.sender === 'npc';
  const isThisPlaying = playingMsgTs === message.timestamp;

  if (isNPC) {
    // Card-only message (no text)
    if (!message.text && message.card) {
      return (
        <div className="flex items-start gap-2">
          <NPCPortrait npcType={npcType} size="sm" />
          <div className="max-w-[85%]">
            <ActionCard card={message.card} />
          </div>
        </div>
      );
    }

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
          {message.card && <ActionCard card={message.card} />}
          {message.audio && (
            <button
              onClick={() => onPlayAudio(message.audio, message.timestamp)}
              className="mt-1 text-[10px] text-gray-500 hover:text-accent-cyan flex items-center gap-1"
            >
              <Volume2 className="w-3 h-3" />
              {isThisPlaying ? 'Playing...' : 'Play audio'}
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

// ─── Action Card ─────────────────────────────────────────────────────

const ActionCard = ({ card }) => {
  if (!card) return null;

  switch (card.type) {
    case 'trade_shortcut':
      return (
        <div className="mt-1 bg-green-900/20 border border-green-700/40 rounded-lg p-2">
          <button
            onClick={card.onAction}
            className="flex items-center gap-2 text-xs text-green-300 hover:text-green-200 w-full"
          >
            <ShoppingCart className="w-4 h-4 shrink-0" />
            <span>Open Trading ({card.mode === 'buy' ? 'Buy' : 'Sell'} Mode)</span>
            <Navigation className="w-3 h-3 ml-auto" />
          </button>
        </div>
      );

    case 'mission_accepted':
      return (
        <div className="mt-1 bg-accent-cyan/10 border border-accent-cyan/30 rounded-lg p-2.5">
          <div className="flex items-center gap-2 mb-1">
            <CheckCircle className="w-4 h-4 text-accent-cyan shrink-0" />
            <span className="text-xs font-bold text-accent-cyan">Mission Accepted</span>
          </div>
          <div className="text-xs text-gray-300 mb-1.5">{card.title}</div>
          <div className="flex gap-3 text-[10px] text-gray-400">
            <span className="flex items-center gap-1"><Coins className="w-3 h-3 text-yellow-400" />{card.credits?.toLocaleString()} cr</span>
            <span>{card.xp} XP</span>
          </div>
          {card.onView && (
            <button onClick={card.onView} className="mt-1.5 text-[10px] text-accent-cyan hover:underline">
              View Missions
            </button>
          )}
        </div>
      );

    case 'credits_change':
      return (
        <div className={`mt-1 rounded-lg p-2 flex items-center gap-2 text-xs ${
          card.amount < 0
            ? 'bg-red-900/20 border border-red-700/40 text-red-300'
            : 'bg-green-900/20 border border-green-700/40 text-green-300'
        }`}>
          <Coins className="w-4 h-4 shrink-0" />
          <span>{card.amount < 0 ? '' : '+'}{card.amount.toLocaleString()} credits</span>
        </div>
      );

    case 'bounty_intel':
      return (
        <div className="mt-1 bg-orange-900/15 border border-orange-700/30 rounded-lg p-2.5">
          <div className="flex items-center gap-2 mb-1.5">
            <Target className="w-4 h-4 text-orange-400 shrink-0" />
            <span className="text-xs font-bold text-orange-300">Bounty Intel</span>
          </div>
          <div className="space-y-1">
            {card.targets.map((t, i) => (
              <div key={i} className="flex justify-between text-[11px]">
                <span className="text-gray-300">{t.sector_name}</span>
                <span className="text-red-400">{t.hostile_count} hostile{t.hostile_count > 1 ? 's' : ''}</span>
              </div>
            ))}
          </div>
        </div>
      );

    case 'price_list':
      return (
        <div className="mt-1 bg-space-800 border border-space-600 rounded-lg p-2.5">
          <div className="flex items-center gap-2 mb-1.5">
            <Coins className="w-4 h-4 text-yellow-400 shrink-0" />
            <span className="text-xs font-bold text-gray-200">{card.portName || 'Port Prices'}</span>
          </div>
          <div className="grid grid-cols-3 gap-x-2 text-[10px] text-gray-500 mb-1 font-bold">
            <span>Commodity</span><span className="text-right">Buy</span><span className="text-right">Sell</span>
          </div>
          {card.prices.map((p, i) => (
            <div key={i} className="grid grid-cols-3 gap-x-2 text-[11px] py-0.5 border-t border-space-700">
              <span className="text-gray-300 truncate">{p.name}</span>
              <span className="text-right text-yellow-300">{p.buy ? `${p.buy}cr` : '—'}</span>
              <span className="text-right text-green-300">{p.sell ? `${p.sell}cr` : '—'}</span>
            </div>
          ))}
        </div>
      );

    case 'price_quote':
      return (
        <div className="mt-1 bg-space-800 border border-space-600 rounded-lg p-2 flex items-center gap-2 text-xs">
          <Coins className="w-4 h-4 text-yellow-400 shrink-0" />
          <span className="text-gray-300">Rate: <span className="text-yellow-300 font-bold">{card.rate.toLocaleString()} cr</span> per kill</span>
        </div>
      );

    case 'route_tip':
      return (
        <div className="mt-1 bg-blue-900/15 border border-blue-700/30 rounded-lg p-2.5">
          <div className="flex items-center gap-2 mb-1.5">
            <Navigation className="w-4 h-4 text-blue-400 shrink-0" />
            <span className="text-xs font-bold text-blue-300">Trade Route Tip</span>
          </div>
          {card.routes.map((r, i) => (
            <div key={i} className="text-[11px] text-gray-300">
              {r.to ? `${r.from} ↔ ${r.to}` : r.from}
            </div>
          ))}
          {card.onNavigate && (
            <button onClick={() => card.onNavigate()} className="mt-1.5 text-[10px] text-blue-400 hover:underline">
              View on Map
            </button>
          )}
        </div>
      );

    case 'status': {
      const variants = {
        success: { icon: CheckCircle, bg: 'bg-green-900/20 border-green-700/40', color: 'text-green-300' },
        error: { icon: XCircle, bg: 'bg-red-900/20 border-red-700/40', color: 'text-red-300' },
        info: { icon: Shield, bg: 'bg-blue-900/20 border-blue-700/40', color: 'text-blue-300' },
        warning: { icon: AlertTriangle, bg: 'bg-yellow-900/20 border-yellow-700/40', color: 'text-yellow-300' },
      };
      const v = variants[card.variant] || variants.info;
      const Icon = v.icon;
      return (
        <div className={`mt-1 rounded-lg border p-2 flex items-center gap-2 text-xs ${v.bg} ${v.color}`}>
          <Icon className="w-4 h-4 shrink-0" />
          <span>{card.text}</span>
        </div>
      );
    }

    default:
      return null;
  }
};

// ─── Thinking Dots ───────────────────────────────────────────────────

// ─── Relationship Bar ──────────────────────────────────────────────

const REL_COLORS = {
  cyan: { bar: 'bg-accent-cyan', label: 'text-gray-400' },
  green: { bar: 'bg-green-400', label: 'text-gray-400' },
  red: { bar: 'bg-red-400', label: 'text-gray-400' },
};

const RelationshipBar = ({ label, value, color }) => {
  const c = REL_COLORS[color] || REL_COLORS.cyan;
  // Map -1..1 to 0..100 for display
  const pct = Math.round(((value || 0) + 1) * 50);
  return (
    <div className="flex items-center gap-1 min-w-0">
      <span className={`${c.label} shrink-0`}>{label}</span>
      <div className="w-10 h-1.5 bg-space-700 rounded-full overflow-hidden">
        <div className={`h-full rounded-full ${c.bar}`} style={{ width: `${pct}%` }} />
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
