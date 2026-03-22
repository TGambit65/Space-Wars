const { NPC, Ship, Port, Sector } = require('../models');
const { Op } = require('sequelize');
const gameSettingsService = require('./gameSettingsService');
const worldPolicyService = require('./worldPolicyService');
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

// ─── Faction-Specific Territory Beats ──────────────────────────────
const FACTION_LABELS = {
  terran_alliance: 'Terran Alliance',
  zythian_swarm: 'Zythian Swarm',
  automaton_collective: 'Automaton Collective',
  synthesis_accord: 'Synthesis Accord',
  sylvari_dominion: 'Sylvari Dominion'
};

// Faction-aware beat templates — appended when NPC has faction affiliation
const FACTION_PATROL_BEATS = [
  { event: 'npc:service_offer', text: (f) => `${f} patrol sweep in progress. All ships — maintain current heading and stand by for scan.`, offer: 'patrol_sweep' },
  { event: 'npc:service_offer', text: (f) => `This sector is under ${f} protection. Report any suspicious activity.`, offer: 'safety_report' },
];
const FACTION_TRADER_BEATS = [
  { event: 'npc:service_offer', text: (f) => `${f} trade convoy passing through. Authorized merchants get priority docking.`, offer: 'convoy' },
  { event: 'npc:service_offer', text: (f) => `Carrying ${f}-subsidized cargo. Better prices for faction allies.`, offer: 'trade' },
];
const FACTION_PIRATE_BEATS = [
  { event: 'npc:combat_warning', text: () => 'This lane is ours. Pay the toll or find another route.', offer: 'toll' },
  { event: 'npc:combat_warning', text: () => 'No faction patrols out here. Just us. Make it easy on yourself.', offer: 'threat' },
];

// ─── Territory Pressure Beat Templates ────────────────────────────
const TERRITORY_PRESSURE_BEATS = {
  high: [
    { event: 'npc:combat_warning', text: 'Warning: this sector has elevated threat levels. Hostile contacts may be in the area.', offer: 'warning' },
    { event: 'npc:combat_warning', text: 'Sensors detect high pirate activity in this region. Travel with caution.', offer: 'warning' },
    { event: 'npc:combat_warning', text: 'Threat advisory: this sector is classified as dangerous. Stay alert.', offer: 'warning' },
  ],
  low: [
    { event: 'npc:service_offer', text: 'Sector status: secure. All lanes are clear for transit.', offer: 'safety_report' },
    { event: 'npc:service_offer', text: 'Routine check-in: this area is under patrol protection. Fly safe.', offer: 'safety_report' },
  ]
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
        attributes: ['sector_id', 'name', 'zone_class', 'security_class']
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
        'behavior_state', 'aggression_level', 'last_hail_at', 'last_presence_beat_at', 'faction']
    });

    if (eligibleNPCs.length === 0) return 0;

    // Group by sector, pick at most 1 NPC per sector per tick to avoid spam
    const npcsBySector = groupBy(eligibleNPCs, 'current_sector_id');

    for (const [sectorId, npcs] of npcsBySector) {
      // Pick a random eligible NPC from this sector
      const npc = npcs[Math.floor(Math.random() * npcs.length)];
      const baseBeats = BEATS_BY_TYPE[npc.npc_type];
      if (!baseBeats || baseBeats.length === 0) continue;

      // Compute territory pressure for this sector
      const sectorShip = activeShips.find(s => s.current_sector_id === sectorId);
      const sectorData = sectorShip && sectorShip.currentSector;
      if (sectorData && sectorData.zone_class) {
        const hostileCount = npcs.filter(n => n.aggression_level >= 0.7).length;
        const patrolCount = npcs.filter(n => n.npc_type === 'PATROL').length;
        const playerCount = (shipsBySector.get(sectorId) || []).length;
        const pressure = worldPolicyService.computeSectorPressure({
          zone_class: sectorData.zone_class,
          security_class: sectorData.security_class,
          hostileNPCCount: hostileCount,
          patrolNPCCount: patrolCount,
          playerCount
        });

        // Chance to emit a territory pressure beat instead of a regular one
        const pressureRoll = Math.random();
        if (pressure.pressure >= 0.55 && pressureRoll < 0.20) {
          // Dangerous/hostile sector — 20% chance of pressure beat
          const pressureBeat = TERRITORY_PRESSURE_BEATS.high[Math.floor(Math.random() * TERRITORY_PRESSURE_BEATS.high.length)];
          const playersInSector = shipsBySector.get(sectorId) || [];
          if (playersInSector.length > 0) {
            socketService.emitToSector(sectorId, pressureBeat.event, {
              npc_id: npc.npc_id, name: npc.name, npc_type: npc.npc_type,
              faction: npc.faction || null, text: pressureBeat.text, offer: pressureBeat.offer,
              pressure_label: pressure.label
            });
            await NPC.update({ last_presence_beat_at: now }, { where: { npc_id: npc.npc_id } });
            beatsEmitted++;
            continue;
          }
        } else if (pressure.pressure < 0.15 && pressureRoll < 0.10) {
          // Secure sector — 10% chance of pressure beat
          const pressureBeat = TERRITORY_PRESSURE_BEATS.low[Math.floor(Math.random() * TERRITORY_PRESSURE_BEATS.low.length)];
          const playersInSector = shipsBySector.get(sectorId) || [];
          if (playersInSector.length > 0) {
            socketService.emitToSector(sectorId, pressureBeat.event, {
              npc_id: npc.npc_id, name: npc.name, npc_type: npc.npc_type,
              faction: npc.faction || null, text: pressureBeat.text, offer: pressureBeat.offer,
              pressure_label: pressure.label
            });
            await NPC.update({ last_presence_beat_at: now }, { where: { npc_id: npc.npc_id } });
            beatsEmitted++;
            continue;
          }
        }
      }

      // Build beat pool: base beats + faction-specific beats if NPC has faction
      const factionLabel = npc.faction && FACTION_LABELS[npc.faction];
      let beatPool = baseBeats;
      if (factionLabel) {
        let factionBeats = [];
        if (npc.npc_type === 'PATROL') factionBeats = FACTION_PATROL_BEATS;
        else if (npc.npc_type === 'TRADER') factionBeats = FACTION_TRADER_BEATS;
        else if (npc.npc_type === 'PIRATE' || npc.npc_type === 'PIRATE_LORD') factionBeats = FACTION_PIRATE_BEATS;
        if (factionBeats.length > 0) {
          // 40% chance of faction-specific beat when faction NPC
          beatPool = Math.random() < 0.4
            ? factionBeats.map(fb => ({ event: fb.event, text: fb.text(factionLabel), offer: fb.offer }))
            : baseBeats;
        }
      }

      // Pick a random beat
      const beat = beatPool[Math.floor(Math.random() * beatPool.length)];

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
          faction: npc.faction || null,
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
          faction: npc.faction || null,
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
