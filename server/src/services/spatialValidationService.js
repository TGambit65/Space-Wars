/**
 * Centralized cross-table collision detection for colony surface grids.
 * Checks ColonyBuilding footprints, SurfaceAnomaly positions, and terrain buildability.
 */
const { ColonyBuilding, SurfaceAnomaly, CustomBlock } = require('../models');
const { generateTerrain, isBuildable } = require('../utils/terrainGenerator');
const config = require('../config');
const { Op } = require('sequelize');

/**
 * Validate that a building can be placed at (gridX, gridY) on the colony surface.
 *
 * @param {string} colonyId
 * @param {number} gridX
 * @param {number} gridY
 * @param {string} buildingType - config key (e.g., 'SURFACE_MINE')
 * @param {object} colony - Colony instance with planet association
 * @param {object} transaction - Sequelize transaction (Colony row should be locked first)
 * @param {string|null} excludeBuildingId - Building ID to exclude (for move operations)
 * @returns {{ valid: boolean, reason?: string }}
 */
async function validatePlacement(colonyId, gridX, gridY, buildingType, colony, transaction, excludeBuildingId = null, existingGrid = null) {
  const footprint = config.colonySurface.buildingFootprints[buildingType];
  if (!footprint) {
    return { valid: false, reason: `Unknown building type: ${buildingType}` };
  }

  const planet = colony.planet;
  if (!planet) {
    return { valid: false, reason: 'Colony has no associated planet' };
  }

  const { grid, width, height } = existingGrid || generateTerrain(
    colonyId, planet.planet_id, planet.type, planet.size
  );

  // Check all tiles in the footprint
  for (let dy = 0; dy < footprint.h; dy++) {
    for (let dx = 0; dx < footprint.w; dx++) {
      const tx = gridX + dx;
      const ty = gridY + dy;

      // Bounds check
      if (tx < 0 || tx >= width || ty < 0 || ty >= height) {
        return { valid: false, reason: `Placement out of bounds at (${tx}, ${ty})` };
      }

      // Terrain buildability check
      const terrain = grid[ty][tx];
      if (!isBuildable(terrain)) {
        return { valid: false, reason: `Tile (${tx}, ${ty}) is ${terrain} — not buildable` };
      }
    }
  }

  // Fetch buildings, blocks, and anomalies in parallel
  const [existingBuildings, blocks, anomalies] = await Promise.all([
    ColonyBuilding.findAll({
      where: { colony_id: colonyId, grid_x: { [Op.ne]: null } },
      transaction
    }),
    CustomBlock.findAll({
      where: { colony_id: colonyId },
      transaction
    }),
    SurfaceAnomaly.findAll({
      where: { colony_id: colonyId, expires_at: { [Op.gt]: new Date() } },
      transaction
    })
  ]);

  // Check collision with placed buildings
  for (const building of existingBuildings) {
    if (excludeBuildingId && building.building_id === excludeBuildingId) continue;

    const bFootprint = config.colonySurface.buildingFootprints[building.building_type];
    if (!bFootprint) continue;

    if (footprintsOverlap(
      gridX, gridY, footprint.w, footprint.h,
      building.grid_x, building.grid_y, bFootprint.w, bFootprint.h
    )) {
      return { valid: false, reason: `Overlaps with existing ${building.building_type}` };
    }
  }

  // Check collision with non-floor custom blocks within footprint
  for (const block of blocks) {
    if (block.block_type === 'floor') continue;
    if (
      block.grid_x >= gridX && block.grid_x < gridX + footprint.w &&
      block.grid_y >= gridY && block.grid_y < gridY + footprint.h
    ) {
      return { valid: false, reason: `Tile (${block.grid_x}, ${block.grid_y}) has a ${block.block_type} block` };
    }
  }

  // Check collision with active anomalies
  for (const anomaly of anomalies) {
    if (
      anomaly.grid_x >= gridX && anomaly.grid_x < gridX + footprint.w &&
      anomaly.grid_y >= gridY && anomaly.grid_y < gridY + footprint.h
    ) {
      return { valid: false, reason: `Tile (${anomaly.grid_x}, ${anomaly.grid_y}) has an unclaimed anomaly` };
    }
  }

  return { valid: true };
}

/**
 * Check if two axis-aligned rectangles overlap.
 */
function footprintsOverlap(x1, y1, w1, h1, x2, y2, w2, h2) {
  return !(x1 + w1 <= x2 || x2 + w2 <= x1 || y1 + h1 <= y2 || y2 + h2 <= y1);
}

/**
 * Validate that a single tile is unoccupied (for anomaly spawning).
 */
async function isTileEmpty(colonyId, gridX, gridY, colony, transaction, cached = null) {
  const grid = cached?.grid || generateTerrain(colonyId, colony.planet.planet_id, colony.planet.type, colony.planet.size).grid;

  if (!isBuildable(grid[gridY]?.[gridX])) return false;

  // Use cached buildings/anomalies if provided, else query
  const buildings = cached?.buildings || await ColonyBuilding.findAll({
    where: { colony_id: colonyId },
    transaction
  });

  for (const building of buildings) {
    if (building.grid_x === null || building.grid_y === null) continue;
    const fp = config.colonySurface.buildingFootprints[building.building_type];
    if (!fp) continue;
    if (
      gridX >= building.grid_x && gridX < building.grid_x + fp.w &&
      gridY >= building.grid_y && gridY < building.grid_y + fp.h
    ) {
      return false;
    }
  }

  const anomalies = cached?.anomalies || await SurfaceAnomaly.findAll({
    where: { colony_id: colonyId },
    transaction
  });
  const now = new Date();
  for (const anomaly of anomalies) {
    if (new Date(anomaly.expires_at) < now) continue;
    if (anomaly.grid_x === gridX && anomaly.grid_y === gridY) return false;
  }

  // Check custom blocks
  const customBlocks = cached?.customBlocks || await CustomBlock.findAll({
    where: { colony_id: colonyId },
    transaction
  });
  for (const block of customBlocks) {
    if (block.grid_x === gridX && block.grid_y === gridY) return false;
  }

  return true;
}

module.exports = {
  validatePlacement,
  footprintsOverlap,
  isTileEmpty
};
