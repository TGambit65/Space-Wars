import { useState, useEffect, useRef } from 'react';
import { MessageSquare, X } from 'lucide-react';
import NPCPortrait from './NPCPortrait';

const DISMISS_TIMEOUT_MS = 15000;
const MAX_VISIBLE = 3;

const TYPE_BORDER = {
  PIRATE: 'border-accent-red/40',
  PIRATE_LORD: 'border-accent-purple/40',
  TRADER: 'border-accent-green/40',
  PATROL: 'border-accent-cyan/40',
  BOUNTY_HUNTER: 'border-accent-orange/40',
};

const NPCHailNotification = ({ pendingHails, onAccept, onDismiss }) => {
  const visibleHails = pendingHails.slice(0, MAX_VISIBLE);

  if (visibleHails.length === 0) return null;

  return (
    <div className="fixed top-16 right-4 z-40 space-y-2 w-80">
      {visibleHails.map(hail => (
        <HailCard
          key={hail.npc_id}
          hail={hail}
          onAccept={() => onAccept(hail)}
          onDismiss={() => onDismiss(hail.npc_id)}
        />
      ))}
      {pendingHails.length > MAX_VISIBLE && (
        <div className="text-center text-xs text-gray-500">
          +{pendingHails.length - MAX_VISIBLE} more hail{pendingHails.length - MAX_VISIBLE > 1 ? 's' : ''}
        </div>
      )}
    </div>
  );
};

const HailCard = ({ hail, onAccept, onDismiss }) => {
  const [visible, setVisible] = useState(false);
  const [fading, setFading] = useState(false);
  const timerRef = useRef(null);

  // Slide in on mount
  useEffect(() => {
    requestAnimationFrame(() => setVisible(true));
  }, []);

  // Auto-dismiss after timeout
  useEffect(() => {
    timerRef.current = setTimeout(() => {
      handleDismiss();
    }, DISMISS_TIMEOUT_MS);

    return () => clearTimeout(timerRef.current);
  }, []);

  const handleDismiss = () => {
    setFading(true);
    setTimeout(() => onDismiss(), 300);
  };

  const handleAccept = () => {
    clearTimeout(timerRef.current);
    onAccept();
  };

  const borderColor = TYPE_BORDER[hail.npc_type] || 'border-space-600';

  return (
    <div
      className={`bg-space-800/95 backdrop-blur-sm border ${borderColor} rounded-lg shadow-xl transition-all duration-300 ${
        visible && !fading
          ? 'translate-x-0 opacity-100'
          : 'translate-x-8 opacity-0'
      }`}
    >
      <div className="p-3">
        <div className="flex items-start gap-3">
          <NPCPortrait npcType={hail.npc_type} size="md" />
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between">
              <span className="text-white text-sm font-bold truncate">{hail.name}</span>
              <button onClick={handleDismiss} className="text-gray-500 hover:text-gray-300 p-0.5 -mr-1">
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
            <div className="text-[10px] text-gray-500 uppercase tracking-wider mb-1">
              {hail.npc_type?.replace('_', ' ')} HAILING
            </div>
            {hail.greeting_text && (
              <p className="text-xs text-gray-400 line-clamp-2 mb-2">"{hail.greeting_text}"</p>
            )}
          </div>
        </div>

        <div className="flex gap-2 mt-1">
          <button
            onClick={handleAccept}
            className="flex-1 btn text-xs py-1.5 bg-accent-cyan/20 text-accent-cyan border border-accent-cyan/30 hover:bg-accent-cyan/30 flex items-center justify-center gap-1"
          >
            <MessageSquare className="w-3 h-3" /> Accept Hail
          </button>
          <button
            onClick={handleDismiss}
            className="btn text-xs py-1.5 bg-space-700 text-gray-400 border border-space-600 hover:text-white"
          >
            Ignore
          </button>
        </div>
      </div>

      {/* Auto-dismiss progress bar */}
      <div className="h-0.5 bg-space-700 rounded-b-lg overflow-hidden">
        <div
          className="h-full bg-accent-cyan/40 transition-none"
          style={{
            animation: `shrink-bar ${DISMISS_TIMEOUT_MS}ms linear forwards`
          }}
        />
      </div>
    </div>
  );
};

export default NPCHailNotification;
