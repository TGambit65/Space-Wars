/**
 * Block Registry — defines every block type in the voxel engine.
 *
 * Each block has:
 *   id          - Uint8 identifier (0-255)
 *   name        - unique string key
 *   solid       - whether the block has collision
 *   transparent - whether faces behind it should render
 *   emissive    - whether the block emits light
 *   breakable   - whether players can destroy it
 *   textures    - { top, side, bottom } atlas indices
 *
 * Atlas layout: 32x32 grid of 16x16px tiles (1024 slots).
 * Each block occupies 3 consecutive slots: id*3+0 (top), id*3+1 (side), id*3+2 (bottom).
 */

function tex(id) {
  return { top: id * 3, side: id * 3 + 1, bottom: id * 3 + 2 };
}

const BLOCK_DEFS = [
  { id: 0,  name: 'air',            solid: false, transparent: true,  emissive: false, breakable: false },
  { id: 1,  name: 'stone',          solid: true,  transparent: false, emissive: false, breakable: true  },
  { id: 2,  name: 'dirt',           solid: true,  transparent: false, emissive: false, breakable: true  },
  { id: 3,  name: 'grass',          solid: true,  transparent: false, emissive: false, breakable: true  },
  { id: 4,  name: 'sand',           solid: true,  transparent: false, emissive: false, breakable: true  },
  { id: 5,  name: 'water',          solid: false, transparent: true,  emissive: false, breakable: false },
  { id: 6,  name: 'ice',            solid: true,  transparent: false, emissive: false, breakable: true  },
  { id: 7,  name: 'lava',           solid: false, transparent: true,  emissive: true,  breakable: false },
  { id: 8,  name: 'crystal',        solid: true,  transparent: false, emissive: true,  breakable: true  },
  { id: 9,  name: 'swamp_mud',      solid: true,  transparent: false, emissive: false, breakable: true  },
  { id: 10, name: 'volcanic_rock',  solid: true,  transparent: false, emissive: false, breakable: true  },
  { id: 11, name: 'metal_plate',    solid: true,  transparent: false, emissive: false, breakable: true  },
  { id: 12, name: 'landing_pad',    solid: true,  transparent: false, emissive: false, breakable: false },
  { id: 13, name: 'highland_rock',  solid: true,  transparent: false, emissive: false, breakable: true  },
  { id: 14, name: 'wood_log',       solid: true,  transparent: false, emissive: false, breakable: true  },
  { id: 15, name: 'leaves',         solid: true,  transparent: true,  emissive: false, breakable: true  },
  { id: 16, name: 'ore_iron',       solid: true,  transparent: false, emissive: false, breakable: true  },
  { id: 17, name: 'ore_crystal',    solid: true,  transparent: false, emissive: false, breakable: true  },
  { id: 18, name: 'ore_fertile',    solid: true,  transparent: false, emissive: false, breakable: true  },
  { id: 19, name: 'ore_thermal',    solid: true,  transparent: false, emissive: true,  breakable: true  },
  { id: 20, name: 'wall',           solid: true,  transparent: false, emissive: false, breakable: true  },
  { id: 21, name: 'reinforced_wall',solid: true,  transparent: false, emissive: false, breakable: true  },
  { id: 22, name: 'floor',          solid: true,  transparent: false, emissive: false, breakable: true  },
  { id: 23, name: 'window',         solid: true,  transparent: true,  emissive: false, breakable: true  },
  { id: 24, name: 'door',           solid: false, transparent: true,  emissive: false, breakable: true  },
  { id: 25, name: 'lamp',           solid: true,  transparent: false, emissive: true,  breakable: true  },
  { id: 26, name: 'pipe',           solid: true,  transparent: false, emissive: false, breakable: true  },
  { id: 27, name: 'vent',           solid: true,  transparent: false, emissive: false, breakable: true  },
  { id: 28, name: 'terminal',       solid: true,  transparent: false, emissive: true,  breakable: true  },
  { id: 29, name: 'storage_crate',  solid: true,  transparent: false, emissive: false, breakable: true  },
  { id: 30, name: 'solar_panel',    solid: true,  transparent: false, emissive: false, breakable: true  },
  { id: 31, name: 'antenna',        solid: true,  transparent: false, emissive: false, breakable: true  },
  { id: 32, name: 'building_core',  solid: true,  transparent: false, emissive: true,  breakable: false },
  { id: 33, name: 'building_wall',  solid: true,  transparent: false, emissive: false, breakable: false },
  { id: 34, name: 'building_roof',  solid: true,  transparent: false, emissive: false, breakable: false },
];

// Build the BLOCKS array — index = block id for O(1) lookups
export const BLOCKS = new Array(256).fill(null);

for (const def of BLOCK_DEFS) {
  BLOCKS[def.id] = {
    ...def,
    textures: def.id === 0 ? { top: -1, side: -1, bottom: -1 } : tex(def.id),
  };
}

// Name-to-block lookup map
const NAME_MAP = new Map();
for (const def of BLOCK_DEFS) {
  NAME_MAP.set(def.name, BLOCKS[def.id]);
}

/**
 * Get a block definition by numeric ID.
 * Returns null for undefined IDs.
 */
export function getBlock(id) {
  return BLOCKS[id] || null;
}

/**
 * Get a block definition by its string name.
 * Returns null if no block with that name exists.
 */
export function getBlockByName(name) {
  return NAME_MAP.get(name) || null;
}

/**
 * Returns true if the block is transparent (faces behind it should render).
 * Air (0) and undefined blocks are treated as transparent.
 */
export function isTransparent(id) {
  const block = BLOCKS[id];
  return !block || block.transparent;
}

/**
 * Returns true if the block is solid (has collision).
 * Air (0) and undefined blocks are not solid.
 */
export function isSolid(id) {
  const block = BLOCKS[id];
  return block ? block.solid : false;
}

/**
 * Total number of defined block types (including air).
 */
export const BLOCK_COUNT = BLOCK_DEFS.length;
