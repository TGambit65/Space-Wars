import { X, Globe, Anchor, Crosshair, Skull, User, Scan, Flag, Building2, Star, AlertCircle, Orbit, MessageSquare, Navigation, Rocket, Shield, Fuel, Activity, Wrench, Map as MapIcon, Swords } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const PLANET_TYPE_COLORS = {
  'Terran': 'text-blue-400',
  'Desert': 'text-amber-400',
  'Ice': 'text-cyan-300',
  'Volcanic': 'text-orange-500',
  'Gas Giant': 'text-orange-300',
  'Oceanic': 'text-blue-500',
  'Barren': 'text-stone-400',
  'Jungle': 'text-green-500',
  'Toxic': 'text-lime-400',
  'Crystalline': 'text-purple-300'
};

const INTERACTIVE_TYPES = ['TRADER', 'PATROL', 'BOUNTY_HUNTER'];

const SystemInfoPanel = ({ selectedType, selectedEntity, onClose, onScanPlanet, onHailNPC, onJump, sectorId, scanning, moving, currentShip, user, systemData }) => {
  const navigate = useNavigate();
  const getLaneKind = (entity) => entity?.lane_class || entity?.connection_type || 'standard';
  const getLaneLabel = (entity) => {
    const laneKind = getLaneKind(entity);
    if (laneKind === 'wormhole') return 'Wormhole';
    if (laneKind === 'portal') return 'Portal';
    if (laneKind === 'protected') return 'Protected Lane';
    if (laneKind === 'gate') return 'Gate';
    return 'Hyperlane';
  };
  const getLaneColor = (entity) => {
    const laneKind = getLaneKind(entity);
    if (laneKind === 'wormhole') return 'text-purple-400';
    if (laneKind === 'portal') return 'text-orange-400';
    if (laneKind === 'protected') return 'text-blue-300';
    return 'text-cyan-400';
  };

  if (!selectedEntity) return null;

  const isUnscannedPlanet = selectedType === 'planet' && !selectedEntity.is_scanned;

  return (
    <div className="absolute top-4 right-4 w-80 max-h-[calc(100vh-8rem)] overflow-y-auto bg-space-900/95 border border-space-700 rounded-lg backdrop-blur-sm">
      {/* Header */}
      <div className="flex items-center justify-between p-3 border-b border-space-700">
        <div className="flex items-center gap-2">
          {selectedType === 'planet' && <Globe className="w-4 h-4 text-blue-400" />}
          {selectedType === 'port' && <Anchor className="w-4 h-4 text-cyan-400" />}
          {selectedType === 'npc' && <Crosshair className="w-4 h-4 text-red-400" />}
          {selectedType === 'jumpPoint' && <Navigation className="w-4 h-4 text-cyan-400" />}
          {selectedType === 'star' && <Star className="w-4 h-4 text-yellow-400" />}
          {selectedType === 'ship' && <Rocket className="w-4 h-4 text-accent-cyan" />}
          <div>
            <h3 className="text-white font-bold text-sm">
              {isUnscannedPlanet ? 'Signal Detected' : selectedEntity.name}
            </h3>
            <div className="text-xs text-gray-400">
              {isUnscannedPlanet && `Orbit #${selectedEntity.orbital_position}`}
              {selectedType === 'planet' && !isUnscannedPlanet && selectedEntity.type}
              {selectedType === 'port' && `${selectedEntity.type} Port`}
              {selectedType === 'npc' && selectedEntity.npc_type}
              {selectedType === 'jumpPoint' && getLaneLabel(selectedEntity)}
              {selectedType === 'star' && selectedEntity.star_class}
              {selectedType === 'ship' && String(selectedEntity.ship_type || 'Unknown').replace('_', ' ')}
            </div>
          </div>
        </div>
        <button onClick={onClose} className="text-gray-400 hover:text-white">
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Unscanned Planet - Anomaly View */}
      {isUnscannedPlanet && (
        <div className="p-6 text-center">
          <div className="text-blue-500/40 flex justify-center mb-4">
            <AlertCircle className="w-12 h-12" />
          </div>
          <h4 className="text-white font-bold text-xs uppercase tracking-widest mb-2">Anomaly Detected</h4>
          <p className="text-gray-500 text-xs mb-5 leading-relaxed">
            Unidentified planetary body at orbital position #{selectedEntity.orbital_position}.
            Initiate deep scan to reveal composition, atmosphere, and resource data.
          </p>
          <button
            onClick={() => onScanPlanet?.(sectorId)}
            disabled={scanning}
            className="w-full bg-blue-600 hover:bg-blue-500 disabled:bg-blue-800 disabled:text-blue-400 py-3 rounded-lg text-white font-bold text-[10px] tracking-widest uppercase shadow-xl transition-all"
          >
            {scanning ? (
              <span className="flex items-center justify-center gap-2">
                <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Scanning...
              </span>
            ) : (
              <><Scan className="w-3 h-3 inline mr-1" /> Initiate Neural Scan</>
            )}
          </button>
        </div>
      )}

      {/* Scanned Planet Detail */}
      {selectedType === 'planet' && !isUnscannedPlanet && (
        <div className="p-3">
          {/* Status badges */}
          <div className="flex gap-2 mb-3">
            {selectedEntity.habitability >= 0.5 && (
              <span className="text-[10px] font-bold uppercase tracking-wider bg-blue-600 text-white px-2 py-0.5 rounded">Colonizable</span>
            )}
            {['Desert', 'Volcanic', 'Barren', 'Crystalline'].includes(selectedEntity.type) && (
              <span className="text-[10px] font-bold uppercase tracking-wider bg-slate-200 text-slate-900 px-2 py-0.5 rounded">Mineable</span>
            )}
          </div>

          <div className="grid grid-cols-2 gap-2 text-xs mb-3">
            <div>
              <span className="text-gray-500">Type:</span>
              <span className={`ml-1 ${PLANET_TYPE_COLORS[selectedEntity.type] || 'text-gray-300'}`}>
                {selectedEntity.type}
              </span>
            </div>
            <div>
              <span className="text-gray-500">Size:</span>
              <span className="ml-1 text-gray-300">{selectedEntity.size}</span>
            </div>
            <div>
              <span className="text-gray-500">Gravity:</span>
              <span className="ml-1 text-gray-300">{selectedEntity.gravity?.toFixed(2)}g</span>
            </div>
            <div>
              <span className="text-gray-500">Temp:</span>
              <span className="ml-1 text-gray-300">{selectedEntity.temperature}°C</span>
            </div>
            <div>
              <span className="text-gray-500">Habitability:</span>
              <span className="ml-1 text-gray-300">{Math.round((selectedEntity.habitability || 0) * 100)}%</span>
            </div>
            <div>
              <span className="text-gray-500">Orbit:</span>
              <span className="ml-1 text-gray-300">#{selectedEntity.orbital_position}</span>
            </div>
          </div>

          {/* Colony info */}
          {selectedEntity.colony && (
            <div className="bg-space-800 rounded p-2 mb-3 border border-space-700">
              <div className="flex items-center gap-1 text-xs text-green-400 mb-1">
                <Building2 className="w-3 h-3" />
                Colony: {selectedEntity.colony.name}
              </div>
              <div className="grid grid-cols-2 gap-1 text-[10px] text-gray-400">
                <span>Pop: {selectedEntity.colony.population?.toLocaleString()}</span>
                <span>Level: {selectedEntity.colony.infrastructure_level}</span>
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="space-y-2">
            {!selectedEntity.owner_user_id && !selectedEntity.colony && (
              <button
                onClick={() => navigate('/colonies', { state: { colonizePlanet: selectedEntity } })}
                className="btn btn-primary w-full text-xs py-1.5"
              >
                <Flag className="w-3 h-3 inline mr-1" /> Colonize
              </button>
            )}
            {selectedEntity.colony && (
              <button
                onClick={() => navigate('/colonies')}
                className="btn w-full text-xs py-1.5 bg-space-700 hover:bg-space-600 text-white border border-space-600"
              >
                <Building2 className="w-3 h-3 inline mr-1" /> View Colony
              </button>
            )}
            <button
              onClick={() => navigate(`/planet/${selectedEntity.planet_id}`)}
              className="btn w-full text-xs py-1.5 bg-accent-cyan/20 text-accent-cyan border border-accent-cyan/30 hover:bg-accent-cyan/30"
            >
              <Orbit className="w-3 h-3 inline mr-1" /> Enter Orbit
            </button>
          </div>
        </div>
      )}

      {/* Port Detail */}
      {selectedType === 'port' && (
        <div className="p-3">
          <div className="grid grid-cols-2 gap-2 text-xs mb-3">
            <div>
              <span className="text-gray-500">Type:</span>
              <span className="ml-1 text-gray-300">{selectedEntity.type}</span>
            </div>
            <div>
              <span className="text-gray-500">Tax Rate:</span>
              <span className="ml-1 text-gray-300">{Math.round((selectedEntity.tax_rate || 0) * 100)}%</span>
            </div>
          </div>
          {selectedEntity.description && (
            <p className="text-xs text-gray-400 mb-3">{selectedEntity.description}</p>
          )}
          <button
            onClick={() => navigate('/trading')}
            className="btn btn-primary w-full text-xs py-1.5"
          >
            <Anchor className="w-3 h-3 inline mr-1" /> Dock &amp; Trade
          </button>
        </div>
      )}

      {/* NPC Detail */}
      {selectedType === 'npc' && (
        <div className="p-3">
          <div className="flex items-center gap-2 mb-3">
            {selectedEntity.npc_type === 'PIRATE' || selectedEntity.npc_type === 'PIRATE_LORD' ? (
              <Skull className="w-5 h-5 text-red-400" />
            ) : (
              <User className="w-5 h-5 text-cyan-400" />
            )}
            <div>
              <div className="text-white text-sm font-bold">{selectedEntity.name}</div>
              <div className="text-xs text-accent-orange">{selectedEntity.npc_type}</div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2 text-xs mb-3">
            <div>
              <span className="text-gray-500">Ship:</span>
              <span className="ml-1 text-gray-300">{selectedEntity.ship_type}</span>
            </div>
            <div>
              <span className="text-gray-500">Aggression:</span>
              <span className="ml-1 text-gray-300">{selectedEntity.aggression_level}</span>
            </div>
          </div>

          {/* Hull bar */}
          <div className="mb-3">
            <div className="flex justify-between text-[10px] text-gray-400 mb-1">
              <span>Hull</span>
              <span>{selectedEntity.hull_points}/{selectedEntity.max_hull_points}</span>
            </div>
            <div className="w-full bg-space-800 rounded-full h-2">
              <div
                className="h-2 rounded-full transition-all"
                style={{
                  width: `${((selectedEntity.hull_points || 0) / (selectedEntity.max_hull_points || 1)) * 100}%`,
                  backgroundColor: ((selectedEntity.hull_points || 0) / (selectedEntity.max_hull_points || 1)) > 0.5 ? '#10B981' : '#EF4444'
                }}
              />
            </div>
          </div>

          <div className="space-y-2">
            {INTERACTIVE_TYPES.includes(selectedEntity.npc_type) && onHailNPC && (
              <button
                onClick={() => onHailNPC(selectedEntity)}
                className="btn w-full text-xs py-1.5 bg-accent-cyan/20 text-accent-cyan border border-accent-cyan/30 hover:bg-accent-cyan/30"
              >
                <MessageSquare className="w-3 h-3 inline mr-1" /> Hail
              </button>
            )}
            <button
              onClick={() => navigate('/combat', { state: { npc: selectedEntity } })}
              className="btn btn-danger w-full text-xs py-1.5"
            >
              <Crosshair className="w-3 h-3 inline mr-1" /> Engage
            </button>
          </div>
        </div>
      )}

      {/* Jump Point Detail */}
      {selectedType === 'jumpPoint' && (
        <div className="p-3">
          <div className="grid grid-cols-2 gap-2 text-xs mb-3">
            <div>
              <span className="text-gray-500">Destination:</span>
              <span className="ml-1 text-gray-300">{selectedEntity.name || `Sector ${selectedEntity.sector_id}`}</span>
            </div>
            <div>
              <span className="text-gray-500">Star Class:</span>
              <span className="ml-1 text-gray-300">{selectedEntity.star_class || 'Unknown'}</span>
            </div>
            <div>
              <span className="text-gray-500">Connection:</span>
              <span className={`ml-1 ${getLaneColor(selectedEntity)}`}>
                {getLaneLabel(selectedEntity)}
              </span>
            </div>
            <div>
              <span className="text-gray-500">Travel Cost:</span>
              <span className="ml-1 text-gray-300">{selectedEntity.travel_cost || 1} fuel</span>
            </div>
          </div>
          <button
            onClick={() => onJump?.(selectedEntity)}
            disabled={moving}
            className="btn btn-primary w-full text-xs py-1.5 flex items-center justify-center gap-2"
          >
            {moving ? (
              <><div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" /> Jumping...</>
            ) : (
              <><Navigation className="w-3 h-3" /> Jump</>
            )}
          </button>
        </div>
      )}

      {/* Star Detail */}
      {selectedType === 'star' && (
        <div className="p-3">
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div>
              <span className="text-gray-500">Star Class:</span>
              <span className="ml-1 text-gray-300">{selectedEntity.star_class}</span>
            </div>
            <div>
              <span className="text-gray-500">Hazard:</span>
              <span className={`ml-1 ${(selectedEntity.hazard_level || 0) > 5 ? 'text-accent-red' : 'text-gray-300'}`}>
                {selectedEntity.hazard_level}/10
              </span>
            </div>
            <div>
              <span className="text-gray-500">Type:</span>
              <span className="ml-1 text-gray-300">{selectedEntity.type}</span>
            </div>
          </div>
          {selectedEntity.description && (
            <p className="text-xs text-gray-400 mt-2">{selectedEntity.description}</p>
          )}
          {selectedEntity.phenomena && (() => {
            const PHEN_INFO = {
              ion_storm: { desc: 'Reduces shield effectiveness and increases component wear', effects: 'Shields -50%, Degradation +50%', color: '#FFD700' },
              nebula: { desc: 'Dense gas cloud obscuring sensors and increasing fuel consumption', effects: 'Scanner range -50%, Fuel cost +20%', color: '#9B59B6' },
              asteroid_field: { desc: 'Rocky debris with potential hull damage but rich mineral deposits', effects: 'Hull damage risk, Mining +50%', color: '#CD853F' },
              solar_flare: { desc: 'Intense stellar radiation disabling shields temporarily', effects: 'Shields disabled, Weapons +20%', color: '#FF4500' },
              gravity_well: { desc: 'Gravitational anomaly preventing escape', effects: 'Cannot flee, Fuel cost x2', color: '#DC143C' },
            };
            const info = PHEN_INFO[selectedEntity.phenomena.type] || {};
            const phenColor = info.color || '#FFD700';
            return (
              <div className="mt-2 p-2.5 rounded" style={{ background: `${phenColor}10`, border: `1px solid ${phenColor}40` }}>
                <div className="text-xs font-bold uppercase tracking-wider mb-1" style={{ color: phenColor }}>
                  <AlertCircle className="w-3 h-3 inline mr-1" />
                  {selectedEntity.phenomena.type?.replace(/_/g, ' ')}
                </div>
                <p className="text-xs text-gray-400 mb-1">{info.desc}</p>
                {info.effects && <p className="text-[10px] font-mono" style={{ color: phenColor }}>{info.effects}</p>}
              </div>
            );
          })()}
        </div>
      )}

      {/* Player Ships in System */}
      {systemData?.ships?.filter(s => s.owner_user_id !== user?.user_id).length > 0 && (
        <div className="p-3 border-t border-space-700">
          <h3 className="text-xs text-gray-500 uppercase tracking-wider mb-2">Other Commanders</h3>
          <div className="space-y-2">
            {systemData.ships.filter(s => s.owner_user_id !== user?.user_id).map(ship => (
              <div key={ship.ship_id} className="flex items-center justify-between p-2 rounded-lg"
                style={{ background: 'rgba(139, 92, 246, 0.05)', border: '1px solid rgba(139, 92, 246, 0.15)' }}
              >
                <div>
                  <p className="text-sm text-purple-300 font-medium">{ship.name}</p>
                  <p className="text-xs text-gray-500">{String(ship.ship_type || 'Unknown').replace('_', ' ')}</p>
                </div>
                <button
                  onClick={() => navigate('/combat', { state: { pvpTarget: ship } })}
                  className="px-2 py-1 text-xs rounded font-medium bg-red-500/10 text-red-400 border border-red-500/20 hover:bg-red-500/20 transition-colors flex items-center gap-1"
                >
                  <Swords className="w-3 h-3" /> Attack
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Ship Detail */}
      {selectedType === 'ship' && currentShip && (() => {
        const ship = currentShip;
        const pct = (cur, max) => Math.max(0, Math.min(100, (cur / max) * 100));
        return (
          <div className="p-3">
            {/* Status Bars */}
            <div className="space-y-2.5 mb-4">
              <div className="space-y-1">
                <div className="flex justify-between text-[11px]">
                  <span className="text-gray-400 flex items-center gap-1"><Activity className="w-3 h-3 text-accent-red" /> Hull</span>
                  <span className="text-white font-mono">{ship.hull_points}/{ship.max_hull_points}</span>
                </div>
                <div className="w-full bg-space-800 rounded-full h-1.5">
                  <div className="h-1.5 rounded-full bg-accent-red transition-all" style={{ width: `${pct(ship.hull_points, ship.max_hull_points)}%` }} />
                </div>
              </div>
              <div className="space-y-1">
                <div className="flex justify-between text-[11px]">
                  <span className="text-gray-400 flex items-center gap-1"><Shield className="w-3 h-3 text-accent-cyan" /> Shields</span>
                  <span className="text-white font-mono">{ship.shield_points}/{ship.max_shield_points}</span>
                </div>
                <div className="w-full bg-space-800 rounded-full h-1.5">
                  <div className="h-1.5 rounded-full bg-accent-cyan transition-all" style={{ width: `${pct(ship.shield_points, ship.max_shield_points)}%` }} />
                </div>
              </div>
              <div className="space-y-1">
                <div className="flex justify-between text-[11px]">
                  <span className="text-gray-400 flex items-center gap-1"><Fuel className="w-3 h-3 text-accent-orange" /> Fuel</span>
                  <span className="text-white font-mono">{ship.fuel}/{ship.max_fuel}</span>
                </div>
                <div className="w-full bg-space-800 rounded-full h-1.5">
                  <div className="h-1.5 rounded-full bg-accent-orange transition-all" style={{ width: `${pct(ship.fuel, ship.max_fuel)}%` }} />
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2 text-xs mb-3">
              <div>
                <span className="text-gray-500">Cargo:</span>
                <span className="ml-1 text-gray-300">{ship.cargo_used || 0}/{ship.cargo_capacity}</span>
              </div>
              <div>
                <span className="text-gray-500">Sector:</span>
                <span className="ml-1 text-gray-300">{ship.currentSector?.name || ship.current_sector?.name || '—'}</span>
              </div>
            </div>

            {/* Actions */}
            <div className="grid grid-cols-2 gap-2">
              <button onClick={() => navigate('/trading')} className="btn btn-secondary text-xs py-1.5 flex items-center justify-center gap-1">
                <Anchor className="w-3 h-3" /> Trade
              </button>
              <button
                onClick={() => onScanPlanet?.(sectorId)}
                disabled={scanning}
                className="btn btn-secondary text-xs py-1.5 flex items-center justify-center gap-1"
              >
                {scanning ? <><div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" /> Scanning</> : <><Scan className="w-3 h-3" /> Scan</>}
              </button>
              <button onClick={() => navigate('/repair')} className="btn btn-secondary text-xs py-1.5 flex items-center justify-center gap-1">
                <Wrench className="w-3 h-3" /> Repair
              </button>
              <button onClick={() => navigate('/map')} className="btn btn-secondary text-xs py-1.5 flex items-center justify-center gap-1">
                <MapIcon className="w-3 h-3" /> Sector Map
              </button>
            </div>
          </div>
        );
      })()}

      {/* Players in Sector — shown when viewing own ship */}
      {(() => {
        if (selectedType !== 'ship') return null;
        const otherShips = (systemData?.ships || []).filter(s => s.owner_user_id && s.owner_user_id !== user?.user_id);
        if (otherShips.length === 0) return null;
        return (
          <div className="p-3 border-t border-space-700">
            <h4 className="text-[10px] uppercase text-gray-500 font-bold tracking-widest mb-2">Players in Sector</h4>
            <div className="space-y-1.5">
              {otherShips.map(s => (
                <div key={s.ship_id} className="flex items-center gap-2 text-xs">
                  <User className="w-3 h-3 text-accent-cyan shrink-0" />
                  <span className="text-gray-300 truncate">{s.name}</span>
                  <span className="text-gray-600 text-[10px] ml-auto">{(s.ship_type || '').replace('_', ' ')}</span>
                </div>
              ))}
            </div>
          </div>
        );
      })()}
    </div>
  );
};

export default SystemInfoPanel;
