# GPT 5.4 Sprint: Galaxy Zone Enforcement & Difficulty Scaling

> **Working directory:** `server/` (within the Space Wars repo)
> **Runtime:** Node.js 20+, Jest, SQLite in-memory (test), SQLite file (dev)
> **Goal:** Wire the existing zone/security model fields into active gameplay enforcement — PvP gating, reward multipliers, safe harbors, anti-griefing cooldowns, and difficulty-scaled NPC power.

---

## 1. What You're Doing

The Sector model already has `zone_class`, `security_class`, `access_mode`, and `rule_flags` fields. The `worldPolicyService.js` already builds default policies per sector type. **But none of this is enforced at runtime.** Combat doesn't check security class. Rewards aren't multiplied. NPCs don't scale with zone difficulty. Safe harbors aren't enforced.

Your job: Wire enforcement into the existing services so zones actually matter.

### What Already Exists (DO NOT recreate)

- **`Sector.zone_class`**: `core`, `inner_ring`, `mid_ring`, `outer_ring`, `frontier`, `deep_space`, `home`, `adventure`, `transit`
- **`Sector.security_class`**: `protected`, `pve`, `contested`, `pvp`
- **`Sector.rule_flags`**: JSON with `allow_pvp`, `allow_hostile_npcs`, `safe_harbor`, `reward_multiplier`, `tourist_pass_allowed`, `protected_entry_buffer_seconds`
- **`worldPolicyService.js`**: `buildDefaultSectorPolicy()`, `evaluateTraversal()`, `isAccessAllowed()`, `getAccessibleAdjacentSectors()`, `resolveTraversal()`
- **`combatService.js`**: Turn-based combat with `initiateCombat()`, `executeTurn()`, `attemptFlee()`
- **`npcService.js`**: NPC spawning, movement, behavior trees, tick processing
- **`tickService.js`**: Runs tactical, combat, maintenance, economy, automation ticks on intervals

### Enforcement Map

| Rule | Where to enforce | How |
|------|-----------------|-----|
| PvP gating | `combatService.initiateCombat()` | Check `rule_flags.allow_pvp` on attacker's sector |
| Safe harbor | `combatService.initiateCombat()` | Block all combat in `safe_harbor: true` sectors |
| Reward multiplier | Trade profit, combat loot, mission rewards | Multiply by `rule_flags.reward_multiplier` |
| Anti-griefing cooldown | `combatService.initiateCombat()` | Track recent PvP kills, add cooldown before allowing re-attack of same target |
| Offline protection | `combatService.initiateCombat()` | Block PvP against players who haven't been online in X minutes |
| NPC difficulty scaling | `npcService` spawn + behavior | Scale NPC stats based on zone_class |

---

## 2. Task A: PvP Zone Enforcement

### Where: `server/src/services/combatService.js`

Find the `initiateCombat()` function. Add zone checks before combat begins:

```javascript
// At the top of initiateCombat(), after loading attacker and defender ships:
const sector = await Sector.findByPk(attackerShip.current_sector_id);
const policy = worldPolicyService.buildDefaultSectorPolicy(sector);

// Safe harbor check
if (policy.rule_flags.safe_harbor) {
  const error = new Error('Combat is not allowed in safe harbor zones');
  error.statusCode = 403;
  throw error;
}

// PvP check (only for player-vs-player, not player-vs-NPC)
if (defenderUserId && !policy.rule_flags.allow_pvp) {
  const error = new Error('PvP combat is not allowed in this security zone');
  error.statusCode = 403;
  throw error;
}
```

**How to identify PvP**: The existing `initiateCombat()` takes parameters that indicate attacker and defender. If the defender is a player (has a user_id), it's PvP. If the defender is an NPC, it's PvE and always allowed (unless safe_harbor blocks all combat).

**Key**: Read the existing `initiateCombat` signature carefully. It likely has params like `attackerShipId, defenderShipId, defenderNpcId`. If `defenderShipId` is provided and maps to a player ship, it's PvP.

### Anti-Griefing Cooldown

Add a new model `PvpCooldown`:

```javascript
// server/src/models/PvpCooldown.js
const PvpCooldown = sequelize.define('PvpCooldown', {
  cooldown_id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  attacker_user_id: { type: DataTypes.UUID, allowNull: false },
  victim_user_id: { type: DataTypes.UUID, allowNull: false },
  expires_at: { type: DataTypes.DATE, allowNull: false },
  created_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW }
}, {
  tableName: 'pvp_cooldowns',
  timestamps: false,
  indexes: [
    { fields: ['attacker_user_id', 'victim_user_id'], unique: true, name: 'idx_pvp_cooldown_pair' },
    { fields: ['expires_at'] }
  ]
});
```

In `initiateCombat()`, after the PvP check:

```javascript
// Anti-griefing: check if attacker recently killed this specific victim
if (defenderUserId) {
  const cooldown = await PvpCooldown.findOne({
    where: {
      attacker_user_id: attackerUserId,
      victim_user_id: defenderUserId,
      expires_at: { [Op.gt]: new Date() }
    }
  });
  if (cooldown) {
    const minutesLeft = Math.ceil((cooldown.expires_at - new Date()) / 60000);
    const error = new Error(`Anti-griefing cooldown: you cannot attack this player for ${minutesLeft} more minutes`);
    error.statusCode = 403;
    throw error;
  }
}
```

After a PvP kill resolves (in the combat resolution logic), create/update the cooldown:

```javascript
// After PvP kill resolution:
const COOLDOWN_MINUTES = 30;
await PvpCooldown.upsert({
  attacker_user_id: winnerId,
  victim_user_id: loserId,
  expires_at: new Date(Date.now() + COOLDOWN_MINUTES * 60 * 1000)
});
```

### Offline Protection

In `initiateCombat()`, check if the defender is online:

```javascript
// Offline protection in PvP zones
if (defenderUserId) {
  const defender = await User.findByPk(defenderUserId, { attributes: ['last_active_at'] });
  const OFFLINE_THRESHOLD_MS = 5 * 60 * 1000; // 5 minutes
  if (defender && defender.last_active_at && (Date.now() - new Date(defender.last_active_at).getTime()) > OFFLINE_THRESHOLD_MS) {
    const error = new Error('This player is offline and protected from PvP');
    error.statusCode = 403;
    throw error;
  }
}
```

**Note:** The User model may or may not have a `last_active_at` field. Check `server/src/models/User.js`. If it doesn't exist, add it as a nullable DATE field and update it in the auth middleware when a request comes in (in `server/src/middleware/auth.js`, after successful JWT verification).

---

## 3. Task B: Reward Multipliers

### Where: Multiple services

The `rule_flags.reward_multiplier` should scale:

1. **Trade profits** — in `tradeService.js`
2. **Combat loot/bounty** — in `combatService.js`
3. **Mission rewards** — in mission completion logic

For each, the pattern is the same:

```javascript
// Load the sector's policy
const sector = await Sector.findByPk(sectorId);
const policy = worldPolicyService.buildDefaultSectorPolicy(sector);
const multiplier = policy.rule_flags.reward_multiplier || 1;

// Apply to reward
const adjustedReward = Math.round(baseReward * multiplier);
```

### Trade Profits

In `tradeService.js`, find the sell transaction handler (where player credits increase from selling cargo). Apply the multiplier to the profit portion only:

```javascript
// After calculating sell price:
const baseProfit = sellPrice - buyPrice; // or however profit is calculated
const adjustedProfit = Math.round(baseProfit * multiplier);
// Add adjustedProfit to player credits instead of baseProfit
```

**Be careful:** Only apply to the profit/bonus portion. The base commodity value should stay the same — the multiplier is a zone-based incentive.

### Combat Rewards

In `combatService.js`, wherever credits or loot are awarded after combat victory, apply the sector's reward multiplier.

### Mission Rewards

In the mission completion flow (likely in `missionService.js`), apply the multiplier to credit rewards when the mission is completed in a higher-risk zone.

---

## 4. Task C: NPC Difficulty Scaling

### Zone Difficulty Config

Add to `server/src/config/index.js` a new `zoneDifficulty` config block:

```javascript
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
}
```

### Where: `npcService.js`

Find the NPC spawn logic. When spawning an NPC in a sector, look up the sector's zone_class and apply the stat multiplier:

```javascript
const config = require('../config');
const zoneDiff = config.zoneDifficulty[sector.zone_class] || config.zoneDifficulty.mid_ring;

// Apply to NPC hull, shields, attack
npc.hull_points = Math.round(baseHull * zoneDiff.npcStatMultiplier);
npc.max_hull_points = npc.hull_points;
npc.shield_points = Math.round(baseShields * zoneDiff.npcStatMultiplier);
npc.max_shield_points = npc.shield_points;
npc.attack_power = Math.round(baseAttack * zoneDiff.npcStatMultiplier);
```

**Important:** Read `npcService.js` carefully to understand the existing spawn flow. The NPC model may use different field names. Adapt the multiplier application to whatever stat fields exist.

### Hostile NPC Gating

In the NPC behavior tick (where NPCs decide whether to attack), check `rule_flags.allow_hostile_npcs`:

```javascript
const sector = await Sector.findByPk(npc.current_sector_id);
const policy = worldPolicyService.buildDefaultSectorPolicy(sector);

if (!policy.rule_flags.allow_hostile_npcs) {
  // Skip aggressive behaviors in this sector
  return;
}
```

---

## 5. Test Files to Create

### `server/tests/services/zoneEnforcement.test.js` (~250-350 lines)

**PvP Zone Enforcement:**
- Blocks PvP combat in `protected` security class sectors
- Blocks all combat in `safe_harbor: true` sectors
- Allows PvP in `pvp` security class sectors
- Allows PvE combat in all non-safe-harbor sectors
- Anti-griefing cooldown prevents re-attack of same victim within window
- Cooldown expires after configured time
- Offline protection blocks PvP against inactive players

**Reward Multipliers:**
- Core sectors apply 1x multiplier
- Frontier sectors apply 1.75x multiplier
- Deep space applies 2.1x multiplier
- Multiplier affects trade profits
- Multiplier affects combat rewards

**NPC Difficulty Scaling:**
- NPCs in core sectors have reduced stats (0.5x)
- NPCs in deep_space have enhanced stats (2x)
- Hostile NPCs don't attack in `allow_hostile_npcs: false` zones
- Spawn density varies by zone

### Test Helpers

Add to `server/tests/helpers.js`:

```javascript
async function createTestSectorWithZone(zoneClass, securityClass, overrides = {}) {
  const sector = await createTestSector({
    zone_class: zoneClass,
    security_class: securityClass,
    rule_flags: {
      ...worldPolicyService.buildDefaultSectorPolicy({ type: 'Mid' }).rule_flags,
      ...overrides.rule_flags
    },
    ...overrides
  });
  return sector;
}
```

---

## 6. Files to Create

```
server/
├── src/
│   ├── models/
│   │   └── PvpCooldown.js                 # NEW — anti-griefing cooldown model
│   └── (no new services — modify existing ones)
└── tests/
    └── services/
        └── zoneEnforcement.test.js         # NEW — zone enforcement tests
```

## 7. Files to Modify

```
server/
├── src/
│   ├── models/
│   │   └── index.js                        # Add PvpCooldown import + export
│   ├── services/
│   │   ├── combatService.js                # Add zone checks to initiateCombat()
│   │   ├── tradeService.js                 # Add reward multiplier to sell profits
│   │   └── npcService.js                   # Add zone-based stat scaling on spawn
│   ├── config/
│   │   └── index.js                        # Add zoneDifficulty config block
│   ├── middleware/
│   │   └── auth.js                         # Add last_active_at update (if User model lacks it)
│   └── models/
│       └── User.js                         # Add last_active_at field (if missing)
└── tests/
    └── helpers.js                          # Add createTestSectorWithZone helper
```

---

## 8. Verification

```bash
cd server
npx jest --forceExit                                        # All tests pass
npx jest -- tests/services/zoneEnforcement.test.js          # Zone tests pass alone
```

---

## 9. Important Notes

- **Read existing services carefully before modifying.** The combat and trade services have complex transaction flows — your changes must work within those transactions.
- The `worldPolicyService` is already imported in several places. Use it for policy resolution — don't duplicate the policy lookup logic.
- The Sector model's `beforeValidate` hook already calls `buildDefaultSectorPolicy()` to populate zone/security/access defaults. You don't need to change this.
- `Sector.rule_flags` is a JSON field. In SQLite, JSON is stored as TEXT. Sequelize handles serialization.
- The `Op` import (`const { Op } = require('sequelize')`) is available in most service files already.
- **Do NOT change the universe generator or existing sector data.** The generator already assigns zone/security classes based on sector type. Your job is enforcement, not assignment.
- PvP cooldown cleanup (expired entries) can be handled lazily — just query with `expires_at > now`. A periodic cleanup job can be added later with the job queue.
- The `is_starting_sector: true` sectors should always be safe harbors — verify the generator sets this correctly, but don't modify it.
