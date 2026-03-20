const crypto = require('crypto');
const {
  formatCredits,
  formatPercent,
  normalizeAgentSelf,
  normalizeCargo,
  normalizeMap,
  normalizeMarketSummary,
  normalizePorts,
  normalizeShip,
  sleep,
  summarizeError,
} = require('./util');

class TradingAgent {
  constructor({ api, logger, state, navigator, trader, options = {} } = {}) {
    this.api = api;
    this.logger = logger;
    this.state = state;
    this.navigator = navigator;
    this.trader = trader;
    this.options = {
      dryRun: Boolean(options.dryRun),
      once: Boolean(options.once),
      loopDelayMs: Math.max(0, Number(options.loopDelayMs) || 3000),
      refuelThreshold: Math.max(0, Number(options.refuelThreshold) || 0.25),
      stopBudgetBuffer: Math.max(0, Number(options.stopBudgetBuffer) || 100),
      maxCycles: options.maxCycles ? Number(options.maxCycles) : null,
    };
    this.idSequence = 0;
  }

  async run() {
    this.logger.info('Starting Space Wars trading agent', {
      dryRun: this.options.dryRun,
      once: this.options.once,
      loopDelayMs: this.options.loopDelayMs,
      refuelThreshold: this.options.refuelThreshold,
      stopBudgetBuffer: this.options.stopBudgetBuffer,
      maxCycles: this.options.maxCycles,
    });

    const bootstrapped = await this.bootstrap();
    if (!bootstrapped) {
      this.finish();
      return;
    }

    let cycle = 0;
    while (!this.state.shouldStop()) {
      cycle += 1;

      if (this.options.maxCycles && cycle > this.options.maxCycles) {
        this.state.requestStop(`Reached max cycle count (${this.options.maxCycles}).`);
        break;
      }

      this.logger.info('Cycle started', {
        cycle,
        sectorId: this.state.ship && this.state.ship.currentSectorId,
        fuel: this.state.ship ? `${this.state.ship.fuel}/${this.state.ship.maxFuel}` : null,
        cargo: this.state.getCargoManifestSummary(),
        budgetRemaining: this.state.getBudgetRemaining(),
      });

      const refreshed = await this.refreshLoopState();
      if (!refreshed || this.state.shouldStop()) {
        break;
      }

      if (await this.maybeRefuel(false)) {
        await this.refreshShip();
      }

      if (this.state.shouldStop()) {
        break;
      }

      const plan = this.trader.buildPlan(this.state);
      this.state.setPlan(plan);
      this.logPlan(plan);

      const executed = await this.executePlan(plan);
      this.state.clearPlan();

      if (!executed && !this.state.shouldStop()) {
        this.logger.warn('Cycle finished without executing a trade action.');
      }

      if (this.options.once && !this.state.shouldStop()) {
        this.state.requestStop('Completed single requested cycle (--once).');
      }

      if (!this.state.shouldStop()) {
        await sleep(this.options.loopDelayMs);
      }
    }

    this.finish();
  }

  finish() {
    this.logger.info('Agent stopped', {
      reason: this.state.stopReason || 'Loop finished',
      lastProfit: this.state.lastProfit,
      compatibilityNotes: this.state.compatibilityNotes,
    });
  }

  async bootstrap() {
    const agent = await this.refreshAgent(true);
    if (!agent) return false;

    if (!this.validateAgentConfig()) {
      return false;
    }

    const ship = await this.refreshShip(true);
    if (!ship) return false;

    await this.refreshCargo(false);

    const map = await this.refreshMap(true);
    if (!map) return false;

    this.navigator.loadMap(map);

    await this.scanCurrentPorts(false, true);
    await this.refreshMarket(false, true);

    return !this.state.shouldStop();
  }

  async refreshLoopState() {
    const agent = await this.refreshAgent(true);
    if (!agent) return false;
    if (!this.validateAgentConfig()) return false;

    const ship = await this.refreshShip(true);
    if (!ship) return false;

    await this.refreshCargo(false);
    await this.scanCurrentPorts(false, false);
    await this.refreshMarket(false, false);

    const remainingBudget = this.state.getBudgetRemaining();
    if (remainingBudget !== null && remainingBudget <= this.options.stopBudgetBuffer) {
      this.state.requestStop(
        `Stopping early because remaining daily budget (${remainingBudget}) is at or below configured buffer (${this.options.stopBudgetBuffer}).`,
      );
      return false;
    }

    return !this.state.shouldStop();
  }

  validateAgentConfig() {
    const agent = this.state.agent;
    if (!agent) {
      this.state.requestStop('Agent profile is missing.');
      return false;
    }

    if (agent.status !== 'active') {
      this.state.requestStop(`Agent is ${agent.status}.`);
      return false;
    }

    if (agent.directive !== 'trade') {
      this.state.requestStop(`Directive is ${agent.directive}; this client only runs the trade directive.`);
      return false;
    }

    if (!agent.shipId) {
      this.state.requestStop('No ship is assigned to the agent.');
      return false;
    }

    for (const permission of ['scan', 'trade', 'navigate']) {
      if (!this.state.hasPermission(permission)) {
        this.state.requestStop(`Missing required permission: ${permission}.`);
        return false;
      }
    }

    return true;
  }

  async refreshAgent(required = true) {
    const body = await this.executeRequest('Fetch agent profile', () => this.api.getAgentSelf(), {
      required,
      retries: 2,
    });
    if (!body) return null;

    const agent = normalizeAgentSelf(body);
    this.state.setAgent(agent);

    this.logger.info('Agent profile loaded', {
      agentId: agent.agentId,
      name: agent.name,
      directive: agent.directive,
      status: agent.status,
      permissions: agent.permissions,
      budgetRemaining: this.state.getBudgetRemaining(),
      rateLimitPerMinute: agent.rateLimitPerMinute,
    });

    return agent;
  }

  async refreshShip(required = true) {
    const body = await this.executeRequest('Fetch ship status', () => this.api.getShip(), {
      required,
      retries: 2,
      permissionFamily: 'scan',
    });
    if (!body) return null;

    const ship = normalizeShip(body);
    this.state.setShip(ship);

    this.logger.info('Ship status updated', {
      shipId: ship.shipId,
      name: ship.name,
      type: ship.shipType,
      sectorId: ship.currentSectorId,
      fuel: `${ship.fuel}/${ship.maxFuel}`,
      fuelRatio: ship.maxFuel > 0 ? Number((ship.fuel / ship.maxFuel).toFixed(3)) : null,
      cargoCapacity: ship.cargoCapacity,
    });

    return ship;
  }

  async refreshCargo(required = false) {
    const body = await this.executeRequest('Fetch cargo manifest', () => this.api.getCargo(), {
      required,
      retries: 2,
      permissionFamily: 'scan',
    });
    if (!body) return null;

    const cargo = normalizeCargo(body);
    this.state.setCargo(cargo);

    this.logger.info('Cargo manifest updated', {
      usedCapacity: cargo.usedCapacity,
      freeCapacity: cargo.freeCapacity,
      items: cargo.items.map((item) => ({
        commodity: item.name,
        quantity: item.quantity,
      })),
    });

    return cargo;
  }

  async refreshMap(required = true) {
    const body = await this.executeRequest('Fetch galaxy map', () => this.api.getMap(), {
      required,
      retries: 2,
      permissionFamily: 'scan',
    });
    if (!body) return null;

    const map = normalizeMap(body);
    this.state.setMap(map);

    this.logger.info('Galaxy map cached', {
      systems: map.systems.length,
      hyperlanes: map.hyperlanes.length,
    });

    return map;
  }

  getCachedPortScan(maxAgeMs = 30000) {
    const sectorId = this.state.ship && this.state.ship.currentSectorId;
    if (!sectorId) return null;

    const scan = this.state.knownPortsBySector.get(sectorId) || null;
    if (!scan) return null;

    const scannedAt = scan.scannedAt ? Date.parse(scan.scannedAt) : 0;
    if (!scannedAt) return null;
    if (Date.now() - scannedAt > maxAgeMs) return null;
    return scan;
  }

  async scanCurrentPorts(required = false, force = false) {
    const sectorId = this.state.ship && this.state.ship.currentSectorId;
    if (!sectorId) return null;

    const cached = !force ? this.getCachedPortScan(30000) : null;
    if (cached) {
      this.logger.debug('Using cached port scan', {
        sectorId,
        portCount: cached.ports.length,
        supportsCommodityListings: cached.supportsCommodityListings,
      });
      return cached;
    }

    const body = await this.executeRequest('Scan current ports', () => this.api.getCurrentPorts(), {
      required,
      retries: 2,
      permissionFamily: 'scan',
    });
    if (!body) return null;

    const portScan = normalizePorts(body, sectorId);
    this.state.notePorts(sectorId, portScan);

    this.logger.info('Port scan updated', {
      sectorId,
      portCount: portScan.ports.length,
      supportsCommodityListings: portScan.supportsCommodityListings,
      ports: portScan.ports.map((port) => ({
        portId: port.portId,
        name: port.name,
        type: port.type,
        commodityCount: port.commodityCount,
      })),
    });

    if (!portScan.supportsCommodityListings) {
      const note = 'The current agent API exposes port summaries but not per-port commodity listings. The client will stop cleanly when it cannot build valid orders from agent endpoints alone.';
      this.state.addCompatibilityNote(note);
    }

    return this.state.knownPortsBySector.get(sectorId) || portScan;
  }

  async refreshMarket(required = false, force = false) {
    const cached = !force && this.state.market && this.state.market.observedAt
      ? (Date.now() - Date.parse(this.state.market.observedAt) <= 45000 ? this.state.market : null)
      : null;

    if (cached) {
      this.logger.debug('Using cached market summary', {
        commodityCount: cached.commodities.length,
      });
      return cached;
    }

    const body = await this.executeRequest('Fetch market summary', () => this.api.getMarketSummary(), {
      required,
      retries: 2,
      permissionFamily: 'scan',
    });
    if (!body) return null;

    const market = normalizeMarketSummary(body);
    this.state.setMarket(market);

    const topSpreads = this.trader.rankMarketCommodities(market).slice(0, 5).map((entry) => ({
      commodity: entry.name,
      estimatedSpread: entry.estimatedSpread,
      portsTrading: entry.portsTrading,
    }));

    this.logger.info('Market summary updated', {
      commodityCount: market.commodities.length,
      topSpreads,
    });

    return this.state.market;
  }

  async maybeRefuel(force = false) {
    const ship = this.state.ship;
    if (!ship || !ship.maxFuel) return false;
    if (!this.state.hasPermission('trade')) return false;

    const fuelRatio = ship.maxFuel > 0 ? ship.fuel / ship.maxFuel : 1;
    if (!force && fuelRatio >= this.options.refuelThreshold) {
      return false;
    }

    const portScan = await this.scanCurrentPorts(false, false);
    if (!portScan || !Array.isArray(portScan.ports) || portScan.ports.length === 0) {
      this.logger.warn('Cannot refuel because there is no known port in the current sector.', {
        sectorId: ship.currentSectorId,
      });
      return false;
    }

    this.logger.info('Fuel below threshold; attempting refuel', {
      sectorId: ship.currentSectorId,
      fuel: `${ship.fuel}/${ship.maxFuel}`,
      fuelRatio: Number(fuelRatio.toFixed(3)),
      threshold: this.options.refuelThreshold,
    });

    for (const port of portScan.ports) {
      if (this.options.dryRun) {
        this.logger.info('Dry run: would refuel here', {
          portId: port.portId,
          portName: port.name,
        });
        return true;
      }

      const result = await this.executeRequest(`Refuel at ${port.name}`, () => this.api.refuel({ portId: port.portId }), {
        required: false,
        retries: 1,
        permissionFamily: 'trade',
      });

      if (result) {
        const refuel = this.extractPayload(result, 'refuel');
        this.logger.info('Refuel succeeded', {
          portId: port.portId,
          portName: port.name,
          fuelPurchased: refuel && refuel.fuel_purchased !== undefined ? refuel.fuel_purchased : null,
          total: refuel && refuel.total !== undefined ? refuel.total : null,
        });
        return true;
      }
    }

    this.logger.warn('Refuel attempt failed at all known current-sector ports.');
    return false;
  }

  async ensureFuelForRoute(route) {
    if (!Array.isArray(route) || route.length === 0) return true;

    const ship = this.state.ship;
    if (!ship) return false;

    const estimatedCost = this.navigator.estimateTravelCost(ship.currentSectorId, route);
    if (ship.fuel > estimatedCost) {
      return true;
    }

    this.logger.warn('Fuel appears insufficient for planned route; attempting pre-route refuel.', {
      currentFuel: ship.fuel,
      estimatedCost,
      route,
    });

    const refueled = await this.maybeRefuel(true);
    if (refueled) {
      await this.refreshShip();
    }

    return refueled;
  }

  async navigateRoute(route) {
    if (!Array.isArray(route) || route.length === 0) {
      return true;
    }

    const fuelReady = await this.ensureFuelForRoute(route);
    if (!fuelReady && (this.state.ship && this.state.ship.fuel <= route.length)) {
      this.logger.warn('Route aborted because fuel still looks too low after refuel attempt.', {
        route,
        currentFuel: this.state.ship && this.state.ship.fuel,
      });
      return false;
    }

    for (const targetSectorId of route) {
      if (this.state.shouldStop()) return false;

      if (this.options.dryRun) {
        this.logger.info('Dry run: would navigate', {
          fromSectorId: this.state.ship && this.state.ship.currentSectorId,
          toSectorId: targetSectorId,
        });
        if (this.state.ship) {
          this.state.setShip({
            ...this.state.ship,
            currentSectorId: targetSectorId,
          });
        }
        continue;
      }

      const body = await this.executeRequest(`Navigate to ${targetSectorId}`, () => this.api.navigate(targetSectorId), {
        required: true,
        retries: 2,
        permissionFamily: 'navigate',
      });
      if (!body) return false;

      const ship = normalizeShip(body);
      this.state.setShip(ship);

      this.logger.info('Navigation hop complete', {
        targetSectorId,
        currentSectorId: ship.currentSectorId,
        fuel: `${ship.fuel}/${ship.maxFuel}`,
      });
    }

    return true;
  }

  async executePlan(plan) {
    if (!plan) {
      return false;
    }

    switch (plan.type) {
      case 'blocked':
        this.state.addCompatibilityNote(plan.reason);
        this.logger.warn('Agent cannot continue with current API payloads', {
          reason: plan.reason,
        });
        this.state.requestStop(plan.reason);
        return false;

      case 'explore': {
        const moved = await this.navigateRoute(plan.route);
        if (!moved) return false;
        await this.scanCurrentPorts(false, true);
        return true;
      }

      case 'sell-cargo':
        return this.executeSellCargoPlan(plan);

      case 'buy-then-sell':
        return this.executeBuyThenSellPlan(plan);

      default:
        this.logger.warn('Unknown plan type received', { planType: plan.type });
        return false;
    }
  }

  async executeSellCargoPlan(plan) {
    const moved = await this.navigateRoute(plan.route);
    if (!moved) return false;

    await this.scanCurrentPorts(false, true);

    const currentCargoItem = this.state.getCargoItemByCommodityId(plan.commodityId);
    const quantityToSell = currentCargoItem ? currentCargoItem.quantity : plan.quantity;
    if (!quantityToSell || quantityToSell <= 0) {
      this.logger.warn('No cargo left to sell for planned commodity.', {
        commodityId: plan.commodityId,
      });
      return false;
    }

    if (this.options.dryRun) {
      this.logger.info('Dry run: would sell cargo', {
        portId: plan.portId,
        commodityId: plan.commodityId,
        quantity: quantityToSell,
      });
      return true;
    }

    const body = await this.executeRequest(`Sell ${plan.commodityName}`, () => this.api.sell({
      shipId: this.state.ship.shipId,
      portId: plan.portId,
      commodityId: plan.commodityId,
      quantity: quantityToSell,
      idempotencyKey: this.nextIdempotencyKey('sell'),
    }), {
      required: false,
      retries: 1,
      permissionFamily: 'trade',
    });
    if (!body) return false;

    const transaction = this.extractPayload(body, 'transaction');

    this.logger.info('Cargo sale completed', {
      portId: plan.portId,
      commodity: plan.commodityName,
      quantity: quantityToSell,
      total: transaction && transaction.total !== undefined ? transaction.total : null,
      unitPrice: transaction && transaction.unit_price !== undefined ? transaction.unit_price : plan.unitPrice,
    });

    await this.refreshShip();
    await this.refreshCargo(false);
    return true;
  }

  async executeBuyThenSellPlan(plan) {
    const routeToBuy = plan.routeToBuy || [];
    const movedToBuy = await this.navigateRoute(routeToBuy);
    if (!movedToBuy) return false;

    await this.scanCurrentPorts(false, true);

    if (this.options.dryRun) {
      this.logger.info('Dry run: would buy then sell', {
        commodity: plan.commodityName,
        buyPortId: plan.buyPortId,
        sellPortId: plan.sellPortId,
        quantity: plan.quantity,
        estimatedProfit: plan.estimatedProfit,
      });
      return true;
    }

    const buyBody = await this.executeRequest(`Buy ${plan.commodityName}`, () => this.api.buy({
      shipId: this.state.ship.shipId,
      portId: plan.buyPortId,
      commodityId: plan.commodityId,
      quantity: plan.quantity,
      idempotencyKey: this.nextIdempotencyKey('buy'),
    }), {
      required: false,
      retries: 1,
      permissionFamily: 'trade',
    });
    if (!buyBody) return false;

    const buyTransaction = this.extractPayload(buyBody, 'transaction');
    const purchasedQuantity = buyTransaction && buyTransaction.quantity !== undefined ? buyTransaction.quantity : plan.quantity;

    this.logger.info('Purchase completed', {
      portId: plan.buyPortId,
      commodity: plan.commodityName,
      quantity: purchasedQuantity,
      total: buyTransaction && buyTransaction.total !== undefined ? buyTransaction.total : null,
      unitPrice: buyTransaction && buyTransaction.unit_price !== undefined ? buyTransaction.unit_price : plan.unitBuyPrice,
    });

    await this.refreshShip();
    await this.refreshCargo(false);
    await this.maybeRefuel(false);

    const movedToSell = await this.navigateRoute(plan.routeToSell || []);
    if (!movedToSell) return false;

    await this.scanCurrentPorts(false, true);

    const currentCargoItem = this.state.getCargoItemByCommodityId(plan.commodityId);
    const quantityToSell = currentCargoItem ? currentCargoItem.quantity : purchasedQuantity;
    if (!quantityToSell || quantityToSell <= 0) {
      this.logger.warn('Nothing to sell after purchase step.', {
        commodityId: plan.commodityId,
      });
      return false;
    }

    const sellBody = await this.executeRequest(`Sell ${plan.commodityName}`, () => this.api.sell({
      shipId: this.state.ship.shipId,
      portId: plan.sellPortId,
      commodityId: plan.commodityId,
      quantity: quantityToSell,
      idempotencyKey: this.nextIdempotencyKey('sell'),
    }), {
      required: false,
      retries: 1,
      permissionFamily: 'trade',
    });
    if (!sellBody) return false;

    const sellTransaction = this.extractPayload(sellBody, 'transaction');
    const buyTotal = buyTransaction && buyTransaction.total !== undefined ? Number(buyTransaction.total) : 0;
    const sellTotal = sellTransaction && sellTransaction.total !== undefined ? Number(sellTransaction.total) : 0;
    const realizedProfit = sellTotal - buyTotal;
    this.state.lastProfit = realizedProfit;

    this.logger.info('Trade cycle completed', {
      commodity: plan.commodityName,
      quantity: quantityToSell,
      buyPortId: plan.buyPortId,
      sellPortId: plan.sellPortId,
      buyTotal,
      sellTotal,
      realizedProfit,
      estimatedProfit: plan.estimatedProfit,
    });

    await this.refreshShip();
    await this.refreshCargo(false);
    await this.maybeRefuel(false);

    return true;
  }

  logPlan(plan) {
    if (!plan) {
      this.logger.warn('No trade plan produced for this cycle.');
      return;
    }

    switch (plan.type) {
      case 'blocked':
        this.logger.warn('Plan generation blocked', { reason: plan.reason });
        break;
      case 'explore':
        this.logger.info('Plan selected: explore', {
          targetSectorId: plan.targetSectorId,
          hops: plan.hops,
          route: plan.route,
          reason: plan.reason,
        });
        break;
      case 'sell-cargo':
        this.logger.info('Plan selected: sell cargo', {
          commodity: plan.commodityName,
          quantity: plan.quantity,
          portId: plan.portId,
          sectorId: plan.sectorId,
          hops: plan.hops,
          estimatedTotalRevenue: plan.estimatedTotalRevenue,
          route: plan.route,
        });
        break;
      case 'buy-then-sell':
        this.logger.info('Plan selected: buy then sell', {
          commodity: plan.commodityName,
          quantity: plan.quantity,
          buyPortId: plan.buyPortId,
          sellPortId: plan.sellPortId,
          buySectorId: plan.buySectorId,
          sellSectorId: plan.sellSectorId,
          unitBuyPrice: plan.unitBuyPrice,
          unitSellPrice: plan.unitSellPrice,
          estimatedProfit: plan.estimatedProfit,
          totalHops: plan.totalHops,
          routeToBuy: plan.routeToBuy,
          routeToSell: plan.routeToSell,
        });
        break;
      default:
        this.logger.info('Plan selected', plan);
        break;
    }
  }

  async executeRequest(label, fn, options = {}) {
    const {
      required = false,
      retries = 0,
      permissionFamily = null,
    } = options;

    let attempt = 0;
    while (attempt <= retries) {
      attempt += 1;
      try {
        return await fn();
      } catch (error) {
        const message = error && error.message ? error.message : 'Unknown API error';
        const permission = this.extractPermissionFamily(message) || permissionFamily;

        if (this.isPermissionDenied(message)) {
          if (permission) {
            this.state.markPermissionDenied(permission);
          }
          this.logger.warn(`${label} denied`, {
            permission,
            message,
          });
          if (required) {
            this.state.requestStop(`${label} failed: ${message}`);
          }
          return null;
        }

        if (this.isRateLimit(message)) {
          const backoffMs = 15000;
          this.logger.warn(`${label} hit rate limit; backing off`, {
            attempt,
            backoffMs,
            message,
          });
          await sleep(backoffMs);
          continue;
        }

        if (this.isBudgetExceeded(message)) {
          this.logger.warn(`${label} blocked by daily budget`, { message });
          this.state.requestStop(message);
          return null;
        }

        if (this.isAgentInactive(message)) {
          this.logger.warn(`${label} stopped because agent is no longer active`, { message });
          this.state.requestStop(message);
          return null;
        }

        if (error.statusCode === 401) {
          this.logger.error(`${label} failed due to authentication`, summarizeError(error));
          this.state.requestStop('Authentication failed. Check SPACEWARS_AGENT_KEY.');
          return null;
        }

        if ((error.isNetworkError || error.retryable || (error.statusCode >= 500)) && attempt <= retries) {
          const backoffMs = Math.min(8000, 1000 * (2 ** (attempt - 1)));
          this.logger.warn(`${label} retrying after transient error`, {
            attempt,
            backoffMs,
            message,
          });
          await sleep(backoffMs);
          continue;
        }

        if (required) {
          this.logger.error(`${label} failed`, summarizeError(error));
          this.state.requestStop(`${label} failed: ${message}`);
        } else {
          this.logger.warn(`${label} failed`, summarizeError(error));
        }
        return null;
      }
    }

    return null;
  }

  extractPayload(body, key) {
    if (!body || typeof body !== 'object') return body;
    if (body.data && body.data[key] !== undefined) return body.data[key];
    if (body[key] !== undefined) return body[key];
    return body.data || body;
  }

  nextIdempotencyKey(prefix) {
    this.idSequence += 1;
    const random = crypto.randomBytes(4).toString('hex');
    return `${prefix}-${Date.now()}-${this.idSequence}-${random}`;
  }

  extractPermissionFamily(message) {
    const match = /Permission denied:\s*([a-z_]+)/i.exec(message || '');
    return match ? match[1] : null;
  }

  isPermissionDenied(message) {
    return /Permission denied:/i.test(message || '');
  }

  isRateLimit(message) {
    return /Rate limit exceeded/i.test(message || '');
  }

  isBudgetExceeded(message) {
    return /Daily budget exceeded/i.test(message || '');
  }

  isAgentInactive(message) {
    return /Agent is\s+(stopped|paused|error|inactive)/i.test(message || '');
  }
}

module.exports = {
  TradingAgent,
};
