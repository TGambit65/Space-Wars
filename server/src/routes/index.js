const express = require('express');
const authRoutes = require('./auth');
const shipRoutes = require('./ship');
const sectorRoutes = require('./sector');
const portRoutes = require('./port');
const tradeRoutes = require('./trade');
// Phase 3: Ship Designer & Combat
const shipDesignerRoutes = require('./shipDesignerRoutes');
const combatRoutes = require('./combatRoutes');
const npcRoutes = require('./npcRoutes');
const { sequelize } = require('../config/database');
const config = require('../config');

const router = express.Router();

// Health check with DB connectivity verification
router.get('/health', async (req, res) => {
  const health = {
    success: true,
    message: 'Space Wars 3000 API is running',
    timestamp: new Date().toISOString(),
    checks: {
      server: 'ok',
      database: 'unknown'
    }
  };

  // Only include uptime in development (could be useful for attackers in prod)
  if (!config.isProduction) {
    health.uptime = process.uptime();
    health.environment = config.nodeEnv;
  }

  try {
    // Verify database connection
    await sequelize.authenticate();
    health.checks.database = 'ok';
  } catch (error) {
    health.checks.database = 'error';
    health.success = false;
    health.message = 'Service unavailable';
  }

  const statusCode = health.success ? 200 : 503;
  res.status(statusCode).json(health);
});

// Mount routes
router.use('/auth', authRoutes);
router.use('/ships', shipRoutes);
router.use('/sectors', sectorRoutes);
router.use('/ports', portRoutes);
router.use('/trade', tradeRoutes);
// Phase 3: Ship Designer & Combat
router.use('/designer', shipDesignerRoutes);
router.use('/combat', combatRoutes);
router.use('/npcs', npcRoutes);

module.exports = router;

