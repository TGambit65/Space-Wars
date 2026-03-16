import { useState, useEffect } from 'react';
import { Trophy, Star, Crosshair, ShoppingCart, Globe, Rocket, Users, Compass, Gem, Swords } from 'lucide-react';

const ACHIEVEMENTS = [
  { id: 'first_trade', icon: ShoppingCart, label: 'First Trade', desc: 'Complete your first trade', check: (d) => (d.trades || 0) >= 1 },
  { id: 'trader_10', icon: ShoppingCart, label: 'Merchant', desc: 'Complete 10 trades', check: (d) => (d.trades || 0) >= 10 },
  { id: 'first_kill', icon: Crosshair, label: 'First Blood', desc: 'Win your first combat', check: (d) => (d.combats || 0) >= 1 },
  { id: 'warrior_10', icon: Swords, label: 'Warrior', desc: 'Win 10 combats', check: (d) => (d.combats || 0) >= 10 },
  { id: 'explorer_10', icon: Compass, label: 'Explorer', desc: 'Visit 10 sectors', check: (d) => (d.sectors || 0) >= 10 },
  { id: 'explorer_50', icon: Globe, label: 'Cartographer', desc: 'Visit 50 sectors', check: (d) => (d.sectors || 0) >= 50 },
  { id: 'colonist', icon: Globe, label: 'Colonist', desc: 'Establish a colony', check: (d) => (d.colonies || 0) >= 1 },
  { id: 'fleet_cmdr', icon: Users, label: 'Fleet Commander', desc: 'Create a fleet', check: (d) => (d.fleets || 0) >= 1 },
  { id: 'rich_10k', icon: Gem, label: 'Wealthy', desc: 'Accumulate 10,000 credits', check: (d) => (d.credits || 0) >= 10000 },
  { id: 'rich_100k', icon: Gem, label: 'Tycoon', desc: 'Accumulate 100,000 credits', check: (d) => (d.credits || 0) >= 100000 },
  { id: 'level_5', icon: Star, label: 'Veteran', desc: 'Reach level 5', check: (d) => (d.level || 0) >= 5 },
  { id: 'level_10', icon: Trophy, label: 'Commander', desc: 'Reach level 10', check: (d) => (d.level || 0) >= 10 },
];

const STORAGE_KEY = 'sw3k_achievements';

function getUnlocked() {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}'); }
  catch { return {}; }
}

export function checkAchievements(stats) {
  const unlocked = getUnlocked();
  const newUnlocks = [];
  for (const a of ACHIEVEMENTS) {
    if (!unlocked[a.id] && a.check(stats)) {
      unlocked[a.id] = Date.now();
      newUnlocks.push(a);
    }
  }
  if (newUnlocks.length > 0) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(unlocked));
  }
  return newUnlocks;
}

export default function AchievementsPanel() {
  const [unlocked, setUnlocked] = useState(getUnlocked);

  useEffect(() => {
    const handler = () => setUnlocked(getUnlocked());
    window.addEventListener('storage', handler);
    window.addEventListener('sw3k:achievement-check', handler);
    return () => {
      window.removeEventListener('storage', handler);
      window.removeEventListener('sw3k:achievement-check', handler);
    };
  }, []);

  const unlockedCount = ACHIEVEMENTS.filter(a => unlocked[a.id]).length;

  return (
    <div className="card">
      <h2 className="card-header flex items-center gap-2">
        <Trophy className="w-5 h-5 text-neon-orange" />
        Achievements
        <span className="text-xs text-gray-500 ml-auto font-normal">{unlockedCount}/{ACHIEVEMENTS.length}</span>
      </h2>
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
        {ACHIEVEMENTS.map(a => {
          const Icon = a.icon;
          const done = !!unlocked[a.id];
          return (
            <div key={a.id} className={`p-2.5 rounded-lg text-center transition-all ${done ? '' : 'opacity-40'}`}
              style={{ background: done ? 'rgba(255,102,0,0.06)' : 'rgba(255,255,255,0.02)', border: `1px solid ${done ? 'rgba(255,102,0,0.2)' : 'rgba(255,255,255,0.05)'}` }}
              title={a.desc}
            >
              <Icon className="w-5 h-5 mx-auto mb-1" style={{ color: done ? '#ff6600' : '#555' }} />
              <p className={`text-[11px] font-medium ${done ? 'text-white' : 'text-gray-600'}`}>{a.label}</p>
              <p className="text-[9px] text-gray-500 mt-0.5">{a.desc}</p>
            </div>
          );
        })}
      </div>
    </div>
  );
}
