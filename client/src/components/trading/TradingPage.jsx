import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { trade, ports, ships, auth } from '../../services/api';
import { ShoppingCart, Package, DollarSign, TrendingUp, TrendingDown, Anchor, AlertCircle, RefreshCw } from 'lucide-react';

const TradingPage = ({ user: initialUser }) => {
    const navigate = useNavigate();
    // We track user credits locally to update UI immediately after trades
    // In a real app, this might come from a global context
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
                const ship = shipList[0];
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
                    setError("No trading port in this sector. Travel to a sector with a Port to trade.");
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
                // Optimistic Updates
                setUserCredits(prev => prev - (commodity.buy_price * qty));
            } else {
                await trade.sell(currentShip.ship_id, currentPort.port_id, commodity.commodity_id, qty);
                // Optimistic Updates
                setUserCredits(prev => prev + (commodity.sell_price * qty));
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
            setTradeQuantities({ ...tradeQuantities, [commodity.commodity_id]: 0 }); // Reset input

        } catch (err) {
            console.error("Trade failed", err);
            alert(err.response?.data?.error || "Transaction declined by port authority.");
        } finally {
            setTradeLoading(false);
        }
    };

    if (loading) return <div className="p-8 text-center text-accent-cyan flex justify-center gap-2"><RefreshCw className="animate-spin" /> Accessing Trade Network...</div>;

    if (error) {
        return (
            <div className="p-12 flex flex-col items-center justify-center text-center space-y-4">
                <div className="w-16 h-16 bg-space-800 rounded-full flex items-center justify-center text-gray-500">
                    <Anchor className="w-8 h-8" />
                </div>
                <h2 className="text-xl text-white font-bold">Trading Unavailable</h2>
                <p className="text-gray-400 max-w-md">{error}</p>
                <button onClick={() => navigate('/map')} className="btn btn-primary mt-4">
                    Go to Starmap
                </button>
            </div>
        );
    }

    return (
        <div className="max-w-6xl mx-auto space-y-6">
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

            <div className="card overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left">
                        <thead className="bg-space-800 text-gray-400 text-xs uppercase font-bold tracking-wider">
                            <tr>
                                <th className="p-4">Commodity</th>
                                <th className="p-4 text-right">Market Supply</th>
                                <th className="p-4 text-right text-accent-green">Buy Price</th>
                                <th className="p-4 text-right text-accent-orange">Sell Price</th>
                                <th className="p-4 text-right">In Cargo</th>
                                <th className="p-4 text-center">Trade Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-space-700">
                            {commodities.map(commodity => {
                                const qty = tradeQuantities[commodity.commodity_id] || '';
                                const owned = getOwnedQuantity(commodity.commodity_id);
                                const canBuy = userCredits >= commodity.buy_price * (parseInt(qty) || 0) &&
                                    (currentShip.cargo_capacity - currentShip.cargo_used) >= (parseInt(qty) || 0); // Assuming volume 1 for simplicity unless data says otherwise
                                const canSell = owned >= (parseInt(qty) || 0);

                                return (
                                    <tr key={commodity.commodity_id} className="hover:bg-space-700/50 transition-colors">
                                        <td className="p-4">
                                            <div className="font-bold text-white">{commodity.name}</div>
                                            <div className="text-xs text-gray-500">{commodity.category}</div>
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
                                                <button
                                                    onClick={() => {
                                                        // Calculate Max
                                                        // For Buy: Min(Affordable, Space)
                                                        // For Sell: Owned
                                                        const space = currentShip.cargo_capacity - currentShip.cargo_used;
                                                        const affordable = Math.floor(userCredits / commodity.buy_price);
                                                        const maxBuy = Math.min(space, affordable);
                                                        const maxSell = owned;
                                                        // Heuristic: If we own some, max sell. If we own 0, max buy.
                                                        // Or just toggle? Let's default to max buy if 0 owned, max sell if owned > 0?
                                                        // Better: Max Buy. User can type for sell or we add 2 buttons.
                                                        // Simple approach: Max Buy capability.
                                                        handleQuantityChange(commodity.commodity_id, owned > 0 ? maxSell : maxBuy);
                                                    }}
                                                    className="px-2 py-1 bg-space-700 hover:bg-space-600 text-xs text-accent-cyan rounded"
                                                    title="Auto-Set Quantity (Max Buy / Max Sell)"
                                                >
                                                    Max
                                                </button>
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
        </div>
    );
};

export default TradingPage;
