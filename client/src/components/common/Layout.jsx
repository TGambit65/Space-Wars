import { Link, useLocation } from 'react-router-dom';
import { Home, Globe, Building2, Users, LogOut, Wallet, Rocket, Map, ShoppingCart, Wrench, Hammer, Settings, Crosshair } from 'lucide-react';

const navItems = [
  { path: '/', icon: Home, label: 'Dashboard' },
  { path: '/planets', icon: Globe, label: 'Planets' },
  { path: '/system', icon: Crosshair, label: 'System' },
  { path: '/map', icon: Map, label: 'Sector Map' },
  { path: '/ships', icon: Rocket, label: 'Ships' },
  { path: '/designer', icon: Wrench, label: 'Shipyard' },
  { path: '/repair', icon: Hammer, label: 'Engineering' },
  { path: '/trading', icon: ShoppingCart, label: 'Market' },
  { path: '/colonies', icon: Building2, label: 'Colonies' },
  { path: '/crew', icon: Users, label: 'Crew' },
];

function Layout({ user, onLogout, children }) {
  const location = useLocation();

  return (
    <div className="min-h-screen flex">
      {/* Sidebar */}
      <aside className="w-64 bg-space-800/50 backdrop-blur border-r border-space-600 flex flex-col">
        {/* Logo */}
        <div className="p-4 border-b border-space-600">
          <div className="flex items-center gap-3">
            <Rocket className="w-8 h-8 text-accent-cyan" />
            <div>
              <h1 className="text-lg font-bold text-white">Space Wars</h1>
              <p className="text-xs text-gray-400">3000</p>
            </div>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-4">
          <ul className="space-y-2">
            {navItems.map(({ path, icon: Icon, label }) => {
              const isActive = location.pathname === path;
              return (
                <li key={path}>
                  <Link
                    to={path}
                    className={`flex items-center gap-3 px-3 py-2 rounded-lg transition-all duration-200 ${isActive
                      ? 'bg-accent-cyan/20 text-accent-cyan border border-accent-cyan/30'
                      : 'text-gray-300 hover:bg-space-700 hover:text-white'
                      }`}
                  >
                    <Icon className="w-5 h-5" />
                    <span>{label}</span>
                  </Link>
                </li>
              );
            })}
            {user?.is_admin && (
              <li>
                <Link
                  to="/admin"
                  className={`flex items-center gap-3 px-3 py-2 rounded-lg transition-all duration-200 ${location.pathname === '/admin'
                    ? 'bg-accent-cyan/20 text-accent-cyan border border-accent-cyan/30'
                    : 'text-gray-300 hover:bg-space-700 hover:text-white'
                    }`}
                >
                  <Settings className="w-5 h-5" />
                  <span>Admin</span>
                </Link>
              </li>
            )}
          </ul>
        </nav>

        {/* User Info */}
        <div className="p-4 border-t border-space-600">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm text-gray-400">Credits</span>
            <div className="flex items-center gap-1 text-accent-orange">
              <Wallet className="w-4 h-4" />
              <span className="font-bold">{user?.credits?.toLocaleString() || 0}</span>
            </div>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-white">{user?.username}</span>
            <button
              onClick={onLogout}
              className="text-gray-400 hover:text-accent-red transition-colors"
              title="Logout"
            >
              <LogOut className="w-5 h-5" />
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content - no padding for fullscreen routes like /map */}
      <main className={`flex-1 overflow-auto ${['/map', '/system'].includes(location.pathname) ? '' : 'p-6'}`}>
        {children}
      </main>
    </div>
  );
}

export default Layout;

