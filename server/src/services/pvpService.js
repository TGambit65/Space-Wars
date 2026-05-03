/**
 * PvP service: opt-in PvP via Bounty Board (graded PvE), Arena queue (ELO/brackets),
 * and open-world mutual duel requests. Spectator mode is read-only via the
 * `combat:event` room emitted by realtimeCombatService.
 */
const { Op } = require('sequelize');
const crypto = require('crypto');
const { BountyContract, Ship, User } = require('../models');
const realtimeCombatService = require('./realtimeCombatService');
const { emitToUser } = require('./socketService');

// ─── Bounty Board ─────────────────────────────────────────────────
const BOUNTY_TARGET_TYPES = {
  1: 'PIRATE',
  2: 'PIRATE',
  3: 'BOUNTY_HUNTER',
  4: 'PIRATE_LORD',
  5: 'PIRATE_LORD'
};
const BOUNTY_TIER_MULT = { 1: 1, 2: 1.8, 3: 3, 4: 5, 5: 8.5 };
const BOUNTY_BASE_CREDITS = 600;
const BOUNTY_BASE_XP = 60;
const BOUNTY_TTL_HOURS = 24;
const MIN_OPEN_BOUNTIES = 8;
const MAX_OPEN_BOUNTIES_PER_TIER = 3;

const seedBountiesIfNeeded = async () => {
  const openCount = await BountyContract.count({ where: { status: 'open' } });
  if (openCount >= MIN_OPEN_BOUNTIES) return 0;
  const expiresAt = new Date(Date.now() + BOUNTY_TTL_HOURS * 60 * 60 * 1000);
  const newRows = [];
  for (let tier = 1; tier <= 5; tier++) {
    const existing = await BountyContract.count({
      where: { status: 'open', tier }
    });
    const need = Math.max(0, MAX_OPEN_BOUNTIES_PER_TIER - existing);
    for (let i = 0; i < need; i++) {
      const killCount = tier <= 2 ? (1 + Math.floor(Math.random() * 2)) : 1;
      const mult = BOUNTY_TIER_MULT[tier];
      newRows.push({
        tier,
        target_npc_type: BOUNTY_TARGET_TYPES[tier],
        kill_count: killCount,
        reward_credits: Math.round(BOUNTY_BASE_CREDITS * mult * killCount),
        reward_xp: Math.round(BOUNTY_BASE_XP * mult * killCount),
        expires_at: expiresAt,
        status: 'open'
      });
    }
  }
  if (newRows.length > 0) await BountyContract.bulkCreate(newRows);
  return newRows.length;
};

const expireStaleBounties = async () => {
  await BountyContract.update(
    { status: 'expired' },
    { where: { status: { [Op.in]: ['open', 'accepted'] }, expires_at: { [Op.lt]: new Date() } } }
  );
};

const listBounties = async (userId) => {
  await expireStaleBounties();
  await seedBountiesIfNeeded();
  const [open, mine] = await Promise.all([
    BountyContract.findAll({
      where: { status: 'open', expires_at: { [Op.gt]: new Date() } },
      order: [['tier', 'ASC'], ['created_at', 'DESC']]
    }),
    BountyContract.findAll({
      where: {
        accepted_by_user_id: userId,
        status: { [Op.in]: ['accepted', 'completed'] }
      },
      order: [['accepted_at', 'DESC']],
      limit: 25
    })
  ]);
  return { open, mine };
};

const acceptBounty = async (userId, contractId) => {
  // Atomic compare-and-set: only flip status open->accepted; race losers see 0 affected rows.
  const [affectedCount] = await BountyContract.update(
    { accepted_by_user_id: userId, status: 'accepted', accepted_at: new Date() },
    { where: { contract_id: contractId, status: 'open', expires_at: { [Op.gt]: new Date() } } }
  );
  if (affectedCount === 0) {
    const existing = await BountyContract.findByPk(contractId);
    if (!existing) { const e = new Error('Bounty not found'); e.statusCode = 404; throw e; }
    if (new Date(existing.expires_at).getTime() <= Date.now()) {
      await existing.update({ status: 'expired' }).catch(() => {});
      const e = new Error('Bounty expired'); e.statusCode = 410; throw e;
    }
    const e = new Error('Bounty no longer available'); e.statusCode = 409; throw e;
  }
  return BountyContract.findByPk(contractId);
};

const abandonBounty = async (userId, contractId) => {
  const contract = await BountyContract.findOne({
    where: { contract_id: contractId, accepted_by_user_id: userId, status: 'accepted' }
  });
  if (!contract) {
    const e = new Error('Active bounty not found'); e.statusCode = 404; throw e;
  }
  await contract.update({ status: 'abandoned' });
  return contract;
};

// ─── Arena Queue (in-memory) ──────────────────────────────────────
const ARENA_BRACKETS = ['1v1', '2v2', 'ffa'];
const ARENA_BRACKET_SIZE = { '1v1': 2, '2v2': 4, 'ffa': 4 };
const ARENA_MATCH_INTERVAL_MS = 2000;
const ARENA_MAX_ELO_GAP = 400;
const DEFAULT_ELO = 1000;

const arenaQueues = { '1v1': [], '2v2': [], 'ffa': [] }; // entry: { userId, shipId, elo, joinedAt }
const arenaElo = new Map();           // userId -> elo
const activeArenaMatches = new Map(); // matchId -> { combatId, bracket, userIds, startedAt }
let arenaMatchTimer = null;

const getElo = (userId) => arenaElo.get(userId) || DEFAULT_ELO;

const updateEloAfterMatch = (winnerIds, loserIds) => {
  if (winnerIds.length === 0 || loserIds.length === 0) return;
  const K = 24;
  const winnerAvg = winnerIds.reduce((s, id) => s + getElo(id), 0) / winnerIds.length;
  const loserAvg = loserIds.reduce((s, id) => s + getElo(id), 0) / loserIds.length;
  const expectedWin = 1 / (1 + Math.pow(10, (loserAvg - winnerAvg) / 400));
  const winDelta = Math.round(K * (1 - expectedWin));
  const loseDelta = -winDelta;
  for (const id of winnerIds) arenaElo.set(id, getElo(id) + winDelta);
  for (const id of loserIds) arenaElo.set(id, Math.max(100, getElo(id) + loseDelta));
};

const removeFromAllQueues = (userId) => {
  for (const b of ARENA_BRACKETS) {
    arenaQueues[b] = arenaQueues[b].filter(e => e.userId !== userId);
  }
};

const joinArenaQueue = async (userId, shipId, bracket) => {
  if (!ARENA_BRACKETS.includes(bracket)) {
    const e = new Error('Invalid bracket'); e.statusCode = 400; throw e;
  }
  const ship = await Ship.findOne({ where: { ship_id: shipId, owner_user_id: userId, is_active: true } });
  if (!ship) { const e = new Error('Ship not found'); e.statusCode = 404; throw e; }
  if (ship.in_combat) { const e = new Error('Ship is already in combat'); e.statusCode = 400; throw e; }
  // Already queued?
  for (const b of ARENA_BRACKETS) {
    if (arenaQueues[b].some(x => x.userId === userId)) {
      const e = new Error('Already queued for arena'); e.statusCode = 409; throw e;
    }
  }
  arenaQueues[bracket].push({
    userId, shipId, elo: getElo(userId), joinedAt: Date.now()
  });
  startArenaMatchmaker();
  emitToUser(userId, 'pvp:arena_queue', { bracket, status: 'queued', position: arenaQueues[bracket].length, elo: getElo(userId) });
  return { bracket, position: arenaQueues[bracket].length, elo: getElo(userId) };
};

const leaveArenaQueue = (userId) => {
  removeFromAllQueues(userId);
  emitToUser(userId, 'pvp:arena_queue', { status: 'left' });
  return { ok: true };
};

const startArenaMatchmaker = () => {
  if (arenaMatchTimer) return;
  arenaMatchTimer = setInterval(() => { tryMakeArenaMatches().catch(() => {}); }, ARENA_MATCH_INTERVAL_MS);
};

const stopArenaMatchmaker = () => {
  if (arenaMatchTimer) { clearInterval(arenaMatchTimer); arenaMatchTimer = null; }
};

const tryMakeArenaMatches = async () => {
  for (const bracket of ARENA_BRACKETS) {
    const need = ARENA_BRACKET_SIZE[bracket];
    while (arenaQueues[bracket].length >= need) {
      // Sort by joinedAt + ELO; pick the oldest entry then closest in ELO.
      arenaQueues[bracket].sort((a, b) => a.joinedAt - b.joinedAt);
      const seed = arenaQueues[bracket][0];
      const candidates = arenaQueues[bracket]
        .slice(1)
        .map(e => ({ e, gap: Math.abs(e.elo - seed.elo) }))
        .sort((a, b) => a.gap - b.gap)
        .slice(0, need - 1);
      if (candidates.length < need - 1) break;
      const tooFar = candidates.some(c => c.gap > ARENA_MAX_ELO_GAP);
      // Relax ELO gap for stale (>30s) seeds to avoid starvation
      const seedAge = Date.now() - seed.joinedAt;
      if (tooFar && seedAge < 30000) break;
      const picked = [seed, ...candidates.map(c => c.e)];
      // Remove from queue
      arenaQueues[bracket] = arenaQueues[bracket].filter(x => !picked.includes(x));
      try {
        await launchArenaMatch(bracket, picked);
      } catch (err) {
        console.error('[PvP] Arena match launch failed:', err);
        // notify entries of failure and re-queue is risky — drop them
        for (const p of picked) emitToUser(p.userId, 'pvp:arena_queue', { status: 'error', message: err.message });
      }
    }
  }
  // Stop timer if everything empty
  const total = ARENA_BRACKETS.reduce((s, b) => s + arenaQueues[b].length, 0);
  if (total === 0) stopArenaMatchmaker();
};

const launchArenaMatch = async (bracket, entries) => {
  const matchId = crypto.randomUUID();
  // Pair up by chaining initiateConsensualPvp; for >2 ships, the realtimeCombatService
  // tick treats every distinct ownerId as its own side, so a single combat instance suffices.
  // We use the first two entries as attacker/defender to bootstrap, then patch additional
  // ships by extending the same combat? That requires multi-ship init. For MVP we keep it simple:
  //  - 1v1: one combat between two ships
  //  - 2v2 / ffa: launched as a single combat using initiateCombat directly with all ships.
  if (bracket === '1v1') {
    // Re-validate ships are still combat-eligible at launch.
    const rows = await Ship.findAll({
      where: { ship_id: { [Op.in]: [entries[0].shipId, entries[1].shipId] }, is_active: true }
    });
    if (rows.length !== 2 || rows.some(r => r.in_combat)) {
      for (const e of entries) emitToUser(e.userId, 'pvp:arena_queue', { status: 'cancelled', message: 'Your ship became unavailable before the match launched.' });
      throw new Error('Arena ships unavailable at launch');
    }
    const combatId = await realtimeCombatService.initiateConsensualPvp(
      entries[0].shipId, entries[1].shipId,
      { combatType: 'PVP_ARENA', sectorEmit: false, matchId }
    );
    activeArenaMatches.set(matchId, {
      combatId, bracket, userIds: entries.map(e => e.userId), startedAt: new Date()
    });
    for (const e of entries) {
      emitToUser(e.userId, 'pvp:arena_match', { matchId, combatId, bracket });
    }
    return;
  }
  // Multi-ship: build ships via Ship records and call initiateCombat directly.
  // Re-validate at launch: ships must still exist, be active, and not already in combat.
  const shipRows = await Ship.findAll({
    where: { ship_id: { [Op.in]: entries.map(e => e.shipId) }, is_active: true }
  });
  const validIds = new Set(shipRows.filter(s => !s.in_combat).map(s => s.ship_id));
  if (validIds.size !== entries.length) {
    // Notify dropped entries; do not start a partial match.
    for (const e of entries) {
      if (!validIds.has(e.shipId)) {
        emitToUser(e.userId, 'pvp:arena_queue', {
          status: 'cancelled',
          message: 'Your ship became unavailable before the match launched.'
        });
      }
    }
    throw new Error('One or more arena ships unavailable at launch');
  }
  // Lock them in_combat atomically
  const shipIdList = entries.map(e => e.shipId);
  await Ship.update({ in_combat: true }, { where: { ship_id: { [Op.in]: shipIdList } } });
  // Assign teams: 2v2 splits into A/B (first 2 vs last 2 by queue order); FFA leaves teamId null.
  const teamFor = (idx) => {
    if (bracket === '2v2') return idx < 2 ? 'A' : 'B';
    return null;
  };
  const ships = shipRows.map(s => {
    const idx = entries.findIndex(e => e.shipId === s.ship_id);
    return {
      shipId: s.ship_id, ownerId: s.owner_user_id, isNPC: false, name: s.name,
      teamId: teamFor(idx),
      stats: {
        maxHull: s.max_hull_points, hull: s.hull_points,
        maxShields: s.max_shield_points, shields: s.shield_points,
        attackPower: s.attack_power, defenseRating: s.defense_rating,
        speed: s.speed, maxEnergy: s.max_energy, energy: s.energy
      }
    };
  });
  const sectorId = shipRows[0].current_sector_id;
  let combatId;
  try {
    combatId = await realtimeCombatService.initiateCombat(
      sectorId, ships, 'PVP_ARENA', { sectorEmit: false, matchId }
    );
  } catch (err) {
    // Rollback in_combat lock so queued ships aren't stuck after a failed launch.
    try {
      await Ship.update({ in_combat: false }, { where: { ship_id: { [Op.in]: shipIdList } } });
    } catch (rollbackErr) {
      console.error('[PvP] Failed to roll back in_combat after arena launch error:', rollbackErr);
    }
    for (const e of entries) {
      emitToUser(e.userId, 'pvp:arena_queue', {
        status: 'cancelled',
        message: 'Arena match failed to start. Please re-queue.'
      });
    }
    throw err;
  }
  activeArenaMatches.set(matchId, {
    combatId, bracket, userIds: entries.map(e => e.userId), startedAt: new Date()
  });
  for (const e of entries) {
    emitToUser(e.userId, 'pvp:arena_match', { matchId, combatId, bracket });
  }
};

const getArenaStatus = (userId) => {
  const queueSizes = Object.fromEntries(ARENA_BRACKETS.map(b => [b, arenaQueues[b].length]));
  for (const bracket of ARENA_BRACKETS) {
    const idx = arenaQueues[bracket].findIndex(e => e.userId === userId);
    if (idx >= 0) {
      return { queued: true, bracket, position: idx + 1, queueSize: arenaQueues[bracket].length, queueSizes, elo: getElo(userId) };
    }
  }
  return { queued: false, elo: getElo(userId), queueSizes };
};

// ─── Duel Requests (in-memory, mutual consent) ────────────────────
const DUEL_TTL_MS = 60_000;
const duelRequests = new Map(); // requestId -> { challengerUserId, challengerShipId, defenderUserId, defenderShipId, sectorId, expiresAt }

const cleanupDuels = () => {
  const now = Date.now();
  for (const [id, r] of duelRequests) {
    if (r.expiresAt <= now) duelRequests.delete(id);
  }
};

const challengeDuel = async (challengerUserId, challengerShipId, defenderShipId) => {
  cleanupDuels();
  const [att, def] = await Promise.all([
    Ship.findOne({ where: { ship_id: challengerShipId, owner_user_id: challengerUserId, is_active: true } }),
    Ship.findOne({ where: { ship_id: defenderShipId, is_active: true } })
  ]);
  if (!att) { const e = new Error('Challenger ship not found'); e.statusCode = 404; throw e; }
  if (!def) { const e = new Error('Defender ship not found'); e.statusCode = 404; throw e; }
  if (att.owner_user_id === def.owner_user_id) {
    const e = new Error('Cannot duel yourself'); e.statusCode = 400; throw e;
  }
  if (att.current_sector_id !== def.current_sector_id) {
    const e = new Error('Defender is not in your sector'); e.statusCode = 400; throw e;
  }
  if (att.in_combat || def.in_combat) {
    const e = new Error('One of the ships is in combat'); e.statusCode = 400; throw e;
  }
  const requestId = crypto.randomUUID();
  const expiresAt = Date.now() + DUEL_TTL_MS;
  duelRequests.set(requestId, {
    requestId,
    challengerUserId,
    challengerShipId,
    defenderUserId: def.owner_user_id,
    defenderShipId,
    sectorId: att.current_sector_id,
    expiresAt
  });
  const challenger = await User.findByPk(challengerUserId, { attributes: ['user_id', 'username'] });
  emitToUser(def.owner_user_id, 'pvp:duel_request', {
    requestId,
    challenger: challenger ? { user_id: challenger.user_id, username: challenger.username } : { user_id: challengerUserId },
    challengerShipName: att.name,
    defenderShipId,
    expiresAt: new Date(expiresAt).toISOString()
  });
  return { requestId, expiresAt: new Date(expiresAt).toISOString() };
};

const respondDuel = async (userId, requestId, accept) => {
  cleanupDuels();
  const req = duelRequests.get(requestId);
  if (!req) { const e = new Error('Duel request not found or expired'); e.statusCode = 404; throw e; }
  if (req.defenderUserId !== userId) {
    const e = new Error('Only the challenged player can respond'); e.statusCode = 403; throw e;
  }
  if (!accept) {
    duelRequests.delete(requestId);
    emitToUser(req.challengerUserId, 'pvp:duel_response', { requestId, accepted: false });
    return { accepted: false };
  }
  // Re-validate co-location at accept-time: an open-world duel must occur where the
  // request was issued. Defender may have moved between challenge and acceptance.
  const [att, def] = await Promise.all([
    Ship.findOne({ where: { ship_id: req.challengerShipId, is_active: true } }),
    Ship.findOne({ where: { ship_id: req.defenderShipId, is_active: true } })
  ]);
  if (!att || !def || att.current_sector_id !== def.current_sector_id || att.in_combat || def.in_combat) {
    duelRequests.delete(requestId);
    const msg = 'Duel cannot start: ships are no longer co-located or one is already in combat.';
    emitToUser(req.challengerUserId, 'pvp:duel_response', { requestId, accepted: false, error: msg });
    emitToUser(req.defenderUserId, 'pvp:duel_response', { requestId, accepted: false, error: msg });
    const e = new Error(msg); e.statusCode = 409; throw e;
  }
  // Remove the request only after combat init succeeds so a failure can be retried by the challenger.
  const matchId = crypto.randomUUID();
  let combatId;
  try {
    combatId = await realtimeCombatService.initiateConsensualPvp(
      req.challengerShipId, req.defenderShipId,
      { combatType: 'PVP_DUEL', sectorEmit: true, matchId, bypassSameSector: false }
    );
  } catch (err) {
    duelRequests.delete(requestId);
    const msg = err?.message || 'Failed to start duel';
    emitToUser(req.challengerUserId, 'pvp:duel_response', { requestId, accepted: false, error: msg });
    emitToUser(req.defenderUserId, 'pvp:duel_response', { requestId, accepted: false, error: msg });
    const e = new Error(msg); e.statusCode = err?.statusCode || 500; throw e;
  }
  duelRequests.delete(requestId);
  emitToUser(req.challengerUserId, 'pvp:duel_response', { requestId, accepted: true, combatId });
  emitToUser(req.defenderUserId, 'pvp:duel_response', { requestId, accepted: true, combatId });
  return { accepted: true, combatId, matchId };
};

const listIncomingDuels = async (userId) => {
  cleanupDuels();
  const candidates = [];
  for (const r of duelRequests.values()) {
    if (r.defenderUserId === userId) candidates.push(r);
  }
  if (candidates.length === 0) return [];
  // Enrich with challenger username + ship name for parity with socket notifications.
  const challengerIds = Array.from(new Set(candidates.map(r => r.challengerUserId)));
  const shipIds = Array.from(new Set(candidates.map(r => r.challengerShipId)));
  const [users, ships] = await Promise.all([
    User.findAll({ where: { user_id: { [Op.in]: challengerIds } }, attributes: ['user_id', 'username'] }),
    Ship.findAll({ where: { ship_id: { [Op.in]: shipIds } }, attributes: ['ship_id', 'name'] })
  ]);
  const userMap = new Map(users.map(u => [u.user_id, u]));
  const shipMap = new Map(ships.map(s => [s.ship_id, s]));
  return candidates.map(r => {
    const u = userMap.get(r.challengerUserId);
    const s = shipMap.get(r.challengerShipId);
    return {
      requestId: r.requestId,
      challengerUserId: r.challengerUserId,
      challenger: u ? { user_id: u.user_id, username: u.username } : { user_id: r.challengerUserId },
      challengerShipName: s?.name || null,
      defenderShipId: r.defenderShipId,
      expiresAt: new Date(r.expiresAt).toISOString()
    };
  });
};

// ─── Combat resolution callback (from realtimeCombatService) ──────
const handleCombatResolved = (matchId, payload) => {
  if (!matchId) return;
  const match = activeArenaMatches.get(matchId);
  if (!match) return;
  activeArenaMatches.delete(matchId);
  const result = payload?.result || {};
  if (payload?.combatType === 'PVP_ARENA') {
    // Prefer team-aware winners/losers from resolveCombat; fall back to single-winner.
    const winners = Array.isArray(result.winners) && result.winners.length
      ? result.winners
      : (result.winnerOwnerId ? [result.winnerOwnerId] : []);
    const losers = Array.isArray(result.losers) && result.losers.length
      ? result.losers
      : match.userIds.filter(id => !winners.includes(id));
    if (winners.length > 0 && losers.length > 0) {
      updateEloAfterMatch(winners, losers);
      for (const uid of match.userIds) {
        emitToUser(uid, 'pvp:arena_result', {
          matchId,
          combatId: payload.combatId,
          winnerUserIds: winners,
          winnerTeamId: result.winnerTeamId || null,
          newElo: getElo(uid)
        });
      }
    } else {
      for (const uid of match.userIds) {
        emitToUser(uid, 'pvp:arena_result', { matchId, combatId: payload.combatId, draw: true, newElo: getElo(uid) });
      }
    }
  }
};

module.exports = {
  // Bounty board
  listBounties,
  acceptBounty,
  abandonBounty,
  seedBountiesIfNeeded,
  // Arena
  joinArenaQueue,
  leaveArenaQueue,
  getArenaStatus,
  // Duels
  challengeDuel,
  respondDuel,
  listIncomingDuels,
  // Internal hook
  handleCombatResolved
};
