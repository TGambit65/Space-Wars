/**
 * Ship Interior Service — returns authored 2D deck templates for the new
 * ship interior viewer. Templates are deterministic per hull class so the
 * client can render a consistent, multi-deck layout.
 *
 * Tile codes:
 *   .  empty floor (passable)
 *   #  wall (impassable)
 *   w  reinforced wall
 *   o  window
 *   d  door (passable)
 *   c  console
 *   b  bed / crew bunk
 *   l  locker / storage
 *   x  airlock (interactable, exits)
 *   u  stairs up (interactable)
 *   s  stairs down (interactable)
 *   E  engineering console
 *   M  medical bay console
 *   B  bridge command console
 *   C  cargo bay floor (passable, decorative)
 *   W  weapons console
 *   R  reactor core (impassable, interactable)
 *   L  loot crate (derelict only, interactable)
 *   F  fire hazard (derelict only, damages player over time)
 *   V  vacuum breach (derelict only, pulls player toward nearest airlock)
 */

const HULL_CLASS = {
  Scout: 'small', Fighter: 'small', Corvette: 'small', Interceptor: 'small',
  'Merchant Cruiser': 'medium', Destroyer: 'medium', 'Mining Barge': 'medium',
  Explorer: 'medium', 'Insta Colony Ship': 'medium',
  Freighter: 'large', Carrier: 'large', 'Colony Ship': 'large', Battlecruiser: 'large',
};

// ---------- Small hull: 1 deck, 18x10 ----------
const SMALL = {
  hullClass: 'small',
  decks: [
    {
      id: 'main',
      name: 'Main Deck',
      width: 18,
      height: 10,
      tiles: [
        '##################',
        '#.....BBB.......o#',
        '#.....c.........o#',
        '#dddd...........d#',
        '#....##....EEE..d#',
        '#....##......c..#x',
        '#....##.........#x',
        '#bb..##.....llll#d',
        '#bb..d..........d#',
        '##################',
      ],
    },
  ],
};

// ---------- Medium hull: 2 decks, 22x12 ----------
const MEDIUM = {
  hullClass: 'medium',
  decks: [
    {
      id: 'command',
      name: 'Command Deck',
      width: 22,
      height: 12,
      tiles: [
        '######################',
        '#oo......BBBB......oo#',
        '#oo......c..c......oo#',
        '#........d..d........#',
        '#####....####....#####',
        'd...#....#..#....#...d',
        '#...#....#..#....#...#',
        '#bb.d....d..d....d.bb#',
        '#bb.#....#..#....#.bb#',
        '#####.....s.....######',
        '#......WW...EE.......#',
        '######################',
      ],
    },
    {
      id: 'engineering',
      name: 'Engineering Deck',
      width: 22,
      height: 12,
      tiles: [
        '######################',
        '#llll.....u.....llll#x',
        '#....................d',
        '#....EEE......MMM....#',
        '#....c..........c....#',
        '#....d..........d....#',
        '#####...########..####',
        '#......#CCCCCC#......#',
        '#......#CCCCCC#......#',
        '#......#CCCCCC#......#',
        '#......d......d......#',
        '######################',
      ],
    },
  ],
};

// ---------- Large hull: 3 decks, 26x14 ----------
const LARGE = {
  hullClass: 'large',
  decks: [
    {
      id: 'bridge',
      name: 'Bridge Deck',
      width: 26,
      height: 14,
      tiles: [
        '##########################',
        '#oooooo...BBBBBB...oooooo#',
        '#oooooo...c....c...oooooo#',
        '#.........d....d.........#',
        '#####...##########...#####',
        'd...d...#........#...d...d',
        '#...#...#...WW...#...#...#',
        '#bb.#...#...c....#...#.bb#',
        '#bb.d...#........d...d.bb#',
        '#####...##########...#####',
        '#...........s............#',
        '#......EE........MM......#',
        '#......c..........c......#',
        '##########################',
      ],
    },
    {
      id: 'crew',
      name: 'Crew Deck',
      width: 26,
      height: 14,
      tiles: [
        '##########################',
        '#bb.bb.bb.bb.bb.bb.bb.bb.#',
        '#bb.bb.bb.bb.bb.bb.bb.bb.#',
        '##d##d##d##d##d##d##d##d##',
        '#........................#',
        '#.....u..............s...#',
        '#........................#',
        '##d##d##....##....##d##d##',
        '#bb.bb.#.MMMM.....#.bb.bb#',
        '#bb.bb.#.cccc.....#.bb.bb#',
        '#bb.bb.d..........d.bb.bb#',
        '#bb.bb.#..........#.bb.bb#',
        '#......d..........d......#',
        '##########################',
      ],
    },
    {
      id: 'cargo',
      name: 'Cargo & Engineering',
      width: 26,
      height: 14,
      tiles: [
        '##########################',
        '#llll.....u.........llll#x',
        '#....####################d',
        '#....#CCCCCCCCCCCCCC#....#',
        '#....#CCCCCCCCCCCCCC#....#',
        '#.EEE#CCCCCCCCCCCCCC#WWW.#',
        '#..c.dCCCCCCCCCCCCCCd..c.#',
        '#....#CCCCCCCCCCCCCC#....#',
        '#....#CCCCCCCCCCCCCC#....#',
        '#....#####################',
        '#............RR..........#',
        '#............RR..........#',
        '#........................#',
        '##########################',
      ],
    },
  ],
};

const TEMPLATES = { small: SMALL, medium: MEDIUM, large: LARGE };

// Tile metadata used by client to render & interact.
const TILE_META = {
  '.': { kind: 'floor', passable: true, color: '#28324a' },
  '#': { kind: 'wall', passable: false, color: '#5a667a' },
  'w': { kind: 'reinforced_wall', passable: false, color: '#3d4658' },
  'o': { kind: 'window', passable: false, color: '#7ec3ff' },
  'd': { kind: 'door', passable: true, color: '#8b6b3a' },
  'c': { kind: 'console', passable: false, interactable: true, color: '#34d3ff', label: 'Control Console' },
  'b': { kind: 'bed', passable: false, color: '#6a4a3a' },
  'l': { kind: 'locker', passable: false, interactable: true, color: '#7a6750', label: 'Locker' },
  'x': { kind: 'airlock', passable: true, interactable: true, color: '#ff8a00', label: 'Airlock — Exit Ship', action: 'leave_ship' },
  'u': { kind: 'stairs_up', passable: true, interactable: true, color: '#ffd166', label: 'Stairs Up', action: 'deck_up' },
  's': { kind: 'stairs_down', passable: true, interactable: true, color: '#ffd166', label: 'Stairs Down', action: 'deck_down' },
  'E': { kind: 'engineering', passable: false, interactable: true, color: '#ff5e3a', label: 'Engineering Console', action: 'open_repair' },
  'M': { kind: 'medical', passable: false, interactable: true, color: '#74e3a4', label: 'Medical Bay', action: 'open_crew' },
  'B': { kind: 'bridge', passable: false, interactable: true, color: '#34d3ff', label: 'Bridge Console', action: 'open_navigation' },
  'C': { kind: 'cargo_floor', passable: true, color: '#3a4a5e' },
  'W': { kind: 'weapons', passable: false, interactable: true, color: '#ff7676', label: 'Weapons Control', action: 'open_combat' },
  'R': { kind: 'reactor', passable: false, interactable: true, color: '#ffae34', label: 'Reactor Core', action: 'open_status' },
  'L': { kind: 'loot', passable: true, interactable: true, color: '#ffd166', label: 'Loot Crate', action: 'loot_crate' },
  'F': { kind: 'fire', passable: true, hazard: 'fire', color: '#ff4422', label: 'Fire' },
  'V': { kind: 'breach', passable: true, hazard: 'breach', color: '#1a2a55', label: 'Hull Breach' },
};

// Per-hull-class loot tables. Weight controls how often each entry is rolled.
const LOOT_TABLES = {
  small: [
    { type: 'credits', weight: 5, min: 25, max: 120 },
    { type: 'commodity', weight: 4, min: 1, max: 4 },
    { type: 'component', weight: 1, tierMin: 1, tierMax: 1 },
  ],
  medium: [
    { type: 'credits', weight: 4, min: 80, max: 400 },
    { type: 'commodity', weight: 4, min: 2, max: 8 },
    { type: 'component', weight: 2, tierMin: 1, tierMax: 2 },
  ],
  large: [
    { type: 'credits', weight: 3, min: 250, max: 1200 },
    { type: 'commodity', weight: 4, min: 4, max: 14 },
    { type: 'component', weight: 3, tierMin: 1, tierMax: 3 },
  ],
};

function getHullClass(shipType) {
  return HULL_CLASS[shipType] || 'small';
}

/**
 * Build interior layout for a ship. Optional mode='derelict' decorates with
 * loot crates and damage indicators (using deterministic seed = ship_id).
 */
function buildInterior(ship, { mode = 'normal' } = {}) {
  const hullClass = getHullClass(ship.ship_type);
  const template = TEMPLATES[hullClass];
  const decks = template.decks.map((deck) => {
    // Validate every row matches declared width — fail loudly on authoring mistakes.
    if (deck.tiles.length !== deck.height) {
      throw new Error(`Deck "${deck.id}" has ${deck.tiles.length} rows, expected ${deck.height}`);
    }
    for (let i = 0; i < deck.tiles.length; i++) {
      if (deck.tiles[i].length !== deck.width) {
        throw new Error(`Deck "${deck.id}" row ${i} length=${deck.tiles[i].length}, expected ${deck.width}`);
      }
    }
    return {
      id: deck.id,
      name: deck.name,
      width: deck.width,
      height: deck.height,
      tiles: deck.tiles.map((row) => row.split('')),
    };
  });

  if (mode === 'derelict') {
    // Sprinkle loot crates and damage on each deck deterministically
    const seed = hashString(String(ship.ship_id || 'default'));
    let s = seed;
    const rand = () => {
      s = (s * 1664525 + 1013904223) | 0;
      return ((s >>> 0) % 1000) / 1000;
    };
    for (const deck of decks) {
      const placedLoot = Math.max(2, Math.floor(rand() * 6));
      for (let i = 0; i < placedLoot; i++) {
        for (let attempt = 0; attempt < 25; attempt++) {
          const x = Math.floor(rand() * deck.width);
          const y = Math.floor(rand() * deck.height);
          if (deck.tiles[y][x] === '.') {
            deck.tiles[y][x] = 'L';
            break;
          }
        }
      }
      // Damage walls into rubble (turn some walls into floor with debris flag)
      const damaged = Math.floor(rand() * 8) + 4;
      for (let i = 0; i < damaged; i++) {
        const x = Math.floor(rand() * deck.width);
        const y = Math.floor(rand() * deck.height);
        if (deck.tiles[y][x] === '#') deck.tiles[y][x] = 'w';
      }
      // Sprinkle fire hazards on floor tiles
      const fires = Math.floor(rand() * 4) + 2;
      for (let i = 0; i < fires; i++) {
        for (let attempt = 0; attempt < 20; attempt++) {
          const x = Math.floor(rand() * deck.width);
          const y = Math.floor(rand() * deck.height);
          if (deck.tiles[y][x] === '.') { deck.tiles[y][x] = 'F'; break; }
        }
      }
      // Sprinkle vacuum breaches on floor tiles
      const breaches = Math.floor(rand() * 3) + 1;
      for (let i = 0; i < breaches; i++) {
        for (let attempt = 0; attempt < 20; attempt++) {
          const x = Math.floor(rand() * deck.width);
          const y = Math.floor(rand() * deck.height);
          if (deck.tiles[y][x] === '.') { deck.tiles[y][x] = 'V'; break; }
        }
      }
    }
  }

  return {
    ship_id: ship.ship_id,
    ship_name: ship.name,
    ship_type: ship.ship_type,
    hull_class: hullClass,
    mode,
    decks,
    tile_meta: TILE_META,
  };
}

function hashString(str) {
  let h = 0;
  for (let i = 0; i < str.length; i++) {
    h = ((h << 5) - h + str.charCodeAt(i)) | 0;
  }
  return h;
}

/**
 * Deterministically roll a loot result for a single crate at (deckId, x, y) on
 * a derelict ship. The seed is derived from ship_id + deck + coords so the
 * same crate always rolls the same loot — this lets the server reject double
 * looting without a persistent table (the in-memory looted set is a separate
 * concern in the controller).
 *
 * Returns an object describing what to award; controller is responsible for
 * actually applying it (DB updates).
 */
function rollCrateLoot(ship, deckId, x, y) {
  const hullClass = getHullClass(ship.ship_type);
  const table = LOOT_TABLES[hullClass] || LOOT_TABLES.small;
  const seed = hashString(`${ship.ship_id || 'ship'}:${deckId}:${x}:${y}`);
  let s = seed | 0;
  const rand = () => {
    s = (s * 1664525 + 1013904223) | 0;
    return ((s >>> 0) % 1000000) / 1000000;
  };

  const totalWeight = table.reduce((sum, e) => sum + e.weight, 0);
  let pick = rand() * totalWeight;
  let entry = table[0];
  for (const e of table) {
    pick -= e.weight;
    if (pick <= 0) { entry = e; break; }
  }

  if (entry.type === 'credits') {
    const amount = entry.min + Math.floor(rand() * (entry.max - entry.min + 1));
    return { type: 'credits', amount };
  }
  if (entry.type === 'commodity') {
    const quantity = entry.min + Math.floor(rand() * (entry.max - entry.min + 1));
    return { type: 'commodity', quantity, _selector: rand() };
  }
  // component
  const tier = entry.tierMin + Math.floor(rand() * (entry.tierMax - entry.tierMin + 1));
  return { type: 'component', tier, _selector: rand() };
}

module.exports = {
  buildInterior,
  getHullClass,
  rollCrateLoot,
  TILE_META,
};
