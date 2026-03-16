/**
 * ChunkManager — manages loaded chunks, worker pools, and mesh lifecycle.
 *
 * Coordinates terrain generation and greedy-meshing via Web Workers,
 * handles chunk loading/unloading based on player position, and
 * builds Three.js BufferGeometry meshes from worker results.
 */

import * as THREE from 'three';
import { Chunk, CHUNK_SIZE, CHUNK_HEIGHT } from './Chunk.js';
import { BLOCKS, isSolid, isTransparent } from './BlockRegistry.js';

// Chunk states
const STATE_PENDING = 'pending';
const STATE_GENERATING = 'generating';
const STATE_MESHING = 'meshing';
const STATE_READY = 'ready';
const STATE_DIRTY = 'dirty';

const TERRAIN_WORKER_COUNT = 2;
const MESH_WORKER_COUNT = 2;

/**
 * Convert world coordinates to chunk coordinates.
 */
function worldToChunk(wx, wz) {
  return {
    cx: Math.floor(wx / CHUNK_SIZE),
    cz: Math.floor(wz / CHUNK_SIZE),
  };
}

/**
 * Build a unique key for a chunk position.
 */
function chunkKey(cx, cz) {
  return `${cx},${cz}`;
}

export class ChunkManager {
  /**
   * @param {THREE.Scene} scene
   * @param {THREE.ShaderMaterial} material — shared voxel material
   * @param {number} renderDistance — in chunks
   */
  constructor(scene, material, renderDistance = 8) {
    this.scene = scene;
    this.material = material;
    this.renderDistance = renderDistance;

    /** @type {Map<string, { chunk: Chunk|null, mesh: THREE.Mesh|null, state: string }>} */
    this.chunks = new Map();

    // Worker pools
    this.terrainWorkers = [];
    this.meshWorkers = [];

    // Track which workers are busy
    this.terrainWorkersBusy = [];
    this.meshWorkersBusy = [];

    // Queues
    this.terrainQueue = [];
    this.meshQueue = [];

    // Player chunk position
    this.playerChunkX = 0;
    this.playerChunkZ = 0;

    // Precomputed spiral load order — offsets from player chunk
    this.loadOrder = [];

    // Generation parameters (set via init)
    this.seed = 42;
    this.planetType = 'Terran';
    this.biomeGrid = null;
    this.serverDeltas = null;
    this.spawnChunk = null;
  }

  /**
   * Initialize the manager with generation parameters and start workers.
   * @param {number} seed
   * @param {string} planetType
   * @param {*} biomeGrid
   * @param {Map|object|null} serverDeltas — block overrides from server
   */
  init(seed, planetType, biomeGrid, serverDeltas, spawnChunk = null) {
    this.seed = seed;
    this.planetType = planetType;
    this.biomeGrid = biomeGrid;
    this.serverDeltas = serverDeltas instanceof Map
      ? serverDeltas
      : new Map(Object.entries(serverDeltas || {}));
    this.spawnChunk = spawnChunk;

    this._precomputeLoadOrder();
    this._initWorkers();
  }

  /**
   * Precompute a spiral load order of chunk offsets, sorted by distance.
   */
  _precomputeLoadOrder() {
    const offsets = [];
    const rd = this.renderDistance;
    for (let r = 0; r <= rd; r++) {
      for (let dx = -r; dx <= r; dx++) {
        for (let dz = -r; dz <= r; dz++) {
          if (Math.max(Math.abs(dx), Math.abs(dz)) === r) {
            offsets.push({ dx, dz, dist: dx * dx + dz * dz });
          }
        }
      }
    }
    offsets.sort((a, b) => a.dist - b.dist);
    this.loadOrder = offsets;
  }

  /**
   * Create Web Worker pools for terrain generation and meshing.
   */
  _initWorkers() {
    for (let i = 0; i < TERRAIN_WORKER_COUNT; i++) {
      const worker = new Worker(
        new URL('./workers/terrainWorker.js', import.meta.url),
        { type: 'module' }
      );
      worker.onmessage = (e) => this._onTerrainResult(i, e.data);
      this.terrainWorkers.push(worker);
      this.terrainWorkersBusy.push(false);
    }

    for (let i = 0; i < MESH_WORKER_COUNT; i++) {
      const worker = new Worker(
        new URL('./workers/meshWorker.js', import.meta.url),
        { type: 'module' }
      );
      worker.onmessage = (e) => this._onMeshResult(i, e.data);
      this.meshWorkers.push(worker);
      this.meshWorkersBusy.push(false);
    }
  }

  /**
   * Called when a terrain worker finishes generating a chunk.
   */
  _onTerrainResult(workerIndex, data) {
    this.terrainWorkersBusy[workerIndex] = false;

    const cx = data.cx ?? data.chunkX;
    const cz = data.cz ?? data.chunkZ;
    const { sections, error } = data;
    if (cx == null || cz == null) return;
    const key = chunkKey(cx, cz);
    const entry = this.chunks.get(key);
    if (!entry) return; // chunk was unloaded while generating
    if (error || !sections) {
      entry.state = STATE_PENDING;
      this.terrainQueue.push({ cx, cz });
      return;
    }

    // Reconstruct chunk from transferred section data
    const chunk = new Chunk(cx, cz);
    for (let sy = 0; sy < sections.length; sy++) {
      if (sections[sy]) {
        chunk.sections[sy] = new Uint8Array(sections[sy]);
      }
    }

    // Apply server deltas (block overrides from the backend)
    this._applyServerDeltas(chunk, cx, cz);

    entry.chunk = chunk;
    entry.state = STATE_MESHING;

    // Enqueue for meshing
    this.meshQueue.push({ cx, cz });
  }

  /**
   * Apply server block deltas to a freshly generated chunk.
   */
  _applyServerDeltas(chunk, cx, cz) {
    if (!this.serverDeltas || this.serverDeltas.size === 0) return;

    // Server deltas keyed as "wx,wy,wz" → blockId
    const baseX = cx * CHUNK_SIZE;
    const baseZ = cz * CHUNK_SIZE;

    for (const [posKey, blockId] of this.serverDeltas) {
      const parts = posKey.split(',');
      if (parts.length !== 3) continue;
      const wx = parseInt(parts[0], 10);
      const wy = parseInt(parts[1], 10);
      const wz = parseInt(parts[2], 10);

      // Check if this delta belongs to this chunk
      const localX = wx - baseX;
      const localZ = wz - baseZ;
      if (localX >= 0 && localX < CHUNK_SIZE && localZ >= 0 && localZ < CHUNK_SIZE) {
        if (wy >= 0 && wy < CHUNK_HEIGHT) {
          chunk.setBlock(localX, wy, localZ, blockId);
        }
      }
    }
  }

  /**
   * Called when a mesh worker finishes building geometry.
   */
  _onMeshResult(workerIndex, data) {
    this.meshWorkersBusy[workerIndex] = false;

    const cx = data.cx ?? data.chunkX;
    const cz = data.cz ?? data.chunkZ;
    const { positions, normals, uvs, aos, indices, error } = data;
    if (cx == null || cz == null) return;
    const key = chunkKey(cx, cz);
    const entry = this.chunks.get(key);
    if (!entry) return;
    if (error) {
      entry.state = STATE_MESHING;
      this.meshQueue.push({ cx, cz });
      return;
    }

    // Remove old mesh if present
    if (entry.mesh) {
      this.scene.remove(entry.mesh);
      entry.mesh.geometry.dispose();
      entry.mesh = null;
    }

    // Skip empty chunks
    if (!positions || positions.length === 0) {
      entry.state = STATE_READY;
      return;
    }

    // Build Three.js BufferGeometry
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(positions), 3));
    geometry.setAttribute('normal', new THREE.BufferAttribute(new Float32Array(normals), 3));
    geometry.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(uvs), 2));
    geometry.setAttribute('aAO', new THREE.BufferAttribute(new Float32Array(aos), 1));
    geometry.setIndex(new THREE.BufferAttribute(new Uint32Array(indices), 1));

    const mesh = new THREE.Mesh(geometry, this.material);
    mesh.position.set(cx * CHUNK_SIZE, 0, cz * CHUNK_SIZE);
    mesh.frustumCulled = true;

    this.scene.add(mesh);
    entry.mesh = mesh;
    entry.state = STATE_READY;
  }

  /**
   * Update the player's chunk position. If it changed, re-evaluate
   * which chunks should be loaded/unloaded.
   */
  updatePlayerPosition(worldX, worldZ) {
    const { cx, cz } = worldToChunk(worldX, worldZ);
    this.playerChunkX = cx;
    this.playerChunkZ = cz;
  }

  /**
   * Per-frame update — processes worker results and enqueues new work.
   */
  update() {
    // Dispatch pending terrain jobs to idle workers
    this._dispatchTerrainJobs();

    // Dispatch pending mesh jobs to idle workers
    this._dispatchMeshJobs();

    // Enqueue new chunks for loading (up to 2 per frame)
    this._enqueueNewChunks(2);

    // Unload chunks beyond render distance + 2
    this._unloadDistantChunks();
  }

  /**
   * Send queued terrain jobs to idle terrain workers.
   */
  _dispatchTerrainJobs() {
    for (let i = 0; i < this.terrainWorkers.length; i++) {
      if (this.terrainWorkersBusy[i] || this.terrainQueue.length === 0) continue;

      const { cx, cz } = this.terrainQueue.shift();
      const key = chunkKey(cx, cz);
      const entry = this.chunks.get(key);
      if (!entry || entry.state !== STATE_PENDING) continue;

      entry.state = STATE_GENERATING;
      this.terrainWorkersBusy[i] = true;

      this.terrainWorkers[i].postMessage({
        chunkX: cx,
        chunkZ: cz,
        cx,
        cz,
        seed: this.seed,
        planetType: this.planetType,
        biomeGrid: this.biomeGrid,
        spawnChunk: this.spawnChunk,
      });
    }
  }

  /**
   * Send queued mesh jobs to idle mesh workers.
   */
  _dispatchMeshJobs() {
    for (let i = 0; i < this.meshWorkers.length; i++) {
      if (this.meshWorkersBusy[i] || this.meshQueue.length === 0) continue;

      const { cx, cz } = this.meshQueue.shift();
      const key = chunkKey(cx, cz);
      const entry = this.chunks.get(key);
      if (!entry || !entry.chunk) continue;

      this.meshWorkersBusy[i] = true;

      // Extract neighbor edges for proper meshing at chunk boundaries
      const neighbors = this._extractNeighborEdges(cx, cz);

      // Copy section data for the worker (slice to avoid detaching the chunk's buffers)
      const sections = entry.chunk.sections.map(
        (s) => (s ? s.buffer.slice(0) : null)
      );

      this.meshWorkers[i].postMessage(
        {
          chunkX: cx,
          chunkZ: cz,
          cx,
          cz,
          sections,
          neighbors,
          neighborEdges: neighbors,
        },
        // Transfer buffers for performance
        sections.filter(Boolean)
      );
    }
  }

  /**
   * Extract boundary columns from neighboring chunks for seamless meshing.
   * Returns { north, south, east, west } where each is either an ArrayBuffer
   * (Uint8Array of CHUNK_HEIGHT * CHUNK_SIZE entries) or null if the
   * neighbor isn't loaded.
   *
   * Uses Chunk.getEdge() for consistent layout with the GreedyMesher.
   * Edge layout: index = y * CHUNK_SIZE + i (matching Chunk.getEdge convention).
   *
   * For meshing chunk (cx, cz):
   *   north = chunk at (cx, cz-1) → its 'south' edge (z=15 face)
   *   south = chunk at (cx, cz+1) → its 'north' edge (z=0 face)
   *   east  = chunk at (cx+1, cz) → its 'west' edge  (x=0 face)
   *   west  = chunk at (cx-1, cz) → its 'east' edge  (x=15 face)
   */
  _extractNeighborEdges(cx, cz) {
    const getEdgeFrom = (ncx, ncz, face) => {
      const nkey = chunkKey(ncx, ncz);
      const nentry = this.chunks.get(nkey);
      if (!nentry || !nentry.chunk) return null;
      return nentry.chunk.getEdge(face);
    };

    const north = getEdgeFrom(cx, cz - 1, 'south');
    const south = getEdgeFrom(cx, cz + 1, 'north');
    const east = getEdgeFrom(cx + 1, cz, 'west');
    const west = getEdgeFrom(cx - 1, cz, 'east');

    return {
      north: north ? north.buffer : null,
      south: south ? south.buffer : null,
      east: east ? east.buffer : null,
      west: west ? west.buffer : null,
    };
  }

  /**
   * Enqueue up to `limit` new chunks for terrain generation,
   * walking the spiral load order outward from the player.
   */
  _enqueueNewChunks(limit) {
    let enqueued = 0;
    for (const { dx, dz } of this.loadOrder) {
      if (enqueued >= limit) break;

      const cx = this.playerChunkX + dx;
      const cz = this.playerChunkZ + dz;
      const key = chunkKey(cx, cz);

      if (this.chunks.has(key)) {
        // Already loaded or in progress — check if dirty and needs remesh
        const entry = this.chunks.get(key);
        if (entry.state === STATE_DIRTY && entry.chunk) {
          entry.state = STATE_MESHING;
          this.meshQueue.push({ cx, cz });
          enqueued++;
        }
        continue;
      }

      // Create a new entry and enqueue terrain generation
      this.chunks.set(key, {
        chunk: null,
        mesh: null,
        state: STATE_PENDING,
      });
      this.terrainQueue.push({ cx, cz });
      enqueued++;
    }
  }

  /**
   * Remove chunks that are too far from the player.
   */
  _unloadDistantChunks() {
    const maxDist = this.renderDistance + 2;

    for (const [key, entry] of this.chunks) {
      const parts = key.split(',');
      const cx = parseInt(parts[0], 10);
      const cz = parseInt(parts[1], 10);

      const dx = cx - this.playerChunkX;
      const dz = cz - this.playerChunkZ;

      if (Math.abs(dx) > maxDist || Math.abs(dz) > maxDist) {
        // Remove mesh from scene
        if (entry.mesh) {
          this.scene.remove(entry.mesh);
          entry.mesh.geometry.dispose();
        }
        this.chunks.delete(key);
      }
    }
  }

  /**
   * Get the block ID at the given world coordinates.
   * @returns {number} block ID, or 0 (air) if the chunk isn't loaded.
   */
  getBlock(wx, wy, wz) {
    const cx = Math.floor(wx / CHUNK_SIZE);
    const cz = Math.floor(wz / CHUNK_SIZE);
    const key = chunkKey(cx, cz);
    const entry = this.chunks.get(key);
    if (!entry || !entry.chunk) return 0;

    const localX = ((wx % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE;
    const localZ = ((wz % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE;
    return entry.chunk.getBlock(localX, wy, localZ);
  }

  /**
   * Returns true when a chunk exists and has finished meshing.
   * @param {number} cx
   * @param {number} cz
   * @returns {boolean}
   */
  isChunkReady(cx, cz) {
    const entry = this.chunks.get(chunkKey(cx, cz));
    return Boolean(entry && entry.chunk && entry.state === STATE_READY);
  }

  /**
   * Finds the highest solid block at the given world X/Z column.
   * Returns -1 if the column is empty or the chunk is not loaded yet.
   * @param {number} wx
   * @param {number} wz
   * @returns {number}
   */
  getHighestSolidY(wx, wz) {
    const cx = Math.floor(wx / CHUNK_SIZE);
    const cz = Math.floor(wz / CHUNK_SIZE);
    const key = chunkKey(cx, cz);
    const entry = this.chunks.get(key);
    if (!entry || !entry.chunk) {
      return -1;
    }

    const localX = ((wx % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE;
    const localZ = ((wz % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE;

    for (let y = CHUNK_HEIGHT - 1; y >= 0; y -= 1) {
      if (isSolid(entry.chunk.getBlock(localX, y, localZ))) {
        return y;
      }
    }

    return -1;
  }

  /**
   * Set a block at the given world coordinates and rebuild the chunk mesh.
   * @param {number} wx
   * @param {number} wy
   * @param {number} wz
   * @param {number} blockId
   */
  setBlock(wx, wy, wz, blockId) {
    const cx = Math.floor(wx / CHUNK_SIZE);
    const cz = Math.floor(wz / CHUNK_SIZE);
    const key = chunkKey(cx, cz);
    const entry = this.chunks.get(key);
    if (!entry || !entry.chunk) return;

    const localX = ((wx % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE;
    const localZ = ((wz % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE;
    entry.chunk.setBlock(localX, wy, localZ, blockId);
    entry.state = STATE_DIRTY;

    // If the block is on a chunk edge, also mark the neighbor dirty
    if (localX === 0) this._markDirty(cx - 1, cz);
    if (localX === CHUNK_SIZE - 1) this._markDirty(cx + 1, cz);
    if (localZ === 0) this._markDirty(cx, cz - 1);
    if (localZ === CHUNK_SIZE - 1) this._markDirty(cx, cz + 1);
  }

  /**
   * Mark a chunk as dirty so it gets re-meshed next frame.
   */
  _markDirty(cx, cz) {
    const key = chunkKey(cx, cz);
    const entry = this.chunks.get(key);
    if (entry && entry.chunk && entry.state === STATE_READY) {
      entry.state = STATE_DIRTY;
    }
  }

  /**
   * Full cleanup — terminate workers and dispose all meshes.
   */
  dispose() {
    // Terminate workers
    for (const w of this.terrainWorkers) w.terminate();
    for (const w of this.meshWorkers) w.terminate();
    this.terrainWorkers = [];
    this.meshWorkers = [];
    this.terrainWorkersBusy = [];
    this.meshWorkersBusy = [];

    // Dispose all meshes
    for (const [, entry] of this.chunks) {
      if (entry.mesh) {
        this.scene.remove(entry.mesh);
        entry.mesh.geometry.dispose();
      }
    }
    this.chunks.clear();

    // Clear queues
    this.terrainQueue = [];
    this.meshQueue = [];
  }
}
