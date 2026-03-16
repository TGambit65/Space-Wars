const DEFAULT_DEV_ORIGINS = [
  'http://localhost:3080',
  'http://127.0.0.1:3080',
  'http://localhost:3081',
  'http://127.0.0.1:3081',
  'http://localhost:3082',
  'http://127.0.0.1:3082',
  'http://localhost:5173',
  'http://127.0.0.1:5173'
];

const normalizeOrigin = (value) => {
  if (!value || typeof value !== 'string') return null;

  try {
    return new URL(value).origin;
  } catch {
    return null;
  }
};

const getAllowedOrigins = () => {
  const configuredOrigins = (process.env.CORS_ORIGIN || '')
    .split(',')
    .map(origin => normalizeOrigin(origin.trim()))
    .filter(Boolean);

  if (configuredOrigins.length > 0) {
    return configuredOrigins;
  }

  if (process.env.NODE_ENV !== 'production') {
    return DEFAULT_DEV_ORIGINS;
  }

  return [];
};

const getTrustProxySetting = () => {
  const value = process.env.TRUST_PROXY;

  if (value === undefined || value === '') {
    return false;
  }

  if (value === 'true') return true;
  if (value === 'false') return false;
  if (/^\d+$/.test(value)) return parseInt(value, 10);

  return value;
};

const shouldUseForwardedHeaders = (req) => {
  const trustProxy = req?.app?.get?.('trust proxy');
  if (trustProxy !== undefined) {
    return trustProxy !== false && trustProxy !== 0 && trustProxy !== 'false' && trustProxy !== '';
  }

  const configuredTrustProxy = getTrustProxySetting();
  return configuredTrustProxy !== false && configuredTrustProxy !== 0;
};

const getRequestOrigin = (req) => {
  if (!req) return null;

  const useForwardedHeaders = shouldUseForwardedHeaders(req);
  const forwardedProto = useForwardedHeaders ? req.headers?.['x-forwarded-proto'] : null;
  const forwardedHost = useForwardedHeaders ? req.headers?.['x-forwarded-host'] : null;
  const protocol = (Array.isArray(forwardedProto) ? forwardedProto[0] : forwardedProto || req.protocol || (req.socket?.encrypted ? 'https' : 'http'))
    .toString()
    .split(',')[0]
    .trim();
  const host = (Array.isArray(forwardedHost) ? forwardedHost[0] : forwardedHost || req.headers?.host || '')
    .toString()
    .split(',')[0]
    .trim();

  if (!host) return null;

  return normalizeOrigin(`${protocol}://${host}`);
};

const isOriginAllowed = (origin, req, allowedOrigins = getAllowedOrigins()) => {
  if (!origin) {
    return true;
  }

  const normalizedOrigin = normalizeOrigin(origin);
  if (!normalizedOrigin) {
    return false;
  }

  if (allowedOrigins.includes(normalizedOrigin)) {
    return true;
  }

  const requestOrigin = getRequestOrigin(req);
  return requestOrigin === normalizedOrigin;
};

module.exports = {
  getAllowedOrigins,
  isOriginAllowed,
  getRequestOrigin,
  getTrustProxySetting
};
