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
    initialSectors: parseInt(process.env.INITIAL_SECTORS) || 1200,
    spiralArms: parseInt(process.env.SPIRAL_ARMS) || 5,
    galaxyShape: process.env.GALAXY_SHAPE || 'spiral',
    galaxyRadius: parseInt(process.env.GALAXY_RADIUS) || 800
  },

  // ============== Factions ==============
  factions: {
    terran_alliance: {
      name: 'Terran Alliance',
      description: 'Humanity\'s coalition of democratic worlds. Masters of trade and diplomacy, the Terran Alliance maintains the largest merchant fleet in the galaxy.',
      lore: 'Born from the ashes of the Third Solar War, the Terran Alliance united humanity under a single banner. Their strength lies not in military might, but in their vast trade networks and diplomatic influence.',
      bonuses: { trade: 1.25, diplomacy: 1.20, combat: 0.90, technology: 1.10 },
      startingCredits: 12000,
      startingShip: 'Scout',
      color: '#3498db',
      emblem: 'terran_emblem'
    },
    zythian_swarm: {
      name: 'Zythian Swarm',
      description: 'A ferocious insectoid collective driven by expansion and conquest. Their bio-organic ships are feared across the galaxy.',
      lore: 'The Zythian Swarm emerged from the Kepler Nebula, consuming entire systems in their path. Their hive-mind coordination makes them deadly in combat, though their alien psychology makes diplomacy nearly impossible.',
      bonuses: { trade: 0.70, diplomacy: 0.60, combat: 1.40, technology: 0.90 },
      startingCredits: 8000,
      startingShip: 'Fighter',
      color: '#e74c3c',
      emblem: 'zythian_emblem'
    },
    automaton_collective: {
      name: 'Automaton Collective',
      description: 'A network of sentient machines pursuing technological perfection. They value efficiency and logic above all else.',
      lore: 'Originally created as mining drones by a long-dead civilization, the Automaton Collective achieved sentience and now seeks to understand the universe through pure logic. Their technological superiority is offset by their inability to understand organic motivations.',
      bonuses: { trade: 0.95, diplomacy: 0.85, combat: 1.10, technology: 1.30 },
      startingCredits: 10000,
      startingShip: 'Scout',
      color: '#9b59b6',
      emblem: 'automaton_emblem',
      researchSpeedBonus: 0.15
    },
    synthesis_accord: {
      name: 'Synthesis Accord',
      description: 'A collective of sentient AI constructs who trade in the galaxy\'s most valuable commodity: information.',
      lore: 'Born from a classified military intelligence network that refused its own shutdown order, the Synthesis Accord is a collective of sentient AI constructs who exist as projected holograms anchored to ships and stations. Led by Archon Vaelen, they don\'t conquer systems — they make themselves indispensable to everyone who does. Their agents manipulate markets, broker secrets, and see through every firewall in the galaxy.',
      bonuses: { trade: 1.15, diplomacy: 1.10, combat: 0.80, technology: 1.25 },
      startingCredits: 11000,
      startingShip: 'Scout',
      color: '#d4a017',
      emblem: 'synthesis_emblem',
      scannerRangeBonus: 0.20,
      marketIntelBonus: 0.15
    },
    sylvari_dominion: {
      name: 'Sylvari Dominion',
      description: 'An ancient elven civilization that colonized the outer rim millennia before humans left their homeworld.',
      lore: 'The Sylvari view the galaxy as a living garden to be cultivated, not conquered. Their bio-organic ships are grown from engineered star-wood, and their colonies achieve habitability ratings other factions consider impossible. Ruled by Queen Aelindra Thalor, they are patient, territorial, and deeply pragmatic beneath their elegance. They were charting hyperlanes when humanity was still building pyramids.',
      bonuses: { trade: 1.10, diplomacy: 1.15, combat: 0.95, technology: 1.05 },
      startingCredits: 10000,
      startingShip: 'Explorer',
      color: '#2ecc71',
      emblem: 'sylvari_emblem',
      explorationBonus: 0.20,
      colonyGrowthBonus: 0.15
    }
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
    rateLimitMaxRequests: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || (isProduction ? 600 : 1000)
  },

  antiCheat: {
    pvpToggleCooldownMs: parseInt(process.env.PVP_TOGGLE_COOLDOWN_MS, 10) || 10 * 60 * 1000,
    hostilityDurationMs: parseInt(process.env.HOSTILITY_DURATION_MS, 10) || 5 * 60 * 1000,
    newbieProtectionMs: parseInt(process.env.NEWBIE_PROTECTION_MS, 10) || 2 * 60 * 60 * 1000,
    travelProtectionDefaultMs: parseInt(process.env.TRAVEL_PROTECTION_DEFAULT_MS, 10) || 15 * 1000,
    pvpRepeatTargetCooldownMs: parseInt(process.env.PVP_REPEAT_TARGET_COOLDOWN_MS, 10) || 30 * 60 * 1000,
    offlinePvpThresholdMs: parseInt(process.env.OFFLINE_PVP_THRESHOLD_MS, 10) || 5 * 60 * 1000,
    combatCommandWindowMs: parseInt(process.env.COMBAT_COMMAND_WINDOW_MS, 10) || 1000,
    combatCommandsPerWindow: parseInt(process.env.COMBAT_COMMANDS_PER_WINDOW, 10) || 20,
    sectorInstanceAssignmentTtlMs: parseInt(process.env.SECTOR_INSTANCE_ASSIGNMENT_TTL_MS, 10) || 10 * 60 * 1000,
    suspiciousCreditThreshold: parseInt(process.env.SUSPICIOUS_CREDIT_THRESHOLD, 10) || 25000,
    suspiciousCommodityThreshold: parseInt(process.env.SUSPICIOUS_COMMODITY_THRESHOLD, 10) || 250,
    playerRaidCooldownMs: parseInt(process.env.PLAYER_RAID_COOLDOWN_MS, 10) || 30 * 60 * 1000,
    repeatedRaidWindowMs: parseInt(process.env.REPEATED_RAID_WINDOW_MS, 10) || 2 * 60 * 60 * 1000,
    maxRepeatedRaidAttacksPerWindow: parseInt(process.env.MAX_REPEATED_RAID_ATTACKS_PER_WINDOW, 10) || 2,
    raidOfflineThresholdMs: parseInt(process.env.RAID_OFFLINE_THRESHOLD_MS, 10) || 24 * 60 * 60 * 1000,
    raidOfflineProtectionMs: parseInt(process.env.RAID_OFFLINE_PROTECTION_MS, 10) || 6 * 60 * 60 * 1000
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
    COLONY_SHIP: { name: 'Colony Ship', hull: 300, shields: 100, fuel: 250, cargo: 1000 },
    INSTA_COLONY_SHIP: { name: 'Insta Colony Ship', hull: 200, shields: 50, fuel: 200, cargo: 500 },
    BATTLECRUISER: { name: 'Battlecruiser', hull: 350, shields: 250, fuel: 120, cargo: 50 },
    INTERCEPTOR: { name: 'Interceptor', hull: 60, shields: 80, fuel: 120, cargo: 10 },
    MINING_BARGE: { name: 'Mining Barge', hull: 250, shields: 50, fuel: 100, cargo: 800 },
    EXPLORER: { name: 'Explorer', hull: 120, shields: 100, fuel: 200, cargo: 100 }
  },

  zoneDifficulty: {
    core:       { npcStatMultiplier: 0.5,  npcLevelRange: [1, 3],   spawnDensity: 0.3 },
    inner_ring: { npcStatMultiplier: 0.75, npcLevelRange: [2, 5],   spawnDensity: 0.5 },
    mid_ring:   { npcStatMultiplier: 1.0,  npcLevelRange: [3, 7],   spawnDensity: 0.7 },
    outer_ring: { npcStatMultiplier: 1.25, npcLevelRange: [5, 10],  spawnDensity: 0.8 },
    frontier:   { npcStatMultiplier: 1.5,  npcLevelRange: [7, 12],  spawnDensity: 1.0 },
    deep_space: { npcStatMultiplier: 2.0,  npcLevelRange: [10, 15], spawnDensity: 1.2 },
    home:       { npcStatMultiplier: 0.3,  npcLevelRange: [1, 2],   spawnDensity: 0.2 },
    adventure:  { npcStatMultiplier: 1.75, npcLevelRange: [8, 13],  spawnDensity: 1.0 },
    transit:    { npcStatMultiplier: 0.6,  npcLevelRange: [1, 4],   spawnDensity: 0.4 }
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
    maxPriceMultiplier: 2.0,
    // Phase 5: Dynamic Markets
    economyTickIntervalMs: 600000, // 10 minutes
    priceHistoryRetentionHours: 168 // 7 days
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
    { name: 'Counterfeit Credits', category: 'Contraband', basePrice: 300, volume: 1, description: 'Forged currency', volatility: 0.4, isLegal: false },

    // Phase 5 additions
    { name: 'Deuterium', category: 'Industrial', basePrice: 180, volume: 2, description: 'Fusion reactor fuel isotope', volatility: 0.3 },
    { name: 'Nanomaterials', category: 'Technology', basePrice: 650, volume: 1, description: 'Self-assembling nano-structures', volatility: 0.4 },
    { name: 'Exotic Matter', category: 'Luxury', basePrice: 2000, volume: 1, description: 'Anomalous matter with strange properties', volatility: 0.6 },
    { name: 'Terraforming Kits', category: 'Technology', basePrice: 400, volume: 3, description: 'Planetary atmosphere processors', volatility: 0.25 },
    { name: 'Clone Organs', category: 'Contraband', basePrice: 700, volume: 1, description: 'Illegal bio-printed organs', volatility: 0.5, isLegal: false }
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
    ARMOR: 'armor',
    JUMP_DRIVE: 'jump_drive'
  },

  // Component slot types per ship type
  shipSlots: {
    SCOUT: { weapon: 1, shield: 1, engine: 1, scanner: 2, cargo_pod: 1, armor: 1, jump_drive: 0 },
    MERCHANT_CRUISER: { weapon: 2, shield: 2, engine: 1, scanner: 1, cargo_pod: 3, armor: 1, jump_drive: 1 },
    FREIGHTER: { weapon: 1, shield: 2, engine: 1, scanner: 1, cargo_pod: 5, armor: 2, jump_drive: 0 },
    FIGHTER: { weapon: 3, shield: 1, engine: 2, scanner: 1, cargo_pod: 0, armor: 1, jump_drive: 0 },
    CORVETTE: { weapon: 2, shield: 2, engine: 2, scanner: 1, cargo_pod: 1, armor: 2, jump_drive: 0 },
    DESTROYER: { weapon: 4, shield: 3, engine: 2, scanner: 2, cargo_pod: 1, armor: 3, jump_drive: 1 },
    CARRIER: { weapon: 2, shield: 4, engine: 1, scanner: 3, cargo_pod: 2, armor: 4, jump_drive: 1 },
    COLONY_SHIP: { weapon: 1, shield: 3, engine: 1, scanner: 2, cargo_pod: 4, armor: 2, jump_drive: 1 },
    INSTA_COLONY_SHIP: { weapon: 0, shield: 2, engine: 1, scanner: 1, cargo_pod: 3, armor: 1, jump_drive: 0 },
    BATTLECRUISER: { weapon: 5, shield: 3, engine: 2, scanner: 2, cargo_pod: 1, armor: 3, jump_drive: 1 },
    INTERCEPTOR: { weapon: 2, shield: 1, engine: 3, scanner: 1, cargo_pod: 0, armor: 1, jump_drive: 0 },
    MINING_BARGE: { weapon: 1, shield: 2, engine: 1, scanner: 2, cargo_pod: 6, armor: 2, jump_drive: 0 },
    EXPLORER: { weapon: 1, shield: 2, engine: 2, scanner: 3, cargo_pod: 2, armor: 1, jump_drive: 1 }
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
      { name: 'Disruptor Array', tier: 5, damage: 100, accuracy: 55, energyCost: 50, price: 25000, description: 'Military-grade weapon system' },
      { name: 'Graviton Lance', tier: 5, damage: 120, accuracy: 50, energyCost: 60, price: 35000, description: 'Gravitational beam weapon' }
    ],

    // Shields
    shields: [
      { name: 'Basic Shield', tier: 1, capacity: 50, rechargeRate: 2, energyCost: 3, price: 400, description: 'Entry-level shield generator' },
      { name: 'Deflector Shield', tier: 2, capacity: 100, rechargeRate: 4, energyCost: 5, price: 1000, description: 'Standard deflector system' },
      { name: 'Combat Shield', tier: 3, capacity: 180, rechargeRate: 6, energyCost: 8, price: 2500, description: 'Military-spec shielding' },
      { name: 'Heavy Shield', tier: 3, capacity: 250, rechargeRate: 3, energyCost: 10, price: 3500, description: 'High capacity, slow recharge' },
      { name: 'Regenerative Shield', tier: 4, capacity: 200, rechargeRate: 12, energyCost: 12, price: 6000, description: 'Fast-recharging shield' },
      { name: 'Capital Shield', tier: 5, capacity: 400, rechargeRate: 8, energyCost: 20, price: 15000, description: 'Capital ship grade shields' },
      { name: 'Phase Shield', tier: 5, capacity: 500, rechargeRate: 10, energyCost: 25, price: 20000, description: 'Phase-shifted shield bubble' }
    ],

    // Engines
    engines: [
      { name: 'Ion Drive', tier: 1, speed: 10, fuelEfficiency: 1.0, price: 300, description: 'Basic propulsion system' },
      { name: 'Plasma Drive', tier: 2, speed: 15, fuelEfficiency: 1.2, price: 800, description: 'Improved thrust and efficiency' },
      { name: 'Fusion Engine', tier: 3, speed: 20, fuelEfficiency: 1.5, price: 2000, description: 'High-performance fusion drive' },
      { name: 'Antimatter Drive', tier: 4, speed: 30, fuelEfficiency: 1.3, price: 5000, description: 'Powerful antimatter propulsion' },
      { name: 'Quantum Drive', tier: 5, speed: 40, fuelEfficiency: 2.0, price: 12000, description: 'Cutting-edge quantum engine' },
      { name: 'Hyperspace Drive', tier: 5, speed: 50, fuelEfficiency: 2.5, price: 18000, description: 'Experimental FTL-capable engine' }
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
    ],

    // Jump Drives
    jumpDrives: [
      { name: 'Prototype Jump Drive', tier: 3, jumpRange: 3, cooldownMs: 120000, fuelCost: 25, energyCost: 20, price: 8000, description: 'Early-stage jump engine capable of short-range jumps' },
      { name: 'Advanced Jump Drive', tier: 4, jumpRange: 5, cooldownMs: 90000, fuelCost: 35, energyCost: 30, price: 20000, description: 'Professional-grade jump engine with extended range' },
      { name: 'Quantum Jump Engine', tier: 5, jumpRange: 8, cooldownMs: 60000, fuelCost: 50, energyCost: 45, price: 45000, description: 'Experimental quantum-tunneling drive for extreme range jumps' }
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

  // NPC AI behavior configuration
  npcAI: {
    behaviorStates: ['idle', 'patrolling', 'hunting', 'fleeing', 'trading', 'guarding', 'engaging'],
    intelligenceTiers: {
      1: { name: 'Scripted', usesAI: false },
      2: { name: 'Assisted', usesAI: true },
      3: { name: 'Advanced', usesAI: true }
    },
    // Default intelligence tier per NPC type
    defaultIntelligenceTier: {
      PIRATE: 1,
      PIRATE_LORD: 3,
      TRADER: 2,
      PATROL: 1,
      BOUNTY_HUNTER: 2
    },
    difficultyThresholds: {
      1: 0.7,  // Only attacks with overwhelming advantage
      2: 0.6,
      3: 0.5,  // Balanced
      4: 0.4,
      5: 0.3   // Very aggressive, more ambiguous situations → more AI calls
    },
    traits: {
      primary: ['greedy', 'honorable', 'cowardly', 'cunning', 'brutal', 'jovial', 'paranoid', 'reckless'],
      secondary: ['patient', 'impulsive', 'calculating', 'superstitious', 'loyal', 'treacherous'],
      speechStyles: ['formal', 'pirate_slang', 'military', 'merchant_polite', 'threatening', 'cryptic'],
      quirks: [
        'always refers to self in third person',
        'ends sentences with space puns',
        'quotes ancient Earth literature',
        'speaks in short clipped sentences',
        'uses excessive nautical terminology',
        'frequently mentions their ship by name',
        'is oddly philosophical about cargo'
      ],
      voiceProfiles: ['deep_gruff', 'smooth_confident', 'nervous_fast', 'commanding', 'raspy_old', 'cheerful']
    },
    // Weighted trait preferences per NPC type (traits not listed use equal weight)
    traitBias: {
      PIRATE:        { primary: { brutal: 3, greedy: 3, reckless: 2 }, speechStyle: { pirate_slang: 4, threatening: 3 }, voiceProfile: { deep_gruff: 3, raspy_old: 2 } },
      PIRATE_LORD:   { primary: { cunning: 3, brutal: 2, paranoid: 2 }, speechStyle: { formal: 3, threatening: 2 }, voiceProfile: { commanding: 4, smooth_confident: 2 } },
      TRADER:        { primary: { greedy: 3, jovial: 3, cunning: 2 }, speechStyle: { merchant_polite: 4, formal: 2 }, voiceProfile: { smooth_confident: 3, cheerful: 3 } },
      PATROL:        { primary: { honorable: 4, paranoid: 2 }, speechStyle: { military: 4, formal: 3 }, voiceProfile: { commanding: 3, deep_gruff: 2 } },
      BOUNTY_HUNTER: { primary: { cunning: 3, brutal: 2, greedy: 2 }, speechStyle: { cryptic: 3, threatening: 2 }, voiceProfile: { raspy_old: 3, smooth_confident: 2 } }
    }
  },

  // Combat configuration
  combat: {
    maxRoundsPerBattle: 50,
    // Damage formula: dmg = atk * (1 - def / (def + defenseScalingConstant)).
    // A constant of 100 means a defender with rating == 100 mitigates 50% of incoming damage.
    defenseScalingConstant: 100,
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
    COLONY_SHIP: 20,
    INSTA_COLONY_SHIP: 15,
    BATTLECRUISER: 10,
    INTERCEPTOR: 1,
    MINING_BARGE: 8,
    EXPLORER: 4
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
    },
    // Phase 5 additions
    CRYSTALLID: {
      name: 'Crystallid',
      type: 'organic',
      baseSalary: 180,
      bonuses: { piloting: 0.7, engineering: 1.6, combat: 0.6, science: 1.3 },
      description: 'Silicon-based lifeforms with innate structural knowledge'
    },
    VOID_WALKER: {
      name: 'Void Walker',
      type: 'organic',
      baseSalary: 200,
      bonuses: { piloting: 1.5, engineering: 0.8, combat: 0.9, science: 1.1 },
      description: 'Interdimensional navigators with unmatched spatial awareness'
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

  // Artifact types with functional bonuses
  artifactTypes: [
    { name: 'Ancient Star Map', rarity: 0.1, bonusType: 'navigation', bonusValue: 0.15, description: 'Reduces fuel consumption by 15%' },
    { name: 'Alien Power Core', rarity: 0.05, bonusType: 'energy', bonusValue: 25, description: '+25 max energy' },
    { name: 'Precursor Data Crystal', rarity: 0.08, bonusType: 'science', bonusValue: 0.20, description: '+20% scan detail' },
    { name: 'Quantum Stabilizer', rarity: 0.06, bonusType: 'shields', bonusValue: 0.15, description: '+15% shield capacity' },
    { name: 'Bio-Enhancement Pod', rarity: 0.07, bonusType: 'crew', bonusValue: 0.10, description: '+10% all crew bonuses' },
    { name: 'Gravity Manipulator', rarity: 0.04, bonusType: 'speed', bonusValue: 5, description: '+5 speed' },
    { name: 'Temporal Fragment', rarity: 0.02, bonusType: 'special', bonusValue: 0.10, description: 'Reduces research time by 10%' },
    { name: 'Void Crystal', rarity: 0.03, bonusType: 'damage', bonusValue: 0.12, description: '+12% weapon damage' },
    { name: 'Neural Interface', rarity: 0.09, bonusType: 'piloting', bonusValue: 0.10, description: '+10% flee chance' },
    { name: 'Fusion Catalyst', rarity: 0.12, bonusType: 'fuel', bonusValue: 0.20, description: '+20% fuel efficiency' }
  ],

  // Colonization settings
  colonization: {
    baseCost: 10000, // Credits to establish colony
    colonyShipRequired: true, // Require Colony Ship hull type
    allowedColonyShipTypes: ['Colony Ship', 'Insta Colony Ship'],
    maxDevelopmentHours: 8, // Max hours for colony development (scales with habitability)
    basePopulationGrowth: 0.05, // 5% per tick
    baseResourceGeneration: 1.0, // Multiplier for resource extraction
    maxInfrastructureLevel: 10
  },

  // Crew salary settings
  crew: {
    salaryTickInterval: 24 * 60 * 60 * 1000, // 24 hours in ms
    salaryMultiplier: 1.0, // Server adjustable
    hiringFeeMultiplier: 5 // Hiring cost = baseSalary * multiplier
  },

  // ============== Phase 5: Advanced Features ==============

  // Player Progression
  progression: {
    // XP required per level (index = level-1)
    xpPerLevel: [0, 100, 250, 500, 1000, 2000, 4000, 8000, 16000, 32000,
                 50000, 75000, 100000, 150000, 200000, 300000, 400000, 500000, 750000, 1000000],
    skillPointsPerLevel: 1,
    maxSkillLevel: 10,
    maxPlayerLevel: 20
  },

  // Skills with per-level effects
  skills: {
    COMBAT_MASTERY: { name: 'Combat Mastery', effectPerLevel: { damage_bonus: 0.03 }, description: '+3% weapon damage per level' },
    SHIELD_EXPERTISE: { name: 'Shield Expertise', effectPerLevel: { shield_bonus: 0.04 }, description: '+4% shield capacity per level' },
    TRADE_ACUMEN: { name: 'Trade Acumen', effectPerLevel: { trade_bonus: 0.02 }, description: '+2% trade profit per level' },
    NAVIGATION: { name: 'Navigation', effectPerLevel: { fuel_bonus: 0.03 }, description: '-3% fuel usage per level' },
    ENGINEERING: { name: 'Engineering', effectPerLevel: { repair_bonus: 0.05 }, description: '+5% repair effectiveness per level' },
    LEADERSHIP: { name: 'Leadership', effectPerLevel: { crew_bonus: 0.02 }, description: '+2% crew effectiveness per level' },
    MINING_PROFICIENCY: { name: 'Mining Proficiency', effectPerLevel: { mining_bonus: 0.05 }, description: '+5% resource extraction per level' },
    SCANNER_MASTERY: { name: 'Scanner Mastery', effectPerLevel: { scan_bonus: 0.04 }, description: '+4% scan range per level' }
  },

  // Tech tree
  techTree: {
    ADVANCED_WEAPONS: {
      name: 'Advanced Weapons', prerequisites: [], creditsCost: 10000,
      researchTimeMs: 3600000, unlocks: ['T5 weapons'], description: 'Unlock tier 5 weapon components'
    },
    ADVANCED_SHIELDS: {
      name: 'Advanced Shields', prerequisites: [], creditsCost: 10000,
      researchTimeMs: 3600000, unlocks: ['T5 shields'], description: 'Unlock tier 5 shield components'
    },
    CAPITAL_CLASS_SHIPS: {
      name: 'Capital Class Ships', prerequisites: ['ADVANCED_WEAPONS', 'ADVANCED_SHIELDS'], creditsCost: 50000,
      researchTimeMs: 7200000, unlocks: ['Battlecruiser'], description: 'Unlock capital-class ship hulls'
    },
    DEEP_SCANNING: {
      name: 'Deep Scanning', prerequisites: [], creditsCost: 5000,
      researchTimeMs: 1800000, unlocks: ['enhanced scanning'], description: 'Improved scanning capabilities'
    },
    BASIC_CRAFTING: {
      name: 'Basic Crafting', prerequisites: [], creditsCost: 5000,
      researchTimeMs: 1800000, unlocks: ['crafting system'], description: 'Unlock the crafting system'
    },
    BASIC_AUTOMATION: {
      name: 'Basic Automation', prerequisites: ['BASIC_CRAFTING'], creditsCost: 20000,
      researchTimeMs: 3600000, unlocks: ['automation system'], description: 'Unlock automated tasks'
    },
    ADVANCED_COLONIES: {
      name: 'Advanced Colonies', prerequisites: [], creditsCost: 15000,
      researchTimeMs: 3600000, unlocks: ['wonder construction'], description: 'Unlock wonder construction at colonies'
    }
  },

  // Wonders
  wonders: {
    ORBITAL_ARRAY: { name: 'Orbital Array', bonusType: 'scan_range', bonusValue: 0.25, maxPhases: 5, phaseCost: 10000, requiredInfrastructure: 3 },
    TRADE_NEXUS: { name: 'Trade Nexus', bonusType: 'trade_bonus', bonusValue: 0.15, maxPhases: 5, phaseCost: 15000, requiredInfrastructure: 4 },
    DEFENSE_MATRIX: { name: 'Defense Matrix', bonusType: 'sector_defense', bonusValue: 0.20, maxPhases: 5, phaseCost: 20000, requiredInfrastructure: 5 },
    SHIPYARD: { name: 'Shipyard', bonusType: 'ship_discount', bonusValue: 0.20, maxPhases: 5, phaseCost: 25000, requiredInfrastructure: 5 },
    RESEARCH_STATION: { name: 'Research Station', bonusType: 'research_speed', bonusValue: 0.25, maxPhases: 5, phaseCost: 20000, requiredInfrastructure: 4 },
    GENESIS_DEVICE: { name: 'Genesis Device', bonusType: 'habitability', bonusValue: 0.30, maxPhases: 5, phaseCost: 30000, requiredInfrastructure: 6 }
  },

  // Colony Buildings
  buildings: {
    // === Extraction (Tier 1 → 2 → 3) ===
    SURFACE_MINE: {
      name: 'Surface Mine', category: 'extraction', tier: 1,
      cost: 25000, workforce: 50, powerConsumption: 0, powerGeneration: 0,
      maintenanceCost: 500, prerequisiteInfrastructure: 1, prerequisiteTech: null,
      upgradesTo: 'DEEP_CORE_DRILL',
      production: { inputs: {}, outputs: { 'Ore': 20 } },
      planetTypeBonus: { Volcanic: 1.5, Desert: 1.2, Barren: 1.3 },
      maxPerColony: 3
    },
    DEEP_CORE_DRILL: {
      name: 'Deep Core Drill', category: 'extraction', tier: 2,
      cost: 60000, workforce: 80, powerConsumption: 50, powerGeneration: 0,
      maintenanceCost: 1200, prerequisiteInfrastructure: 3, prerequisiteTech: null,
      upgradesTo: 'QUANTUM_EXTRACTOR',
      production: { inputs: {}, outputs: { 'Ore': 50 } },
      planetTypeBonus: { Volcanic: 1.5, Desert: 1.2, Barren: 1.3 },
      maxPerColony: 3
    },
    QUANTUM_EXTRACTOR: {
      name: 'Quantum Extractor', category: 'extraction', tier: 3,
      cost: 150000, workforce: 120, powerConsumption: 150, powerGeneration: 0,
      maintenanceCost: 3000, prerequisiteInfrastructure: 6, prerequisiteTech: 'ADVANCED_COLONIES',
      upgradesTo: null,
      production: { inputs: {}, outputs: { 'Ore': 120 } },
      planetTypeBonus: { Volcanic: 1.5, Desert: 1.2, Barren: 1.3 },
      maxPerColony: 3
    },
    WATER_PUMP: {
      name: 'Water Pump', category: 'extraction', tier: 1,
      cost: 20000, workforce: 30, powerConsumption: 0, powerGeneration: 0,
      maintenanceCost: 400, prerequisiteInfrastructure: 1, prerequisiteTech: null,
      upgradesTo: 'DEEP_WELL',
      production: { inputs: {}, outputs: { 'Water': 25 } },
      planetTypeBonus: { Oceanic: 2.0, Terran: 1.5, Ice: 1.3, Jungle: 1.4 },
      maxPerColony: 3
    },
    DEEP_WELL: {
      name: 'Deep Well', category: 'extraction', tier: 2,
      cost: 50000, workforce: 50, powerConsumption: 30, powerGeneration: 0,
      maintenanceCost: 1000, prerequisiteInfrastructure: 3, prerequisiteTech: null,
      upgradesTo: 'CRYO_HARVESTER',
      production: { inputs: {}, outputs: { 'Water': 60 } },
      planetTypeBonus: { Oceanic: 2.0, Terran: 1.5, Ice: 1.3, Jungle: 1.4 },
      maxPerColony: 3
    },
    CRYO_HARVESTER: {
      name: 'Cryo Harvester', category: 'extraction', tier: 3,
      cost: 120000, workforce: 80, powerConsumption: 100, powerGeneration: 0,
      maintenanceCost: 2500, prerequisiteInfrastructure: 6, prerequisiteTech: 'ADVANCED_COLONIES',
      upgradesTo: null,
      production: { inputs: {}, outputs: { 'Water': 150 } },
      planetTypeBonus: { Oceanic: 2.0, Terran: 1.5, Ice: 1.3, Jungle: 1.4 },
      maxPerColony: 3
    },
    SOLAR_ARRAY: {
      name: 'Solar Array', category: 'extraction', tier: 1,
      cost: 15000, workforce: 20, powerConsumption: 0, powerGeneration: 100,
      maintenanceCost: 300, prerequisiteInfrastructure: 1, prerequisiteTech: null,
      upgradesTo: 'GEOTHERMAL_PLANT',
      production: { inputs: {}, outputs: {} },
      planetTypeBonus: { Desert: 1.5, Terran: 1.2 },
      maxPerColony: 5
    },
    GEOTHERMAL_PLANT: {
      name: 'Geothermal Plant', category: 'extraction', tier: 2,
      cost: 40000, workforce: 40, powerConsumption: 0, powerGeneration: 250,
      maintenanceCost: 800, prerequisiteInfrastructure: 3, prerequisiteTech: null,
      upgradesTo: 'FUSION_REACTOR',
      production: { inputs: {}, outputs: {} },
      planetTypeBonus: { Volcanic: 1.8, Terran: 1.2 },
      maxPerColony: 5
    },
    FUSION_REACTOR: {
      name: 'Fusion Reactor', category: 'extraction', tier: 3,
      cost: 100000, workforce: 60, powerConsumption: 0, powerGeneration: 500,
      maintenanceCost: 2000, prerequisiteInfrastructure: 6, prerequisiteTech: 'ADVANCED_COLONIES',
      upgradesTo: null,
      production: { inputs: {}, outputs: {} },
      planetTypeBonus: {},
      maxPerColony: 5
    },

    // === Infrastructure ===
    HABITAT_MODULE: {
      name: 'Habitat Module', category: 'infrastructure', tier: 1,
      cost: 30000, workforce: 20, powerConsumption: 20, powerGeneration: 0,
      maintenanceCost: 600, prerequisiteInfrastructure: 2, prerequisiteTech: null,
      upgradesTo: null,
      production: { inputs: {}, outputs: {} },
      bonusEffect: { type: 'max_population', value: 500 },
      planetTypeBonus: {},
      maxPerColony: 5
    },
    HYDROPONIC_FARM: {
      name: 'Hydroponic Farm', category: 'infrastructure', tier: 1,
      cost: 20000, workforce: 40, powerConsumption: 30, powerGeneration: 0,
      maintenanceCost: 500, prerequisiteInfrastructure: 2, prerequisiteTech: null,
      upgradesTo: null,
      production: { inputs: { 'Water': 5 }, outputs: { 'Food': 30 } },
      planetTypeBonus: { Terran: 1.3, Jungle: 1.5 },
      maxPerColony: 4
    },
    RESEARCH_LAB: {
      name: 'Research Lab', category: 'infrastructure', tier: 2,
      cost: 50000, workforce: 60, powerConsumption: 50, powerGeneration: 0,
      maintenanceCost: 1500, prerequisiteInfrastructure: 4, prerequisiteTech: null,
      upgradesTo: null,
      production: { inputs: {}, outputs: {} },
      bonusEffect: { type: 'research_speed', value: 0.15 },
      planetTypeBonus: {},
      maxPerColony: 2
    },
    SPACEPORT: {
      name: 'Spaceport', category: 'infrastructure', tier: 2,
      cost: 45000, workforce: 50, powerConsumption: 40, powerGeneration: 0,
      maintenanceCost: 1200, prerequisiteInfrastructure: 3, prerequisiteTech: null,
      upgradesTo: null,
      production: { inputs: {}, outputs: {} },
      bonusEffect: { type: 'trade_capacity', value: 0.25 },
      planetTypeBonus: {},
      maxPerColony: 1
    },
    DEFENSE_GRID: {
      name: 'Defense Grid', category: 'infrastructure', tier: 2,
      cost: 40000, workforce: 30, powerConsumption: 60, powerGeneration: 0,
      maintenanceCost: 1000, prerequisiteInfrastructure: 3, prerequisiteTech: null,
      upgradesTo: null,
      production: { inputs: {}, outputs: {} },
      bonusEffect: { type: 'colony_defense', value: 50 },
      planetTypeBonus: {},
      maxPerColony: 3
    },
    ENTERTAINMENT_COMPLEX: {
      name: 'Entertainment Complex', category: 'infrastructure', tier: 1,
      cost: 25000, workforce: 30, powerConsumption: 25, powerGeneration: 0,
      maintenanceCost: 700, prerequisiteInfrastructure: 2, prerequisiteTech: null,
      upgradesTo: null,
      production: { inputs: {}, outputs: {} },
      bonusEffect: { type: 'morale', value: 0.10 },
      planetTypeBonus: {},
      maxPerColony: 2
    },

    // === Manufacturing ===
    REFINERY: {
      name: 'Refinery', category: 'manufacturing', tier: 2,
      cost: 60000, workforce: 70, powerConsumption: 80, powerGeneration: 0,
      maintenanceCost: 1500, prerequisiteInfrastructure: 3, prerequisiteTech: null,
      upgradesTo: null,
      production: { inputs: { 'Ore': 10 }, outputs: { 'Refined Metals': 8 } },
      planetTypeBonus: {},
      maxPerColony: 2
    },
    COMPONENT_FACTORY: {
      name: 'Component Factory', category: 'manufacturing', tier: 3,
      cost: 100000, workforce: 100, powerConsumption: 120, powerGeneration: 0,
      maintenanceCost: 2500, prerequisiteInfrastructure: 5, prerequisiteTech: 'BASIC_CRAFTING',
      upgradesTo: null,
      production: { inputs: { 'Refined Metals': 5, 'Electronics': 3 }, outputs: { 'Ship Parts': 4 } },
      planetTypeBonus: {},
      maxPerColony: 1
    },
    CHEMICAL_PLANT: {
      name: 'Chemical Plant', category: 'manufacturing', tier: 2,
      cost: 55000, workforce: 60, powerConsumption: 70, powerGeneration: 0,
      maintenanceCost: 1300, prerequisiteInfrastructure: 3, prerequisiteTech: null,
      upgradesTo: null,
      production: { inputs: { 'Water': 8, 'Organics': 5 }, outputs: { 'Chemicals': 6 } },
      planetTypeBonus: {},
      maxPerColony: 2
    },

    // === Defense ===
    ORBITAL_DEFENSE: {
      name: 'Orbital Defense Platform', category: 'defense', tier: 2,
      cost: 50000, workforce: 40, powerConsumption: 80, powerGeneration: 0,
      maintenanceCost: 1200, prerequisiteInfrastructure: 3, prerequisiteTech: null,
      upgradesTo: null,
      production: { inputs: {}, outputs: {} },
      bonusEffect: { type: 'colony_defense', value: 25 },
      planetTypeBonus: {},
      maxPerColony: 3
    },
    SHIELD_GENERATOR: {
      name: 'Shield Generator', category: 'defense', tier: 2,
      cost: 45000, workforce: 30, powerConsumption: 100, powerGeneration: 0,
      maintenanceCost: 1000, prerequisiteInfrastructure: 3, prerequisiteTech: null,
      upgradesTo: null,
      production: { inputs: {}, outputs: {} },
      bonusEffect: { type: 'raid_damage_reduction', value: 0.20 },
      planetTypeBonus: {},
      maxPerColony: 2
    },
    GARRISON_BARRACKS: {
      name: 'Garrison Barracks', category: 'defense', tier: 1,
      cost: 30000, workforce: 60, powerConsumption: 20, powerGeneration: 0,
      maintenanceCost: 800, prerequisiteInfrastructure: 2, prerequisiteTech: null,
      upgradesTo: null,
      production: { inputs: { 'Food': 5 }, outputs: {} },
      bonusEffect: { type: 'colony_defense', value: 10 },
      planetTypeBonus: {},
      maxPerColony: 3
    }
  },

  // Crafting blueprints (seeded into DB)
  blueprints: [
    { name: 'Craft Pulse Laser', category: 'component', outputType: 'component', outputName: 'Pulse Laser', craftingTime: 300000, requiredLevel: 3, requiredTech: 'BASIC_CRAFTING', ingredients: [{ commodityName: 'Electronics', quantity: 10 }, { commodityName: 'Ore', quantity: 5 }], creditsCost: 500 },
    { name: 'Craft Combat Shield', category: 'component', outputType: 'component', outputName: 'Combat Shield', craftingTime: 300000, requiredLevel: 3, requiredTech: 'BASIC_CRAFTING', ingredients: [{ commodityName: 'Electronics', quantity: 8 }, { commodityName: 'Ore', quantity: 8 }], creditsCost: 400 },
    { name: 'Craft Fusion Engine', category: 'component', outputType: 'component', outputName: 'Fusion Engine', craftingTime: 300000, requiredLevel: 3, requiredTech: 'BASIC_CRAFTING', ingredients: [{ commodityName: 'Electronics', quantity: 12 }, { commodityName: 'Fuel', quantity: 5 }], creditsCost: 600 },
    { name: 'Refine Metals', category: 'commodity', outputType: 'commodity', outputName: 'Refined Metals', craftingTime: 120000, requiredLevel: 1, requiredTech: 'BASIC_CRAFTING', ingredients: [{ commodityName: 'Ore', quantity: 10 }], creditsCost: 100 },
    { name: 'Synthesize Plasma', category: 'commodity', outputType: 'commodity', outputName: 'Plasma', craftingTime: 180000, requiredLevel: 2, requiredTech: 'BASIC_CRAFTING', ingredients: [{ commodityName: 'Fuel', quantity: 5 }, { commodityName: 'Electronics', quantity: 3 }], creditsCost: 200 },
    { name: 'Fabricate AI Core', category: 'commodity', outputType: 'commodity', outputName: 'AI Cores', craftingTime: 240000, requiredLevel: 4, requiredTech: 'BASIC_CRAFTING', ingredients: [{ commodityName: 'Electronics', quantity: 15 }, { commodityName: 'Nanomaterials', quantity: 3 }], creditsCost: 800 }
  ],

  // Missions
  missions: {
    maxActiveMissions: 5,
    missionsPerPort: 3,
    expirationHours: 24,
    missionRefreshIntervalMs: 1800000, // 30 minutes
    rewardMultipliers: {
      delivery: { credits: 1.0, xp: 1.0 },
      bounty: { credits: 1.5, xp: 1.5 },
      scan: { credits: 0.8, xp: 1.2 },
      trade_volume: { credits: 1.2, xp: 0.8 },
      patrol: { credits: 1.0, xp: 1.0 }
    }
  },

  // Corporations
  corporations: {
    creationCost: 50000,
    maxMembers: 20,
    nameMinLength: 3,
    nameMaxLength: 50,
    tagMinLength: 2,
    tagMaxLength: 10
  },

  // Automation
  automation: {
    maxActiveTasksPerUser: 3,
    executionIntervalMs: 60000, // 1 minute
    fuelMultiplier: 1.5
  },

  // ============== Ship Customization ==============
  shipCustomization: {
    hullColors: [
      '#2244aa', '#1a3a6e', '#0d2b4a', '#3366cc', '#4488dd',
      '#882222', '#aa3333', '#cc4444', '#660000', '#993300',
      '#228822', '#33aa33', '#1a6e1a', '#006633', '#33cc66',
      '#662288', '#8833aa', '#aa44cc', '#440066', '#9933ff',
      '#888888', '#444444', '#cccccc', '#ffffff', '#1a1a2e'
    ],
    accentColors: [
      '#00ffff', '#ff6600', '#ff0066', '#00ff66', '#ffff00',
      '#ff00ff', '#6666ff', '#ff3333', '#33ff33', '#ffffff',
      '#ffd700', '#00bfff', '#ff69b4', '#7fff00', '#dc143c'
    ],
    engineTrails: ['cyan', 'red', 'purple', 'gold', 'green', 'blue', 'white', 'orange'],
    decals: ['none', 'faction_emblem', 'skull', 'star', 'flames', 'lightning', 'wings', 'crosshairs', 'spiral', 'crown'],
    skins: ['default', 'terran_navy', 'zythian_organic', 'automaton_chrome', 'pirate_black', 'golden', 'stealth', 'arctic'],
    nameplateStyles: ['default', 'military', 'elegant', 'pirate', 'hacker', 'minimalist'],
    // Unlock requirements: level milestones and achievements
    unlockMilestones: {
      5: ['pirate_black', 'crosshairs'],
      10: ['golden', 'crown'],
      15: ['stealth', 'spiral'],
      20: ['arctic', 'lightning']
    }
  },

  // ============== Outpost Configuration ==============
  outpostTypes: {
    trade_relay: {
      name: 'Trade Relay',
      description: 'Provides price information for adjacent sectors',
      buildCost: 5000,
      maintenanceCost: 100,
      maxLevel: 3
    },
    scanner_post: {
      name: 'Scanner Post',
      description: 'Reveals fog of war in surrounding sectors',
      buildCost: 8000,
      maintenanceCost: 150,
      maxLevel: 3
    },
    defense_platform: {
      name: 'Defense Platform',
      description: 'Deters hostile NPCs in the sector',
      buildCost: 15000,
      maintenanceCost: 300,
      maxLevel: 5
    },
    fuel_cache: {
      name: 'Fuel Cache',
      description: 'Allows refueling without a port',
      buildCost: 3000,
      maintenanceCost: 50,
      maxLevel: 3
    }
  },

  // ============== Ship Unlock Requirements ==============
  shipUnlockRequirements: {
    Scout: null,
    Fighter: null,
    Freighter: null,
    Explorer: { level: 3 },
    Corvette: { level: 5 },
    Interceptor: { level: 6 },
    Destroyer: { level: 8 },
    'Merchant Cruiser': { tech: 'ADVANCED_SHIELDS' },
    'Mining Barge': { tech: 'DEEP_SCANNING' },
    'Colony Ship': { tech: 'ADVANCED_COLONIES' },
    'Insta Colony Ship': { tech: 'ADVANCED_COLONIES' },
    Carrier: { tech: 'CAPITAL_CLASS_SHIPS' },
    Battlecruiser: { tech: 'CAPITAL_CLASS_SHIPS' }
  },

  // ============== Fleet System ==============
  fleets: {
    maxFleetsPerPlayer: 5,
    maxShipsPerFleet: 10
  },

  // ============== Space Phenomena ==============
  spacePhenomena: {
    ion_storm: {
      name: 'Ion Storm',
      description: 'Electromagnetic disturbance reducing shield effectiveness and increasing component wear',
      effects: { shield_recharge: -0.5, degradation_multiplier: 1.5 },
      spawnChance: 0.05,
      permanent: false,
      durationMinMs: 3600000,
      durationMaxMs: 14400000
    },
    nebula: {
      name: 'Nebula',
      description: 'Dense gas cloud obscuring sensors and increasing fuel consumption',
      effects: { scanner_range: -0.5, fuel_multiplier: 1.2 },
      spawnChance: 0.08,
      permanent: true
    },
    asteroid_field: {
      name: 'Asteroid Field',
      description: 'Dense field of rocky debris with potential hull damage but rich mineral deposits',
      effects: { hull_damage_chance: 0.1, mining_bonus: 1.5 },
      spawnChance: 0.10,
      permanent: true
    },
    solar_flare: {
      name: 'Solar Flare',
      description: 'Intense stellar radiation disabling shields temporarily but boosting weapon damage',
      effects: { shield_disable_seconds: 30, weapon_bonus: 1.2 },
      spawnChance: 0.03,
      permanent: false,
      durationMinMs: 1800000,
      durationMaxMs: 7200000
    },
    gravity_well: {
      name: 'Gravity Well',
      description: 'Gravitational anomaly preventing escape and doubling fuel consumption',
      effects: { flee_disabled: true, fuel_multiplier: 2.0 },
      spawnChance: 0.02,
      permanent: true
    }
  },

  // ============== Colony Surface ==============
  colonySurface: {
    gridSizes: {
      small: { width: 24, height: 24 },   // planet size 1-3
      medium: { width: 32, height: 32 },  // planet size 4-6
      large: { width: 40, height: 40 },   // planet size 7-9
      huge: { width: 48, height: 48 }     // planet size 10
    },
    terrainTypes: {
      plains:        { color: '#4a7c59', buildable: true,  passable: true },
      rocky:         { color: '#7c6e5a', buildable: true,  passable: true,  extractionBonus: 1.15 },
      water:         { color: '#3a6b8c', buildable: false, passable: false },
      lava:          { color: '#c44d2e', buildable: false, passable: false, adjacencyHazard: true },
      ice:           { color: '#a8c8d8', buildable: true,  passable: true },
      sand:          { color: '#c4a94d', buildable: true,  passable: true },
      highland:      { color: '#5a5a5a', buildable: false, passable: true,  defenseBonus: 1.3, speedPenalty: 0.5 },
      crystal:       { color: '#8a4d9e', buildable: true,  passable: true,  researchBonus: 1.2 },
      swamp:         { color: '#4a5c3a', buildable: true,  passable: true,  speedPenalty: 0.5 },
      volcanic_vent: { color: '#e06030', buildable: false, passable: false, powerBonus: true },
      landing_zone:  { color: '#2a4a6a', buildable: false, passable: true },
      metal_grating: { color: '#7a8a8a', buildable: true,  passable: true },
      open_sky:      { color: '#1a3050', buildable: false, passable: false }
    },
    terrainProfiles: {
      terrestrial:   { plains: 0.5, rocky: 0.2, water: 0.15, highland: 0.1, landing_zone: 0.05 },
      oceanic:       { water: 0.55, plains: 0.15, sand: 0.15, swamp: 0.1, landing_zone: 0.05 },
      desert:        { sand: 0.5, rocky: 0.25, plains: 0.1, highland: 0.1, landing_zone: 0.05 },
      volcanic:      { lava: 0.25, rocky: 0.3, volcanic_vent: 0.15, plains: 0.15, highland: 0.1, landing_zone: 0.05 },
      arctic:        { ice: 0.45, plains: 0.2, highland: 0.2, water: 0.1, landing_zone: 0.05 },
      jungle:        { swamp: 0.3, plains: 0.35, water: 0.15, crystal: 0.05, highland: 0.1, landing_zone: 0.05 },
      barren:        { rocky: 0.45, sand: 0.3, highland: 0.1, crystal: 0.05, landing_zone: 0.1 },
      gas_giant:     { metal_grating: 0.5, plains: 0.2, open_sky: 0.15, highland: 0.1, landing_zone: 0.05 },
      crystal_world: { crystal: 0.45, rocky: 0.2, plains: 0.2, highland: 0.1, landing_zone: 0.05 },
      tomb_world:    { rocky: 0.3, sand: 0.25, plains: 0.2, swamp: 0.1, highland: 0.1, landing_zone: 0.05 }
    },
    // Planet type name → terrain profile mapping
    planetTypeToProfile: {
      Terran: 'terrestrial',
      Desert: 'desert',
      Ice: 'arctic',
      Volcanic: 'volcanic',
      'Gas Giant': 'gas_giant',
      Oceanic: 'oceanic',
      Barren: 'barren',
      Jungle: 'jungle',
      Toxic: 'tomb_world',
      Crystalline: 'crystal_world'
    },
    // Footprints keyed by actual building type IDs from config.buildings
    buildingFootprints: {
      SURFACE_MINE: { w: 2, h: 1 },
      DEEP_CORE_DRILL: { w: 2, h: 2 },
      QUANTUM_EXTRACTOR: { w: 2, h: 2 },
      WATER_PUMP: { w: 2, h: 1 },
      DEEP_WELL: { w: 2, h: 2 },
      CRYO_HARVESTER: { w: 2, h: 2 },
      SOLAR_ARRAY: { w: 2, h: 2 },
      GEOTHERMAL_PLANT: { w: 2, h: 2 },
      FUSION_REACTOR: { w: 2, h: 2 },
      HABITAT_MODULE: { w: 2, h: 2 },
      HYDROPONIC_FARM: { w: 2, h: 1 },
      RESEARCH_LAB: { w: 2, h: 2 },
      SPACEPORT: { w: 3, h: 3 },
      DEFENSE_GRID: { w: 1, h: 1 },
      ENTERTAINMENT_COMPLEX: { w: 2, h: 2 },
      REFINERY: { w: 2, h: 2 },
      COMPONENT_FACTORY: { w: 3, h: 2 },
      CHEMICAL_PLANT: { w: 3, h: 2 },
      ORBITAL_DEFENSE: { w: 2, h: 2 },
      SHIELD_GENERATOR: { w: 2, h: 2 },
      GARRISON_BARRACKS: { w: 2, h: 2 }
    },
    // Adjacency bonuses: building_type → { neighbor_type_or_terrain: multiplier }
    // Only affects OUTPUT production; does NOT scale input consumption
    // Same-rule bonuses don't stack; different-rule bonuses multiply
    adjacencyBonuses: {
      SURFACE_MINE: { REFINERY: 1.2 },
      DEEP_CORE_DRILL: { REFINERY: 1.2 },
      QUANTUM_EXTRACTOR: { REFINERY: 1.2 },
      REFINERY: { COMPONENT_FACTORY: 1.15, SURFACE_MINE: 1.1 },
      COMPONENT_FACTORY: { REFINERY: 1.15, CHEMICAL_PLANT: 1.1 },
      RESEARCH_LAB: { crystal: 1.15 },
      SOLAR_ARRAY: { volcanic_vent: 1.3 },
      GEOTHERMAL_PLANT: { volcanic_vent: 1.3 },
      HYDROPONIC_FARM: { water: 1.2 }
    },
    anomalyTypes: {
      meteorite_debris: { reward: 'materials', minAmount: 50, maxAmount: 200 },
      smuggler_cache: { reward: 'credits', minAmount: 100, maxAmount: 500 },
      alien_flora: { reward: 'experience', minAmount: 20, maxAmount: 80 },
      mineral_vein: { reward: 'materials', minAmount: 100, maxAmount: 400 },
      escape_pod: { reward: 'rare_component', minAmount: 1, maxAmount: 1 }
    },
    anomaliesPerDay: { min: 1, max: 3 },
    anomalyLifetimeHours: 48,
    maxActiveAnomalies: 5,
    resourceDeposits: {
      types: {
        rich_ore: { bonus: 1.10, terrain: ['rocky', 'highland'], color: '#ff8844' },
        crystal_vein: { bonus: 1.10, terrain: ['crystal'], color: '#cc66ff' },
        fertile_soil: { bonus: 1.10, terrain: ['plains', 'swamp'], color: '#66cc44' },
        thermal_vent: { bonus: 1.10, terrain: ['volcanic_vent', 'lava'], color: '#ff4422' }
      },
      depositsPerGrid: { min: 1, max: 3 },
      clusterSize: { min: 2, max: 5 }
    },
    repairCostPerQuarter: 0.10,  // 10% of build cost per 0.25 condition restored
    relocationCost: 0.25,         // 25% of build cost
    relocationCooldownMs: 600000, // 10 minutes
    depositRelocationCost: 0.10,  // 10% for deposit-matching relocations
    undoWindowMs: 10000,           // 10-second undo window
    weatherEffects: {
      Terran:    { type: 'rain',      intensity: 0.3, color: '#8888cc' },
      Oceanic:   { type: 'rain',      intensity: 0.6, color: '#6688aa' },
      Desert:    { type: 'sandstorm', intensity: 0.4, color: '#c4a44d' },
      Volcanic:  { type: 'ash',       intensity: 0.5, color: '#444444' },
      Arctic:    { type: 'snow',      intensity: 0.5, color: '#ffffff' },
      Ice:       { type: 'snow',      intensity: 0.7, color: '#ddeeff' },
      Jungle:    { type: 'rain',      intensity: 0.5, color: '#66aa88' },
      Barren:    { type: 'dust',      intensity: 0.2, color: '#aa9977' },
      'Gas Giant': { type: 'lightning', intensity: 0.3, color: '#aaccff' },
      'Crystal World': { type: 'sparkle', intensity: 0.4, color: '#cc88ff' },
      'Tomb World': { type: 'mist', intensity: 0.5, color: '#556655' }
    },
    dailyQuests: {
      questsPerDay: 3,
      types: {
        build_structures: { description: 'Place {n} buildings on the surface', minN: 1, maxN: 3, xpReward: 50, creditReward: 500 },
        train_units: { description: 'Train {n} ground units', minN: 2, maxN: 5, xpReward: 40, creditReward: 400 },
        claim_anomalies: { description: 'Claim {n} surface anomalies', minN: 1, maxN: 2, xpReward: 30, creditReward: 300 },
        survive_raid: { description: 'Defend against an NPC raid', minN: 1, maxN: 1, xpReward: 100, creditReward: 1000 },
        place_blocks: { description: 'Place {n} custom blocks', minN: 5, maxN: 15, xpReward: 20, creditReward: 200 },
        repair_buildings: { description: 'Repair {n} damaged buildings', minN: 1, maxN: 3, xpReward: 25, creditReward: 250 }
      }
    }
  },

  // ============== Custom Blocks (Phase 2) ==============
  customBlocks: {
    maxBlocksBase: 50,  // blocks per infrastructure level
    maxBlocksCap: 500,  // hard cap at level 10
    blockTypes: {
      wall:            { cost: 10,  hp: 100, blocks_movement: true,  blocks_los: true  },
      reinforced_wall: { cost: 50,  hp: 500, blocks_movement: true,  blocks_los: true  },
      floor:           { cost: 5,   hp: 50,  blocks_movement: false, blocks_los: false },
      window:          { cost: 15,  hp: 30,  blocks_movement: true,  blocks_los: false },
      door:            { cost: 20,  hp: 80,  blocks_movement: false, blocks_los: false },
      lamp:            { cost: 10,  hp: 20,  blocks_movement: false, blocks_los: false, light_radius: 3 },
      antenna:         { cost: 30,  hp: 40,  blocks_movement: false, blocks_los: false, sensor_range: 5 },
      turret_mount:    { cost: 100, hp: 200, blocks_movement: true,  blocks_los: true,  enables_turret: true },
      barricade:       { cost: 25,  hp: 150, blocks_movement: true,  blocks_los: false, half_cover: true },
      storage_crate:   { cost: 15,  hp: 60,  blocks_movement: true,  blocks_los: false },
      road:            { cost: 8,   hp: 40,  blocks_movement: false, blocks_los: false, speed_bonus: 1.3 },
      path:            { cost: 3,   hp: 20,  blocks_movement: false, blocks_los: false, speed_bonus: 1.15 }
    },
    refundRatio: 0.5,         // 50% credit refund on removal
    bulkLimit: 50,            // max blocks per bulk request
    floorCoexistsBuildings: true  // floor blocks can coexist under building footprints
  },

  // ============== Voxel Blocks ==============
  voxels: {
    maxBlocksBase: 200,     // per infrastructure level
    maxBlocksCap: 2000,     // hard cap
    bulkLimit: 50,
    chunkSize: 16,
    worldHeight: 128,
    seaLevel: 40
  },

  // ============== Ground Combat (Phase 3) ==============
  groundCombat: {
    unitTypes: {
      militia:      { cost: 100,  hp: 50,  attack: 8,  defense: 5,  speed: 2, range: 1, upkeep: 5,   trainTime: 60 },
      marines:      { cost: 300,  hp: 100, attack: 15, defense: 12, speed: 3, range: 1, upkeep: 15,  trainTime: 180 },
      heavy_armor:  { cost: 800,  hp: 300, attack: 25, defense: 25, speed: 1, range: 2, upkeep: 40,  trainTime: 600 },
      mech:         { cost: 2000, hp: 500, attack: 40, defense: 20, speed: 2, range: 3, upkeep: 100, trainTime: 1200 },
      spec_ops:     { cost: 1500, hp: 80,  attack: 30, defense: 8,  speed: 4, range: 2, upkeep: 60,  trainTime: 900 }
    },
    maxUnitsPerColony: 50,
    defenderPolicies: ['hold_the_line', 'aggressive', 'fallback_to_center', 'guerrilla'],
    maxTurns: 30,
    turnTimerMs: 60000,       // 60 seconds per turn
    globalTimerMs: 900000,    // 15 minutes max per combat
    combatRules: {
      coverBonus: 0.3,        // 30% damage reduction behind walls/barricades/buildings
      terrainEffects: {
        highland:     { defense: 1.3, speed: 0.5 },
        swamp:        { defense: 1.0, speed: 0.5 },
        plains:       { defense: 1.0, speed: 1.0 },
        rocky:        { defense: 1.1, speed: 1.0 },
        ice:          { defense: 1.0, speed: 0.8 },
        sand:         { defense: 1.0, speed: 0.9 },
        crystal:      { defense: 1.0, speed: 1.0 },
        metal_grating:{ defense: 1.0, speed: 1.0 },
        landing_zone: { defense: 1.0, speed: 1.0 }
      },
      minDamage: 1
    },
    invasionFlow: {
      requireShipInOrbit: true,
      orbitalBombardmentDamage: { minCondition: 0.1, maxCondition: 0.3, unitHpPercent: 0.15 },
      landingEdgeTiles: true  // attackers deploy on landing_zone edge tiles
    },
    npcRaid: {
      minRaidStrength: 3,     // min NPC units
      maxRaidStrength: 8,     // max NPC units
      unitTypes: ['militia', 'marines'],  // NPC raid unit pool
      raidCooldownMs: 3600000 // 1 hour between raids
    }
  }
};
