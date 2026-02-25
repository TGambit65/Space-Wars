const { PlayerDiscovery, SectorConnection, sequelize } = require('../models');
const { Op } = require('sequelize');

/**
 * Record that a user has discovered a sector.
 * Returns true if this was a new discovery, false if already known.
 */
const discoverSector = async (userId, sectorId, transaction = null) => {
  const [, created] = await PlayerDiscovery.findOrCreate({
    where: {
      user_id: userId,
      discovery_type: 'sector',
      target_id: sectorId
    },
    defaults: {
      user_id: userId,
      discovery_type: 'sector',
      target_id: sectorId,
      discovery_data: { discovered_at: new Date().toISOString() }
    },
    transaction
  });
  return created;
};

/**
 * Discover a sector and all its direct neighbors (1-hop).
 * Used when a player visits a new system.
 */
const discoverSectorAndNeighbors = async (userId, sectorId, transaction = null) => {
  const newDiscoveries = [];

  // Discover the sector itself
  const isNew = await discoverSector(userId, sectorId, transaction);
  if (isNew) newDiscoveries.push(sectorId);

  // Find all neighbor sector IDs
  const connections = await SectorConnection.findAll({
    where: {
      [Op.or]: [
        { sector_a_id: sectorId },
        { sector_b_id: sectorId }
      ]
    },
    attributes: ['sector_a_id', 'sector_b_id'],
    transaction
  });

  const neighborIds = new Set();
  for (const conn of connections) {
    if (conn.sector_a_id !== sectorId) neighborIds.add(conn.sector_a_id);
    if (conn.sector_b_id !== sectorId) neighborIds.add(conn.sector_b_id);
  }

  // Discover each neighbor
  for (const neighborId of neighborIds) {
    const neighborNew = await discoverSector(userId, neighborId, transaction);
    if (neighborNew) newDiscoveries.push(neighborId);
  }

  return newDiscoveries;
};

/**
 * Get all sector IDs discovered by a user.
 */
const getDiscoveredSectorIds = async (userId) => {
  const discoveries = await PlayerDiscovery.findAll({
    where: {
      user_id: userId,
      discovery_type: 'sector'
    },
    attributes: ['target_id']
  });
  return new Set(discoveries.map(d => d.target_id));
};

module.exports = {
  discoverSector,
  discoverSectorAndNeighbors,
  getDiscoveredSectorIds
};
