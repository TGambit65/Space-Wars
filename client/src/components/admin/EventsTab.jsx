import { useState, useEffect } from 'react';
import { admin } from '../../services/api';
import { Calendar, Plus, AlertTriangle, ChevronLeft, ChevronRight } from 'lucide-react';

const EventsTab = () => {
  const [events, setEvents] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [actionLoading, setActionLoading] = useState(null);

  // Create form
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({
    name: '', description: '', event_type: 'trade', goal_type: 'credits',
    target_value: 100000, rewards: '{}', starts_at: '', ends_at: ''
  });

  useEffect(() => { fetchEvents(); }, [page]);

  const fetchEvents = async () => {
    try {
      setLoading(true);
      const res = await admin.getEvents({ page, limit: 20 });
      const data = res.data.data;
      setEvents(data.events);
      setTotal(data.total);
      setPages(Math.ceil((data.total || 0) / 20));
    } catch (err) {
      setError('Failed to load events');
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async () => {
    setActionLoading('create');
    setError(null);
    try {
      let rewards = {};
      try { rewards = JSON.parse(form.rewards); } catch { rewards = {}; }

      await admin.createEvent({
        ...form,
        target_value: parseInt(form.target_value),
        rewards
      });
      setSuccess('Event created');
      setShowCreate(false);
      setForm({ name: '', description: '', event_type: 'trade', goal_type: 'credits', target_value: 100000, rewards: '{}', starts_at: '', ends_at: '' });
      fetchEvents();
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to create event');
    } finally {
      setActionLoading(null);
    }
  };

  const handleEndEvent = async (eventId) => {
    setActionLoading(eventId);
    try {
      await admin.endEvent(eventId);
      setSuccess('Event ended');
      fetchEvents();
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      setError('Failed to end event');
    } finally {
      setActionLoading(null);
    }
  };

  const handleDeleteEvent = async (eventId) => {
    if (!window.confirm('Delete this event permanently?')) return;
    setActionLoading(eventId);
    try {
      await admin.deleteEvent(eventId);
      setSuccess('Event deleted');
      fetchEvents();
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      setError('Failed to delete event');
    } finally {
      setActionLoading(null);
    }
  };

  if (loading && events.length === 0) {
    return (
      <div className="p-8 text-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-accent-cyan mx-auto mb-4"></div>
        <div className="text-gray-400 text-sm">Loading events...</div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {error && (
        <div className="bg-accent-red/10 border border-accent-red/30 rounded-lg p-3 flex items-center gap-2">
          <AlertTriangle className="w-5 h-5 text-accent-red flex-shrink-0" />
          <span className="text-accent-red text-sm">{error}</span>
          <button onClick={() => setError(null)} className="ml-auto text-accent-red hover:text-white text-xs">Dismiss</button>
        </div>
      )}
      {success && (
        <div className="bg-green-500/10 border border-green-500/30 rounded-lg p-3">
          <span className="text-green-400 text-sm">{success}</span>
        </div>
      )}

      {/* Active Events Cards */}
      {events.filter(e => e.status === 'active').length > 0 && (
        <div className="card p-4">
          <h3 className="card-header flex items-center gap-2">
            <Calendar className="w-4 h-4" /> Active Events
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-3">
            {events.filter(e => e.status === 'active').map(event => {
              const progress = event.target_value > 0 ? Math.min(100, (event.current_value / event.target_value) * 100) : 0;
              return (
                <div key={event.event_id} className="bg-space-800 rounded-lg p-3">
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <div className="text-white font-medium text-sm">{event.name}</div>
                      <div className="text-xs text-gray-400">{event.event_type} / {event.goal_type}</div>
                    </div>
                    <span className="badge badge-green text-xs">Active</span>
                  </div>
                  {event.description && (
                    <div className="text-xs text-gray-400 mb-2">{event.description}</div>
                  )}
                  {/* Progress bar */}
                  <div className="mb-2">
                    <div className="flex justify-between text-xs text-gray-500 mb-1">
                      <span>Progress</span>
                      <span>{event.current_value || 0} / {event.target_value} ({Math.round(progress)}%)</span>
                    </div>
                    <div className="w-full bg-space-700 rounded-full h-2">
                      <div className="bg-accent-cyan rounded-full h-2 transition-all" style={{ width: `${progress}%` }} />
                    </div>
                  </div>
                  <div className="flex justify-between text-xs text-gray-500 mb-2">
                    <span>Ends: {event.ends_at ? new Date(event.ends_at).toLocaleDateString() : '-'}</span>
                    <span>{event.contribution_count || 0} contributors</span>
                  </div>
                  <button onClick={() => handleEndEvent(event.event_id)}
                    disabled={actionLoading === event.event_id}
                    className="btn btn-secondary w-full text-xs">
                    {actionLoading === event.event_id ? 'Ending...' : 'End Event'}
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Create Event */}
      <div className="card p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="card-header mb-0">Create Event</h3>
          <button onClick={() => setShowCreate(!showCreate)} className="btn btn-primary text-xs flex items-center gap-1">
            <Plus className="w-3 h-3" /> {showCreate ? 'Cancel' : 'New Event'}
          </button>
        </div>
        {showCreate && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-3">
            <div>
              <label className="block text-xs text-gray-400 mb-1">Name</label>
              <input type="text" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })}
                className="input text-sm w-full" placeholder="Event name" />
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1">Description</label>
              <input type="text" value={form.description} onChange={e => setForm({ ...form, description: e.target.value })}
                className="input text-sm w-full" placeholder="Optional description" />
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1">Event Type</label>
              <select value={form.event_type} onChange={e => setForm({ ...form, event_type: e.target.value })} className="input text-sm w-full">
                <option value="trade">Trade</option>
                <option value="combat">Combat</option>
                <option value="exploration">Exploration</option>
                <option value="mining">Mining</option>
                <option value="crafting">Crafting</option>
              </select>
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1">Goal Type</label>
              <select value={form.goal_type} onChange={e => setForm({ ...form, goal_type: e.target.value })} className="input text-sm w-full">
                <option value="credits">Credits</option>
                <option value="items">Items</option>
                <option value="kills">Kills</option>
                <option value="distance">Distance</option>
              </select>
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1">Target Value</label>
              <input type="number" value={form.target_value} onChange={e => setForm({ ...form, target_value: e.target.value })}
                className="input text-sm w-full" />
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1">Rewards (JSON)</label>
              <input type="text" value={form.rewards} onChange={e => setForm({ ...form, rewards: e.target.value })}
                className="input text-sm w-full" placeholder='{"credits": 10000}' />
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1">Start Date</label>
              <input type="datetime-local" value={form.starts_at} onChange={e => setForm({ ...form, starts_at: e.target.value })}
                className="input text-sm w-full" />
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1">End Date</label>
              <input type="datetime-local" value={form.ends_at} onChange={e => setForm({ ...form, ends_at: e.target.value })}
                className="input text-sm w-full" />
            </div>
            <div className="md:col-span-2">
              <button onClick={handleCreate} disabled={actionLoading || !form.name || !form.starts_at || !form.ends_at}
                className="btn btn-primary text-sm">
                {actionLoading === 'create' ? 'Creating...' : 'Create Event'}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* All Events Table */}
      <div className="card p-4">
        <h3 className="card-header">All Events ({total})</h3>
        <div className="overflow-x-auto mt-3">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-space-700 text-left">
                <th className="py-1 px-2 text-gray-500">Name</th>
                <th className="py-1 px-2 text-gray-500">Type</th>
                <th className="py-1 px-2 text-gray-500">Progress</th>
                <th className="py-1 px-2 text-gray-500">Status</th>
                <th className="py-1 px-2 text-gray-500">Dates</th>
                <th className="py-1 px-2 text-gray-500">Actions</th>
              </tr>
            </thead>
            <tbody>
              {events.map(event => (
                <tr key={event.event_id} className="border-b border-space-800">
                  <td className="py-1 px-2 text-white">{event.name}</td>
                  <td className="py-1 px-2 text-gray-400">{event.event_type}</td>
                  <td className="py-1 px-2 text-gray-300">
                    {event.current_value || 0} / {event.target_value}
                  </td>
                  <td className="py-1 px-2">
                    <span className={`${
                      event.status === 'active' ? 'text-green-400' :
                      event.status === 'completed' ? 'text-accent-cyan' :
                      event.status === 'ended' ? 'text-gray-400' : 'text-gray-500'
                    }`}>{event.status}</span>
                  </td>
                  <td className="py-1 px-2 text-gray-500">
                    {event.starts_at ? new Date(event.starts_at).toLocaleDateString() : '?'} -
                    {event.ends_at ? new Date(event.ends_at).toLocaleDateString() : '?'}
                  </td>
                  <td className="py-1 px-2">
                    <div className="flex gap-1">
                      {event.status === 'active' && (
                        <button onClick={() => handleEndEvent(event.event_id)}
                          disabled={actionLoading === event.event_id}
                          className="text-accent-orange hover:text-white text-xs">End</button>
                      )}
                      <button onClick={() => handleDeleteEvent(event.event_id)}
                        disabled={actionLoading === event.event_id}
                        className="text-accent-red hover:text-white text-xs">Delete</button>
                    </div>
                  </td>
                </tr>
              ))}
              {events.length === 0 && (
                <tr><td colSpan={6} className="py-6 text-center text-gray-500">No events</td></tr>
              )}
            </tbody>
          </table>
        </div>
        {pages > 1 && (
          <div className="flex items-center justify-between mt-3">
            <span className="text-xs text-gray-500">Page {page} of {pages}</span>
            <div className="flex gap-1">
              <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page <= 1}
                className="btn btn-secondary text-xs px-2 py-1">
                <ChevronLeft className="w-3 h-3" />
              </button>
              <button onClick={() => setPage(p => Math.min(pages, p + 1))} disabled={page >= pages}
                className="btn btn-secondary text-xs px-2 py-1">
                <ChevronRight className="w-3 h-3" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default EventsTab;
