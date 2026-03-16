import { useState } from 'react';
import { Package, Hammer, Zap, Shield, Factory, ChevronDown, ChevronUp, Wrench } from 'lucide-react';

const CATEGORY_ICONS = {
  extraction: Hammer,
  infrastructure: Zap,
  manufacturing: Factory,
  defense: Shield,
};

const CATEGORY_COLORS = {
  extraction: '#f59e0b',
  infrastructure: '#3b82f6',
  manufacturing: '#eab308',
  defense: '#ef4444',
};

function SurfaceToolbar({ buildings, unplaced, selectedTool, onSelectTool, onSelectUnplaced, onRepairAll, damagedCount }) {
  const [expandedCategory, setExpandedCategory] = useState(null);

  // Group buildings config by category
  const categories = {};
  if (buildings) {
    for (const [key, bldg] of Object.entries(buildings)) {
      const cat = bldg.category || 'other';
      if (!categories[cat]) categories[cat] = [];
      categories[cat].push({ key, ...bldg });
    }
  }

  return (
    <div className="absolute left-2 top-2 bottom-2 w-56 flex flex-col gap-2 pointer-events-auto z-10">
      {/* Unplaced Inventory */}
      {unplaced && unplaced.length > 0 && (
        <div className="bg-space-900/95 border border-accent-orange/30 rounded-lg p-2 backdrop-blur-sm">
          <h3 className="text-xs font-bold text-accent-orange flex items-center gap-1 mb-1">
            <Package className="w-3 h-3" />
            Unplaced ({unplaced.length})
          </h3>
          <div className="space-y-1 max-h-32 overflow-y-auto">
            {unplaced.map(b => (
              <button
                key={b.building_id}
                onClick={() => onSelectUnplaced(b)}
                className={`w-full text-left px-2 py-1 rounded text-xs transition-colors ${
                  selectedTool?.building_id === b.building_id
                    ? 'bg-accent-orange/20 border border-accent-orange/50 text-white'
                    : 'bg-space-800 hover:bg-space-700 text-gray-300'
                }`}
              >
                <span className="font-medium">{b.config?.name || b.building_type}</span>
                <span className="text-gray-500 ml-1">{b.footprint?.w}x{b.footprint?.h}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Building Categories */}
      <div className="bg-space-900/95 border border-space-600/30 rounded-lg p-2 backdrop-blur-sm flex-1 overflow-y-auto">
        <h3 className="text-xs font-bold text-gray-400 mb-1">Build</h3>
        {Object.entries(categories).map(([cat, items]) => {
          const Icon = CATEGORY_ICONS[cat] || Hammer;
          const isExpanded = expandedCategory === cat;
          const color = CATEGORY_COLORS[cat] || '#888';
          return (
            <div key={cat} className="mb-1">
              <button
                onClick={() => setExpandedCategory(isExpanded ? null : cat)}
                className="w-full flex items-center justify-between px-2 py-1.5 rounded text-xs font-medium hover:bg-space-800 transition-colors"
                style={{ color }}
              >
                <span className="flex items-center gap-1">
                  <Icon className="w-3 h-3" />
                  {cat.charAt(0).toUpperCase() + cat.slice(1)}
                </span>
                {isExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
              </button>
              {isExpanded && (
                <div className="space-y-0.5 ml-2 mt-0.5">
                  {items.map(bldg => (
                    <button
                      key={bldg.key}
                      onClick={() => onSelectTool(bldg)}
                      className={`w-full text-left px-2 py-1 rounded text-xs transition-colors ${
                        selectedTool?.key === bldg.key
                          ? 'bg-accent-cyan/20 border border-accent-cyan/50 text-white'
                          : 'bg-space-800/50 hover:bg-space-700 text-gray-300'
                      }`}
                    >
                      <div className="font-medium">{bldg.name}</div>
                      <div className="flex justify-between text-gray-500">
                        <span>{bldg.cost?.toLocaleString()}cr</span>
                        <span>{bldg.footprintW || '?'}x{bldg.footprintH || '?'}</span>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Repair All */}
      {damagedCount > 0 && (
        <button
          onClick={onRepairAll}
          className="bg-space-900/95 border border-accent-green/30 rounded-lg p-2 flex items-center gap-2 text-xs text-accent-green hover:bg-accent-green/10 transition-colors"
        >
          <Wrench className="w-3 h-3" />
          Repair All ({damagedCount})
        </button>
      )}
    </div>
  );
}

export default SurfaceToolbar;
