import { useState, useEffect } from 'react';
import { colonies as coloniesApi, ships } from '../../services/api';
import { Building2, Package, ArrowUp, Trash2, Users, AlertCircle, RefreshCw } from 'lucide-react';
import ColonyCard from './ColonyCard';
import ColonyDetails from './ColonyDetails';

function ColoniesPage({ user }) {
  const [userColonies, setUserColonies] = useState([]);
  const [userShips, setUserShips] = useState([]);
  const [selectedColony, setSelectedColony] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchData = async () => {
    try {
      const [coloniesRes, shipsRes] = await Promise.all([
        coloniesApi.getAll(),
        ships.getAll(),
      ]);
      // Handle different response formats
      setUserColonies(Array.isArray(coloniesRes.data) ? coloniesRes.data : (coloniesRes.data?.colonies || []));
      setUserShips(shipsRes.data.data?.ships || []);
    } catch (err) {
      setError('Failed to load colonies');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleCollect = async (colonyId, shipId) => {
    try {
      await coloniesApi.collect(colonyId, shipId);
      await fetchData();
    } catch (err) {
      setError(err.response?.data?.error || 'Collection failed');
    }
  };

  const handleUpgrade = async (colonyId) => {
    try {
      await coloniesApi.upgrade(colonyId);
      await fetchData();
    } catch (err) {
      setError(err.response?.data?.error || 'Upgrade failed');
    }
  };

  const handleAbandon = async (colonyId) => {
    if (!confirm('Are you sure you want to abandon this colony? This action cannot be undone.')) return;
    try {
      await coloniesApi.abandon(colonyId);
      setSelectedColony(null);
      await fetchData();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to abandon colony');
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
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <Building2 className="w-7 h-7 text-accent-green" />
            Colony Management
          </h1>
          <p className="text-gray-400">Manage your planetary colonies and collect resources</p>
        </div>
        <button onClick={fetchData} className="btn btn-secondary flex items-center gap-2">
          <RefreshCw className="w-4 h-4" /> Refresh
        </button>
      </div>

      {error && (
        <div className="flex items-center gap-2 p-3 rounded-lg bg-accent-red/10 border border-accent-red/30 text-accent-red">
          <AlertCircle className="w-5 h-5" />
          <span>{error}</span>
          <button onClick={() => setError('')} className="ml-auto text-sm underline">Dismiss</button>
        </div>
      )}

      {/* Stats Overview */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="card flex items-center gap-4">
          <div className="p-3 rounded-lg bg-accent-green/10 border border-accent-green/30 text-accent-green">
            <Building2 className="w-6 h-6" />
          </div>
          <div>
            <p className="stat-value">{userColonies.length}</p>
            <p className="stat-label">Total Colonies</p>
          </div>
        </div>
        <div className="card flex items-center gap-4">
          <div className="p-3 rounded-lg bg-accent-cyan/10 border border-accent-cyan/30 text-accent-cyan">
            <Users className="w-6 h-6" />
          </div>
          <div>
            <p className="stat-value">{userColonies.reduce((sum, c) => sum + (c.population || 0), 0).toLocaleString()}</p>
            <p className="stat-label">Total Population</p>
          </div>
        </div>
        <div className="card flex items-center gap-4">
          <div className="p-3 rounded-lg bg-accent-purple/10 border border-accent-purple/30 text-accent-purple">
            <ArrowUp className="w-6 h-6" />
          </div>
          <div>
            <p className="stat-value">{Math.round(userColonies.reduce((sum, c) => sum + (c.infrastructure_level || 1), 0) / Math.max(userColonies.length, 1) * 10) / 10}</p>
            <p className="stat-label">Avg Infrastructure</p>
          </div>
        </div>
      </div>

      {/* Colonies Grid */}
      {userColonies.length === 0 ? (
        <div className="card text-center py-12">
          <Building2 className="w-16 h-16 text-gray-600 mx-auto mb-4" />
          <h3 className="text-xl font-semibold text-white mb-2">No Colonies Yet</h3>
          <p className="text-gray-400 max-w-md mx-auto">
            Explore planets and establish colonies to start gathering resources. 
            You'll need a Colony Ship to colonize a planet.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {userColonies.map(colony => (
            <ColonyCard 
              key={colony.colony_id} 
              colony={colony} 
              onClick={() => setSelectedColony(colony)}
            />
          ))}
        </div>
      )}

      {/* Colony Details Modal */}
      {selectedColony && (
        <ColonyDetails
          colony={selectedColony}
          ships={userShips}
          onClose={() => setSelectedColony(null)}
          onCollect={handleCollect}
          onUpgrade={handleUpgrade}
          onAbandon={handleAbandon}
        />
      )}
    </div>
  );
}

export default ColoniesPage;

