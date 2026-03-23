import { useState, useEffect, useRef, useCallback } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { combat, ships, npcs } from '../../services/api';
import CombatHUD from './CombatHUD';
import { Shield, Crosshair, AlertTriangle, Skull, Trophy, Zap, Activity, Clock, TrendingUp } from 'lucide-react';
import { useNotifications } from '../../contexts/NotificationContext';
import WikiLink from '../common/WikiLink';

const CombatPage = ({ user, socket }) => {
    const location = useLocation();
    const navigate = useNavigate();
    const notify = useNotifications();
    const [ship, setShip] = useState(null);
    const [targetNpc, setTargetNpc] = useState(location.state?.npc || null);
    const [pvpTarget, setPvpTarget] = useState(location.state?.pvpTarget || null);

    // Battle State (auto-resolve mode)
    const [battleLog, setBattleLog] = useState([]);
    const [displayLog, setDisplayLog] = useState([]);
    const [battleResult, setBattleResult] = useState(null); // 'victory', 'defeat', 'fled'
    const [isBattling, setIsBattling] = useState(false);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [loot, setLoot] = useState(null);

    // Dynamic Stats for Animation
    const [playerStats, setPlayerStats] = useState({ hull: 0, maxHull: 100, shields: 0, maxShields: 100 });
    const [enemyStats, setEnemyStats] = useState({ hull: 0, maxHull: 100, shields: 0, maxShields: 100 });
    const [combatSpeed, setCombatSpeed] = useState(1);

    // Real-time combat state
    const [combatId, setCombatId] = useState(null);
    const [realtimeState, setRealtimeState] = useState(null);
    const [combatLog, setCombatLog] = useState([]);

    // Visual damage indicators
    const [shakeActive, setShakeActive] = useState(false);
    const [damageFlash, setDamageFlash] = useState(false);
    const [floatingDamage, setFloatingDamage] = useState([]);
    const damageIdRef = useRef(0);

    const scrollRef = useRef(null);
    const intervalRef = useRef(null);
    const speedRef = useRef(combatSpeed);
    const activeShipId = ship?.ship_id;

    const showDamageIndicator = useCallback((amount, side) => {
        if (!amount) return;
        setShakeActive(true);
        setDamageFlash(true);
        const id = ++damageIdRef.current;
        setFloatingDamage(prev => [...prev.slice(-4), { id, amount, side }]);
        setTimeout(() => setShakeActive(false), 400);
        setTimeout(() => setDamageFlash(false), 500);
        setTimeout(() => setFloatingDamage(prev => prev.filter(d => d.id !== id)), 1200);
    }, []);

    useEffect(() => {
        speedRef.current = combatSpeed;
        if (intervalRef.restartFn) intervalRef.restartFn();
    }, [combatSpeed]);

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
                const activeId = shipsRes.data.data?.active_ship_id;
                const currentShip = (activeId && shipList.find(s => s.ship_id === activeId)) || shipList[0];
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

                if (pvpTarget) {
                    // PvP target - we only have basic info from system detail
                    // Use placeholder stats since we can't fetch another player's full ship data
                    setEnemyStats({
                        hull: 100, maxHull: 100,
                        shields: 100, maxShields: 100
                    });
                } else if (targetNpc) {
                    // Fetch real NPC stats
                    try {
                        const npcRes = await npcs.getById(targetNpc.npc_id);
                        const npcData = npcRes.data.data?.npc || npcRes.data.npc || npcRes.data;
                        const npcHull = npcData.hull_points || targetNpc.hull_points || 100;
                        const npcShields = npcData.shield_points || targetNpc.shield_points || 100;
                        setEnemyStats({
                            hull: npcHull, maxHull: npcHull,
                            shields: npcShields, maxShields: npcShields
                        });
                    } catch {
                        // Fallback to whatever data we have
                        setEnemyStats({
                            hull: targetNpc.hull_points || 100, maxHull: targetNpc.hull_points || 100,
                            shields: targetNpc.shield_points || 100, maxShields: targetNpc.shield_points || 100
                        });
                    }
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

    // Socket listeners for real-time combat
    useEffect(() => {
        if (!socket || !combatId) return;

        const onState = (data) => {
            if (data.combatId === combatId) {
                setRealtimeState(data);
            }
        };

        const onHit = (data) => {
            if (data.combatId === combatId) {
                setCombatLog(prev => [...prev.slice(-49), {
                    type: 'hit',
                    attacker: data.attackerId,
                    target: data.targetId,
                    damage: data.damage,
                    system: data.targetSystem,
                    time: Date.now()
                }]);
            }
        };

        const onDestroyed = (data) => {
            if (data.combatId === combatId) {
                setCombatLog(prev => [...prev, { type: 'destroyed', shipId: data.shipId, isNPC: data.isNPC, time: Date.now() }]);
            }
        };

        const onEscaped = (data) => {
            if (data.combatId === combatId) {
                setCombatLog(prev => [...prev, { type: 'escaped', shipId: data.shipId, time: Date.now() }]);
            }
        };

        const onResolved = (data) => {
            if (data.combatId === combatId) {
                setRealtimeState(null);
                setCombatId(null);
                const result = data.result === 'attacker_wins' ? 'victory'
                    : data.result === 'defender_wins' ? 'defeat'
                    : data.result === 'fled' ? 'fled'
                    : data.result;
                setBattleResult(result);
                if (data.loot) {
                    setLoot(data.loot);
                }
                if (result === 'victory') {
                    notify.success(`Victory! Looted ${(data.loot?.credits || 0).toLocaleString()} credits`);
                } else if (result === 'defeat') {
                    notify.error('Defeated in combat');
                } else if (result === 'fled') {
                    notify.warning('Escaped from combat');
                }
            }
        };

        socket.on('combat:state', onState);
        socket.on('combat:hit', onHit);
        socket.on('combat:destroyed', onDestroyed);
        socket.on('combat:escaped', onEscaped);
        socket.on('combat:resolved', onResolved);

        return () => {
            socket.off('combat:state', onState);
            socket.off('combat:hit', onHit);
            socket.off('combat:destroyed', onDestroyed);
            socket.off('combat:escaped', onEscaped);
            socket.off('combat:resolved', onResolved);
        };
    }, [socket, combatId]);

    // Auto-scroll log
    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    }, [displayLog, combatLog]);

    const findRandomTarget = async () => {
        try {
            setLoading(true);
            setError(null);
            // Simulate finding a target by getting NPCs in sector
            if (!ship?.currentSector) return;

            const npcRes = await npcs.getInSector(ship.currentSector.sector_id);
            const npcList = npcRes.data.npcs || [];
            if (npcList.length > 0) {
                const npc = npcList[0];
                setTargetNpc(npc);
                setEnemyStats({
                    hull: npc.hull_points || 100, maxHull: npc.hull_points || 100,
                    shields: npc.shield_points || 100, maxShields: npc.shield_points || 100
                });
            } else {
                setError("No hostile signatures detected in this sector.");
            }
        } catch (err) {
            setError("Scanner malfunction.");
        } finally {
            setLoading(false);
        }
    };

    // Real-time combat engagement handler
    const handleRealtimeEngage = async () => {
        if (!ship || (!targetNpc && !pvpTarget)) return;

        try {
            setIsBattling(true);
            setBattleResult(null);
            setDisplayLog([]);
            setError(null);

            let res;
            if (pvpTarget) {
                res = await combat.realtimeAttackPlayer(activeShipId, pvpTarget.ship_id);
                setCombatLog([{ type: 'system', message: `PvP combat initiated against ${pvpTarget.name}!`, time: Date.now() }]);
            } else {
                res = await combat.realtimeAttackNPC(activeShipId, targetNpc.npc_id);
                setCombatLog([{ type: 'system', message: 'Real-time combat initiated!', time: Date.now() }]);
            }
            setCombatId(res.data.data.combat_id);
        } catch (err) {
            setIsBattling(false);
            // If realtime endpoint not available, fall back to auto-resolve (NPC only)
            if (err.response?.status === 404 && !pvpTarget) {
                console.warn('Real-time combat not available, falling back to auto-resolve');
                startAutoResolveCombat();
            } else {
                setError(err.response?.data?.message || err.response?.data?.error || 'Failed to initiate combat');
            }
        }
    };

    // Original auto-resolve combat (kept as fallback)
    const startAutoResolveCombat = async () => {
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
            const battleLoot = {
                credits: data.credits_looted || 0,
                xp: data.experience_gained || 0,
                shipStatus: data.ship_status || null,
                rewardMultiplier: data.reward_multiplier || 1,
            };

            setBattleLog(rounds);
            setLoot(battleLoot);

            const finishBattle = (logEntries) => {
                setIsBattling(false);
                setBattleResult(result);
                if (logEntries) setDisplayLog(logEntries);
                if (result === 'victory') {
                    notify.success(`Victory! Looted ${battleLoot.credits.toLocaleString()} credits`);
                } else if (result === 'defeat') {
                    notify.error('Defeated in combat');
                }
            };

            let currentRound = 0;
            const runInterval = () => {
                if (intervalRef.current) clearInterval(intervalRef.current);
                intervalRef.current = setInterval(() => {
                    if (currentRound >= rounds.length) {
                        clearInterval(intervalRef.current);
                        intervalRef.restartFn = null;
                        finishBattle();
                        return;
                    }

                    const roundData = rounds[currentRound];
                    const attackerAction = roundData.actions?.[0];
                    const defenderAction = roundData.actions?.[1];

                    setDisplayLog(prev => [...prev, {
                        round: roundData.round,
                        message: `Round ${roundData.round}: You dealt ${attackerAction?.damage || 0} dmg${attackerAction?.critical ? ' (CRITICAL!)' : ''}. Enemy dealt ${defenderAction?.damage || 0} dmg${defenderAction?.critical ? ' (CRITICAL!)' : ''}.`,
                        hasCrit: !!(attackerAction?.critical || defenderAction?.critical),
                    }]);

                    if (defenderAction) {
                        setPlayerStats(prev => ({ ...prev, hull: defenderAction.target_hull, shields: defenderAction.target_shields }));
                        if (defenderAction.damage > 0) showDamageIndicator(defenderAction.damage, 'player');
                    }
                    setEnemyStats(prev => ({ ...prev, hull: attackerAction?.target_hull ?? 0, shields: attackerAction?.target_shields ?? 0 }));
                    if (attackerAction?.damage > 0) showDamageIndicator(attackerAction.damage, 'enemy');

                    currentRound++;
                }, 1000 / speedRef.current);
            };

            intervalRef.restartFn = runInterval;

            intervalRef.skipFn = () => {
                if (intervalRef.current) clearInterval(intervalRef.current);
                intervalRef.restartFn = null;
                const allLogs = rounds.map(rd => {
                    const a = rd.actions?.[0];
                    const d = rd.actions?.[1];
                    return { round: rd.round, message: `Round ${rd.round}: You dealt ${a?.damage || 0} dmg${a?.critical ? ' (CRITICAL!)' : ''}. Enemy dealt ${d?.damage || 0} dmg${d?.critical ? ' (CRITICAL!)' : ''}.`, hasCrit: !!(a?.critical || d?.critical) };
                });
                const lastRound = rounds[rounds.length - 1];
                const lastD = lastRound?.actions?.[1];
                const lastA = lastRound?.actions?.[0];
                if (lastD) setPlayerStats(prev => ({ ...prev, hull: lastD.target_hull, shields: lastD.target_shields }));
                setEnemyStats(prev => ({ ...prev, hull: lastA?.target_hull ?? 0, shields: lastA?.target_shields ?? 0 }));
                finishBattle(allLogs);
            };

            runInterval();

        } catch (err) {
            console.error("Combat failed", err);
            setIsBattling(false);
            setError(err.response?.data?.error || "Combat engagement failed.");
        }
    };

    // Send command to server via socket (used by CombatHUD)
    const handleCombatCommand = (command) => {
        if (!socket || !combatId || !activeShipId) return;
        socket.emit('combat:command', {
            combat_id: combatId,
            ship_id: activeShipId,
            command
        });
    };

    const handleFlee = async () => {
        // In realtime mode, send disengage via socket
        if (combatId && socket) {
            handleCombatCommand({ type: 'disengage' });
            return;
        }

        try {
            const res = await combat.flee(ship.ship_id);
            if (res.data.success) {
                navigate('/map');
            } else {
                notify.error(res.data.message || "Escape attempt failed! Engines unresponsive.");
            }
        } catch (err) {
            notify.error("Flee attempt failed: " + (err.response?.data?.error || "Interdiction field active"));
        }
    };

    const isRealtimeMode = combatId && realtimeState;

    if (loading) return <div className="p-12 text-center text-accent-red animate-pulse">Initializing Tactical Display...</div>;

    // Item 5: Threat assessment — estimate win probability
    const threatAssessment = (() => {
        if (!ship || (!targetNpc && !pvpTarget)) return null;
        const pTotal = playerStats.hull + playerStats.shields;
        const eTotal = enemyStats.hull + enemyStats.shields;
        if (eTotal === 0) return null;
        const ratio = pTotal / (pTotal + eTotal);
        const pct = Math.round(ratio * 100);
        const label = pct >= 75 ? 'Favorable' : pct >= 50 ? 'Even' : pct >= 30 ? 'Risky' : 'Dangerous';
        const color = pct >= 75 ? '#4caf50' : pct >= 50 ? '#ffc107' : pct >= 30 ? '#ff6600' : '#f44336';
        return { pct, label, color };
    })();

    return (
        <div className={`max-w-6xl mx-auto h-[calc(100vh-100px)] flex flex-col ${shakeActive ? 'animate-screen-shake' : ''}`}>
            {/* Damage flash overlay */}
            {damageFlash && (
                <div className="damage-flash-overlay fixed inset-0 pointer-events-none z-50" style={{ background: 'rgba(244, 67, 54, 0.15)' }} />
            )}

            {/* Floating damage numbers */}
            {floatingDamage.map(d => (
                <div key={d.id} className="animate-damage-float fixed z-50 font-bold font-mono text-lg pointer-events-none"
                    style={{
                        color: d.side === 'player' ? '#f44336' : '#00ffff',
                        top: '30%',
                        left: d.side === 'player' ? '20%' : '75%',
                        textShadow: `0 0 10px ${d.side === 'player' ? 'rgba(244,67,54,0.6)' : 'rgba(0,255,255,0.6)'}`,
                    }}
                >
                    -{d.amount}
                </div>
            ))}

            <header className="flex justify-between items-center mb-6">
                <div>
                    <h1 className="text-3xl font-bold text-accent-red flex items-center gap-3">
                        <Crosshair className="w-8 h-8" />
                        Tactical Interface
                        {isRealtimeMode && (
                            <span className="text-sm font-normal text-accent-cyan bg-accent-cyan/10 border border-accent-cyan/30 px-2 py-0.5 rounded ml-2 animate-pulse">
                                LIVE
                            </span>
                        )}
                    </h1>
                    <WikiLink term="combat" className="text-[11px] mt-1">Combat Guide</WikiLink>
                </div>
                <div className="space-x-4">
                    <button onClick={() => navigate('/combat/history')} className="btn btn-secondary mr-2">
                        <Clock className="w-4 h-4 inline mr-2" /> History
                    </button>
                    {!targetNpc && !pvpTarget && !isBattling && !combatId && (
                        <button onClick={findRandomTarget} className="btn btn-secondary">
                            <Activity className="w-4 h-4 inline mr-2" /> Scan for Targets
                        </button>
                    )}
                    {(targetNpc || pvpTarget) && !isBattling && !combatId && (
                        <button onClick={() => { setTargetNpc(null); setPvpTarget(null); setError(null); }} className="btn btn-secondary mr-2">
                            Clear Target
                        </button>
                    )}
                    <button onClick={() => navigate('/map')} className="btn btn-secondary">
                        Exit Tactical
                    </button>
                </div>
            </header>

            {/* Real-time Combat Mode */}
            {isRealtimeMode ? (
                <div className="flex-1 flex flex-col space-y-4 relative">
                    <div className="holo-panel p-4">
                        <h2 className="text-lg font-bold text-neon-cyan mb-3 flex items-center gap-2">
                            <Zap className="w-5 h-5" /> Real-Time Combat
                        </h2>
                        <div className="grid grid-cols-2 gap-4">
                            {realtimeState.ships?.map(ship => (
                                <div key={ship.shipId} className="p-3 rounded-lg" style={{
                                    background: ship.isNPC ? 'rgba(244,67,54,0.08)' : 'rgba(0,255,255,0.08)',
                                    border: `1px solid ${ship.isNPC ? 'rgba(244,67,54,0.25)' : 'rgba(0,255,255,0.25)'}`
                                }}>
                                    <p className={`font-bold text-sm ${ship.isNPC ? 'text-red-400' : 'text-neon-cyan'}`}>
                                        {ship.isNPC ? 'HOSTILE' : 'YOUR SHIP'}
                                        {ship.name && ` - ${ship.name}`}
                                        {ship.escaped ? ' (ESCAPED)' : !ship.alive ? ' (DESTROYED)' : ''}
                                    </p>
                                    <div className="mt-2 space-y-1">
                                        <div className="flex justify-between text-xs text-gray-400">
                                            <span>Shields</span>
                                            <span>{Math.floor(ship.stats?.shields ?? 0)}/{ship.stats?.maxShields ?? 0}</span>
                                        </div>
                                        <div className="w-full h-2 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.06)' }}>
                                            <div className="h-full rounded-full transition-all duration-200" style={{
                                                width: `${(ship.stats?.maxShields ?? 0) > 0 ? (ship.stats.shields / ship.stats.maxShields * 100) : 0}%`,
                                                background: '#3b82f6'
                                            }} />
                                        </div>
                                        <div className="flex justify-between text-xs text-gray-400">
                                            <span>Hull</span>
                                            <span>{Math.floor(ship.stats?.hull ?? 0)}/{ship.stats?.maxHull ?? 0}</span>
                                        </div>
                                        <div className="w-full h-2 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.06)' }}>
                                            <div className="h-full rounded-full transition-all duration-200" style={{
                                                width: `${(ship.stats?.maxHull ?? 0) > 0 ? (ship.stats.hull / ship.stats.maxHull * 100) : 0}%`,
                                                background: (ship.stats?.maxHull ?? 0) > 0 && (ship.stats.hull / ship.stats.maxHull) > 0.5 ? '#00ffff'
                                                    : (ship.stats?.maxHull ?? 0) > 0 && (ship.stats.hull / ship.stats.maxHull) > 0.25 ? '#ffc107'
                                                    : '#f44336'
                                            }} />
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Combat Log */}
                    <div ref={scrollRef} className="holo-panel p-4 max-h-40 overflow-y-auto">
                        <h3 className="text-xs text-gray-500 uppercase mb-2">Combat Log</h3>
                        {combatLog.map((entry, i) => (
                            <p key={i} className={`text-xs ${
                                entry.type === 'hit' ? 'text-neon-orange'
                                : entry.type === 'destroyed' ? 'text-red-400'
                                : entry.type === 'escaped' ? 'text-accent-cyan'
                                : 'text-gray-400'
                            }`}>
                                {entry.type === 'hit' && `Hit! ${entry.damage} damage to ${entry.system || 'hull'}`}
                                {entry.type === 'destroyed' && `Ship destroyed!`}
                                {entry.type === 'escaped' && `Ship escaped!`}
                                {entry.type === 'system' && entry.message}
                            </p>
                        ))}
                    </div>

                    {/* CombatHUD overlay */}
                    <CombatHUD
                        combatState={{
                            ownShip: realtimeState.ships?.find(s => !s.isNPC) ? {
                                name: ship?.name,
                                shield_points: realtimeState.ships.find(s => !s.isNPC).stats?.shields ?? 0,
                                max_shield_points: realtimeState.ships.find(s => !s.isNPC).stats?.maxShields ?? 0,
                                hull_points: realtimeState.ships.find(s => !s.isNPC).stats?.hull ?? 0,
                                max_hull_points: realtimeState.ships.find(s => !s.isNPC).stats?.maxHull ?? 0,
                            } : {},
                            targets: (realtimeState.ships?.filter(s => s.isNPC && s.alive) || []).map(s => ({
                                id: s.shipId,
                                name: s.name || 'Hostile',
                                shield_points: s.stats?.shields ?? 0,
                                max_shield_points: s.stats?.maxShields ?? 0,
                                hull_points: s.stats?.hull ?? 0,
                                max_hull_points: s.stats?.maxHull ?? 0,
                            })),
                            status: 'active',
                            round: combatLog.length,
                            lastAction: combatLog.length > 0 ? (() => {
                                const last = combatLog[combatLog.length - 1];
                                if (last.type === 'hit') return `${last.damage} damage to ${last.system || 'hull'}`;
                                if (last.type === 'destroyed') return 'Ship destroyed!';
                                if (last.type === 'escaped') return 'Ship escaped!';
                                return last.message || '';
                            })() : null,
                        }}
                        onCommand={handleCombatCommand}
                    />
                </div>
            ) : (
                /* Standard auto-resolve combat mode */
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
                                <div className="bg-accent-cyan h-full rounded-full transition-all duration-500" style={{ width: `${playerStats.maxShields > 0 ? (playerStats.shields / playerStats.maxShields) * 100 : 0}%` }}></div>
                            </div>

                            <div className="flex justify-between text-xs text-gray-400 mt-2">
                                <span>Hull Integrity</span>
                                <span>{playerStats.hull}/{playerStats.maxHull}</span>
                            </div>
                            <div className="w-full bg-space-900 h-4 rounded-full">
                                <div className="bg-accent-green h-full rounded-full transition-all duration-500" style={{ width: `${playerStats.maxHull > 0 ? (playerStats.hull / playerStats.maxHull) * 100 : 0}%` }}></div>
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
                                <div key={i} className={`animate-fade-in text-gray-300 border-l-2 pl-2 ${log.hasCrit ? 'border-yellow-400 bg-yellow-400/5' : 'border-accent-red'}`}>
                                    <span className="text-accent-red font-bold">R{log.round}</span>: {log.message}
                                </div>
                            ))}
                        </div>

                        {/* Action Bar */}
                        <div className="flex gap-4 justify-center">
                            {!isBattling && !battleResult && (targetNpc || pvpTarget) && (
                                <div className="w-full space-y-2">
                                    {threatAssessment && (
                                        <div className="flex items-center justify-between p-2 rounded-lg text-xs" style={{
                                            background: `${threatAssessment.color}10`,
                                            border: `1px solid ${threatAssessment.color}30`,
                                        }}>
                                            <span className="flex items-center gap-1.5 text-gray-400">
                                                <TrendingUp className="w-3.5 h-3.5" /> Win Assessment
                                            </span>
                                            <span className="font-bold font-mono" style={{ color: threatAssessment.color }}>
                                                {threatAssessment.label} ({threatAssessment.pct}%)
                                            </span>
                                        </div>
                                    )}
                                    <button onClick={handleRealtimeEngage} className="btn btn-danger w-full py-3 text-lg font-bold tracking-wider animate-pulse">
                                        {pvpTarget ? 'ENGAGE COMMANDER' : 'ENGAGE HOSTILE'}
                                    </button>
                                </div>
                            )}
                            {isBattling && !combatId && (
                                <div className="w-full space-y-2">
                                    <div className="flex items-center justify-center gap-2">
                                        <span className="text-xs text-gray-500">Speed:</span>
                                        {[1, 2, 4].map(s => (
                                            <button key={s} onClick={() => setCombatSpeed(s)}
                                                className={`px-2.5 py-1 text-xs rounded font-mono transition-colors ${combatSpeed === s ? 'bg-accent-cyan/20 text-accent-cyan border border-accent-cyan/40' : 'bg-space-700 text-gray-400 hover:text-white border border-space-600'}`}>
                                                {s}x
                                            </button>
                                        ))}
                                        <button onClick={() => intervalRef.skipFn?.()}
                                            className="px-2.5 py-1 text-xs rounded font-mono bg-space-700 text-gray-400 hover:text-white border border-space-600 transition-colors">
                                            Skip
                                        </button>
                                    </div>
                                    <button onClick={handleFlee} className="btn btn-secondary w-full border-accent-orange text-accent-orange hover:bg-accent-orange hover:text-white">
                                        EMERGENCY FLEE
                                    </button>
                                </div>
                            )}
                            {battleResult === 'victory' && (
                                <div className="text-center w-full space-y-3">
                                    <div className="text-accent-green font-bold text-xl flex items-center justify-center gap-2">
                                        <Trophy /> VICTORY
                                    </div>
                                    <div className="p-3 rounded-lg space-y-1.5" style={{ background: 'rgba(76,175,80,0.06)', border: '1px solid rgba(76,175,80,0.15)' }}>
                                        <div className="flex justify-between text-sm">
                                            <span className="text-gray-400">Credits Looted</span>
                                            <span className="text-accent-orange font-mono">{(loot?.credits || 0).toLocaleString()} cr</span>
                                        </div>
                                        {loot?.xp > 0 && (
                                            <div className="flex justify-between text-sm">
                                                <span className="text-gray-400">XP Earned</span>
                                                <span className="text-neon-cyan font-mono">+{loot.xp.toLocaleString()}</span>
                                            </div>
                                        )}
                                        {loot?.rewardMultiplier > 1 && (
                                            <div className="flex justify-between text-sm">
                                                <span className="text-gray-400">Zone Bonus</span>
                                                <span className="text-accent-purple font-mono">{loot.rewardMultiplier}x</span>
                                            </div>
                                        )}
                                        {loot?.items?.length > 0 && (
                                            <div className="flex justify-between text-sm">
                                                <span className="text-gray-400">Items</span>
                                                <span className="text-white">{loot.items.length} dropped</span>
                                            </div>
                                        )}
                                        <div className="flex justify-between text-sm">
                                            <span className="text-gray-400">Rounds</span>
                                            <span className="text-gray-300 font-mono">{displayLog.length}</span>
                                        </div>
                                        <div className="flex justify-between text-sm">
                                            <span className="text-gray-400">Hull Remaining</span>
                                            <span className={`font-mono ${playerStats.hull / playerStats.maxHull > 0.5 ? 'text-accent-green' : playerStats.hull / playerStats.maxHull > 0.25 ? 'text-yellow-400' : 'text-accent-red'}`}>
                                                {playerStats.hull}/{playerStats.maxHull}
                                            </span>
                                        </div>
                                        {playerStats.maxShields > 0 && (
                                            <div className="flex justify-between text-sm">
                                                <span className="text-gray-400">Shields Remaining</span>
                                                <span className={`font-mono ${playerStats.shields / playerStats.maxShields > 0.5 ? 'text-accent-purple' : 'text-yellow-400'}`}>
                                                    {playerStats.shields}/{playerStats.maxShields}
                                                </span>
                                            </div>
                                        )}
                                        {playerStats.maxHull - playerStats.hull > 0 && (
                                            <div className="flex justify-between text-sm">
                                                <span className="text-gray-400">Hull Damage Taken</span>
                                                <span className="text-accent-red font-mono">-{playerStats.maxHull - playerStats.hull}</span>
                                            </div>
                                        )}
                                        {displayLog.length > 0 && (
                                            <div className="flex justify-between text-sm">
                                                <span className="text-gray-400">Component Stress</span>
                                                <span className={`font-mono ${displayLog.length > 5 ? 'text-accent-orange' : 'text-gray-300'}`}>
                                                    {displayLog.length} round{displayLog.length !== 1 ? 's' : ''} of wear
                                                </span>
                                            </div>
                                        )}
                                    </div>
                                    <div className="flex gap-2">
                                        <button onClick={() => navigate('/map')} className="btn btn-primary flex-1">
                                            Return to Sector
                                        </button>
                                        {playerStats.hull < playerStats.maxHull && (
                                            <button onClick={() => navigate('/repair')} className="btn btn-secondary flex-1 border-accent-orange text-accent-orange">
                                                Repair Ship
                                            </button>
                                        )}
                                    </div>
                                </div>
                            )}
                            {battleResult === 'defeat' && (
                                <div className="text-center w-full space-y-3">
                                    <div className="text-accent-red font-bold text-xl flex items-center justify-center gap-2">
                                        <Skull /> DESTROYED
                                    </div>
                                    <div className="p-3 rounded-lg space-y-1.5" style={{ background: 'rgba(244,67,54,0.06)', border: '1px solid rgba(244,67,54,0.15)' }}>
                                        <div className="flex justify-between text-sm">
                                            <span className="text-gray-400">Rounds Survived</span>
                                            <span className="text-gray-300 font-mono">{displayLog.length}</span>
                                        </div>
                                        <div className="flex justify-between text-sm">
                                            <span className="text-gray-400">Enemy Hull Remaining</span>
                                            <span className="text-accent-red font-mono">{enemyStats.hull}/{enemyStats.maxHull}</span>
                                        </div>
                                        {loot?.xp > 0 && (
                                            <div className="flex justify-between text-sm">
                                                <span className="text-gray-400">XP Earned</span>
                                                <span className="text-neon-cyan font-mono">+{loot.xp.toLocaleString()}</span>
                                            </div>
                                        )}
                                    </div>
                                    <button onClick={() => navigate('/')} className="btn btn-secondary w-full">
                                        Eject Pod
                                    </button>
                                </div>
                            )}
                            {battleResult === 'fled' && (
                                <div className="text-center w-full space-y-2">
                                    <div className="text-accent-orange font-bold text-xl flex items-center justify-center gap-2">
                                        <Activity /> DISENGAGED
                                    </div>
                                    <button onClick={() => navigate('/map')} className="btn btn-primary w-full">
                                        Return to Sector
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Enemy Status */}
                    <div className="card p-6 border-accent-red/30 flex flex-col justify-center space-y-4">
                        {(targetNpc || pvpTarget) ? (
                            <>
                                <h2 className="text-xl font-bold text-accent-red text-right">
                                    {pvpTarget ? (pvpTarget.name || 'Unknown Commander') : (targetNpc.name || "Unknown Hostile")}
                                </h2>
                                {pvpTarget && (
                                    <p className="text-xs text-purple-400 text-right">
                                        {String(pvpTarget.ship_type || 'Unknown').replace('_', ' ')} - PvP
                                    </p>
                                )}
                                <div className="space-y-2">
                                    <div className="flex justify-between text-xs text-gray-400">
                                        <span>Shields</span>
                                        <span>{enemyStats.shields}/{enemyStats.maxShields}</span>
                                    </div>
                                    <div className="w-full bg-space-900 h-2 rounded-full">
                                        <div className="bg-accent-purple h-full rounded-full transition-all duration-500" style={{ width: `${enemyStats.maxShields > 0 ? (enemyStats.shields / enemyStats.maxShields) * 100 : 0}%` }}></div>
                                    </div>

                                    <div className="flex justify-between text-xs text-gray-400 mt-2">
                                        <span>Hull Integrity</span>
                                        <span>{enemyStats.hull}/{enemyStats.maxHull}</span>
                                    </div>
                                    <div className="w-full bg-space-900 h-4 rounded-full">
                                        <div className="bg-accent-red h-full rounded-full transition-all duration-500" style={{ width: `${enemyStats.maxHull > 0 ? (enemyStats.hull / enemyStats.maxHull) * 100 : 0}%` }}></div>
                                    </div>
                                </div>
                                <div className="mt-4 flex justify-center">
                                    <div className={`w-32 h-32 rounded-full border-2 flex items-center justify-center animate-pulse ${
                                        pvpTarget ? 'border-purple-500 bg-purple-500/10' : 'border-accent-red bg-accent-red/10'
                                    }`}>
                                        {pvpTarget ? (
                                            <Crosshair className="w-16 h-16 text-purple-400" />
                                        ) : (
                                            <Skull className="w-16 h-16 text-accent-red" />
                                        )}
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
            )}

            {error && (
                <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 px-6 py-3 rounded shadow-lg flex items-center gap-3 bg-accent-red/90 text-white">
                    <AlertTriangle className="w-5 h-5" /> {error}
                    <button onClick={() => setError(null)} className="text-xs underline ml-2">dismiss</button>
                </div>
            )}
        </div>
    );
};

export default CombatPage;
