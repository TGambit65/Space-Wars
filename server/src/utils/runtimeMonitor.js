const fs = require('fs');
const path = require('path');
const util = require('util');

const RUNTIME_LOG_PATH = path.join(__dirname, '../../runtime-events.log');

const normalizeError = (errorLike) => {
  if (errorLike instanceof Error) {
    return {
      name: errorLike.name,
      message: errorLike.message,
      stack: errorLike.stack
    };
  }

  if (typeof errorLike === 'string') {
    return { message: errorLike };
  }

  return {
    message: util.inspect(errorLike, { depth: 4, breakLength: 120 })
  };
};

const recordRuntimeEvent = (type, details = {}) => {
  const payload = {
    timestamp: new Date().toISOString(),
    type,
    details
  };

  const line = `${JSON.stringify(payload)}\n`;

  try {
    fs.appendFileSync(RUNTIME_LOG_PATH, line, 'utf8');
  } catch (error) {
    console.error('[RuntimeMonitor] Failed to append runtime event log:', error.message);
  }
};

module.exports = {
  RUNTIME_LOG_PATH,
  normalizeError,
  recordRuntimeEvent
};
