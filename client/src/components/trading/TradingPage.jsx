import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { trade, ports, ships, auth } from '../../services/api';
import { ShoppingCart, Package, DollarSign, TrendingUp, TrendingDown, Anchor, AlertCircle, RefreshCw, Fuel, AlertTriangle, Star, Boxes, Zap } from 'lucide-react';
import LoadingScreen from '../common/LoadingScreen';
import { useNotifications } from '../../contexts/NotificationContext';
import useSoundEffects from '../../hooks/useSoundEffects';
import WikiLink from '../common/WikiLink';
import useNearestPort from '../../hooks/useNearestPort';

const TradingPage = ({ user: initialUser }) => {
    const navigate = useNavigate();
    const notify = useNotifications();
    const { play: sfx } = useSoundEffects();
    const [userCredits, setUserCredits] = useState(initialUser?.credits || 0);

    const [currentShip, setCurrentShip] = useState(null);
    const [currentPort, setCurrentPort] = useState(null);
    const [commodities, setCommodities] = useState([]);
    const [cargo, setCargo] = useState([]);

    const [loading, setLoading] = useState(true);
    const [tradeLoading, setTradeLoading] = useState(false);
    const [error, setError] = useState(null);

    // Track quantities for each commodity: { commodityId: quantity }
    const [tradeQuantities, setTradeQuantities] = useState({});
    const [refuelAmount, setRefuelAmount] = useState('');
    const [refuelLoading, setRefuelLoading] = useState(false);
    const [avgCosts, setAvgCosts] = useState({});
    const [bestTrades, setBestTrades] = useState([]);
    const [noPortSectorId, setNoPortSectorId] = useState(null);

    useEffect(() => {
        // If user prop changes (e.g. from parent re-fetch), update credits
        if (initialUser) setUserCredits(initialUser.credits);
    }, [initialUser]);

    useEffect(() => {
        const fetchData = async () => {
            try {
                setLoading(true);
                setError(null);

                // 1. Get Active Ship
                const shipsRes = await ships.getAll();
                const shipList = shipsRes.data.data?.ships || [];

                if (shipList.length === 0) {
                    throw new Error("No active ship found.");
                }
                const activeId = shipsRes.data.data?.active_ship_id;
                const ship = (activeId && shipList.find(s => s.ship_id === activeId)) || shipList[0];
                // Get full details including fresh cargo
                const shipRes = await ships.getById(ship.ship_id);
                setCurrentShip(shipRes.data.data.ship);

                // 2. Check if Docked
                // The API doesn't explicitly flag "docked", but we can look for a port in the current sector
                // Or assume if ship.current_sector matches a port location. 
                // Strategy: Get ports in current sector. If one exists, assume docked for now (simplified).
                // Real logic: Backend usually enforces "docked" state, but for UI we'll just check availability.
                const shipData = shipRes.data.data.ship;
                const currentSector = shipData.currentSector || shipData.current_sector;
                if (!currentSector) throw new Error("Ship location unknown.");

                const portsRes = await ports.getBySector(currentSector.sector_id);
                const localPorts = portsRes.data.data?.ports || [];

                if (!localPorts || localPorts.length === 0) {
                    setNoPortSectorId(currentSector.sector_id);
                    setError("No trading port in this sector. Open the Sector Map to find nearby ports — they appear as cyan rings around systems.");
                    setLoading(false);
                    return;
                }

                // Just pick the first port in sector for now
                const portId = localPorts[0].port_id;
                const portDetailRes = await ports.getById(portId);
                // API returns { success: true, data: { port: { ... } } }
                const portData = portDetailRes.data.data?.port;
                setCurrentPort(portData);
                setCommodities(portData?.commodities || []);

                // 3. Get Cargo (ship.cargo might be summary, get detailed if needed)
                // The ship details endpoint usually includes cargo, but let's be sure.
                // Assuming shipRes.data.cargo is array of items.
                // Or use trade.getCargo(shipId) if specific endpoint exists
                const cargoRes = await trade.getCargo(ship.ship_id);
                // API returns { success: true, data: { items: [...], used_capacity, ... } }
                setCargo(cargoRes.data.data?.items || []);
                // Augment ship with cargo usage info
                setCurrentShip(prev => ({
                  ...prev,
                  cargo_used: cargoRes.data.data?.used_capacity || 0
                }));

                // 4. Refresh User Credits (integrity check)
                const profileRes = await auth.getProfile();
                if (profileRes.data?.data) setUserCredits(profileRes.data.data.credits);

                // 5. Fetch avg purchase costs for cargo items + market summary for best trades
                try {
                    const [historyRes, marketRes] = await Promise.all([
                        trade.getHistory({ type: 'BUY', limit: 100 }),
                        trade.getMarketSummary(),
                    ]);
                    const txns = historyRes.data.data?.transactions || [];
                    const costs = {};
                    for (const tx of txns) {
                        const cid = tx.commodity_id;
                        if (!costs[cid]) costs[cid] = { totalSpent: 0, totalQty: 0 };
                        costs[cid].totalSpent += Number(tx.total_price || 0);
                        costs[cid].totalQty += tx.quantity || 0;
                    }
                    const avgMap = {};
                    for (const [cid, v] of Object.entries(costs)) {
                        if (v.totalQty > 0) avgMap[cid] = Math.round(v.totalSpent / v.totalQty);
                    }
                    setAvgCosts(avgMap);

                    const portComms = portData?.commodities || [];
                    const mktSummary = marketRes.data.data?.market_summary || [];
                    const trades = [];
                    for (const pc of portComms) {
                        const mkt = mktSummary.find(m => m.commodity_id === pc.commodity_id);
                        if (!mkt || !mkt.avg_sell_price || !pc.buy_price) continue;
                        const profit = mkt.avg_sell_price - pc.buy_price;
                        if (profit > 0) {
                            trades.push({ name: pc.name, buyHere: pc.buy_price, avgSellElsewhere: mkt.avg_sell_price, profit });
                        }
                    }
                    trades.sort((a, b) => b.profit - a.profit);
                    setBestTrades(trades.slice(0, 5));
                } catch { /* non-critical */ }

            } catch (err) {
                console.error("Failed to load trading data", err);
                setError(err.message || "Failed to load market data.");
            } finally {
                setLoading(false);
            }
        };

        fetchData();
    }, []);

    const getOwnedQuantity = (commodityId) => {
        // Cargo items from API are flattened: { commodity_id, name, quantity, ... }
        const item = cargo.find(c => c.commodity_id === commodityId);
        return item ? item.quantity : 0;
    };

    const handleQuantityChange = (id, val) => {
        const safeVal = Math.max(0, parseInt(val) || 0);
        setTradeQuantities({ ...tradeQuantities, [id]: safeVal });
    };

    const executeTrade = async (action, commodity) => {
        const qty = tradeQuantities[commodity.commodity_id] || 0;
        if (qty <= 0) return;

        try {
            setTradeLoading(true);
            if (action === 'buy') {
                await trade.buy(currentShip.ship_id, currentPort.port_id, commodity.commodity_id, qty);
                setUserCredits(prev => prev - (commodity.buy_price * qty));
                notify.success(`Bought ${qty} ${commodity.name} for ${(commodity.buy_price * qty).toLocaleString()} cr`);
                sfx('trade');
            } else {
                await trade.sell(currentShip.ship_id, currentPort.port_id, commodity.commodity_id, qty);
                setUserCredits(prev => prev + (commodity.sell_price * qty));
                notify.success(`Sold ${qty} ${commodity.name} for ${(commodity.sell_price * qty).toLocaleString()} cr`);
                sfx('trade');
            }

            // Refresh Data to ensure consistency
            // In a real optimized app, we'd manually update state, but fetching is safer
            const [shipRes, portRes, cargoRes] = await Promise.all([
                ships.getById(currentShip.ship_id),
                ports.getById(currentPort.port_id),
                trade.getCargo(currentShip.ship_id)
            ]);

            setCurrentShip({
              ...shipRes.data.data.ship,
              cargo_used: cargoRes.data.data?.used_capacity || 0
            });
            const portData = portRes.data.data?.port;
            setCurrentPort(portData);
            setCommodities(portData?.commodities || []);
            setCargo(cargoRes.data.data?.items || []);
            setTradeQuantities({ ...tradeQuantities, [commodity.commodity_id]: 0 });

            // Refresh avg costs for profit indicators
            try {
                const historyRes = await trade.getHistory({ type: 'BUY', limit: 100 });
                const txns = historyRes.data.data?.transactions || [];
                const costs = {};
                for (const tx of txns) {
                    const cid = tx.commodity_id;
                    if (!costs[cid]) costs[cid] = { totalSpent: 0, totalQty: 0 };
                    costs[cid].totalSpent += Number(tx.total_price || 0);
                    costs[cid].totalQty += tx.quantity || 0;
                }
                const avgMap = {};
                for (const [cid, v] of Object.entries(costs)) {
                    if (v.totalQty > 0) avgMap[cid] = Math.round(v.totalSpent / v.totalQty);
                }
                setAvgCosts(avgMap);
            } catch { /* non-critical */ }

        } catch (err) {
            console.error("Trade failed", err);
            notify.error(err.response?.data?.error || "Transaction declined by port authority.");
        } finally {
            setTradeLoading(false);
        }
    };

    const handleRefuel = async () => {
        const amt = parseInt(refuelAmount) || 0;
        if (amt <= 0 || !currentShip || !currentPort) return;
        try {
            setRefuelLoading(true);
            await trade.refuel(currentShip.ship_id, currentPort.port_id, amt);
            // Refresh ship data
            const shipRes = await ships.getById(currentShip.ship_id);
            setCurrentShip(prev => ({ ...shipRes.data.data.ship, cargo_used: prev.cargo_used }));
            const profileRes = await auth.getProfile();
            if (profileRes.data?.data) setUserCredits(profileRes.data.data.credits);
            setRefuelAmount('');
            notify.success(`Refueled ${amt} units successfully.`);
        } catch (err) {
            notify.error(err.response?.data?.error || "Refuel failed.");
        } finally {
            setRefuelLoading(false);
        }
    };

    const { nearestPort, loading: nearestPortLoading } = useNearestPort(noPortSectorId, false);
    const [jumpingToPort, setJumpingToPort] = useState(false);

    const handleJumpToNearestPort = async () => {
        if (!nearestPort || !currentShip || jumpingToPort) return;
        setJumpingToPort(true);
        try {
            await ships.move(currentShip.ship_id, nearestPort.sector_id);
            window.location.reload();
        } catch {
            navigate('/map');
        } finally {
            setJumpingToPort(false);
        }
    };

    const [autoRefuel, setAutoRefuel] = useState(() => localStorage.getItem('sw3k_auto_refuel') === 'true');

    // Auto-refuel on load when at port
    useEffect(() => {
        if (!autoRefuel || !currentShip || !currentPort) return;
        if (currentShip.fuel >= currentShip.max_fuel) return;
        const needed = currentShip.max_fuel - currentShip.fuel;
        if (needed <= 0) return;
        trade.refuel(currentShip.ship_id, currentPort.port_id, needed)
            .then(async () => {
                const shipRes = await ships.getById(currentShip.ship_id);
                setCurrentShip(prev => ({ ...shipRes.data.data.ship, cargo_used: prev.cargo_used }));
                const profileRes = await auth.getProfile();
                if (profileRes.data?.data) setUserCredits(profileRes.data.data.credits);
                notify.success(`Auto-refueled ${needed} units`);
            })
            .catch((err) => {
                const msg = err.response?.data?.error || err.response?.data?.message;
                if (msg) notify.warning(`Auto-refuel skipped: ${msg}`);
            });
    }, [autoRefuel, currentShip?.ship_id, currentPort?.port_id]);

    if (loading) return <LoadingScreen variant="trading" />;

    if (error) {
        return (
            <div className="p-12 flex flex-col items-center justify-center text-center space-y-4">
                <div className="w-16 h-16 bg-space-800 rounded-full flex items-center justify-center text-gray-500">
                    <Anchor className="w-8 h-8" />
                </div>
                <h2 className="text-xl text-white font-bold">Trading Unavailable</h2>
                <p className="text-gray-400 max-w-md">{error}</p>
                {nearestPort && (
                    <div className="flex items-center gap-2 px-4 py-2 rounded-lg bg-accent-cyan/5 border border-accent-cyan/20 text-sm">
                        <Zap className="w-4 h-4 text-accent-cyan shrink-0" />
                        <span className="text-gray-300">
                            Nearest port: <span className="text-white font-medium">{nearestPort.name}</span> (1 jump)
                        </span>
                        <button
                            onClick={handleJumpToNearestPort}
                            disabled={jumpingToPort}
                            className="btn btn-primary text-xs px-3 py-1 ml-2 disabled:opacity-50"
                        >
                            {jumpingToPort ? 'Jumping...' : 'Jump to Port'}
                        </button>
                    </div>
                )}
                <div className="flex gap-3 mt-4">
                    <button onClick={() => navigate('/map')} className="btn btn-primary">
                        Open Sector Map
                    </button>
                    <button onClick={() => navigate('/system')} className="btn btn-secondary">
                        System View
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="max-w-6xl mx-auto space-y-6">
            {/* Notifications via global toast system */}
            <header className="flex justify-between items-end mb-6">
                <div>
                    <h1 className="text-3xl font-bold text-white flex items-center gap-3">
                        <ShoppingCart className="w-8 h-8 text-accent-cyan" />
                        Marketplace
                    </h1>
                    <p className="text-gray-400 mt-1 flex items-center gap-2">
                        <Anchor className="w-4 h-4" /> Port: <span className="text-white">{currentPort.name}</span>
                        <span className="mx-2 text-space-600">|</span>
                        {currentPort.type.replace('_', ' ')}
                        <span className="mx-2 text-space-600">|</span>
                        <WikiLink term="trading" className="text-[11px]">Guide</WikiLink>
                        {cargo.length > 0 && (
                            <>
                                <span className="mx-2 text-space-600">|</span>
                                <button
                                    onClick={async () => {
                                        if (!confirm(`Sell all ${cargo.length} cargo types at this port?`)) return;
                                        setTradeLoading(true);
                                        let sold = 0;
                                        for (const item of cargo) {
                                            try {
                                                await trade.sell(currentShip.ship_id, currentPort.port_id, item.commodity_id, item.quantity);
                                                sold++;
                                            } catch { /* some may not be sellable here */ }
                                        }
                                        const [shipRes, portRes, cargoRes, profileRes] = await Promise.all([
                                            ships.getById(currentShip.ship_id),
                                            ports.getById(currentPort.port_id),
                                            trade.getCargo(currentShip.ship_id),
                                            auth.getProfile(),
                                        ]);
                                        setCurrentShip({ ...shipRes.data.data.ship, cargo_used: cargoRes.data.data?.used_capacity || 0 });
                                        const portData = portRes.data.data?.port;
                                        setCurrentPort(portData);
                                        setCommodities(portData?.commodities || []);
                                        setCargo(cargoRes.data.data?.items || []);
                                        if (profileRes.data?.data) setUserCredits(profileRes.data.data.credits);
                                        setTradeLoading(false);
                                        if (sold === 0) {
                                            notify.warning('No cargo could be sold at this port');
                                        } else {
                                            notify.success(`Sold ${sold} cargo type${sold !== 1 ? 's' : ''}`);
                                            sfx('trade');
                                        }
                                    }}
                                    disabled={tradeLoading}
                                    className="text-xs text-accent-orange hover:text-white transition-colors underline disabled:opacity-50"
                                >
                                    Sell All Cargo
                                </button>
                            </>
                        )}
                    </p>
                </div>
                <div className="flex gap-4">
                    <div className="card px-4 py-2 flex items-center gap-3">
                        <div className="text-xs text-gray-400 uppercase tracking-wider">Credits</div>
                        <div className="text-xl font-bold text-accent-orange flex items-center">
                            <DollarSign className="w-5 h-5 mr-1" />
                            {userCredits.toLocaleString()}
                        </div>
                    </div>
                    <div className="card px-4 py-2 flex items-center gap-3">
                        <div className="text-xs text-gray-400 uppercase tracking-wider">Cargo Space</div>
                        <div className={`text-xl font-bold flex items-center ${currentShip.cargo_used >= currentShip.cargo_capacity ? 'text-accent-red' : 'text-white'}`}>
                            <Package className="w-5 h-5 mr-1" />
                            {currentShip.cargo_used} / {currentShip.cargo_capacity}
                        </div>
                    </div>
                </div>
            </header>

            {/* Best Trades Panel */}
            {bestTrades.length > 0 && (
                <div className="card p-4">
                    <h2 className="text-sm font-display text-neon-cyan flex items-center gap-2 mb-3">
                        <Star className="w-4 h-4" /> Best Trade Opportunities
                    </h2>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                        {bestTrades.map(t => (
                            <div key={t.name} className="flex items-center justify-between p-2.5 rounded-lg"
                                style={{ background: 'rgba(76, 175, 80, 0.06)', border: '1px solid rgba(76, 175, 80, 0.15)' }}>
                                <div>
                                    <p className="text-sm text-white font-medium">{t.name}</p>
                                    <p className="text-[10px] text-gray-500">Buy here: {t.buyHere.toLocaleString()} cr</p>
                                </div>
                                <div className="text-right">
                                    <p className="text-sm text-green-400 font-mono">+{t.profit.toLocaleString()} cr</p>
                                    <p className="text-[10px] text-gray-500">avg sell: {t.avgSellElsewhere.toLocaleString()}</p>
                                </div>
                            </div>
                        ))}
                    </div>
                    <p className="text-[10px] text-gray-600 mt-2">Based on average sell prices across all known ports</p>
                </div>
            )}

            <div className="card overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left">
                        <thead className="bg-space-800 text-gray-400 text-xs uppercase font-bold tracking-wider">
                            <tr>
                                <th className="p-4">Commodity</th>
                                <th className="p-4 text-right">Vol</th>
                                <th className="p-4 text-right">Market Supply</th>
                                <th className="p-4 text-right text-accent-green">Buy Price</th>
                                <th className="p-4 text-right text-accent-orange">Sell Price</th>
                                <th className="p-4 text-right">In Cargo</th>
                                <th className="p-4 text-right">Profit/Loss</th>
                                <th className="p-4 text-center">Trade Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-space-700">
                            {commodities.map(commodity => {
                                const qty = tradeQuantities[commodity.commodity_id] || '';
                                const owned = getOwnedQuantity(commodity.commodity_id);
                                const vol = commodity.volume || 1;
                                const canBuy = userCredits >= commodity.buy_price * (parseInt(qty) || 0) &&
                                    (currentShip.cargo_capacity - currentShip.cargo_used) >= (parseInt(qty) || 0) * vol;
                                const canSell = owned >= (parseInt(qty) || 0);

                                return (
                                    <tr key={commodity.commodity_id} className="hover:bg-space-700/50 transition-colors">
                                        <td className="p-4">
                                            <div className="font-bold text-white">{commodity.name}</div>
                                            <div className="text-xs text-gray-500">{commodity.category}</div>
                                        </td>
                                        <td className="p-4 text-right font-mono text-gray-400 text-xs" title={`${vol} cargo unit${vol > 1 ? 's' : ''} per item`}>
                                            {vol > 1 ? <span className="flex items-center justify-end gap-1"><Boxes className="w-3 h-3" />{vol}</span> : <span className="text-gray-600">1</span>}
                                        </td>
                                        <td className="p-4 text-right font-mono text-gray-300">
                                            {commodity.quantity.toLocaleString()}
                                        </td>
                                        <td className="p-4 text-right font-mono text-accent-green">
                                            {commodity.buy_price.toLocaleString()} Cr
                                        </td>
                                        <td className="p-4 text-right font-mono text-accent-orange">
                                            {commodity.sell_price.toLocaleString()} Cr
                                        </td>
                                        <td className="p-4 text-right font-mono text-white">
                                            {owned}
                                        </td>
                                        <td className="p-4 text-right font-mono text-sm">
                                            {owned > 0 && avgCosts[commodity.commodity_id] ? (() => {
                                                const avg = avgCosts[commodity.commodity_id];
                                                const diff = commodity.sell_price - avg;
                                                const pct = avg > 0 ? ((diff / avg) * 100).toFixed(0) : 0;
                                                return (
                                                    <div>
                                                        <span className={diff >= 0 ? 'text-green-400' : 'text-red-400'}>
                                                            {diff >= 0 ? '+' : ''}{diff.toLocaleString()} cr
                                                        </span>
                                                        <div className="text-[10px] text-gray-500">
                                                            avg cost: {avg.toLocaleString()} ({pct >= 0 ? '+' : ''}{pct}%)
                                                        </div>
                                                    </div>
                                                );
                                            })() : (
                                                <span className="text-gray-600">—</span>
                                            )}
                                        </td>
                                        <td className="p-4">
                                            <div className="flex items-center justify-center gap-2">
                                                <input
                                                    type="number"
                                                    placeholder="0"
                                                    value={qty}
                                                    onChange={(e) => handleQuantityChange(commodity.commodity_id, e.target.value)}
                                                    className="w-20 bg-space-900 border border-space-600 rounded px-2 py-1 text-white text-right focus:border-accent-cyan outline-none"
                                                    min="0"
                                                />
                                                <div className="flex flex-col gap-1">
                                                    <button
                                                        onClick={() => {
                                                            const space = Math.floor((currentShip.cargo_capacity - currentShip.cargo_used) / vol);
                                                            const affordable = Math.floor(userCredits / commodity.buy_price);
                                                            const maxBuy = Math.min(space, affordable, commodity.quantity);
                                                            handleQuantityChange(commodity.commodity_id, maxBuy);
                                                        }}
                                                        className="px-2 py-1 bg-space-700 hover:bg-space-600 text-[10px] text-accent-green rounded"
                                                        title="Set max buy quantity"
                                                    >
                                                        Buy Max
                                                    </button>
                                                    {owned > 0 && (
                                                        <button
                                                            onClick={() => handleQuantityChange(commodity.commodity_id, owned)}
                                                            className="px-2 py-1 bg-space-700 hover:bg-space-600 text-[10px] text-accent-orange rounded"
                                                            title="Set quantity to sell all owned"
                                                        >
                                                            Sell All
                                                        </button>
                                                    )}
                                                </div>
                                                <div className="flex flex-col gap-1">
                                                    <button
                                                        onClick={() => executeTrade('buy', commodity)}
                                                        disabled={tradeLoading || !qty || parseInt(qty) <= 0 || !canBuy}
                                                        className="btn btn-success text-xs py-1 px-2 flex items-center justify-center gap-1 w-20 disabled:opacity-50 disabled:cursor-not-allowed"
                                                        title={!canBuy ? "Insufficient funds or cargo space" : "Buy from port"}
                                                    >
                                                        <TrendingDown className="w-3 h-3" /> Buy
                                                    </button>
                                                    <button
                                                        onClick={() => executeTrade('sell', commodity)}
                                                        disabled={tradeLoading || !qty || parseInt(qty) <= 0 || !canSell}
                                                        className="btn btn-secondary text-xs py-1 px-2 flex items-center justify-center gap-1 w-20 disabled:opacity-50 disabled:cursor-not-allowed hover:text-accent-orange"
                                                        title={!canSell ? "Insufficient cargo" : "Sell to port"}
                                                    >
                                                        <TrendingUp className="w-3 h-3" /> Sell
                                                    </button>
                                                </div>
                                            </div>
                                            {qty > 0 && (
                                                <div className="text-[10px] text-center mt-1 text-gray-500">
                                                    Total: <span className="text-gray-300">{(commodity.buy_price * qty).toLocaleString()}</span>
                                                </div>
                                            )}
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Refuel Section */}
            {currentShip && currentPort && (
                <div className="card p-6">
                    <div className="flex items-center justify-between mb-4">
                        <h2 className="text-lg font-bold text-white flex items-center gap-2">
                            <Fuel className="w-5 h-5 text-accent-orange" /> Refuel Station
                        </h2>
                        <label className="flex items-center gap-2 text-xs text-gray-400 cursor-pointer select-none">
                            <input
                                type="checkbox"
                                checked={autoRefuel}
                                onChange={(e) => {
                                    const next = e.target.checked;
                                    setAutoRefuel(next);
                                    localStorage.setItem('sw3k_auto_refuel', String(next));
                                }}
                                className="accent-accent-orange"
                            />
                            Auto-refuel on dock
                        </label>
                    </div>
                    <div className="space-y-3">
                        <div className="flex justify-between text-sm">
                            <span className="text-gray-400">Current Fuel</span>
                            <span className="text-white font-mono">{currentShip.fuel} / {currentShip.max_fuel}</span>
                        </div>
                        <div className="w-full bg-space-900 h-3 rounded-full overflow-hidden">
                            <div
                                className="h-full bg-accent-orange rounded-full transition-all"
                                style={{ width: `${currentShip.max_fuel > 0 ? (currentShip.fuel / currentShip.max_fuel) * 100 : 0}%` }}
                            />
                        </div>
                        {currentShip.fuel < currentShip.max_fuel ? (
                            <div className="flex items-center gap-3 mt-2">
                                <input
                                    type="number"
                                    placeholder="Amount"
                                    value={refuelAmount}
                                    onChange={(e) => setRefuelAmount(e.target.value === '' ? '' : Math.max(0, parseInt(e.target.value) || 0))}
                                    className="w-28 bg-space-900 border border-space-600 rounded px-2 py-1 text-white text-right focus:border-accent-orange outline-none"
                                    min="0"
                                    max={currentShip.max_fuel - currentShip.fuel}
                                />
                                <button
                                    onClick={() => setRefuelAmount(currentShip.max_fuel - currentShip.fuel)}
                                    className="px-2 py-1 bg-space-700 hover:bg-space-600 text-xs text-accent-orange rounded"
                                >
                                    Max
                                </button>
                                <button
                                    onClick={handleRefuel}
                                    disabled={refuelLoading || !refuelAmount || parseInt(refuelAmount) <= 0}
                                    className="btn btn-primary text-sm px-4 py-1 flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    <Fuel className="w-4 h-4" /> {refuelLoading ? 'Refueling...' : 'Refuel'}
                                </button>
                            </div>
                        ) : (
                            <div className="text-accent-green text-sm">Fuel tanks are full.</div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};

export default TradingPage;
