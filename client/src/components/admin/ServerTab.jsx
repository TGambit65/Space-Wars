import { useState, useEffect, useRef } from 'react';
import { admin } from '../../services/api';
import { Activity, Play, Square, RefreshCw, AlertTriangle } from 'lucide-react';

const ServerTab = () => {
  const [status, setStatus] = useState(null);
  const [runtimeLog, setRuntimeLog] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [actionLoading, setActionLoading] = useState(null);
  const [showStopConfirm, setShowStopConfirm] = useState(false);
  const refreshRef = useRef(null);

  useEffect(() => {
    fetchAll();
    refreshRef.current = setInterval(fetchStatus, 10000);
    return () => clearInterval(refreshRef.current);
  }, []);

  const fetchAll = async () => {
    try {
      setLoading(true);
      const [statusRes, logRes] = await Promise.all([
        admin.getServerStatus(),
        admin.getRuntimeLog({ limit: 50 })
      ]);
      setStatus(statusRes.data.data);
      setRuntimeLog(logRes.data.data.entries);
    } catch (err) {
      setError('Failed to load server status');
    } finally {
      setLoading(false);
    }
  };

  const fetchStatus = async () => {
    try {
      const res = await admin.getServerStatus();
      setStatus(res.data.data);
    } catch (err) {
      // silent
    }
  };

  const handleStartTicks = async () => {
    setActionLoading('start');
    try {
      await admin.startTicks();
      await fetchStatus();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to start ticks');
    } finally {
      setActionLoading(null);
    }
  };

  const handleStopTicks = async () => {
    setActionLoading('stop');
    try {
      await admin.stopTicks();
      setShowStopConfirm(false);
      await fetchStatus();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to stop ticks');
    } finally {
      setActionLoading(null);
    }
  };

  const formatUptime = (seconds) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = Math.floor(seconds % 60);
    return `${h}h ${m}m ${s}s`;
  };

  if (loading) {
    return (
      <div className="p-8 text-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-accent-cyan mx-auto mb-4"></div>
        <div className="text-gray-400 text-sm">Loading server status...</div>
      </div>
    );
  }

  const ticks = status?.ticks;
  const server = status?.server;

  return (
    <div className="space-y-4">
      {error && (
        <div className="bg-accent-red/10 border border-accent-red/30 rounded-lg p-3 flex items-center gap-2">
          <AlertTriangle className="w-5 h-5 text-accent-red flex-shrink-0" />
          <span className="text-accent-red text-sm">{error}</span>
          <button onClick={() => setError(null)} className="ml-auto text-accent-red hover:text-white text-xs">Dismiss</button>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Tick Status */}
        <div className="card p-4">
          <div className="flex items-center justify-between mb-4">
            <h3 className="card-header flex items-center gap-2 mb-0">
              <Activity className="w-4 h-4" /> Tick System
            </h3>
            <span className={`px-2 py-0.5 rounded text-xs font-bold ${
              ticks?.running ? 'bg-green-500/20 text-green-400' : 'bg-accent-red/20 text-accent-red'
            }`}>
              {ticks?.running ? 'RUNNING' : 'STOPPED'}
            </span>
          </div>

          {ticks && (
            <div className="grid grid-cols-2 gap-2 mb-4">
              <div className="bg-space-800 rounded p-2 text-center">
                <div className="text-lg font-bold text-accent-cyan">{ticks.tacticalTicks}</div>
                <div className="text-xs text-gray-400">Tactical Ticks</div>
              </div>
              <div className="bg-space-800 rounded p-2 text-center">
                <div className="text-lg font-bold text-accent-orange">{ticks.combatTicks}</div>
                <div className="text-xs text-gray-400">Combat Ticks</div>
              </div>
              <div className="bg-space-800 rounded p-2 text-center">
                <div className="text-lg font-bold text-accent-purple">{ticks.maintenanceTicks}</div>
                <div className="text-xs text-gray-400">Maintenance</div>
              </div>
              <div className="bg-space-800 rounded p-2 text-center">
                <div className="text-lg font-bold text-white">{ticks.avgTacticalMs}ms</div>
                <div className="text-xs text-gray-400">Avg Tactical</div>
              </div>
              <div className="bg-space-800 rounded p-2 text-center">
                <div className="text-lg font-bold text-accent-green">{ticks.activeNPCCount}</div>
                <div className="text-xs text-gray-400">Active NPCs</div>
              </div>
              <div className="bg-space-800 rounded p-2 text-center">
                <div className="text-lg font-bold text-gray-300">
                  {ticks.lastTacticalAt ? new Date(ticks.lastTacticalAt).toLocaleTimeString() : '-'}
                </div>
                <div className="text-xs text-gray-400">Last Tick</div>
              </div>
            </div>
          )}

          {/* Tick Controls */}
          <div className="flex gap-2">
            {!ticks?.running ? (
              <button onClick={handleStartTicks} disabled={actionLoading}
                className="btn btn-primary flex-1 flex items-center justify-center gap-2 text-sm">
                {actionLoading === 'start' ? (
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                ) : <Play className="w-4 h-4" />}
                Start Ticks
              </button>
            ) : !showStopConfirm ? (
              <button onClick={() => setShowStopConfirm(true)} disabled={actionLoading}
                className="btn btn-danger flex-1 flex items-center justify-center gap-2 text-sm">
                <Square className="w-4 h-4" /> Stop Ticks
              </button>
            ) : (
              <div className="flex-1 bg-accent-red/10 border border-accent-red/30 rounded-lg p-3">
                <p className="text-xs text-gray-400 mb-2">Stop all game ticks? NPCs will freeze.</p>
                <div className="flex gap-2">
                  <button onClick={() => setShowStopConfirm(false)} className="btn btn-secondary flex-1 text-xs">Cancel</button>
                  <button onClick={handleStopTicks} disabled={actionLoading}
                    className="btn btn-danger flex-1 text-xs">
                    {actionLoading === 'stop' ? 'Stopping...' : 'Confirm Stop'}
                  </button>
                </div>
              </div>
            )}
            <button onClick={fetchAll} className="btn btn-secondary flex items-center gap-1 text-sm">
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Server Stats */}
        <div className="card p-4">
          <h3 className="card-header flex items-center gap-2">
            Server Info
          </h3>
          {server && (
            <div className="space-y-3 mt-4">
              <div className="flex justify-between text-sm">
                <span className="text-gray-400">Uptime</span>
                <span className="text-white font-mono">{formatUptime(server.uptime)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-400">Memory (RSS)</span>
                <span className="text-white font-mono">{server.memory.rss} MB</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-400">Heap Used</span>
                <span className="text-white font-mono">{server.memory.heapUsed} / {server.memory.heapTotal} MB</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-400">Node.js</span>
                <span className="text-white font-mono">{server.nodeVersion}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-400">PID</span>
                <span className="text-white font-mono">{server.pid}</span>
              </div>
              {/* Memory bar */}
              <div>
                <div className="flex justify-between text-xs text-gray-500 mb-1">
                  <span>Heap Usage</span>
                  <span>{Math.round(server.memory.heapUsed / server.memory.heapTotal * 100)}%</span>
                </div>
                <div className="w-full bg-space-800 rounded-full h-2">
                  <div className="bg-accent-cyan rounded-full h-2 transition-all"
                    style={{ width: `${Math.min(100, server.memory.heapUsed / server.memory.heapTotal * 100)}%` }} />
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Runtime Event Log */}
      <div className="card p-4">
        <h3 className="card-header flex items-center gap-2">
          Runtime Events
        </h3>
        {runtimeLog.length === 0 ? (
          <div className="text-sm text-gray-500 mt-3">No runtime events logged</div>
        ) : (
          <div className="mt-3 max-h-64 overflow-y-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-space-700 text-left">
                  <th className="py-1 px-2 text-gray-500">Time</th>
                  <th className="py-1 px-2 text-gray-500">Type</th>
                  <th className="py-1 px-2 text-gray-500">Details</th>
                </tr>
              </thead>
              <tbody>
                {runtimeLog.map((entry, i) => (
                  <tr key={i} className="border-b border-space-800">
                    <td className="py-1 px-2 text-gray-500 whitespace-nowrap">
                      {entry.timestamp ? new Date(entry.timestamp).toLocaleTimeString() : '-'}
                    </td>
                    <td className="py-1 px-2 text-accent-orange">{entry.type || '-'}</td>
                    <td className="py-1 px-2 text-gray-400 truncate max-w-xs">
                      {entry.details ? (typeof entry.details === 'object' ? JSON.stringify(entry.details) : entry.details) : '-'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default ServerTab;
