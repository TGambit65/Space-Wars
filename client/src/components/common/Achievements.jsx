import { useState, useEffect } from 'react';
import { Trophy, Star, Crosshair, ShoppingCart, Globe, Rocket, Users, Compass, Swords, Building2, Target, Eye, Crown, Sparkles } from 'lucide-react';
import { achievements as achievementsApi } from '../../services/api';

const RARITY_COLORS = {
  common: { text: '#9ca3af', bg: 'rgba(156,163,175,0.08)', border: 'rgba(156,163,175,0.15)', glow: 'rgba(156,163,175,0.1)' },
  uncommon: { text: '#4caf50', bg: 'rgba(76,175,80,0.08)', border: 'rgba(76,175,80,0.2)', glow: 'rgba(76,175,80,0.1)' },
  rare: { text: '#00bfff', bg: 'rgba(0,191,255,0.08)', border: 'rgba(0,191,255,0.2)', glow: 'rgba(0,191,255,0.15)' },
  epic: { text: '#a78bfa', bg: 'rgba(167,139,250,0.08)', border: 'rgba(167,139,250,0.2)', glow: 'rgba(167,139,250,0.15)' },
  legendary: { text: '#ffd700', bg: 'rgba(255,215,0,0.08)', border: 'rgba(255,215,0,0.25)', glow: 'rgba(255,215,0,0.2)' },
};

const CATEGORY_ICONS = {
  exploration: Compass,
  combat: Swords,
  trade: ShoppingCart,
  colony: Building2,
  social: Users,
  progression: Star,
  special: Sparkles,
};

/**
 * Compact achievements widget for the Dashboard.
 * Shows recent unlocks, completion percentage, and a link to the full page.
 */
export default function AchievementsPanel() {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    achievementsApi.getStats()
      .then(res => { if (!cancelled) setStats(res.data.data); })
      .catch(() => {})
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  // Listen for live unlocks and refresh
  useEffect(() => {
    const handler = () => {
      achievementsApi.getStats()
        .then(res => setStats(res.data.data))
        .catch(() => {});
    };
    window.addEventListener('sw3k:achievement-unlocked', handler);
    return () => window.removeEventListener('sw3k:achievement-unlocked', handler);
  }, []);

  if (loading) {
    return (
      <div className="card">
        <h2 className="card-header flex items-center gap-2">
          <Trophy className="w-5 h-5 text-neon-orange" />
          Achievements
        </h2>
        <div className="flex items-center justify-center h-20">
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-neon-cyan"></div>
        </div>
      </div>
    );
  }

  if (!stats) return null;

  const pct = stats.completion_pct || 0;

  return (
    <div className="card">
      <div className="flex items-center justify-between mb-3">
        <h2 className="card-header flex items-center gap-2 mb-0">
          <Trophy className="w-5 h-5 text-neon-orange" />
          Achievements
        </h2>
        <a href="/achievements" className="text-xs text-neon-cyan hover:underline">View All</a>
      </div>

      {/* Completion bar */}
      <div className="mb-4">
        <div className="flex items-center justify-between mb-1">
          <span className="text-xs text-gray-500">{stats.unlocked} / {stats.total} unlocked</span>
          <span className="text-xs font-display" style={{ color: pct >= 100 ? '#ffd700' : '#ff6600' }}>{pct}%</span>
        </div>
        <div className="h-2 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.06)' }}>
          <div
            className="h-full rounded-full transition-all duration-700"
            style={{
              width: `${pct}%`,
              background: pct >= 100 ? 'linear-gradient(90deg, #ffd700, #ff6600)' : '#ff6600',
              boxShadow: '0 0 8px rgba(255,102,0,0.4)',
            }}
          />
        </div>
      </div>

      {/* Recent unlocks */}
      {stats.recent && stats.recent.length > 0 ? (
        <div className="space-y-2">
          <span className="text-[10px] text-gray-600 uppercase tracking-wider font-display">Recent Unlocks</span>
          {stats.recent.map(a => {
            const rarity = RARITY_COLORS[a.rarity] || RARITY_COLORS.common;
            return (
              <div key={a.achievement_id}
                className="flex items-center gap-3 px-3 py-2 rounded-lg"
                style={{ background: rarity.bg, border: `1px solid ${rarity.border}` }}
              >
                <Trophy className="w-4 h-4 flex-shrink-0" style={{ color: rarity.text }} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-white truncate">{a.name}</p>
                  <p className="text-[10px] text-gray-500">
                    {a.unlocked_at ? new Date(a.unlocked_at).toLocaleDateString() : ''}
                  </p>
                </div>
                <span className="text-[10px] font-display px-1.5 py-0.5 rounded-full"
                  style={{ color: rarity.text, background: `${rarity.text}15`, border: `1px solid ${rarity.border}` }}
                >
                  {a.rarity}
                </span>
              </div>
            );
          })}
        </div>
      ) : (
        <p className="text-sm text-gray-600 text-center py-2">No achievements unlocked yet. Start exploring!</p>
      )}
    </div>
  );
}

export { RARITY_COLORS, CATEGORY_ICONS };
