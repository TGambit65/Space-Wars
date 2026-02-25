import { useState } from 'react';
import { X, User, Wallet, Star, Wrench, Crosshair, FlaskConical, Navigation, Rocket, UserMinus, ArrowRightLeft } from 'lucide-react';

const speciesColors = {
  Human: 'from-blue-500 to-cyan-500',
  Vexian: 'from-purple-500 to-pink-500',
  Krynn: 'from-orange-500 to-red-500',
  Zorath: 'from-green-500 to-emerald-500',
  Sylphi: 'from-cyan-400 to-blue-400',
  Grox: 'from-gray-500 to-stone-600',
  Nexari: 'from-indigo-500 to-violet-500',
  Threll: 'from-amber-500 to-yellow-500',
  'Worker Bot': 'from-zinc-400 to-slate-500',
  'Combat Droid': 'from-red-600 to-orange-500',
  'Science Unit': 'from-teal-500 to-cyan-400',
};

const roles = [
  { id: 'Pilot', icon: Navigation, description: 'Improves ship speed and flee chance' },
  { id: 'Engineer', icon: Wrench, description: 'Improves repair efficiency' },
  { id: 'Gunner', icon: Crosshair, description: 'Improves weapon accuracy and damage' },
  { id: 'Scientist', icon: FlaskConical, description: 'Improves scanning and research' },
];

function CrewDetails({ crew, ships, onClose, onDismiss, onAssignRole, onTransfer }) {
  const [selectedRole, setSelectedRole] = useState(crew.assigned_role || '');
  const [targetShip, setTargetShip] = useState('');
  
  const gradient = speciesColors[crew.species] || 'from-gray-500 to-gray-600';

  const handleAssignRole = () => {
    if (selectedRole && selectedRole !== crew.assigned_role) {
      onAssignRole(crew.crew_id, selectedRole);
    }
  };

  const handleTransfer = () => {
    if (targetShip && targetShip !== crew.current_ship_id) {
      onTransfer(crew.crew_id, targetShip);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-space-800 border border-space-600 rounded-xl max-w-lg w-full max-h-[90vh] overflow-auto">
        {/* Header */}
        <div className="p-6 border-b border-space-600">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-4">
              <div className={`w-16 h-16 rounded-full bg-gradient-to-br ${gradient} flex items-center justify-center`}>
                <User className="w-8 h-8 text-white/80" />
              </div>
              <div>
                <h2 className="text-2xl font-bold text-white">{crew.name}</h2>
                <p className="text-gray-400">{crew.species} • Level {crew.level}</p>
              </div>
            </div>
            <button onClick={onClose} className="text-gray-400 hover:text-white p-1">
              <X className="w-6 h-6" />
            </button>
          </div>
        </div>

        {/* Stats */}
        <div className="p-6 grid grid-cols-3 gap-4 border-b border-space-600">
          <div className="text-center">
            <Star className="w-5 h-5 text-accent-cyan mx-auto mb-1" />
            <p className="text-lg font-bold text-white">{crew.level}</p>
            <p className="text-xs text-gray-500">Level</p>
          </div>
          <div className="text-center">
            <p className="text-lg font-bold text-white">{crew.xp || 0}</p>
            <p className="text-xs text-gray-500">Experience</p>
          </div>
          <div className="text-center">
            <Wallet className="w-5 h-5 text-accent-orange mx-auto mb-1" />
            <p className="text-lg font-bold text-white">{crew.salary}</p>
            <p className="text-xs text-gray-500">Daily Salary</p>
          </div>
        </div>

        {/* Current Assignment */}
        {crew.ship && (
          <div className="px-6 py-4 border-b border-space-600">
            <p className="text-sm text-gray-400 mb-2">Currently Assigned To</p>
            <div className="flex items-center gap-3 p-3 rounded-lg bg-space-700/50">
              <Rocket className="w-5 h-5 text-accent-cyan" />
              <div>
                <p className="text-white font-medium">{crew.ship.name}</p>
                <p className="text-xs text-gray-500">{crew.ship.ship_type}</p>
              </div>
            </div>
          </div>
        )}

        {/* Assign Role */}
        <div className="p-6 border-b border-space-600">
          <h3 className="font-semibold text-white mb-3">Assign Role</h3>
          <div className="grid grid-cols-2 gap-2">
            {roles.map(({ id, icon: Icon, description }) => (
              <button
                key={id}
                onClick={() => setSelectedRole(id)}
                className={`p-3 rounded-lg border transition-all text-left ${
                  selectedRole === id
                    ? 'border-accent-purple bg-accent-purple/20'
                    : 'border-space-600 bg-space-700/50 hover:border-space-500'
                }`}
              >
                <Icon className={`w-5 h-5 mb-1 ${selectedRole === id ? 'text-accent-purple' : 'text-gray-400'}`} />
                <p className="text-sm font-medium text-white">{id}</p>
                <p className="text-xs text-gray-500">{description}</p>
              </button>
            ))}
          </div>
          {selectedRole !== crew.assigned_role && (
            <button onClick={handleAssignRole} className="btn btn-primary w-full mt-3">
              Assign as {selectedRole}
            </button>
          )}
        </div>

        {/* Transfer */}
        <div className="p-6 border-b border-space-600">
          <h3 className="font-semibold text-white mb-3 flex items-center gap-2">
            <ArrowRightLeft className="w-5 h-5 text-accent-cyan" /> Transfer to Ship
          </h3>
          <select className="input w-full mb-3" value={targetShip} onChange={(e) => setTargetShip(e.target.value)}>
            <option value="">Select destination ship...</option>
            {ships.filter(s => s.ship_id !== crew.current_ship_id).map(ship => (
              <option key={ship.ship_id} value={ship.ship_id}>{ship.name} ({ship.ship_type})</option>
            ))}
          </select>
          <button onClick={handleTransfer} disabled={!targetShip} className="btn btn-secondary w-full">
            Transfer Crew
          </button>
        </div>

        {/* Dismiss */}
        <div className="p-6">
          <button onClick={() => onDismiss(crew.crew_id)} className="btn btn-danger w-full flex items-center justify-center gap-2">
            <UserMinus className="w-5 h-5" /> Dismiss Crew Member
          </button>
        </div>
      </div>
    </div>
  );
}

export default CrewDetails;

