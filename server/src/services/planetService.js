const { Planet, PlanetResource, Artifact, Sector, Ship, PlayerDiscovery, sequelize } = require('../models');
const config = require('../config');

/**
 * Scan a sector to discover planets (basic info)
 */
const scanSector = async (sectorId, userId, shipId) => {
  // Verify sector exists
  const sector = await Sector.findByPk(sectorId);
  if (!sector) {
    const error = new Error('Sector not found');
    error.statusCode = 404;
    throw error;
  }

  // Verify ship is in this sector (if shipId provided)
  if (shipId) {
    const ship = await Ship.findOne({
      where: { ship_id: shipId, owner_user_id: userId }
    });
    if (!ship) {
      const error = new Error('Ship not found');
      error.statusCode = 404;
      throw error;
    }
    if (ship.current_sector_id !== sectorId) {
      const error = new Error('Ship must be in the sector to scan it');
      error.statusCode = 400;
      throw error;
    }
  }

  // Get all planets in the sector (basic info)
  const planets = await Planet.findAll({
    where: { sector_id: sectorId },
    attributes: ['planet_id', 'name', 'type', 'size', 'gravity', 'temperature', 'habitability', 'has_artifact', 'owner_user_id', 'is_scanned'],
    include: [{ model: PlanetResource, as: 'resources', attributes: ['resource_type', 'abundance'] }]
  });

  // Mark all planets in sector as scanned and record discovery
  for (const planet of planets) {
    if (!planet.is_scanned) {
      await planet.update({ is_scanned: true });
    }
    await PlayerDiscovery.findOrCreate({
      where: {
        user_id: userId,
        discovery_type: 'planet',
        target_id: planet.planet_id
      },
      defaults: {
        discovery_data: { basic_scan: true }
      }
    });
  }

  return {
    sector_id: sectorId,
    sector_name: sector.name,
    planets: planets.map(p => ({
      planet_id: p.planet_id,
      name: p.name,
      type: p.type,
      size: p.size,
      gravity: p.gravity,
      temperature: p.temperature,
      habitability: p.habitability,
      has_artifact: p.has_artifact,
      is_colonized: !!p.owner_user_id,
      resources: p.resources ? p.resources.map(r => ({ resource_type: r.resource_type, abundance: r.abundance })) : []
    }))
  };
};

/**
 * Get detailed planet information (requires being in sector or deep scan)
 */
const getPlanetDetails = async (planetId, userId, shipId) => {
  const planet = await Planet.findByPk(planetId, {
    include: [
      { model: Sector, as: 'sector', attributes: ['sector_id', 'name', 'type'] },
      { model: PlanetResource, as: 'resources' }
    ]
  });

  if (!planet) {
    const error = new Error('Planet not found');
    error.statusCode = 404;
    throw error;
  }

  // Check if user has discovered this planet
  const discovery = await PlayerDiscovery.findOne({
    where: {
      user_id: userId,
      discovery_type: 'planet',
      target_id: planetId
    }
  });

  // Verify ship is in the planet's sector for detailed scan
  let hasDeepScan = false;
  if (shipId) {
    const ship = await Ship.findOne({
      where: { ship_id: shipId, owner_user_id: userId, current_sector_id: planet.sector_id }
    });
    if (ship) {
      hasDeepScan = true;
    }
  }

  // Check for artifact (only reveal if deep scanned)
  let artifactDetected = false;
  if (hasDeepScan && planet.has_artifact) {
    const artifact = await Artifact.findOne({
      where: { location_planet_id: planetId, is_discovered: false }
    });
    if (artifact) {
      artifactDetected = true;
      // Mark artifact as discovered
      await artifact.update({
        is_discovered: true,
        discovered_by_user_id: userId,
        discovered_at: new Date()
      });
      // Record artifact discovery
      await PlayerDiscovery.findOrCreate({
        where: {
          user_id: userId,
          discovery_type: 'artifact',
          target_id: artifact.artifact_id
        },
        defaults: {
          discovery_data: { planet_id: planetId, artifact_name: artifact.name }
        }
      });
    }
  }

  // Update discovery with detailed scan
  if (discovery) {
    await discovery.update({
      discovery_data: { ...discovery.discovery_data, detailed_scan: true }
    });
  }

  return {
    planet_id: planet.planet_id,
    name: planet.name,
    type: planet.type,
    size: planet.size,
    gravity: planet.gravity,
    temperature: planet.temperature,
    habitability: planet.habitability,
    has_artifact: planet.has_artifact,
    description: planet.description,
    is_colonized: !!planet.owner_user_id,
    owner_user_id: planet.owner_user_id,
    sector: planet.sector,
    resources: hasDeepScan ? planet.resources.map(r => ({
      resource_type: r.resource_type,
      abundance: r.abundance,
      total_quantity: r.total_quantity,
      remaining: r.total_quantity - r.extracted_quantity
    })) : [],
    artifact_detected: artifactDetected
  };
};

/**
 * Get all planets owned by a user
 */
const getUserPlanets = async (userId) => {
  const planets = await Planet.findAll({
    where: { owner_user_id: userId },
    include: [
      { model: Sector, as: 'sector', attributes: ['sector_id', 'name'] },
      { model: PlanetResource, as: 'resources' }
    ]
  });

  return planets;
};

/**
 * Get all artifacts discovered by a user
 */
const getUserArtifacts = async (userId) => {
  const artifacts = await Artifact.findAll({
    where: { discovered_by_user_id: userId },
    include: [
      { model: Planet, as: 'locationPlanet', attributes: ['planet_id', 'name'] }
    ]
  });

  return artifacts;
};

/**
 * Claim an artifact from a planet (user must own the planet)
 */
const claimArtifact = async (artifactId, userId) => {
  const artifact = await Artifact.findByPk(artifactId, {
    include: [{ model: Planet, as: 'locationPlanet' }]
  });

  if (!artifact) {
    const error = new Error('Artifact not found');
    error.statusCode = 404;
    throw error;
  }

  if (!artifact.is_discovered) {
    const error = new Error('Artifact has not been discovered yet');
    error.statusCode = 400;
    throw error;
  }

  if (artifact.owner_user_id) {
    const error = new Error('Artifact has already been claimed');
    error.statusCode = 400;
    throw error;
  }

  // User must own the planet to claim the artifact
  if (!artifact.locationPlanet || artifact.locationPlanet.owner_user_id !== userId) {
    const error = new Error('You must own the planet to claim this artifact');
    error.statusCode = 403;
    throw error;
  }

  await artifact.update({
    owner_user_id: userId,
    location_planet_id: null // Artifact is now in player's possession
  });

  return artifact;
};

module.exports = {
  scanSector,
  getPlanetDetails,
  getUserPlanets,
  getUserArtifacts,
  claimArtifact
};

