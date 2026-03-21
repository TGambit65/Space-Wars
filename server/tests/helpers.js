/**
 * Test helper functions and fixtures
 */
const { User, Ship, Sector, SectorConnection, Commodity, Port, PortCommodity, ShipCargo, Transaction, Component, ShipComponent, NPC, CombatLog, Planet, PlanetResource, Colony, Crew, Artifact, PlayerDiscovery, GameSetting, PriceHistory, PlayerSkill, TechResearch, Wonder, Blueprint, CraftingJob, Mission, PlayerMission, Corporation, CorporationMember, AutomatedTask, Job, ColonyBuilding, SurfaceAnomaly, CustomBlock, GroundUnit, GroundCombatUnit, GroundCombatInstance, FactionStanding, FactionWar, CombatInstance, Message, CosmeticUnlock, CorporationAgreement, CommunityEvent, EventContribution, Outpost, ShipDesignTemplate, Fleet, DailyQuest, VoxelBlock, PlayerProtectionState, ActionAuditLog, SectorInstanceAssignment, TransferLedger, ColonyRaidProtection, NpcConversationSession, NpcMemory, AgentAccount, AgentActionLog, sequelize } = require('../src/models');
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
const createSectorConnection = async (sectorAId, sectorBId, overrides = {}) => {
  return SectorConnection.create({
    sector_a_id: sectorAId,
    sector_b_id: sectorBId,
    connection_type: 'standard',
    is_bidirectional: true,
    ...overrides
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
  // Job queue
  await Job.destroy({ where: {} });
  // Agent system first — references User
  await AgentActionLog.destroy({ where: {} });
  await AgentAccount.destroy({ where: {} });
  // New models (Phases 1-7) first — they reference User/Corp/Sector
  await EventContribution.destroy({ where: {} });
  await CommunityEvent.destroy({ where: {} });
  await ActionAuditLog.destroy({ where: {} });
  await TransferLedger.destroy({ where: {} });
  await ShipDesignTemplate.destroy({ where: {} });
  await CosmeticUnlock.destroy({ where: {} });
  await CorporationAgreement.destroy({ where: {} });
  await Message.destroy({ where: {} });
  await CombatInstance.destroy({ where: {} });
  await Outpost.destroy({ where: {} });
  await FactionStanding.destroy({ where: {} });
  await FactionWar.destroy({ where: {} });
  // Phase 5 models first (most dependent)
  await AutomatedTask.destroy({ where: {} });
  await CorporationMember.destroy({ where: {} });
  await PlayerMission.destroy({ where: {} });
  await Mission.destroy({ where: {} });
  await CraftingJob.destroy({ where: {} });
  await Blueprint.destroy({ where: {} });
  await ColonyRaidProtection.destroy({ where: {} });
  await DailyQuest.destroy({ where: {} });
  await GroundCombatUnit.destroy({ where: {} });
  await GroundCombatInstance.destroy({ where: {} });
  await GroundUnit.destroy({ where: {} });
  await VoxelBlock.destroy({ where: {} });
  await CustomBlock.destroy({ where: {} });
  await SurfaceAnomaly.destroy({ where: {} });
  await ColonyBuilding.destroy({ where: {} });
  await Wonder.destroy({ where: {} });
  await TechResearch.destroy({ where: {} });
  await PlayerSkill.destroy({ where: {} });
  await PriceHistory.destroy({ where: {} });
  // NPC Memory + Conversation Sessions
  await NpcMemory.destroy({ where: {} });
  await NpcConversationSession.destroy({ where: {} });
  // AI NPC system
  await GameSetting.destroy({ where: {} });
  gameSettingsService.clearCache();
  // Phase 4 models
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
  // Fleet system - clear fleet_id on ships before deleting fleets
  await Ship.update({ fleet_id: null }, { where: {} });
  await Fleet.destroy({ where: {} });
  // Core models - Corporation before User due to FK
  await Ship.destroy({ where: {} });
  await SectorInstanceAssignment.destroy({ where: {} });
  await PlayerProtectionState.destroy({ where: {} });
  await SectorConnection.destroy({ where: {} });
  await Sector.destroy({ where: {} });
  await Commodity.destroy({ where: {} });
  await Component.destroy({ where: {} });
  // Clear corporation_id on users before deleting corporations
  await User.update({ corporation_id: null }, { where: {} });
  await Corporation.destroy({ where: {} });
  await User.destroy({ where: {} });
};

/**
 * Create a test NPC with AI fields
 */
const createTestNPC = async (sectorId, overrides = {}) => {
  const defaults = {
    name: `Test NPC ${Date.now()}`,
    npc_type: 'PIRATE',
    ship_type: 'Fighter',
    current_sector_id: sectorId,
    hull_points: 100,
    max_hull_points: 100,
    shield_points: 50,
    max_shield_points: 50,
    attack_power: 15,
    defense_rating: 8,
    speed: 10,
    aggression_level: 0.5,
    flee_threshold: 0.2,
    behavior_state: 'idle',
    intelligence_tier: 1,
    ai_personality: {
      trait_primary: 'cunning',
      trait_secondary: 'calculating',
      speech_style: 'formal',
      quirk: 'speaks in short clipped sentences',
      voice_profile: 'deep_gruff'
    },
    is_alive: true
  };
  return NPC.create({ ...defaults, ...overrides });
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

// ============== Phase C Helpers ==============

/**
 * Create a test colony building
 */
const createTestBuilding = async (colonyId, overrides = {}) => {
  const defaults = {
    colony_id: colonyId,
    building_type: 'SURFACE_MINE',
    level: 1,
    is_active: true,
    workforce: 50,
    condition: 1.0,
    last_production: null
  };
  return ColonyBuilding.create({ ...defaults, ...overrides });
};

// ============== Phase 5 Helpers ==============

/**
 * Create a test blueprint
 */
const createTestBlueprint = async (overrides = {}) => {
  const defaults = {
    name: `Blueprint ${Date.now()}`,
    category: 'component',
    output_type: 'component',
    output_name: 'Test Output',
    output_quantity: 1,
    crafting_time: 60000,
    required_level: 1,
    ingredients: [{ commodityName: 'Iron Ore', quantity: 5 }],
    credits_cost: 100,
    description: 'A test blueprint'
  };
  return Blueprint.create({ ...defaults, ...overrides });
};

/**
 * Create a test mission
 */
const createTestMission = async (portId, overrides = {}) => {
  const defaults = {
    port_id: portId,
    mission_type: 'delivery',
    title: `Mission ${Date.now()}`,
    description: 'A test mission',
    requirements: { destination_port_id: null, commodity_name: 'Iron Ore', quantity: 10 },
    reward_credits: 1000,
    reward_xp: 50,
    min_level: 1,
    max_level: 100,
    expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000),
    is_active: true
  };
  return Mission.create({ ...defaults, ...overrides });
};

/**
 * Create a test corporation
 */
const createTestCorporation = async (leaderUserId, overrides = {}) => {
  const defaults = {
    name: `Corp ${Date.now()}`,
    tag: `C${Date.now().toString().slice(-4)}`,
    leader_user_id: leaderUserId,
    treasury: 0,
    member_count: 1,
    is_active: true
  };
  return Corporation.create({ ...defaults, ...overrides });
};

/**
 * Create a test fleet
 */
const createTestFleet = async (userId, shipIds = [], overrides = {}) => {
  const fleet = await Fleet.create({
    owner_user_id: userId,
    name: overrides.name || `Fleet ${Date.now()}`,
    is_active: overrides.is_active !== undefined ? overrides.is_active : true
  });
  if (shipIds.length > 0) {
    const { Op } = require('sequelize');
    await Ship.update({ fleet_id: fleet.fleet_id }, { where: { ship_id: { [Op.in]: shipIds } } });
  }
  return fleet;
};

// ============== Ground Combat Helpers ==============

/**
 * Create a test ground unit at a colony
 */
const createTestGroundUnit = async (colonyId, userId, overrides = {}) => {
  const config = require('../src/config');
  const unitType = overrides.unit_type || 'militia';
  const unitConfig = config.groundCombat.unitTypes[unitType];
  const defaults = {
    owner_user_id: userId,
    unit_type: unitType,
    hp_max: unitConfig.hp,
    hp_remaining: unitConfig.hp,
    colony_id: colonyId,
    is_active: true,
    training_until: null
  };
  const { unit_type, ...restOverrides } = overrides;
  return GroundUnit.create({ ...defaults, ...restOverrides });
};

// ============== Job Queue Helpers ==============

/**
 * Create a test job
 */
const createTestJob = async (overrides = {}) => {
  const defaults = {
    type: 'test_job',
    payload: { test: true },
    status: 'pending',
    priority: 0,
    max_attempts: 3,
    attempts: 0,
    run_at: new Date()
  };
  return Job.create({ ...defaults, ...overrides });
};

// ============== Agent Helpers ==============

/**
 * Create a test agent account for a user
 */
const createTestAgent = async (userId, overrides = {}) => {
  const defaults = {
    owner_id: userId,
    name: `Test Agent ${Date.now()}`,
    status: 'stopped',
    permissions: {
      navigate: true,
      trade: true,
      scan: true,
      dock: true,
      combat: false,
      colony: false,
      fleet: false,
      social: false
    },
    daily_credit_limit: 5000,
    daily_credits_spent: 0,
    rate_limit_per_minute: 30,
    actions_this_minute: 0,
    directive: 'idle',
    directive_params: {}
  };
  return AgentAccount.create({ ...defaults, ...overrides });
};

/**
 * Create a test agent account and return the raw API key once.
 */
const createTestAgentWithKey = async (userId, overrides = {}) => {
  const agent = await createTestAgent(userId, overrides);
  const apiKey = agent.generateApiKey();
  await agent.save();
  return { agent, apiKey };
};

module.exports = {
  createTestUser, createTestSector, createTestShip, createSectorConnection,
  createTestCommodity, createTestPort, addCommodityToPort, addCargoToShip,
  // Phase 4 helpers
  createTestPlanet, createTestPlanetResource, createTestColony, createTestCrew, createTestArtifact,
  createTestGameSetting,
  // AI NPC helpers
  createTestNPC,
  // Phase C helpers
  createTestBuilding,
  // Phase 5 helpers
  createTestBlueprint, createTestMission, createTestCorporation,
  // Fleet helpers
  createTestFleet,
  // Ground combat helpers
  createTestGroundUnit,
  // Job queue helpers
  createTestJob,
  // Agent helpers
  createTestAgent, createTestAgentWithKey,
  cleanDatabase, generateTestToken
};
