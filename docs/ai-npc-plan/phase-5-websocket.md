# Phase 5: WebSocket Layer (Socket.io)

**Goal**: Real-time events for NPC actions, combat updates, and audio streaming for voice chat.
**Dependencies**: Phase 4 (tick system emits events).
**New dependencies**: `socket.io` (server), `socket.io-client` (client)
**Estimated files**: 3 new, 4 modified

---

## Task 5.1: Install Socket.io Dependencies

- [x] Server: `cd server && npm install socket.io`
- [x] Client: `cd client && npm install socket.io-client`

## Task 5.2: Socket Service (Server)

**File**: `server/src/services/socketService.js` (NEW)

- [x] Module state: `let io = null;`
- [x] Implement `initialize(httpServer)`:
  - Create Socket.io instance:
    ```javascript
    io = new Server(httpServer, {
      cors: { origin: ['http://localhost:3080'], methods: ['GET', 'POST'], credentials: true },
      maxHttpBufferSize: 5e6  // 5MB for audio binary frames
    });
    ```
  - Add auth middleware:
    ```javascript
    io.use((socket, next) => {
      const token = socket.handshake.auth.token;
      if (!token) return next(new Error('Authentication required'));
      try {
        const decoded = jwt.verify(token, config.jwt.secret);
        socket.userId = decoded.user_id;
        socket.user = decoded;
        next();
      } catch (err) {
        next(new Error('Invalid token'));
      }
    });
    ```
  - Handle connections:
    ```javascript
    io.on('connection', (socket) => {
      // Join user-specific room
      socket.join(`user:${socket.userId}`);

      // Join sector room (client sends initial sector)
      socket.on('join_sector', ({ sector_id }) => {
        // Leave all sector rooms first
        socket.rooms.forEach(room => {
          if (room.startsWith('sector:')) socket.leave(room);
        });
        socket.join(`sector:${sector_id}`);
        socket.currentSectorId = sector_id;
      });

      socket.on('change_sector', ({ sector_id }) => {
        if (socket.currentSectorId) socket.leave(`sector:${socket.currentSectorId}`);
        socket.join(`sector:${sector_id}`);
        socket.currentSectorId = sector_id;
      });

      socket.on('disconnect', () => { /* cleanup */ });
    });
    ```
- [x] Implement `getIO()` — returns io instance (used by tick system, action executor)
- [x] Implement `emitToSector(sectorId, event, data)`:
  - `io.to('sector:' + sectorId).emit(event, data)`
- [x] Implement `emitToUser(userId, event, data)`:
  - `io.to('user:' + userId).emit(event, data)`
- [x] Implement `getConnectedCount()` — return `io.engine.clientsCount`
- [x] Implement `getUsersInSector(sectorId)` — return user IDs in sector room
- [x] Export all functions

## Task 5.3: Wire Socket.io into Server Startup

**File**: `server/src/index.js` (MODIFY)

- [x] Import socketService and `http` module
- [x] Change server creation from `app.listen()` to:
  ```javascript
  const http = require('http');
  const httpServer = http.createServer(app);
  socketService.initialize(httpServer);
  server = httpServer.listen(config.port, () => { ... });
  ```
- [x] Socket init must happen BEFORE `tickService.startTicks()` (ticks emit to sockets)

## Task 5.4: Add WebSocket Proxy to Vite Config

**File**: `client/vite.config.js` (MODIFY)

- [x] Add Socket.io proxy alongside existing API proxy:
  ```javascript
  proxy: {
    '/api': { target: 'http://localhost:5080', changeOrigin: true },
    '/socket.io': { target: 'http://localhost:5080', ws: true, changeOrigin: true }
  }
  ```

## Task 5.5: useSocket React Hook

**File**: `client/src/hooks/useSocket.js` (NEW)

- [x] Import `io` from `socket.io-client`
- [x] Create hook:
  ```javascript
  const useSocket = () => {
    const [socket, setSocket] = useState(null);
    const [connected, setConnected] = useState(false);

    useEffect(() => {
      const token = localStorage.getItem('token');
      if (!token) return;

      const newSocket = io('/', { auth: { token }, transports: ['websocket', 'polling'] });

      newSocket.on('connect', () => setConnected(true));
      newSocket.on('disconnect', () => setConnected(false));
      newSocket.on('connect_error', (err) => console.error('Socket auth error:', err.message));

      setSocket(newSocket);
      return () => newSocket.disconnect();
    }, []);

    const joinSector = (sectorId) => socket?.emit('join_sector', { sector_id: sectorId });
    const changeSector = (sectorId) => socket?.emit('change_sector', { sector_id: sectorId });

    return { socket, connected, joinSector, changeSector };
  };
  ```
- [x] Export hook

## Task 5.6: useNPCEvents React Hook

**File**: `client/src/hooks/useNPCEvents.js` (NEW)

- [x] Takes `socket` as parameter
- [x] Manages state:
  ```javascript
  const [sectorNPCs, setSectorNPCs] = useState([]);
  const [pendingHails, setPendingHails] = useState([]);
  const [combatAlert, setCombatAlert] = useState(null);
  ```
- [x] Listen for events:
  - `npc:entered_sector` → add to sectorNPCs
  - `npc:left_sector` → remove from sectorNPCs
  - `npc:destroyed` → remove from sectorNPCs
  - `npc:state_change` → update NPC state in sectorNPCs
  - `npc:hails_player` → add to pendingHails
  - `npc:attacks_player` → set combatAlert
  - `npc:dialogue` → forwarded to chat panel via callback
  - `combat:round` → forwarded to combat UI via callback
  - `combat:ended` → clear combatAlert, forward to combat UI
- [x] `dismissHail(npcId)` — remove from pendingHails
- [x] `clearCombatAlert()` — clear combatAlert
- [x] Return all state + handlers

## Task 5.7: Update Tick System and Action Executor to Use Sockets

**Files**: `server/src/services/tickService.js`, `server/src/services/npcActionExecutor.js` (MODIFY — from Phase 4)

- [x] In tickService: import socketService, pass `socketService` to action executor calls
- [x] In npcActionExecutor.executeAction():
  - On NPC move: `socketService.emitToSector(oldSectorId, 'npc:left_sector', { npc_id, name, destination_name })`
  - On NPC move: `socketService.emitToSector(newSectorId, 'npc:entered_sector', { npc_id, name, npc_type, ship_type, behavior_state })`
  - On NPC attack player: `socketService.emitToUser(targetUserId, 'npc:attacks_player', { npc_id, name, npc_type, first_round })`
  - On NPC state change: `socketService.emitToSector(sectorId, 'npc:state_change', { npc_id, old_state, new_state })`
  - On NPC destroyed: `socketService.emitToSector(sectorId, 'npc:destroyed', { npc_id, name, destroyed_by })`

## Task 5.8: Define WebSocket Event Contract

Reference document for frontend/backend coordination:

```
SERVER → CLIENT (sector-scoped, all players in sector):
  'npc:entered_sector'  → { npc_id, name, npc_type, ship_type, behavior_state }
  'npc:left_sector'     → { npc_id, name, destination_name }
  'npc:destroyed'       → { npc_id, name, destroyed_by }
  'npc:state_change'    → { npc_id, old_state, new_state }

SERVER → CLIENT (user-scoped, specific player):
  'npc:attacks_player'  → { npc_id, name, npc_type, first_round_data }
  'npc:hails_player'    → { npc_id, name, npc_type, greeting_text, menu_options, voice_enabled }
  'npc:dialogue'        → { npc_id, text, audio_base64?, menu_options, is_ai }
  'combat:round'        → { round_num, attacker_action, defender_action, attacker_hull, defender_hull }
  'combat:ended'        → { winner_type, rewards?, npc_destroyed? }

CLIENT → SERVER:
  'join_sector'         → { sector_id }
  'change_sector'       → { sector_id }
```

## Task 5.9: Phase 5 Verification

- [x] Start server — verify "Socket.io initialized" in console
- [x] Open browser to game — verify socket connects (check devtools network tab for WebSocket upgrade)
- [x] Navigate to a sector — verify `join_sector` event sent
- [x] Wait for NPC tick — verify `npc:entered_sector` / `npc:left_sector` events received in browser console
- [x] Manually trigger NPC attack on player — verify `npc:attacks_player` event received
- [x] Test socket reconnection: stop/start server, verify client reconnects
- [x] Run `npm test` — existing tests pass (socket shouldn't affect test suite since tests don't start server)
