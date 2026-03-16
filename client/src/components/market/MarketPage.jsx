import { useState, useEffect, useCallback, useRef } from 'react';
import { market, ships as shipsApi, trade } from '../../services/api';
import { BarChart3, TrendingUp, TrendingDown, Minus } from 'lucide-react';

function MarketPage({ user }) {
  const [overview, setOverview] = useState(null);
  const [commodities, setCommodities] = useState([]);
  const [selectedCommodity, setSelectedCommodity] = useState(null);
  const [history, setHistory] = useState([]);
  const [trends, setTrends] = useState([]);
  const [currentPortId, setCurrentPortId] = useState(null);
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
        <p className="text-gray-500 text-sm mt-1">Prices, trends, and trade intelligence</p>
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
