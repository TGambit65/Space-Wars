/**
 * Shared deterministic terrain generator using simplex noise.
 * Runs identically on server (validation) and client (rendering).
 * CommonJS version for server — client has ES module mirror.
 */
const { createNoise2D } = require('simplex-noise');

// Mulberry32 seeded PRNG — deterministic across V8/browser engines
function mulberry32(seed) {
  let s = seed | 0;
  return function () {
    s = (s + 0x6D2B79F5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Simple string hash → 32-bit integer
function hashString(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const ch = str.charCodeAt(i);
    hash = ((hash << 5) - hash + ch) | 0;
  }
  return hash;
}

/**
 * Get grid dimensions for a given planet size (1-10).
 */
function getGridSize(planetSize) {
  if (planetSize <= 3) return { width: 24, height: 24 };
  if (planetSize <= 6) return { width: 32, height: 32 };
  if (planetSize <= 9) return { width: 40, height: 40 };
  return { width: 48, height: 48 };
}

/**
 * Map planet type name to terrain profile key.
 */
const PLANET_TYPE_TO_PROFILE = {
  Terran: 'terrestrial',
  Desert: 'desert',
  Ice: 'arctic',
  Volcanic: 'volcanic',
  'Gas Giant': 'gas_giant',
  Oceanic: 'oceanic',
  Barren: 'barren',
  Jungle: 'jungle',
  Toxic: 'tomb_world',
  Crystalline: 'crystal_world'
};

// Terrain profiles — distribution weights for each terrain type
const TERRAIN_PROFILES = {
  terrestrial:   { plains: 0.5, rocky: 0.2, water: 0.15, highland: 0.1, landing_zone: 0.05 },
  oceanic:       { water: 0.55, plains: 0.15, sand: 0.15, swamp: 0.1, landing_zone: 0.05 },
  desert:        { sand: 0.5, rocky: 0.25, plains: 0.1, highland: 0.1, landing_zone: 0.05 },
  volcanic:      { lava: 0.25, rocky: 0.3, volcanic_vent: 0.15, plains: 0.15, highland: 0.1, landing_zone: 0.05 },
  arctic:        { ice: 0.45, plains: 0.2, highland: 0.2, water: 0.1, landing_zone: 0.05 },
  jungle:        { swamp: 0.3, plains: 0.35, water: 0.15, crystal: 0.05, highland: 0.1, landing_zone: 0.05 },
  barren:        { rocky: 0.45, sand: 0.3, highland: 0.1, crystal: 0.05, landing_zone: 0.1 },
  gas_giant:     { metal_grating: 0.5, plains: 0.2, open_sky: 0.15, highland: 0.1, landing_zone: 0.05 },
  crystal_world: { crystal: 0.45, rocky: 0.2, plains: 0.2, highland: 0.1, landing_zone: 0.05 },
  tomb_world:    { rocky: 0.3, sand: 0.25, plains: 0.2, swamp: 0.1, highland: 0.1, landing_zone: 0.05 }
};

/**
 * Generate terrain grid deterministically from colony/planet IDs.
 *
 * @param {string} colonyId - UUID of the colony
 * @param {string} planetId - UUID of the planet
 * @param {string} planetType - Planet type name (e.g., 'Terran', 'Volcanic')
 * @param {number} planetSize - Planet size 1-10
 * @returns {{ grid: string[][], width: number, height: number }}
 */
function generateTerrain(colonyId, planetId, planetType, planetSize) {
  const seedStr = colonyId + ':' + planetId;
  const seedNum = hashString(seedStr);
  const rng = mulberry32(seedNum);
  const noise2D = createNoise2D(rng);

  const { width, height } = getGridSize(planetSize);
  const profileKey = PLANET_TYPE_TO_PROFILE[planetType] || 'terrestrial';
  const profile = TERRAIN_PROFILES[profileKey] || TERRAIN_PROFILES.terrestrial;

  // Build threshold ranges from profile weights
  const entries = Object.entries(profile);
  const thresholds = [];
  let cumulative = 0;
  for (const [terrainType, weight] of entries) {
    cumulative += weight;
    thresholds.push({ type: terrainType, max: cumulative });
  }
  // Normalize to 1.0 to avoid floating-point gaps
  if (thresholds.length > 0) {
    thresholds[thresholds.length - 1].max = 1.0;
  }

  const grid = [];
  const noiseScale = 0.12; // controls terrain feature size

  for (let y = 0; y < height; y++) {
    const row = [];
    for (let x = 0; x < width; x++) {
      // Edge tiles become landing_zone
      if (x === 0 || y === 0 || x === width - 1 || y === height - 1) {
        row.push('landing_zone');
        continue;
      }

      // Sample noise, round to 4 decimal places for cross-engine parity
      const raw = noise2D(x * noiseScale, y * noiseScale);
      const normalized = Math.round(((raw + 1) / 2) * 10000) / 10000;

      // Map to terrain type via thresholds
      let terrainType = thresholds[0].type;
      for (const t of thresholds) {
        if (normalized <= t.max) {
          terrainType = t.type;
          break;
        }
      }

      // Don't place landing_zone in interior (already handled by edges)
      if (terrainType === 'landing_zone') {
        terrainType = 'plains';
      }

      row.push(terrainType);
    }
    grid.push(row);
  }

  return { grid, width, height };
}

/**
 * Generate resource deposit locations deterministically.
 * Weekly rotation via seed: colony_id + '_deposit_' + weekBucket.
 *
 * @param {string} colonyId
 * @param {string} planetId
 * @param {string} planetType
 * @param {number} planetSize
 * @returns {Array<{ grid_x: number, grid_y: number, resource_type: string, bonus: number }>}
 */
function generateDeposits(colonyId, planetId, planetType, planetSize, existingTerrain = null) {
  const weekBucket = Math.floor(Date.now() / 1000 / 604800);
  const seedStr = colonyId + '_deposit_' + weekBucket;
  const seedNum = hashString(seedStr);
  const rng = mulberry32(seedNum);

  const { grid, width, height } = existingTerrain || generateTerrain(colonyId, planetId, planetType, planetSize);

  const depositTypes = {
    rich_ore: { bonus: 1.10, terrain: ['rocky', 'highland'] },
    crystal_vein: { bonus: 1.10, terrain: ['crystal'] },
    fertile_soil: { bonus: 1.10, terrain: ['plains', 'swamp'] },
    thermal_vent: { bonus: 1.10, terrain: ['volcanic_vent', 'lava'] }
  };

  // Filter to deposit types with matching terrain on this grid
  const viableTypes = [];
  for (const [name, info] of Object.entries(depositTypes)) {
    const hasMatchingTerrain = grid.some(row =>
      row.some(cell => info.terrain.includes(cell))
    );
    if (hasMatchingTerrain) viableTypes.push({ name, ...info });
  }

  if (viableTypes.length === 0) return [];

  const numDeposits = 1 + Math.floor(rng() * 3); // 1-3 deposits
  const deposits = [];
  const used = new Set();

  for (let d = 0; d < numDeposits && d < viableTypes.length; d++) {
    const depositType = viableTypes[d % viableTypes.length];
    const clusterSize = 2 + Math.floor(rng() * 4); // 2-5 tiles

    // Find a random matching terrain tile as cluster center
    const candidates = [];
    for (let y = 2; y < height - 2; y++) {
      for (let x = 2; x < width - 2; x++) {
        if (depositType.terrain.includes(grid[y][x]) && !used.has(`${x},${y}`)) {
          candidates.push({ x, y });
        }
      }
    }

    if (candidates.length === 0) continue;

    const center = candidates[Math.floor(rng() * candidates.length)];
    deposits.push({
      grid_x: center.x,
      grid_y: center.y,
      resource_type: depositType.name,
      bonus: depositType.bonus
    });
    used.add(`${center.x},${center.y}`);

    // Expand cluster around center
    for (let i = 1; i < clusterSize; i++) {
      const dx = Math.floor(rng() * 3) - 1;
      const dy = Math.floor(rng() * 3) - 1;
      const nx = center.x + dx;
      const ny = center.y + dy;
      if (nx >= 1 && nx < width - 1 && ny >= 1 && ny < height - 1 && !used.has(`${nx},${ny}`)) {
        deposits.push({
          grid_x: nx,
          grid_y: ny,
          resource_type: depositType.name,
          bonus: depositType.bonus
        });
        used.add(`${nx},${ny}`);
      }
    }
  }

  return deposits;
}

// Terrain type metadata for client rendering
const TERRAIN_COLORS = {
  plains:        '#4a7c59',
  rocky:         '#7c6e5a',
  water:         '#3a6b8c',
  lava:          '#c44d2e',
  ice:           '#a8c8d8',
  sand:          '#c4a94d',
  highland:      '#5a5a5a',
  crystal:       '#8a4d9e',
  swamp:         '#4a5c3a',
  volcanic_vent: '#e06030',
  landing_zone:  '#2a4a6a',
  metal_grating: '#7a8a8a',
  open_sky:      '#1a3050'
};

const BUILDABLE_TERRAIN = new Set([
  'plains', 'rocky', 'ice', 'sand', 'crystal', 'swamp', 'metal_grating'
]);

function isBuildable(terrainType) {
  return BUILDABLE_TERRAIN.has(terrainType);
}

module.exports = {
  generateTerrain,
  generateDeposits,
  getGridSize,
  hashString,
  mulberry32,
  isBuildable,
  TERRAIN_COLORS,
  BUILDABLE_TERRAIN,
  PLANET_TYPE_TO_PROFILE,
  TERRAIN_PROFILES
};
