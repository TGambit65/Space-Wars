const fs = require('fs');
const path = require('path');
const { ensureDir, safeJson } = require('./util');

const LEVELS = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
};

class Logger {
  constructor({ level = 'info', filePath = null } = {}) {
    this.level = LEVELS[level] ? level : 'info';
    this.filePath = filePath ? path.resolve(filePath) : null;

    if (this.filePath) {
      ensureDir(this.filePath);
    }
  }

  isEnabled(level) {
    return LEVELS[level] >= LEVELS[this.level];
  }

  write(level, message, meta) {
    if (!this.isEnabled(level)) return;

    const timestamp = new Date().toISOString();
    const renderedMeta = meta && Object.keys(meta).length > 0 ? ` ${safeJson(meta)}` : '';
    const line = `[${timestamp}] ${level.toUpperCase().padEnd(5, ' ')} ${message}${renderedMeta}`;

    if (level === 'error') {
      console.error(line);
    } else if (level === 'warn') {
      console.warn(line);
    } else {
      console.log(line);
    }

    if (this.filePath) {
      fs.appendFileSync(this.filePath, `${line}\n`, 'utf8');
    }
  }

  debug(message, meta = undefined) {
    this.write('debug', message, meta);
  }

  info(message, meta = undefined) {
    this.write('info', message, meta);
  }

  warn(message, meta = undefined) {
    this.write('warn', message, meta);
  }

  error(message, meta = undefined) {
    this.write('error', message, meta);
  }
}

module.exports = {
  Logger,
};
