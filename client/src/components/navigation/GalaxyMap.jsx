import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Map, AlertTriangle, Route, Home as HomeIcon, Search } from 'lucide-react';
import { findShortestPath } from '../../utils/pathfinder';
import useGalaxyData from './hooks/useGalaxyData';
import GalaxyMapCanvas from './GalaxyMapCanvas';
import MapHUD from './ui/MapHUD';
import MapControls from './ui/MapControls';
import MovementConfirmDialog from './ui/MovementConfirmDialog';
import FleetCreationModal from '../ship/FleetCreationModal';

const GalaxyMap = ({ user }) => {
  const navigate = useNavigate();
  const {
    mapData,
    currentShip,
    currentSectorId,
    sectorMap,
    adjacencyMap,
    userShipsBySector,
    systemDetail,
    loading,
    error,
    moving,
    isAdjacent,
    moveShip,
    fetchSystemDetail
  } = useGalaxyData();

  const [selectedSystem, setSelectedSystem] = useState(null);
  const [routePath, setRoutePath] = useState([]);
  const [moveTarget, setMoveTarget] = useState(null);
  const [moveError, setMoveError] = useState(null);
  const [moveToast, setMoveToast] = useState(null);
  const [showFleetModal, setShowFleetModal] = useState(false);
  const [selectedShipsForFleet, setSelectedShipsForFleet] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [highlightedSystemId, setHighlightedSystemId] = useState(null);
  const centerOnRef = useRef(null);
  const highlightTimerRef = useRef(null);

  // Refs for selection callback (passed to canvas via useViewport)
  const screenToWorldRef = useRef(null);
  const quadtreeRef = useRef(null);

  // Search results
  const searchResults = useMemo(() => {
    if (!searchQuery || searchQuery.length < 2 || !sectorMap) return [];
    const q = searchQuery.toLowerCase();
    const results = [];
    for (const [id, sys] of sectorMap) {
      if (sys.name && sys.name.toLowerCase().includes(q)) {
        results.push(sys);
        if (results.length >= 8) break;
      }
    }
    return results;
  }, [searchQuery, sectorMap]);

  const handleCenterOnShip = useCallback(() => {
    if (!centerOnRef.current || !currentSectorId || !sectorMap) return;
    const sys = sectorMap.get(currentSectorId);
    if (sys) {
      centerOnRef.current(sys.x_coord, sys.y_coord, 0.6);
    }
  }, [currentSectorId, sectorMap]);

  const handleSearchSelect = useCallback((sys) => {
    if (!centerOnRef.current) return;
    centerOnRef.current(sys.x_coord, sys.y_coord, 1.0);
    setHighlightedSystemId(sys.sector_id);
    setSearchQuery('');
    // Clear highlight after 5 seconds (clear any previous timer first)
    if (highlightTimerRef.current) clearTimeout(highlightTimerRef.current);
    highlightTimerRef.current = setTimeout(() => setHighlightedSystemId(null), 5000);
  }, []);

  // Cleanup highlight timer on unmount
  useEffect(() => {
    return () => { if (highlightTimerRef.current) clearTimeout(highlightTimerRef.current); };
  }, []);

  const handleCenterReady = useCallback((centerFn) => {
    centerOnRef.current = centerFn;
  }, []);

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
      // Click distant -> show info + compute route
      setSelectedSystem(system);
      const path = findShortestPath(adjacencyMap, currentSectorId, sectorId);
      setRoutePath(path);
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

  // Right-click to move directly (no confirmation)
  const handleSystemRightClick = async (sectorId) => {
    if (!isAdjacent(sectorId) || moving) return;
    try {
      setMoveToast(null);
      await moveShip(sectorId);
    } catch (err) {
      setMoveToast(err.response?.data?.message || 'Movement failed');
      setTimeout(() => setMoveToast(null), 3000);
    }
  };

  const handleEnterCombat = (npc) => {
    navigate('/combat', { state: { npc } });
  };

  // Selection complete callback — called from useViewport via GalaxyMapCanvas
  const handleSelectionComplete = useCallback((rect, screenToWorld, quadtree) => {
    if (!userShipsBySector || userShipsBySector.size === 0) return;

    // Convert screen rect to world rect
    const topLeft = screenToWorld(Math.min(rect.startX, rect.endX), Math.min(rect.startY, rect.endY));
    const bottomRight = screenToWorld(Math.max(rect.startX, rect.endX), Math.max(rect.startY, rect.endY));

    const worldRect = {
      x: topLeft.x, y: topLeft.y,
      w: bottomRight.x - topLeft.x,
      h: bottomRight.y - topLeft.y
    };

    // Query quadtree for systems in rect
    let systemsInRect = [];
    if (quadtree) {
      systemsInRect = quadtree.query(worldRect);
    }

    // Collect ships from matched systems that have user's ships
    const allShips = [];
    for (const point of systemsInRect) {
      const sectorId = point.data;
      const myShips = userShipsBySector.get(sectorId);
      if (myShips && myShips.length > 0) {
        for (const ship of myShips) {
          allShips.push({ ...ship, sector_id: sectorId, sector_name: sectorMap.get(sectorId)?.name });
        }
      }
    }

    if (allShips.length > 0) {
      setSelectedShipsForFleet(allShips);
      setShowFleetModal(true);
    }
  }, [userShipsBySector, sectorMap]);

  const handleFleetCreated = () => {
    setShowFleetModal(false);
    setSelectedShipsForFleet(null);
    // Reload map data by navigating to same page
    window.location.reload();
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
        onSystemRightClick={handleSystemRightClick}
        selectedSystemId={selectedSystem?.sector_id}
        userShipsBySector={userShipsBySector}
        onSelectionComplete={handleSelectionComplete}
        routePath={routePath}
        onCenterReady={handleCenterReady}
        highlightedSystemId={highlightedSystemId}
      />

      {/* Map Controls (zoom buttons, legend) */}
      <MapControls />

      {/* HUD Overlay */}
      <MapHUD
        currentShip={currentShip}
        selectedSystem={selectedSystem}
        systemDetail={systemDetail}
        onClose={() => { setSelectedSystem(null); setRoutePath([]); }}
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

      {/* Fleet Creation Modal */}
      {showFleetModal && selectedShipsForFleet && (
        <FleetCreationModal
          ships={selectedShipsForFleet}
          onClose={() => { setShowFleetModal(false); setSelectedShipsForFleet(null); }}
          onCreated={handleFleetCreated}
        />
      )}

      {/* Move toast */}
      {moveToast && (
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-accent-red/90 text-white px-4 py-2 rounded-lg text-sm">
          {moveToast}
        </div>
      )}

      {/* Current location indicator */}
      <div className="absolute top-4 left-4 bg-space-900/90 border border-space-700 rounded-lg px-4 py-2 backdrop-blur-sm max-w-xs">
        <div className="flex items-center gap-2">
          <Map className="w-4 h-4 text-accent-cyan" />
          <span className="text-sm text-gray-400">Location:</span>
          <span className="text-sm text-accent-cyan font-bold">
            {currentShip?.currentSector?.name || sectorMap.get(currentSectorId)?.name || 'Unknown'}
          </span>
          <button onClick={handleCenterOnShip} className="ml-auto text-accent-cyan hover:text-white transition-colors" title="Center on ship">
            <HomeIcon className="w-4 h-4" />
          </button>
        </div>
        {currentShip && (
          <div className="text-xs text-gray-500 mt-1">
            Ship: {currentShip.name} | Explored: {mapData?.discovered_systems || 0}/{mapData?.total_systems || 0}
          </div>
        )}
        {routePath.length > 1 && (
          <div className="flex items-center gap-1.5 text-xs text-accent-cyan mt-1">
            <Route className="w-3 h-3" />
            <span>Route: {routePath.length - 1} jumps to {sectorMap.get(routePath[routePath.length - 1])?.name || 'destination'}</span>
          </div>
        )}
        <div className="relative mt-2">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-gray-500" />
          <input
            type="text"
            placeholder="Search systems..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-space-800 border border-space-700 rounded px-2 py-1 pl-6 text-xs text-white placeholder-gray-600 focus:border-accent-cyan focus:outline-none"
          />
        </div>
        {searchResults.length > 0 && (
          <div className="mt-1 max-h-32 overflow-y-auto">
            {searchResults.map(s => (
              <button key={s.sector_id} onClick={() => handleSearchSelect(s)}
                className="w-full text-left px-2 py-1 text-xs text-gray-300 hover:text-white hover:bg-space-700/50 rounded transition-colors truncate">
                {s.name} <span className="text-gray-600">({s.type})</span>
              </button>
            ))}
          </div>
        )}
        <div className="text-xs text-gray-600 mt-0.5">
          Shift+drag to select ships · Press ? for shortcuts
        </div>
      </div>
    </div>
  );
};

export default GalaxyMap;
