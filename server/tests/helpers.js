/**
 * Test helper functions and fixtures
 */
const { User, Ship, Sector, SectorConnection, Commodity, Port, PortCommodity, ShipCargo, Transaction, Component, ShipComponent, NPC, CombatLog, Planet, PlanetResource, Colony, Crew, Artifact, PlayerDiscovery, GameSetting, sequelize } = require('../src/models');
const authService = require('../src/services/authService');
const gameSettingsService = require('../src/services/gameSettingsService');
const bcrypt = require('bcryptjs');

/**
 * Create a test user directly in database
 */
const createTestUser = async (overrides = {}) => {
  const timestamp = Date.now();
  const defaults = {
    username: overrides.username || `testuser${timestamp}`,
    email: `test${timestamp}@example.com`,
    hashed_password: 'testpassword123', // Will be hashed by model hook
    credits: 10000
  };
  // Remove username from overrides if we already used it
  const { username, ...restOverrides } = overrides;
  return User.create({ ...defaults, ...restOverrides });
};

/**
 * Create a test sector
 */
const createTestSector = async (overrides = {}) => {
  const defaults = {
    name: `Test Sector ${Date.now()}`,
    type: 'Core',
    x_coord: Math.floor(Math.random() * 100),
    y_coord: Math.floor(Math.random() * 100),
    z_coord: 0,
    hazard_level: 1
  };
  return Sector.create({ ...defaults, ...overrides });
};

/**
 * Create a test ship for a user
 */
const createTestShip = async (userId, sectorId, overrides = {}) => {
  const defaults = {
    owner_user_id: userId,
    current_sector_id: sectorId,
    ship_type: 'Scout',
    name: `Test Ship ${Date.now()}`,
    hull_strength: 100,
    max_hull: 100,
    shields: 50,
    max_shields: 50,
    fuel: 100,
    max_fuel: 100,
    cargo_capacity: 50
  };
  return Ship.create({ ...defaults, ...overrides });
};

/**
 * Create a connection between two sectors
 */
const createSectorConnection = async (sectorAId, sectorBId) => {
  return SectorConnection.create({
    sector_a_id: sectorAId,
    sector_b_id: sectorBId,
    connection_type: 'standard',
    is_bidirectional: true
  });
};

/**
 * Create a test commodity
 */
const createTestCommodity = async (overrides = {}) => {
  const defaults = {
    name: `Commodity${Date.now()}`,
    category: 'Essential',
    base_price: 100,
    volatility: 0.2,
    volume_per_unit: 1,
    description: 'Test commodity',
    is_legal: true
  };
  return Commodity.create({ ...defaults, ...overrides });
};

/**
 * Create a test port in a sector
 */
const createTestPort = async (sectorId, overrides = {}) => {
  const defaults = {
    sector_id: sectorId,
    name: `Test Port ${Date.now()}`,
    type: 'Trading Hub',
    tax_rate: 0.05,
    is_active: true,
    allows_illegal: false
  };
  return Port.create({ ...defaults, ...overrides });
};

/**
 * Add a commodity to a port
 */
const addCommodityToPort = async (portId, commodityId, overrides = {}) => {
  const defaults = {
    port_id: portId,
    commodity_id: commodityId,
    quantity: 500,
    max_quantity: 1000,
    buy_price_modifier: 1.0,
    sell_price_modifier: 1.0,
    production_rate: 0,
    consumption_rate: 0,
    can_buy: true,
    can_sell: true
  };
  return PortCommodity.create({ ...defaults, ...overrides });
};

/**
 * Add cargo to a ship
 */
const addCargoToShip = async (shipId, commodityId, quantity) => {
  return ShipCargo.create({
    ship_id: shipId,
    commodity_id: commodityId,
    quantity
  });
};

// ============== Phase 4 Helpers ==============

/**
 * Create a test planet
 */
const createTestPlanet = async (sectorId, overrides = {}) => {
  const defaults = {
    sector_id: sectorId,
    name: `Test Planet ${Date.now()}`,
    type: 'Terran',
    size: 5,
    gravity: 1.0,
    habitability: 0.8,
    has_artifact: false,
    description: 'A test planet'
  };
  return Planet.create({ ...defaults, ...overrides });
};

/**
 * Create a test planet resource
 */
const createTestPlanetResource = async (planetId, overrides = {}) => {
  const defaults = {
    planet_id: planetId,
    resource_type: 'Iron Ore',
    abundance: 1.5,
    total_quantity: 10000,
    extracted_quantity: 0
  };
  return PlanetResource.create({ ...defaults, ...overrides });
};

/**
 * Create a test colony
 */
const createTestColony = async (planetId, userId, overrides = {}) => {
  const defaults = {
    planet_id: planetId,
    user_id: userId,
    name: `Test Colony ${Date.now()}`,
    population: 100,
    infrastructure_level: 1,
    last_resource_tick: new Date(Date.now() - 2 * 60 * 60 * 1000), // 2 hours ago
    is_active: true
  };
  return Colony.create({ ...defaults, ...overrides });
};

/**
 * Create a test crew member
 */
const createTestCrew = async (portId = null, userId = null, shipId = null, overrides = {}) => {
  const defaults = {
    name: `Test Crew ${Date.now()}`,
    species: 'Human',
    level: 1,
    xp: 0,
    salary: 100,
    port_id: portId,
    owner_user_id: userId,
    current_ship_id: shipId,
    is_active: true
  };
  return Crew.create({ ...defaults, ...overrides });
};

/**
 * Create a test artifact
 */
const createTestArtifact = async (planetId, overrides = {}) => {
  const defaults = {
    name: `Test Artifact ${Date.now()}`,
    description: 'A mysterious artifact',
    bonus_type: 'navigation',
    bonus_value: 0,
    rarity: 0.1,
    location_planet_id: planetId,
    is_discovered: false
  };
  return Artifact.create({ ...defaults, ...overrides });
};

/**
 * Clean all test data
 * Note: SQLite doesn't support TRUNCATE, so we use destroy with where: {}
 */
/**
 * Create a test game setting
 */
const createTestGameSetting = async (overrides = {}) => {
  const defaults = {
    category: 'general',
    key: `test.setting.${Date.now()}`,
    value: 'test_value',
    value_type: 'string',
    is_secret: false,
    description: 'Test setting'
  };
  return GameSetting.create({ ...defaults, ...overrides });
};

const cleanDatabase = async () => {
  // Delete in order to respect foreign key constraints
  // AI NPC system
  await GameSetting.destroy({ where: {} });
  gameSettingsService.clearCache();
  // Phase 4 models first
  await PlayerDiscovery.destroy({ where: {} });
  await Artifact.destroy({ where: {} });
  await Colony.destroy({ where: {} });
  await Crew.destroy({ where: {} });
  await PlanetResource.destroy({ where: {} });
  await Planet.destroy({ where: {} });
  // Phase 3 models
  await CombatLog.destroy({ where: {} });
  await ShipComponent.destroy({ where: {} });
  await NPC.destroy({ where: {} });
  // Phase 2 models
  await Transaction.destroy({ where: {} });
  await ShipCargo.destroy({ where: {} });
  await PortCommodity.destroy({ where: {} });
  await Port.destroy({ where: {} });
  // Core models
  await Ship.destroy({ where: {} });
  await SectorConnection.destroy({ where: {} });
  await Sector.destroy({ where: {} });
  await Commodity.destroy({ where: {} });
  await Component.destroy({ where: {} });
  await User.destroy({ where: {} });
};

/**
 * Generate a valid JWT token for a user
 */
const generateTestToken = (user) => {
  const jwt = require('jsonwebtoken');
  const config = require('../src/config');
  return jwt.sign(
    { user_id: user.user_id, username: user.username },
    config.jwt.secret,
    { expiresIn: '1h' }
  );
};

module.exports = {
  createTestUser, createTestSector, createTestShip, createSectorConnection,
  createTestCommodity, createTestPort, addCommodityToPort, addCargoToShip,
  // Phase 4 helpers
  createTestPlanet, createTestPlanetResource, createTestColony, createTestCrew, createTestArtifact,
  createTestGameSetting,
  cleanDatabase, generateTestToken
};

