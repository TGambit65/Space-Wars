const fs = require('fs');
const path = require('path');

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function toNumber(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function toBoolean(value, fallback = false) {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    if (['true', '1', 'yes', 'y', 'on'].includes(normalized)) return true;
    if (['false', '0', 'no', 'n', 'off'].includes(normalized)) return false;
  }
  if (typeof value === 'number') return value !== 0;
  return fallback;
}

function ensureDir(filePath) {
  const directory = path.extname(filePath) ? path.dirname(filePath) : filePath;
  fs.mkdirSync(directory, { recursive: true });
}

function formatCredits(value) {
  const amount = toNumber(value, 0);
  return `${amount.toLocaleString('en-US')} cr`;
}

function formatPercent(value, fractionDigits = 1) {
  const amount = toNumber(value, 0) * 100;
  return `${amount.toFixed(fractionDigits)}%`;
}

function safeJson(value) {
  try {
    return JSON.stringify(value);
  } catch (_error) {
    return '[unserializable]';
  }
}

function parseArgs(argv) {
  const args = {
    once: false,
    dryRun: false,
    verbose: false,
    help: false,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (!token.startsWith('--')) continue;

    const [key, rawInlineValue] = token.includes('=') ? token.split(/=(.*)/s, 2) : [token, undefined];
    const nextValue = rawInlineValue === undefined ? argv[index + 1] : undefined;
    const takeNext = rawInlineValue === undefined && nextValue && !nextValue.startsWith('--');
    const value = rawInlineValue !== undefined ? rawInlineValue : takeNext ? nextValue : undefined;

    if (takeNext) {
      index += 1;
    }

    switch (key) {
      case '--once':
        args.once = true;
        break;
      case '--dry-run':
        args.dryRun = value === undefined ? true : toBoolean(value, true);
        break;
      case '--verbose':
        args.verbose = true;
        break;
      case '--help':
      case '-h':
        args.help = true;
        break;
      case '--loop-delay-ms':
        args.loopDelayMs = toNumber(value, undefined);
        break;
      case '--min-request-interval-ms':
        args.minRequestIntervalMs = toNumber(value, undefined);
        break;
      case '--refuel-threshold':
        args.refuelThreshold = toNumber(value, undefined);
        break;
      case '--stop-budget-buffer':
        args.stopBudgetBuffer = toNumber(value, undefined);
        break;
      case '--max-cycles':
        args.maxCycles = toNumber(value, undefined);
        break;
      case '--log-file':
        args.logFile = value;
        break;
      case '--api-url':
        args.apiUrl = value;
        break;
      case '--agent-key':
        args.agentKey = value;
        break;
      default:
        args.unknown = args.unknown || [];
        args.unknown.push(token);
        break;
    }
  }

  return args;
}

function printHelp() {
  const helpText = [
    'Space Wars Agent Client',
    '',
    'Usage:',
    '  npm start -- [options]',
    '',
    'Options:',
    '  --once                         Run a single trading cycle and exit',
    '  --dry-run                      Log intended actions without mutating the game state',
    '  --verbose                      Enable debug logging',
    '  --loop-delay-ms <ms>           Delay between loop iterations',
    '  --min-request-interval-ms <ms> Minimum delay between API requests',
    '  --refuel-threshold <ratio>     Refuel when fuel ratio falls below this number',
    '  --stop-budget-buffer <credits> Stop when remaining daily budget falls below this buffer',
    '  --max-cycles <n>               Stop after N cycles',
    '  --log-file <path>              Also append logs to a file',
    '  --api-url <url>                Override SPACEWARS_API_URL',
    '  --agent-key <key>              Override SPACEWARS_AGENT_KEY',
    '  --help                         Show this help output',
  ].join('\n');

  process.stdout.write(`${helpText}\n`);
}

function pick(...values) {
  for (const value of values) {
    if (value !== undefined && value !== null) return value;
  }
  return undefined;
}

function asArray(value) {
  if (Array.isArray(value)) return value;
  if (value === undefined || value === null) return [];
  return [value];
}

function normalizeAgentSelf(raw) {
  const data = raw && raw.data && !Array.isArray(raw.data) ? raw.data : raw;
  return {
    agentId: pick(data.agent_id, data.agentId),
    ownerId: pick(data.owner_id, data.ownerId),
    shipId: pick(data.ship_id, data.shipId),
    name: pick(data.name, 'Agent'),
    status: pick(data.status, 'unknown'),
    permissions: data.permissions || {},
    dailyCreditLimit: toNumber(pick(data.daily_credit_limit, data.dailyCreditLimit), 0),
    dailyCreditsSpent: toNumber(pick(data.daily_credits_spent, data.dailyCreditsSpent), 0),
    rateLimitPerMinute: toNumber(pick(data.rate_limit_per_minute, data.rateLimitPerMinute), 0),
    directive: pick(data.directive, 'idle'),
    directiveParams: data.directive_params || data.directiveParams || {},
    totalActions: toNumber(pick(data.total_actions, data.totalActions), 0),
    totalCreditsEarned: toNumber(pick(data.total_credits_earned, data.totalCreditsEarned), 0),
    totalCreditsSpent: toNumber(pick(data.total_credits_spent, data.totalCreditsSpent), 0),
    lastActionAt: pick(data.last_action_at, data.lastActionAt, null),
    lastActionType: pick(data.last_action_type, data.lastActionType, null),
    errorMessage: pick(data.error_message, data.errorMessage, null),
    raw: data,
  };
}

function normalizeShip(raw) {
  const data = raw && raw.data && !Array.isArray(raw.data) ? raw.data : raw;
  const ship = data.ship || data;
  const currentSectorId = pick(
    ship.current_sector_id,
    ship.currentSector && ship.currentSector.sector_id,
    ship.current_sector && ship.current_sector.sector_id,
  );

  return {
    shipId: pick(ship.ship_id, ship.shipId),
    name: pick(ship.name, 'Unknown Ship'),
    shipType: pick(ship.ship_type, ship.shipType, 'Unknown'),
    currentSectorId,
    currentSector: ship.currentSector || ship.current_sector || null,
    fuel: toNumber(pick(ship.fuel, 0), 0),
    maxFuel: toNumber(pick(ship.max_fuel, ship.maxFuel, ship.fuel, 0), 0),
    cargoCapacity: toNumber(pick(ship.cargo_capacity, ship.cargoCapacity, 0), 0),
    hull: toNumber(pick(ship.hull, ship.hull_integrity, ship.current_hull, 0), 0),
    maxHull: toNumber(pick(ship.max_hull, ship.maxHull, ship.hull, 0), 0),
    shields: toNumber(pick(ship.shields, ship.current_shields, 0), 0),
    maxShields: toNumber(pick(ship.max_shields, ship.maxShields, ship.shields, 0), 0),
    isActive: toBoolean(pick(ship.is_active, true), true),
    adjacentSectors: asArray(data.adjacentSectors || data.adjacent_sectors),
    raw: ship,
  };
}

function normalizeCargo(raw) {
  const data = raw && raw.data && !Array.isArray(raw.data) ? raw.data : raw;
  const items = asArray(data.items).map((item) => ({
    commodityId: pick(item.commodity_id, item.commodityId),
    name: pick(item.name, item.commodity_name, 'Unknown Commodity'),
    category: pick(item.category, 'Unknown'),
    quantity: toNumber(pick(item.quantity, 0), 0),
    volume: toNumber(pick(item.volume, 0), 0),
    raw: item,
  }));

  return {
    shipId: pick(data.ship_id, data.shipId),
    shipName: pick(data.ship_name, data.shipName),
    cargoCapacity: toNumber(pick(data.cargo_capacity, data.cargoCapacity, 0), 0),
    usedCapacity: toNumber(pick(data.used_capacity, data.usedCapacity, 0), 0),
    freeCapacity: toNumber(pick(data.free_capacity, data.freeCapacity, 0), 0),
    items,
    raw: data,
  };
}

function normalizeMap(raw) {
  const data = raw && raw.data && !Array.isArray(raw.data) ? raw.data : raw;
  const systems = asArray(data.systems || data.sectors || data.nodes).map((system) => ({
    sectorId: pick(system.sector_id, system.id, system.sectorId),
    name: pick(system.name, `Sector ${pick(system.sector_id, system.id, 'unknown')}`),
    x: toNumber(pick(system.x_coord, system.x, 0), 0),
    y: toNumber(pick(system.y_coord, system.y, 0), 0),
    hasPort: toBoolean(pick(system.has_port, system.hasPort, false), false),
    discovered: toBoolean(pick(system.discovered, true), true),
    raw: system,
  }));

  const hyperlanes = asArray(data.hyperlanes || data.connections || data.edges).map((connection) => ({
    fromId: pick(connection.from_id, connection.sector_a_id, connection.fromId, connection.a),
    toId: pick(connection.to_id, connection.sector_b_id, connection.toId, connection.b),
    travelTime: toNumber(pick(connection.travel_time, connection.travelTime, 1), 1),
    connectionType: pick(connection.connection_type, connection.connectionType, 'hyperlane'),
    raw: connection,
  })).filter((connection) => connection.fromId && connection.toId);

  return {
    systems,
    hyperlanes,
    totalSystems: toNumber(pick(data.total_systems, data.totalSystems, systems.length), systems.length),
    raw: data,
  };
}

function extractCommodityListings(port) {
  return asArray(
    port.commodities ||
    port.listings ||
    port.items ||
    port.market ||
    port.market_items ||
    port.port_commodities ||
    port.portCommodities
  ).map((listing) => ({
    commodityId: pick(listing.commodity_id, listing.commodityId, listing.id),
    name: pick(
      listing.name,
      listing.commodity_name,
      listing.commodity && listing.commodity.name,
      'Unknown Commodity',
    ),
    category: pick(
      listing.category,
      listing.commodity && listing.commodity.category,
      'Unknown',
    ),
    canBuy: toBoolean(pick(listing.can_buy, listing.canBuy, false), false),
    canSell: toBoolean(pick(listing.can_sell, listing.canSell, false), false),
    buyPrice: pick(listing.buy_price, listing.buyPrice) !== undefined
      ? toNumber(pick(listing.buy_price, listing.buyPrice), 0)
      : null,
    sellPrice: pick(listing.sell_price, listing.sellPrice) !== undefined
      ? toNumber(pick(listing.sell_price, listing.sellPrice), 0)
      : null,
    quantity: pick(listing.quantity) !== undefined ? toNumber(listing.quantity, 0) : null,
    maxQuantity: pick(listing.max_quantity, listing.maxQuantity) !== undefined
      ? toNumber(pick(listing.max_quantity, listing.maxQuantity), 0)
      : null,
    volumePerUnit: pick(listing.volume_per_unit, listing.volumePerUnit) !== undefined
      ? toNumber(pick(listing.volume_per_unit, listing.volumePerUnit), 1)
      : 1,
    raw: listing,
  })).filter((listing) => listing.commodityId);
}

function normalizePorts(raw, currentSectorId = null) {
  const data = raw && raw.data && !Array.isArray(raw.data) ? raw.data : raw;
  const ports = asArray(data.ports || data).map((port) => {
    const commodities = extractCommodityListings(port);
    return {
      portId: pick(port.port_id, port.id, port.portId),
      sectorId: pick(port.sector_id, port.sectorId, currentSectorId),
      name: pick(port.name, 'Unknown Port'),
      type: pick(port.type, 'Unknown'),
      description: pick(port.description, ''),
      taxRate: toNumber(pick(port.tax_rate, port.taxRate, 0), 0),
      allowsIllegal: toBoolean(pick(port.allows_illegal, port.allowsIllegal, false), false),
      commodityCount: toNumber(pick(port.commodity_count, port.commodityCount, commodities.length), commodities.length),
      commodities,
      raw: port,
    };
  }).filter((port) => port.portId);

  return {
    ports,
    supportsCommodityListings: ports.some((port) => port.commodities.length > 0),
    raw: data,
  };
}

function normalizeMarketSummary(raw) {
  const data = raw && raw.data && !Array.isArray(raw.data) ? raw.data : raw;
  const entries = asArray(data.market_summary || data.market || data.market_data || data.commodities);

  return {
    commodities: entries.map((entry) => ({
      commodityId: pick(entry.commodity_id, entry.id, entry.commodityId),
      name: pick(entry.name, entry.commodity_name, 'Unknown Commodity'),
      category: pick(entry.category, 'Unknown'),
      basePrice: pick(entry.base_price, entry.basePrice) !== undefined
        ? toNumber(pick(entry.base_price, entry.basePrice), 0)
        : null,
      isLegal: toBoolean(pick(entry.is_legal, entry.isLegal, true), true),
      portsTrading: toNumber(pick(entry.ports_trading, entry.port_count, entry.portsTrading, 0), 0),
      avgBuyPrice: pick(entry.avg_buy_price, entry.avgBuyPrice) !== undefined
        ? toNumber(pick(entry.avg_buy_price, entry.avgBuyPrice), 0)
        : null,
      avgSellPrice: pick(entry.avg_sell_price, entry.avgSellPrice) !== undefined
        ? toNumber(pick(entry.avg_sell_price, entry.avgSellPrice), 0)
        : null,
      minBuyPrice: pick(entry.min_buy_price, entry.minBuyPrice) !== undefined
        ? toNumber(pick(entry.min_buy_price, entry.minBuyPrice), 0)
        : null,
      maxBuyPrice: pick(entry.max_buy_price, entry.maxBuyPrice) !== undefined
        ? toNumber(pick(entry.max_buy_price, entry.maxBuyPrice), 0)
        : null,
      bestBuy: entry.best_buy || entry.bestBuy || entry.lowest_price_port || null,
      bestSell: entry.best_sell || entry.bestSell || entry.highest_price_port || null,
      raw: entry,
    })).filter((entry) => entry.commodityId),
    raw: data,
  };
}

function summarizeError(error) {
  if (!error) return { message: 'Unknown error' };

  return {
    name: error.name,
    message: error.message,
    statusCode: error.statusCode || error.status || null,
    code: error.code || null,
    responseBody: error.responseBody || error.body || null,
    stack: error.stack,
  };
}

module.exports = {
  asArray,
  clamp,
  ensureDir,
  formatCredits,
  formatPercent,
  normalizeAgentSelf,
  normalizeCargo,
  normalizeMap,
  normalizeMarketSummary,
  normalizePorts,
  normalizeShip,
  parseArgs,
  pick,
  printHelp,
  safeJson,
  sleep,
  summarizeError,
  toBoolean,
  toNumber,
};
