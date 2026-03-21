const { NPC, Ship, Port, Sector } = require('../models');
const { Op } = require('sequelize');
const gameSettingsService = require('./gameSettingsService');
const groupBy = require('../utils/groupBy');

// Minimum seconds between proactive hails from the same NPC to anyone
const HAIL_COOLDOWN_MS = 3 * 60 * 1000; // 3 minutes
// Minimum seconds between ambient presence beats from the same NPC
const PRESENCE_COOLDOWN_MS = 2 * 60 * 1000; // 2 minutes

// ─── Proactive Beat Templates ──────────────────────────────────────

const TRADER_BEATS = [
  { event: 'npc:service_offer', text: 'Hailing all ships! Fresh cargo available at competitive prices.', offer: 'trade' },
  { event: 'npc:service_offer', text: 'Looking to offload some cargo? I\'m buying at fair market rates.', offer: 'buy' },
  { event: 'npc:hails_player', text: 'Trader frequency open. Anyone need supplies? I\'ve got a hold full of goods.', offer: 'trade' },
  { event: 'npc:service_offer', text: 'Just restocked from the outer systems. Rare commodities on board — first come, first served.', offer: 'trade' },
];

const PATROL_BEATS = [
  { event: 'npc:service_offer', text: 'Sector patrol reporting: all clear. Safe to proceed.', offer: 'safety_report' },
  { event: 'npc:combat_warning', text: 'Advisory: hostile contacts detected in adjacent sectors. Exercise caution.', offer: 'warning' },
  { event: 'npc:hails_player', text: 'Patrol hailing — any criminal activity to report? Stay vigilant out there.', offer: 'report' },
  { event: 'npc:service_offer', text: 'Running escort assignments this shift. Need protection for your next jump?', offer: 'escort' },
];

const PIRATE_BEATS = [
  { event: 'npc:combat_warning', text: 'Your cargo looks heavy. It would be a shame if something happened to it...', offer: 'threat' },
  { event: 'npc:hails_player', text: 'This is our territory. Pay the toll or face the consequences.', offer: 'bribe' },
  { event: 'npc:combat_warning', text: 'Scanning your hold... Interesting. We could work out a deal, or we could take it by force.', offer: 'threat' },
];

const BOUNTY_HUNTER_BEATS = [
  { event: 'npc:hails_player', text: 'Heard any rumors about wanted targets in these parts? There\'s a bounty to split.', offer: 'contract' },
  { event: 'npc:service_offer', text: 'Looking for a target. Got a name and a price? Let\'s talk business.', offer: 'contract' },
  { event: 'npc:hails_player', text: 'Tracking a mark through this sector. Keep your eyes open and your comms on.', offer: 'info' },
];

const BEATS_BY_TYPE = {
  TRADER: TRADER_BEATS,
  PATROL: PATROL_BEATS,
  PIRATE: PIRATE_BEATS,
  PIRATE_LORD: PIRATE_BEATS,
  BOUNTY_HUNTER: BOUNTY_HUNTER_BEATS,
};

// ─── Presence Tick ─────────────────────────────────────────────────

/**
 * Process one presence tick: generate proactive NPC beats for players.
 * Called from tickService on a 60-second interval.
 *
 * @param {Object} socketService - Socket.io service for events
 * @returns {Promise<number>} Number of beats emitted
 */
const processPresenceTick = async (socketService) => {
  if (!socketService) return 0;

  const aiEnabled = gameSettingsService.getSetting('npc.ai_enabled', true);
  if (!aiEnabled) return 0;

  let beatsEmitted = 0;

  try {
    // Find sectors with active player ships
    const activeShips = await Ship.findAll({
      where: { is_active: true },
      attributes: ['ship_id', 'owner_user_id', 'current_sector_id'],
      include: [{
        model: Sector,
        as: 'currentSector',
        attributes: ['sector_id', 'name']
      }]
    });

    if (activeShips.length === 0) return 0;

    const playerSectorIds = [...new Set(activeShips.map(s => s.current_sector_id))];
    const shipsBySector = groupBy(activeShips, 'current_sector_id');

    // Find alive NPCs in those sectors that haven't recently sent a beat
    const now = new Date();
    const hailCutoff = new Date(now.getTime() - HAIL_COOLDOWN_MS);
    const presenceCutoff = new Date(now.getTime() - PRESENCE_COOLDOWN_MS);

    const eligibleNPCs = await NPC.findAll({
      where: {
        current_sector_id: { [Op.in]: playerSectorIds },
        is_alive: true,
        behavior_state: { [Op.notIn]: ['engaging', 'fleeing'] },
        [Op.or]: [
          { last_presence_beat_at: null },
          { last_presence_beat_at: { [Op.lt]: presenceCutoff } }
        ]
      },
      attributes: ['npc_id', 'name', 'npc_type', 'ship_type', 'current_sector_id',
        'behavior_state', 'aggression_level', 'last_hail_at', 'last_presence_beat_at']
    });

    if (eligibleNPCs.length === 0) return 0;

    // Group by sector, pick at most 1 NPC per sector per tick to avoid spam
    const npcsBySector = groupBy(eligibleNPCs, 'current_sector_id');

    for (const [sectorId, npcs] of npcsBySector) {
      // Pick a random eligible NPC from this sector
      const npc = npcs[Math.floor(Math.random() * npcs.length)];
      const beats = BEATS_BY_TYPE[npc.npc_type];
      if (!beats || beats.length === 0) continue;

      // Pick a random beat
      const beat = beats[Math.floor(Math.random() * beats.length)];

      // Get players in this sector
      const playersInSector = shipsBySector.get(sectorId) || [];
      if (playersInSector.length === 0) continue;

      // For hails, pick one player to hail. For warnings/offers, broadcast to sector.
      if (beat.event === 'npc:hails_player') {
        // Only hail if cooldown elapsed
        if (npc.last_hail_at && new Date(npc.last_hail_at).getTime() > hailCutoff.getTime()) {
          continue;
        }

        // Pick a random player in the sector
        const targetShip = playersInSector[Math.floor(Math.random() * playersInSector.length)];
        const targetUserId = targetShip.owner_user_id;

        socketService.emitToUser(targetUserId, 'npc:hails_player', {
          npc_id: npc.npc_id,
          name: npc.name,
          npc_type: npc.npc_type,
          ship_type: npc.ship_type,
          greeting_text: beat.text,
          offer: beat.offer,
          sector_id: sectorId
        });

        await NPC.update(
          { last_hail_at: now, last_presence_beat_at: now },
          { where: { npc_id: npc.npc_id } }
        );
      } else {
        // Broadcast to sector
        socketService.emitToSector(sectorId, beat.event, {
          npc_id: npc.npc_id,
          name: npc.name,
          npc_type: npc.npc_type,
          text: beat.text,
          offer: beat.offer
        });

        await NPC.update(
          { last_presence_beat_at: now },
          { where: { npc_id: npc.npc_id } }
        );
      }

      beatsEmitted++;
    }
  } catch (err) {
    console.error('[PresenceService] Error:', err.message);
  }

  return beatsEmitted;
};

module.exports = {
  processPresenceTick,
  HAIL_COOLDOWN_MS,
  PRESENCE_COOLDOWN_MS
};
