const { Ship, Sector, SectorConnection, User, TechResearch, sequelize } = require('../models');
const { Op } = require('sequelize');
const config = require('../config');
const maintenanceService = require('./maintenanceService');
const npcService = require('./npcService');
const { discoverSectorAndNeighbors } = require('./discoveryService');
const worldPolicyService = require('./worldPolicyService');
const combatPolicyService = require('./combatPolicyService');
const actionAuditService = require('./actionAuditService');
const sectorInstanceService = require('./sectorInstanceService');

const getShipById = async (shipId, userId = null) => {
  const whereClause = { ship_id: shipId };
  if (userId) {
    whereClause.owner_user_id = userId;
  }

  const ship = await Ship.findOne({
    where: whereClause,
    include: [{
      model: Sector,
      as: 'currentSector'
    }]
  });

  if (!ship) {
    const error = new Error('Ship not found');
    error.statusCode = 404;
    throw error;
  }

  return ship;
};

const getUserShips = async (userId) => {
  return Ship.findAll({
    where: { owner_user_id: userId },
    include: [{
      model: Sector,
      as: 'currentSector'
    }]
  });
};

const getAdjacentSectors = async (sectorId, userId = null, options = {}) => {
  return worldPolicyService.getAccessibleAdjacentSectors({
    sectorId,
    userId,
    includeRestricted: options.includeRestricted === true
  });
};

const isAdjacent = async (fromSectorId, toSectorId) => {
  const connection = await SectorConnection.findOne({
    where: {
      [Op.or]: [
        { sector_a_id: fromSectorId, sector_b_id: toSectorId },
        { 
          sector_a_id: toSectorId, 
          sector_b_id: fromSectorId,
          is_bidirectional: true 
        }
      ]
    }
  });

  return connection !== null;
};

const moveShip = async (shipId, targetSectorId, userId) => {
  // Use transaction to prevent race conditions
  const transaction = await sequelize.transaction();
  let originSectorId = null;
  let traversal = null;
  let entryProtection = null;

  try {
    // Get the ship with lock to prevent concurrent modifications
    const ship = await Ship.findOne({
      where: {
        ship_id: shipId,
        owner_user_id: userId
      },
      include: [{
        model: Sector,
        as: 'currentSector'
      }],
      lock: transaction.LOCK.UPDATE,
      transaction
    });

    if (!ship) {
      const error = new Error('Ship not found');
      error.statusCode = 404;
      throw error;
    }

    // Check if already in target sector
    if (ship.current_sector_id === targetSectorId) {
      const error = new Error('Ship is already in the target sector');
      error.statusCode = 400;
      throw error;
    }
    originSectorId = ship.current_sector_id;

    const targetSector = await Sector.findByPk(targetSectorId, { transaction });
    if (!targetSector) {
      const error = new Error('Target sector not found');
      error.statusCode = 404;
      throw error;
    }

    traversal = await worldPolicyService.resolveTraversal({
      fromSectorId: ship.current_sector_id,
      toSectorId: targetSectorId,
      userId,
      transaction
    });
    const connection = traversal.connection;

    // Calculate fuel cost based on travel_time
    const fuelCost = connection.travel_time || 1;

    // Apply phenomena fuel modifier
    let adjustedFuelCost = fuelCost;
    try {
      const phenomenaService = require('./phenomenaService');
      const effects = await phenomenaService.applyPhenomenaEffects(targetSectorId);
      if (effects.fuel_multiplier) {
        adjustedFuelCost = Math.ceil(fuelCost * effects.fuel_multiplier);
      }
    } catch (e) { /* phenomena check failure should not block movement */ }

    // Check fuel
    if (ship.fuel < adjustedFuelCost) {
      const error = new Error(`Insufficient fuel for travel. Required: ${adjustedFuelCost}, Available: ${ship.fuel}`);
      error.statusCode = 400;
      throw error;
    }

    // Update ship location and fuel
    await ship.update({
      current_sector_id: targetSectorId,
      fuel: ship.fuel - adjustedFuelCost
    }, { transaction });

    // Apply component degradation from sector jump
    await maintenanceService.degradeOnJump(shipId, transaction);

    // Discover new sector and its neighbors (fog of war)
    await discoverSectorAndNeighbors(userId, targetSectorId, transaction);

    entryProtection = combatPolicyService.resolveEntryProtection({
      connectionPolicy: traversal.connectionPolicy,
      toPolicy: traversal.toPolicy
    });
    if (entryProtection) {
      await combatPolicyService.grantTravelProtection({
        userId,
        durationMs: entryProtection.durationMs,
        reason: entryProtection.reason,
        transaction
      });
    }

    const instanceAssignment = await sectorInstanceService.assignUserToSector({
      userId,
      sectorId: targetSectorId,
      transaction
    });
    await sectorInstanceService.releaseUserFromSector({
      userId,
      sectorId: originSectorId,
      transaction
    });

    // Commit transaction
    await transaction.commit();

    // Reload with associations outside transaction
    await ship.reload({
      include: [{
        model: Sector,
        as: 'currentSector'
      }]
    });

    // Check for hostile NPCs in the new sector (potential ambush)
    // This is done after commit so failures don't affect the move
    try {
      const hostileNPC = await npcService.getAggressiveNPCInSector(targetSectorId);
      const ambushThreat = hostileNPC && npcService.willNPCAttack(hostileNPC);

      // Return ship with optional threat warning
      ship.dataValues.hostile_encounter = ambushThreat ? {
        npc_id: hostileNPC.npc_id,
        npc_name: hostileNPC.name,
        npc_type: hostileNPC.npc_type,
        message: `Warning: ${hostileNPC.name} is targeting your ship!`
      } : null;
    } catch {
      // NPC check failed, but move succeeded - just skip the warning
      ship.dataValues.hostile_encounter = null;
    }
    ship.dataValues.instance_assignment = instanceAssignment || null;

    await actionAuditService.record({
      userId,
      actionType: 'ship_travel',
      scopeType: 'ship',
      scopeId: shipId,
      status: 'allow',
      reason: 'authorized',
      metadata: {
        from_sector_id: originSectorId,
        to_sector_id: targetSectorId,
        lane_class: traversal.connectionPolicy.lane_class,
        connection_type: traversal.connection.connection_type,
        entry_protection_reason: entryProtection?.reason || null,
        instance_key: instanceAssignment?.instance_key || null
      }
    }).catch(() => null);

    return ship;
  } catch (error) {
    // Rollback transaction on any error (only if not already committed)
    if (!transaction.finished) {
      await transaction.rollback();
    }
    await actionAuditService.record({
      userId,
      actionType: 'ship_travel',
      scopeType: 'ship',
      scopeId: shipId,
      status: 'deny',
      reason: error.message,
      metadata: {
        from_sector_id: originSectorId,
        to_sector_id: targetSectorId
      }
    }).catch(() => null);
    throw error;
  }
};

const getShipStatus = async (shipId, userId) => {
  const ship = await getShipById(shipId, userId);
  const adjacentSectors = await getAdjacentSectors(ship.current_sector_id, userId);

  return {
    ship: ship.toJSON(),
    adjacentSectors
  };
};

const activateShip = async (shipId, userId) => {
  const ship = await Ship.findOne({
    where: {
      ship_id: shipId,
      owner_user_id: userId,
      is_active: true
    },
    include: [{
      model: Sector,
      as: 'currentSector'
    }]
  });

  if (!ship) {
    const error = new Error('Ship not found or is destroyed');
    error.statusCode = 404;
    throw error;
  }

  await User.update(
    { active_ship_id: shipId },
    { where: { user_id: userId } }
  );

  return ship;
};

const grantRescueShip = async (userId) => {
  // Find the user's last known sector, or fall back to a starting sector
  const destroyedShip = await Ship.findOne({
    where: { owner_user_id: userId },
    order: [['updated_at', 'DESC']]
  });

  let sectorId;
  if (destroyedShip) {
    sectorId = destroyedShip.current_sector_id;
  } else {
    const startingSector = await Sector.findOne({ where: { is_starting_sector: true } })
      || await Sector.findOne();
    if (!startingSector) {
      const error = new Error('No sectors available');
      error.statusCode = 500;
      throw error;
    }
    sectorId = startingSector.sector_id;
  }

  const user = await User.findByPk(userId);
  const sanitizedName = (user?.username || 'Commander').replace(/[<>&"']/g, '');

  const ship = await Ship.create({
    owner_user_id: userId,
    current_sector_id: sectorId,
    ship_type: 'Scout',
    name: `${sanitizedName}'s Rescue Pod`,
    is_active: true
  });

  // Set as active ship
  await User.update(
    { active_ship_id: ship.ship_id },
    { where: { user_id: userId } }
  );

  // Reload with sector association
  await ship.reload({
    include: [{ model: Sector, as: 'currentSector' }]
  });

  return ship;
};

const validateShipUnlock = async (userId, shipType) => {
  const requirement = config.shipUnlockRequirements[shipType];

  // null or undefined means the ship is available to everyone
  if (!requirement) {
    return;
  }

  if (requirement.level) {
    const user = await User.findByPk(userId);
    if (!user || user.level < requirement.level) {
      const error = new Error(`Requires level ${requirement.level} to unlock this ship type`);
      error.statusCode = 403;
      throw error;
    }
  }

  if (requirement.tech) {
    const research = await TechResearch.findOne({
      where: {
        user_id: userId,
        tech_name: requirement.tech,
        is_completed: true
      }
    });
    if (!research) {
      const techEntry = config.techTree[requirement.tech];
      const techName = techEntry ? techEntry.name : requirement.tech;
      const error = new Error(`Requires ${techName} research to unlock this ship type`);
      error.statusCode = 403;
      throw error;
    }
  }
};

module.exports = {
  getShipById,
  getUserShips,
  getAdjacentSectors,
  isAdjacent,
  moveShip,
  getShipStatus,
  activateShip,
  grantRescueShip,
  validateShipUnlock
};
