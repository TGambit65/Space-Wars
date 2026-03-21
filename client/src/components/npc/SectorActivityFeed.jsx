import { useState } from 'react';
import { Radio, ChevronDown, ChevronUp, Skull, Shield, ShoppingCart, Crosshair, AlertTriangle } from 'lucide-react';

const TYPE_CONFIG = {
  entered: { icon: Radio, color: 'text-accent-cyan', label: 'arrived' },
  left: { icon: Radio, color: 'text-gray-500', label: 'departed' },
  destroyed: { icon: Skull, color: 'text-accent-red', label: 'destroyed' },
  combat_warning: { icon: AlertTriangle, color: 'text-accent-red', label: '' },
  service_offer: { icon: ShoppingCart, color: 'text-accent-green', label: '' },
};

const NPC_TYPE_ICON = {
  PIRATE: Skull,
  PIRATE_LORD: Skull,
  TRADER: ShoppingCart,
  PATROL: Shield,
  BOUNTY_HUNTER: Crosshair,
};

function formatTime(timestamp) {
  const d = new Date(timestamp);
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function FeedEntry({ entry }) {
  const config = TYPE_CONFIG[entry.type] || TYPE_CONFIG.entered;
  const Icon = config.icon;
  const NpcIcon = NPC_TYPE_ICON[entry.npc_type] || Radio;

  let message;
  switch (entry.type) {
    case 'entered':
      message = <><span className="text-white font-medium">{entry.name}</span> <span className={config.color}>arrived in sector</span></>;
      break;
    case 'left':
      message = <><span className="text-gray-400">{entry.name}</span> <span className={config.color}>departed</span></>;
      break;
    case 'destroyed':
      message = <><span className="text-accent-red font-medium">{entry.name}</span> <span className="text-gray-400">was destroyed by {entry.destroyed_by}</span></>;
      break;
    case 'combat_warning':
    case 'service_offer':
      message = <><span className="text-white font-medium">{entry.name}:</span> <span className="text-gray-300 italic">{entry.text}</span></>;
      break;
    default:
      message = <span className="text-gray-400">{entry.name}: {entry.text || entry.type}</span>;
  }

  return (
    <div className="flex items-start gap-2 py-1.5 px-2 text-xs border-b border-white/5 last:border-0">
      <NpcIcon className={`w-3.5 h-3.5 mt-0.5 shrink-0 ${config.color}`} />
      <div className="flex-1 leading-snug">{message}</div>
      <span className="text-gray-600 text-[10px] shrink-0 mt-0.5">{formatTime(entry.timestamp)}</span>
    </div>
  );
}

export default function SectorActivityFeed({ activityFeed = [] }) {
  const [expanded, setExpanded] = useState(true);

  if (activityFeed.length === 0) return null;

  return (
    <div className="bg-black/40 border border-white/10 rounded-lg overflow-hidden backdrop-blur-sm">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between px-3 py-2 text-xs font-medium text-gray-300 hover:text-white transition-colors"
      >
        <span className="flex items-center gap-1.5">
          <Radio className="w-3.5 h-3.5 text-accent-cyan" />
          Sector Activity
          {activityFeed.length > 0 && (
            <span className="bg-accent-cyan/20 text-accent-cyan px-1.5 py-0.5 rounded-full text-[10px]">
              {activityFeed.length}
            </span>
          )}
        </span>
        {expanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
      </button>

      {expanded && (
        <div className="max-h-48 overflow-y-auto border-t border-white/10">
          {activityFeed.map((entry, i) => (
            <FeedEntry key={`${entry.npc_id}-${entry.timestamp}-${i}`} entry={entry} />
          ))}
        </div>
      )}
    </div>
  );
}
