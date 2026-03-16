<!-- meta: {"title": "Combat", "order": 6, "icon": "Swords", "category": "Combat"} -->

# Combat

Combat in Space Wars 3000 is turn-based. Each round, both combatants fire weapons and can attempt to flee. Battles end when one side is destroyed, flees successfully, or 50 rounds elapse.

## Damage Formula

Each weapon fires independently per round:

1. **Accuracy check** — Roll against weapon accuracy (e.g., 85% for Laser Cannon)
2. **Base damage** — Weapon damage value
3. **Critical hit** — 10% chance for **2.0× damage**
4. **Shield absorption** — Shields absorb damage first, but 10% of damage **penetrates shields** and hits hull directly
5. **Armor reduction** — Armor reduces remaining hull damage by its damage reduction percentage
6. **Minimum damage** — At least 1 damage is always dealt per hit

### Shield Mechanics

- Shields take the brunt of damage (90% of hits)
- 10% of each hit bypasses shields entirely (shield penetration)
- Shields recharge each round by their recharge rate
- Once shields are depleted, all damage goes to hull

### Critical Hits

- **Chance**: 10% per weapon hit
- **Multiplier**: 2.0× normal damage
- Critical hits can turn the tide of battle quickly

## Fleeing

You can attempt to flee combat each round:

- **Base flee chance**: 30%
- **Speed bonus**: +5% per point of speed difference between your ship and the enemy
- Faster ships have a significant advantage when retreating

> **Tip**: Interceptors with 3 engine slots can reach very high speeds, making them excellent at escaping.

## Combat Rounds

- Maximum rounds per battle: **50**
- If neither side is destroyed or flees after 50 rounds, the battle ends in a draw

## Experience & Loot

- **0.5 XP per damage dealt**
- **100 XP per kill**
- **70% chance** for loot drops on kill
- Loot value scales with NPC type (Pirate Lord drops 3× more than standard enemies)

## NPC Types

| NPC Type | Hostility | Behavior | Ships | Loot Multiplier | Spawn Chance |
|----------|-----------|----------|-------|-----------------|-------------|
| Pirate | Hostile | Aggressive | Fighter, Corvette | 1.5× | 15% |
| Pirate Lord | Hostile | Aggressive | Destroyer | 3.0× | 3% |
| Trader | Neutral | Flee | Freighter, Merchant Cruiser | 0.8× | 20% |
| System Patrol | Friendly | Defensive | Corvette, Fighter | 0.5× | 10% |
| Bounty Hunter | Neutral | Opportunistic | Fighter, Corvette | 2.0× | 5% |

### NPC Behavior

- **Aggressive** — Will attack on sight
- **Defensive** — Only attacks if provoked
- **Flee** — Attempts to run from combat
- **Opportunistic** — Engages if they estimate an advantage

> **Warning**: Pirate Lords fly Destroyers and are very dangerous. Avoid them until you have a well-equipped combat ship.

## Component Degradation

Combat wears down your components:
- Each combat round degrades all installed components by **2%**
- Components at 10% condition break entirely
- Always repair between major engagements at the **Engineering** page
