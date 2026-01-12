const { Ship, Sector, SectorConnection, sequelize } = require('../models');
const { Op } = require('sequelize');
const maintenanceService = require('./maintenanceService');

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

const getAdjacentSectors = async (sectorId) => {
  // Find all connections where this sector is either A or B
  const connections = await SectorConnection.findAll({
    where: {
      [Op.or]: [
        { sector_a_id: sectorId },
        { sector_b_id: sectorId, is_bidirectional: true }
      ]
    },
    include: [
      { model: Sector, as: 'sectorA' },
      { model: Sector, as: 'sectorB' }
    ]
  });

  // Extract the connected sectors (not the current one)
  const adjacentSectors = connections.map(conn => {
    if (conn.sector_a_id === sectorId) {
      return {
        sector: conn.sectorB,
        connection_type: conn.connection_type,
        travel_time: conn.travel_time
      };
    } else {
      return {
        sector: conn.sectorA,
        connection_type: conn.connection_type,
        travel_time: conn.travel_time
      };
    }
  });

  return adjacentSectors;
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

    // Validate target sector exists
    const targetSector = await Sector.findByPk(targetSectorId, { transaction });
    if (!targetSector) {
      const error = new Error('Target sector not found');
      error.statusCode = 404;
      throw error;
    }

    // Check adjacency and get connection details for fuel calculation
    const connection = await SectorConnection.findOne({
      where: {
        [Op.or]: [
          { sector_a_id: ship.current_sector_id, sector_b_id: targetSectorId },
          {
            sector_a_id: targetSectorId,
            sector_b_id: ship.current_sector_id,
            is_bidirectional: true
          }
        ]
      },
      transaction
    });

    if (!connection) {
      const error = new Error('Target sector is not adjacent to current sector');
      error.statusCode = 400;
      throw error;
    }

    // Calculate fuel cost based on travel_time
    const fuelCost = connection.travel_time || 1;

    // Check fuel
    if (ship.fuel < fuelCost) {
      const error = new Error(`Insufficient fuel for travel. Required: ${fuelCost}, Available: ${ship.fuel}`);
      error.statusCode = 400;
      throw error;
    }

    // Update ship location and fuel
    await ship.update({
      current_sector_id: targetSectorId,
      fuel: ship.fuel - fuelCost
    }, { transaction });

    // Apply component degradation from sector jump
    await maintenanceService.degradeOnJump(shipId, transaction);

    // Commit transaction
    await transaction.commit();

    // Reload with associations outside transaction
    await ship.reload({
      include: [{
        model: Sector,
        as: 'currentSector'
      }]
    });

    return ship;
  } catch (error) {
    // Rollback transaction on any error
    await transaction.rollback();
    throw error;
  }
};

const getShipStatus = async (shipId, userId) => {
  const ship = await getShipById(shipId, userId);
  const adjacentSectors = await getAdjacentSectors(ship.current_sector_id);

  return {
    ship: ship.toJSON(),
    adjacentSectors
  };
};

module.exports = {
  getShipById,
  getUserShips,
  getAdjacentSectors,
  isAdjacent,
  moveShip,
  getShipStatus
};

