const { Fleet, Ship, Sector, sequelize } = require('../models');
const { Op } = require('sequelize');
const config = require('../config');
const maintenanceService = require('./maintenanceService');
const { discoverSectorAndNeighbors } = require('./discoveryService');
const worldPolicyService = require('./worldPolicyService');
const combatPolicyService = require('./combatPolicyService');
const actionAuditService = require('./actionAuditService');
const sectorInstanceService = require('./sectorInstanceService');

const createFleet = async (userId, name, shipIds) => {
  if (!name || !name.trim()) {
    const error = new Error('Fleet name is required');
    error.statusCode = 400;
    throw error;
  }

  if (!shipIds || shipIds.length === 0) {
    const error = new Error('At least one ship is required to create a fleet');
    error.statusCode = 400;
    throw error;
  }

  if (shipIds.length > config.fleets.maxShipsPerFleet) {
    const error = new Error(`Maximum ${config.fleets.maxShipsPerFleet} ships per fleet`);
    error.statusCode = 400;
    throw error;
  }

  const transaction = await sequelize.transaction();
  try {
    // Check fleet limit
    const fleetCount = await Fleet.count({
      where: { owner_user_id: userId, is_active: true },
      transaction
    });
    if (fleetCount >= config.fleets.maxFleetsPerPlayer) {
      const error = new Error(`Maximum ${config.fleets.maxFleetsPerPlayer} active fleets allowed`);
      error.statusCode = 400;
      throw error;
    }

    // Validate all ships belong to user, are active, and not already in a fleet
    const ships = await Ship.findAll({
      where: {
        ship_id: { [Op.in]: shipIds },
        owner_user_id: userId,
        is_active: true
      },
      transaction
    });

    if (ships.length !== shipIds.length) {
      const error = new Error('One or more ships not found, not owned by you, or inactive');
      error.statusCode = 400;
      throw error;
    }

    const alreadyAssigned = ships.filter(s => s.fleet_id !== null);
    if (alreadyAssigned.length > 0) {
      const error = new Error(`Ships already in a fleet: ${alreadyAssigned.map(s => s.name).join(', ')}`);
      error.statusCode = 400;
      throw error;
    }

    // Create fleet
    const fleet = await Fleet.create({
      owner_user_id: userId,
      name: name.trim()
    }, { transaction });

    // Assign ships
    await Ship.update(
      { fleet_id: fleet.fleet_id },
      { where: { ship_id: { [Op.in]: shipIds } }, transaction }
    );

    await transaction.commit();

    // Reload with ships
    return getFleet(fleet.fleet_id, userId);
  } catch (error) {
    if (!transaction.finished) await transaction.rollback();
    throw error;
  }
};

const getUserFleets = async (userId) => {
  return Fleet.findAll({
    where: { owner_user_id: userId, is_active: true },
    include: [{
      model: Ship,
      as: 'ships',
      include: [{ model: Sector, as: 'currentSector', attributes: ['sector_id', 'name'] }]
    }],
    order: [['created_at', 'DESC']]
  });
};

const getFleet = async (fleetId, userId) => {
  const fleet = await Fleet.findOne({
    where: { fleet_id: fleetId, owner_user_id: userId, is_active: true },
    include: [{
      model: Ship,
      as: 'ships',
      include: [{ model: Sector, as: 'currentSector', attributes: ['sector_id', 'name'] }]
    }]
  });

  if (!fleet) {
    const error = new Error('Fleet not found');
    error.statusCode = 404;
    throw error;
  }

  return fleet;
};

const renameFleet = async (fleetId, userId, name) => {
  if (!name || !name.trim()) {
    const error = new Error('Fleet name is required');
    error.statusCode = 400;
    throw error;
  }

  const fleet = await Fleet.findOne({
    where: { fleet_id: fleetId, owner_user_id: userId, is_active: true }
  });

  if (!fleet) {
    const error = new Error('Fleet not found');
    error.statusCode = 404;
    throw error;
  }

  await fleet.update({ name: name.trim() });
  return fleet;
};

const addShipsToFleet = async (fleetId, userId, shipIds) => {
  if (!shipIds || shipIds.length === 0) {
    const error = new Error('No ships specified');
    error.statusCode = 400;
    throw error;
  }

  const transaction = await sequelize.transaction();
  try {
    const fleet = await Fleet.findOne({
      where: { fleet_id: fleetId, owner_user_id: userId, is_active: true },
      include: [{ model: Ship, as: 'ships' }],
      transaction
    });

    if (!fleet) {
      const error = new Error('Fleet not found');
      error.statusCode = 404;
      throw error;
    }

    const currentCount = fleet.ships.length;
    if (currentCount + shipIds.length > config.fleets.maxShipsPerFleet) {
      const error = new Error(`Would exceed maximum of ${config.fleets.maxShipsPerFleet} ships per fleet`);
      error.statusCode = 400;
      throw error;
    }

    const ships = await Ship.findAll({
      where: {
        ship_id: { [Op.in]: shipIds },
        owner_user_id: userId,
        is_active: true
      },
      transaction
    });

    if (ships.length !== shipIds.length) {
      const error = new Error('One or more ships not found, not owned by you, or inactive');
      error.statusCode = 400;
      throw error;
    }

    const alreadyAssigned = ships.filter(s => s.fleet_id !== null);
    if (alreadyAssigned.length > 0) {
      const error = new Error(`Ships already in a fleet: ${alreadyAssigned.map(s => s.name).join(', ')}`);
      error.statusCode = 400;
      throw error;
    }

    await Ship.update(
      { fleet_id: fleetId },
      { where: { ship_id: { [Op.in]: shipIds } }, transaction }
    );

    await transaction.commit();
    return getFleet(fleetId, userId);
  } catch (error) {
    if (!transaction.finished) await transaction.rollback();
    throw error;
  }
};

const removeShipsFromFleet = async (fleetId, userId, shipIds) => {
  if (!shipIds || shipIds.length === 0) {
    const error = new Error('No ships specified');
    error.statusCode = 400;
    throw error;
  }

  const transaction = await sequelize.transaction();
  try {
    const fleet = await Fleet.findOne({
      where: { fleet_id: fleetId, owner_user_id: userId, is_active: true },
      include: [{ model: Ship, as: 'ships' }],
      transaction
    });

    if (!fleet) {
      const error = new Error('Fleet not found');
      error.statusCode = 404;
      throw error;
    }

    // Verify ships are in this fleet
    const fleetShipIds = fleet.ships.map(s => s.ship_id);
    const invalidIds = shipIds.filter(id => !fleetShipIds.includes(id));
    if (invalidIds.length > 0) {
      const error = new Error('One or more ships are not in this fleet');
      error.statusCode = 400;
      throw error;
    }

    await Ship.update(
      { fleet_id: null },
      { where: { ship_id: { [Op.in]: shipIds } }, transaction }
    );

    // Auto-disband if fleet becomes empty
    const remainingCount = fleetShipIds.length - shipIds.length;
    if (remainingCount <= 0) {
      await fleet.update({ is_active: false }, { transaction });
    }

    await transaction.commit();

    if (remainingCount <= 0) {
      return { disbanded: true };
    }
    return getFleet(fleetId, userId);
  } catch (error) {
    if (!transaction.finished) await transaction.rollback();
    throw error;
  }
};

const disbandFleet = async (fleetId, userId) => {
  const transaction = await sequelize.transaction();
  try {
    const fleet = await Fleet.findOne({
      where: { fleet_id: fleetId, owner_user_id: userId, is_active: true },
      include: [{ model: Ship, as: 'ships' }],
      transaction
    });

    if (!fleet) {
      const error = new Error('Fleet not found');
      error.statusCode = 404;
      throw error;
    }

    // Unassign all ships
    const shipIds = fleet.ships.map(s => s.ship_id);
    if (shipIds.length > 0) {
      await Ship.update(
        { fleet_id: null },
        { where: { ship_id: { [Op.in]: shipIds } }, transaction }
      );
    }

    await fleet.update({ is_active: false }, { transaction });
    await transaction.commit();

    return { disbanded: true, fleet_id: fleetId };
  } catch (error) {
    if (!transaction.finished) await transaction.rollback();
    throw error;
  }
};

/**
 * Move all ships in a fleet to a target sector (best-effort).
 * Ships that can't move are skipped with a reason.
 */
const moveFleet = async (fleetId, targetSectorId, userId) => {
  const transaction = await sequelize.transaction();
  try {
    const fleet = await Fleet.findOne({
      where: { fleet_id: fleetId, owner_user_id: userId, is_active: true },
      include: [{
        model: Ship,
        as: 'ships',
        where: { is_active: true },
        required: false
      }],
      lock: transaction.LOCK.UPDATE,
      transaction
    });

    if (!fleet) {
      const error = new Error('Fleet not found');
      error.statusCode = 404;
      throw error;
    }

    if (!fleet.ships || fleet.ships.length === 0) {
      const error = new Error('Fleet has no active ships');
      error.statusCode = 400;
      throw error;
    }

    // Validate target sector
    const targetSector = await Sector.findByPk(targetSectorId, { transaction });
    if (!targetSector) {
      const error = new Error('Target sector not found');
      error.statusCode = 404;
      throw error;
    }

    const moved = [];
    const failed = [];
    const failureAudits = [];

    for (const ship of fleet.ships) {
      try {
        await _moveShipCore(ship, targetSectorId, userId, transaction);
        moved.push({ ship_id: ship.ship_id, name: ship.name });
      } catch (moveError) {
        failed.push({ ship_id: ship.ship_id, name: ship.name, reason: moveError.message });
        failureAudits.push({
          userId,
          actionType: 'fleet_travel',
          scopeType: 'fleet',
          scopeId: fleetId,
          status: 'deny',
          reason: moveError.message,
          metadata: {
            ship_id: ship.ship_id,
            from_sector_id: ship.current_sector_id,
            to_sector_id: targetSectorId
          }
        });
      }
    }

    await transaction.commit();
    if (moved.length > 0) {
      await actionAuditService.record({
        userId,
        actionType: 'fleet_travel',
        scopeType: 'fleet',
        scopeId: fleetId,
        status: 'allow',
        reason: 'authorized',
        metadata: {
          to_sector_id: targetSectorId,
          moved_ship_ids: moved.map((ship) => ship.ship_id)
        }
      }).catch(() => null);
    }
    for (const audit of failureAudits) {
      await actionAuditService.record(audit).catch(() => null);
    }
    return { moved, failed };
  } catch (error) {
    if (!transaction.finished) await transaction.rollback();
    throw error;
  }
};

/**
 * Core ship movement logic extracted for reuse by both moveShip and moveFleet.
 * Operates within an existing transaction.
 */
const _moveShipCore = async (ship, targetSectorId, userId, transaction) => {
  // Check if in combat
  if (ship.in_combat) {
    throw new Error('Ship is in combat');
  }

  // Check if already in target sector
  if (ship.current_sector_id === targetSectorId) {
    throw new Error('Ship is already in the target sector');
  }

  const traversal = await worldPolicyService.resolveTraversal({
    fromSectorId: ship.current_sector_id,
    toSectorId: targetSectorId,
    userId,
    transaction
  });
  const connection = traversal.connection;

  // Calculate fuel cost
  const fuelCost = connection.travel_time || 1;
  let adjustedFuelCost = fuelCost;
  try {
    const phenomenaService = require('./phenomenaService');
    const effects = await phenomenaService.applyPhenomenaEffects(targetSectorId);
    if (effects.fuel_multiplier) {
      adjustedFuelCost = Math.ceil(fuelCost * effects.fuel_multiplier);
    }
  } catch (e) { /* phenomena check failure should not block movement */ }

  if (ship.fuel < adjustedFuelCost) {
    throw new Error('Insufficient fuel');
  }

  // Move ship
  await ship.update({
    current_sector_id: targetSectorId,
    fuel: ship.fuel - adjustedFuelCost
  }, { transaction });

  // Component degradation
  await maintenanceService.degradeOnJump(ship.ship_id, transaction);

  // Discover sector
  await discoverSectorAndNeighbors(userId, targetSectorId, transaction);

  const entryProtection = combatPolicyService.resolveEntryProtection({
    connectionPolicy: traversal.connectionPolicy,
    toPolicy: traversal.toPolicy,
    fleet: true
  });
  if (entryProtection) {
    await combatPolicyService.grantTravelProtection({
      userId,
      durationMs: entryProtection.durationMs,
      reason: entryProtection.reason,
      transaction
    });
  }

  await sectorInstanceService.assignUserToSector({
    userId,
    sectorId: targetSectorId,
    transaction
  });
  await sectorInstanceService.releaseUserFromSector({
    userId,
    sectorId: traversal.fromSector.sector_id,
    transaction
  });
};

module.exports = {
  createFleet,
  getUserFleets,
  getFleet,
  renameFleet,
  addShipsToFleet,
  removeShipsFromFleet,
  disbandFleet,
  moveFleet,
  _moveShipCore
};
