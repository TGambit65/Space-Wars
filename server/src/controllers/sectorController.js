const { validationResult } = require('express-validator');
const { Op, fn, col, literal } = require('sequelize');
const { Sector, SectorConnection, Port, Ship, NPC, Planet, Colony, sequelize } = require('../models');
const config = require('../config');
const { getDiscoveredSectorIds } = require('../services/discoveryService');

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

/**
 * GET /api/sectors/map
 * Single-payload endpoint optimized for galaxy map rendering.
 * Includes fog-of-war: only discovered systems have full detail.
 */
const getMapData = async (req, res, next) => {
  try {
    // Get discovered sector IDs for the current user (if authenticated)
    let discoveredIds = null;
    if (req.userId) {
      discoveredIds = await getDiscoveredSectorIds(req.userId);
    }

    // Fetch all sectors with port/ship counts
    const sectors = await Sector.findAll({
      attributes: [
        'sector_id', 'name', 'x_coord', 'y_coord', 'type', 'star_class',
        'hazard_level', 'is_starting_sector', 'phenomena'
      ],
      include: [
        {
          model: Port,
          as: 'ports',
          attributes: ['port_id'],
          where: { is_active: true },
          required: false
        },
        {
          model: Ship,
          as: 'ships',
          attributes: ['ship_id'],
          required: false
        }
      ]
    });

    // Fetch all connections
    const connections = await SectorConnection.findAll({
      attributes: ['sector_a_id', 'sector_b_id', 'connection_type', 'travel_time']
    });

    const config = require('../config');

    // Fetch current user's ships for map badges
    let userShipsBySector = new Map();
    if (req.userId) {
      const userShips = await Ship.findAll({
        where: { owner_user_id: req.userId },
        attributes: ['ship_id', 'name', 'ship_type', 'fleet_id', 'current_sector_id', 'is_active']
      });
      for (const ship of userShips) {
        if (!userShipsBySector.has(ship.current_sector_id)) {
          userShipsBySector.set(ship.current_sector_id, []);
        }
        userShipsBySector.get(ship.current_sector_id).push({
          ship_id: ship.ship_id,
          name: ship.name,
          ship_type: ship.ship_type,
          fleet_id: ship.fleet_id,
          is_active: ship.is_active
        });
      }
    }

    const systems = sectors.map(s => {
      const discovered = !discoveredIds || discoveredIds.has(s.sector_id);
      return {
        sector_id: s.sector_id,
        // Fog of war: hide details for undiscovered systems
        name: discovered ? s.name : null,
        x_coord: s.x_coord,
        y_coord: s.y_coord,
        type: discovered ? s.type : null,
        star_class: discovered ? s.star_class : null,
        hazard_level: discovered ? s.hazard_level : null,
        is_starting_sector: s.is_starting_sector,
        has_port: discovered ? (s.ports && s.ports.length > 0) : null,
        ship_count: discovered ? (s.ships ? s.ships.length : 0) : null,
        phenomena: discovered ? s.phenomena : null,
        discovered,
        my_ships: discovered ? (userShipsBySector.get(s.sector_id) || []) : []
      };
    });

    // Only include hyperlanes where at least one end is discovered
    const hyperlanes = connections
      .filter(c => !discoveredIds || discoveredIds.has(c.sector_a_id) || discoveredIds.has(c.sector_b_id))
      .map(c => ({
        from_id: c.sector_a_id,
        to_id: c.sector_b_id,
        connection_type: c.connection_type,
        travel_time: c.travel_time
      }));

    res.json({
      success: true,
      data: {
        systems,
        hyperlanes,
        galaxy_radius: config.universe.galaxyRadius,
        total_systems: sectors.length,
        discovered_systems: discoveredIds ? discoveredIds.size : sectors.length
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/sectors/:sectorId/system
 * Returns full system detail for zoomed-in view.
 */
const getSystemDetail = async (req, res, next) => {
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
      return res.status(404).json({ success: false, message: 'Sector not found' });
    }

    // Get planets with colony data
    const planets = await Planet.findAll({
      where: { sector_id: sectorId },
      attributes: ['planet_id', 'name', 'type', 'size', 'gravity', 'habitability',
        'temperature', 'orbital_position', 'owner_user_id', 'has_artifact', 'is_scanned'],
      include: [{
        model: Colony,
        as: 'colony',
        attributes: ['colony_id', 'name', 'population', 'infrastructure_level'],
        required: false
      }],
      order: [['orbital_position', 'ASC']]
    });

    // Get ports
    const ports = await Port.findAll({
      where: { sector_id: sectorId, is_active: true },
      attributes: ['port_id', 'name', 'type', 'description', 'tax_rate', 'allows_illegal']
    });

    // Get ships in sector
    const ships = await Ship.findAll({
      where: { current_sector_id: sectorId },
      attributes: ['ship_id', 'name', 'ship_type', 'owner_user_id']
    });

    // Get NPCs in sector
    const npcs = await NPC.findAll({
      where: { current_sector_id: sectorId, is_alive: true },
      attributes: ['npc_id', 'name', 'npc_type', 'ship_type', 'aggression_level', 'hull_points', 'max_hull_points']
    });

    // Get connected neighbors
    const connections = await SectorConnection.findAll({
      where: {
        [Op.or]: [
          { sector_a_id: sectorId },
          { sector_b_id: sectorId }
        ]
      },
      include: [
        { model: Sector, as: 'sectorA', attributes: ['sector_id', 'name', 'type', 'star_class'] },
        { model: Sector, as: 'sectorB', attributes: ['sector_id', 'name', 'type', 'star_class'] }
      ]
    });

    const neighbors = connections.map(conn => {
      const neighbor = conn.sector_a_id === sectorId ? conn.sectorB : conn.sectorA;
      return {
        sector_id: neighbor.sector_id,
        name: neighbor.name,
        type: neighbor.type,
        star_class: neighbor.star_class,
        connection_type: conn.connection_type,
        travel_time: conn.travel_time
      };
    });

    // Get star color from config
    const starConfig = config.starClasses[sector.star_class];
    const star_color = starConfig ? starConfig.color : '#FFFFFF';

    res.json({
      success: true,
      data: {
        sector: {
          sector_id: sector.sector_id,
          name: sector.name,
          x_coord: sector.x_coord,
          y_coord: sector.y_coord,
          type: sector.type,
          star_class: sector.star_class,
          star_color,
          hazard_level: sector.hazard_level,
          description: sector.description
        },
        planets,
        ports,
        ships,
        npcs,
        neighbors
      }
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getSectors,
  getSectorById,
  getUniverseStats,
  getMapData,
  getSystemDetail
};
