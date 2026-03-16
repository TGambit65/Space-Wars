import { useState, useEffect, useCallback } from 'react';
import { missions, ships as shipsApi } from '../../services/api';
import { Target, Package, Crosshair, BarChart3, Shield, Clock, ChevronDown, ChevronUp } from 'lucide-react';

const typeConfig = {
  delivery: { icon: Package, color: '#00ffff', label: 'Delivery' },
  bounty: { icon: Crosshair, color: '#f44336', label: 'Bounty' },
  scan: { icon: Target, color: '#a78bfa', label: 'Scan' },
  trade: { icon: BarChart3, color: '#4caf50', label: 'Trade' },
  patrol: { icon: Shield, color: '#ff6600', label: 'Patrol' },
};

function MissionsPage({ user }) {
  const [active, setActive] = useState([]);
  const [available, setAvailable] = useState([]);
  const [ships, setShips] = useState([]);
  const [currentPort, setCurrentPort] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [actionLoading, setActionLoading] = useState(null);

  const fetchData = useCallback(async () => {
    try {
      const [activeRes, shipsRes] = await Promise.all([
        missions.getActive(),
        shipsApi.getAll(),
      ]);
      const activeData = activeRes.data.data;
      setActive(Array.isArray(activeData) ? activeData : activeData?.missions || []);
      const shipList = shipsRes.data.data?.ships || shipsRes.data || [];
      setShips(shipList);

      // Find if player is at a port
      const activeId = shipsRes.data.data?.active_ship_id;
      const activeShip = (activeId && shipList.find(s => s.ship_id === activeId)) || shipList[0];
      if (activeShip?.currentSector?.ports?.length > 0) {
        const portId = activeShip.currentSector.ports[0].port_id;
        setCurrentPort(portId);
        try {
          const availRes = await missions.getAvailable(portId);
          const availRaw = availRes.data.data;
          setAvailable(Array.isArray(availRaw) ? availRaw : availRaw?.missions || []);
        } catch { setAvailable([]); }
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load missions');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleAccept = async (missionId) => {
    setActionLoading(missionId);
    try {
      await missions.accept(missionId);
      await fetchData();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to accept mission');
    } finally {
      setActionLoading(null);
    }
  };

  const handleAbandon = async (playerMissionId) => {
    setActionLoading(`abandon-${playerMissionId}`);
    try {
      await missions.abandon(playerMissionId);
      await fetchData();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to abandon mission');
    } finally {
      setActionLoading(null);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-neon-cyan"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Mission Board</h1>
        <p className="text-gray-500 text-sm mt-1">Accept contracts and earn rewards</p>
      </div>

      {error && (
        <div className="p-3 rounded-lg text-sm" style={{ background: 'rgba(244,67,54,0.1)', border: '1px solid rgba(244,67,54,0.3)', color: '#f44336' }}>
          {error}
          <button onClick={() => setError(null)} className="ml-2 underline">dismiss</button>
        </div>
      )}

      {/* Active Missions */}
      <div>
        <h2 className="text-lg font-display text-white mb-3">Active Missions ({active.length})</h2>
        {active.length === 0 ? (
          <div className="holo-panel p-8 text-center">
            <p className="text-gray-500 text-sm">No active missions. Visit a port to accept new contracts.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {active.map(m => {
              const id = m.player_mission_id || m.id;
              return (
                <ActiveMissionCard
                  key={id}
                  mission={m}
                  onAbandon={() => handleAbandon(id)}
                  loading={actionLoading === `abandon-${id}`}
                />
              );
            })}
          </div>
        )}
      </div>

      {/* Available Missions */}
      <div>
        <h2 className="text-lg font-display text-white mb-3">
          Available Missions
          {!currentPort && <span className="text-xs text-gray-500 font-body ml-2">(dock at a port to see missions)</span>}
        </h2>
        {available.length === 0 ? (
          <div className="holo-panel p-8 text-center">
            <p className="text-gray-500 text-sm">
              {currentPort ? 'No missions available at this port.' : 'Dock at a port to see available missions.'}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {available.map(m => {
              const id = m.mission_id || m.id;
              return (
                <AvailableMissionCard
                  key={id}
                  mission={m}
                  onAccept={() => handleAccept(id)}
                  loading={actionLoading === id}
                />
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

function ActiveMissionCard({ mission, onAbandon, loading }) {
  const type = mission.mission_type || mission.type || 'delivery';
  const cfg = typeConfig[type] || typeConfig.delivery;
  const Icon = cfg.icon;
  const progress = mission.progress || 0;
  const total = mission.total || mission.requirement || 1;
  const pct = Math.min((progress / total) * 100, 100);

  return (
    <div className="holo-panel p-4">
      <div className="flex items-center gap-4">
        <div className="p-2 rounded-lg" style={{ background: `${cfg.color}12` }}>
          <Icon className="w-5 h-5" style={{ color: cfg.color }} />
        </div>
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <h3 className="text-sm font-medium text-white">{mission.title || mission.name}</h3>
            <span className="badge text-xs" style={{ background: `${cfg.color}15`, color: cfg.color, border: `1px solid ${cfg.color}30` }}>
              {cfg.label}
            </span>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex-1">
              <div className="progress-bar">
                <div className="progress-fill" style={{ width: `${pct}%`, background: cfg.color, boxShadow: `0 0 8px ${cfg.color}40` }} />
              </div>
            </div>
            <span className="text-xs text-gray-400">{progress}/{total}</span>
          </div>
          {mission.time_remaining && (
            <p className="text-xs text-gray-500 mt-1 flex items-center gap-1">
              <Clock className="w-3 h-3" /> {mission.time_remaining}
            </p>
          )}
        </div>
        <button onClick={onAbandon} disabled={loading} className="holo-button-danger text-xs px-3 py-1">
          {loading ? '...' : 'Abandon'}
        </button>
      </div>
    </div>
  );
}

function AvailableMissionCard({ mission, onAccept, loading }) {
  const [expanded, setExpanded] = useState(false);
  const type = mission.mission_type || mission.type || 'delivery';
  const cfg = typeConfig[type] || typeConfig.delivery;
  const Icon = cfg.icon;

  const objectives = mission.objectives || mission.requirements || [];
  const timeLimit = mission.time_limit || mission.duration;
  const hasDetails = mission.description || objectives.length > 0 || timeLimit;

  return (
    <div className="holo-panel p-4">
      <div className="flex items-center gap-2 mb-2">
        <Icon className="w-4 h-4" style={{ color: cfg.color }} />
        <h3 className="text-sm font-display text-white">{mission.title || mission.name}</h3>
        <span className="badge text-xs ml-auto" style={{ background: `${cfg.color}15`, color: cfg.color, border: `1px solid ${cfg.color}30` }}>
          {cfg.label}
        </span>
      </div>
      {mission.description && <p className="text-xs text-gray-500 mb-3">{mission.description}</p>}

      {/* Expandable briefing */}
      {hasDetails && (
        <button
          onClick={() => setExpanded(!expanded)}
          className="flex items-center gap-1 text-xs text-gray-400 hover:text-neon-cyan transition-colors mb-2"
        >
          {expanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
          {expanded ? 'Hide Briefing' : 'Mission Briefing'}
        </button>
      )}
      {expanded && (
        <div className="mb-3 p-3 rounded-lg text-xs space-y-2" style={{ background: 'rgba(0,255,255,0.03)', border: '1px solid rgba(0,255,255,0.08)' }}>
          {objectives.length > 0 && (
            <div>
              <p className="text-gray-400 font-semibold mb-1">Objectives:</p>
              <ul className="list-disc list-inside text-gray-300 space-y-0.5">
                {objectives.map((obj, i) => (
                  <li key={i}>{typeof obj === 'string' ? obj : obj.description || obj.name || JSON.stringify(obj)}</li>
                ))}
              </ul>
            </div>
          )}
          {timeLimit && (
            <p className="text-gray-400 flex items-center gap-1">
              <Clock className="w-3 h-3" /> Time Limit: <span className="text-white">{timeLimit}</span>
            </p>
          )}
          {mission.reward_credits && (
            <div>
              <p className="text-gray-400 font-semibold mb-1">Rewards:</p>
              <div className="flex gap-4">
                <span className="text-neon-orange">{mission.reward_credits.toLocaleString()} credits</span>
                {mission.reward_xp && <span className="text-neon-cyan">{mission.reward_xp} XP</span>}
                {mission.reward_reputation && <span className="text-purple-400">+{mission.reward_reputation} rep</span>}
              </div>
            </div>
          )}
        </div>
      )}

      <div className="flex items-center justify-between pt-3" style={{ borderTop: '1px solid rgba(0,255,255,0.08)' }}>
        <div className="flex gap-3 text-xs">
          {mission.reward_credits && (
            <span className="text-neon-orange font-display">{mission.reward_credits.toLocaleString()} cr</span>
          )}
          {mission.reward_xp && (
            <span className="text-neon-cyan">{mission.reward_xp} XP</span>
          )}
        </div>
        <button onClick={onAccept} disabled={loading} className="holo-button text-xs">
          {loading ? '...' : 'Accept'}
        </button>
      </div>
    </div>
  );
}

export default MissionsPage;
