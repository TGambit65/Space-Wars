import { Globe, Thermometer, Scale, Droplets, Crown, Sparkles } from 'lucide-react';

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

const habitabilityColor = (value) => {
  if (value >= 0.7) return 'text-accent-green';
  if (value >= 0.4) return 'text-accent-orange';
  return 'text-accent-red';
};

function PlanetCard({ planet, onClick, owned }) {
  const gradient = planetColors[planet.type] || 'from-gray-500 to-gray-700';

  return (
    <div
      onClick={onClick}
      className="card hover:border-accent-cyan/50 cursor-pointer transition-all group"
    >
      <div className="flex items-start gap-4">
        {/* Planet Visual */}
        <div className={`w-16 h-16 rounded-full bg-gradient-to-br ${gradient} flex-shrink-0 relative overflow-hidden`}>
          <div className="absolute inset-0 bg-black/20" />
          <div className="absolute w-8 h-8 rounded-full bg-white/10 -top-2 -right-2" />
          {planet.has_artifact && (
            <div className="absolute bottom-0 right-0 p-1 bg-accent-purple rounded-full animate-pulse">
              <Sparkles className="w-3 h-3 text-white" />
            </div>
          )}
        </div>

        {/* Planet Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="font-semibold text-white truncate group-hover:text-accent-cyan transition-colors">
              {planet.name}
            </h3>
            {owned && (
              <span className="badge badge-orange flex items-center gap-1">
                <Crown className="w-3 h-3" /> Owned
              </span>
            )}
          </div>
          <p className="text-sm text-gray-400">{planet.type}</p>
          
          <div className="flex items-center gap-4 mt-2 text-xs">
            <div className="flex items-center gap-1" title="Size">
              <Globe className="w-3.5 h-3.5 text-gray-500" />
              <span className="text-gray-300">{planet.size}</span>
            </div>
            <div className="flex items-center gap-1" title="Gravity">
              <Scale className="w-3.5 h-3.5 text-gray-500" />
              <span className="text-gray-300">{planet.gravity?.toFixed(1)}g</span>
            </div>
            <div className="flex items-center gap-1" title="Habitability">
              <Droplets className="w-3.5 h-3.5 text-gray-500" />
              <span className={habitabilityColor(planet.habitability)}>
                {Math.round((planet.habitability || 0) * 100)}%
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Resources Preview */}
      {planet.resources && planet.resources.length > 0 && (
        <div className="mt-3 pt-3 border-t border-space-600">
          <p className="text-xs text-gray-500 mb-2">Resources</p>
          <div className="flex flex-wrap gap-1">
            {planet.resources.slice(0, 4).map((res, idx) => (
              <span key={idx} className="badge badge-cyan text-xs">
                {res.resource_type}
              </span>
            ))}
            {planet.resources.length > 4 && (
              <span className="badge badge-cyan text-xs">+{planet.resources.length - 4}</span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default PlanetCard;

