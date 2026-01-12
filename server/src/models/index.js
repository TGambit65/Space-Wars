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
  CombatLog
};

