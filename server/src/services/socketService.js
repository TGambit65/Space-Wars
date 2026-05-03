const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');
const config = require('../config');
const { User, Ship, CorporationMember } = require('../models');
const { getAllowedOrigins, isOriginAllowed } = require('../utils/security');
const { getCookieToken } = require('../utils/authCookie');
const actionAuditService = require('./actionAuditService');
const { evaluateCombatCommand, clearCombatCommandSocketState } = require('./combatCommandGuard');
const realtimeCombatService = require('./realtimeCombatService');

// ─── Module State ────────────────────────────────────────────────

let io = null;
const MAX_SOCKETS_PER_USER = 3;
const userSockets = new Map(); // userId -> Set<socketId>
const CHAT_RATE_LIMIT = 5; // max messages
const CHAT_RATE_WINDOW = 10000; // per 10 seconds
const chatCounters = new Map(); // userId -> { count, resetAt }
const ACCESS_CACHE_MS = 1000;
const ROOM_ID_PATTERN = /^[0-9a-f-]{16,}$/i;
const allowedOrigins = getAllowedOrigins();

const checkTokenFreshness = (socket) => {
  if (!socket.tokenExp) return true;
  return Date.now() / 1000 < socket.tokenExp;
};

const normalizeRoomId = (value) => {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (!trimmed || trimmed.length > 100 || !ROOM_ID_PATTERN.test(trimmed)) {
    return null;
  }
  return trimmed;
};

const normalizeFaction = (value) => {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (!Object.prototype.hasOwnProperty.call(config.factions, trimmed)) {
    return null;
  }
  return trimmed;
};

const normalizeChatText = (value) => {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  return trimmed.substring(0, 500);
};

const escapeHtml = (str) => {
  if (typeof str !== 'string') return '';
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
};

const throttleChat = (socket) => {
  const now = Date.now();
  const key = socket.userId || socket.id;
  let counter = chatCounters.get(key);
  if (!counter || now >= counter.resetAt) {
    counter = { count: 0, resetAt: now + CHAT_RATE_WINDOW };
    chatCounters.set(key, counter);
  }

  counter.count += 1;
  if (counter.count > CHAT_RATE_LIMIT) {
    socket.emit('chat_throttled', { message: 'Too many messages, slow down.' });
    return false;
  }

  return true;
};

// Clean up expired chat counters every 30 seconds
setInterval(() => {
  const now = Date.now();
  for (const [key, counter] of chatCounters) {
    if (now >= counter.resetAt + CHAT_RATE_WINDOW) chatCounters.delete(key);
  }
}, 30000);

const emitAccessDenied = (socket, channel, message) => {
  socket.emit('room_access_denied', { channel, message });
};

const leaveMatchingRooms = (socket, prefix) => {
  for (const room of socket.rooms) {
    if (room.startsWith(prefix)) {
      socket.leave(room);
    }
  }
};

const getSocketAccess = async (socket, { forceRefresh = false } = {}) => {
  const now = Date.now();
  if (!forceRefresh && socket.accessState && socket.accessState.expiresAt > now) {
    return socket.accessState.data;
  }

  const [user, corporationMembership, ships] = await Promise.all([
    User.findByPk(socket.userId, {
      attributes: ['user_id', 'username', 'faction', 'corporation_id', 'active_ship_id']
    }),
    CorporationMember.findOne({
      where: { user_id: socket.userId },
      attributes: ['corporation_id']
    }),
    Ship.findAll({
      where: { owner_user_id: socket.userId, is_active: true },
      attributes: ['ship_id', 'current_sector_id']
    })
  ]);

  if (!user) {
    throw new Error('User not found');
  }

  const activeShip = ships.find(ship => ship.ship_id === user.active_ship_id);
  const allowedSectorIds = [...new Set(
    ships
      .map(ship => ship.current_sector_id)
      .filter(Boolean)
  )];

  const access = {
    userName: user.username || socket.user?.username || 'Unknown',
    faction: normalizeFaction(user.faction),
    corporationId: normalizeRoomId(user.corporation_id || corporationMembership?.corporation_id),
    allowedSectorIds: new Set(allowedSectorIds),
    defaultSectorId: activeShip?.current_sector_id || allowedSectorIds[0] || null
  };

  socket.accessState = {
    expiresAt: now + ACCESS_CACHE_MS,
    data: access
  };

  return access;
};

const joinAuthorizedSector = async (socket, requestedSectorId, options = {}) => {
  const access = await getSocketAccess(socket, options);
  const normalizedRequested = normalizeRoomId(requestedSectorId);
  const targetSectorId = normalizedRequested && access.allowedSectorIds.has(normalizedRequested)
    ? normalizedRequested
    : (!normalizedRequested ? access.defaultSectorId : null);

  if (!targetSectorId) {
    emitAccessDenied(socket, 'sector', 'You can only subscribe to sectors where one of your active ships is present.');
    return null;
  }

  leaveMatchingRooms(socket, 'sector:');
  socket.join(`sector:${targetSectorId}`);
  socket.currentSectorId = targetSectorId;
  return targetSectorId;
};

// ─── Initialization ──────────────────────────────────────────────

/**
 * Initialize Socket.io on the HTTP server.
 * Must be called BEFORE tickService.startTicks().
 * @param {import('http').Server} httpServer
 */
const initialize = (httpServer) => {
  if (io) {
    console.warn('[SocketService] Already initialized');
    return;
  }

  io = new Server(httpServer, {
    cors: {
      origin: (origin, callback) => {
        if (!origin || allowedOrigins.length === 0 || allowedOrigins.includes(origin)) {
          callback(null, true);
          return;
        }
        callback(new Error('Origin not allowed'));
      },
      methods: ['GET', 'POST'],
      credentials: true
    },
    allowRequest: (req, callback) => {
      callback(null, isOriginAllowed(req.headers.origin, req, allowedOrigins));
    },
    maxHttpBufferSize: 5e6 // 5MB for audio binary frames
  });

  // Connection rate limiting by IP
  const connectionAttempts = new Map();
  const CONN_RATE_LIMIT = 20;
  const CONN_RATE_WINDOW = 60000;

  io.use((socket, next) => {
    const ip = socket.handshake.address;
    const now = Date.now();
    let attempts = connectionAttempts.get(ip) || [];
    attempts = attempts.filter(t => now - t < CONN_RATE_WINDOW);
    if (attempts.length >= CONN_RATE_LIMIT) {
      return next(new Error('Too many connection attempts'));
    }
    attempts.push(now);
    connectionAttempts.set(ip, attempts);
    next();
  });

  // Periodic cleanup of expired connection attempts
  setInterval(() => {
    const now = Date.now();
    for (const [ip, attempts] of connectionAttempts) {
      const filtered = attempts.filter(t => now - t < CONN_RATE_WINDOW);
      if (filtered.length === 0) connectionAttempts.delete(ip);
      else connectionAttempts.set(ip, filtered);
    }
  }, 60000);

  // ── JWT Auth Middleware ──────────────────────────────────────
  io.use(async (socket, next) => {
    const token = socket.handshake.auth.token || getCookieToken(socket.handshake.headers.cookie);
    if (!token) {
      return next(new Error('Authentication required'));
    }

    try {
      const decoded = jwt.verify(token, config.jwt.secret, { algorithms: ['HS256'] });
      const user = await User.findByPk(decoded.user_id, {
        attributes: ['user_id', 'username']
      });

      if (!user) {
        return next(new Error('Invalid token'));
      }

      socket.userId = user.user_id;
      socket.tokenExp = decoded.exp;
      socket.user = {
        user_id: user.user_id,
        username: user.username
      };
      next();
    } catch (err) {
      next(new Error('Invalid token'));
    }
  });

  // ── Connection Handler ──────────────────────────────────────
  io.on('connection', (socket) => {
    // ── Per-user connection cap ──────────────────────────────
    const userId = socket.userId;
    if (!userSockets.has(userId)) {
      userSockets.set(userId, new Set());
    }
    const sockets = userSockets.get(userId);
    const wasOffline = sockets.size === 0;
    sockets.add(socket.id);
    if (wasOffline) {
      try { realtimeCombatService.notifyPlayerReconnect(userId); } catch (e) { console.error('[SocketService] notifyPlayerReconnect failed:', e); }
    }

    // If over limit, disconnect the oldest socket
    if (sockets.size > MAX_SOCKETS_PER_USER) {
      const oldestId = sockets.values().next().value;
      const oldSocket = io.sockets.sockets.get(oldestId);
      if (oldSocket && oldSocket.id !== socket.id) {
        oldSocket.emit('error', { message: 'Connection replaced by new tab' });
        oldSocket.disconnect(true);
      }
      sockets.delete(oldestId);
    }

    // Join user-specific room for targeted events
    socket.join(`user:${socket.userId}`);

    getSocketAccess(socket)
      .then((access) => {
        if (access.corporationId) {
          socket.join(`corp:${access.corporationId}`);
        }
        if (access.faction) {
          socket.join(`faction:${access.faction}`);
        }
        if (access.defaultSectorId) {
          socket.join(`sector:${access.defaultSectorId}`);
          socket.currentSectorId = access.defaultSectorId;
        }
      })
      .catch((error) => {
        socket.emit('error', { message: 'Failed to initialize real-time subscriptions' });
        console.error('[SocketService] Access bootstrap failed:', error.message);
      });

    // Client joins their current sector on connect
    socket.on('join_sector', async (payload = {}) => {
      try {
        const { sector_id } = payload;
        await joinAuthorizedSector(socket, sector_id);
      } catch {
        emitAccessDenied(socket, 'sector', 'Unable to join the requested sector.');
      }
    });

    // Client moves to a new sector
    socket.on('change_sector', async (payload = {}) => {
      try {
        const { sector_id } = payload;
        await joinAuthorizedSector(socket, sector_id, { forceRefresh: true });
      } catch {
        emitAccessDenied(socket, 'sector', 'Unable to switch to the requested sector.');
      }
    });

    // Join corporation chat room
    socket.on('join_corp', async () => {
      try {
        const access = await getSocketAccess(socket, { forceRefresh: true });
        if (!access.corporationId) {
          emitAccessDenied(socket, 'corporation', 'You are not currently in a corporation.');
          return;
        }

        socket.join(`corp:${access.corporationId}`);
      } catch {
        emitAccessDenied(socket, 'corporation', 'Unable to join corporation comms.');
      }
    });

    // Join faction chat room
    socket.on('join_faction', async () => {
      try {
        const access = await getSocketAccess(socket, { forceRefresh: true });
        if (!access.faction) {
          emitAccessDenied(socket, 'faction', 'Unable to determine your faction channel.');
          return;
        }

        socket.join(`faction:${access.faction}`);
      } catch {
        emitAccessDenied(socket, 'faction', 'Unable to join faction comms.');
      }
    });

    // Sector chat message
    socket.on('chat_message', async (payload = {}) => {
      const { text } = payload;
      const messageText = escapeHtml(normalizeChatText(text));
      if (!messageText || !throttleChat(socket)) return;
      if (!checkTokenFreshness(socket)) { socket.emit('error', { message: 'Session expired' }); socket.disconnect(true); return; }

      try {
        const sectorId = socket.currentSectorId || await joinAuthorizedSector(socket, null, { forceRefresh: true });
        if (!sectorId) {
          socket.emit('chat_error', { channel: 'sector', message: 'Join a sector before sending sector chat.' });
          return;
        }

        const access = await getSocketAccess(socket);
        io.to(`sector:${sectorId}`).emit('chat_message', {
          sender_id: socket.userId,
          sender_name: access.userName,
          senderId: socket.userId,
          senderName: access.userName,
          text: messageText,
          sector_id: sectorId,
          sectorId,
          timestamp: new Date().toISOString()
        });
      } catch {
        socket.emit('chat_error', { channel: 'sector', message: 'Unable to deliver sector chat right now.' });
      }
    });

    // Corporation chat
    socket.on('corp_chat', async (payload = {}) => {
      const { text } = payload;
      const messageText = escapeHtml(normalizeChatText(text));
      if (!messageText || !throttleChat(socket)) return;
      if (!checkTokenFreshness(socket)) { socket.emit('error', { message: 'Session expired' }); socket.disconnect(true); return; }

      try {
        const access = await getSocketAccess(socket, { forceRefresh: true });
        if (!access.corporationId) {
          socket.emit('chat_error', { channel: 'corporation', message: 'You are not currently in a corporation.' });
          return;
        }

        socket.join(`corp:${access.corporationId}`);
        io.to(`corp:${access.corporationId}`).emit('corp_chat', {
          sender_id: socket.userId,
          sender_name: access.userName,
          senderId: socket.userId,
          senderName: access.userName,
          text: messageText,
          corporation_id: access.corporationId,
          corporationId: access.corporationId,
          timestamp: new Date().toISOString()
        });
      } catch {
        socket.emit('chat_error', { channel: 'corporation', message: 'Unable to deliver corporation chat right now.' });
      }
    });

    // Faction chat
    socket.on('faction_chat', async (payload = {}) => {
      const { text } = payload;
      const messageText = escapeHtml(normalizeChatText(text));
      if (!messageText || !throttleChat(socket)) return;
      if (!checkTokenFreshness(socket)) { socket.emit('error', { message: 'Session expired' }); socket.disconnect(true); return; }

      try {
        const access = await getSocketAccess(socket, { forceRefresh: true });
        if (!access.faction) {
          socket.emit('chat_error', { channel: 'faction', message: 'Unable to determine your faction channel.' });
          return;
        }

        socket.join(`faction:${access.faction}`);
        io.to(`faction:${access.faction}`).emit('faction_chat', {
          sender_id: socket.userId,
          sender_name: access.userName,
          senderId: socket.userId,
          senderName: access.userName,
          text: messageText,
          faction: access.faction,
          timestamp: new Date().toISOString()
        });
      } catch {
        socket.emit('chat_error', { channel: 'faction', message: 'Unable to deliver faction chat right now.' });
      }
    });

    // Real-time combat commands
    socket.on('combat:command', async (data) => {
      try {
        const realtimeCombatService = require('./realtimeCombatService');
        if (!data || !data.combat_id || !data.ship_id || !data.command || typeof data.command.type !== 'string') {
          return;
        }

        const commandDecision = evaluateCombatCommand({
          actorId: socket.userId,
          socketId: socket.id,
          combatId: data.combat_id,
          shipId: data.ship_id,
          sequence: data.command.sequence
        });
        if (!commandDecision.allowed) {
          await actionAuditService.record({
            userId: socket.userId,
            actionType: 'combat_command',
            scopeType: 'combat',
            scopeId: data.combat_id,
            status: commandDecision.status,
            reason: commandDecision.reason,
            metadata: {
              ship_id: data.ship_id,
              command_type: data.command.type,
              sequence: data.command.sequence ?? null
            }
          });
          socket.emit('combat:error', { message: 'Combat command rejected', reason: commandDecision.reason });
          return;
        }

        const combatState = realtimeCombatService.getCombatState(data.combat_id);
        const playerShip = combatState?.ships?.find(ship => ship.shipId === data.ship_id);
        if (!playerShip || playerShip.isNPC || playerShip.ownerId !== socket.userId) {
          await actionAuditService.record({
            userId: socket.userId,
            actionType: 'combat_command',
            scopeType: 'combat',
            scopeId: data.combat_id,
            status: 'deny',
            reason: 'unauthorized_combat_command',
            metadata: {
              ship_id: data.ship_id,
              command_type: data.command.type
            }
          });
          socket.emit('combat:error', { message: 'Unauthorized combat command' });
          return;
        }

        realtimeCombatService.handleCommand(data.combat_id, data.ship_id, data.command);
      } catch (e) {
        socket.emit('combat:error', { message: 'Combat command failed' });
      }
    });

    // Spectator: join a combat room (read-only) for arena/duel matches.
    socket.on('combat:spectate_join', async (payload = {}) => {
      try {
        const realtimeCombatService = require('./realtimeCombatService');
        const combatId = typeof payload?.combat_id === 'string' ? payload.combat_id.trim() : null;
        if (!combatId) {
          socket.emit('combat:error', { message: 'combat_id required' });
          return;
        }
        const state = realtimeCombatService.getCombatState(combatId);
        if (!state) {
          socket.emit('combat:error', { message: 'Combat not found' });
          return;
        }
        const isParticipant = Array.isArray(state.ships)
          && state.ships.some(s => !s.isNPC && s.ownerId === socket.userId);
        const isSpectatable = state.combatType === 'PVP_ARENA' || state.combatType === 'PVP_DUEL';
        if (!isParticipant && !isSpectatable) {
          socket.emit('combat:error', { message: 'This combat is not spectatable' });
          return;
        }
        // Participants already receive events via their per-user room; joining the
        // combat room would double-deliver. Only true spectators join the room.
        if (!isParticipant) {
          socket.join(`combat:${combatId}`);
        }
        socket.emit('combat:event', {
          v: 1,
          ts: Date.now(),
          combatId,
          type: 'snapshot',
          snapshot: state
        });
      } catch (e) {
        socket.emit('combat:error', { message: 'Spectator join failed' });
      }
    });

    socket.on('combat:spectate_leave', (payload = {}) => {
      try {
        const combatId = typeof payload?.combat_id === 'string' ? payload.combat_id.trim() : null;
        if (combatId) socket.leave(`combat:${combatId}`);
      } catch { /* noop */ }
    });

    socket.on('disconnect', () => {
      // Clean up per-user socket tracking
      const socks = userSockets.get(socket.userId);
      let lastSocketGone = false;
      if (socks) {
        socks.delete(socket.id);
        if (socks.size === 0) {
          userSockets.delete(socket.userId);
          lastSocketGone = true;
        }
      }
      if (lastSocketGone) {
        try { realtimeCombatService.notifyPlayerDisconnect(socket.userId); } catch (e) { console.error('[SocketService] notifyPlayerDisconnect failed:', e); }
      }
      chatCounters.delete(socket.id);
      clearCombatCommandSocketState(socket.id);
      delete socket.accessState;
      // Room membership is auto-cleaned by Socket.io
    });
  });

  console.log('[SocketService] Socket.io initialized');
};

// ─── Emit Helpers ────────────────────────────────────────────────

/**
 * Emit an event to all clients in a sector room.
 * @param {string} sectorId
 * @param {string} event
 * @param {Object} data
 */
const emitToSector = (sectorId, event, data) => {
  if (!io) return;
  io.to(`sector:${sectorId}`).emit(event, data);
};

/**
 * Emit an event to a specific user (all their connected clients).
 * @param {string} userId
 * @param {string} event
 * @param {Object} data
 */
const emitToUser = (userId, event, data) => {
  if (!io) return;
  io.to(`user:${userId}`).emit(event, data);
};

/**
 * Emit a batch of updates to all clients in a sector room.
 * Sends a single 'npc:batch_update' event with an array of changes
 * instead of one event per NPC — reduces socket writes in dense sectors.
 * @param {string} sectorId
 * @param {Array<Object>} updates - Array of { event, data } objects
 */
const batchEmitToSector = (sectorId, updates) => {
  if (!io || !updates || updates.length === 0) return;
  io.to(`sector:${sectorId}`).emit('npc:batch_update', updates);
};

/**
 * Emit an event to a combat-specific room (used by spectators of arena/duel matches).
 * Players already receive combat events via their per-user room.
 * @param {string} combatId
 * @param {string} event
 * @param {Object} data
 */
const emitToCombatRoom = (combatId, event, data) => {
  if (!io || !combatId) return;
  io.to(`combat:${combatId}`).emit(event, data);
};

// ─── Query Helpers ───────────────────────────────────────────────

/**
 * Get the raw Socket.io server instance.
 * @returns {Server|null}
 */
const getIO = () => io;

/**
 * Get the number of connected clients.
 * @returns {number}
 */
const getConnectedCount = () => {
  if (!io) return 0;
  return io.engine.clientsCount;
};

/**
 * Get user IDs currently in a sector room.
 * @param {string} sectorId
 * @returns {Promise<string[]>}
 */
const getUsersInSector = async (sectorId) => {
  if (!io) return [];
  const room = `sector:${sectorId}`;
  const sockets = await io.in(room).fetchSockets();
  return sockets.map(s => s.userId).filter(Boolean);
};

module.exports = {
  initialize,
  getIO,
  emitToSector,
  emitToUser,
  emitToCombatRoom,
  batchEmitToSector,
  getConnectedCount,
  getUsersInSector
};
