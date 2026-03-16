# Phase 3: Ship Designer & Combat MVP (Updated)

**Objective:** Implement ship customization with components, turn-based combat system, NPC pirates/traders, and maintenance economy sinks.

**Prerequisites:** Completion of Phase 2 (Trading & Economy).

## Database Schema

### Components Table
- `component_id` (UUID, PK)
- `name` (string, unique)
- `type` (enum: weapon, shield, engine, scanner, cargo_pod, armor)
- `tier` (1-5)
- Type-specific stats:
  - Weapons: `damage`, `accuracy`, `energy_cost`
  - Shields: `shield_capacity`, `recharge_rate`, `energy_cost`
  - Engines: `speed_bonus`, `fuel_efficiency`
  - Scanners: `scan_range`, `detail_level`
  - Cargo: `cargo_capacity`
  - Armor: `hull_bonus`, `damage_reduction`
- `price` (integer)
- `description` (text)

### ShipComponent Table (Junction)
- `ship_component_id` (UUID, PK)
- `ship_id` (FK to Ships)
- `component_id` (FK to Components)
- `slot_index` (integer, 0-indexed)
- `condition` (float, 0.0-1.0, default 1.0)
- `is_active` (boolean, default true)

### NPC Table
- `npc_id` (UUID, PK)
- `name`, `npc_type` (Pirate, Trader, Patrol, etc.)
- `ship_type`, `current_sector_id`
- Combat stats: `hull_points`, `shield_points`, `attack_power`, `defense_rating`, `speed`
- AI stats: `aggression_level`, `flee_threshold`
- Rewards: `credits_carried`, `experience_value`
- State: `is_alive`, `respawn_at`

### CombatLog Table
- `combat_log_id` (UUID, PK)
- Participants: `attacker_ship_id`, `defender_npc_id` (or defender_ship_id for PVP)
- `sector_id`, `combat_type` (PVE/PVP)
- Results: `rounds_fought`, `winner_type`, damage dealt/remaining
- Rewards: `credits_looted`, `experience_gained`
- `combat_rounds` (JSON - detailed round-by-round data)

## Ship Modifications
- Add to Ships table: `max_hull_points`, `max_shield_points`, `max_energy`, `energy`, `in_combat`, `last_maintenance_at`
- Ship stats (`attack_power`, `defense_rating`, `speed`, `scanner_range`) should be recalculated from base + components

## Configuration (config/index.js)

### Component Slot Limits per Ship Type
```javascript
shipSlots: {
  SCOUT: { weapon: 1, shield: 1, engine: 1, scanner: 2, cargo_pod: 1, armor: 1 },
  FIGHTER: { weapon: 3, shield: 1, engine: 2, scanner: 1, cargo_pod: 0, armor: 1 },
  FREIGHTER: { weapon: 1, shield: 2, engine: 1, scanner: 1, cargo_pod: 5, armor: 2 },
  // ... etc
}
```

### Combat Configuration
```javascript
combat: {
  maxRoundsPerBattle: 50,
  fleeChanceBase: 0.3,
  fleeChancePerSpeedDiff: 0.05,
  criticalHitChance: 0.10,
  criticalHitMultiplier: 2.0,
  shieldPenetration: 0.1,  // 10% damage bypasses shields
  minDamage: 1
}
```

### Maintenance Configuration
```javascript
maintenance: {
  componentDegradationPerCombat: 0.02,  // 2% per combat round
  componentDegradationPerJump: 0.005,   // 0.5% per sector jump
  hullRepairCostPerPoint: 5,
  componentRepairCostMultiplier: 0.3,   // 30% of component price
  minComponentCondition: 0.1,           // Auto-disable at 10%
  conditionEffectivenessRatio: 0.5      // Effectiveness penalty
}
```

## Services to Implement

### shipDesignerService
- `getAvailableComponents(type?)` - List components, optionally filtered
- `getShipWithComponents(shipId, userId)` - Ship with installed components
- `installComponent(userId, shipId, componentId)` - Validate slots, energy, deduct credits
- `uninstallComponent(userId, shipId, shipComponentId)` - Remove and refund partial credits
- `recalculateShipStats(ship, transaction?)` - Aggregate component bonuses to ship stats
- **Validation**: Ship must be at port, slot available, energy capacity sufficient

### combatService
- `calculateDamage(attackPower, defenseRating)` - With ±20% variance
- `applyDamage(target, damage)` - Shields first (with penetration), then hull
- `calculateScannerAccuracyBonus(attacker, defender)` - 5% per scanner level difference
- `executeCombatRound(attacker, defender, roundNum)` - Full round with energy consumption
- `attackNPC(userId, shipId, npcId)` - Full combat to resolution
- `fleeFromCombat(userId, shipId)` - Attempt to escape
- `getCombatHistory(userId, limit)` - Player's combat logs

### npcService
- `spawnNPC(sectorId, npcType?, transaction?)` - Create NPC with random stats
- `getNPCsInSector(sectorId)` - List alive NPCs
- `moveNPC(npcId, targetSectorId)` - Move to adjacent sector only
- `processNPCActions()` - AI behavior tick (patrol, trade, attack players)
- `respawnDeadNPCs()` - Respawn NPCs past their respawn_at time

### maintenanceService
- `calculateHullRepairCost(ship)` - Cost to repair hull
- `calculateComponentRepairCost(shipComponent)` - Cost to repair component
- `getRepairEstimate(shipId, userId)` - Full repair cost breakdown
- `repairHull(userId, shipId, portId)` - Repair hull at port
- `repairComponent(userId, shipId, componentId, portId)` - Repair single component
- `repairAll(userId, shipId, portId)` - Repair everything
- `degradeComponents(shipId, rounds, transaction?)` - Apply combat degradation
- `degradeOnJump(shipId, transaction?)` - Apply movement degradation
- `restoreShieldsAtPort(shipId)` - Restore shields when docking

## API Endpoints

### Ship Designer (`/api/ship-designer`)
- `GET /components` - List available components
- `GET /ship/:shipId` - Get ship with components
- `POST /ship/:shipId/install` - Install component (body: component_id)
- `POST /ship/:shipId/uninstall` - Uninstall component (body: ship_component_id)
- `GET /repair/:shipId/estimate` - Get repair cost estimate
- `POST /repair/:shipId/hull` - Repair hull (body: port_id)
- `POST /repair/:shipId/component/:componentId` - Repair component
- `POST /repair/:shipId/all` - Repair all

### Combat (`/api/combat`)
- `POST /attack/:shipId` - Attack NPC (body: npc_id)
- `POST /flee/:shipId` - Attempt to flee
- `GET /history` - Get combat history
- `GET /log/:combatLogId` - Get specific combat log (ownership verified)

### NPCs (`/api/npcs`)
- `GET /sector/:sectorId` - Get NPCs in sector
- `GET /:npcId` - Get NPC details
- `POST /spawn` - Spawn NPC (admin only)
- `POST /respawn` - Respawn dead NPCs (admin only)

## Integration Points

### Movement Integration (shipService)
- Call `maintenanceService.degradeOnJump(shipId, transaction)` after successful sector movement
- This applies 0.5% degradation to all active components

### Combat Integration
- Call `maintenanceService.degradeComponents(shipId, rounds, transaction)` after combat
- Call `shipDesignerService.recalculateShipStats(ship, transaction)` to update stats
- Components at min condition (10%) are auto-disabled

### Universe Generator Integration
- Seed components from config during universe generation
- Spawn initial NPCs based on sector type (pirates in outer sectors, patrols in core)

## Security Considerations

1. **Admin Middleware**: NPC spawn/respawn endpoints require admin role
2. **Combat Log Ownership**: Users can only view logs where they own attacker or defender ship
3. **Port Validation**: Component install/repair requires ship to be at a port
4. **Energy Validation**: Total component energy cost cannot exceed ship max_energy
5. **Slot Validation**: Cannot install more components than ship type allows

## Economy Sinks Added

| Sink | Cost |
|------|------|
| Hull Repair | 5 credits per hull point |
| Component Repair | 30% of component price per full repair |
| Component Purchase | Full component price |
| Fuel (from Phase 1) | Per-jump fuel cost |

## Compatibility Notes for Future Phases

### Phase 4 (Planets & Crew)
- Hull configs can be extended with `crew_capacity`
- Crew salaries follow same economy sink pattern as maintenance
- No conflicts with component system

### Phase 5 (Advanced Features)
- Crafting can produce components using existing Component model
- Tech tree can unlock component tiers (tier 4-5 could require research)
- Existing admin middleware extends for full admin panel

### Phase 6 (Beta)
- Fleet combat extends `executeCombatRound` pattern
- Component targeting adds to damage application logic
- Combat log JSON structure supports replay UI

## Testing Requirements

Write tests for:
1. Component installation/uninstallation (slot limits, energy limits)
2. Combat damage calculation and application
3. NPC spawning and movement validation
4. Maintenance degradation and repair costs
5. Admin endpoint authorization

**Goal:** At the end of Phase 3, players can customize ships with components, engage in turn-based combat with NPCs, and repair/maintain their ships at ports. The economy has meaningful sinks from component wear and repair costs.

