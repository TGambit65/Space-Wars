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
// Phase 4: Planets, Colonization & Crew
const planetRoutes = require('./planetRoutes');
const colonyRoutes = require('./colonyRoutes');
const crewRoutes = require('./crewRoutes');
// AI NPC Dialogue
const dialogueRoutes = require('./dialogueRoutes');
// Phase 5: Advanced Features
const marketRoutes = require('./marketRoutes');
const progressionRoutes = require('./progressionRoutes');
const artifactRoutes = require('./artifactRoutes');
const wonderRoutes = require('./wonderRoutes');
const craftingRoutes = require('./craftingRoutes');
const missionRoutes = require('./missionRoutes');
const corporationRoutes = require('./corporationRoutes');
const automationRoutes = require('./automationRoutes');
// Phase C: Colony Buildings
const colonyBuildingRoutes = require('./colonyBuildingRoutes');
// Factions & Warfare
const factionRoutes = require('./factionRoutes');
// Messaging
const messagingRoutes = require('./messagingRoutes');
// Phase 7: Agreements, Events, Outposts, Templates, Cosmetics
const agreementRoutes = require('./agreementRoutes');
const eventRoutes = require('./eventRoutes');
const outpostRoutes = require('./outpostRoutes');
const shipTemplateRoutes = require('./shipTemplateRoutes');
const cosmeticRoutes = require('./cosmeticRoutes');
// Ground Combat
const groundCombatRoutes = require('./groundCombatRoutes');
// Fleet System
const fleetRoutes = require('./fleet');
// AI Agent System
const agentRoutes = require('./agentRoutes');
const agentGameRoutes = require('./agentGameRoutes');
// Achievements
const achievementRoutes = require('./achievementRoutes');
// Admin
const adminRoutes = require('./adminRoutes');
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
// Phase 4: Planets, Colonization & Crew
router.use('/planets', planetRoutes);
router.use('/colonies', colonyRoutes);
router.use('/crew', crewRoutes);
// AI NPC Dialogue
router.use('/dialogue', dialogueRoutes);
// Phase 5: Advanced Features
router.use('/market', marketRoutes);
router.use('/progression', progressionRoutes);
router.use('/artifacts', artifactRoutes);
router.use('/wonders', wonderRoutes);
router.use('/crafting', craftingRoutes);
router.use('/missions', missionRoutes);
router.use('/corporations', corporationRoutes);
router.use('/automation', automationRoutes);
// Phase C: Colony Buildings
router.use('/buildings', colonyBuildingRoutes);
// Factions & Warfare
router.use('/factions', factionRoutes);
// Messaging
router.use('/messages', messagingRoutes);
// Phase 7
router.use('/corporations/agreements', agreementRoutes);
router.use('/events', eventRoutes);
router.use('/outposts', outpostRoutes);
router.use('/templates', shipTemplateRoutes);
router.use('/cosmetics', cosmeticRoutes);
// Ground Combat
router.use('/ground-combat', groundCombatRoutes);
// Fleet System
router.use('/fleets', fleetRoutes);
// AI Agent System
router.use('/agents', agentRoutes);
router.use('/agent-api', agentGameRoutes);
// Achievements
router.use('/achievements', achievementRoutes);
// Admin
router.use('/admin', adminRoutes);

module.exports = router;

