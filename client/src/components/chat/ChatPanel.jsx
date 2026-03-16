import { useState, useEffect, useRef } from 'react';
import { MessageSquare, X, Send, Radio, Building2, Flag } from 'lucide-react';

const normalizeMessage = (data, channel) => ({
  ...data,
  channel,
  senderId: data.senderId || data.sender_id,
  senderName: data.senderName || data.sender_name,
});

const ChatPanel = ({ socket, user, isOpen, onClose }) => {
  const [activeTab, setActiveTab] = useState('sector');
  const [messages, setMessages] = useState({ sector: [], corp: [], faction: [] });
  const [inputText, setInputText] = useState('');
  const messagesEndRef = useRef(null);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, activeTab]);

  // Socket listeners for chat events
  useEffect(() => {
    if (!socket) return;

    const onSectorChat = (data) => {
      setMessages(prev => ({
        ...prev,
        sector: [...prev.sector.slice(-99), normalizeMessage(data, 'sector')]
      }));
    };

    const onCorpChat = (data) => {
      setMessages(prev => ({
        ...prev,
        corp: [...prev.corp.slice(-99), normalizeMessage(data, 'corp')]
      }));
    };

    const onFactionChat = (data) => {
      setMessages(prev => ({
        ...prev,
        faction: [...prev.faction.slice(-99), normalizeMessage(data, 'faction')]
      }));
    };

    socket.on('chat_message', onSectorChat);
    socket.on('corp_chat', onCorpChat);
    socket.on('faction_chat', onFactionChat);

    return () => {
      socket.off('chat_message', onSectorChat);
      socket.off('corp_chat', onCorpChat);
      socket.off('faction_chat', onFactionChat);
    };
  }, [socket]);

  // Join faction and corp rooms on mount
  useEffect(() => {
    if (!socket || !user) return;
    if (user.faction) {
      socket.emit('join_faction', { faction: user.faction });
    }
    if (user.corporation_id) {
      socket.emit('join_corp', { corporation_id: user.corporation_id });
    }
  }, [socket, user]);

  const handleSend = () => {
    if (!inputText.trim() || !socket) return;

    const eventMap = {
      sector: 'chat_message',
      corp: 'corp_chat',
      faction: 'faction_chat'
    };

    const payload = { text: inputText.trim() };

    socket.emit(eventMap[activeTab], payload);
    setInputText('');
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const tabs = [
    { id: 'sector', label: 'Sector', icon: Radio, color: '#00ffff' },
    { id: 'corp', label: 'Corp', icon: Building2, color: '#a78bfa', disabled: !user?.corporation_id },
    { id: 'faction', label: 'Faction', icon: Flag, color: '#ff6600' },
  ];

  const currentMessages = messages[activeTab] || [];

  const formatTime = (ts) => {
    if (!ts) return '';
    const d = new Date(ts);
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  if (!isOpen) return null;

  return (
    <div className="fixed right-0 top-0 bottom-0 w-80 z-40 flex flex-col"
      style={{
        background: 'rgba(10, 10, 30, 0.95)',
        backdropFilter: 'blur(12px)',
        borderLeft: '1px solid rgba(0, 255, 255, 0.12)',
      }}
    >
      {/* Header */}
      <div className="flex items-center justify-between p-3" style={{ borderBottom: '1px solid rgba(0, 255, 255, 0.12)' }}>
        <div className="flex items-center gap-2">
          <MessageSquare className="w-4 h-4 text-neon-cyan" />
          <span className="text-sm font-bold text-white font-display">Comms Channel</span>
        </div>
        <button onClick={onClose} className="text-gray-500 hover:text-white transition-colors">
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Tabs */}
      <div className="flex border-b" style={{ borderColor: 'rgba(0, 255, 255, 0.12)' }}>
        {tabs.map(tab => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => !tab.disabled && setActiveTab(tab.id)}
              disabled={tab.disabled}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2 text-xs font-medium transition-colors ${
                tab.disabled ? 'text-gray-700 cursor-not-allowed' :
                activeTab === tab.id ? 'border-b-2' : 'text-gray-500 hover:text-gray-300'
              }`}
              style={activeTab === tab.id ? { color: tab.color, borderColor: tab.color } : {}}
            >
              <Icon className="w-3 h-3" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        {currentMessages.length === 0 ? (
          <p className="text-center text-gray-600 text-xs mt-8">No messages yet. Say something!</p>
        ) : (
          currentMessages.map((msg, i) => {
            const isMe = msg.senderId === user?.user_id;
            return (
              <div key={i} className={`text-xs ${isMe ? 'text-right' : ''}`}>
                <span className="text-gray-600">{formatTime(msg.timestamp)} </span>
                <span className={isMe ? 'text-neon-cyan' : 'text-neon-orange'}>{msg.senderName || 'Unknown'}: </span>
                <span className="text-gray-300">{msg.text}</span>
              </div>
            );
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="p-3" style={{ borderTop: '1px solid rgba(0, 255, 255, 0.12)' }}>
        <div className="flex gap-2">
          <input
            type="text"
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={`Message ${activeTab}...`}
            className="flex-1 bg-transparent border rounded px-2 py-1.5 text-xs text-white placeholder-gray-600 focus:outline-none focus:border-neon-cyan/50"
            style={{ borderColor: 'rgba(255,255,255,0.1)' }}
          />
          <button
            onClick={handleSend}
            disabled={!inputText.trim()}
            className="text-neon-cyan hover:text-white disabled:text-gray-700 transition-colors p-1.5"
          >
            <Send className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
};

export default ChatPanel;
