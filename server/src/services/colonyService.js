const { Colony, Planet, PlanetResource, Ship, User, Sector, Commodity, ShipCargo, sequelize } = require('../models');
const config = require('../config');
const colonyBuildingService = require('./colonyBuildingService');

// Map planet resources to commodity names for cargo transfer
// Keys match planetResources in config, values match commodity names
const RESOURCE_TO_COMMODITY = {
  'Iron Ore': 'Metals',
  'Water': 'Water',
  'Silicon': 'Electronics',
  'Organics': 'Organics',
  'Rare Minerals': 'Rare Minerals',
  'Fuel': 'Fuel Cells',
  'Chemicals': 'Chemicals',
  'Bio-Samples': 'Medical Supplies'
};

/**
 * Colonize a planet
 */
const colonizePlanet = async (planetId, userId, shipId, colonyName) => {
  const transaction = await sequelize.transaction();

  try {
    // Get planet with lock
    const planet = await Planet.findByPk(planetId, {
      transaction,
      lock: transaction.LOCK.UPDATE,
      include: [{ model: Sector, as: 'sector' }]
    });

    if (!planet) {
      throw Object.assign(new Error('Planet not found'), { statusCode: 404 });
    }

    if (planet.owner_user_id) {
      throw Object.assign(new Error('Planet is already colonized'), { statusCode: 400 });
    }

    // Check habitability
    if (planet.habitability === 0) {
      throw Object.assign(new Error('This planet cannot be colonized (uninhabitable)'), { statusCode: 400 });
    }

    // Get user with lock
    const user = await User.findByPk(userId, {
      transaction,
      lock: transaction.LOCK.UPDATE
    });

    if (!user) {
      throw Object.assign(new Error('User not found'), { statusCode: 404 });
    }

    // Get ship and verify it's in the right sector
    const ship = await Ship.findOne({
      where: { ship_id: shipId, owner_user_id: userId },
      transaction
    });

    if (!ship) {
      throw Object.assign(new Error('Ship not found'), { statusCode: 404 });
    }

    if (ship.current_sector_id !== planet.sector_id) {
      throw Object.assign(new Error('Ship must be in the same sector as the planet'), { statusCode: 400 });
    }

    // Check if Colony Ship is required and ship type matches
    if (config.colonization.colonyShipRequired && ship.ship_type !== 'Colony Ship') {
      throw Object.assign(new Error('Colony Ship required for colonization'), { statusCode: 400 });
    }

    // Check colonization cost
    const cost = config.colonization.baseCost;
    if (user.credits < cost) {
      throw Object.assign(new Error(`Insufficient credits. Colonization costs ${cost} credits.`), { statusCode: 400 });
    }

    // Deduct credits
    await user.update({
      credits: user.credits - cost
    }, { transaction });

    // Set planet owner
    await planet.update({
      owner_user_id: userId
    }, { transaction });

    // Create colony
    const colony = await Colony.create({
      planet_id: planetId,
      user_id: userId,
      name: colonyName || `${planet.name} Colony`,
      population: 100,
      infrastructure_level: 1,
      last_resource_tick: new Date()
    }, { transaction });

    await transaction.commit();

    return {
      colony,
      planet,
      credits_spent: cost,
      remaining_credits: user.credits - cost
    };
  } catch (error) {
    await transaction.rollback();
    throw error;
  }
};

/**
 * Get all colonies for a user
 */
const getUserColonies = async (userId) => {
  const colonies = await Colony.findAll({
    where: { user_id: userId, is_active: true },
    include: [{
      model: Planet,
      as: 'planet',
      include: [
        { model: Sector, as: 'sector', attributes: ['sector_id', 'name'] },
        { model: PlanetResource, as: 'resources' }
      ]
    }]
  });

  return colonies;
};

/**
 * Get colony details
 */
const getColonyDetails = async (colonyId, userId) => {
  const colony = await Colony.findOne({
    where: { colony_id: colonyId, user_id: userId },
    include: [{
      model: Planet,
      as: 'planet',
      include: [
        { model: Sector, as: 'sector' },
        { model: PlanetResource, as: 'resources' }
      ]
    }]
  });

  if (!colony) {
    throw Object.assign(new Error('Colony not found'), { statusCode: 404 });
  }

  return colony;
};

/**
 * Process resource generation for a colony and transfer to ship
 * Requires a ship at the colony's sector to collect resources
 */
const processResourceGeneration = async (colonyId, userId, shipId = null) => {
  const transaction = await sequelize.transaction();

  try {
    const colony = await Colony.findOne({
      where: { colony_id: colonyId, user_id: userId, is_active: true },
      include: [{
        model: Planet,
        as: 'planet',
        include: [
          { model: PlanetResource, as: 'resources' },
          { model: Sector, as: 'sector' }
        ]
      }],
      transaction,
      lock: transaction.LOCK.UPDATE
    });

    if (!colony) {
      throw Object.assign(new Error('Colony not found'), { statusCode: 404 });
    }

    const now = new Date();
    const lastTick = new Date(colony.last_resource_tick);
    const hoursPassed = (now - lastTick) / (1000 * 60 * 60);

    if (hoursPassed < 1) {
      throw Object.assign(new Error('Resources can only be collected once per hour'), { statusCode: 400 });
    }

    // If ship is provided, verify it and prepare for cargo transfer
    let ship = null;
    let shipCargoCapacity = 0;
    let usedCargo = 0;

    if (shipId) {
      ship = await Ship.findOne({
        where: { ship_id: shipId, owner_user_id: userId },
        include: [{ model: ShipCargo, as: 'cargo', include: [{ model: Commodity, as: 'commodity' }] }],
        transaction
      });

      if (!ship) {
        throw Object.assign(new Error('Ship not found'), { statusCode: 404 });
      }

      if (ship.current_sector_id !== colony.planet.sector_id) {
        throw Object.assign(new Error('Ship must be in the same sector as the colony to collect resources'), { statusCode: 400 });
      }

      shipCargoCapacity = ship.cargo_capacity;
      usedCargo = ship.cargo ? ship.cargo.reduce((sum, c) => sum + (c.quantity * c.commodity.volume_per_unit), 0) : 0;
    }

    // Calculate resource generation
    const generatedResources = [];
    const transferredResources = [];
    const baseMultiplier = config.colonization.baseResourceGeneration;
    const infrastructureBonus = 1 + (colony.infrastructure_level - 1) * 0.1;
    const populationBonus = Math.min(1 + colony.population / 1000, 2.0);

    for (const resource of colony.planet.resources) {
      const remaining = resource.total_quantity - resource.extracted_quantity;
      if (remaining <= 0) continue;

      // Calculate yield
      const baseYield = resource.abundance * baseMultiplier * infrastructureBonus * populationBonus;
      const yield_ = Math.min(Math.floor(baseYield * hoursPassed), remaining);

      if (yield_ > 0) {
        // Update extracted quantity
        await resource.update({
          extracted_quantity: resource.extracted_quantity + yield_
        }, { transaction });

        generatedResources.push({
          resource_type: resource.resource_type,
          amount: yield_,
          remaining: remaining - yield_
        });

        // Transfer to ship if provided
        if (ship) {
          const commodityName = RESOURCE_TO_COMMODITY[resource.resource_type];
          if (commodityName) {
            const commodity = await Commodity.findOne({ where: { name: commodityName }, transaction });
            if (commodity) {
              const volumeNeeded = yield_ * commodity.volume_per_unit;
              const availableSpace = shipCargoCapacity - usedCargo;
              const transferAmount = Math.min(yield_, Math.floor(availableSpace / commodity.volume_per_unit));

              if (transferAmount > 0) {
                // Find or create cargo entry
                const [shipCargo, created] = await ShipCargo.findOrCreate({
                  where: { ship_id: shipId, commodity_id: commodity.commodity_id },
                  defaults: { quantity: 0 },
                  transaction
                });

                await shipCargo.update({ quantity: shipCargo.quantity + transferAmount }, { transaction });
                usedCargo += transferAmount * commodity.volume_per_unit;

                transferredResources.push({
                  resource_type: resource.resource_type,
                  commodity_name: commodityName,
                  amount_transferred: transferAmount,
                  amount_generated: yield_
                });
              }
            }
          }
        }
      }
    }

    // Process building production tick
    let buildingProduction = { production: [], powerBalance: 0 };
    try {
      buildingProduction = await colonyBuildingService.processProductionTick(
        colonyId, hoursPassed, generatedResources, transaction, colony
      );
    } catch (buildingErr) {
      // Non-fatal: log but don't fail the whole collection
      console.warn('Building production error:', buildingErr.message);
    }

    // Calculate population growth
    const populationGrowthRate = config.colonization.basePopulationGrowth || 0.05;
    const habitabilityMultiplier = colony.planet.habitability || 0.5;
    const growthPerHour = colony.population * (populationGrowthRate / 24) * habitabilityMultiplier;
    const populationGrowth = Math.floor(growthPerHour * hoursPassed);
    const newPopulation = colony.population + populationGrowth;

    // Max population based on infrastructure level and planet size
    const maxPopulation = colony.infrastructure_level * colony.planet.size * 500;
    const cappedPopulation = Math.min(newPopulation, maxPopulation);

    // Update last tick time and population
    await colony.update({
      last_resource_tick: now,
      population: cappedPopulation
    }, { transaction });

    await transaction.commit();

    return {
      colony_id: colonyId,
      hours_passed: Math.floor(hoursPassed),
      resources_generated: generatedResources,
      resources_transferred: ship ? transferredResources : null,
      ship_id: shipId || null,
      population_growth: populationGrowth,
      new_population: cappedPopulation,
      building_production: buildingProduction.production,
      power_balance: buildingProduction.powerBalance
    };
  } catch (error) {
    await transaction.rollback();
    throw error;
  }
};

/**
 * Upgrade colony infrastructure
 */
const upgradeInfrastructure = async (colonyId, userId) => {
  const transaction = await sequelize.transaction();

  try {
    const colony = await Colony.findOne({
      where: { colony_id: colonyId, user_id: userId, is_active: true },
      transaction,
      lock: transaction.LOCK.UPDATE
    });

    if (!colony) {
      throw Object.assign(new Error('Colony not found'), { statusCode: 404 });
    }

    if (colony.infrastructure_level >= config.colonization.maxInfrastructureLevel) {
      throw Object.assign(new Error('Colony is at maximum infrastructure level'), { statusCode: 400 });
    }

    // Calculate upgrade cost (exponential)
    const upgradeCost = Math.floor(config.colonization.baseCost * Math.pow(1.5, colony.infrastructure_level));

    const user = await User.findByPk(userId, { transaction, lock: transaction.LOCK.UPDATE });

    if (user.credits < upgradeCost) {
      throw Object.assign(new Error(`Insufficient credits. Upgrade costs ${upgradeCost} credits.`), { statusCode: 400 });
    }

    // Deduct credits and upgrade
    const newCredits = user.credits - upgradeCost;
    const newInfrastructureLevel = colony.infrastructure_level + 1;

    await user.update({ credits: newCredits }, { transaction });
    await colony.update({ infrastructure_level: newInfrastructureLevel }, { transaction });

    await transaction.commit();

    return {
      colony_id: colonyId,
      new_infrastructure_level: newInfrastructureLevel,
      credits_spent: upgradeCost,
      remaining_credits: newCredits
    };
  } catch (error) {
    await transaction.rollback();
    throw error;
  }
};

/**
 * Abandon a colony
 */
const abandonColony = async (colonyId, userId) => {
  const transaction = await sequelize.transaction();

  try {
    const colony = await Colony.findOne({
      where: { colony_id: colonyId, user_id: userId },
      include: [{ model: Planet, as: 'planet' }],
      transaction
    });

    if (!colony) {
      throw Object.assign(new Error('Colony not found'), { statusCode: 404 });
    }

    // Remove colony
    await colony.destroy({ transaction });

    // Clear planet ownership
    await colony.planet.update({ owner_user_id: null }, { transaction });

    await transaction.commit();

    return { message: 'Colony abandoned successfully' };
  } catch (error) {
    await transaction.rollback();
    throw error;
  }
};

module.exports = {
  colonizePlanet,
  getUserColonies,
  getColonyDetails,
  processResourceGeneration,
  upgradeInfrastructure,
  abandonColony
};

