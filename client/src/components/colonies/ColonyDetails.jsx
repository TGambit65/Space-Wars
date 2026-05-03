import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { X, Building2, Users, ArrowUp, Package, Trash2, Clock, Globe, Rocket, Sparkles, Factory, Loader, Zap, Box, Battery, Gauge } from 'lucide-react';
import { buildings as buildingsApi } from '../../services/api';
import ColonyWonders from './ColonyWonders';
import ColonyBuildings from './ColonyBuildings';

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
  const [activeTab, setActiveTab] = useState('overview');
  const [timeLeft, setTimeLeft] = useState('');
  const [buildingSummary, setBuildingSummary] = useState(null);

  const planet = colony.planet || {};
  const gradient = planetColors[planet.type] || 'from-gray-500 to-gray-700';

  // Fetch building data for overview summary
  useEffect(() => {
    if (colony.is_developing) return;
    buildingsApi.getColonyBuildings(colony.colony_id)
      .then(res => {
        const bList = res.data?.data?.buildings || res.data?.buildings || [];
        const active = bList.filter(b => b.is_active);
        const powerGen = bList.reduce((s, b) => s + (b.config?.powerGeneration || 0), 0);
        const powerUse = active.reduce((s, b) => s + (b.config?.powerConsumption || 0), 0);
        const workforce = active.reduce((s, b) => s + (b.workforce || 0), 0);
        // Aggregate net production from all active buildings
        const inputs = {};
        const outputs = {};
        active.forEach(b => {
          const prod = b.config?.production;
          if (!prod) return;
          Object.entries(prod.inputs || {}).forEach(([name, qty]) => { inputs[name] = (inputs[name] || 0) + qty; });
          Object.entries(prod.outputs || {}).forEach(([name, qty]) => { outputs[name] = (outputs[name] || 0) + qty; });
        });
        setBuildingSummary({ powerGen, powerUse, workforce, buildingCount: bList.length, inputs, outputs });
      })
      .catch(() => {});
  }, [colony.colony_id, colony.is_developing, activeTab]);

  const isDeveloping = colony.is_developing && colony.develops_at;

  // Countdown timer for developing colonies
  useEffect(() => {
    if (!isDeveloping) return;
    const update = () => {
      const remaining = new Date(colony.develops_at) - Date.now();
      if (remaining <= 0) { setTimeLeft('Complete!'); return; }
      const h = Math.floor(remaining / 3600000);
      const m = Math.floor((remaining % 3600000) / 60000);
      const s = Math.floor((remaining % 60000) / 1000);
      setTimeLeft(`${h}h ${m}m ${s}s`);
    };
    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, [isDeveloping, colony.develops_at]);

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
            <div className="flex items-center gap-2">
              <Link
                to={`/colony/${colony.colony_id}/surface`}
                className="flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-lg bg-accent-cyan/10 text-accent-cyan border border-accent-cyan/20 hover:bg-accent-cyan/20 transition-colors"
                onClick={onClose}
              >
                <Box className="w-4 h-4" /> Surface View
              </Link>
              <button onClick={onClose} className="text-gray-400 hover:text-white p-1">
                <X className="w-6 h-6" />
              </button>
            </div>
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

        {isDeveloping ? (
          /* Development in progress — show countdown, block all actions except abandon */
          <div className="p-6 space-y-6">
            <div className="p-6 rounded-lg bg-space-700/50 text-center space-y-4 border border-accent-orange/30">
              <Loader className="w-10 h-10 text-accent-orange mx-auto animate-spin" style={{ animationDuration: '3s' }} />
              <h3 className="text-xl font-bold text-accent-orange">Colony Developing...</h3>
              <p className="text-3xl font-mono text-white">{timeLeft}</p>
              <p className="text-sm text-gray-400">
                The colony is being established. Buildings, resource collection, and wonders are unavailable until development completes.
              </p>
            </div>
            <button onClick={() => onAbandon(colony.colony_id)} className="btn btn-danger w-full flex items-center justify-center gap-2">
              <Trash2 className="w-5 h-5" /> Abandon Colony
            </button>
          </div>
        ) : (
          <>
            {/* Tabs */}
            <div className="flex gap-1 px-6 border-b" style={{ borderColor: 'rgba(0,255,255,0.1)' }}>
              {[
                { id: 'overview', label: 'Overview' },
                { id: 'buildings', label: 'Buildings', icon: Factory },
                { id: 'wonders', label: 'Wonders', icon: Sparkles },
              ].map(t => (
                <button key={t.id} onClick={() => setActiveTab(t.id)}
                  className={`px-4 py-2 text-sm transition-all flex items-center gap-1.5 ${activeTab === t.id ? 'text-neon-cyan font-semibold' : 'text-gray-500 hover:text-gray-300'}`}
                  style={activeTab === t.id ? { borderBottom: '2px solid #00ffff' } : {}}
                >
                  {t.icon && <t.icon className="w-3.5 h-3.5" />}
                  {t.label}
                </button>
              ))}
            </div>

            {activeTab === 'overview' && (
              <>
                {/* Building Economy Summary */}
                {buildingSummary && buildingSummary.buildingCount > 0 && (
                  <div className="px-6 pt-4">
                    <div className="p-4 rounded-lg bg-space-700/50 space-y-3">
                      <h3 className="font-semibold text-white flex items-center gap-2">
                        <Gauge className="w-5 h-5 text-accent-orange" /> Colony Economy
                      </h3>
                      <div className="grid grid-cols-2 gap-3">
                        {/* Power Balance */}
                        <div className="p-3 rounded-lg" style={{ background: 'rgba(255,204,0,0.04)', border: '1px solid rgba(255,204,0,0.12)' }}>
                          <div className="flex items-center gap-1.5 mb-2">
                            <Battery className="w-3.5 h-3.5 text-yellow-400" />
                            <span className="text-xs text-gray-400">Power Balance</span>
                          </div>
                          <div className="text-lg font-bold font-mono" style={{ color: buildingSummary.powerGen >= buildingSummary.powerUse ? '#4caf50' : '#f44336' }}>
                            {buildingSummary.powerGen - buildingSummary.powerUse} kW
                          </div>
                          <div className="h-1.5 rounded-full overflow-hidden mt-1.5" style={{ background: 'rgba(255,255,255,0.06)' }}>
                            <div className="h-full rounded-full transition-all" style={{
                              width: `${buildingSummary.powerGen > 0 ? Math.min((buildingSummary.powerUse / buildingSummary.powerGen) * 100, 100) : 0}%`,
                              background: buildingSummary.powerUse <= buildingSummary.powerGen ? '#4caf50' : '#f44336',
                            }} />
                          </div>
                          <div className="text-[10px] text-gray-500 mt-1">{buildingSummary.powerUse} / {buildingSummary.powerGen} kW used</div>
                        </div>
                        {/* Workforce Usage */}
                        <div className="p-3 rounded-lg" style={{ background: 'rgba(59,130,246,0.04)', border: '1px solid rgba(59,130,246,0.12)' }}>
                          <div className="flex items-center gap-1.5 mb-2">
                            <Users className="w-3.5 h-3.5 text-blue-400" />
                            <span className="text-xs text-gray-400">Workforce</span>
                          </div>
                          <div className="text-lg font-bold font-mono" style={{ color: buildingSummary.workforce <= (colony.population || 0) ? '#4caf50' : '#f44336' }}>
                            {buildingSummary.workforce} / {colony.population || 0}
                          </div>
                          <div className="h-1.5 rounded-full overflow-hidden mt-1.5" style={{ background: 'rgba(255,255,255,0.06)' }}>
                            <div className="h-full rounded-full transition-all" style={{
                              width: `${(colony.population || 0) > 0 ? Math.min((buildingSummary.workforce / colony.population) * 100, 100) : 0}%`,
                              background: buildingSummary.workforce <= (colony.population || 0) ? '#3b82f6' : '#f44336',
                            }} />
                          </div>
                          <div className="text-[10px] text-gray-500 mt-1">{Math.max(0, (colony.population || 0) - buildingSummary.workforce)} available</div>
                        </div>
                      </div>
                      {/* Net Building Production */}
                      {(Object.keys(buildingSummary.outputs).length > 0 || Object.keys(buildingSummary.inputs).length > 0) && (
                        <div className="pt-2 border-t" style={{ borderColor: 'rgba(255,255,255,0.06)' }}>
                          <div className="text-xs text-gray-400 mb-1.5">Building Production (per tick)</div>
                          <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs">
                            {Object.entries(buildingSummary.outputs).map(([name, qty]) => {
                              const consumed = buildingSummary.inputs[name] || 0;
                              const net = qty - consumed;
                              return (
                                <span key={name} className="flex items-center gap-1">
                                  <span className="text-gray-300">{name}:</span>
                                  <span className="text-green-400">+{qty}</span>
                                  {consumed > 0 && <span className="text-red-400">-{consumed}</span>}
                                  <span className="font-mono" style={{ color: net >= 0 ? '#4caf50' : '#f44336' }}>(net {net >= 0 ? '+' : ''}{net})</span>
                                </span>
                              );
                            })}
                            {Object.entries(buildingSummary.inputs)
                              .filter(([name]) => !buildingSummary.outputs[name])
                              .map(([name, qty]) => (
                                <span key={name} className="flex items-center gap-1">
                                  <span className="text-gray-300">{name}:</span>
                                  <span className="text-red-400">-{qty}</span>
                                </span>
                              ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Resource Extraction Overview */}
                {planet.resources?.length > 0 && (
                  <div className="px-6 pt-4">
                    <div className="p-4 rounded-lg bg-space-700/50 space-y-3">
                      <h3 className="font-semibold text-white flex items-center gap-2">
                        <Zap className="w-5 h-5 text-neon-cyan" /> Production Overview
                      </h3>
                      <div className="grid grid-cols-2 gap-2">
                        {planet.resources.map(r => {
                          const remaining = (r.total_quantity || 0) - (r.extracted_quantity || 0);
                          const pct = r.total_quantity > 0 ? (remaining / r.total_quantity) * 100 : 0;
                          const infraBonus = 1 + ((colony.infrastructure_level || 1) - 1) * 0.1;
                          const popBonus = Math.min(1 + (colony.population || 0) / 1000, 2.0);
                          const ratePerHour = Math.round((r.abundance || 1) * 1.0 * infraBonus * popBonus * 10) / 10;
                          return (
                            <div key={r.planet_resource_id || r.resource_type} className="p-2.5 rounded-lg" style={{ background: 'rgba(0,255,255,0.03)', border: '1px solid rgba(0,255,255,0.08)' }}>
                              <div className="flex items-center justify-between mb-1">
                                <span className="text-xs text-white font-medium">{r.resource_type}</span>
                                <span className="text-[10px] text-neon-cyan font-mono">~{ratePerHour}/hr</span>
                              </div>
                              <div className="h-1.5 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.06)' }}>
                                <div className="h-full rounded-full transition-all" style={{
                                  width: `${pct}%`,
                                  background: pct > 50 ? '#00ffff' : pct > 20 ? '#ffc107' : '#f44336',
                                }} />
                              </div>
                              <div className="flex justify-between mt-1">
                                <span className="text-[10px] text-gray-500">x{r.abundance?.toFixed(1)} abundance</span>
                                <span className="text-[10px] text-gray-500">{remaining.toLocaleString()} remaining</span>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                )}

                {/* Collect Resources */}
                <div className="px-6 pt-4 pb-6">
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
              </>
            )}

            {activeTab === 'buildings' && (
              <div className="px-6 py-4">
                <ColonyBuildings colonyId={colony.colony_id} colony={colony} />
              </div>
            )}

            {activeTab === 'wonders' && (
              <div className="px-6 py-4">
                <ColonyWonders colonyId={colony.colony_id} />
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

export default ColonyDetails;

