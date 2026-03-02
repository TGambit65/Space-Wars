import { useState, useEffect, useRef } from 'react';
import { admin } from '../../services/api';
import { RefreshCw, Loader, Clock, Activity, AlertTriangle, ChevronLeft, ChevronRight } from 'lucide-react';

const TYPE_COLORS = {
  PIRATE: 'text-accent-red',
  TRADER: 'text-accent-green',
  PATROL: 'text-accent-cyan',
  BOUNTY_HUNTER: 'text-accent-orange',
  PIRATE_LORD: 'text-accent-purple',
};

const NPCManagementTab = () => {
  const [npcStats, setNpcStats] = useState(null);
  const [tickStatus, setTickStatus] = useState(null);
  const [logs, setLogs] = useState(null);
  const [logPage, setLogPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [respawning, setRespawning] = useState(false);
  const [respawnResult, setRespawnResult] = useState(null);
  const [showRespawnConfirm, setShowRespawnConfirm] = useState(false);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const refreshRef = useRef(null);
  const logPageRef = useRef(logPage);
  logPageRef.current = logPage;

  useEffect(() => {
    fetchAll();
  }, []);

  useEffect(() => {
    if (autoRefresh) {
      refreshRef.current = setInterval(fetchAll, 30000);
    }
    return () => { if (refreshRef.current) clearInterval(refreshRef.current); };
  }, [autoRefresh]);

  const fetchAll = async () => {
    try {
      const [statsRes, tickRes, logsRes] = await Promise.all([
        admin.getNPCStats(),
        admin.getTickStatus(),
        admin.getAILogs({ page: logPageRef.current, limit: 50 }),
      ]);
      setNpcStats(statsRes.data.data);
      setTickStatus(tickRes.data.data);
      setLogs(logsRes.data.data);
    } catch (err) {
      console.error('Failed to fetch NPC data:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchLogs = async (page) => {
    try {
      const res = await admin.getAILogs({ page, limit: 50 });
      setLogs(res.data.data);
      setLogPage(page);
    } catch (err) {
      console.error('Failed to fetch logs:', err);
    }
  };

  const handleRespawn = async () => {
    try {
      setRespawning(true);
      setRespawnResult(null);
      const res = await admin.forceRespawn();
      setRespawnResult(res.data.data.respawned_count);
      setShowRespawnConfirm(false);
      fetchAll();
    } catch (err) {
      setRespawnResult(-1);
    } finally {
      setRespawning(false);
    }
  };

  if (loading) {
    return (
      <div className="p-8 text-center">
        <Loader className="w-8 h-8 text-accent-cyan mx-auto mb-2 animate-spin" />
        <div className="text-gray-400 text-sm">Loading NPC data...</div>
      </div>
    );
  }

  // Build type stats from the aggregated data
  const typeStats = buildTypeStats(npcStats);

  return (
    <div className="space-y-6">
      {/* Population Stats Grid */}
      <div className="card p-4">
        <h2 className="card-header">NPC Population</h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          {Object.entries(typeStats).map(([type, stats]) => (
            <div key={type} className="bg-space-800 rounded-lg p-3">
              <div className={`text-xs font-bold ${TYPE_COLORS[type] || 'text-gray-400'} mb-2`}>
                {type.replace('_', ' ')}
              </div>
              <div className="grid grid-cols-2 gap-1 text-center">
                <div>
                  <div className="text-lg font-bold text-green-400">{stats.alive}</div>
                  <div className="text-[10px] text-gray-500">Alive</div>
                </div>
                <div>
                  <div className="text-lg font-bold text-gray-500">{stats.dead}</div>
                  <div className="text-[10px] text-gray-500">Dead</div>
                </div>
              </div>
              {stats.avgHull !== null && (
                <div className="mt-2">
                  <div className="progress-bar">
                    <div className="progress-fill bg-accent-cyan" style={{ width: `${stats.avgHull}%` }} />
                  </div>
                  <div className="text-[10px] text-gray-500 mt-1 text-center">{stats.avgHull}% avg hull</div>
                </div>
              )}
            </div>
          ))}
        </div>
        {/* Totals */}
        {npcStats?.totals && (
          <div className="flex gap-4 mt-4 text-sm">
            <span className="text-gray-400">
              Total: <span className="text-white font-bold">{npcStats.totals.total}</span>
            </span>
            <span className="text-gray-400">
              Alive: <span className="text-green-400 font-bold">{npcStats.totals.alive}</span>
            </span>
            <span className="text-gray-400">
              Dead: <span className="text-gray-500 font-bold">{npcStats.totals.dead}</span>
            </span>
            <span className="text-gray-400">
              Avg Intelligence: <span className="text-accent-purple font-bold">{npcStats.totals.avg_intelligence_tier}</span>
            </span>
          </div>
        )}
      </div>

      {/* Controls Row */}
      <div className="card p-4">
        <h2 className="card-header">Controls</h2>
        <div className="flex items-center gap-4 flex-wrap">
          {!showRespawnConfirm ? (
            <button onClick={() => setShowRespawnConfirm(true)}
              className="btn btn-danger flex items-center gap-2">
              <RefreshCw className="w-4 h-4" /> Force Respawn All
            </button>
          ) : (
            <div className="bg-accent-red/10 border border-accent-red/30 rounded-lg p-3 flex items-center gap-3">
              <AlertTriangle className="w-4 h-4 text-accent-red flex-shrink-0" />
              <span className="text-xs text-gray-300">Respawn all dead NPCs immediately?</span>
              <button onClick={() => setShowRespawnConfirm(false)}
                className="btn btn-secondary text-xs px-2 py-1">Cancel</button>
              <button onClick={handleRespawn} disabled={respawning}
                className="btn btn-danger text-xs px-2 py-1 flex items-center gap-1">
                {respawning ? <Loader className="w-3 h-3 animate-spin" /> : null}
                Confirm
              </button>
            </div>
          )}
          {respawnResult !== null && (
            <span className={`text-sm ${respawnResult >= 0 ? 'text-green-400' : 'text-accent-red'}`}>
              {respawnResult >= 0 ? `Respawned ${respawnResult} NPCs` : 'Respawn failed'}
            </span>
          )}
          <button onClick={fetchAll} className="btn btn-secondary flex items-center gap-2 text-sm">
            <RefreshCw className="w-3 h-3" /> Refresh
          </button>
        </div>
      </div>

      {/* Tick System Status */}
      {tickStatus && (
        <div className="card p-4">
          <h2 className="card-header flex items-center gap-2">
            <Activity className="w-4 h-4" /> Tick System
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            <StatBox label="Status"
              value={tickStatus.running ? 'Running' : 'Stopped'}
              color={tickStatus.running ? 'text-green-400' : 'text-accent-red'}
              dot={tickStatus.running ? 'bg-green-400' : 'bg-accent-red'} />
            <StatBox label="Tactical Ticks" value={tickStatus.tacticalTicks ?? 0} />
            <StatBox label="Combat Ticks" value={tickStatus.combatTicks ?? 0} />
            <StatBox label="Avg Tactical (ms)" value={tickStatus.avgTacticalMs ?? 0} />
            <StatBox label="Active NPCs" value={tickStatus.activeNPCCount ?? 0} />
            <StatBox label="Last Tick"
              value={tickStatus.lastTacticalAt ? new Date(tickStatus.lastTacticalAt).toLocaleTimeString() : 'N/A'}
              small />
          </div>
        </div>
      )}

      {/* AI Decision Log */}
      <div className="card p-4">
        <div className="flex items-center justify-between mb-3">
          <h2 className="card-header mb-0">AI Decision Log</h2>
          <label className="flex items-center gap-2 cursor-pointer text-xs text-gray-400">
            <input type="checkbox" checked={autoRefresh} onChange={(e) => setAutoRefresh(e.target.checked)}
              className="rounded border-space-500" />
            Auto-refresh
          </label>
        </div>

        {logs?.logs?.length > 0 ? (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-space-700 text-left">
                    <th className="py-2 px-2 text-xs text-gray-500">Time</th>
                    <th className="py-2 px-2 text-xs text-gray-500">NPC</th>
                    <th className="py-2 px-2 text-xs text-gray-500">Type</th>
                    <th className="py-2 px-2 text-xs text-gray-500">Action</th>
                    <th className="py-2 px-2 text-xs text-gray-500">Reason</th>
                    <th className="py-2 px-2 text-xs text-gray-500">Source</th>
                    <th className="py-2 px-2 text-xs text-gray-500">Latency</th>
                  </tr>
                </thead>
                <tbody>
                  {logs.logs.map((entry, i) => (
                    <tr key={i} className="border-b border-space-800 hover:bg-space-700/50">
                      <td className="py-1.5 px-2 text-xs text-gray-400 whitespace-nowrap">
                        {entry.timestamp ? new Date(entry.timestamp).toLocaleTimeString() : '-'}
                      </td>
                      <td className="py-1.5 px-2 text-xs text-white">{entry.npc_name || '-'}</td>
                      <td className="py-1.5 px-2">
                        <span className={`text-xs ${TYPE_COLORS[entry.npc_type] || 'text-gray-400'}`}>
                          {entry.npc_type || '-'}
                        </span>
                      </td>
                      <td className="py-1.5 px-2 text-xs text-accent-cyan">{entry.action || '-'}</td>
                      <td className="py-1.5 px-2 text-xs text-gray-400 max-w-[200px] truncate">{entry.reason || '-'}</td>
                      <td className="py-1.5 px-2">
                        {entry.was_ai ? (
                          <span className="badge badge-cyan">AI</span>
                        ) : (
                          <span className="badge bg-space-700 text-gray-400 border border-space-600">Script</span>
                        )}
                      </td>
                      <td className="py-1.5 px-2 text-xs text-gray-500">
                        {entry.latency_ms ? `${entry.latency_ms}ms` : '-'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {/* Pagination */}
            {logs.pages > 1 && (
              <div className="flex items-center justify-between mt-3">
                <span className="text-xs text-gray-500">
                  Page {logs.page} of {logs.pages} ({logs.total} entries)
                </span>
                <div className="flex gap-1">
                  <button onClick={() => fetchLogs(logPage - 1)} disabled={logPage <= 1}
                    className="btn btn-secondary text-xs px-2 py-1">
                    <ChevronLeft className="w-3 h-3" />
                  </button>
                  <button onClick={() => fetchLogs(logPage + 1)} disabled={logPage >= logs.pages}
                    className="btn btn-secondary text-xs px-2 py-1">
                    <ChevronRight className="w-3 h-3" />
                  </button>
                </div>
              </div>
            )}
          </>
        ) : (
          <div className="text-center py-6 text-gray-500 text-sm">
            <Clock className="w-6 h-6 mx-auto mb-2 opacity-50" />
            No decision log entries yet. Start the tick system to see NPC decisions.
          </div>
        )}
      </div>
    </div>
  );
};

// --- Helpers ---

const buildTypeStats = (npcStats) => {
  const types = {};
  const allTypes = ['PIRATE', 'TRADER', 'PATROL', 'BOUNTY_HUNTER', 'PIRATE_LORD'];

  for (const t of allTypes) {
    types[t] = { alive: 0, dead: 0, avgHull: null };
  }

  if (npcStats?.by_type) {
    for (const row of npcStats.by_type) {
      const type = row.npc_type;
      if (!types[type]) types[type] = { alive: 0, dead: 0, avgHull: null };
      if (row.is_alive) {
        types[type].alive = parseInt(row.count) || 0;
        if (row.avg_hull != null && row.avg_max_hull != null && row.avg_max_hull > 0) {
          types[type].avgHull = Math.round((row.avg_hull / row.avg_max_hull) * 100);
        }
      } else {
        types[type].dead = parseInt(row.count) || 0;
      }
    }
  }

  return types;
};

const StatBox = ({ label, value, color, dot, small }) => (
  <div className="bg-space-800 rounded p-3 text-center">
    <div className={`${small ? 'text-sm' : 'text-xl'} font-bold ${color || 'text-white'} flex items-center justify-center gap-1`}>
      {dot && <span className={`w-2 h-2 rounded-full ${dot} inline-block`} />}
      {value}
    </div>
    <div className="text-[10px] text-gray-500 mt-1">{label}</div>
  </div>
);

export default NPCManagementTab;
