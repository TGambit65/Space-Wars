import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { crafting, ships as shipsApi, trade } from '../../services/api';
import { Hammer, Clock, Package, X, CheckCircle } from 'lucide-react';
import WikiLink from '../common/WikiLink';
import LoadingScreen from '../common/LoadingScreen';

function CraftingPage({ user }) {
  const [blueprints, setBlueprints] = useState([]);
  const [jobs, setJobs] = useState([]);
  const [ships, setShips] = useState([]);
  const [selectedShip, setSelectedShip] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [actionLoading, setActionLoading] = useState(null);
  const [cargo, setCargo] = useState([]);

  const fetchData = useCallback(async () => {
    try {
      const [bpRes, jobsRes, shipsRes] = await Promise.all([
        crafting.getBlueprints(),
        crafting.getJobs(),
        shipsApi.getAll(),
      ]);
      const bpRaw = bpRes.data.data;
      setBlueprints(Array.isArray(bpRaw) ? bpRaw : bpRaw?.blueprints || []);
      const jobsRaw = jobsRes.data.data;
      setJobs(Array.isArray(jobsRaw) ? jobsRaw : jobsRaw?.jobs || []);
      const shipList = shipsRes.data.data?.ships || shipsRes.data || [];
      setShips(shipList);
      if (!selectedShip && shipList.length > 0) {
        const activeId = shipsRes.data.data?.active_ship_id;
        const active = (activeId && shipList.find(s => s.ship_id === activeId)) || shipList[0];
        setSelectedShip(active.ship_id);
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load crafting data');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  useEffect(() => {
    if (!selectedShip) { setCargo([]); return; }
    trade.getCargo(selectedShip).then(res => {
      setCargo(res.data.data?.items || []);
    }).catch(() => setCargo([]));
  }, [selectedShip]);

  const handleCraft = async (blueprintId) => {
    if (!selectedShip) return setError('Select a ship first');
    setActionLoading(blueprintId);
    try {
      await crafting.start({ blueprint_id: blueprintId, ship_id: selectedShip });
      await fetchData();
      if (selectedShip) {
        trade.getCargo(selectedShip).then(res => setCargo(res.data.data?.items || [])).catch(() => {});
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Crafting failed');
    } finally {
      setActionLoading(null);
    }
  };

  const handleCancel = async (jobId) => {
    setActionLoading(`cancel-${jobId}`);
    try {
      await crafting.cancel(jobId);
      await fetchData();
    } catch (err) {
      setError(err.response?.data?.message || 'Cancel failed');
    } finally {
      setActionLoading(null);
    }
  };

  const handleComplete = async (jobId) => {
    setActionLoading(`complete-${jobId}`);
    try {
      await crafting.complete(jobId);
      await fetchData();
    } catch (err) {
      setError(err.response?.data?.message || 'Collection failed');
    } finally {
      setActionLoading(null);
    }
  };

  const handleCheckJobs = async () => {
    try {
      await crafting.check();
      await fetchData();
    } catch (err) { /* ignore */ }
  };

  if (loading) return <LoadingScreen variant="crafting" />;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Crafting</h1>
          <p className="text-gray-500 text-sm mt-1">Blueprints and manufacturing <WikiLink term="crafting" className="text-[11px] ml-2">Guide</WikiLink></p>
        </div>
        <div className="flex items-center gap-3">
          <select value={selectedShip} onChange={e => setSelectedShip(e.target.value)} className="input text-sm">
            <option value="">Select Ship</option>
            {ships.map(s => <option key={s.ship_id} value={s.ship_id}>{s.name}</option>)}
          </select>
          <button onClick={handleCheckJobs} className="btn btn-ghost text-sm">
            <Clock className="w-4 h-4 mr-1 inline" /> Check Jobs
          </button>
        </div>
      </div>

      {error && (
        <div className="p-3 rounded-lg text-sm" style={{ background: 'rgba(244,67,54,0.1)', border: '1px solid rgba(244,67,54,0.3)', color: '#f44336' }}>
          {error}
          <button onClick={() => setError(null)} className="ml-2 underline">dismiss</button>
        </div>
      )}

      {/* Active Jobs */}
      {jobs.length > 0 && (
        <div>
          <h2 className="text-lg font-display text-white mb-3">Active Jobs</h2>
          <div className="space-y-3">
            {jobs.map(job => (
              <JobCard key={job.job_id || job.id} job={job} onCancel={handleCancel} onComplete={handleComplete} actionLoading={actionLoading} />
            ))}
          </div>
        </div>
      )}

      {/* Blueprints */}
      <div>
        <h2 className="text-lg font-display text-white mb-3">Blueprints</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {(Array.isArray(blueprints) ? blueprints : []).map(bp => (
            <BlueprintCard
              key={bp.blueprint_id || bp.id || bp.name}
              blueprint={bp}
              cargo={cargo}
              onCraft={() => handleCraft(bp.blueprint_id || bp.id)}
              loading={actionLoading === (bp.blueprint_id || bp.id)}
            />
          ))}
          {blueprints.length === 0 && (
            <div className="col-span-full text-center py-8">
              <Package className="w-10 h-10 text-gray-600 mx-auto mb-2" />
              <p className="text-gray-400 text-sm mb-1">No blueprints available</p>
              <p className="text-gray-600 text-xs">Research crafting skills in <Link to="/progression" className="text-accent-cyan hover:underline">Progression</Link> to unlock blueprints</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function useCountdown(endTime) {
  const [remaining, setRemaining] = useState(() => Math.max(0, (endTime || 0) - Date.now()));
  useEffect(() => {
    if (!endTime) return;
    const tick = () => setRemaining(Math.max(0, endTime - Date.now()));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [endTime]);
  return remaining;
}

function JobCard({ job, onCancel, onComplete, actionLoading }) {
  const isComplete = job.status === 'completed' || job.is_complete;
  const progress = job.progress || 0;
  const id = job.job_id || job.id;

  const startedAt = new Date(job.started_at || job.created_at || 0).getTime();
  const duration = (job.crafting_time || job.duration || 0) * 1000; // seconds to ms
  const endTime = startedAt && duration ? startedAt + duration : 0;
  const remaining = useCountdown(isComplete ? 0 : endTime);

  return (
    <div className="holo-panel p-4 flex items-center gap-4">
      <div className="p-2 rounded-lg" style={{ background: isComplete ? 'rgba(76,175,80,0.1)' : 'rgba(255,193,7,0.1)' }}>
        {isComplete ? <CheckCircle className="w-5 h-5 text-status-success" /> : <Clock className="w-5 h-5 text-status-warning" />}
      </div>
      <div className="flex-1">
        <p className="text-sm font-medium text-white">{job.blueprint_name || job.name || 'Crafting Job'}</p>
        <div className="flex items-center gap-2">
          <p className="text-xs text-gray-500">{job.ship_name || 'Ship'}</p>
          {!isComplete && remaining > 0 && (
            <span className="text-xs text-yellow-400 font-mono">~{formatDuration(Math.ceil(remaining / 1000))} left</span>
          )}
          {!isComplete && remaining === 0 && endTime > 0 && (
            <span className="text-xs text-gray-500">Processing...</span>
          )}
        </div>
        {!isComplete && (
          <div className="progress-bar mt-2">
            <div className="progress-fill" style={{ width: `${progress}%`, background: '#ffc107', boxShadow: '0 0 8px rgba(255,193,7,0.3)' }} />
          </div>
        )}
      </div>
      <div className="flex gap-2">
        {isComplete ? (
          <button onClick={() => onComplete(id)} disabled={actionLoading === `complete-${id}`} className="holo-button text-xs">
            Collect
          </button>
        ) : (
          <button onClick={() => onCancel(id)} disabled={actionLoading === `cancel-${id}`} className="holo-button-danger text-xs px-3 py-1">
            <X className="w-3 h-3" />
          </button>
        )}
      </div>
    </div>
  );
}

function formatDuration(seconds) {
  if (!seconds) return '';
  if (seconds < 60) return `${seconds}s`;
  if (seconds < 3600) {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return s > 0 ? `${m}m ${s}s` : `${m}m`;
  }
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

function BlueprintCard({ blueprint, cargo, onCraft, loading }) {
  const ingredients = blueprint.ingredients || blueprint.required_materials || [];
  const categoryColors = {
    weapon: '#f44336', shield: '#2196f3', engine: '#ff6600', hull: '#4caf50', general: '#00ffff',
  };
  const cat = blueprint.category || 'general';

  const getOwned = (name) => {
    const item = cargo.find(c =>
      (c.name || '').toLowerCase() === (name || '').toLowerCase() ||
      (c.commodity_name || '').toLowerCase() === (name || '').toLowerCase()
    );
    return item ? item.quantity : 0;
  };

  const canCraftAll = ingredients.length === 0 || ingredients.every(ing => {
    const needed = ing.quantity || ing.amount || 0;
    return getOwned(ing.name || ing.commodity) >= needed;
  });

  return (
    <div className="holo-panel p-4">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-sm font-display text-white">{blueprint.name}</h3>
        <span className="badge text-xs" style={{
          background: `${categoryColors[cat] || categoryColors.general}15`,
          color: categoryColors[cat] || categoryColors.general,
          border: `1px solid ${categoryColors[cat] || categoryColors.general}30`,
        }}>
          {cat}
        </span>
      </div>
      {blueprint.description && <p className="text-xs text-gray-500 mb-3">{blueprint.description}</p>}
      {ingredients.length > 0 && (
        <div className="mb-3">
          <p className="text-xs text-gray-500 mb-1">Ingredients:</p>
          <div className="flex flex-wrap gap-1">
            {ingredients.map((ing, i) => {
              const needed = ing.quantity || ing.amount || 0;
              const owned = getOwned(ing.name || ing.commodity);
              const hasEnough = owned >= needed;
              return (
                <span key={i} className="text-xs px-2 py-0.5 rounded flex items-center gap-1" style={{
                  background: hasEnough ? 'rgba(76,175,80,0.08)' : 'rgba(244,67,54,0.08)',
                  border: `1px solid ${hasEnough ? 'rgba(76,175,80,0.25)' : 'rgba(244,67,54,0.25)'}`,
                  color: hasEnough ? '#4caf50' : '#f44336',
                }}>
                  {ing.name || ing.commodity}: {owned}/{needed}
                </span>
              );
            })}
          </div>
        </div>
      )}
      <div className="flex items-center justify-between mt-3 pt-3" style={{ borderTop: '1px solid rgba(0,255,255,0.08)' }}>
        <div className="text-xs text-gray-400">
          {blueprint.credit_cost ? `${blueprint.credit_cost.toLocaleString()} cr` : ''}
          {blueprint.crafting_time ? ` | ${formatDuration(blueprint.crafting_time)}` : ''}
        </div>
        <button onClick={onCraft} disabled={loading || !canCraftAll} className={`holo-button text-xs ${!canCraftAll ? 'opacity-50 cursor-not-allowed' : ''}`}>
          {loading ? '...' : canCraftAll ? 'Craft' : 'Missing'}
        </button>
      </div>
    </div>
  );
}

export default CraftingPage;
