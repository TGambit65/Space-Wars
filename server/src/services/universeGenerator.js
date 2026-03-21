const { Sector, SectorConnection, Commodity, Port, PortCommodity, Component, NPC, Planet, PlanetResource, Artifact, Crew, sequelize } = require('../models');
const config = require('../config');
const npcService = require('./npcService');
const worldPolicyService = require('./worldPolicyService');

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

  // Pick a random element from an array
  pick(arr) {
    return arr[this.nextInt(0, arr.length - 1)];
  }

  // Weighted random selection: weights is array of { value, weight }
  weightedPick(items) {
    const total = items.reduce((sum, i) => sum + i.weight, 0);
    let roll = this.next() * total;
    for (const item of items) {
      roll -= item.weight;
      if (roll <= 0) return item.value;
    }
    return items[items.length - 1].value;
  }
}

// ============== Sector Naming ==============

const STAR_NAMES_PREFIX = [
  'Alpha', 'Beta', 'Gamma', 'Delta', 'Epsilon', 'Zeta', 'Eta', 'Theta',
  'Iota', 'Kappa', 'Lambda', 'Mu', 'Nu', 'Xi', 'Omicron', 'Pi',
  'Rho', 'Sigma', 'Tau', 'Upsilon', 'Phi', 'Chi', 'Psi', 'Omega'
];

const STAR_NAMES_SUFFIX = [
  'Prime', 'Major', 'Minor', 'Centauri', 'Draconis', 'Cygni', 'Eridani',
  'Lyrae', 'Aquilae', 'Orionis', 'Serpentis', 'Pegasi', 'Ursae',
  'Tauri', 'Leonis', 'Hydrae', 'Crucis', 'Carinae', 'Velorum'
];

const ROMAN_NUMERALS = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X',
  'XI', 'XII', 'XIII', 'XIV', 'XV', 'XVI', 'XVII', 'XVIII', 'XIX', 'XX'];

const generateSectorName = (rng, catalogNumber) => {
  const prefix = rng.pick(STAR_NAMES_PREFIX);
  const suffix = rng.pick(STAR_NAMES_SUFFIX);
  const numeral = ROMAN_NUMERALS[catalogNumber % ROMAN_NUMERALS.length];
  return `${prefix} ${suffix} ${numeral}`;
};

// ============== Star Class Assignment ==============

const getStarClassForZone = (rng, sectorType) => {
  // Hot/massive stars more common near core, cool stars in outer regions
  const zoneWeights = {
    Core:    [{ value: 'O', weight: 5 }, { value: 'B', weight: 10 }, { value: 'A', weight: 15 },
              { value: 'F', weight: 20 }, { value: 'G', weight: 20 }, { value: 'K', weight: 10 },
              { value: 'M', weight: 5 }, { value: 'Neutron', weight: 8 }, { value: 'BlackHole', weight: 7 }],
    Inner:   [{ value: 'O', weight: 2 }, { value: 'B', weight: 8 }, { value: 'A', weight: 15 },
              { value: 'F', weight: 25 }, { value: 'G', weight: 25 }, { value: 'K', weight: 15 },
              { value: 'M', weight: 5 }, { value: 'Neutron', weight: 3 }, { value: 'BlackHole', weight: 2 }],
    Mid:     [{ value: 'O', weight: 1 }, { value: 'B', weight: 3 }, { value: 'A', weight: 10 },
              { value: 'F', weight: 20 }, { value: 'G', weight: 30 }, { value: 'K', weight: 20 },
              { value: 'M', weight: 10 }, { value: 'Neutron', weight: 3 }, { value: 'BlackHole', weight: 3 }],
    Outer:   [{ value: 'O', weight: 0 }, { value: 'B', weight: 1 }, { value: 'A', weight: 5 },
              { value: 'F', weight: 10 }, { value: 'G', weight: 20 }, { value: 'K', weight: 30 },
              { value: 'M', weight: 25 }, { value: 'Neutron', weight: 5 }, { value: 'BlackHole', weight: 4 }],
    Fringe:  [{ value: 'O', weight: 0 }, { value: 'B', weight: 0 }, { value: 'A', weight: 2 },
              { value: 'F', weight: 5 }, { value: 'G', weight: 15 }, { value: 'K', weight: 25 },
              { value: 'M', weight: 40 }, { value: 'Neutron', weight: 7 }, { value: 'BlackHole', weight: 6 }],
    Unknown: [{ value: 'O', weight: 0 }, { value: 'B', weight: 0 }, { value: 'A', weight: 1 },
              { value: 'F', weight: 3 }, { value: 'G', weight: 10 }, { value: 'K', weight: 20 },
              { value: 'M', weight: 45 }, { value: 'Neutron', weight: 10 }, { value: 'BlackHole', weight: 11 }]
  };

  return rng.weightedPick(zoneWeights[sectorType] || zoneWeights.Mid);
};

// ============== Galaxy Placement ==============

/**
 * Generate star positions in a spiral galaxy pattern.
 * Uses logarithmic spiral arms with central bulge.
 */
const generateSpiralPositions = (numSystems, galaxyRadius, rng, configuredArms = null) => {
  const positions = [];
  const minDistance = galaxyRadius * 0.015; // Slightly tighter for larger galaxies
  const numArms = configuredArms || config.universe.spiralArms || rng.nextInt(2, 4);
  const armSpread = 0.4; // How wide each arm is (radians)
  const armTwist = 2.5; // How tightly the arms wind

  // ~20% of stars in central bulge
  const bulgeCount = Math.floor(numSystems * 0.2);
  const armCount = numSystems - bulgeCount;

  // Place central bulge stars
  for (let i = 0; i < bulgeCount; i++) {
    let placed = false;
    for (let attempt = 0; attempt < 50; attempt++) {
      // Gaussian-like distribution for bulge: more stars near center
      const r = galaxyRadius * 0.15 * Math.sqrt(rng.next());
      const theta = rng.next() * Math.PI * 2;
      const x = r * Math.cos(theta);
      const y = r * Math.sin(theta);

      if (isFarEnough(positions, x, y, minDistance)) {
        positions.push({ x, y });
        placed = true;
        break;
      }
    }
    if (!placed) {
      // Force-place with slightly relaxed constraint
      const r = galaxyRadius * 0.15 * Math.sqrt(rng.next());
      const theta = rng.next() * Math.PI * 2;
      positions.push({ x: r * Math.cos(theta), y: r * Math.sin(theta) });
    }
  }

  // Place arm stars
  for (let i = 0; i < armCount; i++) {
    let placed = false;
    for (let attempt = 0; attempt < 50; attempt++) {
      // Pick which arm
      const armIndex = i % numArms;
      const armAngleOffset = (armIndex / numArms) * Math.PI * 2;

      // Distance from center: power distribution favoring inner regions
      const distFrac = rng.next();
      const r = galaxyRadius * (0.1 + 0.85 * Math.pow(distFrac, 0.7));

      // Angle follows logarithmic spiral with jitter
      const spiralAngle = armAngleOffset + armTwist * Math.log(1 + r / galaxyRadius);
      const jitter = (rng.next() - 0.5) * armSpread * (1 + distFrac * 0.5);
      const theta = spiralAngle + jitter;

      const x = r * Math.cos(theta);
      const y = r * Math.sin(theta);

      if (isFarEnough(positions, x, y, minDistance)) {
        positions.push({ x, y });
        placed = true;
        break;
      }
    }
    if (!placed) {
      // Force-place
      const r = galaxyRadius * (0.1 + 0.85 * rng.next());
      const theta = rng.next() * Math.PI * 2;
      positions.push({ x: r * Math.cos(theta), y: r * Math.sin(theta) });
    }
  }

  return positions;
};

const isFarEnough = (positions, x, y, minDist) => {
  const minDistSq = minDist * minDist;
  for (const p of positions) {
    const dx = p.x - x;
    const dy = p.y - y;
    if (dx * dx + dy * dy < minDistSq) return false;
  }
  return true;
};

const getSectorTypeFromDistance = (x, y, galaxyRadius) => {
  const dist = Math.sqrt(x * x + y * y);
  const ratio = dist / galaxyRadius;

  if (ratio < 0.15) return 'Core';
  if (ratio < 0.35) return 'Inner';
  if (ratio < 0.55) return 'Mid';
  if (ratio < 0.75) return 'Outer';
  if (ratio < 0.90) return 'Fringe';
  return 'Unknown';
};

// ============== Hyperlane Generation ==============

/**
 * Compute Delaunay triangulation and generate hyperlanes.
 * Uses MST for connectivity, then adds extra edges probabilistically.
 */
const generateHyperlanes = (positions, sectorIds, galaxyRadius, rng) => {
  const _delaunator = require('delaunator');
  const Delaunator = _delaunator.default || _delaunator;

  // Flatten positions for Delaunator: [x0, y0, x1, y1, ...]
  const coords = new Float64Array(positions.length * 2);
  for (let i = 0; i < positions.length; i++) {
    coords[i * 2] = positions[i].x;
    coords[i * 2 + 1] = positions[i].y;
  }

  const delaunay = new Delaunator(coords);

  // Extract unique edges from triangulation
  const edgeSet = new Set();
  const edges = [];

  const addEdge = (a, b) => {
    const key = a < b ? `${a}-${b}` : `${b}-${a}`;
    if (!edgeSet.has(key)) {
      edgeSet.add(key);
      const dx = positions[a].x - positions[b].x;
      const dy = positions[a].y - positions[b].y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      edges.push({ a, b, dist, key });
    }
  };

  // Extract edges from triangles
  const triangles = delaunay.triangles;
  for (let i = 0; i < triangles.length; i += 3) {
    addEdge(triangles[i], triangles[i + 1]);
    addEdge(triangles[i + 1], triangles[i + 2]);
    addEdge(triangles[i + 2], triangles[i]);
  }

  // Sort edges by distance for MST
  edges.sort((a, b) => a.dist - b.dist);

  // Kruskal's MST using Union-Find
  const parent = Array.from({ length: positions.length }, (_, i) => i);
  const rank = new Array(positions.length).fill(0);

  const find = (x) => {
    if (parent[x] !== x) parent[x] = find(parent[x]);
    return parent[x];
  };

  const union = (x, y) => {
    const px = find(x), py = find(y);
    if (px === py) return false;
    if (rank[px] < rank[py]) parent[px] = py;
    else if (rank[px] > rank[py]) parent[py] = px;
    else { parent[py] = px; rank[px]++; }
    return true;
  };

  const mstEdges = new Set();
  const nonMstEdges = [];
  const degree = new Array(positions.length).fill(0);

  // Build MST
  for (const edge of edges) {
    if (union(edge.a, edge.b)) {
      mstEdges.add(edge.key);
      degree[edge.a]++;
      degree[edge.b]++;
    }
  }

  // Separate MST edges from non-MST edges
  for (const edge of edges) {
    if (!mstEdges.has(edge.key)) {
      nonMstEdges.push(edge);
    }
  }

  // Add back non-MST Delaunay edges probabilistically
  // Shorter edges more likely, cap degree at 5-6
  const maxDegree = 6;
  const targetConnections = Math.floor(positions.length * 1.5);
  let connectionCount = positions.length - 1; // MST edges

  for (const edge of nonMstEdges) {
    if (connectionCount >= targetConnections) break;
    if (degree[edge.a] >= maxDegree || degree[edge.b] >= maxDegree) continue;

    // Probability inversely proportional to distance
    const maxDist = galaxyRadius * 0.5;
    const prob = Math.max(0.1, 1 - edge.dist / maxDist);
    if (rng.next() < prob) {
      mstEdges.add(edge.key);
      degree[edge.a]++;
      degree[edge.b]++;
      connectionCount++;
    }
  }

  // Build connection records
  const connections = [];
  for (const edge of edges) {
    if (mstEdges.has(edge.key)) {
      // Travel time proportional to distance (1-5 range)
      const travelTime = Math.max(1, Math.min(5, Math.round(edge.dist / (galaxyRadius * 0.1))));
      connections.push({
        sector_a_id: sectorIds[edge.a],
        sector_b_id: sectorIds[edge.b],
        connection_type: 'standard',
        travel_time: travelTime,
        is_bidirectional: true
      });
    }
  }

  // Add wormhole connections between distant systems (scales with galaxy size)
  const wormholeCount = rng.nextInt(1, Math.max(3, Math.floor(positions.length / 200)));
  const minWormholeDist = galaxyRadius * 0.6;
  let wormholesAdded = 0;

  for (let attempt = 0; attempt < 100 && wormholesAdded < wormholeCount; attempt++) {
    const a = rng.nextInt(0, positions.length - 1);
    const b = rng.nextInt(0, positions.length - 1);
    if (a === b) continue;

    const dx = positions[a].x - positions[b].x;
    const dy = positions[a].y - positions[b].y;
    const dist = Math.sqrt(dx * dx + dy * dy);

    if (dist >= minWormholeDist) {
      const key = a < b ? `${a}-${b}` : `${b}-${a}`;
      if (!edgeSet.has(key)) {
        connections.push({
          sector_a_id: sectorIds[a],
          sector_b_id: sectorIds[b],
          connection_type: 'wormhole',
          travel_time: 1,
          is_bidirectional: true
        });
        wormholesAdded++;
      }
    }
  }

  return connections;
};

// ============== Core Universe Generation ==============

const generateUniverse = async ({ numSystems = null, seed = null, galaxyShape = null, galaxyRadius: radius = null } = {}) => {
  const sectorCount = numSystems || config.universe.initialSectors;
  const universeSeed = seed || config.universe.seed;
  const shape = galaxyShape || config.universe.galaxyShape;
  const galaxyRadius = radius || config.universe.galaxyRadius;
  const rng = new SeededRandom(universeSeed);

  console.log(`Generating ${shape} galaxy with ${sectorCount} systems (radius: ${galaxyRadius})...`);

  const transaction = await sequelize.transaction();

  try {
    // Clear existing data
    await SectorConnection.destroy({ where: {}, transaction });
    await Sector.destroy({ where: {}, transaction });

    // Generate star positions
    const positions = generateSpiralPositions(sectorCount, galaxyRadius, rng);

    console.log(`Placed ${positions.length} star systems. Creating sectors...`);

    const sectors = [];
    const sectorIds = [];
    let startingSectorIdx = null;
    let minDistToCenter = Infinity;

    // Create sector records
    for (let i = 0; i < positions.length; i++) {
      const { x, y } = positions[i];
      const sectorType = getSectorTypeFromDistance(x, y, galaxyRadius);
      const starClass = getStarClassForZone(rng, sectorType);

      // Track closest to center for starting sector
      const distToCenter = Math.sqrt(x * x + y * y);
      if (sectorType === 'Core' && distToCenter < minDistToCenter) {
        minDistToCenter = distToCenter;
        startingSectorIdx = i;
      }

      const hazardLevel = rng.nextInt(
        0,
        sectorType === 'Core' ? 2 :
        sectorType === 'Inner' ? 3 :
        sectorType === 'Mid' ? 5 :
        sectorType === 'Outer' ? 6 :
        sectorType === 'Fringe' ? 8 : 10
      );

      const starConfig = config.starClasses[starClass];
      const sectorPolicy = worldPolicyService.buildDefaultSectorPolicy({
        type: sectorType
      });

      const sector = await Sector.create({
        x_coord: parseFloat(x.toFixed(2)),
        y_coord: parseFloat(y.toFixed(2)),
        z_coord: 0,
        name: generateSectorName(rng, i),
        type: sectorType,
        star_class: starClass,
        zone_class: sectorPolicy.zone_class,
        security_class: sectorPolicy.security_class,
        access_mode: sectorPolicy.access_mode,
        is_starting_sector: false, // Set after loop
        hazard_level: hazardLevel,
        description: `A ${sectorType.toLowerCase()} system with a ${starConfig.name} star.`,
        rule_flags: sectorPolicy.rule_flags
      }, { transaction });

      sectors.push(sector);
      sectorIds.push(sector.sector_id);
    }

    // Mark starting sector
    if (startingSectorIdx !== null) {
      await sectors[startingSectorIdx].update({ is_starting_sector: true }, { transaction });
    }

    // Assign permanent space phenomena to sectors
    const phenomenaTypes = Object.entries(config.spacePhenomena || {})
      .filter(([, p]) => p.permanent);

    for (const sector of sectors) {
      // BlackHole systems don't get additional phenomena
      if (sector.star_class === 'BlackHole') continue;

      for (const [type, phenomenaDef] of phenomenaTypes) {
        if (rng.next() < phenomenaDef.spawnChance) {
          await sector.update({
            phenomena: {
              type,
              intensity: 0.5 + rng.next() * 0.5,
              expires_at: null
            }
          }, { transaction });
          break; // Only one phenomenon per sector
        }
      }
    }

    console.log(`Created ${sectors.length} sectors. Generating hyperlanes...`);

    // Generate hyperlane connections
    const sectorsById = new Map(sectors.map((sector) => [sector.sector_id, sector]));
    const connections = generateHyperlanes(positions, sectorIds, galaxyRadius, rng).map((connection) => {
      const fromSector = sectorsById.get(connection.sector_a_id);
      const toSector = sectorsById.get(connection.sector_b_id);
      const connectionPolicy = worldPolicyService.buildDefaultConnectionPolicy(connection, fromSector, toSector);

      return {
        ...connection,
        lane_class: connectionPolicy.lane_class,
        access_mode: connectionPolicy.access_mode,
        rule_flags: connectionPolicy.rule_flags
      };
    });
    await SectorConnection.bulkCreate(connections, { transaction });

    await transaction.commit();

    // Invalidate the static map cache so the next /api/sectors/map request rebuilds it
    try { require('../controllers/sectorController').clearMapCache(); } catch (_) {}

    console.log(`✓ Galaxy generated: ${sectors.length} systems, ${connections.length} hyperlanes`);

    return { sectors: sectors.length, connections: connections.length, galaxyRadius };
  } catch (error) {
    await transaction.rollback();
    console.error('✗ Galaxy generation failed:', error);
    throw error;
  }
};

const getStartingSector = async () => {
  let sector = await Sector.findOne({ where: { is_starting_sector: true } });
  if (!sector) {
    sector = await Sector.findOne({
      where: { type: 'Core' },
      order: [['hazard_level', 'ASC']]
    });
  }
  if (!sector) {
    sector = await Sector.findOne();
  }
  return sector;
};

// ============== Commodity & Port Generation ==============

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

// ============== Component Seeding ==============

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
    armor: 'armor',
    jumpDrives: 'jump_drive'
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
          protectedCargo: def.protectedCargo,
          jumpRange: def.jumpRange,
          cooldownMs: def.cooldownMs,
          fuelCost: def.fuelCost
        }
      }, { transaction });
      components.push(component);
    }
  }

  console.log(`✓ Seeded ${components.length} components`);
  return components;
};

// ============== NPC Spawning ==============

/**
 * Spawn NPCs in sectors (Phase 3)
 */
const spawnNPCs = async (sectors, rng, transaction) => {
  let npcCount = 0;

  for (const sector of sectors) {
    let spawnChance = 0.3;
    if (sector.type === 'Core') spawnChance = 0.5;
    else if (sector.type === 'Fringe' || sector.type === 'Unknown') spawnChance = 0.4;

    if (rng.next() > spawnChance) continue;

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

// ============== Planet Generation ==============

// Planet types biased by orbital position
const INNER_TYPES = ['Volcanic', 'Desert', 'Barren'];
const OUTER_TYPES = ['Gas Giant', 'Ice', 'Crystalline'];

/**
 * Generate planets for sectors.
 * Planet count and type distribution tied to star_class.
 * All non-BlackHole systems get planets. BlackHole systems get 0.
 * Orbital positions have natural gaps (randomly selected from 1-15 range).
 * Planet type biased by orbital position: inner=hot, outer=cold, middle=star-class bias.
 * Planet names use system name + Roman numeral.
 */
const generatePlanets = async (sectors, rng, transaction) => {
  const planets = [];

  for (const sector of sectors) {
    const starConfig = config.starClasses[sector.star_class];
    if (!starConfig) continue;

    // BlackHole systems get 0 planets
    const maxP = starConfig.maxPlanets || 0;
    if (maxP === 0) continue;

    // Planet count based on star class (1 to maxPlanets)
    const numPlanets = rng.nextInt(1, maxP);

    // Pick random orbital positions from 1-15 range, then sort
    const allPositions = [];
    for (let p = 1; p <= 15; p++) allPositions.push(p);
    // Fisher-Yates shuffle (partial) to pick numPlanets positions
    for (let i = allPositions.length - 1; i > 0; i--) {
      const j = rng.nextInt(0, i);
      [allPositions[i], allPositions[j]] = [allPositions[j], allPositions[i]];
    }
    const orbitalPositions = allPositions.slice(0, numPlanets).sort((a, b) => a - b);

    for (let i = 0; i < numPlanets; i++) {
      const orbitalPos = orbitalPositions[i];

      // Position-based type bias
      let planetTypeName;
      if (orbitalPos <= 3 && rng.next() < 0.6) {
        // Inner orbits bias toward hot types
        planetTypeName = rng.pick(INNER_TYPES);
      } else if (orbitalPos >= 10 && rng.next() < 0.6) {
        // Outer orbits bias toward cold types
        planetTypeName = rng.pick(OUTER_TYPES);
      } else if (starConfig.planetBias && starConfig.planetBias.length > 0 && rng.next() < 0.65) {
        // Middle orbits use star-class bias
        planetTypeName = rng.pick(starConfig.planetBias);
      } else {
        const allTypes = Object.values(config.planetTypes);
        planetTypeName = rng.pick(allTypes).name;
      }

      // Find the config entry
      const planetConfig = Object.values(config.planetTypes).find(p => p.name === planetTypeName)
        || config.planetTypes.BARREN;

      // Name: system name + Roman numeral
      const name = `${sector.name} ${ROMAN_NUMERALS[i] || (i + 1)}`;

      const size = rng.nextInt(2, 9);
      const gravity = 0.3 + rng.next() * 2.2;
      const hasArtifact = rng.next() < 0.1;

      const baseTemperatures = {
        'Terran': 15, 'Desert': 45, 'Ice': -60, 'Volcanic': 400,
        'Gas Giant': -150, 'Oceanic': 20, 'Barren': -30, 'Jungle': 30,
        'Toxic': 80, 'Crystalline': -100
      };
      const baseTemp = baseTemperatures[planetConfig.name] || 0;
      const tempVariation = Math.floor((rng.next() - 0.5) * 40);
      const temperature = baseTemp + tempVariation;

      const planet = await Planet.create({
        sector_id: sector.sector_id,
        name: name,
        type: planetConfig.name,
        size: size,
        gravity: parseFloat(gravity.toFixed(2)),
        habitability: planetConfig.habitability,
        temperature: temperature,
        has_artifact: hasArtifact,
        orbital_position: orbitalPos,
        description: `A ${planetConfig.name.toLowerCase()} planet. ${planetConfig.description}`
      }, { transaction });

      planets.push(planet);

      // Generate resources for this planet
      await generatePlanetResources(planet, planetConfig, rng, transaction);
    }
  }

  console.log(`✓ Generated ${planets.length} planets`);
  return planets;
};

/**
 * Generate resources for a planet based on its type
 */
const generatePlanetResources = async (planet, planetConfig, rng, transaction) => {
  const planetResources = config.planetResources;
  const preferredResources = planetConfig.resources || [];

  for (const resourceDef of planetResources) {
    const isPreferred = preferredResources.some(r =>
      resourceDef.name.toLowerCase().includes(r.toLowerCase())
    );

    const baseChance = isPreferred ? 0.7 : resourceDef.rarity * 0.5;
    if (rng.next() > baseChance) continue;

    const abundanceMultiplier = isPreferred ? 1.5 : 1.0;
    const abundance = (0.5 + rng.next() * 1.5) * abundanceMultiplier;
    const totalQuantity = Math.floor(resourceDef.baseYield * planet.size * 1000 * abundance);

    await PlanetResource.create({
      planet_id: planet.planet_id,
      resource_type: resourceDef.name,
      abundance: parseFloat(abundance.toFixed(2)),
      total_quantity: totalQuantity,
      extracted_quantity: 0
    }, { transaction });
  }
};

// ============== Artifact Generation ==============

/**
 * Generate artifacts on planets (Phase 4)
 */
const generateArtifacts = async (planets, rng, transaction) => {
  const artifactTypes = config.artifactTypes;
  let artifactCount = 0;

  for (const planet of planets) {
    if (!planet.has_artifact) continue;

    let selectedArtifact = null;
    for (const artifactType of artifactTypes) {
      if (rng.next() < artifactType.rarity) {
        selectedArtifact = artifactType;
        break;
      }
    }

    if (!selectedArtifact) {
      selectedArtifact = artifactTypes[rng.nextInt(0, artifactTypes.length - 1)];
    }

    const baseBonusPercent = Math.floor((0.15 - selectedArtifact.rarity) * 200);
    const bonusVariation = rng.nextInt(-5, 5);
    const bonusValue = Math.max(5, Math.min(30, baseBonusPercent + bonusVariation));

    await Artifact.create({
      name: selectedArtifact.name,
      description: selectedArtifact.description,
      bonus_type: selectedArtifact.bonusType,
      bonus_value: bonusValue,
      rarity: selectedArtifact.rarity,
      location_planet_id: planet.planet_id,
      is_discovered: false
    }, { transaction });

    artifactCount++;
  }

  console.log(`✓ Generated ${artifactCount} artifacts`);
  return artifactCount;
};

// ============== Crew Generation ==============

const CREW_FIRST_NAMES = [
  'Zara', 'Kael', 'Nova', 'Rex', 'Luna', 'Orion', 'Vex', 'Aria',
  'Dash', 'Lyra', 'Blaze', 'Storm', 'Echo', 'Raven', 'Phoenix', 'Atlas'
];

const CREW_LAST_NAMES = [
  'Starwind', 'Nebula', 'Voidwalker', 'Cosmis', 'Astral', 'Quantum',
  'Stellar', 'Cosmic', 'Galactic', 'Solar', 'Lunar', 'Meteor'
];

/**
 * Generate crew members at ports (Phase 4)
 */
const generateCrewAtPorts = async (ports, rng, transaction) => {
  const speciesKeys = Object.keys(config.crewSpecies);
  let crewCount = 0;

  for (const port of ports) {
    if (rng.next() > 0.55) continue;

    const numCrew = rng.nextInt(1, 4);

    for (let i = 0; i < numCrew; i++) {
      const speciesKey = speciesKeys[rng.nextInt(0, speciesKeys.length - 1)];
      const speciesConfig = config.crewSpecies[speciesKey];

      const firstName = CREW_FIRST_NAMES[rng.nextInt(0, CREW_FIRST_NAMES.length - 1)];
      const lastName = CREW_LAST_NAMES[rng.nextInt(0, CREW_LAST_NAMES.length - 1)];
      const level = rng.nextInt(1, 5);
      const salaryMultiplier = 1 + (level - 1) * 0.2;

      await Crew.create({
        name: `${firstName} ${lastName}`,
        species: speciesConfig.name,
        level: level,
        xp: 0,
        salary: Math.floor(speciesConfig.baseSalary * salaryMultiplier),
        port_id: port.port_id,
        is_active: true
      }, { transaction });

      crewCount++;
    }
  }

  console.log(`✓ Generated ${crewCount} crew members at ports`);
  return crewCount;
};

// ============== Full Universe Generation ==============

/**
 * Full universe generation including commodities, ports, components, NPCs, planets, and crew
 */
const generateFullUniverse = async ({ numSystems = null, seed = null, galaxyShape = null, galaxyRadius = null } = {}) => {
  const result = await generateUniverse({ numSystems, seed, galaxyShape, galaxyRadius });

  const transaction = await sequelize.transaction();
  try {
    // Clear existing economy, Phase 3, and Phase 4 data
    await PortCommodity.destroy({ where: {}, transaction });
    await Crew.destroy({ where: {}, transaction });
    await Port.destroy({ where: {}, transaction });
    await Commodity.destroy({ where: {}, transaction });
    await NPC.destroy({ where: {}, transaction });
    await Component.destroy({ where: {}, transaction });
    await Artifact.destroy({ where: {}, transaction });
    await PlanetResource.destroy({ where: {}, transaction });
    await Planet.destroy({ where: {}, transaction });

    // Seed commodities
    const commodities = await seedCommodities(transaction);

    // Seed components (Phase 3)
    await seedComponents(transaction);

    // Get all sectors
    const sectors = await Sector.findAll({ transaction });
    const rng = new SeededRandom(seed || config.universe.seed);

    // Generate ports
    const ports = await generatePorts(sectors, commodities, rng, transaction);

    // Spawn NPCs (Phase 3)
    await spawnNPCs(sectors, rng, transaction);

    // Phase 4: Generate planets
    const planets = await generatePlanets(sectors, rng, transaction);

    // Phase 4: Generate artifacts on planets
    await generateArtifacts(planets, rng, transaction);

    // Phase 4: Generate crew at ports
    await generateCrewAtPorts(ports, rng, transaction);

    // Phase 5: Seed crafting blueprints
    const craftingService = require('./craftingService');
    await craftingService.seedBlueprints(transaction);

    await transaction.commit();
    console.log('✓ Full universe generation complete');
    return result;
  } catch (error) {
    await transaction.rollback();
    throw error;
  }
};

module.exports = {
  generateUniverse,
  generateFullUniverse,
  getStartingSector,
  seedCommodities,
  seedComponents,
  spawnNPCs,
  // Phase 4
  generatePlanets,
  generateArtifacts,
  generateCrewAtPorts
};
