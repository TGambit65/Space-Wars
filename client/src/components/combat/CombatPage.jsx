import { useState, useEffect, useRef, useCallback } from 'react';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { combat, ships, npcs } from '../../services/api';
import CombatHUD from './CombatHUD';
import TacticalMap from './TacticalMap';
import { Crosshair, AlertTriangle, Skull, Trophy, Zap, Activity, Clock, TrendingUp } from 'lucide-react';
import { useNotifications } from '../../contexts/NotificationContext';
import WikiLink from '../common/WikiLink';

/**
 * Pre-encounter warning banner with a live 5-second reaction countdown
 * and react-now controls. Mounted only while a `warning` event is active.
 */
const EncounterWarningBanner = ({ warning, onCancel, onEngageNow, onCountermeasure }) => {
    const [now, setNow] = useState(Date.now());
    useEffect(() => {
        if (!warning?.pendingUntil) return undefined;
        const id = setInterval(() => setNow(Date.now()), 100);
        return () => clearInterval(id);
    }, [warning?.pendingUntil]);
    const remaining = warning?.pendingUntil
        ? Math.max(0, warning.pendingUntil - now)
        : null;
    const seconds = remaining !== null ? (remaining / 1000).toFixed(1) : null;
    const expired = remaining !== null && remaining <= 0;
    return (
        <div className="mb-4 p-3 rounded border border-accent-red/40 bg-accent-red/10 flex items-center gap-3">
            <AlertTriangle className="w-5 h-5 text-accent-red animate-pulse" />
            <div className="flex-1 text-sm">
                <div className="font-bold text-accent-red flex items-center gap-3">
                    <span>Hostile engagement imminent!</span>
                    {seconds !== null && !expired && (
                        <span className="font-mono text-accent-orange text-xs">
                            React in {seconds}s
                        </span>
                    )}
                </div>
                <div className="text-gray-300 text-xs mt-1">
                    {warning.hostiles.map((h, i) => (
                        <span key={h.shipId}>
                            {i > 0 && ', '}
                            {h.name || h.npcType}{h.tier ? ` [${h.tier}]` : ''}
                        </span>
                    ))}
                </div>
            </div>
            {!expired && (
                <div className="flex gap-2">
                    <button
                        onClick={onCancel}
                        className="px-3 py-1 rounded text-xs bg-accent-orange/20 border border-accent-orange/50 text-accent-orange hover:bg-accent-orange/30"
                    >
                        Flee
                    </button>
                    <button
                        onClick={onCountermeasure}
                        className="px-3 py-1 rounded text-xs bg-accent-cyan/20 border border-accent-cyan/50 text-accent-cyan hover:bg-accent-cyan/30"
                    >
                        Countermeasure
                    </button>
                    <button
                        onClick={onEngageNow}
                        className="px-3 py-1 rounded text-xs bg-accent-red/20 border border-accent-red/50 text-accent-red hover:bg-accent-red/30"
                    >
                        Engage now
                    </button>
                </div>
            )}
        </div>
    );
};

/**
 * CombatPage — single source of truth client for ship-to-ship combat.
 *
 * All combat state arrives over the unified `combat:event` channel
 * (versioned, sequenced; type discriminator: started/snapshot/state/hit/destroyed/
 *  escaped/warning/autopilot_on/autopilot_off/recovered/resolved). The legacy
 * auto-resolve POST endpoint and parallel listeners (combat:hit/state/...)
 * were removed in Task #4.
 */
const CombatPage = ({ user, socket }) => {
    const location = useLocation();
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const notify = useNotifications();
    const urlCombatId = searchParams.get('combatId');
    const [ship, setShip] = useState(null);
    const [targetNpc, setTargetNpc] = useState(location.state?.npc || null);
    const [pvpTarget, setPvpTarget] = useState(location.state?.pvpTarget || null);

    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [loot, setLoot] = useState(null);
    const [battleResult, setBattleResult] = useState(null); // 'victory' | 'defeat' | 'fled'
    const [isBattling, setIsBattling] = useState(false);

    // Realtime channel state
    const [combatId, setCombatId] = useState(null);
    const [realtimeState, setRealtimeState] = useState(null);
    const [combatLog, setCombatLog] = useState([]);
    const [autopilotActive, setAutopilotActive] = useState(false);
    const [encounterWarning, setEncounterWarning] = useState(null);
    const lastSeqRef = useRef(0);
    // Tracks the combatId we just initiated (set in handleEngage, cleared on bind).
    // Used to gate adoption of incoming combat:event 'started/snapshot/recovered'
    // so unrelated sector combats can never overwrite our UI state.
    const pendingCombatIdRef = useRef(null);

    // Visual damage indicators
    const [shakeActive, setShakeActive] = useState(false);
    const [damageFlash, setDamageFlash] = useState(false);
    const [floatingDamage, setFloatingDamage] = useState([]);
    const damageIdRef = useRef(0);

    const scrollRef = useRef(null);
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

    // ─── Initial Ship + Target Load ─────────────────────────────
    useEffect(() => {
        const init = async () => {
            try {
                const shipsRes = await ships.getAll();
                const shipList = shipsRes.data.data?.ships || [];
                if (!shipList.length) throw new Error('No ship found');
                const activeId = shipsRes.data.data?.active_ship_id;
                const currentShip = (activeId && shipList.find(s => s.ship_id === activeId)) || shipList[0];
                const fullShipRes = await ships.getById(currentShip.ship_id);
                setShip(fullShipRes.data.data.ship);

                if (targetNpc && !targetNpc.hull_points) {
                    try {
                        const npcRes = await npcs.getById(targetNpc.npc_id);
                        setTargetNpc(npcRes.data.data?.npc || npcRes.data.npc || npcRes.data);
                    } catch { /* keep what we have */ }
                }
            } catch (err) {
                console.error('Combat init failed', err);
                setError('Combat systems offline.');
            } finally {
                setLoading(false);
            }
        };
        init();
        // We intentionally only run this on mount for the initial target;
        // target swaps happen through findRandomTarget / clear actions.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // ─── URL-driven binding (arena/duel matches link us here with ?combatId=) ──
    useEffect(() => {
        if (!socket || !urlCombatId) return;
        if (combatId === urlCombatId) return;
        pendingCombatIdRef.current = urlCombatId;
        setCombatId(urlCombatId);
        setIsBattling(true);
        // Request a snapshot — the spectate_join handler emits one and is
        // permissive for participants on any combat type.
        socket.emit('combat:spectate_join', { combat_id: urlCombatId });
        return () => {
            socket.emit('combat:spectate_leave', { combat_id: urlCombatId });
        };
    }, [socket, urlCombatId, combatId]);

    // ─── Single combat:event Channel ────────────────────────────
    useEffect(() => {
        if (!socket) return;

        const applyHitFlash = (data) => {
            const target = realtimeState?.ships?.find(s => s.shipId === data.targetId);
            if (target && !target.isNPC) {
                showDamageIndicator(data.damage, 'player');
            } else if (target) {
                showDamageIndicator(data.damage, 'enemy');
            }
        };

        const onEvent = (evt) => {
            if (!evt || typeof evt !== 'object') return;
            // Out-of-order guard within a single combat. Snapshot/recovered events
            // are authoritative full-state and must always apply on reconnect, so
            // they bypass the seq guard (and reset the local high-water mark).
            const isAuthoritativeSnapshot = evt.type === 'snapshot' || evt.type === 'recovered' || evt.type === 'started';
            if (combatId && evt.combatId === combatId && evt.seq && !isAuthoritativeSnapshot) {
                if (evt.seq <= lastSeqRef.current) return;
                lastSeqRef.current = evt.seq;
            } else if (isAuthoritativeSnapshot && evt.seq) {
                lastSeqRef.current = evt.seq;
            }

            switch (evt.type) {
                case 'warning':
                    // Pre-engagement warning sent to the targeted user only.
                    // pendingUntil arrives as an absolute server timestamp so
                    // the client can render a real reaction countdown.
                    setEncounterWarning({
                        hostiles: evt.hostiles || [],
                        at: Date.now(),
                        pendingUntil: evt.pendingUntil || null,
                        graceMs: evt.graceMs || 5000
                    });
                    if (evt.pendingUntil) {
                        const remaining = Math.max(0, evt.pendingUntil - Date.now());
                        setTimeout(() => setEncounterWarning(null), remaining + 500);
                    } else {
                        setTimeout(() => setEncounterWarning(null), 8000);
                    }
                    break;
                case 'engaged':
                    // Server signalled the warning window has expired and
                    // weapons are now hot.
                    setEncounterWarning(null);
                    break;
                case 'cancelled':
                    // Player fled during the warning window — clean up locally.
                    setEncounterWarning(null);
                    setCombatId(null);
                    setRealtimeState(null);
                    setIsBattling(false);
                    setBattleResult('fled');
                    notify.warning('Disengaged before the fight began');
                    break;
                case 'countermeasure':
                    notify.info('Countermeasures deployed');
                    break;
                case 'started':
                case 'snapshot':
                case 'recovered': {
                    // Only adopt a combat when (a) we initiated it and got back this id,
                    // (b) we are already tracking it, or (c) we are listed as a participant
                    // in the snapshot (so server-initiated recovery still binds the right user).
                    const matchesPending = pendingCombatIdRef.current && evt.combatId === pendingCombatIdRef.current;
                    const matchesActive = combatId && evt.combatId === combatId;
                    const isParticipant = !!(user?.user_id && Array.isArray(evt.snapshot?.ships)
                        && evt.snapshot.ships.some(s => !s.isNPC && s.ownerId && s.ownerId === user.user_id));
                    if (!matchesPending && !matchesActive && !isParticipant) break;

                    if (!matchesActive) {
                        setCombatId(evt.combatId);
                        lastSeqRef.current = evt.seq || 0;
                        pendingCombatIdRef.current = null;
                    }
                    if (evt.snapshot) setRealtimeState(evt.snapshot);
                    if (evt.type === 'recovered') {
                        notify.warning('Reconnected -- combat resumed in autopilot');
                    }
                    break;
                }
                case 'state':
                    if (evt.combatId === combatId && evt.snapshot) {
                        setRealtimeState(evt.snapshot);
                    }
                    break;
                case 'hit':
                    if (evt.combatId === combatId) {
                        applyHitFlash(evt);
                        setCombatLog(prev => [...prev.slice(-49), {
                            type: 'hit',
                            attacker: evt.attackerId,
                            target: evt.targetId,
                            damage: evt.damage,
                            system: evt.targetSystem,
                            time: Date.now()
                        }]);
                    }
                    break;
                case 'destroyed':
                    if (evt.combatId === combatId) {
                        setCombatLog(prev => [...prev, { type: 'destroyed', shipId: evt.shipId, isNPC: evt.isNPC, time: Date.now() }]);
                    }
                    break;
                case 'escaped':
                    if (evt.combatId === combatId) {
                        setCombatLog(prev => [...prev, { type: 'escaped', shipId: evt.shipId, time: Date.now() }]);
                    }
                    break;
                case 'autopilot_on':
                    if (evt.combatId === combatId) {
                        setAutopilotActive(true);
                        notify.warning('Connection lost -- autopilot engaged for 60s');
                    }
                    break;
                case 'autopilot_off':
                    if (evt.combatId === combatId) {
                        setAutopilotActive(false);
                    }
                    break;
                case 'resolved':
                    if (evt.combatId === combatId) {
                        pendingCombatIdRef.current = null;
                        const result = evt.result?.winnerType === 'player'
                            ? (evt.result.winnerOwnerId && user?.user_id && evt.result.winnerOwnerId === user.user_id ? 'victory' : 'defeat')
                            : evt.result?.escaped?.length ? 'fled' : 'defeat';
                        setBattleResult(result);
                        setLoot(evt.loot || null);
                        setIsBattling(false);
                        setCombatId(null);
                        setRealtimeState(null);
                        if (result === 'victory') notify.success(`Victory! Looted ${(evt.loot?.credits || 0).toLocaleString()} credits`);
                        else if (result === 'defeat') notify.error('Defeated in combat');
                        else if (result === 'fled') notify.warning('Escaped from combat');
                    }
                    break;
                default:
                    break;
            }
        };

        socket.on('combat:event', onEvent);
        return () => { socket.off('combat:event', onEvent); };
    }, [socket, combatId, realtimeState, showDamageIndicator, notify, user]);

    // Auto-scroll log
    useEffect(() => {
        if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }, [combatLog]);

    const findRandomTarget = async () => {
        try {
            setLoading(true); setError(null);
            if (!ship?.currentSector) return;
            const npcRes = await npcs.getInSector(ship.currentSector.sector_id);
            const npcList = npcRes.data.npcs || [];
            if (npcList.length > 0) setTargetNpc(npcList[0]);
            else setError('No hostile signatures detected in this sector.');
        } catch {
            setError('Scanner malfunction.');
        } finally {
            setLoading(false);
        }
    };

    const handleEngage = async () => {
        if (!ship || (!targetNpc && !pvpTarget)) return;
        try {
            setIsBattling(true); setBattleResult(null); setError(null); setCombatLog([]);
            let res;
            if (pvpTarget) {
                res = await combat.realtimeAttackPlayer(activeShipId, pvpTarget.ship_id);
                setCombatLog([{ type: 'system', message: `PvP combat initiated against ${pvpTarget.name}!`, time: Date.now() }]);
            } else {
                res = await combat.realtimeAttackNPC(activeShipId, targetNpc.npc_id);
                setCombatLog([{ type: 'system', message: 'Real-time combat initiated', time: Date.now() }]);
            }
            const newCombatId = res.data.data.combat_id;
            pendingCombatIdRef.current = newCombatId;
            setCombatId(newCombatId);
            lastSeqRef.current = 0;
        } catch (err) {
            setIsBattling(false);
            setError(err.response?.data?.message || err.response?.data?.error || 'Failed to initiate combat');
        }
    };

    const handleCombatCommand = (command) => {
        if (!socket || !combatId || !activeShipId) return;
        socket.emit('combat:command', {
            combat_id: combatId,
            ship_id: activeShipId,
            command
        });
    };

    const handleFlee = () => {
        if (combatId) handleCombatCommand({ type: 'disengage' });
    };

    if (loading) return <div className="p-12 text-center text-accent-red animate-pulse">Initializing Tactical Display...</div>;

    const ownShip = realtimeState?.ships?.find(s => !s.isNPC);
    const enemies = realtimeState?.ships?.filter(s => s.isNPC) || [];
    const livingEnemies = enemies.filter(s => s.alive);
    const targetCard = pvpTarget || targetNpc;

    // Threat assessment using realtime stats if present, otherwise pre-fight
    const threatAssessment = (() => {
        if (!ship || !targetCard) return null;
        const pHull = ownShip?.stats?.hull ?? ship.hull_points;
        const pShields = ownShip?.stats?.shields ?? ship.shield_points;
        const eHull = enemies[0]?.stats?.hull ?? targetCard.hull_points ?? 100;
        const eShields = enemies[0]?.stats?.shields ?? targetCard.shield_points ?? 100;
        const pTotal = pHull + pShields;
        const eTotal = eHull + eShields;
        if (eTotal === 0) return null;
        const ratio = pTotal / (pTotal + eTotal);
        const pct = Math.round(ratio * 100);
        const label = pct >= 75 ? 'Favorable' : pct >= 50 ? 'Even' : pct >= 30 ? 'Risky' : 'Dangerous';
        const color = pct >= 75 ? '#4caf50' : pct >= 50 ? '#ffc107' : pct >= 30 ? '#ff6600' : '#f44336';
        return { pct, label, color };
    })();

    const isLive = !!combatId && !!realtimeState;

    return (
        <div className={`max-w-6xl mx-auto h-[calc(100vh-100px)] flex flex-col ${shakeActive ? 'animate-screen-shake' : ''}`}>
            {damageFlash && (
                <div className="damage-flash-overlay fixed inset-0 pointer-events-none z-50" style={{ background: 'rgba(244, 67, 54, 0.15)' }} />
            )}

            {floatingDamage.map(d => (
                <div key={d.id} className="animate-damage-float fixed z-50 font-bold font-mono text-lg pointer-events-none"
                    style={{
                        color: d.side === 'player' ? '#f44336' : '#00ffff',
                        top: '30%',
                        left: d.side === 'player' ? '20%' : '75%',
                        textShadow: `0 0 10px ${d.side === 'player' ? 'rgba(244,67,54,0.6)' : 'rgba(0,255,255,0.6)'}`,
                    }}>
                    -{d.amount}
                </div>
            ))}

            <header className="flex justify-between items-center mb-6">
                <div>
                    <h1 className="text-3xl font-bold text-accent-red flex items-center gap-3">
                        <Crosshair className="w-8 h-8" />
                        Tactical Interface
                        {isLive && (
                            <span className="text-sm font-normal text-accent-cyan bg-accent-cyan/10 border border-accent-cyan/30 px-2 py-0.5 rounded ml-2 animate-pulse">
                                LIVE
                            </span>
                        )}
                        {autopilotActive && (
                            <span className="text-sm font-normal text-accent-orange bg-accent-orange/10 border border-accent-orange/30 px-2 py-0.5 rounded ml-2">
                                AUTOPILOT
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
                    <button onClick={() => navigate('/map')} className="btn btn-secondary">Exit Tactical</button>
                </div>
            </header>

            {encounterWarning && (
                <EncounterWarningBanner
                    warning={encounterWarning}
                    onCancel={() => handleCombatCommand({ type: 'disengage' })}
                    onEngageNow={() => handleCombatCommand({ type: 'engage_now' })}
                    onCountermeasure={() => handleCombatCommand({ type: 'countermeasure' })}
                />
            )}

            {isLive ? (
                <div className="flex-1 flex flex-col space-y-4 relative pb-56">
                    {/* Tactical Map: top-down PixiJS view of the arena */}
                    <div className="holo-panel p-2 flex-1 min-h-[320px] relative">
                        <div className="absolute top-3 left-4 z-10 flex items-center gap-2 pointer-events-none">
                            <Zap className="w-4 h-4 text-neon-cyan" />
                            <span className="text-xs uppercase tracking-widest text-neon-cyan font-bold">Tactical Display</span>
                            <span className="text-[10px] text-gray-500 ml-2">Click enemy → target · Click empty → move · Right-click → stop</span>
                        </div>
                        <div className="w-full h-full">
                            <TacticalMap
                                snapshot={realtimeState}
                                ownShipId={activeShipId}
                                onCommand={handleCombatCommand}
                            />
                        </div>
                    </div>

                    <div className="holo-panel p-4">
                        <h2 className="text-xs uppercase tracking-widest text-neon-cyan mb-2 flex items-center gap-2 font-bold">
                            <Activity className="w-4 h-4" /> Combatants
                        </h2>
                        <div className="grid grid-cols-2 gap-4">
                            {realtimeState.ships?.map(s => (
                                <div key={s.shipId} className="p-3 rounded-lg" style={{
                                    background: s.isNPC ? 'rgba(244,67,54,0.08)' : 'rgba(0,255,255,0.08)',
                                    border: `1px solid ${s.isNPC ? 'rgba(244,67,54,0.25)' : 'rgba(0,255,255,0.25)'}`
                                }}>
                                    <p className={`font-bold text-sm ${s.isNPC ? 'text-red-400' : 'text-neon-cyan'}`}>
                                        {s.isNPC ? 'HOSTILE' : 'YOUR SHIP'}
                                        {s.name && ` - ${s.name}`}
                                        {s.tier && s.isNPC ? ` [${s.tier}]` : ''}
                                        {s.escaped ? ' (ESCAPED)' : !s.alive ? ' (DESTROYED)' : ''}
                                        {s.aiControlled && !s.isNPC ? ' (AUTOPILOT)' : ''}
                                    </p>
                                    <div className="mt-2 space-y-1">
                                        <div className="flex justify-between text-xs text-gray-400">
                                            <span>Shields</span>
                                            <span>{Math.floor(s.stats?.shields ?? 0)}/{s.stats?.maxShields ?? 0}</span>
                                        </div>
                                        <div className="w-full h-2 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.06)' }}>
                                            <div className="h-full rounded-full transition-all duration-200" style={{
                                                width: `${(s.stats?.maxShields ?? 0) > 0 ? (s.stats.shields / s.stats.maxShields * 100) : 0}%`,
                                                background: '#3b82f6'
                                            }} />
                                        </div>
                                        <div className="flex justify-between text-xs text-gray-400">
                                            <span>Hull</span>
                                            <span>{Math.floor(s.stats?.hull ?? 0)}/{s.stats?.maxHull ?? 0}</span>
                                        </div>
                                        <div className="w-full h-2 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.06)' }}>
                                            <div className="h-full rounded-full transition-all duration-200" style={{
                                                width: `${(s.stats?.maxHull ?? 0) > 0 ? (s.stats.hull / s.stats.maxHull * 100) : 0}%`,
                                                background: (s.stats?.maxHull ?? 0) > 0 && (s.stats.hull / s.stats.maxHull) > 0.5 ? '#00ffff'
                                                    : (s.stats?.maxHull ?? 0) > 0 && (s.stats.hull / s.stats.maxHull) > 0.25 ? '#ffc107'
                                                    : '#f44336'
                                            }} />
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

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

                    <CombatHUD
                        combatState={{
                            ownShip: ownShip ? {
                                name: ship?.name,
                                shield_points: ownShip.stats?.shields ?? 0,
                                max_shield_points: ownShip.stats?.maxShields ?? 0,
                                hull_points: ownShip.stats?.hull ?? 0,
                                max_hull_points: ownShip.stats?.maxHull ?? 0,
                            } : {},
                            targets: livingEnemies.map(s => ({
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
                        onFlee={handleFlee}
                    />
                </div>
            ) : (
                <div className="flex-1 grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div className="card p-6 border-accent-cyan/30 flex flex-col justify-center space-y-4">
                        <h2 className="text-xl font-bold text-accent-cyan">{ship?.name}</h2>
                        <div className="text-sm text-gray-400 space-y-1">
                            <div>Hull: {ship?.hull_points}/{ship?.max_hull_points}</div>
                            <div>Shields: {ship?.shield_points}/{ship?.max_shield_points}</div>
                            <div>Attack: {ship?.attack_power}</div>
                            <div>Defense: {ship?.defense_rating}</div>
                        </div>
                    </div>

                    <div className="flex flex-col space-y-4">
                        <div className="flex-1 card bg-black/50 border-accent-red/20 p-4 font-mono text-sm flex flex-col items-center justify-center">
                            {!targetCard && !battleResult && (
                                <div className="text-gray-600 text-center">No target acquired. Scan for hostiles or select one from the sector view.</div>
                            )}
                            {targetCard && !battleResult && !isBattling && (
                                <div className="w-full space-y-3">
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
                                    <button onClick={handleEngage} className="btn btn-danger w-full py-3 text-lg font-bold tracking-wider animate-pulse">
                                        {pvpTarget ? 'ENGAGE COMMANDER' : 'ENGAGE HOSTILE'}
                                    </button>
                                </div>
                            )}
                            {isBattling && !combatId && (
                                <div className="text-accent-cyan animate-pulse">Establishing tactical link...</div>
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
                                    </div>
                                    {Array.isArray(loot?.derelictManifests) && loot.derelictManifests.length > 0 && (
                                        <div className="p-3 rounded-lg text-left space-y-2" style={{ background: 'rgba(255,209,102,0.06)', border: '1px solid rgba(255,209,102,0.2)' }}>
                                            <div className="text-xs uppercase tracking-wide text-accent-orange font-bold">
                                                Derelict Wrecks Boardable
                                            </div>
                                            {loot.derelictManifests.map((m) => (
                                                <button
                                                    key={m.derelict_id}
                                                    onClick={() => navigate(`/derelict/${m.derelict_id}`)}
                                                    className="w-full text-xs text-left text-gray-300 flex justify-between items-center gap-2 px-2 py-1.5 rounded hover:bg-accent-orange/10 transition-colors border border-transparent hover:border-accent-orange/40"
                                                >
                                                    <span>
                                                        {m.ship_type} <span className="text-gray-500">({m.hull_class})</span>
                                                    </span>
                                                    <span className="font-mono text-accent-orange flex items-center gap-1">
                                                        {m.crates.length} crate{m.crates.length === 1 ? '' : 's'}
                                                        <span className="text-[10px]">→ Board</span>
                                                    </span>
                                                </button>
                                            ))}
                                            <div className="text-[10px] text-gray-500 italic">
                                                Click a wreck to walk its decks and recover loot.
                                            </div>
                                        </div>
                                    )}
                                    <div className="flex gap-2">
                                        <button onClick={() => navigate('/map')} className="btn btn-primary flex-1">Return to Sector</button>
                                        <button onClick={() => navigate('/repair')} className="btn btn-secondary flex-1 border-accent-orange text-accent-orange">Repair Ship</button>
                                    </div>
                                </div>
                            )}
                            {battleResult === 'defeat' && (
                                <div className="text-center w-full space-y-3">
                                    <div className="text-accent-red font-bold text-xl flex items-center justify-center gap-2">
                                        <Skull /> DESTROYED
                                    </div>
                                    <button onClick={() => navigate('/')} className="btn btn-secondary w-full">Eject Pod</button>
                                </div>
                            )}
                            {battleResult === 'fled' && (
                                <div className="text-center w-full space-y-2">
                                    <div className="text-accent-orange font-bold text-xl flex items-center justify-center gap-2">
                                        <Activity /> DISENGAGED
                                    </div>
                                    <button onClick={() => navigate('/map')} className="btn btn-primary w-full">Return to Sector</button>
                                </div>
                            )}
                        </div>
                    </div>

                    <div className="card p-6 border-accent-red/30 flex flex-col justify-center space-y-4">
                        {targetCard ? (
                            <>
                                <h2 className="text-xl font-bold text-accent-red text-right">
                                    {pvpTarget ? (pvpTarget.name || 'Unknown Commander') : (targetNpc.name || 'Unknown Hostile')}
                                </h2>
                                <p className="text-xs text-purple-400 text-right">
                                    {pvpTarget
                                        ? `${String(pvpTarget.ship_type || 'Unknown').replace('_', ' ')} - PvP`
                                        : `${targetNpc.npc_type || 'Hostile'}${targetNpc.intelligence_tier ? ` [${targetNpc.intelligence_tier}]` : ''}`}
                                </p>
                                <div className="text-sm text-gray-400 space-y-1">
                                    <div>Hull: {targetCard.hull_points ?? '??'}</div>
                                    <div>Shields: {targetCard.shield_points ?? '??'}</div>
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
