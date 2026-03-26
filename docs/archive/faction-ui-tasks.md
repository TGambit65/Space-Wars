# Implementation Tasks: UI/UX & Faction Reskins

## Phase 1: Core Design System & Terran Foundation
- [x] Analyze `site/css/sw3-design-system.css` and establish it as the single source of truth.
- [x] Create `docs/faction-ui-ux-plan.md` outlining the faction themes and component strategy.
- [x] Extract structural styles (glass panels, grids, glows) from Terran Stitch export.
- [x] Integrate Terran CSS classes (`.terran-glass-panel`, `.terran-grid-bg`) into `client/src/styles/index.css`.
- [x] Build the `TerranDashboard.jsx` React component.
- [x] Implement conditional rendering in `Dashboard.jsx` to show the Terran dashboard for `terran_alliance` players.

## Phase 2: Zythian Swarm Interface
- [x] Generate Zythian Swarm UI prompt and process the Stitch export.
- [x] Extract bio-organic styles and custom pulsing animations from the Zythian Stitch export.
- [x] Integrate Zythian CSS classes (`.zythian-glass-panel`, `.zythian-bg`) into `client/src/styles/index.css`.
- [x] Build the `ZythianDashboard.jsx` React component (translating metrics to Biomass, Evolution Points, etc.).
- [x] Implement conditional rendering in `Dashboard.jsx` to show the Zythian dashboard for `zythian_swarm` players.

## Phase 3: Automaton Collective Interface
- [x] Process the Automaton Collective Stitch export.
- [x] Extract cybernetic, sharp, terminal-style CSS from the Automaton export.
- [x] Integrate Automaton CSS classes (e.g., `.automaton-hex-panel`, `.automaton-bg`) into `client/src/styles/index.css`.
- [x] Build the `AutomatonDashboard.jsx` React component (translating metrics to Energy Credits, Processing Cores).
- [x] Implement conditional rendering in `Dashboard.jsx` to show the Automaton dashboard for `automaton_collective` players.

## Phase 4: Global Component Refactor (Tech Debt)
- [x] Convert generic `<Button>`, `<Card>`, and `<Notification>` components to inherit styles dynamically from CSS custom properties (`--sw3-primary`).
- [x] Refactor `client/src/components/common/Layout.jsx` sidebar to use the `sw3-design-system.css` layout metrics instead of inline styles.
- [x] Implement global `ThemeProvider` context in `App.jsx` to inject `data-faction` attributes on the `<body>` tag.

## Phase 5: Additional Views
- [x] Expand faction theming to the **Galaxy Map** view (e.g., Hex-grid for Automatons, Neural Web for Zythians).
- [x] Expand faction theming to the **Shipyard** view (e.g., Assembly Matrix for Automatons, Spawning Pool for Zythians).
- [x] Expand faction theming to the **Market** view.
- [x] Reskin the Registration/Faction Selection screen to instantly preview themes upon selection.