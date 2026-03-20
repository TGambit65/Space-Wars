const tickService = require('../services/tickService');
const fs = require('fs');
const { RUNTIME_LOG_PATH } = require('../utils/runtimeMonitor');

/**
 * GET /api/admin/server/status
 * Server status: tick system + process info + socket connections.
 */
const getServerStatus = async (req, res, next) => {
  try {
    const tickStatus = tickService.getStatus();
    const mem = process.memoryUsage();

    res.json({
      success: true,
      data: {
        ticks: tickStatus,
        server: {
          uptime: process.uptime(),
          memory: {
            rss: Math.round(mem.rss / 1024 / 1024),
            heapUsed: Math.round(mem.heapUsed / 1024 / 1024),
            heapTotal: Math.round(mem.heapTotal / 1024 / 1024)
          },
          nodeVersion: process.version,
          pid: process.pid
        }
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/admin/server/runtime-log
 * Read recent runtime event log entries.
 * Query: ?limit=100
 */
const getRuntimeLog = async (req, res, next) => {
  try {
    const limit = Math.min(500, Math.max(1, parseInt(req.query.limit) || 100));
    let entries = [];

    if (fs.existsSync(RUNTIME_LOG_PATH)) {
      const content = fs.readFileSync(RUNTIME_LOG_PATH, 'utf8');
      const lines = content.trim().split('\n').filter(Boolean);
      // Take last N entries
      const recentLines = lines.slice(-limit);
      entries = recentLines.map(line => {
        try { return JSON.parse(line); } catch { return { raw: line }; }
      }).reverse();
    }

    res.json({ success: true, data: { entries } });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/admin/server/ticks/start
 * Start the tick system.
 */
const startTicks = async (req, res, next) => {
  try {
    if (tickService.isRunning()) {
      return res.status(400).json({ success: false, message: 'Ticks are already running' });
    }
    tickService.startTicks();
    res.json({ success: true, message: 'Tick system started' });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/admin/server/ticks/stop
 * Stop the tick system.
 */
const stopTicks = async (req, res, next) => {
  try {
    if (!tickService.isRunning()) {
      return res.status(400).json({ success: false, message: 'Ticks are not running' });
    }
    tickService.stopTicks();
    res.json({ success: true, message: 'Tick system stopped' });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getServerStatus,
  getRuntimeLog,
  startTicks,
  stopTicks
};
