import { Routes, Route, Navigate } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { auth } from './services/api';
import Layout from './components/common/Layout';
import Login from './components/common/Login';
import Dashboard from './components/common/Dashboard';
import GalaxyMap from './components/navigation/GalaxyMap';
import SystemView from './components/navigation/SystemView';
import ShipPanel from './components/ship/ShipPanel';
import ShipDesigner from './components/ship/ShipDesigner';
import TradingPage from './components/trading/TradingPage';
import CombatPage from './components/combat/CombatPage';
import CombatHistory from './components/combat/CombatHistory';
import RepairPage from './components/ship/RepairPage';
import PlanetsPage from './components/planets/PlanetsPage';
import ColoniesPage from './components/colonies/ColoniesPage';
import CrewPage from './components/crew/CrewPage';
import AdminPage from './components/admin/AdminPage';

function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (token) {
      auth.getProfile()
        .then(res => setUser(res.data.data))
        .catch(() => localStorage.removeItem('token'))
        .finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, []);

  const handleLogin = (userData, token) => {
    localStorage.setItem('token', token);
    setUser(userData);
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    setUser(null);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-accent-cyan"></div>
      </div>
    );
  }

  if (!user) {
    return <Login onLogin={handleLogin} />;
  }

  return (
    <Layout user={user} onLogout={handleLogout}>
      <Routes>
        <Route path="/" element={<Dashboard user={user} />} />
        <Route path="/map" element={<GalaxyMap user={user} />} />
        <Route path="/system" element={<SystemView user={user} />} />
        <Route path="/ships" element={<ShipPanel user={user} />} />
        <Route path="/designer" element={<ShipDesigner user={user} />} />
        <Route path="/trading" element={<TradingPage user={user} />} />
        <Route path="/combat" element={<CombatPage user={user} />} />
        <Route path="/combat/history" element={<CombatHistory user={user} />} />
        <Route path="/repair" element={<RepairPage user={user} />} />
        <Route path="/planets" element={<PlanetsPage user={user} />} />
        <Route path="/colonies" element={<ColoniesPage user={user} />} />
        <Route path="/crew" element={<CrewPage user={user} />} />
        {user.is_admin && <Route path="/admin" element={<AdminPage user={user} />} />}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Layout>
  );
}

export default App;

