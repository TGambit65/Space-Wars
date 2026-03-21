import { useState, useEffect, useCallback } from 'react';

/**
 * React hook for consuming NPC-related Socket.io events.
 * Manages sector NPC list, pending hails, and combat alerts.
 *
 * @param {object|null} socket - Socket.io client instance from useSocket
 * @returns {{ sectorNPCs, pendingHails, combatAlert, dismissHail, clearCombatAlert }}
 */
const useNPCEvents = (socket) => {
  const [sectorNPCs, setSectorNPCs] = useState([]);
  const [pendingHails, setPendingHails] = useState([]);
  const [combatAlert, setCombatAlert] = useState(null);
  const [activityFeed, setActivityFeed] = useState([]);

  useEffect(() => {
    if (!socket) return;

    const onEnteredSector = (data) => {
      setSectorNPCs(prev => {
        if (prev.some(n => n.npc_id === data.npc_id)) return prev;
        return [...prev, data];
      });
      addToFeed({ type: 'entered', npc_id: data.npc_id, name: data.name, npc_type: data.npc_type });
    };

    const onLeftSector = (data) => {
      setSectorNPCs(prev => prev.filter(n => n.npc_id !== data.npc_id));
      addToFeed({ type: 'left', npc_id: data.npc_id, name: data.name });
    };

    const onDestroyed = (data) => {
      setSectorNPCs(prev => prev.filter(n => n.npc_id !== data.npc_id));
      addToFeed({ type: 'destroyed', npc_id: data.npc_id, name: data.name, destroyed_by: data.destroyed_by });
    };

    const onStateChange = (data) => {
      setSectorNPCs(prev => prev.map(n =>
        n.npc_id === data.npc_id
          ? { ...n, behavior_state: data.new_state }
          : n
      ));
    };

    const onHailsPlayer = (data) => {
      setPendingHails(prev => {
        if (prev.some(h => h.npc_id === data.npc_id)) return prev;
        return [...prev, data];
      });
    };

    const onAttacksPlayer = (data) => {
      setCombatAlert(data);
    };

    const onCombatEnded = () => {
      setCombatAlert(null);
    };

    // New presence events — add to activity feed
    const addToFeed = (entry) => {
      setActivityFeed(prev => {
        const updated = [{ ...entry, timestamp: Date.now() }, ...prev];
        return updated.slice(0, 20); // Keep last 20 entries
      });
    };

    const onCombatWarning = (data) => {
      addToFeed({ type: 'combat_warning', ...data });
    };

    const onServiceOffer = (data) => {
      addToFeed({ type: 'service_offer', ...data });
    };

    // Handler map for dispatching batch updates
    const eventHandlers = {
      'npc:entered_sector': onEnteredSector,
      'npc:left_sector': onLeftSector,
      'npc:destroyed': onDestroyed,
      'npc:state_change': onStateChange,
      'npc:hails_player': onHailsPlayer,
      'npc:attacks_player': onAttacksPlayer,
      'npc:combat_warning': onCombatWarning,
      'npc:service_offer': onServiceOffer,
    };

    // Batched NPC updates: single socket event containing multiple changes
    const onBatchUpdate = (updates) => {
      if (!Array.isArray(updates)) return;
      for (const { event, data } of updates) {
        const handler = eventHandlers[event];
        if (handler) handler(data);
      }
    };

    socket.on('npc:entered_sector', onEnteredSector);
    socket.on('npc:left_sector', onLeftSector);
    socket.on('npc:destroyed', onDestroyed);
    socket.on('npc:state_change', onStateChange);
    socket.on('npc:hails_player', onHailsPlayer);
    socket.on('npc:attacks_player', onAttacksPlayer);
    socket.on('combat:ended', onCombatEnded);
    socket.on('npc:batch_update', onBatchUpdate);
    socket.on('npc:combat_warning', onCombatWarning);
    socket.on('npc:service_offer', onServiceOffer);

    return () => {
      socket.off('npc:entered_sector', onEnteredSector);
      socket.off('npc:left_sector', onLeftSector);
      socket.off('npc:destroyed', onDestroyed);
      socket.off('npc:state_change', onStateChange);
      socket.off('npc:hails_player', onHailsPlayer);
      socket.off('npc:attacks_player', onAttacksPlayer);
      socket.off('combat:ended', onCombatEnded);
      socket.off('npc:batch_update', onBatchUpdate);
      socket.off('npc:combat_warning', onCombatWarning);
      socket.off('npc:service_offer', onServiceOffer);
    };
  }, [socket]);

  // Clear sector NPC list when socket disconnects or sector changes
  const resetSectorNPCs = useCallback(() => {
    setSectorNPCs([]);
  }, []);

  const dismissHail = useCallback((npcId) => {
    setPendingHails(prev => prev.filter(h => h.npc_id !== npcId));
  }, []);

  const clearCombatAlert = useCallback(() => {
    setCombatAlert(null);
  }, []);

  const clearActivityFeed = useCallback(() => {
    setActivityFeed([]);
  }, []);

  return {
    sectorNPCs,
    pendingHails,
    combatAlert,
    activityFeed,
    resetSectorNPCs,
    dismissHail,
    clearCombatAlert,
    clearActivityFeed
  };
};

export default useNPCEvents;
