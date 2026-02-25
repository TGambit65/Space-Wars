import { useState, useEffect, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { combat, ships, npcs } from '../../services/api';
import { Shield, Crosshair, AlertTriangle, Skull, Trophy, Zap, Activity, Clock } from 'lucide-react';

const CombatPage = ({ user }) => {
    const location = useLocation();
    const navigate = useNavigate();
    const [ship, setShip] = useState(null);
    const [targetNpc, setTargetNpc] = useState(location.state?.npc || null);

    // Battle State
    const [battleLog, setBattleLog] = useState([]);
    const [displayLog, setDisplayLog] = useState([]);
    const [roundIndex, setRoundIndex] = useState(0);
    const [battleResult, setBattleResult] = useState(null); // 'victory', 'defeat', 'fled'
    const [isBattling, setIsBattling] = useState(false);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [loot, setLoot] = useState(null);

    // Dynamic Stats for Animation
    const [playerStats, setPlayerStats] = useState({ hull: 0, maxHull: 100, shields: 0, maxShields: 100 });
    const [enemyStats, setEnemyStats] = useState({ hull: 0, maxHull: 100, shields: 0, maxShields: 100 });

    const scrollRef = useRef(null);
    const intervalRef = useRef(null);

    useEffect(() => {
        return () => {
            if (intervalRef.current) clearInterval(intervalRef.current);
        };
    }, []);

    useEffect(() => {
        const init = async () => {
            try {
                // Get Player Ship
                const shipsRes = await ships.getAll();
                const shipList = shipsRes.data.data?.ships || [];
                if (!shipList.length) throw new Error("No ship found");
                const currentShip = shipList[0];
                const fullShipRes = await ships.getById(currentShip.ship_id);
                // API returns { success: true, data: { ship: {...}, adjacentSectors: [...] } }
                const shipData = fullShipRes.data.data.ship;
                setShip(shipData);

                setPlayerStats({
                    hull: shipData.hull_points,
                    maxHull: shipData.max_hull_points,
                    shields: shipData.shield_points,
                    maxShields: shipData.max_shield_points
                });

                if (targetNpc) {
                    // Set initial enemy stats (simplified as we might not know max values until battle starts or scan)
                    setEnemyStats({
                        hull: 100, maxHull: 100, // Placeholder until scan/first hit
                        shields: 100, maxShields: 100
                    });
                } else {
                    // If no target passed, look for one in current sector or simulate
                    setError("No target locking data. Initiate scan to find targets.");
                }
            } catch (err) {
                console.error("Combat init failed", err);
                setError("Combat systems offline.");
            } finally {
                setLoading(false);
            }
        };
        init();
    }, [targetNpc]);

    // Auto-scroll log
    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    }, [displayLog]);

    const findRandomTarget = async () => {
        try {
            setLoading(true);
            setError(null);
            // Simulate finding a target by getting NPCs in sector
            if (!ship?.currentSector) return;

            const npcRes = await npcs.getInSector(ship.currentSector.sector_id);
            const npcList = npcRes.data.npcs || [];
            if (npcList.length > 0) {
                setTargetNpc(npcList[0]);
                setEnemyStats({ hull: 100, maxHull: 100, shields: 100, maxShields: 100 });
            } else {
                setError("No hostile signatures detected in this sector.");
            }
        } catch (err) {
            setError("Scanner malfunction.");
        } finally {
            setLoading(false);
        }
    };

    const startCombat = async () => {
        if (!ship || !targetNpc) return;

        try {
            setIsBattling(true);
            setBattleResult(null);
            setDisplayLog([]);

            // Execute full combat on backend
            const combatRes = await combat.attack(ship.ship_id, targetNpc.npc_id);
            const data = combatRes.data;

            // Map backend winner to UI result
            const result = data.winner === 'attacker' ? 'victory' : data.winner === 'defender' ? 'defeat' : 'draw';
            const rounds = data.combat_rounds || [];
            const battleLoot = { credits: data.credits_looted || 0 };

            setBattleLog(rounds);
            setLoot(battleLoot);

            // Start Animation Loop
            let currentRound = 0;
            intervalRef.current = setInterval(() => {
                if (currentRound >= rounds.length) {
                    clearInterval(intervalRef.current);
                    setIsBattling(false);
                    setBattleResult(result);
                    return;
                }

                const roundData = rounds[currentRound];
                const attackerAction = roundData.actions?.[0];
                const defenderAction = roundData.actions?.[1];

                // Update Log
                setDisplayLog(prev => [...prev, {
                    round: roundData.round,
                    message: `Round ${roundData.round}: You dealt ${attackerAction?.damage || 0} dmg. Enemy dealt ${defenderAction?.damage || 0} dmg.`
                }]);

                // Update Stats - actions[0].target_hull is defender's hull, actions[1].target_hull is attacker's hull
                if (defenderAction) {
                    setPlayerStats(prev => ({ ...prev, hull: defenderAction.target_hull, shields: defenderAction.target_shields }));
                }
                setEnemyStats(prev => ({ ...prev, hull: attackerAction?.target_hull ?? 0, shields: attackerAction?.target_shields ?? 0 }));

                currentRound++;
            }, 1000); // 1 second per round

        } catch (err) {
            console.error("Combat failed", err);
            setIsBattling(false);
            setError(err.response?.data?.error || "Combat engagement failed.");
        }
    };

    const handleFlee = async () => {
        try {
            const res = await combat.flee(ship.ship_id);
            if (res.data.success) {
                alert("Emergency jump coordinates calculated. Fleeing!");
                navigate('/map');
            } else {
                alert(res.data.message || "Escape attempt failed! Engines unresponsive.");
            }
        } catch (err) {
            alert("Flee attempt failed: " + (err.response?.data?.error || "Interdiction field active"));
        }
    };

    if (loading) return <div className="p-12 text-center text-accent-red animate-pulse">Initializing Tactical Display...</div>;

    return (
        <div className="max-w-6xl mx-auto h-[calc(100vh-100px)] flex flex-col">
            <header className="flex justify-between items-center mb-6">
                <h1 className="text-3xl font-bold text-accent-red flex items-center gap-3">
                    <Crosshair className="w-8 h-8" />
                    Tactical Interface
                </h1>
                <div className="space-x-4">
                    <button onClick={() => navigate('/combat/history')} className="btn btn-secondary mr-2">
                        <Clock className="w-4 h-4 inline mr-2" /> History
                    </button>
                    {!targetNpc && !isBattling && (
                        <button onClick={findRandomTarget} className="btn btn-secondary">
                            <Activity className="w-4 h-4 inline mr-2" /> Scan for Targets
                        </button>
                    )}
                    {targetNpc && !isBattling && (
                        <button onClick={() => { setTargetNpc(null); setError(null); }} className="btn btn-secondary mr-2">
                            Clear Target
                        </button>
                    )}
                    <button onClick={() => navigate('/map')} className="btn btn-secondary">
                        Exit Tactical
                    </button>
                </div>
            </header>

            <div className="flex-1 grid grid-cols-1 md:grid-cols-3 gap-6">
                {/* Player Status */}
                <div className="card p-6 border-accent-cyan/30 flex flex-col justify-center space-y-4">
                    <h2 className="text-xl font-bold text-accent-cyan">{ship?.name}</h2>
                    <div className="space-y-2">
                        <div className="flex justify-between text-xs text-gray-400">
                            <span>Shields</span>
                            <span>{playerStats.shields}/{playerStats.maxShields}</span>
                        </div>
                        <div className="w-full bg-space-900 h-2 rounded-full">
                            <div className="bg-accent-cyan h-full rounded-full transition-all duration-500" style={{ width: `${(playerStats.shields / playerStats.maxShields) * 100}%` }}></div>
                        </div>

                        <div className="flex justify-between text-xs text-gray-400 mt-2">
                            <span>Hull Integrity</span>
                            <span>{playerStats.hull}/{playerStats.maxHull}</span>
                        </div>
                        <div className="w-full bg-space-900 h-4 rounded-full">
                            <div className="bg-accent-green h-full rounded-full transition-all duration-500" style={{ width: `${(playerStats.hull / playerStats.maxHull) * 100}%` }}></div>
                        </div>
                    </div>
                </div>

                {/* Central Battle Log & Controls */}
                <div className="flex flex-col space-y-4">
                    <div
                        ref={scrollRef}
                        className="flex-1 card bg-black/50 border-accent-red/20 p-4 overflow-y-auto font-mono text-sm space-y-2 relative"
                    >
                        {displayLog.length === 0 && !error && (
                            <div className="text-gray-600 text-center mt-10">Waiting for engagement command...</div>
                        )}
                        {displayLog.map((log, i) => (
                            <div key={i} className="animate-fade-in text-gray-300 border-l-2 border-accent-red pl-2">
                                <span className="text-accent-red font-bold">R{log.round}</span>: {log.message}
                            </div>
                        ))}
                    </div>

                    {/* Action Bar */}
                    <div className="flex gap-4 justify-center">
                        {!isBattling && !battleResult && targetNpc && (
                            <button onClick={startCombat} className="btn btn-danger w-full py-3 text-lg font-bold tracking-wider animate-pulse">
                                ENGAGE HOSTILE
                            </button>
                        )}
                        {isBattling && (
                            <button onClick={handleFlee} className="btn btn-secondary w-full border-accent-orange text-accent-orange hover:bg-accent-orange hover:text-white">
                                EMERGENCY FLEE
                            </button>
                        )}
                        {battleResult === 'victory' && (
                            <div className="text-center w-full space-y-2">
                                <div className="text-accent-green font-bold text-xl flex items-center justify-center gap-2">
                                    <Trophy /> VICTORY
                                </div>
                                <div className="text-sm text-gray-400">
                                    Loot: {loot?.credits} Credits
                                </div>
                                <button onClick={() => navigate('/map')} className="btn btn-primary w-full">
                                    Return to Sector
                                </button>
                            </div>
                        )}
                        {battleResult === 'defeat' && (
                            <div className="text-center w-full space-y-2">
                                <div className="text-accent-red font-bold text-xl flex items-center justify-center gap-2">
                                    <Skull /> DESTROYED
                                </div>
                                <button onClick={() => navigate('/')} className="btn btn-secondary w-full">
                                    Eject Pod
                                </button>
                            </div>
                        )}
                    </div>
                </div>

                {/* Enemy Status */}
                <div className="card p-6 border-accent-red/30 flex flex-col justify-center space-y-4">
                    {targetNpc ? (
                        <>
                            <h2 className="text-xl font-bold text-accent-red text-right">{targetNpc.name || "Unknown Hostile"}</h2>
                            <div className="space-y-2">
                                <div className="flex justify-between text-xs text-gray-400">
                                    <span>Shields</span>
                                    <span>{enemyStats.shields}%</span>
                                </div>
                                <div className="w-full bg-space-900 h-2 rounded-full">
                                    <div className="bg-accent-purple h-full rounded-full transition-all duration-500" style={{ width: `${enemyStats.shields}%` }}></div>
                                </div>

                                <div className="flex justify-between text-xs text-gray-400 mt-2">
                                    <span>Hull Integrity</span>
                                    <span>{enemyStats.hull}/{enemyStats.maxHull}</span>
                                </div>
                                <div className="w-full bg-space-900 h-4 rounded-full">
                                    <div className="bg-accent-red h-full rounded-full transition-all duration-500" style={{ width: `${(enemyStats.hull / enemyStats.maxHull) * 100}%` }}></div>
                                </div>
                            </div>
                            <div className="mt-4 flex justify-center">
                                <div className="w-32 h-32 rounded-full border-2 border-accent-red bg-accent-red/10 flex items-center justify-center animate-pulse">
                                    <Skull className="w-16 h-16 text-accent-red" />
                                </div>
                            </div>
                        </>
                    ) : (
                        <div className="h-full flex flex-col items-center justify-center text-gray-600 space-y-2">
                            <AlertTriangle className="w-12 h-12" />
                            <p>No Target Lock</p>
                        </div>
                    )}
                </div>
            </div>

            {error && (
                <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 bg-accent-red/90 text-white px-6 py-3 rounded shadow-lg flex items-center gap-3">
                    <AlertTriangle /> {error}
                </div>
            )}
        </div>
    );
};

export default CombatPage;
