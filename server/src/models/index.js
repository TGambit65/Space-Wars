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
// Phase C: Colony Buildings
const ColonyBuilding = require('./ColonyBuilding');
// Colony Surface
const SurfaceAnomaly = require('./SurfaceAnomaly');
const CustomBlock = require('./CustomBlock');
// Faction & Warfare
const FactionStanding = require('./FactionStanding');
const FactionWar = require('./FactionWar');
// Real-time Combat
const CombatInstance = require('./CombatInstance');
// Messaging
const Message = require('./Message');
// Visual Customization
const CosmeticUnlock = require('./CosmeticUnlock');
// Fleet System
const Fleet = require('./Fleet');
// Ground Combat
const GroundUnit = require('./GroundUnit');
const GroundCombatUnit = require('./GroundCombatUnit');
const GroundCombatInstance = require('./GroundCombatInstance');
// Daily Quests
const DailyQuest = require('./DailyQuest');
// Voxel Blocks
const VoxelBlock = require('./VoxelBlock');
// NPC Conversation Sessions
const NpcConversationSession = require('./NpcConversationSession');
// AI Agent System
const AgentAccount = require('./AgentAccount');
const AgentActionLog = require('./AgentActionLog');
const PlayerProtectionState = require('./PlayerProtectionState');
const ActionAuditLog = require('./ActionAuditLog');
const SectorInstanceAssignment = require('./SectorInstanceAssignment');
const TransferLedger = require('./TransferLedger');
const ColonyRaidProtection = require('./ColonyRaidProtection');
// Phase 7: Agreements, Events, Outposts, Templates
const CorporationAgreement = require('./CorporationAgreement');
const CommunityEvent = require('./CommunityEvent');
const EventContribution = require('./EventContribution');
const Outpost = require('./Outpost');
const ShipDesignTemplate = require('./ShipDesignTemplate');

// Define relationships

// User <-> Ship (One-to-Many)
User.hasMany(Ship, { foreignKey: 'owner_user_id', as: 'ships' });
Ship.belongsTo(User, { foreignKey: 'owner_user_id', as: 'owner' });

// Sector <-> Ship (One-to-Many)
Sector.hasMany(Ship, { foreignKey: 'current_sector_id', as: 'ships' });
Ship.belongsTo(Sector, { foreignKey: 'current_sector_id', as: 'currentSector' });

// Sector ownership / access policy support
User.hasMany(Sector, { foreignKey: 'owner_user_id', as: 'ownedSectors' });
Sector.belongsTo(User, { foreignKey: 'owner_user_id', as: 'ownerUser' });

Corporation.hasMany(Sector, { foreignKey: 'owner_corporation_id', as: 'ownedSectors' });
Sector.belongsTo(Corporation, { foreignKey: 'owner_corporation_id', as: 'ownerCorporation' });

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

// Phase C: Colony Buildings
Colony.hasMany(ColonyBuilding, { foreignKey: 'colony_id', as: 'buildings' });
ColonyBuilding.belongsTo(Colony, { foreignKey: 'colony_id', as: 'colony' });

// Colony Surface Anomalies
Colony.hasMany(SurfaceAnomaly, { foreignKey: 'colony_id', as: 'anomalies' });
SurfaceAnomaly.belongsTo(Colony, { foreignKey: 'colony_id', as: 'colony' });

// Custom Blocks
Colony.hasMany(CustomBlock, { foreignKey: 'colony_id', as: 'customBlocks' });
CustomBlock.belongsTo(Colony, { foreignKey: 'colony_id', as: 'colony' });

// ============== Faction & Warfare ==============
User.hasMany(FactionStanding, { foreignKey: 'user_id', as: 'factionStandings' });
FactionStanding.belongsTo(User, { foreignKey: 'user_id', as: 'user' });

// ============== Real-time Combat ==============
Sector.hasMany(CombatInstance, { foreignKey: 'sector_id', as: 'combatInstances' });
CombatInstance.belongsTo(Sector, { foreignKey: 'sector_id', as: 'sector' });

// ============== Messaging ==============
User.hasMany(Message, { foreignKey: 'sender_user_id', as: 'sentMessages' });
Message.belongsTo(User, { foreignKey: 'sender_user_id', as: 'sender' });
User.hasMany(Message, { foreignKey: 'recipient_user_id', as: 'receivedMessages' });
Message.belongsTo(User, { foreignKey: 'recipient_user_id', as: 'recipient' });
Corporation.hasMany(Message, { foreignKey: 'corporation_id', as: 'messages' });
Message.belongsTo(Corporation, { foreignKey: 'corporation_id', as: 'corporation' });

// ============== Cosmetic Unlocks ==============
User.hasMany(CosmeticUnlock, { foreignKey: 'user_id', as: 'cosmeticUnlocks' });
CosmeticUnlock.belongsTo(User, { foreignKey: 'user_id', as: 'user' });

// ============== Corporation Agreements ==============
Corporation.hasMany(CorporationAgreement, { foreignKey: 'proposer_corp_id', as: 'proposedAgreements' });
CorporationAgreement.belongsTo(Corporation, { foreignKey: 'proposer_corp_id', as: 'proposer' });
Corporation.hasMany(CorporationAgreement, { foreignKey: 'target_corp_id', as: 'receivedAgreements' });
CorporationAgreement.belongsTo(Corporation, { foreignKey: 'target_corp_id', as: 'target' });

// ============== Community Events ==============
CommunityEvent.hasMany(EventContribution, { foreignKey: 'event_id', as: 'contributions' });
EventContribution.belongsTo(CommunityEvent, { foreignKey: 'event_id', as: 'event' });
User.hasMany(EventContribution, { foreignKey: 'user_id', as: 'eventContributions' });
EventContribution.belongsTo(User, { foreignKey: 'user_id', as: 'user' });

// ============== Outposts ==============
User.hasMany(Outpost, { foreignKey: 'user_id', as: 'outposts' });
Outpost.belongsTo(User, { foreignKey: 'user_id', as: 'owner' });
Corporation.hasMany(Outpost, { foreignKey: 'corporation_id', as: 'outposts' });
Outpost.belongsTo(Corporation, { foreignKey: 'corporation_id', as: 'corporation' });
Sector.hasMany(Outpost, { foreignKey: 'sector_id', as: 'outposts' });
Outpost.belongsTo(Sector, { foreignKey: 'sector_id', as: 'sector' });

// ============== Fleet System ==============
User.hasMany(Fleet, { foreignKey: 'owner_user_id', as: 'fleets' });
Fleet.belongsTo(User, { foreignKey: 'owner_user_id', as: 'owner' });
Fleet.hasMany(Ship, { foreignKey: 'fleet_id', as: 'ships' });
Ship.belongsTo(Fleet, { foreignKey: 'fleet_id', as: 'fleet' });

// ============== Ship Design Templates ==============
User.hasMany(ShipDesignTemplate, { foreignKey: 'user_id', as: 'designTemplates' });
ShipDesignTemplate.belongsTo(User, { foreignKey: 'user_id', as: 'user' });

// ============== Ground Combat ==============
// GroundUnit — persistent roster
User.hasMany(GroundUnit, { foreignKey: 'owner_user_id', as: 'groundUnits' });
GroundUnit.belongsTo(User, { foreignKey: 'owner_user_id', as: 'owner' });
Colony.hasMany(GroundUnit, { foreignKey: 'colony_id', as: 'garrison' });
GroundUnit.belongsTo(Colony, { foreignKey: 'colony_id', as: 'colony' });
Ship.hasMany(GroundUnit, { foreignKey: 'ship_id', as: 'groundUnits' });
GroundUnit.belongsTo(Ship, { foreignKey: 'ship_id', as: 'ship' });

// GroundCombatInstance
Colony.hasMany(GroundCombatInstance, { foreignKey: 'colony_id', as: 'groundCombatInstances' });
GroundCombatInstance.belongsTo(Colony, { foreignKey: 'colony_id', as: 'colony' });
User.hasMany(GroundCombatInstance, { foreignKey: 'attacker_id', as: 'attackingCombats' });
GroundCombatInstance.belongsTo(User, { foreignKey: 'attacker_id', as: 'attacker' });
Ship.hasMany(GroundCombatInstance, { foreignKey: 'attacker_ship_id', as: 'groundCombatInstances' });
GroundCombatInstance.belongsTo(Ship, { foreignKey: 'attacker_ship_id', as: 'attackerShip' });

// GroundCombatUnit — per-instance snapshots
GroundCombatInstance.hasMany(GroundCombatUnit, { foreignKey: 'combat_instance_id', as: 'combatUnits' });
GroundCombatUnit.belongsTo(GroundCombatInstance, { foreignKey: 'combat_instance_id', as: 'combatInstance' });
GroundUnit.hasMany(GroundCombatUnit, { foreignKey: 'source_unit_id', as: 'combatSnapshots' });
GroundCombatUnit.belongsTo(GroundUnit, { foreignKey: 'source_unit_id', as: 'sourceUnit' });

// ============== Daily Quests ==============
User.hasMany(DailyQuest, { foreignKey: 'user_id', as: 'dailyQuests' });
DailyQuest.belongsTo(User, { foreignKey: 'user_id', as: 'user' });

// ============== Voxel Blocks ==============
Colony.hasMany(VoxelBlock, { foreignKey: 'colony_id', as: 'voxelBlocks' });
VoxelBlock.belongsTo(Colony, { foreignKey: 'colony_id' });
User.hasMany(VoxelBlock, { foreignKey: 'placed_by', as: 'placedVoxels' });
VoxelBlock.belongsTo(User, { foreignKey: 'placed_by', as: 'placer' });

// ============== NPC Conversation Sessions ==============
NPC.hasMany(NpcConversationSession, { foreignKey: 'npc_id', as: 'conversationSessions' });
NpcConversationSession.belongsTo(NPC, { foreignKey: 'npc_id', as: 'npc' });
User.hasMany(NpcConversationSession, { foreignKey: 'user_id', as: 'npcConversations' });
NpcConversationSession.belongsTo(User, { foreignKey: 'user_id', as: 'user' });

// ============== AI Agent System ==============
User.hasOne(AgentAccount, { foreignKey: 'owner_id', as: 'agentAccount' });
AgentAccount.belongsTo(User, { foreignKey: 'owner_id', as: 'owner' });
AgentAccount.belongsTo(Ship, { foreignKey: 'ship_id', as: 'ship' });
Ship.hasOne(AgentAccount, { foreignKey: 'ship_id', as: 'agentAccount' });
AgentAccount.hasMany(AgentActionLog, { foreignKey: 'agent_id', as: 'actionLogs' });
AgentActionLog.belongsTo(AgentAccount, { foreignKey: 'agent_id', as: 'agent' });
User.hasMany(AgentActionLog, { foreignKey: 'owner_id', as: 'agentActionLogs' });
AgentActionLog.belongsTo(User, { foreignKey: 'owner_id', as: 'owner' });

// ============== Anti-Cheat / Anti-Grief ==============
User.hasOne(PlayerProtectionState, { foreignKey: 'user_id', as: 'protectionState' });
PlayerProtectionState.belongsTo(User, { foreignKey: 'user_id', as: 'user' });
User.hasMany(ActionAuditLog, { foreignKey: 'user_id', as: 'actionAuditLogs' });
ActionAuditLog.belongsTo(User, { foreignKey: 'user_id', as: 'user' });
User.hasMany(SectorInstanceAssignment, { foreignKey: 'user_id', as: 'sectorInstanceAssignments' });
SectorInstanceAssignment.belongsTo(User, { foreignKey: 'user_id', as: 'user' });
Sector.hasMany(SectorInstanceAssignment, { foreignKey: 'sector_id', as: 'instanceAssignments' });
SectorInstanceAssignment.belongsTo(Sector, { foreignKey: 'sector_id', as: 'sector' });
User.hasMany(TransferLedger, { foreignKey: 'user_id', as: 'transferLedgerEntries' });
TransferLedger.belongsTo(User, { foreignKey: 'user_id', as: 'user' });
Commodity.hasMany(TransferLedger, { foreignKey: 'commodity_id', as: 'transferLedgerEntries' });
TransferLedger.belongsTo(Commodity, { foreignKey: 'commodity_id', as: 'commodity' });
Colony.hasOne(ColonyRaidProtection, { foreignKey: 'colony_id', as: 'raidProtection' });
ColonyRaidProtection.belongsTo(Colony, { foreignKey: 'colony_id', as: 'colony' });
User.hasMany(ColonyRaidProtection, { foreignKey: 'last_attacker_id', as: 'recentRaidTargets' });
ColonyRaidProtection.belongsTo(User, { foreignKey: 'last_attacker_id', as: 'lastAttacker' });

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
  AutomatedTask,
  // Phase C
  ColonyBuilding,
  // Colony Surface
  SurfaceAnomaly,
  CustomBlock,
  // Factions & Warfare
  FactionStanding,
  FactionWar,
  // Real-time Combat
  CombatInstance,
  // Messaging
  Message,
  // Cosmetics
  CosmeticUnlock,
  // Fleet System
  Fleet,
  // Ground Combat
  GroundUnit,
  GroundCombatUnit,
  GroundCombatInstance,
  // Phase 7
  CorporationAgreement,
  CommunityEvent,
  EventContribution,
  Outpost,
  ShipDesignTemplate,
  // Daily Quests
  DailyQuest,
  // Voxel Blocks
  VoxelBlock,
  PlayerProtectionState,
  ActionAuditLog,
  SectorInstanceAssignment,
  TransferLedger,
  ColonyRaidProtection,
  // NPC Conversation Sessions
  NpcConversationSession,
  // AI Agent System
  AgentAccount,
  AgentActionLog
};
