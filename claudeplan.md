# Space Wars 3000 — UX Improvement Plan (Player Perspective)

## 1. New Player Onboarding (Critical)

**Problem:** After registration and faction selection, the player lands on a dashboard with no guidance. There is no tutorial, no tooltips, no first-mission prompt, and no explanation of what to do next. The sidebar has 23+ nav items — overwhelming for a new player.

**Suggestions:**
- Add a **first-login tutorial flow** — a short guided sequence: "Check your ship -> Navigate to a port -> Make your first trade -> Scan a planet." Track completion in a `tutorial_step` field on the User model.
- Show a **"Getting Started" card** on the Dashboard for new players (level 1, <5 minutes played) with 3-4 checklist items linking to the relevant pages.
- **Progressive sidebar disclosure** — hide advanced features (Automation, Crafting, Corporations, Outposts, Events, Wiki) until the player reaches the level or prerequisite that makes them relevant. Show a "More" section or unlock notification.
- Add **contextual empty states** — when a player visits Trading with no port nearby, the current message is good, but add a "Nearest port is in sector X" hint with a link to the map.

---

## 2. Navigation & Spatial Awareness

**Problem:** The galaxy map, system view, and sector map are separate pages with no persistent mini-map or breadcrumb showing where you are. Players lose spatial context when switching to trading, combat, or colony pages.

**Suggestions:**
- Add a **persistent location bar** at the top of the main content area (not just the sidebar credits display) showing: `Sector: Alpha Centauri | Port: Trading Hub | Fuel: 72/100`. This should be visible on every non-map page.
- Add a **mini-map widget** (collapsible) in the bottom-left corner showing the immediate sector neighborhood — current sector highlighted, adjacent sectors clickable for quick travel.
- On the **System View**, show a visual indicator for which entities are interactable (ports = dock icon, planets = scan icon, NPCs = hail/attack icon) rather than requiring the player to click each entity to discover what actions are available.
- Add a **"Jump to nearest port"** quick-action button on the ship status panel and trading error pages.
- Display **space phenomena** (ion storms, nebulae, asteroid fields, solar flares, gravity wells) on the galaxy map and system view. The backend defines 5 phenomena types with gameplay effects (shield reduction, fuel cost increases, mining bonuses, flee prevention) but nothing renders them. Players are affected by invisible hazards. Show them as colored overlays or sector badges with tooltip descriptions.
- Improve the **Planet Orbit View discoverability** — the immersive planet view (`/planet/:id`) is only reachable by double-clicking a planet in the System View. Add a "View Planet" button on planet scan results and colony cards. Add a back-navigation breadcrumb (currently only Escape key works, which is undiscoverable).

---

## 3. Trading UX

**Problem:** The trading table works but lacks key decision-support information. Players have no way to know where to sell at a profit without manually visiting ports and comparing prices.

**Suggestions:**
- Show **profit/loss indicators** per commodity: "You bought at avg X cr, current sell price is Y cr" with green/red coloring.
- Add a **"Best Trades" panel** on the trading page showing the top 3 profitable buy->sell opportunities from the current port based on known price data from visited ports.
- Add **separate "Buy Max" and "Sell All" buttons** per commodity row. The current single Max button uses a heuristic (if you own the commodity, it sets max sell quantity; if you don't, it sets max buy quantity) which is confusing when a player owns some units but wants to buy more.
- Show **commodity volume** in the trade table — large volume items fill cargo faster, and this is invisible to the player currently.
- On the Market Data page, add a **route planner** — "Buy X at Port A, sell at Port B, estimated profit: Z credits" based on explored ports.

---

## 4. Combat Feedback & Engagement

**Problem:** Combat is either auto-resolved (fast but feels disconnected) or real-time via sockets (but the player has limited control beyond watching). The auto-resolve mode shows round-by-round text with 1-second delays, which is just waiting.

**Suggestions:**
- For auto-resolve mode, add a **speed control** (1x, 2x, 4x, Skip to Result) so players can watch the detail or skip ahead.
- Add **visual ship damage indicators** — show the hull/shield bars animating down as rounds progress, with screen shake or flash on critical hits.
- After combat, show a **detailed loot breakdown**: credits earned, XP gained, items dropped, component damage taken. Currently it only shows credits.
- Add a **threat assessment** before engaging: "Enemy estimated power: HIGH. Your win probability: ~65%. Recommended: upgrade shields." This could use the existing combat service math.
- Show **XP gain notifications** after combat, trading, and exploration — currently XP accrual is invisible outside the Progression page.

---

## 5. Ship Management & Customization

**Problem:** Ship management is spread across 4 separate pages (Ships, Shipyard/Designer, Customize, Engineering/Repair) with no cross-linking. A player who notices their hull is low on the Ship page has to navigate to Engineering separately.

**Suggestions:**
- Add **quick-action buttons** on the Ship Status page: "Repair Hull" (links to Engineering), "Upgrade Components" (links to Shipyard), "Customize" (links to Customizer).
- Show **component condition** on the Ship Status page — currently you have to go to Engineering to see degradation. A simple "3 components need repair" warning would help.
- On the **Shipyard**, show a **ship comparison view** — when browsing components, show a before/after stat comparison (damage +5, accuracy -3, etc.).
- Add a **"Buy New Ship"** flow — currently there's no visible way for a player to purchase additional ships. The ship purchasing endpoint needs a storefront UI.
- Fix the **Ship Design Templates** — the Shipyard has Save and Delete for templates but no "Load/Apply" button. The saved templates list is display-only with no way to apply a saved design to the current ship.
- The **Ship Customizer** has no visual preview — the player picks colors and options from swatches/dropdowns but only sees a text summary of hex codes. Add a rendered ship silhouette or 3D preview that updates in real-time as the player changes options.
- **Fleet discoverability** — fleet creation requires Shift+drag on the galaxy map (only documented in 10px gray text at the bottom of the Ship panel). Fleet movement is right-click only. Add an explicit "Create Fleet" button on the Ship panel, and show fleet controls prominently when a fleet is selected on the map.

---

## 6. Colony Management

**Problem:** Colonies are a deep system (buildings, production chains, wonders, raids) but the UI treats them as a flat list. Players can't easily see production bottlenecks or plan build orders.

**Suggestions:**
- Add a **production overview** per colony: "Producing: 20 Ore, 25 Water, 30 Food per tick. Consuming: 10 Ore, 5 Water. Net: +10 Ore, +20 Water, +30 Food."
- Show **building prerequisites visually** — a simple tech-tree-style layout showing which buildings unlock which, rather than requiring the player to discover prerequisites by trial and error.
- Add a **"Collect All"** button for players with multiple colonies, rather than requiring individual collection per colony.
- Show **population growth projections** — "Current: 500. Projected next tick: 525. Housing limit: 1000."
- Add **raid alerts** — prominent notification when a colony is under raid, with a quick-link to respond.
- Show **power balance** per colony — buildings consume and generate power, but there is no summary showing "Power: 250/300 MW used." Players can't tell if they have headroom to build more.
- Show **workforce usage** — buildings require workforce from population, but there is no indicator of remaining available workforce.
- **Wonder construction UX** — 6 wonder types with multi-phase construction exist but the plan must ensure the wonder build UI shows phase progress, costs for next phase, and the cumulative bonus being built toward.

---

## 7. Progression Visibility

**Problem:** The player's level, XP, and skill points are only visible on the dedicated Progression page. There's no ambient sense of growth or achievement.

**Suggestions:**
- Add **level and XP bar** to the sidebar or top bar — always visible, showing progress toward next level.
- Show **toast notifications** for: level ups, skill point earned, tech research completed, mission rewards, artifact discovered. Currently these events are silent.
- Add an **achievement/milestone system** — "First Kill," "Traded 10,000 credits," "Colonized a planet," "Explored 50 sectors." Display in a trophy case on the Dashboard or profile.
- On level up, show a **"What's New" popup** — "You've unlocked: Corvette ship class. You earned: 1 skill point."

---

## 8. Social & Multiplayer Features

**Problem:** The game has Corporations, Messaging, Chat, Factions, and PvP but they feel disconnected. There's no player list, no way to see who's online, and the chat is a hidden floating button.

**Suggestions:**
- Add a **"Players in Sector"** panel on the System View — show other players' ships, their faction, and whether they have PvP enabled. This creates presence and social interaction opportunities.
- Make the **chat more visible** — instead of a hidden button in the bottom-right, add a chat tab in the sidebar or a persistent chat bar at the bottom of the screen.
- Add a **Corporation dashboard** with: member online status, shared treasury graph, recent corporation activity log, and pending agreements.
- Add **faction-wide chat channels** — currently chat appears to be global only.
- Show **leaderboards** on the Dashboard: Top traders, top combatants, richest players, biggest corporations.
- **Messaging improvements** — the compose modal requires typing exact usernames with no autocomplete or player search. There is no "Reply" button on received messages. Add player name autocomplete and a one-click reply action.
- The **Corporation agreement proposal** requires typing a raw Corporation ID. Replace with a searchable corporation picker from the leaderboard data.

---

## 9. Crafting & Automation UX

**Problem:** Crafting and Automation pages have functional but hostile UX that requires players to know internal game IDs and provides minimal feedback.

**Suggestions:**
- **Crafting**: Show whether the player has the required ingredients in their active ship's cargo. Currently the blueprint card lists ingredients but doesn't indicate if the player can actually craft it. Add green/red indicators per ingredient. Display crafting time in human-readable format (e.g., "5 minutes") instead of raw seconds.
- **Crafting jobs**: Show estimated time remaining, not just a progress bar with no labels.
- **Automation trade routes**: The waypoint input requires typing raw Sector IDs with no autocomplete or map picker. Replace with a searchable dropdown of explored sectors, or allow clicking on the galaxy map to add waypoints.
- **Automation mining runs**: The "Return Port Sector ID" field requires typing a raw number. Replace with a dropdown of sectors that contain ports.
- **Outpost building**: Same raw Sector ID problem. Replace with a picker showing explored sectors, or integrate with the galaxy map so the player can right-click a sector and select "Build Outpost."

---

## 10. NPC Interaction & Dialogue

**Problem:** The game has an AI-powered NPC dialogue system with voice support, personality traits, and scripted conversations — a major differentiating feature. But the interaction entry points are not obvious and errors fail silently.

**Suggestions:**
- Make NPC **hail notifications more prominent** — they appear as a small overlay that can be easily missed during map navigation. Add a sound cue and a pulsing indicator.
- On the **System View entity bar**, clearly mark which NPCs are friendly/hostile/neutral with color coding and show available actions (Hail, Attack, Trade) without requiring a click first.
- Add a **dialogue history** — players can't review past NPC conversations. If an NPC gave a trade tip or quest hint during dialogue, it's lost when the chat closes.
- Show **NPC personality traits** (e.g., "greedy," "honorable") in the hail notification or chat header so the player can adjust their approach.
- Handle **dialogue API failures gracefully** — if the AI service is down, show a clear message instead of silently failing.

---

## 11. Community Events & Factions

**Problem:** Community Events and Faction pages are functional but lack context and engagement hooks.

**Suggestions:**
- **Events**: The contribute action takes a raw number with no guidance. Show the player's credits, suggest contribution amounts (10%, 25%, 50% of credits), and clarify what resource is being contributed (credits vs. materials).
- **Events**: Show the player's own contribution rank and amount on the event card, not just behind the leaderboard modal.
- **Factions**: The faction page shows standings and wars but offers no actionable gameplay. Add links to faction-specific missions, show how recent actions have changed standing, and suggest actions to improve standing ("Trade at Terran ports to gain reputation").
- **Faction wars**: Show what the player can do to contribute to their faction's war effort.

---

## 12. Quality-of-Life Improvements

**Problem:** Several small friction points that individually are minor but collectively degrade the experience.

**Suggestions:**
- **Auto-refuel option** — "Refuel to max when docking" toggle, saving players the manual refuel step every time.
- **Keyboard shortcuts** — M for map, T for trading, S for ship status, Space to confirm dialogs. The game is entirely mouse-driven.
- **Sound effects and audio** — there is zero audio feedback. Even basic UI sounds (button clicks, trade confirmations, combat hits, warp jumps) would dramatically improve immersion.
- **Loading state improvements** — replace generic spinners with thematic messages: "Establishing subspace link..." "Calibrating navigation array..." (some pages do this, but not consistently).
- **Breadcrumb navigation** — on sub-pages (Combat History, Planet Orbit View), show a breadcrumb trail for easy back-navigation.
- **Responsive/mobile layout** — the sidebar is fixed at 264px with no collapse option. On smaller screens, the game is likely unusable. Add a hamburger menu for mobile.
- **Session persistence** — save the player's last active page in localStorage so refreshing the browser returns them to where they were, not the Dashboard.
- **Bulk actions** — sell all cargo, dismiss all unassigned crew, collect all colony resources.
- **Consistent error handling** — error display varies wildly across pages: some use auto-dismissing toasts (5s), some use persistent banners, some use `alert()` (PvP toggle in ShipPanel). Standardize on a single notification system with severity levels (info/warning/error) and consistent behavior.
- **Socket connection indicator** — the real-time WebSocket connection has no visible status. If the socket disconnects (affects combat, chat, NPC hails), the player gets no feedback. Add a small connectivity indicator in the sidebar or status bar.
- **Replace all raw ID inputs** — at least 5 pages require typing raw numeric Sector IDs, Corporation IDs, or Port IDs (Automation waypoints, Automation mining return port, Outpost building, Corporation agreement proposals, Messaging recipient). This is the single most hostile UX pattern in the app. Replace every instance with searchable dropdowns, autocomplete fields, or map-based pickers.
- **Basic accessibility** — no ARIA labels, no keyboard focus management, no skip-navigation links. Add semantic ARIA roles to interactive elements and ensure all actions are keyboard-reachable.

---

## 13. Visual Polish & Immersion

**Problem:** The dark space theme is solid but feels static. There's no sense of being in a living universe.

**Suggestions:**
- Add **ambient animations** to the Dashboard — a subtle star parallax background, or a small animated ship graphic.
- **Faction theming** — tint the UI accent colors based on the player's faction (blue for Terran, red for Zythian, purple for Automaton). Currently everyone sees the same cyan theme.
- Add **ship silhouettes/icons** per ship type — currently all ships use the same Rocket icon from Lucide. Even simple SVG outlines per ship class would add character.
- **Event/notification feed** — a scrolling ticker or notification bell showing recent events: "Pirate activity detected in Sector 47," "Trade prices shifted at Mining Outpost 12," "Your colony produced 50 Ore."
- Add **transition animations** between pages — a quick warp/fade effect when navigating between major sections.
- **Wiki cross-linking** — the in-game wiki is well-built with markdown articles and search, but no other page links to it. Add contextual "Learn more" links and tooltip popups that reference wiki articles (e.g., hovering over a planet type shows a wiki excerpt).

---

## Priority Ranking

| Priority | Item | Impact | Effort |
|----------|------|--------|--------|
| P0 | New player onboarding flow | Critical — players will bounce without guidance | Medium |
| P0 | Persistent location/status bar | Core spatial awareness | Low |
| P0 | Toast notifications for XP/level/rewards | Makes progression feel alive | Low |
| P0 | Replace all raw ID inputs with pickers | Fixes worst UX pattern in the app | Medium |
| P1 | Trading profit indicators & best trades | Core gameplay loop improvement | Medium |
| P1 | Combat speed control & loot breakdown | Combat satisfaction | Low |
| P1 | Ship page quick-actions & cross-linking | Reduces navigation friction | Low |
| P1 | Progressive sidebar disclosure | Reduces overwhelm | Medium |
| P1 | Consistent error handling | Professionalism, trust | Medium |
| P1 | Space phenomena visibility | Invisible hazards are unfair | Medium |
| P1 | Fix Ship Design Templates (load/apply) | Broken feature | Low |
| P2 | Colony production overview + power/workforce | Helps colony management | Medium |
| P2 | Crafting ingredient availability indicators | Reduces trial-and-error | Low |
| P2 | Achievement/milestone system | Long-term engagement | High |
| P2 | Sound effects | Immersion | Medium |
| P2 | Players in sector / social presence | Multiplayer feel | Medium |
| P2 | NPC dialogue prominence & history | Showcases unique feature | Medium |
| P2 | Messaging reply + autocomplete | Social friction removal | Low |
| P2 | Fleet discoverability | Hidden feature exposure | Low |
| P2 | Socket connection indicator | Prevents silent failures | Low |
| P3 | Faction-colored UI theming | Visual identity | Low |
| P3 | Ship silhouette icons | Visual variety | Low |
| P3 | Ship Customizer live preview | Makes customization meaningful | High |
| P3 | Mobile responsive layout | Accessibility | High |
| P3 | Keyboard shortcuts | Power user QoL | Low |
| P3 | Route planner / trade advisor | Advanced trading tool | High |
| P3 | Wiki cross-linking from game pages | Knowledge discoverability | Low |
| P3 | Basic accessibility (ARIA, focus) | Compliance, inclusion | Medium |
| P3 | Wonder construction UX | Colony endgame depth | Medium |
| P3 | Faction actionable gameplay | Faction engagement | High |
