const config = require('../config');

const AUTH_COOKIE_NAME = process.env.AUTH_COOKIE_NAME || 'sw3k_auth';

const parseCookieHeader = (cookieHeader) => {
  if (!cookieHeader || typeof cookieHeader !== 'string') {
    return {};
  }

  return cookieHeader.split(';').reduce((cookies, pair) => {
    const separatorIndex = pair.indexOf('=');
    if (separatorIndex === -1) {
      return cookies;
    }

    const key = pair.slice(0, separatorIndex).trim();
    const value = pair.slice(separatorIndex + 1).trim();
    if (!key) {
      return cookies;
    }

    cookies[key] = decodeURIComponent(value);
    return cookies;
  }, {});
};

const parseJwtExpiryToMs = (value) => {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value * 1000;
  }

  if (typeof value !== 'string') {
    return 24 * 60 * 60 * 1000;
  }

  const trimmed = value.trim();
  if (/^\d+$/.test(trimmed)) {
    return parseInt(trimmed, 10) * 1000;
  }

  const match = trimmed.match(/^(\d+)(ms|s|m|h|d)$/i);
  if (!match) {
    return 24 * 60 * 60 * 1000;
  }

  const amount = parseInt(match[1], 10);
  const unit = match[2].toLowerCase();
  const multipliers = {
    ms: 1,
    s: 1000,
    m: 60 * 1000,
    h: 60 * 60 * 1000,
    d: 24 * 60 * 60 * 1000
  };

  return amount * multipliers[unit];
};

const isSecureRequest = (req) => {
  if (req?.secure || req?.socket?.encrypted) {
    return true;
  }

  const forwardedProto = req?.headers?.['x-forwarded-proto'];
  const proto = Array.isArray(forwardedProto) ? forwardedProto[0] : forwardedProto;
  return typeof proto === 'string' && proto.split(',')[0].trim() === 'https';
};

const getAuthCookieOptions = (req) => ({
  httpOnly: true,
  sameSite: 'lax',
  secure: config.isProduction || isSecureRequest(req),
  path: '/',
  maxAge: parseJwtExpiryToMs(config.jwt.expiresIn)
});

const setAuthCookie = (res, token, req) => {
  res.cookie(AUTH_COOKIE_NAME, token, getAuthCookieOptions(req));
};

const clearAuthCookie = (res, req) => {
  res.clearCookie(AUTH_COOKIE_NAME, {
    httpOnly: true,
    sameSite: 'lax',
    secure: config.isProduction || isSecureRequest(req),
    path: '/'
  });
};

const getCookieToken = (cookieHeader) => parseCookieHeader(cookieHeader)[AUTH_COOKIE_NAME] || null;

const getAuthTokenFromRequest = (req) => {
  const authHeader = req?.headers?.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return authHeader.split(' ')[1];
  }

  return getCookieToken(req?.headers?.cookie);
};

module.exports = {
  AUTH_COOKIE_NAME,
  clearAuthCookie,
  getAuthCookieOptions,
  getAuthTokenFromRequest,
  getCookieToken,
  parseCookieHeader,
  parseJwtExpiryToMs,
  setAuthCookie
};
