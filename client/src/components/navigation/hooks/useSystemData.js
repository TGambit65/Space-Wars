import { useState, useEffect, useCallback } from 'react';
import { sectors as sectorsApi, ships as shipsApi, planets as planetsApi } from '../../../services/api';

export default function useSystemData() {
  const [systemDetail, setSystemDetail] = useState(null);
  const [currentShip, setCurrentShip] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [moving, setMoving] = useState(false);

  // Fetch ship + system detail on mount
  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const shipsRes = await shipsApi.getAll();
        const shipList = shipsRes.data.data?.ships || [];
        if (shipList.length === 0) {
          setError('No ship found');
          return;
        }

        const activeId = shipsRes.data.data?.active_ship_id;
        const ship = (activeId && shipList.find(s => s.ship_id === activeId)) || shipList[0];
        setCurrentShip(ship);

        const sectorId = ship.currentSector?.sector_id || ship.current_sector_id;
        if (!sectorId) {
          setError('Ship has no current sector');
          return;
        }

        const res = await sectorsApi.getSystemDetail(sectorId);
        setSystemDetail(res.data.data);
      } catch (err) {
        console.error('Failed to load system data', err);
        setError('Failed to load system data');
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  // Re-fetch system detail (e.g. after scanning a planet)
  const refreshSystem = useCallback(async () => {
    if (!currentShip) return;
    const sectorId = currentShip.currentSector?.sector_id || currentShip.current_sector_id;
    if (!sectorId) return;
    try {
      const res = await sectorsApi.getSystemDetail(sectorId);
      setSystemDetail(res.data.data);
    } catch (err) {
      console.error('Failed to refresh system detail', err);
    }
  }, [currentShip]);

  // Scan a planet and refresh
  const scanPlanet = useCallback(async (sectorId) => {
    try {
      await planetsApi.scan(sectorId);
      await refreshSystem();
    } catch (err) {
      console.error('Scan failed', err);
      throw err;
    }
  }, [refreshSystem]);

  // Move ship to a connected system
  const moveToSystem = useCallback(async (targetSectorId) => {
    if (!currentShip || moving) return;
    try {
      setMoving(true);
      await shipsApi.move(currentShip.ship_id, targetSectorId);
      // Re-fetch ship data
      const shipsRes = await shipsApi.getAll();
      const shipList = shipsRes.data.data?.ships || [];
      const activeId = shipsRes.data.data?.active_ship_id;
      const ship = (activeId && shipList.find(s => s.ship_id === activeId)) || shipList[0];
      setCurrentShip(ship);
      window.dispatchEvent(new CustomEvent('sw3k:sector-changed', { detail: { sectorId: targetSectorId } }));
      window.dispatchEvent(new Event('sw3k:profile-dirty'));
      // Fetch new system detail
      const res = await sectorsApi.getSystemDetail(targetSectorId);
      setSystemDetail(res.data.data);
    } catch (err) {
      console.error('Move failed', err);
      throw err;
    } finally {
      setMoving(false);
    }
  }, [currentShip, moving]);

  return {
    systemDetail,
    currentShip,
    loading,
    error,
    moving,
    refreshSystem,
    scanPlanet,
    moveToSystem
  };
}
