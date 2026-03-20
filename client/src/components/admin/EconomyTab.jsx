import { useState, useEffect } from 'react';
import { admin } from '../../services/api';
import { TrendingUp, AlertTriangle, RefreshCw, ChevronLeft, ChevronRight } from 'lucide-react';

const EconomyTab = () => {
  const [overview, setOverview] = useState(null);
  const [transfers, setTransfers] = useState([]);
  const [transferTotal, setTransferTotal] = useState(0);
  const [transferPage, setTransferPage] = useState(1);
  const [transferPages, setTransferPages] = useState(1);
  const [flaggedOnly, setFlaggedOnly] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [actionLoading, setActionLoading] = useState(null);
  const [showResetConfirm, setShowResetConfirm] = useState(false);

  useEffect(() => { fetchAll(); }, []);
  useEffect(() => { fetchTransfers(); }, [transferPage, flaggedOnly]);

  const fetchAll = async () => {
    try {
      setLoading(true);
      const res = await admin.getEconomyOverview();
      setOverview(res.data.data);
    } catch (err) {
      setError('Failed to load economy data');
    } finally {
      setLoading(false);
    }
  };

  const fetchTransfers = async () => {
    try {
      const params = { page: transferPage, limit: 25 };
      if (flaggedOnly) params.flagged_only = 'true';
      const res = await admin.getTransfers(params);
      const data = res.data.data;
      setTransfers(data.transfers);
      setTransferTotal(data.total);
      setTransferPages(data.pages);
    } catch (err) {
      // silent
    }
  };

  const handleForceEconomyTick = async () => {
    setActionLoading('tick');
    setError(null);
    try {
      await admin.forceEconomyTick();
      setSuccess('Economy tick processed');
      fetchAll();
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      setError('Force tick failed');
    } finally {
      setActionLoading(null);
    }
  };

  const handleResetStocks = async () => {
    setActionLoading('reset');
    setError(null);
    try {
      const res = await admin.resetPortStocks();
      setSuccess(res.data.message);
      setShowResetConfirm(false);
      fetchAll();
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      setError('Reset stocks failed');
    } finally {
      setActionLoading(null);
    }
  };

  if (loading) {
    return (
      <div className="p-8 text-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-accent-cyan mx-auto mb-4"></div>
        <div className="text-gray-400 text-sm">Loading economy data...</div>
      </div>
    );
  }

  const stockPct = overview && overview.totalCapacity > 0
    ? Math.round(overview.totalStock / overview.totalCapacity * 100)
    : 0;

  return (
    <div className="space-y-4">
      {error && (
        <div className="bg-accent-red/10 border border-accent-red/30 rounded-lg p-3 flex items-center gap-2">
          <AlertTriangle className="w-5 h-5 text-accent-red flex-shrink-0" />
          <span className="text-accent-red text-sm">{error}</span>
          <button onClick={() => setError(null)} className="ml-auto text-accent-red hover:text-white text-xs">Dismiss</button>
        </div>
      )}
      {success && (
        <div className="bg-green-500/10 border border-green-500/30 rounded-lg p-3">
          <span className="text-green-400 text-sm">{success}</span>
        </div>
      )}

      {/* Overview Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="card p-3 text-center">
          <div className="text-2xl font-bold text-accent-cyan">{overview?.ports || 0}</div>
          <div className="text-xs text-gray-400">Active Ports</div>
        </div>
        <div className="card p-3 text-center">
          <div className="text-2xl font-bold text-accent-purple">{overview?.commodities || 0}</div>
          <div className="text-xs text-gray-400">Commodities</div>
        </div>
        <div className="card p-3 text-center">
          <div className="text-2xl font-bold text-accent-green">{overview?.recentTransfers24h || 0}</div>
          <div className="text-xs text-gray-400">Transfers (24h)</div>
        </div>
        <div className="card p-3 text-center">
          <div className="text-2xl font-bold text-accent-red">{overview?.flaggedTransfers24h || 0}</div>
          <div className="text-xs text-gray-400">Flagged (24h)</div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Stock Health */}
        <div className="card p-4">
          <h3 className="card-header flex items-center gap-2">
            <TrendingUp className="w-4 h-4" /> Market Health
          </h3>
          <div className="space-y-3 mt-4">
            <div className="flex justify-between text-sm">
              <span className="text-gray-400">Port Commodities</span>
              <span className="text-white font-mono">{overview?.portCommodities || 0}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-400">Avg Stock Level</span>
              <span className="text-white font-mono">{overview?.avgStockLevel || 0} / {overview?.avgMaxStock || 0}</span>
            </div>
            <div>
              <div className="flex justify-between text-xs text-gray-500 mb-1">
                <span>Global Stock Utilization</span>
                <span>{stockPct}%</span>
              </div>
              <div className="w-full bg-space-800 rounded-full h-2">
                <div className={`rounded-full h-2 transition-all ${
                  stockPct < 25 ? 'bg-accent-red' : stockPct < 50 ? 'bg-accent-orange' : 'bg-accent-green'
                }`} style={{ width: `${stockPct}%` }} />
              </div>
            </div>
          </div>
        </div>

        {/* Controls */}
        <div className="card p-4">
          <h3 className="card-header flex items-center gap-2">
            Economy Controls
          </h3>
          <div className="space-y-3 mt-4">
            <button onClick={handleForceEconomyTick} disabled={actionLoading}
              className="btn btn-primary w-full flex items-center justify-center gap-2 text-sm">
              {actionLoading === 'tick' ? (
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
              ) : <RefreshCw className="w-4 h-4" />}
              Force Economy Tick
            </button>

            {!showResetConfirm ? (
              <button onClick={() => setShowResetConfirm(true)} disabled={actionLoading}
                className="btn btn-danger w-full text-sm">
                Reset All Port Stocks
              </button>
            ) : (
              <div className="bg-accent-red/10 border border-accent-red/30 rounded-lg p-3">
                <p className="text-xs text-gray-400 mb-2">Reset all port commodity quantities to 50% capacity?</p>
                <div className="flex gap-2">
                  <button onClick={() => setShowResetConfirm(false)} className="btn btn-secondary flex-1 text-xs">Cancel</button>
                  <button onClick={handleResetStocks} disabled={actionLoading}
                    className="btn btn-danger flex-1 text-xs">
                    {actionLoading === 'reset' ? 'Resetting...' : 'Confirm Reset'}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Transfer Ledger */}
      <div className="card p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="card-header mb-0">Transfer Ledger</h3>
          <label className="flex items-center gap-2 text-xs text-gray-400 cursor-pointer">
            <input type="checkbox" checked={flaggedOnly} onChange={e => { setFlaggedOnly(e.target.checked); setTransferPage(1); }}
              className="rounded border-space-600" />
            Flagged only
          </label>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-space-700 text-left">
                <th className="py-1 px-2 text-gray-500">Time</th>
                <th className="py-1 px-2 text-gray-500">Type</th>
                <th className="py-1 px-2 text-gray-500">Source</th>
                <th className="py-1 px-2 text-gray-500">Destination</th>
                <th className="py-1 px-2 text-gray-500">Credits</th>
                <th className="py-1 px-2 text-gray-500">Status</th>
                <th className="py-1 px-2 text-gray-500">Flags</th>
              </tr>
            </thead>
            <tbody>
              {transfers.map(t => (
                <tr key={t.transfer_id || t.transfer_ledger_id} className="border-b border-space-800">
                  <td className="py-1 px-2 text-gray-500 whitespace-nowrap">
                    {new Date(t.created_at).toLocaleString()}
                  </td>
                  <td className="py-1 px-2 text-gray-300">{t.transfer_type}</td>
                  <td className="py-1 px-2 text-gray-400">{t.source_type}:{t.source_id?.slice(0, 8)}</td>
                  <td className="py-1 px-2 text-gray-400">{t.destination_type}:{t.destination_id?.slice(0, 8)}</td>
                  <td className="py-1 px-2 text-accent-cyan">{t.credits_amount || '-'}</td>
                  <td className="py-1 px-2">
                    <span className={`${t.status === 'completed' ? 'text-green-400' : t.status === 'denied' ? 'text-accent-red' : 'text-gray-400'}`}>
                      {t.status}
                    </span>
                  </td>
                  <td className="py-1 px-2 text-accent-orange">
                    {t.risk_flags && t.risk_flags !== '[]' && JSON.parse(typeof t.risk_flags === 'string' ? t.risk_flags : '[]').length > 0
                      ? JSON.parse(typeof t.risk_flags === 'string' ? t.risk_flags : '[]').join(', ')
                      : '-'}
                  </td>
                </tr>
              ))}
              {transfers.length === 0 && (
                <tr><td colSpan={7} className="py-6 text-center text-gray-500">No transfers found</td></tr>
              )}
            </tbody>
          </table>
        </div>
        {transferPages > 1 && (
          <div className="flex items-center justify-between mt-3">
            <span className="text-xs text-gray-500">
              Page {transferPage} of {transferPages} ({transferTotal} transfers)
            </span>
            <div className="flex gap-1">
              <button onClick={() => setTransferPage(p => Math.max(1, p - 1))} disabled={transferPage <= 1}
                className="btn btn-secondary text-xs px-2 py-1">
                <ChevronLeft className="w-3 h-3" />
              </button>
              <button onClick={() => setTransferPage(p => Math.min(transferPages, p + 1))} disabled={transferPage >= transferPages}
                className="btn btn-secondary text-xs px-2 py-1">
                <ChevronRight className="w-3 h-3" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default EconomyTab;
