const { Sector, SectorConnection, Commodity, Port, PortCommodity, Component, NPC, sequelize } = require('../models');
const config = require('../config');
const npcService = require('./npcService');

// Simple seeded random number generator
class SeededRandom {
  constructor(seed) {
    this.seed = seed;
  }
  
  next() {
    this.seed = (this.seed * 1103515245 + 12345) & 0x7fffffff;
    return this.seed / 0x7fffffff;
  }
  
  nextInt(min, max) {
    return Math.floor(this.next() * (max - min + 1)) + min;
  }
}

const SECTOR_NAMES = [
  'Alpha', 'Beta', 'Gamma', 'Delta', 'Epsilon', 'Zeta', 'Eta', 'Theta',
  'Iota', 'Kappa', 'Lambda', 'Mu', 'Nu', 'Xi', 'Omicron', 'Pi',
  'Rho', 'Sigma', 'Tau', 'Upsilon', 'Phi', 'Chi', 'Psi', 'Omega'
];

const SECTOR_SUFFIXES = [
  'Prime', 'Major', 'Minor', 'Station', 'Outpost', 'Hub', 'Gateway',
  'Nexus', 'Reach', 'Edge', 'Crossing', 'Junction'
];

const getSectorType = (x, y, gridSize) => {
  const centerX = Math.floor(gridSize / 2);
  const centerY = Math.floor(gridSize / 2);
  const distance = Math.sqrt(Math.pow(x - centerX, 2) + Math.pow(y - centerY, 2));
  const maxDistance = Math.sqrt(2) * (gridSize / 2);
  const ratio = distance / maxDistance;
  
  if (ratio < 0.15) return 'Core';
  if (ratio < 0.35) return 'Inner';
  if (ratio < 0.55) return 'Mid';
  if (ratio < 0.75) return 'Outer';
  if (ratio < 0.9) return 'Fringe';
  return 'Unknown';
};

const generateSectorName = (rng, x, y) => {
  const nameIndex = rng.nextInt(0, SECTOR_NAMES.length - 1);
  const suffixIndex = rng.nextInt(0, SECTOR_SUFFIXES.length - 1);
  return `${SECTOR_NAMES[nameIndex]} ${SECTOR_SUFFIXES[suffixIndex]} ${x}-${y}`;
};

const generateUniverse = async (numSectors = null, seed = null) => {
  const sectorCount = numSectors || config.universe.initialSectors;
  const universeSeed = seed || config.universe.seed;
  const rng = new SeededRandom(universeSeed);
  
  // Calculate grid size (square grid)
  const gridSize = Math.ceil(Math.sqrt(sectorCount));
  
  console.log(`Generating universe with ${sectorCount} sectors (${gridSize}x${gridSize} grid)...`);
  
  const transaction = await sequelize.transaction();
  
  try {
    // Clear existing data
    await SectorConnection.destroy({ where: {}, transaction });
    await Sector.destroy({ where: {}, transaction });
    
    const sectors = [];
    const sectorMap = new Map(); // For quick lookup by coordinates
    
    // Generate sectors in a grid pattern
    let sectorIndex = 0;
    const centerX = Math.floor(gridSize / 2);
    const centerY = Math.floor(gridSize / 2);

    for (let y = 0; y < gridSize && sectorIndex < sectorCount; y++) {
      for (let x = 0; x < gridSize && sectorIndex < sectorCount; x++) {
        const sectorType = getSectorType(x, y, gridSize);
        // Mark the center sector as the starting sector
        const isStarting = (x === centerX && y === centerY);

        const sector = await Sector.create({
          x_coord: x,
          y_coord: y,
          z_coord: 0,
          name: generateSectorName(rng, x, y),
          type: sectorType,
          is_starting_sector: isStarting,
          hazard_level: rng.nextInt(0, sectorType === 'Core' ? 2 : sectorType === 'Fringe' ? 8 : 5),
          description: `A ${sectorType.toLowerCase()} sector at coordinates (${x}, ${y}).`
        }, { transaction });

        sectors.push(sector);
        sectorMap.set(`${x},${y}`, sector);
        sectorIndex++;
      }
    }
    
    console.log(`Created ${sectors.length} sectors. Generating connections...`);
    
    // Generate connections (adjacent sectors in grid)
    const connections = [];
    for (const sector of sectors) {
      const { x_coord: x, y_coord: y } = sector;
      
      // Connect to right neighbor
      const rightNeighbor = sectorMap.get(`${x + 1},${y}`);
      if (rightNeighbor) {
        connections.push({
          sector_a_id: sector.sector_id,
          sector_b_id: rightNeighbor.sector_id,
          connection_type: 'standard',
          travel_time: 1,
          is_bidirectional: true
        });
      }
      
      // Connect to bottom neighbor
      const bottomNeighbor = sectorMap.get(`${x},${y + 1}`);
      if (bottomNeighbor) {
        connections.push({
          sector_a_id: sector.sector_id,
          sector_b_id: bottomNeighbor.sector_id,
          connection_type: 'standard',
          travel_time: 1,
          is_bidirectional: true
        });
      }
      
      // Add diagonal connections with 30% probability
      if (rng.next() < 0.3) {
        const diagonalNeighbor = sectorMap.get(`${x + 1},${y + 1}`);
        if (diagonalNeighbor) {
          connections.push({
            sector_a_id: sector.sector_id,
            sector_b_id: diagonalNeighbor.sector_id,
            connection_type: 'standard',
            travel_time: 2,
            is_bidirectional: true
          });
        }
      }
    }
    
    await SectorConnection.bulkCreate(connections, { transaction });
    
    await transaction.commit();
    console.log(`✓ Universe generated: ${sectors.length} sectors, ${connections.length} connections`);
    
    return { sectors: sectors.length, connections: connections.length };
  } catch (error) {
    await transaction.rollback();
    console.error('✗ Universe generation failed:', error);
    throw error;
  }
};

const getStartingSector = async () => {
  // First try to find an explicitly marked starting sector
  let sector = await Sector.findOne({ where: { is_starting_sector: true } });

  // Fallback: find a Core sector with low hazard
  if (!sector) {
    sector = await Sector.findOne({
      where: { type: 'Core' },
      order: [['hazard_level', 'ASC']]
    });
  }

  // Final fallback: any sector
  if (!sector) {
    sector = await Sector.findOne();
  }

  return sector;
};

/**
 * Seed all commodities from config
 */
const seedCommodities = async (transaction) => {
  const commodityDefs = config.commodities;
  const commodities = [];

  for (const def of commodityDefs) {
    const commodity = await Commodity.create({
      name: def.name,
      category: def.category,
      base_price: def.basePrice,
      volume_per_unit: def.volume,
      description: def.description,
      volatility: def.volatility,
      is_legal: def.isLegal !== false
    }, { transaction });
    commodities.push(commodity);
  }

  console.log(`✓ Seeded ${commodities.length} commodities`);
  return commodities;
};

const PORT_NAMES = {
  'Trading Hub': ['Central Market', 'Commerce Station', 'Trade Nexus', 'Merchant Hub', 'Exchange Post'],
  'Mining Outpost': ['Ore Extraction', 'Deep Mine', 'Mineral Works', 'Rock Crusher', 'Asteroid Mine'],
  'Agricultural Station': ['Hydrofarm', 'Agri-Dome', 'Green Station', 'Harvest Hub', 'Bio-Farm'],
  'Tech Center': ['Tech Labs', 'Innovation Hub', 'Research Station', 'Science Complex', 'Data Center'],
  'Space Station': ['Orbital Station', 'Star Port', 'Way Station', 'Dock Alpha', 'Rest Stop'],
  'Fuel Depot': ['Refuel Station', 'Gas Giant Tap', 'Energy Hub', 'Power Station', 'Fuel Point'],
  'Medical Station': ['Med Bay', 'Health Center', 'Bio-Lab', 'Emergency Clinic', 'Hospital Ship'],
  'Black Market': ['Shadow Port', 'Dark Bazaar', 'Underground', 'Hidden Market', 'Smuggler\'s Den']
};

/**
 * Generate ports for sectors
 */
const generatePorts = async (sectors, commodities, rng, transaction) => {
  const portTypes = Object.keys(config.portTypes);
  const ports = [];

  for (const sector of sectors) {
    // ~50% of sectors have at least 1 port
    if (rng.next() > 0.5) continue;

    // Determine number of ports (1-2)
    const numPorts = rng.next() < 0.7 ? 1 : 2;

    for (let i = 0; i < numPorts; i++) {
      // Select port type based on sector type
      let portType;
      if (sector.type === 'Core') {
        portType = rng.next() < 0.6 ? 'Trading Hub' : portTypes[rng.nextInt(0, portTypes.length - 1)];
      } else if (sector.type === 'Fringe' || sector.type === 'Unknown') {
        portType = rng.next() < 0.3 ? 'Black Market' : portTypes[rng.nextInt(0, portTypes.length - 1)];
      } else {
        portType = portTypes[rng.nextInt(0, portTypes.length - 1)];
      }

      const portConfig = config.portTypes[portType];
      const names = PORT_NAMES[portType];
      const name = names[rng.nextInt(0, names.length - 1)] + ' ' + sector.name.split(' ')[0];

      const port = await Port.create({
        sector_id: sector.sector_id,
        name: name,
        type: portType,
        description: portConfig.description,
        tax_rate: portConfig.taxRate || config.economy.defaultTaxRate,
        allows_illegal: portConfig.allowsIllegal || false
      }, { transaction });

      ports.push(port);

      // Add commodities to port
      await generatePortCommodities(port, commodities, portConfig, rng, transaction);
    }
  }

  console.log(`✓ Generated ${ports.length} ports`);
  return ports;
};

/**
 * Generate commodities for a port based on its type
 */
const generatePortCommodities = async (port, commodities, portConfig, rng, transaction) => {
  for (const commodity of commodities) {
    // Skip illegal commodities at legal ports
    if (!commodity.is_legal && !port.allows_illegal) continue;

    let shouldStock = false;
    let canBuy = true;
    let canSell = true;
    let productionRate = 0;
    let consumptionRate = 0;
    let buyMod = 1.0;
    let sellMod = 1.0;

    if (portConfig.produces && portConfig.produces.includes(commodity.name)) {
      shouldStock = true;
      productionRate = rng.nextInt(5, 20);
      buyMod = 0.8 + rng.next() * 0.2; // Sells cheaper
    } else if (portConfig.consumes && portConfig.consumes.includes(commodity.name)) {
      shouldStock = true;
      consumptionRate = rng.nextInt(5, 15);
      sellMod = 1.1 + rng.next() * 0.2; // Buys at higher price
    } else if (portConfig.buysAll && portConfig.sellsAll) {
      shouldStock = rng.next() < (portConfig.commodityChance || 0.5);
    }

    if (!shouldStock) continue;

    const maxQty = rng.nextInt(200, 1000);
    const startQty = rng.nextInt(Math.floor(maxQty * 0.3), Math.floor(maxQty * 0.7));

    await PortCommodity.create({
      port_id: port.port_id,
      commodity_id: commodity.commodity_id,
      quantity: startQty,
      max_quantity: maxQty,
      buy_price_modifier: buyMod,
      sell_price_modifier: sellMod,
      production_rate: productionRate,
      consumption_rate: consumptionRate,
      can_buy: canBuy,
      can_sell: canSell
    }, { transaction });
  }
};

/**
 * Seed all components from config (Phase 3)
 */
const seedComponents = async (transaction) => {
  const componentTypes = {
    weapons: 'weapon',
    shields: 'shield',
    engines: 'engine',
    scanners: 'scanner',
    cargoPods: 'cargo_pod',
    armor: 'armor'
  };

  const components = [];
  for (const [configKey, type] of Object.entries(componentTypes)) {
    const defs = config.components[configKey] || [];
    for (const def of defs) {
      const component = await Component.create({
        name: def.name,
        type: type,
        tier: def.tier,
        damage: def.damage || 0,
        accuracy: def.accuracy || 0,
        shield_capacity: def.capacity || 0,
        recharge_rate: def.rechargeRate || 0,
        speed_bonus: def.speed || 0,
        fuel_efficiency: def.fuelEfficiency || 1.0,
        scan_range: def.range || 0,
        detail_level: def.detailLevel || 0,
        cargo_capacity: def.capacity || 0,
        hull_bonus: def.hullBonus || 0,
        damage_reduction: def.damageReduction || 0,
        energy_cost: def.energyCost || 0,
        price: def.price,
        description: def.description,
        special_properties: {
          shieldBonus: def.shieldBonus,
          detectsCloaked: def.detectsCloaked,
          protectedCargo: def.protectedCargo
        }
      }, { transaction });
      components.push(component);
    }
  }

  console.log(`✓ Seeded ${components.length} components`);
  return components;
};

/**
 * Spawn NPCs in sectors (Phase 3)
 */
const spawnNPCs = async (sectors, rng, transaction) => {
  let npcCount = 0;

  for (const sector of sectors) {
    // Spawn chance based on sector type
    let spawnChance = 0.3; // Base 30% per sector
    if (sector.type === 'Core') spawnChance = 0.5;
    else if (sector.type === 'Fringe' || sector.type === 'Unknown') spawnChance = 0.4;

    if (rng.next() > spawnChance) continue;

    // Number of NPCs per sector (1-3)
    const numNPCs = rng.nextInt(1, 3);
    for (let i = 0; i < numNPCs; i++) {
      try {
        await npcService.spawnNPC(sector.sector_id, null, transaction);
        npcCount++;
      } catch (err) {
        console.warn(`Failed to spawn NPC in sector ${sector.sector_id}:`, err.message);
      }
    }
  }

  console.log(`✓ Spawned ${npcCount} NPCs`);
  return npcCount;
};

/**
 * Full universe generation including commodities, ports, components, and NPCs
 */
const generateFullUniverse = async (numSectors = null, seed = null) => {
  const result = await generateUniverse(numSectors, seed);

  const transaction = await sequelize.transaction();
  try {
    // Clear existing economy and Phase 3 data
    await PortCommodity.destroy({ where: {}, transaction });
    await Port.destroy({ where: {}, transaction });
    await Commodity.destroy({ where: {}, transaction });
    await NPC.destroy({ where: {}, transaction });
    await Component.destroy({ where: {}, transaction });

    // Seed commodities
    const commodities = await seedCommodities(transaction);

    // Seed components (Phase 3)
    await seedComponents(transaction);

    // Get all sectors and generate ports
    const sectors = await Sector.findAll({ transaction });
    const rng = new SeededRandom(seed || config.universe.seed);
    await generatePorts(sectors, commodities, rng, transaction);

    // Spawn NPCs (Phase 3)
    await spawnNPCs(sectors, rng, transaction);

    await transaction.commit();
    console.log('✓ Full universe generation complete');
    return result;
  } catch (error) {
    await transaction.rollback();
    throw error;
  }
};

module.exports = { generateUniverse, generateFullUniverse, getStartingSector, seedCommodities, seedComponents, spawnNPCs };

