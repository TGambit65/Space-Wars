# Space Wars 3000: Frontend Development Tasks

> **CONTEXT FOR NEW AGENT**: This document contains all tasks needed to complete the frontend. The backend is ~92% complete with working APIs. You are implementing the missing UI components.

---

## 🏗️ Project Structure

```
client/
├── src/
│   ├── App.jsx                    # Routes - ADD NEW ROUTES HERE
│   ├── main.jsx                   # Entry point (don't modify)
│   ├── components/
│   │   ├── common/                # Shared components
│   │   │   ├── Dashboard.jsx      # Home page
│   │   │   ├── Layout.jsx         # Sidebar nav - ADD NAV ITEMS HERE
│   │   │   └── Login.jsx          # Auth
│   │   ├── colonies/              # Colony management (done)
│   │   ├── crew/                  # Crew management (done)
│   │   ├── planets/               # Planet exploration (done)
│   │   ├── navigation/            # CREATE THIS FOLDER
│   │   ├── trading/               # CREATE THIS FOLDER
│   │   ├── combat/                # CREATE THIS FOLDER
│   │   └── ship/                  # CREATE THIS FOLDER
│   ├── services/
│   │   └── api.js                 # API wrappers - MODIFY THIS FIRST
│   └── styles/
│       └── index.css              # TailwindCSS + custom classes
```

---

## 🎨 Styling Conventions

Use these existing CSS classes defined in `index.css`:

| Class | Usage |
|-------|-------|
| `card` | Container with dark bg, border, padding |
| `card-header` | Cyan text header with icon gap |
| `btn btn-primary` | Cyan button (main action) |
| `btn btn-secondary` | Gray button (secondary) |
| `btn btn-danger` | Red button (destructive) |
| `btn btn-success` | Green button (positive) |
| `input` | Form input styling |
| `badge-cyan/green/orange/red` | Status badges |
| `stat-value` / `stat-label` | Stats display |
| `progress-bar` / `progress-fill` | Progress bars |

**Color tokens**: `accent-cyan`, `accent-green`, `accent-orange`, `accent-red`, `accent-purple`, `space-500` through `space-900`

**Icons**: Use `lucide-react` (already installed). Example: `import { Rocket, Map } from 'lucide-react'`

---

## ⚡ TASK 0: Prerequisites - Update api.js

**File**: `client/src/services/api.js`

**What to do**: Add these new API wrapper objects to the existing file:

```javascript
// === ADD AFTER LINE 88 (after the ports object) ===

// Combat
export const combat = {
  attack: (shipId, npcId) => api.post(`/combat/attack/${shipId}`, { npc_id: npcId }),
  flee: (shipId) => api.post(`/combat/flee/${shipId}`),
  getHistory: () => api.get('/combat/history'),
  getLog: (logId) => api.get(`/combat/log/${logId}`),
};

// Ship Designer
export const designer = {
  getComponents: () => api.get('/designer/components'),
  getDesign: (shipId) => api.get(`/designer/design/${shipId}`),
  install: (shipId, componentId) => api.post(`/designer/install/${shipId}`, { component_id: componentId }),
  uninstall: (shipId, componentId) => api.delete(`/designer/uninstall/${shipId}/${componentId}`),
  getRepairEstimate: (shipId) => api.get(`/designer/repair/${shipId}`),
  repairHull: (shipId) => api.post(`/designer/repair/${shipId}/hull`),
  repairComponent: (shipId, componentId) => api.post(`/designer/repair/${shipId}/component/${componentId}`),
};

// NPCs
export const npcs = {
  getInSector: (sectorId) => api.get(`/npcs/sector/${sectorId}`),
  getById: (npcId) => api.get(`/npcs/${npcId}`),
};
```

**Also add to EXISTING objects**:

```javascript
// Add to 'sectors' object:
getAll: (params) => api.get('/sectors', { params }),
getStats: () => api.get('/sectors/stats'),

// Add to 'ports' object:
getAll: (params) => api.get('/ports', { params }),

// Add to 'trade' object:
getCommodities: () => api.get('/trade/commodities'),
getMarket: (commodityId) => api.get(`/trade/market/${commodityId}`),
getMarketSummary: () => api.get('/trade/market'),
getHistory: (params) => api.get('/trade/history', { params }),
refuel: (shipId, portId, amount) => api.post(`/trade/refuel/${shipId}`, { port_id: portId, amount }),
```

---

## 🔴 TASK 1: Starmap & Navigation (CRITICAL)

### 1.1 Create SectorMap.jsx

**Create file**: `client/src/components/navigation/SectorMap.jsx`

**Backend API Response** (GET /api/sectors):
```json
{
  "success": true,
  "data": {
    "sectors": [
      {
        "sector_id": "uuid",
        "name": "Alpha Centauri",
        "type": "nebula",
        "x_coord": 5,
        "y_coord": 3,
        "is_discovered": true,
        "danger_level": 2
      }
    ],
    "pagination": { "page": 1, "limit": 100, "total": 100 }
  }
}
```

**Implementation steps**:
1. Create folder: `client/src/components/navigation/`
2. Fetch sectors with `sectors.getAll()` on mount
3. Render a grid (recommend 10x10 or 15x15)
4. Each cell shows sector name/type or empty if undiscovered
5. Highlight current ship location with cyan border
6. Show connections between adjacent sectors as lines
7. Click handler calls `ships.move(shipId, targetSectorId)`

**Key imports**:
```javascript
import { useState, useEffect } from 'react';
import { sectors, ships } from '../../services/api';
import { Map, Navigation, AlertTriangle } from 'lucide-react';
```

**Suggested grid cell styling**:
```javascript
<div className={`w-16 h-16 border border-space-600 rounded flex items-center justify-center text-xs
  ${isCurrentLocation ? 'border-accent-cyan bg-accent-cyan/20' : ''}
  ${sector.danger_level > 3 ? 'bg-accent-red/10' : ''}
  hover:bg-space-600 cursor-pointer`}>
```

### 1.2 Add Route to App.jsx

**File**: `client/src/App.jsx`

Add import:
```javascript
import SectorMap from './components/navigation/SectorMap';
```

Add route (line ~55):
```javascript
<Route path="/map" element={<SectorMap user={user} />} />
```

### 1.3 Add Nav Item to Layout.jsx

**File**: `client/src/components/common/Layout.jsx`

Add to `navItems` array (after line 8):
```javascript
{ path: '/map', icon: Map, label: 'Star Map' },
```

Import Map icon:
```javascript
import { Home, Globe, Building2, Users, LogOut, Wallet, Rocket, Map } from 'lucide-react';
```

---

## 🔴 TASK 2: Ship Status Panel (CRITICAL)

### 2.1 Create ShipPanel.jsx

**Create file**: `client/src/components/ship/ShipPanel.jsx`

**Backend API Response** (GET /api/ships/:id):
```json
{
  "success": true,
  "data": {
    "ship_id": "uuid",
    "name": "USS Enterprise",
    "ship_type": "MERCHANT_CRUISER",
    "current_hull": 120,
    "max_hull": 150,
    "current_shields": 50,
    "max_shields": 75,
    "current_fuel": 80,
    "max_fuel": 150,
    "current_sector": { "sector_id": "uuid", "name": "Trading Hub Alpha" },
    "cargo_used": 45,
    "cargo_capacity": 200
  }
}
```

**Implementation**:
1. Create folder: `client/src/components/ship/`
2. Fetch ship data with `ships.getById(shipId)` on mount
3. Display progress bars for hull, shields, fuel
4. Show current sector name
5. Add action buttons: "Navigate", "Trade", "Scan"

**Progress bar example**:
```javascript
<div className="space-y-1">
  <div className="flex justify-between text-sm">
    <span className="text-gray-400">Hull</span>
    <span className="text-white">{ship.current_hull}/{ship.max_hull}</span>
  </div>
  <div className="progress-bar">
    <div 
      className="progress-fill bg-accent-green" 
      style={{ width: `${(ship.current_hull / ship.max_hull) * 100}%` }}
    />
  </div>
</div>
```

### 2.2 Add Route and Nav

Same pattern as Task 1: add `/ships` route and nav item with `Rocket` icon.

---

## 🔴 TASK 3: Trading Interface (CRITICAL)

### 3.1 Create TradingPage.jsx

**Create file**: `client/src/components/trading/TradingPage.jsx`

**Backend API Response** (GET /api/ports/:id):
```json
{
  "success": true,
  "data": {
    "port_id": "uuid",
    "name": "Trading Hub Alpha",
    "type": "trading_hub",
    "commodities": [
      {
        "commodity_id": "uuid",
        "name": "Fuel",
        "buy_price": 45,
        "sell_price": 38,
        "quantity": 500,
        "category": "Essential"
      }
    ]
  }
}
```

**Implementation**:
1. Create folder: `client/src/components/trading/`
2. Fetch port data, ship cargo, and player credits
3. Display commodities table with buy/sell columns
4. Add quantity input with +/- buttons and "Max" button
5. Buy button calls `trade.buy(shipId, portId, commodityId, quantity)`
6. Sell button calls `trade.sell(shipId, portId, commodityId, quantity)`
7. Show running total cost/revenue before confirming

**Trade button example**:
```javascript
<button 
  onClick={() => handleBuy(commodity.commodity_id, quantity)}
  disabled={player.credits < commodity.buy_price * quantity}
  className="btn btn-primary"
>
  Buy ({(commodity.buy_price * quantity).toLocaleString()} cr)
</button>
```

### 3.2 Add Route and Nav

Add `/trading` route with `ShoppingCart` icon from lucide-react.

---

## 🟡 TASK 4: Ship Designer UI

### 4.1 Create ShipDesigner.jsx

**Create file**: `client/src/components/ship/ShipDesigner.jsx`

**Backend API Response** (GET /api/designer/design/:shipId):
```json
{
  "success": true,
  "data": {
    "ship": { "ship_id": "uuid", "name": "USS Enterprise", "slots": 5 },
    "components": [
      {
        "ship_component_id": "uuid",
        "component": {
          "name": "Laser Cannon Mk1",
          "type": "weapon",
          "power_usage": 10,
          "stats": { "damage": 15 }
        },
        "condition": 85
      }
    ],
    "stats": {
      "total_damage": 15,
      "total_shields": 50,
      "power_used": 10,
      "power_max": 100
    }
  }
}
```

**Implementation**:
1. Show ship with installed components
2. Fetch available components with `designer.getComponents()`
3. Drag-and-drop or click to install/uninstall
4. Show real-time stat changes
5. Display power budget bar

---

## 🟡 TASK 5: Combat Interface

### 5.1 Create CombatPage.jsx

**Create file**: `client/src/components/combat/CombatPage.jsx`

**Backend API Response** (POST /api/combat/attack/:shipId):
```json
{
  "success": true,
  "data": {
    "combat_log_id": "uuid",
    "result": "victory",
    "rounds": [
      { "round": 1, "attacker_damage": 15, "defender_damage": 10, "attacker_hull": 120, "defender_hull": 85 },
      { "round": 2, "attacker_damage": 18, "defender_damage": 8, "attacker_hull": 112, "defender_hull": 67 }
    ],
    "loot": { "credits": 500, "commodities": [{ "name": "Fuel", "quantity": 10 }] }
  }
}
```

**Implementation**:
1. Show player ship vs NPC stats side-by-side
2. Animate rounds with delay (setTimeout)
3. Display damage numbers and health bar changes
4. Show "Flee" button that calls `combat.flee(shipId)`
5. Display loot modal on victory

---

## 🟡 TASK 6: Cargo Management

### 6.1 Create CargoHold.jsx

**Create file**: `client/src/components/ship/CargoHold.jsx`

**Backend API Response** (GET /api/trade/cargo/:shipId):
```json
{
  "success": true,
  "data": {
    "cargo": [
      { "commodity": { "name": "Fuel", "volume": 1 }, "quantity": 50 },
      { "commodity": { "name": "Ore", "volume": 3 }, "quantity": 20 }
    ],
    "capacity_used": 110,
    "capacity_max": 200
  }
}
```

**Implementation**:
1. List all cargo with volume calculations
2. Show capacity bar
3. Add "Jettison" button per item (if needed)

---

## 🟢 TASKS 7-9: Medium Priority

### 7. Repair Station UI
- File: `client/src/components/ship/RepairPage.jsx`
- Use `designer.getRepairEstimate(shipId)`
- Show hull + component damage with costs
- "Repair All" button

### 8. Combat History
- File: `client/src/components/combat/CombatHistory.jsx`
- Use `combat.getHistory()` and `combat.getLog(logId)`
- List view with expandable details

### 9. NPC Display
- Integrate into SectorMap or create `NPCList.jsx`
- Use `npcs.getInSector(sectorId)`
- Show NPC type, ship, threat level
- "Attack" button triggers combat

---

## ✅ Verification Checklist

After completing each task:
- [ ] Component renders without errors
- [ ] API calls work (check DevTools Network tab)
- [ ] Navigation works (route added, nav item added)
- [ ] Responsive on mobile (Tailwind responsive classes)
- [ ] Error states handled (try/catch with error display)
- [ ] Loading states shown (spinner while fetching)

---

## 🔴 TASK 10: Admin Panel & Game Setup (CRITICAL)

### 10.1 Admin Setup Flow
- First-time setup wizard when no admin exists (or on fresh DB)
- Admin sets: game name, difficulty level (1-5), universe size, NPC density, economy speed
- Difficulty affects: NPC aggression multipliers, spawn rates, loot scaling, combat stat multipliers
- Store settings in a `GameSettings` model or config table

### 10.2 Admin Dashboard (`/admin`)
- Protected route (admin-only via `adminMiddleware`)
- Universe management: regenerate, view stats, adjust parameters
- Player management: list players, ban/unban, reset accounts
- NPC management: adjust spawn rates, difficulty scaling, view NPC population
- Economy controls: price multipliers, trade volume adjustments
- Game settings: modify difficulty and scaling factors at runtime

### 10.3 Backend Requirements
- `GameSettings` model (or key-value config table) persisted to DB
- `GET/PUT /api/admin/settings` endpoints
- Difficulty multiplier applied to NPC stats, aggression, loot, spawn rates
- Settings loaded at server startup, cached in memory, refreshed on admin update

---

## 🟡 TASK 11: AI NPC Architecture — Model-Agnostic Decision Service

### 11.1 Overview
Two distinct AI NPC systems running on a shared inference server (single 24GB GPU):
- **Tactical AI (8B model)**: Combat decisions, movement, patrol routes — structured JSON output
- **Interactive AI (14B model)**: Trading dialogue, player questions, rumors — conversational output
- Both fronted by scripting layers (behavior trees + dialogue trees) that handle 70-80% of cases without any AI call
- Fallback to current RNG/scripted logic if inference server is unavailable

### 11.2 Tactical NPC Service (`server/src/services/npcAIService.js`)
- **Behavior tree first**: Pure code handles obvious decisions (low hull → flee, no threats → patrol, target almost dead → finish)
- **AI fallback for ambiguity**: Only calls model when situation is genuinely complex (multiple threats, unclear advantage, unfamiliar sector)
- **Structured JSON output** with constrained decoding — model picks from valid actions enum, never freeform
- **Batch processing**: Collect all NPCs needing AI decisions per tick, send as one batched prompt (5 NPCs per call)
- **Tick rates**: Combat NPCs every 15s, patrol/movement every 60s
- **Only active NPCs**: Skip AI for NPCs with no players in sector or adjacent sectors
- **Decision caching**: NPC traveling to a destination reuses same decision until arrival
- Difficulty scaling: Low = AI called 10% of ambiguous cases, High = AI called 100%

### 11.3 Interactive NPC Service (`server/src/services/npcDialogueService.js`)
- **Dialogue tree first**: Scripted responses for common interactions (greetings, buy/sell UI, standard questions)
- **Template system**: Pre-written dialogue with AI-generated variable fills (personality quips, contextual rumors)
- **AI for free-text only**: Model only called when player types a custom message that doesn't match scripted paths
- **Semantic response cache**: Common questions (directions, prices, lore) cached after first AI generation, reused for all players
- **Context injection per call** (~350 tokens): NPC personality, port inventory, player history, recent events
- **Personality profiles**: Generated once on NPC spawn, stored in DB, reused in every prompt
- NPC types with dialogue: TRADER (buy/sell negotiation, rumors), PATROL (warnings, bounty info), BOUNTY_HUNTER (target info, threats)

### 11.4 Inference Server Architecture
- **Runtime**: vLLM or llama.cpp server with OpenAI-compatible API
- **Hardware target**: Single 24GB GPU (RTX 3090/4090, L4, A5000)
- **Models loaded**: 8B (Q4, ~5GB) + 14B (Q4, ~9GB) = ~14GB VRAM, ~10GB headroom for KV cache
- **Provider abstraction**: `server/src/services/aiProviderService.js` wraps inference calls behind a common interface
  - Supports: local vLLM, local llama.cpp, OpenAI-compatible API, Anthropic API, DeepSeek API
  - Config selects provider + model per NPC type (tactical vs interactive)
  - Enables starting with cloud API during development, switching to self-hosted for production
- **Health checks**: Service monitors inference server, auto-falls back to scripted behavior on failure
- **Throughput budget**: ~50-80 calls/min at 500 players (after scripting layer), well within single-GPU capacity

### 11.5 Scripting Layers (Token Cost Reduction)
- **Behavior trees** (`server/src/services/npcBehaviorTree.js`): Standard game AI decision trees for tactical NPCs
  - Handles: flee thresholds, obvious aggression, idle patrol routes, trade route following
  - Estimated coverage: 70-80% of all tactical decisions
- **Dialogue trees** (`server/src/services/npcDialogueTree.js`): Scripted conversation flows for interactive NPCs
  - Handles: greetings, trade UI triggers, FAQ responses, farewell
  - Estimated coverage: 75-85% of all player interactions
- **Response cache** (`server/src/services/aiResponseCache.js`): LRU cache with semantic similarity matching
  - Cache key: NPC type + intent category + context hash
  - TTL: 5-15 min for dynamic info (prices), 24hr for static (lore, directions)
  - Estimated additional reduction: 30-50% of remaining AI calls

### 11.6 Cost Estimates at 500 Concurrent Players (24/7)
```
With scripting + caching:
  ~50-80 AI calls/min total
  Self-hosted (24GB GPU): $50-100/month (electricity + hardware amortization)
  DeepSeek V3 API:        ~$30-40/day (~$1,000/month)
  Haiku API:              ~$120-160/day (~$4,500/month)
```

### 11.7 Development Phases
1. Build provider abstraction + behavior trees + dialogue trees (no AI yet, pure scripting)
2. Wire up cloud API (DeepSeek or Haiku) for the AI fallback paths
3. Test and tune: adjust behavior tree coverage, cache hit rates, prompt quality
4. Set up local inference server (vLLM/llama.cpp + models) for production
5. Optional: fine-tune 8B on logged tactical decisions for better quality

### 11.8 Hardware Options
- **Budget ($500-1200)**: Dual Tesla P40 (48GB total) in used Dell R720/R730
  - Pros: 48GB VRAM for ~$800, can run 8B + 32B, massive VRAM-per-dollar
  - Cons: Pascal arch (2016), ~3x slower than modern GPUs, REQUIRES heavy scripting layers
  - P40 speeds: ~20-25 tok/s (8B), ~8-12 tok/s (32B), ~5-6 tok/s (70B — too slow)
  - Scripting reduces AI calls to 15-40/min, making P40 throughput viable for 500 players
- **Mid ($1,500)**: Single RTX 3090 (24GB)
  - 3x faster inference, 24GB limits to 8B + 14B, scripting is optimization not necessity
- **High ($2,200)**: Single RTX 4090 (24GB)
  - Fastest single-card option, same 24GB/model constraints as 3090

### 11.9 Model Recommendations
- **Tactical (8B)**: Llama 3.1 8B, Mistral 7B, or Qwen 2.5 7B — any are fine for structured JSON
- **Interactive (14B, 24GB setup)**: Qwen 2.5 14B or Mistral Nemo 12B — good conversational quality
- **Interactive (32B, 48GB setup)**: Qwen 2.5 32B or Command-R 35B — significantly better dialogue, personality, nuance
- **70B**: Fits on 48GB but too slow on P40s for real-time serving. Not recommended.
- **Fine-tuning target**: After collecting 10-50k decision logs, fine-tune the 8B on game-specific tactical data

---

## 📊 Progress Tracking

| Task | Status | Notes |
|------|--------|-------|
| 0. api.js updates | [ ] | Do this FIRST |
| 1. Starmap & Navigation | [ ] | Creates `/map` route |
| 2. Ship Status Panel | [ ] | Creates `/ships` route |
| 3. Trading Interface | [ ] | Creates `/trading` route |
| 4. Ship Designer | [ ] | Creates `/designer` route |
| 5. Combat Interface | [ ] | Creates `/combat` route |
| 6. Cargo Management | [ ] | Component for ship page |
| 7. Repair Station | [ ] | Creates `/repair` route |
| 8. Combat History | [ ] | Component for combat page |
| 9. NPC Display | [ ] | Integrated component |
| 10. Admin Panel & Setup | [ ] | Admin dashboard + difficulty settings |
| 11. AI NPC Architecture | [ ] | Dual-model NPC system with scripting layers |
