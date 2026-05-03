import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { pvp } from '../../services/api';
import { Swords, X, Check } from 'lucide-react';

/**
 * Global listener for incoming duel requests. Renders a fixed-position toast
 * with Accept/Decline. Bootstraps from the REST endpoint on mount in case a
 * request arrived while disconnected, then listens to the socket.
 */
export default function DuelRequestListener({ socket }) {
  const navigate = useNavigate();
  const [requests, setRequests] = useState([]);
  const [busy, setBusy] = useState(null);

  const refresh = useCallback(async () => {
    try {
      const res = await pvp.duelIncoming();
      setRequests(res.data?.data || []);
    } catch { /* noop */ }
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  useEffect(() => {
    if (!socket) return;
    const onRequest = (data) => {
      setRequests(prev => {
        if (prev.some(r => r.requestId === data.requestId)) return prev;
        return [...prev, data];
      });
    };
    const onResponse = (data) => {
      setRequests(prev => prev.filter(r => r.requestId !== data.requestId));
      if (data.accepted && data.combatId) {
        navigate(`/combat?combatId=${data.combatId}`);
      }
    };
    socket.on('pvp:duel_request', onRequest);
    socket.on('pvp:duel_response', onResponse);
    return () => {
      socket.off('pvp:duel_request', onRequest);
      socket.off('pvp:duel_response', onResponse);
    };
  }, [socket, navigate]);

  const respond = async (requestId, accept) => {
    setBusy(requestId);
    try {
      const res = await pvp.duelRespond(requestId, accept);
      setRequests(prev => prev.filter(r => r.requestId !== requestId));
      if (accept && res.data?.data?.combatId) {
        navigate(`/combat?combatId=${res.data.data.combatId}`);
      }
    } catch { /* noop */ }
    finally { setBusy(null); }
  };

  if (requests.length === 0) return null;

  return (
    <div className="fixed top-20 right-4 z-50 space-y-2 max-w-xs">
      {requests.map(r => (
        <div key={r.requestId} className="p-3 rounded-lg border border-red-600 bg-space-800 shadow-lg">
          <div className="flex items-center gap-2 mb-2">
            <Swords className="w-4 h-4 text-red-400" />
            <span className="text-sm text-white font-semibold">Duel Request</span>
          </div>
          <p className="text-xs text-gray-300 mb-3">
            {r.challenger?.username || 'A pilot'} challenges you to a duel
            {r.challengerShipName ? ` aboard ${r.challengerShipName}` : ''}.
          </p>
          <div className="flex gap-2">
            <button
              onClick={() => respond(r.requestId, true)}
              disabled={busy === r.requestId}
              className="flex-1 py-1.5 text-xs rounded bg-red-700 hover:bg-red-600 text-white flex items-center justify-center gap-1 disabled:opacity-50"
            >
              <Check className="w-3 h-3" /> Accept
            </button>
            <button
              onClick={() => respond(r.requestId, false)}
              disabled={busy === r.requestId}
              className="flex-1 py-1.5 text-xs rounded bg-gray-700 hover:bg-gray-600 text-white flex items-center justify-center gap-1 disabled:opacity-50"
            >
              <X className="w-3 h-3" /> Decline
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
