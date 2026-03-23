import { useState, useEffect } from 'react';
import { sectors } from '../services/api';

/**
 * Finds the nearest port in adjacent sectors when the current sector has none.
 * @param {number|null} sectorId - Current sector ID
 * @param {boolean} hasPort - Whether current sector already has a port
 * @returns {{ nearestPort: object|null, loading: boolean }}
 */
export default function useNearestPort(sectorId, hasPort) {
  const [nearestPort, setNearestPort] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!sectorId || hasPort) {
      setNearestPort(null);
      return;
    }

    let cancelled = false;
    setLoading(true);

    sectors.getById(sectorId).then(res => {
      if (cancelled) return;
      const adj = res.data.data?.adjacentSectors || [];
      const withPort = adj.find(s => {
        const sec = s.sector || s;
        return Array.isArray(sec.ports) && sec.ports.length > 0;
      });
      setNearestPort(withPort ? (withPort.sector || withPort) : null);
    }).catch(() => {
      if (!cancelled) setNearestPort(null);
    }).finally(() => {
      if (!cancelled) setLoading(false);
    });

    return () => { cancelled = true; };
  }, [sectorId, hasPort]);

  return { nearestPort, loading };
}
