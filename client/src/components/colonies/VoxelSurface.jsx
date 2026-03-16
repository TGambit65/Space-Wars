import { useRef, useEffect, useState, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import * as THREE from 'three';
import { colonies } from '../../services/api';
import { VoxelEngine } from '../../engine/VoxelEngine';
import { PlayerController } from '../../engine/PlayerController';
import { VoxelRaycaster } from '../../engine/VoxelRaycaster';
import { BLOCKS, getBlock } from '../../engine/BlockRegistry';
import { LANDING_SITE_LAYOUT } from '../../engine/TerrainGenerator';
import { isBuildable } from '../../utils/terrainGenerator';
import VoxelHUD from './VoxelHUD';
import VoxelToolbar from './VoxelToolbar';

const CHUNK_SIZE = 16;
const CHUNK_READY_TIMEOUT_MS = 8000;
const FALLBACK_RESPAWN_Y = 52;
const RESPAWN_FALL_THRESHOLD = -8;

// Default hotbar block IDs: stone, dirt, grass, sand, wall, floor, window, lamp, wood_log
const DEFAULT_HOTBAR = [1, 2, 3, 4, 20, 22, 23, 25, 14];

/**
 * Convert world coordinates to chunk + local coordinates for server API.
 */
function worldToChunkLocal(wx, wy, wz) {
  const cx = Math.floor(wx / CHUNK_SIZE);
  const cz = Math.floor(wz / CHUNK_SIZE);
  const lx = ((wx % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE;
  const lz = ((wz % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE;
  return { chunk_x: cx, chunk_z: cz, local_x: lx, local_y: wy, local_z: lz };
}

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function getSpawnChunk(surface) {
  const width = surface?.width || surface?.terrain?.[0]?.length || 1;
  const height = surface?.height || surface?.terrain?.length || 1;
  const terrain = surface?.terrain;
  const centerX = Math.max(0, Math.floor(width / 2));
  const centerY = Math.max(0, Math.floor(height / 2));

  if (Array.isArray(terrain) && terrain.length > 0) {
    for (let radius = 0; radius <= Math.max(width, height); radius += 1) {
      for (let dz = -radius; dz <= radius; dz += 1) {
        for (let dx = -radius; dx <= radius; dx += 1) {
          if (Math.max(Math.abs(dx), Math.abs(dz)) !== radius) continue;

          const x = centerX + dx;
          const z = centerY + dz;
          const terrainType = terrain[z]?.[x];
          if (!terrainType || !isBuildable(terrainType)) continue;

          return { cx: x, cz: z };
        }
      }
    }
  }

  return {
    cx: centerX,
    cz: centerY,
  };
}

async function loadInitialServerDeltas(colonyId, spawnChunk) {
  const requests = [];

  for (let dz = -1; dz <= 1; dz += 1) {
    for (let dx = -1; dx <= 1; dx += 1) {
      const cx = spawnChunk.cx + dx;
      const cz = spawnChunk.cz + dz;
      if (cx < 0 || cz < 0) continue;
      requests.push({ cx, cz });
    }
  }

  const results = await Promise.allSettled(
    requests.map(({ cx, cz }) =>
      colonies.getVoxelChunk(colonyId, cx, cz).then((response) => ({
        cx,
        cz,
        data: response.data.data || response.data,
      }))
    )
  );

  const deltaMap = new Map();

  for (const result of results) {
    if (result.status !== 'fulfilled' || !Array.isArray(result.value.data)) continue;

    for (const row of result.value.data) {
      const wx = row.chunk_x * CHUNK_SIZE + row.local_x;
      const wz = row.chunk_z * CHUNK_SIZE + row.local_z;
      deltaMap.set(`${wx},${row.local_y},${wz}`, row.block_type);
    }
  }

  return deltaMap.size > 0 ? deltaMap : null;
}

function findSpawnPoint(chunkManager, spawnChunk) {
  const chunkCandidates = [
    [spawnChunk.cx, spawnChunk.cz],
    [spawnChunk.cx + 1, spawnChunk.cz],
    [spawnChunk.cx - 1, spawnChunk.cz],
    [spawnChunk.cx, spawnChunk.cz + 1],
    [spawnChunk.cx, spawnChunk.cz - 1],
  ];
  const candidates = [
    [2, 8],
    [2, 7],
    [2, 9],
    [3, 8],
    [4, 8],
    [5, 8],
    [4, 7],
    [4, 9],
    [6, 8],
    [8, 8],
    [7, 8],
    [8, 7],
    [9, 8],
    [8, 9],
    [6, 8],
    [8, 6],
    [10, 8],
    [8, 10],
  ];
  let bestSpawn = null;

  for (const [cx, cz] of chunkCandidates) {
    if (cx < 0 || cz < 0 || !chunkManager.isChunkReady(cx, cz)) {
      continue;
    }

    const baseX = cx * CHUNK_SIZE;
    const baseZ = cz * CHUNK_SIZE;

    for (const [x, z] of candidates) {
      const topY = chunkManager.getHighestSolidY(baseX + x, baseZ + z);
      if (topY >= 0) {
        const spawn = {
          x: baseX + x + 0.5,
          y: topY + 1.1,
          z: baseZ + z + 0.5,
        };
        if (topY >= 42) {
          return spawn;
        }
        if (!bestSpawn || spawn.y > bestSpawn.y) {
          bestSpawn = spawn;
        }
      }
    }
  }

  return bestSpawn;
}

function getLandingSiteSpawn(chunkManager, spawnChunk) {
  const wx = spawnChunk.cx * CHUNK_SIZE + LANDING_SITE_LAYOUT.spawnLocal.x;
  const wz = spawnChunk.cz * CHUNK_SIZE + LANDING_SITE_LAYOUT.spawnLocal.z;
  const groundY = chunkManager.getHighestSolidY(Math.floor(wx), Math.floor(wz));
  if (groundY < 0) return null;

  return {
    x: wx,
    y: groundY + 1.1,
    z: wz,
  };
}

function getLandingSiteFocus(chunkManager, spawnChunk) {
  const wx = spawnChunk.cx * CHUNK_SIZE + LANDING_SITE_LAYOUT.focusLocal.x;
  const wz = spawnChunk.cz * CHUNK_SIZE + LANDING_SITE_LAYOUT.focusLocal.z;
  const groundY = chunkManager.getHighestSolidY(Math.floor(wx), Math.floor(wz));

  return {
    x: wx,
    y: (groundY >= 0 ? groundY : FALLBACK_RESPAWN_Y) + LANDING_SITE_LAYOUT.focusLocal.yOffset,
    z: wz,
  };
}

function getLandingSitePreview(chunkManager, spawnChunk) {
  const focus = getLandingSiteFocus(chunkManager, spawnChunk);
  const focusGroundY = chunkManager.getHighestSolidY(Math.floor(focus.x), Math.floor(focus.z));
  const wx = focus.x - 6.5;
  const wz = focus.z + 3.5;

  return {
    position: {
      x: wx,
      y: (focusGroundY >= 0 ? focusGroundY : FALLBACK_RESPAWN_Y) + 5.5,
      z: wz,
    },
    target: focus,
  };
}

function orientControllerToward(controller, origin, target) {
  const dx = target.x - origin.x;
  const dy = target.y - origin.y;
  const dz = target.z - origin.z;
  const horizontalDistance = Math.max(0.001, Math.hypot(dx, dz));

  controller.yaw = Math.atan2(-dx, -dz);
  controller.pitch = Math.max(
    -0.08,
    Math.min(0.02, Math.atan2(dy, horizontalDistance) - 0.22)
  );
  controller.update(0);
}

async function waitForSpawnPoint(engine, controller, spawnChunk) {
  const startedAt = Date.now();
  const fallbackX = spawnChunk.cx * CHUNK_SIZE + 8.5;
  const fallbackZ = spawnChunk.cz * CHUNK_SIZE + 8.5;

  while (Date.now() - startedAt < CHUNK_READY_TIMEOUT_MS) {
    engine.setPlayerPosition(controller.position.x, controller.position.y, controller.position.z);

    const chunkManager = engine.getChunkManager();
    if (chunkManager?.isChunkReady(spawnChunk.cx, spawnChunk.cz)) {
      const landingSpawn = getLandingSiteSpawn(chunkManager, spawnChunk);
      if (landingSpawn) {
        return landingSpawn;
      }

      const spawn = findSpawnPoint(chunkManager, spawnChunk);
      if (spawn) {
        return spawn;
      }
    }

    await wait(50);
  }

  return { x: fallbackX, y: FALLBACK_RESPAWN_Y, z: fallbackZ };
}

function VoxelSurface({ user }) {
  const { colonyId } = useParams();

  // State
  const [colonyData, setColonyData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [playerPos, setPlayerPos] = useState(null);
  const [targetBlock, setTargetBlock] = useState(null);
  const [selectedSlot, setSelectedSlot] = useState(0);
  const [hotbar, setHotbar] = useState(DEFAULT_HOTBAR);
  const [showToolbar, setShowToolbar] = useState(false);
  const [flyMode, setFlyMode] = useState(false);

  // Refs
  const containerRef = useRef(null);
  const engineRef = useRef(null);
  const controllerRef = useRef(null);
  const raycasterRef = useRef(null);
  const animFrameRef = useRef(null);
  const initialSpawnRef = useRef(null);
  const lastSafePositionRef = useRef(null);
  const selectedSlotRef = useRef(0);
  const hotbarRef = useRef(DEFAULT_HOTBAR);
  const showToolbarRef = useRef(false);
  const colonyIdRef = useRef(colonyId);

  // Keep refs in sync with state
  useEffect(() => { selectedSlotRef.current = selectedSlot; }, [selectedSlot]);
  useEffect(() => { hotbarRef.current = hotbar; }, [hotbar]);
  useEffect(() => { showToolbarRef.current = showToolbar; }, [showToolbar]);
  useEffect(() => { colonyIdRef.current = colonyId; }, [colonyId]);

  // Fetch colony data and initialize engine
  useEffect(() => {
    let cancelled = false;
    window.render_game_to_text = () => JSON.stringify({
      mode: 'voxel_surface',
      colonyId: colonyIdRef.current,
      loading: true,
      error: null,
    });

    async function initVoxelWorld() {
      try {
        setLoading(true);
        setError(null);

        // Fetch colony details
        const detailsRes = await colonies.getDetails(colonyId);
        const colony = detailsRes.data.data || detailsRes.data;

        if (cancelled) return;

        // Fetch surface data for biome/seed info
        let surface = null;
        try {
          const surfaceRes = await colonies.getSurface(colonyId);
          surface = surfaceRes.data.data || surfaceRes.data;
        } catch {
          // Surface may not be initialized yet, that's OK
        }

        if (cancelled) return;

        const planet = colony.planet || {};
        const planetType = planet.type || 'Terran';
        const seed = colony.colony_id || 42;

        // Build biome grid from surface data if available
        let biomeGrid = null;
        if (surface && surface.terrain) {
          biomeGrid = surface.terrain;
        }

        const spawnChunk = getSpawnChunk(surface);
        let serverDeltas = null;
        try {
          serverDeltas = await loadInitialServerDeltas(colonyId, spawnChunk);
        } catch {
          // No persisted deltas yet, use pure terrain generation.
        }

        if (cancelled) return;

        setColonyData({ colony, planet, planetType, seed, biomeGrid, serverDeltas });

        // Initialize engine
        if (!containerRef.current) return;

        const engine = new VoxelEngine();
        engine.init(containerRef.current, {
          planetType,
          seed,
          biomeGrid,
          serverDeltas,
          spawnChunk,
        });
        engineRef.current = engine;

        // Initialize player controller
        const controller = new PlayerController(
          engine.getCamera(),
          engine.getChunkManager(),
          engine.getRenderer().domElement
        );
        controller.init();
        controller.setPosition(
          spawnChunk.cx * CHUNK_SIZE + 8.5,
          FALLBACK_RESPAWN_Y,
          spawnChunk.cz * CHUNK_SIZE + 8.5
        );
        controller.yaw = -0.95;
        controller.pitch = -0.18;
        controller.update(0);
        controllerRef.current = controller;

        const spawn = await waitForSpawnPoint(engine, controller, spawnChunk);
        if (cancelled) return;
        controller.setPosition(spawn.x, spawn.y, spawn.z);
        const focus = getLandingSiteFocus(engine.getChunkManager(), spawnChunk);
        orientControllerToward(controller, spawn, focus);
        initialSpawnRef.current = spawn;
        lastSafePositionRef.current = spawn;
        engine.setPlayerPosition(spawn.x, spawn.y, spawn.z);

        // Initialize raycaster
        const raycaster = new VoxelRaycaster(engine.getChunkManager());
        raycasterRef.current = raycaster;

        // Start the game loop (separate from engine's render loop)
        // The engine handles its own render loop via _animate.
        // We just need to update the controller and HUD state.
        // Use a separate clock so we don't interfere with engine's clock.
        const hudClock = new THREE.Clock();
        const gameLoop = () => {
          if (cancelled) return;

          const dt = Math.min(hudClock.getDelta(), 0.05);
          controller.update(dt);

          // Inform engine of player position for chunk loading
          engine.setPlayerPosition(
            controller.position.x,
            controller.position.y,
            controller.position.z
          );

          // Update target block for HUD
          const chunkManager = engine.getChunkManager();
          if (!chunkManager) {
            animFrameRef.current = requestAnimationFrame(gameLoop);
            return;
          }
          const target = raycaster.getTargetBlock(engine.getCamera());
          const player = controller.getPosition();
          const groundY = chunkManager.getHighestSolidY(
            Math.floor(player.x),
            Math.floor(player.z)
          );
          const safeY = groundY >= 0 ? groundY + 1.1 : null;

          if (
            controller.flyMode ||
            controller.isGrounded ||
            (safeY !== null && player.y >= groundY && player.y <= groundY + 2.5)
          ) {
            lastSafePositionRef.current = {
              x: player.x,
              y: safeY ?? player.y,
              z: player.z,
            };
          }

          if (!controller.flyMode && (player.y < RESPAWN_FALL_THRESHOLD || (safeY !== null && player.y < groundY - 3))) {
            const resetPosition = lastSafePositionRef.current || initialSpawnRef.current;
            if (resetPosition) {
              controller.setPosition(resetPosition.x, resetPosition.y, resetPosition.z);
            }
          }

          if (!controller.isLocked && initialSpawnRef.current) {
            const preview = getLandingSitePreview(chunkManager, spawnChunk);
            const camera = engine.getCamera();
            camera.position.set(preview.position.x, preview.position.y, preview.position.z);
            camera.lookAt(preview.target.x, preview.target.y, preview.target.z);
          }

          setTargetBlock(target);
          setPlayerPos(controller.getPosition());
          setFlyMode(controller.flyMode);

          window.render_game_to_text = () => JSON.stringify({
            mode: 'voxel_surface',
            colonyId: colonyIdRef.current,
            loading: false,
            error: null,
            player: controller.getPosition(),
            camera: {
              x: engine.getCamera().position.x,
              y: engine.getCamera().position.y,
              z: engine.getCamera().position.z,
              pitch: engine.getCamera().rotation.x,
              yaw: engine.getCamera().rotation.y,
            },
            groundY,
            flyMode: controller.flyMode,
            chunk: {
              x: Math.floor(player.x / CHUNK_SIZE),
              z: Math.floor(player.z / CHUNK_SIZE),
            },
            landingSite: (() => {
              if (!spawnChunk) return null;
              const focus = getLandingSiteFocus(chunkManager, spawnChunk);
              const preview = getLandingSitePreview(chunkManager, spawnChunk);
              return {
                spawnChunk,
                focus,
                focusGroundY: chunkManager.getHighestSolidY(
                  Math.floor(focus.x),
                  Math.floor(focus.z)
                ),
                preview,
              };
            })(),
            target: target?.hit ? {
              blockPos: target.blockPos,
              placePos: target.placePos,
              blockType: target.blockType,
            } : null,
            selectedBlockId: hotbarRef.current[selectedSlotRef.current],
          });

          animFrameRef.current = requestAnimationFrame(gameLoop);
        };
        animFrameRef.current = requestAnimationFrame(gameLoop);

        setLoading(false);
      } catch (err) {
        if (!cancelled) {
          console.error('Failed to initialize voxel world:', err);
          setError(err.response?.data?.message || err.message || 'Failed to load colony data');
          window.render_game_to_text = () => JSON.stringify({
            mode: 'voxel_surface',
            colonyId: colonyIdRef.current,
            loading: false,
            error: err.response?.data?.message || err.message || 'Failed to load colony data',
          });
          setLoading(false);
        }
      }
    }

    initVoxelWorld();

    return () => {
      cancelled = true;

      if (animFrameRef.current) {
        cancelAnimationFrame(animFrameRef.current);
        animFrameRef.current = null;
      }
      if (controllerRef.current) {
        controllerRef.current.dispose();
        controllerRef.current = null;
      }
      initialSpawnRef.current = null;
      lastSafePositionRef.current = null;
      if (engineRef.current) {
        engineRef.current.dispose();
        engineRef.current = null;
      }
      raycasterRef.current = null;
      delete window.render_game_to_text;
    };
  }, [colonyId]);

  // Handle mouse clicks for block placement and removal
  const handleMouseDown = useCallback((e) => {
    const controller = controllerRef.current;
    const raycaster = raycasterRef.current;
    const engine = engineRef.current;
    if (!controller || !raycaster || !engine) return;
    if (!controller.isLocked) return;
    if (showToolbarRef.current) return;

    const chunkManager = engine.getChunkManager();
    if (!chunkManager) return;

    const target = raycaster.getTargetBlock(engine.getCamera());
    if (!target.hit) return;

    if (e.button === 0) {
      // Left click: break block
      const [bx, by, bz] = target.blockPos;
      const block = getBlock(target.blockType);

      // Don't break unbreakable blocks
      if (block && !block.breakable) return;

      chunkManager.setBlock(bx, by, bz, 0);

      // Persist to server (fire-and-forget)
      const coords = worldToChunkLocal(bx, by, bz);
      colonies.removeVoxel(colonyIdRef.current, coords).catch((err) => {
        console.warn('Failed to persist block removal:', err);
      });
    } else if (e.button === 2) {
      // Right click: place block
      if (!target.placePos) return;
      const [px, py, pz] = target.placePos;

      const selectedBlockId = hotbarRef.current[selectedSlotRef.current];
      if (!selectedBlockId || selectedBlockId === 0) return;

      // Don't place a block where the player is standing
      const pos = controller.getPosition();
      const playerMinX = pos.x - 0.3;
      const playerMaxX = pos.x + 0.3;
      const playerMinY = pos.y;
      const playerMaxY = pos.y + 1.7;
      const playerMinZ = pos.z - 0.3;
      const playerMaxZ = pos.z + 0.3;

      if (
        px + 1 > playerMinX && px < playerMaxX &&
        py + 1 > playerMinY && py < playerMaxY &&
        pz + 1 > playerMinZ && pz < playerMaxZ
      ) {
        return; // Would clip into player
      }

      chunkManager.setBlock(px, py, pz, selectedBlockId);

      // Persist to server (fire-and-forget)
      const coords = worldToChunkLocal(px, py, pz);
      colonies.placeVoxel(colonyIdRef.current, {
        ...coords,
        block_type: selectedBlockId,
      }).catch((err) => {
        console.warn('Failed to persist block placement:', err);
      });
    }
  }, []);

  // Prevent context menu on right click
  const handleContextMenu = useCallback((e) => {
    e.preventDefault();
  }, []);

  // Handle keyboard for hotbar selection and toolbar toggle
  useEffect(() => {
    const handleKeyDown = (e) => {
      const controller = controllerRef.current;
      if (!controller || !controller.isLocked) return;

      // Number keys 1-9 for hotbar slot selection
      const num = parseInt(e.key, 10);
      if (num >= 1 && num <= 9) {
        setSelectedSlot(num - 1);
        return;
      }

      // Tab to toggle toolbar
      if (e.key === 'Tab') {
        e.preventDefault();
        setShowToolbar((prev) => !prev);
        // Exit pointer lock when opening toolbar
        if (!showToolbarRef.current) {
          document.exitPointerLock();
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Handle hotbar assignment from toolbar
  const handleHotbarAssign = useCallback((slotIndex, blockId) => {
    setHotbar((prev) => {
      const next = [...prev];
      if (slotIndex !== null) {
        next[slotIndex] = blockId;
      } else {
        // Find first empty slot, or replace currently selected
        const empty = next.findIndex((id) => id === 0);
        const target = empty !== -1 ? empty : selectedSlotRef.current;
        next[target] = blockId;
      }
      return next;
    });
  }, []);

  const handleToolbarClose = useCallback(() => {
    setShowToolbar(false);
  }, []);

  return (
    <div className="relative w-full h-screen overflow-hidden bg-black">
      <div
        ref={containerRef}
        className="w-full h-full"
        onMouseDown={handleMouseDown}
        onContextMenu={handleContextMenu}
        style={{ visibility: loading || error ? 'hidden' : 'visible' }}
      />

      {loading && (
        <div className="absolute inset-0 flex items-center justify-center bg-black">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-accent-cyan mx-auto mb-4" />
            <div className="text-accent-cyan font-display">Generating terrain...</div>
            <div className="text-xs text-gray-500 mt-2">Building voxel world</div>
          </div>
        </div>
      )}

      {error && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/95">
          <div className="text-center max-w-md">
            <div className="text-red-400 text-lg mb-2">Failed to load</div>
            <div className="text-gray-500 text-sm mb-4">{error}</div>
            <button
              onClick={() => window.history.back()}
              className="px-4 py-2 text-sm bg-space-800 border border-space-600 rounded text-gray-300 hover:text-white hover:border-accent-cyan transition-colors"
            >
              Go Back
            </button>
          </div>
        </div>
      )}

      {!loading && !error && (
        <>
          <VoxelHUD
            playerPos={playerPos}
            targetBlock={targetBlock}
            hotbar={hotbar}
            selectedSlot={selectedSlot}
            flyMode={flyMode}
          />
          {showToolbar && (
            <VoxelToolbar
              blocks={BLOCKS}
              hotbar={hotbar}
              onAssign={handleHotbarAssign}
              onClose={handleToolbarClose}
            />
          )}
        </>
      )}
    </div>
  );
}

export default VoxelSurface;
