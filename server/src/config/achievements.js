/**
 * Static achievement catalog. These are seeded into the Achievement table on first run.
 * Categories: exploration, combat, trade, colony, social, progression, special
 */
module.exports = [
  // === EXPLORATION ===
  {
    achievement_id: 'first_jump',
    name: 'First Jump',
    description: 'Navigate to another sector for the first time',
    category: 'exploration',
    rarity: 'common',
    target_value: 1,
    reward_credits: 100,
    sort_order: 1
  },
  {
    achievement_id: 'explore_10',
    name: 'Wayward Explorer',
    description: 'Discover 10 unique sectors',
    category: 'exploration',
    rarity: 'common',
    target_value: 10,
    reward_credits: 500,
    sort_order: 2
  },
  {
    achievement_id: 'explore_50',
    name: 'Star Cartographer',
    description: 'Discover 50 unique sectors',
    category: 'exploration',
    rarity: 'uncommon',
    target_value: 50,
    reward_credits: 2000,
    sort_order: 3
  },
  {
    achievement_id: 'explore_200',
    name: 'Galaxy Mapper',
    description: 'Discover 200 unique sectors',
    category: 'exploration',
    rarity: 'rare',
    target_value: 200,
    reward_credits: 10000,
    reward_title: 'Galaxy Mapper',
    sort_order: 4
  },
  {
    achievement_id: 'explore_500',
    name: 'Frontier Pioneer',
    description: 'Discover 500 unique sectors',
    category: 'exploration',
    rarity: 'epic',
    target_value: 500,
    reward_credits: 50000,
    reward_title: 'Pioneer',
    sort_order: 5
  },
  {
    achievement_id: 'scan_planet',
    name: 'Planet Scanner',
    description: 'Scan your first planet',
    category: 'exploration',
    rarity: 'common',
    target_value: 1,
    reward_credits: 200,
    sort_order: 6
  },
  {
    achievement_id: 'find_artifact',
    name: 'Relic Hunter',
    description: 'Discover your first artifact',
    category: 'exploration',
    rarity: 'uncommon',
    target_value: 1,
    reward_credits: 1000,
    sort_order: 7
  },
  {
    achievement_id: 'visit_all_star_classes',
    name: 'Stellar Connoisseur',
    description: 'Visit systems with all 9 star classes',
    category: 'exploration',
    rarity: 'rare',
    target_value: 9,
    reward_credits: 5000,
    reward_title: 'Stellar Connoisseur',
    sort_order: 8
  },

  // === COMBAT ===
  {
    achievement_id: 'first_kill',
    name: 'First Blood',
    description: 'Win your first combat encounter',
    category: 'combat',
    rarity: 'common',
    target_value: 1,
    reward_credits: 200,
    sort_order: 10
  },
  {
    achievement_id: 'combat_wins_10',
    name: 'Seasoned Fighter',
    description: 'Win 10 combat encounters',
    category: 'combat',
    rarity: 'uncommon',
    target_value: 10,
    reward_credits: 2000,
    sort_order: 11
  },
  {
    achievement_id: 'combat_wins_50',
    name: 'Ace Pilot',
    description: 'Win 50 combat encounters',
    category: 'combat',
    rarity: 'rare',
    target_value: 50,
    reward_credits: 10000,
    reward_title: 'Ace Pilot',
    sort_order: 12
  },
  {
    achievement_id: 'combat_wins_200',
    name: 'War Hero',
    description: 'Win 200 combat encounters',
    category: 'combat',
    rarity: 'epic',
    target_value: 200,
    reward_credits: 50000,
    reward_title: 'War Hero',
    sort_order: 13
  },
  {
    achievement_id: 'survive_low_hull',
    name: 'By the Skin of Your Teeth',
    description: 'Win a fight with less than 10% hull remaining',
    category: 'combat',
    rarity: 'uncommon',
    target_value: 1,
    reward_credits: 1000,
    sort_order: 14
  },
  {
    achievement_id: 'pvp_first_win',
    name: 'PvP Initiate',
    description: 'Win your first PvP combat',
    category: 'combat',
    rarity: 'uncommon',
    target_value: 1,
    reward_credits: 500,
    sort_order: 15
  },

  // === TRADE ===
  {
    achievement_id: 'first_trade',
    name: 'Merchant Initiate',
    description: 'Complete your first trade',
    category: 'trade',
    rarity: 'common',
    target_value: 1,
    reward_credits: 100,
    sort_order: 20
  },
  {
    achievement_id: 'trades_50',
    name: 'Seasoned Trader',
    description: 'Complete 50 trades',
    category: 'trade',
    rarity: 'uncommon',
    target_value: 50,
    reward_credits: 3000,
    sort_order: 21
  },
  {
    achievement_id: 'trades_500',
    name: 'Trade Baron',
    description: 'Complete 500 trades',
    category: 'trade',
    rarity: 'rare',
    target_value: 500,
    reward_credits: 25000,
    reward_title: 'Trade Baron',
    sort_order: 22
  },
  {
    achievement_id: 'earn_100k',
    name: 'Six Figures',
    description: 'Accumulate 100,000 total credits earned from trading',
    category: 'trade',
    rarity: 'uncommon',
    target_value: 100000,
    reward_credits: 5000,
    sort_order: 23
  },
  {
    achievement_id: 'earn_1m',
    name: 'Millionaire',
    description: 'Accumulate 1,000,000 total credits earned from trading',
    category: 'trade',
    rarity: 'epic',
    target_value: 1000000,
    reward_credits: 50000,
    reward_title: 'Millionaire',
    sort_order: 24
  },
  {
    achievement_id: 'trade_illegal',
    name: 'Smuggler',
    description: 'Successfully trade an illegal commodity',
    category: 'trade',
    rarity: 'uncommon',
    target_value: 1,
    reward_credits: 500,
    is_hidden: true,
    sort_order: 25
  },

  // === COLONY ===
  {
    achievement_id: 'first_colony',
    name: 'Colony Founder',
    description: 'Establish your first colony',
    category: 'colony',
    rarity: 'uncommon',
    target_value: 1,
    reward_credits: 2000,
    sort_order: 30
  },
  {
    achievement_id: 'colony_population_1000',
    name: 'Growing Community',
    description: 'Reach 1,000 population in a single colony',
    category: 'colony',
    rarity: 'rare',
    target_value: 1000,
    reward_credits: 10000,
    sort_order: 31
  },
  {
    achievement_id: 'build_wonder',
    name: 'Wonder Builder',
    description: 'Complete a colony wonder',
    category: 'colony',
    rarity: 'epic',
    target_value: 1,
    reward_credits: 25000,
    reward_title: 'Wonder Builder',
    sort_order: 32
  },

  // === SOCIAL ===
  {
    achievement_id: 'join_corporation',
    name: 'Team Player',
    description: 'Join a corporation',
    category: 'social',
    rarity: 'common',
    target_value: 1,
    reward_credits: 500,
    sort_order: 40
  },
  {
    achievement_id: 'create_corporation',
    name: 'CEO',
    description: 'Create a corporation',
    category: 'social',
    rarity: 'uncommon',
    target_value: 1,
    reward_credits: 2000,
    reward_title: 'CEO',
    sort_order: 41
  },
  {
    achievement_id: 'send_message',
    name: 'Social Butterfly',
    description: 'Send your first message',
    category: 'social',
    rarity: 'common',
    target_value: 1,
    reward_credits: 100,
    sort_order: 42
  },

  // === PROGRESSION ===
  {
    achievement_id: 'buy_second_ship',
    name: 'Fleet Owner',
    description: 'Own more than one ship',
    category: 'progression',
    rarity: 'uncommon',
    target_value: 2,
    reward_credits: 1000,
    sort_order: 50
  },
  {
    achievement_id: 'max_skill',
    name: 'Master of One',
    description: 'Max out any skill',
    category: 'progression',
    rarity: 'rare',
    target_value: 1,
    reward_credits: 10000,
    sort_order: 51
  },
  {
    achievement_id: 'craft_item',
    name: 'Craftsperson',
    description: 'Craft your first item',
    category: 'progression',
    rarity: 'common',
    target_value: 1,
    reward_credits: 300,
    sort_order: 52
  },
  {
    achievement_id: 'complete_mission',
    name: 'Mission Complete',
    description: 'Complete your first mission',
    category: 'progression',
    rarity: 'common',
    target_value: 1,
    reward_credits: 200,
    sort_order: 53
  },

  // === SPECIAL ===
  {
    achievement_id: 'survive_destruction',
    name: 'Phoenix',
    description: 'Have a ship destroyed and continue playing',
    category: 'special',
    rarity: 'uncommon',
    target_value: 1,
    reward_credits: 500,
    is_hidden: true,
    sort_order: 60
  },
  {
    achievement_id: 'visit_black_hole',
    name: 'Event Horizon',
    description: 'Visit a black hole system',
    category: 'special',
    rarity: 'rare',
    target_value: 1,
    reward_credits: 3000,
    is_hidden: true,
    sort_order: 61
  }
];
