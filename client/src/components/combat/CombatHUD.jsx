import { useState, useEffect, useCallback } from 'react';
import {
  Shield, Crosshair, Zap, Activity, LogOut,
  AlertTriangle, ChevronUp, ChevronDown
} from 'lucide-react';

const SUBSYSTEMS = [
  { value: 'hull', label: 'Hull' },
  { value: 'shields', label: 'Shields' },
  { value: 'weapons', label: 'Weapons' },
  { value: 'engines', label: 'Engines' },
  { value: 'sensors', label: 'Sensors' },
];

const CombatHUD = ({ combatState, onCommand }) => {
  // Power allocation: weapons, shields, engines (must sum to 100)
  const [powerWeapons, setPowerWeapons] = useState(34);
  const [powerShields, setPowerShields] = useState(33);
  const [powerEngines, setPowerEngines] = useState(33);

  // Target selection
  const [selectedTargetId, setSelectedTargetId] = useState('');
  const [selectedSubsystem, setSelectedSubsystem] = useState('hull');

  // Derive data from combatState prop
  const ownShip = combatState?.ownShip || {};
  const targets = combatState?.targets || [];
  const selectedTarget = targets.find(t =>
    String(t.id || t.npc_id || t.ship_id) === String(selectedTargetId)
  );

  // Auto-select first target if none selected
  useEffect(() => {
    if (!selectedTargetId && targets.length > 0) {
      setSelectedTargetId(String(targets[0].id || targets[0].npc_id || targets[0].ship_id));
    }
  }, [targets, selectedTargetId]);

  const clampPower = useCallback((weapons, shields, engines) => {
    const total = weapons + shields + engines;
    if (total !== 100) {
      // Normalize
      const scale = 100 / (total || 1);
      return {
        weapons: Math.round(weapons * scale),
        shields: Math.round(shields * scale),
        engines: 100 - Math.round(weapons * scale) - Math.round(shields * scale),
      };
    }
    return { weapons, shields, engines };
  }, []);

  const handlePowerChange = (system, value) => {
    const val = Math.max(0, Math.min(100, parseInt(value) || 0));
    let w = powerWeapons;
    let s = powerShields;
    let e = powerEngines;

    if (system === 'weapons') {
      w = val;
      // Redistribute remainder between shields and engines proportionally
      const remainder = 100 - val;
      const otherTotal = s + e || 1;
      s = Math.round((s / otherTotal) * remainder);
      e = remainder - s;
    } else if (system === 'shields') {
      s = val;
      const remainder = 100 - val;
      const otherTotal = w + e || 1;
      w = Math.round((w / otherTotal) * remainder);
      e = remainder - w;
    } else {
      e = val;
      const remainder = 100 - val;
      const otherTotal = w + s || 1;
      w = Math.round((w / otherTotal) * remainder);
      s = remainder - w;
    }

    // Clamp negatives
    w = Math.max(0, w);
    s = Math.max(0, s);
    e = Math.max(0, e);

    const clamped = clampPower(w, s, e);
    setPowerWeapons(clamped.weapons);
    setPowerShields(clamped.shields);
    setPowerEngines(clamped.engines);

    if (onCommand) {
      onCommand({
        type: 'power_allocation',
        weapons: clamped.weapons,
        shields: clamped.shields,
        engines: clamped.engines,
      });
    }
  };

  const handleTargetChange = (targetId) => {
    setSelectedTargetId(targetId);
    if (onCommand) {
      onCommand({ type: 'select_target', target_id: targetId, subsystem: selectedSubsystem });
    }
  };

  const handleSubsystemChange = (subsystem) => {
    setSelectedSubsystem(subsystem);
    if (onCommand) {
      onCommand({ type: 'target_subsystem', target_id: selectedTargetId, subsystem });
    }
  };

  const handleDisengage = () => {
    if (onCommand) {
      onCommand({ type: 'disengage' });
    }
  };

  const getBarColor = (percent) => {
    if (percent > 60) return 'bg-accent-green';
    if (percent > 30) return 'bg-accent-orange';
    return 'bg-accent-red';
  };

  const renderHealthBar = (label, current, max, colorClass) => {
    const percent = max > 0 ? (current / max) * 100 : 0;
    return (
      <div>
        <div className="flex justify-between text-[10px] text-gray-400 mb-0.5">
          <span>{label}</span>
          <span>{Math.round(current)} / {Math.round(max)}</span>
        </div>
        <div className="w-full bg-space-900 h-2 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-300 ${colorClass || getBarColor(percent)}`}
            style={{ width: `${Math.max(0, Math.min(100, percent))}%` }}
          />
        </div>
      </div>
    );
  };

  const renderPowerSlider = (label, icon, value, system, color) => (
    <div className="space-y-1">
      <div className="flex items-center justify-between">
        <span className="text-[10px] text-gray-400 uppercase tracking-wider flex items-center gap-1">
          {icon} {label}
        </span>
        <span className={`text-xs font-mono font-bold ${color}`}>{value}%</span>
      </div>
      <input
        type="range"
        min="0"
        max="100"
        value={value}
        onChange={(e) => handlePowerChange(system, e.target.value)}
        className="w-full h-1.5 rounded-full appearance-none cursor-pointer bg-space-800"
        style={{
          accentColor: color === 'text-accent-red' ? '#f44336' :
            color === 'text-accent-cyan' ? '#00ffff' : '#ff6600',
        }}
      />
    </div>
  );

  return (
    <div className="absolute bottom-0 left-0 right-0 pointer-events-none z-40">
      <div className="max-w-6xl mx-auto p-4">
        <div className="pointer-events-auto grid grid-cols-4 gap-3">

          {/* 1. Own Ship Status */}
          <div className="holo-panel p-3 space-y-2">
            <h4 className="text-[10px] uppercase tracking-widest text-accent-cyan font-bold flex items-center gap-1">
              <Activity className="w-3 h-3" /> {ownShip.name || 'Your Ship'}
            </h4>
            {renderHealthBar(
              'Shields',
              ownShip.shield_points ?? ownShip.shields ?? 0,
              ownShip.max_shield_points ?? ownShip.maxShields ?? 100,
              'bg-accent-cyan'
            )}
            {renderHealthBar(
              'Hull',
              ownShip.hull_points ?? ownShip.hull ?? 0,
              ownShip.max_hull_points ?? ownShip.maxHull ?? 100
            )}
            {combatState?.status && (
              <div className={`text-[10px] font-bold uppercase tracking-wider ${
                combatState.status === 'active' ? 'text-accent-red animate-pulse' : 'text-gray-500'
              }`}>
                {combatState.status === 'active' ? 'COMBAT ACTIVE' : combatState.status}
              </div>
            )}
          </div>

          {/* 2. Power Allocation */}
          <div className="holo-panel p-3 space-y-2">
            <h4 className="text-[10px] uppercase tracking-widest text-accent-orange font-bold flex items-center gap-1">
              <Zap className="w-3 h-3" /> Power Distribution
            </h4>
            {renderPowerSlider(
              'Weapons',
              <Crosshair className="w-2.5 h-2.5" />,
              powerWeapons,
              'weapons',
              'text-accent-red'
            )}
            {renderPowerSlider(
              'Shields',
              <Shield className="w-2.5 h-2.5" />,
              powerShields,
              'shields',
              'text-accent-cyan'
            )}
            {renderPowerSlider(
              'Engines',
              <Activity className="w-2.5 h-2.5" />,
              powerEngines,
              'engines',
              'text-accent-orange'
            )}
            <div className="text-[9px] text-gray-600 text-center">
              Total: {powerWeapons + powerShields + powerEngines}%
            </div>
          </div>

          {/* 3. Target Selector */}
          <div className="holo-panel p-3 space-y-2">
            <h4 className="text-[10px] uppercase tracking-widest text-accent-red font-bold flex items-center gap-1">
              <Crosshair className="w-3 h-3" /> Target Lock
            </h4>

            {/* Target Dropdown */}
            <select
              value={selectedTargetId}
              onChange={(e) => handleTargetChange(e.target.value)}
              className="w-full bg-space-900 border border-space-700 text-white rounded px-2 py-1 text-xs focus:border-accent-red outline-none"
            >
              {targets.length === 0 && <option value="">No targets</option>}
              {targets.map(t => {
                const tid = String(t.id || t.npc_id || t.ship_id);
                return (
                  <option key={tid} value={tid}>
                    {t.name || `Target ${tid}`}
                  </option>
                );
              })}
            </select>

            {/* Subsystem selector */}
            <div className="flex flex-wrap gap-1">
              {SUBSYSTEMS.map(sub => (
                <button
                  key={sub.value}
                  onClick={() => handleSubsystemChange(sub.value)}
                  className={`text-[9px] px-1.5 py-0.5 rounded border transition-colors ${
                    selectedSubsystem === sub.value
                      ? 'border-accent-red/60 bg-accent-red/10 text-accent-red'
                      : 'border-space-700 text-gray-500 hover:text-gray-300'
                  }`}
                >
                  {sub.label}
                </button>
              ))}
            </div>

            {/* Target Health */}
            {selectedTarget && (
              <div className="space-y-1 pt-1">
                <div className="text-xs text-white font-semibold truncate">
                  {selectedTarget.name || 'Unknown'}
                </div>
                {renderHealthBar(
                  'Shields',
                  selectedTarget.shield_points ?? selectedTarget.shields ?? 0,
                  selectedTarget.max_shield_points ?? selectedTarget.maxShields ?? 100,
                  'bg-accent-purple'
                )}
                {renderHealthBar(
                  'Hull',
                  selectedTarget.hull_points ?? selectedTarget.hull ?? 0,
                  selectedTarget.max_hull_points ?? selectedTarget.maxHull ?? 100,
                  'bg-accent-red'
                )}
              </div>
            )}
          </div>

          {/* 4. Actions */}
          <div className="holo-panel p-3 flex flex-col justify-between">
            <h4 className="text-[10px] uppercase tracking-widest text-gray-400 font-bold flex items-center gap-1">
              <AlertTriangle className="w-3 h-3" /> Actions
            </h4>

            <div className="flex-1 flex flex-col justify-center gap-2">
              {/* Combat log summary */}
              {combatState?.lastAction && (
                <div className="text-[10px] text-gray-400 bg-space-900/60 rounded p-2 font-mono leading-relaxed max-h-16 overflow-y-auto">
                  {combatState.lastAction}
                </div>
              )}

              {/* Round counter */}
              {combatState?.round != null && (
                <div className="text-xs text-gray-500 text-center">
                  Round <span className="text-white font-bold">{combatState.round}</span>
                </div>
              )}
            </div>

            {/* Disengage Button */}
            <button
              onClick={handleDisengage}
              className="holo-button-danger w-full py-2 text-sm font-bold tracking-wider flex items-center justify-center gap-2"
            >
              <LogOut className="w-4 h-4" /> DISENGAGE
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CombatHUD;
