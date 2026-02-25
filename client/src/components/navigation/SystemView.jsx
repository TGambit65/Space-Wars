import { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Map, AlertTriangle, Star } from 'lucide-react';
import useSystemData from './hooks/useSystemData';
import SystemViewCanvas from './SystemViewCanvas';
import SystemInfoPanel from './ui/SystemInfoPanel';
import SystemEntityBar from './ui/SystemEntityBar';

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

const SystemView = ({ user }) => {
  const navigate = useNavigate();
  const {
    systemDetail,
    currentShip,
    loading,
    error,
    scanPlanet
  } = useSystemData();

  const [selectedType, setSelectedType] = useState(null);
  const [selectedEntity, setSelectedEntity] = useState(null);
  const [scanning, setScanning] = useState(false);

  const selectedEntityId = selectedEntity?.planet_id || selectedEntity?.port_id ||
    selectedEntity?.npc_id || selectedEntity?.sector_id || null;

  const handleEntityClick = useCallback((type, entity) => {
    setSelectedType(type);
    setSelectedEntity(entity);
  }, []);

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

  return (
    <div className="relative w-full h-screen overflow-hidden bg-black">
      {/* Three.js Canvas */}
      <SystemViewCanvas
        systemDetail={systemDetail}
        currentShip={currentShip}
        selectedEntityId={selectedEntityId}
        onEntityClick={handleEntityClick}
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
        {currentShip && (
          <div className="text-xs text-gray-500 mt-1">
            Ship: {currentShip.name}
          </div>
        )}
      </div>

      {/* Right panel: Entity info */}
      <SystemInfoPanel
        selectedType={selectedType}
        selectedEntity={selectedEntity}
        onClose={handleClosePanel}
        onScanPlanet={handleScanPlanet}
        sectorId={sectorId}
        scanning={scanning}
      />

      {/* Bottom bar: Entity list */}
      <SystemEntityBar
        systemDetail={systemDetail}
        selectedEntityId={selectedEntityId}
        onEntitySelect={handleEntitySelect}
      />
    </div>
  );
};

export default SystemView;
