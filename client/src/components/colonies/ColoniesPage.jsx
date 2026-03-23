import { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { colonies as coloniesApi, ships } from '../../services/api';
import { Building2, Package, ArrowUp, Trash2, Users, AlertCircle, RefreshCw, Globe, Rocket, Shield, Map, Trophy, Download, TrendingUp, Swords, Orbit } from 'lucide-react';
import ColonyCard from './ColonyCard';
import ColonyDetails from './ColonyDetails';

function ColoniesPage({ user }) {
  const location = useLocation();
  const navigate = useNavigate();
  const [colonizePlanet, setColonizePlanet] = useState(location.state?.colonizePlanet || null);
  const [colonizeShipId, setColonizeShipId] = useState('');
  const [colonizeName, setColonizeName] = useState('');
  const [colonizeLoading, setColonizeLoading] = useState(false);
  const [userColonies, setUserColonies] = useState([]);
  const [userShips, setUserShips] = useState([]);
  const [selectedColony, setSelectedColony] = useState(null);
  const [raids, setRaids] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [collectAllLoading, setCollectAllLoading] = useState(false);
  const [collectAllShip, setCollectAllShip] = useState('');

  const fetchData = async () => {
    try {
      const [coloniesRes, shipsRes, raidsRes] = await Promise.all([
        coloniesApi.getAll(),
        ships.getAll(),
        coloniesApi.getRaids().catch(() => ({ data: { data: [] } })),
      ]);
      // Handle different response formats
      setUserColonies(Array.isArray(coloniesRes.data) ? coloniesRes.data : (coloniesRes.data?.colonies || []));
      setUserShips(shipsRes.data.data?.ships || []);
      setRaids(raidsRes.data?.data || raidsRes.data || []);
    } catch (err) {
      setError('Failed to load colonies');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // P5 Item 9: Collect All
  const handleCollectAll = async () => {
    if (!collectAllShip || userColonies.length === 0) return;
    setCollectAllLoading(true);
    setError('');
    let collected = 0;
    let failed = 0;
    for (const colony of userColonies) {
      try {
        await coloniesApi.collect(colony.colony_id, collectAllShip);
        collected++;
      } catch {
        failed++;
      }
    }
    setCollectAllLoading(false);
    await fetchData();
    if (failed > 0) {
      setError(`Collected from ${collected} colonies, ${failed} failed (ship may not be in range)`);
    }
  };

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

  const handleColonize = async () => {
    if (!colonizeShipId || !colonizePlanet) return;
    setColonizeLoading(true);
    setError('');
    try {
      await coloniesApi.colonize(colonizePlanet.planet_id, colonizeShipId, colonizeName || undefined);
      setColonizePlanet(null);
      setColonizeShipId('');
      setColonizeName('');
      // Clear navigation state so refresh doesn't re-show prompt
      window.history.replaceState({}, '');
      await fetchData();
    } catch (err) {
      setError(err.response?.data?.error || err.response?.data?.message || 'Colonization failed');
    } finally {
      setColonizeLoading(false);
    }
  };

  const colonyShips = userShips.filter(s =>
    s.ship_type === 'Colony Ship' || s.ship_type === 'Insta Colony Ship'
  );

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
        <div className="flex items-center gap-2">
          {/* P5 Item 9: Collect All */}
          {userColonies.length > 1 && (
            <div className="flex items-center gap-1">
              <select value={collectAllShip} onChange={e => setCollectAllShip(e.target.value)}
                className="bg-space-800 border border-space-600 text-white rounded px-2 py-1.5 text-xs">
                <option value="">Ship...</option>
                {userShips.map(s => <option key={s.ship_id} value={s.ship_id}>{s.name}</option>)}
              </select>
              <button onClick={handleCollectAll} disabled={!collectAllShip || collectAllLoading}
                className="btn btn-primary flex items-center gap-1.5 text-xs disabled:opacity-50">
                <Download className="w-3.5 h-3.5" /> {collectAllLoading ? 'Collecting...' : 'Collect All'}
              </button>
            </div>
          )}
          <button onClick={() => navigate('/colony-leaderboard')} className="btn btn-secondary flex items-center gap-2">
            <Trophy className="w-4 h-4" /> Leaderboard
          </button>
          <button onClick={fetchData} className="btn btn-secondary flex items-center gap-2">
            <RefreshCw className="w-4 h-4" /> Refresh
          </button>
        </div>
      </div>

      {error && (
        <div className="flex items-center gap-2 p-3 rounded-lg bg-accent-red/10 border border-accent-red/30 text-accent-red">
          <AlertCircle className="w-5 h-5" />
          <span>{error}</span>
          <button onClick={() => setError('')} className="ml-auto text-sm underline">Dismiss</button>
        </div>
      )}

      {/* Colonization Prompt */}
      {colonizePlanet && (
        <div className="card p-6 space-y-4" style={{ borderColor: 'rgba(76, 175, 80, 0.3)', background: 'rgba(76, 175, 80, 0.05)' }}>
          <div className="flex items-center gap-3">
            <Globe className="w-6 h-6 text-accent-green" />
            <div>
              <h2 className="text-lg font-bold text-white">Colonize {colonizePlanet.name}</h2>
              <p className="text-sm text-gray-400">
                {colonizePlanet.planet_type && <span className="capitalize">{colonizePlanet.planet_type}</span>}
                {colonizePlanet.habitability != null && <span> — Habitability: {colonizePlanet.habitability}%</span>}
              </p>
            </div>
            <button onClick={() => { setColonizePlanet(null); window.history.replaceState({}, ''); }}
              className="ml-auto text-gray-500 hover:text-white text-sm">Cancel</button>
          </div>
          <div className="flex flex-wrap items-end gap-4">
            <div className="flex-1 min-w-[180px]">
              <label className="text-xs text-gray-400 block mb-1">Colony Ship</label>
              <select value={colonizeShipId} onChange={e => setColonizeShipId(e.target.value)}
                className="w-full bg-space-800 border border-space-600 text-white rounded px-3 py-2 text-sm">
                <option value="">Select a colony ship...</option>
                {colonyShips.map(s => (
                  <option key={s.ship_id} value={s.ship_id}>{s.name} ({s.ship_type})</option>
                ))}
              </select>
              {colonyShips.length === 0 && (
                <p className="text-xs text-accent-red mt-1">No colony ships available. Build or purchase one first.</p>
              )}
            </div>
            <div className="flex-1 min-w-[140px]">
              <label className="text-xs text-gray-400 block mb-1">Colony Name (optional)</label>
              <input value={colonizeName} onChange={e => setColonizeName(e.target.value)}
                placeholder={colonizePlanet.name + ' Colony'}
                className="w-full bg-space-800 border border-space-600 text-white rounded px-3 py-2 text-sm" />
            </div>
            <button onClick={handleColonize} disabled={!colonizeShipId || colonizeLoading}
              className="btn btn-primary flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              style={{ background: '#4caf50', borderColor: '#4caf50' }}>
              <Rocket className="w-4 h-4" />
              {colonizeLoading ? 'Colonizing...' : `Colonize ${colonizePlanet.name}`}
            </button>
          </div>
        </div>
      )}

      {/* Stats Overview */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
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
            {/* P5 Item 10: Growth projection */}
            {userColonies.length > 0 && (() => {
              const totalGrowth = userColonies.reduce((sum, c) => {
                const growth = (c.population || 0) * ((c.growth_rate || 0.02) * (c.habitability || 50) / 100);
                return sum + growth;
              }, 0);
              return totalGrowth > 0 ? (
                <p className="text-[10px] text-accent-green flex items-center gap-0.5 mt-0.5">
                  <TrendingUp className="w-2.5 h-2.5" /> +{Math.round(totalGrowth).toLocaleString()}/tick
                </p>
              ) : null;
            })()}
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
        <div className="card flex items-center gap-4">
          <div className="p-3 rounded-lg bg-accent-orange/10 border border-accent-orange/30 text-accent-orange">
            <Shield className="w-6 h-6" />
          </div>
          <div>
            <p className="stat-value">{raids.length}</p>
            <p className="stat-label">Recent Raids</p>
          </div>
        </div>
      </div>

      {/* P5 Item 11: Raid alerts with quick-link */}
      {raids.filter(r => r.raid_damage > 0).length > 0 && (
        <div className="p-3 rounded-lg flex items-center gap-3" style={{
          background: 'rgba(244, 67, 54, 0.08)',
          border: '1px solid rgba(244, 67, 54, 0.25)',
        }}>
          <Swords className="w-5 h-5 text-accent-red flex-shrink-0 animate-pulse" />
          <div className="flex-1">
            <p className="text-sm font-semibold text-accent-red">Colony Under Attack!</p>
            <p className="text-xs text-gray-400">
              {raids.filter(r => r.raid_damage > 0).map(r => r.colony_name).join(', ')} recently raided
            </p>
          </div>
          <button onClick={() => {
            const damaged = userColonies.find(c => raids.some(r => r.colony_id === c.colony_id && r.raid_damage > 0));
            if (damaged) setSelectedColony(damaged);
          }} className="holo-button-danger text-xs px-3 py-1.5">
            Respond
          </button>
        </div>
      )}

      {raids.length > 0 && (
        <div className="card">
          <h2 className="text-lg font-bold text-white flex items-center gap-2 mb-3">
            <Shield className="w-5 h-5 text-accent-orange" /> Recent Raid Activity
          </h2>
          <div className="space-y-2">
            {raids.slice(0, 5).map(raid => (
              <div key={raid.colony_id} className="flex items-center justify-between p-2 bg-space-800 rounded border border-space-700">
                <div>
                  <span className="text-white text-sm font-medium">{raid.colony_name}</span>
                  <span className="text-gray-500 text-xs ml-2">Defense: {raid.defense_rating}</span>
                </div>
                <div className="text-right">
                  <span className="text-accent-orange text-xs">{raid.raid_damage > 0 ? `${raid.raid_damage} damage` : 'No damage'}</span>
                  {raid.last_raid && <span className="text-gray-600 text-xs ml-2">{new Date(raid.last_raid).toLocaleDateString()}</span>}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

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
            <div key={colony.colony_id} className="relative">
              <ColonyCard
                colony={colony}
                onClick={() => setSelectedColony(colony)}
              />
              <div className="absolute top-2 right-2 flex items-center gap-1">
                <button
                  onClick={(e) => { e.stopPropagation(); navigate(`/planet/${colony.planet_id || colony.planet?.planet_id}`); }}
                  className="bg-space-800/90 border border-accent-cyan/30 rounded px-2 py-1 text-xs text-accent-cyan hover:bg-accent-cyan/10 flex items-center gap-1 transition-colors"
                  title="View Planet Orbit"
                >
                  <Orbit className="w-3 h-3" /> Planet
                </button>
                <button
                  onClick={(e) => { e.stopPropagation(); navigate(`/colony/${colony.colony_id}/surface`); }}
                  className="bg-space-800/90 border border-accent-cyan/30 rounded px-2 py-1 text-xs text-accent-cyan hover:bg-accent-cyan/10 flex items-center gap-1 transition-colors"
                  title="View Surface"
                >
                  <Map className="w-3 h-3" /> Surface
                </button>
              </div>
            </div>
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

