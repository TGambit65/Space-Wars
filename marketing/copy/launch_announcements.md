# Space Wars 3000 — Launch Copy Pack

All copy is plug-and-play. Headlines are written for the **Explore. Trade.
Conquer.** positioning. Replace `[LAUNCH_URL]` with your final domain.

---

## 1. The 1-line elevator pitch

> Space Wars 3000 is a real-time multiplayer space trading and combat game
> where every NPC you blow up leaves a boardable wreck — and every other
> player can come scavenge it.

## 2. The 25-word version (for app store / Product Hunt subtitle)

> Real-time multiplayer space MMO. Trade across 1,200 sectors, fight in a
> 10 Hz tactical combat engine, and walk the wrecks you leave behind.

## 3. The 100-word "About" (press kit / Wikipedia / store page)

> Space Wars 3000 is a browser-based multiplayer space trading and combat
> game built around a single, unified real-time combat engine. Players
> explore a persistent galaxy of 1,200 sectors, trade commodities through
> a live economy of 800+ ports, design custom ships, and fight other
> captains in PvP duels, arenas, and bounty contracts. Every NPC kill
> drops a fully-explorable derelict — you can board it on foot, walk its
> decks, and salvage credits, cargo, and components. PvE, PvP, and
> spectator combat all share one ruleset. No twitch-only skill walls.
> Every fight is a story.

---

## 4. Email — launch announcement

**Subject lines (pick one, A/B the rest):**
1. Space Wars 3000 is live. Your fleet is waiting.
2. The galaxy just opened. Come take a sector.
3. We launched. The first wrecks are already drifting.

**Body:**

> Hey {first_name},
>
> Space Wars 3000 is live today.
>
> It's a real-time multiplayer space trading and combat game we've been
> building in the open. 1,200 sectors. 33 commodities moving through 800+
> ports. A 10 Hz tactical combat engine that handles PvE, duels, arena
> matches, and bounty contracts under one ruleset.
>
> The thing we're proudest of: when you destroy an enemy ship, it leaves
> a real, walkable wreck. You can board it, explore the decks, and loot
> what's left. So can anyone else who shows up in time.
>
> First 100 captains who log in get a starter loadout on the house.
>
> → Play now: [LAUNCH_URL]
>
> See you in the black,
> The Space Wars 3000 team

---

## 5. Discord — launch announcement (with @everyone)

```
🚀  **SPACE WARS 3000 IS LIVE**  🚀

The galaxy is open. 1,200 sectors. One economy. One real-time combat
engine for PvE, duels, arena, and bounties.

✨ New this launch:
   • Walkable derelict wrecks — kill it, board it, loot it
   • Bounty board, arena lobby, and live spectator view
   • Recover-on-reconnect autopilot so a dropped session won't kill you

Jump in → [LAUNCH_URL]
First 100 captains get a starter loadout. Tag a friend you want flying
wing. ⬇️
```

---

## 6. Twitter / X — launch thread

**Tweet 1 (hook + key art)**
> We just launched Space Wars 3000.
> Real-time multiplayer space trading + combat, in your browser.
> 1,200 sectors. One galactic economy. Your move.
> 🌌 [LAUNCH_URL]

**Tweet 2**
> One unified 10 Hz combat engine handles PvE, PvP duels, arena matches,
> bounty contracts, and live spectating.
> No separate rulesets. No twitch-only walls. Every fight is a story.

**Tweet 3 (the differentiator)**
> Every NPC you destroy leaves a real walkable wreck.
> Board it. Walk the decks on foot. Loot what's left before someone else
> shows up.
> [GIF or screenshot of derelict boarding]

**Tweet 4 (CTA)**
> Free to play, runs in your browser, no install.
> First 100 captains who log in today get a starter loadout.
> 👉 [LAUNCH_URL]

---

## 7. Product Hunt — tagline + description

**Name:** Space Wars 3000
**Tagline:** Real-time multiplayer space MMO with walkable wrecks
**Description:**

> A browser-based multiplayer space trading and combat game built around
> a single real-time combat engine. Trade across 1,200 sectors, fight
> in PvP duels, arenas, or bounty contracts — and board the wrecks you
> leave behind to scavenge cargo and components on foot.
>
> What's different:
> • One unified 10 Hz tactical combat engine for PvE, PvP, and arena
> • Every NPC kill becomes a walkable derelict ship you can board
> • Live spectator view + bounty board + arena lobby out of the box
> • Reconnect-safe: dropped sessions auto-pilot until you're back
>
> Free, browser-based, no install.

---

## 8. Hacker News — Show HN post

**Title:** Show HN: Space Wars 3000 – browser-based multiplayer space MMO

**Body:**

> Hi HN — I'm launching Space Wars 3000, a real-time multiplayer space
> trading and combat game that runs entirely in the browser.
>
> The technical bits HN tends to enjoy:
>
> • One Node.js/Socket.io server runs a fixed-step 10 Hz combat tick that
>   covers PvE, PvP duels, arena matches, and bounty contracts under one
>   ruleset. State is checkpointed every ~5 s so a server restart resumes
>   active fights with disconnected players placed on autopilot.
> • The economy is a live simulation across 1,200 sectors, 33 commodities,
>   and 800+ ports — supply/demand actually moves prices.
> • PixiJS for the tactical map, a small custom 2D engine for ship-interior
>   boarding (so killed NPCs leave real walkable wrecks you can loot).
> • React + Vite frontend, Sequelize/PostgreSQL backend.
>
> It's free, no install, runs in any modern browser.
>
> → [LAUNCH_URL]
>
> Happy to answer anything about the architecture, the combat reconciliation
> model, or how we keep PvE/PvP fairness with one ruleset.

---

## 9. App store / itch.io short description

> Trade across 1,200 sectors. Fight in real-time. Board the wrecks you
> leave behind. Free, browser-based, multiplayer.

---

## 10. SEO meta (drop into `<head>`)

```html
<title>Space Wars 3000 — Multiplayer Space Trading &amp; Combat MMO</title>
<meta name="description" content="Real-time multiplayer space trading and combat game. Explore 1,200 sectors, fight PvP duels and bounty contracts, and board the wrecks you leave behind. Free, browser-based, no install.">
<meta property="og:title" content="Space Wars 3000">
<meta property="og:description" content="Explore. Trade. Conquer. A browser-based multiplayer space MMO with walkable wrecks.">
<meta property="og:image" content="[LAUNCH_URL]/marketing/social/og_card.png">
<meta property="og:type" content="website">
<meta name="twitter:card" content="summary_large_image">
```
