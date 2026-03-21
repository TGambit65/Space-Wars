require('dotenv').config();
const http = require('http');
const net = require('net');
const app = require('./app');
const config = require('./config');
const { connectDatabase, syncDatabase, sequelize } = require('./config/database');
const { generateUniverse, generateFullUniverse, seedCommodities } = require('./services/universeGenerator');
const gameSettingsService = require('./services/gameSettingsService');
const socketService = require('./services/socketService');
const { ensureSprintWorldSchema } = require('./services/schemaPatchService');
const tickService = require('./services/tickService');
const achievementService = require('./services/achievementService');
const { Sector, Commodity, Port } = require('./models');
const { recordRuntimeEvent, normalizeError, RUNTIME_LOG_PATH } = require('./utils/runtimeMonitor');

let server = null;
let isShuttingDown = false;
let shutdownTimer = null;
let activePort = Number(config.port);
const runtimeFaultTimestamps = [];
const MAX_DEVELOPMENT_RUNTIME_FAULTS = 3;
const RUNTIME_FAULT_WINDOW_MS = 60 * 1000;
const MAX_PORT_PROBE_ATTEMPTS = 10;

const pruneRuntimeFaults = (now = Date.now()) => {
  while (runtimeFaultTimestamps.length > 0 && now - runtimeFaultTimestamps[0] > RUNTIME_FAULT_WINDOW_MS) {
    runtimeFaultTimestamps.shift();
  }
};

const shouldExitForRuntimeFault = () => {
  if (config.nodeEnv === 'production' || config.nodeEnv === 'test') {
    return true;
  }

  pruneRuntimeFaults();
  return runtimeFaultTimestamps.length >= MAX_DEVELOPMENT_RUNTIME_FAULTS;
};

const noteRuntimeFault = (source, errorLike) => {
  const error = normalizeError(errorLike);
  const now = Date.now();
  runtimeFaultTimestamps.push(now);
  pruneRuntimeFaults(now);

  recordRuntimeEvent('runtime_fault', {
    source,
    environment: config.nodeEnv,
    faultCountInWindow: runtimeFaultTimestamps.length,
    error
  });

  console.error(`[RuntimeFault:${source}]`, error.message);
  if (error.stack) {
    console.error(error.stack);
  }
};

const probePortAvailability = (port) => new Promise((resolve, reject) => {
  const probe = net.createServer();

  probe.once('error', (error) => {
    if (error.code === 'EADDRINUSE') {
      resolve(false);
      return;
    }
    reject(error);
  });

  probe.once('listening', () => {
    probe.close((closeError) => {
      if (closeError) {
        reject(closeError);
        return;
      }
      resolve(true);
    });
  });

  probe.listen(port, '0.0.0.0');
});

const resolveStartupPort = async () => {
  const desiredPort = Number(config.port);
  const maxAttempts = config.nodeEnv === 'development' ? MAX_PORT_PROBE_ATTEMPTS : 1;

  for (let offset = 0; offset < maxAttempts; offset += 1) {
    const candidatePort = desiredPort + offset;
    const isAvailable = await probePortAvailability(candidatePort);

    if (!isAvailable) {
      continue;
    }

    if (offset > 0) {
      recordRuntimeEvent('port_fallback', {
        desiredPort,
        selectedPort: candidatePort,
        environment: config.nodeEnv
      });
      console.warn(
        `[Startup] Port ${desiredPort} is busy. Using ${candidatePort} instead.`
      );
    }

    return candidatePort;
  }

  const error = new Error(
    `No available port found in range ${desiredPort}-${desiredPort + maxAttempts - 1}`
  );
  error.code = 'NO_AVAILABLE_PORT';
  throw error;
};

const startServer = async () => {
  try {
    activePort = await resolveStartupPort();

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

    await ensureSprintWorldSchema();

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

    // Seed achievement catalog
    await achievementService.seedAchievements();

    // Load game settings from database
    await gameSettingsService.loadAllSettings();

    // Create HTTP server and initialize Socket.io
    const httpServer = http.createServer(app);
    httpServer.on('error', (error) => {
      noteRuntimeFault('http_server', error);
      if (!isShuttingDown) {
        gracefulShutdown('HTTP_SERVER_ERROR');
      }
    });
    socketService.initialize(httpServer);

    // Start server
    server = httpServer.listen(activePort, () => {
      recordRuntimeEvent('server_started', {
        port: activePort,
        environment: config.nodeEnv
      });
      console.log('═'.repeat(50));
      console.log(`  Space Wars 3000 Server`);
      console.log(`  Running on port ${activePort}`);
      console.log(`  Environment: ${config.nodeEnv}`);
      console.log(`  API: http://localhost:${activePort}/api`);
      console.log(`  WebSocket: enabled`);
      console.log('═'.repeat(50));

      // Start game tick system after server is listening (sockets available)
      tickService.startTicks(socketService);
    });
  } catch (error) {
    recordRuntimeEvent('server_start_failed', {
      environment: config.nodeEnv,
      error: normalizeError(error)
    });
    console.error('Failed to start server:', error);
    process.exit(1);
  }
};

// Graceful shutdown handler
const gracefulShutdown = async (signal) => {
  if (isShuttingDown) {
    console.warn(`[Shutdown] ${signal} received while shutdown is already in progress`);
    return;
  }

  isShuttingDown = true;
  recordRuntimeEvent('shutdown_started', { signal });
  console.log(`\n${signal} received. Shutting down gracefully...`);

  if (server) {
    // Stop game ticks before closing connections
    tickService.stopTicks();

    // Close Socket.io to disconnect all clients gracefully
    const io = socketService.getIO();
    if (io) io.close();

    server.close(async () => {
      console.log('HTTP server closed');

      try {
        await sequelize.close();
        console.log('Database connection closed');
        recordRuntimeEvent('shutdown_completed', { signal, status: 'success' });
        if (shutdownTimer) {
          clearTimeout(shutdownTimer);
          shutdownTimer = null;
        }
        process.exit(0);
      } catch (error) {
        console.error('Error closing database connection:', error);
        recordRuntimeEvent('shutdown_completed', {
          signal,
          status: 'database_close_failed',
          error: normalizeError(error)
        });
        if (shutdownTimer) {
          clearTimeout(shutdownTimer);
          shutdownTimer = null;
        }
        process.exit(1);
      }
    });

    // Force shutdown after 10 seconds if graceful shutdown fails
    shutdownTimer = setTimeout(() => {
      console.error('Forced shutdown due to timeout');
      recordRuntimeEvent('shutdown_timeout', { signal });
      process.exit(1);
    }, 10000);
    shutdownTimer.unref?.();
  } else {
    recordRuntimeEvent('shutdown_completed', { signal, status: 'no_server' });
    process.exit(0);
  }
};

const handleRuntimeFault = (source, errorLike) => {
  noteRuntimeFault(source, errorLike);

  if (shouldExitForRuntimeFault()) {
    console.error(`[RuntimeFault:${source}] Threshold reached. Initiating shutdown. Log: ${RUNTIME_LOG_PATH}`);
    gracefulShutdown(source.toUpperCase());
    return;
  }

  console.warn(
    `[RuntimeFault:${source}] Continuing in ${config.nodeEnv} mode ` +
    `(${runtimeFaultTimestamps.length}/${MAX_DEVELOPMENT_RUNTIME_FAULTS} faults within ${RUNTIME_FAULT_WINDOW_MS / 1000}s before shutdown). ` +
    `Log: ${RUNTIME_LOG_PATH}`
  );
};

// Handle shutdown signals
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  handleRuntimeFault('uncaught_exception', error);
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  handleRuntimeFault('unhandled_rejection', reason);
});

startServer();
