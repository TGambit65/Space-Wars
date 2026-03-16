import { useEffect, useCallback } from 'react';
import { getBlockColor } from './VoxelHUD';

function VoxelToolbar({ blocks, hotbar, onAssign, onClose }) {
  const handleKeyDown = useCallback((e) => {
    if (e.key === 'Escape' || e.key === 'Tab') {
      e.preventDefault();
      onClose();
    }
  }, [onClose]);

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  // Filter to placeable blocks: exclude air (0) and building-only blocks (>= 32)
  const placeableBlocks = blocks.filter(b => b && b.id > 0 && b.id < 32);

  const handleBlockClick = (blockId) => {
    // Find the first empty slot, or use the first slot
    const emptySlot = hotbar.findIndex(id => id === 0);
    const targetSlot = emptySlot !== -1 ? emptySlot : 0;
    onAssign(targetSlot, blockId);
  };

  return (
    <div
      className="absolute inset-0 flex items-center justify-center bg-black/60 pointer-events-auto z-10"
      onClick={onClose}
    >
      <div
        className="bg-space-800/95 border border-space-600 rounded-xl p-6 max-w-lg w-full max-h-[80vh] overflow-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="text-lg font-bold text-white mb-2">Block Inventory</h3>
        <p className="text-xs text-gray-500 mb-4">
          Click a block to add to your hotbar. Press Tab or Escape to close.
        </p>

        {/* Current hotbar */}
        <div className="mb-4 p-3 rounded-lg bg-space-700/50">
          <p className="text-xs text-gray-400 mb-2">Current Hotbar</p>
          <div className="flex gap-1">
            {hotbar.map((blockId, i) => {
              const block = blocks[blockId];
              return (
                <div
                  key={i}
                  className="w-10 h-10 rounded border border-space-600/50 bg-space-900/70 flex flex-col items-center justify-center cursor-pointer hover:border-accent-cyan/50 transition-colors"
                  onClick={() => onAssign(i, 0)}
                  title={block ? `${block.name} (click to clear)` : 'Empty'}
                >
                  {block && block.id !== 0 ? (
                    <div
                      className="w-5 h-5 rounded-sm border border-white/10"
                      style={{ backgroundColor: getBlockColor(block.name) }}
                    />
                  ) : (
                    <div className="w-5 h-5" />
                  )}
                  <span className="text-[8px] text-gray-600">{i + 1}</span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Block grid */}
        <div className="grid grid-cols-6 gap-2">
          {placeableBlocks.map((block) => {
            const isInHotbar = hotbar.includes(block.id);
            return (
              <button
                key={block.id}
                onClick={() => handleBlockClick(block.id)}
                className={`flex flex-col items-center gap-1 p-2 rounded transition-colors group ${
                  isInHotbar
                    ? 'bg-accent-cyan/10 border border-accent-cyan/20'
                    : 'hover:bg-space-700/50 border border-transparent'
                }`}
              >
                <div
                  className="w-8 h-8 rounded-sm border border-space-600 group-hover:border-accent-cyan transition-colors"
                  style={{ backgroundColor: getBlockColor(block.name) }}
                />
                <span className="text-[10px] text-gray-400 group-hover:text-white truncate w-full text-center">
                  {block.name.replace(/_/g, ' ')}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export default VoxelToolbar;
