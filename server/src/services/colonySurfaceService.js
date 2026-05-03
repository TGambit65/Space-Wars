/**
 * Colony Surface Service — manages the tile grid surface view of colonies.
 * Handles terrain generation, building placement with adjacency bonuses,
 * surface anomaly spawning/claiming, and legacy migration.
 */
const { Colony, ColonyBuilding, SurfaceAnomaly, CustomBlock, GroundCombatInstance, Planet, User, sequelize } = require('../models');
const { generateTerrain, generateDeposits, getGridSize, isBuildable } = require('../utils/terrainGenerator');
const { validatePlacement, isTileEmpty } = require('./spatialValidationService');
const { getBlockCap } = require('./customBlockService');
const config = require('../config');
const { Op } = require('sequelize');

/**
 * Enrich a building record with config data and footprint.
 */
function enrichBuilding(building) {
  const bConfig = config.buildings[building.building_type] || {};
  const footprint = config.colonySurface.buildingFootprints[building.building_type] || { w: 1, h: 1 };
  return {
    ...building.toJSON(),
    config: {
      name: bConfig.name,
      category: bConfig.category,
      tier: bConfig.tier,
      cost: bConfig.cost,
      powerConsumption: bConfig.powerConsumption,
      powerGeneration: bConfig.powerGeneration,
      maintenanceCost: bConfig.maintenanceCost,
      production: bConfig.production,
      bonusEffect: bConfig.bonusEffect || null
    },
    footprint
  };
}

/**
 * Check if colony has active ground combat. Throws 409 if locked.
 */
async function checkCombatLock(colonyId, transaction) {
  const activeCombat = await GroundCombatInstance.findOne({
    where: { colony_id: colonyId, status: { [Op.in]: ['deploying', 'active'] } },
    transaction
  });
  if (activeCombat) {
    throw Object.assign(new Error('Surface is locked during active combat'), { statusCode: 409 });
  }
}

/**
 * Get colony surface data: terrain, placed buildings, anomalies, deposits, unplaced inventory.
 * Lazily spawns daily anomalies if needed.
 */
async function getSurface(colonyId, userId) {
  const colony = await Colony.findOne({
    where: { colony_id: colonyId, user_id: userId },
    include: [{ model: Planet, as: 'planet' }]
  });
  if (!colony) {
    throw Object.assign(new Error('Colony not found or not owned'), { statusCode: 404 });
  }

  const planet = colony.planet;
  const terrain = generateTerrain(colonyId, planet.planet_id, planet.type, planet.size);
  const deposits = generateDeposits(colonyId, planet.planet_id, planet.type, planet.size, terrain);

  // If not initialized, return terrain preview only
  if (!colony.surface_initialized) {
    return {
      needs_initialization: true,
      terrain: terrain.grid,
      width: terrain.width,
      height: terrain.height,
      deposits,
      planet_type: planet.type,
      planet_size: planet.size
    };
  }

  // Lazy anomaly spawning
  await spawnAnomaliesIfNeeded(colony);

  // Fetch buildings, anomalies, and blocks in parallel
  const now = new Date();
  const [buildings, anomalies, customBlocks] = await Promise.all([
    ColonyBuilding.findAll({
      where: { colony_id: colonyId },
      order: [['createdAt', 'ASC']]
    }),
    SurfaceAnomaly.findAll({
      where: { colony_id: colonyId, expires_at: { [Op.gt]: now } }
    }),
    CustomBlock.findAll({
      where: { colony_id: colonyId },
      order: [['createdAt', 'ASC']]
    })
  ]);

  // Separate placed vs unplaced buildings
  const placed = [];
  const unplaced = [];
  for (const b of buildings) {
    const entry = enrichBuilding(b);
    if (b.grid_x !== null && b.grid_y !== null) {
      placed.push(entry);
    } else {
      unplaced.push(entry);
    }
  }

  return {
    needs_initialization: false,
    terrain: terrain.grid,
    width: terrain.width,
    height: terrain.height,
    deposits,
    buildings: placed,
    unplaced,
    anomalies: anomalies.map(a => a.toJSON()),
    customBlocks: customBlocks.map(b => b.toJSON()),
    blockTypes: config.customBlocks.blockTypes,
    blockCap: getBlockCap(colony),
    buildingFootprints: config.colonySurface.buildingFootprints,
    adjacencyBonuses: config.colonySurface.adjacencyBonuses,
    weather: config.colonySurface.weatherEffects[planet.type] || { type: "none", intensity: 0, color: "#ffffff" },
    timeOfDay: ((Date.now() / 1000 / 240) % 1) * 24,
    planet_type: planet.type,
    planet_size: planet.size,
    colony: {
      colony_id: colony.colony_id,
      name: colony.name,
      infrastructure_level: colony.infrastructure_level,
      population: colony.population,
      defender_policy: colony.defender_policy || 'hold_the_line'
    },
    combat_active: !!(await GroundCombatInstance.findOne({
      where: { colony_id: colonyId, status: { [Op.in]: ['deploying', 'active'] } }
    }))
  };
}

/**
 * Initialize surface for legacy colonies — auto-place existing buildings.
 */
async function initializeSurface(colonyId, userId) {
  const transaction = await sequelize.transaction();
  try {
    const colony = await Colony.findOne({
      where: { colony_id: colonyId, user_id: userId },
      include: [{ model: Planet, as: 'planet' }],
      lock: transaction.LOCK.UPDATE,
      transaction
    });
    if (!colony) {
      throw Object.assign(new Error('Colony not found or not owned'), { statusCode: 404 });
    }
    if (colony.surface_initialized) {
      await transaction.commit();
      return { auto_placed: false, message: 'Surface already initialized' };
    }

    const planet = colony.planet;
    const { grid, width, height } = generateTerrain(colonyId, planet.planet_id, planet.type, planet.size);

    const buildings = await ColonyBuilding.findAll({
      where: { colony_id: colonyId },
      order: [['createdAt', 'ASC']],
      transaction
    });

    // Priority order: command-like first, then by category
    const categoryPriority = { defense: 0, infrastructure: 1, extraction: 2, manufacturing: 3 };
    const sorted = [...buildings].sort((a, b) => {
      const aCat = config.buildings[a.building_type]?.category || 'manufacturing';
      const bCat = config.buildings[b.building_type]?.category || 'manufacturing';
      return (categoryPriority[aCat] || 3) - (categoryPriority[bCat] || 3);
    });

    let placedCount = 0;
    let unplacedCount = 0;
    const occupied = new Set();

    for (const building of sorted) {
      const footprint = config.colonySurface.buildingFootprints[building.building_type];
      if (!footprint) {
        unplacedCount++;
        continue;
      }

      const pos = findAutoPlacePosition(grid, width, height, footprint, occupied);
      if (pos) {
        await building.update({
          grid_x: pos.x,
          grid_y: pos.y,
          placed_at: new Date()
        }, { transaction });

        // Mark tiles as occupied
        for (let dy = 0; dy < footprint.h; dy++) {
          for (let dx = 0; dx < footprint.w; dx++) {
            occupied.add(`${pos.x + dx},${pos.y + dy}`);
          }
        }
        placedCount++;
      } else {
        unplacedCount++;
      }
    }

    // Recalculate adjacency for all placed buildings
    const placedBuildings = await ColonyBuilding.findAll({
      where: { colony_id: colonyId, grid_x: { [Op.ne]: null } },
      transaction
    });
    await recalcAdjacencyBatch(placedBuildings, grid, transaction);

    await colony.update({ surface_initialized: true }, { transaction });
    await transaction.commit();

    return { auto_placed: true, placed_count: placedCount, unplaced_count: unplacedCount };
  } catch (err) {
    await transaction.rollback();
    throw err;
  }
}

/**
 * Find a valid auto-placement position using spiral-out search from grid center.
 */
function findAutoPlacePosition(grid, width, height, footprint, occupied) {
  const cx = Math.floor(width / 2);
  const cy = Math.floor(height / 2);

  // Spiral search from center
  for (let radius = 0; radius < Math.max(width, height); radius++) {
    for (let dy = -radius; dy <= radius; dy++) {
      for (let dx = -radius; dx <= radius; dx++) {
        if (Math.abs(dx) !== radius && Math.abs(dy) !== radius) continue; // only perimeter
        const x = cx + dx;
        const y = cy + dy;

        if (canPlaceAt(grid, width, height, x, y, footprint, occupied)) {
          return { x, y };
        }
      }
    }
  }
  return null;
}

function canPlaceAt(grid, width, height, x, y, footprint, occupied) {
  for (let dy = 0; dy < footprint.h; dy++) {
    for (let dx = 0; dx < footprint.w; dx++) {
      const tx = x + dx;
      const ty = y + dy;
      if (tx < 0 || tx >= width || ty < 0 || ty >= height) return false;
      if (!isBuildable(grid[ty][tx])) return false;
      if (occupied.has(`${tx},${ty}`)) return false;
    }
  }
  return true;
}

/**
 * Place a building on the surface grid.
 */
async function placeBuilding(colonyId, userId, buildingType, gridX, gridY) {
  const transaction = await sequelize.transaction();
  try {
    await checkCombatLock(colonyId, transaction);
    // Lock colony row to serialize mutations
    const colony = await Colony.findOne({
      where: { colony_id: colonyId, user_id: userId },
      include: [{ model: Planet, as: 'planet' }],
      lock: transaction.LOCK.UPDATE,
      transaction
    });
    if (!colony) {
      throw Object.assign(new Error('Colony not found or not owned'), { statusCode: 404 });
    }
    if (!colony.surface_initialized) {
      throw Object.assign(new Error('Surface not initialized — call POST /surface/initialize first'), { statusCode: 400 });
    }

    // Validate grid coordinates
    const { width, height, grid } = generateTerrain(colonyId, colony.planet.planet_id, colony.planet.type, colony.planet.size);
    if (!Number.isInteger(gridX) || !Number.isInteger(gridY) || gridX < 0 || gridY < 0 || gridX >= width || gridY >= height) {
      throw Object.assign(new Error('Invalid grid coordinates'), { statusCode: 400 });
    }

    // Validate placement (pass grid to avoid redundant terrain generation)
    const validation = await validatePlacement(colonyId, gridX, gridY, buildingType, colony, transaction, null, { grid, width, height });
    if (!validation.valid) {
      throw Object.assign(new Error(validation.reason), { statusCode: 400 });
    }

    // Check if this is an unplaced existing building being placed
    const unplacedBuilding = await ColonyBuilding.findOne({
      where: { colony_id: colonyId, building_type: buildingType, grid_x: null },
      transaction
    });

    let building;
    if (unplacedBuilding) {
      // Place existing unplaced building
      await unplacedBuilding.update({
        grid_x: gridX,
        grid_y: gridY,
        placed_at: new Date()
      }, { transaction });
      building = unplacedBuilding;
    } else {
      // Construct new building via colonyBuildingService pattern (inline to avoid circular deps)
      const bldgConfig = config.buildings[buildingType];
      if (!bldgConfig) {
        throw Object.assign(new Error('Invalid building type'), { statusCode: 400 });
      }

      // Credit check
      const user = await User.findByPk(userId, { transaction, lock: true });
      if (Number(user.credits) < bldgConfig.cost) {
        throw Object.assign(new Error('Insufficient credits'), { statusCode: 400 });
      }

      // Workforce check
      const existingBuildings = await ColonyBuilding.findAll({
        where: { colony_id: colonyId, is_active: true },
        transaction
      });
      const totalWorkforce = existingBuildings.reduce((sum, b) => sum + b.workforce, 0);
      if (totalWorkforce + bldgConfig.workforce > colony.population) {
        throw Object.assign(new Error('Insufficient population for workforce'), { statusCode: 400 });
      }

      // Max per colony check
      const existingCount = await ColonyBuilding.count({
        where: { colony_id: colonyId, building_type: buildingType },
        transaction
      });
      if (existingCount >= bldgConfig.maxPerColony) {
        throw Object.assign(new Error(`Maximum ${bldgConfig.maxPerColony} of this building per colony`), { statusCode: 400 });
      }

      await user.update({ credits: Number(user.credits) - bldgConfig.cost }, { transaction });

      building = await ColonyBuilding.create({
        colony_id: colonyId,
        building_type: buildingType,
        level: bldgConfig.tier,
        workforce: bldgConfig.workforce,
        condition: 1.0,
        is_active: true,
        grid_x: gridX,
        grid_y: gridY,
        placed_at: new Date()
      }, { transaction });
    }

    // Recalculate adjacency for this building and neighbors
    await recalcAdjacencyAround(colonyId, gridX, gridY, buildingType, grid, transaction);

    await transaction.commit();
    return building.toJSON();
  } catch (err) {
    await transaction.rollback();
    throw err;
  }
}

/**
 * Move an existing building to a new position.
 */
async function moveBuilding(colonyId, userId, buildingId, newX, newY) {
  const transaction = await sequelize.transaction();
  try {
    await checkCombatLock(colonyId, transaction);
    const colony = await Colony.findOne({
      where: { colony_id: colonyId, user_id: userId },
      include: [{ model: Planet, as: 'planet' }],
      lock: transaction.LOCK.UPDATE,
      transaction
    });
    if (!colony) {
      throw Object.assign(new Error('Colony not found or not owned'), { statusCode: 404 });
    }

    const building = await ColonyBuilding.findOne({
      where: { building_id: buildingId, colony_id: colonyId },
      transaction,
      lock: true
    });
    if (!building) {
      throw Object.assign(new Error('Building not found'), { statusCode: 404 });
    }
    if (building.grid_x === null) {
      throw Object.assign(new Error('Building is not placed on the surface'), { statusCode: 400 });
    }

    // Check relocation cooldown
    if (building.last_relocated) {
      const elapsed = Date.now() - new Date(building.last_relocated).getTime();
      if (elapsed < config.colonySurface.relocationCooldownMs) {
        const remaining = Math.ceil((config.colonySurface.relocationCooldownMs - elapsed) / 1000);
        throw Object.assign(new Error(`Relocation on cooldown — ${remaining}s remaining`), { statusCode: 400 });
      }
    }

    // Validate new position
    const { grid, width, height } = generateTerrain(colonyId, colony.planet.planet_id, colony.planet.type, colony.planet.size);
    if (!Number.isInteger(newX) || !Number.isInteger(newY) || newX < 0 || newY < 0 || newX >= width || newY >= height) {
      throw Object.assign(new Error('Invalid grid coordinates'), { statusCode: 400 });
    }

    const validation = await validatePlacement(colonyId, newX, newY, building.building_type, colony, transaction, buildingId, { grid, width, height });
    if (!validation.valid) {
      throw Object.assign(new Error(validation.reason), { statusCode: 400 });
    }

    // Calculate relocation cost
    const bldgConfig = config.buildings[building.building_type];
    const baseCost = bldgConfig?.cost || 0;

    // Check if relocating onto a resource deposit (reduced cost)
    const deposits = generateDeposits(colonyId, colony.planet.planet_id, colony.planet.type, colony.planet.size);
    const isDepositMove = deposits.some(d => d.grid_x === newX && d.grid_y === newY);
    const costRatio = isDepositMove ? config.colonySurface.depositRelocationCost : config.colonySurface.relocationCost;
    const relocCost = Math.floor(baseCost * costRatio);

    // First relocation free for auto-placed buildings
    const isFirstRelocation = !building.last_relocated && colony.surface_initialized;
    const finalCost = isFirstRelocation ? 0 : relocCost;

    if (finalCost > 0) {
      const user = await User.findByPk(userId, { transaction, lock: true });
      if (Number(user.credits) < finalCost) {
        throw Object.assign(new Error(`Insufficient credits (need ${finalCost})`), { statusCode: 400 });
      }
      await user.update({ credits: Number(user.credits) - finalCost }, { transaction });
    }

    const oldX = building.grid_x;
    const oldY = building.grid_y;

    await building.update({
      grid_x: newX,
      grid_y: newY,
      last_relocated: isDepositMove ? null : new Date(), // deposit moves bypass cooldown
      placed_at: new Date()
    }, { transaction });

    // Recalc adjacency around old and new positions
    await recalcAdjacencyAround(colonyId, oldX, oldY, building.building_type, grid, transaction);
    await recalcAdjacencyAround(colonyId, newX, newY, building.building_type, grid, transaction);

    await transaction.commit();
    return { building: building.toJSON(), cost: finalCost };
  } catch (err) {
    await transaction.rollback();
    throw err;
  }
}

/**
 * Undo a recent building placement (within 10-second window).
 */
async function undoPlacement(colonyId, userId, buildingId) {
  const transaction = await sequelize.transaction();
  try {
    await checkCombatLock(colonyId, transaction);
    const colony = await Colony.findOne({
      where: { colony_id: colonyId, user_id: userId },
      include: [{ model: Planet, as: 'planet' }],
      lock: transaction.LOCK.UPDATE,
      transaction
    });
    if (!colony) {
      throw Object.assign(new Error('Colony not found or not owned'), { statusCode: 404 });
    }

    const building = await ColonyBuilding.findOne({
      where: { building_id: buildingId, colony_id: colonyId },
      transaction,
      lock: true
    });
    if (!building) {
      throw Object.assign(new Error('Building not found'), { statusCode: 404 });
    }
    if (!building.placed_at) {
      throw Object.assign(new Error('Building has no placement timestamp'), { statusCode: 400 });
    }

    const elapsed = Date.now() - new Date(building.placed_at).getTime();
    if (elapsed > config.colonySurface.undoWindowMs) {
      throw Object.assign(new Error('Undo window expired (10 seconds)'), { statusCode: 400 });
    }

    const { grid } = generateTerrain(colonyId, colony.planet.planet_id, colony.planet.type, colony.planet.size);
    const oldX = building.grid_x;
    const oldY = building.grid_y;

    // Move building back to unplaced state
    await building.update({
      grid_x: null,
      grid_y: null,
      placed_at: null,
      cached_multiplier: 1.0
    }, { transaction });

    // Recalc adjacency for neighbors
    if (oldX !== null && oldY !== null) {
      await recalcAdjacencyAround(colonyId, oldX, oldY, building.building_type, grid, transaction);
    }

    await transaction.commit();
    return { undone: true, building_id: buildingId };
  } catch (err) {
    await transaction.rollback();
    throw err;
  }
}

/**
 * Spawn daily anomalies if not already spawned today.
 */
async function spawnAnomaliesIfNeeded(colony) {
  const currentBucket = Math.floor(Date.now() / 86400000);
  const lastBucket = colony.last_anomaly_spawn
    ? Math.floor(new Date(colony.last_anomaly_spawn).getTime() / 86400000)
    : -1;

  if (currentBucket <= lastBucket) return; // already spawned today

  const transaction = await sequelize.transaction();
  try {
    // Re-lock colony
    const lockedColony = await Colony.findOne({
      where: { colony_id: colony.colony_id },
      include: [{ model: Planet, as: 'planet' }],
      lock: transaction.LOCK.UPDATE,
      transaction
    });

    // Double-check after lock
    const recheck = lockedColony.last_anomaly_spawn
      ? Math.floor(new Date(lockedColony.last_anomaly_spawn).getTime() / 86400000)
      : -1;
    if (currentBucket <= recheck) {
      await transaction.commit();
      return;
    }

    // Clean up expired anomalies
    await SurfaceAnomaly.destroy({
      where: {
        colony_id: colony.colony_id,
        expires_at: { [Op.lt]: new Date() }
      },
      transaction
    });

    // Check active count
    const activeCount = await SurfaceAnomaly.count({
      where: {
        colony_id: colony.colony_id,
        expires_at: { [Op.gt]: new Date() }
      },
      transaction
    });

    const maxActive = config.colonySurface.maxActiveAnomalies;
    if (activeCount >= maxActive) {
      await lockedColony.update({ last_anomaly_spawn: new Date() }, { transaction });
      await transaction.commit();
      return;
    }

    const { min, max } = config.colonySurface.anomaliesPerDay;
    const toSpawn = Math.min(
      min + Math.floor(Math.random() * (max - min + 1)),
      maxActive - activeCount
    );

    const planet = lockedColony.planet;
    const { grid, width, height } = generateTerrain(
      colony.colony_id, planet.planet_id, planet.type, planet.size
    );

    const anomalyTypeKeys = Object.keys(config.colonySurface.anomalyTypes);
    const expiresAt = new Date(Date.now() + config.colonySurface.anomalyLifetimeHours * 3600000);

    // Pre-fetch buildings and anomalies once to avoid N+1 queries in the loop
    const cachedBuildings = await ColonyBuilding.findAll({
      where: { colony_id: colony.colony_id },
      transaction
    });
    const cachedAnomalies = await SurfaceAnomaly.findAll({
      where: { colony_id: colony.colony_id },
      transaction
    });
    const cached = { grid, buildings: cachedBuildings, anomalies: cachedAnomalies };

    for (let i = 0; i < toSpawn; i++) {
      // Find random empty buildable tile
      const maxAttempts = 100;
      let placed = false;
      for (let attempt = 0; attempt < maxAttempts; attempt++) {
        const rx = 1 + Math.floor(Math.random() * (width - 2));
        const ry = 1 + Math.floor(Math.random() * (height - 2));

        const empty = await isTileEmpty(colony.colony_id, rx, ry, lockedColony, transaction, cached);
        if (!empty) continue;

        // Pick random anomaly type
        const typeKey = anomalyTypeKeys[Math.floor(Math.random() * anomalyTypeKeys.length)];
        const typeConfig = config.colonySurface.anomalyTypes[typeKey];
        const amount = typeConfig.minAmount + Math.floor(Math.random() * (typeConfig.maxAmount - typeConfig.minAmount + 1));

        const newAnomaly = await SurfaceAnomaly.create({
          colony_id: colony.colony_id,
          grid_x: rx,
          grid_y: ry,
          anomaly_type: typeKey,
          reward_type: typeConfig.reward,
          reward_amount: amount,
          expires_at: expiresAt
        }, { transaction });

        // Add to cached anomalies so subsequent iterations don't overlap
        cached.anomalies.push(newAnomaly);
        placed = true;
        break;
      }
    }

    await lockedColony.update({ last_anomaly_spawn: new Date() }, { transaction });
    await transaction.commit();
  } catch (err) {
    await transaction.rollback();
    // Non-critical failure — anomaly spawning shouldn't break getSurface
    console.error('Failed to spawn anomalies:', err.message);
  }
}

/**
 * Claim an anomaly and award its reward.
 */
async function claimAnomaly(colonyId, userId, anomalyId) {
  const transaction = await sequelize.transaction();
  try {
    const colony = await Colony.findOne({
      where: { colony_id: colonyId, user_id: userId },
      lock: transaction.LOCK.UPDATE,
      transaction
    });
    if (!colony) {
      throw Object.assign(new Error('Colony not found or not owned'), { statusCode: 404 });
    }

    const anomaly = await SurfaceAnomaly.findOne({
      where: { anomaly_id: anomalyId, colony_id: colonyId },
      transaction
    });
    if (!anomaly) {
      throw Object.assign(new Error('Anomaly not found'), { statusCode: 404 });
    }
    if (new Date(anomaly.expires_at) < new Date()) {
      await anomaly.destroy({ transaction });
      throw Object.assign(new Error('Anomaly has expired'), { statusCode: 400 });
    }

    // Award reward
    const user = await User.findByPk(userId, { transaction, lock: true });
    let rewardDescription = '';

    switch (anomaly.reward_type) {
      case 'credits':
        await user.update({ credits: Number(user.credits) + anomaly.reward_amount }, { transaction });
        rewardDescription = `${anomaly.reward_amount} credits`;
        break;
      case 'materials':
        await user.update({ credits: Number(user.credits) + anomaly.reward_amount }, { transaction });
        rewardDescription = `${anomaly.reward_amount} credits worth of materials`;
        break;
      case 'experience':
        await user.update({ experience: (user.experience || 0) + anomaly.reward_amount }, { transaction });
        rewardDescription = `${anomaly.reward_amount} experience`;
        break;
      case 'rare_component':
        await user.update({ credits: Number(user.credits) + 2000 }, { transaction });
        rewardDescription = 'a rare component (2000 credits)';
        break;
      default:
        await user.update({ credits: Number(user.credits) + anomaly.reward_amount }, { transaction });
        rewardDescription = `${anomaly.reward_amount} credits`;
    }

    await anomaly.destroy({ transaction });
    await transaction.commit();

    return {
      claimed: true,
      anomaly_type: anomaly.anomaly_type,
      reward_type: anomaly.reward_type,
      reward_amount: anomaly.reward_amount,
      description: rewardDescription
    };
  } catch (err) {
    await transaction.rollback();
    throw err;
  }
}

/**
 * Repair buildings on the surface. Accepts either { building_ids: [...] } or { all: true }.
 */
async function repairBuildings(colonyId, userId, options) {
  const transaction = await sequelize.transaction();
  try {
    const colony = await Colony.findOne({
      where: { colony_id: colonyId, user_id: userId },
      lock: transaction.LOCK.UPDATE,
      transaction
    });
    if (!colony) {
      throw Object.assign(new Error('Colony not found or not owned'), { statusCode: 404 });
    }

    let buildings;
    if (options.all) {
      buildings = await ColonyBuilding.findAll({
        where: { colony_id: colonyId, condition: { [Op.lt]: 1.0 } },
        transaction
      });
    } else if (options.building_ids && options.building_ids.length > 0) {
      buildings = await ColonyBuilding.findAll({
        where: {
          building_id: { [Op.in]: options.building_ids },
          colony_id: colonyId,
          condition: { [Op.lt]: 1.0 }
        },
        transaction
      });
    } else {
      throw Object.assign(new Error('Specify building_ids or all: true'), { statusCode: 400 });
    }

    if (buildings.length === 0) {
      await transaction.commit();
      return { repaired: 0, total_cost: 0 };
    }

    // Calculate total repair cost
    let totalCost = 0;
    for (const b of buildings) {
      const bConfig = config.buildings[b.building_type];
      if (!bConfig) continue;
      // Cost: 10% of build cost per 0.25 condition restored, rounded up to nearest 0.25
      const conditionDeficit = 1.0 - b.condition;
      const quarters = Math.ceil(conditionDeficit / 0.25);
      totalCost += Math.floor(bConfig.cost * config.colonySurface.repairCostPerQuarter * quarters);
    }

    const user = await User.findByPk(userId, { transaction, lock: true });
    if (Number(user.credits) < totalCost) {
      throw Object.assign(new Error(`Insufficient credits (need ${totalCost})`), { statusCode: 400 });
    }

    await user.update({ credits: Number(user.credits) - totalCost }, { transaction });

    for (const b of buildings) {
      await b.update({ condition: 1.0 }, { transaction });
    }

    await transaction.commit();
    return { repaired: buildings.length, total_cost: totalCost };
  } catch (err) {
    await transaction.rollback();
    throw err;
  }
}

// ============== Adjacency Calculation ==============

/**
 * Recalculate cached_multiplier for all buildings within influence range of a position.
 */
async function recalcAdjacencyAround(colonyId, gridX, gridY, buildingType, grid, transaction) {
  const footprint = config.colonySurface.buildingFootprints[buildingType] || { w: 1, h: 1 };
  const influenceRange = 4; // adjacency range 2 + max footprint 3 - 1

  const buildings = await ColonyBuilding.findAll({
    where: { colony_id: colonyId, grid_x: { [Op.ne]: null } },
    transaction
  });

  const toRecalc = buildings.filter(b => {
    const bfp = config.colonySurface.buildingFootprints[b.building_type] || { w: 1, h: 1 };
    // Check if any tile of this building is within influence range of the affected area
    for (let dy = 0; dy < bfp.h; dy++) {
      for (let dx = 0; dx < bfp.w; dx++) {
        const bx = b.grid_x + dx;
        const by = b.grid_y + dy;
        for (let fy = 0; fy < footprint.h; fy++) {
          for (let fx = 0; fx < footprint.w; fx++) {
            if (Math.abs(bx - (gridX + fx)) + Math.abs(by - (gridY + fy)) <= influenceRange) {
              return true;
            }
          }
        }
      }
    }
    return false;
  });

  await recalcAdjacencyBatch(toRecalc, grid, transaction, buildings);
}

/**
 * Recalculate cached_multiplier for a batch of buildings.
 */
async function recalcAdjacencyBatch(targetBuildings, grid, transaction, allBuildings = null) {
  if (!allBuildings) {
    if (targetBuildings.length === 0) return;
    const colonyId = targetBuildings[0].colony_id;
    allBuildings = await ColonyBuilding.findAll({
      where: { colony_id: colonyId, grid_x: { [Op.ne]: null } },
      transaction
    });
  }

  const adjacencyBonuses = config.colonySurface.adjacencyBonuses;
  const adjacencyRange = 2;

  for (const building of targetBuildings) {
    if (building.grid_x === null) continue;

    const bonusRules = adjacencyBonuses[building.building_type];
    if (!bonusRules) {
      if (building.cached_multiplier !== 1.0) {
        await building.update({ cached_multiplier: 1.0 }, { transaction });
      }
      continue;
    }

    const bfp = config.colonySurface.buildingFootprints[building.building_type] || { w: 1, h: 1 };

    // Collect unique bonuses (strongest per rule, different rules multiply)
    const activeBonuses = {};

    for (const [bonusSource, multiplier] of Object.entries(bonusRules)) {
      // Check if bonusSource is a terrain type
      const isTerrainBonus = config.colonySurface.terrainTypes[bonusSource] !== undefined;

      if (isTerrainBonus) {
        // Check terrain tiles within adjacency range of building footprint
        let found = false;
        for (let dy = -adjacencyRange; dy < bfp.h + adjacencyRange && !found; dy++) {
          for (let dx = -adjacencyRange; dx < bfp.w + adjacencyRange && !found; dx++) {
            const tx = building.grid_x + dx;
            const ty = building.grid_y + dy;
            if (tx < 0 || ty < 0 || !grid[ty] || !grid[ty][tx]) continue;
            // Must be within Manhattan distance 2 of any footprint tile
            let withinRange = false;
            for (let fy = 0; fy < bfp.h && !withinRange; fy++) {
              for (let fx = 0; fx < bfp.w && !withinRange; fx++) {
                if (Math.abs(tx - (building.grid_x + fx)) + Math.abs(ty - (building.grid_y + fy)) <= adjacencyRange) {
                  withinRange = true;
                }
              }
            }
            if (withinRange && grid[ty][tx] === bonusSource) {
              found = true;
            }
          }
        }
        if (found) {
          // Same-rule: keep strongest
          activeBonuses[bonusSource] = Math.max(activeBonuses[bonusSource] || 1.0, multiplier);
        }
      } else {
        // Check neighbor buildings of matching type
        let found = false;
        for (const neighbor of allBuildings) {
          if (neighbor.building_id === building.building_id) continue;
          if (neighbor.grid_x === null) continue;
          if (neighbor.building_type !== bonusSource) continue;

          const nfp = config.colonySurface.buildingFootprints[neighbor.building_type] || { w: 1, h: 1 };
          // Check Manhattan distance between closest tiles
          let minDist = Infinity;
          for (let ay = 0; ay < bfp.h; ay++) {
            for (let ax = 0; ax < bfp.w; ax++) {
              for (let ny = 0; ny < nfp.h; ny++) {
                for (let nx = 0; nx < nfp.w; nx++) {
                  const dist = Math.abs((building.grid_x + ax) - (neighbor.grid_x + nx)) +
                               Math.abs((building.grid_y + ay) - (neighbor.grid_y + ny));
                  minDist = Math.min(minDist, dist);
                }
              }
            }
          }
          if (minDist <= adjacencyRange) {
            found = true;
            break; // Same-rule: doesn't stack — one match is enough
          }
        }
        if (found) {
          activeBonuses[bonusSource] = Math.max(activeBonuses[bonusSource] || 1.0, multiplier);
        }
      }
    }

    // Different-rule bonuses multiply
    let totalMultiplier = 1.0;
    for (const bonus of Object.values(activeBonuses)) {
      totalMultiplier *= bonus;
    }

    // Round to avoid floating point drift
    totalMultiplier = Math.round(totalMultiplier * 10000) / 10000;

    if (building.cached_multiplier !== totalMultiplier) {
      await building.update({ cached_multiplier: totalMultiplier }, { transaction });
    }
  }
}

/**
 * Get public surface data for any colony (no ownership check).
 * Strips sensitive info: garrison units, combat_active, defender_policy, unplaced buildings.
 */
async function getPublicSurface(colonyId) {
  const colony = await Colony.findOne({
    where: { colony_id: colonyId },
    include: [
      { model: Planet, as: 'planet' },
      { model: User, as: 'owner', attributes: ['user_id', 'username'] }
    ]
  });
  if (!colony) {
    throw Object.assign(new Error('Colony not found'), { statusCode: 404 });
  }

  const planet = colony.planet;
  const terrain = generateTerrain(colonyId, planet.planet_id, planet.type, planet.size);
  const deposits = generateDeposits(colonyId, planet.planet_id, planet.type, planet.size, terrain);

  if (!colony.surface_initialized) {
    return {
      needs_initialization: true,
      terrain: terrain.grid,
      width: terrain.width,
      height: terrain.height,
      deposits,
      planet_type: planet.type,
      planet_size: planet.size,
      owner_name: colony.owner ? colony.owner.username : null
    };
  }

  const now = new Date();
  const [buildings, anomalies, customBlocks] = await Promise.all([
    ColonyBuilding.findAll({
      where: { colony_id: colonyId, grid_x: { [Op.ne]: null } },
      order: [['createdAt', 'ASC']]
    }),
    SurfaceAnomaly.findAll({
      where: { colony_id: colonyId, expires_at: { [Op.gt]: now } }
    }),
    CustomBlock.findAll({
      where: { colony_id: colonyId },
      order: [['createdAt', 'ASC']]
    })
  ]);

  // Only placed buildings (no unplaced inventory)
  const placed = buildings.map(enrichBuilding);

  return {
    needs_initialization: false,
    terrain: terrain.grid,
    width: terrain.width,
    height: terrain.height,
    deposits,
    buildings: placed,
    anomalies: anomalies.map(a => a.toJSON()),
    customBlocks: customBlocks.map(b => b.toJSON()),
    blockTypes: config.customBlocks.blockTypes,
    buildingFootprints: config.colonySurface.buildingFootprints,
    planet_type: planet.type,
    planet_size: planet.size,
    owner_name: colony.owner ? colony.owner.username : null,
    colony: {
      colony_id: colony.colony_id,
      name: colony.name,
      infrastructure_level: colony.infrastructure_level,
      population: colony.population
    }
  };
}

/**
 * Get colony leaderboard sorted by the given metric.
 */
async function getLeaderboard(sortBy = 'production', limit = 20) {
  const { GroundUnit } = require('../models');

  // Only eager-load what's needed for the requested sort metric
  const includes = [
    { model: Planet, as: 'planet', attributes: ['name', 'type'] },
    { model: User, as: 'owner', attributes: ['username'] }
  ];

  if (sortBy === 'production' || sortBy === 'defense') {
    includes.push({ model: ColonyBuilding, as: 'buildings', attributes: ['building_type', 'is_active', 'cached_multiplier'] });
  }
  if (sortBy === 'aesthetic') {
    includes.push({ model: ColonyBuilding, as: 'buildings', attributes: ['building_id'] });
    includes.push({ model: CustomBlock, as: 'customBlocks', attributes: ['block_id'] });
  }
  if (sortBy === 'defense') {
    includes.push({ model: GroundUnit, as: 'garrison', attributes: ['unit_id'] });
  }

  const colonies = await Colony.findAll({
    include: includes,
    where: { is_active: true },
    attributes: ['colony_id', 'name', 'infrastructure_level', 'population', 'defense_rating']
  });

  const scored = colonies.map(colony => {
    const buildings = colony.buildings || [];

    let score = 0;
    switch (sortBy) {
      case 'production': {
        for (const b of buildings) {
          if (!b.is_active) continue;
          const bConfig = config.buildings[b.building_type];
          if (!bConfig || !bConfig.production) continue;
          const productionValues = Object.values(bConfig.production);
          const productionSum = productionValues.reduce((s, v) => s + (typeof v === 'number' ? v : 0), 0);
          score += productionSum * (b.cached_multiplier || 1);
        }
        break;
      }
      case 'defense': {
        score = colony.defense_rating || 0;
        for (const b of buildings) {
          if (b.building_type === 'DEFENSE_GRID') score += 1;
        }
        score += (colony.garrison || []).length;
        break;
      }
      case 'aesthetic': {
        score = (colony.customBlocks || []).length + buildings.length;
        break;
      }
      default:
        score = 0;
    }

    return {
      colony_id: colony.colony_id,
      colony_name: colony.name,
      owner_username: colony.owner ? colony.owner.username : 'Unknown',
      planet_name: colony.planet ? colony.planet.name : 'Unknown',
      score: Math.round(score * 100) / 100,
      infrastructure_level: colony.infrastructure_level,
      population: colony.population
    };
  });

  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, limit);
}

module.exports = {
  getSurface,
  initializeSurface,
  placeBuilding,
  moveBuilding,
  undoPlacement,
  claimAnomaly,
  repairBuildings,
  spawnAnomaliesIfNeeded,
  recalcAdjacencyAround,
  recalcAdjacencyBatch,
  getPublicSurface,
  getLeaderboard
};
