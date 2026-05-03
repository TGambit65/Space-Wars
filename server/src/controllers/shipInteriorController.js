const { Ship, Crew } = require('../models');
const shipInteriorService = require('../services/shipInteriorService');
const lootAwardService = require('../services/lootAwardService');

// Per-process record of which crates a user has already looted on a given
// derelict ship. Keyed by `${userId}:${shipId}`, value is a Set of
// `${deckId}:${x}:${y}` strings. This is intentionally ephemeral — derelict
// loot resets when the server restarts, which is acceptable for this MVP.
const lootedRegistry = new Map();

function getLootedSet(userId, shipId) {
  const key = `${userId}:${shipId}`;
  let set = lootedRegistry.get(key);
  if (!set) {
    set = new Set();
    lootedRegistry.set(key, set);
  }
  return set;
}

function isShipDerelict(ship) {
  return !ship.owner_user_id || ship.status === 'destroyed' || ship.status === 'derelict';
}

async function getInterior(req, res) {
  try {
    const { shipId } = req.params;
    const mode = req.query.mode === 'derelict' ? 'derelict' : 'normal';
    const ship = await Ship.findByPk(shipId);
    if (!ship) {
      return res.status(404).json({ success: false, message: 'Ship not found' });
    }
    if (mode === 'normal') {
      if (ship.owner_user_id !== req.userId) {
        return res.status(403).json({ success: false, message: 'You do not own this ship' });
      }
    } else {
      if (!isShipDerelict(ship)) {
        return res.status(403).json({ success: false, message: 'Ship is not derelict' });
      }
      if (req.user) {
        if (req.user.current_sector_id && ship.sector_id && req.user.current_sector_id !== ship.sector_id) {
          return res.status(403).json({ success: false, message: 'You are not in the same sector as this derelict' });
        }
      }
    }
    const data = shipInteriorService.buildInterior(ship.toJSON(), { mode });

    if (mode === 'derelict') {
      // Strip already-looted crates from the rendered grid so re-entering the
      // derelict shows the player which crates remain.
      const looted = getLootedSet(req.userId, shipId);
      for (const deck of data.decks) {
        for (let y = 0; y < deck.height; y++) {
          for (let x = 0; x < deck.width; x++) {
            if (deck.tiles[y][x] === 'L' && looted.has(`${deck.id}:${x}:${y}`)) {
              deck.tiles[y][x] = '.';
            }
          }
        }
      }
    }
    res.json({ success: true, data });
  } catch (error) {
    res.status(error.statusCode || 500).json({ success: false, message: error.message });
  }
}

async function lootCrate(req, res) {
  try {
    const { shipId } = req.params;
    const { deckId, x, y } = req.body || {};
    if (!deckId || typeof x !== 'number' || typeof y !== 'number') {
      return res.status(400).json({ success: false, message: 'deckId, x, y required' });
    }

    const derelict = await Ship.findByPk(shipId);
    if (!derelict) return res.status(404).json({ success: false, message: 'Ship not found' });
    if (!isShipDerelict(derelict)) {
      return res.status(403).json({ success: false, message: 'Ship is not derelict' });
    }
    if (req.user && req.user.current_sector_id && derelict.sector_id
        && req.user.current_sector_id !== derelict.sector_id) {
      return res.status(403).json({ success: false, message: 'You are not in the same sector as this derelict' });
    }

    // Validate that (deckId, x, y) is a real loot tile in the generated layout.
    const layout = shipInteriorService.buildInterior(derelict.toJSON(), { mode: 'derelict' });
    const deck = layout.decks.find((d) => d.id === deckId);
    if (!deck || y < 0 || y >= deck.height || x < 0 || x >= deck.width) {
      return res.status(400).json({ success: false, message: 'Invalid crate coordinates' });
    }
    if (deck.tiles[y][x] !== 'L') {
      return res.status(400).json({ success: false, message: 'No loot crate at that tile' });
    }

    const looted = getLootedSet(req.userId, shipId);
    const lootKey = `${deckId}:${x}:${y}`;
    if (looted.has(lootKey)) {
      return res.status(400).json({ success: false, message: 'Crate already looted' });
    }

    const roll = shipInteriorService.rollCrateLoot(derelict.toJSON(), deckId, x, y);
    const { award, error } = await lootAwardService.awardRollToUser(req.userId, roll);
    if (error) {
      return res.status(error.statusCode).json({ success: false, message: error.message });
    }

    looted.add(lootKey);
    res.json({ success: true, data: { award, looted_key: lootKey } });
  } catch (error) {
    res.status(error.statusCode || 500).json({ success: false, message: error.message });
  }
}

async function getOnBoardCrew(req, res) {
  try {
    const { shipId } = req.params;
    const ship = await Ship.findByPk(shipId);
    if (!ship) return res.status(404).json({ success: false, message: 'Ship not found' });
    if (ship.owner_user_id !== req.userId) {
      return res.status(403).json({ success: false, message: 'You do not own this ship' });
    }
    const crew = await Crew.findAll({
      where: { current_ship_id: shipId, is_active: true },
      attributes: ['crew_id', 'name', 'species', 'assigned_role', 'level'],
    });
    res.json({ success: true, data: { crew } });
  } catch (error) {
    res.status(error.statusCode || 500).json({ success: false, message: error.message });
  }
}

module.exports = { getInterior, lootCrate, getOnBoardCrew };
