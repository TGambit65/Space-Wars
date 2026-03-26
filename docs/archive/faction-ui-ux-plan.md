# Frontend UI/UX Enhancement & Faction Interfaces Plan

## 1. Frontend Codebase Analysis

The Space Wars 3000 frontend is divided into two main environments:
1. **Static Site (`site/`)**: Contains the landing pages (`index.html`), Wiki (`site/wiki/`), and the core CSS design system (`site/css/sw3-design-system.css`). It establishes the visual identity of the game.
2. **React Client App (`client/src/`)**: The actual game client interface handling real-time interactions, dashboards, chat, navigation, and gameplay.

**Current Style Profile (Home Page):**
The home page and the core design system utilize a **Unified Cyan Theme**:
- Deep dark backgrounds (`#0a0a0a`) and surfaces (`#1a1a1a`).
- Neon accents with Cyan primary (`#00ffff`) and Orange secondary (`#ff6600`).
- Modern sci-fi aesthetic using glassmorphism (backdrop filters), glowing drop-shadows (`0 0 20px rgba(0, 255, 255, 0.3)`), and sharp edge geometry.

---

## 2. Plan to Maintain the Home Page Style

To ensure the immersive style of the home page propagates flawlessly throughout the React client and the Wiki:
- **Single Source of Truth**: Elevate `sw3-design-system.css` as the foundational stylesheet for both the static site and the React application.
- **CSS Custom Properties**: Leverage the existing CSS variables (e.g., `--sw3-primary`, `--sw3-surface`) to power dynamic theming.
- **Shared Components**: Replicate the CSS-based button components (`sw3-btn`), card components (`sw3-card`), and navigation structures as reusable React components to ensure structural consistency.
- **Preserve Geometry & Glows**: Keep the fixed padding scales, glowing hover states, and backdrop-blurs as the unchangeable baseline layer. Faction themes will only override the color palette and border radii, not the core layout metrics.

---

## 3. Three Distinct Faction UI Interfaces

We will implement three distinct visual interfaces based on the player's chosen faction, injecting personality into the core design system without breaking usability.

### A. Terran Federation (The Standard)
*Motto: Unity Through Progress*
- **Theme Color**: Earth Blue / Cyan (`#3498db` to `#00ffff`)
- **Aesthetic**: Utilitarian, military-grade, clean, and structured.
- **UI Elements**: Sharp 90-degree corners, prominent grid lines, standard glassmorphic data panels. Reuses the default Home Page aesthetic almost entirely.
- **Typography**: Crisp, highly legible sans-serif (Inter/Roboto) with bright blue glows for active states.

### B. Zynthian Collective (The Swarm)
*Motto: Harmony with Nature*
- **Theme Color**: Crimson Red (`#e74c3c`) with Bio-Green accents.
- **Aesthetic**: Organic, bio-tech, fluid, and living.
- **UI Elements**: Rounded corners (`border-radius: 12px` to `24px`), asymmetrical borders, pulsing organic animations (breathing glow effects rather than static neon).
- **Typography**: Slightly curved display fonts, softer contrasts, with floating particle effects in the background.

### C. Nexus Syndicate / Automaton Collective
*Motto: Efficiency Above All*
- **Theme Color**: Deep Violet / Neon Purple (`#9b59b6`)
- **Aesthetic**: Cyberpunk, monolithic, data-dense, hyper-efficient.
- **UI Elements**: Hexagonal UI components, terminal-style data readouts, scan-line overlays, heavily contrasting dark surfaces.
- **Typography**: Monospace fonts for data blocks, glitch/flicker transitions on hover states.

---

## 4. UI/UX Enhancement Plan

1. **Global Theme Provider**: Implement a React `ThemeProvider` context in `client/src/App.jsx` that reads the `user.faction` and dynamically injects the appropriate CSS variables into the `:root` element.
2. **Polished Onboarding**: Redesign the faction selection screen in the registration/login flow to showcase these UI changes instantly upon selecting a faction.
3. **Unified Navigation UX**: Bring the React Client's sidebar/navigation up to the visual standard of the static site's sticky top-bar, utilizing the same glassmorphism (`backdrop-filter: blur(10px)`).
4. **Enhanced Feedback**: Standardize the notification system (`sw3-notification`) globally across React and static pages to ensure a seamless transition between the Wiki and the game.

---

## 5. Conflict Audit vs. Idea Board

**Audit Source**: `planner/spacewars-plan-export.json` and `docs/idea-board-gap-audit.md`

- **Current Board Focus**: The idea board is heavily tilted toward backend mechanics (PvP zones, Admin Control Plane, NPC dialogue, instance orchestration, home sectors, pathfinding).
- **Conflict Assessment**: **No Conflicts Found.**
- **Synergy**: The dynamic Faction UI system perfectly synergizes with the "Interactive NPC Dialogue" and "Player Home Sectors" features. A Zynthian player interacting with an NPC in their home sector will experience it through an organic red/green UI, enhancing the narrative immersion planned in the idea board without interfering with the backend rule engines or React state management.

---

## 6. Feature PRDs

### Feature: Dynamic Faction Theme Engine

**Purpose**
Create a seamless, deeply immersive UI experience by reskinning the game client to match the player's chosen faction while preserving the core layout and usability established by the homepage.

**Functional Requirements**
- Extend `sw3-design-system.css` to include data-attribute overrides for `[data-faction="terran"]`, `[data-faction="zynthian"]`, and `[data-faction="nexus"]`.
- The React application must wrap the main application layout in a `ThemeProvider` that reads `user.faction` and sets the `data-faction` attribute on the `<body>` tag.
- Faction changes must dynamically override `--sw3-primary`, `--sw3-primary-alpha`, and border-radius variables.
- Maintain a fallback to the default Cyan theme for unauthenticated users or generic Wiki pages.

**UX Specification**
- **Terran**: Default blue/cyan, sharp edges (`--sw3-radius-md: 4px`).
- **Zynthian**: Red/Green, curved edges (`--sw3-radius-md: 16px`), organic pulse animations on primary buttons.
- **Nexus**: Purple, terminal aesthetic, scan-line background overlays on cards.
- Transitions between themes (e.g., during faction selection) should cross-fade smoothly over `0.3s`.

**Acceptance Criteria**
- Changing faction in the registration screen dynamically changes the entire form's color palette and button shapes.
- Logging in as a Nexus player renders the dashboard with purple hues and hexagonal styling cues.
- The base layout, grids, and paddings remain identical across all factions to avoid breaking responsive design.

---

### Feature: Unified Client/Site Component Library

**Purpose**
Ensure the high-quality visual standard of the homepage is perfectly replicated in the React game client by creating a 1:1 React component library mapped to the static design system.

**Functional Requirements**
- Build React components for `<Button>`, `<Card>`, `<CardHeader>`, `<Notification>`, and `<Navbar>` that strictly implement the class names from `sw3-design-system.css`.
- Remove legacy inline styling from `client/src/components/common/Layout.jsx` that hardcodes faction colors, replacing it with the new CSS variable inheritance.
- Support responsive collapsing for the navigation bar, mimicking the static site's mobile behavior.

**UX Specification**
- Game client buttons feature the same `::before` pseudo-element hover sweep animation seen on the homepage.
- Client dashboard cards feature the `sw3-card:hover` glowing drop shadow.
- Notifications utilize the slide-in/slide-out transform classes from the static site.

**Acceptance Criteria**
- React `<Button variant="primary">` renders identical DOM and styling to `<a class="sw3-btn sw3-btn--primary">` on the static site.
- The game client fully relies on `sw3-design-system.css` for structural UI styling.
- All legacy hardcoded color hexes are removed from the React codebase.