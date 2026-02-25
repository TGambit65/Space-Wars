import { useState, useEffect } from 'react';
import { X, User, Wallet, UserPlus, Rocket, AlertCircle, Building } from 'lucide-react';
import { crew as crewApi, ports as portsApi, ships } from '../../services/api';

const speciesColors = {
  Human: 'from-blue-500 to-cyan-500',
  Vexian: 'from-purple-500 to-pink-500',
  Krynn: 'from-orange-500 to-red-500',
  Zorath: 'from-green-500 to-emerald-500',
  Sylphi: 'from-cyan-400 to-blue-400',
  Grox: 'from-gray-500 to-stone-600',
  Nexari: 'from-indigo-500 to-violet-500',
  Threll: 'from-amber-500 to-yellow-500',
  'Worker Bot': 'from-zinc-400 to-slate-500',
  'Combat Droid': 'from-red-600 to-orange-500',
  'Science Unit': 'from-teal-500 to-cyan-400',
};

function HireCrewModal({ ships: userShips, onClose, onHired }) {
  const [selectedShip, setSelectedShip] = useState('');
  const [availableCrew, setAvailableCrew] = useState([]);
  const [loading, setLoading] = useState(false);
  const [hiring, setHiring] = useState(null);
  const [error, setError] = useState('');

  const selectedShipData = userShips.find(s => s.ship_id === selectedShip);

  useEffect(() => {
    if (selectedShip && selectedShipData?.current_sector_id) {
      loadAvailableCrew();
    } else {
      setAvailableCrew([]);
    }
  }, [selectedShip]);

  const loadAvailableCrew = async () => {
    setLoading(true);
    setError('');
    try {
      // Get ports in the ship's sector
      const portsRes = await portsApi.getBySector(selectedShipData.current_sector_id);
      const portsInSector = portsRes.data.data?.ports || [];

      if (portsInSector.length === 0) {
        setAvailableCrew([]);
        return;
      }

      // Get crew from each port (response is a raw array)
      const crewPromises = portsInSector.map(p => crewApi.getAtPort(p.port_id));
      const crewResults = await Promise.all(crewPromises);
      const allCrew = crewResults.flatMap(res => Array.isArray(res.data) ? res.data : (res.data?.crew || []));

      setAvailableCrew(allCrew);
    } catch (err) {
      setError('Failed to load available crew');
    } finally {
      setLoading(false);
    }
  };

  const handleHire = async (crewId) => {
    setHiring(crewId);
    setError('');
    try {
      await crewApi.hire(crewId, selectedShip);
      onHired();
      await loadAvailableCrew();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to hire crew');
    } finally {
      setHiring(null);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-space-800 border border-space-600 rounded-xl max-w-2xl w-full max-h-[90vh] overflow-auto">
        {/* Header */}
        <div className="p-6 border-b border-space-600 flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold text-white flex items-center gap-2">
              <UserPlus className="w-6 h-6 text-accent-purple" /> Hire Crew
            </h2>
            <p className="text-gray-400 text-sm">Select a ship to see available crew at nearby ports</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-white p-1">
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Ship Selection */}
        <div className="p-6 border-b border-space-600">
          <label className="block text-sm text-gray-400 mb-2">Select Ship</label>
          <select className="input w-full" value={selectedShip} onChange={(e) => setSelectedShip(e.target.value)}>
            <option value="">Choose a ship...</option>
            {userShips.map(ship => (
              <option key={ship.ship_id} value={ship.ship_id}>
                {ship.name} - {ship.currentSector?.name || 'Unknown Sector'}
              </option>
            ))}
          </select>
          {selectedShipData && (
            <div className="mt-3 p-3 rounded-lg bg-space-700/50 flex items-center gap-3">
              <Rocket className="w-5 h-5 text-accent-cyan" />
              <div>
                <p className="text-white">{selectedShipData.name}</p>
                <p className="text-xs text-gray-400">Location: {selectedShipData.currentSector?.name}</p>
              </div>
            </div>
          )}
        </div>

        {/* Error */}
        {error && (
          <div className="mx-6 mt-4 flex items-center gap-2 p-3 rounded-lg bg-accent-red/10 border border-accent-red/30 text-accent-red">
            <AlertCircle className="w-5 h-5" />
            <span>{error}</span>
          </div>
        )}

        {/* Available Crew */}
        <div className="p-6">
          <h3 className="font-semibold text-white mb-4">Available Crew</h3>
          
          {!selectedShip ? (
            <p className="text-gray-400 text-center py-8">Select a ship to see available crew at nearby ports.</p>
          ) : loading ? (
            <div className="flex justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-accent-cyan"></div>
            </div>
          ) : availableCrew.length === 0 ? (
            <p className="text-gray-400 text-center py-8">No crew available at ports in this sector.</p>
          ) : (
            <div className="space-y-3 max-h-96 overflow-auto">
              {availableCrew.map(c => {
                const gradient = speciesColors[c.species] || 'from-gray-500 to-gray-600';
                return (
                  <div key={c.crew_id} className="flex items-center gap-4 p-4 rounded-lg bg-space-700/50 border border-space-600">
                    <div className={`w-12 h-12 rounded-full bg-gradient-to-br ${gradient} flex items-center justify-center flex-shrink-0`}>
                      <User className="w-6 h-6 text-white/80" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-white">{c.name}</p>
                      <p className="text-sm text-gray-400">{c.species} • Level {c.level}</p>
                      <p className="text-xs text-accent-orange flex items-center gap-1 mt-1">
                        <Wallet className="w-3 h-3" /> {c.salary}/day salary • {c.hiring_fee} hiring fee
                      </p>
                    </div>
                    <button
                      onClick={() => handleHire(c.crew_id)}
                      disabled={hiring === c.crew_id}
                      className="btn btn-primary"
                    >
                      {hiring === c.crew_id ? 'Hiring...' : 'Hire'}
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default HireCrewModal;

