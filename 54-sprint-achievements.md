# GPT 5.4 Sprint: Server-Authoritative Achievement System

> **Working directory:** `server/` (within the Space Wars repo)
> **Runtime:** Node.js 20+, Jest, SQLite in-memory (test), SQLite file (dev)
> **Goal:** Build a complete achievement system with definition registry, progress tracking, unlock logic, reward distribution, and API endpoints.

---

## 1. What You're Doing

Build a server-authoritative achievement system from scratch. There is **no existing achievement code** in the codebase. You're creating:

1. **`Achievement` model** — defines what achievements exist (static catalog)
2. **`PlayerAchievement` model** — tracks per-player progress and unlock state
3. **`achievementService.js`** — core logic: check progress, unlock, distribute rewards
4. **Achievement definitions** — JSON catalog of ~30-40 achievements across all game systems
5. **API routes** — player-facing endpoints to view achievements and progress
6. **Event hooks** — integrate with existing services to trigger progress checks
7. **Comprehensive tests**

---

## 2. Models

### `Achievement` (Definition Catalog)

Create `server/src/models/Achievement.js`:

```javascript
const Achievement = sequelize.define('Achievement', {
  achievement_id: {
    type: DataTypes.STRING(100),
    primaryKey: true,
    comment: 'Human-readable key: first_trade, explore_100_sectors, etc.'
  },
  name: {
    type: DataTypes.STRING(200),
    allowNull: false
  },
  description: {
    type: DataTypes.TEXT,
    allowNull: false
  },
  category: {
    type: DataTypes.STRING(50),
    allowNull: false,
    validate: {
      isIn: [['exploration', 'combat', 'trade', 'colony', 'social', 'progression', 'special']]
    }
  },
  icon: {
    type: DataTypes.STRING(100),
    allowNull: true,
    comment: 'Icon key for frontend rendering'
  },
  rarity: {
    type: DataTypes.STRING(20),
    allowNull: false,
    defaultValue: 'common',
    validate: {
      isIn: [['common', 'uncommon', 'rare', 'epic', 'legendary']]
    }
  },
  target_value: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 1,
    comment: 'Target count to unlock (1 for one-shot achievements)'
  },
  reward_credits: {
    type: DataTypes.BIGINT,
    allowNull: false,
    defaultValue: 0
  },
  reward_xp: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 0
  },
  reward_cosmetic_id: {
    type: DataTypes.UUID,
    allowNull: true,
    comment: 'Optional cosmetic unlock reward'
  },
  reward_title: {
    type: DataTypes.STRING(100),
    allowNull: true,
    comment: 'Optional title reward (e.g., "Master Trader")'
  },
  is_hidden: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
    comment: 'Hidden achievements show as ??? until unlocked'
  },
  is_active: {
    type: DataTypes.BOOLEAN,
    defaultValue: true
  },
  sort_order: {
    type: DataTypes.INTEGER,
    defaultValue: 0
  },
  created_at: {
    type: DataTypes.DATE,
    allowNull: false,
    defaultValue: DataTypes.NOW
  }
}, {
  tableName: 'achievements',
  timestamps: false,
  indexes: [
    { fields: ['category'] },
    { fields: ['rarity'] },
    { fields: ['is_active'] }
  ]
});
```

### `PlayerAchievement` (Per-Player Progress)

Create `server/src/models/PlayerAchievement.js`:

```javascript
const PlayerAchievement = sequelize.define('PlayerAchievement', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  user_id: {
    type: DataTypes.UUID,
    allowNull: false,
    references: { model: 'users', key: 'user_id' }
  },
  achievement_id: {
    type: DataTypes.STRING(100),
    allowNull: false,
    references: { model: 'achievements', key: 'achievement_id' }
  },
  current_value: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 0
  },
  unlocked: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  },
  unlocked_at: {
    type: DataTypes.DATE,
    allowNull: true
  },
  reward_claimed: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  },
  created_at: {
    type: DataTypes.DATE,
    allowNull: false,
    defaultValue: DataTypes.NOW
  },
  updated_at: {
    type: DataTypes.DATE,
    allowNull: false,
    defaultValue: DataTypes.NOW
  }
}, {
  tableName: 'player_achievements',
  timestamps: false,
  indexes: [
    { fields: ['user_id', 'achievement_id'], unique: true, name: 'idx_player_achievement_unique' },
    { fields: ['user_id', 'unlocked'] },
    { fields: ['unlocked_at'] }
  ]
});
```

### Registration in `models/index.js`

```javascript
const Achievement = require('./Achievement');
const PlayerAchievement = require('./PlayerAchievement');

// Associations
Achievement.hasMany(PlayerAchievement, { foreignKey: 'achievement_id', as: 'playerProgress' });
PlayerAchievement.belongsTo(Achievement, { foreignKey: 'achievement_id', as: 'achievement' });
User.hasMany(PlayerAchievement, { foreignKey: 'user_id', as: 'achievements' });
PlayerAchievement.belongsTo(User, { foreignKey: 'user_id', as: 'user' });

// Export both
```

---

## 3. Achievement Definitions

Create `server/src/config/achievements.js`:

```javascript
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
```

---

## 4. Service: `achievementService.js`

Create `server/src/services/achievementService.js`:

### `seedAchievements()`

Syncs the definitions from `config/achievements.js` into the Achievement table:

```javascript
async function seedAchievements() {
  const definitions = require('../config/achievements');
  for (const def of definitions) {
    await Achievement.findOrCreate({
      where: { achievement_id: def.achievement_id },
      defaults: def
    });
  }
}
```

Call this during server startup (in `server/src/index.js` after `sequelize.sync()`).

### `incrementProgress(userId, achievementId, amount)`

The core function. Increments progress and checks for unlock:

```javascript
/**
 * @param {string} userId
 * @param {string} achievementId
 * @param {number} [amount=1] - Amount to increment by
 * @returns {Promise<{ progress: PlayerAchievement, justUnlocked: boolean }>}
 */
async function incrementProgress(userId, achievementId, amount = 1) {
  const achievement = await Achievement.findByPk(achievementId);
  if (!achievement || !achievement.is_active) return null;

  let [progress, created] = await PlayerAchievement.findOrCreate({
    where: { user_id: userId, achievement_id: achievementId },
    defaults: { current_value: 0 }
  });

  if (progress.unlocked) return { progress, justUnlocked: false };

  const newValue = progress.current_value + amount;
  const justUnlocked = newValue >= achievement.target_value;

  await progress.update({
    current_value: Math.min(newValue, achievement.target_value),
    unlocked: justUnlocked,
    unlocked_at: justUnlocked ? new Date() : null,
    updated_at: new Date()
  });

  if (justUnlocked) {
    await distributeReward(userId, achievement);
    // Emit socket event if socketService is available
    try {
      const socketService = require('./socketService');
      socketService.emitToUser(userId, 'achievement:unlocked', {
        achievement_id: achievement.achievement_id,
        name: achievement.name,
        description: achievement.description,
        rarity: achievement.rarity,
        reward_credits: achievement.reward_credits,
        reward_title: achievement.reward_title
      });
    } catch (_) { /* Socket not available in tests */ }
  }

  return { progress, justUnlocked };
}
```

### `setProgress(userId, achievementId, value)`

Sets progress to an absolute value (for count-based checks like "own X ships"):

```javascript
async function setProgress(userId, achievementId, value) {
  const achievement = await Achievement.findByPk(achievementId);
  if (!achievement || !achievement.is_active) return null;

  let [progress] = await PlayerAchievement.findOrCreate({
    where: { user_id: userId, achievement_id: achievementId },
    defaults: { current_value: 0 }
  });

  if (progress.unlocked) return { progress, justUnlocked: false };

  const justUnlocked = value >= achievement.target_value;

  await progress.update({
    current_value: Math.min(value, achievement.target_value),
    unlocked: justUnlocked,
    unlocked_at: justUnlocked ? new Date() : null,
    updated_at: new Date()
  });

  if (justUnlocked) {
    await distributeReward(userId, achievement);
  }

  return { progress, justUnlocked };
}
```

### `distributeReward(userId, achievement)`

```javascript
async function distributeReward(userId, achievement) {
  if (achievement.reward_credits > 0) {
    const user = await User.findByPk(userId);
    if (user) {
      await user.update({ credits: user.credits + achievement.reward_credits });
    }
  }
  if (achievement.reward_cosmetic_id) {
    // Grant cosmetic — use CosmeticUnlock model
    await CosmeticUnlock.findOrCreate({
      where: { user_id: userId, cosmetic_id: achievement.reward_cosmetic_id },
      defaults: { source: 'achievement', source_id: achievement.achievement_id }
    });
  }
  // reward_title and reward_xp can be handled by future systems
}
```

### `getPlayerAchievements(userId)`

Returns all achievements with player progress:

```javascript
async function getPlayerAchievements(userId) {
  const achievements = await Achievement.findAll({
    where: { is_active: true },
    order: [['category', 'ASC'], ['sort_order', 'ASC']],
    include: [{
      model: PlayerAchievement,
      as: 'playerProgress',
      where: { user_id: userId },
      required: false
    }]
  });

  return achievements.map(a => {
    const progress = a.playerProgress?.[0];
    const unlocked = progress?.unlocked || false;

    return {
      achievement_id: a.achievement_id,
      name: a.is_hidden && !unlocked ? '???' : a.name,
      description: a.is_hidden && !unlocked ? 'Hidden achievement' : a.description,
      category: a.category,
      icon: a.icon,
      rarity: a.rarity,
      target_value: a.target_value,
      current_value: progress?.current_value || 0,
      unlocked,
      unlocked_at: progress?.unlocked_at || null,
      reward_credits: a.reward_credits,
      reward_title: a.reward_title,
      is_hidden: a.is_hidden
    };
  });
}
```

### `getUnlockStats(userId)`

Summary stats:

```javascript
async function getUnlockStats(userId) {
  const total = await Achievement.count({ where: { is_active: true } });
  const unlocked = await PlayerAchievement.count({ where: { user_id: userId, unlocked: true } });
  const recentUnlocks = await PlayerAchievement.findAll({
    where: { user_id: userId, unlocked: true },
    include: [{ model: Achievement, as: 'achievement' }],
    order: [['unlocked_at', 'DESC']],
    limit: 5
  });

  return {
    total,
    unlocked,
    completion_pct: total > 0 ? Math.round((unlocked / total) * 100) : 0,
    recent: recentUnlocks.map(p => ({
      achievement_id: p.achievement_id,
      name: p.achievement.name,
      rarity: p.achievement.rarity,
      unlocked_at: p.unlocked_at
    }))
  };
}
```

### Full exports

```javascript
module.exports = {
  seedAchievements,
  incrementProgress,
  setProgress,
  distributeReward,
  getPlayerAchievements,
  getUnlockStats
};
```

---

## 5. API Routes

Add to a new route file `server/src/routes/achievementRoutes.js`:

```javascript
const router = require('express').Router();
const { authMiddleware } = require('../middleware/auth');
const achievementService = require('../services/achievementService');

// GET /api/achievements — list all achievements with player progress
router.get('/', authMiddleware, async (req, res) => {
  try {
    const achievements = await achievementService.getPlayerAchievements(req.userId);
    res.json({ success: true, data: achievements });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// GET /api/achievements/stats — unlock summary
router.get('/stats', authMiddleware, async (req, res) => {
  try {
    const stats = await achievementService.getUnlockStats(req.userId);
    res.json({ success: true, data: stats });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;
```

Mount in `server/src/index.js` or wherever routes are mounted:

```javascript
app.use('/api/achievements', require('./routes/achievementRoutes'));
```

---

## 6. Event Hooks (Minimal Integration)

Add achievement triggers to existing services. These are **small additions** — a single function call after key events:

### Navigation (`sectorService.js` or `sectorController.js`)

After successful navigation/move:
```javascript
const achievementService = require('./achievementService');
// After player moves to a new sector:
achievementService.incrementProgress(userId, 'first_jump', 1).catch(() => {});
// Count unique discoveries:
const discoveryCount = await PlayerDiscovery.count({ where: { user_id: userId } });
achievementService.setProgress(userId, 'explore_10', discoveryCount).catch(() => {});
achievementService.setProgress(userId, 'explore_50', discoveryCount).catch(() => {});
achievementService.setProgress(userId, 'explore_200', discoveryCount).catch(() => {});
achievementService.setProgress(userId, 'explore_500', discoveryCount).catch(() => {});
```

### Combat (`combatService.js`)

After combat victory:
```javascript
achievementService.incrementProgress(winnerId, 'first_kill', 1).catch(() => {});
achievementService.incrementProgress(winnerId, 'combat_wins_10', 1).catch(() => {});
achievementService.incrementProgress(winnerId, 'combat_wins_50', 1).catch(() => {});
achievementService.incrementProgress(winnerId, 'combat_wins_200', 1).catch(() => {});
```

### Trade (`tradeService.js`)

After successful buy or sell:
```javascript
achievementService.incrementProgress(userId, 'first_trade', 1).catch(() => {});
achievementService.incrementProgress(userId, 'trades_50', 1).catch(() => {});
achievementService.incrementProgress(userId, 'trades_500', 1).catch(() => {});
```

**Note:** Use `.catch(() => {})` on all achievement calls so achievement errors never break game logic. Achievement tracking is best-effort.

---

## 7. Test Files to Create

### `server/tests/services/achievementService.test.js` (~300-400 lines)

**seedAchievements:**
- Seeds all definitions into the database
- Idempotent — running twice doesn't duplicate
- Count matches definitions array length

**incrementProgress:**
- Increments progress by 1
- Increments progress by custom amount
- Unlocks when target_value reached
- Does not increment past target_value
- Does not re-unlock already unlocked achievements
- Distributes credit reward on unlock
- Returns justUnlocked: true on unlock, false otherwise
- Returns null for non-existent achievement
- Returns null for inactive achievement

**setProgress:**
- Sets absolute progress value
- Unlocks when value >= target_value
- Does not downgrade progress if called with lower value (implementation note: it should, actually — set to the provided value)

**distributeReward:**
- Adds credits to user balance
- Grants cosmetic unlock if specified

**getPlayerAchievements:**
- Returns all active achievements
- Includes progress for started achievements
- Shows 0 progress for unstarted achievements
- Hidden achievements show ??? when not unlocked
- Hidden achievements show real name when unlocked

**getUnlockStats:**
- Returns correct total and unlocked counts
- Returns completion percentage
- Returns recent unlocks ordered by date

### Test Helpers

Add to `server/tests/helpers.js`:

```javascript
async function createTestAchievement(overrides = {}) {
  const { Achievement } = require('../src/models');
  return Achievement.create({
    achievement_id: `test_achievement_${Date.now()}`,
    name: 'Test Achievement',
    description: 'Test description',
    category: 'special',
    rarity: 'common',
    target_value: 1,
    reward_credits: 100,
    ...overrides
  });
}
```

Add `Achievement` and `PlayerAchievement` to the `cleanDatabase()` truncation list.

---

## 8. Verification

```bash
cd server
npx jest --forceExit                                          # All tests pass
npx jest -- tests/services/achievementService.test.js         # Achievement tests pass alone
```

---

## 9. Important Notes

- **Achievement checks must NEVER break game logic.** Always wrap in `.catch(() => {})` or try/catch.
- The `CosmeticUnlock` model already exists — check its schema for the correct fields before using it in `distributeReward`.
- The `socketService.emitToUser()` method may or may not exist. Check `server/src/services/socketService.js`. If it doesn't have `emitToUser`, use whatever method exists to emit to a specific user's socket room.
- The `User.credits` field type is likely BIGINT or INTEGER — check before doing arithmetic.
- **Do NOT add achievement hooks to every service at once.** Start with navigation, combat, and trade. Other hooks can be added incrementally. The service and model must work fully even with zero hooks.
- Achievement seeding should be idempotent — use `findOrCreate`, not `bulkCreate`.
- The achievement_id is a human-readable string key, NOT a UUID. This makes it easy to reference in code without looking up IDs.

---

## 10. Quick Reference: Key File Paths

```
server/
├── src/
│   ├── models/
│   │   ├── Achievement.js                  # NEW — create this
│   │   ├── PlayerAchievement.js            # NEW — create this
│   │   └── index.js                        # MODIFY — add imports, associations, exports
│   ├── config/
│   │   └── achievements.js                 # NEW — achievement definitions catalog
│   ├── services/
│   │   └── achievementService.js           # NEW — core achievement logic
│   ├── routes/
│   │   └── achievementRoutes.js            # NEW — player-facing API
│   └── index.js                            # MODIFY — mount achievement routes, call seedAchievements()
└── tests/
    ├── helpers.js                          # MODIFY — add createTestAchievement, add to cleanDatabase
    └── services/
        └── achievementService.test.js      # NEW — comprehensive tests
```

### Existing files to add minimal hooks to (after core system works):

```
server/src/services/
├── sectorService.js (or controller)        # MODIFY — add exploration achievement hooks
├── combatService.js                        # MODIFY — add combat achievement hooks
└── tradeService.js                         # MODIFY — add trade achievement hooks
```
