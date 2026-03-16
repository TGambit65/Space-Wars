import { useState, useEffect, useCallback } from 'react';
import { wonders } from '../../services/api';
import { Sparkles, CheckCircle } from 'lucide-react';

function ColonyWonders({ colonyId }) {
  const [wonderTypes, setWonderTypes] = useState([]);
  const [colonyWonders, setColonyWonders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [actionLoading, setActionLoading] = useState(null);

  const fetchData = useCallback(async () => {
    try {
      const [typesRes, wondersRes] = await Promise.all([
        wonders.getTypes(),
        wonders.getColonyWonders(colonyId),
      ]);
      // Types comes as { data: { types: { KEY: {...}, ... } } } — convert object to array
      const typesRaw = typesRes.data.data?.types || typesRes.data.data || typesRes.data || {};
      if (Array.isArray(typesRaw)) {
        setWonderTypes(typesRaw);
      } else if (typeof typesRaw === 'object') {
        setWonderTypes(Object.entries(typesRaw).map(([key, val]) => ({ ...val, type: key })));
      } else {
        setWonderTypes([]);
      }
      // Wonders comes as { data: { wonders: [...] } }
      const wondersRaw = wondersRes.data.data;
      setColonyWonders(Array.isArray(wondersRaw) ? wondersRaw : wondersRaw?.wonders || []);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load wonders');
    } finally {
      setLoading(false);
    }
  }, [colonyId]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleBuild = async (wonderType) => {
    setActionLoading(`build-${wonderType}`);
    try {
      await wonders.build(colonyId, wonderType);
      await fetchData();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to build');
    } finally {
      setActionLoading(null);
    }
  };

  const handleAdvance = async (wonderId) => {
    setActionLoading(`advance-${wonderId}`);
    try {
      await wonders.advance(wonderId);
      await fetchData();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to advance');
    } finally {
      setActionLoading(null);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-neon-cyan"></div>
      </div>
    );
  }

  const builtTypes = new Set(colonyWonders.map(w => w.wonder_type || w.type));

  return (
    <div className="space-y-4">
      {error && (
        <div className="p-3 rounded-lg text-sm" style={{ background: 'rgba(244,67,54,0.1)', border: '1px solid rgba(244,67,54,0.3)', color: '#f44336' }}>
          {error}
          <button onClick={() => setError(null)} className="ml-2 underline">dismiss</button>
        </div>
      )}

      {/* Active Wonders */}
      {colonyWonders.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-sm font-display text-neon-cyan">Active Wonders</h3>
          {colonyWonders.map(w => {
            const id = w.wonder_id || w.id;
            const totalPhases = w.total_phases || w.phases || 3;
            const currentPhase = w.current_phase || 0;
            const isComplete = currentPhase >= totalPhases;
            const pct = (currentPhase / totalPhases) * 100;

            return (
              <div key={id} className="p-3 rounded-lg" style={{ background: 'rgba(0,255,255,0.03)', border: '1px solid rgba(0,255,255,0.1)' }}>
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-neon-cyan" />
                    <span className="text-sm font-medium text-white">{w.name || (w.wonder_type || w.type || '').replace(/_/g, ' ')}</span>
                  </div>
                  {isComplete && <CheckCircle className="w-4 h-4 text-status-success" />}
                </div>
                {w.bonus && <p className="text-xs text-gray-500 mb-2">{w.bonus}</p>}
                <div className="progress-bar mb-2">
                  <div className="progress-fill" style={{
                    width: `${pct}%`,
                    background: isComplete ? '#4caf50' : '#00ffff',
                    boxShadow: `0 0 8px ${isComplete ? 'rgba(76,175,80,0.3)' : 'rgba(0,255,255,0.3)'}`,
                  }} />
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-gray-500">Phase {currentPhase}/{totalPhases}</span>
                  {!isComplete && (
                    <button onClick={() => handleAdvance(id)} disabled={actionLoading === `advance-${id}`}
                      className="holo-button text-xs">
                      {actionLoading === `advance-${id}` ? '...' : 'Advance Phase'}
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Available Wonder Types */}
      <div className="space-y-3">
        <h3 className="text-sm font-display text-neon-cyan">Available Wonders</h3>
        {wonderTypes.filter(t => !builtTypes.has(t.type || t.name)).length === 0 ? (
          <p className="text-gray-500 text-xs text-center py-4">All available wonders built</p>
        ) : (
          wonderTypes.filter(t => !builtTypes.has(t.type || t.name)).map(t => {
            const type = t.type || t.name;
            const phaseCost = t.phaseCost || t.phase_cost;
            const maxPhases = t.maxPhases || t.max_phases || 5;
            const bonusType = (t.bonusType || t.bonus_type || '').replace(/_/g, ' ');
            const bonusValue = t.bonusValue || t.bonus_value;
            const reqInfra = t.requiredInfrastructure || t.infrastructure_requirement;
            return (
              <div key={type} className="p-3 rounded-lg" style={{ background: 'rgba(255,102,0,0.03)', border: '1px solid rgba(255,102,0,0.1)' }}>
                <div className="flex items-center justify-between mb-1">
                  <p className="text-sm font-medium text-white">{(t.name || type || '').replace(/_/g, ' ')}</p>
                  <button onClick={() => handleBuild(type)} disabled={actionLoading === `build-${type}`}
                    className="holo-button-orange text-xs px-3 py-1">
                    {actionLoading === `build-${type}` ? '...' : 'Build'}
                  </button>
                </div>
                {t.bonus && <p className="text-xs text-gray-500">{t.bonus}</p>}
                <div className="flex flex-wrap gap-x-4 gap-y-1 mt-1.5 text-[11px] text-gray-500">
                  {bonusType && bonusValue && <span>Bonus: <span className="text-neon-cyan">+{Math.round(bonusValue * 100)}% {bonusType}</span></span>}
                  {phaseCost && <span>Cost: <span className="text-neon-orange">{phaseCost.toLocaleString()} cr/phase</span></span>}
                  {maxPhases && <span>Phases: {maxPhases}</span>}
                  {phaseCost && maxPhases && <span>Total: <span className="text-neon-orange">{(phaseCost * maxPhases).toLocaleString()} cr</span></span>}
                  {reqInfra && <span>Requires Infra Lv. {reqInfra}</span>}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

export default ColonyWonders;
