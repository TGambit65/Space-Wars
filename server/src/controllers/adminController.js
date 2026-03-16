const config = require('../config');
const { Sector, SectorConnection, Planet, Port, NPC, Crew, Ship, ShipCargo, ShipComponent, CombatLog, Transaction: TxModel } = require('../models');
const universeGenerator = require('../services/universeGenerator');
const actionAuditService = require('../services/actionAuditService');

/**
 * POST /api/admin/universe/generate
 * Wipe and regenerate universe with given parameters.
 */
const generateUniverse = async (req, res, next) => {
  try {
    const { num_systems, seed, galaxy_shape } = req.body;

    // Validate inputs
    const systemCount = num_systems ? parseInt(num_systems) : undefined;
    if (systemCount !== undefined && (systemCount < 20 || systemCount > 1000)) {
      return res.status(400).json({
        success: false,
        message: 'num_systems must be between 20 and 1000'
      });
    }

    const validShapes = ['spiral', 'elliptical', 'ring'];
    if (galaxy_shape && !validShapes.includes(galaxy_shape)) {
      return res.status(400).json({
        success: false,
        message: `galaxy_shape must be one of: ${validShapes.join(', ')}`
      });
    }

    // Clear player data that references sectors
    await ShipCargo.destroy({ where: {} });
    await ShipComponent.destroy({ where: {} });
    await CombatLog.destroy({ where: {} });
    await TxModel.destroy({ where: {} });
    await Ship.destroy({ where: {} });

    console.log('Admin: Starting universe regeneration...');

    const result = await universeGenerator.generateFullUniverse({
      numSystems: systemCount,
      seed: seed ? parseInt(seed) : undefined,
      galaxyShape: galaxy_shape
    });

    res.json({
      success: true,
      message: 'Universe regenerated successfully',
      data: result
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/admin/universe/config
 * Return current universe settings and stats.
 */
const getUniverseConfig = async (req, res, next) => {
  try {
    const sectorCount = await Sector.count();
    const connectionCount = await SectorConnection.count();
    const planetCount = await Planet.count();
    const portCount = await Port.count();
    const npcCount = await NPC.count({ where: { is_alive: true } });
    const crewCount = await Crew.count();

    res.json({
      success: true,
      data: {
        config: {
          seed: config.universe.seed,
          initialSectors: config.universe.initialSectors,
          galaxyShape: config.universe.galaxyShape,
          galaxyRadius: config.universe.galaxyRadius
        },
        stats: {
          sectors: sectorCount,
          connections: connectionCount,
          planets: planetCount,
          ports: portCount,
          npcs: npcCount,
          crew: crewCount
        }
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/admin/action-audit
 * Return recent action audit logs for moderation and cheat review.
 */
const getActionAuditLogs = async (req, res, next) => {
  try {
    const logs = await actionAuditService.listRecent({
      userId: req.query.user_id || null,
      actionType: req.query.action_type || null,
      scopeType: req.query.scope_type || null,
      scopeId: req.query.scope_id || null,
      status: req.query.status || null,
      limit: req.query.limit || 50
    });

    res.json({
      success: true,
      data: {
        logs
      }
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  generateUniverse,
  getUniverseConfig,
  getActionAuditLogs
};
