/**
 * Lightweight passability + spatial query helpers for 2D scenes.
 * Works on a uniform tile grid. Callers supply tile->passable lookup
 * and obstacle lists (buildings with footprints, custom blocks).
 */

export function buildPassabilityMap({
  width,
  height,
  tileGrid,
  tileMeta,
  buildings = [],
  blocks = [],
  blockMeta = {},
}) {
  // Returns a Uint8Array of size width*height. 1 = passable, 0 = blocked.
  const map = new Uint8Array(width * height);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const t = tileGrid?.[y]?.[x];
      const meta = t && tileMeta ? tileMeta[t] : null;
      // Default to passable when meta missing.
      map[y * width + x] = (!meta || meta.passable !== false) ? 1 : 0;
    }
  }
  // Buildings block their footprint (but you can walk along edges).
  for (const b of buildings) {
    const fp = b.footprint || { w: 1, h: 1 };
    if (b.grid_x == null || b.grid_y == null) continue;
    for (let dy = 0; dy < fp.h; dy++) {
      for (let dx = 0; dx < fp.w; dx++) {
        const x = b.grid_x + dx;
        const y = b.grid_y + dy;
        if (x >= 0 && y >= 0 && x < width && y < height) {
          map[y * width + x] = 0;
        }
      }
    }
  }
  // Custom blocks: only those with blocks_movement.
  for (const blk of blocks) {
    const meta = blockMeta[blk.block_type];
    if (!meta || !meta.blocks_movement) continue;
    if (blk.grid_x < 0 || blk.grid_y < 0 || blk.grid_x >= width || blk.grid_y >= height) continue;
    map[blk.grid_y * width + blk.grid_x] = 0;
  }
  return map;
}

export function isPassable(passabilityMap, width, height, gx, gy) {
  if (gx < 0 || gy < 0 || gx >= width || gy >= height) return false;
  return passabilityMap[gy * width + gx] === 1;
}

/**
 * Resolve an attempted move from (px, py) by (dx, dy) in tile units,
 * sliding against obstacles. Avatar is treated as a point with radius r (tile fraction).
 */
export function moveWithCollision(passabilityMap, w, h, px, py, dx, dy, radius = 0.3) {
  let nx = px + dx;
  let ny = py + dy;
  // X axis
  if (!_canStand(passabilityMap, w, h, nx, py, radius)) nx = px;
  // Y axis
  if (!_canStand(passabilityMap, w, h, nx, ny, radius)) ny = py;
  return { x: nx, y: ny };
}

function _canStand(map, w, h, x, y, r) {
  const samples = [
    [x - r, y - r], [x + r, y - r],
    [x - r, y + r], [x + r, y + r],
    [x, y],
  ];
  for (const [sx, sy] of samples) {
    const gx = Math.floor(sx);
    const gy = Math.floor(sy);
    if (!isPassable(map, w, h, gx, gy)) return false;
  }
  return true;
}

export function findNearestInteractable(items, px, py, maxDist = 1.6) {
  let best = null;
  let bestD = maxDist;
  for (const it of items) {
    const dx = (it.x ?? it.grid_x) + 0.5 - px;
    const dy = (it.y ?? it.grid_y) + 0.5 - py;
    const d = Math.hypot(dx, dy);
    if (d < bestD) {
      bestD = d;
      best = it;
    }
  }
  return best ? { item: best, distance: bestD } : null;
}
