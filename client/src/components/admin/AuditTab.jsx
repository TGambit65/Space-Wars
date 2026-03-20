import { useState, useEffect } from 'react';
import { admin } from '../../services/api';
import { Shield, ChevronLeft, ChevronRight, ChevronDown, ChevronUp } from 'lucide-react';

const STATUS_OPTIONS = ['', 'allow', 'deny', 'throttle', 'error'];
const STATUS_COLORS = {
  allow: 'text-green-400',
  deny: 'text-accent-red',
  throttle: 'text-accent-orange',
  error: 'text-gray-400'
};

const AuditTab = () => {
  const [logs, setLogs] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState(null);

  // Filters
  const [statusFilter, setStatusFilter] = useState('');
  const [actionTypeFilter, setActionTypeFilter] = useState('');
  const [scopeTypeFilter, setScopeTypeFilter] = useState('');
  const [userIdFilter, setUserIdFilter] = useState('');

  // Expanded rows
  const [expandedRow, setExpandedRow] = useState(null);

  useEffect(() => { fetchSummary(); }, []);
  useEffect(() => { fetchLogs(); }, [page, statusFilter, actionTypeFilter, scopeTypeFilter]);

  const fetchSummary = async () => {
    try {
      const res = await admin.getAuditSummary();
      setSummary(res.data.data);
    } catch (err) {
      // silent
    }
  };

  const fetchLogs = async () => {
    try {
      setLoading(true);
      const params = { page, limit: 50 };
      if (statusFilter) params.status = statusFilter;
      if (actionTypeFilter) params.action_type = actionTypeFilter;
      if (scopeTypeFilter) params.scope_type = scopeTypeFilter;
      if (userIdFilter) params.user_id = userIdFilter;

      const res = await admin.getAuditLogs(params);
      const data = res.data.data;
      setLogs(data.logs);
      setTotal(data.total);
      setPages(data.pages);
    } catch (err) {
      console.error('Failed to load audit logs:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = () => {
    setPage(1);
    fetchLogs();
  };

  return (
    <div className="space-y-4">
      {/* Summary Boxes */}
      {summary && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="card p-3 text-center">
            <div className="text-2xl font-bold text-white">{summary.total}</div>
            <div className="text-xs text-gray-400">Total (24h)</div>
          </div>
          <div className="card p-3 text-center">
            <div className="text-2xl font-bold text-accent-red">{summary.denials}</div>
            <div className="text-xs text-gray-400">Denials (24h)</div>
          </div>
          <div className="card p-3 text-center">
            <div className="text-2xl font-bold text-accent-orange">{summary.throttles}</div>
            <div className="text-xs text-gray-400">Throttles (24h)</div>
          </div>
          <div className="card p-3 text-center">
            <div className="text-2xl font-bold text-gray-400">{summary.errors}</div>
            <div className="text-xs text-gray-400">Errors (24h)</div>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="card p-4">
        <div className="flex gap-3 flex-wrap items-end">
          <div>
            <label className="block text-xs text-gray-400 mb-1">Status</label>
            <select value={statusFilter} onChange={e => { setStatusFilter(e.target.value); setPage(1); }}
              className="input text-sm">
              <option value="">All</option>
              {STATUS_OPTIONS.filter(Boolean).map(s => (
                <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs text-gray-400 mb-1">Action Type</label>
            <input type="text" value={actionTypeFilter} onChange={e => setActionTypeFilter(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleSearch()}
              className="input text-sm" placeholder="e.g. trade_buy" />
          </div>
          <div>
            <label className="block text-xs text-gray-400 mb-1">Scope Type</label>
            <input type="text" value={scopeTypeFilter} onChange={e => setScopeTypeFilter(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleSearch()}
              className="input text-sm" placeholder="e.g. port" />
          </div>
          <div>
            <label className="block text-xs text-gray-400 mb-1">User ID</label>
            <input type="text" value={userIdFilter} onChange={e => setUserIdFilter(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleSearch()}
              className="input text-sm" placeholder="UUID" />
          </div>
          <button onClick={handleSearch} className="btn btn-secondary text-sm">
            Filter
          </button>
        </div>
      </div>

      {/* Audit Log Table */}
      <div className="card p-4">
        <h3 className="card-header flex items-center gap-2">
          <Shield className="w-4 h-4" /> Audit Log
        </h3>
        {loading ? (
          <div className="p-8 text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-accent-cyan mx-auto mb-2"></div>
            <div className="text-gray-400 text-sm">Loading logs...</div>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto mt-3">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-space-700 text-left">
                    <th className="py-1 px-2 text-gray-500 w-6"></th>
                    <th className="py-1 px-2 text-gray-500">Time</th>
                    <th className="py-1 px-2 text-gray-500">User</th>
                    <th className="py-1 px-2 text-gray-500">Action</th>
                    <th className="py-1 px-2 text-gray-500">Scope</th>
                    <th className="py-1 px-2 text-gray-500">Status</th>
                    <th className="py-1 px-2 text-gray-500">IP</th>
                    <th className="py-1 px-2 text-gray-500">Reason</th>
                  </tr>
                </thead>
                <tbody>
                  {logs.map(log => {
                    const id = log.action_audit_log_id;
                    const isExpanded = expandedRow === id;
                    return (
                      <>
                        <tr key={id} className="border-b border-space-800 hover:bg-space-700/50 cursor-pointer"
                          onClick={() => setExpandedRow(isExpanded ? null : id)}>
                          <td className="py-1 px-2 text-gray-500">
                            {isExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                          </td>
                          <td className="py-1 px-2 text-gray-500 whitespace-nowrap">
                            {new Date(log.created_at).toLocaleString()}
                          </td>
                          <td className="py-1 px-2 text-gray-300 font-mono">
                            {log.user_id ? log.user_id.slice(0, 8) + '...' : '-'}
                          </td>
                          <td className="py-1 px-2 text-gray-300">{log.action_type}</td>
                          <td className="py-1 px-2 text-gray-400">
                            {log.scope_type}{log.scope_id ? `:${log.scope_id.slice(0, 8)}` : ''}
                          </td>
                          <td className="py-1 px-2">
                            <span className={STATUS_COLORS[log.status] || 'text-gray-400'}>{log.status}</span>
                          </td>
                          <td className="py-1 px-2 text-gray-500">{log.ip_address || '-'}</td>
                          <td className="py-1 px-2 text-gray-500 truncate max-w-[200px]">{log.reason || '-'}</td>
                        </tr>
                        {isExpanded && (
                          <tr key={`${id}-detail`} className="border-b border-space-800">
                            <td colSpan={8} className="py-2 px-4">
                              <div className="bg-space-800 rounded p-3 text-xs">
                                <div className="text-gray-400 mb-1 font-bold">Metadata</div>
                                <pre className="text-gray-300 overflow-x-auto whitespace-pre-wrap">
                                  {log.metadata ? JSON.stringify(log.metadata, null, 2) : 'No metadata'}
                                </pre>
                                {log.user_id && (
                                  <div className="mt-2 text-gray-400">
                                    <span className="font-bold">Full User ID:</span> {log.user_id}
                                  </div>
                                )}
                                {log.scope_id && (
                                  <div className="text-gray-400">
                                    <span className="font-bold">Full Scope ID:</span> {log.scope_id}
                                  </div>
                                )}
                              </div>
                            </td>
                          </tr>
                        )}
                      </>
                    );
                  })}
                  {logs.length === 0 && (
                    <tr><td colSpan={8} className="py-6 text-center text-gray-500">No audit logs found</td></tr>
                  )}
                </tbody>
              </table>
            </div>
            {pages > 1 && (
              <div className="flex items-center justify-between mt-3">
                <span className="text-xs text-gray-500">
                  Page {page} of {pages} ({total} entries)
                </span>
                <div className="flex gap-1">
                  <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page <= 1}
                    className="btn btn-secondary text-xs px-2 py-1">
                    <ChevronLeft className="w-3 h-3" />
                  </button>
                  <button onClick={() => setPage(p => Math.min(pages, p + 1))} disabled={page >= pages}
                    className="btn btn-secondary text-xs px-2 py-1">
                    <ChevronRight className="w-3 h-3" />
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default AuditTab;
