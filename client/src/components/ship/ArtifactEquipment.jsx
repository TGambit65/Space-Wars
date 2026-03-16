import { useState, useEffect, useCallback } from 'react';
import { artifacts } from '../../services/api';
import { Gem, Zap, Shield, Swords } from 'lucide-react';

const rarityColors = {
  common: { color: '#999', label: 'Common' },
  uncommon: { color: '#4caf50', label: 'Uncommon' },
  rare: { color: '#2196f3', label: 'Rare' },
  epic: { color: '#a78bfa', label: 'Epic' },
  legendary: { color: '#ff6600', label: 'Legendary' },
};

function ArtifactEquipment({ shipId }) {
  const [allArtifacts, setAllArtifacts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [actionLoading, setActionLoading] = useState(null);

  const fetchData = useCallback(async () => {
    try {
      const res = await artifacts.getAll();
      const d = res.data.data;
      setAllArtifacts(Array.isArray(d) ? d : d?.artifacts || []);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load artifacts');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleEquip = async (artifactId) => {
    setActionLoading(`equip-${artifactId}`);
    try {
      await artifacts.equip(artifactId, shipId);
      await fetchData();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to equip');
    } finally {
      setActionLoading(null);
    }
  };

  const handleUnequip = async (artifactId) => {
    setActionLoading(`unequip-${artifactId}`);
    try {
      await artifacts.unequip(artifactId);
      await fetchData();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to unequip');
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

  const equipped = allArtifacts.filter(a => a.equipped_ship_id === shipId || a.ship_id === shipId);
  const available = allArtifacts.filter(a => !a.equipped_ship_id && !a.ship_id);

  return (
    <div className="space-y-4">
      {error && (
        <div className="p-3 rounded-lg text-sm" style={{ background: 'rgba(244,67,54,0.1)', border: '1px solid rgba(244,67,54,0.3)', color: '#f44336' }}>
          {error}
          <button onClick={() => setError(null)} className="ml-2 underline">dismiss</button>
        </div>
      )}

      {/* Equipped */}
      <div>
        <h3 className="text-sm font-display text-neon-cyan mb-2">Equipped ({equipped.length})</h3>
        {equipped.length === 0 ? (
          <p className="text-xs text-gray-500 text-center py-4">No artifacts equipped on this ship</p>
        ) : (
          <div className="space-y-2">
            {equipped.map(a => (
              <ArtifactCard key={a.artifact_id || a.id} artifact={a}
                action="unequip" onAction={() => handleUnequip(a.artifact_id || a.id)}
                loading={actionLoading === `unequip-${a.artifact_id || a.id}`} />
            ))}
          </div>
        )}
      </div>

      {/* Available */}
      <div>
        <h3 className="text-sm font-display text-neon-orange mb-2">Available ({available.length})</h3>
        {available.length === 0 ? (
          <p className="text-xs text-gray-500 text-center py-4">No unequipped artifacts</p>
        ) : (
          <div className="space-y-2">
            {available.map(a => (
              <ArtifactCard key={a.artifact_id || a.id} artifact={a}
                action="equip" onAction={() => handleEquip(a.artifact_id || a.id)}
                loading={actionLoading === `equip-${a.artifact_id || a.id}`} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function ArtifactCard({ artifact, action, onAction, loading }) {
  const rarity = rarityColors[artifact.rarity || 'common'] || rarityColors.common;
  const typeIcons = { weapon: Swords, shield: Shield, engine: Zap, general: Gem };
  const Icon = typeIcons[artifact.artifact_type || artifact.type] || Gem;

  return (
    <div className="flex items-center gap-3 p-3 rounded-lg" style={{ background: 'rgba(0,255,255,0.02)', border: `1px solid ${rarity.color}20` }}>
      <div className="p-2 rounded-lg" style={{ background: `${rarity.color}12` }}>
        <Icon className="w-4 h-4" style={{ color: rarity.color }} />
      </div>
      <div className="flex-1">
        <div className="flex items-center gap-2">
          <span className="text-sm text-white">{artifact.name}</span>
          <span className="text-xs px-1.5 py-0.5 rounded" style={{ background: `${rarity.color}15`, color: rarity.color, border: `1px solid ${rarity.color}25` }}>
            {rarity.label}
          </span>
        </div>
        {artifact.bonus && <p className="text-xs text-gray-500 mt-0.5">{artifact.bonus}</p>}
      </div>
      <button onClick={onAction} disabled={loading}
        className={action === 'equip' ? 'holo-button text-xs' : 'holo-button-orange text-xs px-3 py-1'}>
        {loading ? '...' : action === 'equip' ? 'Equip' : 'Unequip'}
      </button>
    </div>
  );
}

export default ArtifactEquipment;
