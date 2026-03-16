/**
 * Chunk — a 16 x 128 x 16 column of blocks stored in 8 vertical sections.
 *
 * Each section is a 16x16x16 cube stored as a flat Uint8Array(4096).
 * Sections are lazily allocated — an all-air section stays null to save memory.
 *
 * Index within a section: (y & 15) * 256 + z * 16 + x
 * where x, z are 0..15 and y is the local y within the section (0..15).
 */

export const CHUNK_SIZE = 16;
export const CHUNK_HEIGHT = 128;
export const SECTION_HEIGHT = 16;
export const SECTIONS_PER_CHUNK = 8; // 128 / 16

export class Chunk {
  /**
   * @param {number} chunkX - chunk coordinate on the X axis
   * @param {number} chunkZ - chunk coordinate on the Z axis
   */
  constructor(chunkX, chunkZ) {
    this.x = chunkX;
    this.z = chunkZ;
    /** @type {(Uint8Array|null)[]} 8 sections, null = all air */
    this.sections = new Array(SECTIONS_PER_CHUNK).fill(null);
    this.dirty = true;
  }

  // ---------------------------------------------------------------------------
  // Block access
  // ---------------------------------------------------------------------------

  /**
   * Get the block ID at local coordinates.
   * @param {number} x 0..15
   * @param {number} y 0..127
   * @param {number} z 0..15
   * @returns {number} block ID (0 = air if section unallocated)
   */
  getBlock(x, y, z) {
    const sectionY = (y >>> 4); // y >> 4, unsigned
    const section = this.sections[sectionY];
    if (!section) return 0;
    const index = ((y & 15) << 8) | (z << 4) | x; // (y&15)*256 + z*16 + x
    return section[index];
  }

  /**
   * Set the block ID at local coordinates.
   * Allocates the section if needed; deallocates if the section becomes empty.
   * @param {number} x 0..15
   * @param {number} y 0..127
   * @param {number} z 0..15
   * @param {number} id block ID (0-255)
   */
  setBlock(x, y, z, id) {
    const sectionY = (y >>> 4);
    let section = this.sections[sectionY];

    if (id === 0 && !section) return; // setting air in an air section — noop

    if (!section) {
      section = new Uint8Array(4096); // allocate on first write
      this.sections[sectionY] = section;
    }

    const index = ((y & 15) << 8) | (z << 4) | x;
    section[index] = id;
    this.dirty = true;
  }

  // ---------------------------------------------------------------------------
  // Section helpers
  // ---------------------------------------------------------------------------

  /**
   * Returns true if the given section index has no non-air blocks.
   * @param {number} sectionY 0..7
   */
  isEmptySection(sectionY) {
    const section = this.sections[sectionY];
    if (!section) return true;
    for (let i = 0; i < 4096; i++) {
      if (section[i] !== 0) return false;
    }
    return true;
  }

  /**
   * Get the raw Uint8Array for a section, or null if empty.
   * @param {number} sectionY 0..7
   * @returns {Uint8Array|null}
   */
  getSection(sectionY) {
    return this.sections[sectionY];
  }

  // ---------------------------------------------------------------------------
  // Edge extraction (for neighbor meshing)
  // ---------------------------------------------------------------------------

  /**
   * Extract the edge column of blocks on a given face for cross-chunk meshing.
   * Returns a Uint8Array(CHUNK_HEIGHT * CHUNK_SIZE) = 2048 entries.
   *
   * Layout: index = y * 16 + (x or z depending on face).
   *
   * @param {'north'|'south'|'east'|'west'} face
   * @returns {Uint8Array}
   */
  getEdge(face) {
    const edge = new Uint8Array(CHUNK_HEIGHT * CHUNK_SIZE);

    for (let y = 0; y < CHUNK_HEIGHT; y++) {
      for (let i = 0; i < CHUNK_SIZE; i++) {
        let blockId;
        switch (face) {
          case 'north': blockId = this.getBlock(i, y, 0);               break; // z=0
          case 'south': blockId = this.getBlock(i, y, CHUNK_SIZE - 1);  break; // z=15
          case 'east':  blockId = this.getBlock(CHUNK_SIZE - 1, y, i);  break; // x=15
          case 'west':  blockId = this.getBlock(0, y, i);               break; // x=0
          default:      blockId = 0;
        }
        edge[y * CHUNK_SIZE + i] = blockId;
      }
    }

    return edge;
  }

  // ---------------------------------------------------------------------------
  // Serialization helpers
  // ---------------------------------------------------------------------------

  /**
   * Serialize sections to a transferable array for Web Worker postMessage.
   * Returns an array of 8 entries (Uint8Array.buffer or null).
   */
  serializeSections() {
    return this.sections.map(s => (s ? s.buffer.slice(0) : null));
  }

  /**
   * Reconstruct a Chunk from serialized section buffers.
   * @param {number} chunkX
   * @param {number} chunkZ
   * @param {(ArrayBuffer|null)[]} sectionBuffers
   * @returns {Chunk}
   */
  static fromSections(chunkX, chunkZ, sectionBuffers) {
    const chunk = new Chunk(chunkX, chunkZ);
    for (let i = 0; i < SECTIONS_PER_CHUNK; i++) {
      chunk.sections[i] = sectionBuffers[i] ? new Uint8Array(sectionBuffers[i]) : null;
    }
    return chunk;
  }

  // ---------------------------------------------------------------------------
  // Coordinate conversion — static utilities
  // ---------------------------------------------------------------------------

  /**
   * Convert world x,z to chunk coordinates and local offsets.
   * @param {number} wx world X
   * @param {number} wz world Z
   * @returns {{ cx: number, cz: number, lx: number, lz: number }}
   */
  static worldToChunk(wx, wz) {
    const cx = Math.floor(wx / CHUNK_SIZE);
    const cz = Math.floor(wz / CHUNK_SIZE);
    // Proper modulo that handles negatives
    const lx = ((wx % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE;
    const lz = ((wz % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE;
    return { cx, cz, lx, lz };
  }

  /**
   * Convert local block coordinates + chunk position to world coordinates.
   * @param {number} lx local X (0..15)
   * @param {number} ly local Y (0..127)
   * @param {number} lz local Z (0..15)
   * @param {number} chunkX
   * @param {number} chunkZ
   * @returns {{ wx: number, wy: number, wz: number }}
   */
  static localToWorld(lx, ly, lz, chunkX, chunkZ) {
    return {
      wx: chunkX * CHUNK_SIZE + lx,
      wy: ly,
      wz: chunkZ * CHUNK_SIZE + lz,
    };
  }
}
