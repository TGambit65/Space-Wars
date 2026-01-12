# Space Wars 3000 - Transfer Prompt

## Project Overview

**Project:** Space Wars 3000  
**Description:** A massively multiplayer online (MMO) space trading, exploration, and combat game inspired by TradeWars 2002 with modern graphics, deep ship customization, crew systems, and extensive server admin tools.  
**Workspace:** `d:\Projects\Space-Wars`

---

## Development Documents (Read These First)

The project has detailed phase-by-phase development documents in the workspace root:

| Priority | Document | Description |
|----------|----------|-------------|
| ⭐ **FIRST** | `Space Wars 3000_ Development Plan (Final).md` | Master plan with vision, features, tech stack, and all 7 phases |
| Phase 1 | `Space Wars 3000_ Phase 1 Prompt - Core Engine & Universe.docx` | ✅ COMPLETE |
| Phase 2 | `Space Wars 3000_ Phase 2 Prompt - Trading & Economy MVP.docx` | 🔜 NEXT |
| Phase 3 | `Space Wars 3000_ Phase 3 Prompt - Ship Designer & Combat MVP.docx` | Pending |
| Phase 4 | `Space Wars 3000_ Phase 4 Prompt - Planets, Colonization & Crew MVP.docx` | Pending |
| Phase 5 | `Space Wars 3000_ Phase 5 Prompt - Advanced Features & Polish (Alpha).docx` | Pending |
| Phase 6 | `Space Wars 3000_ Phase 6 Prompt - Beta & Iteration.docx` | Pending |
| Phase 7 | `Space Wars 3000_ Phase 7 Prompt - Launch & Post-Launch.md` | Pending |

---

## Current Progress: Phase 1 COMPLETE ✅

**Phase 1 (Core Engine & Universe)** has been fully implemented with two comprehensive security reviews completed.

### Tech Stack Implemented

- **Backend:** Node.js + Express
- **Database:** SQLite (via Sequelize ORM) - easily swappable to PostgreSQL
- **Auth:** JWT with bcrypt password hashing
- **Security:** Helmet, CORS, express-rate-limit

### Server Structure (`server/src/`)

```
├── app.js                   # Express app with middleware
├── index.js                 # Server entry point with graceful shutdown
├── config/
│   ├── index.js             # Centralized config (JWT, security, ship types)
│   └── database.js          # Sequelize SQLite connection
├── models/
│   ├── index.js             # Model associations
│   ├── User.js              # User model with password hashing
│   ├── Ship.js              # Ship model with types
│   ├── Sector.js            # Sector model (universe grid)
│   └── SectorConnection.js  # Adjacency graph edges
├── controllers/
│   ├── authController.js
│   ├── shipController.js
│   └── sectorController.js
├── services/
│   ├── authService.js       # Registration, login, JWT
│   ├── shipService.js       # Movement with transactions
│   └── universeGenerator.js # 10x10 sector grid generation
├── middleware/
│   ├── auth.js              # JWT verification
│   └── errorHandler.js      # Global error handling
└── routes/
    ├── index.js             # Health check + route mounting
    ├── auth.js              # /api/auth/* with validation
    ├── ship.js              # /api/ships/* with validation
    └── sector.js            # /api/sectors/* with validation
```

### API Endpoints Implemented

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/health` | Health check with DB status |
| POST | `/api/auth/register` | User registration (creates ship) |
| POST | `/api/auth/login` | JWT authentication |
| GET | `/api/auth/profile` | Get user profile |
| GET | `/api/ships` | List user's ships |
| GET | `/api/ships/:id` | Ship status + adjacent sectors |
| POST | `/api/ships/:id/move` | Move to adjacent sector (fuel cost, transaction-safe) |
| GET | `/api/sectors` | List sectors (paginated) |
| GET | `/api/sectors/:id` | Sector details |
| GET | `/api/sectors/stats` | Universe statistics |

### Security Features Implemented

- Strong password requirements (8+ chars, upper, lower, number, special char)
- JWT with secure secret generation (validated in production)
- Rate limiting (10 attempts/15min on auth, 100-1000/15min general)
- Helmet security headers
- CORS configuration
- Input validation (express-validator)
- SQL injection prevention (Sequelize parameterized queries)
- Row-level locking on ship movement (prevents race conditions)
- Login attempt logging
- Graceful shutdown handlers
- Production error sanitization

### Database

- SQLite file at `server/data/spacewars.sqlite`
- 100 sectors generated in 10x10 grid
- Sector types: Core, Inner, Mid, Outer, Fringe, Unknown
- ~200 bidirectional connections with travel_time costs

---

## To Run the Server

```bash
cd server
npm install  # if not done
node src/index.js
```

Server runs on `http://localhost:3000`

---

## Next Step: Phase 2 (Trading & Economy MVP)

**Before starting Phase 2, please:**

1. ⭐ **Review `Space Wars 3000_ Development Plan (Final).md`** to understand the full vision
2. 📖 **Review `Space Wars 3000_ Phase 2 Prompt - Trading & Economy MVP.docx`** for detailed Phase 2 requirements
3. ✅ **Confirm your understanding and proposed approach before implementing**

### Phase 2 Typically Includes

- Trading ports/stations in sectors
- Buy/sell commodities with dynamic pricing
- Cargo system for ships
- Basic economy sinks (fuel costs, transaction fees)
- Market data endpoints

---

## Important Design Notes

| Feature | Note |
|---------|------|
| **Reducing Grind** | Project prioritizes QoL features and automation |
| **Difficulty Sliders** | Server admin tools with configurable difficulty (Phase 5+) |
| **Ship Designer** | 20+ hull types and components coming in Phase 3 |
| **Crew System** | 7 alien + 3 robot species coming in Phase 4 |
| **Future-Proofing** | All features should consider future configurable difficulty settings |

---

## Key Config Values (`server/src/config/index.js`)

The config includes ship type definitions ready for Phase 2+:

- Scout, Freighter, Fighter, Cruiser, Battleship, Miner, Explorer, Carrier
- Each has: hull, shields, fuel, cargo capacity, speed stats

---

*Generated: 2026-01-12*

