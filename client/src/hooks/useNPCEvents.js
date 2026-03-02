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

  useEffect(() => {
    if (!socket) return;

    const onEnteredSector = (data) => {
      setSectorNPCs(prev => {
        // Avoid duplicates
        if (prev.some(n => n.npc_id === data.npc_id)) return prev;
        return [...prev, data];
      });
    };

    const onLeftSector = (data) => {
      setSectorNPCs(prev => prev.filter(n => n.npc_id !== data.npc_id));
    };

    const onDestroyed = (data) => {
      setSectorNPCs(prev => prev.filter(n => n.npc_id !== data.npc_id));
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

    socket.on('npc:entered_sector', onEnteredSector);
    socket.on('npc:left_sector', onLeftSector);
    socket.on('npc:destroyed', onDestroyed);
    socket.on('npc:state_change', onStateChange);
    socket.on('npc:hails_player', onHailsPlayer);
    socket.on('npc:attacks_player', onAttacksPlayer);
    socket.on('combat:ended', onCombatEnded);

    return () => {
      socket.off('npc:entered_sector', onEnteredSector);
      socket.off('npc:left_sector', onLeftSector);
      socket.off('npc:destroyed', onDestroyed);
      socket.off('npc:state_change', onStateChange);
      socket.off('npc:hails_player', onHailsPlayer);
      socket.off('npc:attacks_player', onAttacksPlayer);
      socket.off('combat:ended', onCombatEnded);
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

  return {
    sectorNPCs,
    pendingHails,
    combatAlert,
    resetSectorNPCs,
    dismissHail,
    clearCombatAlert
  };
};

export default useNPCEvents;
