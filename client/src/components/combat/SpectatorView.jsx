import { useEffect, useState, useCallback, useRef } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { pvp } from '../../services/api';
import { Eye, Users, Trophy } from 'lucide-react';

function ArenaCanvas({ snapshot }) {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !snapshot) return;
    const ctx = canvas.getContext('2d');
    const W = canvas.width, H = canvas.height;
    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = '#0a0a1f';
    ctx.fillRect(0, 0, W, H);
    // Arena bounds (-200..200 in game units)
    ctx.strokeStyle = '#1a3a4a';
    ctx.strokeRect(20, 20, W - 40, H - 40);
    const scale = (W - 40) / 400;
    const ships = snapshot.ships || [];
    for (const s of ships) {
      const x = 20 + (s.position.x + 200) * scale;
      const y = 20 + (s.position.y + 200) * scale;
      const alive = s.alive;
      ctx.fillStyle = !alive ? '#444' : (s.isNPC ? '#ff6666' : '#66ccff');
      ctx.beginPath();
      ctx.arc(x, y, 6, 0, Math.PI * 2);
      ctx.fill();
      // Hull bar
      const pct = Math.max(0, s.stats.hull / s.stats.maxHull);
      ctx.fillStyle = pct > 0.5 ? '#3aff6a' : pct > 0.25 ? '#ffd23a' : '#ff5a3a';
      ctx.fillRect(x - 12, y - 14, 24 * pct, 3);
      ctx.strokeStyle = '#222'; ctx.strokeRect(x - 12, y - 14, 24, 3);
      // Name
      ctx.fillStyle = '#cccccc';
      ctx.font = '10px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(s.name || (s.isNPC ? 'NPC' : 'Pilot'), x, y + 18);
    }
  }, [snapshot]);

  return (
    <canvas ref={canvasRef} width={520} height={520} className="rounded border border-gray-700 bg-black" />
  );
}

export default function SpectatorView({ socket }) {
  const [params] = useSearchParams();
  const presetCombatId = params.get('combatId');
  const [available, setAvailable] = useState([]);
  const [combatId, setCombatId] = useState(presetCombatId || null);
  const [snapshot, setSnapshot] = useState(null);
  const [feed, setFeed] = useState([]);
  const [error, setError] = useState(null);

  const refreshList = useCallback(async () => {
    try {
      const res = await pvp.listSpectatable();
      setAvailable(res.data?.data || []);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load spectatable matches');
    }
  }, []);

  useEffect(() => {
    refreshList();
    const t = setInterval(refreshList, 5000);
    return () => clearInterval(t);
  }, [refreshList]);

  useEffect(() => {
    if (!socket || !combatId) return;
    socket.emit('combat:spectate_join', { combat_id: combatId });
    const onEvent = (evt) => {
      if (!evt || evt.combatId !== combatId) return;
      if (evt.type === 'snapshot' || evt.type === 'state' || evt.type === 'started' || evt.type === 'recovered') {
        if (evt.snapshot) setSnapshot(evt.snapshot);
      }
      setFeed(prev => [{ ts: Date.now(), type: evt.type, payload: evt }, ...prev].slice(0, 40));
      if (evt.type === 'resolved') {
        // Stop emitting on this combat
        setTimeout(() => refreshList(), 500);
      }
    };
    socket.on('combat:event', onEvent);
    return () => {
      socket.off('combat:event', onEvent);
      socket.emit('combat:spectate_leave', { combat_id: combatId });
    };
  }, [socket, combatId, refreshList]);

  return (
    <div className="p-4 max-w-6xl mx-auto space-y-4">
      <div className="flex items-center gap-3">
        <Eye className="w-7 h-7 text-purple-400" />
        <h1 className="text-2xl font-bold text-white">Spectator</h1>
      </div>
      <p className="text-sm text-gray-400">Read-only view of live arena and duel matches.</p>

      {error && <div className="p-3 rounded bg-red-900/40 border border-red-700 text-red-200 text-sm">{error}</div>}

      <div className="grid grid-cols-12 gap-4">
        <aside className="col-span-12 md:col-span-4 space-y-2">
          <h2 className="text-sm font-semibold text-gray-300 mb-1">Live Matches</h2>
          {available.length === 0 ? (
            <div className="text-xs text-gray-500">No spectatable matches right now.</div>
          ) : available.map(m => (
            <button
              key={m.combatId}
              onClick={() => { setSnapshot(null); setFeed([]); setCombatId(m.combatId); }}
              className={`w-full text-left p-2 rounded border ${combatId === m.combatId ? 'border-purple-500 bg-purple-900/30' : 'border-gray-700 bg-space-800 hover:border-purple-700'}`}
            >
              <div className="text-xs uppercase text-purple-300">{m.combatType.replace('PVP_', '')}</div>
              <div className="text-sm text-white flex items-center gap-1">
                <Users className="w-3 h-3" /> {m.players.join(' vs ') || '—'}
              </div>
              <div className="text-[10px] text-gray-500">started {new Date(m.startedAt).toLocaleTimeString()}</div>
            </button>
          ))}
        </aside>

        <main className="col-span-12 md:col-span-8 space-y-3">
          {!combatId ? (
            <div className="p-6 text-gray-500 text-sm rounded border border-gray-800">
              Select a live match on the left to spectate.
            </div>
          ) : (
            <>
              <ArenaCanvas snapshot={snapshot} />
              <div className="grid grid-cols-2 gap-2">
                {(snapshot?.ships || []).map(s => (
                  <div key={s.shipId} className="p-2 rounded border border-gray-800 bg-space-800 text-xs">
                    <div className="flex items-center justify-between">
                      <span className="text-white font-medium">{s.name || (s.isNPC ? 'NPC' : 'Pilot')}</span>
                      {!s.alive && <span className="text-red-400">DESTROYED</span>}
                    </div>
                    <div className="text-gray-400 mt-1">
                      Hull {Math.round(s.stats.hull)}/{s.stats.maxHull} · Shields {Math.round(s.stats.shields)}/{s.stats.maxShields}
                    </div>
                  </div>
                ))}
              </div>
              <div className="p-2 rounded border border-gray-800 bg-space-800/60 max-h-40 overflow-y-auto text-xs space-y-1 font-mono">
                {feed.map((f, i) => (
                  <div key={i} className="text-gray-400">
                    <span className="text-purple-300">[{f.type}]</span>{' '}
                    {f.payload.attackerId ? `${f.payload.attackerId.slice(0, 6)} → ${f.payload.targetId?.slice(0, 6)} ${f.payload.damage || ''}` : ''}
                    {f.payload.shipId ? `ship ${f.payload.shipId.slice(0, 6)}` : ''}
                    {f.type === 'resolved' && f.payload.result?.winnerOwnerId ? ` winner ${f.payload.result.winnerOwnerId.slice(0, 6)}` : ''}
                  </div>
                ))}
              </div>
            </>
          )}
        </main>
      </div>

      <div className="text-xs text-gray-600">
        <Link to="/arena" className="text-cyan-400 hover:underline">Open Arena Lobby →</Link>
      </div>
    </div>
  );
}
