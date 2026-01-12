require('dotenv').config();
const app = require('./app');
const config = require('./config');
const { connectDatabase, syncDatabase, sequelize } = require('./config/database');
const { generateUniverse, generateFullUniverse, seedCommodities } = require('./services/universeGenerator');
const { Sector, Commodity, Port } = require('./models');

let server = null;

const startServer = async () => {
  try {
    // Connect to database
    await connectDatabase();

    // Check if database has tables already
    let sectorCount = await Sector.count().catch(() => -1);
    const isNewDb = sectorCount === -1;

    // Sync database - use force:true only for new databases
    if (isNewDb) {
      console.log('Initializing new database...');
      await syncDatabase({ force: true });
      sectorCount = 0;  // After force sync, no sectors exist
    } else {
      await syncDatabase({ alter: false });  // Don't alter existing tables
    }

    // Check if universe needs to be generated
    if (sectorCount === 0) {
      console.log('No sectors found. Generating full universe with economy...');
      await generateFullUniverse();
    } else {
      console.log(`✓ Universe already exists with ${sectorCount} sectors`);

      // Check if commodities and ports exist (for upgraded databases from Phase 1)
      const commodityCount = await Commodity.count().catch(() => 0);
      const portCount = await Port.count().catch(() => 0);

      if (commodityCount === 0) {
        console.log('Economy data missing. Seeding commodities and ports...');
        // Re-run full generation to add economy to existing universe
        await generateFullUniverse();
      } else {
        console.log(`✓ Economy exists with ${commodityCount} commodities and ${portCount} ports`);
      }
    }

    // Start server
    server = app.listen(config.port, () => {
      console.log('═'.repeat(50));
      console.log(`  🚀 Space Wars 3000 Server`);
      console.log(`  ✓ Running on port ${config.port}`);
      console.log(`  ✓ Environment: ${config.nodeEnv}`);
      console.log(`  ✓ API: http://localhost:${config.port}/api`);
      console.log('═'.repeat(50));
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
};

// Graceful shutdown handler
const gracefulShutdown = async (signal) => {
  console.log(`\n${signal} received. Shutting down gracefully...`);

  if (server) {
    server.close(async () => {
      console.log('✓ HTTP server closed');

      try {
        await sequelize.close();
        console.log('✓ Database connection closed');
        process.exit(0);
      } catch (error) {
        console.error('Error closing database connection:', error);
        process.exit(1);
      }
    });

    // Force shutdown after 10 seconds if graceful shutdown fails
    setTimeout(() => {
      console.error('Forced shutdown due to timeout');
      process.exit(1);
    }, 10000);
  } else {
    process.exit(0);
  }
};

// Handle shutdown signals
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
  gracefulShutdown('UNCAUGHT_EXCEPTION');
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  // Don't exit immediately - log and continue, but consider it a warning
});

startServer();

