const { validationResult } = require('express-validator');
const { Op, fn } = require('sequelize');
const { Sector, SectorConnection, Port, PortCommodity, Commodity } = require('../models');

const getSectors = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const { page = 1, limit = 50, type } = req.query;
    const offset = (page - 1) * limit;

    const whereClause = {};
    if (type) {
      whereClause.type = type;
    }

    const { count, rows: sectors } = await Sector.findAndCountAll({
      where: whereClause,
      limit: parseInt(limit),
      offset: parseInt(offset),
      order: [['x_coord', 'ASC'], ['y_coord', 'ASC']]
    });

    res.json({
      success: true,
      data: {
        sectors,
        pagination: {
          total: count,
          page: parseInt(page),
          limit: parseInt(limit),
          pages: Math.ceil(count / limit)
        }
      }
    });
  } catch (error) {
    next(error);
  }
};

const getSectorById = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const { sectorId } = req.params;

    const sector = await Sector.findByPk(sectorId);

    if (!sector) {
      return res.status(404).json({
        success: false,
        message: 'Sector not found'
      });
    }

    // Get connections for this sector
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

    const adjacentSectors = connections.map(conn => {
      const adjacentSector = conn.sector_a_id === sectorId
        ? conn.sectorB
        : conn.sectorA;
      return {
        sector: adjacentSector,
        connection_type: conn.connection_type,
        travel_time: conn.travel_time
      };
    });

    // Get ports in this sector (Phase 2)
    const ports = await Port.findAll({
      where: { sector_id: sectorId, is_active: true },
      attributes: ['port_id', 'name', 'type', 'description', 'tax_rate', 'allows_illegal']
    });

    res.json({
      success: true,
      data: {
        sector,
        adjacentSectors,
        ports
      }
    });
  } catch (error) {
    next(error);
  }
};

const getUniverseStats = async (req, res, next) => {
  try {
    const totalSectors = await Sector.count();
    const totalConnections = await SectorConnection.count();
    
    const sectorTypes = await Sector.findAll({
      attributes: [
        'type',
        [fn('COUNT', 'type'), 'count']
      ],
      group: ['type']
    });

    res.json({
      success: true,
      data: {
        totalSectors,
        totalConnections,
        sectorTypes
      }
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getSectors,
  getSectorById,
  getUniverseStats
};

