const MapControls = () => {
  return (
    <div className="absolute bottom-4 left-4 bg-space-900/90 border border-space-700 rounded-lg p-3 backdrop-blur-sm">
      {/* Legend */}
      <div className="text-xs space-y-1.5">
        <div className="text-gray-400 font-bold uppercase mb-2">Legend</div>
        <div className="flex items-center gap-2">
          <div className="w-2.5 h-2.5 rounded-full bg-[#FFE87A]"></div>
          <span className="text-gray-400">G-type (Sol-like)</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-2.5 h-2.5 rounded-full bg-[#6B8BFF]"></div>
          <span className="text-gray-400">O/B-type (Hot)</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-2.5 h-2.5 rounded-full bg-[#FF6B4D]"></div>
          <span className="text-gray-400">M-type (Red Dwarf)</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-2.5 h-2.5 rounded-full bg-[#9B59B6]"></div>
          <span className="text-gray-400">Black Hole</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-px bg-gray-600"></div>
          <span className="text-gray-400">Hyperlane</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-px border-t border-dashed border-cyan-400"></div>
          <span className="text-gray-400">Wormhole</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-2.5 h-2.5 rounded-full border border-cyan-400"></div>
          <span className="text-gray-400">Has Port</span>
        </div>
      </div>

      {/* Controls hint */}
      <div className="mt-3 pt-2 border-t border-space-700 text-[10px] text-gray-500 space-y-0.5">
        <div>Scroll: Zoom | Drag: Pan</div>
        <div>Arrows: Pan | +/-: Zoom</div>
        <div>Esc: Reset view</div>
      </div>
    </div>
  );
};

export default MapControls;
