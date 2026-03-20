import { getBlockByName } from './BlockRegistry.js';

const CHUNK_SIZE = 16;
const BASE_Y = 38;

function bid(name) {
  return getBlockByName(name)?.id ?? 0;
}

const BLOCK = {
  air: bid('air'),
  floor: bid('floor'),
  wall: bid('wall'),
  reinforced: bid('reinforced_wall'),
  window: bid('window'),
  lamp: bid('lamp'),
  terminal: bid('terminal'),
  crate: bid('storage_crate'),
  pipe: bid('pipe'),
  vent: bid('vent'),
  door: bid('door'),
  pad: bid('landing_pad'),
  plate: bid('metal_plate'),
  core: bid('building_core'),
  roof: bid('building_roof'),
};

function setBlock(map, x, y, z, blockId) {
  map.set(`${x},${y},${z}`, blockId);
}

function fillBox(map, x1, x2, y1, y2, z1, z2, blockId) {
  for (let x = x1; x <= x2; x += 1) {
    for (let y = y1; y <= y2; y += 1) {
      for (let z = z1; z <= z2; z += 1) {
        setBlock(map, x, y, z, blockId);
      }
    }
  }
}

function hollowRoom(map, bounds, blocks) {
  const {
    x1, x2, y1, y2, z1, z2,
  } = bounds;
  const {
    floor = BLOCK.floor,
    wall = BLOCK.wall,
    ceiling = BLOCK.roof,
  } = blocks || {};

  fillBox(map, x1, x2, y1, y1, z1, z2, floor);
  fillBox(map, x1, x2, y2, y2, z1, z2, ceiling);

  for (let y = y1 + 1; y < y2; y += 1) {
    for (let x = x1; x <= x2; x += 1) {
      setBlock(map, x, y, z1, wall);
      setBlock(map, x, y, z2, wall);
    }
    for (let z = z1; z <= z2; z += 1) {
      setBlock(map, x1, y, z, wall);
      setBlock(map, x2, y, z, wall);
    }
  }
}

function carveDoor(map, x, y, z, axis = 'z') {
  setBlock(map, x, y, z, BLOCK.door);
  setBlock(map, x, y + 1, z, BLOCK.door);
  if (axis === 'x') {
    setBlock(map, x, y + 2, z, BLOCK.window);
  } else {
    setBlock(map, x, y + 2, z, BLOCK.window);
  }
}

function addLightStrip(map, x1, x2, y, z, step = 2) {
  for (let x = x1; x <= x2; x += step) {
    setBlock(map, x, y, z, BLOCK.lamp);
  }
}

function addColumn(map, x, z, y1, y2, blockId = BLOCK.reinforced) {
  fillBox(map, x, x, y1, y2, z, z, blockId);
}

function createBaseBiomeGrid(size = 3, biome = 'open_sky') {
  return Array.from({ length: size }, () => Array.from({ length: size }, () => biome));
}

function createSceneBase({
  id,
  title,
  subtitle,
  profileId,
  markers,
  interactions,
  preview,
  spawn,
  seed = 4242,
  planetType = 'BlackHole',
  renderDistance = 2,
  serverDeltas,
}) {
  return {
    id,
    title,
    subtitle,
    profileId,
    engine: {
      planetType,
      seed,
      biomeGrid: createBaseBiomeGrid(),
      serverDeltas,
      spawnChunk: { cx: 0, cz: 0 },
      renderDistance,
      showWater: false,
    },
    spawn,
    preview,
    markers,
    interactions,
  };
}

function buildShipInteriorDeltas(ship) {
  const deltas = new Map();
  hollowRoom(deltas, { x1: 2, x2: 13, y1: BASE_Y, y2: BASE_Y + 5, z1: 2, z2: 13 }, {
    floor: BLOCK.floor,
    wall: BLOCK.wall,
    ceiling: BLOCK.roof,
  });

  hollowRoom(deltas, { x1: 4, x2: 11, y1: BASE_Y + 1, y2: BASE_Y + 4, z1: 4, z2: 6 }, {
    floor: BLOCK.plate,
    wall: BLOCK.reinforced,
    ceiling: BLOCK.reinforced,
  });

  carveDoor(deltas, 7, BASE_Y + 1, 2, 'z');
  carveDoor(deltas, 7, BASE_Y + 1, 13, 'z');

  addLightStrip(deltas, 3, 12, BASE_Y + 4, 3);
  addLightStrip(deltas, 3, 12, BASE_Y + 4, 12);
  addColumn(deltas, 4, 4, BASE_Y + 1, BASE_Y + 4);
  addColumn(deltas, 11, 4, BASE_Y + 1, BASE_Y + 4);
  addColumn(deltas, 4, 11, BASE_Y + 1, BASE_Y + 4);
  addColumn(deltas, 11, 11, BASE_Y + 1, BASE_Y + 4);

  fillBox(deltas, 5, 9, BASE_Y + 1, BASE_Y + 1, 7, 9, BLOCK.pad);
  fillBox(deltas, 6, 8, BASE_Y + 2, BASE_Y + 2, 8, 8, BLOCK.core);
  setBlock(deltas, 6, BASE_Y + 2, 4, BLOCK.terminal);
  setBlock(deltas, 7, BASE_Y + 2, 4, BLOCK.terminal);
  setBlock(deltas, 8, BASE_Y + 2, 4, BLOCK.terminal);
  setBlock(deltas, 10, BASE_Y + 1, 10, BLOCK.crate);
  setBlock(deltas, 10, BASE_Y + 2, 10, BLOCK.crate);
  setBlock(deltas, 3, BASE_Y + 2, 10, BLOCK.pipe);
  setBlock(deltas, 3, BASE_Y + 3, 10, BLOCK.pipe);
  setBlock(deltas, 3, BASE_Y + 4, 10, BLOCK.vent);

  // Observation windows
  setBlock(deltas, 2, BASE_Y + 2, 6, BLOCK.window);
  setBlock(deltas, 2, BASE_Y + 2, 7, BLOCK.window);
  setBlock(deltas, 13, BASE_Y + 2, 8, BLOCK.window);
  setBlock(deltas, 13, BASE_Y + 2, 9, BLOCK.window);

  return deltas;
}

function buildDerelictDeltas() {
  const deltas = new Map();
  hollowRoom(deltas, { x1: 1, x2: 14, y1: BASE_Y, y2: BASE_Y + 5, z1: 1, z2: 14 }, {
    floor: BLOCK.plate,
    wall: BLOCK.reinforced,
    ceiling: BLOCK.reinforced,
  });

  hollowRoom(deltas, { x1: 4, x2: 11, y1: BASE_Y + 1, y2: BASE_Y + 4, z1: 4, z2: 11 }, {
    floor: BLOCK.floor,
    wall: BLOCK.wall,
    ceiling: BLOCK.roof,
  });

  carveDoor(deltas, 7, BASE_Y + 1, 1, 'z');
  carveDoor(deltas, 7, BASE_Y + 1, 14, 'z');

  // Damage and collapse silhouettes
  fillBox(deltas, 10, 12, BASE_Y + 1, BASE_Y + 2, 5, 6, BLOCK.air);
  fillBox(deltas, 4, 5, BASE_Y + 3, BASE_Y + 4, 9, 10, BLOCK.air);
  setBlock(deltas, 11, BASE_Y + 1, 10, BLOCK.crate);
  setBlock(deltas, 10, BASE_Y + 1, 10, BLOCK.crate);
  setBlock(deltas, 4, BASE_Y + 1, 5, BLOCK.core);
  setBlock(deltas, 4, BASE_Y + 2, 5, BLOCK.terminal);
  setBlock(deltas, 9, BASE_Y + 1, 4, BLOCK.pipe);
  setBlock(deltas, 9, BASE_Y + 2, 4, BLOCK.pipe);
  setBlock(deltas, 9, BASE_Y + 3, 4, BLOCK.lamp);
  setBlock(deltas, 6, BASE_Y + 1, 9, BLOCK.crate);
  setBlock(deltas, 7, BASE_Y + 1, 9, BLOCK.crate);
  addLightStrip(deltas, 3, 12, BASE_Y + 4, 3, 3);

  return deltas;
}

export function createShipInteriorScene(ship, user) {
  const shipName = ship?.name || 'Scout';
  const sectorName = ship?.currentSector?.name || ship?.current_sector?.name || 'Transit Corridor';
  const deltas = buildShipInteriorDeltas(ship);

  const spawn = { x: 7.5, y: BASE_Y + 1.1, z: 10.5, yaw: 0.02, pitch: -0.02 };
  const preview = {
    position: { x: 7.5, y: BASE_Y + 4.3, z: 14.5 },
    target: { x: 7.5, y: BASE_Y + 2.2, z: 7.5 },
  };

  return createSceneBase({
    id: 'ship_interior',
    title: `${shipName} Interior`,
    subtitle: `Command deck in ${sectorName}`,
    profileId: 'ship_interior',
    seed: ship?.ship_id?.length || 4242,
    serverDeltas: deltas,
    spawn,
    preview,
    markers: [
      { key: 'bridge', label: 'Bridge', x: 7.5, y: BASE_Y + 2.8, z: 4.4, color: 'cyan' },
      { key: 'locker', label: 'Locker', x: 10.5, y: BASE_Y + 2.2, z: 10.5, color: 'amber' },
      { key: 'airlock', label: 'Airlock', x: 7.5, y: BASE_Y + 2.2, z: 13.6, color: 'violet' },
    ],
    interactions: [
      {
        id: 'bridge-console',
        label: 'Bridge Console',
        prompt: 'Open navigation handoff and review live ship telemetry',
        result: `Bridge telemetry synchronized for ${shipName}.`,
        position: { x: 7.0, y: BASE_Y + 2.2, z: 4.4 },
        activationRadius: 6.8,
      },
      {
        id: 'crew-locker',
        label: 'Crew Locker',
        prompt: 'Inspect mission gear stowage and boarding kits',
        result: `${user?.username || 'Crew'} reviewed the ship loadout locker.`,
        position: { x: 10.3, y: BASE_Y + 1.8, z: 10.2 },
        activationRadius: 4.2,
      },
      {
        id: 'aft-airlock',
        label: 'Aft Airlock',
        prompt: 'Cycle the airlock and prep the away team',
        result: 'Airlock sealed. Boarding team status green.',
        position: { x: 7.5, y: BASE_Y + 1.8, z: 12.8 },
        activationRadius: 4.8,
      },
    ],
  });
}

export function createDerelictBoardingScene({ ship, sector }) {
  const deltas = buildDerelictDeltas();
  const sectorName = sector?.name || ship?.currentSector?.name || ship?.current_sector?.name || 'Outer Drift';

  return createSceneBase({
    id: 'derelict_boarding',
    title: 'Derelict Boarding',
    subtitle: `Silent wreck drifting in ${sectorName}`,
    profileId: 'derelict_boarding',
    seed: (sector?.sector_id?.length || 84) * 17,
    planetType: 'BlackHole',
    serverDeltas: deltas,
    spawn: { x: 6.0, y: BASE_Y + 1.1, z: 8.2, yaw: 0.46, pitch: -0.04 },
    preview: {
      position: { x: 7.6, y: BASE_Y + 4.7, z: 14.8 },
      target: { x: 5.2, y: BASE_Y + 2.3, z: 7.1 },
    },
    markers: [
      { key: 'beacon', label: 'Data Core', x: 4.3, y: BASE_Y + 2.6, z: 5.2, color: 'cyan' },
      { key: 'salvage', label: 'Salvage Crate', x: 10.8, y: BASE_Y + 1.8, z: 10.4, color: 'amber' },
      { key: 'exit', label: 'Breach Exit', x: 7.5, y: BASE_Y + 2.0, z: 13.8, color: 'violet' },
    ],
    interactions: [
      {
        id: 'data-core',
        label: 'Data Core',
        prompt: 'Extract the ship log and recover black-box telemetry',
        result: 'Recovered fragmented jump telemetry from the derelict core.',
        position: { x: 4.4, y: BASE_Y + 2.0, z: 5.0 },
        activationRadius: 7.4,
      },
      {
        id: 'salvage-locker',
        label: 'Salvage Locker',
        prompt: 'Crack open the locker and catalogue anything worth hauling',
        result: 'Salvage manifest updated: unstable parts, scorched tools, sealed crate.',
        position: { x: 10.5, y: BASE_Y + 1.8, z: 10.1 },
        activationRadius: 4.4,
      },
      {
        id: 'breach-exit',
        label: 'Breach Exit',
        prompt: 'Withdraw the team back through the hull breach',
        result: 'Away team recalled to the primary shuttle lock.',
        position: { x: 7.5, y: BASE_Y + 1.8, z: 13.0 },
        activationRadius: 4.8,
      },
    ],
  });
}

export function getScenePreviewMarkers(scene) {
  return scene.markers.map((marker) => ({
    ...marker,
    position: { x: marker.x, y: marker.y, z: marker.z },
  }));
}

export function getSceneKeyFromShipAndSector(shipId, sectorId) {
  return `${shipId || 'ship'}-${sectorId || 'sector'}`;
}

export function getInteriorSceneChunkBounds() {
  return {
    minX: 0,
    minZ: 0,
    maxX: CHUNK_SIZE - 1,
    maxZ: CHUNK_SIZE - 1,
  };
}
