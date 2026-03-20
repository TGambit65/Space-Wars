import { useState, useEffect, useCallback } from 'react';
import { agents, ships as shipsApi } from '../../services/api';
import { Bot, Key, Play, Square, Pause, Trash2, RefreshCw, Shield, Copy, Eye, EyeOff, Settings, Activity } from 'lucide-react';

const DIRECTIVES = [
  { value: 'idle', label: 'Idle', desc: 'Agent does nothing until given commands' },
  { value: 'trade', label: 'Trade', desc: 'Autonomously trade for profit' },
  { value: 'scout', label: 'Scout', desc: 'Explore and scan new sectors' },
  { value: 'defend', label: 'Defend', desc: 'Patrol and protect assigned area' },
  { value: 'mine', label: 'Mine', desc: 'Gather resources from planets' },
];

const PERMISSION_FAMILIES = [
  { key: 'navigate', label: 'Navigate', desc: 'Move between sectors' },
  { key: 'trade', label: 'Trade', desc: 'Buy and sell commodities' },
  { key: 'scan', label: 'Scan', desc: 'View sector and map data' },
  { key: 'dock', label: 'Dock', desc: 'Interact with ports' },
  { key: 'combat', label: 'Combat', desc: 'Engage in combat' },
  { key: 'colony', label: 'Colony', desc: 'Manage colonies' },
  { key: 'fleet', label: 'Fleet', desc: 'Fleet operations' },
  { key: 'social', label: 'Social', desc: 'Send messages, join corps' },
];

const STATUS_COLORS = {
  active: 'text-green-400',
  stopped: 'text-gray-400',
  paused: 'text-yellow-400',
  error: 'text-red-400',
};

export default function AgentPage({ user }) {
  const [agent, setAgent] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [newApiKey, setNewApiKey] = useState(null);
  const [showKey, setShowKey] = useState(false);
  const [tab, setTab] = useState('overview');
  const [logs, setLogs] = useState([]);
  const [logPage, setLogPage] = useState(1);
  const [logTotal, setLogTotal] = useState(0);
  const [playerShips, setPlayerShips] = useState([]);
  const [creating, setCreating] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);

  const fetchAgent = useCallback(async () => {
    try {
      const res = await agents.get();
      setAgent(res.data.data);
      setError(null);
    } catch (err) {
      if (err.response?.status === 404) {
        setAgent(null);
      } else {
        setError(err.response?.data?.message || 'Failed to load agent');
      }
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchLogs = useCallback(async (page = 1) => {
    try {
      const res = await agents.getLogs({ page, limit: 20 });
      setLogs(res.data.data.logs);
      setLogTotal(res.data.data.total);
      setLogPage(page);
    } catch { /* ignore */ }
  }, []);

  const fetchShips = useCallback(async () => {
    try {
      const res = await shipsApi.getAll();
      setPlayerShips(res.data.data || []);
    } catch { /* ignore */ }
  }, []);

  useEffect(() => { fetchAgent(); fetchShips(); }, [fetchAgent, fetchShips]);
  useEffect(() => { if (agent && tab === 'activity') fetchLogs(1); }, [agent, tab, fetchLogs]);

  const handleCreate = async () => {
    setCreating(true);
    try {
      const res = await agents.create({ name: `${user.username}'s Agent` });
      setAgent(res.data.data.agent);
      setNewApiKey(res.data.data.api_key);
      setShowKey(true);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to create agent');
    } finally {
      setCreating(false);
    }
  };

  const handleStatusChange = async (status) => {
    setActionLoading(true);
    try {
      const res = await agents.setStatus(status);
      setAgent(res.data.data);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to change status');
    } finally {
      setActionLoading(false);
    }
  };

  const handleRegenKey = async () => {
    if (!confirm('This will invalidate the current API key. Any running agent will lose access. Continue?')) return;
    try {
      const res = await agents.regenerateKey();
      setAgent(res.data.data.agent);
      setNewApiKey(res.data.data.api_key);
      setShowKey(true);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to regenerate key');
    }
  };

  const handleDelete = async () => {
    if (!confirm('Delete your agent account? All logs will be lost. This cannot be undone.')) return;
    try {
      await agents.remove();
      setAgent(null);
      setNewApiKey(null);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to delete agent');
    }
  };

  const handleUpdate = async (updates) => {
    setActionLoading(true);
    try {
      const res = await agents.update(updates);
      setAgent(res.data.data);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to update agent');
    } finally {
      setActionLoading(false);
    }
  };

  const copyKey = () => {
    if (newApiKey) {
      navigator.clipboard.writeText(newApiKey);
    }
  };

  if (loading) {
    return (
      <div className="min-h-[16rem] flex items-center justify-center">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-neon-cyan" />
      </div>
    );
  }

  // No agent yet — show creation UI
  if (!agent) {
    return (
      <div className="max-w-2xl mx-auto space-y-6">
        <div className="card p-6 text-center space-y-4">
          <Bot className="w-16 h-16 mx-auto text-neon-cyan opacity-60" />
          <h2 className="text-2xl font-bold text-neon-cyan">AI Agent Companion</h2>
          <p className="text-gray-400 max-w-md mx-auto">
            Deploy an AI agent that plays alongside you. Your agent can navigate, trade, scout,
            and more — all within the permissions and budget you set.
          </p>
          <p className="text-sm text-gray-500">
            Compatible with OpenClaw and other AI agent frameworks via API key authentication.
          </p>
          {error && <p className="text-red-400 text-sm">{error}</p>}
          <button onClick={handleCreate} disabled={creating} className="btn btn-primary px-8 py-3 text-lg">
            {creating ? 'Creating...' : 'Create Agent'}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-4">
      {/* API Key Banner */}
      {newApiKey && (
        <div className="card p-4 border border-yellow-500/50 bg-yellow-500/10">
          <div className="flex items-center gap-2 mb-2">
            <Key className="w-5 h-5 text-yellow-400" />
            <span className="text-yellow-400 font-semibold">Save Your API Key</span>
          </div>
          <p className="text-sm text-gray-300 mb-2">This key will only be shown once. Copy it now.</p>
          <div className="flex items-center gap-2">
            <code className="flex-1 bg-black/40 px-3 py-2 rounded text-sm font-mono text-green-400 break-all">
              {showKey ? newApiKey : '••••••••••••••••••••••••••••'}
            </code>
            <button onClick={() => setShowKey(!showKey)} className="p-2 hover:bg-white/10 rounded" title={showKey ? 'Hide' : 'Show'}>
              {showKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
            <button onClick={copyKey} className="p-2 hover:bg-white/10 rounded" title="Copy">
              <Copy className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {error && (
        <div className="card p-3 border border-red-500/50 bg-red-500/10 text-red-400 text-sm">
          {error}
          <button onClick={() => setError(null)} className="ml-2 underline">dismiss</button>
        </div>
      )}

      {/* Header */}
      <div className="card p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Bot className="w-8 h-8 text-neon-cyan" />
            <div>
              <h2 className="text-xl font-bold text-white">{agent.name}</h2>
              <div className="flex items-center gap-3 text-sm">
                <span className={STATUS_COLORS[agent.status]}>
                  {agent.status === 'active' ? '● Active' : agent.status === 'paused' ? '● Paused' : agent.status === 'error' ? '● Error' : '○ Stopped'}
                </span>
                <span className="text-gray-500">|</span>
                <span className="text-gray-400">Directive: {agent.directive}</span>
                {agent.ship && (
                  <>
                    <span className="text-gray-500">|</span>
                    <span className="text-gray-400">Ship: {agent.ship.name}</span>
                  </>
                )}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {agent.status === 'stopped' && (
              <button onClick={() => handleStatusChange('active')} disabled={actionLoading}
                className="btn btn-sm bg-green-600 hover:bg-green-500 text-white flex items-center gap-1">
                <Play className="w-4 h-4" /> Start
              </button>
            )}
            {agent.status === 'active' && (
              <>
                <button onClick={() => handleStatusChange('paused')} disabled={actionLoading}
                  className="btn btn-sm bg-yellow-600 hover:bg-yellow-500 text-white flex items-center gap-1">
                  <Pause className="w-4 h-4" /> Pause
                </button>
                <button onClick={() => handleStatusChange('stopped')} disabled={actionLoading}
                  className="btn btn-sm bg-red-600 hover:bg-red-500 text-white flex items-center gap-1">
                  <Square className="w-4 h-4" /> Stop
                </button>
              </>
            )}
            {agent.status === 'paused' && (
              <>
                <button onClick={() => handleStatusChange('active')} disabled={actionLoading}
                  className="btn btn-sm bg-green-600 hover:bg-green-500 text-white flex items-center gap-1">
                  <Play className="w-4 h-4" /> Resume
                </button>
                <button onClick={() => handleStatusChange('stopped')} disabled={actionLoading}
                  className="btn btn-sm bg-red-600 hover:bg-red-500 text-white flex items-center gap-1">
                  <Square className="w-4 h-4" /> Stop
                </button>
              </>
            )}
          </div>
        </div>
        {agent.error_message && (
          <div className="mt-2 text-sm text-red-400 bg-red-500/10 rounded px-3 py-1">
            Error: {agent.error_message}
          </div>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-gray-700">
        {[
          { key: 'overview', label: 'Overview', icon: Bot },
          { key: 'permissions', label: 'Permissions', icon: Shield },
          { key: 'settings', label: 'Settings', icon: Settings },
          { key: 'activity', label: 'Activity Log', icon: Activity },
        ].map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={`px-4 py-2 text-sm flex items-center gap-1.5 border-b-2 transition-colors ${
              tab === t.key ? 'border-neon-cyan text-neon-cyan' : 'border-transparent text-gray-400 hover:text-gray-300'
            }`}>
            <t.icon className="w-4 h-4" /> {t.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      {tab === 'overview' && <OverviewTab agent={agent} />}
      {tab === 'permissions' && <PermissionsTab agent={agent} onUpdate={handleUpdate} />}
      {tab === 'settings' && (
        <SettingsTab agent={agent} ships={playerShips} onUpdate={handleUpdate}
          onRegenKey={handleRegenKey} onDelete={handleDelete} />
      )}
      {tab === 'activity' && (
        <ActivityTab logs={logs} page={logPage} total={logTotal} onPageChange={(p) => fetchLogs(p)} />
      )}
    </div>
  );
}

function OverviewTab({ agent }) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
      <StatCard label="Total Actions" value={agent.total_actions || 0} />
      <StatCard label="Credits Earned" value={(agent.total_credits_earned || 0).toLocaleString()} color="text-green-400" />
      <StatCard label="Credits Spent" value={(agent.total_credits_spent || 0).toLocaleString()} color="text-red-400" />
      <StatCard label="Today's Budget" value={`${(agent.daily_credits_spent || 0).toLocaleString()} / ${(agent.daily_credit_limit || 0).toLocaleString()}`} />
      <StatCard label="Rate Limit" value={`${agent.actions_this_minute || 0} / ${agent.rate_limit_per_minute || 30} per min`} />
      <StatCard label="Directive" value={agent.directive} />
      <StatCard label="Last Action" value={agent.last_action_type || 'None'} />
      <StatCard label="Last Active" value={agent.last_action_at ? new Date(agent.last_action_at).toLocaleString() : 'Never'} />
    </div>
  );
}

function StatCard({ label, value, color = 'text-white' }) {
  return (
    <div className="card p-3">
      <div className="text-xs text-gray-500 mb-1">{label}</div>
      <div className={`text-sm font-semibold ${color}`}>{value}</div>
    </div>
  );
}

function PermissionsTab({ agent, onUpdate }) {
  const [perms, setPerms] = useState(agent.permissions || {});
  const [dirty, setDirty] = useState(false);

  const toggle = (key) => {
    const updated = { ...perms, [key]: !perms[key] };
    setPerms(updated);
    setDirty(true);
  };

  const save = () => {
    onUpdate({ permissions: perms });
    setDirty(false);
  };

  return (
    <div className="card p-4 space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-gray-300">Agent Permissions</h3>
        {dirty && (
          <button onClick={save} className="btn btn-sm btn-primary">Save Changes</button>
        )}
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
        {PERMISSION_FAMILIES.map(p => (
          <label key={p.key} className="flex items-center gap-3 p-2 rounded hover:bg-white/5 cursor-pointer">
            <input type="checkbox" checked={!!perms[p.key]} onChange={() => toggle(p.key)}
              className="w-4 h-4 accent-neon-cyan" />
            <div>
              <span className="text-sm text-white">{p.label}</span>
              <span className="text-xs text-gray-500 ml-2">{p.desc}</span>
            </div>
          </label>
        ))}
      </div>
    </div>
  );
}

function SettingsTab({ agent, ships, onUpdate, onRegenKey, onDelete }) {
  const [name, setName] = useState(agent.name);
  const [directive, setDirective] = useState(agent.directive);
  const [shipId, setShipId] = useState(agent.ship_id || '');
  const [dailyLimit, setDailyLimit] = useState(agent.daily_credit_limit);
  const [rateLimit, setRateLimit] = useState(agent.rate_limit_per_minute);

  const save = () => {
    onUpdate({
      name,
      directive,
      ship_id: shipId || null,
      daily_credit_limit: parseInt(dailyLimit) || 5000,
      rate_limit_per_minute: parseInt(rateLimit) || 30,
    });
  };

  return (
    <div className="space-y-4">
      <div className="card p-4 space-y-3">
        <h3 className="text-sm font-semibold text-gray-300">Agent Configuration</h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            <label className="text-xs text-gray-500">Agent Name</label>
            <input value={name} onChange={e => setName(e.target.value)}
              className="w-full bg-black/40 border border-gray-700 rounded px-3 py-1.5 text-sm text-white" />
          </div>
          <div>
            <label className="text-xs text-gray-500">Directive</label>
            <select value={directive} onChange={e => setDirective(e.target.value)}
              className="w-full bg-black/40 border border-gray-700 rounded px-3 py-1.5 text-sm text-white">
              {DIRECTIVES.map(d => (
                <option key={d.value} value={d.value}>{d.label} — {d.desc}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs text-gray-500">Assigned Ship</label>
            <select value={shipId} onChange={e => setShipId(e.target.value)}
              className="w-full bg-black/40 border border-gray-700 rounded px-3 py-1.5 text-sm text-white">
              <option value="">No ship assigned</option>
              {ships.map(s => (
                <option key={s.ship_id} value={s.ship_id}>{s.name} ({s.ship_type})</option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs text-gray-500">Daily Credit Limit</label>
            <input type="number" value={dailyLimit} onChange={e => setDailyLimit(e.target.value)}
              className="w-full bg-black/40 border border-gray-700 rounded px-3 py-1.5 text-sm text-white" />
          </div>
          <div>
            <label className="text-xs text-gray-500">Rate Limit (actions/min)</label>
            <input type="number" value={rateLimit} onChange={e => setRateLimit(e.target.value)}
              className="w-full bg-black/40 border border-gray-700 rounded px-3 py-1.5 text-sm text-white" />
          </div>
        </div>

        <button onClick={save} className="btn btn-primary">Save Settings</button>
      </div>

      {/* Danger Zone */}
      <div className="card p-4 border border-red-500/30 space-y-3">
        <h3 className="text-sm font-semibold text-red-400">Danger Zone</h3>
        <div className="flex flex-wrap gap-3">
          <button onClick={onRegenKey} className="btn btn-sm border border-yellow-500/50 text-yellow-400 hover:bg-yellow-500/10 flex items-center gap-1">
            <RefreshCw className="w-4 h-4" /> Regenerate API Key
          </button>
          <button onClick={onDelete} className="btn btn-sm border border-red-500/50 text-red-400 hover:bg-red-500/10 flex items-center gap-1">
            <Trash2 className="w-4 h-4" /> Delete Agent
          </button>
        </div>
      </div>
    </div>
  );
}

function ActivityTab({ logs, page, total, onPageChange }) {
  const pages = Math.ceil(total / 20);
  const RESULT_COLORS = {
    allowed: 'text-green-400',
    denied: 'text-red-400',
    error: 'text-red-400',
    budget_exceeded: 'text-yellow-400',
    rate_limited: 'text-orange-400',
  };

  return (
    <div className="card p-4 space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-gray-300">Action Log ({total} total)</h3>
        <div className="flex items-center gap-2 text-sm">
          <button disabled={page <= 1} onClick={() => onPageChange(page - 1)}
            className="px-2 py-1 rounded bg-black/40 hover:bg-white/10 disabled:opacity-30">Prev</button>
          <span className="text-gray-400">{page} / {pages || 1}</span>
          <button disabled={page >= pages} onClick={() => onPageChange(page + 1)}
            className="px-2 py-1 rounded bg-black/40 hover:bg-white/10 disabled:opacity-30">Next</button>
        </div>
      </div>

      {logs.length === 0 ? (
        <p className="text-gray-500 text-sm text-center py-4">No actions recorded yet.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-gray-500 text-xs border-b border-gray-700">
                <th className="text-left py-1 pr-3">Time</th>
                <th className="text-left py-1 pr-3">Action</th>
                <th className="text-left py-1 pr-3">Family</th>
                <th className="text-left py-1 pr-3">Target</th>
                <th className="text-left py-1 pr-3">Result</th>
                <th className="text-right py-1">Credits</th>
              </tr>
            </thead>
            <tbody>
              {logs.map(log => (
                <tr key={log.log_id} className="border-b border-gray-800 hover:bg-white/5">
                  <td className="py-1.5 pr-3 text-gray-400 whitespace-nowrap">
                    {new Date(log.created_at).toLocaleTimeString()}
                  </td>
                  <td className="py-1.5 pr-3 text-white">{log.action_type}</td>
                  <td className="py-1.5 pr-3 text-gray-400">{log.action_family}</td>
                  <td className="py-1.5 pr-3 text-gray-400 max-w-[120px] truncate">{log.target_entity || '—'}</td>
                  <td className={`py-1.5 pr-3 ${RESULT_COLORS[log.result] || 'text-gray-400'}`}>{log.result}</td>
                  <td className={`py-1.5 text-right ${log.credits_delta > 0 ? 'text-green-400' : log.credits_delta < 0 ? 'text-red-400' : 'text-gray-500'}`}>
                    {log.credits_delta > 0 ? '+' : ''}{log.credits_delta || '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
