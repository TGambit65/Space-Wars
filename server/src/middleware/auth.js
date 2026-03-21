const jwt = require('jsonwebtoken');
const config = require('../config');
const { User } = require('../models');
const { getAuthTokenFromRequest, getCookieToken, setAuthCookie } = require('../utils/authCookie');

const LAST_ACTIVE_WRITE_THROTTLE_MS = 30 * 1000;

const touchLastActive = (user) => {
  if (!user) return;

  const now = Date.now();
  const lastActiveAtMs = user.last_active_at ? new Date(user.last_active_at).getTime() : 0;
  if (lastActiveAtMs && (now - lastActiveAtMs) < LAST_ACTIVE_WRITE_THROTTLE_MS) {
    return;
  }

  const lastActiveAt = new Date(now);
  user.last_active_at = lastActiveAt;
  user.update({ last_active_at: lastActiveAt }, { fields: ['last_active_at'] }).catch(() => null);
};

const authMiddleware = async (req, res, next) => {
  try {
    const token = getAuthTokenFromRequest(req);

    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'Access denied. No token provided.'
      });
    }

    // Verify token
    const decoded = jwt.verify(token, config.jwt.secret);

    // Find user
    const user = await User.findByPk(decoded.user_id);
    
    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Invalid token. User not found.'
      });
    }

    // Attach user to request
    req.user = user;
    req.userId = user.user_id;
    touchLastActive(user);
    if (req.headers.authorization?.startsWith('Bearer ') && !getCookieToken(req.headers.cookie)) {
      setAuthCookie(res, token, req);
    }

    next();
  } catch (error) {
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({
        success: false,
        message: 'Invalid token.'
      });
    }
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({
        success: false,
        message: 'Token expired.'
      });
    }
    
    console.error('Auth middleware error:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error during authentication.'
    });
  }
};

// Optional auth - doesn't fail if no token, but populates user if present
const optionalAuth = async (req, res, next) => {
  try {
    const token = getAuthTokenFromRequest(req);
    if (token) {
      const decoded = jwt.verify(token, config.jwt.secret);
      const user = await User.findByPk(decoded.user_id);

      if (user) {
        req.user = user;
        req.userId = user.user_id;
        touchLastActive(user);
        if (req.headers.authorization?.startsWith('Bearer ') && !getCookieToken(req.headers.cookie)) {
          setAuthCookie(res, token, req);
        }
      }
    }

    next();
  } catch (error) {
    // Silently continue without user
    next();
  }
};

// Admin middleware - requires user to be an admin
// Must be used AFTER authMiddleware
const adminMiddleware = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({
      success: false,
      message: 'Authentication required.'
    });
  }

  if (!req.user.is_admin) {
    return res.status(403).json({
      success: false,
      message: 'Admin access required.'
    });
  }

  next();
};

module.exports = {
  authMiddleware,
  optionalAuth,
  adminMiddleware
};
