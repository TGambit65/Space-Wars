import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { colonies as coloniesApi } from '../../services/api';
import { Trophy, ArrowLeft, RefreshCw, Factory, Shield, Sparkles } from 'lucide-react';

const SORT_OPTIONS = [
  { key: 'production', label: 'Production', icon: Factory },
  { key: 'defense', label: 'Defense', icon: Shield },
  { key: 'aesthetic', label: 'Aesthetic', icon: Sparkles },
];

function ColonyLeaderboard({ user }) {
  const navigate = useNavigate();
  const [sortBy, setSortBy] = useState('production');
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchLeaderboard = async (sort) => {
    setLoading(true);
    setError('');
    try {
      const res = await coloniesApi.getLeaderboard(sort, 20);
      const data = res.data.data || res.data;
      setEntries(Array.isArray(data) ? data : data.leaderboard || []);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load leaderboard');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLeaderboard(sortBy);
  }, [sortBy]);

  const rankColor = (rank) => {
    if (rank === 1) return 'text-yellow-400';
    if (rank === 2) return 'text-gray-300';
    if (rank === 3) return 'text-orange-400';
    return 'text-gray-500';
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate('/colonies')}
            className="btn btn-secondary flex items-center gap-2 text-sm"
          >
            <ArrowLeft className="w-4 h-4" /> Colonies
          </button>
          <div>
            <h1 className="text-2xl font-bold text-white flex items-center gap-2">
              <Trophy className="w-7 h-7 text-yellow-400" />
              Colony Leaderboard
            </h1>
            <p className="text-gray-400 text-sm">Top colonies ranked by performance</p>
          </div>
        </div>
        <button
          onClick={() => fetchLeaderboard(sortBy)}
          className="btn btn-secondary flex items-center gap-2"
        >
          <RefreshCw className="w-4 h-4" /> Refresh
        </button>
      </div>

      {/* Sort Tabs */}
      <div className="flex gap-2">
        {SORT_OPTIONS.map(opt => {
          const Icon = opt.icon;
          const active = sortBy === opt.key;
          return (
            <button
              key={opt.key}
              onClick={() => setSortBy(opt.key)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                active
                  ? 'bg-accent-cyan/15 border border-accent-cyan/40 text-accent-cyan'
                  : 'bg-space-800/80 border border-space-600/30 text-gray-400 hover:text-white hover:border-space-500'
              }`}
            >
              <Icon className="w-4 h-4" />
              {opt.label}
            </button>
          );
        })}
      </div>

      {/* Error */}
      {error && (
        <div className="card p-3 border-accent-red/30 bg-accent-red/5 text-accent-red text-sm">
          {error}
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div className="flex items-center justify-center h-48">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-accent-cyan"></div>
        </div>
      )}

      {/* Leaderboard Table */}
      {!loading && entries.length === 0 && (
        <div className="card text-center py-12">
          <Trophy className="w-12 h-12 text-gray-600 mx-auto mb-3" />
          <p className="text-gray-400">No colonies found on the leaderboard.</p>
        </div>
      )}

      {!loading && entries.length > 0 && (
        <div className="card p-0 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-space-600/30">
                <th className="text-left px-4 py-3 text-gray-400 font-medium w-16">Rank</th>
                <th className="text-left px-4 py-3 text-gray-400 font-medium">Colony</th>
                <th className="text-left px-4 py-3 text-gray-400 font-medium">Owner</th>
                <th className="text-left px-4 py-3 text-gray-400 font-medium">Planet</th>
                <th className="text-right px-4 py-3 text-gray-400 font-medium">Score</th>
                <th className="text-right px-4 py-3 text-gray-400 font-medium">Infra</th>
              </tr>
            </thead>
            <tbody>
              {entries.map((entry, idx) => {
                const rank = idx + 1;
                const isCurrentUser = entry.owner_username === user?.username;
                return (
                  <tr
                    key={entry.colony_id || idx}
                    className={`border-b border-space-700/20 transition-colors hover:bg-space-700/20 ${
                      isCurrentUser ? 'bg-accent-cyan/5' : ''
                    }`}
                  >
                    <td className={`px-4 py-3 font-bold font-display ${rankColor(rank)}`}>
                      {rank <= 3 ? (
                        <span className="flex items-center gap-1">
                          <Trophy className="w-4 h-4" />
                          {rank}
                        </span>
                      ) : rank}
                    </td>
                    <td className="px-4 py-3">
                      <button
                        onClick={() => navigate(`/colony/${entry.colony_id}/surface/public`)}
                        className="text-accent-cyan hover:underline font-medium"
                      >
                        {entry.colony_name || 'Unknown Colony'}
                      </button>
                    </td>
                    <td className={`px-4 py-3 ${isCurrentUser ? 'text-accent-cyan font-medium' : 'text-gray-300'}`}>
                      {entry.owner_username || 'Unknown'}
                    </td>
                    <td className="px-4 py-3 text-gray-400">
                      {entry.planet_name || entry.planet_type || '-'}
                    </td>
                    <td className="px-4 py-3 text-right text-white font-medium">
                      {(entry.score ?? entry[sortBy + '_score'] ?? 0).toLocaleString()}
                    </td>
                    <td className="px-4 py-3 text-right text-gray-400">
                      Lv.{entry.infrastructure_level || 1}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export default ColonyLeaderboard;
