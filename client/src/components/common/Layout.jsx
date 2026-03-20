import { Link, useLocation } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { Home, Globe, Building2, Users, LogOut, Wallet, Rocket, Map, ShoppingCart, Wrench, Hammer, Settings, Crosshair, TrendingUp, Boxes, Target, UsersRound, Bot, BarChart3, Swords, BookOpen, Shield, Mail, Flag, Landmark, Calendar, Palette, ChevronDown, ChevronRight, Keyboard, Menu, X, Eye, Leaf } from 'lucide-react';
import StatusBar from './StatusBar';
import useKeyboardShortcuts, { SHORTCUTS } from '../../hooks/useKeyboardShortcuts';
import { useGameSession } from '../../contexts/GameSessionContext';

const FACTION_META = {
  terran_alliance: { name: 'Terran Alliance', color: '#3498db', icon: Shield },
  zythian_swarm: { name: 'Zythian Swarm', color: '#e74c3c', icon: Swords },
  automaton_collective: { name: 'Automaton Collective', color: '#9b59b6', icon: TrendingUp },
  synthesis_accord: { name: 'Synthesis Accord', color: '#d4a017', icon: Eye },
  sylvari_dominion: { name: 'Sylvari Dominion', color: '#2ecc71', icon: Leaf },
};

const coreNavItems = [
  { path: '/', icon: Home, label: 'Dashboard' },
  { path: '/ships', icon: Rocket, label: 'Ships' },
  { path: '/map', icon: Map, label: 'Sector Map' },
  { path: '/system', icon: Crosshair, label: 'System' },
  { path: '/planets', icon: Globe, label: 'Planets' },
  { path: '/trading', icon: ShoppingCart, label: 'Trading' },
  { path: '/combat', icon: Swords, label: 'Combat' },
  { path: '/crew', icon: Users, label: 'Crew' },
  { path: '/progression', icon: TrendingUp, label: 'Progression' },
  { path: '/missions', icon: Target, label: 'Missions' },
  { path: '/messages', icon: Mail, label: 'Messages' },
];

const advancedNavItems = [
  { path: '/designer', icon: Wrench, label: 'Shipyard' },
  { path: '/customizer', icon: Palette, label: 'Customize' },
  { path: '/repair', icon: Hammer, label: 'Engineering' },
  { path: '/market', icon: BarChart3, label: 'Market Data' },
  { path: '/colonies', icon: Building2, label: 'Colonies' },
  { path: '/outposts', icon: Landmark, label: 'Outposts' },
  { path: '/crafting', icon: Boxes, label: 'Crafting' },
  { path: '/faction', icon: Flag, label: 'Faction' },
  { path: '/events', icon: Calendar, label: 'Events' },
  { path: '/corporation', icon: UsersRound, label: 'Corporation' },
  { path: '/automation', icon: Bot, label: 'Automation' },
  { path: '/agent', icon: Bot, label: 'AI Agent' },
  { path: '/wiki', icon: BookOpen, label: 'Wiki' },
];

const SHORTCUT_LABELS = { d: 'Dashboard', s: 'Ships', m: 'Sector Map', v: 'System View', t: 'Trading', c: 'Combat', p: 'Progression', i: 'Messages' };

function Layout({ user, onLogout, children, socketConnected }) {
  const location = useLocation();
  useKeyboardShortcuts();
  const { unreadCount, progressionData } = useGameSession();
  const [showShortcuts, setShowShortcuts] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const userLevel = progressionData?.player_level || user?.player_level || 1;
  const progLoaded = progressionData !== null;
  const isNewPlayer = progLoaded ? userLevel < 3 : false;
  const [advancedExpanded, setAdvancedExpanded] = useState(() =>
    localStorage.getItem('sw3k_nav_expanded') === 'true'
  );

  // UI Scale
  const [uiScale, setUiScale] = useState(() => {
    const saved = localStorage.getItem('ui-scale');
    if (saved) return parseFloat(saved);
    return window.innerWidth < 768 ? 1.15 : 1.0;
  });

  useEffect(() => {
    document.documentElement.style.fontSize = (uiScale * 16) + 'px';
    localStorage.setItem('ui-scale', String(uiScale));
  }, [uiScale]);

  const adjustScale = (delta) => {
    setUiScale(s => {
      const next = Math.round((s + delta) * 100) / 100;
      return Math.max(0.85, Math.min(1.3, next));
    });
  };

  useEffect(() => {
    const handler = () => setShowShortcuts(true);
    window.addEventListener('sw3k:show-shortcuts', handler);
    return () => window.removeEventListener('sw3k:show-shortcuts', handler);
  }, []);

  useEffect(() => { setSidebarOpen(false); }, [location.pathname]);

  const factionMeta = user?.faction ? FACTION_META[user.faction] : null;

  return (
    <div className="min-h-screen flex">
      {/* Mobile hamburger */}
      <button
        onClick={() => setSidebarOpen(true)}
        className="fixed top-3 left-3 z-50 p-2 rounded-lg bg-space-900/90 border border-space-700 text-gray-400 hover:text-white md:hidden"
        aria-label="Open menu"
      >
        <Menu className="w-5 h-5" />
      </button>

      {/* Mobile overlay */}
      {sidebarOpen && (
        <div className="fixed inset-0 bg-black/60 z-40 md:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      {/* Sidebar */}
      <aside className={`w-64 flex flex-col border-r fixed md:static inset-y-0 left-0 z-50 transform transition-transform duration-200 md:translate-x-0 ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}
        style={{
          background: 'rgba(10, 10, 30, 0.95)',
          backdropFilter: 'blur(12px)',
          borderColor: 'var(--sw3-primary-alpha)'
        }}
      >
        {/* Logo */}
        <div className="p-4" style={{ borderBottom: '1px solid var(--sw3-primary-alpha)' }}>
          <div className="flex items-center gap-3">
            <div className="relative">
              <Rocket className="w-8 h-8" style={{ color: 'var(--sw3-primary)' }} />
              <div className="absolute inset-0 blur-sm opacity-40">
                <Rocket className="w-8 h-8" style={{ color: 'var(--sw3-primary)' }} />
              </div>
            </div>
            <div className="flex-1">
              <h1 className="text-lg font-bold text-white font-display tracking-wide">Space Wars</h1>
              <p className="text-xs font-display tracking-widest" style={{ color: 'var(--sw3-primary)' }}>3000</p>
            </div>
            <button onClick={() => setSidebarOpen(false)} className="p-1 text-gray-500 hover:text-white md:hidden" aria-label="Close menu">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Level & XP */}
        {progressionData && (
          <div className="px-4 py-3" style={{ borderBottom: '1px solid var(--sw3-primary-alpha)' }}>
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-xs font-display" style={{ color: 'var(--sw3-primary)' }}>Lv. {progressionData.player_level || 1}</span>
              <span className="text-[10px] text-gray-500">
                {(progressionData.total_xp || 0).toLocaleString()} / {(progressionData.xp_to_next_level || 1000).toLocaleString()} XP
              </span>
            </div>
            <div className="h-1.5 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.06)' }}>
              <div
                className="h-full rounded-full transition-all duration-500"
                style={{
                  width: `${Math.min(((progressionData.total_xp || 0) / (progressionData.xp_to_next_level || 1000)) * 100, 100)}%`,
                  background: 'var(--sw3-primary)',
                  boxShadow: '0 0 6px var(--sw3-primary-glow)',
                }}
              />
            </div>
          </div>
        )}

        {/* Navigation */}
        <nav className="flex-1 p-3 overflow-y-auto" role="navigation" aria-label="Main navigation">
          <ul className="space-y-1">
            {coreNavItems.map(({ path, icon: Icon, label }) => (
              <NavItem key={path} path={path} icon={Icon} label={label} isActive={location.pathname === path}
                hasUnread={label === 'Messages' && unreadCount > 0} unreadCount={unreadCount} />
            ))}
          </ul>

          {/* Advanced Features */}
          {isNewPlayer ? (
            <div className="mt-3">
              <button
                onClick={() => { setAdvancedExpanded(!advancedExpanded); localStorage.setItem('sw3k_nav_expanded', String(!advancedExpanded)); }}
                className="flex items-center gap-2 px-3 py-2 w-full text-xs text-gray-500 hover:text-gray-400 transition-colors"
              >
                {advancedExpanded ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
                <span className="uppercase tracking-wider font-display">More Features</span>
              </button>
              {advancedExpanded && (
                <ul className="space-y-1 mt-1">
                  {advancedNavItems.map(({ path, icon: Icon, label }) => (
                    <NavItem key={path} path={path} icon={Icon} label={label} isActive={location.pathname === path} />
                  ))}
                </ul>
              )}
            </div>
          ) : (
            <>
              <div className="mt-3 mb-1 px-3">
                <span className="text-[10px] text-gray-600 uppercase tracking-wider font-display">Advanced</span>
              </div>
              <ul className="space-y-1">
                {advancedNavItems.map(({ path, icon: Icon, label }) => (
                  <NavItem key={path} path={path} icon={Icon} label={label} isActive={location.pathname === path} />
                ))}
              </ul>
            </>
          )}

          {user?.is_admin && (
            <ul className="space-y-1 mt-3">
              <li>
                <Link
                  to="/admin"
                  className={`flex items-center gap-3 px-3 py-2 rounded-lg transition-all duration-200 text-sm ${location.pathname === '/admin'
                    ? 'text-neon-orange'
                    : 'text-gray-400 hover:text-neon-orange/80 hover:bg-white/[0.03]'
                    }`}
                  style={location.pathname === '/admin' ? {
                    background: 'rgba(255, 102, 0, 0.08)',
                    borderLeft: '2px solid #ff6600',
                    boxShadow: 'inset 0 0 15px rgba(255, 102, 0, 0.05)',
                  } : { borderLeft: '2px solid transparent' }}
                >
                  <Settings className="w-4 h-4" />
                  <span className={location.pathname === '/admin' ? 'font-semibold' : ''}>Admin</span>
                </Link>
              </li>
            </ul>
          )}
        </nav>

        {/* Back to Site + User Info */}
        <div className="p-4" style={{ borderTop: '1px solid var(--sw3-primary-alpha)' }}>
          <a
            href="/"
            className="flex items-center gap-2 px-3 py-2 mb-3 rounded-lg text-sm text-gray-400 hover:text-white hover:bg-white/[0.03] transition-all duration-200"
            style={{ borderLeft: '2px solid transparent' }}
          >
            <Globe className="w-4 h-4" />
            <span>Back to Site</span>
          </a>
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs text-gray-500 uppercase tracking-wider font-display">Credits</span>
            <div className="flex items-center gap-1.5 text-neon-orange">
              <Wallet className="w-3.5 h-3.5" />
              <span className="font-bold font-display text-sm">{user?.credits?.toLocaleString() || 0}</span>
            </div>
          </div>
          {factionMeta && (() => {
            const FIcon = factionMeta.icon;
            return (
              <div className="flex items-center gap-2 mb-2 px-1">
                <FIcon className="w-3.5 h-3.5" style={{ color: 'var(--sw3-primary)' }} />
                <span className="text-xs font-display" style={{ color: 'var(--sw3-primary)' }}>{factionMeta.name}</span>
              </div>
            );
          })()}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {socketConnected !== null && (
                <span className={`w-2 h-2 rounded-full shrink-0 ${socketConnected ? 'bg-green-400 shadow-[0_0_6px_rgba(74,222,128,0.5)]' : 'bg-red-400 shadow-[0_0_6px_rgba(248,113,113,0.5)]'}`} title={socketConnected ? 'Connected' : 'Disconnected'} />
              )}
              <span className="text-sm font-medium text-white">{user?.username}</span>
            </div>
            <button
              onClick={onLogout}
              className="text-gray-500 hover:text-status-danger transition-colors p-1 rounded hover:bg-status-danger/10"
              title="Logout"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
          <div className="flex items-center gap-1 mt-2 text-xs">
            <button onClick={() => adjustScale(-0.15)} className="px-1.5 py-0.5 rounded bg-space-800 text-gray-400 hover:text-white transition-colors" title="Decrease UI scale">A-</button>
            <span className="text-gray-500 min-w-[3ch] text-center">{Math.round(uiScale * 100)}%</span>
            <button onClick={() => adjustScale(0.15)} className="px-1.5 py-0.5 rounded bg-space-800 text-gray-400 hover:text-white transition-colors" title="Increase UI scale">A+</button>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main role="main" aria-label="Page content" className={`flex-1 overflow-auto md:ml-0 ${['/map', '/system', '/wiki'].includes(location.pathname) || location.pathname.startsWith('/planet/') || location.pathname.startsWith('/colony/') ? '' : 'p-6 pt-14 md:pt-6'}`}>
        <div className="animate-fade-in">
          {!['/map', '/system', '/wiki'].includes(location.pathname) && !location.pathname.startsWith('/planet/') && (
            <StatusBar />
          )}
          {children}
        </div>
      </main>

      {/* Keyboard Shortcuts Modal */}
      {showShortcuts && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4" onClick={() => setShowShortcuts(false)} role="dialog" aria-modal="true" aria-label="Keyboard shortcuts">
          <div className="card w-full max-w-sm p-6 space-y-4" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                <Keyboard className="w-5 h-5 text-accent-cyan" /> Keyboard Shortcuts
              </h2>
              <button onClick={() => setShowShortcuts(false)} data-dismiss className="text-gray-500 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="space-y-2">
              {Object.entries(SHORTCUT_LABELS).map(([key, label]) => (
                <div key={key} className="flex items-center justify-between">
                  <span className="text-sm text-gray-300">{label}</span>
                  <kbd className="px-2 py-0.5 rounded text-xs font-mono bg-space-700 border border-space-600 text-accent-cyan">{key.toUpperCase()}</kbd>
                </div>
              ))}
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-300">Close dialogs</span>
                <kbd className="px-2 py-0.5 rounded text-xs font-mono bg-space-700 border border-space-600 text-accent-cyan">ESC</kbd>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-300">Show this help</span>
                <kbd className="px-2 py-0.5 rounded text-xs font-mono bg-space-700 border border-space-600 text-accent-cyan">?</kbd>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function NavItem({ path, icon: Icon, label, isActive, hasUnread, unreadCount }) {
  return (
    <li>
      <Link
        to={path}
        aria-label={label}
        aria-current={isActive ? 'page' : undefined}
        className={`flex items-center gap-3 px-3 py-2 transition-all duration-200 text-sm ${isActive
          ? ''
          : 'text-gray-400 hover:bg-white/[0.03]'
          }`}
        style={{
          borderRadius: 'var(--sw3-border-radius)',
          color: isActive ? 'var(--sw3-primary)' : undefined,
          background: isActive ? 'var(--sw3-primary-alpha)' : undefined,
          borderLeft: isActive ? '2px solid var(--sw3-primary)' : '2px solid transparent',
          boxShadow: isActive ? 'inset 0 0 15px var(--sw3-primary-alpha)' : 'none',
        }}
      >
        <Icon className="w-4 h-4" />
        <span className={`flex-1 ${isActive ? 'font-semibold' : ''}`}>{label}</span>
        {hasUnread && (
          <span className="px-1.5 py-0.5 text-[10px] font-bold rounded-full" style={{ background: 'var(--sw3-primary-alpha)', color: 'var(--sw3-primary)', border: '1px solid var(--sw3-primary)' }}>
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </Link>
    </li>
  );
}

export default Layout;
