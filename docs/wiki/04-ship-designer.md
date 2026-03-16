<!-- meta: {"title": "Ship Designer", "order": 4, "icon": "Wrench", "category": "Core Systems"} -->

# Ship Designer

The **Shipyard** lets you install, swap, and upgrade components on your ships. Each ship has a fixed number of slots per component type.

## Component Slots by Ship

| Ship | Weapon | Shield | Engine | Scanner | Cargo Pod | Armor |
|------|--------|--------|--------|---------|-----------|-------|
| Scout | 1 | 1 | 1 | 2 | 1 | 1 |
| Merchant Cruiser | 2 | 2 | 1 | 1 | 3 | 1 |
| Freighter | 1 | 2 | 1 | 1 | 5 | 2 |
| Fighter | 3 | 1 | 2 | 1 | 0 | 1 |
| Corvette | 2 | 2 | 2 | 1 | 1 | 2 |
| Destroyer | 4 | 3 | 2 | 2 | 1 | 3 |
| Carrier | 2 | 4 | 1 | 3 | 2 | 4 |
| Colony Ship | 1 | 3 | 1 | 2 | 4 | 2 |
| Insta Colony Ship | 0 | 2 | 1 | 1 | 3 | 1 |
| Battlecruiser | 5 | 3 | 2 | 2 | 1 | 3 |
| Interceptor | 2 | 1 | 3 | 1 | 0 | 1 |
| Mining Barge | 1 | 2 | 1 | 2 | 6 | 2 |
| Explorer | 1 | 2 | 2 | 3 | 2 | 1 |

## Weapons

Weapons deal damage in combat. Higher tiers deal more damage but cost more energy and have lower accuracy.

| Name | Tier | Damage | Accuracy | Energy | Price | Special |
|------|------|--------|----------|--------|-------|---------|
| Laser Cannon | 1 | 10 | 85% | 5 | 500 | — |
| Pulse Laser | 2 | 18 | 80% | 8 | 1,200 | — |
| Plasma Cannon | 3 | 30 | 75% | 15 | 3,000 | — |
| Ion Cannon | 2 | 12 | 90% | 10 | 1,500 | 1.5× vs shields |
| Missile Launcher | 3 | 45 | 70% | 20 | 4,000 | — |
| Railgun | 4 | 60 | 65% | 25 | 8,000 | — |
| Photon Torpedo | 4 | 80 | 60% | 35 | 12,000 | — |
| Disruptor Array | 5 | 100 | 55% | 50 | 25,000 | — |
| Graviton Lance | 5 | 120 | 50% | 60 | 35,000 | — |

## Shields

Shields absorb incoming damage and recharge between combat rounds.

| Name | Tier | Capacity | Recharge/rd | Energy | Price |
|------|------|----------|-------------|--------|-------|
| Basic Shield | 1 | 50 | 2 | 3 | 400 |
| Deflector Shield | 2 | 100 | 4 | 5 | 1,000 |
| Combat Shield | 3 | 180 | 6 | 8 | 2,500 |
| Heavy Shield | 3 | 250 | 3 | 10 | 3,500 |
| Regenerative Shield | 4 | 200 | 12 | 12 | 6,000 |
| Capital Shield | 5 | 400 | 8 | 20 | 15,000 |
| Phase Shield | 5 | 500 | 10 | 25 | 20,000 |

> **Tip**: The Regenerative Shield has the fastest recharge rate (12/round). For long fights, regeneration matters more than raw capacity.

## Engines

Engines affect ship speed and fuel efficiency. Higher fuel efficiency means less fuel consumed per jump.

| Name | Tier | Speed | Fuel Efficiency | Price |
|------|------|-------|-----------------|-------|
| Ion Drive | 1 | 10 | 1.0× | 300 |
| Plasma Drive | 2 | 15 | 1.2× | 800 |
| Fusion Engine | 3 | 20 | 1.5× | 2,000 |
| Antimatter Drive | 4 | 30 | 1.3× | 5,000 |
| Quantum Drive | 5 | 40 | 2.0× | 12,000 |
| Hyperspace Drive | 5 | 50 | 2.5× | 18,000 |

## Scanners

Scanners determine how much detail you can see and at what range.

| Name | Tier | Range | Detail Level | Price | Special |
|------|------|-------|-------------|-------|---------|
| Basic Scanner | 1 | 1 | 1 | 200 | — |
| Long-Range Scanner | 2 | 2 | 2 | 600 | — |
| Deep Scanner | 3 | 3 | 3 | 1,500 | — |
| Military Scanner | 4 | 4 | 4 | 4,000 | Detects cloaked |
| Quantum Scanner | 5 | 5 | 5 | 10,000 | — |

## Cargo Pods

Cargo pods expand your ship's cargo capacity.

| Name | Tier | Capacity | Price | Special |
|------|------|----------|-------|---------|
| Small Cargo Pod | 1 | +25 | 250 | — |
| Medium Cargo Pod | 2 | +50 | 600 | — |
| Large Cargo Pod | 3 | +100 | 1,500 | — |
| Reinforced Cargo Pod | 3 | +75 | 1,800 | Protected cargo |
| Massive Cargo Hold | 4 | +200 | 4,000 | — |

## Armor

Armor adds hull points and provides damage reduction (a percentage of incoming damage is absorbed).

| Name | Tier | Hull Bonus | Damage Reduction | Price |
|------|------|-----------|-----------------|-------|
| Light Plating | 1 | +20 | 5% | 350 |
| Composite Armor | 2 | +50 | 10% | 900 |
| Reactive Armor | 3 | +80 | 15% | 2,200 |
| Ablative Armor | 4 | +120 | 20% | 5,500 |
| Quantum Armor | 5 | +200 | 25% | 14,000 |

## Component Condition

Components degrade over time:
- **2% per combat round** — fighting wears down equipment
- **0.5% per sector jump** — travel takes its toll
- Components at **10% condition break** and stop functioning
- At 50% condition, a component operates at only 50% effectiveness

Visit the **Engineering** page to repair components. Repair cost is 30% of the component's purchase price for a full repair.
