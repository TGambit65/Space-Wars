/**
 * Web Worker — off-thread terrain generation.
 *
 * Receives chunk generation requests and posts back serialized section arrays
 * as Transferable objects for zero-copy handoff to the main thread.
 *
 * Loaded via: new Worker(new URL('./workers/terrainWorker.js', import.meta.url), { type: 'module' })
 */
import { generateChunk } from '../TerrainGenerator.js';

self.onmessage = function (e) {
  const {
    cx,
    cz,
    chunkX = cx,
    chunkZ = cz,
    seed,
    planetType,
    biomeGrid,
    spawnChunk,
    requestId,
  } = e.data;

  try {
    const chunk = generateChunk(chunkX, chunkZ, seed, planetType, biomeGrid, spawnChunk);

    // Serialize sections to transferable ArrayBuffers
    const sections = [];
    const transferables = [];

    for (let i = 0; i < chunk.sections.length; i++) {
      const section = chunk.sections[i];
      if (section) {
        // Copy the buffer so we can transfer ownership
        const buf = section.buffer.slice(0);
        sections.push(buf);
        transferables.push(buf);
      } else {
        sections.push(null);
      }
    }

    self.postMessage(
      { cx: chunkX, cz: chunkZ, chunkX, chunkZ, sections, requestId, error: null },
      transferables
    );
  } catch (err) {
    self.postMessage({
      cx: chunkX,
      cz: chunkZ,
      chunkX,
      chunkZ,
      sections: null,
      requestId,
      error: err.message || 'Terrain generation failed',
    });
  }
};
