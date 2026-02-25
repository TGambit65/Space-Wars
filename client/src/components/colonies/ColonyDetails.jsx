import { useState } from 'react';
import { X, Building2, Users, ArrowUp, Package, Trash2, Clock, Globe, Rocket } from 'lucide-react';

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

function ColonyDetails({ colony, ships, onClose, onCollect, onUpgrade, onAbandon }) {
  const [selectedShip, setSelectedShip] = useState('');
  const [loading, setLoading] = useState({ collect: false, upgrade: false });
  
  const planet = colony.planet || {};
  const gradient = planetColors[planet.type] || 'from-gray-500 to-gray-700';
  
  const lastCollect = colony.last_resource_tick ? new Date(colony.last_resource_tick) : null;
  const hoursSinceCollect = lastCollect ? Math.floor((Date.now() - lastCollect) / (1000 * 60 * 60)) : 0;
  const canCollect = hoursSinceCollect >= 1;
  
  // Calculate upgrade cost (exponential)
  const upgradeCost = Math.floor(10000 * Math.pow(1.5, colony.infrastructure_level - 1));
  const isMaxLevel = colony.infrastructure_level >= 10;

  const handleCollect = async () => {
    if (!selectedShip) return;
    setLoading(prev => ({ ...prev, collect: true }));
    await onCollect(colony.colony_id, selectedShip);
    setLoading(prev => ({ ...prev, collect: false }));
  };

  const handleUpgrade = async () => {
    setLoading(prev => ({ ...prev, upgrade: true }));
    await onUpgrade(colony.colony_id);
    setLoading(prev => ({ ...prev, upgrade: false }));
  };

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-space-800 border border-space-600 rounded-xl max-w-2xl w-full max-h-[90vh] overflow-auto">
        {/* Header */}
        <div className="p-6 border-b border-space-600">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-4">
              <div className="relative">
                <div className={`w-16 h-16 rounded-full bg-gradient-to-br ${gradient} relative overflow-hidden`}>
                  <div className="absolute inset-0 bg-black/20" />
                </div>
                <div className="absolute -bottom-1 -right-1 p-1.5 bg-space-700 rounded-full border border-accent-green">
                  <Building2 className="w-4 h-4 text-accent-green" />
                </div>
              </div>
              <div>
                <h2 className="text-2xl font-bold text-white">{colony.name}</h2>
                <p className="text-gray-400 flex items-center gap-1">
                  <Globe className="w-4 h-4" /> {planet.name} • {planet.type}
                </p>
              </div>
            </div>
            <button onClick={onClose} className="text-gray-400 hover:text-white p-1">
              <X className="w-6 h-6" />
            </button>
          </div>
        </div>

        {/* Stats */}
        <div className="p-6 grid grid-cols-3 gap-4">
          <div className="text-center">
            <Users className="w-6 h-6 text-accent-cyan mx-auto mb-1" />
            <p className="text-xl font-bold text-white">{colony.population?.toLocaleString()}</p>
            <p className="text-xs text-gray-500">Population</p>
          </div>
          <div className="text-center">
            <ArrowUp className="w-6 h-6 text-accent-green mx-auto mb-1" />
            <p className="text-xl font-bold text-white">{colony.infrastructure_level}/10</p>
            <p className="text-xs text-gray-500">Infrastructure</p>
          </div>
          <div className="text-center">
            <Clock className="w-6 h-6 text-accent-orange mx-auto mb-1" />
            <p className="text-xl font-bold text-white">{hoursSinceCollect}h</p>
            <p className="text-xs text-gray-500">Since Collection</p>
          </div>
        </div>

        {/* Collect Resources */}
        <div className="px-6 pb-6">
          <div className="p-4 rounded-lg bg-space-700/50 space-y-4">
            <h3 className="font-semibold text-white flex items-center gap-2">
              <Package className="w-5 h-5 text-accent-cyan" /> Collect Resources
            </h3>
            
            {!canCollect ? (
              <p className="text-gray-400 text-center py-2">Resources can only be collected once per hour.</p>
            ) : (
              <>
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Select Ship to Receive Resources</label>
                  <select className="input w-full" value={selectedShip} onChange={(e) => setSelectedShip(e.target.value)}>
                    <option value="">Choose a ship...</option>
                    {ships.map(ship => (
                      <option key={ship.ship_id} value={ship.ship_id}>
                        {ship.name} - {ship.currentSector?.name || 'Unknown'}
                      </option>
                    ))}
                  </select>
                </div>
                <button onClick={handleCollect} disabled={loading.collect || !selectedShip} className="btn btn-primary w-full flex items-center justify-center gap-2">
                  {loading.collect ? <div className="w-5 h-5 border-2 border-space-900 border-t-transparent rounded-full animate-spin" /> : <Package className="w-5 h-5" />}
                  Collect Resources ({hoursSinceCollect}h worth)
                </button>
              </>
            )}
          </div>
        </div>

        {/* Upgrade Infrastructure */}
        <div className="px-6 pb-6">
          <div className="p-4 rounded-lg bg-space-700/50 space-y-4">
            <h3 className="font-semibold text-white flex items-center gap-2">
              <ArrowUp className="w-5 h-5 text-accent-green" /> Upgrade Infrastructure
            </h3>
            <div className="flex items-center justify-between">
              <span className="text-gray-400">Current Level</span>
              <span className="text-white font-bold">{colony.infrastructure_level}/10</span>
            </div>
            <div className="progress-bar"><div className="progress-fill bg-accent-green" style={{ width: `${colony.infrastructure_level * 10}%` }} /></div>
            {isMaxLevel ? (
              <p className="text-accent-green text-center py-2">Maximum level reached!</p>
            ) : (
              <>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-400">Upgrade Cost</span>
                  <span className="text-accent-orange font-bold">{upgradeCost.toLocaleString()} credits</span>
                </div>
                <button onClick={handleUpgrade} disabled={loading.upgrade} className="btn btn-success w-full">
                  {loading.upgrade ? 'Upgrading...' : `Upgrade to Level ${colony.infrastructure_level + 1}`}
                </button>
              </>
            )}
          </div>
        </div>

        {/* Abandon Colony */}
        <div className="px-6 pb-6">
          <button onClick={() => onAbandon(colony.colony_id)} className="btn btn-danger w-full flex items-center justify-center gap-2">
            <Trash2 className="w-5 h-5" /> Abandon Colony
          </button>
        </div>
      </div>
    </div>
  );
}

export default ColonyDetails;

