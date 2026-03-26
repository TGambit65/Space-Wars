const gameSettingsService = require('../services/gameSettingsService');
const aiProviderFactory = require('../services/ai/aiProviderFactory');
const npcActionExecutor = require('../services/npcActionExecutor');
const npcService = require('../services/npcService');
const dialogueCacheService = require('../services/dialogueCacheService');
const tickService = require('../services/tickService');
const { NPC, User } = require('../models');
const { fn, col, Op } = require('sequelize');

// ─── Settings ────────────────────────────────────────────────────

/**
 * GET /api/admin/settings
 * Returns all settings with secret values masked.
 */
const getSettings = async (req, res, next) => {
  try {
    const settings = gameSettingsService.getPublicSettings();
    res.json({ success: true, data: settings });
  } catch (err) {
    next(err);
  }
};

/**
 * PUT /api/admin/settings
 * Bulk update settings.
 * Body: { settings: { 'key': value, ... } }
 */
const updateSettings = async (req, res, next) => {
  try {
    const { settings } = req.body;
    if (!settings || typeof settings !== 'object') {
      return res.status(400).json({ success: false, message: 'Missing settings object' });
    }

    // Only allow updates to keys that already exist in the database/cache
    const existingKeys = await gameSettingsService.getAllSettings();
    const unknownKeys = Object.keys(settings).filter(k => !(k in existingKeys));
    if (unknownKeys.length > 0) {
      return res.status(400).json({
        success: false,
        message: `Unknown setting keys: ${unknownKeys.join(', ')}`
      });
    }

    await gameSettingsService.setSettings(settings);
    res.json({ success: true, message: 'Settings updated' });
  } catch (err) {
    next(err);
  }
};

// ─── AI ──────────────────────────────────────────────────────────

/**
 * POST /api/admin/ai/test
 * Test an AI provider connection.
 * Body: { provider_type, purpose, config: { api_key?, model?, base_url? } }
 */
const testAIConnection = async (req, res, next) => {
  try {
    const { provider_type, purpose, config } = req.body;
    if (!provider_type || !purpose) {
      return res.status(400).json({ success: false, message: 'Missing provider_type or purpose' });
    }

    const result = await aiProviderFactory.testConnection(provider_type, purpose, config || {});
    res.json({ success: true, data: result });
  } catch (err) {
    // Return connection errors as data, not 500
    res.json({
      success: true,
      data: { connected: false, message: err.message, latency_ms: 0 }
    });
  }
};

/**
 * GET /api/admin/ai/stats
 * Returns AI usage statistics and cache stats.
 */
const getAIStats = async (req, res, next) => {
  try {
    const cacheStats = dialogueCacheService.getStats();
    const tickStatus = tickService.getStatus();

    res.json({
      success: true,
      data: {
        tick: {
          tacticalTicks: tickStatus.tacticalTicks,
          combatTicks: tickStatus.combatTicks,
          avgTacticalMs: tickStatus.avgTacticalMs,
          activeNPCCount: tickStatus.activeNPCCount
        },
        cache: cacheStats
      }
    });
  } catch (err) {
    next(err);
  }
};

/**
 * GET /api/admin/ai/logs
 * Returns paginated AI decision log.
 * Query: ?page=1&limit=50
 */
const getAIDecisionLogs = async (req, res, next) => {
  try {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 50));
    const offset = (page - 1) * limit;

    const { entries, total } = npcActionExecutor.getDecisionLog(limit, offset);
    res.json({
      success: true,
      data: {
        logs: entries,
        total,
        page,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (err) {
    next(err);
  }
};

// ─── NPC Management ──────────────────────────────────────────────

/**
 * GET /api/admin/npcs/stats
 * Returns NPC population stats by type and behavior state.
 */
const getNPCPopulation = async (req, res, next) => {
  try {
    // Count by type and alive status
    const byType = await NPC.findAll({
      attributes: [
        'npc_type',
        'is_alive',
        [fn('COUNT', col('npc_id')), 'count'],
        [fn('AVG', col('hull_points')), 'avg_hull'],
        [fn('AVG', col('max_hull_points')), 'avg_max_hull']
      ],
      group: ['npc_type', 'is_alive'],
      raw: true
    });

    // Count by behavior state (alive only)
    const byState = await NPC.findAll({
      attributes: [
        'behavior_state',
        [fn('COUNT', col('npc_id')), 'count']
      ],
      where: { is_alive: true },
      group: ['behavior_state'],
      raw: true
    });

    // Totals
    const totalAlive = await NPC.count({ where: { is_alive: true } });
    const totalDead = await NPC.count({ where: { is_alive: false } });

    // Average intelligence tier
    const avgIntelligence = await NPC.findOne({
      attributes: [[fn('AVG', col('intelligence_tier')), 'avg_tier']],
      where: { is_alive: true },
      raw: true
    });

    res.json({
      success: true,
      data: {
        by_type: byType,
        by_state: byState,
        totals: {
          alive: totalAlive,
          dead: totalDead,
          total: totalAlive + totalDead,
          avg_intelligence_tier: avgIntelligence ? Math.round((avgIntelligence.avg_tier || 1) * 10) / 10 : 1
        }
      }
    });
  } catch (err) {
    next(err);
  }
};

/**
 * POST /api/admin/npcs/respawn
 * Force respawn all dead NPCs (override respawn timer).
 */
const forceRespawn = async (req, res, next) => {
  try {
    // Force all dead NPCs to be respawn-eligible
    await NPC.update(
      { respawn_at: new Date(0) },
      { where: { is_alive: false } }
    );

    // Now respawn them
    const count = await npcService.respawnNPCs();
    res.json({ success: true, data: { respawned_count: count } });
  } catch (err) {
    next(err);
  }
};

// ─── Tick System ─────────────────────────────────────────────────

/**
 * GET /api/admin/ticks/status
 * Returns tick system status.
 */
const getTickStatus = async (req, res, next) => {
  try {
    const status = tickService.getStatus();
    res.json({ success: true, data: status });
  } catch (err) {
    next(err);
  }
};

// ─── User Management ─────────────────────────────────────────────

/**
 * GET /api/admin/users
 * Returns paginated user list.
 * Query: ?page=1&limit=25&search=&tier=
 */
const getUserList = async (req, res, next) => {
  try {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 25));
    const offset = (page - 1) * limit;
    const { search, tier } = req.query;

    const where = {};
    if (search) {
      const sanitized = String(search).replace(/[%_\\]/g, '\\$&');
      where[Op.or] = [
        { username: { [Op.like]: `%${sanitized}%` } },
        { email: { [Op.like]: `%${sanitized}%` } }
      ];
    }
    if (tier && ['free', 'premium', 'elite'].includes(tier)) {
      where.subscription_tier = tier;
    }

    const { count, rows } = await User.findAndCountAll({
      where,
      attributes: ['user_id', 'username', 'email', 'subscription_tier', 'is_admin', 'created_at', 'last_login'],
      order: [['created_at', 'DESC']],
      limit,
      offset
    });

    res.json({
      success: true,
      data: {
        users: rows,
        total: count,
        page,
        pages: Math.ceil(count / limit)
      }
    });
  } catch (err) {
    next(err);
  }
};

/**
 * PUT /api/admin/users/tier
 * Update a user's subscription tier.
 * Body: { user_id, subscription_tier }
 */
const updateUserTier = async (req, res, next) => {
  try {
    const { user_id, subscription_tier } = req.body;
    if (!user_id || !subscription_tier) {
      return res.status(400).json({ success: false, message: 'Missing user_id or subscription_tier' });
    }

    const validTiers = ['free', 'premium', 'elite'];
    if (!validTiers.includes(subscription_tier)) {
      return res.status(400).json({ success: false, message: `Invalid tier. Must be: ${validTiers.join(', ')}` });
    }

    const user = await User.findByPk(user_id);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    await user.update({ subscription_tier });
    res.json({ success: true, message: `User ${user.username} tier updated to ${subscription_tier}` });
  } catch (err) {
    next(err);
  }
};

module.exports = {
  getSettings,
  updateSettings,
  testAIConnection,
  getAIStats,
  getAIDecisionLogs,
  getNPCPopulation,
  forceRespawn,
  getTickStatus,
  getUserList,
  updateUserTier
};
