const { validationResult } = require('express-validator');
const { Op, fn, col, literal } = require('sequelize');
const { Sector, SectorConnection, Port, Ship, NPC, Planet, Colony, sequelize } = require('../models');
const config = require('../config');
const { getDiscoveredSectorIds } = require('../services/discoveryService');
const worldPolicyService = require('../services/worldPolicyService');

// ─── Static Map Cache ────────────────────────────────────────────
// Sectors and connections are generated once and never change at runtime.
// Cache them to avoid full-table scans on every /api/sectors/map request.
let staticMapCache = null; // { sectors, connections, sectorCount, generatedAt }

const clearMapCache = () => {
  staticMapCache = null;
};

const serializeSector = (sector) => ({
  sector_id: sector.sector_id,
  name: sector.name,
  x_coord: sector.x_coord,
  y_coord: sector.y_coord,
  z_coord: sector.z_coord,
  type: sector.type,
  star_class: sector.star_class,
  description: sector.description,
  is_starting_sector: sector.is_starting_sector,
  hazard_level: sector.hazard_level,
  phenomena: sector.phenomena,
  policy_summary: worldPolicyService.summarizeSectorPolicy(sector)
});

const getStaticMapData = async () => {
  if (staticMapCache) return staticMapCache;

  const sectors = await Sector.findAll({
    attributes: [
      'sector_id', 'name', 'x_coord', 'y_coord', 'type', 'star_class',
      'hazard_level', 'is_starting_sector', 'phenomena',
      'zone_class', 'security_class', 'access_mode', 'owner_user_id', 'owner_corporation_id', 'rule_flags'
    ],
    include: [{
      model: Port,
      as: 'ports',
      attributes: ['port_id'],
      where: { is_active: true },
      required: false
    }]
  });

  const connections = await SectorConnection.findAll({
    attributes: [
      'sector_a_id',
      'sector_b_id',
      'connection_type',
      'lane_class',
      'access_mode',
      'travel_time',
      'rule_flags'
    ]
  });

  staticMapCache = {
    sectors: sectors.map(s => ({
      sector_id: s.sector_id,
      name: s.name,
      x_coord: s.x_coord,
      y_coord: s.y_coord,
      type: s.type,
      star_class: s.star_class,
      hazard_level: s.hazard_level,
      is_starting_sector: s.is_starting_sector,
      phenomena: s.phenomena,
      zone_class: s.zone_class,
      security_class: s.security_class,
      access_mode: s.access_mode,
      owner_user_id: s.owner_user_id,
      owner_corporation_id: s.owner_corporation_id,
      rule_flags: s.rule_flags,
      has_port: s.ports && s.ports.length > 0
    })),
    connections: connections.map(c => ({
      from_id: c.sector_a_id,
      to_id: c.sector_b_id,
      connection_type: c.connection_type,
      lane_class: c.lane_class,
      access_mode: c.access_mode,
      travel_time: c.travel_time,
      rule_flags: c.rule_flags
    })),
    sectorCount: sectors.length,
    generatedAt: Date.now()
  };

  return staticMapCache;
};

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
        sectors: sectors.map(serializeSector),
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
          { sector_b_id: sectorId, is_bidirectional: true }
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
        sector: serializeSector(adjacentSector),
        connection_type: conn.connection_type,
        lane_class: conn.lane_class,
        access_mode: conn.access_mode,
        travel_time: conn.travel_time,
        sector_policy: worldPolicyService.summarizeSectorPolicy(adjacentSector),
        connection_policy: worldPolicyService.summarizeConnectionPolicy(conn, sector, adjacentSector)
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
        sector: serializeSector(sector),
        sector_policy: worldPolicyService.summarizeSectorPolicy(sector),
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
 *
 * Static data (sectors, connections, ports) is cached in-memory.
 * Dynamic data (ship counts, user ships, discoveries) is fetched per-request.
 * ETag support for conditional requests.
 */
const getMapData = async (req, res, next) => {
  try {
    // Load static map data from cache (sectors + connections + port presence)
    const staticData = await getStaticMapData();

    // ETag: based on sector count + cache generation time
    const etag = `"map-${staticData.sectorCount}-${staticData.generatedAt}"`;
    res.set('ETag', etag);
    res.set('Cache-Control', 'private, max-age=30');

    if (req.headers['if-none-match'] === etag) {
      return res.status(304).end();
    }

    // Get discovered sector IDs for the current user (if authenticated)
    let discoveredIds = null;
    if (req.userId) {
      discoveredIds = await getDiscoveredSectorIds(req.userId);
    }

    // Dynamic: aggregate ship counts per sector (1 lightweight query)
    const shipCounts = await Ship.findAll({
      where: { is_active: true },
      attributes: ['current_sector_id', [fn('COUNT', col('ship_id')), 'ship_count']],
      group: ['current_sector_id'],
      raw: true
    });
    const shipCountMap = new Map(shipCounts.map(r => [r.current_sector_id, parseInt(r.ship_count)]));

    // Dynamic: fetch current user's ships for map badges (1 query, ~10 rows)
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

    // Merge static + dynamic
    const systems = staticData.sectors.map(s => {
      const discovered = !discoveredIds || discoveredIds.has(s.sector_id);
      return {
        sector_id: s.sector_id,
        name: discovered ? s.name : null,
        x_coord: s.x_coord,
        y_coord: s.y_coord,
        type: discovered ? s.type : null,
        star_class: discovered ? s.star_class : null,
        hazard_level: discovered ? s.hazard_level : null,
        is_starting_sector: s.is_starting_sector,
        has_port: discovered ? s.has_port : null,
        ship_count: discovered ? (shipCountMap.get(s.sector_id) || 0) : null,
        phenomena: discovered ? s.phenomena : null,
        policy_summary: discovered ? worldPolicyService.summarizeSectorPolicy(s) : null,
        discovered,
        my_ships: discovered ? (userShipsBySector.get(s.sector_id) || []) : []
      };
    });

    // Only include hyperlanes where at least one end is discovered
    const hyperlanes = staticData.connections
      .filter(c => !discoveredIds || discoveredIds.has(c.from_id) || discoveredIds.has(c.to_id))
      .map(c => ({
        ...c,
        connection_policy: {
          lane_class: c.lane_class,
          access_mode: c.access_mode,
          rule_flags: c.rule_flags || {}
        }
      }));

    res.json({
      success: true,
      data: {
        systems,
        hyperlanes,
        galaxy_radius: config.universe.galaxyRadius,
        total_systems: staticData.sectorCount,
        discovered_systems: discoveredIds ? discoveredIds.size : staticData.sectorCount
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
      attributes: ['npc_id', 'name', 'npc_type', 'ship_type', 'aggression_level', 'hull_points', 'max_hull_points', 'behavior_state', 'faction']
    });

    // Get connected neighbors
    const connections = await SectorConnection.findAll({
      where: {
        [Op.or]: [
          { sector_a_id: sectorId },
          { sector_b_id: sectorId, is_bidirectional: true }
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
        lane_class: conn.lane_class,
        access_mode: conn.access_mode,
        travel_time: conn.travel_time,
        sector_policy: worldPolicyService.summarizeSectorPolicy(neighbor),
        connection_policy: worldPolicyService.summarizeConnectionPolicy(conn, sector, neighbor)
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
          description: sector.description,
          policy_summary: worldPolicyService.summarizeSectorPolicy(sector)
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
  getSystemDetail,
  clearMapCache
};
