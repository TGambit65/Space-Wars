import { useState, useEffect } from 'react';
import { admin } from '../../services/api';
import { Search, ChevronLeft, ChevronRight, X, Heart, Wrench, Navigation, Zap, DollarSign, ArrowLeft } from 'lucide-react';
import SectorPicker from '../common/SectorPicker';

const TIER_OPTIONS = ['free', 'premium', 'elite'];
const TIER_COLORS = {
  free: 'text-gray-400',
  premium: 'text-accent-cyan',
  elite: 'text-accent-purple',
};

const UsersTab = () => {
  const [users, setUsers] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [search, setSearch] = useState('');
  const [tierFilter, setTierFilter] = useState('');
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(null);
  const [searchTrigger, setSearchTrigger] = useState(0);

  // Player detail drilldown
  const [selectedUser, setSelectedUser] = useState(null);
  const [userDetail, setUserDetail] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState(null);
  const [actionResult, setActionResult] = useState(null);

  // Support action forms
  const [creditAmount, setCreditAmount] = useState('');
  const [creditReason, setCreditReason] = useState('');
  const [moveSectorId, setMoveSectorId] = useState('');

  useEffect(() => { fetchUsers(); }, [page, tierFilter, searchTrigger]);

  const fetchUsers = async () => {
    try {
      setLoading(true);
      const params = { page, limit: 25 };
      if (search) params.search = search;
      if (tierFilter) params.tier = tierFilter;
      const res = await admin.getUsers(params);
      const data = res.data.data;
      setUsers(data.users);
      setTotal(data.total);
      setPages(data.pages);
    } catch (err) {
      console.error('Failed to fetch users:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = () => {
    setPage(1);
    setSearchTrigger(t => t + 1);
  };

  const handleTierChange = async (userId, newTier) => {
    try {
      setUpdating(userId);
      await admin.updateUserTier(userId, newTier);
      setUsers(prev => prev.map(u =>
        u.user_id === userId ? { ...u, subscription_tier: newTier } : u
      ));
    } catch (err) {
      console.error('Failed to update tier:', err);
    } finally {
      setUpdating(null);
    }
  };

  const openDetail = async (userId) => {
    setSelectedUser(userId);
    setDetailLoading(true);
    setActionResult(null);
    try {
      const res = await admin.getUserDetail(userId);
      setUserDetail(res.data.data);
    } catch (err) {
      console.error('Failed to load user detail:', err);
    } finally {
      setDetailLoading(false);
    }
  };

  const closeDetail = () => {
    setSelectedUser(null);
    setUserDetail(null);
    setActionResult(null);
    setCreditAmount('');
    setCreditReason('');
    setMoveSectorId('');
  };

  const runAction = async (actionFn, label) => {
    setActionLoading(label);
    setActionResult(null);
    try {
      const res = await actionFn();
      setActionResult({ type: 'success', message: res.data.message || `${label} completed` });
      // Refresh detail
      const detailRes = await admin.getUserDetail(selectedUser);
      setUserDetail(detailRes.data.data);
    } catch (err) {
      setActionResult({ type: 'error', message: err.response?.data?.message || `${label} failed` });
    } finally {
      setActionLoading(null);
    }
  };

  // ─── Detail View ───────────────────────────────────────────
  if (selectedUser && userDetail) {
    const u = userDetail.user;
    return (
      <div className="space-y-4">
        <button onClick={closeDetail} className="btn btn-secondary text-xs flex items-center gap-1">
          <ArrowLeft className="w-3 h-3" /> Back to Users
        </button>

        {actionResult && (
          <div className={`rounded-lg p-3 text-sm ${
            actionResult.type === 'success'
              ? 'bg-green-500/10 border border-green-500/30 text-green-400'
              : 'bg-accent-red/10 border border-accent-red/30 text-accent-red'
          }`}>
            {actionResult.message}
          </div>
        )}

        {/* User Header */}
        <div className="card p-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-xl font-bold text-white">{u.username}</h3>
              <div className="text-sm text-gray-400">{u.email || 'No email'}</div>
              <div className="flex gap-2 mt-1">
                <span className={`text-xs font-medium ${TIER_COLORS[u.subscription_tier] || 'text-gray-400'}`}>
                  {(u.subscription_tier || 'free').toUpperCase()}
                </span>
                {u.is_admin && <span className="badge badge-red text-xs">Admin</span>}
                {u.faction && <span className="text-xs text-accent-orange">{u.faction}</span>}
              </div>
            </div>
            <div className="text-right">
              <div className="text-2xl font-bold text-accent-cyan">{(u.credits || 0).toLocaleString()}</div>
              <div className="text-xs text-gray-400">Credits</div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Ships */}
          <div className="card p-4">
            <h4 className="text-sm font-bold text-gray-300 mb-3">Ships ({userDetail.ships.length})</h4>
            {userDetail.ships.length === 0 ? (
              <div className="text-xs text-gray-500">No ships</div>
            ) : (
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {userDetail.ships.map(ship => (
                  <div key={ship.ship_id} className="bg-space-800 rounded p-2 text-xs">
                    <div className="flex justify-between items-center">
                      <span className="text-white font-medium">{ship.name}</span>
                      <span className={`${ship.is_active ? 'text-green-400' : ship.hull_points <= 0 ? 'text-accent-red' : 'text-gray-500'}`}>
                        {ship.is_active ? 'Active' : ship.hull_points <= 0 ? 'Destroyed' : 'Inactive'}
                      </span>
                    </div>
                    <div className="text-gray-400 mt-1">
                      {ship.ship_type} | HP: {ship.hull_points}/{ship.max_hull_points} | Sector: {ship.current_sector_id}
                    </div>
                    <div className="flex gap-1 mt-2">
                      {ship.hull_points <= 0 && (
                        <button
                          onClick={() => runAction(() => admin.reviveShip(selectedUser, { ship_id: ship.ship_id }), 'Revive')}
                          disabled={actionLoading}
                          className="btn btn-secondary text-xs px-2 py-0.5 flex items-center gap-1">
                          <Heart className="w-3 h-3" /> Revive
                        </button>
                      )}
                      {ship.hull_points > 0 && ship.hull_points < ship.max_hull_points && (
                        <button
                          onClick={() => runAction(() => admin.repairShip(selectedUser, { ship_id: ship.ship_id }), 'Repair')}
                          disabled={actionLoading}
                          className="btn btn-secondary text-xs px-2 py-0.5 flex items-center gap-1">
                          <Wrench className="w-3 h-3" /> Repair
                        </button>
                      )}
                      {!ship.is_active && ship.hull_points > 0 && (
                        <button
                          onClick={() => runAction(() => admin.setActiveShip(selectedUser, { ship_id: ship.ship_id }), 'Activate')}
                          disabled={actionLoading}
                          className="btn btn-secondary text-xs px-2 py-0.5 flex items-center gap-1">
                          <Zap className="w-3 h-3" /> Activate
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Colonies */}
          <div className="card p-4">
            <h4 className="text-sm font-bold text-gray-300 mb-3">Colonies ({userDetail.colonies.length})</h4>
            {userDetail.colonies.length === 0 ? (
              <div className="text-xs text-gray-500">No colonies</div>
            ) : (
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {userDetail.colonies.map(colony => (
                  <div key={colony.colony_id} className="bg-space-800 rounded p-2 text-xs">
                    <div className="text-white font-medium">{colony.name}</div>
                    <div className="text-gray-400">
                      Pop: {colony.population || 0} | Level: {colony.infrastructure_level || 1}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Support Actions */}
        <div className="card p-4">
          <h4 className="text-sm font-bold text-gray-300 mb-3">Support Actions</h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Adjust Credits */}
            <div className="bg-space-800 rounded p-3">
              <div className="text-xs text-gray-400 mb-2 flex items-center gap-1">
                <DollarSign className="w-3 h-3" /> Adjust Credits
              </div>
              <div className="flex gap-2">
                <input type="number" value={creditAmount} onChange={e => setCreditAmount(e.target.value)}
                  className="input text-xs flex-1" placeholder="Amount (+/-)" />
                <input type="text" value={creditReason} onChange={e => setCreditReason(e.target.value)}
                  className="input text-xs flex-1" placeholder="Reason" />
                <button
                  onClick={() => {
                    const amt = parseInt(creditAmount);
                    if (!amt) return;
                    runAction(() => admin.adjustCredits(selectedUser, { amount: amt, reason: creditReason }), 'Credits');
                    setCreditAmount('');
                    setCreditReason('');
                  }}
                  disabled={actionLoading || !creditAmount}
                  className="btn btn-primary text-xs px-3">
                  Apply
                </button>
              </div>
            </div>

            {/* Move Ship */}
            <div className="bg-space-800 rounded p-3">
              <div className="text-xs text-gray-400 mb-2 flex items-center gap-1">
                <Navigation className="w-3 h-3" /> Move Active Ship to Sector
              </div>
              <div className="flex gap-2">
                <SectorPicker value={moveSectorId} onChange={setMoveSectorId} placeholder="Search sector..." />
                <button
                  onClick={() => {
                    const activeShip = userDetail.ships.find(s => s.is_active);
                    if (!activeShip || !moveSectorId) return;
                    runAction(() => admin.moveShip(selectedUser, { ship_id: activeShip.ship_id, sector_id: parseInt(moveSectorId) }), 'Move');
                    setMoveSectorId('');
                  }}
                  disabled={actionLoading || !moveSectorId}
                  className="btn btn-primary text-xs px-3">
                  Move
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Recent Audit */}
        {userDetail.recentAudit && userDetail.recentAudit.length > 0 && (
          <div className="card p-4">
            <h4 className="text-sm font-bold text-gray-300 mb-3">Recent Audit ({userDetail.recentAudit.length})</h4>
            <div className="overflow-x-auto max-h-48 overflow-y-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-space-700 text-left">
                    <th className="py-1 px-2 text-gray-500">Time</th>
                    <th className="py-1 px-2 text-gray-500">Action</th>
                    <th className="py-1 px-2 text-gray-500">Scope</th>
                    <th className="py-1 px-2 text-gray-500">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {userDetail.recentAudit.map(log => (
                    <tr key={log.action_audit_log_id} className="border-b border-space-800">
                      <td className="py-1 px-2 text-gray-500">{new Date(log.created_at).toLocaleString()}</td>
                      <td className="py-1 px-2 text-gray-300">{log.action_type}</td>
                      <td className="py-1 px-2 text-gray-400">{log.scope_type}</td>
                      <td className="py-1 px-2">
                        <span className={`${
                          log.status === 'allow' ? 'text-green-400' :
                          log.status === 'deny' ? 'text-accent-red' :
                          log.status === 'throttle' ? 'text-accent-orange' : 'text-gray-400'
                        }`}>{log.status}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    );
  }

  // ─── Loading Detail ────────────────────────────────────────
  if (selectedUser && detailLoading) {
    return (
      <div className="p-8 text-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-accent-cyan mx-auto mb-2"></div>
        <div className="text-gray-400 text-sm">Loading player detail...</div>
      </div>
    );
  }

  // ─── User List ─────────────────────────────────────────────
  return (
    <div className="space-y-4">
      {/* Search / Filter */}
      <div className="card p-4">
        <div className="flex gap-3 flex-wrap">
          <div className="flex-1 min-w-[200px]">
            <div className="flex gap-2">
              <input type="text" value={search} onChange={(e) => setSearch(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                className="input flex-1 text-sm" placeholder="Search username or email..." />
              <button onClick={handleSearch} className="btn btn-secondary flex items-center gap-1">
                <Search className="w-4 h-4" /> Search
              </button>
            </div>
          </div>
          <select value={tierFilter} onChange={(e) => { setTierFilter(e.target.value); setPage(1); }}
            className="input text-sm">
            <option value="">All Tiers</option>
            {TIER_OPTIONS.map(t => (
              <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>
            ))}
          </select>
        </div>
      </div>

      {/* User Table */}
      <div className="card p-4">
        {loading ? (
          <div className="p-8 text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-accent-cyan mx-auto mb-2"></div>
            <div className="text-gray-400 text-sm">Loading users...</div>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-space-700 text-left">
                    <th className="py-2 px-2 text-xs text-gray-500">Username</th>
                    <th className="py-2 px-2 text-xs text-gray-500">Email</th>
                    <th className="py-2 px-2 text-xs text-gray-500">Tier</th>
                    <th className="py-2 px-2 text-xs text-gray-500">Admin</th>
                    <th className="py-2 px-2 text-xs text-gray-500">Last Login</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map(u => (
                    <tr key={u.user_id} className="border-b border-space-800 hover:bg-space-700/50 cursor-pointer"
                      onClick={() => openDetail(u.user_id)}>
                      <td className="py-2 px-2 text-accent-cyan font-medium hover:underline">{u.username}</td>
                      <td className="py-2 px-2 text-gray-400">{u.email || '-'}</td>
                      <td className="py-2 px-2">
                        <select value={u.subscription_tier || 'free'}
                          onChange={(e) => { e.stopPropagation(); handleTierChange(u.user_id, e.target.value); }}
                          onClick={(e) => e.stopPropagation()}
                          disabled={updating === u.user_id}
                          className={`bg-space-800 border border-space-600 rounded px-2 py-1 text-xs ${TIER_COLORS[u.subscription_tier] || 'text-gray-400'}`}>
                          {TIER_OPTIONS.map(t => (
                            <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>
                          ))}
                        </select>
                      </td>
                      <td className="py-2 px-2">
                        {u.is_admin ? <span className="badge badge-red">Admin</span> : <span className="text-gray-600 text-xs">-</span>}
                      </td>
                      <td className="py-2 px-2 text-xs text-gray-500">
                        {u.last_login ? new Date(u.last_login).toLocaleDateString() : 'Never'}
                      </td>
                    </tr>
                  ))}
                  {users.length === 0 && (
                    <tr><td colSpan={5} className="py-6 text-center text-gray-500">No users found</td></tr>
                  )}
                </tbody>
              </table>
            </div>
            {/* Pagination */}
            {pages > 1 && (
              <div className="flex items-center justify-between mt-3">
                <span className="text-xs text-gray-500">
                  Page {page} of {pages} ({total} users)
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

export default UsersTab;
