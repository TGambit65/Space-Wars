import { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Star, X, Rocket, Palette, Zap } from 'lucide-react';
import { LEVEL_UNLOCKS } from '../../constants/levelUnlocks';

const LevelUpModal = ({ data, onClose }) => {
  const navigate = useNavigate();
  const timerRef = useRef(null);

  const level = data?.new_level || '?';
  const skillPoints = data?.available_skill_points || 0;
  const unlocks = LEVEL_UNLOCKS[level] || {};
  const hasUnlocks = (unlocks.ships?.length > 0) || (unlocks.features?.length > 0) || (unlocks.cosmetics?.length > 0);

  // Auto-dismiss after 15 seconds
  useEffect(() => {
    timerRef.current = setTimeout(onClose, 15000);
    return () => clearTimeout(timerRef.current);
  }, [onClose]);

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-[60] p-4" onClick={onClose}>
      <div
        className="card w-full max-w-sm p-6 space-y-4 relative overflow-hidden"
        onClick={e => e.stopPropagation()}
        style={{ boxShadow: '0 0 60px rgba(0,255,255,0.15), 0 0 120px rgba(0,255,255,0.05)' }}
      >
        {/* Glow effect */}
        <div className="absolute inset-0 pointer-events-none" style={{
          background: 'radial-gradient(circle at 50% 0%, rgba(0,255,255,0.08) 0%, transparent 60%)',
        }} />

        <button onClick={onClose} className="absolute top-3 right-3 text-gray-500 hover:text-white z-10" data-dismiss>
          <X className="w-5 h-5" />
        </button>

        {/* Header */}
        <div className="text-center relative">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full mb-3" style={{
            background: 'rgba(0,255,255,0.1)',
            border: '2px solid rgba(0,255,255,0.3)',
            boxShadow: '0 0 20px rgba(0,255,255,0.2)',
          }}>
            <Star className="w-8 h-8 text-accent-cyan" />
          </div>
          <h2 className="text-2xl font-bold text-white font-display">Level {level}!</h2>
          <p className="text-sm text-gray-400 mt-1">Commander rank increased</p>
        </div>

        {/* Skill Points */}
        {skillPoints > 0 && (
          <div className="flex items-center justify-center gap-2 py-2 rounded-lg" style={{
            background: 'rgba(255,193,7,0.08)',
            border: '1px solid rgba(255,193,7,0.2)',
          }}>
            <Zap className="w-4 h-4 text-yellow-400" />
            <span className="text-sm text-yellow-300 font-medium">{skillPoints} skill point{skillPoints > 1 ? 's' : ''} available</span>
          </div>
        )}

        {/* Unlocks */}
        {hasUnlocks && (
          <div className="space-y-2">
            <h3 className="text-xs font-bold uppercase tracking-wider text-gray-500">New Unlocks</h3>
            {unlocks.ships?.map(ship => (
              <div key={ship} className="flex items-center gap-2 text-sm text-gray-300">
                <Rocket className="w-4 h-4 text-accent-cyan shrink-0" />
                <span>Ship class: <span className="text-white font-medium">{ship}</span></span>
              </div>
            ))}
            {unlocks.features?.map(feat => (
              <div key={feat} className="flex items-center gap-2 text-sm text-gray-300">
                <Zap className="w-4 h-4 text-accent-orange shrink-0" />
                <span>{feat}</span>
              </div>
            ))}
            {unlocks.cosmetics?.map(cos => (
              <div key={cos} className="flex items-center gap-2 text-sm text-gray-300">
                <Palette className="w-4 h-4 text-purple-400 shrink-0" />
                <span>{cos}</span>
              </div>
            ))}
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-3 pt-2">
          <button onClick={onClose} className="btn btn-secondary flex-1 text-sm">Continue</button>
          <button onClick={() => { onClose(); navigate('/progression'); }} className="btn btn-primary flex-1 text-sm">
            View Progression
          </button>
        </div>
      </div>
    </div>
  );
};

export default LevelUpModal;
