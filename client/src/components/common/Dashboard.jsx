import { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { ships, colonies, crew as crewApi, combat, factions, events as eventsApi } from '../../services/api';
import { Rocket, Globe, Building2, Users, ArrowRight, Wallet, AlertTriangle, Map, Swords, BarChart3, Shield, TrendingUp, Eye, Leaf, CheckCircle, Circle, X, BookOpen, Trophy, Calendar, Zap } from 'lucide-react';
import AchievementsPanel from './Achievements';
import TerranDashboard from './TerranDashboard';
import ZythianDashboard from './ZythianDashboard';
import AutomatonDashboard from './AutomatonDashboard';
import { useGameSession } from '../../contexts/GameSessionContext';

const FACTION_META = {
  terran_alliance: { name: 'Terran Alliance', color: '#3498db', icon: Shield },
  zythian_swarm: { name: 'Zythian Swarm', color: '#e74c3c', icon: Swords },
  automaton_collective: { name: 'Automaton Collective', color: '#9b59b6', icon: TrendingUp },
  synthesis_accord: { name: 'Synthesis Accord', color: '#d4a017', icon: Eye },
  sylvari_dominion: { name: 'Sylvari Dominion', color: '#2ecc71', icon: Leaf },
};

function Dashboard({ user }) {
  const [data, setData] = useState({ ships: [], colonies: [], crew: [] });
  const [combatLogs, setCombatLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [factionLeaderboard, setFactionLeaderboard] = useState([]);
  const [activeEvents, setActiveEvents] = useState([]);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [shipsRes, coloniesRes, crewRes] = await Promise.all([
          ships.getAll(),
          colonies.getAll(),
          crewApi.getAll(),
        ]);
        setData({
          ships: shipsRes.data.data?.ships || [],
          colonies: Array.isArray(coloniesRes.data.data) ? coloniesRes.data.data : Array.isArray(coloniesRes.data) ? coloniesRes.data : coloniesRes.data.data?.colonies || [],
          crew: Array.isArray(crewRes.data.data) ? crewRes.data.data : Array.isArray(crewRes.data) ? crewRes.data : crewRes.data.data?.crew || [],
        });
      } catch (err) {
        console.error('Failed to fetch dashboard data:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  // P5 Item 15: Leaderboard data
  useEffect(() => {
    factions.getLeaderboard()
      .then(res => {
        const raw = res.data.data;
        setFactionLeaderboard(Array.isArray(raw) ? raw.slice(0, 5) : (raw?.leaderboard || []).slice(0, 5));
      })
      .catch(() => {});
  }, []);

  // P5 Item 18: Active events for ticker
  useEffect(() => {
    eventsApi.getActive()
      .then(res => {
        const raw = res.data.data;
        setActiveEvents(Array.isArray(raw) ? raw : raw?.events || []);
      })
      .catch(() => {});
  }, []);

  const totalSalary = data.crew.reduce((sum, c) => sum + (c.salary || 0), 0);
  const salaryDebt = user?.crew_salary_due || 0;

  useEffect(() => {
    if (loading) return;
    combat.getHistory()
      .then(res => setCombatLogs(res?.data?.combat_logs || []))
      .catch(() => {});
  }, [loading]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-neon-cyan"></div>
      </div>
    );
  }

  // Onboarding card is shown above ALL faction dashboards so every new player sees it
  const onboardingCard = <GettingStartedCard user={user} ships={data.ships} />;

  if (user?.faction === 'terran_alliance') {
    return <>{onboardingCard}<TerranDashboard user={user} data={data} combatLogs={combatLogs} /></>;
  }

  if (user?.faction === 'zythian_swarm') {
    return <>{onboardingCard}<ZythianDashboard user={user} data={data} combatLogs={combatLogs} /></>;
  }

  if (user?.faction === 'automaton_collective') {
    return <>{onboardingCard}<AutomatonDashboard user={user} data={data} combatLogs={combatLogs} /></>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">
            Welcome, Commander <span className="holo-text">{user?.username}</span>
          </h1>
          <p className="text-gray-500 text-sm mt-1">Empire Overview</p>
        </div>
        {user?.faction && FACTION_META[user.faction] && (() => {
          const fm = FACTION_META[user.faction];
          const FIcon = fm.icon;
          return (
            <Link to="/faction" className="flex items-center gap-2 px-3 py-2 rounded-lg transition-all hover:bg-white/[0.03]"
              style={{ border: `1px solid ${fm.color}30` }}
            >
              <FIcon className="w-5 h-5" style={{ color: fm.color }} />
              <span className="text-sm font-display" style={{ color: fm.color }}>{fm.name}</span>
            </Link>
          );
        })()}
      </div>

      {/* Salary Warning */}
      {salaryDebt > 0 && (
        <div className="flex items-center gap-3 p-4 rounded-lg"
          style={{
            background: 'rgba(255, 102, 0, 0.08)',
            border: '1px solid rgba(255, 102, 0, 0.25)',
          }}
        >
          <AlertTriangle className="w-6 h-6 text-neon-orange flex-shrink-0" />
          <div>
            <p className="text-neon-orange font-semibold text-sm font-display">Salary Debt Outstanding</p>
            <p className="text-sm text-gray-400">You owe {salaryDebt.toLocaleString()} credits in unpaid crew salaries.</p>
          </div>
          <Link to="/crew" className="holo-button-orange ml-auto text-xs">Pay Now</Link>
        </div>
      )}

      {/* Getting Started (fallback factions) */}
      {onboardingCard}

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard icon={Wallet} label="Credits" value={user?.credits?.toLocaleString() || 0} color="orange" />
        <StatCard icon={Rocket} label="Ships" value={data.ships.length} color="cyan" />
        <StatCard icon={Building2} label="Colonies" value={data.colonies.length} color="green" />
        <StatCard icon={Users} label="Crew" value={data.crew.length} color="purple" subtext={`${totalSalary}/day salary`} />
      </div>

      {/* Achievements */}
      <AchievementsPanel />

      {/* Quick Links */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <QuickLinkCard
          to="/planets"
          icon={Globe}
          title="Explore Planets"
          description="Scan sectors for habitable worlds and artifacts"
          color="cyan"
        />
        <QuickLinkCard
          to="/colonies"
          icon={Building2}
          title="Manage Colonies"
          description="Collect resources and upgrade infrastructure"
          color="green"
        />
        <QuickLinkCard
          to="/crew"
          icon={Users}
          title="Hire Crew"
          description="Recruit specialists to enhance your ships"
          color="purple"
        />
        <QuickLinkCard
          to="/map"
          icon={Map}
          title="Galaxy Map"
          description="Navigate sectors and discover new systems"
          color="cyan"
        />
        <QuickLinkCard
          to="/combat"
          icon={Swords}
          title="Combat"
          description="Engage hostile NPCs and defend your territory"
          color="red"
        />
        <QuickLinkCard
          to="/market"
          icon={BarChart3}
          title="Market Data"
          description="Track commodity prices and trade trends"
          color="orange"
        />
      </div>

      {/* Fleet Overview */}
      <div className="holo-panel p-4">
        <div className="flex items-center justify-between mb-1">
          <h2 className="card-header">Your Fleet</h2>
          {data.ships.length > 0 && (
            <Link to="/ships" className="text-xs text-neon-cyan hover:underline flex items-center gap-1">
              View All{data.ships.length > 5 ? ` (${data.ships.length})` : ''} <ArrowRight className="w-3 h-3" />
            </Link>
          )}
        </div>
        <div className="space-y-2">
          {data.ships.length === 0 ? (
            <p className="text-gray-500 text-center py-4 text-sm">No ships found</p>
          ) : (
            data.ships.slice(0, 5).map((ship) => (
              <div key={ship.ship_id}
                className="flex items-center justify-between p-3 rounded-lg transition-all duration-200 hover:bg-white/[0.02]"
                style={{ background: 'rgba(0, 255, 255, 0.02)', border: '1px solid rgba(0, 255, 255, 0.06)' }}
              >
                <div className="flex items-center gap-3">
                  <Rocket className="w-4 h-4 text-neon-cyan" />
                  <div>
                    <p className="font-medium text-white text-sm">{ship.name}</p>
                    <p className="text-xs text-gray-500">{ship.ship_type}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-xs text-gray-400">{ship.currentSector?.name || 'Unknown Sector'}</p>
                  <HullBar current={ship.hull_points} max={ship.max_hull_points} />
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* P5 Item 15: Leaderboard + P5 Item 18: Event Ticker */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Faction Leaderboard */}
        <div className="holo-panel p-4">
          <div className="flex items-center justify-between mb-3">
            <h2 className="card-header text-sm"><Trophy className="w-4 h-4 text-accent-orange" /> Faction Standings</h2>
            <Link to="/faction" className="text-xs text-neon-cyan hover:underline">View All</Link>
          </div>
          {factionLeaderboard.length === 0 ? (
            <p className="text-gray-500 text-center py-4 text-xs">No faction data</p>
          ) : (
            <div className="space-y-1.5">
              {factionLeaderboard.map((f, i) => {
                const meta = FACTION_META[f.faction_name || f.name] || {};
                return (
                  <div key={f.faction_id || f.name || i} className="flex items-center justify-between p-2 rounded-lg"
                    style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.04)' }}>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-mono text-gray-500 w-5 text-right">#{i + 1}</span>
                      <span className="text-sm text-white">{meta.name || f.faction_name || f.name}</span>
                    </div>
                    <span className="text-xs font-mono" style={{ color: meta.color || '#999' }}>
                      {(f.total_power || f.members || f.score || 0).toLocaleString()}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Active Events */}
        <div className="holo-panel p-4">
          <div className="flex items-center justify-between mb-3">
            <h2 className="card-header text-sm"><Calendar className="w-4 h-4 text-accent-orange" /> Active Events</h2>
            <Link to="/events" className="text-xs text-neon-cyan hover:underline">View All</Link>
          </div>
          {activeEvents.length === 0 ? (
            <p className="text-gray-500 text-center py-4 text-xs">No active events</p>
          ) : (
            <div className="space-y-2">
              {activeEvents.slice(0, 3).map(evt => {
                const id = evt.id || evt.event_id;
                const current = evt.current_value || 0;
                const target = evt.target_value || 1;
                const pct = Math.min(100, (current / target) * 100);
                return (
                  <Link key={id} to="/events" className="block p-2.5 rounded-lg hover:bg-white/[0.02] transition-colors"
                    style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,102,0,0.1)' }}>
                    <p className="text-sm text-white truncate">{evt.name || evt.title}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <div className="flex-1 h-1.5 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.06)' }}>
                        <div className="h-full rounded-full" style={{ width: `${pct}%`, background: pct >= 100 ? '#4caf50' : '#ff6600' }} />
                      </div>
                      <span className="text-[10px] text-gray-500 font-mono">{pct.toFixed(0)}%</span>
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* P5 Item 17: Star Parallax — subtle ambient background */}
      <StarParallax />
    </div>
  );
}

function HullBar({ current, max }) {
  const pct = max > 0 ? (current / max) * 100 : 0;
  const color = pct > 60 ? '#00ffff' : pct > 30 ? '#ffc107' : '#f44336';
  return (
    <div className="flex items-center gap-2 mt-1">
      <span className="text-xs text-gray-500">{current}/{max}</span>
      <div className="w-16 h-1.5 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.06)' }}>
        <div className="h-full rounded-full transition-all duration-300"
          style={{ width: `${pct}%`, background: color, boxShadow: `0 0 6px ${color}40` }}
        />
      </div>
    </div>
  );
}

function StatCard({ icon: Icon, label, value, color, subtext }) {
  const themes = {
    cyan:   { glow: 'rgba(0, 255, 255, 0.15)', border: 'rgba(0, 255, 255, 0.2)', text: '#00ffff', icon: 'rgba(0, 255, 255, 0.1)' },
    green:  { glow: 'rgba(76, 175, 80, 0.15)', border: 'rgba(76, 175, 80, 0.2)', text: '#4caf50', icon: 'rgba(76, 175, 80, 0.1)' },
    purple: { glow: 'rgba(139, 92, 246, 0.15)', border: 'rgba(139, 92, 246, 0.2)', text: '#a78bfa', icon: 'rgba(139, 92, 246, 0.1)' },
    orange: { glow: 'rgba(255, 102, 0, 0.15)', border: 'rgba(255, 102, 0, 0.2)', text: '#ff6600', icon: 'rgba(255, 102, 0, 0.1)' },
  };
  const t = themes[color];

  return (
    <div className="holo-panel p-4 flex items-center gap-4"
      style={{ borderColor: t.border }}
    >
      <div className="p-3 rounded-lg" style={{ background: t.icon, border: `1px solid ${t.border}` }}>
        <Icon className="w-5 h-5" style={{ color: t.text }} />
      </div>
      <div>
        <p className="stat-value" style={{ color: t.text }}>{value}</p>
        <p className="stat-label">{label}</p>
        {subtext && <p className="text-xs text-gray-600 mt-0.5">{subtext}</p>}
      </div>
    </div>
  );
}

function GettingStartedCard({ user, ships }) {
  const [dismissed, setDismissed] = useState(() => localStorage.getItem('sw3k_onboarding_dismissed') === 'true');
  const [visited, setVisited] = useState(() => {
    try { return JSON.parse(localStorage.getItem('sw3k_onboarding_steps') || '{}'); }
    catch { return {}; }
  });
  const { progressionData } = useGameSession();

  const playerLevel = progressionData?.player_level || user?.player_level || 1;
  if (dismissed || playerLevel > 2) return null;

  // Auto-detect completion from real game data + fallback to visited flag
  const steps = [
    { key: 'ship', label: 'Check your ship status', link: '/ships', icon: Rocket, done: !!visited.ship || (ships && ships.length > 0) },
    { key: 'map', label: 'Open the galaxy map', link: '/map', icon: Map, done: !!visited.map },
    { key: 'trade', label: 'Make your first trade', link: '/trading', icon: Wallet, done: !!visited.trade || (user?.credits != null && user.credits !== 10000) },
    { key: 'planet', label: 'Scan a planet', link: '/planets', icon: Globe, done: !!visited.planet },
  ];

  const handleStepClick = (key) => {
    const next = { ...visited, [key]: true };
    setVisited(next);
    localStorage.setItem('sw3k_onboarding_steps', JSON.stringify(next));
  };

  const handleDismiss = () => {
    setDismissed(true);
    localStorage.setItem('sw3k_onboarding_dismissed', 'true');
  };

  const doneCount = steps.filter(s => s.done).length;

  return (
    <div className="rounded-lg p-5 relative" style={{
      background: 'rgba(0, 255, 255, 0.04)',
      border: '1px solid rgba(0, 255, 255, 0.2)',
      boxShadow: '0 0 20px rgba(0, 255, 255, 0.05)',
    }}>
      <button onClick={handleDismiss} className="absolute top-3 right-3 text-gray-600 hover:text-gray-400 transition-colors">
        <X className="w-4 h-4" />
      </button>
      <h3 className="text-sm font-display text-neon-cyan mb-1">Getting Started</h3>
      <p className="text-xs text-gray-500 mb-4">
        Complete these steps to begin your journey ({doneCount}/{steps.length})
        <span className="mx-1">·</span>
        <Link to="/wiki?article=guide-new-player" className="text-neon-cyan/60 hover:text-neon-cyan inline-flex items-center gap-1">
          <BookOpen className="w-3 h-3" /> Read the guide
        </Link>
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        {steps.map(step => {
          const StepIcon = step.icon;
          return (
            <Link
              key={step.key}
              to={step.link}
              onClick={() => handleStepClick(step.key)}
              className="flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all hover:bg-white/[0.03]"
              style={{ border: `1px solid ${step.done ? 'rgba(76,175,80,0.2)' : 'rgba(255,255,255,0.05)'}` }}
            >
              {step.done
                ? <CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0" />
                : <Circle className="w-4 h-4 text-gray-600 flex-shrink-0" />
              }
              <StepIcon className="w-4 h-4 text-gray-500 flex-shrink-0" />
              <span className={`text-sm ${step.done ? 'text-gray-500 line-through' : 'text-gray-300'}`}>{step.label}</span>
            </Link>
          );
        })}
      </div>
    </div>
  );
}

function QuickLinkCard({ to, icon: Icon, title, description, color }) {
  const colors = { cyan: '#00ffff', green: '#4caf50', purple: '#a78bfa', red: '#f44336', orange: '#ff6600' };
  const c = colors[color];
  return (
    <Link to={to} className="card group cursor-pointer"
      style={{ borderColor: `${c}15` }}
    >
      <div className="flex items-center justify-between">
        <Icon className="w-7 h-7" style={{ color: c }} />
        <ArrowRight className="w-4 h-4 text-gray-600 group-hover:text-neon-cyan group-hover:translate-x-1 transition-all duration-200" />
      </div>
      <h3 className="text-base font-semibold text-white mt-3 font-display">{title}</h3>
      <p className="text-sm text-gray-500 mt-1">{description}</p>
    </Link>
  );
}

/** P5 Item 17: Ambient star parallax */
function StarParallax() {
  const stars = useMemo(() => {
    const result = [];
    for (let i = 0; i < 60; i++) {
      result.push({
        x: Math.random() * 100,
        y: Math.random() * 200,
        size: 0.5 + Math.random() * 1.5,
        opacity: 0.2 + Math.random() * 0.5,
        layer: i < 20 ? 'slow' : 'fast',
      });
    }
    return result;
  }, []);

  return (
    <div className="star-parallax" aria-hidden="true">
      <svg className="star-parallax-layer star-parallax-layer-slow" viewBox="0 0 100 200" preserveAspectRatio="none">
        {stars.filter(s => s.layer === 'slow').map((s, i) => (
          <circle key={i} cx={s.x} cy={s.y} r={s.size * 0.15} fill="white" opacity={s.opacity} />
        ))}
      </svg>
      <svg className="star-parallax-layer star-parallax-layer-fast" viewBox="0 0 100 200" preserveAspectRatio="none" style={{ opacity: 0.6 }}>
        {stars.filter(s => s.layer === 'fast').map((s, i) => (
          <circle key={i} cx={s.x} cy={s.y} r={s.size * 0.1} fill="#00ffff" opacity={s.opacity * 0.5} />
        ))}
      </svg>
    </div>
  );
}

export default Dashboard;
