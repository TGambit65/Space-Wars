const pvpService = require('../services/pvpService');
const realtimeCombatService = require('../services/realtimeCombatService');

const wrap = (fn) => async (req, res) => {
  try { await fn(req, res); }
  catch (err) { res.status(err.statusCode || 500).json({ success: false, message: err.message }); }
};

// ── Bounty Board ─────────────────────────────────────────────────
const listBounties = wrap(async (req, res) => {
  const data = await pvpService.listBounties(req.user.user_id);
  res.json({ success: true, data });
});

const acceptBounty = wrap(async (req, res) => {
  const contract = await pvpService.acceptBounty(req.user.user_id, req.params.contractId);
  res.json({ success: true, data: { contract } });
});

const abandonBounty = wrap(async (req, res) => {
  const contract = await pvpService.abandonBounty(req.user.user_id, req.params.contractId);
  res.json({ success: true, data: { contract } });
});

// ── Arena ────────────────────────────────────────────────────────
const arenaStatus = wrap(async (req, res) => {
  res.json({ success: true, data: pvpService.getArenaStatus(req.user.user_id) });
});

const arenaJoin = wrap(async (req, res) => {
  const { ship_id: shipId, bracket = '1v1' } = req.body || {};
  if (!shipId) return res.status(400).json({ success: false, message: 'ship_id is required' });
  const data = await pvpService.joinArenaQueue(req.user.user_id, shipId, bracket);
  res.json({ success: true, data });
});

const arenaLeave = wrap(async (req, res) => {
  res.json({ success: true, data: pvpService.leaveArenaQueue(req.user.user_id) });
});

// ── Duels ────────────────────────────────────────────────────────
const duelChallenge = wrap(async (req, res) => {
  const { challenger_ship_id: challengerShipId, defender_ship_id: defenderShipId } = req.body || {};
  if (!challengerShipId || !defenderShipId) {
    return res.status(400).json({ success: false, message: 'challenger_ship_id and defender_ship_id required' });
  }
  const data = await pvpService.challengeDuel(req.user.user_id, challengerShipId, defenderShipId);
  res.json({ success: true, data });
});

const duelRespond = wrap(async (req, res) => {
  const { accept } = req.body || {};
  const data = await pvpService.respondDuel(req.user.user_id, req.params.requestId, !!accept);
  res.json({ success: true, data });
});

const duelIncoming = wrap(async (req, res) => {
  res.json({ success: true, data: await pvpService.listIncomingDuels(req.user.user_id) });
});

// ── Spectator ────────────────────────────────────────────────────
const listSpectatable = wrap(async (req, res) => {
  res.json({ success: true, data: realtimeCombatService.listSpectatableCombats() });
});

module.exports = {
  listBounties, acceptBounty, abandonBounty,
  arenaStatus, arenaJoin, arenaLeave,
  duelChallenge, duelRespond, duelIncoming,
  listSpectatable
};
