/**
 * derelictManifestService — persistent registry of post-combat NPC wreck
 * manifests. realtimeCombatService.resolveCombat() builds a manifest for
 * every destroyed NPC ship and registers it here; the boarding view
 * (ShipInterior2DView via /api/derelicts/:id/...) consumes it.
 *
 * Manifests are stored in the `derelict_manifests` table keyed by their
 * synthetic `derelict_<npcId>` id and expire after MANIFEST_TTL_MS so
 * they survive backend restarts for the full TTL window. Per-user
 * looted-crate sets are stored in the `looted` JSON column so re-entering
 * a wreck shows which crates have already been claimed by *this* player.
 */

const { DerelictManifest, sequelize } = require('../models');
const { Op } = require('sequelize');

const MANIFEST_TTL_MS = 30 * 60 * 1000; // 30 minutes
const CLEANUP_INTERVAL_MS = 5 * 60 * 1000;

const isExpired = (row) => !row || new Date(row.expires_at).getTime() < Date.now();

const register = async (manifest) => {
  if (!manifest || !manifest.derelict_id) return null;
  const expiresAt = new Date(Date.now() + MANIFEST_TTL_MS);
  await DerelictManifest.upsert({
    derelict_id: manifest.derelict_id,
    manifest,
    looted: {},
    expires_at: expiresAt,
    created_at: new Date()
  });
  return manifest.derelict_id;
};

const getRow = async (derelictId) => {
  const row = await DerelictManifest.findByPk(derelictId);
  if (!row) return null;
  if (isExpired(row)) {
    try { await row.destroy(); } catch (_) { /* ignore */ }
    return null;
  }
  return row;
};

const getManifest = async (derelictId) => {
  const row = await getRow(derelictId);
  return row ? row.manifest : null;
};

const getLootedSetForUser = (row, userId) => {
  const looted = row.looted || {};
  return new Set(looted[userId] || []);
};

const isLooted = async (derelictId, userId, deckId, x, y) => {
  const row = await getRow(derelictId);
  if (!row) return false;
  return getLootedSetForUser(row, userId).has(`${deckId}:${x}:${y}`);
};

const markLooted = async (derelictId, userId, deckId, x, y) => {
  return sequelize.transaction(async (t) => {
    const row = await DerelictManifest.findByPk(derelictId, {
      transaction: t,
      lock: t.LOCK.UPDATE
    });
    if (!row || isExpired(row)) return false;
    const looted = { ...(row.looted || {}) };
    const set = new Set(looted[userId] || []);
    set.add(`${deckId}:${x}:${y}`);
    looted[userId] = Array.from(set);
    row.looted = looted;
    row.changed('looted', true);
    await row.save({ transaction: t });
    return true;
  });
};

/**
 * Atomic claim — returns true if this call newly added the lootKey, false
 * if some other concurrent request already claimed it. Caller awards loot
 * only on `true`, and may call `releaseClaim` to roll back if the award
 * itself fails so the player can retry.
 */
const claim = async (derelictId, userId, deckId, x, y) => {
  return sequelize.transaction(async (t) => {
    const row = await DerelictManifest.findByPk(derelictId, {
      transaction: t,
      lock: t.LOCK.UPDATE
    });
    if (!row || isExpired(row)) return false;
    const looted = { ...(row.looted || {}) };
    const set = new Set(looted[userId] || []);
    const key = `${deckId}:${x}:${y}`;
    if (set.has(key)) return false;
    set.add(key);
    looted[userId] = Array.from(set);
    row.looted = looted;
    row.changed('looted', true);
    await row.save({ transaction: t });
    return true;
  });
};

const releaseClaim = async (derelictId, userId, deckId, x, y) => {
  return sequelize.transaction(async (t) => {
    const row = await DerelictManifest.findByPk(derelictId, {
      transaction: t,
      lock: t.LOCK.UPDATE
    });
    if (!row) return;
    const looted = { ...(row.looted || {}) };
    const arr = looted[userId];
    if (!Array.isArray(arr)) return;
    const key = `${deckId}:${x}:${y}`;
    const next = arr.filter(k => k !== key);
    if (next.length === arr.length) return;
    looted[userId] = next;
    row.looted = looted;
    row.changed('looted', true);
    await row.save({ transaction: t });
  });
};

/**
 * Returns true if `userId` participated in the combat that produced this
 * wreck, OR if their active ship is currently in the same sector as the
 * wreck. Mirrors the design intent ("you killed it, you loot it") while
 * still allowing nearby allies who joined late to board.
 */
const isAuthorizedToBoard = async (derelictId, userId) => {
  const row = await getRow(derelictId);
  if (!row) return false;
  const m = row.manifest;
  if (Array.isArray(m.participant_user_ids) && m.participant_user_ids.includes(userId)) {
    return true;
  }
  if (m.sector_id) {
    try {
      const { Ship } = require('../models');
      const ship = await Ship.findOne({
        where: { owner_user_id: userId, current_sector_id: m.sector_id },
        attributes: ['ship_id']
      });
      if (ship) return true;
    } catch (e) {
      console.error('[derelictManifestService] sector check failed:', e.message);
    }
  }
  return false;
};

const findCrate = (manifest, deckId, x, y) => {
  if (!manifest) return null;
  return manifest.crates.find(c => c.deckId === deckId && c.x === x && c.y === y) || null;
};

/**
 * Returns a renderable interior payload (decks/tile_meta/hull_class) with
 * already-looted L tiles for the requesting user converted to floor.
 */
const buildInteriorForUser = async (derelictId, userId) => {
  const row = await getRow(derelictId);
  if (!row) return null;
  const m = row.manifest;
  const looted = getLootedSetForUser(row, userId);

  const decks = m.decks.map(d => {
    const tiles = d.tiles.map(rowStr => rowStr.split(''));
    for (let y = 0; y < d.height; y++) {
      for (let x = 0; x < d.width; x++) {
        if (tiles[y][x] === 'L' && looted.has(`${d.id}:${x}:${y}`)) {
          tiles[y][x] = '.';
        }
      }
    }
    return { id: d.id, name: d.name, width: d.width, height: d.height, tiles };
  });

  return {
    ship_id: m.derelict_id,
    name: `Derelict ${m.ship_type}`,
    hull_class: m.hull_class,
    decks,
    tile_meta: m.tile_meta,
    is_derelict: true,
    sector_id: m.sector_id || null
  };
};

// Periodic cleanup to evict expired manifests from the table.
const cleanupExpired = async () => {
  try {
    await DerelictManifest.destroy({ where: { expires_at: { [Op.lt]: new Date() } } });
  } catch (err) {
    console.error('[derelictManifestService] cleanup failed:', err.message);
  }
};

setInterval(cleanupExpired, CLEANUP_INTERVAL_MS).unref?.();

module.exports = {
  register,
  getManifest,
  buildInteriorForUser,
  isLooted,
  markLooted,
  claim,
  releaseClaim,
  findCrate,
  isAuthorizedToBoard,
  _cleanupExpired: cleanupExpired,
  _size: async () => DerelictManifest.count()
};
