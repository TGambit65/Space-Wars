import { useState, useEffect } from 'react';
import { outposts } from '../../services/api';
import {
  Radio, ArrowUp, Trash2, AlertCircle, RefreshCw, PlusCircle,
  MapPin, Shield, Zap, Package, X
} from 'lucide-react';
import SectorPicker from '../common/SectorPicker';

const OUTPOST_TYPES = [
  { value: 'sensor', label: 'Sensor Array', description: 'Extended detection range in sector' },
  { value: 'defense', label: 'Defense Platform', description: 'Automated weapons to protect sector' },
  { value: 'mining', label: 'Mining Outpost', description: 'Passive resource extraction' },
  { value: 'relay', label: 'Comm Relay', description: 'Extends communication range' },
  { value: 'depot', label: 'Supply Depot', description: 'Remote cargo storage and refueling' },
];

const OutpostsPage = ({ user }) => {
  const [userOutposts, setUserOutposts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState(null);
  const [toast, setToast] = useState(null);

  // Build form state
  const [showBuildForm, setShowBuildForm] = useState(false);
  const [buildSectorId, setBuildSectorId] = useState('');
  const [buildType, setBuildType] = useState('sensor');
  const [buildName, setBuildName] = useState('');
  const [buildLoading, setBuildLoading] = useState(false);

  const fetchOutposts = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await outposts.getAll();
      setUserOutposts(res.data.data?.outposts || res.data.outposts || []);
    } catch (err) {
      setError('Failed to load outposts.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOutposts();
  }, []);

  const handleBuild = async () => {
    if (!buildSectorId) {
      setError('Sector ID is required.');
      return;
    }
    try {
      setBuildLoading(true);
      setError(null);
      await outposts.build({
        sector_id: parseInt(buildSectorId, 10),
        type: buildType,
        name: buildName.trim() || undefined,
      });
      setShowBuildForm(false);
      setBuildSectorId('');
      setBuildType('sensor');
      setBuildName('');
      setToast({ message: 'Outpost constructed successfully.', type: 'success' });
      setTimeout(() => setToast(null), 4000);
      await fetchOutposts();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to build outpost.');
    } finally {
      setBuildLoading(false);
    }
  };

  const handleUpgrade = async (outpostId) => {
    try {
      setActionLoading(true);
      setError(null);
      await outposts.upgrade(outpostId);
      setToast({ message: 'Outpost upgraded.', type: 'success' });
      setTimeout(() => setToast(null), 4000);
      await fetchOutposts();
    } catch (err) {
      setError(err.response?.data?.error || 'Upgrade failed.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleDestroy = async (outpostId) => {
    if (!confirm('Are you sure you want to destroy this outpost? This cannot be undone.')) return;
    try {
      setActionLoading(true);
      setError(null);
      await outposts.destroy(outpostId);
      setToast({ message: 'Outpost destroyed.', type: 'success' });
      setTimeout(() => setToast(null), 4000);
      await fetchOutposts();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to destroy outpost.');
    } finally {
      setActionLoading(false);
    }
  };

  const getTypeIcon = (type) => {
    switch (type) {
      case 'sensor': return <Radio className="w-5 h-5 text-accent-cyan" />;
      case 'defense': return <Shield className="w-5 h-5 text-accent-red" />;
      case 'mining': return <Package className="w-5 h-5 text-accent-orange" />;
      case 'relay': return <Zap className="w-5 h-5 text-accent-purple" />;
      case 'depot': return <Package className="w-5 h-5 text-accent-green" />;
      default: return <Radio className="w-5 h-5 text-gray-500" />;
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-accent-cyan"></div>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <Radio className="w-7 h-7 text-accent-cyan" />
            Outpost Management
          </h1>
          <p className="text-gray-400">Build and manage your deep-space outposts</p>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={fetchOutposts} className="holo-button" disabled={loading}>
            <RefreshCw className="w-4 h-4" /> Refresh
          </button>
          <button
            onClick={() => setShowBuildForm(!showBuildForm)}
            className="holo-button-orange"
          >
            <PlusCircle className="w-4 h-4" />
            {showBuildForm ? 'Cancel' : 'Build New'}
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

      {/* Build New Outpost Form */}
      {showBuildForm && (
        <div className="holo-panel p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              <PlusCircle className="w-5 h-5 text-accent-orange" /> Construct New Outpost
            </h2>
            <button onClick={() => setShowBuildForm(false)} className="text-gray-500 hover:text-white">
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="text-xs text-gray-400 block mb-1">Sector</label>
              <SectorPicker
                value={buildSectorId}
                onChange={setBuildSectorId}
                placeholder="Select sector..."
              />
            </div>
            <div>
              <label className="text-xs text-gray-400 block mb-1">Outpost Type</label>
              <select
                value={buildType}
                onChange={(e) => setBuildType(e.target.value)}
                className="w-full bg-space-900 border border-space-600 text-white rounded px-3 py-2 text-sm focus:border-accent-cyan outline-none"
              >
                {OUTPOST_TYPES.map(t => (
                  <option key={t.value} value={t.value}>{t.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs text-gray-400 block mb-1">Name (optional)</label>
              <input
                type="text"
                value={buildName}
                onChange={(e) => setBuildName(e.target.value)}
                placeholder="Outpost name..."
                className="w-full bg-space-900 border border-space-600 text-white rounded px-3 py-2 text-sm focus:border-accent-cyan outline-none"
              />
            </div>
          </div>

          {/* Type description */}
          <div className="text-sm text-gray-400">
            {OUTPOST_TYPES.find(t => t.value === buildType)?.description}
          </div>

          <div className="flex justify-end">
            <button
              onClick={handleBuild}
              disabled={buildLoading || !buildSectorId}
              className="holo-button-orange disabled:opacity-50"
            >
              <PlusCircle className="w-4 h-4" />
              {buildLoading ? 'Constructing...' : 'Build Outpost'}
            </button>
          </div>
        </div>
      )}

      {/* Stats Overview */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="card flex items-center gap-4">
          <div className="p-3 rounded-lg bg-accent-cyan/10 border border-accent-cyan/30 text-accent-cyan">
            <Radio className="w-6 h-6" />
          </div>
          <div>
            <p className="stat-value">{userOutposts.length}</p>
            <p className="stat-label">Total Outposts</p>
          </div>
        </div>
        <div className="card flex items-center gap-4">
          <div className="p-3 rounded-lg bg-accent-orange/10 border border-accent-orange/30 text-accent-orange">
            <ArrowUp className="w-6 h-6" />
          </div>
          <div>
            <p className="stat-value">
              {userOutposts.length > 0
                ? (userOutposts.reduce((sum, o) => sum + (o.level || 1), 0) / userOutposts.length).toFixed(1)
                : 0}
            </p>
            <p className="stat-label">Avg Level</p>
          </div>
        </div>
        <div className="card flex items-center gap-4">
          <div className="p-3 rounded-lg bg-accent-purple/10 border border-accent-purple/30 text-accent-purple">
            <MapPin className="w-6 h-6" />
          </div>
          <div>
            <p className="stat-value">
              {new Set(userOutposts.map(o => o.sector_id)).size}
            </p>
            <p className="stat-label">Sectors Covered</p>
          </div>
        </div>
      </div>

      {/* Outposts List */}
      {userOutposts.length === 0 ? (
        <div className="holo-panel text-center py-12">
          <Radio className="w-16 h-16 text-gray-600 mx-auto mb-4" />
          <h3 className="text-xl font-semibold text-white mb-2">No Outposts Deployed</h3>
          <p className="text-gray-400 max-w-md mx-auto">
            Build outposts to extend your reach across the galaxy. Sensor arrays, defense platforms,
            and mining stations help you control territory.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {userOutposts.map(outpost => (
            <div key={outpost.id || outpost.outpost_id} className="holo-panel p-4 flex items-center gap-4">
              {/* Type Icon */}
              <div className="flex-shrink-0 p-3 bg-space-800 rounded-lg">
                {getTypeIcon(outpost.type)}
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <h3 className="text-white font-bold truncate">
                    {outpost.name || `${(outpost.type || 'unknown').charAt(0).toUpperCase() + (outpost.type || 'unknown').slice(1)} Outpost`}
                  </h3>
                  <span className="text-[10px] uppercase px-1.5 py-0.5 rounded bg-space-700 text-gray-400">
                    {outpost.type}
                  </span>
                </div>
                <div className="text-sm text-gray-400 flex items-center gap-3 mt-0.5">
                  <span className="flex items-center gap-1">
                    <MapPin className="w-3 h-3" /> Sector {outpost.sector_id}
                  </span>
                  <span className="flex items-center gap-1">
                    <ArrowUp className="w-3 h-3" /> Level {outpost.level || 1}
                  </span>
                </div>
              </div>

              {/* Actions */}
              <div className="flex items-center gap-2 flex-shrink-0">
                <button
                  onClick={() => handleUpgrade(outpost.id || outpost.outpost_id)}
                  disabled={actionLoading}
                  className="holo-button text-xs px-3 py-1.5 disabled:opacity-50"
                  title="Upgrade outpost"
                >
                  <ArrowUp className="w-3.5 h-3.5" /> Upgrade
                </button>
                <button
                  onClick={() => handleDestroy(outpost.id || outpost.outpost_id)}
                  disabled={actionLoading}
                  className="holo-button-danger text-xs px-3 py-1.5 disabled:opacity-50"
                  title="Destroy outpost"
                >
                  <Trash2 className="w-3.5 h-3.5" /> Destroy
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default OutpostsPage;
