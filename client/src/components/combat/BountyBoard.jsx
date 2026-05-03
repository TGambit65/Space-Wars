import { useEffect, useState, useCallback } from 'react';
import { pvp } from '../../services/api';
import { Crosshair, Target, Trophy, Clock, Award } from 'lucide-react';

const TIER_COLORS = {
  1: '#9ca3af',
  2: '#60a5fa',
  3: '#a78bfa',
  4: '#f59e0b',
  5: '#ef4444'
};

const TIER_LABELS = {
  1: 'T1 — Routine',
  2: 'T2 — Standard',
  3: 'T3 — Veteran',
  4: 'T4 — Elite',
  5: 'T5 — Legendary'
};

function formatExpiry(iso) {
  const ms = new Date(iso).getTime() - Date.now();
  if (ms <= 0) return 'expired';
  const h = Math.floor(ms / 3600_000);
  const m = Math.floor((ms % 3600_000) / 60_000);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

export default function BountyBoard() {
  const [open, setOpen] = useState([]);
  const [mine, setMine] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(null);
  const [error, setError] = useState(null);

  const refresh = useCallback(async () => {
    try {
      const res = await pvp.listBounties();
      const data = res.data?.data || {};
      setOpen(data.open || []);
      setMine(data.mine || []);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load bounty board');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
    const interval = setInterval(refresh, 15000);
    return () => clearInterval(interval);
  }, [refresh]);

  const handleAccept = async (id) => {
    setBusy(id);
    try { await pvp.acceptBounty(id); await refresh(); }
    catch (err) { setError(err.response?.data?.message || 'Failed to accept bounty'); }
    finally { setBusy(null); }
  };

  const handleAbandon = async (id) => {
    setBusy(id);
    try { await pvp.abandonBounty(id); await refresh(); }
    catch (err) { setError(err.response?.data?.message || 'Failed to abandon bounty'); }
    finally { setBusy(null); }
  };

  if (loading) return <div className="p-6 text-gray-400">Loading bounty board…</div>;

  return (
    <div className="p-4 max-w-5xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <Crosshair className="w-7 h-7 text-red-400" />
        <h1 className="text-2xl font-bold text-white">Bounty Board</h1>
      </div>
      <p className="text-sm text-gray-400">
        Hunt graded targets for credits and XP. Rewards scale by tier (T1–T5). Kill the
        target NPC type while the bounty is active and the contract auto-completes.
      </p>

      {error && (
        <div className="p-3 rounded bg-red-900/40 border border-red-700 text-red-200 text-sm">{error}</div>
      )}

      <section>
        <h2 className="text-lg font-semibold text-white mb-3">My Active Bounties</h2>
        {mine.filter(c => c.status === 'accepted').length === 0 ? (
          <div className="text-sm text-gray-500">No active bounties. Accept one below.</div>
        ) : (
          <div className="grid gap-3">
            {mine.filter(c => c.status === 'accepted').map(c => (
              <div key={c.contract_id} className="p-3 rounded-lg border border-gray-700 bg-space-800">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="px-2 py-0.5 rounded text-xs font-semibold" style={{ background: TIER_COLORS[c.tier] + '33', color: TIER_COLORS[c.tier] }}>
                        {TIER_LABELS[c.tier]}
                      </span>
                      <span className="text-white font-medium">Hunt {c.kill_count}× {c.target_npc_type}</span>
                    </div>
                    <div className="text-xs text-gray-400 mt-1">
                      Progress: {c.kills_recorded} / {c.kill_count} · Reward: {c.reward_credits.toLocaleString()} cr · {c.reward_xp} XP
                    </div>
                  </div>
                  <button
                    onClick={() => handleAbandon(c.contract_id)}
                    disabled={busy === c.contract_id}
                    className="px-3 py-1.5 text-xs rounded bg-gray-700 hover:bg-gray-600 text-white disabled:opacity-50"
                  >
                    Abandon
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <section>
        <h2 className="text-lg font-semibold text-white mb-3">Available Contracts</h2>
        {open.length === 0 ? (
          <div className="text-sm text-gray-500">No open contracts right now.</div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {open.map(c => (
              <div key={c.contract_id} className="p-3 rounded-lg border border-gray-700 bg-space-800 hover:border-cyan-700 transition">
                <div className="flex items-center gap-2 mb-2">
                  <span className="px-2 py-0.5 rounded text-xs font-semibold" style={{ background: TIER_COLORS[c.tier] + '33', color: TIER_COLORS[c.tier] }}>
                    {TIER_LABELS[c.tier]}
                  </span>
                  <Target className="w-4 h-4 text-gray-400" />
                  <span className="text-white">Hunt {c.kill_count}× {c.target_npc_type}</span>
                </div>
                <div className="text-xs text-gray-400 flex items-center gap-3 mb-3">
                  <span><Trophy className="inline w-3 h-3 mr-1" />{c.reward_credits.toLocaleString()} cr</span>
                  <span><Award className="inline w-3 h-3 mr-1" />{c.reward_xp} XP</span>
                  <span><Clock className="inline w-3 h-3 mr-1" />{formatExpiry(c.expires_at)}</span>
                </div>
                <button
                  onClick={() => handleAccept(c.contract_id)}
                  disabled={busy === c.contract_id}
                  className="w-full py-1.5 text-sm rounded bg-cyan-700 hover:bg-cyan-600 text-white disabled:opacity-50"
                >
                  Accept Contract
                </button>
              </div>
            ))}
          </div>
        )}
      </section>

      <section>
        <h2 className="text-lg font-semibold text-white mb-3">Recent Completions</h2>
        {mine.filter(c => c.status === 'completed').length === 0 ? (
          <div className="text-sm text-gray-500">No completed bounties yet.</div>
        ) : (
          <div className="grid gap-2">
            {mine.filter(c => c.status === 'completed').slice(0, 10).map(c => (
              <div key={c.contract_id} className="p-2 rounded border border-gray-800 bg-space-800/60 text-xs text-gray-300 flex justify-between">
                <span>{TIER_LABELS[c.tier]} — {c.kill_count}× {c.target_npc_type}</span>
                <span className="text-green-400">+{c.reward_credits.toLocaleString()} cr · +{c.reward_xp} XP</span>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
