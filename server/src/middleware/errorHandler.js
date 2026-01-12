const errorHandler = (err, req, res, next) => {
  // Log full error server-side (not exposed to client in production)
  console.error('Error:', err);

  const isProduction = process.env.NODE_ENV === 'production';

  // Sequelize validation errors
  if (err.name === 'SequelizeValidationError') {
    const errors = err.errors.map(e => ({
      field: e.path,
      message: e.message
    }));

    return res.status(400).json({
      success: false,
      message: 'Validation error',
      errors
    });
  }

  // Sequelize unique constraint errors
  if (err.name === 'SequelizeUniqueConstraintError') {
    const errors = err.errors.map(e => ({
      field: e.path,
      message: `${e.path} already exists`
    }));

    return res.status(409).json({
      success: false,
      message: 'Duplicate entry',
      errors
    });
  }

  // Sequelize database connection errors - sanitize in production
  if (err.name === 'SequelizeConnectionError' ||
      err.name === 'SequelizeConnectionRefusedError' ||
      err.name === 'SequelizeDatabaseError') {
    console.error('[DATABASE ERROR]', err.message);
    return res.status(503).json({
      success: false,
      message: isProduction ? 'Service temporarily unavailable' : err.message
    });
  }

  // JWT errors
  if (err.name === 'JsonWebTokenError' || err.name === 'TokenExpiredError') {
    return res.status(401).json({
      success: false,
      message: err.name === 'TokenExpiredError' ? 'Token expired' : 'Invalid token'
    });
  }

  // Default error
  const statusCode = err.statusCode || 500;

  // In production, don't expose internal error messages for 500 errors
  let message = err.message || 'Internal Server Error';
  if (isProduction && statusCode === 500) {
    message = 'An unexpected error occurred';
  }

  res.status(statusCode).json({
    success: false,
    message,
    ...(!isProduction && { stack: err.stack })
  });
};

// 404 handler
const notFoundHandler = (req, res) => {
  res.status(404).json({
    success: false,
    message: `Route ${req.originalUrl} not found`
  });
};

module.exports = {
  errorHandler,
  notFoundHandler
};

