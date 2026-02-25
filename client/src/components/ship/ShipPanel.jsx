import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ships, trade, planets } from '../../services/api';
import CargoHold from './CargoHold';
import { Rocket, Shield, Activity, Fuel, Box, Anchor, Zap } from 'lucide-react';

const ShipPanel = () => {
    const navigate = useNavigate();
    const [ship, setShip] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        const fetchData = async () => {
            try {
                setLoading(true);
                // Get all ships
                const shipsRes = await ships.getAll();
                const shipList = shipsRes.data.data?.ships || [];

                if (shipList.length > 0) {
                    // For now, just use the first ship found
                    // In a real multi-ship game, we'd probably have a selector or route param
                    const shipId = shipList[0].ship_id;
                    const shipDetailRes = await ships.getById(shipId);
                    setShip(shipDetailRes.data.data.ship);
                } else {
                    setError("No ships found for this commander.");
                }
            } catch (err) {
                console.error("Failed to load ship data", err);
                setError("Failed to retrieve ship status.");
            } finally {
                setLoading(false);
            }
        };

        fetchData();
    }, []);

    if (loading) return <div className="p-8 text-center text-accent-cyan">Establishing link with ship computer...</div>;
    if (error) return <div className="p-8 text-center text-accent-red">{error}</div>;
    if (!ship) return <div className="p-8 text-center text-gray-400">No active ship detected.</div>;

    // Helper for percentage
    const getPercent = (current, max) => Math.max(0, Math.min(100, (current / max) * 100));

    return (
        <div className="max-w-4xl mx-auto space-y-6">
            <header className="flex justify-between items-center mb-6">
                <div>
                    <h1 className="text-3xl font-bold text-white flex items-center gap-3">
                        <Rocket className="w-8 h-8 text-accent-cyan" />
                        Ship Status
                    </h1>
                    <p className="text-gray-400 mt-1">
                        USS <span className="text-white font-mono">{ship.name}</span> • {String(ship.ship_type || 'Unknown').replace('_', ' ')}
                    </p>
                </div>
                <div className="text-right">
                    <div className="badge-cyan text-sm px-3 py-1 rounded-full border border-accent-cyan/30 bg-accent-cyan/10">
                        Active
                    </div>
                </div>
            </header>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Main Stats Card */}
                <div className="card p-6 space-y-6">
                    <h2 className="card-header flex items-center gap-2 text-xl">
                        <Activity className="w-5 h-5" /> Systems Integrity
                    </h2>

                    {/* Hull */}
                    <div className="space-y-1">
                        <div className="flex justify-between text-sm">
                            <span className="text-gray-400 flex items-center gap-2"><div className="w-2 h-2 bg-accent-red rounded-full"></div>Hull</span>
                            <span className="text-white font-mono">{ship.hull_points} / {ship.max_hull_points}</span>
                        </div>
                        <div className="progress-bar">
                            <div
                                className="progress-fill bg-accent-red"
                                style={{ width: `${getPercent(ship.hull_points, ship.max_hull_points)}%` }}
                            />
                        </div>
                    </div>

                    {/* Shields */}
                    <div className="space-y-1">
                        <div className="flex justify-between text-sm">
                            <span className="text-gray-400 flex items-center gap-2"><div className="w-2 h-2 bg-accent-cyan rounded-full"></div>Shields</span>
                            <span className="text-white font-mono">{ship.shield_points} / {ship.max_shield_points}</span>
                        </div>
                        <div className="progress-bar">
                            <div
                                className="progress-fill bg-accent-cyan"
                                style={{ width: `${getPercent(ship.shield_points, ship.max_shield_points)}%` }}
                            />
                        </div>
                    </div>

                    {/* Fuel */}
                    <div className="space-y-1">
                        <div className="flex justify-between text-sm">
                            <span className="text-gray-400 flex items-center gap-2"><div className="w-2 h-2 bg-accent-orange rounded-full"></div>Fuel</span>
                            <span className="text-white font-mono">{ship.fuel} / {ship.max_fuel}</span>
                        </div>
                        <div className="progress-bar">
                            <div
                                className="progress-fill bg-accent-orange"
                                style={{ width: `${getPercent(ship.fuel, ship.max_fuel)}%` }}
                            />
                        </div>
                    </div>
                </div>

                {/* Cargo & Navigation Card */}
                <div className="card p-6 flex flex-col justify-between">
                    <div className="space-y-6">
                        <h2 className="card-header flex items-center gap-2 text-xl">
                            <Box className="w-5 h-5" /> Cargo & Location
                        </h2>

                        {/* Cargo */}
                        <div className="space-y-1">
                            <div className="flex justify-between text-sm">
                                <span className="text-gray-400">Cargo Hold</span>
                                <span className="text-white font-mono">{ship.cargo_used || 0} / {ship.cargo_capacity} units</span>
                            </div>
                            <div className="progress-bar">
                                <div
                                    className="progress-fill bg-space-500"
                                    style={{ width: `${getPercent(ship.cargo_used || 0, ship.cargo_capacity)}%` }}
                                />
                            </div>
                        </div>

                        {/* Location */}
                        <div className="bg-space-800 p-4 rounded border border-space-600">
                            <div className="text-gray-400 text-sm mb-1">Current Sector</div>
                            <div className="text-xl text-accent-cyan font-bold flex items-center gap-2">
                                <Anchor className="w-5 h-5" />
                                {ship.currentSector?.name || ship.current_sector?.name || "Unknown Space"}
                            </div>
                        </div>
                    </div>

                    {/* Action Buttons */}
                    <div className="grid grid-cols-2 gap-3 mt-6">
                        <button
                            onClick={() => navigate('/map')}
                            className="btn btn-primary flex justify-center items-center gap-2"
                        >
                            <Rocket className="w-4 h-4" /> Navigate
                        </button>
                        <button
                            onClick={() => navigate('/trading')}
                            className="btn btn-secondary flex justify-center items-center gap-2"
                        >
                            <Zap className="w-4 h-4" /> Trade
                        </button>
                        <button
                            onClick={async () => {
                                const sector = ship.currentSector || ship.current_sector;
                                if (!sector?.sector_id) return;
                                try {
                                    // Assuming planets.scan returns data or initiates a background scan
                                    // There is no specific response format given for scan in the prompts, 
                                    // but usually it returns a list of planets or a success message.
                                    // We'll just alert success for now.
                                    await planets.scan(sector.sector_id);
                                    alert(`Scan complete for ${sector.name}. Check Planets databank.`);
                                } catch (e) {
                                    console.error("Scan failed", e);
                                    alert("Scan failed: " + (e.response?.data?.error || e.message));
                                }
                            }}
                            className="btn btn-secondary flex justify-center items-center gap-2 col-span-2 md:col-span-1"
                        >
                            <Activity className="w-4 h-4" /> Scan
                        </button>
                    </div>
                </div>
            </div>

            {/* Detailed Cargo Manifest */}
            <CargoHold
                shipId={ship.ship_id}
                capacity={ship.cargo_capacity}
                used={ship.cargo_used}
            />
        </div>
    );
};

export default ShipPanel;
