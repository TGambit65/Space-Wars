import { useState, useEffect, useMemo, useCallback } from 'react';
import { sectors as sectorsApi, ships as shipsApi, npcs as npcsApi } from '../../../services/api';

export default function useGalaxyData() {
  const [mapData, setMapData] = useState(null);
  const [currentShip, setCurrentShip] = useState(null);
  const [systemDetail, setSystemDetail] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [moving, setMoving] = useState(false);

  // Fetch galaxy map data + ship on mount
  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const [mapRes, shipsRes] = await Promise.all([
          sectorsApi.getMapData(),
          shipsApi.getAll()
        ]);
        setMapData(mapRes.data.data);

        const shipList = shipsRes.data.data?.ships || [];
        const activeId = shipsRes.data.data?.active_ship_id;
        if (shipList.length > 0) {
          const active = (activeId && shipList.find(s => s.ship_id === activeId)) || shipList[0];
          setCurrentShip(active);
        }
      } catch (err) {
        console.error('Failed to load galaxy data', err);
        setError('Failed to load galaxy data');
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  // Build index maps
  const sectorMap = useMemo(() => {
    if (!mapData?.systems) return new Map();
    const m = new Map();
    for (const sys of mapData.systems) {
      m.set(sys.sector_id, sys);
    }
    return m;
  }, [mapData]);

  // Build per-sector lookup of current user's ships
  const userShipsBySector = useMemo(() => {
    if (!mapData?.systems) return new Map();
    const m = new Map();
    for (const sys of mapData.systems) {
      if (sys.my_ships && sys.my_ships.length > 0) {
        m.set(sys.sector_id, sys.my_ships);
      }
    }
    return m;
  }, [mapData]);

  const adjacencyMap = useMemo(() => {
    if (!mapData?.hyperlanes) return new Map();
    const adj = new Map();
    for (const lane of mapData.hyperlanes) {
      if (!adj.has(lane.from_id)) adj.set(lane.from_id, []);
      if (!adj.has(lane.to_id)) adj.set(lane.to_id, []);
      adj.get(lane.from_id).push(lane.to_id);
      adj.get(lane.to_id).push(lane.from_id);
    }
    return adj;
  }, [mapData]);

  // Current sector ID from ship
  const currentSectorId = currentShip?.currentSector?.sector_id || currentShip?.current_sector_id;

  // Check if a sector is adjacent to current position
  const isAdjacent = useCallback((sectorId) => {
    if (!currentSectorId || !adjacencyMap.has(currentSectorId)) return false;
    return adjacencyMap.get(currentSectorId).includes(sectorId);
  }, [currentSectorId, adjacencyMap]);

  // Move ship to target sector
  const moveShip = useCallback(async (targetSectorId) => {
    if (!currentShip || moving) return;
    try {
      setMoving(true);
      await shipsApi.move(currentShip.ship_id, targetSectorId);
      // Update local state
      const targetSys = sectorMap.get(targetSectorId);
      setCurrentShip(prev => ({
        ...prev,
        current_sector_id: targetSectorId,
        currentSector: targetSys ? { sector_id: targetSys.sector_id, name: targetSys.name } : prev.currentSector
      }));
      window.dispatchEvent(new CustomEvent('sw3k:sector-changed', { detail: { sectorId: targetSectorId } }));
      window.dispatchEvent(new Event('sw3k:profile-dirty'));
      // Clear system detail so it reloads
      setSystemDetail(null);
    } catch (err) {
      console.error('Move failed', err);
      throw err;
    } finally {
      setMoving(false);
    }
  }, [currentShip, moving, sectorMap]);

  // Fetch system detail
  const fetchSystemDetail = useCallback(async (sectorId) => {
    try {
      const res = await sectorsApi.getSystemDetail(sectorId);
      setSystemDetail(res.data.data);
    } catch (err) {
      console.error('Failed to fetch system detail', err);
    }
  }, []);

  return {
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
  };
}
