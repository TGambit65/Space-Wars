/**
 * BuildingGenerator — converts 2D colony building placements into 3D voxel
 * structures for the Minecraft-style engine.
 *
 * Each colony building occupies one or more grid tiles on the colony surface.
 * Each grid tile corresponds to a single chunk (16x16 blocks). This module
 * provides procedural 3D templates for every building type and centers them
 * within their chunk footprint.
 *
 * Block IDs (from BlockRegistry.js):
 *   11  metal_plate        26  pipe
 *   12  landing_pad         27  vent
 *   23  window (transparent) 28  terminal (emissive)
 *   25  lamp (emissive)      29  storage_crate
 *   30  solar_panel          31  antenna
 *   32  building_core (emissive, non-breakable)
 *   33  building_wall (non-breakable)
 *   34  building_roof (non-breakable)
 */

import { CHUNK_SIZE } from './Chunk.js';

// ---------------------------------------------------------------------------
// Block ID constants — kept in sync with BlockRegistry
// ---------------------------------------------------------------------------

const B = {
  METAL_PLATE:   11,
  LANDING_PAD:   12,
  WINDOW:        23,
  LAMP:          25,
  PIPE:          26,
  VENT:          27,
  TERMINAL:      28,
  STORAGE_CRATE: 29,
  SOLAR_PANEL:   30,
  ANTENNA:       31,
  CORE:          32,
  WALL:          33,
  ROOF:          34,
};

// ---------------------------------------------------------------------------
// Helper: push a filled rectangle of blocks
// ---------------------------------------------------------------------------

function fillRect(blocks, bx, by, bz, w, h, d, blockId) {
  for (let dx = 0; dx < w; dx++) {
    for (let dy = 0; dy < h; dy++) {
      for (let dz = 0; dz < d; dz++) {
        blocks.push({ x: bx + dx, y: by + dy, z: bz + dz, blockId });
      }
    }
  }
}

function fillFloor(blocks, bx, by, bz, w, d, blockId) {
  fillRect(blocks, bx, by, bz, w, 1, d, blockId);
}

/**
 * Build hollow walls around a rectangular footprint (one layer thick).
 * Walls are `height` blocks tall starting at by+1 (floor is separate).
 */
function hollowWalls(blocks, bx, by, bz, w, d, height, wallId, windowId, windowRow) {
  for (let dy = 1; dy <= height; dy++) {
    const isWindowRow = windowId && dy === windowRow;
    const id = isWindowRow ? windowId : wallId;

    // North and south walls (full width)
    for (let dx = 0; dx < w; dx++) {
      blocks.push({ x: bx + dx, y: by + dy, z: bz, blockId: id });
      blocks.push({ x: bx + dx, y: by + dy, z: bz + d - 1, blockId: id });
    }
    // East and west walls (skip corners already placed)
    for (let dz = 1; dz < d - 1; dz++) {
      blocks.push({ x: bx, y: by + dy, z: bz + dz, blockId: id });
      blocks.push({ x: bx + w - 1, y: by + dy, z: bz + dz, blockId: id });
    }
  }
}

// ---------------------------------------------------------------------------
// Building templates
//
// Each template receives (bx, by, bz) — the world position of the building's
// bottom-left corner, where by is already surfaceY+1 (on top of terrain).
//
// Templates return an array of { x, y, z, blockId }.
// ---------------------------------------------------------------------------

const BUILDING_TEMPLATES = {

  // -----------------------------------------------------------------------
  // SURFACE_MINE — 2x1 footprint (6x4 blocks). Open pit with scaffolding.
  // -----------------------------------------------------------------------
  SURFACE_MINE(bx, by, bz) {
    const blocks = [];
    const W = 6, D = 4;

    // Platform floor
    fillFloor(blocks, bx, by, bz, W, D, B.METAL_PLATE);

    // Pit (carve a 4x2 hole in center, 2 blocks deep)
    for (let dx = 1; dx <= 4; dx++) {
      for (let dz = 1; dz <= 2; dz++) {
        // Replace floor with air (just don't add it; we overwrite)
        blocks.push({ x: bx + dx, y: by - 1, z: bz + dz, blockId: B.METAL_PLATE });
        blocks.push({ x: bx + dx, y: by - 2, z: bz + dz, blockId: B.METAL_PLATE });
      }
    }

    // Scaffolding pillars at corners
    for (let dy = 1; dy <= 5; dy++) {
      blocks.push({ x: bx, y: by + dy, z: bz, blockId: B.WALL });
      blocks.push({ x: bx + W - 1, y: by + dy, z: bz, blockId: B.WALL });
      blocks.push({ x: bx, y: by + dy, z: bz + D - 1, blockId: B.WALL });
      blocks.push({ x: bx + W - 1, y: by + dy, z: bz + D - 1, blockId: B.WALL });
    }

    // Top beams connecting pillars
    for (let dx = 0; dx < W; dx++) {
      blocks.push({ x: bx + dx, y: by + 6, z: bz, blockId: B.WALL });
      blocks.push({ x: bx + dx, y: by + 6, z: bz + D - 1, blockId: B.WALL });
    }
    for (let dz = 0; dz < D; dz++) {
      blocks.push({ x: bx, y: by + 6, z: bz + dz, blockId: B.WALL });
      blocks.push({ x: bx + W - 1, y: by + 6, z: bz + dz, blockId: B.WALL });
    }

    // Lamp under the beam
    blocks.push({ x: bx + 3, y: by + 5, z: bz + 2, blockId: B.LAMP });

    return blocks;
  },

  // -----------------------------------------------------------------------
  // HABITAT_MODULE — 2x2 footprint (8x8 blocks). Residential box with windows.
  // -----------------------------------------------------------------------
  HABITAT_MODULE(bx, by, bz) {
    const blocks = [];
    const W = 8, D = 8, H = 4;

    // Floor
    fillFloor(blocks, bx, by, bz, W, D, B.WALL);

    // Walls with windows on row 2
    hollowWalls(blocks, bx, by, bz, W, D, H, B.WALL, B.WINDOW, 2);

    // Door openings (remove center blocks on south wall at dy=1,2)
    // We add air back by simply not generating those — but since hollowWalls
    // already pushed them, we mark them. Instead, use a post-filter approach
    // or just add the door frame. For simplicity we leave the wall solid and
    // note that the door block (24) could be placed. Let's add a door.
    // Actually, let's keep it clean — no door, just windows. Players enter
    // through the colony surface UI, not by walking.

    // Interior lamps
    blocks.push({ x: bx + 2, y: by + H, z: bz + 2, blockId: B.LAMP });
    blocks.push({ x: bx + 5, y: by + H, z: bz + 5, blockId: B.LAMP });

    // Roof
    fillFloor(blocks, bx, by + H + 1, bz, W, D, B.ROOF);

    return blocks;
  },

  // -----------------------------------------------------------------------
  // SOLAR_ARRAY — 2x2 footprint (8x8 blocks). Elevated panels on pillars.
  // -----------------------------------------------------------------------
  SOLAR_ARRAY(bx, by, bz) {
    const blocks = [];
    const W = 8, D = 8;

    // Four support pillars (2 blocks tall)
    const pillarH = 3;
    const pillars = [[1, 1], [1, D - 2], [W - 2, 1], [W - 2, D - 2]];
    for (const [px, pz] of pillars) {
      for (let dy = 0; dy < pillarH; dy++) {
        blocks.push({ x: bx + px, y: by + dy, z: bz + pz, blockId: B.WALL });
      }
    }

    // Solar panel array (flat grid on top of pillars)
    for (let dx = 0; dx < W; dx++) {
      for (let dz = 0; dz < D; dz++) {
        blocks.push({ x: bx + dx, y: by + pillarH, z: bz + dz, blockId: B.SOLAR_PANEL });
      }
    }

    // Support cross-beams under panels
    for (let dx = 0; dx < W; dx++) {
      blocks.push({ x: bx + dx, y: by + pillarH - 1, z: bz + D / 2 - 1, blockId: B.METAL_PLATE });
      blocks.push({ x: bx + dx, y: by + pillarH - 1, z: bz + D / 2, blockId: B.METAL_PLATE });
    }

    return blocks;
  },

  // -----------------------------------------------------------------------
  // SPACEPORT — 3x3 footprint (12x12 blocks). Landing pad + control tower.
  // -----------------------------------------------------------------------
  SPACEPORT(bx, by, bz) {
    const blocks = [];
    const W = 12, D = 12;

    // Landing pad floor (10x10 centered)
    for (let dx = 1; dx < W - 1; dx++) {
      for (let dz = 1; dz < D - 1; dz++) {
        blocks.push({ x: bx + dx, y: by, z: bz + dz, blockId: B.LANDING_PAD });
      }
    }

    // Pad border
    for (let dx = 0; dx < W; dx++) {
      blocks.push({ x: bx + dx, y: by, z: bz, blockId: B.METAL_PLATE });
      blocks.push({ x: bx + dx, y: by, z: bz + D - 1, blockId: B.METAL_PLATE });
    }
    for (let dz = 0; dz < D; dz++) {
      blocks.push({ x: bx, y: by, z: bz + dz, blockId: B.METAL_PLATE });
      blocks.push({ x: bx + W - 1, y: by, z: bz + dz, blockId: B.METAL_PLATE });
    }

    // Corner lights on pad
    const corners = [[1, 1], [1, D - 2], [W - 2, 1], [W - 2, D - 2]];
    for (const [cx, cz] of corners) {
      blocks.push({ x: bx + cx, y: by + 1, z: bz + cz, blockId: B.LAMP });
    }

    // Control tower in the corner (3x3, 6 tall)
    const tx = bx, tz = bz;
    const towerW = 3, towerD = 3, towerH = 6;

    fillFloor(blocks, tx, by, tz, towerW, towerD, B.WALL);

    for (let dy = 1; dy <= towerH; dy++) {
      const isWindowRow = dy >= 4 && dy <= 5;
      // Pillar corners
      blocks.push({ x: tx, y: by + dy, z: tz, blockId: B.WALL });
      blocks.push({ x: tx + towerW - 1, y: by + dy, z: tz, blockId: B.WALL });
      blocks.push({ x: tx, y: by + dy, z: tz + towerD - 1, blockId: B.WALL });
      blocks.push({ x: tx + towerW - 1, y: by + dy, z: tz + towerD - 1, blockId: B.WALL });

      // Mid-wall segments
      const midId = isWindowRow ? B.WINDOW : B.WALL;
      blocks.push({ x: tx + 1, y: by + dy, z: tz, blockId: midId });
      blocks.push({ x: tx + 1, y: by + dy, z: tz + towerD - 1, blockId: midId });
      blocks.push({ x: tx, y: by + dy, z: tz + 1, blockId: midId });
      blocks.push({ x: tx + towerW - 1, y: by + dy, z: tz + 1, blockId: midId });
    }

    // Tower roof
    fillFloor(blocks, tx, by + towerH + 1, tz, towerW, towerD, B.ROOF);

    // Antenna on top of tower
    for (let dy = towerH + 2; dy <= towerH + 4; dy++) {
      blocks.push({ x: tx + 1, y: by + dy, z: tz + 1, blockId: B.ANTENNA });
    }

    // Tower interior lamp
    blocks.push({ x: tx + 1, y: by + towerH, z: tz + 1, blockId: B.LAMP });

    return blocks;
  },

  // -----------------------------------------------------------------------
  // DEFENSE_GRID — 1x1 footprint (5x5 blocks). Small turret platform.
  // -----------------------------------------------------------------------
  DEFENSE_GRID(bx, by, bz) {
    const blocks = [];
    const W = 5, D = 5;

    // Base platform
    fillFloor(blocks, bx, by, bz, W, D, B.METAL_PLATE);

    // Central pillar (3 blocks tall)
    for (let dy = 1; dy <= 3; dy++) {
      blocks.push({ x: bx + 2, y: by + dy, z: bz + 2, blockId: B.WALL });
    }

    // Turret head (3x3)
    for (let dx = 1; dx <= 3; dx++) {
      for (let dz = 1; dz <= 3; dz++) {
        blocks.push({ x: bx + dx, y: by + 4, z: bz + dz, blockId: B.WALL });
      }
    }
    // Emissive core in turret
    blocks.push({ x: bx + 2, y: by + 5, z: bz + 2, blockId: B.CORE });

    // Corner guards
    blocks.push({ x: bx, y: by + 1, z: bz, blockId: B.WALL });
    blocks.push({ x: bx + W - 1, y: by + 1, z: bz, blockId: B.WALL });
    blocks.push({ x: bx, y: by + 1, z: bz + D - 1, blockId: B.WALL });
    blocks.push({ x: bx + W - 1, y: by + 1, z: bz + D - 1, blockId: B.WALL });

    return blocks;
  },

  // -----------------------------------------------------------------------
  // RESEARCH_LAB — 2x2 footprint (8x8 blocks). Taller building with terminals.
  // -----------------------------------------------------------------------
  RESEARCH_LAB(bx, by, bz) {
    const blocks = [];
    const W = 8, D = 8, H = 5;

    // Floor
    fillFloor(blocks, bx, by, bz, W, D, B.WALL);

    // Walls with windows on rows 2 and 3 (all four sides)
    for (let dy = 1; dy <= H; dy++) {
      const isWindowRow = dy === 2 || dy === 3;
      const id = isWindowRow ? B.WINDOW : B.WALL;

      for (let dx = 0; dx < W; dx++) {
        blocks.push({ x: bx + dx, y: by + dy, z: bz, blockId: id });
        blocks.push({ x: bx + dx, y: by + dy, z: bz + D - 1, blockId: id });
      }
      for (let dz = 1; dz < D - 1; dz++) {
        blocks.push({ x: bx, y: by + dy, z: bz + dz, blockId: id });
        blocks.push({ x: bx + W - 1, y: by + dy, z: bz + dz, blockId: id });
      }
    }

    // Roof
    fillFloor(blocks, bx, by + H + 1, bz, W, D, B.ROOF);

    // Interior terminals along the walls
    blocks.push({ x: bx + 2, y: by + 1, z: bz + 1, blockId: B.TERMINAL });
    blocks.push({ x: bx + 4, y: by + 1, z: bz + 1, blockId: B.TERMINAL });
    blocks.push({ x: bx + 6, y: by + 1, z: bz + 1, blockId: B.TERMINAL });

    // Interior lamps
    blocks.push({ x: bx + 2, y: by + H, z: bz + 4, blockId: B.LAMP });
    blocks.push({ x: bx + 5, y: by + H, z: bz + 4, blockId: B.LAMP });

    // Antenna on roof
    blocks.push({ x: bx + 4, y: by + H + 2, z: bz + 4, blockId: B.ANTENNA });
    blocks.push({ x: bx + 4, y: by + H + 3, z: bz + 4, blockId: B.ANTENNA });

    return blocks;
  },

  // -----------------------------------------------------------------------
  // REFINERY — 2x2 footprint (8x8 blocks). Industrial with pipes and vents.
  // -----------------------------------------------------------------------
  REFINERY(bx, by, bz) {
    const blocks = [];
    const W = 8, D = 8, H = 5;

    // Floor
    fillFloor(blocks, bx, by, bz, W, D, B.METAL_PLATE);

    // Walls (no windows — industrial)
    hollowWalls(blocks, bx, by, bz, W, D, H, B.WALL, null, 0);

    // Roof
    fillFloor(blocks, bx, by + H + 1, bz, W, D, B.ROOF);

    // Vent stacks on the roof (two chimney-like structures)
    for (let dy = H + 2; dy <= H + 4; dy++) {
      blocks.push({ x: bx + 2, y: by + dy, z: bz + 2, blockId: B.PIPE });
      blocks.push({ x: bx + 5, y: by + dy, z: bz + 5, blockId: B.PIPE });
    }
    blocks.push({ x: bx + 2, y: by + H + 5, z: bz + 2, blockId: B.VENT });
    blocks.push({ x: bx + 5, y: by + H + 5, z: bz + 5, blockId: B.VENT });

    // External pipe runs along one side
    for (let dz = 0; dz < D; dz++) {
      blocks.push({ x: bx + W, y: by + 2, z: bz + dz, blockId: B.PIPE });
    }

    // Interior machinery
    blocks.push({ x: bx + 3, y: by + 1, z: bz + 3, blockId: B.CORE });
    blocks.push({ x: bx + 4, y: by + 1, z: bz + 4, blockId: B.CORE });

    // Interior lamp
    blocks.push({ x: bx + 4, y: by + H, z: bz + 2, blockId: B.LAMP });

    return blocks;
  },

  // -----------------------------------------------------------------------
  // POWER_PLANT / FUSION_REACTOR / GEOTHERMAL_PLANT — 2x2 (8x8).
  // Building with glowing reactor core.
  // -----------------------------------------------------------------------
  POWER_PLANT(bx, by, bz) {
    const blocks = [];
    const W = 8, D = 8, H = 5;

    // Floor
    fillFloor(blocks, bx, by, bz, W, D, B.METAL_PLATE);

    // Reinforced walls
    hollowWalls(blocks, bx, by, bz, W, D, H, B.WALL, null, 0);

    // Roof
    fillFloor(blocks, bx, by + H + 1, bz, W, D, B.ROOF);

    // Central reactor core (2x2x3 emissive column)
    for (let dy = 1; dy <= 3; dy++) {
      blocks.push({ x: bx + 3, y: by + dy, z: bz + 3, blockId: B.CORE });
      blocks.push({ x: bx + 4, y: by + dy, z: bz + 3, blockId: B.CORE });
      blocks.push({ x: bx + 3, y: by + dy, z: bz + 4, blockId: B.CORE });
      blocks.push({ x: bx + 4, y: by + dy, z: bz + 4, blockId: B.CORE });
    }

    // Pipes from core to walls
    for (let dx = 1; dx <= 2; dx++) {
      blocks.push({ x: bx + dx, y: by + 2, z: bz + 3, blockId: B.PIPE });
      blocks.push({ x: bx + 5 + dx, y: by + 2, z: bz + 4, blockId: B.PIPE });
    }
    for (let dz = 1; dz <= 2; dz++) {
      blocks.push({ x: bx + 3, y: by + 2, z: bz + dz, blockId: B.PIPE });
      blocks.push({ x: bx + 4, y: by + 2, z: bz + 5 + dz, blockId: B.PIPE });
    }

    // Roof vents
    blocks.push({ x: bx + 3, y: by + H + 2, z: bz + 3, blockId: B.VENT });
    blocks.push({ x: bx + 4, y: by + H + 2, z: bz + 4, blockId: B.VENT });

    return blocks;
  },

  // -----------------------------------------------------------------------
  // STORAGE_DEPOT — 2x1 footprint (6x4 blocks). Low warehouse with crates.
  // -----------------------------------------------------------------------
  STORAGE_DEPOT(bx, by, bz) {
    const blocks = [];
    const W = 6, D = 4, H = 3;

    // Floor
    fillFloor(blocks, bx, by, bz, W, D, B.METAL_PLATE);

    // Walls (low, no windows)
    hollowWalls(blocks, bx, by, bz, W, D, H, B.WALL, null, 0);

    // Roof
    fillFloor(blocks, bx, by + H + 1, bz, W, D, B.ROOF);

    // Storage crates inside
    blocks.push({ x: bx + 1, y: by + 1, z: bz + 1, blockId: B.STORAGE_CRATE });
    blocks.push({ x: bx + 2, y: by + 1, z: bz + 1, blockId: B.STORAGE_CRATE });
    blocks.push({ x: bx + 3, y: by + 1, z: bz + 1, blockId: B.STORAGE_CRATE });
    blocks.push({ x: bx + 4, y: by + 1, z: bz + 1, blockId: B.STORAGE_CRATE });
    blocks.push({ x: bx + 1, y: by + 1, z: bz + 2, blockId: B.STORAGE_CRATE });
    blocks.push({ x: bx + 2, y: by + 1, z: bz + 2, blockId: B.STORAGE_CRATE });
    // Stack some on top
    blocks.push({ x: bx + 1, y: by + 2, z: bz + 1, blockId: B.STORAGE_CRATE });
    blocks.push({ x: bx + 2, y: by + 2, z: bz + 1, blockId: B.STORAGE_CRATE });

    // Interior lamp
    blocks.push({ x: bx + 3, y: by + H, z: bz + 2, blockId: B.LAMP });

    return blocks;
  },

  // -----------------------------------------------------------------------
  // COMM_TOWER — 1x1 footprint (4x4 blocks). Tall thin antenna structure.
  // -----------------------------------------------------------------------
  COMM_TOWER(bx, by, bz) {
    const blocks = [];

    // Base pad
    fillFloor(blocks, bx, by, bz, 4, 4, B.METAL_PLATE);

    // Central column (10 blocks tall)
    const towerH = 10;
    for (let dy = 1; dy <= towerH; dy++) {
      blocks.push({ x: bx + 1, y: by + dy, z: bz + 1, blockId: B.WALL });
      blocks.push({ x: bx + 2, y: by + dy, z: bz + 2, blockId: B.WALL });
    }

    // Cross-arms at middle and top
    const arms = [Math.floor(towerH / 2), towerH];
    for (const armY of arms) {
      blocks.push({ x: bx, y: by + armY, z: bz + 1, blockId: B.METAL_PLATE });
      blocks.push({ x: bx + 3, y: by + armY, z: bz + 1, blockId: B.METAL_PLATE });
      blocks.push({ x: bx + 1, y: by + armY, z: bz, blockId: B.METAL_PLATE });
      blocks.push({ x: bx + 1, y: by + armY, z: bz + 3, blockId: B.METAL_PLATE });
      blocks.push({ x: bx, y: by + armY, z: bz + 2, blockId: B.METAL_PLATE });
      blocks.push({ x: bx + 3, y: by + armY, z: bz + 2, blockId: B.METAL_PLATE });
      blocks.push({ x: bx + 2, y: by + armY, z: bz, blockId: B.METAL_PLATE });
      blocks.push({ x: bx + 2, y: by + armY, z: bz + 3, blockId: B.METAL_PLATE });
    }

    // Antenna tip
    blocks.push({ x: bx + 1, y: by + towerH + 1, z: bz + 1, blockId: B.ANTENNA });
    blocks.push({ x: bx + 2, y: by + towerH + 1, z: bz + 2, blockId: B.ANTENNA });
    blocks.push({ x: bx + 1, y: by + towerH + 2, z: bz + 2, blockId: B.ANTENNA });

    // Blinking light at top
    blocks.push({ x: bx + 2, y: by + towerH + 2, z: bz + 1, blockId: B.LAMP });

    return blocks;
  },

  // -----------------------------------------------------------------------
  // DEEP_CORE_DRILL — 2x2 footprint (8x8). Upgraded mine with deeper pit.
  // -----------------------------------------------------------------------
  DEEP_CORE_DRILL(bx, by, bz) {
    const blocks = [];
    const W = 8, D = 8;

    // Platform
    fillFloor(blocks, bx, by, bz, W, D, B.METAL_PLATE);

    // Drill derrick — tall scaffolding in center
    for (let dy = 1; dy <= 8; dy++) {
      blocks.push({ x: bx + 2, y: by + dy, z: bz + 2, blockId: B.WALL });
      blocks.push({ x: bx + 5, y: by + dy, z: bz + 2, blockId: B.WALL });
      blocks.push({ x: bx + 2, y: by + dy, z: bz + 5, blockId: B.WALL });
      blocks.push({ x: bx + 5, y: by + dy, z: bz + 5, blockId: B.WALL });
    }

    // Cross-braces at intervals
    for (const armY of [3, 6]) {
      for (let dx = 3; dx <= 4; dx++) {
        blocks.push({ x: bx + dx, y: by + armY, z: bz + 2, blockId: B.METAL_PLATE });
        blocks.push({ x: bx + dx, y: by + armY, z: bz + 5, blockId: B.METAL_PLATE });
      }
      for (let dz = 3; dz <= 4; dz++) {
        blocks.push({ x: bx + 2, y: by + armY, z: bz + dz, blockId: B.METAL_PLATE });
        blocks.push({ x: bx + 5, y: by + armY, z: bz + dz, blockId: B.METAL_PLATE });
      }
    }

    // Top cap
    for (let dx = 2; dx <= 5; dx++) {
      for (let dz = 2; dz <= 5; dz++) {
        blocks.push({ x: bx + dx, y: by + 9, z: bz + dz, blockId: B.ROOF });
      }
    }

    // Drill bit (core block in center going down)
    blocks.push({ x: bx + 3, y: by + 1, z: bz + 3, blockId: B.CORE });
    blocks.push({ x: bx + 4, y: by + 1, z: bz + 4, blockId: B.CORE });
    blocks.push({ x: bx + 3, y: by, z: bz + 4, blockId: B.CORE });
    blocks.push({ x: bx + 4, y: by, z: bz + 3, blockId: B.CORE });

    // Lamp
    blocks.push({ x: bx + 3, y: by + 8, z: bz + 3, blockId: B.LAMP });

    return blocks;
  },

  // -----------------------------------------------------------------------
  // QUANTUM_EXTRACTOR — 2x2 (8x8). Advanced mine with emissive tech.
  // -----------------------------------------------------------------------
  QUANTUM_EXTRACTOR(bx, by, bz) {
    const blocks = [];
    const W = 8, D = 8, H = 6;

    // Floor
    fillFloor(blocks, bx, by, bz, W, D, B.METAL_PLATE);

    // Walls with windows
    hollowWalls(blocks, bx, by, bz, W, D, H, B.WALL, B.WINDOW, 3);

    // Roof
    fillFloor(blocks, bx, by + H + 1, bz, W, D, B.ROOF);

    // Central quantum core (emissive column)
    for (let dy = 1; dy <= H; dy++) {
      blocks.push({ x: bx + 3, y: by + dy, z: bz + 3, blockId: B.CORE });
      blocks.push({ x: bx + 4, y: by + dy, z: bz + 4, blockId: B.CORE });
    }

    // Surrounding terminals
    blocks.push({ x: bx + 2, y: by + 1, z: bz + 3, blockId: B.TERMINAL });
    blocks.push({ x: bx + 5, y: by + 1, z: bz + 4, blockId: B.TERMINAL });
    blocks.push({ x: bx + 3, y: by + 1, z: bz + 2, blockId: B.TERMINAL });
    blocks.push({ x: bx + 4, y: by + 1, z: bz + 5, blockId: B.TERMINAL });

    // Antenna on roof
    blocks.push({ x: bx + 4, y: by + H + 2, z: bz + 4, blockId: B.ANTENNA });
    blocks.push({ x: bx + 4, y: by + H + 3, z: bz + 4, blockId: B.ANTENNA });

    return blocks;
  },

  // -----------------------------------------------------------------------
  // WATER_PUMP — 2x1 footprint (6x4). Small pump station.
  // -----------------------------------------------------------------------
  WATER_PUMP(bx, by, bz) {
    const blocks = [];
    const W = 6, D = 4, H = 3;

    fillFloor(blocks, bx, by, bz, W, D, B.METAL_PLATE);
    hollowWalls(blocks, bx, by, bz, W, D, H, B.WALL, null, 0);
    fillFloor(blocks, bx, by + H + 1, bz, W, D, B.ROOF);

    // Pipe machinery
    for (let dx = 1; dx <= 4; dx++) {
      blocks.push({ x: bx + dx, y: by + 1, z: bz + 1, blockId: B.PIPE });
      blocks.push({ x: bx + dx, y: by + 1, z: bz + 2, blockId: B.PIPE });
    }
    // Core pump
    blocks.push({ x: bx + 3, y: by + 2, z: bz + 1, blockId: B.CORE });

    return blocks;
  },

  // -----------------------------------------------------------------------
  // DEEP_WELL — 2x2 (8x8). Upgraded water pump.
  // -----------------------------------------------------------------------
  DEEP_WELL(bx, by, bz) {
    const blocks = [];
    const W = 8, D = 8, H = 4;

    fillFloor(blocks, bx, by, bz, W, D, B.METAL_PLATE);
    hollowWalls(blocks, bx, by, bz, W, D, H, B.WALL, null, 0);
    fillFloor(blocks, bx, by + H + 1, bz, W, D, B.ROOF);

    // Internal pipe network
    for (let dz = 1; dz < D - 1; dz++) {
      blocks.push({ x: bx + 2, y: by + 1, z: bz + dz, blockId: B.PIPE });
      blocks.push({ x: bx + 5, y: by + 1, z: bz + dz, blockId: B.PIPE });
    }
    blocks.push({ x: bx + 3, y: by + 1, z: bz + 3, blockId: B.CORE });
    blocks.push({ x: bx + 4, y: by + 1, z: bz + 4, blockId: B.CORE });
    blocks.push({ x: bx + 4, y: by + 3, z: bz + 4, blockId: B.LAMP });

    return blocks;
  },

  // -----------------------------------------------------------------------
  // CRYO_HARVESTER — 2x2 (8x8). Advanced water extraction.
  // -----------------------------------------------------------------------
  CRYO_HARVESTER(bx, by, bz) {
    const blocks = [];
    const W = 8, D = 8, H = 5;

    fillFloor(blocks, bx, by, bz, W, D, B.METAL_PLATE);
    hollowWalls(blocks, bx, by, bz, W, D, H, B.WALL, B.WINDOW, 3);
    fillFloor(blocks, bx, by + H + 1, bz, W, D, B.ROOF);

    // Central cryo core
    for (let dy = 1; dy <= 3; dy++) {
      blocks.push({ x: bx + 3, y: by + dy, z: bz + 3, blockId: B.CORE });
      blocks.push({ x: bx + 4, y: by + dy, z: bz + 4, blockId: B.CORE });
    }

    // Pipe runs
    for (let dx = 1; dx <= 6; dx++) {
      blocks.push({ x: bx + dx, y: by + 2, z: bz + 1, blockId: B.PIPE });
      blocks.push({ x: bx + dx, y: by + 2, z: bz + 6, blockId: B.PIPE });
    }

    blocks.push({ x: bx + 4, y: by + H, z: bz + 4, blockId: B.LAMP });

    return blocks;
  },

  // -----------------------------------------------------------------------
  // HYDROPONIC_FARM — 2x1 footprint (6x4). Low greenhouse with windows.
  // -----------------------------------------------------------------------
  HYDROPONIC_FARM(bx, by, bz) {
    const blocks = [];
    const W = 6, D = 4, H = 3;

    fillFloor(blocks, bx, by, bz, W, D, B.WALL);

    // Walls — mostly windows for light
    for (let dy = 1; dy <= H; dy++) {
      const id = dy <= 2 ? B.WINDOW : B.WALL;
      for (let dx = 0; dx < W; dx++) {
        blocks.push({ x: bx + dx, y: by + dy, z: bz, blockId: id });
        blocks.push({ x: bx + dx, y: by + dy, z: bz + D - 1, blockId: id });
      }
      for (let dz = 1; dz < D - 1; dz++) {
        blocks.push({ x: bx, y: by + dy, z: bz + dz, blockId: id });
        blocks.push({ x: bx + W - 1, y: by + dy, z: bz + dz, blockId: id });
      }
    }

    // Glass roof
    fillFloor(blocks, bx, by + H + 1, bz, W, D, B.WINDOW);

    // Grow lamps
    blocks.push({ x: bx + 2, y: by + H, z: bz + 2, blockId: B.LAMP });
    blocks.push({ x: bx + 4, y: by + H, z: bz + 1, blockId: B.LAMP });

    return blocks;
  },

  // -----------------------------------------------------------------------
  // ENTERTAINMENT_COMPLEX — 2x2 (8x8). Flashy building with lots of lights.
  // -----------------------------------------------------------------------
  ENTERTAINMENT_COMPLEX(bx, by, bz) {
    const blocks = [];
    const W = 8, D = 8, H = 5;

    fillFloor(blocks, bx, by, bz, W, D, B.WALL);
    hollowWalls(blocks, bx, by, bz, W, D, H, B.WALL, B.WINDOW, 2);
    fillFloor(blocks, bx, by + H + 1, bz, W, D, B.ROOF);

    // Lots of lamps for ambiance
    for (let dx = 2; dx <= 5; dx += 3) {
      for (let dz = 2; dz <= 5; dz += 3) {
        blocks.push({ x: bx + dx, y: by + H, z: bz + dz, blockId: B.LAMP });
      }
    }

    // Decorative sign on top (lamp strip)
    for (let dx = 2; dx <= 5; dx++) {
      blocks.push({ x: bx + dx, y: by + H + 2, z: bz, blockId: B.LAMP });
    }

    return blocks;
  },

  // -----------------------------------------------------------------------
  // COMPONENT_FACTORY — 3x2 footprint (10x8). Large manufacturing building.
  // -----------------------------------------------------------------------
  COMPONENT_FACTORY(bx, by, bz) {
    const blocks = [];
    const W = 10, D = 8, H = 5;

    fillFloor(blocks, bx, by, bz, W, D, B.METAL_PLATE);
    hollowWalls(blocks, bx, by, bz, W, D, H, B.WALL, null, 0);
    fillFloor(blocks, bx, by + H + 1, bz, W, D, B.ROOF);

    // Machinery rows (terminals along assembly line)
    for (let dx = 2; dx <= 7; dx += 2) {
      blocks.push({ x: bx + dx, y: by + 1, z: bz + 3, blockId: B.TERMINAL });
      blocks.push({ x: bx + dx, y: by + 1, z: bz + 4, blockId: B.TERMINAL });
    }

    // Pipes overhead
    for (let dx = 1; dx < W - 1; dx++) {
      blocks.push({ x: bx + dx, y: by + 4, z: bz + 2, blockId: B.PIPE });
      blocks.push({ x: bx + dx, y: by + 4, z: bz + 5, blockId: B.PIPE });
    }

    // Vent stacks
    blocks.push({ x: bx + 3, y: by + H + 2, z: bz + 2, blockId: B.VENT });
    blocks.push({ x: bx + 7, y: by + H + 2, z: bz + 5, blockId: B.VENT });

    // Lamps
    blocks.push({ x: bx + 3, y: by + H, z: bz + 4, blockId: B.LAMP });
    blocks.push({ x: bx + 7, y: by + H, z: bz + 4, blockId: B.LAMP });

    return blocks;
  },

  // -----------------------------------------------------------------------
  // CHEMICAL_PLANT — 3x2 footprint (10x8). Industrial processing.
  // -----------------------------------------------------------------------
  CHEMICAL_PLANT(bx, by, bz) {
    const blocks = [];
    const W = 10, D = 8, H = 5;

    fillFloor(blocks, bx, by, bz, W, D, B.METAL_PLATE);
    hollowWalls(blocks, bx, by, bz, W, D, H, B.WALL, null, 0);
    fillFloor(blocks, bx, by + H + 1, bz, W, D, B.ROOF);

    // Storage tanks (pipe columns)
    const tanks = [[2, 2], [2, 5], [5, 3], [7, 2], [7, 5]];
    for (const [tx, tz] of tanks) {
      for (let dy = 1; dy <= 4; dy++) {
        blocks.push({ x: bx + tx, y: by + dy, z: bz + tz, blockId: B.PIPE });
      }
    }

    // Connecting pipes
    for (let dx = 3; dx <= 6; dx++) {
      blocks.push({ x: bx + dx, y: by + 3, z: bz + 3, blockId: B.PIPE });
    }

    // Vents
    blocks.push({ x: bx + 2, y: by + H + 2, z: bz + 2, blockId: B.VENT });
    blocks.push({ x: bx + 7, y: by + H + 2, z: bz + 5, blockId: B.VENT });

    // Lamps
    blocks.push({ x: bx + 5, y: by + H, z: bz + 4, blockId: B.LAMP });

    return blocks;
  },

  // -----------------------------------------------------------------------
  // ORBITAL_DEFENSE — 2x2 (8x8). Missile battery / defense structure.
  // -----------------------------------------------------------------------
  ORBITAL_DEFENSE(bx, by, bz) {
    const blocks = [];
    const W = 8, D = 8;

    // Armored base
    fillFloor(blocks, bx, by, bz, W, D, B.WALL);

    // Central silo (round-ish)
    for (let dy = 1; dy <= 5; dy++) {
      for (let dx = 2; dx <= 5; dx++) {
        blocks.push({ x: bx + dx, y: by + dy, z: bz + 2, blockId: B.WALL });
        blocks.push({ x: bx + dx, y: by + dy, z: bz + 5, blockId: B.WALL });
      }
      for (let dz = 3; dz <= 4; dz++) {
        blocks.push({ x: bx + 2, y: by + dy, z: bz + dz, blockId: B.WALL });
        blocks.push({ x: bx + 5, y: by + dy, z: bz + dz, blockId: B.WALL });
      }
    }

    // Silo cap
    for (let dx = 2; dx <= 5; dx++) {
      for (let dz = 2; dz <= 5; dz++) {
        blocks.push({ x: bx + dx, y: by + 6, z: bz + dz, blockId: B.ROOF });
      }
    }

    // Launcher rails on top
    blocks.push({ x: bx + 3, y: by + 7, z: bz + 3, blockId: B.METAL_PLATE });
    blocks.push({ x: bx + 4, y: by + 7, z: bz + 4, blockId: B.METAL_PLATE });
    blocks.push({ x: bx + 3, y: by + 8, z: bz + 3, blockId: B.ANTENNA });
    blocks.push({ x: bx + 4, y: by + 8, z: bz + 4, blockId: B.ANTENNA });

    // Interior core
    blocks.push({ x: bx + 3, y: by + 3, z: bz + 3, blockId: B.CORE });
    blocks.push({ x: bx + 4, y: by + 3, z: bz + 4, blockId: B.CORE });

    return blocks;
  },

  // -----------------------------------------------------------------------
  // SHIELD_GENERATOR — 2x2 (8x8). Dome-shaped shield emitter.
  // -----------------------------------------------------------------------
  SHIELD_GENERATOR(bx, by, bz) {
    const blocks = [];
    const W = 8, D = 8;

    // Base
    fillFloor(blocks, bx, by, bz, W, D, B.METAL_PLATE);

    // Octagonal walls (2 layers, then taper)
    // Layer 1-2: full 8x8 walls
    for (let dy = 1; dy <= 2; dy++) {
      for (let dx = 1; dx < W - 1; dx++) {
        blocks.push({ x: bx + dx, y: by + dy, z: bz, blockId: B.WALL });
        blocks.push({ x: bx + dx, y: by + dy, z: bz + D - 1, blockId: B.WALL });
      }
      for (let dz = 1; dz < D - 1; dz++) {
        blocks.push({ x: bx, y: by + dy, z: bz + dz, blockId: B.WALL });
        blocks.push({ x: bx + W - 1, y: by + dy, z: bz + dz, blockId: B.WALL });
      }
    }

    // Layer 3-4: tapered (6x6)
    for (let dy = 3; dy <= 4; dy++) {
      for (let dx = 2; dx <= 5; dx++) {
        blocks.push({ x: bx + dx, y: by + dy, z: bz + 1, blockId: B.WALL });
        blocks.push({ x: bx + dx, y: by + dy, z: bz + 6, blockId: B.WALL });
      }
      for (let dz = 2; dz <= 5; dz++) {
        blocks.push({ x: bx + 1, y: by + dy, z: bz + dz, blockId: B.WALL });
        blocks.push({ x: bx + 6, y: by + dy, z: bz + dz, blockId: B.WALL });
      }
    }

    // Dome cap (4x4)
    for (let dx = 2; dx <= 5; dx++) {
      for (let dz = 2; dz <= 5; dz++) {
        blocks.push({ x: bx + dx, y: by + 5, z: bz + dz, blockId: B.ROOF });
      }
    }

    // Central emitter core
    for (let dy = 1; dy <= 4; dy++) {
      blocks.push({ x: bx + 3, y: by + dy, z: bz + 3, blockId: B.CORE });
      blocks.push({ x: bx + 4, y: by + dy, z: bz + 4, blockId: B.CORE });
    }

    // Top emitter
    blocks.push({ x: bx + 3, y: by + 6, z: bz + 4, blockId: B.CORE });
    blocks.push({ x: bx + 4, y: by + 6, z: bz + 3, blockId: B.CORE });

    return blocks;
  },

  // -----------------------------------------------------------------------
  // GARRISON_BARRACKS — 2x2 (8x8). Military housing.
  // -----------------------------------------------------------------------
  GARRISON_BARRACKS(bx, by, bz) {
    const blocks = [];
    const W = 8, D = 8, H = 4;

    fillFloor(blocks, bx, by, bz, W, D, B.WALL);
    hollowWalls(blocks, bx, by, bz, W, D, H, B.WALL, B.WINDOW, 2);
    fillFloor(blocks, bx, by + H + 1, bz, W, D, B.ROOF);

    // Interior dividing wall
    for (let dy = 1; dy <= H; dy++) {
      for (let dz = 1; dz < D - 1; dz++) {
        blocks.push({ x: bx + 4, y: by + dy, z: bz + dz, blockId: B.WALL });
      }
    }

    // Lamps in each room
    blocks.push({ x: bx + 2, y: by + H, z: bz + 3, blockId: B.LAMP });
    blocks.push({ x: bx + 6, y: by + H, z: bz + 4, blockId: B.LAMP });

    return blocks;
  },

  // -----------------------------------------------------------------------
  // DEFAULT — generic box for unknown building types.
  // 6x6 footprint, 3 high walls, roof.
  // -----------------------------------------------------------------------
  DEFAULT(bx, by, bz) {
    const blocks = [];
    const W = 6, D = 6, H = 3;

    fillFloor(blocks, bx, by, bz, W, D, B.WALL);
    hollowWalls(blocks, bx, by, bz, W, D, H, B.WALL, B.WINDOW, 2);
    fillFloor(blocks, bx, by + H + 1, bz, W, D, B.ROOF);

    // Interior lamp
    blocks.push({ x: bx + 3, y: by + H, z: bz + 3, blockId: B.LAMP });

    return blocks;
  },
};

// Alias upgraded building types that share visual templates
BUILDING_TEMPLATES.GEOTHERMAL_PLANT = BUILDING_TEMPLATES.POWER_PLANT;
BUILDING_TEMPLATES.FUSION_REACTOR = BUILDING_TEMPLATES.POWER_PLANT;

// ---------------------------------------------------------------------------
// Footprint sizes (in grid tiles) — determines block-space width.
// Must stay in sync with server/src/config/index.js colonySurface.buildingFootprints
// ---------------------------------------------------------------------------

const FOOTPRINTS = {
  SURFACE_MINE:           { w: 2, h: 1 },
  DEEP_CORE_DRILL:        { w: 2, h: 2 },
  QUANTUM_EXTRACTOR:      { w: 2, h: 2 },
  WATER_PUMP:             { w: 2, h: 1 },
  DEEP_WELL:              { w: 2, h: 2 },
  CRYO_HARVESTER:         { w: 2, h: 2 },
  SOLAR_ARRAY:            { w: 2, h: 2 },
  GEOTHERMAL_PLANT:       { w: 2, h: 2 },
  FUSION_REACTOR:         { w: 2, h: 2 },
  HABITAT_MODULE:         { w: 2, h: 2 },
  HYDROPONIC_FARM:        { w: 2, h: 1 },
  RESEARCH_LAB:           { w: 2, h: 2 },
  SPACEPORT:              { w: 3, h: 3 },
  DEFENSE_GRID:           { w: 1, h: 1 },
  ENTERTAINMENT_COMPLEX:  { w: 2, h: 2 },
  REFINERY:               { w: 2, h: 2 },
  COMPONENT_FACTORY:      { w: 3, h: 2 },
  CHEMICAL_PLANT:         { w: 3, h: 2 },
  ORBITAL_DEFENSE:        { w: 2, h: 2 },
  SHIELD_GENERATOR:       { w: 2, h: 2 },
  GARRISON_BARRACKS:      { w: 2, h: 2 },
  // Conceptual types not in the config but available for future use
  POWER_PLANT:            { w: 2, h: 2 },
  STORAGE_DEPOT:          { w: 2, h: 1 },
  COMM_TOWER:             { w: 1, h: 1 },
};

/**
 * Compute the block-space width of a building template given its footprint.
 *
 * Scale rules:
 *   1x1 footprint →  4-6 blocks wide  (centered in 16x16 chunk)
 *   2x1 footprint →  6 blocks wide
 *   2x2 footprint →  8 blocks wide
 *   3x2 footprint → 10 blocks wide
 *   3x3 footprint → 12 blocks wide
 *
 * The template already generates at the appropriate block width, so we just
 * need to know how much space to center within.
 */
function getBuildingBlockSize(buildingType) {
  const fp = FOOTPRINTS[buildingType] || { w: 1, h: 1 };
  // Each footprint tile ≈ 4 blocks + 2 block padding
  // 1→4, 2→8, 3→12 (but clamped to fit in chunk)
  const blockW = Math.min(fp.w * 4, CHUNK_SIZE);
  const blockD = Math.min(fp.h * 4, CHUNK_SIZE);
  return { blockW, blockD };
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Convert colony building placements into 3D voxel block data.
 *
 * @param {Array<{ building_type: string, grid_x: number, grid_y: number }>} buildings
 *   Array of placed buildings from the colony surface data.
 *
 * @param {function(number, number): number} surfaceHeightFn
 *   Returns the surface Y coordinate at the given world (X, Z).
 *   This is the highest solid terrain block at that column.
 *
 * @returns {Array<{ x: number, y: number, z: number, blockId: number }>}
 *   All blocks to place for every building. Coordinates are in world space.
 */
export function generateBuildingBlocks(buildings, surfaceHeightFn) {
  const allBlocks = [];

  for (const building of buildings) {
    // Skip buildings that haven't been placed on the grid
    if (building.grid_x == null || building.grid_y == null) continue;

    const type = building.building_type;
    const template = BUILDING_TEMPLATES[type] || BUILDING_TEMPLATES.DEFAULT;

    // World origin of the chunk this building's top-left grid tile sits in
    const chunkOriginX = building.grid_x * CHUNK_SIZE;
    const chunkOriginZ = building.grid_y * CHUNK_SIZE;

    // Determine the total chunk space the building occupies
    const fp = FOOTPRINTS[type] || { w: 1, h: 1 };
    const totalChunkW = fp.w * CHUNK_SIZE;
    const totalChunkD = fp.h * CHUNK_SIZE;

    // Get the building's block-space size to center it
    const { blockW, blockD } = getBuildingBlockSize(type);
    const offsetX = Math.floor((totalChunkW - blockW) / 2);
    const offsetZ = Math.floor((totalChunkD - blockD) / 2);

    // Sample surface height at the center of the building's footprint
    const centerX = chunkOriginX + Math.floor(totalChunkW / 2);
    const centerZ = chunkOriginZ + Math.floor(totalChunkD / 2);
    const surfaceY = surfaceHeightFn(centerX, centerZ);

    // Building base sits one block above the surface
    const baseX = chunkOriginX + offsetX;
    const baseY = surfaceY + 1;
    const baseZ = chunkOriginZ + offsetZ;

    const blocks = template(baseX, baseY, baseZ);
    allBlocks.push(...blocks);
  }

  return allBlocks;
}

/**
 * Convenience: apply building blocks to a ChunkManager.
 *
 * @param {Array<{ x: number, y: number, z: number, blockId: number }>} blocks
 * @param {import('./ChunkManager.js').ChunkManager} chunkManager
 */
export function applyBuildingBlocks(blocks, chunkManager) {
  for (const { x, y, z, blockId } of blocks) {
    chunkManager.setBlock(x, y, z, blockId);
  }
}
