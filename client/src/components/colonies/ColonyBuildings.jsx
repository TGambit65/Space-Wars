import { useState, useEffect, useCallback } from 'react';
import { buildings } from '../../services/api';
import { Factory, Zap, Users, ArrowUp, Trash2, Power, Wrench, ChevronDown, ChevronUp, Lock, GitBranch } from 'lucide-react';

const categoryIcons = {
  extraction: '⛏️',
  infrastructure: '🏗️',
  manufacturing: '🏭',
};

const tierColors = {
  1: 'text-gray-400 border-gray-500',
  2: 'text-blue-400 border-blue-500',
  3: 'text-purple-400 border-purple-500',
};

function ConditionBar({ condition }) {
  const pct = Math.round(condition * 100);
  const color = pct > 70 ? '#4caf50' : pct > 30 ? '#ff9800' : '#f44336';
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 bg-space-700 rounded-full overflow-hidden">
        <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: color }} />
      </div>
      <span className="text-xs" style={{ color }}>{pct}%</span>
    </div>
  );
}

function ProductionDisplay({ production }) {
  if (!production) return null;
  const inputs = Object.entries(production.inputs || {});
  const outputs = Object.entries(production.outputs || {});
  if (inputs.length === 0 && outputs.length === 0) return null;

  return (
    <div className="flex items-center gap-1 text-xs flex-wrap">
      {inputs.map(([name, qty]) => (
        <span key={name} className="text-red-400">-{qty} {name}</span>
      ))}
      {inputs.length > 0 && outputs.length > 0 && <span className="text-gray-500">→</span>}
      {outputs.map(([name, qty]) => (
        <span key={name} className="text-green-400">+{qty} {name}</span>
      ))}
    </div>
  );
}

function ColonyBuildings({ colonyId, colony }) {
  const [colonyBuildings, setColonyBuildings] = useState([]);
  const [availableBuildings, setAvailableBuildings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [actionLoading, setActionLoading] = useState(null);
  const [showAvailable, setShowAvailable] = useState(true);

  const fetchData = useCallback(async () => {
    try {
      const [buildingsRes, availableRes] = await Promise.all([
        buildings.getColonyBuildings(colonyId),
        buildings.getAvailable(colonyId),
      ]);
      const bData = buildingsRes.data?.data?.buildings || buildingsRes.data?.buildings || [];
      const aData = availableRes.data?.data?.available || availableRes.data?.available || [];
      setColonyBuildings(bData);
      setAvailableBuildings(aData);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load buildings');
    } finally {
      setLoading(false);
    }
  }, [colonyId]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleAction = async (action, ...args) => {
    const key = `${action}-${args[0] || ''}`;
    setActionLoading(key);
    setError(null);
    try {
      await action(...args);
      await fetchData();
    } catch (err) {
      setError(err.response?.data?.message || 'Action failed');
    } finally {
      setActionLoading(null);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-neon-cyan"></div>
      </div>
    );
  }

  // Power summary
  const totalPower = colonyBuildings.reduce((sum, b) => sum + (b.config?.powerGeneration || 0), 0);
  const totalConsumption = colonyBuildings.filter(b => b.is_active).reduce((sum, b) => sum + (b.config?.powerConsumption || 0), 0);
  const totalWorkforce = colonyBuildings.filter(b => b.is_active).reduce((sum, b) => sum + (b.workforce || 0), 0);

  const buildable = availableBuildings.filter(b => b.canBuild);

  return (
    <div className="space-y-4">
      {error && (
        <div className="p-3 rounded-lg text-sm" style={{ background: 'rgba(244,67,54,0.1)', border: '1px solid rgba(244,67,54,0.3)', color: '#f44336' }}>
          {error}
          <button onClick={() => setError(null)} className="ml-2 underline">dismiss</button>
        </div>
      )}

      {/* Summary Bar */}
      <div className="flex gap-4 text-xs">
        <div className="flex items-center gap-1">
          <Zap className="w-3.5 h-3.5 text-yellow-400" />
          <span className={totalPower >= totalConsumption ? 'text-green-400' : 'text-red-400'}>
            {totalPower - totalConsumption} kW
          </span>
          <span className="text-gray-600">({totalPower}/{totalConsumption})</span>
        </div>
        <div className="flex items-center gap-1">
          <Users className="w-3.5 h-3.5 text-blue-400" />
          <span className={totalWorkforce <= (colony?.population || 0) ? 'text-green-400' : 'text-red-400'}>
            {totalWorkforce}/{colony?.population || 0}
          </span>
          <span className="text-gray-600">workforce</span>
        </div>
        <div className="flex items-center gap-1">
          <Factory className="w-3.5 h-3.5 text-neon-cyan" />
          <span className="text-gray-400">{colonyBuildings.length} buildings</span>
        </div>
      </div>

      {/* Active Buildings */}
      {colonyBuildings.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-sm font-display text-neon-cyan">Active Buildings</h3>
          {colonyBuildings.map(b => {
            const cfg = b.config || {};
            const tierClass = tierColors[cfg.tier] || tierColors[1];

            return (
              <div key={b.building_id} className="p-3 rounded-lg" style={{
                background: b.is_active ? 'rgba(0,255,255,0.03)' : 'rgba(100,100,100,0.05)',
                border: `1px solid ${b.is_active ? 'rgba(0,255,255,0.1)' : 'rgba(100,100,100,0.15)'}`,
                opacity: b.is_active ? 1 : 0.6,
              }}>
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className="text-sm">{categoryIcons[cfg.category] || '🏢'}</span>
                    <span className="text-sm font-medium text-white">{cfg.name || b.building_type.replace(/_/g, ' ')}</span>
                    <span className={`text-[10px] px-1.5 py-0.5 rounded border ${tierClass}`}>T{cfg.tier || b.level}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    {!b.is_active && <span className="text-xs text-gray-500">OFFLINE</span>}
                  </div>
                </div>

                {/* Condition */}
                <div className="mb-2">
                  <ConditionBar condition={b.condition} />
                </div>

                {/* Production */}
                {cfg.production && <div className="mb-2"><ProductionDisplay production={cfg.production} /></div>}

                {/* Stats row */}
                <div className="flex items-center gap-3 text-xs text-gray-500 mb-2">
                  <span className="flex items-center gap-1"><Users className="w-3 h-3" />{b.workforce}</span>
                  {cfg.powerConsumption > 0 && (
                    <span className="flex items-center gap-1 text-red-400"><Zap className="w-3 h-3" />-{cfg.powerConsumption}kW</span>
                  )}
                  {cfg.powerGeneration > 0 && (
                    <span className="flex items-center gap-1 text-green-400"><Zap className="w-3 h-3" />+{cfg.powerGeneration}kW</span>
                  )}
                  {cfg.bonusEffect && (
                    <span className="text-neon-cyan">{cfg.bonusEffect.type}: +{cfg.bonusEffect.value}</span>
                  )}
                </div>

                {/* Action buttons */}
                <div className="flex items-center gap-2 flex-wrap">
                  <button
                    onClick={() => handleAction(
                      b.is_active ? (id) => buildings.toggle(id, false) : (id) => buildings.toggle(id, true),
                      b.building_id
                    )}
                    disabled={actionLoading === `toggle-${b.building_id}`}
                    className="holo-button text-xs flex items-center gap-1"
                  >
                    <Power className="w-3 h-3" />
                    {b.is_active ? 'Deactivate' : 'Activate'}
                  </button>
                  {cfg.upgradesTo && (
                    <button
                      onClick={() => handleAction((id) => buildings.upgrade(id), b.building_id)}
                      disabled={!!actionLoading}
                      className="holo-button text-xs flex items-center gap-1"
                    >
                      <ArrowUp className="w-3 h-3" /> Upgrade
                    </button>
                  )}
                  {b.condition < 1.0 && (
                    <button
                      onClick={() => handleAction((id) => buildings.repair(id), b.building_id)}
                      disabled={!!actionLoading}
                      className="holo-button text-xs flex items-center gap-1"
                    >
                      <Wrench className="w-3 h-3" /> Repair
                    </button>
                  )}
                  <button
                    onClick={() => {
                      if (confirm('Demolish this building? You will receive a 50% refund.')) {
                        handleAction((id) => buildings.demolish(id), b.building_id);
                      }
                    }}
                    disabled={!!actionLoading}
                    className="text-xs text-red-400 hover:text-red-300 flex items-center gap-1 ml-auto"
                  >
                    <Trash2 className="w-3 h-3" /> Demolish
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Available Buildings */}
      <div className="space-y-3">
        <button
          onClick={() => setShowAvailable(!showAvailable)}
          className="text-sm font-display text-neon-cyan flex items-center gap-1 w-full"
        >
          Available Buildings ({buildable.length})
          {showAvailable ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </button>

        {showAvailable && (
          buildable.length === 0 ? (
            <p className="text-gray-500 text-xs text-center py-4">No buildings available to construct</p>
          ) : (
            buildable.map(b => (
              <div key={b.building_type} className="p-3 rounded-lg" style={{ background: 'rgba(255,102,0,0.03)', border: '1px solid rgba(255,102,0,0.1)' }}>
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-sm">{categoryIcons[b.category] || '🏢'}</span>
                      <span className="text-sm font-medium text-white">{b.name}</span>
                      <span className={`text-[10px] px-1.5 py-0.5 rounded border ${tierColors[b.tier] || tierColors[1]}`}>T{b.tier}</span>
                    </div>
                    <div className="flex items-center gap-3 text-xs text-gray-500 mb-1">
                      <span className="text-accent-orange">{b.cost?.toLocaleString()} cr</span>
                      <span><Users className="w-3 h-3 inline" /> {b.workforce}</span>
                      {b.powerConsumption > 0 && <span><Zap className="w-3 h-3 inline text-red-400" /> {b.powerConsumption}kW</span>}
                      {b.powerGeneration > 0 && <span><Zap className="w-3 h-3 inline text-green-400" /> +{b.powerGeneration}kW</span>}
                    </div>
                    <ProductionDisplay production={b.production} />
                    {b.current_count > 0 && (
                      <span className="text-xs text-gray-600">Built: {b.current_count}/{b.maxPerColony}</span>
                    )}
                  </div>
                  <button
                    onClick={() => handleAction((type) => buildings.build(colonyId, type), b.building_type)}
                    disabled={!!actionLoading}
                    className="holo-button-orange text-xs px-3 py-1 ml-3"
                  >
                    {actionLoading === `build-${b.building_type}` ? '...' : 'Build'}
                  </button>
                </div>
              </div>
            ))
          )
        )}

        {/* P5 Item 8: Locked buildings with prerequisites */}
        {(() => {
          const locked = availableBuildings.filter(b => !b.canBuild);
          if (locked.length === 0) return null;
          return (
            <>
              <div className="flex items-center gap-2 mt-2">
                <GitBranch className="w-3.5 h-3.5 text-gray-500" />
                <span className="text-xs text-gray-500 font-display uppercase tracking-wider">Locked ({locked.length})</span>
              </div>
              {locked.map(b => (
                <div key={b.building_type} className="p-3 rounded-lg opacity-60" style={{ background: 'rgba(100,100,100,0.04)', border: '1px solid rgba(100,100,100,0.1)' }}>
                  <div className="flex items-center gap-2 mb-1">
                    <Lock className="w-3.5 h-3.5 text-gray-500" />
                    <span className="text-sm font-medium text-gray-400">{b.name}</span>
                    <span className={`text-[10px] px-1.5 py-0.5 rounded border ${tierColors[b.tier] || tierColors[1]}`}>T{b.tier}</span>
                  </div>
                  <div className="flex flex-wrap gap-2 text-xs text-gray-500">
                    {b.prerequisiteInfrastructure > 0 && (
                      <span className={colony?.infrastructure_level >= b.prerequisiteInfrastructure ? 'text-green-400' : 'text-red-400'}>
                        Infrastructure Lv.{b.prerequisiteInfrastructure}
                      </span>
                    )}
                    {b.prerequisiteTech && (
                      <span className="text-red-400">
                        Tech: {b.prerequisiteTech.replace(/_/g, ' ')}
                      </span>
                    )}
                    {b.reason && <span className="text-gray-600">{b.reason}</span>}
                    <span className="text-accent-orange">{b.cost?.toLocaleString()} cr</span>
                  </div>
                </div>
              ))}
            </>
          );
        })()}
      </div>
    </div>
  );
}

export default ColonyBuildings;
