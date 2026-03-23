import { useState, useEffect } from 'react';
import { crew as crewApi, ships, ports as portsApi } from '../../services/api';
import { Users, UserPlus, Wallet, AlertCircle, RefreshCw, Rocket, Building, Trash2 } from 'lucide-react';
import CrewCard from './CrewCard';
import WikiLink from '../common/WikiLink';
import CrewDetails from './CrewDetails';
import HireCrewModal from './HireCrewModal';

function CrewPage({ user }) {
  const [myCrew, setMyCrew] = useState([]);
  const [userShips, setUserShips] = useState([]);
  const [selectedCrew, setSelectedCrew] = useState(null);
  const [showHireModal, setShowHireModal] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchData = async () => {
    try {
      const [crewRes, shipsRes] = await Promise.all([
        crewApi.getAll(),
        ships.getAll(),
      ]);
      // Handle different response formats
      setMyCrew(Array.isArray(crewRes.data) ? crewRes.data : (crewRes.data?.crew || []));
      setUserShips(shipsRes.data.data?.ships || []);
    } catch (err) {
      setError('Failed to load crew data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const totalSalary = myCrew.reduce((sum, c) => sum + (c.salary || 0), 0);
  const salaryDebt = user?.crew_salary_due || 0;

  const handlePayDebt = async () => {
    try {
      await crewApi.payDebt();
      window.location.reload(); // Refresh to get updated user credits
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to pay debt');
    }
  };

  const handleDismiss = async (crewId) => {
    if (!confirm('Are you sure you want to dismiss this crew member?')) return;
    try {
      await crewApi.dismiss(crewId);
      setSelectedCrew(null);
      await fetchData();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to dismiss crew');
    }
  };

  const handleAssignRole = async (crewId, role) => {
    try {
      await crewApi.assignRole(crewId, role);
      await fetchData();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to assign role');
    }
  };

  const handleTransfer = async (crewId, targetShipId) => {
    try {
      await crewApi.transfer(crewId, targetShipId);
      await fetchData();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to transfer crew');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-accent-cyan"></div>
      </div>
    );
  }

  const idleCrew = myCrew.filter(c => !c.ship_id);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <Users className="w-7 h-7 text-accent-purple" />
            Crew Management
          </h1>
          <p className="text-gray-400">Hire, manage, and assign crew members to your ships <WikiLink term="crew" className="text-[11px] ml-2">Guide</WikiLink></p>
        </div>
        <div className="flex gap-2">
          {idleCrew.length > 1 && (
            <button
              onClick={async () => {
                if (!confirm(`Dismiss ${idleCrew.length} unassigned crew members?`)) return;
                let dismissed = 0;
                for (const c of idleCrew) {
                  try { await crewApi.dismiss(c.crew_id); dismissed++; } catch { /* skip */ }
                }
                await fetchData();
                if (dismissed > 0) setError('');
              }}
              className="btn btn-secondary flex items-center gap-2 text-accent-red border-accent-red/30 hover:bg-accent-red/10"
            >
              <Trash2 className="w-4 h-4" /> Dismiss Idle ({idleCrew.length})
            </button>
          )}
          <button onClick={fetchData} className="btn btn-secondary flex items-center gap-2">
            <RefreshCw className="w-4 h-4" />
          </button>
          <button onClick={() => setShowHireModal(true)} className="btn btn-primary flex items-center gap-2">
            <UserPlus className="w-4 h-4" /> Hire Crew
          </button>
        </div>
      </div>

      {error && (
        <div className="flex items-center gap-2 p-3 rounded-lg bg-accent-red/10 border border-accent-red/30 text-accent-red">
          <AlertCircle className="w-5 h-5" />
          <span>{error}</span>
          <button onClick={() => setError('')} className="ml-auto text-sm underline">Dismiss</button>
        </div>
      )}

      {/* Salary Warning */}
      {salaryDebt > 0 && (
        <div className="flex items-center gap-3 p-4 rounded-lg bg-accent-orange/10 border border-accent-orange/30">
          <Wallet className="w-6 h-6 text-accent-orange flex-shrink-0" />
          <div className="flex-1">
            <p className="text-accent-orange font-medium">Salary Debt: {salaryDebt.toLocaleString()} credits</p>
            <p className="text-sm text-gray-400">Unpaid crew salaries accumulate interest. Pay off your debt to keep crew morale high.</p>
          </div>
          <button onClick={handlePayDebt} className="btn btn-primary">Pay Debt</button>
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="card flex items-center gap-4">
          <div className="p-3 rounded-lg bg-accent-purple/10 border border-accent-purple/30 text-accent-purple">
            <Users className="w-6 h-6" />
          </div>
          <div>
            <p className="stat-value">{myCrew.length}</p>
            <p className="stat-label">Total Crew</p>
          </div>
        </div>
        <div className="card flex items-center gap-4">
          <div className="p-3 rounded-lg bg-accent-orange/10 border border-accent-orange/30 text-accent-orange">
            <Wallet className="w-6 h-6" />
          </div>
          <div>
            <p className="stat-value">{totalSalary.toLocaleString()}</p>
            <p className="stat-label">Daily Salary</p>
          </div>
        </div>
        <div className="card flex items-center gap-4">
          <div className="p-3 rounded-lg bg-accent-cyan/10 border border-accent-cyan/30 text-accent-cyan">
            <Rocket className="w-6 h-6" />
          </div>
          <div>
            <p className="stat-value">{userShips.length}</p>
            <p className="stat-label">Ships</p>
          </div>
        </div>
      </div>

      {/* Crew List */}
      {myCrew.length === 0 ? (
        <div className="card text-center py-12">
          <Users className="w-16 h-16 text-gray-600 mx-auto mb-4" />
          <h3 className="text-xl font-semibold text-white mb-2">No Crew Hired</h3>
          <p className="text-gray-400 max-w-md mx-auto mb-4">Visit a port to hire crew members for your ships. Different species have unique bonuses!</p>
          <button onClick={() => setShowHireModal(true)} className="btn btn-primary">
            <UserPlus className="w-4 h-4 mr-2" /> Hire Your First Crew
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {myCrew.map(crew => (
            <CrewCard key={crew.crew_id} crew={crew} onClick={() => setSelectedCrew(crew)} />
          ))}
        </div>
      )}

      {/* Modals */}
      {selectedCrew && (
        <CrewDetails crew={selectedCrew} ships={userShips} onClose={() => setSelectedCrew(null)} onDismiss={handleDismiss} onAssignRole={handleAssignRole} onTransfer={handleTransfer} />
      )}
      {showHireModal && (
        <HireCrewModal ships={userShips} onClose={() => setShowHireModal(false)} onHired={fetchData} />
      )}
    </div>
  );
}

export default CrewPage;

