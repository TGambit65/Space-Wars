import { useState, useEffect } from 'react';
import { admin } from '../../services/api';
import { Settings, AlertTriangle, RefreshCw, Database } from 'lucide-react';

const SYSTEM_COUNTS = [50, 100, 200, 400];
const GALAXY_SHAPES = ['spiral', 'elliptical', 'ring'];

const AdminPage = ({ user }) => {
  const [config, setConfig] = useState(null);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);

  // Form state
  const [numSystems, setNumSystems] = useState(200);
  const [galaxyShape, setGalaxyShape] = useState('spiral');
  const [seed, setSeed] = useState('');

  useEffect(() => {
    fetchConfig();
  }, []);

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
      setError('Failed to load configuration. Are you an admin?');
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
      fetchConfig(); // Refresh stats
    } catch (err) {
      setError(err.response?.data?.message || 'Generation failed');
    } finally {
      setGenerating(false);
    }
  };

  if (loading) {
    return (
      <div className="p-8 text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-accent-cyan mx-auto mb-4"></div>
        <div className="text-accent-cyan">Loading admin panel...</div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <Settings className="w-8 h-8 text-accent-cyan" />
        <div>
          <h1 className="text-3xl font-bold text-white">Universe Administration</h1>
          <p className="text-gray-400 text-sm">Configure and regenerate the galaxy</p>
        </div>
      </div>

      {error && (
        <div className="mb-4 bg-accent-red/10 border border-accent-red/30 rounded-lg p-3 flex items-center gap-2">
          <AlertTriangle className="w-5 h-5 text-accent-red flex-shrink-0" />
          <span className="text-accent-red text-sm">{error}</span>
        </div>
      )}

      {success && (
        <div className="mb-4 bg-green-500/10 border border-green-500/30 rounded-lg p-3">
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
            {/* System Count */}
            <div>
              <label className="block text-sm text-gray-400 mb-2">System Count</label>
              <div className="flex gap-2">
                {SYSTEM_COUNTS.map(count => (
                  <button
                    key={count}
                    onClick={() => setNumSystems(count)}
                    className={`flex-1 py-2 rounded text-sm font-mono transition-colors ${
                      numSystems === count
                        ? 'bg-accent-cyan/20 border border-accent-cyan text-accent-cyan'
                        : 'bg-space-800 border border-space-700 text-gray-400 hover:border-space-600'
                    }`}
                  >
                    {count}
                  </button>
                ))}
              </div>
            </div>

            {/* Galaxy Shape */}
            <div>
              <label className="block text-sm text-gray-400 mb-2">Galaxy Shape</label>
              <div className="flex gap-2">
                {GALAXY_SHAPES.map(shape => (
                  <button
                    key={shape}
                    onClick={() => setGalaxyShape(shape)}
                    className={`flex-1 py-2 rounded text-sm capitalize transition-colors ${
                      galaxyShape === shape
                        ? 'bg-accent-cyan/20 border border-accent-cyan text-accent-cyan'
                        : 'bg-space-800 border border-space-700 text-gray-400 hover:border-space-600'
                    }`}
                  >
                    {shape}
                  </button>
                ))}
              </div>
            </div>

            {/* Seed */}
            <div>
              <label className="block text-sm text-gray-400 mb-2">Universe Seed</label>
              <input
                type="number"
                value={seed}
                onChange={(e) => setSeed(e.target.value)}
                className="input w-full"
                placeholder="Random if empty"
              />
            </div>

            {/* Generate Button */}
            {!showConfirm ? (
              <button
                onClick={() => setShowConfirm(true)}
                className="btn btn-danger w-full flex items-center justify-center gap-2"
              >
                <RefreshCw className="w-4 h-4" />
                Regenerate Universe
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
                  <button
                    onClick={() => setShowConfirm(false)}
                    className="btn btn-secondary flex-1"
                    disabled={generating}
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleGenerate}
                    className="btn btn-danger flex-1 flex items-center justify-center gap-2"
                    disabled={generating}
                  >
                    {generating ? (
                      <>
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                        Generating...
                      </>
                    ) : (
                      'Confirm Destroy & Regenerate'
                    )}
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

export default AdminPage;
