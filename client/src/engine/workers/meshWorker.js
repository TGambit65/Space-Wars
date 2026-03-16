/**
 * Web Worker — off-thread greedy meshing.
 *
 * Receives serialized chunk sections + neighbor edge data, reconstructs
 * a minimal Chunk, runs the greedy mesher, and posts back geometry buffers
 * as Transferable objects.
 *
 * Loaded via: new Worker(new URL('./workers/meshWorker.js', import.meta.url), { type: 'module' })
 */
import { Chunk, SECTIONS_PER_CHUNK } from '../Chunk.js';
import { greedyMesh } from '../GreedyMesher.js';
import { BLOCKS } from '../BlockRegistry.js';

self.onmessage = function (e) {
  const {
    cx,
    cz,
    chunkX = cx,
    chunkZ = cz,
    sections,
    neighbors,
    neighborEdges = neighbors,
    requestId,
  } = e.data;

  try {
    // Reconstruct Chunk from serialized section buffers
    const chunk = new Chunk(chunkX, chunkZ);
    for (let i = 0; i < SECTIONS_PER_CHUNK; i++) {
      if (sections[i]) {
        chunk.sections[i] = new Uint8Array(sections[i]);
      }
    }

    // Reconstruct neighbor edge Uint8Arrays from transferred buffers
    const neighbors = {
      north: neighborEdges.north ? new Uint8Array(neighborEdges.north) : null,
      south: neighborEdges.south ? new Uint8Array(neighborEdges.south) : null,
      east:  neighborEdges.east  ? new Uint8Array(neighborEdges.east)  : null,
      west:  neighborEdges.west  ? new Uint8Array(neighborEdges.west)  : null,
    };

    // Run the greedy mesher
    const mesh = greedyMesh(chunk, neighbors, BLOCKS);

    // Transfer the typed array buffers
    const transferables = [
      mesh.positions.buffer,
      mesh.normals.buffer,
      mesh.uvs.buffer,
      mesh.indices.buffer,
      mesh.aos.buffer,
    ];

    self.postMessage(
      {
        cx: chunkX,
        cz: chunkZ,
        chunkX,
        chunkZ,
        positions: mesh.positions.buffer,
        normals:   mesh.normals.buffer,
        uvs:       mesh.uvs.buffer,
        indices:   mesh.indices.buffer,
        aos:       mesh.aos.buffer,
        requestId,
        error: null,
      },
      transferables
    );
  } catch (err) {
    self.postMessage({
      cx: chunkX,
      cz: chunkZ,
      chunkX,
      chunkZ,
      positions: null,
      normals: null,
      uvs: null,
      indices: null,
      aos: null,
      requestId,
      error: err.message || 'Meshing failed',
    });
  }
};
