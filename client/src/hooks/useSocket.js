import { useState, useEffect, useRef } from 'react';
import { io } from 'socket.io-client';

/**
 * React hook for managing a Socket.io connection with JWT auth.
 * Connects when a user is present (token exists), disconnects on logout/unmount.
 *
 * @param {object|null} user - Current user object; triggers reconnect on login/logout
 * @returns {{ socket: object|null, connected: boolean, joinSector: function, changeSector: function }}
 */
const useSocket = (user) => {
  const [connected, setConnected] = useState(false);
  const socketRef = useRef(null);

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token || !user) {
      // Disconnect if previously connected (logout)
      if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current = null;
        setConnected(false);
      }
      return;
    }

    const newSocket = io('/', {
      auth: { token },
      transports: ['websocket', 'polling']
    });

    newSocket.on('connect', () => setConnected(true));
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
  }, [user]);

  const joinSector = (sectorId) => {
    socketRef.current?.emit('join_sector', { sector_id: sectorId });
  };

  const changeSector = (sectorId) => {
    socketRef.current?.emit('change_sector', { sector_id: sectorId });
  };

  return { socket: socketRef.current, connected, joinSector, changeSector };
};

export default useSocket;
