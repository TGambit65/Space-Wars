import { useState, useEffect } from 'react';
import { designer, ships, templates } from '../../services/api';
import { Wrench, Zap, Shield, Crosshair, Cpu, Trash2, PlusCircle, AlertTriangle, Save, FolderOpen, X, Download } from 'lucide-react';
import { useNotifications } from '../../contexts/NotificationContext';
import WikiLink from '../../components/common/WikiLink';

const ShipDesigner = () => {
    const [ship, setShip] = useState(null);
    const [installed, setInstalled] = useState([]);
    const [available, setAvailable] = useState([]);
    const [stats, setStats] = useState(null);
    const notify = useNotifications();
    const [loading, setLoading] = useState(true);
    const [actionLoading, setActionLoading] = useState(false);
    const [error, setError] = useState(null);

    // Template state
    const [savedTemplates, setSavedTemplates] = useState([]);
    const [showTemplates, setShowTemplates] = useState(false);
    const [templateName, setTemplateName] = useState('');

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
            const activeId = shipsRes.data.data.active_ship_id;
            const activeShip = (activeId && shipsRes.data.data.ships.find(s => s.ship_id === activeId)) || shipsRes.data.data.ships[0];
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
            notify.error(err.response?.data?.error || "Installation failed. Check slots or power.");
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
            notify.error(err.response?.data?.error || "Uninstall failed.");
        } finally {
            setActionLoading(false);
        }
    };

    const fetchTemplates = async () => {
        try {
            const res = await templates.getAll();
            setSavedTemplates(res.data.data?.templates || res.data.templates || []);
        } catch { /* ignore */ }
    };

    const handleSaveTemplate = async () => {
        if (!templateName.trim() || !ship) return;
        try {
            setActionLoading(true);
            await templates.save({
                name: templateName.trim(),
                ship_type: ship.ship_type,
                components: installed.map(c => ({ component_id: c.component_id, name: c.name, type: c.type })),
            });
            setTemplateName('');
            notify.success('Template saved!');
            await fetchTemplates();
        } catch (err) {
            notify.error(err.response?.data?.message || 'Failed to save template');
        } finally {
            setActionLoading(false);
        }
    };

    const handleDeleteTemplate = async (id) => {
        try {
            await templates.delete(id);
            await fetchTemplates();
        } catch { /* ignore */ }
    };

    const handleApplyTemplate = async (template) => {
        if (!ship || !template.components?.length) return;
        try {
            setActionLoading(true);
            // Uninstall all current components
            for (const comp of installed) {
                await designer.uninstall(ship.ship_id, comp.ship_component_id);
            }
            // Install template components by matching available components by name+type
            let installedCount = 0;
            for (const tComp of template.components) {
                const match = available.find(a =>
                    a.name === tComp.name || (a.id || a.component_id) === tComp.component_id
                );
                if (match) {
                    try {
                        await designer.install(ship.ship_id, match.id || match.component_id);
                        installedCount++;
                    } catch { /* skip if slot/power issues */ }
                }
            }
            await fetchData();
            if (installedCount === 0) {
                notify.warning(`Template applied but no matching components found in catalog`);
            } else {
                notify.success(`Template applied: ${installedCount}/${template.components.length} components installed`);
            }
        } catch (err) {
            notify.error(err.response?.data?.message || 'Failed to apply template');
            await fetchData();
        } finally {
            setActionLoading(false);
        }
    };

    if (loading) return <div className="p-8 text-center text-accent-cyan">Initializing Engineering Subsystems...</div>;
    if (error) return <div className="p-8 text-center text-accent-red">{error}</div>;

    const powerPercent = Math.min(100, (stats.power_used / stats.power_max) * 100);

    return (
        <div className="max-w-6xl mx-auto space-y-6 shipyard-bg-grid shipyard-scanline p-6 relative">
            {/* Notifications via global toast system */}
            <header className="flex justify-between items-center mb-6">
                <div>
                    <h1 className="text-3xl font-bold text-white flex items-center gap-3">
                        <Wrench className="w-8 h-8 text-accent-cyan" />
                        Shipyard & Designer
                    </h1>
                    <p className="text-gray-400 mt-1">
                        Modifying: <span className="text-white font-mono">{ship.name}</span>
                        <span className="mx-2 text-space-600">|</span>
                        <WikiLink term="ship designer" className="text-[11px]">Guide</WikiLink>
                    </p>
                </div>
                <div className="flex items-center gap-4">
                    <button onClick={() => { setShowTemplates(!showTemplates); if (!showTemplates) fetchTemplates(); }}
                        className="holo-button text-sm flex items-center gap-1.5">
                        <FolderOpen className="w-4 h-4" /> Templates
                    </button>
                    <div className="text-right">
                        <div className="text-sm text-gray-400">Available Slots</div>
                        <div className="text-2xl font-bold text-accent-cyan">
                            {installed.length} / {ship.slots}
                        </div>
                    </div>
                </div>
            </header>

            {/* Templates Panel */}
            {showTemplates && (
                <div className="holo-panel p-4 space-y-3">
                    <div className="flex items-center justify-between">
                        <h3 className="text-sm font-display text-white flex items-center gap-2">
                            <FolderOpen className="w-4 h-4 text-neon-cyan" /> Design Templates
                        </h3>
                        <button onClick={() => setShowTemplates(false)} className="text-gray-500 hover:text-white">
                            <X className="w-4 h-4" />
                        </button>
                    </div>
                    {/* Save current */}
                    <div className="flex gap-2">
                        <input className="input flex-1 text-sm" placeholder="Template name..." value={templateName}
                            onChange={e => setTemplateName(e.target.value)} />
                        <button onClick={handleSaveTemplate} disabled={actionLoading || !templateName.trim()}
                            className="holo-button text-xs flex items-center gap-1 disabled:opacity-50">
                            <Save className="w-3.5 h-3.5" /> Save Current
                        </button>
                    </div>
                    {/* Saved list */}
                    {savedTemplates.length === 0 ? (
                        <p className="text-gray-500 text-xs text-center py-2">No saved templates</p>
                    ) : (
                        <div className="space-y-1.5 max-h-40 overflow-y-auto">
                            {savedTemplates.map(t => (
                                <div key={t.template_id || t.id} className="flex items-center justify-between p-2 rounded-lg"
                                    style={{ background: 'rgba(0,255,255,0.03)', border: '1px solid rgba(0,255,255,0.08)' }}>
                                    <div>
                                        <p className="text-sm text-white">{t.name}</p>
                                        <p className="text-xs text-gray-500">{t.ship_type} — {(t.components || []).length} components</p>
                                    </div>
                                    <div className="flex items-center gap-1">
                                        <button onClick={() => handleApplyTemplate(t)} disabled={actionLoading}
                                            className="text-neon-cyan hover:text-white p-1 disabled:opacity-50 transition-colors" title="Apply template">
                                            <Download className="w-3.5 h-3.5" />
                                        </button>
                                        <button onClick={() => handleDeleteTemplate(t.template_id || t.id)}
                                            className="text-gray-600 hover:text-red-400 p-1 transition-colors" title="Delete template">
                                            <Trash2 className="w-3.5 h-3.5" />
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}

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
                                        className="btn btn-danger p-2 rounded-full opacity-60 hover:opacity-100 transition-opacity"
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
                            const fitsPower = (stats.power_used + comp.energy_cost) <= stats.power_max;
                            const hasSlots = installed.length < ship.slots;

                            // P5 Item 6: Before/after stat comparison
                            const statDelta = comp.stats ? Object.entries(comp.stats).map(([k, v]) => {
                                const current = stats[k] || 0;
                                return { key: k, current, after: current + v, delta: v };
                            }) : [];

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
                                            {statDelta.length > 0 && (
                                                <div className="text-xs mt-1 flex flex-wrap gap-x-3 gap-y-0.5">
                                                    {statDelta.map(s => (
                                                        <span key={s.key} className="flex items-center gap-1">
                                                            <span className="text-gray-500">{s.key}:</span>
                                                            <span className="text-gray-400 font-mono">{s.current}</span>
                                                            <span className="text-gray-600">→</span>
                                                            <span className={`font-mono ${s.delta > 0 ? 'text-accent-green' : s.delta < 0 ? 'text-accent-red' : 'text-gray-400'}`}>
                                                                {s.after}{s.delta !== 0 && <span className="text-[10px] ml-0.5">({s.delta > 0 ? '+' : ''}{s.delta})</span>}
                                                            </span>
                                                        </span>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                    <button
                                        onClick={() => handleInstall(comp.id || comp.component_id)}
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
