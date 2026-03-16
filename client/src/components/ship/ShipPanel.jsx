import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ships, trade, planets, auth, fleets as fleetsApi, designer } from '../../services/api';
import CargoHold from './CargoHold';
import ArtifactEquipment from './ArtifactEquipment';
import { Rocket, Shield, Activity, Fuel, Box, Anchor, Zap, Gem, ChevronDown, ChevronRight, Skull, Swords, Users, Trash2, Edit3, MapPin, X, Wrench, Palette, AlertTriangle as AlertWarn, Hammer } from 'lucide-react';
import { getShipIcon } from '../../utils/shipIcons';
import { useNotifications } from '../../contexts/NotificationContext';

const ShipPanel = ({ user }) => {
    const navigate = useNavigate();
    const notify = useNotifications();
    const [ship, setShip] = useState(null);
    const [allShips, setAllShips] = useState([]);
    const [activeShipId, setActiveShipId] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [dropdownOpen, setDropdownOpen] = useState(false);

    // Fleet state
    const [userFleets, setUserFleets] = useState([]);
    const [expandedFleetId, setExpandedFleetId] = useState(null);
    const [renamingFleetId, setRenamingFleetId] = useState(null);
    const [renameValue, setRenameValue] = useState('');
    const [damagedComponents, setDamagedComponents] = useState(0);
    const [showCreateFleet, setShowCreateFleet] = useState(false);
    const [newFleetName, setNewFleetName] = useState('');
    const [newFleetShips, setNewFleetShips] = useState([]);

    const loadShipDetails = async (shipId) => {
        const shipDetailRes = await ships.getById(shipId);
        setShip(shipDetailRes.data.data.ship);
        try {
            const designRes = await designer.getDesign(shipId);
            const components = Object.values(designRes.data.design?.components || {}).flat();
            setDamagedComponents(components.filter(c => c.condition < 0.7).length);
        } catch { setDamagedComponents(0); }
    };

    const loadFleets = async () => {
        try {
            const res = await fleetsApi.getAll();
            setUserFleets(res.data.data?.fleets || []);
        } catch (err) {
            console.error('Failed to load fleets', err);
        }
    };

    useEffect(() => {
        const fetchData = async () => {
            try {
                setLoading(true);
                const shipsRes = await ships.getAll();
                const shipList = shipsRes.data.data?.ships || [];
                const serverActiveId = shipsRes.data.data?.active_ship_id;

                if (shipList.length > 0) {
                    const liveShips = shipList.filter(s => s.is_active !== false);
                    if (liveShips.length === 0) {
                        setError("No active ships available.");
                        return;
                    }
                    setAllShips(shipList);
                    const selectedId = (serverActiveId && liveShips.find(s => s.ship_id === serverActiveId))
                        ? serverActiveId : liveShips[0].ship_id;
                    setActiveShipId(selectedId);
                    await loadShipDetails(selectedId);
                } else {
                    setError("No ships found for this commander.");
                }

                await loadFleets();
            } catch (err) {
                console.error("Failed to load ship data", err);
                setError("Failed to retrieve ship status.");
            } finally {
                setLoading(false);
            }
        };

        fetchData();
    }, []);

    const handleActivateShip = async (shipId) => {
        try {
            await ships.activate(shipId);
            setActiveShipId(shipId);
            await loadShipDetails(shipId);
        } catch (err) {
            notify.error(err.response?.data?.message || 'Failed to activate ship');
        }
    };

    const handlePvPToggle = async () => {
        try {
            const res = await auth.togglePvP();
            const enabled = res.data.data.pvp_enabled;
            if (enabled) notify.warning(`PvP enabled`);
            else notify.info(`PvP disabled`);
        } catch (err) {
            console.error('Failed to toggle PvP:', err);
            notify.error(err.response?.data?.message || 'Failed to toggle PvP');
        }
    };

    const handleDisbandFleet = async (fleetId) => {
        if (!confirm('Disband this fleet? Ships will be unassigned.')) return;
        try {
            await fleetsApi.disband(fleetId);
            notify.success('Fleet disbanded');
            await loadFleets();
        } catch (err) {
            notify.error(err.response?.data?.message || 'Failed to disband fleet');
        }
    };

    const handleRenameFleet = async (fleetId) => {
        if (!renameValue.trim()) return;
        try {
            await fleetsApi.rename(fleetId, renameValue.trim());
            setRenamingFleetId(null);
            setRenameValue('');
            await loadFleets();
        } catch (err) {
            notify.error(err.response?.data?.message || 'Failed to rename fleet');
        }
    };

    const handleCreateFleet = async () => {
        if (!newFleetName.trim() || newFleetShips.length === 0) {
            notify.error('Enter a fleet name and select at least one ship');
            return;
        }
        try {
            await fleetsApi.create(newFleetName.trim(), newFleetShips);
            notify.success(`Fleet "${newFleetName.trim()}" created`);
            setShowCreateFleet(false);
            setNewFleetName('');
            setNewFleetShips([]);
            await loadFleets();
        } catch (err) {
            notify.error(err.response?.data?.message || 'Failed to create fleet');
        }
    };

    const handleRemoveShipFromFleet = async (fleetId, shipId) => {
        try {
            await fleetsApi.removeShips(fleetId, [shipId]);
            notify.success('Ship removed from fleet');
            await loadFleets();
        } catch (err) {
            notify.error(err.response?.data?.message || 'Failed to remove ship');
        }
    };

    if (loading) return <div className="p-8 text-center text-accent-cyan">Establishing link with ship computer...</div>;
    if (error) return <div className="p-8 text-center text-accent-red">{error}</div>;
    if (!ship) return <div className="p-8 text-center text-gray-400">No active ship detected.</div>;

    // Helper for percentage
    const getPercent = (current, max) => Math.max(0, Math.min(100, (current / max) * 100));

    return (
        <div className="max-w-4xl mx-auto space-y-6">
            {/* Notifications via global toast system */}

            {/* Fleets Section */}
            {(userFleets.length > 0 || allShips.length > 1) && (
                <div className="card p-4">
                    <div className="flex items-center justify-between mb-3">
                        <h2 className="card-header flex items-center gap-2 text-lg">
                            <Users className="w-5 h-5 text-accent-orange" /> Fleets
                        </h2>
                        <button onClick={() => { setShowCreateFleet(true); setNewFleetShips([]); setNewFleetName(''); }} className="text-xs px-3 py-1.5 rounded border border-accent-orange/30 text-accent-orange hover:bg-accent-orange/10 transition-colors">
                            + Create Fleet
                        </button>
                    </div>
                    <div className="space-y-2">
                        {userFleets.map(fleet => {
                            const isExpanded = expandedFleetId === fleet.fleet_id;
                            const isRenaming = renamingFleetId === fleet.fleet_id;
                            const activeShips = fleet.ships?.filter(s => s.is_active !== false) || [];
                            return (
                                <div key={fleet.fleet_id} className="border border-space-600 rounded-lg overflow-hidden">
                                    <div
                                        className="flex items-center justify-between px-3 py-2 bg-space-800 cursor-pointer hover:bg-space-700 transition-colors"
                                        onClick={() => setExpandedFleetId(isExpanded ? null : fleet.fleet_id)}
                                    >
                                        <div className="flex items-center gap-2">
                                            <ChevronRight className={`w-4 h-4 text-gray-400 transition-transform ${isExpanded ? 'rotate-90' : ''}`} />
                                            {isRenaming ? (
                                                <input
                                                    type="text"
                                                    value={renameValue}
                                                    onChange={e => setRenameValue(e.target.value)}
                                                    onKeyDown={e => { if (e.key === 'Enter') handleRenameFleet(fleet.fleet_id); if (e.key === 'Escape') setRenamingFleetId(null); }}
                                                    onClick={e => e.stopPropagation()}
                                                    autoFocus
                                                    className="bg-space-900 border border-accent-cyan/30 rounded px-2 py-0.5 text-sm text-white focus:outline-none w-40"
                                                />
                                            ) : (
                                                <span className="text-sm font-mono text-accent-orange">{fleet.name}</span>
                                            )}
                                            <span className="text-xs text-gray-500">({activeShips.length} ships)</span>
                                        </div>
                                        <div className="flex items-center gap-1">
                                            <button
                                                onClick={e => { e.stopPropagation(); setRenamingFleetId(fleet.fleet_id); setRenameValue(fleet.name); }}
                                                className="p-1 text-gray-500 hover:text-accent-cyan transition-colors"
                                                title="Rename"
                                            >
                                                <Edit3 className="w-3.5 h-3.5" />
                                            </button>
                                            <button
                                                onClick={e => { e.stopPropagation(); handleDisbandFleet(fleet.fleet_id); }}
                                                className="p-1 text-gray-500 hover:text-accent-red transition-colors"
                                                title="Disband"
                                            >
                                                <Trash2 className="w-3.5 h-3.5" />
                                            </button>
                                        </div>
                                    </div>
                                    {isExpanded && (
                                        <div className="px-3 py-2 space-y-1 bg-space-900/50">
                                            {(fleet.ships || []).map(s => (
                                                <div key={s.ship_id} className={`flex items-center justify-between px-2 py-1.5 rounded text-sm ${s.is_active === false ? 'opacity-40' : ''}`}>
                                                    <div className="flex items-center gap-2">
                                                        {s.is_active === false ? (
                                                            <Skull className="w-3.5 h-3.5 text-accent-red" />
                                                        ) : (
                                                            <Rocket className="w-3.5 h-3.5 text-gray-400" />
                                                        )}
                                                        <span className="font-mono text-white">{s.name}</span>
                                                        <span className="text-xs text-gray-500">{s.ship_type}</span>
                                                    </div>
                                                    <div className="flex items-center gap-2">
                                                        <span className="text-xs text-gray-500 flex items-center gap-1">
                                                            <MapPin className="w-3 h-3" />
                                                            {s.currentSector?.name || 'Unknown'}
                                                        </span>
                                                        <span className="text-xs text-gray-500">
                                                            Fuel: {s.fuel}/{s.max_fuel}
                                                        </span>
                                                        {s.is_active !== false && (
                                                            <button
                                                                onClick={() => handleRemoveShipFromFleet(fleet.fleet_id, s.ship_id)}
                                                                className="text-gray-500 hover:text-accent-red transition-colors"
                                                                title="Remove from fleet"
                                                            >
                                                                <X className="w-3.5 h-3.5" />
                                                            </button>
                                                        )}
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                    <p className="text-xs text-gray-600 mt-2">
                        Shift+drag on galaxy map to select ships and create new fleets. Right-click systems to move fleets.
                    </p>
                </div>
            )}

            {/* Create Fleet Modal */}
            {showCreateFleet && (
                <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
                    <div className="card w-full max-w-md p-6 space-y-4">
                        <div className="flex items-center justify-between">
                            <h2 className="text-lg font-bold text-white flex items-center gap-2">
                                <Users className="w-5 h-5 text-accent-orange" /> Create Fleet
                            </h2>
                            <button onClick={() => setShowCreateFleet(false)} data-dismiss className="text-gray-500 hover:text-white">
                                <X className="w-5 h-5" />
                            </button>
                        </div>
                        <div>
                            <label className="text-xs text-gray-400 block mb-1">Fleet Name</label>
                            <input value={newFleetName} onChange={e => setNewFleetName(e.target.value)}
                                placeholder="Alpha Squadron" className="w-full bg-space-900 border border-space-600 text-white rounded px-3 py-2 text-sm focus:border-accent-cyan outline-none" />
                        </div>
                        <div>
                            <label className="text-xs text-gray-400 block mb-1">Select Ships ({newFleetShips.length} selected)</label>
                            <div className="max-h-48 overflow-y-auto space-y-1">
                                {allShips.filter(s => s.is_active !== false).map(s => {
                                    const inFleet = userFleets.some(f => f.ships?.some(fs => fs.ship_id === s.ship_id));
                                    const selected = newFleetShips.includes(s.ship_id);
                                    return (
                                        <label key={s.ship_id} className={`flex items-center gap-2 p-2 rounded cursor-pointer transition-colors ${inFleet ? 'opacity-40' : selected ? 'bg-accent-orange/10 border border-accent-orange/30' : 'hover:bg-space-700 border border-transparent'}`}>
                                            <input type="checkbox" disabled={inFleet} checked={selected}
                                                onChange={() => setNewFleetShips(prev => selected ? prev.filter(id => id !== s.ship_id) : [...prev, s.ship_id])}
                                                className="accent-accent-orange" />
                                            {(() => { const { icon: SIcon, color } = getShipIcon(s.ship_type); return <SIcon className="w-3.5 h-3.5 shrink-0" style={{ color }} />; })()}
                                            <span className="text-sm text-white">{s.name}</span>
                                            <span className="text-xs text-gray-500 ml-auto">{s.ship_type}{inFleet ? ' (in fleet)' : ''}</span>
                                        </label>
                                    );
                                })}
                            </div>
                        </div>
                        <div className="flex justify-end gap-3 pt-2">
                            <button onClick={() => setShowCreateFleet(false)} className="btn btn-secondary text-sm">Cancel</button>
                            <button onClick={handleCreateFleet} disabled={!newFleetName.trim() || newFleetShips.length === 0}
                                className="btn btn-primary text-sm disabled:opacity-50">Create Fleet</button>
                        </div>
                    </div>
                </div>
            )}

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
                {allShips.length > 1 && (
                    <div className="relative">
                        <button
                            onClick={() => setDropdownOpen(!dropdownOpen)}
                            className="flex items-center gap-2 px-4 py-2 rounded-lg border border-accent-cyan/30 bg-accent-cyan/10 text-accent-cyan hover:bg-accent-cyan/20 transition-colors"
                        >
                            <Rocket className="w-4 h-4" />
                            <span className="font-mono text-sm hidden sm:inline">{ship.name}</span>
                            <span className="text-xs opacity-60 hidden sm:inline">({allShips.filter(s => s.is_active !== false).length}/{allShips.length})</span>
                            <ChevronDown className={`w-4 h-4 transition-transform ${dropdownOpen ? 'rotate-180' : ''}`} />
                        </button>
                        {dropdownOpen && (
                            <>
                                <div className="fixed inset-0 z-40" onClick={() => setDropdownOpen(false)} />
                                <div className="absolute right-0 top-full mt-2 z-50 w-72 rounded-lg border border-space-600 bg-space-900 shadow-xl shadow-black/50 overflow-hidden">
                                    <div className="px-3 py-2 border-b border-space-600 text-xs text-gray-500 uppercase tracking-wider">
                                        Fleet Roster — {allShips.filter(s => s.is_active !== false).length} active / {allShips.length} total
                                    </div>
                                    {allShips.map(s => {
                                        const isActive = s.is_active !== false;
                                        const isSelected = s.ship_id === activeShipId;
                                        return (
                                            <button
                                                key={s.ship_id}
                                                onClick={() => {
                                                    if (isActive && !isSelected) {
                                                        handleActivateShip(s.ship_id);
                                                    }
                                                    setDropdownOpen(false);
                                                }}
                                                disabled={!isActive}
                                                className={`w-full flex items-center gap-3 px-3 py-2.5 text-left transition-colors ${
                                                    isSelected
                                                        ? 'bg-accent-cyan/10 border-l-2 border-accent-cyan'
                                                        : isActive
                                                            ? 'hover:bg-space-800 border-l-2 border-transparent'
                                                            : 'opacity-50 border-l-2 border-transparent cursor-not-allowed'
                                                }`}
                                            >
                                                {isActive ? (
                                                    <Rocket className={`w-4 h-4 flex-shrink-0 ${isSelected ? 'text-accent-cyan' : 'text-gray-400'}`} />
                                                ) : (
                                                    <Skull className="w-4 h-4 flex-shrink-0 text-accent-red" />
                                                )}
                                                <div className="flex-1 min-w-0">
                                                    <div className={`font-mono text-sm truncate ${isSelected ? 'text-accent-cyan' : isActive ? 'text-white' : 'text-gray-500'}`}>
                                                        {s.name}
                                                    </div>
                                                    <div className="text-xs text-gray-500">
                                                        {String(s.ship_type || '').replace('_', ' ')}
                                                    </div>
                                                </div>
                                                {isSelected && (
                                                    <span className="text-xs px-2 py-0.5 rounded-full border border-accent-cyan/30 bg-accent-cyan/10 text-accent-cyan">
                                                        Active
                                                    </span>
                                                )}
                                                {!isActive && (
                                                    <span className="text-xs px-2 py-0.5 rounded-full border border-accent-red/30 bg-accent-red/10 text-accent-red">
                                                        Destroyed
                                                    </span>
                                                )}
                                            </button>
                                        );
                                    })}
                                </div>
                            </>
                        )}
                    </div>
                )}
                {allShips.length <= 1 && (
                    <div className="badge-cyan text-sm px-3 py-1 rounded-full border border-accent-cyan/30 bg-accent-cyan/10">
                        Active
                    </div>
                )}
            </header>

            {/* PvP Combat Toggle */}
            <div className="flex items-center justify-between p-3 rounded-lg" style={{
                background: user?.pvp_enabled ? 'rgba(244,67,54,0.08)' : 'rgba(255,255,255,0.02)',
                border: `1px solid ${user?.pvp_enabled ? 'rgba(244,67,54,0.25)' : 'rgba(255,255,255,0.06)'}`
            }}>
                <div className="flex items-center gap-2">
                    <Swords className="w-4 h-4" style={{ color: user?.pvp_enabled ? '#f44336' : '#666' }} />
                    <div>
                        <p className={`text-sm font-medium ${user?.pvp_enabled ? 'text-red-400' : 'text-gray-400'}`}>
                            PvP Combat
                        </p>
                        <p className="text-xs text-gray-600">
                            {user?.pvp_enabled ? 'You can be attacked by same-faction players' : 'Cross-faction PvP is always enabled'}
                        </p>
                    </div>
                </div>
                <button
                    onClick={handlePvPToggle}
                    className={`px-3 py-1 text-xs rounded font-medium transition-all ${
                        user?.pvp_enabled
                            ? 'bg-red-500/20 text-red-400 border border-red-500/30 hover:bg-red-500/30'
                            : 'bg-gray-700/50 text-gray-400 border border-gray-600/30 hover:bg-gray-700'
                    }`}
                >
                    {user?.pvp_enabled ? 'ENABLED' : 'DISABLED'}
                </button>
            </div>

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

                    {/* Component Condition Warning */}
                    {damagedComponents > 0 && (
                        <div className="flex items-center gap-2 p-3 rounded-lg" style={{ background: 'rgba(255,102,0,0.08)', border: '1px solid rgba(255,102,0,0.2)' }}>
                            <AlertWarn className="w-4 h-4 text-neon-orange flex-shrink-0" />
                            <span className="text-sm text-neon-orange">{damagedComponents} component{damagedComponents > 1 ? 's' : ''} need repair</span>
                            <button onClick={() => navigate('/repair')} className="ml-auto text-xs text-neon-orange underline hover:text-white transition-colors">Fix Now</button>
                        </div>
                    )}

                    {/* Action Buttons */}
                    <div className="grid grid-cols-2 gap-3 mt-6">
                        <button onClick={() => navigate('/system')} className="btn btn-primary flex justify-center items-center gap-2">
                            <Rocket className="w-4 h-4" /> Navigate
                        </button>
                        <button onClick={() => navigate('/trading')} className="btn btn-secondary flex justify-center items-center gap-2">
                            <Zap className="w-4 h-4" /> Trade
                        </button>
                        <button
                            onClick={async () => {
                                const sector = ship.currentSector || ship.current_sector;
                                if (!sector?.sector_id) return;
                                try {
                                    await planets.scan(sector.sector_id);
                                    notify.success(`Scan complete for ${sector.name}. Check Planets databank.`);
                                } catch (e) {
                                    console.error("Scan failed", e);
                                    notify.error("Scan failed: " + (e.response?.data?.error || e.message));
                                }
                            }}
                            className="btn btn-secondary flex justify-center items-center gap-2"
                        >
                            <Activity className="w-4 h-4" /> Scan
                        </button>
                    </div>

                    {/* Quick Actions */}
                    <div className="grid grid-cols-3 gap-2 mt-3">
                        <button onClick={() => navigate('/repair')} className="flex items-center justify-center gap-1.5 px-2 py-2 rounded-lg text-xs text-gray-400 hover:text-neon-cyan transition-colors" style={{ background: 'rgba(0,255,255,0.03)', border: '1px solid rgba(0,255,255,0.08)' }}>
                            <Hammer className="w-3.5 h-3.5" /> Repair
                        </button>
                        <button onClick={() => navigate('/designer')} className="flex items-center justify-center gap-1.5 px-2 py-2 rounded-lg text-xs text-gray-400 hover:text-neon-cyan transition-colors" style={{ background: 'rgba(0,255,255,0.03)', border: '1px solid rgba(0,255,255,0.08)' }}>
                            <Wrench className="w-3.5 h-3.5" /> Upgrade
                        </button>
                        <button onClick={() => navigate('/customizer')} className="flex items-center justify-center gap-1.5 px-2 py-2 rounded-lg text-xs text-gray-400 hover:text-neon-cyan transition-colors" style={{ background: 'rgba(0,255,255,0.03)', border: '1px solid rgba(0,255,255,0.08)' }}>
                            <Palette className="w-3.5 h-3.5" /> Customize
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

            {/* Artifact Equipment */}
            <div className="card p-6">
                <h2 className="card-header flex items-center gap-2 text-xl">
                    <Gem className="w-5 h-5" /> Artifacts
                </h2>
                <ArtifactEquipment shipId={ship.ship_id} />
            </div>
        </div>
    );
};

export default ShipPanel;
