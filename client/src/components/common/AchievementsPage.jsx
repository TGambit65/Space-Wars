import { useState, useEffect } from 'react';
import { Trophy, Lock, CheckCircle } from 'lucide-react';
import { achievements as achievementsApi } from '../../services/api';
import { RARITY_COLORS, CATEGORY_ICONS } from './Achievements';

const CATEGORIES = [
  { key: 'all', label: 'All' },
  { key: 'exploration', label: 'Exploration' },
  { key: 'combat', label: 'Combat' },
  { key: 'trade', label: 'Trade' },
  { key: 'colony', label: 'Colony' },
  { key: 'social', label: 'Social' },
  { key: 'progression', label: 'Progression' },
  { key: 'special', label: 'Special' },
];

export default function AchievementsPage() {
  const [achievements, setAchievements] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeCategory, setActiveCategory] = useState('all');

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      achievementsApi.getAll(),
      achievementsApi.getStats(),
    ])
      .then(([allRes, statsRes]) => {
        if (cancelled) return;
        setAchievements(allRes.data.data || []);
        setStats(statsRes.data.data || null);
      })
      .catch(() => {})
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  // Refresh on live unlock
  useEffect(() => {
    const handler = () => {
      Promise.all([achievementsApi.getAll(), achievementsApi.getStats()])
        .then(([allRes, statsRes]) => {
          setAchievements(allRes.data.data || []);
          setStats(statsRes.data.data || null);
        })
        .catch(() => {});
    };
    window.addEventListener('sw3k:achievement-unlocked', handler);
    return () => window.removeEventListener('sw3k:achievement-unlocked', handler);
  }, []);

  const filtered = activeCategory === 'all'
    ? achievements
    : achievements.filter(a => a.category === activeCategory);

  const unlockedInCategory = filtered.filter(a => a.unlocked).length;
  const totalInCategory = filtered.length;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-neon-cyan"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white font-display flex items-center gap-3">
            <Trophy className="w-7 h-7 text-neon-orange" />
            Achievements
          </h1>
          <p className="text-sm text-gray-500 mt-1">Track your progress across the galaxy</p>
        </div>
        {stats && (
          <div className="text-right">
            <p className="text-2xl font-bold font-display" style={{ color: stats.completion_pct >= 100 ? '#ffd700' : '#ff6600' }}>
              {stats.completion_pct}%
            </p>
            <p className="text-xs text-gray-500">{stats.unlocked} / {stats.total} unlocked</p>
          </div>
        )}
      </div>

      {/* Global progress bar */}
      {stats && (
        <div className="h-3 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.06)' }}>
          <div
            className="h-full rounded-full transition-all duration-700"
            style={{
              width: `${stats.completion_pct}%`,
              background: stats.completion_pct >= 100
                ? 'linear-gradient(90deg, #ffd700, #ff6600, #ffd700)'
                : 'linear-gradient(90deg, #ff6600, #ff8c00)',
              boxShadow: '0 0 12px rgba(255,102,0,0.4)',
            }}
          />
        </div>
      )}

      {/* Category tabs */}
      <div className="flex flex-wrap gap-2">
        {CATEGORIES.map(cat => {
          const isActive = activeCategory === cat.key;
          const Icon = cat.key === 'all' ? Trophy : (CATEGORY_ICONS[cat.key] || Trophy);
          const count = cat.key === 'all'
            ? achievements.length
            : achievements.filter(a => a.category === cat.key).length;
          const unlocked = cat.key === 'all'
            ? achievements.filter(a => a.unlocked).length
            : achievements.filter(a => a.category === cat.key && a.unlocked).length;

          return (
            <button
              key={cat.key}
              onClick={() => setActiveCategory(cat.key)}
              className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-all"
              style={{
                background: isActive ? 'rgba(255,102,0,0.12)' : 'rgba(255,255,255,0.02)',
                border: `1px solid ${isActive ? 'rgba(255,102,0,0.3)' : 'rgba(255,255,255,0.06)'}`,
                color: isActive ? '#ff6600' : '#9ca3af',
              }}
            >
              <Icon className="w-3.5 h-3.5" />
              <span>{cat.label}</span>
              <span className="text-[10px] opacity-60">{unlocked}/{count}</span>
            </button>
          );
        })}
      </div>

      {/* Category summary */}
      <div className="flex items-center gap-2 text-xs text-gray-500">
        <span>{unlockedInCategory} / {totalInCategory} unlocked in {activeCategory === 'all' ? 'total' : activeCategory}</span>
      </div>

      {/* Achievement grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {filtered.map(a => (
          <AchievementCard key={a.achievement_id} achievement={a} />
        ))}
      </div>

      {filtered.length === 0 && (
        <p className="text-center text-gray-600 py-8">No achievements in this category</p>
      )}
    </div>
  );
}

function AchievementCard({ achievement }) {
  const {
    name, description, category, rarity, target_value, current_value,
    unlocked, unlocked_at, reward_credits, reward_xp, reward_title,
    is_hidden
  } = achievement;

  const rarityStyle = RARITY_COLORS[rarity] || RARITY_COLORS.common;
  const Icon = CATEGORY_ICONS[category] || Trophy;
  const pct = target_value > 0 ? Math.min((current_value / target_value) * 100, 100) : 0;

  return (
    <div
      className={`rounded-lg p-4 transition-all duration-200 ${unlocked ? '' : 'opacity-70'}`}
      style={{
        background: unlocked ? rarityStyle.bg : 'rgba(255,255,255,0.015)',
        border: `1px solid ${unlocked ? rarityStyle.border : 'rgba(255,255,255,0.06)'}`,
        boxShadow: unlocked ? `0 0 15px ${rarityStyle.glow}` : 'none',
      }}
    >
      <div className="flex items-start gap-3">
        {/* Icon */}
        <div
          className="p-2.5 rounded-lg flex-shrink-0"
          style={{
            background: unlocked ? `${rarityStyle.text}15` : 'rgba(255,255,255,0.03)',
            border: `1px solid ${unlocked ? rarityStyle.border : 'rgba(255,255,255,0.06)'}`,
          }}
        >
          {unlocked
            ? <Icon className="w-5 h-5" style={{ color: rarityStyle.text }} />
            : is_hidden
              ? <Lock className="w-5 h-5 text-gray-600" />
              : <Icon className="w-5 h-5 text-gray-600" />
          }
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-0.5">
            <h3 className={`text-sm font-semibold truncate ${unlocked ? 'text-white' : 'text-gray-400'}`}>
              {name}
            </h3>
            {unlocked && <CheckCircle className="w-3.5 h-3.5 flex-shrink-0" style={{ color: rarityStyle.text }} />}
          </div>
          <p className="text-xs text-gray-500 mb-2">{description}</p>

          {/* Progress bar */}
          {target_value > 1 && (
            <div className="mb-2">
              <div className="flex items-center justify-between mb-1">
                <span className="text-[10px] text-gray-500">
                  {current_value} / {target_value}
                </span>
                <span className="text-[10px]" style={{ color: unlocked ? rarityStyle.text : '#6b7280' }}>
                  {Math.round(pct)}%
                </span>
              </div>
              <div className="h-1.5 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.06)' }}>
                <div
                  className="h-full rounded-full transition-all duration-500"
                  style={{
                    width: `${pct}%`,
                    background: unlocked ? rarityStyle.text : 'rgba(255,255,255,0.15)',
                    boxShadow: unlocked ? `0 0 6px ${rarityStyle.glow}` : 'none',
                  }}
                />
              </div>
            </div>
          )}

          {/* Rewards & rarity */}
          <div className="flex items-center flex-wrap gap-1.5">
            <span
              className="text-[10px] font-display px-1.5 py-0.5 rounded-full"
              style={{
                color: rarityStyle.text,
                background: `${rarityStyle.text}12`,
                border: `1px solid ${rarityStyle.border}`,
              }}
            >
              {rarity}
            </span>
            {reward_credits > 0 && (
              <span className="text-[10px] text-neon-orange">
                +{Number(reward_credits).toLocaleString()} cr
              </span>
            )}
            {reward_xp > 0 && (
              <span className="text-[10px] text-neon-cyan">
                +{reward_xp} XP
              </span>
            )}
            {reward_title && (
              <span className="text-[10px] text-yellow-400">
                Title: {reward_title}
              </span>
            )}
          </div>

          {/* Unlock date */}
          {unlocked && unlocked_at && (
            <p className="text-[10px] text-gray-600 mt-1.5">
              Unlocked {new Date(unlocked_at).toLocaleDateString()}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
