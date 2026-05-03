import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { pvp, ships as shipsApi } from '../../services/api';
import { Swords, Trophy, Users, Clock, X } from 'lucide-react';

const BRACKETS = [
  { id: '1v1', label: '1 vs 1', icon: Swords, desc: 'Solo duel, even ELO matchmaking.' },
  { id: '2v2', label: '2 vs 2', icon: Users, desc: 'Team match: 2 allies vs 2 opponents (auto-assigned).' },
  { id: 'ffa', label: 'Free-for-all', icon: Users, desc: 'Up to 4 players, last ship standing wins.' },
];

export default function ArenaLobby({ socket }) {
  const navigate = useNavigate();
  const [status, setStatus] = useState(null);
  const [ships, setShips] = useState([]);
  const [activeShipId, setActiveShipId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  const refresh = useCallback(async () => {
    try {
      const [statusRes, shipsRes] = await Promise.all([
        pvp.arenaStatus(),
        shipsApi.getAll(),
      ]);
      setStatus(statusRes.data?.data || null);
      const shipList = shipsRes.data?.data?.ships || [];
      setShips(shipList);
      setActiveShipId(shipsRes.data?.data?.active_ship_id || shipList[0]?.ship_id || null);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load arena');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  // React to live arena updates
  useEffect(() => {
    if (!socket) return;
    const onQueue = () => refresh();
    const onMatch = (data) => {
      if (data?.combatId) navigate(`/combat?combatId=${data.combatId}`);
    };
    socket.on('pvp:arena_queue', onQueue);
    socket.on('pvp:arena_match', onMatch);
    return () => {
      socket.off('pvp:arena_queue', onQueue);
      socket.off('pvp:arena_match', onMatch);
    };
  }, [socket, refresh, navigate]);

  const handleJoin = async (bracket) => {
    if (!activeShipId) { setError('No active ship'); return; }
    setBusy(true); setError(null);
    try { await pvp.arenaJoin(activeShipId, bracket); await refresh(); }
    catch (err) { setError(err.response?.data?.message || 'Failed to queue'); }
    finally { setBusy(false); }
  };

  const handleLeave = async () => {
    setBusy(true); setError(null);
    try { await pvp.arenaLeave(); await refresh(); }
    catch (err) { setError(err.response?.data?.message || 'Failed to leave queue'); }
    finally { setBusy(false); }
  };

  if (loading) return <div className="p-6 text-gray-400">Loading arena…</div>;

  return (
    <div className="p-4 max-w-4xl mx-auto space-y-5">
      <div className="flex items-center gap-3">
        <Swords className="w-7 h-7 text-red-400" />
        <h1 className="text-2xl font-bold text-white">Arena</h1>
      </div>
      <p className="text-sm text-gray-400">
        Bracketed PvP queue with ELO-based matchmaking. Bypasses sector consent rules — both
        players opt in by joining the queue.
      </p>

      {error && <div className="p-3 rounded bg-red-900/40 border border-red-700 text-red-200 text-sm">{error}</div>}

      <div className="p-3 rounded-lg border border-gray-700 bg-space-800 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Trophy className="w-5 h-5 text-amber-400" />
          <span className="text-white font-semibold">Your ELO:</span>
          <span className="text-amber-400 font-mono">{status?.elo ?? 1000}</span>
        </div>
        {status?.queued ? (
          <button
            onClick={handleLeave}
            disabled={busy}
            className="px-3 py-1.5 text-sm rounded bg-red-700 hover:bg-red-600 text-white flex items-center gap-1"
          >
            <X className="w-4 h-4" /> Leave queue ({status.bracket})
          </button>
        ) : (
          <span className="text-xs text-gray-400">Not queued</span>
        )}
      </div>

      <div className="grid gap-3 md:grid-cols-3">
        {BRACKETS.map(b => {
          const Icon = b.icon;
          const queueSize = status?.queueSizes?.[b.id] ?? 0;
          const inThisBracket = status?.queued && status.bracket === b.id;
          return (
            <div key={b.id} className="p-4 rounded-lg border border-gray-700 bg-space-800">
              <div className="flex items-center gap-2 mb-2">
                <Icon className="w-5 h-5 text-cyan-400" />
                <h3 className="text-white font-semibold">{b.label}</h3>
              </div>
              <p className="text-xs text-gray-400 mb-3">{b.desc}</p>
              <div className="text-xs text-gray-500 mb-3 flex items-center gap-2">
                <Clock className="w-3 h-3" /> {queueSize} in queue
              </div>
              <button
                onClick={() => handleJoin(b.id)}
                disabled={busy || status?.queued}
                className="w-full py-1.5 text-sm rounded bg-cyan-700 hover:bg-cyan-600 text-white disabled:opacity-50"
              >
                {inThisBracket ? 'Queued…' : `Queue ${b.label}`}
              </button>
            </div>
          );
        })}
      </div>

      <div className="p-3 rounded border border-gray-800 text-xs text-gray-500">
        Active ship: {ships.find(s => s.ship_id === activeShipId)?.name || '—'}
      </div>
    </div>
  );
}
