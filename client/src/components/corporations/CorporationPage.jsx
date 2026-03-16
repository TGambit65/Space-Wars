import { useState, useEffect, useCallback } from 'react';
import { corporations, agreements } from '../../services/api';
import { Users, Crown, Shield, LogOut, Link2, Check, X as XIcon } from 'lucide-react';
import CorporationPicker from '../common/CorporationPicker';

function CorporationPage({ user }) {
  const [corp, setCorp] = useState(null);
  const [leaderboard, setLeaderboard] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [actionLoading, setActionLoading] = useState(null);
  const [tab, setTab] = useState('info');

  // Create form state
  const [createForm, setCreateForm] = useState({ name: '', tag: '', description: '' });
  const [contributeAmount, setContributeAmount] = useState('');
  const [withdrawAmount, setWithdrawAmount] = useState('');

  // Agreements state
  const [corpAgreements, setCorpAgreements] = useState([]);
  const [proposeForm, setProposeForm] = useState({ target_corp_id: '', agreement_type: 'trade_agreement', terms: '' });

  const fetchData = useCallback(async () => {
    try {
      const [mineRes, lbRes, agRes] = await Promise.allSettled([
        corporations.getMine(),
        corporations.getLeaderboard(),
        agreements.getAll(),
      ]);
      if (mineRes.status === 'fulfilled') {
        setCorp(mineRes.value.data.data || mineRes.value.data || null);
      } else {
        setCorp(null);
      }
      if (lbRes.status === 'fulfilled') {
        const lbRaw = lbRes.value.data.data;
        setLeaderboard(Array.isArray(lbRaw) ? lbRaw : lbRaw?.corporations || []);
      }
      if (agRes.status === 'fulfilled') {
        const agRaw = agRes.value.data.data;
        setCorpAgreements(Array.isArray(agRaw) ? agRaw : agRaw?.agreements || []);
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load data');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleCreate = async (e) => {
    e.preventDefault();
    setActionLoading('create');
    try {
      await corporations.create(createForm);
      await fetchData();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to create corporation');
    } finally {
      setActionLoading(null);
    }
  };

  const handleJoin = async (corpId) => {
    setActionLoading(`join-${corpId}`);
    try {
      await corporations.join(corpId);
      await fetchData();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to join');
    } finally {
      setActionLoading(null);
    }
  };

  const handleLeave = async () => {
    if (!confirm('Leave this corporation?')) return;
    setActionLoading('leave');
    try {
      await corporations.leave();
      setCorp(null);
      await fetchData();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to leave');
    } finally {
      setActionLoading(null);
    }
  };

  const handleContribute = async () => {
    const amt = parseInt(contributeAmount);
    if (!amt || amt <= 0) return;
    setActionLoading('contribute');
    try {
      await corporations.contribute(amt);
      setContributeAmount('');
      await fetchData();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to contribute');
    } finally {
      setActionLoading(null);
    }
  };

  const handleWithdraw = async () => {
    const amt = parseInt(withdrawAmount);
    if (!amt || amt <= 0) return;
    setActionLoading('withdraw');
    try {
      await corporations.withdraw(amt);
      setWithdrawAmount('');
      await fetchData();
    } catch (err) {
      setError(err.response?.data?.message || 'Withdrawal failed');
    } finally {
      setActionLoading(null);
    }
  };

  const handlePromote = async (userId) => {
    setActionLoading(`promote-${userId}`);
    try {
      await corporations.promote(userId);
      await fetchData();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to promote');
    } finally {
      setActionLoading(null);
    }
  };

  const handleTransfer = async (userId) => {
    if (!confirm('Transfer leadership? This cannot be undone.')) return;
    setActionLoading(`transfer-${userId}`);
    try {
      await corporations.transfer(userId);
      await fetchData();
    } catch (err) {
      setError(err.response?.data?.message || 'Transfer failed');
    } finally {
      setActionLoading(null);
    }
  };

  const handlePropose = async (e) => {
    e.preventDefault();
    if (!proposeForm.target_corp_id) return;
    setActionLoading('propose');
    try {
      await agreements.propose({
        target_corp_id: proposeForm.target_corp_id,
        agreement_type: proposeForm.agreement_type,
        terms: proposeForm.terms ? { note: proposeForm.terms } : undefined,
      });
      setProposeForm({ target_corp_id: '', agreement_type: 'trade_agreement', terms: '' });
      await fetchData();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to propose agreement');
    } finally {
      setActionLoading(null);
    }
  };

  const handleRespondAgreement = async (id, accept) => {
    setActionLoading(`agree-${id}`);
    try {
      await agreements.respond(id, accept);
      await fetchData();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to respond');
    } finally {
      setActionLoading(null);
    }
  };

  const handleBreakAgreement = async (id) => {
    if (!confirm('Break this agreement?')) return;
    setActionLoading(`break-${id}`);
    try {
      await agreements.breakAgreement(id);
      await fetchData();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to break agreement');
    } finally {
      setActionLoading(null);
    }
  };

  const handleDisband = async () => {
    if (!confirm('Disband this corporation permanently?')) return;
    setActionLoading('disband');
    try {
      await corporations.disband();
      setCorp(null);
      await fetchData();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to disband');
    } finally {
      setActionLoading(null);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-neon-cyan"></div>
      </div>
    );
  }

  const isLeader = corp?.role === 'leader';

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Corporation</h1>
        <p className="text-gray-500 text-sm mt-1">{corp ? corp.name : 'Join or create a corporation'}</p>
      </div>

      {error && (
        <div className="p-3 rounded-lg text-sm" style={{ background: 'rgba(244,67,54,0.1)', border: '1px solid rgba(244,67,54,0.3)', color: '#f44336' }}>
          {error}
          <button onClick={() => setError(null)} className="ml-2 underline">dismiss</button>
        </div>
      )}

      {!corp ? (
        /* No Corporation */
        <div className="space-y-6">
          {/* Create */}
          <div className="holo-panel p-6">
            <h2 className="text-lg font-display text-white mb-4">Create Corporation</h2>
            <form onSubmit={handleCreate} className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <input className="input" placeholder="Corporation Name" value={createForm.name}
                  onChange={e => setCreateForm(f => ({ ...f, name: e.target.value }))} required />
                <input className="input" placeholder="Tag (3-5 chars)" value={createForm.tag} maxLength={5}
                  onChange={e => setCreateForm(f => ({ ...f, tag: e.target.value.toUpperCase() }))} required />
              </div>
              <textarea className="input w-full" rows={2} placeholder="Description (optional)" value={createForm.description}
                onChange={e => setCreateForm(f => ({ ...f, description: e.target.value }))} />
              <button type="submit" disabled={actionLoading === 'create'} className="holo-button">
                {actionLoading === 'create' ? 'Creating...' : 'Create Corporation'}
              </button>
            </form>
          </div>

          {/* Leaderboard */}
          <div className="holo-panel p-4">
            <h2 className="text-lg font-display text-white mb-4">Corporations</h2>
            {leaderboard.length === 0 ? (
              <p className="text-gray-500 text-sm text-center py-4">No corporations yet</p>
            ) : (
              <div className="space-y-2">
                {leaderboard.map((c, i) => {
                  const id = c.corporation_id || c.id;
                  return (
                    <div key={id} className="flex items-center justify-between p-3 rounded-lg" style={{ background: 'rgba(0,255,255,0.02)', border: '1px solid rgba(0,255,255,0.06)' }}>
                      <div className="flex items-center gap-3">
                        <span className="text-xs font-display text-gray-500 w-6 text-right">#{i + 1}</span>
                        <div>
                          <p className="text-sm font-medium text-white">{c.name} <span className="badge-cyan text-xs ml-1">{c.tag}</span></p>
                          <p className="text-xs text-gray-500">{c.member_count || 0} members | {(c.treasury || 0).toLocaleString()} cr</p>
                        </div>
                      </div>
                      <button onClick={() => handleJoin(id)} disabled={actionLoading === `join-${id}`} className="holo-button text-xs">
                        {actionLoading === `join-${id}` ? '...' : 'Join'}
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      ) : (
        /* In Corporation */
        <div className="space-y-6">
          {/* Header */}
          <div className="holo-panel p-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="p-3 rounded-lg" style={{ background: 'rgba(0,255,255,0.1)' }}>
                  <Users className="w-6 h-6 text-neon-cyan" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-xl font-display text-white">{corp.name}</h2>
                    <span className="badge-cyan">{corp.tag}</span>
                  </div>
                  <p className="text-xs text-gray-500 mt-1">{corp.description || 'No description'}</p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-xs text-gray-500 uppercase tracking-wider font-display">Treasury</p>
                <p className="text-2xl font-bold font-display text-neon-orange">{(corp.treasury || 0).toLocaleString()}</p>
                <p className="text-xs text-gray-500">credits</p>
              </div>
            </div>
          </div>

          {/* Tabs */}
          <div className="flex gap-1 border-b" style={{ borderColor: 'rgba(0,255,255,0.1)' }}>
            {['info', 'members', 'treasury', 'agreements'].map(t => (
              <button key={t} onClick={() => setTab(t)}
                className={`px-4 py-2 text-sm transition-all ${tab === t ? 'text-neon-cyan font-semibold' : 'text-gray-500 hover:text-gray-300'}`}
                style={tab === t ? { borderBottom: '2px solid #00ffff' } : {}}
              >
                {t.charAt(0).toUpperCase() + t.slice(1)}
              </button>
            ))}
          </div>

          {tab === 'members' && (
            <div className="space-y-2">
              {(corp.members || []).map(m => {
                const roleCfg = { leader: { icon: Crown, color: '#ff6600' }, officer: { icon: Shield, color: '#00ffff' }, member: { icon: Users, color: '#999' } };
                const r = roleCfg[m.role] || roleCfg.member;
                const RoleIcon = r.icon;
                return (
                  <div key={m.user_id} className="flex items-center justify-between p-3 rounded-lg" style={{ background: 'rgba(0,255,255,0.02)', border: '1px solid rgba(0,255,255,0.06)' }}>
                    <div className="flex items-center gap-3">
                      <RoleIcon className="w-4 h-4" style={{ color: r.color }} />
                      <div>
                        <p className="text-sm text-white">{m.username}</p>
                        <p className="text-xs text-gray-500">{m.role} | contributed: {(m.contribution || 0).toLocaleString()}</p>
                      </div>
                    </div>
                    {isLeader && m.user_id !== user.user_id && (
                      <div className="flex gap-2">
                        {m.role === 'member' && (
                          <button onClick={() => handlePromote(m.user_id)} disabled={actionLoading === `promote-${m.user_id}`} className="holo-button text-xs">Promote</button>
                        )}
                        <button onClick={() => handleTransfer(m.user_id)} disabled={actionLoading === `transfer-${m.user_id}`} className="holo-button-orange text-xs px-3 py-1">Transfer</button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {tab === 'treasury' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="holo-panel p-4">
                <h3 className="text-sm font-display text-white mb-3">Contribute</h3>
                <div className="flex gap-2">
                  <input type="number" className="input flex-1" placeholder="Amount" value={contributeAmount}
                    onChange={e => setContributeAmount(e.target.value)} min="1" />
                  <button onClick={handleContribute} disabled={actionLoading === 'contribute'} className="holo-button text-sm">
                    {actionLoading === 'contribute' ? '...' : 'Contribute'}
                  </button>
                </div>
              </div>
              {isLeader && (
                <div className="holo-panel p-4">
                  <h3 className="text-sm font-display text-white mb-3">Withdraw</h3>
                  <div className="flex gap-2">
                    <input type="number" className="input flex-1" placeholder="Amount" value={withdrawAmount}
                      onChange={e => setWithdrawAmount(e.target.value)} min="1" />
                    <button onClick={handleWithdraw} disabled={actionLoading === 'withdraw'} className="holo-button-orange text-sm px-4 py-2">
                      {actionLoading === 'withdraw' ? '...' : 'Withdraw'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {tab === 'info' && (
            <div className="space-y-4">
              <div className="holo-panel p-4">
                <p className="text-sm text-gray-400">{corp.description || 'No description set.'}</p>
                <p className="text-xs text-gray-600 mt-2">Members: {corp.member_count || corp.members?.length || 0} | Your role: {corp.role}</p>
              </div>
              <div className="flex gap-3">
                <button onClick={handleLeave} disabled={actionLoading === 'leave'} className="holo-button-danger text-sm px-4 py-2">
                  <LogOut className="w-4 h-4 inline mr-1" /> {actionLoading === 'leave' ? 'Leaving...' : 'Leave Corporation'}
                </button>
                {isLeader && (
                  <button onClick={handleDisband} disabled={actionLoading === 'disband'} className="holo-button-danger text-sm px-4 py-2">
                    {actionLoading === 'disband' ? 'Disbanding...' : 'Disband'}
                  </button>
                )}
              </div>
            </div>
          )}

          {tab === 'agreements' && (
            <div className="space-y-4">
              {/* Active Agreements */}
              <div className="holo-panel p-4">
                <h3 className="text-sm font-display text-white mb-3 flex items-center gap-2">
                  <Link2 className="w-4 h-4 text-neon-cyan" /> Active Agreements
                </h3>
                {corpAgreements.length === 0 ? (
                  <p className="text-gray-500 text-sm text-center py-4">No agreements</p>
                ) : (
                  <div className="space-y-2">
                    {corpAgreements.map(ag => {
                      const id = ag.agreement_id || ag.id;
                      const isPending = ag.status === 'pending';
                      const isIncoming = ag.target_corp_id === (corp.corporation_id || corp.id);
                      const typeLbl = (ag.agreement_type || '').replace(/_/g, ' ');
                      return (
                        <div key={id} className="flex items-center justify-between p-3 rounded-lg" style={{
                          background: isPending ? 'rgba(255,165,0,0.06)' : 'rgba(0,255,255,0.04)',
                          border: `1px solid ${isPending ? 'rgba(255,165,0,0.2)' : 'rgba(0,255,255,0.1)'}`
                        }}>
                          <div>
                            <p className="text-sm text-white capitalize">{typeLbl}</p>
                            <p className="text-xs text-gray-500">
                              {isPending ? (isIncoming ? 'Incoming proposal' : 'Awaiting response') : 'Active'}
                              {ag.partner_name && ` — ${ag.partner_name}`}
                              {ag.proposer_corp_name && ` — from ${ag.proposer_corp_name}`}
                              {ag.target_corp_name && ` — to ${ag.target_corp_name}`}
                            </p>
                            {ag.terms?.note && <p className="text-xs text-gray-600 mt-1">"{ag.terms.note}"</p>}
                          </div>
                          <div className="flex gap-2">
                            {isPending && isIncoming && isLeader && (
                              <>
                                <button onClick={() => handleRespondAgreement(id, true)} disabled={!!actionLoading} className="holo-button text-xs px-3 py-1">
                                  <Check className="w-3 h-3 inline mr-1" /> Accept
                                </button>
                                <button onClick={() => handleRespondAgreement(id, false)} disabled={!!actionLoading} className="holo-button-danger text-xs px-3 py-1">
                                  <XIcon className="w-3 h-3 inline mr-1" /> Reject
                                </button>
                              </>
                            )}
                            {ag.status === 'active' && isLeader && (
                              <button onClick={() => handleBreakAgreement(id)} disabled={!!actionLoading} className="holo-button-danger text-xs px-3 py-1">
                                Break
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Propose New Agreement */}
              {isLeader && (
                <div className="holo-panel p-4">
                  <h3 className="text-sm font-display text-white mb-3">Propose Agreement</h3>
                  <form onSubmit={handlePropose} className="space-y-3">
                    <div className="grid grid-cols-2 gap-3">
                      <CorporationPicker
                        value={proposeForm.target_corp_id}
                        onChange={val => setProposeForm(f => ({ ...f, target_corp_id: val }))}
                        placeholder="Select corporation..."
                      />
                      <select className="input" value={proposeForm.agreement_type}
                        onChange={e => setProposeForm(f => ({ ...f, agreement_type: e.target.value }))}>
                        <option value="trade_agreement">Trade Agreement</option>
                        <option value="defense_pact">Defense Pact</option>
                        <option value="non_aggression">Non-Aggression</option>
                        <option value="alliance">Alliance</option>
                      </select>
                    </div>
                    <input className="input w-full" placeholder="Terms / notes (optional)" value={proposeForm.terms}
                      onChange={e => setProposeForm(f => ({ ...f, terms: e.target.value }))} />
                    <button type="submit" disabled={actionLoading === 'propose'} className="holo-button">
                      {actionLoading === 'propose' ? 'Proposing...' : 'Send Proposal'}
                    </button>
                  </form>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default CorporationPage;
