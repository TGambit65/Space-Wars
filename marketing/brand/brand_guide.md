# Space Wars 3000 — Brand Guide

A short, opinionated reference for anyone making something that wears the
Space Wars 3000 name. Keep it cinematic, keep it confident, keep it cyan.

---

## 1. Brand essence

| | |
|---|---|
| **Name** | Space Wars 3000 |
| **Tagline** | Explore. Trade. Conquer. |
| **One-liner** | A multiplayer space trading and combat game where every wreck you leave behind is a story someone else can loot. |
| **Audience** | Indie/strategy/space-sim players, ex-EVE/Elite/X3 fans, browser-MMO and roguelike crowds. |
| **Tone of voice** | Cinematic and confident, never campy. Short sentences. Verbs in the imperative. Trust the player. |

### Voice in three checks
- ✅ "Lock the target. Take the shot. Walk the wreck."
- ✅ "1,200 sectors. One galactic economy. Your move."
- ❌ "Welcome to an exciting adventure full of fun activities!"

---

## 2. Logo system

Three approved variants live in this folder:

| File | Use it when |
|---|---|
| `logo_full_lockup.png` | Default. Web headers, social posts, press kit cover. |
| `logo_icon_mark.png` | Square contexts: app icon, favicon, avatar, OG corner badge. |
| `logo_mono_white.png` | Single-color print, dark-only embeds, partner co-marks. |

### Clear space
Reserve clear space equal to the height of the **emblem ring** on every side.
Never let other UI, text, or imagery enter that zone.

### Don'ts
- Don't recolor the emblem outside the cyan/navy palette.
- Don't stretch, skew, or add drop shadows.
- Don't place the full lockup on busy imagery — use the icon mark or a
  solid-color plate instead.

---

## 3. Color palette

The palette is intentionally narrow: deep space + one hot accent.

| Token | Hex | RGB | Usage |
|---|---|---|---|
| **Void Navy** | `#0A0E1F` | 10, 14, 31 | Page background, dark plates |
| **Hull Charcoal** | `#141B33` | 20, 27, 51 | Cards, panels, secondary surfaces |
| **Console Cyan** | `#5BE3FF` | 91, 227, 255 | Primary accent, CTAs, headlines |
| **Plasma Teal** | `#1FBFD8` | 31, 191, 216 | Gradient stop, hover state |
| **Warning Orange** | `#FFA94D` | 255, 169, 77 | Combat alerts, derelict loot, danger |
| **Bone White** | `#F2F5FA` | 242, 245, 250 | Body text on dark |
| **Asteroid Grey** | `#7A8499` | 122, 132, 153 | Secondary text, dividers |

**Signature gradient (CTAs, hero)**: `linear-gradient(90deg, #1FBFD8 0%, #5BE3FF 100%)`
on a `#0A0E1F` plate.

---

## 4. Typography

| Role | Family | Weights | Notes |
|---|---|---|---|
| Display / headlines | **Orbitron** | 700, 900 | All-caps for hero lines, sentence-case for H2/H3 |
| UI / body | **Inter** (or Roboto fallback) | 400, 500, 700 | Tight letter-spacing on UI labels |
| Mono / data | **JetBrains Mono** | 400, 500 | Credits, coordinates, leaderboards |

Both Orbitron and Inter are already loaded by the existing site via Google
Fonts — keep using those CDN links so you don't ship duplicate webfonts.

---

## 5. Iconography & motion

- Iconography: thin-stroke line icons, 1.5px weight, slightly geometric.
  Avoid glyph icons that look generic — use Font Awesome sparingly, prefer
  custom SVG for hero feature blocks.
- Motion: easing `cubic-bezier(.2,.8,.2,1)`, 200–320ms for UI transitions.
  For cinematic moments (hero loops, trailer cuts), use slower 800–1200ms
  warp/parallax movements.

---

## 6. Photography & key art

- Always cinematic, never illustrative-cartoon.
- Deep navy negative space dominates; cyan and orange are accents only.
- No legible text inside generated/key art — copy is overlaid in HTML/CSS.
- Approved hero asset: `marketing/social/key_art_hero.png`.

---

## 7. Quick-reference CSS variables

Drop these into any new page to stay on-brand:

```css
:root {
  --sw-navy:        #0A0E1F;
  --sw-charcoal:    #141B33;
  --sw-cyan:        #5BE3FF;
  --sw-teal:        #1FBFD8;
  --sw-orange:      #FFA94D;
  --sw-bone:        #F2F5FA;
  --sw-grey:        #7A8499;
  --sw-cta:         linear-gradient(90deg, #1FBFD8 0%, #5BE3FF 100%);
  --sw-font-display:'Orbitron', system-ui, sans-serif;
  --sw-font-body:   'Inter', 'Roboto', system-ui, sans-serif;
  --sw-font-mono:   'JetBrains Mono', ui-monospace, monospace;
}
```
