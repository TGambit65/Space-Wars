import { Building2, Users, ArrowUp, Clock, Package } from 'lucide-react';

const planetColors = {
  Terran: 'from-green-600 to-blue-600',
  Desert: 'from-yellow-600 to-orange-600',
  Ice: 'from-cyan-400 to-blue-300',
  Volcanic: 'from-red-600 to-orange-500',
  'Gas Giant': 'from-amber-500 to-purple-600',
  Oceanic: 'from-blue-500 to-cyan-400',
  Barren: 'from-gray-500 to-stone-600',
  Jungle: 'from-green-500 to-emerald-700',
  Toxic: 'from-lime-500 to-purple-500',
  Crystalline: 'from-pink-400 to-purple-400',
};

function ColonyCard({ colony, onClick }) {
  const planet = colony.planet || {};
  const gradient = planetColors[planet.type] || 'from-gray-500 to-gray-700';
  
  // Calculate time since last collection
  const lastCollect = colony.last_resource_tick ? new Date(colony.last_resource_tick) : null;
  const hoursSinceCollect = lastCollect ? Math.floor((Date.now() - lastCollect) / (1000 * 60 * 60)) : 0;
  const canCollect = hoursSinceCollect >= 1;

  return (
    <div 
      onClick={onClick}
      className="card hover:border-accent-green/50 cursor-pointer transition-all group"
    >
      <div className="flex items-start gap-4">
        {/* Planet Visual */}
        <div className="relative">
          <div className={`w-14 h-14 rounded-full bg-gradient-to-br ${gradient} relative overflow-hidden`}>
            <div className="absolute inset-0 bg-black/20" />
          </div>
          <div className="absolute -bottom-1 -right-1 p-1 bg-space-700 rounded-full border border-space-500">
            <Building2 className="w-4 h-4 text-accent-green" />
          </div>
        </div>

        {/* Colony Info */}
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-white truncate group-hover:text-accent-green transition-colors">
            {colony.name}
          </h3>
          <p className="text-sm text-gray-400">{planet.name} • {planet.type}</p>
          
          <div className="flex items-center gap-4 mt-2 text-xs">
            <div className="flex items-center gap-1" title="Population">
              <Users className="w-3.5 h-3.5 text-gray-500" />
              <span className="text-gray-300">{colony.population?.toLocaleString()}</span>
            </div>
            <div className="flex items-center gap-1" title="Infrastructure Level">
              <ArrowUp className="w-3.5 h-3.5 text-gray-500" />
              <span className="text-gray-300">Lvl {colony.infrastructure_level}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Resource Collection Status */}
      <div className="mt-3 pt-3 border-t border-space-600 flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm">
          <Clock className={`w-4 h-4 ${canCollect ? 'text-accent-green' : 'text-gray-500'}`} />
          <span className={canCollect ? 'text-accent-green' : 'text-gray-400'}>
            {canCollect ? 'Ready to collect!' : `${Math.max(0, 60 - (hoursSinceCollect * 60))} min until ready`}
          </span>
        </div>
        {canCollect && (
          <span className="badge badge-green flex items-center gap-1">
            <Package className="w-3 h-3" />
            {hoursSinceCollect}h resources
          </span>
        )}
      </div>

      {/* Infrastructure Progress */}
      <div className="mt-3">
        <div className="flex items-center justify-between text-xs mb-1">
          <span className="text-gray-500">Infrastructure</span>
          <span className="text-gray-400">{colony.infrastructure_level}/10</span>
        </div>
        <div className="progress-bar">
          <div 
            className="progress-fill bg-gradient-to-r from-accent-green to-accent-cyan" 
            style={{ width: `${(colony.infrastructure_level / 10) * 100}%` }}
          />
        </div>
      </div>
    </div>
  );
}

export default ColonyCard;

