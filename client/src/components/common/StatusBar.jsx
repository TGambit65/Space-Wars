import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { sectors, ships as shipsApi } from '../../services/api';
import { MapPin, Fuel, Shield, Anchor, Navigation, Zap } from 'lucide-react';
import { useGameSession } from '../../contexts/GameSessionContext';
import useNearestPort from '../../hooks/useNearestPort';

function StatusBar({ compact = false }) {
  const { activeShip } = useGameSession();
  const navigate = useNavigate();
  const [sectorName, setSectorName] = useState(null);
  const [hasPort, setHasPort] = useState(false);
  const [jumpLoading, setJumpLoading] = useState(false);

  useEffect(() => {
    if (!activeShip) {
      setSectorName(null);
      setHasPort(false);
      return undefined;
    }

    const sectorId = activeShip.currentSector?.sector_id || activeShip.current_sector_id || activeShip.sector_id;
    const currentSectorName = activeShip.currentSector?.name || activeShip.sector_name;
    const currentPorts = activeShip.currentSector?.ports;

    if (currentSectorName) {
      setSectorName(currentSectorName);
    }
    if (Array.isArray(currentPorts)) {
      setHasPort(currentPorts.length > 0);
    }

    if (!sectorId || (currentSectorName && Array.isArray(currentPorts))) {
      return undefined;
    }

    let cancelled = false;

    sectors.getById(sectorId)
      .then((secRes) => {
        if (cancelled) return;
        const sector = secRes.data.data || {};
        setSectorName(sector.name || currentSectorName || `Sector ${sectorId}`);
        setHasPort(Array.isArray(sector.ports) && sector.ports.length > 0);
      })
      .catch(() => {
        if (cancelled) return;
        setSectorName(currentSectorName || `Sector ${sectorId}`);
        setHasPort(false);
      });

    return () => {
      cancelled = true;
    };
  }, [activeShip]);

  // P5 Item 3: Find nearest port in adjacent sectors
  const currentSectorId = activeShip?.currentSector?.sector_id || activeShip?.current_sector_id || activeShip?.sector_id;
  const { nearestPort } = useNearestPort(currentSectorId, hasPort);

  const handleJumpToPort = async () => {
    if (!nearestPort || !activeShip || jumpLoading) return;
    setJumpLoading(true);
    try {
      await shipsApi.move(activeShip.ship_id, nearestPort.sector_id);
      navigate('/trading');
    } catch {
      // Movement may fail if fuel is low — just navigate to map
      navigate('/map');
    } finally {
      setJumpLoading(false);
    }
  };

  if (!activeShip) return null;

  const fuelPct = activeShip.max_fuel > 0 ? (activeShip.fuel / activeShip.max_fuel) * 100 : 0;
  const hullPct = activeShip.max_hull_points > 0 ? (activeShip.hull_points / activeShip.max_hull_points) * 100 : 0;
  const fuelColor = fuelPct > 50 ? '#00ffff' : fuelPct > 25 ? '#ffc107' : '#f44336';
  const hullColor = hullPct > 60 ? '#00ffff' : hullPct > 30 ? '#ffc107' : '#f44336';

  return (
    <div
      className={`flex items-center gap-6 px-4 py-2 text-xs rounded-lg ${compact ? 'fixed top-2 left-1/2 -translate-x-1/2 z-40 pointer-events-auto' : 'mb-4'}`}
      style={{
        background: compact ? 'rgba(10, 10, 30, 0.85)' : 'rgba(10, 10, 30, 0.6)',
        border: '1px solid rgba(0, 255, 255, 0.08)',
        backdropFilter: 'blur(8px)',
      }}
    >
      {/* Location */}
      <Link to="/system" className="flex items-center gap-1.5 text-gray-400 hover:text-neon-cyan transition-colors">
        <MapPin className="w-3.5 h-3.5" />
        <span className="font-display">{sectorName || 'Unknown'}</span>
      </Link>

      {/* Ship */}
      <Link to="/ships" className="flex items-center gap-1.5 text-gray-400 hover:text-neon-cyan transition-colors">
        <Navigation className="w-3.5 h-3.5" />
        <span>{activeShip.name}</span>
      </Link>

      {/* Fuel */}
      <div className="flex items-center gap-1.5">
        <Fuel className="w-3.5 h-3.5" style={{ color: fuelColor }} />
        <div className="w-20 h-1.5 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.06)' }}>
          <div className="h-full rounded-full transition-all duration-300"
            style={{ width: `${fuelPct}%`, background: fuelColor, boxShadow: `0 0 4px ${fuelColor}40` }} />
        </div>
        <span className="text-gray-500">{activeShip.fuel}/{activeShip.max_fuel}</span>
      </div>

      {/* Hull */}
      <div className="flex items-center gap-1.5">
        <Shield className="w-3.5 h-3.5" style={{ color: hullColor }} />
        <div className="w-20 h-1.5 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.06)' }}>
          <div className="h-full rounded-full transition-all duration-300"
            style={{ width: `${hullPct}%`, background: hullColor, boxShadow: `0 0 4px ${hullColor}40` }} />
        </div>
        <span className="text-gray-500">{activeShip.hull_points}/{activeShip.max_hull_points}</span>
      </div>

      {/* Port indicator */}
      {hasPort && (
        <Link to="/trading" className="flex items-center gap-1.5 text-neon-orange hover:text-neon-orange/80 transition-colors ml-auto">
          <Anchor className="w-3.5 h-3.5" />
          <span>Port Available</span>
        </Link>
      )}

      {/* P5 Item 3: Jump to nearest port */}
      {!hasPort && nearestPort && (
        <button onClick={handleJumpToPort} disabled={jumpLoading}
          className="flex items-center gap-1.5 text-gray-400 hover:text-neon-cyan transition-colors ml-auto disabled:opacity-50"
          title={`Jump to ${nearestPort.name} (has port)`}
        >
          <Zap className="w-3.5 h-3.5" />
          <span>{jumpLoading ? 'Jumping...' : `Port → ${nearestPort.name}`}</span>
        </button>
      )}
    </div>
  );
}

export default StatusBar;
