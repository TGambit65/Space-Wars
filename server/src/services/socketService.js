const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');
const config = require('../config');

// ─── Module State ────────────────────────────────────────────────

let io = null;

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
      origin: process.env.CORS_ORIGIN || ['http://localhost:3080'],
      methods: ['GET', 'POST'],
      credentials: true
    },
    maxHttpBufferSize: 5e6 // 5MB for audio binary frames
  });

  // ── JWT Auth Middleware ──────────────────────────────────────
  io.use((socket, next) => {
    const token = socket.handshake.auth.token;
    if (!token) {
      return next(new Error('Authentication required'));
    }
    try {
      const decoded = jwt.verify(token, config.jwt.secret);
      socket.userId = decoded.user_id;
      socket.user = decoded;
      next();
    } catch (err) {
      next(new Error('Invalid token'));
    }
  });

  // ── Connection Handler ──────────────────────────────────────
  io.on('connection', (socket) => {
    // Join user-specific room for targeted events
    socket.join(`user:${socket.userId}`);

    // Client joins their current sector on connect
    socket.on('join_sector', ({ sector_id }) => {
      if (!sector_id || typeof sector_id !== 'string' || sector_id.length > 100) return;
      // Leave any existing sector rooms first
      for (const room of socket.rooms) {
        if (room.startsWith('sector:')) {
          socket.leave(room);
        }
      }
      socket.join(`sector:${sector_id}`);
      socket.currentSectorId = sector_id;
    });

    // Client moves to a new sector
    socket.on('change_sector', ({ sector_id }) => {
      if (!sector_id || typeof sector_id !== 'string' || sector_id.length > 100) return;
      if (socket.currentSectorId) {
        socket.leave(`sector:${socket.currentSectorId}`);
      }
      socket.join(`sector:${sector_id}`);
      socket.currentSectorId = sector_id;
    });

    socket.on('disconnect', () => {
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
  getConnectedCount,
  getUsersInSector
};
