const { sequelize } = require('../config/database');
const User = require('./User');
const Sector = require('./Sector');
const SectorConnection = require('./SectorConnection');
const Ship = require('./Ship');
const Commodity = require('./Commodity');
const Port = require('./Port');
const PortCommodity = require('./PortCommodity');
const ShipCargo = require('./ShipCargo');
const Transaction = require('./Transaction');
// Phase 3: Combat & Ship Designer
const Component = require('./Component');
const ShipComponent = require('./ShipComponent');
const NPC = require('./NPC');
const CombatLog = require('./CombatLog');
// Phase 4: Planets, Colonization & Crew
const Planet = require('./Planet');
const PlanetResource = require('./PlanetResource');
const Colony = require('./Colony');
const Crew = require('./Crew');
const Artifact = require('./Artifact');
const PlayerDiscovery = require('./PlayerDiscovery');
// AI NPC System
const GameSetting = require('./GameSetting');
// Phase 5: Advanced Features
const PriceHistory = require('./PriceHistory');
const PlayerSkill = require('./PlayerSkill');
const TechResearch = require('./TechResearch');
const Wonder = require('./Wonder');
const Blueprint = require('./Blueprint');
const CraftingJob = require('./CraftingJob');
const Mission = require('./Mission');
const PlayerMission = require('./PlayerMission');
const Corporation = require('./Corporation');
const CorporationMember = require('./CorporationMember');
const AutomatedTask = require('./AutomatedTask');

// Define relationships

// User <-> Ship (One-to-Many)
User.hasMany(Ship, { foreignKey: 'owner_user_id', as: 'ships' });
Ship.belongsTo(User, { foreignKey: 'owner_user_id', as: 'owner' });

// Sector <-> Ship (One-to-Many)
Sector.hasMany(Ship, { foreignKey: 'current_sector_id', as: 'ships' });
Ship.belongsTo(Sector, { foreignKey: 'current_sector_id', as: 'currentSector' });

// Sector <-> SectorConnection (Many-to-Many through SectorConnection)
Sector.belongsToMany(Sector, {
  through: SectorConnection,
  as: 'connectedSectors',
  foreignKey: 'sector_a_id',
  otherKey: 'sector_b_id'
});

// Also define reverse relationship for bidirectional queries
Sector.belongsToMany(Sector, {
  through: SectorConnection,
  as: 'incomingConnections',
  foreignKey: 'sector_b_id',
  otherKey: 'sector_a_id'
});

// Direct associations for SectorConnection
SectorConnection.belongsTo(Sector, { foreignKey: 'sector_a_id', as: 'sectorA' });
SectorConnection.belongsTo(Sector, { foreignKey: 'sector_b_id', as: 'sectorB' });

// ============== Phase 2: Trading & Economy ==============

// Sector <-> Port (One-to-Many)
Sector.hasMany(Port, { foreignKey: 'sector_id', as: 'ports' });
Port.belongsTo(Sector, { foreignKey: 'sector_id', as: 'sector' });

// Port <-> PortCommodity <-> Commodity (Many-to-Many through PortCommodity)
Port.hasMany(PortCommodity, { foreignKey: 'port_id', as: 'portCommodities' });
PortCommodity.belongsTo(Port, { foreignKey: 'port_id', as: 'port' });

Commodity.hasMany(PortCommodity, { foreignKey: 'commodity_id', as: 'portCommodities' });
PortCommodity.belongsTo(Commodity, { foreignKey: 'commodity_id', as: 'commodity' });

// Ship <-> ShipCargo <-> Commodity (Many-to-Many through ShipCargo)
Ship.hasMany(ShipCargo, { foreignKey: 'ship_id', as: 'cargo' });
ShipCargo.belongsTo(Ship, { foreignKey: 'ship_id', as: 'ship' });

Commodity.hasMany(ShipCargo, { foreignKey: 'commodity_id', as: 'shipCargo' });
ShipCargo.belongsTo(Commodity, { foreignKey: 'commodity_id', as: 'commodity' });

// Transaction relationships
User.hasMany(Transaction, { foreignKey: 'user_id', as: 'transactions' });
Transaction.belongsTo(User, { foreignKey: 'user_id', as: 'user' });

Ship.hasMany(Transaction, { foreignKey: 'ship_id', as: 'transactions' });
Transaction.belongsTo(Ship, { foreignKey: 'ship_id', as: 'ship' });

Port.hasMany(Transaction, { foreignKey: 'port_id', as: 'transactions' });
Transaction.belongsTo(Port, { foreignKey: 'port_id', as: 'port' });

Commodity.hasMany(Transaction, { foreignKey: 'commodity_id', as: 'transactions' });
Transaction.belongsTo(Commodity, { foreignKey: 'commodity_id', as: 'commodity' });

// ============== Phase 3: Ship Designer & Combat ==============

// Ship <-> ShipComponent <-> Component (Many-to-Many through ShipComponent)
Ship.hasMany(ShipComponent, { foreignKey: 'ship_id', as: 'components' });
ShipComponent.belongsTo(Ship, { foreignKey: 'ship_id', as: 'ship' });

Component.hasMany(ShipComponent, { foreignKey: 'component_id', as: 'shipComponents' });
ShipComponent.belongsTo(Component, { foreignKey: 'component_id', as: 'component' });

// Sector <-> NPC (One-to-Many)
Sector.hasMany(NPC, { foreignKey: 'current_sector_id', as: 'npcs' });
NPC.belongsTo(Sector, { foreignKey: 'current_sector_id', as: 'currentSector' });

// CombatLog relationships
Ship.hasMany(CombatLog, { foreignKey: 'attacker_ship_id', as: 'attackerLogs' });
Ship.hasMany(CombatLog, { foreignKey: 'defender_ship_id', as: 'defenderLogs' });
CombatLog.belongsTo(Ship, { foreignKey: 'attacker_ship_id', as: 'attackerShip' });
CombatLog.belongsTo(Ship, { foreignKey: 'defender_ship_id', as: 'defenderShip' });

NPC.hasMany(CombatLog, { foreignKey: 'attacker_npc_id', as: 'attackerLogs' });
NPC.hasMany(CombatLog, { foreignKey: 'defender_npc_id', as: 'defenderLogs' });
CombatLog.belongsTo(NPC, { foreignKey: 'attacker_npc_id', as: 'attackerNpc' });
CombatLog.belongsTo(NPC, { foreignKey: 'defender_npc_id', as: 'defenderNpc' });

Sector.hasMany(CombatLog, { foreignKey: 'sector_id', as: 'combatLogs' });
CombatLog.belongsTo(Sector, { foreignKey: 'sector_id', as: 'sector' });

// ============== Phase 4: Planets, Colonization & Crew ==============

// Sector <-> Planet (One-to-Many)
Sector.hasMany(Planet, { foreignKey: 'sector_id', as: 'planets' });
Planet.belongsTo(Sector, { foreignKey: 'sector_id', as: 'sector' });

// User <-> Planet (One-to-Many for ownership)
User.hasMany(Planet, { foreignKey: 'owner_user_id', as: 'ownedPlanets' });
Planet.belongsTo(User, { foreignKey: 'owner_user_id', as: 'owner' });

// Planet <-> PlanetResource (One-to-Many)
Planet.hasMany(PlanetResource, { foreignKey: 'planet_id', as: 'resources' });
PlanetResource.belongsTo(Planet, { foreignKey: 'planet_id', as: 'planet' });

// Planet <-> Colony (One-to-One)
Planet.hasOne(Colony, { foreignKey: 'planet_id', as: 'colony' });
Colony.belongsTo(Planet, { foreignKey: 'planet_id', as: 'planet' });

// User <-> Colony (One-to-Many)
User.hasMany(Colony, { foreignKey: 'user_id', as: 'colonies' });
Colony.belongsTo(User, { foreignKey: 'user_id', as: 'owner' });

// Ship <-> Crew (One-to-Many)
Ship.hasMany(Crew, { foreignKey: 'current_ship_id', as: 'crew' });
Crew.belongsTo(Ship, { foreignKey: 'current_ship_id', as: 'ship' });

// User <-> Crew (One-to-Many for ownership)
User.hasMany(Crew, { foreignKey: 'owner_user_id', as: 'hiredCrew' });
Crew.belongsTo(User, { foreignKey: 'owner_user_id', as: 'owner' });

// Port <-> Crew (One-to-Many for available crew at port)
Port.hasMany(Crew, { foreignKey: 'port_id', as: 'availableCrew' });
Crew.belongsTo(Port, { foreignKey: 'port_id', as: 'port' });

// Planet <-> Artifact (One-to-Many)
Planet.hasMany(Artifact, { foreignKey: 'location_planet_id', as: 'artifacts' });
Artifact.belongsTo(Planet, { foreignKey: 'location_planet_id', as: 'locationPlanet' });

// User <-> Artifact (One-to-Many for ownership)
User.hasMany(Artifact, { foreignKey: 'owner_user_id', as: 'ownedArtifacts' });
Artifact.belongsTo(User, { foreignKey: 'owner_user_id', as: 'owner' });

// User <-> Artifact (discoverer relationship)
User.hasMany(Artifact, { foreignKey: 'discovered_by_user_id', as: 'discoveredArtifacts' });
Artifact.belongsTo(User, { foreignKey: 'discovered_by_user_id', as: 'discoverer' });

// User <-> PlayerDiscovery (One-to-Many)
User.hasMany(PlayerDiscovery, { foreignKey: 'user_id', as: 'discoveries' });
PlayerDiscovery.belongsTo(User, { foreignKey: 'user_id', as: 'user' });

// ============== Phase 5: Advanced Features ==============

// Ship <-> Artifact (equipped artifacts)
Ship.hasMany(Artifact, { foreignKey: 'equipped_ship_id', as: 'equippedArtifacts' });
Artifact.belongsTo(Ship, { foreignKey: 'equipped_ship_id', as: 'equippedShip' });

// PriceHistory relationships
Port.hasMany(PriceHistory, { foreignKey: 'port_id', as: 'priceHistory' });
PriceHistory.belongsTo(Port, { foreignKey: 'port_id', as: 'port' });
Commodity.hasMany(PriceHistory, { foreignKey: 'commodity_id', as: 'priceHistory' });
PriceHistory.belongsTo(Commodity, { foreignKey: 'commodity_id', as: 'commodity' });

// User <-> PlayerSkill (One-to-Many)
User.hasMany(PlayerSkill, { foreignKey: 'user_id', as: 'skills' });
PlayerSkill.belongsTo(User, { foreignKey: 'user_id', as: 'user' });

// User <-> TechResearch (One-to-Many)
User.hasMany(TechResearch, { foreignKey: 'user_id', as: 'techResearch' });
TechResearch.belongsTo(User, { foreignKey: 'user_id', as: 'user' });

// Colony <-> Wonder (One-to-Many)
Colony.hasMany(Wonder, { foreignKey: 'colony_id', as: 'wonders' });
Wonder.belongsTo(Colony, { foreignKey: 'colony_id', as: 'colony' });

// CraftingJob relationships
User.hasMany(CraftingJob, { foreignKey: 'user_id', as: 'craftingJobs' });
CraftingJob.belongsTo(User, { foreignKey: 'user_id', as: 'user' });
Blueprint.hasMany(CraftingJob, { foreignKey: 'blueprint_id', as: 'craftingJobs' });
CraftingJob.belongsTo(Blueprint, { foreignKey: 'blueprint_id', as: 'blueprint' });
Ship.hasMany(CraftingJob, { foreignKey: 'ship_id', as: 'craftingJobs' });
CraftingJob.belongsTo(Ship, { foreignKey: 'ship_id', as: 'ship' });

// Mission relationships
Port.hasMany(Mission, { foreignKey: 'port_id', as: 'missions' });
Mission.belongsTo(Port, { foreignKey: 'port_id', as: 'port' });

// PlayerMission relationships
User.hasMany(PlayerMission, { foreignKey: 'user_id', as: 'playerMissions' });
PlayerMission.belongsTo(User, { foreignKey: 'user_id', as: 'user' });
Mission.hasMany(PlayerMission, { foreignKey: 'mission_id', as: 'playerMissions' });
PlayerMission.belongsTo(Mission, { foreignKey: 'mission_id', as: 'mission' });

// Corporation relationships
Corporation.belongsTo(User, { foreignKey: 'leader_user_id', as: 'leader' });
User.hasOne(Corporation, { foreignKey: 'leader_user_id', as: 'ledCorporation' });

// User <-> Corporation (membership)
Corporation.hasMany(User, { foreignKey: 'corporation_id', as: 'members' });
User.belongsTo(Corporation, { foreignKey: 'corporation_id', as: 'corporation' });

// CorporationMember relationships
Corporation.hasMany(CorporationMember, { foreignKey: 'corporation_id', as: 'corporationMembers' });
CorporationMember.belongsTo(Corporation, { foreignKey: 'corporation_id', as: 'corporation' });
User.hasMany(CorporationMember, { foreignKey: 'user_id', as: 'corporationMemberships' });
CorporationMember.belongsTo(User, { foreignKey: 'user_id', as: 'user' });

// AutomatedTask relationships
User.hasMany(AutomatedTask, { foreignKey: 'user_id', as: 'automatedTasks' });
AutomatedTask.belongsTo(User, { foreignKey: 'user_id', as: 'user' });
Ship.hasMany(AutomatedTask, { foreignKey: 'ship_id', as: 'automatedTasks' });
AutomatedTask.belongsTo(Ship, { foreignKey: 'ship_id', as: 'ship' });

module.exports = {
  sequelize,
  User,
  Sector,
  SectorConnection,
  Ship,
  Commodity,
  Port,
  PortCommodity,
  ShipCargo,
  Transaction,
  // Phase 3
  Component,
  ShipComponent,
  NPC,
  CombatLog,
  // Phase 4
  Planet,
  PlanetResource,
  Colony,
  Crew,
  Artifact,
  PlayerDiscovery,
  // AI NPC System
  GameSetting,
  // Phase 5
  PriceHistory,
  PlayerSkill,
  TechResearch,
  Wonder,
  Blueprint,
  CraftingJob,
  Mission,
  PlayerMission,
  Corporation,
  CorporationMember,
  AutomatedTask
};

