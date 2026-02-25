import { User, Wallet, Star, Wrench, Crosshair, FlaskConical, Navigation, Rocket } from 'lucide-react';

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

const roleIcons = {
  Pilot: Navigation,
  Engineer: Wrench,
  Gunner: Crosshair,
  Scientist: FlaskConical,
};

function CrewCard({ crew, onClick }) {
  const gradient = speciesColors[crew.species] || 'from-gray-500 to-gray-600';
  const RoleIcon = crew.assigned_role ? roleIcons[crew.assigned_role] : null;

  return (
    <div 
      onClick={onClick}
      className="card hover:border-accent-purple/50 cursor-pointer transition-all group"
    >
      <div className="flex items-start gap-4">
        {/* Avatar */}
        <div className="relative">
          <div className={`w-14 h-14 rounded-full bg-gradient-to-br ${gradient} flex items-center justify-center`}>
            <User className="w-7 h-7 text-white/80" />
          </div>
          <div className="absolute -bottom-1 -right-1 px-1.5 py-0.5 bg-space-700 rounded-full border border-space-500 text-xs font-bold text-accent-cyan">
            {crew.level}
          </div>
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-white truncate group-hover:text-accent-purple transition-colors">
            {crew.name}
          </h3>
          <p className="text-sm text-gray-400">{crew.species}</p>
          
          <div className="flex items-center gap-3 mt-2">
            {crew.assigned_role && RoleIcon && (
              <span className="badge badge-purple flex items-center gap-1">
                <RoleIcon className="w-3 h-3" />
                {crew.assigned_role}
              </span>
            )}
            <span className="flex items-center gap-1 text-xs text-accent-orange">
              <Wallet className="w-3 h-3" />
              {crew.salary}/day
            </span>
          </div>
        </div>
      </div>

      {/* Ship Assignment */}
      {crew.ship && (
        <div className="mt-3 pt-3 border-t border-space-600 flex items-center gap-2 text-sm">
          <Rocket className="w-4 h-4 text-accent-cyan" />
          <span className="text-gray-300 truncate">{crew.ship.name}</span>
        </div>
      )}

      {/* XP Progress */}
      <div className="mt-3">
        <div className="flex items-center justify-between text-xs mb-1">
          <span className="text-gray-500 flex items-center gap-1">
            <Star className="w-3 h-3" /> Experience
          </span>
          <span className="text-gray-400">{crew.xp || 0} XP</span>
        </div>
        <div className="progress-bar">
          <div 
            className="progress-fill bg-gradient-to-r from-accent-purple to-accent-cyan" 
            style={{ width: `${Math.min((crew.xp || 0) % 100, 100)}%` }}
          />
        </div>
      </div>
    </div>
  );
}

export default CrewCard;

