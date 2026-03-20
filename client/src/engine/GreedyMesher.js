/**
 * Greedy mesher — converts a Chunk into an optimized triangle mesh.
 *
 * For each of the 6 face directions, sweeps slice-by-slice through the chunk
 * and merges adjacent co-planar faces of the same block type into larger quads.
 * Computes per-vertex ambient occlusion (4 levels: 1.0, 0.8, 0.6, 0.4).
 *
 * Inputs:
 *   chunk         — Chunk instance
 *   neighbors     — { north, south, east, west } edge arrays (Uint8Array or null)
 *                   Each edge array is CHUNK_HEIGHT * CHUNK_SIZE entries,
 *                   index = y * CHUNK_SIZE + i
 *   blockRegistry — the BLOCKS array from BlockRegistry
 *
 * Output:
 *   { positions: Float32Array, normals: Float32Array, uvs: Float32Array,
 *     indices: Uint32Array, aos: Float32Array }
 */

import { CHUNK_SIZE, CHUNK_HEIGHT } from './Chunk.js';

// Face directions: [dx, dy, dz]
// flipWinding: the natural quad winding (u-axis × v-axis) doesn't match the
// face normal for some directions, so we flip the triangle indices to ensure
// front-face visibility with THREE.FrontSide culling.
const FACES = [
  { name: 'py', dir: [0,  1, 0], axis: 1, positive: true,  flipWinding: true  }, // top    (+Y)
  { name: 'ny', dir: [0, -1, 0], axis: 1, positive: false, flipWinding: false }, // bottom (-Y)
  { name: 'px', dir: [1,  0, 0], axis: 0, positive: true,  flipWinding: true  }, // east   (+X)
  { name: 'nx', dir: [-1, 0, 0], axis: 0, positive: false, flipWinding: false }, // west   (-X)
  { name: 'pz', dir: [0,  0, 1], axis: 2, positive: true,  flipWinding: false }, // south  (+Z)
  { name: 'nz', dir: [0,  0,-1], axis: 2, positive: false, flipWinding: true  }, // north  (-Z)
];

// AO value table: (side1 + side2 + corner) → brightness
const AO_TABLE = [1.0, 0.8, 0.6, 0.4]; // index = occluder count

/**
 * Check if a block ID should be treated as transparent for face culling.
 * @param {number} id
 * @param {(object|null)[]} registry - BLOCKS array
 * @returns {boolean}
 */
function isTransparentBlock(id, registry) {
  if (id === 0) return true;
  const block = registry[id];
  return block ? block.transparent : true;
}

/**
 * Check if a block is solid (used for AO calculation).
 * @param {number} id
 * @param {(object|null)[]} registry
 * @returns {boolean}
 */
function isSolidBlock(id, registry) {
  if (id === 0) return false;
  const block = registry[id];
  return block ? block.solid : false;
}

/**
 * Get block at world-relative position within or adjacent to the chunk.
 * Uses neighbor edge data for cross-boundary lookups.
 */
function getBlockAt(chunk, x, y, z, neighbors, registry) {
  if (y < 0 || y >= CHUNK_HEIGHT) return 0;

  // Inside chunk bounds
  if (x >= 0 && x < CHUNK_SIZE && z >= 0 && z < CHUNK_SIZE) {
    return chunk.getBlock(x, y, z);
  }

  // Cross-boundary: use neighbor edge data
  // neighbor edges are indexed: y * CHUNK_SIZE + i
  if (x < 0 && neighbors.west) {
    return neighbors.west[y * CHUNK_SIZE + z];
  }
  if (x >= CHUNK_SIZE && neighbors.east) {
    return neighbors.east[y * CHUNK_SIZE + z];
  }
  if (z < 0 && neighbors.north) {
    return neighbors.north[y * CHUNK_SIZE + x];
  }
  if (z >= CHUNK_SIZE && neighbors.south) {
    return neighbors.south[y * CHUNK_SIZE + x];
  }

  // No neighbor data — treat as air (face is visible)
  return 0;
}

/**
 * Compute AO value for one vertex of a face.
 *
 * @param {object} chunk
 * @param {number} x,y,z - position of the block that owns the face
 * @param {number[]} normal - face normal [dx, dy, dz]
 * @param {number[]} tangent - tangent direction along the face
 * @param {number[]} bitangent - bitangent direction along the face
 * @param {number} tu - tangent offset (-1 or +1 for vertex corner)
 * @param {number} bv - bitangent offset (-1 or +1 for vertex corner)
 * @param {object} neighbors
 * @param {Array} registry
 * @returns {number} AO brightness (1.0, 0.8, 0.6, 0.4)
 */
function vertexAO(chunk, x, y, z, normal, tangent, bitangent, tu, bv, neighbors, registry) {
  // Position on the face (shifted by normal to sample neighbors of the exposed surface)
  const fx = x + normal[0];
  const fy = y + normal[1];
  const fz = z + normal[2];

  const side1Id = getBlockAt(chunk, fx + tangent[0] * tu, fy + tangent[1] * tu, fz + tangent[2] * tu, neighbors, registry);
  const side2Id = getBlockAt(chunk, fx + bitangent[0] * bv, fy + bitangent[1] * bv, fz + bitangent[2] * bv, neighbors, registry);
  const cornerId = getBlockAt(chunk, fx + tangent[0] * tu + bitangent[0] * bv, fy + tangent[1] * tu + bitangent[1] * bv, fz + tangent[2] * tu + bitangent[2] * bv, neighbors, registry);

  const s1 = isSolidBlock(side1Id, registry) ? 1 : 0;
  const s2 = isSolidBlock(side2Id, registry) ? 1 : 0;
  const c  = isSolidBlock(cornerId, registry) ? 1 : 0;

  // If both sides are solid, corner is always occluded (= 3)
  const ao = s1 && s2 ? 3 : (s1 + s2 + c);
  return AO_TABLE[ao];
}

/**
 * Generate an optimized mesh for a chunk using greedy meshing.
 *
 * @param {Chunk} chunk
 * @param {{ north: Uint8Array|null, south: Uint8Array|null, east: Uint8Array|null, west: Uint8Array|null }} neighbors
 * @param {(object|null)[]} blockRegistry - BLOCKS array
 * @returns {{ positions: Float32Array, normals: Float32Array, uvs: Float32Array, indices: Uint32Array, aos: Float32Array }}
 */
export function greedyMesh(chunk, neighbors, blockRegistry) {
  const positions = [];
  const normals   = [];
  const uvs       = [];
  const indices   = [];
  const aos       = [];

  let vertexCount = 0;

  const nbrs = {
    north: neighbors.north || null,
    south: neighbors.south || null,
    east:  neighbors.east  || null,
    west:  neighbors.west  || null,
  };

  for (const face of FACES) {
    const [dx, dy, dz] = face.dir;
    const axis = face.axis;

    // Determine the two axes that span this face's plane
    let uAxis, vAxis; // indices into [x, y, z]
    let uSize, vSize, sliceSize;

    if (axis === 1) {
      // Y-faces: plane is XZ
      uAxis = 0; vAxis = 2;
      uSize = CHUNK_SIZE; vSize = CHUNK_SIZE; sliceSize = CHUNK_HEIGHT;
    } else if (axis === 0) {
      // X-faces: plane is YZ
      uAxis = 2; vAxis = 1;
      uSize = CHUNK_SIZE; vSize = CHUNK_HEIGHT; sliceSize = CHUNK_SIZE;
    } else {
      // Z-faces: plane is XY
      uAxis = 0; vAxis = 1;
      uSize = CHUNK_SIZE; vSize = CHUNK_HEIGHT; sliceSize = CHUNK_SIZE;
    }

    // Sweep along the face normal axis
    for (let slice = 0; slice < sliceSize; slice++) {
      // Build 2D mask of exposed face block IDs for this slice
      // mask[v * uSize + u] = blockId if face is visible, 0 otherwise
      const mask = new Int16Array(uSize * vSize); // -1 = already merged, 0 = no face, >0 = blockId
      const aoMask = new Float32Array(uSize * vSize * 4); // 4 AO values per face

      for (let v = 0; v < vSize; v++) {
        for (let u = 0; u < uSize; u++) {
          // Reconstruct x, y, z from slice, u, v
          const pos = [0, 0, 0];
          pos[axis] = slice;
          pos[uAxis] = u;
          pos[vAxis] = v;

          const blockId = chunk.getBlock(pos[0], pos[1], pos[2]);
          if (blockId === 0) continue;
          // Skip transparent blocks that are not solid (rendered separately or invisible).
          // Solid transparent blocks like leaves, windows, doors are kept.
          const blockDef = blockRegistry[blockId];
          if (blockDef && blockDef.transparent && !blockDef.solid) continue;

          // Check the adjacent block in the face direction
          const nx = pos[0] + dx;
          const ny = pos[1] + dy;
          const nz = pos[2] + dz;

          const adjId = getBlockAt(chunk, nx, ny, nz, nbrs, blockRegistry);

          // Face is visible if adjacent block is transparent (and not the same transparent type)
          if (!isTransparentBlock(adjId, blockRegistry)) continue;
          if (adjId === blockId) continue; // same transparent block — skip

          mask[v * uSize + u] = blockId;

          // Compute AO for 4 vertices of this face
          const normal = face.dir;
          const tangent = [0, 0, 0];
          const bitangent = [0, 0, 0];
          tangent[uAxis] = 1;
          bitangent[vAxis] = 1;

          const idx = (v * uSize + u) * 4;
          aoMask[idx + 0] = vertexAO(chunk, pos[0], pos[1], pos[2], normal, tangent, bitangent, -1, -1, nbrs, blockRegistry);
          aoMask[idx + 1] = vertexAO(chunk, pos[0], pos[1], pos[2], normal, tangent, bitangent,  1, -1, nbrs, blockRegistry);
          aoMask[idx + 2] = vertexAO(chunk, pos[0], pos[1], pos[2], normal, tangent, bitangent,  1,  1, nbrs, blockRegistry);
          aoMask[idx + 3] = vertexAO(chunk, pos[0], pos[1], pos[2], normal, tangent, bitangent, -1,  1, nbrs, blockRegistry);
        }
      }

      // Greedy merge: scan rows, extend right then down
      for (let v = 0; v < vSize; v++) {
        for (let u = 0; u < uSize; ) {
          const blockId = mask[v * uSize + u];
          if (blockId <= 0) { u++; continue; }

          // Determine width: extend right while same block type and similar AO
          let w = 1;
          while (u + w < uSize && mask[v * uSize + u + w] === blockId) {
            w++;
          }

          // Determine height: extend down while entire row matches
          let h = 1;
          let canExtend = true;
          while (v + h < vSize && canExtend) {
            for (let du = 0; du < w; du++) {
              if (mask[(v + h) * uSize + u + du] !== blockId) {
                canExtend = false;
                break;
              }
            }
            if (canExtend) h++;
          }

          // Mark merged cells
          for (let dv = 0; dv < h; dv++) {
            for (let du = 0; du < w; du++) {
              if (dv === 0 && du === 0) continue;
              mask[(v + dv) * uSize + u + du] = -1;
            }
          }
          mask[v * uSize + u] = -1;

          // Emit quad
          // Reconstruct world position of the quad's origin corner
          const origin = [0, 0, 0];
          origin[axis] = slice;
          origin[uAxis] = u;
          origin[vAxis] = v;

          // Offset the quad along the face normal for positive faces
          const offset = face.positive ? 1 : 0;

          // 4 corners of the quad
          const p0 = [origin[0], origin[1], origin[2]];
          const p1 = [origin[0], origin[1], origin[2]];
          const p2 = [origin[0], origin[1], origin[2]];
          const p3 = [origin[0], origin[1], origin[2]];

          p0[axis] += offset;
          p1[axis] += offset;
          p2[axis] += offset;
          p3[axis] += offset;

          // p0 = (u, v), p1 = (u+w, v), p2 = (u+w, v+h), p3 = (u, v+h)
          p1[uAxis] += w;
          p2[uAxis] += w;
          p2[vAxis] += h;
          p3[vAxis] += h;

          // Get texture atlas index for this face
          const block = blockRegistry[blockId];
          let atlasIndex = 0;
          if (block && block.textures) {
            if (face.name === 'py') atlasIndex = block.textures.top;
            else if (face.name === 'ny') atlasIndex = block.textures.bottom;
            else atlasIndex = block.textures.side;
          }

          // UV coordinates: map entire quad to one atlas tile
          // Atlas is 32x32 grid, tile coords:
          const tilesPerRow = 32;
          const tileU = (atlasIndex % tilesPerRow) / tilesPerRow;
          const tileV = Math.floor(atlasIndex / tilesPerRow) / tilesPerRow;
          const tileSize = 1 / tilesPerRow;

          // Tile UVs (tiling the texture across the quad for larger merged faces)
          const u0 = tileU;
          const v0 = tileV;
          const u1 = tileU + tileSize;
          const v1 = tileV + tileSize;

          // AO: use corner values of the origin face
          const aoIdx = (v * uSize + u) * 4;
          const ao0 = aoMask[aoIdx + 0];
          const ao1 = aoMask[aoIdx + 1];
          const ao2 = aoMask[aoIdx + 2];
          const ao3 = aoMask[aoIdx + 3];

          // Emit 4 vertices
          const vi = vertexCount;
          positions.push(
            p0[0], p0[1], p0[2],
            p1[0], p1[1], p1[2],
            p2[0], p2[1], p2[2],
            p3[0], p3[1], p3[2]
          );

          normals.push(
            dx, dy, dz,
            dx, dy, dz,
            dx, dy, dz,
            dx, dy, dz
          );

          uvs.push(
            u0, v1,
            u1, v1,
            u1, v0,
            u0, v0
          );

          aos.push(ao0, ao1, ao2, ao3);

          // Two triangles — flip based on AO to avoid anisotropy artifacts.
          // For faces where the natural quad winding is inverted, reverse the
          // triangle vertex order so front-face culling works correctly.
          if (face.flipWinding) {
            if (ao0 + ao2 > ao1 + ao3) {
              indices.push(vi, vi + 2, vi + 1, vi, vi + 3, vi + 2);
            } else {
              indices.push(vi + 1, vi + 3, vi + 2, vi, vi + 3, vi + 1);
            }
          } else {
            if (ao0 + ao2 > ao1 + ao3) {
              indices.push(vi, vi + 1, vi + 2, vi, vi + 2, vi + 3);
            } else {
              indices.push(vi + 1, vi + 2, vi + 3, vi, vi + 1, vi + 3);
            }
          }

          vertexCount += 4;
          u += w;
        }
      }
    }
  }

  return {
    positions: new Float32Array(positions),
    normals:   new Float32Array(normals),
    uvs:       new Float32Array(uvs),
    indices:   new Uint32Array(indices),
    aos:       new Float32Array(aos),
  };
}
