import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Map, AlertTriangle } from 'lucide-react';
import useGalaxyData from './hooks/useGalaxyData';
import GalaxyMapCanvas from './GalaxyMapCanvas';
import MapHUD from './ui/MapHUD';
import MapControls from './ui/MapControls';
import MovementConfirmDialog from './ui/MovementConfirmDialog';

const GalaxyMap = ({ user }) => {
  const navigate = useNavigate();
  const {
    mapData,
    currentShip,
    currentSectorId,
    sectorMap,
    adjacencyMap,
    systemDetail,
    loading,
    error,
    moving,
    isAdjacent,
    moveShip,
    fetchSystemDetail
  } = useGalaxyData();

  const [selectedSystem, setSelectedSystem] = useState(null);
  const [moveTarget, setMoveTarget] = useState(null);
  const [moveError, setMoveError] = useState(null);

  // When clicking a system on the map
  const handleSystemClick = (sectorId) => {
    const system = sectorMap.get(sectorId);
    if (!system) return;

    if (sectorId === currentSectorId) {
      // Click current system -> navigate to system view
      navigate('/system');
      return;
    } else if (isAdjacent(sectorId)) {
      // Click adjacent -> movement confirm
      setMoveTarget(system);
    } else {
      // Click distant -> just show info
      setSelectedSystem(system);
    }
  };

  const handleConfirmMove = async () => {
    if (!moveTarget) return;
    try {
      setMoveError(null);
      await moveShip(moveTarget.sector_id);
      setMoveTarget(null);
      setSelectedSystem(null);
    } catch (err) {
      setMoveError(err.response?.data?.message || 'Movement failed');
    }
  };

  const handleCancelMove = () => {
    setMoveTarget(null);
    setMoveError(null);
  };

  const handleEnterCombat = (npc) => {
    navigate('/combat', { state: { npc } });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[calc(100vh-4rem)]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-accent-cyan mx-auto mb-4"></div>
          <div className="text-accent-cyan">Scanning galaxy...</div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-[calc(100vh-4rem)]">
        <div className="text-center text-accent-red">
          <AlertTriangle className="w-12 h-12 mx-auto mb-4" />
          <div>{error}</div>
        </div>
      </div>
    );
  }

  return (
    <div className="relative w-full h-screen overflow-hidden bg-black">
      {/* Canvas */}
      <GalaxyMapCanvas
        mapData={mapData}
        currentSectorId={currentSectorId}
        adjacencyMap={adjacencyMap}
        onSystemClick={handleSystemClick}
        selectedSystemId={selectedSystem?.sector_id}
      />

      {/* Map Controls (zoom buttons, legend) */}
      <MapControls />

      {/* HUD Overlay */}
      <MapHUD
        currentShip={currentShip}
        selectedSystem={selectedSystem}
        systemDetail={systemDetail}
        onClose={() => setSelectedSystem(null)}
        onEnterCombat={handleEnterCombat}
        isCurrentSector={selectedSystem?.sector_id === currentSectorId}
      />

      {/* Movement Confirm Dialog */}
      {moveTarget && (
        <MovementConfirmDialog
          target={moveTarget}
          moving={moving}
          error={moveError}
          onConfirm={handleConfirmMove}
          onCancel={handleCancelMove}
        />
      )}

      {/* Current location indicator */}
      <div className="absolute top-4 left-4 bg-space-900/90 border border-space-700 rounded-lg px-4 py-2 backdrop-blur-sm">
        <div className="flex items-center gap-2">
          <Map className="w-4 h-4 text-accent-cyan" />
          <span className="text-sm text-gray-400">Location:</span>
          <span className="text-sm text-accent-cyan font-bold">
            {currentShip?.currentSector?.name || sectorMap.get(currentSectorId)?.name || 'Unknown'}
          </span>
        </div>
        {currentShip && (
          <div className="text-xs text-gray-500 mt-1">
            Ship: {currentShip.name} | Explored: {mapData?.discovered_systems || 0}/{mapData?.total_systems || 0}
          </div>
        )}
      </div>
    </div>
  );
};

export default GalaxyMap;
