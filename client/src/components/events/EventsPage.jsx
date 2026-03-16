import { useState, useEffect } from 'react';
import { events } from '../../services/api';
import {
  Calendar, Trophy, AlertCircle, RefreshCw, Target,
  Users, X, Medal, ChevronRight
} from 'lucide-react';

const EventsPage = ({ user }) => {
  const [activeEvents, setActiveEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [toast, setToast] = useState(null);
  const [contributeAmounts, setContributeAmounts] = useState({});
  const [contributeLoading, setContributeLoading] = useState({});

  // Leaderboard modal
  const [leaderboardEvent, setLeaderboardEvent] = useState(null);
  const [leaderboard, setLeaderboard] = useState([]);
  const [leaderboardLoading, setLeaderboardLoading] = useState(false);

  const fetchEvents = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await events.getActive();
      setActiveEvents(res.data.data?.events || res.data.events || []);
    } catch (err) {
      setError('Failed to load community events.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchEvents();
  }, []);

  const handleContribute = async (eventId) => {
    const amount = parseInt(contributeAmounts[eventId], 10);
    if (!amount || amount <= 0) return;
    try {
      setContributeLoading(prev => ({ ...prev, [eventId]: true }));
      setError(null);
      await events.contribute(eventId, amount);
      setContributeAmounts(prev => ({ ...prev, [eventId]: '' }));
      setToast({ message: `Contributed ${amount} to the event.`, type: 'success' });
      setTimeout(() => setToast(null), 4000);
      await fetchEvents();
    } catch (err) {
      setError(err.response?.data?.error || 'Contribution failed.');
    } finally {
      setContributeLoading(prev => ({ ...prev, [eventId]: false }));
    }
  };

  const openLeaderboard = async (event) => {
    setLeaderboardEvent(event);
    setLeaderboard([]);
    setLeaderboardLoading(true);
    try {
      const res = await events.getLeaderboard(event.id || event.event_id);
      setLeaderboard(res.data.data?.leaderboard || res.data.leaderboard || []);
    } catch {
      setLeaderboard([]);
    } finally {
      setLeaderboardLoading(false);
    }
  };

  const getProgressPercent = (event) => {
    const current = event.current_value || 0;
    const target = event.target_value || 1;
    return Math.min(100, (current / target) * 100);
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return '';
    return new Date(dateStr).toLocaleDateString(undefined, {
      month: 'short', day: 'numeric', year: 'numeric',
    });
  };

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
            <Calendar className="w-7 h-7 text-accent-orange" />
            Community Events
          </h1>
          <p className="text-gray-400">Contribute to galaxy-wide events and earn rewards</p>
        </div>
        <button onClick={fetchEvents} className="holo-button" disabled={loading}>
          <RefreshCw className="w-4 h-4" /> Refresh
        </button>
      </div>

      {error && (
        <div className="flex items-center gap-2 p-3 rounded-lg bg-accent-red/10 border border-accent-red/30 text-accent-red">
          <AlertCircle className="w-5 h-5" />
          <span>{error}</span>
          <button onClick={() => setError(null)} className="ml-auto text-sm underline">Dismiss</button>
        </div>
      )}

      {toast && (
        <div className={`flex items-center gap-2 p-3 rounded-lg border ${
          toast.type === 'success'
            ? 'bg-accent-green/10 border-accent-green/30 text-accent-green'
            : 'bg-accent-red/10 border-accent-red/30 text-accent-red'
        }`}>
          <span>{toast.message}</span>
          <button onClick={() => setToast(null)} className="ml-auto text-sm underline">Dismiss</button>
        </div>
      )}

      {/* Events List */}
      {activeEvents.length === 0 ? (
        <div className="holo-panel text-center py-12">
          <Calendar className="w-16 h-16 text-gray-600 mx-auto mb-4" />
          <h3 className="text-xl font-semibold text-white mb-2">No Active Events</h3>
          <p className="text-gray-400 max-w-md mx-auto">
            Check back soon for galaxy-wide community events. Participate to earn rewards and climb the leaderboards.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {activeEvents.map(event => {
            const eventId = event.id || event.event_id;
            const progress = getProgressPercent(event);
            const isComplete = progress >= 100;
            return (
              <div key={eventId} className="holo-panel p-5 space-y-4">
                {/* Event Header */}
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <h3 className="text-lg font-bold text-white flex items-center gap-2">
                      <Target className="w-5 h-5 text-accent-orange flex-shrink-0" />
                      {event.name || event.title || 'Unnamed Event'}
                    </h3>
                    {event.description && (
                      <p className="text-sm text-gray-400 mt-1">{event.description}</p>
                    )}
                    <div className="flex items-center gap-4 mt-2 text-xs text-gray-500">
                      {event.start_date && (
                        <span>Started: {formatDate(event.start_date)}</span>
                      )}
                      {event.end_date && (
                        <span>Ends: {formatDate(event.end_date)}</span>
                      )}
                      {event.participant_count != null && (
                        <span className="flex items-center gap-1">
                          <Users className="w-3 h-3" /> {event.participant_count} participants
                        </span>
                      )}
                    </div>
                  </div>
                  <button
                    onClick={() => openLeaderboard(event)}
                    className="holo-button text-xs px-3 py-1.5 flex-shrink-0"
                    title="View leaderboard"
                  >
                    <Trophy className="w-3.5 h-3.5" /> Leaderboard
                  </button>
                </div>

                {/* Progress Bar */}
                <div>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-gray-400">Progress</span>
                    <span className={isComplete ? 'text-accent-green font-bold' : 'text-white'}>
                      {(event.current_value || 0).toLocaleString()} / {(event.target_value || 0).toLocaleString()}
                      <span className="text-gray-500 ml-1">({progress.toFixed(1)}%)</span>
                    </span>
                  </div>
                  <div className="w-full bg-space-900 h-4 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-500 ${
                        isComplete ? 'bg-accent-green' : 'bg-accent-orange'
                      }`}
                      style={{ width: `${progress}%` }}
                    />
                  </div>
                </div>

                {/* Rewards */}
                {event.rewards && (
                  <div className="text-xs text-gray-400">
                    Rewards: <span className="text-accent-cyan">{typeof event.rewards === 'string' ? event.rewards : JSON.stringify(event.rewards)}</span>
                  </div>
                )}

                {/* Contribute */}
                {!isComplete && (
                  <div className="flex items-center gap-3 pt-1">
                    <input
                      type="number"
                      value={contributeAmounts[eventId] || ''}
                      onChange={(e) => setContributeAmounts(prev => ({
                        ...prev,
                        [eventId]: e.target.value === '' ? '' : Math.max(0, parseInt(e.target.value) || 0),
                      }))}
                      placeholder="Amount..."
                      min="1"
                      className="w-32 bg-space-900 border border-space-600 text-white rounded px-3 py-1.5 text-sm focus:border-accent-orange outline-none"
                    />
                    <button
                      onClick={() => handleContribute(eventId)}
                      disabled={contributeLoading[eventId] || !contributeAmounts[eventId] || parseInt(contributeAmounts[eventId]) <= 0}
                      className="holo-button-orange text-sm disabled:opacity-50"
                    >
                      <ChevronRight className="w-4 h-4" />
                      {contributeLoading[eventId] ? 'Contributing...' : 'Contribute'}
                    </button>
                  </div>
                )}

                {isComplete && (
                  <div className="text-sm text-accent-green font-semibold flex items-center gap-1">
                    <Trophy className="w-4 h-4" /> Event Complete
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Leaderboard Modal */}
      {leaderboardEvent && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="holo-panel w-full max-w-md p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                <Trophy className="w-5 h-5 text-accent-orange" />
                {leaderboardEvent.name || leaderboardEvent.title || 'Event'} Leaderboard
              </h2>
              <button
                onClick={() => setLeaderboardEvent(null)}
                className="text-gray-500 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {leaderboardLoading ? (
              <div className="flex items-center justify-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-accent-cyan"></div>
              </div>
            ) : leaderboard.length === 0 ? (
              <div className="text-center py-8 text-gray-400">
                <Users className="w-10 h-10 mx-auto mb-2 text-gray-600" />
                <p>No contributions yet.</p>
              </div>
            ) : (
              <div className="space-y-2 max-h-80 overflow-y-auto">
                {leaderboard.map((entry, index) => (
                  <div
                    key={entry.user_id || index}
                    className={`flex items-center gap-3 p-3 rounded-lg ${
                      index === 0 ? 'bg-accent-orange/10 border border-accent-orange/30' :
                      index === 1 ? 'bg-gray-400/5 border border-gray-500/20' :
                      index === 2 ? 'bg-amber-900/10 border border-amber-700/20' :
                      'bg-space-800/50'
                    }`}
                  >
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0 ${
                      index === 0 ? 'bg-accent-orange/20 text-accent-orange' :
                      index === 1 ? 'bg-gray-400/20 text-gray-300' :
                      index === 2 ? 'bg-amber-700/20 text-amber-500' :
                      'bg-space-700 text-gray-400'
                    }`}>
                      {index < 3 ? <Medal className="w-4 h-4" /> : index + 1}
                    </div>
                    <div className="flex-1 min-w-0">
                      <span className="text-white text-sm font-medium truncate block">
                        {entry.username || entry.user?.username || `Player ${entry.user_id}`}
                      </span>
                    </div>
                    <span className="text-accent-cyan font-mono text-sm flex-shrink-0">
                      {(entry.contribution || entry.amount || 0).toLocaleString()}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default EventsPage;
