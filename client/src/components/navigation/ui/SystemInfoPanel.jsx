import { X, Globe, Anchor, Crosshair, Skull, User, Scan, Flag, Building2, Star, AlertCircle, Orbit, MessageSquare } from 'lucide-react';
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

const SystemInfoPanel = ({ selectedType, selectedEntity, onClose, onScanPlanet, onHailNPC, sectorId, scanning }) => {
  const navigate = useNavigate();

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
          {selectedType === 'star' && <Star className="w-4 h-4 text-yellow-400" />}
          <div>
            <h3 className="text-white font-bold text-sm">
              {isUnscannedPlanet ? 'Signal Detected' : selectedEntity.name}
            </h3>
            <div className="text-xs text-gray-400">
              {isUnscannedPlanet && `Orbit #${selectedEntity.orbital_position}`}
              {selectedType === 'planet' && !isUnscannedPlanet && selectedEntity.type}
              {selectedType === 'port' && `${selectedEntity.type} Port`}
              {selectedType === 'npc' && selectedEntity.npc_type}
              {selectedType === 'star' && selectedEntity.star_class}
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
        </div>
      )}
    </div>
  );
};

export default SystemInfoPanel;
