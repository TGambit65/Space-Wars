import { useState, useEffect } from 'react';
import { admin } from '../../services/api';
import { Settings, AlertTriangle, RefreshCw, Database, Globe, Cpu, Users, UserCog, Search, ChevronLeft, ChevronRight } from 'lucide-react';
import AIConfigTab from './AIConfigTab';
import NPCManagementTab from './NPCManagementTab';

const SYSTEM_COUNTS = [50, 100, 200, 400];
const GALAXY_SHAPES = ['spiral', 'elliptical', 'ring'];

const TABS = [
  { key: 'universe', label: 'Universe', icon: Globe },
  { key: 'ai', label: 'AI Config', icon: Cpu },
  { key: 'npcs', label: 'NPCs', icon: Users },
  { key: 'users', label: 'Users', icon: UserCog },
];

const TIER_OPTIONS = ['free', 'premium', 'elite'];
const TIER_COLORS = {
  free: 'text-gray-400',
  premium: 'text-accent-cyan',
  elite: 'text-accent-purple',
};

const AdminPage = ({ user }) => {
  const [activeTab, setActiveTab] = useState('universe');

  return (
    <div className="p-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <Settings className="w-8 h-8 text-accent-cyan" />
        <div>
          <h1 className="text-3xl font-bold text-white">Administration</h1>
          <p className="text-gray-400 text-sm">Manage universe, AI, NPCs, and users</p>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="flex gap-1 mb-6 border-b border-space-700 pb-0">
        {TABS.map(tab => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.key;
          return (
            <button key={tab.key} onClick={() => setActiveTab(tab.key)}
              className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium transition-colors border-b-2 -mb-px ${
                isActive
                  ? 'border-accent-cyan text-accent-cyan'
                  : 'border-transparent text-gray-400 hover:text-gray-200 hover:border-space-500'
              }`}>
              <Icon className="w-4 h-4" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Tab Content */}
      {activeTab === 'universe' && <UniverseTab />}
      {activeTab === 'ai' && <AIConfigTab />}
      {activeTab === 'npcs' && <NPCManagementTab />}
      {activeTab === 'users' && <UsersTab />}
    </div>
  );
};

// ─── Universe Tab (extracted from original AdminPage) ────────────────────

const UniverseTab = () => {
  const [config, setConfig] = useState(null);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [numSystems, setNumSystems] = useState(200);
  const [galaxyShape, setGalaxyShape] = useState('spiral');
  const [seed, setSeed] = useState('');

  useEffect(() => { fetchConfig(); }, []);

  const fetchConfig = async () => {
    try {
      setLoading(true);
      const res = await admin.getConfig();
      const data = res.data.data;
      setConfig(data.config);
      setStats(data.stats);
      setNumSystems(data.config.initialSectors);
      setGalaxyShape(data.config.galaxyShape);
      setSeed(String(data.config.seed));
    } catch (err) {
      setError('Failed to load configuration.');
    } finally {
      setLoading(false);
    }
  };

  const handleGenerate = async () => {
    try {
      setGenerating(true);
      setError(null);
      setSuccess(null);
      const res = await admin.generateUniverse({
        num_systems: numSystems,
        galaxy_shape: galaxyShape,
        seed: seed ? parseInt(seed) : undefined
      });
      setSuccess(`Universe regenerated: ${res.data.data.sectors} systems, ${res.data.data.connections} hyperlanes`);
      setShowConfirm(false);
      fetchConfig();
    } catch (err) {
      setError(err.response?.data?.message || 'Generation failed');
    } finally {
      setGenerating(false);
    }
  };

  if (loading) {
    return (
      <div className="p-8 text-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-accent-cyan mx-auto mb-4"></div>
        <div className="text-gray-400 text-sm">Loading universe data...</div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {error && (
        <div className="bg-accent-red/10 border border-accent-red/30 rounded-lg p-3 flex items-center gap-2">
          <AlertTriangle className="w-5 h-5 text-accent-red flex-shrink-0" />
          <span className="text-accent-red text-sm">{error}</span>
        </div>
      )}
      {success && (
        <div className="bg-green-500/10 border border-green-500/30 rounded-lg p-3">
          <span className="text-green-400 text-sm">{success}</span>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Current Stats */}
        <div className="card p-4">
          <h2 className="card-header flex items-center gap-2">
            <Database className="w-4 h-4" /> Current Universe Stats
          </h2>
          {stats && (
            <div className="grid grid-cols-2 gap-3 mt-4">
              <div className="bg-space-800 rounded p-3 text-center">
                <div className="text-2xl font-bold text-accent-cyan">{stats.sectors}</div>
                <div className="text-xs text-gray-400">Systems</div>
              </div>
              <div className="bg-space-800 rounded p-3 text-center">
                <div className="text-2xl font-bold text-accent-purple">{stats.connections}</div>
                <div className="text-xs text-gray-400">Hyperlanes</div>
              </div>
              <div className="bg-space-800 rounded p-3 text-center">
                <div className="text-2xl font-bold text-accent-green">{stats.planets}</div>
                <div className="text-xs text-gray-400">Planets</div>
              </div>
              <div className="bg-space-800 rounded p-3 text-center">
                <div className="text-2xl font-bold text-accent-orange">{stats.ports}</div>
                <div className="text-xs text-gray-400">Ports</div>
              </div>
              <div className="bg-space-800 rounded p-3 text-center">
                <div className="text-2xl font-bold text-accent-red">{stats.npcs}</div>
                <div className="text-xs text-gray-400">NPCs</div>
              </div>
              <div className="bg-space-800 rounded p-3 text-center">
                <div className="text-2xl font-bold text-white">{stats.crew}</div>
                <div className="text-xs text-gray-400">Crew</div>
              </div>
            </div>
          )}
        </div>

        {/* Generation Config */}
        <div className="card p-4">
          <h2 className="card-header flex items-center gap-2">
            <RefreshCw className="w-4 h-4" /> Generate New Universe
          </h2>
          <div className="space-y-4 mt-4">
            <div>
              <label className="block text-sm text-gray-400 mb-2">System Count</label>
              <div className="flex gap-2">
                {SYSTEM_COUNTS.map(count => (
                  <button key={count} onClick={() => setNumSystems(count)}
                    className={`flex-1 py-2 rounded text-sm font-mono transition-colors ${
                      numSystems === count
                        ? 'bg-accent-cyan/20 border border-accent-cyan text-accent-cyan'
                        : 'bg-space-800 border border-space-700 text-gray-400 hover:border-space-600'
                    }`}>
                    {count}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-2">Galaxy Shape</label>
              <div className="flex gap-2">
                {GALAXY_SHAPES.map(shape => (
                  <button key={shape} onClick={() => setGalaxyShape(shape)}
                    className={`flex-1 py-2 rounded text-sm capitalize transition-colors ${
                      galaxyShape === shape
                        ? 'bg-accent-cyan/20 border border-accent-cyan text-accent-cyan'
                        : 'bg-space-800 border border-space-700 text-gray-400 hover:border-space-600'
                    }`}>
                    {shape}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-2">Universe Seed</label>
              <input type="number" value={seed} onChange={(e) => setSeed(e.target.value)}
                className="input w-full" placeholder="Random if empty" />
            </div>
            {!showConfirm ? (
              <button onClick={() => setShowConfirm(true)}
                className="btn btn-danger w-full flex items-center justify-center gap-2">
                <RefreshCw className="w-4 h-4" /> Regenerate Universe
              </button>
            ) : (
              <div className="bg-accent-red/10 border border-accent-red/30 rounded-lg p-4">
                <div className="flex items-center gap-2 mb-2">
                  <AlertTriangle className="w-5 h-5 text-accent-red" />
                  <span className="text-accent-red font-bold text-sm">Destructive Action</span>
                </div>
                <p className="text-xs text-gray-400 mb-3">
                  This will destroy all existing game data including ships, cargo, combat logs,
                  and transactions. Player accounts will be preserved but will need new ships.
                </p>
                <div className="flex gap-2">
                  <button onClick={() => setShowConfirm(false)} className="btn btn-secondary flex-1"
                    disabled={generating}>Cancel</button>
                  <button onClick={handleGenerate}
                    className="btn btn-danger flex-1 flex items-center justify-center gap-2"
                    disabled={generating}>
                    {generating ? (
                      <>
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                        Generating...
                      </>
                    ) : 'Confirm Destroy & Regenerate'}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

// ─── Users Tab ───────────────────────────────────────────────────────────

const UsersTab = () => {
  const [users, setUsers] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [search, setSearch] = useState('');
  const [tierFilter, setTierFilter] = useState('');
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(null);
  const [searchTrigger, setSearchTrigger] = useState(0);

  useEffect(() => { fetchUsers(); }, [page, tierFilter, searchTrigger]);

  const fetchUsers = async () => {
    try {
      setLoading(true);
      const params = { page, limit: 25 };
      if (search) params.search = search;
      if (tierFilter) params.tier = tierFilter;
      const res = await admin.getUsers(params);
      const data = res.data.data;
      setUsers(data.users);
      setTotal(data.total);
      setPages(data.pages);
    } catch (err) {
      console.error('Failed to fetch users:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = () => {
    setPage(1);
    setSearchTrigger(t => t + 1);
  };

  const handleTierChange = async (userId, newTier) => {
    try {
      setUpdating(userId);
      await admin.updateUserTier(userId, newTier);
      setUsers(prev => prev.map(u =>
        u.user_id === userId ? { ...u, subscription_tier: newTier } : u
      ));
    } catch (err) {
      console.error('Failed to update tier:', err);
    } finally {
      setUpdating(null);
    }
  };

  return (
    <div className="space-y-4">
      {/* Search / Filter */}
      <div className="card p-4">
        <div className="flex gap-3 flex-wrap">
          <div className="flex-1 min-w-[200px]">
            <div className="flex gap-2">
              <input type="text" value={search} onChange={(e) => setSearch(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                className="input flex-1 text-sm" placeholder="Search username or email..." />
              <button onClick={handleSearch} className="btn btn-secondary flex items-center gap-1">
                <Search className="w-4 h-4" /> Search
              </button>
            </div>
          </div>
          <select value={tierFilter} onChange={(e) => { setTierFilter(e.target.value); setPage(1); }}
            className="input text-sm">
            <option value="">All Tiers</option>
            {TIER_OPTIONS.map(t => (
              <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>
            ))}
          </select>
        </div>
      </div>

      {/* User Table */}
      <div className="card p-4">
        {loading ? (
          <div className="p-8 text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-accent-cyan mx-auto mb-2"></div>
            <div className="text-gray-400 text-sm">Loading users...</div>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-space-700 text-left">
                    <th className="py-2 px-2 text-xs text-gray-500">Username</th>
                    <th className="py-2 px-2 text-xs text-gray-500">Email</th>
                    <th className="py-2 px-2 text-xs text-gray-500">Tier</th>
                    <th className="py-2 px-2 text-xs text-gray-500">Admin</th>
                    <th className="py-2 px-2 text-xs text-gray-500">Last Login</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map(u => (
                    <tr key={u.user_id} className="border-b border-space-800 hover:bg-space-700/50">
                      <td className="py-2 px-2 text-white font-medium">{u.username}</td>
                      <td className="py-2 px-2 text-gray-400">{u.email || '-'}</td>
                      <td className="py-2 px-2">
                        <select value={u.subscription_tier || 'free'}
                          onChange={(e) => handleTierChange(u.user_id, e.target.value)}
                          disabled={updating === u.user_id}
                          className={`bg-space-800 border border-space-600 rounded px-2 py-1 text-xs ${TIER_COLORS[u.subscription_tier] || 'text-gray-400'}`}>
                          {TIER_OPTIONS.map(t => (
                            <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>
                          ))}
                        </select>
                      </td>
                      <td className="py-2 px-2">
                        {u.is_admin ? <span className="badge badge-red">Admin</span> : <span className="text-gray-600 text-xs">-</span>}
                      </td>
                      <td className="py-2 px-2 text-xs text-gray-500">
                        {u.last_login ? new Date(u.last_login).toLocaleDateString() : 'Never'}
                      </td>
                    </tr>
                  ))}
                  {users.length === 0 && (
                    <tr><td colSpan={5} className="py-6 text-center text-gray-500">No users found</td></tr>
                  )}
                </tbody>
              </table>
            </div>
            {/* Pagination */}
            {pages > 1 && (
              <div className="flex items-center justify-between mt-3">
                <span className="text-xs text-gray-500">
                  Page {page} of {pages} ({total} users)
                </span>
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
          </>
        )}
      </div>
    </div>
  );
};

export default AdminPage;
