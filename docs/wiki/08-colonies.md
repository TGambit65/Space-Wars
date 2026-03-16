<!-- meta: {"title": "Colonies", "order": 8, "icon": "Building2", "category": "World"} -->

# Colonies

Colonies allow you to establish permanent settlements on planets, extract resources, and build infrastructure.

## Founding a Colony

### Requirements

1. **A Colony Ship** — Either a Colony Ship or Insta Colony Ship hull type
2. **A habitable planet** — Gas Giants (0% habitability) cannot be colonized
3. **10,000 credits** — Base colonization cost
4. **Navigate to the planet's system** — You must be in the same sector

### Colony Ship Types

| Ship | Cargo | Crew | Development | Consumed? |
|------|-------|------|-------------|-----------|
| Colony Ship | 1,000 | 20 | Up to 8 hours (scales with habitability) | Yes |
| Insta Colony Ship | 500 | 15 | Instant | Yes |

> **Important**: Your colony ship is **consumed** when founding a colony. You'll need another ship to continue playing.

### Development Timer

Standard Colony Ships trigger a development period before the colony becomes active. The timer scales inversely with planet habitability:

- **Terran (100%)** — Shortest development time
- **Desert (50%)** — Moderate development time
- **Barren (10%)** — Very long development time

Insta Colony Ships skip this timer entirely but carry less cargo and crew.

## Colony Management

### Infrastructure Level

Colonies have an infrastructure level from 1–10. Higher infrastructure unlocks:
- More advanced buildings
- Higher population capacity
- Access to wonders (at infrastructure 3+)

### Population Growth

Base population growth rate is **5% per tick**. Growth is influenced by:
- Planet habitability
- Available housing (Habitat Modules)
- Colony morale (Entertainment Complexes)

### Resource Extraction

Colonies automatically extract resources based on:
- Planet type and available resources
- Installed extraction buildings
- Infrastructure level
- Base resource generation multiplier (1.0×)

## Buildings

Colonies can construct 21 building types across three categories. Buildings require workforce, some consume power, and many have planet type bonuses.

### Extraction Buildings

These produce raw resources. Each has a 3-tier upgrade chain:

**Mining Chain**: Surface Mine → Deep Core Drill → Quantum Extractor

| Building | Tier | Cost | Workforce | Power | Output | Max |
|----------|------|------|-----------|-------|--------|-----|
| Surface Mine | 1 | 25,000 | 50 | 0 | 20 Ore | 3 |
| Deep Core Drill | 2 | 60,000 | 80 | 50 | 50 Ore | 3 |
| Quantum Extractor | 3 | 150,000 | 120 | 150 | 120 Ore | 3 |

Planet bonuses: Volcanic 1.5×, Barren 1.3×, Desert 1.2×

**Water Chain**: Water Pump → Deep Well → Cryo Harvester

| Building | Tier | Cost | Workforce | Power | Output | Max |
|----------|------|------|-----------|-------|--------|-----|
| Water Pump | 1 | 20,000 | 30 | 0 | 25 Water | 3 |
| Deep Well | 2 | 50,000 | 50 | 30 | 60 Water | 3 |
| Cryo Harvester | 3 | 120,000 | 80 | 100 | 150 Water | 3 |

Planet bonuses: Oceanic 2.0×, Terran 1.5×, Jungle 1.4×, Ice 1.3×

**Power Chain**: Solar Array → Geothermal Plant → Fusion Reactor

| Building | Tier | Cost | Workforce | Power Gen | Max |
|----------|------|------|-----------|-----------|-----|
| Solar Array | 1 | 15,000 | 20 | 100 | 5 |
| Geothermal Plant | 2 | 40,000 | 40 | 250 | 5 |
| Fusion Reactor | 3 | 100,000 | 60 | 500 | 5 |

Solar Array bonus: Desert 1.5×. Geothermal bonus: Volcanic 1.8×.

### Infrastructure Buildings

| Building | Tier | Cost | Workforce | Power | Effect | Max |
|----------|------|------|-----------|-------|--------|-----|
| Habitat Module | 1 | 30,000 | 20 | 20 | +500 max population | 5 |
| Hydroponic Farm | 1 | 20,000 | 40 | 30 | 5 Water → 30 Food | 4 |
| Entertainment Complex | 1 | 25,000 | 30 | 25 | +10% morale | 2 |
| Spaceport | 2 | 45,000 | 50 | 40 | +25% trade capacity | 1 |
| Defense Grid | 2 | 40,000 | 30 | 60 | +50 colony defense | 3 |
| Research Lab | 2 | 50,000 | 60 | 50 | +15% research speed | 2 |

### Manufacturing Buildings

| Building | Tier | Cost | Workforce | Power | Production | Max |
|----------|------|------|-----------|-------|------------|-----|
| Refinery | 2 | 60,000 | 70 | 80 | 10 Ore → 8 Refined Metals | 2 |
| Chemical Plant | 2 | 55,000 | 60 | 70 | 8 Water + 5 Organics → 6 Chemicals | 2 |
| Component Factory | 3 | 100,000 | 100 | 120 | 5 Refined Metals + 3 Electronics → 4 Ship Parts | 1 |

## Wonders

Wonders are unique mega-structures that provide powerful bonuses. They require the **Advanced Colonies** tech and sufficient infrastructure.

| Wonder | Bonus | Phase Cost | Required Infrastructure |
|--------|-------|-----------|------------------------|
| Orbital Array | +25% scan range | 10,000 | 3 |
| Trade Nexus | +15% trade bonus | 15,000 | 4 |
| Defense Matrix | +20% sector defense | 20,000 | 5 |
| Shipyard | -20% ship cost | 25,000 | 5 |
| Research Station | +25% research speed | 20,000 | 4 |
| Genesis Device | +30% habitability | 30,000 | 6 |

Wonders are built in phases (up to 5 per wonder). Each phase costs credits and provides incremental bonus increases.
