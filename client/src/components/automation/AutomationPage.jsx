import { useState, useEffect, useCallback } from 'react';
import { automation, ships as shipsApi, colonies as coloniesApi } from '../../services/api';
import { Bot, Play, Pause, Trash2, Plus, Route, Gem } from 'lucide-react';
import SectorPicker from '../common/SectorPicker';

function AutomationPage({ user }) {
  const [tasks, setTasks] = useState([]);
  const [ships, setShips] = useState([]);
  const [colonyList, setColonyList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [actionLoading, setActionLoading] = useState(null);
  const [showCreate, setShowCreate] = useState(null); // 'trade' | 'mining' | null

  // Trade route form
  const [tradeForm, setTradeForm] = useState({ ship_id: '', waypoints: [] });
  const [waypointInput, setWaypointInput] = useState('');

  // Mining form
  const [miningForm, setMiningForm] = useState({ ship_id: '', colony_id: '', return_port_sector_id: '' });

  const fetchData = useCallback(async () => {
    try {
      const [tasksRes, shipsRes, coloniesRes] = await Promise.all([
        automation.getTasks(),
        shipsApi.getAll(),
        coloniesApi.getAll(),
      ]);
      const tasksRaw = tasksRes.data.data;
      setTasks(Array.isArray(tasksRaw) ? tasksRaw : tasksRaw?.tasks || []);
      setShips(shipsRes.data.data?.ships || shipsRes.data || []);
      const colRaw = coloniesRes.data.data;
      setColonyList(Array.isArray(colRaw) ? colRaw : Array.isArray(coloniesRes.data) ? coloniesRes.data : colRaw?.colonies || []);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load data');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handlePause = async (taskId) => {
    setActionLoading(`pause-${taskId}`);
    try {
      await automation.pause(taskId);
      await fetchData();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to pause');
    } finally {
      setActionLoading(null);
    }
  };

  const handleResume = async (taskId) => {
    setActionLoading(`resume-${taskId}`);
    try {
      await automation.resume(taskId);
      await fetchData();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to resume');
    } finally {
      setActionLoading(null);
    }
  };

  const handleCancel = async (taskId) => {
    if (!confirm('Cancel this automation task?')) return;
    setActionLoading(`cancel-${taskId}`);
    try {
      await automation.cancel(taskId);
      await fetchData();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to cancel');
    } finally {
      setActionLoading(null);
    }
  };

  const handleCreateTradeRoute = async (e) => {
    e.preventDefault();
    if (tradeForm.waypoints.length < 2) return setError('Need at least 2 waypoints');
    setActionLoading('create-trade');
    try {
      await automation.createTradeRoute(tradeForm);
      setShowCreate(null);
      setTradeForm({ ship_id: '', waypoints: [] });
      await fetchData();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to create trade route');
    } finally {
      setActionLoading(null);
    }
  };

  const handleCreateMining = async (e) => {
    e.preventDefault();
    setActionLoading('create-mining');
    try {
      await automation.createMiningRun(miningForm);
      setShowCreate(null);
      setMiningForm({ ship_id: '', colony_id: '', return_port_sector_id: '' });
      await fetchData();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to create mining run');
    } finally {
      setActionLoading(null);
    }
  };

  const addWaypoint = () => {
    if (!waypointInput) return;
    setTradeForm(f => ({ ...f, waypoints: [...f.waypoints, waypointInput] }));
    setWaypointInput('');
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-neon-cyan"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Automation</h1>
          <p className="text-gray-500 text-sm mt-1">Automated trade routes and mining runs</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setShowCreate(showCreate === 'trade' ? null : 'trade')} className="holo-button text-xs">
            <Route className="w-3.5 h-3.5" /> Trade Route
          </button>
          <button onClick={() => setShowCreate(showCreate === 'mining' ? null : 'mining')} className="holo-button-orange text-xs px-3 py-2">
            <Gem className="w-3.5 h-3.5" /> Mining Run
          </button>
        </div>
      </div>

      {error && (
        <div className="p-3 rounded-lg text-sm" style={{ background: 'rgba(244,67,54,0.1)', border: '1px solid rgba(244,67,54,0.3)', color: '#f44336' }}>
          {error}
          <button onClick={() => setError(null)} className="ml-2 underline">dismiss</button>
        </div>
      )}

      {/* Create Forms */}
      {showCreate === 'trade' && (
        <div className="holo-panel p-4">
          <h2 className="text-sm font-display text-white mb-3">Create Trade Route</h2>
          <form onSubmit={handleCreateTradeRoute} className="space-y-3">
            <select className="input w-full" value={tradeForm.ship_id} onChange={e => setTradeForm(f => ({ ...f, ship_id: e.target.value }))} required>
              <option value="">Select Ship</option>
              {ships.map(s => <option key={s.ship_id} value={s.ship_id}>{s.name}</option>)}
            </select>
            <div className="flex gap-2">
              <SectorPicker
                className="flex-1"
                value={waypointInput}
                onChange={setWaypointInput}
                placeholder="Select waypoint sector..."
              />
              <button type="button" onClick={addWaypoint} className="btn btn-ghost text-sm"><Plus className="w-4 h-4" /></button>
            </div>
            {tradeForm.waypoints.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {tradeForm.waypoints.map((w, i) => (
                  <span key={i} className="badge-cyan text-xs cursor-pointer" onClick={() => setTradeForm(f => ({ ...f, waypoints: f.waypoints.filter((_, j) => j !== i) }))}>
                    {w} x
                  </span>
                ))}
              </div>
            )}
            <button type="submit" disabled={actionLoading === 'create-trade'} className="holo-button text-sm">
              {actionLoading === 'create-trade' ? 'Creating...' : 'Create Route'}
            </button>
          </form>
        </div>
      )}

      {showCreate === 'mining' && (
        <div className="holo-panel p-4">
          <h2 className="text-sm font-display text-white mb-3">Create Mining Run</h2>
          <form onSubmit={handleCreateMining} className="space-y-3">
            <select className="input w-full" value={miningForm.ship_id} onChange={e => setMiningForm(f => ({ ...f, ship_id: e.target.value }))} required>
              <option value="">Select Ship</option>
              {ships.map(s => <option key={s.ship_id} value={s.ship_id}>{s.name}</option>)}
            </select>
            <select className="input w-full" value={miningForm.colony_id} onChange={e => setMiningForm(f => ({ ...f, colony_id: e.target.value }))} required>
              <option value="">Select Colony</option>
              {colonyList.map(c => <option key={c.colony_id || c.id} value={c.colony_id || c.id}>{c.name || c.colony_name}</option>)}
            </select>
            <SectorPicker
              value={miningForm.return_port_sector_id}
              onChange={val => setMiningForm(f => ({ ...f, return_port_sector_id: val }))}
              placeholder="Select return port sector..."
              hasPort={true}
            />
            <button type="submit" disabled={actionLoading === 'create-mining'} className="holo-button-orange text-sm px-4 py-2">
              {actionLoading === 'create-mining' ? 'Creating...' : 'Create Mining Run'}
            </button>
          </form>
        </div>
      )}

      {/* Active Tasks */}
      <div>
        <h2 className="text-lg font-display text-white mb-3">Active Tasks ({tasks.length})</h2>
        {tasks.length === 0 ? (
          <div className="holo-panel p-8 text-center">
            <Bot className="w-8 h-8 text-gray-600 mx-auto mb-2" />
            <p className="text-gray-500 text-sm">No automation tasks running</p>
          </div>
        ) : (
          <div className="space-y-3">
            {tasks.map(task => {
              const id = task.task_id || task.id;
              const isPaused = task.status === 'paused';
              const typeColors = { trade_route: '#00ffff', mining_run: '#ff6600' };
              const color = typeColors[task.task_type || task.type] || '#00ffff';
              return (
                <div key={id} className="holo-panel p-4 flex items-center gap-4">
                  <div className="p-2 rounded-lg" style={{ background: `${color}12` }}>
                    {task.task_type === 'mining_run' || task.type === 'mining_run'
                      ? <Gem className="w-5 h-5" style={{ color }} />
                      : <Route className="w-5 h-5" style={{ color }} />
                    }
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium text-white">{task.ship_name || 'Ship'}</p>
                      <span className="badge text-xs" style={{ background: `${color}15`, color, border: `1px solid ${color}30` }}>
                        {(task.task_type || task.type || '').replace('_', ' ')}
                      </span>
                      {isPaused && <span className="badge-orange text-xs">Paused</span>}
                    </div>
                    <p className="text-xs text-gray-500 mt-0.5">
                      Step {task.current_step || 0}/{task.total_steps || '?'} | Runs: {task.runs_completed || 0}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    {isPaused ? (
                      <button onClick={() => handleResume(id)} disabled={actionLoading === `resume-${id}`} className="btn btn-ghost text-xs p-2">
                        <Play className="w-4 h-4 text-status-success" />
                      </button>
                    ) : (
                      <button onClick={() => handlePause(id)} disabled={actionLoading === `pause-${id}`} className="btn btn-ghost text-xs p-2">
                        <Pause className="w-4 h-4 text-status-warning" />
                      </button>
                    )}
                    <button onClick={() => handleCancel(id)} disabled={actionLoading === `cancel-${id}`} className="btn btn-ghost text-xs p-2">
                      <Trash2 className="w-4 h-4 text-status-danger" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

export default AutomationPage;
