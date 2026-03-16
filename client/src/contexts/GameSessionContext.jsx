import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { auth, messages as messagesApi, progression } from '../services/api';

const GameSessionContext = createContext(null);

const getActiveShip = (user) => {
  const ships = Array.isArray(user?.ships) ? user.ships : [];
  if (ships.length === 0) return null;

  return ships.find(ship => ship.ship_id === user?.active_ship_id)
    || ships.find(ship => ship.is_active !== false)
    || ships[0]
    || null;
};

export function GameSessionProvider({ user, onUserUpdate, children }) {
  const [unreadCount, setUnreadCount] = useState(0);
  const [progressionData, setProgressionData] = useState(null);
  const [activeShip, setActiveShip] = useState(() => getActiveShip(user));
  const mountedRef = useRef(true);
  const userIdRef = useRef(user?.user_id || null);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    userIdRef.current = user?.user_id || null;
  }, [user?.user_id]);

  const refreshUnread = useCallback(async () => {
    const res = await messagesApi.getUnread();
    if (!mountedRef.current || !userIdRef.current) {
      return;
    }
    setUnreadCount(res.data.data?.unread || res.data.data?.count || 0);
  }, []);

  const refreshProgression = useCallback(async () => {
    const res = await progression.get();
    if (!mountedRef.current || !userIdRef.current) {
      return;
    }
    setProgressionData(res.data.data || res.data);
  }, []);

  const refreshProfile = useCallback(async () => {
    const res = await auth.getProfile();
    if (!mountedRef.current || !userIdRef.current) {
      return null;
    }
    const profile = res.data.data;
    onUserUpdate(profile);
    setActiveShip(getActiveShip(profile));
    return profile;
  }, [onUserUpdate]);

  const refreshAll = useCallback(async () => {
    await Promise.allSettled([
      refreshUnread(),
      refreshProgression()
    ]);
  }, [refreshProgression, refreshUnread]);

  useEffect(() => {
    setActiveShip(getActiveShip(user));
  }, [user]);

  useEffect(() => {
    if (!user?.user_id) {
      setUnreadCount(0);
      setProgressionData(null);
      setActiveShip(null);
      return undefined;
    }

    let disposed = false;

    const guardedRefresh = async () => {
      if (disposed) return;
      await refreshAll();
    };

    const guardedProfileRefresh = async () => {
      if (disposed) return;
      await refreshProfile();
    };

    guardedRefresh();
    guardedProfileRefresh();

    const intervalId = window.setInterval(guardedRefresh, 30000);
    const handleFocus = () => {
      guardedRefresh();
      guardedProfileRefresh();
    };
    const handleProfileDirty = () => { guardedProfileRefresh(); };

    window.addEventListener('focus', handleFocus);
    window.addEventListener('sw3k:profile-dirty', handleProfileDirty);

    return () => {
      disposed = true;
      window.clearInterval(intervalId);
      window.removeEventListener('focus', handleFocus);
      window.removeEventListener('sw3k:profile-dirty', handleProfileDirty);
    };
  }, [refreshAll, refreshProfile, user?.user_id]);

  const value = useMemo(() => ({
    unreadCount,
    progressionData,
    activeShip,
    refreshProfile,
    refreshUnread,
    refreshProgression
  }), [activeShip, progressionData, refreshProfile, refreshProgression, refreshUnread, unreadCount]);

  return (
    <GameSessionContext.Provider value={value}>
      {children}
    </GameSessionContext.Provider>
  );
}

export function useGameSession() {
  const context = useContext(GameSessionContext);
  if (!context) {
    throw new Error('useGameSession must be used within GameSessionProvider');
  }
  return context;
}
