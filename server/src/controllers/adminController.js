const config = require('../config');
const { Sector, SectorConnection, Planet, Port, NPC, Crew, Ship, ShipCargo, ShipComponent, CombatLog, Transaction: TxModel, User, Colony, Fleet, ActionAuditLog } = require('../models');
const { Op, fn, col } = require('sequelize');
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
 * Return paginated action audit logs with filters.
 * Query: ?page=1&limit=50&user_id=&action_type=&scope_type=&status=
 */
const getActionAuditLogs = async (req, res, next) => {
  try {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(200, Math.max(1, parseInt(req.query.limit) || 50));
    const offset = (page - 1) * limit;

    const where = {};
    if (req.query.user_id) where.user_id = req.query.user_id;
    if (req.query.action_type) where.action_type = req.query.action_type;
    if (req.query.scope_type) where.scope_type = req.query.scope_type;
    if (req.query.status) where.status = req.query.status;

    const { count, rows } = await ActionAuditLog.findAndCountAll({
      where,
      order: [['created_at', 'DESC']],
      limit,
      offset
    });

    res.json({
      success: true,
      data: {
        logs: rows,
        total: count,
        page,
        pages: Math.ceil(count / limit)
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/admin/audit/summary
 * Summary counts for last 24 hours.
 */
const getAuditSummary = async (req, res, next) => {
  try {
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const baseWhere = { created_at: { [Op.gte]: oneDayAgo } };

    const [denials, throttles, errors, total] = await Promise.all([
      ActionAuditLog.count({ where: { ...baseWhere, status: 'deny' } }),
      ActionAuditLog.count({ where: { ...baseWhere, status: 'throttle' } }),
      ActionAuditLog.count({ where: { ...baseWhere, status: 'error' } }),
      ActionAuditLog.count({ where: baseWhere })
    ]);

    res.json({
      success: true,
      data: { denials, throttles, errors, total }
    });
  } catch (error) {
    next(error);
  }
};

// ─── Player Support ─────────────────────────────────────────────

/**
 * GET /api/admin/users/:id/detail
 * Full player detail: user + ships + colonies + fleets.
 */
const getUserDetail = async (req, res, next) => {
  try {
    const user = await User.findByPk(req.params.id, {
      attributes: { exclude: ['password_hash'] }
    });
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    const [ships, colonies, fleets, recentAudit] = await Promise.all([
      Ship.findAll({ where: { owner_user_id: req.params.id } }),
      Colony.findAll({ where: { owner_user_id: req.params.id } }),
      Fleet.findAll({ where: { owner_user_id: req.params.id } }),
      ActionAuditLog.findAll({
        where: { user_id: req.params.id },
        order: [['created_at', 'DESC']],
        limit: 20
      })
    ]);

    res.json({
      success: true,
      data: { user, ships, colonies, fleets, recentAudit }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/admin/users/:id/credits
 * Adjust player credits.
 * Body: { amount, reason }
 */
const adjustCredits = async (req, res, next) => {
  try {
    const { amount, reason } = req.body;
    if (amount === undefined || amount === 0) {
      return res.status(400).json({ success: false, message: 'Amount is required and cannot be 0' });
    }

    const user = await User.findByPk(req.params.id);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    const before = user.credits || 0;
    const newCredits = Math.max(0, before + amount);
    await user.update({ credits: newCredits });

    await actionAuditService.record({
      userId: req.userId,
      actionType: 'admin_adjust_credits',
      scopeType: 'user',
      scopeId: req.params.id,
      status: 'allow',
      reason: reason || 'Admin credit adjustment',
      metadata: { target_user: user.username, amount, before, after: newCredits }
    });

    res.json({ success: true, data: { before, after: newCredits, username: user.username } });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/admin/users/:id/revive-ship
 * Revive a destroyed ship.
 * Body: { ship_id }
 */
const reviveShip = async (req, res, next) => {
  try {
    const { ship_id } = req.body;
    if (!ship_id) {
      return res.status(400).json({ success: false, message: 'ship_id is required' });
    }

    const ship = await Ship.findOne({ where: { ship_id, owner_user_id: req.params.id } });
    if (!ship) {
      return res.status(404).json({ success: false, message: 'Ship not found for this user' });
    }

    const before = { hull_points: ship.hull_points, shield_points: ship.shield_points, is_active: ship.is_active };
    await ship.update({
      hull_points: ship.max_hull_points,
      shield_points: ship.max_shield_points,
      is_active: true
    });

    await actionAuditService.record({
      userId: req.userId,
      actionType: 'admin_revive_ship',
      scopeType: 'ship',
      scopeId: ship_id,
      status: 'allow',
      reason: 'Admin ship revive',
      metadata: { target_user_id: req.params.id, ship_name: ship.name, before }
    });

    res.json({ success: true, message: `Ship ${ship.name} revived`, data: { ship } });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/admin/users/:id/repair-ship
 * Full repair a ship.
 * Body: { ship_id }
 */
const repairShip = async (req, res, next) => {
  try {
    const { ship_id } = req.body;
    if (!ship_id) {
      return res.status(400).json({ success: false, message: 'ship_id is required' });
    }

    const ship = await Ship.findOne({ where: { ship_id, owner_user_id: req.params.id } });
    if (!ship) {
      return res.status(404).json({ success: false, message: 'Ship not found for this user' });
    }

    const before = { hull_points: ship.hull_points, shield_points: ship.shield_points };
    await ship.update({
      hull_points: ship.max_hull_points,
      shield_points: ship.max_shield_points
    });

    await actionAuditService.record({
      userId: req.userId,
      actionType: 'admin_repair_ship',
      scopeType: 'ship',
      scopeId: ship_id,
      status: 'allow',
      reason: 'Admin ship repair',
      metadata: { target_user_id: req.params.id, ship_name: ship.name, before }
    });

    res.json({ success: true, message: `Ship ${ship.name} repaired`, data: { ship } });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/admin/users/:id/move-ship
 * Move a ship to a sector.
 * Body: { ship_id, sector_id }
 */
const moveShip = async (req, res, next) => {
  try {
    const { ship_id, sector_id } = req.body;
    if (!ship_id || !sector_id) {
      return res.status(400).json({ success: false, message: 'ship_id and sector_id are required' });
    }

    const ship = await Ship.findOne({ where: { ship_id, owner_user_id: req.params.id } });
    if (!ship) {
      return res.status(404).json({ success: false, message: 'Ship not found for this user' });
    }

    const sector = await Sector.findByPk(sector_id);
    if (!sector) {
      return res.status(404).json({ success: false, message: 'Sector not found' });
    }

    const before = { sector_id: ship.current_sector_id };
    await ship.update({ current_sector_id: sector_id });

    await actionAuditService.record({
      userId: req.userId,
      actionType: 'admin_move_ship',
      scopeType: 'ship',
      scopeId: ship_id,
      status: 'allow',
      reason: 'Admin ship teleport',
      metadata: { target_user_id: req.params.id, ship_name: ship.name, before, after: { sector_id } }
    });

    res.json({ success: true, message: `Ship ${ship.name} moved to sector ${sector.name}`, data: { ship } });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/admin/users/:id/set-active-ship
 * Force a ship to be the active ship.
 * Body: { ship_id }
 */
const setActiveShip = async (req, res, next) => {
  try {
    const { ship_id } = req.body;
    if (!ship_id) {
      return res.status(400).json({ success: false, message: 'ship_id is required' });
    }

    const ship = await Ship.findOne({ where: { ship_id, owner_user_id: req.params.id } });
    if (!ship) {
      return res.status(404).json({ success: false, message: 'Ship not found for this user' });
    }

    // Deactivate all other ships
    await Ship.update(
      { is_active: false },
      { where: { owner_user_id: req.params.id, ship_id: { [Op.ne]: ship_id } } }
    );
    await ship.update({ is_active: true });

    await actionAuditService.record({
      userId: req.userId,
      actionType: 'admin_set_active_ship',
      scopeType: 'ship',
      scopeId: ship_id,
      status: 'allow',
      reason: 'Admin set active ship',
      metadata: { target_user_id: req.params.id, ship_name: ship.name }
    });

    res.json({ success: true, message: `Ship ${ship.name} set as active`, data: { ship } });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  generateUniverse,
  getUniverseConfig,
  getActionAuditLogs,
  getAuditSummary,
  getUserDetail,
  adjustCredits,
  reviveShip,
  repairShip,
  moveShip,
  setActiveShip
};
