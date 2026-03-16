const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const { rateLimit, ipKeyGenerator } = require('express-rate-limit');
const jwt = require('jsonwebtoken');
const path = require('path');
const routes = require('./routes');
const config = require('./config');
const { errorHandler, notFoundHandler } = require('./middleware/errorHandler');
const { getAllowedOrigins, getTrustProxySetting, isOriginAllowed } = require('./utils/security');
const { getAuthTokenFromRequest } = require('./utils/authCookie');

const app = express();
const trustProxySetting = getTrustProxySetting();
const allowedOrigins = getAllowedOrigins();

app.disable('x-powered-by');
app.set('trust proxy', trustProxySetting);

// Security middleware - helmet sets various HTTP headers
// Relaxed CSP for marketing site which loads CDN resources (Bootstrap, Font Awesome, Google Fonts)
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'", "https://cdn.jsdelivr.net"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://cdn.jsdelivr.net", "https://cdnjs.cloudflare.com", "https://fonts.googleapis.com"],
      fontSrc: ["'self'", "https://cdnjs.cloudflare.com", "https://fonts.gstatic.com"],
      imgSrc: ["'self'", "data:", "blob:"],
      connectSrc: ["'self'", "ws:", "wss:"],
    }
  }
}));

// CORS configuration
const buildCorsOptions = (req, callback) => {
  callback(null, {
    origin: isOriginAllowed(req.header('Origin'), req, allowedOrigins),
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    exposedHeaders: ['X-RateLimit-Limit', 'X-RateLimit-Remaining', 'X-RateLimit-Reset'],
    credentials: true,
    maxAge: 86400
  });
};
app.use(cors(buildCorsOptions));
app.options(/.*/, cors(buildCorsOptions));

// Rate limiting - general API rate limit (token-based for authenticated users)
const generalLimiter = rateLimit({
  windowMs: config.security.rateLimitWindowMs,
  max: config.security.rateLimitMaxRequests,
  message: {
    success: false,
    message: 'Too many requests, please try again later.'
  },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    // Use userId from JWT if available, fall back to IP
    // This prevents shared-IP false positives (corporate NAT, mobile carriers)
    const token = getAuthTokenFromRequest(req);
    if (token) {
      try {
        const decoded = jwt.verify(token, config.jwt.secret);
        return `user:${decoded.user_id}`;
      } catch {
        // Invalid token — fall through to IP-based limiting
      }
    }
    return ipKeyGenerator(req.ip);
  }
});
app.use('/api', generalLimiter);

// Stricter rate limit for auth endpoints (prevent brute force)
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // 100 attempts per window (increased for development)
  message: {
    success: false,
    message: 'Too many authentication attempts, please try again later.'
  },
  standardHeaders: true,
  legacyHeaders: false,
  // Skip custom keyGenerator - use default which handles IPv6 properly
  validate: { xForwardedForHeader: false }
});
app.use('/api/auth/login', authLimiter);
app.use('/api/auth/register', authLimiter);

// Body parsers with size limits
app.use(express.json({ limit: '10kb' }));
app.use(express.urlencoded({ extended: true, limit: '10kb' }));

// Request logging in development
if (process.env.NODE_ENV === 'development') {
  app.use((req, res, next) => {
    console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
    next();
  });
}

// API Routes
app.use('/api', routes);

// Serve React game app at /play (production builds)
const clientDist = path.join(__dirname, '../../client/dist');
app.use('/play', express.static(clientDist));
app.get('/play/{*splat}', (req, res, next) => {
  const indexPath = path.join(clientDist, 'index.html');
  res.sendFile(indexPath, (err) => {
    if (err) next(); // Fall through if client/dist doesn't exist (dev mode)
  });
});

// Serve marketing site at root (static files from site/)
const sitePath = path.join(__dirname, '../../site');
app.use(express.static(sitePath));

// SPA-style fallback for marketing site HTML pages
app.get('/wiki', (req, res) => {
  res.sendFile(path.join(sitePath, 'wiki', 'index.html'));
});
app.get('/wiki/{*splat}', (req, res, next) => {
  // Try to serve the file, fall through to 404 if not found
  res.sendFile(path.join(sitePath, req.path, 'index.html'), (err) => {
    if (err) next();
  });
});

// 404 handler - only for API routes return JSON, otherwise let static files handle it
app.use('/api', notFoundHandler);
app.use(errorHandler);

module.exports = app;
