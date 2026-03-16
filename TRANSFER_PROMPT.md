# Space Wars 3000 - Frontend Development Transfer Prompt

> **For Gemini 3.0 Pro Agent** | Generated: January 2026

---

## 🎯 Your Mission

Complete the frontend UI for Space Wars 3000, an MMO space trading/combat game. The **backend is 92% complete** with working APIs. Your job is to build the missing React components that consume these APIs.

---

## 📁 Project Location

```
d:\Projects\Space-Wars\
├── client/                    # React frontend (YOUR FOCUS)
│   ├── src/
│   │   ├── App.jsx           # Routes - add new routes here
│   │   ├── components/       # UI components
│   │   ├── services/api.js   # API wrappers - MODIFY FIRST
│   │   └── styles/index.css  # TailwindCSS + custom classes
│   └── package.json
├── server/                    # Node.js backend (working, don't modify)
├── tasks.md                   # YOUR DETAILED TASK LIST ⬅️ READ THIS
└── TRANSFER_PROMPT.md         # This file
```

---

## 🚀 Getting Started

### 1. Read the Task List

**CRITICAL**: Open and read `d:\Projects\Space-Wars\tasks.md` immediately. It contains:
- Exact file paths for every component to create
- API response examples with JSON structures
- Implementation steps and code snippets
- Styling conventions and CSS classes

### 2. Start the Dev Servers

```bash
# Terminal 1 - Backend (port 5080)
cd d:\Projects\Space-Wars\server
npm run dev

# Terminal 2 - Frontend (port 3080)
cd d:\Projects\Space-Wars\client
npm run dev
```

Access: `http://localhost:3080` (proxies API calls to backend)

### 3. Task Order (Follow This Sequence)

| Priority | Task | Creates Route |
|----------|------|---------------|
| **0** | Update `api.js` with new wrappers | N/A |
| **1** | Starmap & Navigation | `/map` |
| **2** | Ship Status Panel | `/ships` |
| **3** | Trading Interface | `/trading` |
| **4** | Ship Designer | `/designer` |
| **5** | Combat Interface | `/combat` |
| **6** | Cargo Management | Component |
| **7-9** | Polish features | Various |

---

## 🏗️ Architecture Context

### Tech Stack
- **Frontend**: React 18, Vite, TailwindCSS, Axios, React Router
- **Backend**: Node.js, Express, Sequelize, PostgreSQL
- **Auth**: JWT tokens stored in localStorage

### Existing Components (Use as Templates)
- `PlanetsPage.jsx` - Best example of page structure
- `Dashboard.jsx` - Shows ship/colony/crew data fetching
- `Layout.jsx` - Sidebar navigation (add new nav items here)

### State Management
- Uses React's `useState` and `useEffect` (no Redux)
- API wrappers in `services/api.js` handle auth headers automatically

### Styling Pattern
```jsx
// Use existing CSS classes from index.css:
<div className="card">              // Dark container
  <h2 className="card-header">      // Cyan header
    <Icon className="w-5 h-5" /> Title
  </h2>
  <button className="btn btn-primary">Action</button>
</div>
```

---

## 📡 Key API Endpoints

| Feature | Endpoint | Method |
|---------|----------|--------|
| Sectors list | `/api/sectors` | GET |
| Sector details | `/api/sectors/:id` | GET |
| Ship status | `/api/ships/:id` | GET |
| Move ship | `/api/ships/:id/move` | POST |
| Port details | `/api/ports/:id` | GET |
| Buy commodity | `/api/trade/buy` | POST |
| Sell commodity | `/api/trade/sell` | POST |
| Ship components | `/api/designer/components` | GET |
| Install component | `/api/designer/install/:shipId` | POST |
| Attack NPC | `/api/combat/attack/:shipId` | POST |
| Flee combat | `/api/combat/flee/:shipId` | POST |

**Full API details with response schemas are in `tasks.md`**

---

## ⚠️ Important Notes

### DO First
1. Read `tasks.md` completely before coding
2. Update `api.js` with missing wrappers (Task 0)
3. Test each component before moving to the next
4. Add routes to `App.jsx` and nav items to `Layout.jsx`

### DON'T
- Modify backend code (it's working)
- Change database models
- Install new packages (everything needed is installed)
- Skip the api.js updates (components will fail without them)

### Common Patterns
```jsx
// Fetching data on mount
useEffect(() => {
  const fetchData = async () => {
    try {
      const res = await someApi.getAll();
      setData(res.data);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to load');
    }
  };
  fetchData();
}, []);

// Error display
{error && (
  <div className="flex items-center gap-2 p-3 rounded-lg bg-accent-red/10 border border-accent-red/30 text-accent-red">
    <AlertCircle className="w-5 h-5" />
    <span>{error}</span>
  </div>
)}
```

---

## 🎮 Game Context

Space Wars 3000 is a multiplayer space trading game where players:
1. **Explore** a procedurally generated universe (100 sectors)
2. **Trade** commodities between ports for profit
3. **Customize** ships with modular components
4. **Combat** NPCs and other players
5. **Colonize** planets and manage crews

The backend supports all these features. You're building the UI to make them playable.

---

## ✅ Success Criteria

Your work is complete when:
- [ ] All 9 tasks in `tasks.md` are done
- [ ] Players can navigate the starmap
- [ ] Players can trade at ports
- [ ] Players can customize their ships
- [ ] Players can engage in combat
- [ ] All new routes work and have nav links
- [ ] No console errors in browser DevTools

---

## 📞 Quick Reference

| Question | Answer |
|----------|--------|
| Where are the tasks? | `d:\Projects\Space-Wars\tasks.md` |
| What port is frontend? | 3080 |
| What port is backend? | 5080 |
| Where to add routes? | `client/src/App.jsx` |
| Where to add nav items? | `client/src/components/common/Layout.jsx` |
| What icons to use? | `lucide-react` (already installed) |
| CSS classes? | See `client/src/styles/index.css` |

---

**Start by reading `tasks.md` — it has everything you need!**
