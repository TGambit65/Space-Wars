const { validationResult } = require('express-validator');
const authService = require('../services/authService');
const combatPolicyService = require('../services/combatPolicyService');
const { clearAuthCookie, setAuthCookie } = require('../utils/authCookie');

const applyAuthResponseHeaders = (res) => {
  res.set({
    'Cache-Control': 'no-store',
    Pragma: 'no-cache'
  });
};

const register = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const { username, email, password, faction } = req.body;
    const result = await authService.registerUser(username, email, password, faction);
    applyAuthResponseHeaders(res);
    setAuthCookie(res, result.token, req);

    res.status(201).json({
      success: true,
      message: 'Registration successful',
      data: result
    });
  } catch (error) {
    next(error);
  }
};

const login = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const { username, password } = req.body;
    const clientIp = req.ip || req.socket?.remoteAddress || 'unknown';
    const result = await authService.loginUser(username, password, clientIp);
    applyAuthResponseHeaders(res);
    setAuthCookie(res, result.token, req);

    res.json({
      success: true,
      message: 'Login successful',
      data: result
    });
  } catch (error) {
    next(error);
  }
};

const getProfile = async (req, res, next) => {
  try {
    const profile = await authService.getUserProfile(req.userId);
    applyAuthResponseHeaders(res);

    res.json({
      success: true,
      data: profile
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Toggle PvP enabled/disabled for the current user
 */
const togglePvP = async (req, res) => {
  try {
    const result = await combatPolicyService.togglePvp({
      userId: req.userId,
      req
    });

    res.json({
      success: true,
      data: {
        pvp_enabled: result.pvp_enabled,
        cooldown_until: result.cooldown_until
      }
    });
  } catch (error) {
    res.status(error.statusCode || 500).json({ success: false, message: error.message });
  }
};

const logout = async (req, res) => {
  applyAuthResponseHeaders(res);
  clearAuthCookie(res, req);
  res.json({ success: true, message: 'Logged out.' });
};

module.exports = {
  register,
  login,
  getProfile,
  togglePvP,
  logout
};
