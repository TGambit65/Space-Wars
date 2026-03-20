import { useState, useEffect } from 'react';
import { admin } from '../../services/api';
import { Swords, AlertTriangle } from 'lucide-react';

const FACTIONS = [
  { key: 'terran_alliance', label: 'Terran Alliance', color: '#3b82f6' },
  { key: 'zythian_swarm', label: 'Zythian Swarm', color: '#ef4444' },
  { key: 'automaton_collective', label: 'Automaton Collective', color: '#8b5cf6' },
  { key: 'synthesis_accord', label: 'Synthesis Accord', color: '#06b6d4' },
  { key: 'sylvari_dominion', label: 'Sylvari Dominion', color: '#22c55e' },
];

const factionLabel = (key) => FACTIONS.find(f => f.key === key)?.label || key;
const factionColor = (key) => FACTIONS.find(f => f.key === key)?.color || '#888';

const WarsTab = () => {
  const [wars, setWars] = useState([]);
  const [activeWars, setActiveWars] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [actionLoading, setActionLoading] = useState(null);

  // Declare war form
  const [attacker, setAttacker] = useState('');
  const [defender, setDefender] = useState('');
  const [showDeclareConfirm, setShowDeclareConfirm] = useState(false);

  useEffect(() => { fetchAll(); }, []);

  const fetchAll = async () => {
    try {
      setLoading(true);
      const [warsRes, activeRes] = await Promise.all([
        admin.getWars({}),
        admin.getActiveWars()
      ]);
      setWars(warsRes.data.data.wars);
      setActiveWars(activeRes.data.data.wars);
    } catch (err) {
      setError('Failed to load war data');
    } finally {
      setLoading(false);
    }
  };

  const handleDeclareWar = async () => {
    if (!attacker || !defender) return;
    setActionLoading('declare');
    setError(null);
    try {
      await admin.declareWar({ attacker_faction: attacker, defender_faction: defender });
      setSuccess(`War declared: ${factionLabel(attacker)} vs ${factionLabel(defender)}`);
      setShowDeclareConfirm(false);
      setAttacker('');
      setDefender('');
      fetchAll();
      setTimeout(() => setSuccess(null), 4000);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to declare war');
    } finally {
      setActionLoading(null);
    }
  };

  const handleResolve = async (warId) => {
    setActionLoading(warId);
    setError(null);
    try {
      await admin.resolveWar(warId);
      setSuccess('War resolved');
      fetchAll();
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to resolve war');
    } finally {
      setActionLoading(null);
    }
  };

  if (loading) {
    return (
      <div className="p-8 text-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-accent-cyan mx-auto mb-4"></div>
        <div className="text-gray-400 text-sm">Loading war data...</div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {error && (
        <div className="bg-accent-red/10 border border-accent-red/30 rounded-lg p-3 flex items-center gap-2">
          <AlertTriangle className="w-5 h-5 text-accent-red flex-shrink-0" />
          <span className="text-accent-red text-sm">{error}</span>
          <button onClick={() => setError(null)} className="ml-auto text-accent-red hover:text-white text-xs">Dismiss</button>
        </div>
      )}
      {success && (
        <div className="bg-green-500/10 border border-green-500/30 rounded-lg p-3">
          <span className="text-green-400 text-sm">{success}</span>
        </div>
      )}

      {/* Active Wars */}
      <div className="card p-4">
        <h3 className="card-header flex items-center gap-2">
          <Swords className="w-4 h-4" /> Active Wars ({activeWars.length})
        </h3>
        {activeWars.length === 0 ? (
          <div className="text-sm text-gray-500 mt-3">No active wars</div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-3">
            {activeWars.map(war => {
              const total = (war.attacker_score || 0) + (war.defender_score || 0);
              const attackerPct = total > 0 ? (war.attacker_score / total) * 100 : 50;
              return (
                <div key={war.war_id || war.faction_war_id} className="bg-space-800 rounded-lg p-3">
                  <div className="flex justify-between items-center mb-2">
                    <span className="font-medium text-sm" style={{ color: factionColor(war.attacker_faction) }}>
                      {factionLabel(war.attacker_faction)}
                    </span>
                    <span className="text-xs text-gray-500">VS</span>
                    <span className="font-medium text-sm" style={{ color: factionColor(war.defender_faction) }}>
                      {factionLabel(war.defender_faction)}
                    </span>
                  </div>
                  {/* Score bar */}
                  <div className="w-full bg-space-700 rounded-full h-3 mb-2 flex overflow-hidden">
                    <div className="h-3 transition-all" style={{ width: `${attackerPct}%`, backgroundColor: factionColor(war.attacker_faction) }} />
                    <div className="h-3 transition-all flex-1" style={{ backgroundColor: factionColor(war.defender_faction) }} />
                  </div>
                  <div className="flex justify-between text-xs text-gray-400">
                    <span>{war.attacker_score || 0} pts</span>
                    <span>{war.ends_at ? `Ends: ${new Date(war.ends_at).toLocaleDateString()}` : ''}</span>
                    <span>{war.defender_score || 0} pts</span>
                  </div>
                  <button onClick={() => handleResolve(war.war_id || war.faction_war_id)}
                    disabled={actionLoading === (war.war_id || war.faction_war_id)}
                    className="btn btn-secondary w-full mt-2 text-xs">
                    {actionLoading === (war.war_id || war.faction_war_id) ? 'Resolving...' : 'Resolve War'}
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Declare War */}
      <div className="card p-4">
        <h3 className="card-header">Declare War</h3>
        <div className="flex gap-3 mt-3 flex-wrap items-end">
          <div className="flex-1 min-w-[150px]">
            <label className="block text-xs text-gray-400 mb-1">Attacker</label>
            <select value={attacker} onChange={e => setAttacker(e.target.value)} className="input text-sm w-full">
              <option value="">Select faction...</option>
              {FACTIONS.map(f => (
                <option key={f.key} value={f.key}>{f.label}</option>
              ))}
            </select>
          </div>
          <div className="flex-1 min-w-[150px]">
            <label className="block text-xs text-gray-400 mb-1">Defender</label>
            <select value={defender} onChange={e => setDefender(e.target.value)} className="input text-sm w-full">
              <option value="">Select faction...</option>
              {FACTIONS.filter(f => f.key !== attacker).map(f => (
                <option key={f.key} value={f.key}>{f.label}</option>
              ))}
            </select>
          </div>
          {!showDeclareConfirm ? (
            <button onClick={() => { if (attacker && defender) setShowDeclareConfirm(true); }}
              disabled={!attacker || !defender}
              className="btn btn-danger text-sm">
              Declare War
            </button>
          ) : (
            <div className="flex gap-2">
              <button onClick={() => setShowDeclareConfirm(false)} className="btn btn-secondary text-xs">Cancel</button>
              <button onClick={handleDeclareWar} disabled={actionLoading}
                className="btn btn-danger text-xs">
                {actionLoading === 'declare' ? 'Declaring...' : 'Confirm'}
              </button>
            </div>
          )}
        </div>
      </div>

      {/* War History */}
      <div className="card p-4">
        <h3 className="card-header">War History ({wars.length})</h3>
        <div className="overflow-x-auto mt-3">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-space-700 text-left">
                <th className="py-1 px-2 text-gray-500">Attacker</th>
                <th className="py-1 px-2 text-gray-500">Defender</th>
                <th className="py-1 px-2 text-gray-500">Score</th>
                <th className="py-1 px-2 text-gray-500">Status</th>
                <th className="py-1 px-2 text-gray-500">Started</th>
                <th className="py-1 px-2 text-gray-500">Ended</th>
              </tr>
            </thead>
            <tbody>
              {wars.map(war => (
                <tr key={war.war_id || war.faction_war_id} className="border-b border-space-800">
                  <td className="py-1 px-2" style={{ color: factionColor(war.attacker_faction) }}>
                    {factionLabel(war.attacker_faction)}
                  </td>
                  <td className="py-1 px-2" style={{ color: factionColor(war.defender_faction) }}>
                    {factionLabel(war.defender_faction)}
                  </td>
                  <td className="py-1 px-2 text-gray-300">
                    {war.attacker_score || 0} - {war.defender_score || 0}
                  </td>
                  <td className="py-1 px-2">
                    <span className={`${
                      war.status === 'active' ? 'text-accent-orange' :
                      war.status === 'resolved' ? 'text-green-400' : 'text-gray-400'
                    }`}>{war.status}</span>
                  </td>
                  <td className="py-1 px-2 text-gray-500">
                    {war.started_at ? new Date(war.started_at).toLocaleDateString() : '-'}
                  </td>
                  <td className="py-1 px-2 text-gray-500">
                    {war.ended_at ? new Date(war.ended_at).toLocaleDateString() : '-'}
                  </td>
                </tr>
              ))}
              {wars.length === 0 && (
                <tr><td colSpan={6} className="py-6 text-center text-gray-500">No wars recorded</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default WarsTab;
