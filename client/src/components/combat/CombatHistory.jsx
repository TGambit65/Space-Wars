import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { combat } from '../../services/api';
import { Shield, Crosshair, Skull, Award, Clock, ChevronDown, ChevronUp, AlertCircle } from 'lucide-react';

const CombatHistory = () => {
    const navigate = useNavigate();
    const [history, setHistory] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [expandedLogId, setExpandedLogId] = useState(null);
    const [detailLog, setDetailLog] = useState(null);
    const [detailLoading, setDetailLoading] = useState(false);
    const [logsCache, setLogsCache] = useState({});
    const [visibleCount, setVisibleCount] = useState(10);

    useEffect(() => {
        fetchHistory();
    }, []);

    const fetchHistory = async () => {
        try {
            setLoading(true);
            const res = await combat.getHistory();
            setHistory(res.data.combat_logs || res.data.data?.combat_logs || []);
        } catch (err) {
            console.error("Failed to load combat history", err);
            setError("Unable to retrieve battle logs.");
        } finally {
            setLoading(false);
        }
    };

    const toggleDetail = async (logId) => {
        if (expandedLogId === logId) {
            setExpandedLogId(null);
            setDetailLog(null);
            return;
        }

        setExpandedLogId(logId);
        // Check cache first
        if (logsCache[logId]) {
            setDetailLog(logsCache[logId]);
            return;
        }

        setDetailLoading(true);
        try {
            const res = await combat.getLog(logId);
            const log = res.data.combat_log || res.data;
            setDetailLog(log);
            setLogsCache(prev => ({ ...prev, [logId]: log }));
        } catch (err) {
            console.error("Failed to load detail log", err);
        } finally {
            setDetailLoading(false);
        }
    };

    // Map backend winner_type to display result
    const mapResult = (winnerType) => {
        if (winnerType === 'attacker') return 'victory';
        if (winnerType === 'defender') return 'defeat';
        if (winnerType === 'fled') return 'fled';
        return 'draw';
    };

    const getResultColor = (result) => {
        if (result === 'victory') return 'text-accent-green';
        if (result === 'defeat') return 'text-accent-red';
        return 'text-accent-orange'; // flee or draw
    };

    const getResultIcon = (result) => {
        if (result === 'victory') return <Award className="w-5 h-5 text-accent-green" />;
        if (result === 'defeat') return <Skull className="w-5 h-5 text-accent-red" />;
        return <Shield className="w-5 h-5 text-accent-orange" />; // flee or draw
    };

    if (loading) return <div className="p-8 text-center text-accent-cyan animate-pulse">Decrypting Battle Logs...</div>;
    if (error) return <div className="p-8 text-center text-accent-red flex items-center justify-center gap-2"><AlertCircle /> {error}</div>;

    return (
        <div className="max-w-4xl mx-auto space-y-6">
            <header className="flex justify-between items-center mb-6">
                <div>
                    <h1 className="text-3xl font-bold text-white flex items-center gap-3">
                        <Crosshair className="w-8 h-8 text-accent-red" />
                        Combat Logs
                    </h1>
                    <p className="text-gray-400 mt-1">
                        Tactical Analysis & Battle Records
                    </p>
                </div>
                <button onClick={() => navigate('/combat')} className="btn btn-secondary">
                    Back to Combat
                </button>
            </header>

            {history.length === 0 ? (
                <div className="text-center py-12 text-gray-500 border border-dashed border-space-700 rounded bg-space-800/20">
                    No combat records found. The galaxy is peaceful... for now.
                </div>
            ) : (
                <div className="space-y-4">
                    {history.slice(0, visibleCount).map((record) => {
                        const result = mapResult(record.winner_type);
                        const opponentName = record.defenderNpc?.name || record.attackerNpc?.name || "Unknown Hostile";
                        return (
                        <div key={record.combat_log_id} className="card overflow-hidden transition-all duration-300 hover:border-space-500">
                            {/* Summary Row */}
                            <div
                                className="p-4 flex items-center justify-between cursor-pointer hover:bg-space-800/50"
                                onClick={() => toggleDetail(record.combat_log_id)}
                            >
                                <div className="flex items-center gap-4">
                                    <div className={`p-2 rounded-full bg-space-900 border border-space-700`}>
                                        {getResultIcon(result)}
                                    </div>
                                    <div>
                                        <div className="text-white font-bold flex items-center gap-2">
                                            vs. {opponentName}
                                            <span className={`text-xs uppercase font-bold px-2 py-0.5 rounded border ${result === 'victory' ? 'bg-accent-green/10 border-accent-green/30 text-accent-green' :
                                                result === 'defeat' ? 'bg-accent-red/10 border-accent-red/30 text-accent-red' :
                                                    'bg-accent-orange/10 border-accent-orange/30 text-accent-orange'
                                                }`}>
                                                {result}
                                            </span>
                                        </div>
                                        <div className="text-xs text-gray-500 flex items-center gap-2 mt-1">
                                            <Clock className="w-3 h-3" />
                                            {new Date(record.created_at).toLocaleString()}
                                        </div>
                                    </div>
                                </div>
                                <div className="text-gray-400">
                                    {expandedLogId === record.combat_log_id ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                                </div>
                            </div>

                            {/* Expanded Details */}
                            {expandedLogId === record.combat_log_id && (
                                <div className="border-t border-space-800 bg-space-900/30 p-4">
                                    {detailLoading ? (
                                        <div className="text-center text-sm text-gray-500 py-4">Loading tactical data...</div>
                                    ) : detailLog ? (
                                        <div className="space-y-4">
                                            {/* Battle Stats Summary */}
                                            <div className="grid grid-cols-2 gap-4 text-sm mb-4">
                                                <div className="p-3 bg-space-800 rounded border border-space-700">
                                                    <div className="text-gray-400 mb-1">Rounds Fought</div>
                                                    <div className="text-white font-mono text-lg">{detailLog.rounds_fought || detailLog.combat_rounds?.length || 0}</div>
                                                </div>
                                                <div className="p-3 bg-space-800 rounded border border-space-700">
                                                    <div className="text-gray-400 mb-1">Total Damage Dealt</div>
                                                    <div className="text-accent-orange font-mono text-lg">
                                                        {detailLog.attacker_damage_dealt || 0}
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Loot */}
                                            {detailLog.credits_looted > 0 && (
                                                <div className="p-3 bg-accent-green/10 border border-accent-green/30 rounded">
                                                    <div className="text-accent-green font-bold text-sm mb-2 uppercase tracking-wider">Salvage Recovered</div>
                                                    <div className="text-sm text-white">+ {detailLog.credits_looted} Credits</div>
                                                </div>
                                            )}

                                            {/* Round Log */}
                                            <div className="space-y-1">
                                                <div className="text-xs text-gray-500 uppercase font-bold tracking-wider mb-2">Engagement Log</div>
                                                <div className="max-h-60 overflow-y-auto space-y-1 pr-2 scrollbar-thin scrollbar-thumb-space-600">
                                                    {detailLog.combat_rounds?.map((round, idx) => (
                                                        <div key={idx} className="text-xs flex justify-between p-2 bg-space-800/50 rounded hover:bg-space-800">
                                                            <span className="text-gray-400 w-8">R{round.round}</span>
                                                            <span className="text-accent-cyan">Player: {round.actions?.[0]?.damage || 0} dmg</span>
                                                            <span className="text-gray-600">|</span>
                                                            <span className="text-accent-red">Enemy: {round.actions?.[1]?.damage || 0} dmg</span>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="text-center text-red-400 py-4">Failed to load log details.</div>
                                    )}
                                </div>
                            )}
                        </div>
                    );
                    })}
                    {visibleCount < history.length && (
                        <button
                            onClick={() => setVisibleCount(prev => prev + 10)}
                            className="btn btn-secondary w-full py-2 text-sm"
                        >
                            Load More ({history.length - visibleCount} remaining)
                        </button>
                    )}
                </div>
            )}
        </div>
    );
};

export default CombatHistory;
