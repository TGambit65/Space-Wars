const { ColonyBuilding, Colony, User, TechResearch, Planet, sequelize } = require('../models');
const config = require('../config');

/**
 * Get available buildings that can be constructed at a colony
 */
const getAvailableBuildings = async (userId, colonyId) => {
  const colony = await Colony.findOne({
    where: { colony_id: colonyId, user_id: userId },
    include: [{ model: Planet, as: 'planet' }]
  });
  if (!colony) {
    throw Object.assign(new Error('Colony not found or not owned'), { statusCode: 404 });
  }

  const existingBuildings = await ColonyBuilding.findAll({
    where: { colony_id: colonyId }
  });

  // Count existing buildings by type
  const buildingCounts = {};
  for (const b of existingBuildings) {
    buildingCounts[b.building_type] = (buildingCounts[b.building_type] || 0) + 1;
  }

  // Get completed tech for this user
  const completedTech = await TechResearch.findAll({
    where: { user_id: userId, is_completed: true }
  });
  const techSet = new Set(completedTech.map(t => t.tech_name));

  const available = [];
  for (const [key, bldg] of Object.entries(config.buildings)) {
    const reasons = [];
    let canBuild = true;

    if (colony.infrastructure_level < bldg.prerequisiteInfrastructure) {
      canBuild = false;
      reasons.push(`Requires infrastructure level ${bldg.prerequisiteInfrastructure}`);
    }

    if (bldg.prerequisiteTech && !techSet.has(bldg.prerequisiteTech)) {
      canBuild = false;
      const techName = config.techTree[bldg.prerequisiteTech]?.name || bldg.prerequisiteTech;
      reasons.push(`Requires tech: ${techName}`);
    }

    const count = buildingCounts[key] || 0;
    if (count >= bldg.maxPerColony) {
      canBuild = false;
      reasons.push(`Maximum ${bldg.maxPerColony} per colony`);
    }

    available.push({
      building_type: key,
      ...bldg,
      current_count: count,
      canBuild,
      reasons
    });
  }

  return available;
};

/**
 * Construct a new building at a colony
 */
const constructBuilding = async (userId, colonyId, buildingType) => {
  const bldgConfig = config.buildings[buildingType];
  if (!bldgConfig) {
    throw Object.assign(new Error('Invalid building type'), { statusCode: 400 });
  }

  const transaction = await sequelize.transaction();
  try {
    const colony = await Colony.findOne({
      where: { colony_id: colonyId, user_id: userId },
      transaction,
      lock: true
    });
    if (!colony) {
      throw Object.assign(new Error('Colony not found or not owned'), { statusCode: 404 });
    }

    // Block during development
    if (colony.developing_until && new Date(colony.developing_until) > new Date()) {
      throw Object.assign(new Error('Colony is still developing'), { statusCode: 400 });
    }

    // Check infrastructure
    if (colony.infrastructure_level < bldgConfig.prerequisiteInfrastructure) {
      throw Object.assign(new Error(`Requires infrastructure level ${bldgConfig.prerequisiteInfrastructure}`), { statusCode: 400 });
    }

    // Check tech
    if (bldgConfig.prerequisiteTech) {
      const tech = await TechResearch.findOne({
        where: { user_id: userId, tech_name: bldgConfig.prerequisiteTech, is_completed: true },
        transaction
      });
      if (!tech) {
        throw Object.assign(new Error(`Requires tech: ${bldgConfig.prerequisiteTech}`), { statusCode: 400 });
      }
    }

    // Check max per colony
    const existingCount = await ColonyBuilding.count({
      where: { colony_id: colonyId, building_type: buildingType },
      transaction
    });
    if (existingCount >= bldgConfig.maxPerColony) {
      throw Object.assign(new Error(`Maximum ${bldgConfig.maxPerColony} of this building per colony`), { statusCode: 400 });
    }

    // Check workforce capacity
    const existingBuildings = await ColonyBuilding.findAll({
      where: { colony_id: colonyId, is_active: true },
      transaction
    });
    const totalWorkforce = existingBuildings.reduce((sum, b) => sum + b.workforce, 0);
    if (totalWorkforce + bldgConfig.workforce > colony.population) {
      throw Object.assign(new Error('Insufficient population for workforce'), { statusCode: 400 });
    }

    // Check credits
    const user = await User.findByPk(userId, { transaction, lock: true });
    if (Number(user.credits) < bldgConfig.cost) {
      throw Object.assign(new Error('Insufficient credits'), { statusCode: 400 });
    }

    await user.update({ credits: Number(user.credits) - bldgConfig.cost }, { transaction });

    const building = await ColonyBuilding.create({
      colony_id: colonyId,
      building_type: buildingType,
      level: bldgConfig.tier,
      workforce: bldgConfig.workforce,
      condition: 1.0,
      is_active: true
    }, { transaction });

    await transaction.commit();
    return building;
  } catch (err) {
    await transaction.rollback();
    throw err;
  }
};

/**
 * Upgrade a building to its next tier
 */
const upgradeBuilding = async (userId, buildingId) => {
  const transaction = await sequelize.transaction();
  try {
    const building = await ColonyBuilding.findByPk(buildingId, {
      include: [{ model: Colony, as: 'colony' }],
      transaction,
      lock: true
    });
    if (!building) {
      throw Object.assign(new Error('Building not found'), { statusCode: 404 });
    }
    if (building.colony.user_id !== userId) {
      throw Object.assign(new Error('Colony not owned by user'), { statusCode: 403 });
    }

    const currentConfig = config.buildings[building.building_type];
    if (!currentConfig || !currentConfig.upgradesTo) {
      throw Object.assign(new Error('This building cannot be upgraded'), { statusCode: 400 });
    }

    const nextConfig = config.buildings[currentConfig.upgradesTo];
    if (!nextConfig) {
      throw Object.assign(new Error('Invalid upgrade configuration'), { statusCode: 500 });
    }

    // Check infrastructure for next tier
    if (building.colony.infrastructure_level < nextConfig.prerequisiteInfrastructure) {
      throw Object.assign(new Error(`Requires infrastructure level ${nextConfig.prerequisiteInfrastructure}`), { statusCode: 400 });
    }

    // Check tech for next tier
    if (nextConfig.prerequisiteTech) {
      const tech = await TechResearch.findOne({
        where: { user_id: userId, tech_name: nextConfig.prerequisiteTech, is_completed: true },
        transaction
      });
      if (!tech) {
        throw Object.assign(new Error(`Requires tech: ${nextConfig.prerequisiteTech}`), { statusCode: 400 });
      }
    }

    // Check credits
    const user = await User.findByPk(userId, { transaction, lock: true });
    if (Number(user.credits) < nextConfig.cost) {
      throw Object.assign(new Error('Insufficient credits'), { statusCode: 400 });
    }

    await user.update({ credits: Number(user.credits) - nextConfig.cost }, { transaction });

    await building.update({
      building_type: currentConfig.upgradesTo,
      level: nextConfig.tier,
      workforce: nextConfig.workforce,
      condition: 1.0
    }, { transaction });

    await transaction.commit();
    return building.reload();
  } catch (err) {
    await transaction.rollback();
    throw err;
  }
};

/**
 * Demolish a building and refund 50% of cost
 */
const demolishBuilding = async (userId, buildingId) => {
  const transaction = await sequelize.transaction();
  try {
    const building = await ColonyBuilding.findByPk(buildingId, {
      include: [{ model: Colony, as: 'colony' }],
      transaction
    });
    if (!building) {
      throw Object.assign(new Error('Building not found'), { statusCode: 404 });
    }
    if (building.colony.user_id !== userId) {
      throw Object.assign(new Error('Colony not owned by user'), { statusCode: 403 });
    }

    const bldgConfig = config.buildings[building.building_type];
    const refund = Math.floor((bldgConfig?.cost || 0) * 0.5);

    if (refund > 0) {
      const user = await User.findByPk(userId, { transaction, lock: true });
      await user.update({ credits: Number(user.credits) + refund }, { transaction });
    }

    await building.destroy({ transaction });

    await transaction.commit();
    return { refund };
  } catch (err) {
    await transaction.rollback();
    throw err;
  }
};

/**
 * Toggle a building active/inactive
 */
const toggleBuilding = async (userId, buildingId, isActive) => {
  const building = await ColonyBuilding.findByPk(buildingId, {
    include: [{ model: Colony, as: 'colony' }]
  });
  if (!building) {
    throw Object.assign(new Error('Building not found'), { statusCode: 404 });
  }
  if (building.colony.user_id !== userId) {
    throw Object.assign(new Error('Colony not owned by user'), { statusCode: 403 });
  }

  await building.update({ is_active: isActive });
  return building;
};

/**
 * Get all buildings for a colony with config details merged
 */
const getColonyBuildings = async (colonyId) => {
  const buildings = await ColonyBuilding.findAll({
    where: { colony_id: colonyId },
    order: [['createdAt', 'ASC']]
  });

  return buildings.map(b => {
    const bldgConfig = config.buildings[b.building_type] || {};
    return {
      ...b.toJSON(),
      config: {
        name: bldgConfig.name,
        category: bldgConfig.category,
        tier: bldgConfig.tier,
        cost: bldgConfig.cost,
        powerConsumption: bldgConfig.powerConsumption,
        powerGeneration: bldgConfig.powerGeneration,
        maintenanceCost: bldgConfig.maintenanceCost,
        production: bldgConfig.production,
        upgradesTo: bldgConfig.upgradesTo,
        bonusEffect: bldgConfig.bonusEffect || null
      }
    };
  });
};

/**
 * Process production tick for all active buildings in a colony
 * Called from colonyService.processResourceGeneration
 *
 * @param {string} colonyId
 * @param {number} hoursPassed
 * @param {Array} generatedResources - modified in-place, items: { resource_type, amount, remaining }
 * @param {object} transaction - Sequelize transaction
 * @param {object} colony - colony instance with planet
 * @returns {{ production: Array, powerBalance: number }}
 */
const processProductionTick = async (colonyId, hoursPassed, generatedResources, transaction, colony) => {
  const buildings = await ColonyBuilding.findAll({
    where: { colony_id: colonyId, is_active: true },
    transaction
  });

  if (buildings.length === 0) {
    return { production: [], powerBalance: 0 };
  }

  const planetType = colony?.planet?.type || '';

  // Calculate power balance
  let totalGeneration = 0;
  let totalConsumption = 0;
  for (const b of buildings) {
    const cfg = config.buildings[b.building_type];
    if (!cfg) continue;
    totalGeneration += cfg.powerGeneration || 0;
    totalConsumption += cfg.powerConsumption || 0;
  }
  const hasPower = totalGeneration >= totalConsumption;

  // Build a map of available resources from extraction this tick
  const resourcePool = {};
  for (const r of generatedResources) {
    resourcePool[r.resource_type] = (resourcePool[r.resource_type] || 0) + r.amount;
  }

  const infrastructureBonus = colony ? (1 + (colony.infrastructure_level - 1) * 0.1) : 1;
  const production = [];

  for (const building of buildings) {
    const cfg = config.buildings[building.building_type];
    if (!cfg) continue;

    // Power check: buildings with power consumption need adequate power
    if (cfg.powerConsumption > 0 && !hasPower) {
      production.push({
        building_id: building.building_id,
        building_type: building.building_type,
        name: cfg.name,
        status: 'no_power',
        outputs: {}
      });
      continue;
    }

    // Calculate planet type bonus
    const planetBonus = cfg.planetTypeBonus?.[planetType] || 1.0;

    // Condition affects output
    const conditionFactor = building.condition;

    // Check and consume inputs
    const outputs = {};
    let inputsSatisfied = true;
    const inputScale = {};

    if (cfg.production.inputs && Object.keys(cfg.production.inputs).length > 0) {
      // Manufacturing: check if inputs are available
      let minRatio = 1.0;
      for (const [inputName, inputQty] of Object.entries(cfg.production.inputs)) {
        const available = resourcePool[inputName] || 0;
        const needed = inputQty * hoursPassed;
        if (available <= 0) {
          inputsSatisfied = false;
          minRatio = 0;
          break;
        }
        const ratio = Math.min(available / needed, 1.0);
        minRatio = Math.min(minRatio, ratio);
      }

      if (!inputsSatisfied || minRatio <= 0) {
        production.push({
          building_id: building.building_id,
          building_type: building.building_type,
          name: cfg.name,
          status: 'no_inputs',
          outputs: {}
        });
        continue;
      }

      // Consume inputs proportionally
      for (const [inputName, inputQty] of Object.entries(cfg.production.inputs)) {
        const consumed = Math.floor(inputQty * hoursPassed * minRatio);
        resourcePool[inputName] = (resourcePool[inputName] || 0) - consumed;
        // Also reduce from generatedResources
        const resEntry = generatedResources.find(r => r.resource_type === inputName);
        if (resEntry) {
          resEntry.amount = Math.max(0, resEntry.amount - consumed);
        }
      }

      inputScale.ratio = minRatio;
    }

    // Calculate outputs — include cached adjacency multiplier
    const adjacencyMultiplier = building.cached_multiplier || 1.0;
    for (const [outputName, outputQty] of Object.entries(cfg.production.outputs || {})) {
      const baseOutput = outputQty * hoursPassed;
      const scaledOutput = Math.floor(baseOutput * conditionFactor * planetBonus * infrastructureBonus * adjacencyMultiplier * (inputScale.ratio || 1));
      if (scaledOutput > 0) {
        outputs[outputName] = scaledOutput;
        // Add to resource pool so downstream buildings can use them
        resourcePool[outputName] = (resourcePool[outputName] || 0) + scaledOutput;
        // Add to generatedResources
        const existing = generatedResources.find(r => r.resource_type === outputName);
        if (existing) {
          existing.amount += scaledOutput;
        } else {
          generatedResources.push({
            resource_type: outputName,
            amount: scaledOutput,
            remaining: null,
            from_building: true
          });
        }
      }
    }

    // Degrade condition
    const newCondition = Math.max(0.1, building.condition - 0.01);
    await building.update({
      condition: newCondition,
      last_production: new Date()
    }, { transaction });

    production.push({
      building_id: building.building_id,
      building_type: building.building_type,
      name: cfg.name,
      status: 'active',
      outputs
    });
  }

  return {
    production,
    powerBalance: totalGeneration - totalConsumption
  };
};

/**
 * Repair a building's condition back to 1.0
 */
const repairBuilding = async (userId, buildingId) => {
  const transaction = await sequelize.transaction();
  try {
    const building = await ColonyBuilding.findByPk(buildingId, {
      include: [{ model: Colony, as: 'colony' }],
      transaction,
      lock: true
    });
    if (!building) {
      throw Object.assign(new Error('Building not found'), { statusCode: 404 });
    }
    if (building.colony.user_id !== userId) {
      throw Object.assign(new Error('Colony not owned by user'), { statusCode: 403 });
    }
    if (building.condition >= 1.0) {
      throw Object.assign(new Error('Building is already at full condition'), { statusCode: 400 });
    }

    const bldgConfig = config.buildings[building.building_type];
    const repairCost = Math.floor((bldgConfig?.maintenanceCost || 500) * (1 - building.condition) * 10);

    const user = await User.findByPk(userId, { transaction, lock: true });
    if (Number(user.credits) < repairCost) {
      throw Object.assign(new Error('Insufficient credits'), { statusCode: 400 });
    }

    await user.update({ credits: Number(user.credits) - repairCost }, { transaction });
    await building.update({ condition: 1.0 }, { transaction });

    await transaction.commit();
    return { building: await building.reload(), repairCost };
  } catch (err) {
    await transaction.rollback();
    throw err;
  }
};

module.exports = {
  getAvailableBuildings,
  constructBuilding,
  upgradeBuilding,
  demolishBuilding,
  toggleBuilding,
  getColonyBuildings,
  processProductionTick,
  repairBuilding
};
