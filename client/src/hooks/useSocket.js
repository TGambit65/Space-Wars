import { useState, useEffect, useRef } from 'react';
import { io } from 'socket.io-client';
import { getToken } from '../services/session';

const getActiveSectorId = (user) => {
  const ships = Array.isArray(user?.ships) ? user.ships : [];
  const activeShip = ships.find(ship => ship.ship_id === user?.active_ship_id)
    || ships.find(ship => ship.is_active !== false)
    || ships[0];

  return activeShip?.currentSector?.sector_id || activeShip?.current_sector_id || null;
};

/**
 * React hook for managing a Socket.io connection with JWT auth.
 * Connects when a user is present (token exists), disconnects on logout/unmount.
 *
 * @param {object|null} user - Current user object; triggers reconnect on login/logout
 * @returns {{ socket: object|null, connected: boolean, joinSector: function, changeSector: function }}
 */
const useSocket = (user) => {
  const [connected, setConnected] = useState(null);
  const socketRef = useRef(null);
  const activeSectorId = getActiveSectorId(user);

  useEffect(() => {
    const token = getToken();
    if (!user) {
      // Disconnect if previously connected (logout)
      if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current = null;
      }
      setConnected(null);
      return;
    }

    const socketOptions = {
      transports: ['websocket', 'polling'],
      withCredentials: true
    };
    if (token) {
      socketOptions.auth = { token };
    }

    const newSocket = io('/', socketOptions);

    newSocket.on('connect', () => {
      setConnected(true);
      if (activeSectorId) {
        newSocket.emit('join_sector', { sector_id: activeSectorId });
      }
    });
    newSocket.on('disconnect', () => setConnected(false));
    newSocket.on('connect_error', (err) => {
      console.error('[Socket] Connection error:', err.message);
      setConnected(false);
    });

    socketRef.current = newSocket;

    return () => {
      newSocket.disconnect();
      socketRef.current = null;
    };
  }, [user?.user_id]);

  useEffect(() => {
    if (!socketRef.current || !activeSectorId || !connected) return;
    socketRef.current.emit('join_sector', { sector_id: activeSectorId });
  }, [activeSectorId, connected]);

  useEffect(() => {
    const handleSectorChange = (event) => {
      const sectorId = event.detail?.sectorId;
      if (sectorId) {
        socketRef.current?.emit('change_sector', { sector_id: sectorId });
      }
    };

    window.addEventListener('sw3k:sector-changed', handleSectorChange);
    return () => window.removeEventListener('sw3k:sector-changed', handleSectorChange);
  }, []);

  const joinSector = (sectorId) => {
    socketRef.current?.emit('join_sector', { sector_id: sectorId });
  };

  const changeSector = (sectorId) => {
    socketRef.current?.emit('change_sector', { sector_id: sectorId });
  };

  return { socket: socketRef.current, connected, joinSector, changeSector };
};

export default useSocket;
