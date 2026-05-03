/**
 * derelictManifestService — in-memory registry of post-combat NPC wreck
 * manifests. realtimeCombatService.resolveCombat() builds a manifest for
 * every destroyed NPC ship and registers it here; the boarding view
 * (ShipInterior2DView via /api/derelicts/:id/...) consumes it.
 *
 * Manifests are keyed by their synthetic `derelict_<npcId>` id and expire
 * after MANIFEST_TTL_MS to keep the map bounded. Per-user looted-crate
 * sets live alongside the manifest so re-entering a wreck shows which
 * crates have already been claimed by *this* player.
 */

const MANIFEST_TTL_MS = 30 * 60 * 1000; // 30 minutes
const CLEANUP_INTERVAL_MS = 5 * 60 * 1000;

const registry = new Map(); // derelictId -> { manifest, expiresAt, looted: Map<userId, Set<lootKey>> }

const register = (manifest) => {
  if (!manifest || !manifest.derelict_id) return null;
  registry.set(manifest.derelict_id, {
    manifest,
    expiresAt: Date.now() + MANIFEST_TTL_MS,
    looted: new Map()
  });
  return manifest.derelict_id;
};

const get = (derelictId) => {
  const entry = registry.get(derelictId);
  if (!entry) return null;
  if (entry.expiresAt < Date.now()) {
    registry.delete(derelictId);
    return null;
  }
  return entry;
};

const getManifest = (derelictId) => {
  const entry = get(derelictId);
  return entry ? entry.manifest : null;
};

const getLootedSetForUser = (derelictId, userId) => {
  const entry = get(derelictId);
  if (!entry) return null;
  let set = entry.looted.get(userId);
  if (!set) {
    set = new Set();
    entry.looted.set(userId, set);
  }
  return set;
};

const isLooted = (derelictId, userId, deckId, x, y) => {
  const set = getLootedSetForUser(derelictId, userId);
  if (!set) return false;
  return set.has(`${deckId}:${x}:${y}`);
};

const markLooted = (derelictId, userId, deckId, x, y) => {
  const set = getLootedSetForUser(derelictId, userId);
  if (!set) return false;
  set.add(`${deckId}:${x}:${y}`);
  return true;
};

/**
 * Atomic claim — returns true if this call newly added the lootKey, false
 * if some other concurrent request already claimed it. Caller awards loot
 * only on `true`, and may call `releaseClaim` to roll back if the award
 * itself fails so the player can retry.
 */
const claim = (derelictId, userId, deckId, x, y) => {
  const set = getLootedSetForUser(derelictId, userId);
  if (!set) return false;
  const key = `${deckId}:${x}:${y}`;
  if (set.has(key)) return false;
  set.add(key);
  return true;
};

const releaseClaim = (derelictId, userId, deckId, x, y) => {
  const entry = registry.get(derelictId);
  if (!entry) return;
  const set = entry.looted.get(userId);
  if (!set) return;
  set.delete(`${deckId}:${x}:${y}`);
};

const findCrate = (manifest, deckId, x, y) => {
  if (!manifest) return null;
  return manifest.crates.find(c => c.deckId === deckId && c.x === x && c.y === y) || null;
};

/**
 * Returns a renderable interior payload (decks/tile_meta/hull_class) with
 * already-looted L tiles for the requesting user converted to floor.
 */
const buildInteriorForUser = (derelictId, userId) => {
  const entry = get(derelictId);
  if (!entry) return null;
  const m = entry.manifest;
  const looted = getLootedSetForUser(derelictId, userId) || new Set();

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

// Periodic cleanup to evict expired manifests.
setInterval(() => {
  const now = Date.now();
  for (const [id, entry] of registry) {
    if (entry.expiresAt < now) registry.delete(id);
  }
}, CLEANUP_INTERVAL_MS).unref?.();

module.exports = {
  register,
  getManifest,
  buildInteriorForUser,
  isLooted,
  markLooted,
  claim,
  releaseClaim,
  findCrate,
  _size: () => registry.size
};
