import { Globe, Anchor, Crosshair, Skull, HelpCircle, Rocket, Navigation } from 'lucide-react';

const PLANET_DOT_COLORS = {
  'Terran': '#4A90D9',
  'Desert': '#D4A574',
  'Ice': '#B8E4F0',
  'Volcanic': '#FF6B35',
  'Gas Giant': '#E8B4A0',
  'Oceanic': '#1E90FF',
  'Barren': '#8B7355',
  'Jungle': '#228B22',
  'Toxic': '#9ACD32',
  'Crystalline': '#E6E6FA'
};

const NPC_STATE_BADGES = {
  attacking:  { label: 'Engaging',   className: 'bg-red-900/60 text-red-300' },
  fleeing:    { label: 'Fleeing',    className: 'bg-yellow-900/60 text-yellow-300' },
  trading:    { label: 'Trading',    className: 'bg-green-900/60 text-green-300' },
  patrolling: { label: 'Patrolling', className: 'bg-blue-900/60 text-blue-300' },
  guarding:   { label: 'Guarding',   className: 'bg-blue-900/60 text-blue-300' },
  pursuing:   { label: 'Pursuing',   className: 'bg-orange-900/60 text-orange-300' },
  docking:    { label: 'Docking',    className: 'bg-cyan-900/60 text-cyan-300' },
};

const SystemEntityBar = ({ systemDetail, selectedEntityId, onEntitySelect, currentShip, neighbors, onShipSelect }) => {
  if (!systemDetail) return null;

  const planets = systemDetail.planets || [];
  const ports = systemDetail.ports || [];
  const npcs = systemDetail.npcs || [];
  const jumpPoints = neighbors || [];

  if (!currentShip && planets.length === 0 && ports.length === 0 && npcs.length === 0 && jumpPoints.length === 0) return null;

  return (
    <div className="absolute bottom-4 left-1/2 -translate-x-1/2 max-w-[calc(100vw-320px)] bg-space-900/90 border border-space-700 rounded-lg backdrop-blur-sm px-3 py-2 pointer-events-auto">
      <div className="flex items-center gap-2 overflow-x-auto scrollbar-thin scrollbar-thumb-space-600">
        {/* Player Ship */}
        {currentShip && (
          <>
            <button
              onClick={() => onShipSelect?.()}
              className={`flex items-center gap-1.5 px-2 py-1 rounded text-xs shrink-0 transition-all ${
                selectedEntityId === 'ship'
                  ? 'bg-space-600 text-white border border-space-500'
                  : 'text-accent-cyan hover:bg-space-700 hover:text-white'
              }`}
            >
              <Rocket className="w-3 h-3 text-accent-cyan shrink-0" />
              <span className="truncate max-w-[100px]">{currentShip.name}</span>
            </button>
            {(planets.length > 0 || ports.length > 0 || npcs.length > 0 || jumpPoints.length > 0) && (
              <div className="w-px h-5 bg-space-600 shrink-0" />
            )}
          </>
        )}

        {/* Planets */}
        {planets.length > 0 && (
          <>
            <span className="text-[10px] text-gray-500 uppercase shrink-0 font-bold tracking-widest">Bodies</span>
            {planets.map(planet => {
              const isScanned = planet.is_scanned;
              return (
                <button
                  key={planet.planet_id}
                  onClick={() => onEntitySelect('planet', planet)}
                  className={`flex items-center gap-1.5 px-2 py-1 rounded text-xs shrink-0 transition-all ${
                    planet.planet_id === selectedEntityId
                      ? 'bg-space-600 text-white border border-space-500'
                      : 'text-gray-300 hover:bg-space-700 hover:text-white'
                  }`}
                >
                  {isScanned ? (
                    <span
                      className="w-2.5 h-2.5 rounded-full inline-block shrink-0"
                      style={{ backgroundColor: PLANET_DOT_COLORS[planet.type] || '#888' }}
                    />
                  ) : (
                    <HelpCircle className="w-3 h-3 text-gray-600 shrink-0" />
                  )}
                  <span className={`truncate max-w-[100px] ${!isScanned ? 'text-gray-500 italic' : ''}`}>
                    {isScanned ? planet.name : `Orbit #${planet.orbital_position}`}
                  </span>
                </button>
              );
            })}
          </>
        )}

        {/* Separator */}
        {planets.length > 0 && (jumpPoints.length > 0 || ports.length > 0 || npcs.length > 0) && (
          <div className="w-px h-5 bg-space-600 shrink-0" />
        )}

        {/* Jump Points — high priority, shown before ports/contacts */}
        {jumpPoints.length > 0 && (
          <>
            <span className="text-[10px] text-gray-500 uppercase shrink-0 font-bold tracking-widest">Jump</span>
            {jumpPoints.map(neighbor => (
              <button
                key={neighbor.sector_id}
                onClick={() => onEntitySelect('jumpPoint', neighbor)}
                className={`flex items-center gap-1.5 px-2 py-1 rounded text-xs shrink-0 transition-all ${
                  neighbor.sector_id === selectedEntityId
                    ? 'bg-space-600 text-white border border-space-500'
                    : 'text-gray-300 hover:bg-space-700 hover:text-white'
                }`}
              >
                <Navigation className={`w-3 h-3 shrink-0 ${
                  (neighbor.lane_class || neighbor.connection_type) === 'wormhole'
                    ? 'text-purple-400'
                    : (neighbor.lane_class || neighbor.connection_type) === 'portal'
                      ? 'text-orange-400'
                      : (neighbor.lane_class || neighbor.connection_type) === 'protected'
                        ? 'text-blue-300'
                        : 'text-cyan-400'
                }`} />
                <span className="truncate max-w-[100px]">{neighbor.name || `Sector ${neighbor.sector_id}`}</span>
              </button>
            ))}
          </>
        )}

        {/* Separator */}
        {(planets.length > 0 || jumpPoints.length > 0) && ports.length > 0 && (
          <div className="w-px h-5 bg-space-600 shrink-0" />
        )}

        {/* Ports */}
        {ports.length > 0 && (
          <>
            <span className="text-[10px] text-gray-500 uppercase shrink-0 font-bold tracking-widest">Ports</span>
            {ports.map(port => (
              <button
                key={port.port_id}
                onClick={() => onEntitySelect('port', port)}
                className={`flex items-center gap-1.5 px-2 py-1 rounded text-xs shrink-0 transition-all ${
                  port.port_id === selectedEntityId
                    ? 'bg-space-600 text-white border border-space-500'
                    : 'text-gray-300 hover:bg-space-700 hover:text-white'
                }`}
              >
                <Anchor className="w-3 h-3 text-cyan-400 shrink-0" />
                <span className="truncate max-w-[100px]">{port.name}</span>
              </button>
            ))}
          </>
        )}

        {/* Separator */}
        {(planets.length > 0 || jumpPoints.length > 0 || ports.length > 0) && npcs.length > 0 && (
          <div className="w-px h-5 bg-space-600 shrink-0" />
        )}

        {/* NPCs */}
        {npcs.length > 0 && (
          <>
            <span className="text-[10px] text-gray-500 uppercase shrink-0 font-bold tracking-widest">Contacts</span>
            {npcs.map(npc => {
              const isHostile = npc.npc_type === 'PIRATE' || npc.npc_type === 'PIRATE_LORD' || npc.npc_type === 'BOUNTY_HUNTER';
              const isFriendly = npc.npc_type === 'TRADER';
              const npcColor = isHostile ? 'text-red-400' : isFriendly ? 'text-green-400' : 'text-yellow-400';
              const stateBadge = NPC_STATE_BADGES[npc.behavior_state];
              return (
                <button
                  key={npc.npc_id}
                  onClick={() => onEntitySelect('npc', npc)}
                  className={`flex items-center gap-1.5 px-2 py-1 rounded text-xs shrink-0 transition-all ${
                    npc.npc_id === selectedEntityId
                      ? 'bg-space-600 text-white border border-space-500'
                      : 'text-gray-300 hover:bg-space-700 hover:text-white'
                  }`}
                >
                  {isHostile ? (
                    <Skull className={`w-3 h-3 ${npcColor} shrink-0`} />
                  ) : (
                    <Crosshair className={`w-3 h-3 ${npcColor} shrink-0`} />
                  )}
                  <span className="truncate max-w-[100px]">{npc.name}</span>
                  {stateBadge && (
                    <span className={`text-[9px] px-1 rounded ${stateBadge.className}`}>
                      {stateBadge.label}
                    </span>
                  )}
                </button>
              );
            })}
          </>
        )}
      </div>
    </div>
  );
};

export default SystemEntityBar;
