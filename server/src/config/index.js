require('dotenv').config();
const crypto = require('crypto');

const isProduction = process.env.NODE_ENV === 'production';

// Generate a random secret if not provided (will change on restart - only for dev)
const generateDevSecret = () => {
  const secret = crypto.randomBytes(64).toString('hex');
  console.warn('⚠️  WARNING: Using auto-generated JWT secret. Set JWT_SECRET in .env for production!');
  return secret;
};

// Validate required environment variables in production
const validateProductionConfig = () => {
  if (isProduction) {
    const required = ['JWT_SECRET', 'DB_PASSWORD'];
    const missing = required.filter(key => !process.env[key]);
    if (missing.length > 0) {
      throw new Error(`Missing required environment variables for production: ${missing.join(', ')}`);
    }
    if (process.env.JWT_SECRET && process.env.JWT_SECRET.length < 32) {
      throw new Error('JWT_SECRET must be at least 32 characters in production');
    }
  }
};

validateProductionConfig();

module.exports = {
  port: process.env.PORT || 3000,
  nodeEnv: process.env.NODE_ENV || 'development',
  isProduction,

  db: {
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 5432,
    name: process.env.DB_NAME || 'spacewars3000',
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || 'postgres'
  },

  jwt: {
    secret: process.env.JWT_SECRET || generateDevSecret(),
    expiresIn: process.env.JWT_EXPIRES_IN || '24h'
  },

  universe: {
    seed: parseInt(process.env.UNIVERSE_SEED) || 42,
    initialSectors: parseInt(process.env.INITIAL_SECTORS) || 400,
    galaxyShape: process.env.GALAXY_SHAPE || 'spiral',
    galaxyRadius: parseInt(process.env.GALAXY_RADIUS) || 500
  },

  // Star classification system
  starClasses: {
    O: { name: 'Class O (Blue Supergiant)', color: '#6B8BFF', maxPlanets: 5, planetBias: ['Barren', 'Volcanic', 'Gas Giant'] },
    B: { name: 'Class B (Blue Giant)', color: '#8BB5FF', maxPlanets: 7, planetBias: ['Barren', 'Volcanic', 'Gas Giant', 'Crystalline'] },
    A: { name: 'Class A (White)', color: '#D4E4FF', maxPlanets: 8, planetBias: ['Desert', 'Barren', 'Gas Giant', 'Ice'] },
    F: { name: 'Class F (Yellow-White)', color: '#F8F0D0', maxPlanets: 10, planetBias: ['Terran', 'Oceanic', 'Desert', 'Gas Giant'] },
    G: { name: 'Class G (Yellow)', color: '#FFE87A', maxPlanets: 15, planetBias: ['Terran', 'Oceanic', 'Jungle', 'Desert', 'Gas Giant'] },
    K: { name: 'Class K (Orange)', color: '#FFB84D', maxPlanets: 12, planetBias: ['Desert', 'Ice', 'Barren', 'Toxic', 'Gas Giant'] },
    M: { name: 'Class M (Red Dwarf)', color: '#FF6B4D', maxPlanets: 8, planetBias: ['Ice', 'Barren', 'Toxic', 'Volcanic'] },
    Neutron: { name: 'Neutron Star', color: '#E0E8FF', maxPlanets: 3, planetBias: ['Barren', 'Crystalline'] },
    BlackHole: { name: 'Black Hole', color: '#9B59B6', maxPlanets: 0, planetBias: [] }
  },

  security: {
    // Production should use 12+ rounds, dev can use 10 for faster testing
    bcryptRounds: parseInt(process.env.BCRYPT_ROUNDS) || (isProduction ? 12 : 10),
    rateLimitWindowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000, // 15 minutes
    rateLimitMaxRequests: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || (isProduction ? 100 : 1000)
  },

  // Ship types configuration (for future extensibility in Phase 2+)
  shipTypes: {
    SCOUT: { name: 'Scout', hull: 100, shields: 50, fuel: 100, cargo: 50 },
    MERCHANT_CRUISER: { name: 'Merchant Cruiser', hull: 150, shields: 75, fuel: 150, cargo: 200 },
    FREIGHTER: { name: 'Freighter', hull: 200, shields: 50, fuel: 200, cargo: 500 },
    FIGHTER: { name: 'Fighter', hull: 80, shields: 100, fuel: 80, cargo: 20 },
    CORVETTE: { name: 'Corvette', hull: 120, shields: 100, fuel: 120, cargo: 50 },
    DESTROYER: { name: 'Destroyer', hull: 250, shields: 150, fuel: 150, cargo: 75 },
    CARRIER: { name: 'Carrier', hull: 400, shields: 200, fuel: 100, cargo: 100 },
    COLONY_SHIP: { name: 'Colony Ship', hull: 300, shields: 100, fuel: 250, cargo: 1000 }
  },

  // ============== Phase 2: Economy Configuration ==============
  economy: {
    // Default price volatility (0-1, how much prices swing based on supply)
    defaultVolatility: 0.3,
    // Price spread multiplier (margin between buy/sell prices)
    priceSpread: 0.15,
    // Default tax rate for ports
    defaultTaxRate: 0.05,
    // Starting cargo for new players
    startingCargo: {
      'Food': 10,
      'Water': 5
    },
    // Minimum/maximum price multipliers
    minPriceMultiplier: 0.5,
    maxPriceMultiplier: 2.0
  },

  // Commodity definitions
  commodities: [
    // Essential - Basic necessities for survival
    { name: 'Fuel', category: 'Essential', basePrice: 50, volume: 1, description: 'Starship fuel cells', volatility: 0.2 },
    { name: 'Food', category: 'Essential', basePrice: 30, volume: 1, description: 'Preserved food supplies', volatility: 0.25 },
    { name: 'Water', category: 'Essential', basePrice: 20, volume: 2, description: 'Purified water reserves', volatility: 0.2 },
    { name: 'Oxygen', category: 'Essential', basePrice: 40, volume: 1, description: 'Compressed oxygen tanks', volatility: 0.15 },
    { name: 'Medical Supplies', category: 'Essential', basePrice: 150, volume: 1, description: 'First aid kits and medicine', volatility: 0.35 },

    // Industrial - Raw materials and construction
    { name: 'Ore', category: 'Industrial', basePrice: 25, volume: 3, description: 'Unprocessed metal ore', volatility: 0.3 },
    { name: 'Refined Metals', category: 'Industrial', basePrice: 80, volume: 2, description: 'Processed metal alloys', volatility: 0.25 },
    { name: 'Chemicals', category: 'Industrial', basePrice: 60, volume: 1, description: 'Industrial chemical compounds', volatility: 0.35 },
    { name: 'Construction Materials', category: 'Industrial', basePrice: 45, volume: 4, description: 'Structural building materials', volatility: 0.2 },
    { name: 'Plasma', category: 'Industrial', basePrice: 120, volume: 1, description: 'High-energy plasma containers', volatility: 0.4 },
    { name: 'Equipment', category: 'Industrial', basePrice: 75, volume: 2, description: 'General-purpose tools and machinery', volatility: 0.2 },

    // Technology - Advanced components
    { name: 'Electronics', category: 'Technology', basePrice: 200, volume: 1, description: 'Circuit boards and components', volatility: 0.3 },
    { name: 'Ship Parts', category: 'Technology', basePrice: 300, volume: 2, description: 'Replacement ship components', volatility: 0.25 },
    { name: 'Weapons', category: 'Technology', basePrice: 400, volume: 2, description: 'Small arms and munitions', volatility: 0.4 },
    { name: 'AI Cores', category: 'Technology', basePrice: 800, volume: 1, description: 'Artificial intelligence processors', volatility: 0.5 },
    { name: 'Navigation Data', category: 'Technology', basePrice: 250, volume: 1, description: 'Star charts and route data', volatility: 0.35 },

    // Organic - Agricultural and biological goods
    { name: 'Organics', category: 'Organic', basePrice: 35, volume: 2, description: 'Organic compounds and fertilizers', volatility: 0.3 },
    { name: 'Livestock', category: 'Organic', basePrice: 100, volume: 5, description: 'Live animals for farming', volatility: 0.4 },
    { name: 'Seeds', category: 'Organic', basePrice: 45, volume: 1, description: 'Agricultural seed stocks', volatility: 0.25 },
    { name: 'Textiles', category: 'Organic', basePrice: 70, volume: 2, description: 'Fabrics and clothing materials', volatility: 0.2 },
    { name: 'Bio-Samples', category: 'Organic', basePrice: 350, volume: 1, description: 'Rare biological specimens', volatility: 0.5 },

    // Luxury - High-value trade goods
    { name: 'Luxury Goods', category: 'Luxury', basePrice: 500, volume: 1, description: 'Fine jewelry and artwork', volatility: 0.45 },
    { name: 'Rare Minerals', category: 'Luxury', basePrice: 600, volume: 1, description: 'Precious gems and crystals', volatility: 0.5 },
    { name: 'Alien Artifacts', category: 'Luxury', basePrice: 1000, volume: 1, description: 'Mysterious alien relics', volatility: 0.6 },
    { name: 'Entertainment Media', category: 'Luxury', basePrice: 150, volume: 1, description: 'Holovids and games', volatility: 0.3 },

    // Contraband - Illegal but profitable (Black Market only)
    { name: 'Narcotics', category: 'Contraband', basePrice: 450, volume: 1, description: 'Illegal substances', volatility: 0.6, isLegal: false },
    { name: 'Stolen Goods', category: 'Contraband', basePrice: 200, volume: 2, description: 'Hot merchandise', volatility: 0.5, isLegal: false },
    { name: 'Counterfeit Credits', category: 'Contraband', basePrice: 300, volume: 1, description: 'Forged currency', volatility: 0.4, isLegal: false }
  ],

  // Port types and their commodity preferences
  portTypes: {
    'Trading Hub': {
      description: 'Large commercial station with diverse goods',
      taxRate: 0.05,
      commodityChance: 0.8, // 80% chance to stock each commodity
      buysAll: true,
      sellsAll: true
    },
    'Mining Outpost': {
      description: 'Mineral extraction facility',
      taxRate: 0.03,
      produces: ['Ore', 'Refined Metals', 'Rare Minerals'],
      consumes: ['Food', 'Water', 'Equipment', 'Construction Materials']
    },
    'Agricultural Station': {
      description: 'Farming and food production hub',
      taxRate: 0.04,
      produces: ['Food', 'Organics', 'Seeds', 'Livestock', 'Water'],
      consumes: ['Chemicals', 'Construction Materials', 'Electronics']
    },
    'Tech Center': {
      description: 'High-tech manufacturing facility',
      taxRate: 0.08,
      produces: ['Electronics', 'Ship Parts', 'AI Cores', 'Navigation Data'],
      consumes: ['Refined Metals', 'Chemicals', 'Plasma', 'Rare Minerals']
    },
    'Space Station': {
      description: 'General purpose orbital platform',
      taxRate: 0.06,
      commodityChance: 0.5,
      buysAll: true,
      sellsAll: true
    },
    'Fuel Depot': {
      description: 'Refueling station',
      taxRate: 0.02,
      produces: ['Fuel', 'Oxygen', 'Plasma'],
      consumes: ['Ore', 'Chemicals', 'Water']
    },
    'Medical Station': {
      description: 'Healthcare and research facility',
      taxRate: 0.07,
      produces: ['Medical Supplies', 'Bio-Samples'],
      consumes: ['Chemicals', 'Electronics', 'Organics', 'Water']
    },
    'Black Market': {
      description: 'Underground trading post',
      taxRate: 0.10,
      allowsIllegal: true,
      commodityChance: 0.4,
      buysAll: true,
      sellsAll: true
    }
  },

  // ============== Phase 3: Ship Components Configuration ==============
  componentTypes: {
    WEAPON: 'weapon',
    SHIELD: 'shield',
    ENGINE: 'engine',
    SCANNER: 'scanner',
    CARGO_POD: 'cargo_pod',
    ARMOR: 'armor'
  },

  // Component slot types per ship type
  shipSlots: {
    SCOUT: { weapon: 1, shield: 1, engine: 1, scanner: 2, cargo_pod: 1, armor: 1 },
    MERCHANT_CRUISER: { weapon: 2, shield: 2, engine: 1, scanner: 1, cargo_pod: 3, armor: 1 },
    FREIGHTER: { weapon: 1, shield: 2, engine: 1, scanner: 1, cargo_pod: 5, armor: 2 },
    FIGHTER: { weapon: 3, shield: 1, engine: 2, scanner: 1, cargo_pod: 0, armor: 1 },
    CORVETTE: { weapon: 2, shield: 2, engine: 2, scanner: 1, cargo_pod: 1, armor: 2 },
    DESTROYER: { weapon: 4, shield: 3, engine: 2, scanner: 2, cargo_pod: 1, armor: 3 },
    CARRIER: { weapon: 2, shield: 4, engine: 1, scanner: 3, cargo_pod: 2, armor: 4 },
    COLONY_SHIP: { weapon: 1, shield: 3, engine: 1, scanner: 2, cargo_pod: 4, armor: 2 }
  },

  // Component definitions
  components: {
    // Weapons
    weapons: [
      { name: 'Laser Cannon', tier: 1, damage: 10, accuracy: 85, energyCost: 5, price: 500, description: 'Basic laser weapon' },
      { name: 'Pulse Laser', tier: 2, damage: 18, accuracy: 80, energyCost: 8, price: 1200, description: 'Rapid-fire pulse weapon' },
      { name: 'Plasma Cannon', tier: 3, damage: 30, accuracy: 75, energyCost: 15, price: 3000, description: 'High-damage plasma projectiles' },
      { name: 'Ion Cannon', tier: 2, damage: 12, accuracy: 90, energyCost: 10, price: 1500, description: 'Disrupts shields effectively', shieldBonus: 1.5 },
      { name: 'Missile Launcher', tier: 3, damage: 45, accuracy: 70, energyCost: 20, price: 4000, description: 'Heavy guided missiles' },
      { name: 'Railgun', tier: 4, damage: 60, accuracy: 65, energyCost: 25, price: 8000, description: 'Devastating kinetic rounds' },
      { name: 'Photon Torpedo', tier: 4, damage: 80, accuracy: 60, energyCost: 35, price: 12000, description: 'Powerful energy torpedoes' },
      { name: 'Disruptor Array', tier: 5, damage: 100, accuracy: 55, energyCost: 50, price: 25000, description: 'Military-grade weapon system' }
    ],

    // Shields
    shields: [
      { name: 'Basic Shield', tier: 1, capacity: 50, rechargeRate: 2, energyCost: 3, price: 400, description: 'Entry-level shield generator' },
      { name: 'Deflector Shield', tier: 2, capacity: 100, rechargeRate: 4, energyCost: 5, price: 1000, description: 'Standard deflector system' },
      { name: 'Combat Shield', tier: 3, capacity: 180, rechargeRate: 6, energyCost: 8, price: 2500, description: 'Military-spec shielding' },
      { name: 'Heavy Shield', tier: 3, capacity: 250, rechargeRate: 3, energyCost: 10, price: 3500, description: 'High capacity, slow recharge' },
      { name: 'Regenerative Shield', tier: 4, capacity: 200, rechargeRate: 12, energyCost: 12, price: 6000, description: 'Fast-recharging shield' },
      { name: 'Capital Shield', tier: 5, capacity: 400, rechargeRate: 8, energyCost: 20, price: 15000, description: 'Capital ship grade shields' }
    ],

    // Engines
    engines: [
      { name: 'Ion Drive', tier: 1, speed: 10, fuelEfficiency: 1.0, price: 300, description: 'Basic propulsion system' },
      { name: 'Plasma Drive', tier: 2, speed: 15, fuelEfficiency: 1.2, price: 800, description: 'Improved thrust and efficiency' },
      { name: 'Fusion Engine', tier: 3, speed: 20, fuelEfficiency: 1.5, price: 2000, description: 'High-performance fusion drive' },
      { name: 'Antimatter Drive', tier: 4, speed: 30, fuelEfficiency: 1.3, price: 5000, description: 'Powerful antimatter propulsion' },
      { name: 'Quantum Drive', tier: 5, speed: 40, fuelEfficiency: 2.0, price: 12000, description: 'Cutting-edge quantum engine' }
    ],

    // Scanners
    scanners: [
      { name: 'Basic Scanner', tier: 1, range: 1, detailLevel: 1, price: 200, description: 'Short-range sector scanner' },
      { name: 'Long-Range Scanner', tier: 2, range: 2, detailLevel: 2, price: 600, description: 'Extended scanning range' },
      { name: 'Deep Scanner', tier: 3, range: 3, detailLevel: 3, price: 1500, description: 'Detailed object analysis' },
      { name: 'Military Scanner', tier: 4, range: 4, detailLevel: 4, price: 4000, description: 'Military-grade detection', detectsCloaked: true },
      { name: 'Quantum Scanner', tier: 5, range: 5, detailLevel: 5, price: 10000, description: 'Ultimate scanning capability' }
    ],

    // Cargo pods
    cargoPods: [
      { name: 'Small Cargo Pod', tier: 1, capacity: 25, price: 250, description: 'Basic cargo expansion' },
      { name: 'Medium Cargo Pod', tier: 2, capacity: 50, price: 600, description: 'Standard cargo module' },
      { name: 'Large Cargo Pod', tier: 3, capacity: 100, price: 1500, description: 'Spacious cargo container' },
      { name: 'Reinforced Cargo Pod', tier: 3, capacity: 75, price: 1800, description: 'Protected cargo storage', protectedCargo: true },
      { name: 'Massive Cargo Hold', tier: 4, capacity: 200, price: 4000, description: 'Industrial cargo module' }
    ],

    // Armor
    armor: [
      { name: 'Light Plating', tier: 1, hullBonus: 20, damageReduction: 0.05, price: 350, description: 'Basic hull reinforcement' },
      { name: 'Composite Armor', tier: 2, hullBonus: 50, damageReduction: 0.10, price: 900, description: 'Layered armor plating' },
      { name: 'Reactive Armor', tier: 3, hullBonus: 80, damageReduction: 0.15, price: 2200, description: 'Explosive-resistant armor' },
      { name: 'Ablative Armor', tier: 4, hullBonus: 120, damageReduction: 0.20, price: 5500, description: 'Energy weapon resistant' },
      { name: 'Quantum Armor', tier: 5, hullBonus: 200, damageReduction: 0.25, price: 14000, description: 'Top-tier hull protection' }
    ]
  },

  // ============== Phase 3: NPC Configuration ==============
  npcTypes: {
    PIRATE: {
      name: 'Pirate',
      hostility: 'hostile',
      behavior: 'aggressive',
      lootMultiplier: 1.5,
      ships: ['Fighter', 'Corvette'],
      spawnChance: 0.15
    },
    PIRATE_LORD: {
      name: 'Pirate Lord',
      hostility: 'hostile',
      behavior: 'aggressive',
      lootMultiplier: 3.0,
      ships: ['Destroyer'],
      spawnChance: 0.03,
      isBoss: true
    },
    TRADER: {
      name: 'Trader',
      hostility: 'neutral',
      behavior: 'flee',
      lootMultiplier: 0.8,
      ships: ['Freighter', 'Merchant Cruiser'],
      spawnChance: 0.20,
      canTrade: true
    },
    PATROL: {
      name: 'System Patrol',
      hostility: 'friendly',
      behavior: 'defensive',
      lootMultiplier: 0.5,
      ships: ['Corvette', 'Fighter'],
      spawnChance: 0.10,
      protectsSector: true
    },
    BOUNTY_HUNTER: {
      name: 'Bounty Hunter',
      hostility: 'neutral',
      behavior: 'opportunistic',
      lootMultiplier: 2.0,
      ships: ['Fighter', 'Corvette'],
      spawnChance: 0.05
    }
  },

  // Combat configuration
  combat: {
    maxRoundsPerBattle: 50,
    fleeChanceBase: 0.3,
    fleeChancePerSpeedDiff: 0.05,
    criticalHitChance: 0.10,
    criticalHitMultiplier: 2.0,
    shieldPenetration: 0.1, // 10% damage bypasses shields
    minDamage: 1,
    experiencePerDamage: 0.5,
    experiencePerKill: 100,
    lootDropChance: 0.7
  },

  // Maintenance configuration
  maintenance: {
    componentDegradationPerCombat: 0.02, // 2% degradation per combat round
    componentDegradationPerJump: 0.005, // 0.5% per sector jump
    hullRepairCostPerPoint: 5, // Credits per hull point
    componentRepairCostMultiplier: 0.3, // 30% of component price to fully repair
    minComponentCondition: 0.1, // Components break at 10% condition
    conditionEffectivenessRatio: 0.5 // At 50% condition, 50% effectiveness penalty
  },

  // ============== Phase 4: Planets, Colonization & Crew ==============

  // Crew capacity per ship type
  crewCapacity: {
    SCOUT: 2,
    MERCHANT_CRUISER: 4,
    FREIGHTER: 6,
    FIGHTER: 1,
    CORVETTE: 3,
    DESTROYER: 8,
    CARRIER: 15,
    COLONY_SHIP: 20
  },

  // Planet types and their characteristics
  planetTypes: {
    TERRAN: {
      name: 'Terran',
      habitability: 1.0,
      description: 'Earth-like planet with breathable atmosphere',
      resources: ['Water', 'Organics', 'Food'],
      color: '#4A90D9'
    },
    DESERT: {
      name: 'Desert',
      habitability: 0.5,
      description: 'Hot, arid world with sparse water',
      resources: ['Rare Minerals', 'Ore', 'Silicon'],
      color: '#D4A574'
    },
    ICE: {
      name: 'Ice',
      habitability: 0.3,
      description: 'Frozen world with subsurface oceans',
      resources: ['Water', 'Chemicals', 'Gases'],
      color: '#B8E4F0'
    },
    VOLCANIC: {
      name: 'Volcanic',
      habitability: 0.2,
      description: 'Geologically active with extreme heat',
      resources: ['Ore', 'Plasma', 'Rare Minerals'],
      color: '#FF6B35'
    },
    GAS_GIANT: {
      name: 'Gas Giant',
      habitability: 0.0,
      description: 'Massive gas planet with no solid surface',
      resources: ['Fuel', 'Chemicals', 'Plasma'],
      color: '#E8B4A0'
    },
    OCEANIC: {
      name: 'Oceanic',
      habitability: 0.7,
      description: 'Planet covered almost entirely by water',
      resources: ['Water', 'Food', 'Bio-Samples'],
      color: '#1E90FF'
    },
    BARREN: {
      name: 'Barren',
      habitability: 0.1,
      description: 'Rocky, lifeless world with minimal atmosphere',
      resources: ['Ore', 'Refined Metals', 'Construction Materials'],
      color: '#8B7355'
    },
    JUNGLE: {
      name: 'Jungle',
      habitability: 0.8,
      description: 'Dense vegetation covering most of the surface',
      resources: ['Organics', 'Bio-Samples', 'Food', 'Seeds'],
      color: '#228B22'
    },
    TOXIC: {
      name: 'Toxic',
      habitability: 0.1,
      description: 'Atmosphere filled with harmful gases',
      resources: ['Chemicals', 'Plasma', 'Narcotics'],
      color: '#9ACD32'
    },
    CRYSTALLINE: {
      name: 'Crystalline',
      habitability: 0.2,
      description: 'Surface covered in massive crystal formations',
      resources: ['Rare Minerals', 'Electronics', 'AI Cores'],
      color: '#E6E6FA'
    }
  },

  // Planet resource types available for extraction
  planetResources: [
    { name: 'Iron Ore', baseYield: 10, rarity: 0.8 },
    { name: 'Water', baseYield: 15, rarity: 0.7 },
    { name: 'Silicon', baseYield: 8, rarity: 0.6 },
    { name: 'Rare Minerals', baseYield: 3, rarity: 0.2 },
    { name: 'Organics', baseYield: 12, rarity: 0.5 },
    { name: 'Fuel', baseYield: 6, rarity: 0.4 },
    { name: 'Chemicals', baseYield: 5, rarity: 0.3 },
    { name: 'Bio-Samples', baseYield: 2, rarity: 0.15 }
  ],

  // Crew species (7 alien + 3 robot as per design doc)
  crewSpecies: {
    // Humanoid species
    HUMAN: {
      name: 'Human',
      type: 'organic',
      baseSalary: 100,
      bonuses: { piloting: 1.0, engineering: 1.0, combat: 1.0, science: 1.0 },
      description: 'Versatile and adaptable'
    },
    VEXIAN: {
      name: 'Vexian',
      type: 'organic',
      baseSalary: 120,
      bonuses: { piloting: 1.3, engineering: 0.9, combat: 1.0, science: 1.0 },
      description: 'Excellent pilots with keen reflexes'
    },
    KRYNN: {
      name: 'Krynn',
      type: 'organic',
      baseSalary: 140,
      bonuses: { piloting: 0.8, engineering: 1.4, combat: 0.9, science: 1.1 },
      description: 'Brilliant engineers and mechanics'
    },
    ZORATH: {
      name: 'Zorath',
      type: 'organic',
      baseSalary: 150,
      bonuses: { piloting: 0.9, engineering: 0.8, combat: 1.5, science: 0.8 },
      description: 'Fearsome warriors bred for combat'
    },
    SYLPHI: {
      name: 'Sylphi',
      type: 'organic',
      baseSalary: 130,
      bonuses: { piloting: 1.1, engineering: 1.0, combat: 0.7, science: 1.4 },
      description: 'Natural scientists and researchers'
    },
    GROX: {
      name: 'Grox',
      type: 'organic',
      baseSalary: 90,
      bonuses: { piloting: 0.8, engineering: 1.2, combat: 1.1, science: 0.7 },
      description: 'Hardy workers who require little maintenance'
    },
    NEXARI: {
      name: 'Nexari',
      type: 'organic',
      baseSalary: 160,
      bonuses: { piloting: 1.2, engineering: 1.1, combat: 1.1, science: 1.2 },
      description: 'Well-rounded aliens with telepathic abilities'
    },
    THRELL: {
      name: 'Threll',
      type: 'organic',
      baseSalary: 110,
      bonuses: { piloting: 1.0, engineering: 0.9, combat: 1.2, science: 0.9 },
      description: 'Multi-limbed aliens good in tight spaces'
    },
    // Robot types (no salary, maintenance cost instead)
    WORKER_BOT: {
      name: 'Worker Bot',
      type: 'robot',
      baseSalary: 50,
      bonuses: { piloting: 0.5, engineering: 1.3, combat: 0.5, science: 0.5 },
      description: 'Basic labor unit for repetitive tasks'
    },
    COMBAT_DROID: {
      name: 'Combat Droid',
      type: 'robot',
      baseSalary: 80,
      bonuses: { piloting: 0.6, engineering: 0.6, combat: 1.6, science: 0.4 },
      description: 'Military-grade combat automaton'
    },
    SCIENCE_UNIT: {
      name: 'Science Unit',
      type: 'robot',
      baseSalary: 100,
      bonuses: { piloting: 0.4, engineering: 1.0, combat: 0.3, science: 1.7 },
      description: 'Advanced AI research assistant'
    }
  },

  // Crew roles and their effects
  crewRoles: {
    PILOT: {
      name: 'Pilot',
      stat: 'piloting',
      effect: 'Improves ship speed and flee chance'
    },
    ENGINEER: {
      name: 'Engineer',
      stat: 'engineering',
      effect: 'Reduces maintenance costs and improves repairs'
    },
    GUNNER: {
      name: 'Gunner',
      stat: 'combat',
      effect: 'Increases weapon accuracy and damage'
    },
    SCIENTIST: {
      name: 'Scientist',
      stat: 'science',
      effect: 'Improves scanning and artifact research'
    }
  },

  // Artifact types (placeholder bonuses for now)
  artifactTypes: [
    { name: 'Ancient Star Map', rarity: 0.1, bonusType: 'navigation', description: 'Reveals hidden routes' },
    { name: 'Alien Power Core', rarity: 0.05, bonusType: 'energy', description: 'Mysterious energy source' },
    { name: 'Precursor Data Crystal', rarity: 0.08, bonusType: 'science', description: 'Contains ancient knowledge' },
    { name: 'Quantum Stabilizer', rarity: 0.06, bonusType: 'shields', description: 'Enhances shield stability' },
    { name: 'Bio-Enhancement Pod', rarity: 0.07, bonusType: 'crew', description: 'Improves crew performance' },
    { name: 'Gravity Manipulator', rarity: 0.04, bonusType: 'speed', description: 'Affects local gravity' },
    { name: 'Temporal Fragment', rarity: 0.02, bonusType: 'special', description: 'Time-displaced artifact' },
    { name: 'Void Crystal', rarity: 0.03, bonusType: 'damage', description: 'Channels destructive energy' },
    { name: 'Neural Interface', rarity: 0.09, bonusType: 'piloting', description: 'Direct ship control link' },
    { name: 'Fusion Catalyst', rarity: 0.12, bonusType: 'fuel', description: 'Improves fuel efficiency' }
  ],

  // Colonization settings
  colonization: {
    baseCost: 10000, // Credits to establish colony
    colonyShipRequired: true, // Require Colony Ship hull type
    basePopulationGrowth: 0.05, // 5% per tick
    baseResourceGeneration: 1.0, // Multiplier for resource extraction
    maxInfrastructureLevel: 10
  },

  // Crew salary settings
  crew: {
    salaryTickInterval: 24 * 60 * 60 * 1000, // 24 hours in ms
    salaryMultiplier: 1.0, // Server adjustable
    hiringFeeMultiplier: 5 // Hiring cost = baseSalary * multiplier
  }
};

