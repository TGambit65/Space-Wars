import { useState, useEffect, useCallback, useRef } from 'react';
import { market, ships as shipsApi, trade } from '../../services/api';
import { BarChart3, TrendingUp, TrendingDown, Minus, Navigation, ArrowRight } from 'lucide-react';
import WikiLink from '../common/WikiLink';

function MarketPage({ user }) {
  const [overview, setOverview] = useState(null);
  const [commodities, setCommodities] = useState([]);
  const [selectedCommodity, setSelectedCommodity] = useState(null);
  const [history, setHistory] = useState([]);
  const [trends, setTrends] = useState([]);
  const [currentPortId, setCurrentPortId] = useState(null);
  const [tradeRoutes, setTradeRoutes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const chartRef = useRef(null);
  const chartContainerRef = useRef(null);

  const fetchData = useCallback(async () => {
    try {
      const [shipsRes, comRes] = await Promise.all([
        shipsApi.getAll(),
        trade.getCommodities().catch(() => ({ data: [] })),
      ]);
      const shipList = shipsRes.data.data?.ships || shipsRes.data || [];
      const comRaw = comRes.data.data;
      const comms = Array.isArray(comRaw) ? comRaw : comRaw?.commodities || [];
      setCommodities(comms);

      const activeId = shipsRes.data.data?.active_ship_id;
      const activeShip = (activeId && shipList.find(s => s.ship_id === activeId)) || shipList[0];
      if (activeShip?.currentSector?.ports?.length > 0) {
        const portId = activeShip.currentSector.ports[0].port_id;
        setCurrentPortId(portId);
        try {
          const ovRes = await market.getOverview(portId);
          setOverview(ovRes.data.data || ovRes.data);
        } catch { setOverview(null); }
      }

      // Compute trade routes from market summary
      try {
        const summaryRes = await trade.getMarketSummary();
        const summary = summaryRes.data.data?.market_summary || [];
        const routes = [];
        for (const c of summary) {
          if (c.best_buy && c.best_sell && c.best_sell.price > c.best_buy.price) {
            routes.push({
              commodity: c.name,
              commodity_id: c.commodity_id,
              buyPort: c.best_buy.port_name,
              buyPrice: c.best_buy.price,
              buySectorId: c.best_buy.sector_id,
              sellPort: c.best_sell.port_name,
              sellPrice: c.best_sell.price,
              sellSectorId: c.best_sell.sector_id,
              profit: c.best_sell.price - c.best_buy.price,
              margin: c.best_buy.price > 0 ? Math.round(((c.best_sell.price - c.best_buy.price) / c.best_buy.price) * 100) : 0,
            });
          }
        }
        routes.sort((a, b) => b.profit - a.profit);
        setTradeRoutes(routes.slice(0, 10));
      } catch { /* non-critical */ }
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load market data');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleSelectCommodity = async (commodityId) => {
    setSelectedCommodity(commodityId);
    try {
      const [histRes, trendRes] = await Promise.all([
        currentPortId ? market.getHistory(currentPortId, commodityId).catch(() => ({ data: [] })) : Promise.resolve({ data: [] }),
        market.getTrends(commodityId).catch(() => ({ data: [] })),
      ]);
      const histRaw = histRes.data.data;
      setHistory(Array.isArray(histRaw) ? histRaw : histRaw?.history || []);
      const trendRaw = trendRes.data.data;
      setTrends(Array.isArray(trendRaw) ? trendRaw : trendRaw?.trends || []);
    } catch { /* ignore */ }
  };

  useEffect(() => {
    if (!chartRef.current || history.length === 0) return;
    drawChart(chartRef.current, history);
  }, [history]);

  // Redraw chart on resize
  useEffect(() => {
    if (!chartContainerRef.current || history.length === 0) return;
    const observer = new ResizeObserver(() => {
      if (chartRef.current) drawChart(chartRef.current, history);
    });
    observer.observe(chartContainerRef.current);
    return () => observer.disconnect();
  }, [history]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-neon-cyan"></div>
      </div>
    );
  }

  const overviewItems = overview?.commodities || overview?.items || (Array.isArray(overview) ? overview : []);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Market Data</h1>
        <p className="text-gray-500 text-sm mt-1">Prices, trends, and trade intelligence <WikiLink term="trading" className="text-[11px] ml-2">Guide</WikiLink></p>
      </div>

      {error && (
        <div className="p-3 rounded-lg text-sm" style={{ background: 'rgba(244,67,54,0.1)', border: '1px solid rgba(244,67,54,0.3)', color: '#f44336' }}>
          {error}
          <button onClick={() => setError(null)} className="ml-2 underline">dismiss</button>
        </div>
      )}

      {/* Port Overview */}
      <div className="holo-panel p-4">
        <h2 className="text-lg font-display text-white mb-3">
          Port Overview
          {!currentPortId && <span className="text-xs text-gray-500 font-body ml-2">(dock at a port)</span>}
        </h2>
        {overviewItems.length === 0 ? (
          <p className="text-gray-500 text-sm text-center py-4">
            {currentPortId ? 'No market data available.' : 'Navigate to a port to view prices.'}
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="table-header">
                  <th className="text-left p-2">Commodity</th>
                  <th className="text-right p-2">Buy</th>
                  <th className="text-right p-2">Sell</th>
                  <th className="text-right p-2">Qty</th>
                  <th className="text-center p-2">Trend</th>
                  <th className="p-2"></th>
                </tr>
              </thead>
              <tbody>
                {overviewItems.map((item, i) => {
                  const commodityId = item.commodity_id || item.id;
                  const trend = item.trend || item.price_trend || 'stable';
                  return (
                    <tr key={commodityId || i} className="table-row">
                      <td className="p-2 text-white">{item.name || item.commodity_name}</td>
                      <td className="p-2 text-right text-neon-cyan font-display">{(item.buy_price || 0).toLocaleString()}</td>
                      <td className="p-2 text-right text-neon-orange font-display">{(item.sell_price || 0).toLocaleString()}</td>
                      <td className="p-2 text-right text-gray-400">{(item.quantity || 0).toLocaleString()}</td>
                      <td className="p-2 text-center">
                        <TrendIcon trend={trend} />
                      </td>
                      <td className="p-2 text-right">
                        <button onClick={() => handleSelectCommodity(commodityId)} className="text-xs text-neon-cyan hover:underline">
                          Details
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Price History Chart */}
      {selectedCommodity && (
        <div className="holo-panel p-4">
          <h2 className="text-lg font-display text-white mb-3">Price History</h2>
          <div ref={chartContainerRef} className="w-full" style={{ height: '200px' }}>
            <canvas ref={chartRef} className="w-full h-full" />
          </div>
          {history.length === 0 && <p className="text-gray-500 text-sm text-center py-4">No history data available</p>}
        </div>
      )}

      {/* Cross-port Trends */}
      {trends.length > 0 && (
        <div className="holo-panel p-4">
          <h2 className="text-lg font-display text-white mb-3">Cross-Port Comparison</h2>
          <div className="space-y-2">
            {trends.map((t, i) => (
              <div key={i} className="flex items-center justify-between p-3 rounded-lg" style={{ background: 'rgba(0,255,255,0.02)', border: '1px solid rgba(0,255,255,0.06)' }}>
                <div>
                  <p className="text-sm text-white">{t.port_name || t.name || `Port ${t.port_id}`}</p>
                  <p className="text-xs text-gray-500">{t.sector_name || ''}</p>
                </div>
                <div className="flex gap-6 text-sm">
                  <span className="text-neon-cyan font-display">Buy: {(t.buy_price || 0).toLocaleString()}</span>
                  <span className="text-neon-orange font-display">Sell: {(t.sell_price || 0).toLocaleString()}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Trade Route Planner */}
      {tradeRoutes.length > 0 && (
        <div className="holo-panel p-4">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-display text-white flex items-center gap-2">
              <Navigation className="w-5 h-5 text-neon-cyan" />
              Trade Route Planner
            </h2>
            <WikiLink term="trading" className="text-[11px]">Guide</WikiLink>
          </div>
          <p className="text-xs text-gray-500 mb-3">Best buy/sell opportunities across all known ports</p>
          <div className="space-y-2">
            {tradeRoutes.map((route, i) => (
              <div key={i} className="p-3 rounded-lg" style={{ background: 'rgba(76,175,80,0.04)', border: '1px solid rgba(76,175,80,0.12)' }}>
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-sm text-white font-medium">{route.commodity}</span>
                  <span className="text-sm text-green-400 font-mono font-bold">+{route.profit.toLocaleString()} cr/unit</span>
                </div>
                <div className="flex items-center gap-2 text-xs">
                  <div className="flex items-center gap-1">
                    <span className="text-neon-cyan">Buy</span>
                    <span className="text-gray-300">{route.buyPort}</span>
                    <span className="text-gray-500 font-mono">@ {route.buyPrice.toLocaleString()}</span>
                  </div>
                  <ArrowRight className="w-3 h-3 text-gray-600 shrink-0" />
                  <div className="flex items-center gap-1">
                    <span className="text-neon-orange">Sell</span>
                    <span className="text-gray-300">{route.sellPort}</span>
                    <span className="text-gray-500 font-mono">@ {route.sellPrice.toLocaleString()}</span>
                  </div>
                  <span className="ml-auto text-green-400/70 text-[10px] font-mono">+{route.margin}%</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function TrendIcon({ trend }) {
  if (trend === 'up' || trend === 'rising') return <TrendingUp className="w-4 h-4 text-status-success inline" />;
  if (trend === 'down' || trend === 'falling') return <TrendingDown className="w-4 h-4 text-status-danger inline" />;
  return <Minus className="w-4 h-4 text-gray-500 inline" />;
}

function drawChart(canvas, data) {
  const ctx = canvas.getContext('2d');
  const dpr = window.devicePixelRatio || 1;
  const rect = canvas.getBoundingClientRect();
  canvas.width = rect.width * dpr;
  canvas.height = rect.height * dpr;
  ctx.scale(dpr, dpr);
  const w = rect.width;
  const h = rect.height;
  ctx.clearRect(0, 0, w, h);

  if (data.length < 2) return;

  const prices = data.map(d => d.price || d.buy_price || 0);
  const min = Math.min(...prices) * 0.95;
  const max = Math.max(...prices) * 1.05;
  const range = max - min || 1;

  // Background grid
  ctx.strokeStyle = 'rgba(0, 255, 255, 0.06)';
  ctx.lineWidth = 1;
  for (let i = 0; i < 5; i++) {
    const y = (h / 5) * i;
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(w, y);
    ctx.stroke();
  }

  // Line
  ctx.beginPath();
  ctx.strokeStyle = '#00ffff';
  ctx.lineWidth = 2;
  data.forEach((d, i) => {
    const x = (i / (data.length - 1)) * w;
    const y = h - ((prices[i] - min) / range) * h;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  });
  ctx.stroke();

  // Glow line
  ctx.beginPath();
  ctx.strokeStyle = 'rgba(0, 255, 255, 0.2)';
  ctx.lineWidth = 6;
  data.forEach((d, i) => {
    const x = (i / (data.length - 1)) * w;
    const y = h - ((prices[i] - min) / range) * h;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  });
  ctx.stroke();

  // Fill
  ctx.beginPath();
  data.forEach((d, i) => {
    const x = (i / (data.length - 1)) * w;
    const y = h - ((prices[i] - min) / range) * h;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  });
  ctx.lineTo(w, h);
  ctx.lineTo(0, h);
  ctx.closePath();
  const grad = ctx.createLinearGradient(0, 0, 0, h);
  grad.addColorStop(0, 'rgba(0, 255, 255, 0.15)');
  grad.addColorStop(1, 'rgba(0, 255, 255, 0)');
  ctx.fillStyle = grad;
  ctx.fill();
}

export default MarketPage;
