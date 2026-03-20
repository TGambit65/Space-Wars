class Trader {
  constructor({ navigator, logger = null } = {}) {
    this.navigator = navigator;
    this.logger = logger;
  }

  rankMarketCommodities(market) {
    if (!market || !Array.isArray(market.commodities)) return [];

    return [...market.commodities]
      .map((commodity) => ({
        ...commodity,
        estimatedSpread:
          commodity.maxBuyPrice !== null && commodity.maxBuyPrice !== undefined
          && commodity.minBuyPrice !== null && commodity.minBuyPrice !== undefined
            ? commodity.maxBuyPrice - commodity.minBuyPrice
            : null,
      }))
      .sort((left, right) => {
        const rightSpread = right.estimatedSpread ?? -Infinity;
        const leftSpread = left.estimatedSpread ?? -Infinity;
        if (rightSpread !== leftSpread) return rightSpread - leftSpread;
        return (right.portsTrading || 0) - (left.portsTrading || 0);
      });
  }

  getObservedPairs(state) {
    const listings = state.getObservedListings();
    const buyListings = [];
    const sellListings = [];

    for (const observed of listings) {
      const sectorId = observed.sectorId;
      const port = observed.port;
      for (const commodity of port.commodities || []) {
        if (commodity.canBuy && commodity.sellPrice) {
          buyListings.push({
            sectorId,
            portId: port.portId,
            portName: port.name,
            portType: port.type,
            commodity,
          });
        }
        if (commodity.canSell && commodity.buyPrice) {
          sellListings.push({
            sectorId,
            portId: port.portId,
            portName: port.name,
            portType: port.type,
            commodity,
          });
        }
      }
    }

    return { buyListings, sellListings };
  }

  findBestCargoSale(state) {
    if (!state.cargo || !Array.isArray(state.cargo.items) || state.cargo.items.length === 0) {
      return null;
    }

    const { sellListings } = this.getObservedPairs(state);
    const currentSectorId = state.ship && state.ship.currentSectorId;
    let bestPlan = null;

    for (const cargoItem of state.cargo.items) {
      if (!cargoItem.quantity || cargoItem.quantity <= 0) continue;

      for (const listing of sellListings) {
        if (listing.commodity.commodityId !== cargoItem.commodityId) continue;
        const route = this.navigator.shortestPath(currentSectorId, listing.sectorId);
        if (route === null) continue;
        const hops = route.length;
        const totalRevenue = cargoItem.quantity * listing.commodity.buyPrice;
        const score = totalRevenue / Math.max(1, hops || 1);

        const plan = {
          type: 'sell-cargo',
          route,
          hops,
          sectorId: listing.sectorId,
          portId: listing.portId,
          portName: listing.portName,
          commodityId: cargoItem.commodityId,
          commodityName: cargoItem.name,
          quantity: cargoItem.quantity,
          unitPrice: listing.commodity.buyPrice,
          estimatedTotalRevenue: totalRevenue,
          score,
        };

        if (!bestPlan || plan.score > bestPlan.score) {
          bestPlan = plan;
        }
      }
    }

    return bestPlan;
  }

  findBestObservedTrade(state) {
    const ship = state.ship;
    const cargo = state.cargo;
    if (!ship || !cargo) return null;

    const currentSectorId = ship.currentSectorId;
    const freeCapacity = Math.max(0, cargo.freeCapacity || 0);
    const budgetRemaining = state.getBudgetRemaining();
    const { buyListings, sellListings } = this.getObservedPairs(state);

    let bestPlan = null;

    for (const buy of buyListings) {
      const unitCost = buy.commodity.sellPrice;
      const volumePerUnit = Math.max(1, buy.commodity.volumePerUnit || 1);
      const stockQuantity = buy.commodity.quantity !== null && buy.commodity.quantity !== undefined
        ? buy.commodity.quantity
        : Infinity;
      const budgetQty = budgetRemaining === null
        ? Infinity
        : Math.floor(budgetRemaining / Math.max(1, unitCost));
      const cargoQty = Math.floor(freeCapacity / volumePerUnit);
      const maxQuantity = Math.min(stockQuantity, budgetQty, cargoQty);

      if (!Number.isFinite(maxQuantity) && maxQuantity !== Infinity) continue;
      if (maxQuantity === Infinity || maxQuantity <= 0) continue;

      for (const sell of sellListings) {
        if (sell.commodity.commodityId !== buy.commodity.commodityId) continue;
        if (sell.portId === buy.portId) continue;
        if ((sell.commodity.buyPrice || 0) <= unitCost) continue;

        const routeToBuy = this.navigator.shortestPath(currentSectorId, buy.sectorId);
        const routeToSell = this.navigator.shortestPath(buy.sectorId, sell.sectorId);
        if (routeToBuy === null || routeToSell === null) continue;

        const totalRoute = [...routeToBuy, ...routeToSell];
        const totalHops = totalRoute.length;
        const profitPerUnit = sell.commodity.buyPrice - unitCost;
        const estimatedProfit = profitPerUnit * maxQuantity;
        const score = estimatedProfit / Math.max(1, totalHops || 1);

        const plan = {
          type: 'buy-then-sell',
          commodityId: buy.commodity.commodityId,
          commodityName: buy.commodity.name,
          quantity: maxQuantity,
          unitBuyPrice: unitCost,
          unitSellPrice: sell.commodity.buyPrice,
          profitPerUnit,
          estimatedProfit,
          routeToBuy,
          routeToSell,
          totalRoute,
          totalHops,
          buySectorId: buy.sectorId,
          buyPortId: buy.portId,
          buyPortName: buy.portName,
          sellSectorId: sell.sectorId,
          sellPortId: sell.portId,
          sellPortName: sell.portName,
          score,
        };

        if (!bestPlan || plan.score > bestPlan.score) {
          bestPlan = plan;
        }
      }
    }

    return bestPlan;
  }

  findExplorationPlan(state) {
    const currentSectorId = state.ship && state.ship.currentSectorId;
    if (!currentSectorId || !state.map || !Array.isArray(state.map.systems)) return null;

    const knownSectors = new Set(state.getKnownPorts().map((entry) => entry.sectorId));
    const nearest = this.navigator.nearestMatchingSector(currentSectorId, (sector) => {
      if (!sector || !sector.hasPort) return false;
      return !knownSectors.has(sector.sectorId);
    });

    if (!nearest) return null;

    return {
      type: 'explore',
      targetSectorId: nearest.sectorId,
      route: nearest.path,
      hops: nearest.path.length,
      reason: 'Scan an unvisited port sector to collect commodity listings.',
    };
  }

  buildPlan(state) {
    const marketRankings = this.rankMarketCommodities(state.market);
    if (marketRankings.length > 0) {
      this.logger && this.logger.debug('Top market spreads', {
        leaders: marketRankings.slice(0, 5).map((entry) => ({
          commodity: entry.name,
          estimatedSpread: entry.estimatedSpread,
          portsTrading: entry.portsTrading,
        })),
      });
    }

    const sellPlan = this.findBestCargoSale(state);
    if (sellPlan) {
      return sellPlan;
    }

    const tradePlan = this.findBestObservedTrade(state);
    if (tradePlan) {
      return tradePlan;
    }

    const knownScans = state.getKnownPorts();
    const anyCommodityListings = knownScans.some((scan) => scan.supportsCommodityListings);
    if (!anyCommodityListings) {
      return {
        type: 'blocked',
        reason: 'Current /api/agent-api/port responses do not expose per-port commodity listings or commodity IDs, so the client cannot construct valid buy/sell orders from the agent API alone.',
      };
    }

    const explorationPlan = this.findExplorationPlan(state);
    if (explorationPlan) {
      return explorationPlan;
    }

    if (state.cargo && Array.isArray(state.cargo.items) && state.cargo.items.length > 0) {
      return {
        type: 'blocked',
        reason: 'The ship is carrying cargo, but no observed port currently advertises a matching sell listing. Scan more ports or expose richer market route data.',
      };
    }

    return {
      type: 'blocked',
      reason: 'No profitable observed trade route is currently available from the data exposed by the agent API.',
    };
  }
}

module.exports = {
  Trader,
};
