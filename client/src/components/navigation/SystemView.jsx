import { useState, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Map, AlertTriangle, Star } from 'lucide-react';
import useSystemData from './hooks/useSystemData';
import SystemViewCanvas from './SystemViewCanvas';
import SystemInfoPanel from './ui/SystemInfoPanel';
import SystemEntityBar from './ui/SystemEntityBar';
import SectorActivityFeed from '../npc/SectorActivityFeed';
import { FACTION_COLORS, FACTION_LABELS } from '../../constants/factions';

const STAR_CLASS_LABELS = {
  O: 'Blue Supergiant',
  B: 'Blue Giant',
  A: 'White Star',
  F: 'Yellow-White Star',
  G: 'Yellow Star',
  K: 'Orange Star',
  M: 'Red Dwarf',
  Neutron: 'Neutron Star',
  BlackHole: 'Black Hole'
};

const SystemView = ({ user, onHailNPC, activityFeed = [], sectorNPCs = [] }) => {
  const navigate = useNavigate();
  const {
    systemDetail,
    currentShip,
    loading,
    error,
    moving,
    scanPlanet,
    moveToSystem
  } = useSystemData();

  const [selectedType, setSelectedType] = useState(null);
  const [selectedEntity, setSelectedEntity] = useState(null);
  const [scanning, setScanning] = useState(false);
  const [moveError, setMoveError] = useState(null);

  const neighbors = systemDetail?.neighbors || [];

  // Merge initial NPC data with live socket updates.
  // Socket-driven sectorNPCs take priority (newer state), fall back to initial fetch.
  const liveNPCs = useMemo(() => {
    const initialNPCs = systemDetail?.npcs || [];
    if (sectorNPCs.length === 0) return initialNPCs;

    // Build map from socket data (authoritative for presence + state)
    const socketMap = new Map(sectorNPCs.map(n => [n.npc_id, n]));
    // Merge: socket NPCs override initial data, keep initial fields socket doesn't have
    const merged = new Map();
    for (const npc of initialNPCs) {
      const live = socketMap.get(npc.npc_id);
      merged.set(npc.npc_id, live ? { ...npc, ...live } : npc);
    }
    // Add any NPCs that arrived via socket but weren't in initial fetch
    for (const npc of sectorNPCs) {
      if (!merged.has(npc.npc_id)) merged.set(npc.npc_id, npc);
    }
    return Array.from(merged.values());
  }, [systemDetail?.npcs, sectorNPCs]);

  // Build a system detail view with live NPCs for rendering
  const liveSystemDetail = useMemo(() => {
    if (!systemDetail) return null;
    return { ...systemDetail, npcs: liveNPCs };
  }, [systemDetail, liveNPCs]);

  const selectedEntityId = selectedType === 'ship' ? 'ship' :
    (selectedEntity?.planet_id || selectedEntity?.port_id ||
    selectedEntity?.npc_id || selectedEntity?.sector_id || null);

  const handleEntityClick = useCallback((type, entity) => {
    setSelectedType(type);
    setSelectedEntity(entity);
  }, []);

  const handleEntityDoubleClick = useCallback((type, entity) => {
    if (type === 'planet' && entity?.planet_id) {
      navigate(`/planet/${entity.planet_id}`);
    }
  }, [navigate]);

  const handleEntitySelect = useCallback((type, entity) => {
    setSelectedType(type);
    setSelectedEntity(entity);
  }, []);

  const handleClosePanel = useCallback(() => {
    setSelectedType(null);
    setSelectedEntity(null);
  }, []);

  const handleScanPlanet = useCallback(async (sectorId) => {
    try {
      setScanning(true);
      await scanPlanet(sectorId);
      // After scan completes, the systemDetail updates via refreshSystem.
      // Clear selection so the user can re-click to see scanned data.
      setSelectedType(null);
      setSelectedEntity(null);
    } catch (err) {
      // Error handled in hook
    } finally {
      setScanning(false);
    }
  }, [scanPlanet]);

  const handleJump = useCallback(async (neighbor) => {
    try {
      setMoveError(null);
      await moveToSystem(neighbor.sector_id);
      setSelectedType(null);
      setSelectedEntity(null);
    } catch (err) {
      const msg = err.response?.data?.message || err.message || 'Jump failed';
      setMoveError(msg);
      setTimeout(() => setMoveError(null), 5000);
    }
  }, [moveToSystem]);

  const handleEntityRightClick = useCallback(async (type, entity) => {
    if (type === 'jumpPoint') {
      try {
        setMoveError(null);
        await moveToSystem(entity.sector_id);
        setSelectedType(null);
        setSelectedEntity(null);
      } catch (err) {
        const msg = err.response?.data?.message || err.message || 'Jump failed';
        setMoveError(msg);
        setTimeout(() => setMoveError(null), 5000);
      }
    } else if (type === 'planet' && entity?.planet_id) {
      navigate(`/planet/${entity.planet_id}`);
    }
  }, [moveToSystem, navigate]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-black">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
          <p className="text-xs font-bold uppercase tracking-widest text-blue-400">Syncing Stellar Data</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-screen bg-black">
        <div className="text-center text-accent-red">
          <AlertTriangle className="w-12 h-12 mx-auto mb-4" />
          <div>{error}</div>
        </div>
      </div>
    );
  }

  const sector = systemDetail?.sector;
  const sectorId = sector?.sector_id;
  const scannedCount = systemDetail?.planets?.filter(p => p.is_scanned).length || 0;
  const totalCount = systemDetail?.planets?.length || 0;

  // Compute faction presence from live NPCs
  const factionPresence = useMemo(() => {
    const counts = {};
    for (const npc of liveNPCs) {
      if (npc.faction) {
        counts[npc.faction] = (counts[npc.faction] || 0) + 1;
      }
    }
    return Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .map(([faction, count]) => ({ faction, count }));
  }, [liveNPCs]);

  return (
    <div className="relative w-full h-screen overflow-hidden bg-black">
      {/* Three.js Canvas */}
      <SystemViewCanvas
        systemDetail={liveSystemDetail}
        currentShip={currentShip}
        selectedEntityId={selectedEntityId}
        onEntityClick={handleEntityClick}
        onEntityDoubleClick={handleEntityDoubleClick}
        neighbors={neighbors}
        onEntityRightClick={handleEntityRightClick}
      />

      {/* Top-left: Back button + system info */}
      <div className="absolute top-4 left-4 bg-space-900/90 border border-space-700 rounded-lg px-4 py-3 backdrop-blur-sm pointer-events-auto">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate('/map')}
            className="text-gray-400 hover:text-accent-cyan transition-colors flex items-center gap-1 text-sm"
          >
            <Map className="w-4 h-4" />
            <span>Sector Map</span>
          </button>
          <div className="w-px h-6 bg-space-600" />
          <div className="flex items-center gap-2">
            <Star
              className="w-4 h-4"
              style={{ color: sector?.star_color || '#FFE87A' }}
            />
            <div>
              <div className="text-sm text-white font-bold">{sector?.name || 'Unknown System'}</div>
              <div className="text-[10px] text-gray-400">
                {STAR_CLASS_LABELS[sector?.star_class] || sector?.star_class}
                {totalCount > 0 && ` | ${scannedCount}/${totalCount} scanned`}
              </div>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2 mt-1">
          {currentShip && (
            <span className="text-xs text-gray-500">
              Ship: {currentShip.name}
            </span>
          )}
          {factionPresence.length > 0 && (
            <>
              <span className="w-px h-3 bg-space-600" />
              <div className="flex items-center gap-1.5">
                {factionPresence.slice(0, 3).map(({ faction, count }) => (
                  <span key={faction} className="text-[10px] font-medium" style={{ color: FACTION_COLORS[faction] || '#888' }}>
                    {FACTION_LABELS[faction] || faction} ({count})
                  </span>
                ))}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Phenomena Banner */}
      {sector?.phenomena && (() => {
        const PHEN_META = {
          ion_storm: { name: 'Ion Storm', color: '#FFD700', effects: 'Shields -50%, Component wear +50%' },
          nebula: { name: 'Nebula', color: '#9B59B6', effects: 'Scanner range -50%, Fuel cost +20%' },
          asteroid_field: { name: 'Asteroid Field', color: '#CD853F', effects: 'Hull damage risk, Mining bonus +50%' },
          solar_flare: { name: 'Solar Flare', color: '#FF4500', effects: 'Shields disabled, Weapons +20%' },
          gravity_well: { name: 'Gravity Well', color: '#DC143C', effects: 'Cannot flee, Fuel cost x2' },
        };
        const meta = PHEN_META[sector.phenomena.type] || { name: sector.phenomena.type, color: '#FFD700', effects: '' };
        return (
          <div className="absolute top-20 left-1/2 -translate-x-1/2 pointer-events-auto px-4 py-2 rounded-lg backdrop-blur-sm max-w-md"
            style={{ background: `${meta.color}15`, border: `1px solid ${meta.color}40` }}>
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-3.5 h-3.5" style={{ color: meta.color }} />
              <span className="text-xs font-bold uppercase tracking-wider" style={{ color: meta.color }}>{meta.name}</span>
              <span className="text-[10px] text-gray-400">{meta.effects}</span>
            </div>
          </div>
        );
      })()}

      {/* Right panel: Entity info */}
      <SystemInfoPanel
        selectedType={selectedType}
        selectedEntity={selectedEntity}
        onClose={handleClosePanel}
        onScanPlanet={handleScanPlanet}
        onHailNPC={onHailNPC}
        onJump={handleJump}
        sectorId={sectorId}
        scanning={scanning}
        moving={moving}
        currentShip={currentShip}
        user={user}
        systemData={liveSystemDetail}
      />

      {/* Bottom-left: Sector activity feed */}
      <div className="absolute bottom-20 left-4 w-72 pointer-events-auto z-20">
        <SectorActivityFeed activityFeed={activityFeed} />
      </div>

      {/* Bottom bar: Entity list */}
      <SystemEntityBar
        systemDetail={liveSystemDetail}
        selectedEntityId={selectedEntityId}
        onEntitySelect={handleEntitySelect}
        currentShip={currentShip}
        neighbors={neighbors}
        onShipSelect={() => handleEntityClick('ship', currentShip)}
      />

      {/* Move Error Toast */}
      {moveError && (
        <div className="absolute top-16 left-1/2 -translate-x-1/2 bg-accent-red/90 text-white px-4 py-2 rounded-lg text-sm shadow-lg z-50 flex items-center gap-2">
          <AlertTriangle className="w-4 h-4" />
          {moveError}
        </div>
      )}
    </div>
  );
};

export default SystemView;
