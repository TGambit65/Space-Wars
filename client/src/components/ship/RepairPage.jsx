import { useState, useEffect } from 'react';
import { designer, ships, auth } from '../../services/api';
import { Hammer, Shield, Crosshair, Zap, AlertCircle, CheckCircle, DollarSign } from 'lucide-react';

const RepairPage = ({ user: initialUser }) => {
    const [ship, setShip] = useState(null);
    const [estimates, setEstimates] = useState(null);
    // Track credits locally
    const [userCredits, setUserCredits] = useState(initialUser?.credits || 0);

    const [loading, setLoading] = useState(true);
    const [actionLoading, setActionLoading] = useState(false);
    const [error, setError] = useState(null);
    const [successMsg, setSuccessMsg] = useState(null);

    useEffect(() => {
        // If user prop changes (e.g. from parent re-fetch), update credits
        if (initialUser) setUserCredits(initialUser.credits);
        fetchData();
    }, [initialUser]);

    const fetchData = async () => {
        try {
            setLoading(true);
            const shipsRes = await ships.getAll();
            const shipList = shipsRes.data.data?.ships || [];
            if (shipList.length === 0) throw new Error("No active ship found.");
            const shipId = shipList[0].ship_id;

            // Fetch profile too to ensure credits are fresh if navigating directly
            const [shipRes, estimateRes, profileRes] = await Promise.all([
                ships.getById(shipId),
                designer.getRepairEstimate(shipId),
                auth.getProfile()
            ]);

            setShip(shipRes.data.data.ship);
            const est = estimateRes.data.estimate;
            // Normalize estimate field names
            setEstimates({
              hull_cost: est.hull_repair_cost || 0,
              components: (est.components_needing_repair || []).map(c => ({
                ship_component_id: c.ship_component_id,
                name: c.name,
                condition: c.condition,
                cost: c.repair_cost || 0
              }))
            });
            if (profileRes.data?.data) setUserCredits(profileRes.data.data.credits);
        } catch (err) {
            console.error("Repair station error", err);
            setError("Repair systems offline.");
        } finally {
            setLoading(false);
        }
    };

    const handleRepairHull = async () => {
        try {
            setActionLoading(true);
            setError(null);
            await designer.repairHull(ship.ship_id);
            setSuccessMsg("Hull repaired successfully.");
            await fetchData();
        } catch (err) {
            setError(err.response?.data?.error || "Hull repair failed.");
        } finally {
            setActionLoading(false);
        }
    };

    const handleRepairComponent = async (componentId) => {
        try {
            setActionLoading(true);
            setError(null);
            await designer.repairComponent(ship.ship_id, componentId);
            setSuccessMsg("Component repaired.");
            await fetchData();
        } catch (err) {
            setError(err.response?.data?.error || "Component repair failed.");
        } finally {
            setActionLoading(false);
        }
    };

    const handleRepairAll = async () => {
        try {
            setActionLoading(true);
            setError(null);
            const promises = [];

            if (estimates.hull_cost > 0) {
                promises.push(designer.repairHull(ship.ship_id));
            }

            estimates.components.forEach(comp => {
                if (comp.cost > 0) {
                    promises.push(designer.repairComponent(ship.ship_id, comp.ship_component_id));
                }
            });

            await Promise.all(promises);
            setSuccessMsg("All systems repaired.");
            await fetchData();
        } catch (err) {
            // Some might fail if credits run out
            setError("Some repairs failed. Check credits.");
            await fetchData();
        } finally {
            setActionLoading(false);
        }
    };

    if (loading) return <div className="p-8 text-center text-accent-cyan animate-pulse">Analyzing System Damage...</div>;
    if (error && !ship) return <div className="p-8 text-center text-accent-red">{error}</div>;

    const totalCost = (estimates?.hull_cost || 0) + (estimates?.components?.reduce((sum, c) => sum + c.cost, 0) || 0);

    return (
        <div className="max-w-4xl mx-auto space-y-6">
            <header className="flex justify-between items-center mb-6">
                <div>
                    <h1 className="text-3xl font-bold text-white flex items-center gap-3">
                        <Hammer className="w-8 h-8 text-accent-orange" />
                        Engineering & Repairs
                    </h1>
                    <p className="text-gray-400 mt-1">
                        USS <span className="text-white font-mono">{ship.name}</span>
                    </p>
                </div>
                <div className="flex flex-col items-end gap-2">
                    <div className="card px-4 py-2 flex items-center gap-3 border border-space-600 bg-space-800">
                        <div className="text-xs text-gray-400 uppercase tracking-wider">Credits</div>
                        <div className="text-xl font-bold text-accent-orange flex items-center">
                            <DollarSign className="w-5 h-5 mr-1" />
                            {(userCredits || 0).toLocaleString()}
                        </div>
                    </div>
                    {totalCost > 0 && (
                        <div className="text-right">
                            <div className="text-sm text-gray-400">Total Repair Cost</div>
                            <div className="text-2xl font-bold text-accent-red">{(totalCost || 0).toLocaleString()} Cr</div>
                        </div>
                    )}
                </div>
            </header>

            {error && <div className="bg-accent-red/20 border border-accent-red/50 text-white p-4 rounded flex items-center gap-3"><AlertCircle /> {error}</div>}
            {successMsg && <div className="bg-accent-green/20 border border-accent-green/50 text-white p-4 rounded flex items-center gap-3"><CheckCircle /> {successMsg}</div>}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Hull Status */}
                <div className="card p-6 space-y-4">
                    <h2 className="text-xl font-bold text-white flex items-center gap-2">
                        <Shield className="w-5 h-5 text-accent-cyan" /> Hull Status
                    </h2>

                    <div className="space-y-2">
                        <div className="flex justify-between text-sm">
                            <span className="text-gray-400">Integrity</span>
                            <span className={`${ship.hull_points < ship.max_hull_points ? 'text-accent-red' : 'text-accent-green'}`}>
                                {ship.hull_points} / {ship.max_hull_points}
                            </span>
                        </div>
                        <div className="w-full bg-space-900 h-4 rounded-full overflow-hidden">
                            <div
                                className={`h-full ${ship.hull_points < ship.max_hull_points * 0.5 ? 'bg-accent-red' : 'bg-accent-green'}`}
                                style={{ width: `${(ship.hull_points / ship.max_hull_points) * 100}%` }}
                            ></div>
                        </div>
                    </div>

                    {estimates?.hull_cost > 0 ? (
                        <div className="flex justify-between items-center mt-4 bg-space-800/50 p-3 rounded">
                            <span className="text-accent-orange font-bold">{(estimates.hull_cost || 0).toLocaleString()} Cr</span>
                            <button
                                onClick={handleRepairHull}
                                disabled={actionLoading || userCredits < estimates.hull_cost}
                                className="btn btn-primary text-sm px-4 py-1 disabled:opacity-50 disabled:cursor-not-allowed"
                                title={userCredits < estimates.hull_cost ? "Insufficient Credits" : "Repair Hull"}
                            >
                                Repair Hull
                            </button>
                        </div>
                    ) : (
                        <div className="text-center text-gray-500 italic py-2">No damage detected</div>
                    )}
                </div>

                {/* Damaged Components */}
                <div className="card p-6 space-y-4">
                    <h2 className="text-xl font-bold text-white flex items-center gap-2">
                        <Zap className="w-5 h-5 text-accent-orange" /> Component Status
                    </h2>

                    {(!estimates?.components || estimates.components.length === 0) ? (
                        <div className="text-center text-gray-500 italic py-8 border border-dashed border-space-700 rounded">
                            No component damage detected.
                        </div>
                    ) : (
                        <div className="space-y-3">
                            {(estimates.components || []).map(comp => (
                                <div key={comp.ship_component_id} className="flex justify-between items-center bg-space-800 p-3 rounded border border-space-700">
                                    <div>
                                        <div className="font-bold text-white">{comp.name}</div>
                                        <div className="text-xs text-accent-red">Condition: {comp.condition}%</div>
                                    </div>
                                    <div className="text-right flex flex-col items-end gap-1">
                                        <span className="text-accent-orange font-bold text-sm">{(comp.cost || 0).toLocaleString()} Cr</span>
                                        <button
                                            onClick={() => handleRepairComponent(comp.ship_component_id)}
                                            disabled={actionLoading || userCredits < comp.cost}
                                            className="btn btn-secondary text-xs px-2 py-1 disabled:opacity-50 disabled:cursor-not-allowed"
                                            title={userCredits < comp.cost ? "Insufficient Credits" : "Repair Component"}
                                        >
                                            Repair
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>

            {totalCost > 0 && (
                <div className="flex justify-center mt-8">
                    <button
                        onClick={handleRepairAll}
                        disabled={actionLoading || userCredits < totalCost}
                        className="btn btn-success py-3 px-8 text-lg shadow-lg shadow-accent-green/20 disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none bg-accent-green text-white hover:bg-accent-green/90"
                        title={userCredits < totalCost ? "Insufficient Credits" : "Repair All"}
                    >
                        {userCredits < totalCost ? `Insufficient Credits (${(totalCost - userCredits).toLocaleString()} needed)` : `Repair All Systems (${totalCost.toLocaleString()} Cr)`}
                    </button>
                </div>
            )}
        </div>
    );
};

export default RepairPage;
