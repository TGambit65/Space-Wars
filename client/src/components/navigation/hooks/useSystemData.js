import { useState, useEffect, useCallback } from 'react';
import { sectors as sectorsApi, ships as shipsApi, planets as planetsApi } from '../../../services/api';

export default function useSystemData() {
  const [systemDetail, setSystemDetail] = useState(null);
  const [currentShip, setCurrentShip] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

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

        const ship = shipList[0];
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

  return {
    systemDetail,
    currentShip,
    loading,
    error,
    refreshSystem,
    scanPlanet
  };
}
