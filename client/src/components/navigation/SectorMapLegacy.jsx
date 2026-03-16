import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { sectors, ships, npcs } from '../../services/api';
import { Map, Navigation, AlertTriangle, Crosshair, Skull, User } from 'lucide-react';

const SectorMap = ({ user }) => {
    const navigate = useNavigate();
    const [sectorList, setSectorList] = useState([]);
    const [currentShip, setCurrentShip] = useState(null);
    const [sectorNpcs, setSectorNpcs] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [moving, setMoving] = useState(false);
    const [toast, setToast] = useState(null);

    useEffect(() => {
        const fetchData = async () => {
            try {
                setLoading(true);
                // Fetch sectors
                const sectorsRes = await sectors.getAll({ limit: 100 });
                setSectorList(sectorsRes.data.data?.sectors || []);

                // Fetch user's active ship to know current location
                // In a real app we might store this in context, but fetching here for safety
                const shipsRes = await ships.getAll();
                const shipList = shipsRes.data.data?.ships || [];
                if (shipList.length > 0) {
                    const activeId = shipsRes.data.data?.active_ship_id;
                    setCurrentShip((activeId && shipList.find(s => s.ship_id === activeId)) || shipList[0]);
                }

            } catch (err) {
                console.error("Failed to load map data", err);
                setError("Failed to load star map data.");
            } finally {
                setLoading(false);
            }
        };

        fetchData();
    }, [user]);

    // Fetch NPCs whenever ship moves to a new sector
    useEffect(() => {
        if (currentShip?.currentSector?.sector_id) {
            fetchNpcs(currentShip.currentSector.sector_id);
        }
    }, [currentShip?.currentSector?.sector_id]);

    const fetchNpcs = async (sectorId) => {
        try {
            const res = await npcs.getInSector(sectorId);
            setSectorNpcs(res.data.npcs || []);
        } catch (err) {
            console.error("Failed to fetch NPCs", err);
        }
    };

    const handleEnterCombat = (npc) => {
        navigate('/combat', { state: { npc } });
    };

    const handleMove = async (targetSectorId) => {
        if (!currentShip) return;
        if (moving) return;

        try {
            setMoving(true);
            await ships.move(currentShip.ship_id, targetSectorId);

            // Update local state to reflect new location immediately
            setCurrentShip(prev => ({
                ...prev,
                currentSector: sectorList.find(s => s.sector_id === targetSectorId)
            }));

            // Optional: Refresh ship details to get updated fuel, etc.
            // const updatedShip = await ships.getById(currentShip.ship_id);
            // setCurrentShip(updatedShip.data);

        } catch (err) {
            console.error("Move failed", err);
            setToast({ message: err.response?.data?.error || "Movement failed", type: 'error' });
            setTimeout(() => setToast(null), 5000);
        } finally {
            setMoving(false);
        }
    };

    if (loading) return <div className="p-8 text-center text-accent-cyan">Scanning sector data...</div>;
    if (error) return <div className="p-8 text-center text-accent-red"><AlertTriangle className="inline mr-2" />{error}</div>;

    // Grid Rendering Logic
    // Assuming sectors have x_coord (1-10) and y_coord (1-10)
    // We can render a 10x10 grid.
    const gridSize = 10;
    const grid = Array(gridSize).fill(null).map(() => Array(gridSize).fill(null));

    sectorList.forEach(sector => {
        const x = sector.x_coord;
        const y = sector.y_coord;
        if (x >= 0 && x < gridSize && y >= 0 && y < gridSize) {
            grid[y][x] = sector;
        }
    });

    return (
        <div className="p-6 max-w-6xl mx-auto">
            {toast && (
                <div className={`flex items-center justify-between p-3 rounded-lg border mb-4 ${toast.type === 'error' ? 'bg-accent-red/10 border-accent-red/30 text-accent-red' : 'bg-accent-green/10 border-accent-green/30 text-accent-green'}`}>
                    <span className="flex items-center gap-2"><AlertTriangle className="w-4 h-4" />{toast.message}</span>
                    <button onClick={() => setToast(null)} className="text-xs underline ml-4">dismiss</button>
                </div>
            )}
            <div className="flex justify-between items-center mb-6">
                <div>
                    <h1 className="text-3xl font-bold text-white flex items-center gap-3">
                        <Map className="w-8 h-8 text-accent-cyan" />
                        Galactic Starmap
                    </h1>
                    <p className="text-gray-400 mt-1">
                        Current Location: <span className="text-accent-cyan">{currentShip?.currentSector?.name || 'Unknown'}</span>
                    </p>
                </div>
                <div className="text-right">
                    <div className="text-sm text-gray-400">Ship Status</div>
                    <div className="text-white font-mono">{currentShip?.name}</div>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
                <div className="lg:col-span-3">
                    <div className="card p-4 overflow-x-auto mb-4">
                        <div className="grid gap-2" style={{ gridTemplateColumns: `repeat(${gridSize}, minmax(4rem, 1fr))` }}>
                            {grid.map((row, y) => (
                                row.map((sector, x) => {
                                    const isCurrentLocation = currentShip?.currentSector?.sector_id === sector?.sector_id;
                                    const isDiscovered = !!sector;

                                    // Calculate adjacency
                                    // currentShip.currentSector only has ID/Name, so we find full sector object from list
                                    const currentSectorFull = currentShip?.currentSector ? sectorList.find(s => s.sector_id === currentShip.currentSector.sector_id) : null;
                                    const isAdjacent = currentSectorFull && sector && (
                                        (Math.abs(sector.x_coord - currentSectorFull.x_coord) === 1 && sector.y_coord === currentSectorFull.y_coord) ||
                                        (Math.abs(sector.y_coord - currentSectorFull.y_coord) === 1 && sector.x_coord === currentSectorFull.x_coord)
                                    );

                                    return (
                                        <div
                                            key={`${x}-${y}`}
                                            onClick={() => (sector && (isAdjacent || isCurrentLocation)) ? handleMove(sector.sector_id) : null}
                                            className={`
                            aspect-square rounded border transition-all duration-200 flex flex-col items-center justify-center p-1 text-center relative group
                            ${!sector ? 'border-space-800 bg-space-900/50 opacity-20 cursor-default' : ''}
                            ${sector && !isDiscovered ? 'border-space-700 bg-space-800 text-gray-600' : ''}
                            ${sector && isDiscovered ? 'border-space-600 bg-space-800' : ''}
                            ${isCurrentLocation ? 'border-accent-cyan bg-accent-cyan/10 ring-1 ring-accent-cyan shadow-[0_0_15px_rgba(6,182,212,0.3)] z-10' : ''}
                            ${isAdjacent ? 'border-accent-cyan/50 bg-accent-cyan/5 hover:bg-accent-cyan/20 cursor-pointer' : ''}
                            ${!isAdjacent && !isCurrentLocation && sector ? 'opacity-50 cursor-not-allowed' : ''}
                            ${sector?.hazard_level > 3 ? 'border-accent-red/30 bg-accent-red/5' : ''}
                          `}
                                        >
                                            {sector ? (
                                                <>
                                                    {isCurrentLocation && (
                                                        <Navigation className="w-6 h-6 text-accent-cyan -mt-1 mb-1 animate-pulse" />
                                                    )}
                                                    {!isCurrentLocation && isDiscovered && (
                                                        <div className={`w-2 h-2 rounded-full mb-1 ${sector.type === 'nebula' ? 'bg-accent-purple' : 'bg-gray-500'}`} />
                                                    )}

                                                    <div className="text-[10px] leading-tight font-medium truncate w-full px-1">
                                                        {sector.name}
                                                    </div>

                                                    {/* Tooltip */}
                                                    <div className="absolute z-10 bottom-full mb-2 hidden group-hover:block w-48 bg-space-900 border border-space-600 rounded p-2 text-left shadow-xl pointer-events-none">
                                                        <div className="font-bold text-accent-cyan mb-1">{sector.name}</div>
                                                        <div className="text-xs text-gray-300">Type: {sector.type}</div>
                                                        <div className="text-xs text-gray-300">Coords: {sector.x_coord}, {sector.y_coord}</div>
                                                        <div className="text-xs text-accent-red mt-1">Hazard Lvl: {sector.hazard_level}</div>
                                                        {isCurrentLocation && <div className="text-xs text-accent-green mt-1 font-bold">CURRENT LOCATION</div>}
                                                    </div>
                                                </>
                                            ) : (
                                                <span className="text-space-700 text-xs">Uncharted</span>
                                            )}
                                        </div>
                                    );
                                })
                            ))}
                        </div>
                    </div>

                    <div className="mt-4 flex gap-4 text-sm text-gray-400">
                        <div className="flex items-center gap-2">
                            <div className="w-3 h-3 border border-accent-cyan bg-accent-cyan/10"></div>
                            <span>Current Location</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <div className="w-3 h-3 bg-accent-purple rounded-full"></div>
                            <span>Nebula</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <div className="w-3 h-3 border border-accent-red/30 bg-accent-red/5"></div>
                            <span>High Danger</span>
                        </div>
                    </div>
                </div>

                {/* NPC Side Panel */}
                <div className="lg:col-span-1 space-y-4">
                    <div className="card p-4 h-full border-space-700">
                        <h3 className="text-lg font-bold text-white flex items-center gap-2 mb-4">
                            <Crosshair className="w-5 h-5 text-accent-red" />
                            Sector Scanner
                        </h3>

                        {sectorNpcs.length === 0 ? (
                            <div className="text-center text-gray-500 py-8 italic border border-dashed border-space-700 rounded">
                                No local contacts detected.
                            </div>
                        ) : (
                            <div className="space-y-3">
                                {sectorNpcs.map(npc => (
                                    <div key={npc.npc_id} className="bg-space-800 p-3 rounded border border-space-600 hover:border-accent-red/50 transition-colors">
                                        <div className="flex justify-between items-start mb-2">
                                            <div>
                                                <div className="text-white font-bold text-sm">{npc.name}</div>
                                                <div className="text-xs text-accent-orange">{npc.faction || 'Outlaw'}</div>
                                            </div>
                                            {npc.is_hostile ? (
                                                <Skull className="w-4 h-4 text-accent-red" title="Hostile" />
                                            ) : (
                                                <User className="w-4 h-4 text-accent-cyan" title="Neutral" />
                                            )}
                                        </div>

                                        <div className="text-xs text-gray-400 mb-3 space-y-1">
                                            <div className="flex justify-between">
                                                <span>Ship:</span>
                                                <span className="text-gray-300">{npc.ship_class || 'Unknown'}</span>
                                            </div>
                                            <div className="flex justify-between">
                                                <span>Difficulty:</span>
                                                <span className="text-accent-red">{npc.difficulty_level}/10</span>
                                            </div>
                                        </div>

                                        <button
                                            onClick={() => handleEnterCombat(npc)}
                                            className="btn btn-danger w-full text-xs py-1.5 flex items-center justify-center gap-2"
                                        >
                                            <Crosshair className="w-3 h-3" /> Engage Hostile
                                        </button>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default SectorMap;
