class AgentState {
  constructor() {
    this.agent = null;
    this.ship = null;
    this.cargo = null;
    this.map = null;
    this.market = null;
    this.currentPlan = null;
    this.stopReason = null;
    this.disabledPermissions = new Set();
    this.compatibilityNotes = [];
    this.knownPortsBySector = new Map();
    this.observedPortListings = new Map();
    this.lastProfit = null;
  }

  setAgent(agent) {
    if (agent && typeof agent === 'object') {
      this.agent = { ...agent, observedAt: new Date().toISOString() };
      return;
    }
    this.agent = agent;
  }

  setShip(ship) {
    if (ship && typeof ship === 'object') {
      this.ship = { ...ship, observedAt: new Date().toISOString() };
      return;
    }
    this.ship = ship;
  }

  setCargo(cargo) {
    if (cargo && typeof cargo === 'object') {
      this.cargo = { ...cargo, observedAt: new Date().toISOString() };
      return;
    }
    this.cargo = cargo;
  }

  setMap(map) {
    if (map && typeof map === 'object') {
      this.map = { ...map, observedAt: new Date().toISOString() };
      return;
    }
    this.map = map;
  }

  setMarket(market) {
    if (market && typeof market === 'object') {
      this.market = { ...market, observedAt: new Date().toISOString() };
      return;
    }
    this.market = market;
  }

  setPlan(plan) {
    this.currentPlan = plan;
  }

  clearPlan() {
    this.currentPlan = null;
  }

  requestStop(reason) {
    if (!this.stopReason) {
      this.stopReason = reason;
    }
  }

  shouldStop() {
    return Boolean(this.stopReason);
  }

  markPermissionDenied(permissionFamily) {
    if (permissionFamily) {
      this.disabledPermissions.add(permissionFamily);
    }
  }

  hasPermission(permissionFamily) {
    if (!permissionFamily) return true;
    if (this.disabledPermissions.has(permissionFamily)) return false;
    if (!this.agent || !this.agent.permissions) return true;
    return Boolean(this.agent.permissions[permissionFamily]);
  }

  getBudgetRemaining() {
    if (!this.agent) return null;
    const limit = Number(this.agent.dailyCreditLimit || 0);
    const spent = Number(this.agent.dailyCreditsSpent || 0);
    if (limit <= 0) return null;
    return Math.max(0, limit - spent);
  }

  addCompatibilityNote(note) {
    if (!note) return;
    if (!this.compatibilityNotes.includes(note)) {
      this.compatibilityNotes.push(note);
    }
  }

  notePorts(sectorId, portScan) {
    if (!sectorId || !portScan || !Array.isArray(portScan.ports)) return;

    this.knownPortsBySector.set(sectorId, {
      sectorId,
      scannedAt: new Date().toISOString(),
      supportsCommodityListings: Boolean(portScan.supportsCommodityListings),
      ports: portScan.ports,
    });

    for (const port of portScan.ports) {
      if (port.commodities && port.commodities.length > 0) {
        this.observedPortListings.set(port.portId, {
          sectorId,
          port,
          observedAt: new Date().toISOString(),
        });
      }
    }
  }

  getKnownPorts() {
    return Array.from(this.knownPortsBySector.values());
  }

  getObservedListings() {
    return Array.from(this.observedPortListings.values());
  }

  getCargoItemByCommodityId(commodityId) {
    if (!this.cargo || !Array.isArray(this.cargo.items)) return null;
    return this.cargo.items.find((item) => item.commodityId === commodityId) || null;
  }

  getCargoManifestSummary() {
    if (!this.cargo || !Array.isArray(this.cargo.items) || this.cargo.items.length === 0) {
      return [];
    }

    return this.cargo.items.map((item) => ({
      commodityId: item.commodityId,
      name: item.name,
      quantity: item.quantity,
    }));
  }
}

module.exports = {
  AgentState,
};
