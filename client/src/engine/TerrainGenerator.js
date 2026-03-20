/**
 * Voxel terrain generator.
 *
 * Converts the existing 2D biome grid (from terrainGenerator.js) into a full
 * 3D chunk of blocks using multi-octave simplex noise for heightmaps and
 * seeded RNG for feature placement (trees, ores).
 */
import { createNoise2D } from 'simplex-noise';
import { Chunk, CHUNK_SIZE, CHUNK_HEIGHT } from './Chunk.js';
import { getBlockByName } from './BlockRegistry.js';

// ---------------------------------------------------------------------------
// PRNG — copied from client/src/utils/terrainGenerator.js for consistency
// ---------------------------------------------------------------------------

export function mulberry32(seed) {
  let s = seed | 0;
  return function () {
    s = (s + 0x6D2B79F5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function hashString(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const ch = str.charCodeAt(i);
    hash = ((hash << 5) - hash + ch) | 0;
  }
  return hash;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

export const SEA_LEVEL = 40;
export const LANDING_SITE_LAYOUT = {
  spawnLocal: { x: 2.5, z: 8.5 },
  focusLocal: { x: 12.5, yOffset: 6.5, z: 8.5 },
  padCenterLocal: { x: 8.5, z: 8.5 },
};

/** Height range [min, max] per biome. */
const BIOME_HEIGHT = {
  plains:        [30, 65],
  rocky:         [25, 80],
  water:         [20, 35],
  highland:      [55, 100],
  sand:          [30, 50],
  lava:          [15, 35],
  ice:           [35, 70],
  crystal:       [35, 85],
  swamp:         [28, 42],
  volcanic_vent: [20, 65],
  landing_zone:  [40, 40], // perfectly flat
  metal_grating: [40, 40], // perfectly flat
  open_sky:      [25, 35],
};

/** Surface block per biome. */
const BIOME_SURFACE = {
  plains:        'grass',
  rocky:         'stone',
  water:         'sand',          // shore surface; water filled separately
  highland:      'highland_rock',
  sand:          'sand',
  lava:          'volcanic_rock', // surface crust; lava filled separately
  ice:           'ice',
  crystal:       'crystal',
  swamp:         'swamp_mud',
  volcanic_vent: 'volcanic_rock',
  landing_zone:  'landing_pad',
  metal_grating: 'metal_plate',
  open_sky:      'metal_plate',
};

/** Sub-surface block per biome (layer between surface and stone). */
const BIOME_SUBSURFACE = {
  plains:        'dirt',
  rocky:         'stone',
  water:         'sand',
  highland:      'stone',
  sand:          'sand',
  lava:          'volcanic_rock',
  ice:           'ice',
  crystal:       'stone',
  swamp:         'dirt',
  volcanic_vent: 'volcanic_rock',
  landing_zone:  'stone',
  metal_grating: 'metal_plate',
  open_sky:      'metal_plate',
};

/** Fluid fill block per biome (fills from sea level down to terrain surface). */
const BIOME_FLUID = {
  water:  'water',
  lava:   'lava',
  swamp:  'water',
  open_sky: 'air',
};

/** Ore types and their relative weight, mined block ids. */
const ORE_TABLE = [
  { name: 'ore_iron',    weight: 50, minY: 10, maxY: 35 },
  { name: 'ore_crystal', weight: 20, minY: 15, maxY: 30 },
  { name: 'ore_fertile', weight: 20, minY: 20, maxY: 35 },
  { name: 'ore_thermal', weight: 10, minY: 10, maxY: 25 },
];

// Pre-resolve block IDs at module load
const _blockIdCache = {};
function bid(name) {
  if (_blockIdCache[name] === undefined) {
    const block = getBlockByName(name);
    _blockIdCache[name] = block ? block.id : 0;
  }
  return _blockIdCache[name];
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Generate a full Chunk of voxel data.
 *
 * @param {number} chunkX  chunk coordinate X
 * @param {number} chunkZ  chunk coordinate Z
 * @param {number} seed    numeric seed for this planet
 * @param {string} planetType  e.g. 'Terran', 'Desert' — used only as fallback
 * @param {string[][]} biomeGrid  2D array from terrainGenerator.generateTerrain().grid
 * @returns {Chunk}
 */
export function generateChunk(chunkX, chunkZ, seed, planetType, biomeGrid, spawnChunk = null) {
  const chunk = new Chunk(chunkX, chunkZ);

  // Derive biome for this chunk from the 2D grid.
  // If the grid doesn't cover this chunk, fall back to plains.
  const biome = (biomeGrid && biomeGrid[chunkZ] && biomeGrid[chunkZ][chunkX])
    ? biomeGrid[chunkZ][chunkX]
    : 'plains';

  const [hMin, hMax] = BIOME_HEIGHT[biome] || BIOME_HEIGHT.plains;
  const surfaceId    = bid(BIOME_SURFACE[biome]    || 'grass');
  const subSurfaceId = bid(BIOME_SUBSURFACE[biome] || 'dirt');
  const fluidName    = BIOME_FLUID[biome];
  const fluidId      = fluidName ? bid(fluidName) : 0;
  const stoneId      = bid('stone');

  // Seeded noise for heightmap
  const noiseSeed = seed ^ hashString(`terrain_${chunkX}_${chunkZ}`);
  const rng = mulberry32(noiseSeed);
  const noise2D = createNoise2D(rng);

  // Feature RNG (trees, ores) — separate stream so heightmap doesn't affect it
  const featureRng = mulberry32(seed ^ hashString(`features_${chunkX}_${chunkZ}`));

  // Build heightmap for all 16x16 columns
  const heightmap = new Uint8Array(CHUNK_SIZE * CHUNK_SIZE);

  for (let lz = 0; lz < CHUNK_SIZE; lz++) {
    for (let lx = 0; lx < CHUNK_SIZE; lx++) {
      const wx = chunkX * CHUNK_SIZE + lx;
      const wz = chunkZ * CHUNK_SIZE + lz;

      // Four-octave noise for more dramatic terrain
      const oct1 = noise2D(wx * 0.008, wz * 0.008) * 0.45;  // continental shapes
      const oct2 = noise2D(wx * 0.025, wz * 0.025) * 0.30;  // hills
      const oct3 = noise2D(wx * 0.06,  wz * 0.06)  * 0.15;  // roughness
      const oct4 = noise2D(wx * 0.14,  wz * 0.14)  * 0.10;  // fine detail
      const n = (oct1 + oct2 + oct3 + oct4 + 1) / 2; // normalize to 0..1

      const height = Math.floor(hMin + n * (hMax - hMin));
      const clampedHeight = Math.max(1, Math.min(height, CHUNK_HEIGHT - 1));
      heightmap[lz * CHUNK_SIZE + lx] = clampedHeight;
    }
  }

  // Fill blocks column by column
  for (let lz = 0; lz < CHUNK_SIZE; lz++) {
    for (let lx = 0; lx < CHUNK_SIZE; lx++) {
      const surfaceY = heightmap[lz * CHUNK_SIZE + lx];

      for (let y = 0; y <= surfaceY; y++) {
        let blockId;

        if (y <= 2) {
          // Bedrock (stone, unbreakable conceptually — stone block)
          blockId = stoneId;
        } else if (y < surfaceY - 3) {
          // Deep stone
          blockId = stoneId;
        } else if (y < surfaceY) {
          // Sub-surface layers
          blockId = subSurfaceId;
        } else {
          // Surface
          blockId = surfaceId;
        }

        chunk.setBlock(lx, y, lz, blockId);
      }

      // Fluid fill: from sea level down to terrain surface + 1
      if (fluidId && surfaceY < SEA_LEVEL) {
        for (let y = surfaceY + 1; y <= SEA_LEVEL; y++) {
          chunk.setBlock(lx, y, lz, fluidId);
        }
      }
    }
  }

  // --- Feature placement ---

  // Trees on plains and swamp
  if (biome === 'plains' || biome === 'swamp') {
    placeTreesInChunk(chunk, heightmap, featureRng);
  }

  // Ore deposits at depth
  placeOres(chunk, heightmap, featureRng);

  if (spawnChunk && spawnChunk.cx === chunkX && spawnChunk.cz === chunkZ) {
    placeLandingSite(chunk, heightmap);
  }

  chunk.dirty = true;
  return chunk;
}

// ---------------------------------------------------------------------------
// Feature placement helpers
// ---------------------------------------------------------------------------

function placeTreesInChunk(chunk, heightmap, rng) {
  const logId    = bid('wood_log');
  const leavesId = bid('leaves');

  // Attempt to place ~3-6 trees per chunk
  const numTrees = 3 + Math.floor(rng() * 4);

  for (let t = 0; t < numTrees; t++) {
    const lx = Math.floor(rng() * (CHUNK_SIZE - 4)) + 2; // keep 2-block margin
    const lz = Math.floor(rng() * (CHUNK_SIZE - 4)) + 2;
    const surfaceY = heightmap[lz * CHUNK_SIZE + lx];

    // Don't place trees in water
    if (surfaceY < SEA_LEVEL) continue;
    // Don't place if too tall for chunk
    if (surfaceY + 8 >= CHUNK_HEIGHT) continue;

    const trunkHeight = 4 + Math.floor(rng() * 3); // 4-6

    // Trunk
    for (let y = 1; y <= trunkHeight; y++) {
      chunk.setBlock(lx, surfaceY + y, lz, logId);
    }

    // Leaf canopy (sphere-ish shape around top of trunk)
    const canopyBase = surfaceY + trunkHeight - 1;
    const canopyTop  = surfaceY + trunkHeight + 2;
    const canopyRadius = 2;

    for (let dy = canopyBase; dy <= canopyTop; dy++) {
      const r = dy === canopyTop ? 1 : canopyRadius;
      for (let dx = -r; dx <= r; dx++) {
        for (let dz = -r; dz <= r; dz++) {
          // Skip corners for rounder shape
          if (Math.abs(dx) === r && Math.abs(dz) === r && dy !== canopyBase) continue;

          const bx = lx + dx;
          const bz = lz + dz;

          if (bx < 0 || bx >= CHUNK_SIZE || bz < 0 || bz >= CHUNK_SIZE) continue;
          if (dy < 0 || dy >= CHUNK_HEIGHT) continue;

          // Don't overwrite trunk
          if (dx === 0 && dz === 0 && dy <= surfaceY + trunkHeight) continue;

          chunk.setBlock(bx, dy, bz, leavesId);
        }
      }
    }
  }
}

function placeOres(chunk, heightmap, rng) {
  // Each ore type gets a few vein attempts per chunk
  for (const ore of ORE_TABLE) {
    const oreId = bid(ore.name);
    const attempts = Math.ceil(ore.weight / 10);

    for (let a = 0; a < attempts; a++) {
      if (rng() > 0.4) continue; // 40% chance per attempt

      const cx = Math.floor(rng() * CHUNK_SIZE);
      const cy = ore.minY + Math.floor(rng() * (ore.maxY - ore.minY));
      const cz = Math.floor(rng() * CHUNK_SIZE);

      // Make sure ore is below the surface
      const surfaceY = heightmap[cz * CHUNK_SIZE + cx];
      if (cy >= surfaceY - 2) continue;

      // Small vein: 1-4 blocks
      const veinSize = 1 + Math.floor(rng() * 4);
      chunk.setBlock(cx, cy, cz, oreId);

      for (let v = 1; v < veinSize; v++) {
        const ox = cx + Math.floor(rng() * 3) - 1;
        const oy = cy + Math.floor(rng() * 3) - 1;
        const oz = cz + Math.floor(rng() * 3) - 1;

        if (ox < 0 || ox >= CHUNK_SIZE || oy < 1 || oy >= CHUNK_HEIGHT || oz < 0 || oz >= CHUNK_SIZE) continue;
        if (heightmap[oz * CHUNK_SIZE + ox] <= oy + 2) continue;

        // Only replace stone
        if (chunk.getBlock(ox, oy, oz) === bid('stone')) {
          chunk.setBlock(ox, oy, oz, oreId);
        }
      }
    }
  }
}

function placeLandingSite(chunk, heightmap) {
  const landingPadId = bid('landing_pad');
  const metalPlateId = bid('metal_plate');
  const lampId = bid('lamp');
  const windowId = bid('window');
  const antennaId = bid('antenna');
  const buildingCoreId = bid('building_core');
  const buildingWallId = bid('building_wall');
  const buildingRoofId = bid('building_roof');
  const storageCrateId = bid('storage_crate');
  const terminalId = bid('terminal');
  const solarPanelId = bid('solar_panel');

  const center = 8;
  const padRadius = 4;
  const apronRadius = 6;
  let padY = 0;

  for (let lz = center - apronRadius; lz <= center + apronRadius; lz++) {
    for (let lx = center - apronRadius; lx <= center + apronRadius; lx++) {
      const clampedX = Math.max(0, Math.min(CHUNK_SIZE - 1, lx));
      const clampedZ = Math.max(0, Math.min(CHUNK_SIZE - 1, lz));
      padY = Math.max(padY, heightmap[clampedZ * CHUNK_SIZE + clampedX]);
    }
  }

  padY = Math.max(SEA_LEVEL + 3, Math.min(CHUNK_HEIGHT - 8, padY + 1));

  for (let lz = center - apronRadius; lz <= center + apronRadius; lz++) {
    for (let lx = center - apronRadius; lx <= center + apronRadius; lx++) {
      if (lx < 0 || lx >= CHUNK_SIZE || lz < 0 || lz >= CHUNK_SIZE) continue;

      for (let y = padY + 1; y < Math.min(CHUNK_HEIGHT, padY + 6); y++) {
        chunk.setBlock(lx, y, lz, 0);
      }

      for (let y = 0; y < padY; y++) {
        if (chunk.getBlock(lx, y, lz) === 0) {
          chunk.setBlock(lx, y, lz, metalPlateId);
        }
      }

      const dx = Math.abs(lx - center);
      const dz = Math.abs(lz - center);
      const onPad = dx <= padRadius && dz <= padRadius;
      const onApron = dx <= apronRadius && dz <= apronRadius;

      if (onPad) {
        chunk.setBlock(lx, padY, lz, landingPadId);
      } else if (onApron) {
        chunk.setBlock(lx, padY, lz, metalPlateId);
      }
    }
  }

  const pylons = [
    [center - padRadius, center - padRadius],
    [center + padRadius, center - padRadius],
    [center - padRadius, center + padRadius],
    [center + padRadius, center + padRadius],
  ];

  for (const [lx, lz] of pylons) {
    chunk.setBlock(lx, padY + 1, lz, buildingWallId);
    chunk.setBlock(lx, padY + 2, lz, lampId);
  }

  chunk.setBlock(center, padY + 1, center, buildingCoreId);

  // Small command hut on the east side of the pad for a readable silhouette.
  for (let lx = 10; lx <= 14; lx += 1) {
    for (let lz = 5; lz <= 10; lz += 1) {
      for (let y = padY + 1; y <= padY + 4; y += 1) {
        chunk.setBlock(lx, y, lz, 0);
      }
      chunk.setBlock(lx, padY, lz, metalPlateId);
    }
  }

  for (let lx = 10; lx <= 14; lx += 1) {
    for (let lz = 5; lz <= 10; lz += 1) {
      const edge = lx === 10 || lx === 14 || lz === 5 || lz === 10;
      if (!edge) continue;

      for (let y = padY + 1; y <= padY + 3; y += 1) {
        // Leave a small door opening toward the pad.
        const isDoorway = lx === 10 && lz >= 7 && lz <= 8 && y <= padY + 2;
        if (!isDoorway) {
          const isWindowBand = y === padY + 2 && (
            (lz === 5 && lx >= 11 && lx <= 13) ||
            (lz === 10 && lx >= 11 && lx <= 13)
          );
          chunk.setBlock(lx, y, lz, isWindowBand ? windowId : buildingWallId);
        }
      }
    }
  }

  for (let lx = 10; lx <= 14; lx += 1) {
    for (let lz = 5; lz <= 10; lz += 1) {
      chunk.setBlock(lx, padY + 4, lz, buildingRoofId);
    }
  }

  chunk.setBlock(12, padY + 1, 8, terminalId);
  chunk.setBlock(11, padY + 1, 7, storageCrateId);
  chunk.setBlock(12, padY + 1, 9, storageCrateId);
  chunk.setBlock(13, padY + 5, 6, lampId);
  chunk.setBlock(13, padY + 5, 9, lampId);

  // Pad-side logistics clutter for visual depth.
  for (const [lx, lz] of [
    [5, 6],
    [5, 7],
    [5, 9],
    [6, 10],
  ]) {
    chunk.setBlock(lx, padY + 1, lz, storageCrateId);
  }

  // Simple solar array strip at the north edge.
  for (let lx = 6; lx <= 10; lx += 1) {
    chunk.setBlock(lx, padY + 1, 3, solarPanelId);
  }

  // West-side overlook so the player spawns with a readable view across the site.
  for (let lx = 1; lx <= 4; lx += 1) {
    for (let lz = 6; lz <= 10; lz += 1) {
      for (let y = 0; y <= padY + 1; y += 1) {
        if (chunk.getBlock(lx, y, lz) === 0) {
          chunk.setBlock(lx, y, lz, buildingWallId);
        }
      }
      chunk.setBlock(lx, padY + 2, lz, metalPlateId);
    }
  }

  for (let lz = 6; lz <= 10; lz += 1) {
    chunk.setBlock(1, padY + 3, lz, buildingWallId);
  }

  for (const [lx, y] of [
    [5, padY + 1],
    [4, padY + 2],
    [3, padY + 3],
  ]) {
    chunk.setBlock(lx, y, 8, landingPadId);
  }

  // Beacon mast beyond the command hut so the first view has a vertical read.
  for (let y = padY + 1; y <= padY + 6; y += 1) {
    chunk.setBlock(14, y, 8, antennaId);
  }
  chunk.setBlock(14, padY + 7, 8, lampId);

  // Main control spire behind the hut so the site reads from a distance.
  for (let y = padY + 1; y <= padY + 10; y += 1) {
    chunk.setBlock(12, y, 12, buildingCoreId);
    if (y <= padY + 8) {
      chunk.setBlock(11, y, 12, buildingWallId);
      chunk.setBlock(13, y, 12, buildingWallId);
      chunk.setBlock(12, y, 11, buildingWallId);
      chunk.setBlock(12, y, 13, buildingWallId);
    }
  }
  chunk.setBlock(12, padY + 11, 12, lampId);
  chunk.setBlock(11, padY + 9, 12, windowId);
  chunk.setBlock(13, padY + 9, 12, windowId);
  chunk.setBlock(12, padY + 9, 11, terminalId);
  chunk.setBlock(12, padY + 9, 13, terminalId);

  for (const [lx, lz] of [
    [10, 12],
    [14, 12],
    [12, 10],
    [12, 14],
  ]) {
    chunk.setBlock(lx, padY + 8, lz, solarPanelId);
  }

  // Large east-side hangar facade so the colony reads at a glance.
  for (let lz = 4; lz <= 12; lz += 1) {
    for (let y = padY + 1; y <= padY + 7; y += 1) {
      const isDoor = lz >= 7 && lz <= 9 && y <= padY + 5;
      if (isDoor) {
        chunk.setBlock(15, y, lz, 0);
        continue;
      }

      const isWindowBand = y === padY + 5 && (lz === 5 || lz === 11);
      chunk.setBlock(15, y, lz, isWindowBand ? windowId : buildingWallId);
    }
  }
  for (let lz = 4; lz <= 12; lz += 1) {
    chunk.setBlock(15, padY + 8, lz, buildingRoofId);
  }
  chunk.setBlock(15, padY + 6, 6, lampId);
  chunk.setBlock(15, padY + 6, 10, lampId);

  // Roofline guide lights and a gantry beam to make the structure readable from preview.
  for (const lz of [4, 6, 8, 10, 12]) {
    chunk.setBlock(15, padY + 8, lz, lampId);
  }
  for (let lx = 12; lx <= 15; lx += 1) {
    chunk.setBlock(lx, padY + 6, 8, buildingCoreId);
  }

  // Tall beacon towers so the preview has unmistakable silhouettes.
  for (const [lx, lz] of [
    [11, 4],
    [15, 4],
    [11, 12],
    [15, 12],
  ]) {
    for (let y = padY + 1; y <= padY + 11; y += 1) {
      const blockId = y >= padY + 8 ? buildingCoreId : buildingWallId;
      chunk.setBlock(lx, y, lz, blockId);
    }
    chunk.setBlock(lx, padY + 12, lz, lampId);
  }

  // Elevated bright gantry across the landing strip for a clearer center read.
  for (let lx = 8; lx <= 15; lx += 1) {
    chunk.setBlock(lx, padY + 9, 8, buildingCoreId);
  }
  chunk.setBlock(10, padY + 10, 8, lampId);
  chunk.setBlock(13, padY + 10, 8, lampId);

  // Roof beacon bars for the main hangar.
  for (let lz = 5; lz <= 11; lz += 2) {
    chunk.setBlock(14, padY + 9, lz, buildingCoreId);
  }

  // Primary spaceport beacon: intentionally exaggerated so the preview has a clear landmark.
  for (let y = padY + 1; y <= padY + 18; y += 1) {
    const shaftBlock = y >= padY + 12 ? buildingCoreId : buildingWallId;
    chunk.setBlock(15, y, 8, shaftBlock);
    if (y <= padY + 10) {
      chunk.setBlock(14, y, 8, buildingWallId);
    }
  }
  chunk.setBlock(15, padY + 19, 8, lampId);
  chunk.setBlock(15, padY + 17, 7, terminalId);
  chunk.setBlock(15, padY + 17, 9, terminalId);

  // Thickened hangar shoulders so the actual silhouette reads without relying only on holograms.
  for (let y = padY + 1; y <= padY + 9; y += 1) {
    chunk.setBlock(14, y, 5, buildingWallId);
    chunk.setBlock(14, y, 11, buildingWallId);
    if (y <= padY + 7) {
      chunk.setBlock(13, y, 5, buildingWallId);
      chunk.setBlock(13, y, 11, buildingWallId);
    }
  }
  for (let lz = 5; lz <= 11; lz += 1) {
    chunk.setBlock(14, padY + 10, lz, buildingRoofId);
  }

  // Command hub annex and elevated bridge to give the colony real mass in the preview.
  for (let lx = 9; lx <= 13; lx += 1) {
    for (let lz = 11; lz <= 14; lz += 1) {
      const edge = lx === 9 || lx === 13 || lz === 11 || lz === 14;
      for (let y = padY + 1; y <= padY + 5; y += 1) {
        if (edge) {
          const windowBand = y === padY + 3 && lz !== 11;
          chunk.setBlock(lx, y, lz, windowBand ? windowId : buildingWallId);
        } else {
          chunk.setBlock(lx, y, lz, 0);
        }
      }
      chunk.setBlock(lx, padY + 6, lz, buildingRoofId);
    }
  }
  for (let lx = 10; lx <= 12; lx += 1) {
    chunk.setBlock(lx, padY + 6, 11, lampId);
  }
  for (let lx = 10; lx <= 13; lx += 1) {
    chunk.setBlock(lx, padY + 6, 10, buildingCoreId);
  }

  // Raised landing approach gantries near the overlook so the left side of the shot has stronger depth.
  for (const [lx, lz] of [
    [3, 6],
    [3, 10],
    [5, 6],
    [5, 10],
  ]) {
    for (let y = padY + 1; y <= padY + 4; y += 1) {
      chunk.setBlock(lx, y, lz, buildingWallId);
    }
    chunk.setBlock(lx, padY + 5, lz, lampId);
  }
  for (let lz = 6; lz <= 10; lz += 4) {
    for (let lx = 3; lx <= 5; lx += 1) {
      chunk.setBlock(lx, padY + 4, lz, buildingCoreId);
    }
  }

  // Walkway stripe from west approach into the pad center.
  for (let lx = 2; lx <= 8; lx += 1) {
    chunk.setBlock(lx, padY, 8, landingPadId);
  }

  // Stronger centerline and threshold lights so the pad reads from the preview shot.
  for (const [lx, lz] of [
    [6, 6],
    [6, 10],
    [8, 6],
    [8, 10],
    [10, 6],
    [10, 10],
  ]) {
    chunk.setBlock(lx, padY + 1, lz, lampId);
  }

  for (let lz = 6; lz <= 10; lz += 1) {
    chunk.setBlock(9, padY + 1, lz, buildingCoreId);
  }

  // Perimeter guide lights at the player approach edge.
  chunk.setBlock(3, padY + 1, 6, lampId);
  chunk.setBlock(3, padY + 1, 10, lampId);
  chunk.setBlock(2, padY + 3, 6, lampId);
  chunk.setBlock(2, padY + 3, 10, lampId);

  // South apron marker bar to break up the otherwise-flat foreground slab.
  for (let lx = 6; lx <= 15; lx += 1) {
    chunk.setBlock(lx, padY + 1, 13, (lx % 2 === 0) ? lampId : terminalId);
  }
}
