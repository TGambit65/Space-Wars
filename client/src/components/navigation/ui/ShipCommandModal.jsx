import { useNavigate } from 'react-router-dom';
import { X, Rocket, Shield, Fuel, Activity, Scan, Map, Anchor, Wrench } from 'lucide-react';

const ShipCommandModal = ({ ship, sectorId, onClose, onScan, scanning }) => {
  const navigate = useNavigate();

  if (!ship) return null;

  const getPercent = (current, max) => Math.max(0, Math.min(100, (current / max) * 100));

  return (
    <div className="absolute inset-0 flex items-center justify-center bg-black/50 backdrop-blur-sm z-50">
      <div className="bg-space-900 border border-space-600 rounded-lg p-6 max-w-sm w-full mx-4 shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <Rocket className="w-6 h-6 text-accent-cyan" />
            <div>
              <h3 className="text-lg font-bold text-white">{ship.name}</h3>
              <div className="text-xs text-gray-400">{String(ship.ship_type || 'Unknown').replace('_', ' ')}</div>
            </div>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-white">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Status Bars */}
        <div className="space-y-3 mb-5">
          {/* Hull */}
          <div className="space-y-1">
            <div className="flex justify-between text-xs">
              <span className="text-gray-400 flex items-center gap-1">
                <Activity className="w-3 h-3 text-accent-red" /> Hull
              </span>
              <span className="text-white font-mono text-[11px]">{ship.hull_points} / {ship.max_hull_points}</span>
            </div>
            <div className="w-full bg-space-800 rounded-full h-2">
              <div
                className="h-2 rounded-full bg-accent-red transition-all"
                style={{ width: `${getPercent(ship.hull_points, ship.max_hull_points)}%` }}
              />
            </div>
          </div>

          {/* Shields */}
          <div className="space-y-1">
            <div className="flex justify-between text-xs">
              <span className="text-gray-400 flex items-center gap-1">
                <Shield className="w-3 h-3 text-accent-cyan" /> Shields
              </span>
              <span className="text-white font-mono text-[11px]">{ship.shield_points} / {ship.max_shield_points}</span>
            </div>
            <div className="w-full bg-space-800 rounded-full h-2">
              <div
                className="h-2 rounded-full bg-accent-cyan transition-all"
                style={{ width: `${getPercent(ship.shield_points, ship.max_shield_points)}%` }}
              />
            </div>
          </div>

          {/* Fuel */}
          <div className="space-y-1">
            <div className="flex justify-between text-xs">
              <span className="text-gray-400 flex items-center gap-1">
                <Fuel className="w-3 h-3 text-accent-orange" /> Fuel
              </span>
              <span className="text-white font-mono text-[11px]">{ship.fuel} / {ship.max_fuel}</span>
            </div>
            <div className="w-full bg-space-800 rounded-full h-2">
              <div
                className="h-2 rounded-full bg-accent-orange transition-all"
                style={{ width: `${getPercent(ship.fuel, ship.max_fuel)}%` }}
              />
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={() => { onClose(); navigate('/trading'); }}
            className="btn btn-secondary flex items-center justify-center gap-2 text-sm py-2"
          >
            <Anchor className="w-4 h-4" /> Trade
          </button>
          <button
            onClick={() => {
              if (sectorId && onScan) onScan(sectorId);
            }}
            disabled={scanning}
            className="btn btn-secondary flex items-center justify-center gap-2 text-sm py-2"
          >
            {scanning ? (
              <><div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" /> Scanning</>
            ) : (
              <><Scan className="w-4 h-4" /> Scan</>
            )}
          </button>
          <button
            onClick={() => { onClose(); navigate('/repair'); }}
            className="btn btn-secondary flex items-center justify-center gap-2 text-sm py-2"
          >
            <Wrench className="w-4 h-4" /> Repair
          </button>
          <button
            onClick={() => { onClose(); navigate('/map'); }}
            className="btn btn-secondary flex items-center justify-center gap-2 text-sm py-2"
          >
            <Map className="w-4 h-4" /> Sector Map
          </button>
        </div>
      </div>
    </div>
  );
};

export default ShipCommandModal;
