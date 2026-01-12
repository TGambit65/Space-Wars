/**
 * Sector Service - Business logic for sector operations
 */
const { Op } = require('sequelize');
const { Sector, SectorConnection, Port } = require('../models');

/**
 * Get sector by ID with connections
 */
const getSectorById = async (sectorId) => {
  const sector = await Sector.findByPk(sectorId);
  
  if (!sector) {
    const error = new Error('Sector not found');
    error.statusCode = 404;
    throw error;
  }

  // Get connected sectors
  const connections = await SectorConnection.findAll({
    where: {
      [Op.or]: [
        { sector_a_id: sectorId },
        { sector_b_id: sectorId }
      ]
    },
    include: [
      { model: Sector, as: 'sectorA' },
      { model: Sector, as: 'sectorB' }
    ]
  });

  const connectedSectors = connections.map(conn => {
    return conn.sector_a_id === sectorId ? conn.sectorB : conn.sectorA;
  });

  return { ...sector.toJSON(), connectedSectors };
};

/**
 * Get all sectors connected to a sector
 */
const getConnectedSectors = async (sectorId) => {
  const connections = await SectorConnection.findAll({
    where: {
      [Op.or]: [
        { sector_a_id: sectorId },
        { sector_b_id: sectorId }
      ]
    },
    include: [
      { model: Sector, as: 'sectorA' },
      { model: Sector, as: 'sectorB' }
    ]
  });

  return connections.map(conn => {
    return conn.sector_a_id === sectorId ? conn.sectorB : conn.sectorA;
  });
};

/**
 * Get all sectors with optional pagination
 */
const getAllSectors = async (options = {}) => {
  const { limit = 50, offset = 0 } = options;
  
  return Sector.findAll({
    limit,
    offset,
    order: [['x_coord', 'ASC'], ['y_coord', 'ASC']]
  });
};

/**
 * Get sector map data for visualization
 */
const getSectorMap = async () => {
  const sectors = await Sector.findAll({
    attributes: ['sector_id', 'name', 'x_coord', 'y_coord', 'type']
  });
  
  const connections = await SectorConnection.findAll({
    attributes: ['sector_a_id', 'sector_b_id']
  });

  return { sectors, connections };
};

/**
 * Check if two sectors are directly connected
 */
const isConnected = async (sectorAId, sectorBId) => {
  if (sectorAId === sectorBId) return false;
  
  const connection = await SectorConnection.findOne({
    where: {
      [Op.or]: [
        { sector_a_id: sectorAId, sector_b_id: sectorBId },
        { sector_a_id: sectorBId, sector_b_id: sectorAId }
      ]
    }
  });

  return !!connection;
};

/**
 * Search sectors by name
 */
const searchSectors = async (query) => {
  return Sector.findAll({
    where: {
      name: { [Op.like]: `%${query}%` }
    },
    limit: 20
  });
};

module.exports = {
  getSectorById,
  getConnectedSectors,
  getAllSectors,
  getSectorMap,
  isConnected,
  searchSectors
};

