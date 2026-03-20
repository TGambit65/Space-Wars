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

const PREVIEW_MARKER_STYLES = {
  cyan: 'border-cyan-300/50 bg-cyan-500/10 text-cyan-100',
  amber: 'border-amber-300/50 bg-amber-500/10 text-amber-100',
  violet: 'border-violet-300/50 bg-violet-500/10 text-violet-100',
};

function VoxelHUD({
  playerPos,
  targetBlock,
  hotbar = [],
  selectedSlot = 0,
  flyMode,
  profile,
  previewMode = false,
  previewMarkers = [],
  inputState = {},
  showHotbar = true,
  colonyId = null,
}) {
  const runtimeHints = profile?.runtimeHints || [];
  const previewHints = profile?.previewHints || [];
  const previewTitle = profile?.previewTitle || 'Traversal preview';
  const previewPrompt = profile?.previewPrompt || 'Click scene or press A/Start';
  const previewLabel = profile?.previewLabel || 'Traversal Preview';
  const allowFly = inputState.allowFly ?? profile?.controls?.allowFly ?? false;

  return (
    <div className="absolute inset-0 pointer-events-none">
      {/* Crosshair */}
      {!previewMode && (
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2">
          <div className="w-6 h-6 relative">
            <div className="absolute top-1/2 left-0 w-full h-px bg-white/70" />
            <div className="absolute left-1/2 top-0 h-full w-px bg-white/70" />
          </div>
        </div>
      )}

      {/* Coordinates */}
      {playerPos && (
        <div className="absolute top-4 left-4 font-mono text-xs text-white/70 bg-black/40 px-2 py-1 rounded">
          X: {Math.floor(playerPos.x)} Y: {Math.floor(playerPos.y)} Z: {Math.floor(playerPos.z)}
        </div>
      )}

      {/* Fly mode indicator */}
      {allowFly && flyMode && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 text-xs text-accent-cyan bg-black/40 px-2 py-1 rounded">
          FLY MODE (F to toggle)
        </div>
      )}

      {/* Navigation buttons */}
      <div className="absolute top-4 right-4 pointer-events-auto flex gap-2">
        {colonyId && (
          <button
            onClick={() => { window.location.href = `/colony/${colonyId}/surface`; }}
            className="px-3 py-1.5 text-sm bg-space-800/90 border border-blue-500/40 rounded text-blue-400 hover:text-blue-300 hover:border-blue-400/60 transition-colors"
            title="Return to 2D colony map"
          >
            &#9635; 2D Map
          </button>
        )}
        <button
          onClick={() => window.history.back()}
          className="px-3 py-1.5 text-sm bg-space-800/90 border border-space-600 rounded text-gray-300 hover:text-white hover:border-accent-cyan transition-colors"
        >
          &larr; Back
        </button>
      </div>

      {/* Controls hint */}
      <div className="absolute top-14 right-4 font-mono text-[10px] text-white/40 bg-black/30 px-2 py-1 rounded leading-relaxed">
        {previewMode ? (
          <>
            <div>{previewTitle}</div>
            <div>{previewPrompt}</div>
            {previewHints.map((hint) => (
              <div key={hint}>{hint}</div>
            ))}
          </>
        ) : (
          <>
            {runtimeHints.map((hint) => (
              <div key={hint}>{hint}</div>
            ))}
          </>
        )}
      </div>

      {previewMode && (
        <div className="absolute left-1/2 top-10 -translate-x-1/2 rounded-full border border-cyan-400/30 bg-slate-950/60 px-4 py-2 text-[11px] uppercase tracking-[0.28em] text-cyan-200/80 backdrop-blur-sm">
          {previewLabel}
        </div>
      )}

      {previewMode && previewMarkers.map((marker) => (
        <div
          key={marker.key}
          className="absolute"
          style={{ left: marker.x, top: marker.y }}
        >
          <div className="relative -translate-x-1/2 -translate-y-full">
            <div className={`mx-auto h-8 w-px ${marker.offscreen ? 'bg-white/55' : 'bg-white/30'}`} />
            {marker.offscreen && (
              <div className="mx-auto mb-1 h-0 w-0 border-l-[6px] border-r-[6px] border-b-[9px] border-l-transparent border-r-transparent border-b-white/70" />
            )}
            <div
              className={`rounded-full border px-3 py-1 text-[10px] font-medium uppercase tracking-[0.22em] backdrop-blur-sm ${marker.offscreen ? 'shadow-[0_0_18px_rgba(255,255,255,0.16)]' : ''} ${PREVIEW_MARKER_STYLES[marker.color] || PREVIEW_MARKER_STYLES.cyan}`}
            >
              {marker.label}
            </div>
          </div>
        </div>
      ))}

      {/* Target block info */}
      {targetBlock?.hit && (
        <div className="absolute bottom-20 left-4 font-mono text-xs text-white/70 bg-black/40 px-2 py-1 rounded">
          {getBlock(targetBlock.blockType)?.name || 'Unknown'}
          <span className="text-white/40 ml-2">
            [{targetBlock.blockPos[0]}, {targetBlock.blockPos[1]}, {targetBlock.blockPos[2]}]
          </span>
        </div>
      )}

      {inputState.gamepadActive && (
        <div className="absolute bottom-20 right-4 rounded-full border border-cyan-400/30 bg-slate-950/60 px-3 py-1 text-[10px] uppercase tracking-[0.18em] text-cyan-200/80 backdrop-blur-sm">
          Gamepad Ready
        </div>
      )}

      {/* Hotbar */}
      {showHotbar && hotbar.length > 0 && (
      <div className={`absolute left-1/2 -translate-x-1/2 flex gap-1 ${previewMode ? 'bottom-3' : 'bottom-4'}`}>
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
      )}
    </div>
  );
}

export { getBlockColor };
export default VoxelHUD;
