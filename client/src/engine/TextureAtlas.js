/**
 * Procedural texture atlas generator.
 *
 * Creates a 512x512 Canvas2D texture containing 16x16px pixel-art tiles
 * arranged in a 32x32 grid (1024 slots). Each block type occupies 3 slots:
 *   id*3 + 0  = top face
 *   id*3 + 1  = side face
 *   id*3 + 2  = bottom face
 *
 * Returns a THREE.CanvasTexture with nearest-neighbor filtering for crisp
 * pixel-art rendering.
 */
import * as THREE from 'three';

const ATLAS_SIZE   = 512;    // total texture size in pixels
const TILE_SIZE    = 16;     // pixels per tile
const TILES_PER_ROW = 32;   // ATLAS_SIZE / TILE_SIZE

// ---------------------------------------------------------------------------
// Simple seeded RNG for texture generation
// ---------------------------------------------------------------------------
function mulberry32(seed) {
  let s = seed | 0;
  return function () {
    s = (s + 0x6D2B79F5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ---------------------------------------------------------------------------
// Color helpers
// ---------------------------------------------------------------------------
function hexToRgb(hex) {
  const n = parseInt(hex.replace('#', ''), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function vary(rgb, amount, rng) {
  return rgb.map(c => Math.max(0, Math.min(255, c + Math.floor((rng() - 0.5) * 2 * amount))));
}

function rgbStr([r, g, b, a]) {
  if (a !== undefined) return `rgba(${r},${g},${b},${a})`;
  return `rgb(${r},${g},${b})`;
}

// ---------------------------------------------------------------------------
// Per-block texture generators
// ---------------------------------------------------------------------------

/**
 * Fill a 16x16 tile with noise-varied color.
 */
function fillNoisy(ctx, ox, oy, baseRgb, variance, rng) {
  for (let py = 0; py < TILE_SIZE; py++) {
    for (let px = 0; px < TILE_SIZE; px++) {
      ctx.fillStyle = rgbStr(vary(baseRgb, variance, rng));
      ctx.fillRect(ox + px, oy + py, 1, 1);
    }
  }
}

/**
 * Fill with base color and add scattered darker spots.
 */
function fillWithSpots(ctx, ox, oy, baseRgb, spotRgb, variance, spotChance, rng) {
  for (let py = 0; py < TILE_SIZE; py++) {
    for (let px = 0; px < TILE_SIZE; px++) {
      const isSpot = rng() < spotChance;
      const base = isSpot ? spotRgb : baseRgb;
      ctx.fillStyle = rgbStr(vary(base, variance, rng));
      ctx.fillRect(ox + px, oy + py, 1, 1);
    }
  }
}

/**
 * Fill with horizontal stripe pattern (for wood log sides).
 */
function fillStriped(ctx, ox, oy, baseRgb, stripeRgb, variance, rng) {
  for (let py = 0; py < TILE_SIZE; py++) {
    const isStripe = (py % 4 === 0) || (py % 4 === 1);
    for (let px = 0; px < TILE_SIZE; px++) {
      const base = isStripe ? stripeRgb : baseRgb;
      ctx.fillStyle = rgbStr(vary(base, variance, rng));
      ctx.fillRect(ox + px, oy + py, 1, 1);
    }
  }
}

/**
 * Fill with ring pattern (for wood log top/bottom).
 */
function fillRings(ctx, ox, oy, baseRgb, ringRgb, variance, rng) {
  const cx = TILE_SIZE / 2;
  const cy = TILE_SIZE / 2;
  for (let py = 0; py < TILE_SIZE; py++) {
    for (let px = 0; px < TILE_SIZE; px++) {
      const dist = Math.sqrt((px - cx) ** 2 + (py - cy) ** 2);
      const isRing = Math.floor(dist) % 3 === 0;
      const base = isRing ? ringRgb : baseRgb;
      ctx.fillStyle = rgbStr(vary(base, variance, rng));
      ctx.fillRect(ox + px, oy + py, 1, 1);
    }
  }
}

// Texture definitions per block — keyed by block name.
// Each entry: { top: fn, side: fn, bottom: fn } or a shorthand.
// fn(ctx, ox, oy, rng) draws a 16x16 tile at (ox, oy).

const TEXTURE_GENERATORS = {
  stone: {
    all(ctx, ox, oy, rng) {
      fillWithSpots(ctx, ox, oy, [128, 128, 128], [96, 96, 96], 12, 0.15, rng);
    }
  },
  dirt: {
    all(ctx, ox, oy, rng) {
      fillWithSpots(ctx, ox, oy, [134, 96, 67], [110, 78, 55], 10, 0.12, rng);
    }
  },
  grass: {
    top(ctx, ox, oy, rng) {
      fillNoisy(ctx, ox, oy, [76, 140, 72], 15, rng);
    },
    side(ctx, ox, oy, rng) {
      // Dirt with green top edge
      fillWithSpots(ctx, ox, oy, [134, 96, 67], [110, 78, 55], 10, 0.1, rng);
      for (let px = 0; px < TILE_SIZE; px++) {
        for (let py = 0; py < 3; py++) {
          ctx.fillStyle = rgbStr(vary([76, 140, 72], 12, rng));
          ctx.fillRect(ox + px, oy + py, 1, 1);
        }
      }
    },
    bottom(ctx, ox, oy, rng) {
      fillWithSpots(ctx, ox, oy, [134, 96, 67], [110, 78, 55], 10, 0.12, rng);
    }
  },
  sand: {
    all(ctx, ox, oy, rng) {
      fillNoisy(ctx, ox, oy, [210, 190, 100], 12, rng);
    }
  },
  water: {
    all(ctx, ox, oy, rng) {
      for (let py = 0; py < TILE_SIZE; py++) {
        for (let px = 0; px < TILE_SIZE; px++) {
          const wave = Math.sin((px + py * 0.5) * 0.8) * 15;
          const base = [50, 100 + wave, 180 + wave];
          ctx.fillStyle = rgbStr(vary(base.map(c => Math.max(0, Math.min(255, c))), 8, rng).concat([200]));
          ctx.fillRect(ox + px, oy + py, 1, 1);
        }
      }
    }
  },
  ice: {
    all(ctx, ox, oy, rng) {
      for (let py = 0; py < TILE_SIZE; py++) {
        for (let px = 0; px < TILE_SIZE; px++) {
          const streak = rng() < 0.08;
          const base = streak ? [240, 250, 255] : [170, 200, 220];
          ctx.fillStyle = rgbStr(vary(base, 10, rng));
          ctx.fillRect(ox + px, oy + py, 1, 1);
        }
      }
    }
  },
  lava: {
    all(ctx, ox, oy, rng) {
      for (let py = 0; py < TILE_SIZE; py++) {
        for (let px = 0; px < TILE_SIZE; px++) {
          const bright = rng() < 0.15;
          const base = bright ? [255, 200, 60] : [200, 70 + Math.floor(rng() * 30), 30];
          ctx.fillStyle = rgbStr(vary(base, 15, rng));
          ctx.fillRect(ox + px, oy + py, 1, 1);
        }
      }
    }
  },
  crystal: {
    all(ctx, ox, oy, rng) {
      for (let py = 0; py < TILE_SIZE; py++) {
        for (let px = 0; px < TILE_SIZE; px++) {
          const facet = ((px + py) % 5 === 0) || rng() < 0.05;
          const base = facet ? [200, 160, 255] : [120, 60, 160];
          ctx.fillStyle = rgbStr(vary(base, 15, rng));
          ctx.fillRect(ox + px, oy + py, 1, 1);
        }
      }
    }
  },
  swamp_mud: {
    all(ctx, ox, oy, rng) {
      fillWithSpots(ctx, ox, oy, [74, 92, 58], [60, 75, 48], 10, 0.15, rng);
    }
  },
  volcanic_rock: {
    all(ctx, ox, oy, rng) {
      fillWithSpots(ctx, ox, oy, [80, 50, 40], [50, 30, 25], 12, 0.2, rng);
    }
  },
  metal_plate: {
    all(ctx, ox, oy, rng) {
      // Riveted metal look
      fillNoisy(ctx, ox, oy, [178, 188, 198], 10, rng);
      // Rivets at corners
      for (const [rx, ry] of [[2,2],[13,2],[2,13],[13,13]]) {
        ctx.fillStyle = rgbStr(vary([110, 120, 130], 5, rng));
        ctx.fillRect(ox + rx, oy + ry, 2, 2);
      }
    }
  },
  landing_pad: {
    all(ctx, ox, oy, rng) {
      fillNoisy(ctx, ox, oy, [108, 126, 156], 8, rng);
      // Bright center guidance stripe
      for (let px = 0; px < TILE_SIZE; px++) {
        if ((px + 1) % 4 < 2) {
          ctx.fillStyle = rgbStr(vary([240, 214, 72], 8, rng));
          ctx.fillRect(ox + px, oy + 7, 1, 2);
        }
      }
      // Perimeter brackets
      for (const [x, y, w, h] of [
        [1, 1, 4, 1],
        [1, 1, 1, 4],
        [11, 1, 4, 1],
        [14, 1, 1, 4],
        [1, 14, 4, 1],
        [1, 11, 1, 4],
        [11, 14, 4, 1],
        [14, 11, 1, 4],
      ]) {
        ctx.fillStyle = rgbStr(vary([255, 236, 130], 6, rng));
        ctx.fillRect(ox + x, oy + y, w, h);
      }
    }
  },
  highland_rock: {
    all(ctx, ox, oy, rng) {
      fillWithSpots(ctx, ox, oy, [100, 100, 100], [70, 70, 70], 15, 0.18, rng);
    }
  },
  wood_log: {
    top(ctx, ox, oy, rng) { fillRings(ctx, ox, oy, [160, 120, 70], [120, 85, 50], 10, rng); },
    side(ctx, ox, oy, rng) { fillStriped(ctx, ox, oy, [140, 100, 55], [110, 75, 40], 8, rng); },
    bottom(ctx, ox, oy, rng) { fillRings(ctx, ox, oy, [160, 120, 70], [120, 85, 50], 10, rng); },
  },
  leaves: {
    all(ctx, ox, oy, rng) {
      for (let py = 0; py < TILE_SIZE; py++) {
        for (let px = 0; px < TILE_SIZE; px++) {
          const gap = rng() < 0.15;
          if (gap) {
            ctx.fillStyle = 'rgba(0,0,0,0)';
          } else {
            ctx.fillStyle = rgbStr(vary([50, 130, 50], 20, rng));
          }
          ctx.fillRect(ox + px, oy + py, 1, 1);
        }
      }
    }
  },
  ore_iron: {
    all(ctx, ox, oy, rng) {
      fillWithSpots(ctx, ox, oy, [128, 128, 128], [180, 140, 100], 10, 0.2, rng);
    }
  },
  ore_crystal: {
    all(ctx, ox, oy, rng) {
      fillWithSpots(ctx, ox, oy, [128, 128, 128], [160, 100, 200], 10, 0.18, rng);
    }
  },
  ore_fertile: {
    all(ctx, ox, oy, rng) {
      fillWithSpots(ctx, ox, oy, [128, 128, 128], [100, 170, 80], 10, 0.18, rng);
    }
  },
  ore_thermal: {
    all(ctx, ox, oy, rng) {
      fillWithSpots(ctx, ox, oy, [128, 128, 128], [220, 120, 40], 12, 0.2, rng);
    }
  },
  wall: {
    all(ctx, ox, oy, rng) {
      fillNoisy(ctx, ox, oy, [160, 160, 165], 6, rng);
      // Horizontal mortar lines
      for (let py = 0; py < TILE_SIZE; py += 4) {
        for (let px = 0; px < TILE_SIZE; px++) {
          ctx.fillStyle = rgbStr(vary([130, 130, 135], 4, rng));
          ctx.fillRect(ox + px, oy + py, 1, 1);
        }
      }
    }
  },
  reinforced_wall: {
    all(ctx, ox, oy, rng) {
      fillNoisy(ctx, ox, oy, [100, 110, 120], 6, rng);
      // Cross bracing
      for (let i = 0; i < TILE_SIZE; i++) {
        ctx.fillStyle = rgbStr(vary([70, 80, 90], 5, rng));
        ctx.fillRect(ox + i, oy + i, 1, 1);
        ctx.fillRect(ox + (TILE_SIZE - 1 - i), oy + i, 1, 1);
      }
    }
  },
  floor: {
    all(ctx, ox, oy, rng) {
      // Tiled floor
      for (let py = 0; py < TILE_SIZE; py++) {
        for (let px = 0; px < TILE_SIZE; px++) {
          const isGridLine = (px % 8 === 0) || (py % 8 === 0);
          const base = isGridLine ? [100, 105, 110] : [150, 155, 160];
          ctx.fillStyle = rgbStr(vary(base, 5, rng));
          ctx.fillRect(ox + px, oy + py, 1, 1);
        }
      }
    }
  },
  window: {
    all(ctx, ox, oy, rng) {
      // Blue tinted glass with frame
      for (let py = 0; py < TILE_SIZE; py++) {
        for (let px = 0; px < TILE_SIZE; px++) {
          const isFrame = px === 0 || px === 15 || py === 0 || py === 15;
          if (isFrame) {
            ctx.fillStyle = rgbStr(vary([80, 85, 90], 4, rng));
          } else {
            ctx.fillStyle = rgbStr(vary([100, 160, 220], 10, rng).concat([140]));
          }
          ctx.fillRect(ox + px, oy + py, 1, 1);
        }
      }
    }
  },
  door: {
    all(ctx, ox, oy, rng) {
      fillNoisy(ctx, ox, oy, [120, 90, 60], 8, rng);
      // Handle
      ctx.fillStyle = rgbStr(vary([200, 200, 60], 10, rng));
      ctx.fillRect(ox + 12, oy + 7, 2, 3);
    }
  },
  lamp: {
    all(ctx, ox, oy, rng) {
      fillNoisy(ctx, ox, oy, [240, 230, 180], 10, rng);
      // Bright center
      for (let py = 5; py < 11; py++) {
        for (let px = 5; px < 11; px++) {
          ctx.fillStyle = rgbStr(vary([255, 250, 220], 5, rng));
          ctx.fillRect(ox + px, oy + py, 1, 1);
        }
      }
    }
  },
  pipe: {
    all(ctx, ox, oy, rng) {
      for (let py = 0; py < TILE_SIZE; py++) {
        for (let px = 0; px < TILE_SIZE; px++) {
          const distFromCenter = Math.abs(px - 7.5);
          const shade = Math.max(0, 1 - distFromCenter / 8);
          const base = [80 + shade * 80, 90 + shade * 80, 100 + shade * 80];
          ctx.fillStyle = rgbStr(vary(base.map(Math.floor), 5, rng));
          ctx.fillRect(ox + px, oy + py, 1, 1);
        }
      }
    }
  },
  vent: {
    all(ctx, ox, oy, rng) {
      for (let py = 0; py < TILE_SIZE; py++) {
        for (let px = 0; px < TILE_SIZE; px++) {
          const isSlat = py % 3 === 0;
          const base = isSlat ? [60, 65, 70] : [120, 125, 130];
          ctx.fillStyle = rgbStr(vary(base, 6, rng));
          ctx.fillRect(ox + px, oy + py, 1, 1);
        }
      }
    }
  },
  terminal: {
    all(ctx, ox, oy, rng) {
      fillNoisy(ctx, ox, oy, [50, 55, 60], 5, rng);
      // Green screen
      for (let py = 3; py < 12; py++) {
        for (let px = 3; px < 13; px++) {
          const scanline = py % 2 === 0;
          const base = scanline ? [20, 180, 60] : [15, 140, 45];
          ctx.fillStyle = rgbStr(vary(base, 8, rng));
          ctx.fillRect(ox + px, oy + py, 1, 1);
        }
      }
    }
  },
  storage_crate: {
    all(ctx, ox, oy, rng) {
      fillNoisy(ctx, ox, oy, [160, 130, 70], 10, rng);
      // Metal bands
      for (let px = 0; px < TILE_SIZE; px++) {
        for (const row of [3, 12]) {
          ctx.fillStyle = rgbStr(vary([100, 100, 110], 5, rng));
          ctx.fillRect(ox + px, oy + row, 1, 1);
        }
      }
    }
  },
  solar_panel: {
    top(ctx, ox, oy, rng) {
      // Dark blue cells with silver grid
      for (let py = 0; py < TILE_SIZE; py++) {
        for (let px = 0; px < TILE_SIZE; px++) {
          const isGrid = (px % 4 === 0) || (py % 4 === 0);
          const base = isGrid ? [180, 185, 190] : [30, 50, 120];
          ctx.fillStyle = rgbStr(vary(base, 6, rng));
          ctx.fillRect(ox + px, oy + py, 1, 1);
        }
      }
    },
    side(ctx, ox, oy, rng) { fillNoisy(ctx, ox, oy, [100, 105, 110], 6, rng); },
    bottom(ctx, ox, oy, rng) { fillNoisy(ctx, ox, oy, [100, 105, 110], 6, rng); },
  },
  antenna: {
    all(ctx, ox, oy, rng) {
      // Mostly transparent with a thin metal rod
      ctx.clearRect(ox, oy, TILE_SIZE, TILE_SIZE);
      fillNoisy(ctx, ox, oy, [90, 95, 100], 5, rng);
      // Central rod
      for (let py = 0; py < TILE_SIZE; py++) {
        ctx.fillStyle = rgbStr(vary([180, 185, 190], 5, rng));
        ctx.fillRect(ox + 7, oy + py, 2, 1);
      }
    }
  },
  building_core: {
    all(ctx, ox, oy, rng) {
      fillNoisy(ctx, ox, oy, [88, 110, 152], 8, rng);
      // Glowing center indicator
      for (let py = 5; py < 11; py++) {
        for (let px = 5; px < 11; px++) {
          ctx.fillStyle = rgbStr(vary([120, 235, 255], 8, rng));
          ctx.fillRect(ox + px, oy + py, 1, 1);
        }
      }
    }
  },
  building_wall: {
    all(ctx, ox, oy, rng) {
      fillNoisy(ctx, ox, oy, [175, 180, 188], 6, rng);
      // Panel seam
      for (let i = 0; i < TILE_SIZE; i++) {
        ctx.fillStyle = rgbStr(vary([128, 133, 140], 4, rng));
        ctx.fillRect(ox + i, oy + 8, 1, 1);
      }
    }
  },
  building_roof: {
    all(ctx, ox, oy, rng) {
      fillNoisy(ctx, ox, oy, [100, 110, 125], 8, rng);
    }
  },
};

// ---------------------------------------------------------------------------
// Atlas generation
// ---------------------------------------------------------------------------

/**
 * Draw one tile into the atlas canvas.
 * @param {CanvasRenderingContext2D} ctx
 * @param {number} atlasIndex - slot in the 32x32 grid
 * @param {string} blockName
 * @param {'top'|'side'|'bottom'} face
 * @param {function} rng
 */
function drawTile(ctx, atlasIndex, blockName, face, rng) {
  const col = atlasIndex % TILES_PER_ROW;
  const row = Math.floor(atlasIndex / TILES_PER_ROW);
  const ox = col * TILE_SIZE;
  const oy = row * TILE_SIZE;

  const gen = TEXTURE_GENERATORS[blockName];
  if (!gen) {
    // Fallback: magenta "missing texture" checkerboard
    for (let py = 0; py < TILE_SIZE; py++) {
      for (let px = 0; px < TILE_SIZE; px++) {
        const checker = ((px >> 2) + (py >> 2)) % 2 === 0;
        ctx.fillStyle = checker ? '#ff00ff' : '#000000';
        ctx.fillRect(ox + px, oy + py, 1, 1);
      }
    }
    return;
  }

  // Use face-specific generator if available, otherwise 'all'
  const fn = gen[face] || gen.all;
  if (fn) {
    fn(ctx, ox, oy, rng);
  }
}

/**
 * Create the procedural texture atlas.
 *
 * @param {(object|null)[]} blockRegistry - the BLOCKS array from BlockRegistry
 * @returns {{ texture: THREE.CanvasTexture, getUV: (atlasIndex: number) => { u0: number, v0: number, u1: number, v1: number } }}
 */
export function createTextureAtlas(blockRegistry) {
  const canvas = document.createElement('canvas');
  canvas.width = ATLAS_SIZE;
  canvas.height = ATLAS_SIZE;
  const ctx = canvas.getContext('2d');

  // Clear to transparent black
  ctx.clearRect(0, 0, ATLAS_SIZE, ATLAS_SIZE);

  const rng = mulberry32(42); // fixed seed for deterministic textures

  // Generate tiles for each defined block
  for (let id = 1; id < blockRegistry.length; id++) {
    const block = blockRegistry[id];
    if (!block) continue;

    const { name, textures } = block;
    if (!textures || textures.top < 0) continue;

    drawTile(ctx, textures.top,    name, 'top',    rng);
    drawTile(ctx, textures.side,   name, 'side',   rng);
    drawTile(ctx, textures.bottom, name, 'bottom', rng);
  }

  // Create Three.js texture
  const texture = new THREE.CanvasTexture(canvas);
  texture.magFilter = THREE.NearestFilter;
  texture.minFilter = THREE.NearestFilter;
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.needsUpdate = true;

  /**
   * Get UV coordinates for a given atlas slot index.
   * @param {number} atlasIndex
   * @returns {{ u0: number, v0: number, u1: number, v1: number }}
   */
  function getUV(atlasIndex) {
    const col = atlasIndex % TILES_PER_ROW;
    const row = Math.floor(atlasIndex / TILES_PER_ROW);
    const tileSize = 1 / TILES_PER_ROW;
    return {
      u0: col * tileSize,
      v0: row * tileSize,
      u1: (col + 1) * tileSize,
      v1: (row + 1) * tileSize,
    };
  }

  return { texture, getUV, canvas };
}
