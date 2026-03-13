import { useState, useMemo } from 'react';
import { X, Rocket, Users } from 'lucide-react';
import { fleets as fleetsApi } from '../../services/api';

const FleetCreationModal = ({ ships, onClose, onCreated }) => {
  const [fleetName, setFleetName] = useState('Fleet 1');
  const [selectedIds, setSelectedIds] = useState(() =>
    new Set(ships.filter(s => !s.fleet_id).map(s => s.ship_id))
  );
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState(null);

  // Group ships by sector
  const shipsBySector = useMemo(() => {
    const groups = new Map();
    for (const ship of ships) {
      const key = ship.sector_id;
      if (!groups.has(key)) groups.set(key, { name: ship.sector_name || 'Unknown', ships: [] });
      groups.get(key).ships.push(ship);
    }
    return groups;
  }, [ships]);

  const toggleShip = (shipId) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(shipId)) next.delete(shipId);
      else next.add(shipId);
      return next;
    });
  };

  const handleCreate = async () => {
    if (selectedIds.size === 0) {
      setError('Select at least one ship');
      return;
    }
    try {
      setCreating(true);
      setError(null);
      await fleetsApi.create(fleetName, Array.from(selectedIds));
      onCreated();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to create fleet');
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
      <div className="bg-space-900 border border-space-600 rounded-xl shadow-2xl w-full max-w-md mx-4 max-h-[80vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-space-600">
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <Users className="w-5 h-5 text-accent-cyan" />
            Create Fleet
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-white transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-4 space-y-4 overflow-y-auto flex-1">
          {/* Fleet name */}
          <div>
            <label className="block text-sm text-gray-400 mb-1">Fleet Name</label>
            <input
              type="text"
              value={fleetName}
              onChange={e => setFleetName(e.target.value)}
              maxLength={100}
              className="w-full bg-space-800 border border-space-600 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-accent-cyan"
            />
          </div>

          {/* Ship list grouped by sector */}
          <div>
            <label className="block text-sm text-gray-400 mb-2">
              Select Ships ({selectedIds.size} selected)
            </label>
            <div className="space-y-3">
              {Array.from(shipsBySector.entries()).map(([sectorId, group]) => (
                <div key={sectorId}>
                  <div className="text-xs text-gray-500 uppercase tracking-wider mb-1">
                    {group.name}
                  </div>
                  <div className="space-y-1">
                    {group.ships.map(ship => {
                      const inFleet = ship.fleet_id != null;
                      const isSelected = selectedIds.has(ship.ship_id);
                      return (
                        <label
                          key={ship.ship_id}
                          className={`flex items-center gap-3 px-3 py-2 rounded-lg cursor-pointer transition-colors ${
                            inFleet
                              ? 'opacity-40 cursor-not-allowed bg-space-800/50'
                              : isSelected
                                ? 'bg-accent-cyan/10 border border-accent-cyan/30'
                                : 'bg-space-800 hover:bg-space-700 border border-transparent'
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={isSelected}
                            disabled={inFleet}
                            onChange={() => !inFleet && toggleShip(ship.ship_id)}
                            className="accent-accent-cyan"
                          />
                          <Rocket className={`w-4 h-4 flex-shrink-0 ${isSelected ? 'text-accent-cyan' : 'text-gray-400'}`} />
                          <div className="flex-1 min-w-0">
                            <div className={`text-sm font-mono truncate ${isSelected ? 'text-white' : 'text-gray-300'}`}>
                              {ship.name}
                            </div>
                            <div className="text-xs text-gray-500">
                              {ship.ship_type}
                              {inFleet && ' (already in a fleet)'}
                            </div>
                          </div>
                        </label>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {error && (
            <div className="text-sm text-accent-red bg-accent-red/10 border border-accent-red/30 rounded-lg px-3 py-2">
              {error}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex gap-3 p-4 border-t border-space-600">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2 rounded-lg border border-space-600 text-gray-400 hover:text-white hover:border-space-500 transition-colors text-sm"
          >
            Cancel
          </button>
          <button
            onClick={handleCreate}
            disabled={creating || selectedIds.size === 0}
            className="flex-1 px-4 py-2 rounded-lg bg-accent-cyan/20 border border-accent-cyan/30 text-accent-cyan hover:bg-accent-cyan/30 transition-colors text-sm disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {creating ? 'Creating...' : `Create Fleet (${selectedIds.size})`}
          </button>
        </div>
      </div>
    </div>
  );
};

export default FleetCreationModal;
