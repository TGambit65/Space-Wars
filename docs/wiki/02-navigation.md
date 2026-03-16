<!-- meta: {"title": "Navigation", "order": 2, "icon": "Map", "category": "Core Systems"} -->

# Navigation

Space Wars 3000 features a procedurally generated galaxy with ~400 star systems arranged in a spiral pattern within a radius of 500 light-years.

## Galaxy Map

The **Sector Map** (`/map`) displays the entire galaxy as a 2D canvas view. Systems are shown as colored dots based on their star class, connected by hyperlane lines.

### Hyperlanes

Hyperlanes are the primary travel routes between star systems. They are generated using Delaunay triangulation, creating a natural-looking network. Each jump along a hyperlane costs fuel based on distance.

### Wormholes

Wormholes are rare long-distance connections that link distant parts of the galaxy. They appear as special connections on the map and allow rapid traversal across the galaxy.

### Jumping Between Systems

To travel:
1. Open the Sector Map
2. Click on a connected (adjacent) system
3. Your ship will jump there, consuming fuel

Fuel cost scales with distance. Upgrade your engines for better fuel efficiency.

## System View

The **System** page (`/system`) shows a 3D orbital view of your current star system using Three.js rendering. You'll see:

- **The Star** — rendered with a glow effect at the center
- **Planets** — orbiting at their assigned positions (1–15 per system)
- **Ports** — shown as octahedrons
- **NPCs** — shown as cones
- **Your Ship** — positioned near the star

### Scanning

Unscanned planets appear as dim anonymous spheres labeled "SIG-DETECTED". Use your ship's scanners to reveal planet details including:
- Planet type and habitability
- Available resources
- Whether the planet can be colonized

Better scanners reveal more detail at greater range.

## Star Classes

Each system has a star class that determines its color, maximum planet count, and what types of planets are likely to appear.

| Star Class | Color | Max Planets | Likely Planet Types |
|-----------|-------|-------------|---------------------|
| O (Blue Supergiant) | Blue | 5 | Barren, Volcanic, Gas Giant |
| B (Blue Giant) | Light Blue | 7 | Barren, Volcanic, Gas Giant, Crystalline |
| A (White) | White | 8 | Desert, Barren, Gas Giant, Ice |
| F (Yellow-White) | Pale Yellow | 10 | Terran, Oceanic, Desert, Gas Giant |
| G (Yellow) | Yellow | 15 | Terran, Oceanic, Jungle, Desert, Gas Giant |
| K (Orange) | Orange | 12 | Desert, Ice, Barren, Toxic, Gas Giant |
| M (Red Dwarf) | Red | 8 | Ice, Barren, Toxic, Volcanic |
| Neutron Star | Pale Blue | 3 | Barren, Crystalline |
| Black Hole | Purple | 0 | None |

> **Tip**: Class F and G stars are the best places to find habitable (Terran, Oceanic, Jungle) planets for colonization.

## Orbital Position

Planets are placed at orbital positions 1–15 from the star. Position affects planet type:

- **Inner orbits (1–3)** — Biased toward hot types (Volcanic, Desert, Barren)
- **Mid orbits (4–9)** — Mixed types, best chance for habitable worlds
- **Outer orbits (10+)** — Biased toward cold types (Ice, Gas Giant)

## Planet Naming

Planets are named after their parent system followed by a Roman numeral based on orbital position. For example, the third planet orbiting "Alpha Centauri" would be **Alpha Centauri III**.
