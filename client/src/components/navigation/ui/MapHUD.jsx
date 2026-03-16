import { X, Crosshair, Skull, User, Anchor, Globe } from 'lucide-react';

const MapHUD = ({ currentShip, selectedSystem, systemDetail, onClose, onEnterCombat, isCurrentSector }) => {
  if (!selectedSystem) return null;

  return (
    <div className="absolute top-4 right-4 w-80 max-h-[calc(100vh-8rem)] overflow-y-auto bg-space-900/95 border border-space-700 rounded-lg backdrop-blur-sm">
      {/* Header */}
      <div className="flex items-center justify-between p-3 border-b border-space-700">
        <div>
          <h3 className="text-white font-bold text-sm">{selectedSystem.name}</h3>
          <div className="text-xs text-gray-400">
            {selectedSystem.type} System | {selectedSystem.star_class} Star
          </div>
        </div>
        <button onClick={onClose} className="text-gray-400 hover:text-white">
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* System Info */}
      <div className="p-3 border-b border-space-800">
        <div className="grid grid-cols-2 gap-2 text-xs">
          <div>
            <span className="text-gray-500">Hazard:</span>
            <span className={`ml-1 ${selectedSystem.hazard_level > 5 ? 'text-accent-red' : 'text-gray-300'}`}>
              {selectedSystem.hazard_level}/10
            </span>
          </div>
          <div>
            <span className="text-gray-500">Coords:</span>
            <span className="ml-1 text-gray-300">
              {selectedSystem.x_coord?.toFixed(0)}, {selectedSystem.y_coord?.toFixed(0)}
            </span>
          </div>
        </div>
      </div>

      {/* System Detail (loaded when available) */}
      {systemDetail && (
        <>
          {/* Planets */}
          {systemDetail.planets?.length > 0 && (
            <div className="p-3 border-b border-space-800">
              <h4 className="text-xs text-gray-400 uppercase mb-2 flex items-center gap-1">
                <Globe className="w-3 h-3" /> Planets ({systemDetail.planets.length})
              </h4>
              <div className="space-y-1">
                {systemDetail.planets.map(planet => (
                  <div key={planet.planet_id} className="flex justify-between items-center text-xs bg-space-800/50 rounded px-2 py-1">
                    <span className="text-gray-300">{planet.name}</span>
                    <span className="text-gray-500">{planet.type}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Ports */}
          {systemDetail.ports?.length > 0 && (
            <div className="p-3 border-b border-space-800">
              <h4 className="text-xs text-gray-400 uppercase mb-2 flex items-center gap-1">
                <Anchor className="w-3 h-3" /> Ports ({systemDetail.ports.length})
              </h4>
              <div className="space-y-1">
                {systemDetail.ports.map(port => (
                  <div key={port.port_id} className="flex justify-between items-center text-xs bg-space-800/50 rounded px-2 py-1">
                    <span className="text-gray-300">{port.name}</span>
                    <span className="text-gray-500">{port.type}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* NPCs (only in current sector) */}
          {isCurrentSector && systemDetail.npcs?.length > 0 && (
            <div className="p-3 border-b border-space-800">
              <h4 className="text-xs text-gray-400 uppercase mb-2 flex items-center gap-1">
                <Crosshair className="w-3 h-3 text-accent-red" /> Contacts ({systemDetail.npcs.length})
              </h4>
              <div className="space-y-2">
                {systemDetail.npcs.map(npc => (
                  <div key={npc.npc_id} className="bg-space-800 p-2 rounded border border-space-700">
                    <div className="flex justify-between items-start mb-1">
                      <div>
                        <div className="text-white text-xs font-bold">{npc.name}</div>
                        <div className="text-[10px] text-accent-orange">{npc.npc_type}</div>
                      </div>
                      {npc.npc_type === 'PIRATE' || npc.npc_type === 'PIRATE_LORD' ? (
                        <Skull className="w-3 h-3 text-accent-red" />
                      ) : (
                        <User className="w-3 h-3 text-accent-cyan" />
                      )}
                    </div>
                    <div className="flex justify-between text-[10px] text-gray-400 mb-2">
                      <span>Ship: {npc.ship_type}</span>
                      <span>HP: {npc.hull_points}/{npc.max_hull_points}</span>
                    </div>
                    <button
                      onClick={() => onEnterCombat(npc)}
                      className="btn btn-danger w-full text-[10px] py-1"
                    >
                      <Crosshair className="w-3 h-3 inline mr-1" /> Engage
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Neighbors */}
          {systemDetail.neighbors?.length > 0 && (
            <div className="p-3">
              <h4 className="text-xs text-gray-400 uppercase mb-2">
                Connected Systems ({systemDetail.neighbors.length})
              </h4>
              <div className="space-y-1">
                {systemDetail.neighbors.map(n => (
                  <div key={n.sector_id} className="flex justify-between items-center text-xs bg-space-800/50 rounded px-2 py-1">
                    <span className="text-gray-300">{n.name}</span>
                    <span className={`${
                      (n.lane_class || n.connection_type) === 'wormhole'
                        ? 'text-accent-purple'
                        : (n.lane_class || n.connection_type) === 'portal'
                          ? 'text-orange-400'
                          : (n.lane_class || n.connection_type) === 'protected'
                            ? 'text-blue-300'
                            : 'text-gray-500'
                    }`}>
                      {(n.lane_class || n.connection_type) === 'wormhole'
                        ? 'Wormhole'
                        : (n.lane_class || n.connection_type) === 'portal'
                          ? 'Portal'
                          : (n.lane_class || n.connection_type) === 'protected'
                            ? `Safe ${n.travel_time}t`
                            : `${n.travel_time}t`}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      {/* Loading state for detail */}
      {!systemDetail && isCurrentSector && (
        <div className="p-4 text-center text-xs text-gray-500">
          Loading system data...
        </div>
      )}
    </div>
  );
};

export default MapHUD;
