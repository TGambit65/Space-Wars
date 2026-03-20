require('dotenv').config();

const path = require('path');
const { SpaceWarsApi } = require('./api');
const { TradingAgent } = require('./agent');
const { Logger } = require('./logger');
const { AgentState } = require('./state');
const { Navigator } = require('./strategy/navigator');
const { Trader } = require('./strategy/trader');
const { parseArgs, printHelp, toBoolean, toNumber } = require('./util');

function buildConfig(args) {
  const apiUrl = args.apiUrl || process.env.SPACEWARS_API_URL || 'http://localhost:5080/api';
  const agentKey = args.agentKey || process.env.SPACEWARS_AGENT_KEY;
  const logLevel = args.verbose ? 'debug' : (process.env.SPACEWARS_LOG_LEVEL || 'info');
  const logFile = args.logFile || process.env.SPACEWARS_LOG_FILE || null;

  return {
    apiUrl,
    agentKey,
    logLevel,
    logFile,
    minRequestIntervalMs: args.minRequestIntervalMs !== undefined
      ? args.minRequestIntervalMs
      : toNumber(process.env.SPACEWARS_MIN_REQUEST_INTERVAL_MS, 2500),
    loopDelayMs: args.loopDelayMs !== undefined
      ? args.loopDelayMs
      : toNumber(process.env.SPACEWARS_LOOP_DELAY_MS, 3000),
    refuelThreshold: args.refuelThreshold !== undefined
      ? args.refuelThreshold
      : Number(process.env.SPACEWARS_REFUEL_THRESHOLD || 0.25),
    stopBudgetBuffer: args.stopBudgetBuffer !== undefined
      ? args.stopBudgetBuffer
      : toNumber(process.env.SPACEWARS_STOP_BUDGET_BUFFER, 100),
    maxCycles: args.maxCycles !== undefined
      ? args.maxCycles
      : (process.env.SPACEWARS_MAX_CYCLES ? toNumber(process.env.SPACEWARS_MAX_CYCLES, null) : null),
    dryRun: args.dryRun || toBoolean(process.env.SPACEWARS_DRY_RUN, false),
    once: args.once,
  };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));

  if (args.help) {
    printHelp();
    process.exit(0);
  }

  const config = buildConfig(args);
  const logger = new Logger({
    level: config.logLevel,
    filePath: config.logFile ? path.resolve(config.logFile) : null,
  });

  if (!config.agentKey) {
    logger.error('Missing SPACEWARS_AGENT_KEY. Copy .env.example to .env and add your sw3k_agent_* key.');
    process.exit(1);
  }

  if (args.unknown && args.unknown.length > 0) {
    logger.warn('Unknown CLI arguments were ignored.', { unknown: args.unknown });
  }

  const api = new SpaceWarsApi({
    baseUrl: config.apiUrl,
    agentKey: config.agentKey,
    logger,
    minRequestIntervalMs: config.minRequestIntervalMs,
  });

  const state = new AgentState();
  const navigator = new Navigator(logger);
  const trader = new Trader({ navigator, logger });
  const agent = new TradingAgent({
    api,
    logger,
    state,
    navigator,
    trader,
    options: {
      dryRun: config.dryRun,
      once: config.once,
      loopDelayMs: config.loopDelayMs,
      refuelThreshold: config.refuelThreshold,
      stopBudgetBuffer: config.stopBudgetBuffer,
      maxCycles: config.maxCycles,
    },
  });

  process.on('SIGINT', () => {
    logger.warn('Received SIGINT; requesting graceful shutdown.');
    state.requestStop('Interrupted by SIGINT');
  });

  process.on('SIGTERM', () => {
    logger.warn('Received SIGTERM; requesting graceful shutdown.');
    state.requestStop('Interrupted by SIGTERM');
  });

  try {
    await agent.run();
    process.exit(0);
  } catch (error) {
    logger.error('Unhandled fatal error', {
      name: error.name,
      message: error.message,
      stack: error.stack,
    });
    process.exit(1);
  }
}

main();
