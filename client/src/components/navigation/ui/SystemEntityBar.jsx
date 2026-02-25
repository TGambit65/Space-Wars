import { Globe, Anchor, Crosshair, Skull, HelpCircle } from 'lucide-react';

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

const SystemEntityBar = ({ systemDetail, selectedEntityId, onEntitySelect }) => {
  if (!systemDetail) return null;

  const planets = systemDetail.planets || [];
  const ports = systemDetail.ports || [];
  const npcs = systemDetail.npcs || [];

  if (planets.length === 0 && ports.length === 0 && npcs.length === 0) return null;

  return (
    <div className="absolute bottom-4 left-1/2 -translate-x-1/2 max-w-[calc(100vw-320px)] bg-space-900/90 border border-space-700 rounded-lg backdrop-blur-sm px-3 py-2 pointer-events-auto">
      <div className="flex items-center gap-2 overflow-x-auto scrollbar-thin scrollbar-thumb-space-600">
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
        {planets.length > 0 && (ports.length > 0 || npcs.length > 0) && (
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
        {(planets.length > 0 || ports.length > 0) && npcs.length > 0 && (
          <div className="w-px h-5 bg-space-600 shrink-0" />
        )}

        {/* NPCs */}
        {npcs.length > 0 && (
          <>
            <span className="text-[10px] text-gray-500 uppercase shrink-0 font-bold tracking-widest">Contacts</span>
            {npcs.map(npc => (
              <button
                key={npc.npc_id}
                onClick={() => onEntitySelect('npc', npc)}
                className={`flex items-center gap-1.5 px-2 py-1 rounded text-xs shrink-0 transition-all ${
                  npc.npc_id === selectedEntityId
                    ? 'bg-space-600 text-white border border-space-500'
                    : 'text-gray-300 hover:bg-space-700 hover:text-white'
                }`}
              >
                {npc.npc_type === 'PIRATE' || npc.npc_type === 'PIRATE_LORD' ? (
                  <Skull className="w-3 h-3 text-red-400 shrink-0" />
                ) : (
                  <Crosshair className="w-3 h-3 text-yellow-400 shrink-0" />
                )}
                <span className="truncate max-w-[100px]">{npc.name}</span>
              </button>
            ))}
          </>
        )}
      </div>
    </div>
  );
};

export default SystemEntityBar;
