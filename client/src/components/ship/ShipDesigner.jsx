import { useState, useEffect } from 'react';
import { designer, ships } from '../../services/api';
import { Wrench, Zap, Shield, Crosshair, Cpu, Trash2, PlusCircle, AlertTriangle } from 'lucide-react';

const ShipDesigner = () => {
    const [ship, setShip] = useState(null);
    const [installed, setInstalled] = useState([]);
    const [available, setAvailable] = useState([]);
    const [stats, setStats] = useState(null);
    const [loading, setLoading] = useState(true);
    const [actionLoading, setActionLoading] = useState(false);
    const [error, setError] = useState(null);

    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async () => {
        try {
            setLoading(true);
            // 1. Get active ship
            const shipsRes = await ships.getAll();
            if (!shipsRes.data.data?.ships || shipsRes.data.data.ships.length === 0) {
                throw new Error("No active ship found.");
            }
            const activeShip = shipsRes.data.data.ships[0];
            const shipId = activeShip.ship_id;

            // 2. Get Design & Components
            const [designRes, componentsRes] = await Promise.all([
                designer.getDesign(shipId),
                designer.getComponents()
            ]);

            const design = designRes.data.design;

            // Map backend "design" to UI "ship" state
            setShip({
                ship_id: design.ship_id,
                name: design.ship_name,
                ship_type: design.ship_type,
                slots: design.slots.reduce((sum, s) => sum + s.max, 0)
            });

            // Flatten component map to array
            const allComponents = Object.values(design.components).flat();
            setInstalled(allComponents);

            // Compute power stats from components
            const powerUsed = allComponents.reduce((sum, c) => sum + (c.energy_cost || 0), 0);
            setStats({
              ...design.stats,
              power_used: powerUsed,
              power_max: activeShip.max_energy || 100,
              total_damage: design.stats.attack || 0,
              total_shields: design.stats.shields || 0
            });
            setAvailable(componentsRes.data.components || []);

        } catch (err) {
            console.error("Designer load failed", err);
            setError("Failed to load ship design systems.");
        } finally {
            setLoading(false);
        }
    };

    const handleInstall = async (componentId) => {
        try {
            setActionLoading(true);
            await designer.install(ship.ship_id, componentId);
            await fetchData(); // Refresh all state
        } catch (err) {
            console.error("Install failed", err);
            alert(err.response?.data?.error || "Installation failed. Check slots or power.");
        } finally {
            setActionLoading(false);
        }
    };

    const handleUninstall = async (componentId) => {
        try {
            setActionLoading(true);
            await designer.uninstall(ship.ship_id, componentId);
            await fetchData(); // Refresh all state
        } catch (err) {
            console.error("Uninstall failed", err);
            alert(err.response?.data?.error || "Uninstall failed.");
        } finally {
            setActionLoading(false);
        }
    };

    if (loading) return <div className="p-8 text-center text-accent-cyan">Initializing Engineering Subsystems...</div>;
    if (error) return <div className="p-8 text-center text-accent-red">{error}</div>;

    const powerPercent = Math.min(100, (stats.power_used / stats.power_max) * 100);

    return (
        <div className="max-w-6xl mx-auto space-y-6">
            <header className="flex justify-between items-center mb-6">
                <div>
                    <h1 className="text-3xl font-bold text-white flex items-center gap-3">
                        <Wrench className="w-8 h-8 text-accent-cyan" />
                        Shipyard & Desiger
                    </h1>
                    <p className="text-gray-400 mt-1">
                        Modifying: <span className="text-white font-mono">{ship.name}</span>
                    </p>
                </div>
                <div className="text-right">
                    <div className="text-sm text-gray-400">Available Slots</div>
                    <div className="text-2xl font-bold text-accent-cyan">
                        {installed.length} / {ship.slots}
                    </div>
                </div>
            </header>

            {/* Stats Overview */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="card p-4 flex items-center gap-3">
                    <div className="p-2 bg-accent-orange/10 rounded-lg"><Zap className="w-6 h-6 text-accent-orange" /></div>
                    <div>
                        <div className="text-xs text-gray-400 uppercase">Power Grid</div>
                        <div className="text-lg font-bold text-white">{stats.power_used} / {stats.power_max} MW</div>
                        <div className="w-full bg-gray-700 h-1 mt-1 rounded-full overflow-hidden">
                            <div className={`h-full ${powerPercent > 90 ? 'bg-accent-red' : 'bg-accent-orange'}`} style={{ width: `${powerPercent}%` }}></div>
                        </div>
                    </div>
                </div>
                <div className="card p-4 flex items-center gap-3">
                    <div className="p-2 bg-accent-red/10 rounded-lg"><Crosshair className="w-6 h-6 text-accent-red" /></div>
                    <div>
                        <div className="text-xs text-gray-400 uppercase">Total Firepower</div>
                        <div className="text-lg font-bold text-white">{stats.total_damage} DPS</div>
                    </div>
                </div>
                <div className="card p-4 flex items-center gap-3">
                    <div className="p-2 bg-accent-cyan/10 rounded-lg"><Shield className="w-6 h-6 text-accent-cyan" /></div>
                    <div>
                        <div className="text-xs text-gray-400 uppercase">Shield Rating</div>
                        <div className="text-lg font-bold text-white">{stats.total_shields} MJ</div>
                    </div>
                </div>
                <div className="card p-4 flex items-center gap-3">
                    <div className="p-2 bg-space-600/30 rounded-lg"><Cpu className="w-6 h-6 text-accent-purple" /></div>
                    <div>
                        <div className="text-xs text-gray-400 uppercase">System Status</div>
                        <div className="text-sm font-medium text-accent-green">Operational</div>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* Installed Components */}
                <div className="space-y-4">
                    <h2 className="text-xl font-bold text-white flex items-center gap-2 border-b border-space-700 pb-2">
                        <Cpu className="w-5 h-5 text-accent-cyan" /> Installed Systems
                    </h2>

                    {installed.length === 0 ? (
                        <div className="p-8 text-center text-gray-500 border border-dashed border-space-700 rounded-lg">
                            No components installed. Ship is non-operational.
                        </div>
                    ) : (
                        <div className="space-y-3">
                            {installed.map((item) => (
                                <div key={item.ship_component_id} className="card p-4 flex justify-between items-center group hover:border-accent-cyan/50 transition-colors">
                                    <div className="flex items-center gap-4">
                                        <div className="w-10 h-10 bg-space-800 rounded flex items-center justify-center">
                                            {item.type === 'weapon' ? <Crosshair className="text-accent-red" /> :
                                                item.type === 'shield' ? <Shield className="text-accent-cyan" /> : <Cpu className="text-gray-400" />}
                                        </div>
                                        <div>
                                            <div className="font-bold text-white">{item.name}</div>
                                            <div className="text-xs text-gray-400 flex gap-3">
                                                <span>Tier: {item.tier}</span>
                                                <span className={`${item.condition < 0.5 ? 'text-accent-red' : 'text-accent-green'}`}>Cond: {(item.condition * 100).toFixed(0)}%</span>
                                                <span className="uppercase text-[10px] text-gray-500 mt-0.5">{item.type}</span>
                                            </div>
                                        </div>
                                    </div>
                                    <button
                                        onClick={() => handleUninstall(item.ship_component_id)}
                                        disabled={actionLoading}
                                        className="btn btn-danger p-2 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                                        title="Uninstall"
                                    >
                                        <Trash2 className="w-4 h-4" />
                                    </button>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Available Components */}
                <div className="space-y-4">
                    <h2 className="text-xl font-bold text-white flex items-center gap-2 border-b border-space-700 pb-2">
                        <PlusCircle className="w-5 h-5 text-accent-green" /> Available Components
                    </h2>

                    <div className="space-y-3">
                        {available.map((comp) => {
                            const canAfford = true; // Assuming free component pool or prepaid for now based on prompt simplicity. 
                            // Real logic would check User Credits vs Price if components cost money.
                            // Tasks.md doesn't specify component costs in listing, only install/uninstall.

                            const fitsPower = (stats.power_used + comp.energy_cost) <= stats.power_max;
                            const hasSlots = installed.length < ship.slots;

                            return (
                                <div key={comp.id || comp.name} className="card p-4 flex justify-between items-center">
                                    <div className="flex items-center gap-4">
                                        <div className="w-10 h-10 bg-space-800 rounded flex items-center justify-center">
                                            <Cpu className="text-gray-500" />
                                        </div>
                                        <div>
                                            <div className="font-bold text-white">{comp.name}</div>
                                            <div className="text-xs text-gray-400 flex gap-3">
                                                <span className={`${!fitsPower ? 'text-accent-red' : ''}`}>Pwr: {comp.energy_cost}</span>
                                                <span>{comp.type}</span>
                                            </div>
                                            {comp.stats && (
                                                <div className="text-xs text-accent-cyan mt-1">
                                                    {Object.entries(comp.stats).map(([k, v]) => `${k}: ${v}`).join(', ')}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                    <button
                                        onClick={() => handleInstall(comp.id || comp.component_id)} // Check API response field for ID
                                        disabled={actionLoading || !hasSlots || !fitsPower}
                                        className="btn btn-primary text-xs px-3 py-1 flex items-center gap-1 disabled:opacity-50 disabled:cursor-not-allowed"
                                    >
                                        {!hasSlots ? 'No Slots' : !fitsPower ? 'Low Power' : 'Install'}
                                    </button>
                                </div>
                            );
                        })}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ShipDesigner;
