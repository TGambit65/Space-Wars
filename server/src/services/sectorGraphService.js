const { SectorConnection, Port } = require('../models');
const { Op } = require('sequelize');

/**
 * Shared sector graph utilities for pathfinding and adjacency queries.
 * Extracted to avoid circular dependencies between npcService and behaviorTreeService.
 */

/**
 * Get all sector IDs adjacent to a given sector.
 * @param {string} sectorId
 * @returns {Promise<string[]>} Array of adjacent sector IDs
 */
const getAdjacentSectorIds = async (sectorId) => {
  const connections = await SectorConnection.findAll({
    where: {
      [Op.or]: [
        { sector_a_id: sectorId },
        { sector_b_id: sectorId }
      ]
    },
    attributes: ['sector_a_id', 'sector_b_id']
  });

  const adjacentIds = new Set();
  for (const conn of connections) {
    if (conn.sector_a_id !== sectorId) adjacentIds.add(conn.sector_a_id);
    if (conn.sector_b_id !== sectorId) adjacentIds.add(conn.sector_b_id);
  }
  return [...adjacentIds];
};

/**
 * Build an in-memory adjacency map from a set of sector IDs.
 * Pre-fetches all connections in a single query to avoid N+1.
 * @param {Set<string>|null} sectorScope - If provided, only include connections between these sectors. If null, loads all.
 * @returns {Promise<Map<string, string[]>>} Adjacency map: sectorId → [neighborIds]
 */
const buildAdjacencyMap = async (sectorScope = null) => {
  const where = {};
  if (sectorScope && sectorScope.size > 0) {
    const ids = [...sectorScope];
    where[Op.or] = [
      { sector_a_id: { [Op.in]: ids } },
      { sector_b_id: { [Op.in]: ids } }
    ];
  }

  const connections = await SectorConnection.findAll({
    where,
    attributes: ['sector_a_id', 'sector_b_id']
  });

  const adjacency = new Map();
  const addEdge = (from, to) => {
    if (!adjacency.has(from)) adjacency.set(from, []);
    adjacency.get(from).push(to);
  };

  for (const conn of connections) {
    addEdge(conn.sector_a_id, conn.sector_b_id);
    addEdge(conn.sector_b_id, conn.sector_a_id);
  }

  return adjacency;
};

/**
 * Get the set of sector IDs that have an active port.
 * @param {string[]} sectorIds - Sectors to check
 * @returns {Promise<Set<string>>} Set of sector IDs with active ports
 */
const getPortSectorIds = async (sectorIds) => {
  if (!sectorIds || sectorIds.length === 0) return new Set();

  const ports = await Port.findAll({
    where: { sector_id: { [Op.in]: sectorIds }, is_active: true },
    attributes: ['sector_id']
  });

  return new Set(ports.map(p => p.sector_id));
};

/**
 * BFS to find the next step in a path from one sector to another.
 * Uses in-memory adjacency map when provided, falls back to per-hop queries.
 * @param {string} fromSectorId
 * @param {string} toSectorId
 * @param {number} maxHops - Max search depth
 * @param {Map<string, string[]>} [adjacencyMap] - Pre-built adjacency map (optional)
 * @returns {Promise<string|null>} Next sector_id to move to, or null if no path
 */
const findPathToSector = async (fromSectorId, toSectorId, maxHops = 10, adjacencyMap = null) => {
  if (fromSectorId === toSectorId) return null;

  const getNeighbors = adjacencyMap
    ? (id) => adjacencyMap.get(id) || []
    : getAdjacentSectorIds;

  const visited = new Set([fromSectorId]);
  const queue = [];

  const startNeighbors = await Promise.resolve(getNeighbors(fromSectorId));
  for (const neighborId of startNeighbors) {
    if (neighborId === toSectorId) return neighborId;
    visited.add(neighborId);
    queue.push({ sectorId: neighborId, firstStep: neighborId, depth: 1 });
  }

  while (queue.length > 0) {
    const { sectorId, firstStep, depth } = queue.shift();
    if (depth >= maxHops) continue;

    const neighbors = await Promise.resolve(getNeighbors(sectorId));
    for (const neighborId of neighbors) {
      if (neighborId === toSectorId) return firstStep;
      if (!visited.has(neighborId)) {
        visited.add(neighborId);
        queue.push({ sectorId: neighborId, firstStep, depth: depth + 1 });
      }
    }
  }

  return null;
};

/**
 * BFS to find the nearest sector with a port.
 * @param {string} fromSectorId
 * @param {number} maxHops
 * @param {Map<string, string[]>} [adjacencyMap] - Pre-built adjacency map (optional)
 * @param {Set<string>} [portSectorSet] - Pre-fetched set of sectors with ports (optional)
 * @returns {Promise<string|null>} Next sector_id to move toward the nearest port, or fromSectorId if already at port, or null
 */
const findNearestPortSector = async (fromSectorId, maxHops = 10, adjacencyMap = null, portSectorSet = null) => {
  const hasPort = portSectorSet
    ? (id) => portSectorSet.has(id)
    : async (id) => {
        const port = await Port.findOne({ where: { sector_id: id, is_active: true } });
        return !!port;
      };

  if (await Promise.resolve(hasPort(fromSectorId))) return fromSectorId;

  const getNeighbors = adjacencyMap
    ? (id) => adjacencyMap.get(id) || []
    : getAdjacentSectorIds;

  const visited = new Set([fromSectorId]);
  const queue = [];

  const startNeighbors = await Promise.resolve(getNeighbors(fromSectorId));
  for (const neighborId of startNeighbors) {
    visited.add(neighborId);
    queue.push({ sectorId: neighborId, firstStep: neighborId, depth: 1 });
  }

  while (queue.length > 0) {
    const { sectorId, firstStep, depth } = queue.shift();

    if (await Promise.resolve(hasPort(sectorId))) return firstStep;
    if (depth >= maxHops) continue;

    const neighbors = await Promise.resolve(getNeighbors(sectorId));
    for (const neighborId of neighbors) {
      if (!visited.has(neighborId)) {
        visited.add(neighborId);
        queue.push({ sectorId: neighborId, firstStep, depth: depth + 1 });
      }
    }
  }

  return null;
};

module.exports = {
  getAdjacentSectorIds,
  buildAdjacencyMap,
  getPortSectorIds,
  findPathToSector,
  findNearestPortSector
};
