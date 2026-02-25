import { useState, useEffect } from 'react';
import { planets, ships } from '../../services/api';
import { Globe, Scan, ChevronRight, Sparkles, Crown, AlertCircle } from 'lucide-react';
import PlanetCard from './PlanetCard';
import PlanetDetails from './PlanetDetails';
import ArtifactsList from './ArtifactsList';

function PlanetsPage({ user }) {
  const [userShips, setUserShips] = useState([]);
  const [selectedShip, setSelectedShip] = useState(null);
  const [discoveredPlanets, setDiscoveredPlanets] = useState([]);
  const [ownedPlanets, setOwnedPlanets] = useState([]);
  const [artifacts, setArtifacts] = useState([]);
  const [selectedPlanet, setSelectedPlanet] = useState(null);
  const [scanning, setScanning] = useState(false);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState('scan');

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [shipsRes, planetsRes, artifactsRes] = await Promise.all([
          ships.getAll(),
          planets.getUserPlanets(),
          planets.getUserArtifacts(),
        ]);
        // Handle different response formats
        // API returns { success: true, data: { ships: [...] } }
        const shipsList = shipsRes.data.data?.ships || [];
        const planetsList = Array.isArray(planetsRes.data) ? planetsRes.data : (planetsRes.data?.planets || []);
        const artifactsList = Array.isArray(artifactsRes.data) ? artifactsRes.data : (artifactsRes.data?.artifacts || []);
        setUserShips(shipsList);
        setOwnedPlanets(planetsList);
        setArtifacts(artifactsList);
        if (shipsList.length > 0) {
          setSelectedShip(shipsList[0]);
        }
      } catch (err) {
        setError('Failed to load data');
      }
    };
    fetchData();
  }, []);

  const handleScan = async () => {
    if (!selectedShip) return;
    setScanning(true);
    setError('');
    try {
      const res = await planets.scan(selectedShip.current_sector_id);
      setDiscoveredPlanets(res.data.planets || []);
    } catch (err) {
      setError(err.response?.data?.error || 'Scan failed');
    } finally {
      setScanning(false);
    }
  };

  const handleClaimArtifact = async (artifactId) => {
    try {
      await planets.claimArtifact(artifactId);
      const res = await planets.getUserArtifacts();
      setArtifacts(Array.isArray(res.data) ? res.data : (res.data?.artifacts || []));
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to claim artifact');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <Globe className="w-7 h-7 text-accent-cyan" />
            Planet Exploration
          </h1>
          <p className="text-gray-400">Scan sectors to discover planets and artifacts</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-space-600 pb-2">
        <TabButton active={activeTab === 'scan'} onClick={() => setActiveTab('scan')} icon={Scan} label="Scan Sector" />
        <TabButton active={activeTab === 'owned'} onClick={() => setActiveTab('owned')} icon={Crown} label={`Owned (${ownedPlanets.length})`} />
        <TabButton active={activeTab === 'artifacts'} onClick={() => setActiveTab('artifacts')} icon={Sparkles} label={`Artifacts (${artifacts.length})`} />
      </div>

      {error && (
        <div className="flex items-center gap-2 p-3 rounded-lg bg-accent-red/10 border border-accent-red/30 text-accent-red">
          <AlertCircle className="w-5 h-5" />
          <span>{error}</span>
        </div>
      )}

      {activeTab === 'scan' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Scan Controls */}
          <div className="card">
            <h2 className="card-header"><Scan className="w-5 h-5" /> Sector Scanner</h2>

            <div className="space-y-4">
              <div>
                <label className="block text-sm text-gray-400 mb-2">Select Ship</label>
                <select
                  className="input w-full"
                  value={selectedShip?.ship_id || ''}
                  onChange={(e) => setSelectedShip(userShips.find(s => s.ship_id === e.target.value))}
                >
                  {userShips.map(ship => (
                    <option key={ship.ship_id} value={ship.ship_id}>
                      {ship.name} - {ship.currentSector?.name || 'Unknown'}
                    </option>
                  ))}
                </select>
              </div>

              {selectedShip && (
                <div className="p-3 rounded-lg bg-space-700/50">
                  <p className="text-sm text-gray-400">Current Location</p>
                  <p className="text-white font-medium">{selectedShip.currentSector?.name || 'Unknown Sector'}</p>
                </div>
              )}

              <button onClick={handleScan} disabled={scanning || !selectedShip} className="btn btn-primary w-full flex items-center justify-center gap-2">
                {scanning ? (
                  <><div className="w-5 h-5 border-2 border-space-900 border-t-transparent rounded-full animate-spin" /> Scanning...</>
                ) : (
                  <><Scan className="w-5 h-5" /> Scan Sector</>
                )}
              </button>
            </div>
          </div>

          {/* Discovered Planets */}
          <div className="lg:col-span-2 card">
            <h2 className="card-header"><Globe className="w-5 h-5" /> Discovered Planets</h2>
            {discoveredPlanets.length === 0 ? (
              <p className="text-gray-400 text-center py-8">No planets discovered. Scan a sector to find planets.</p>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {discoveredPlanets.map(planet => (
                  <PlanetCard key={planet.planet_id} planet={planet} onClick={() => setSelectedPlanet(planet)} />
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {activeTab === 'owned' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {ownedPlanets.length === 0 ? (
            <p className="text-gray-400 col-span-full text-center py-8">You don't own any planets yet. Colonize planets to claim ownership.</p>
          ) : (
            ownedPlanets.map(planet => (
              <PlanetCard key={planet.planet_id} planet={planet} onClick={() => setSelectedPlanet(planet)} owned />
            ))
          )}
        </div>
      )}

      {activeTab === 'artifacts' && <ArtifactsList artifacts={artifacts} onClaim={handleClaimArtifact} />}

      {selectedPlanet && (
        <PlanetDetails planet={selectedPlanet} ships={userShips} onClose={() => setSelectedPlanet(null)} onColonize={() => {
          planets.getUserPlanets().then(res => setOwnedPlanets(res.data));
        }} />
      )}
    </div>
  );
}

function TabButton({ active, onClick, icon: Icon, label }) {
  return (
    <button onClick={onClick} className={`flex items-center gap-2 px-4 py-2 rounded-t-lg transition-all ${active ? 'bg-space-700 text-accent-cyan border-b-2 border-accent-cyan' : 'text-gray-400 hover:text-white'}`}>
      <Icon className="w-4 h-4" />
      {label}
    </button>
  );
}

export default PlanetsPage;

