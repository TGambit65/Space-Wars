import { useState } from 'react';
import { X, Globe, Scale, Thermometer, Droplets, Package, Building2, Sparkles } from 'lucide-react';
import { colonies } from '../../services/api';

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

function PlanetDetails({ planet, ships, onClose, onColonize }) {
  const [colonyName, setColonyName] = useState(`Colony on ${planet.name}`);
  const [selectedShip, setSelectedShip] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const colonyShips = ships.filter(s => s.ship_type === 'Colony Ship');
  const gradient = planetColors[planet.type] || 'from-gray-500 to-gray-700';

  const handleColonize = async () => {
    if (!selectedShip || !colonyName) return;
    setLoading(true);
    setError('');
    try {
      await colonies.colonize(planet.planet_id, selectedShip, colonyName);
      onColonize?.();
      onClose();
    } catch (err) {
      setError(err.response?.data?.error || 'Colonization failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-space-800 border border-space-600 rounded-xl max-w-2xl w-full max-h-[90vh] overflow-auto">
        {/* Header */}
        <div className="p-6 border-b border-space-600 flex items-start justify-between">
          <div className="flex items-center gap-4">
            <div className={`w-20 h-20 rounded-full bg-gradient-to-br ${gradient} relative overflow-hidden`}>
              <div className="absolute inset-0 bg-black/20" />
              <div className="absolute w-10 h-10 rounded-full bg-white/10 -top-2 -right-2" />
              {planet.has_artifact && (
                <div className="absolute bottom-1 right-1 p-1.5 bg-accent-purple rounded-full animate-pulse">
                  <Sparkles className="w-4 h-4 text-white" />
                </div>
              )}
            </div>
            <div>
              <h2 className="text-2xl font-bold text-white">{planet.name}</h2>
              <p className="text-gray-400">{planet.type} Planet</p>
            </div>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-white p-1">
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Stats */}
        <div className="p-6 grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatItem icon={Globe} label="Size" value={planet.size} />
          <StatItem icon={Scale} label="Gravity" value={`${planet.gravity?.toFixed(2)}g`} />
          <StatItem icon={Thermometer} label="Temperature" value={planet.temperature ? `${planet.temperature}°C` : 'Unknown'} />
          <StatItem icon={Droplets} label="Habitability" value={`${Math.round((planet.habitability || 0) * 100)}%`} color={planet.habitability >= 0.5 ? 'green' : 'orange'} />
        </div>

        {/* Resources */}
        {planet.resources && planet.resources.length > 0 && (
          <div className="px-6 pb-6">
            <h3 className="text-lg font-semibold text-white mb-3 flex items-center gap-2">
              <Package className="w-5 h-5 text-accent-cyan" /> Resources
            </h3>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
              {planet.resources.map((res, idx) => (
                <div key={idx} className="p-3 rounded-lg bg-space-700/50 flex items-center justify-between">
                  <span className="text-white">{res.resource_type}</span>
                  <div className="text-right">
                    <span className="text-sm text-accent-cyan">{res.abundance?.toFixed(1)}x</span>
                    <p className="text-xs text-gray-500">{res.total_quantity?.toLocaleString()} units</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Colonize Section */}
        {!planet.owner_user_id && (
          <div className="p-6 border-t border-space-600 bg-space-700/30">
            <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
              <Building2 className="w-5 h-5 text-accent-green" /> Establish Colony
            </h3>
            
            {error && <p className="text-accent-red text-sm mb-3">{error}</p>}
            
            {colonyShips.length === 0 ? (
              <p className="text-gray-400 text-center py-4">You need a Colony Ship to colonize this planet.</p>
            ) : (
              <div className="space-y-4">
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Colony Name</label>
                  <input type="text" className="input w-full" value={colonyName} onChange={(e) => setColonyName(e.target.value)} />
                </div>
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Select Colony Ship</label>
                  <select className="input w-full" value={selectedShip} onChange={(e) => setSelectedShip(e.target.value)}>
                    <option value="">Choose a ship...</option>
                    {colonyShips.map(ship => (
                      <option key={ship.ship_id} value={ship.ship_id}>{ship.name}</option>
                    ))}
                  </select>
                </div>
                <div className="flex items-center justify-between p-3 rounded-lg bg-space-700">
                  <span className="text-gray-400">Colonization Cost</span>
                  <span className="text-accent-orange font-bold">10,000 credits</span>
                </div>
                <button onClick={handleColonize} disabled={loading || !selectedShip} className="btn btn-success w-full">
                  {loading ? 'Colonizing...' : 'Establish Colony'}
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function StatItem({ icon: Icon, label, value, color = 'cyan' }) {
  const colors = { cyan: 'text-accent-cyan', green: 'text-accent-green', orange: 'text-accent-orange' };
  return (
    <div className="text-center">
      <Icon className={`w-5 h-5 ${colors[color]} mx-auto mb-1`} />
      <p className="text-lg font-semibold text-white">{value}</p>
      <p className="text-xs text-gray-500">{label}</p>
    </div>
  );
}

export default PlanetDetails;

