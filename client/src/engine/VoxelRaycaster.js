/**
 * VoxelRaycaster — DDA (Digital Differential Analyzer) raycaster for voxel grids.
 *
 * Efficiently marches a ray through the voxel grid one cell at a time,
 * returning the first solid block hit along with the face normal.
 */

import * as THREE from 'three';
import { isSolid } from './BlockRegistry.js';

export class VoxelRaycaster {
  /**
   * @param {{ getBlock(wx: number, wy: number, wz: number): number }} chunkManager
   */
  constructor(chunkManager) {
    this.chunkManager = chunkManager;
  }

  /**
   * Cast a ray through the voxel grid using the DDA algorithm.
   *
   * @param {THREE.Vector3} origin    - ray start position (world space)
   * @param {THREE.Vector3} direction - ray direction (will be normalized internally)
   * @param {number} [maxDistance=7]   - maximum reach in blocks
   * @returns {{ hit: boolean, blockPos?: [number, number, number], normal?: [number, number, number], blockType?: number }}
   */
  cast(origin, direction, maxDistance = 7) {
    // Normalize direction to ensure correct distance calculations
    const dir = direction.clone().normalize();

    // Starting voxel (integer coordinates)
    let ix = Math.floor(origin.x);
    let iy = Math.floor(origin.y);
    let iz = Math.floor(origin.z);

    // Step direction per axis (+1 or -1)
    const stepX = dir.x > 0 ? 1 : -1;
    const stepY = dir.y > 0 ? 1 : -1;
    const stepZ = dir.z > 0 ? 1 : -1;

    // tDelta: how far along the ray (in t) to traverse one full voxel on each axis
    // If a direction component is 0, tDelta = Infinity (we never cross that axis)
    const tDeltaX = dir.x !== 0 ? Math.abs(1 / dir.x) : Infinity;
    const tDeltaY = dir.y !== 0 ? Math.abs(1 / dir.y) : Infinity;
    const tDeltaZ = dir.z !== 0 ? Math.abs(1 / dir.z) : Infinity;

    // tMax: distance along the ray to the next voxel boundary on each axis
    let tMaxX = dir.x !== 0
      ? (dir.x > 0 ? (ix + 1 - origin.x) : (origin.x - ix)) * tDeltaX
      : Infinity;
    let tMaxY = dir.y !== 0
      ? (dir.y > 0 ? (iy + 1 - origin.y) : (origin.y - iy)) * tDeltaY
      : Infinity;
    let tMaxZ = dir.z !== 0
      ? (dir.z > 0 ? (iz + 1 - origin.z) : (origin.z - iz)) * tDeltaZ
      : Infinity;

    // Track the face normal of the last step taken
    let normalX = 0;
    let normalY = 0;
    let normalZ = 0;

    let dist = 0;

    // Skip the starting voxel (player's head may be inside a block) by stepping once first
    let firstStep = true;

    while (dist < maxDistance) {
      // Check current voxel (skip the origin voxel to avoid zero-normal issues)
      if (!firstStep) {
        const blockType = this.chunkManager.getBlock(ix, iy, iz);
        if (blockType > 0 && isSolid(blockType)) {
          return {
            hit: true,
            blockPos: [ix, iy, iz],
            normal: [normalX, normalY, normalZ],
            blockType,
          };
        }
      }
      firstStep = false;

      // Advance to the next voxel boundary (step along the axis with smallest tMax)
      if (tMaxX < tMaxY && tMaxX < tMaxZ) {
        ix += stepX;
        dist = tMaxX;
        tMaxX += tDeltaX;
        normalX = -stepX;
        normalY = 0;
        normalZ = 0;
      } else if (tMaxY < tMaxZ) {
        iy += stepY;
        dist = tMaxY;
        tMaxY += tDeltaY;
        normalX = 0;
        normalY = -stepY;
        normalZ = 0;
      } else {
        iz += stepZ;
        dist = tMaxZ;
        tMaxZ += tDeltaZ;
        normalX = 0;
        normalY = 0;
        normalZ = -stepZ;
      }
    }

    return { hit: false };
  }

  /**
   * Convenience method: cast a ray from the camera center into the scene.
   *
   * @param {THREE.PerspectiveCamera} camera
   * @param {number} [maxDistance=7]
   * @returns {{ hit: boolean, blockPos?: [number, number, number], normal?: [number, number, number], blockType?: number, placePos?: [number, number, number] }}
   */
  getTargetBlock(camera, maxDistance = 7) {
    // Camera forward direction in world space
    const direction = new THREE.Vector3(0, 0, -1);
    direction.applyQuaternion(camera.quaternion);

    const result = this.cast(camera.position, direction, maxDistance);

    if (result.hit) {
      // Placement position: the empty voxel adjacent to the hit face
      result.placePos = [
        result.blockPos[0] + result.normal[0],
        result.blockPos[1] + result.normal[1],
        result.blockPos[2] + result.normal[2],
      ];
    }

    return result;
  }
}
