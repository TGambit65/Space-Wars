class Navigator {
  constructor(logger = null) {
    this.logger = logger;
    this.systems = new Map();
    this.graph = new Map();
  }

  loadMap(map) {
    this.systems.clear();
    this.graph.clear();

    for (const system of map.systems || []) {
      this.systems.set(system.sectorId, system);
      this.graph.set(system.sectorId, []);
    }

    for (const lane of map.hyperlanes || []) {
      if (!this.graph.has(lane.fromId)) this.graph.set(lane.fromId, []);
      if (!this.graph.has(lane.toId)) this.graph.set(lane.toId, []);

      this.graph.get(lane.fromId).push({
        sectorId: lane.toId,
        travelTime: lane.travelTime,
        connectionType: lane.connectionType,
      });

      this.graph.get(lane.toId).push({
        sectorId: lane.fromId,
        travelTime: lane.travelTime,
        connectionType: lane.connectionType,
      });
    }

    this.logger && this.logger.info('Navigator graph ready', {
      systems: this.systems.size,
      hyperlanes: map.hyperlanes ? map.hyperlanes.length : 0,
    });
  }

  hasSector(sectorId) {
    return this.graph.has(sectorId);
  }

  getNeighbors(sectorId) {
    return this.graph.get(sectorId) || [];
  }

  getSector(sectorId) {
    return this.systems.get(sectorId) || null;
  }

  shortestPath(startSectorId, endSectorId) {
    if (!startSectorId || !endSectorId) return null;
    if (startSectorId === endSectorId) return [];
    if (!this.graph.has(startSectorId) || !this.graph.has(endSectorId)) return null;

    const queue = [startSectorId];
    const visited = new Set([startSectorId]);
    const previous = new Map();

    while (queue.length > 0) {
      const current = queue.shift();
      if (current === endSectorId) break;

      for (const neighbor of this.getNeighbors(current)) {
        if (visited.has(neighbor.sectorId)) continue;
        visited.add(neighbor.sectorId);
        previous.set(neighbor.sectorId, current);
        queue.push(neighbor.sectorId);
      }
    }

    if (!visited.has(endSectorId)) return null;

    const path = [];
    let cursor = endSectorId;
    while (cursor && cursor !== startSectorId) {
      path.unshift(cursor);
      cursor = previous.get(cursor);
    }

    return path;
  }


  estimateTravelCost(startSectorId, path) {
    if (!startSectorId || !Array.isArray(path) || path.length === 0) return 0;

    let cost = 0;
    let previous = startSectorId;
    for (const sectorId of path) {
      const edge = this.getNeighbors(previous).find((neighbor) => neighbor.sectorId === sectorId);
      cost += edge ? Math.max(1, edge.travelTime || 1) : 1;
      previous = sectorId;
    }
    return cost;
  }

  nearestMatchingSector(startSectorId, predicate) {
    if (!startSectorId || !this.graph.has(startSectorId)) return null;
    if (predicate(this.getSector(startSectorId), startSectorId)) {
      return { sectorId: startSectorId, path: [] };
    }

    const queue = [startSectorId];
    const visited = new Set([startSectorId]);
    const previous = new Map();

    while (queue.length > 0) {
      const current = queue.shift();
      for (const neighbor of this.getNeighbors(current)) {
        if (visited.has(neighbor.sectorId)) continue;
        visited.add(neighbor.sectorId);
        previous.set(neighbor.sectorId, current);

        const sector = this.getSector(neighbor.sectorId);
        if (predicate(sector, neighbor.sectorId)) {
          const path = [];
          let cursor = neighbor.sectorId;
          while (cursor && cursor !== startSectorId) {
            path.unshift(cursor);
            cursor = previous.get(cursor);
          }

          return { sectorId: neighbor.sectorId, path };
        }

        queue.push(neighbor.sectorId);
      }
    }

    return null;
  }
}

module.exports = {
  Navigator,
};
