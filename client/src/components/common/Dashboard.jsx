import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { ships, colonies, crew as crewApi } from '../../services/api';
import { Rocket, Globe, Building2, Users, ArrowRight, Wallet, AlertTriangle } from 'lucide-react';

function Dashboard({ user }) {
  const [data, setData] = useState({ ships: [], colonies: [], crew: [] });
  const [loading, setLoading] = useState(true);

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
          colonies: coloniesRes.data || [],
          crew: crewRes.data || [],
        });
      } catch (err) {
        console.error('Failed to fetch dashboard data:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  const totalSalary = data.crew.reduce((sum, c) => sum + (c.salary || 0), 0);
  const salaryDebt = user?.crew_salary_due || 0;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-accent-cyan"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Welcome, Commander {user?.username}</h1>
        <p className="text-gray-400">Here's your empire overview</p>
      </div>

      {/* Salary Warning */}
      {salaryDebt > 0 && (
        <div className="flex items-center gap-3 p-4 rounded-lg bg-accent-orange/10 border border-accent-orange/30">
          <AlertTriangle className="w-6 h-6 text-accent-orange flex-shrink-0" />
          <div>
            <p className="text-accent-orange font-medium">Salary Debt Outstanding</p>
            <p className="text-sm text-gray-300">You owe {salaryDebt.toLocaleString()} credits in unpaid crew salaries.</p>
          </div>
          <Link to="/crew" className="btn btn-secondary ml-auto">Pay Now</Link>
        </div>
      )}

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard icon={Wallet} label="Credits" value={user?.credits?.toLocaleString() || 0} color="orange" />
        <StatCard icon={Rocket} label="Ships" value={data.ships.length} color="cyan" />
        <StatCard icon={Building2} label="Colonies" value={data.colonies.length} color="green" />
        <StatCard icon={Users} label="Crew" value={data.crew.length} color="purple" subtext={`${totalSalary}/day salary`} />
      </div>

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
      </div>

      {/* Recent Activity */}
      <div className="card">
        <h2 className="card-header">Your Fleet</h2>
        <div className="space-y-2">
          {data.ships.length === 0 ? (
            <p className="text-gray-400 text-center py-4">No ships found</p>
          ) : (
            data.ships.slice(0, 5).map((ship) => (
              <div key={ship.ship_id} className="flex items-center justify-between p-3 rounded-lg bg-space-700/50">
                <div className="flex items-center gap-3">
                  <Rocket className="w-5 h-5 text-accent-cyan" />
                  <div>
                    <p className="font-medium text-white">{ship.name}</p>
                    <p className="text-sm text-gray-400">{ship.ship_type}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-sm text-gray-300">{ship.currentSector?.name || 'Unknown Sector'}</p>
                  <p className="text-xs text-gray-500">Hull: {ship.hull_points}/{ship.max_hull_points}</p>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

function StatCard({ icon: Icon, label, value, color, subtext }) {
  const colors = {
    cyan: 'text-accent-cyan bg-accent-cyan/10 border-accent-cyan/30',
    green: 'text-accent-green bg-accent-green/10 border-accent-green/30',
    purple: 'text-accent-purple bg-accent-purple/10 border-accent-purple/30',
    orange: 'text-accent-orange bg-accent-orange/10 border-accent-orange/30',
  };

  return (
    <div className="card flex items-center gap-4">
      <div className={`p-3 rounded-lg border ${colors[color]}`}>
        <Icon className="w-6 h-6" />
      </div>
      <div>
        <p className="stat-value">{value}</p>
        <p className="stat-label">{label}</p>
        {subtext && <p className="text-xs text-gray-500">{subtext}</p>}
      </div>
    </div>
  );
}

function QuickLinkCard({ to, icon: Icon, title, description, color }) {
  const colors = { cyan: 'text-accent-cyan', green: 'text-accent-green', purple: 'text-accent-purple' };
  return (
    <Link to={to} className="card hover:border-accent-cyan/50 transition-all group">
      <div className="flex items-center justify-between">
        <Icon className={`w-8 h-8 ${colors[color]}`} />
        <ArrowRight className="w-5 h-5 text-gray-500 group-hover:text-accent-cyan transition-colors" />
      </div>
      <h3 className="text-lg font-semibold text-white mt-3">{title}</h3>
      <p className="text-sm text-gray-400 mt-1">{description}</p>
    </Link>
  );
}

export default Dashboard;

