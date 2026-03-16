import { useState, useEffect } from 'react';
import { messages } from '../../services/api';
import {
  Mail, Send, Inbox, Trash2, AlertCircle, RefreshCw,
  ChevronDown, ChevronUp, X, MailOpen, PenSquare, Reply
} from 'lucide-react';
import PlayerPicker from '../common/PlayerPicker';

const MessagingPage = ({ user }) => {
  const [tab, setTab] = useState('inbox');
  const [inboxMessages, setInboxMessages] = useState([]);
  const [sentMessages, setSentMessages] = useState([]);
  const [expandedId, setExpandedId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [actionLoading, setActionLoading] = useState(false);

  // Compose modal state
  const [showCompose, setShowCompose] = useState(false);
  const [composeRecipient, setComposeRecipient] = useState('');
  const [composeSubject, setComposeSubject] = useState('');
  const [composeBody, setComposeBody] = useState('');
  const [sendLoading, setSendLoading] = useState(false);
  const [sendError, setSendError] = useState(null);

  const fetchMessages = async () => {
    try {
      setLoading(true);
      setError(null);
      const [inboxRes, sentRes] = await Promise.all([
        messages.getInbox(),
        messages.getSent(),
      ]);
      setInboxMessages(inboxRes.data.data?.messages || inboxRes.data.messages || []);
      setSentMessages(sentRes.data.data?.messages || sentRes.data.messages || []);
    } catch (err) {
      setError('Failed to load messages.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMessages();
  }, []);

  const handleExpand = async (msg) => {
    if (expandedId === msg.message_id) {
      setExpandedId(null);
      return;
    }
    setExpandedId(msg.message_id);
    // Mark as read if inbox and unread
    if (tab === 'inbox' && !msg.is_read) {
      try {
        await messages.markRead(msg.message_id);
        setInboxMessages(prev =>
          prev.map(m => m.message_id === msg.message_id ? { ...m, is_read: true } : m)
        );
      } catch {
        // Silent fail on mark-read
      }
    }
  };

  const handleDelete = async (msgId) => {
    if (!confirm('Delete this message?')) return;
    try {
      setActionLoading(true);
      await messages.delete(msgId);
      setInboxMessages(prev => prev.filter(m => m.message_id !== msgId));
      setSentMessages(prev => prev.filter(m => m.message_id !== msgId));
      if (expandedId === msgId) setExpandedId(null);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to delete message.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleSend = async () => {
    if (!composeRecipient.trim() || !composeSubject.trim() || !composeBody.trim()) {
      setSendError('All fields are required.');
      return;
    }
    try {
      setSendLoading(true);
      setSendError(null);
      await messages.send({
        recipient_username: composeRecipient.trim(),
        subject: composeSubject.trim(),
        body: composeBody.trim(),
      });
      setShowCompose(false);
      setComposeRecipient('');
      setComposeSubject('');
      setComposeBody('');
      await fetchMessages();
    } catch (err) {
      setSendError(err.response?.data?.error || 'Failed to send message.');
    } finally {
      setSendLoading(false);
    }
  };

  const handleReply = (msg) => {
    const sender = msg.sender_username || msg.sender?.username || '';
    const subject = msg.subject || '';
    setComposeRecipient(sender);
    setComposeSubject(subject.startsWith('Re: ') ? subject : `Re: ${subject}`);
    setComposeBody('');
    setShowCompose(true);
    setSendError(null);
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) +
      ' ' + d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
  };

  const currentMessages = tab === 'inbox' ? inboxMessages : sentMessages;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-accent-cyan"></div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <Mail className="w-7 h-7 text-accent-cyan" />
            Communications
          </h1>
          <p className="text-gray-400">Send and receive messages from other commanders</p>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={fetchMessages} className="holo-button" disabled={loading}>
            <RefreshCw className="w-4 h-4" /> Refresh
          </button>
          <button onClick={() => setShowCompose(true)} className="holo-button-orange">
            <PenSquare className="w-4 h-4" /> Compose
          </button>
        </div>
      </div>

      {error && (
        <div className="flex items-center gap-2 p-3 rounded-lg bg-accent-red/10 border border-accent-red/30 text-accent-red">
          <AlertCircle className="w-5 h-5" />
          <span>{error}</span>
          <button onClick={() => setError(null)} className="ml-auto text-sm underline">Dismiss</button>
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 border-b border-space-700">
        <button
          onClick={() => { setTab('inbox'); setExpandedId(null); }}
          className={`px-5 py-2.5 text-sm font-medium flex items-center gap-2 border-b-2 transition-colors ${
            tab === 'inbox'
              ? 'border-accent-cyan text-accent-cyan'
              : 'border-transparent text-gray-400 hover:text-white'
          }`}
        >
          <Inbox className="w-4 h-4" /> Inbox
          {inboxMessages.filter(m => !m.is_read).length > 0 && (
            <span className="ml-1 px-1.5 py-0.5 text-[10px] bg-accent-cyan/20 text-accent-cyan rounded-full">
              {inboxMessages.filter(m => !m.is_read).length}
            </span>
          )}
        </button>
        <button
          onClick={() => { setTab('sent'); setExpandedId(null); }}
          className={`px-5 py-2.5 text-sm font-medium flex items-center gap-2 border-b-2 transition-colors ${
            tab === 'sent'
              ? 'border-accent-orange text-accent-orange'
              : 'border-transparent text-gray-400 hover:text-white'
          }`}
        >
          <Send className="w-4 h-4" /> Sent
        </button>
      </div>

      {/* Message List */}
      <div className="holo-panel p-0 divide-y divide-space-700">
        {currentMessages.length === 0 ? (
          <div className="p-12 text-center">
            <Mail className="w-12 h-12 text-gray-600 mx-auto mb-3" />
            <p className="text-gray-400">
              {tab === 'inbox' ? 'No messages in your inbox.' : 'No sent messages.'}
            </p>
          </div>
        ) : (
          currentMessages.map(msg => (
            <div key={msg.message_id} className="transition-colors hover:bg-space-800/30">
              {/* Message Row */}
              <div
                className="flex items-center gap-4 px-5 py-3 cursor-pointer"
                onClick={() => handleExpand(msg)}
              >
                {/* Read indicator */}
                <div className="flex-shrink-0">
                  {tab === 'inbox' && !msg.is_read ? (
                    <Mail className="w-5 h-5 text-accent-cyan" />
                  ) : (
                    <MailOpen className="w-5 h-5 text-gray-600" />
                  )}
                </div>

                {/* Sender / Recipient */}
                <div className="w-32 flex-shrink-0">
                  <span className={`text-sm truncate block ${tab === 'inbox' && !msg.is_read ? 'text-white font-bold' : 'text-gray-300'}`}>
                    {tab === 'inbox'
                      ? (msg.sender_username || msg.sender?.username || 'Unknown')
                      : (msg.recipient_username || msg.recipient?.username || 'Unknown')}
                  </span>
                </div>

                {/* Subject */}
                <div className="flex-1 min-w-0">
                  <span className={`text-sm truncate block ${tab === 'inbox' && !msg.is_read ? 'text-white font-semibold' : 'text-gray-300'}`}>
                    {msg.subject || '(No Subject)'}
                  </span>
                </div>

                {/* Date */}
                <div className="flex-shrink-0 text-xs text-gray-500 w-36 text-right">
                  {formatDate(msg.created_at || msg.sent_at)}
                </div>

                {/* Expand/Collapse Icon */}
                <div className="flex-shrink-0">
                  {expandedId === msg.message_id
                    ? <ChevronUp className="w-4 h-4 text-gray-500" />
                    : <ChevronDown className="w-4 h-4 text-gray-500" />}
                </div>
              </div>

              {/* Expanded Body */}
              {expandedId === msg.message_id && (
                <div className="px-5 pb-4 pt-0">
                  <div className="bg-space-900/60 rounded-lg p-4 text-sm text-gray-300 leading-relaxed whitespace-pre-wrap">
                    {msg.body || msg.content || '(No content)'}
                  </div>
                  <div className="flex justify-end mt-3 gap-2">
                    {tab === 'inbox' && (
                      <button
                        onClick={(e) => { e.stopPropagation(); handleReply(msg); }}
                        className="holo-button text-xs px-3 py-1.5 flex items-center gap-1.5"
                      >
                        <Reply className="w-3.5 h-3.5" /> Reply
                      </button>
                    )}
                    <button
                      onClick={(e) => { e.stopPropagation(); handleDelete(msg.message_id); }}
                      disabled={actionLoading}
                      className="holo-button-danger text-xs px-3 py-1.5 flex items-center gap-1.5 disabled:opacity-50"
                    >
                      <Trash2 className="w-3.5 h-3.5" /> Delete
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))
        )}
      </div>

      {/* Compose Modal */}
      {showCompose && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="holo-panel w-full max-w-lg p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                <PenSquare className="w-5 h-5 text-accent-cyan" /> New Message
              </h2>
              <button
                onClick={() => { setShowCompose(false); setSendError(null); }}
                className="text-gray-500 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {sendError && (
              <div className="flex items-center gap-2 p-2 rounded bg-accent-red/10 border border-accent-red/30 text-accent-red text-sm">
                <AlertCircle className="w-4 h-4" />
                <span>{sendError}</span>
              </div>
            )}

            <div>
              <label className="text-xs text-gray-400 block mb-1">Recipient</label>
              <PlayerPicker
                value={composeRecipient}
                onChange={setComposeRecipient}
                placeholder="Search commander name..."
              />
            </div>

            <div>
              <label className="text-xs text-gray-400 block mb-1">Subject</label>
              <input
                type="text"
                value={composeSubject}
                onChange={(e) => setComposeSubject(e.target.value)}
                placeholder="Message subject..."
                className="w-full bg-space-900 border border-space-600 text-white rounded px-3 py-2 text-sm focus:border-accent-cyan outline-none"
              />
            </div>

            <div>
              <label className="text-xs text-gray-400 block mb-1">Message</label>
              <textarea
                value={composeBody}
                onChange={(e) => setComposeBody(e.target.value)}
                placeholder="Type your message..."
                rows={6}
                className="w-full bg-space-900 border border-space-600 text-white rounded px-3 py-2 text-sm focus:border-accent-cyan outline-none resize-none"
              />
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <button
                onClick={() => { setShowCompose(false); setSendError(null); }}
                className="holo-button text-sm"
              >
                Cancel
              </button>
              <button
                onClick={handleSend}
                disabled={sendLoading}
                className="holo-button-orange text-sm disabled:opacity-50"
              >
                <Send className="w-4 h-4" />
                {sendLoading ? 'Sending...' : 'Send Message'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default MessagingPage;
