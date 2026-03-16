import { getBlock } from '../../engine/BlockRegistry';

const BLOCK_COLORS = {
  stone: '#888888',
  dirt: '#8B6914',
  grass: '#4CAF50',
  sand: '#DDD06A',
  water: '#2196F3',
  ice: '#B3E5FC',
  lava: '#FF5722',
  crystal: '#9C27B0',
  swamp_mud: '#5D6B3B',
  volcanic_rock: '#4A2020',
  metal_plate: '#9E9E9E',
  landing_pad: '#607D8B',
  highland_rock: '#8D6E63',
  wood_log: '#795548',
  leaves: '#66BB6A',
  ore_iron: '#78909C',
  ore_crystal: '#CE93D8',
  ore_fertile: '#A5D6A7',
  ore_thermal: '#FF8A65',
  wall: '#8899AA',
  reinforced_wall: '#667788',
  floor: '#556655',
  window: '#88BBDD',
  door: '#886644',
  lamp: '#FFEE88',
  pipe: '#78909C',
  vent: '#90A4AE',
  terminal: '#4DD0E1',
  storage_crate: '#887766',
  solar_panel: '#1565C0',
  antenna: '#99AACC',
  building_core: '#FF6F00',
  building_wall: '#5D4037',
  building_roof: '#455A64',
};

function getBlockColor(name) {
  return BLOCK_COLORS[name] || '#666666';
}

function VoxelHUD({ playerPos, targetBlock, hotbar, selectedSlot, flyMode }) {
  return (
    <div className="absolute inset-0 pointer-events-none">
      {/* Crosshair */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2">
        <div className="w-6 h-6 relative">
          <div className="absolute top-1/2 left-0 w-full h-px bg-white/70" />
          <div className="absolute left-1/2 top-0 h-full w-px bg-white/70" />
        </div>
      </div>

      {/* Coordinates */}
      {playerPos && (
        <div className="absolute top-4 left-4 font-mono text-xs text-white/70 bg-black/40 px-2 py-1 rounded">
          X: {Math.floor(playerPos.x)} Y: {Math.floor(playerPos.y)} Z: {Math.floor(playerPos.z)}
        </div>
      )}

      {/* Fly mode indicator */}
      {flyMode && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 text-xs text-accent-cyan bg-black/40 px-2 py-1 rounded">
          FLY MODE (F to toggle)
        </div>
      )}

      {/* Back button */}
      <div className="absolute top-4 right-4 pointer-events-auto">
        <button
          onClick={() => window.history.back()}
          className="px-3 py-1.5 text-sm bg-space-800/90 border border-space-600 rounded text-gray-300 hover:text-white hover:border-accent-cyan transition-colors"
        >
          &larr; Back
        </button>
      </div>

      {/* Controls hint */}
      <div className="absolute top-14 right-4 font-mono text-[10px] text-white/40 bg-black/30 px-2 py-1 rounded leading-relaxed">
        <div>WASD - Move</div>
        <div>Mouse - Look</div>
        <div>LClick - Break</div>
        <div>RClick - Place</div>
        <div>1-9 - Select block</div>
        <div>Tab - Inventory</div>
        <div>F - Fly mode</div>
        <div>Space - Jump/Up</div>
        <div>Shift - Sprint/Down</div>
      </div>

      {/* Target block info */}
      {targetBlock?.hit && (
        <div className="absolute bottom-20 left-4 font-mono text-xs text-white/70 bg-black/40 px-2 py-1 rounded">
          {getBlock(targetBlock.blockType)?.name || 'Unknown'}
          <span className="text-white/40 ml-2">
            [{targetBlock.blockPos[0]}, {targetBlock.blockPos[1]}, {targetBlock.blockPos[2]}]
          </span>
        </div>
      )}

      {/* Hotbar */}
      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-1">
        {hotbar.map((blockId, i) => {
          const block = getBlock(blockId);
          const isSelected = i === selectedSlot;
          return (
            <div
              key={i}
              className={`w-12 h-12 rounded border-2 flex flex-col items-center justify-center transition-colors ${
                isSelected
                  ? 'border-accent-cyan bg-space-800/90 shadow-[0_0_8px_rgba(0,255,255,0.3)]'
                  : 'border-space-600/50 bg-space-900/70'
              }`}
            >
              {block && block.id !== 0 ? (
                <div
                  className="w-6 h-6 rounded-sm border border-white/10"
                  style={{ backgroundColor: getBlockColor(block.name) }}
                  title={block.name}
                />
              ) : (
                <div className="w-6 h-6" />
              )}
              <span className="text-[10px] text-gray-500 mt-0.5">{i + 1}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export { getBlockColor };
export default VoxelHUD;
