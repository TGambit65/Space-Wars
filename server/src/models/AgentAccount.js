const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');
const crypto = require('crypto');

const AgentAccount = sequelize.define('AgentAccount', {
  agent_id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  owner_id: {
    type: DataTypes.UUID,
    allowNull: false,
    references: { model: 'users', key: 'user_id' },
    comment: 'Player who owns this agent',
  },
  ship_id: {
    type: DataTypes.UUID,
    allowNull: true,
    references: { model: 'ships', key: 'ship_id' },
    comment: 'Ship assigned to the agent (null = unassigned)',
  },
  name: {
    type: DataTypes.STRING(50),
    allowNull: false,
    defaultValue: 'Agent',
    comment: 'Display name for the agent',
  },
  status: {
    type: DataTypes.ENUM('active', 'stopped', 'paused', 'error'),
    defaultValue: 'stopped',
    allowNull: false,
    comment: 'Current operational status',
  },
  // API key for external agent authentication (OpenClaw, etc.)
  api_key_hash: {
    type: DataTypes.STRING(128),
    allowNull: true,
    comment: 'Hashed API key for agent authentication',
  },
  api_key_prefix: {
    type: DataTypes.STRING(8),
    allowNull: true,
    comment: 'First 8 chars of API key for identification',
  },
  // Permissions — whitelist of allowed action families
  permissions: {
    type: DataTypes.JSON,
    defaultValue: {
      navigate: true,
      trade: true,
      scan: true,
      dock: true,
      combat: false,
      colony: false,
      fleet: false,
      social: false,
    },
    allowNull: false,
    comment: 'ABAC-style permission flags per action family',
  },
  // Budget controls
  daily_credit_limit: {
    type: DataTypes.BIGINT,
    defaultValue: 5000,
    allowNull: false,
    comment: 'Max credits the agent can spend per day',
  },
  daily_credits_spent: {
    type: DataTypes.BIGINT,
    defaultValue: 0,
    allowNull: false,
  },
  budget_reset_at: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW,
    allowNull: false,
    comment: 'When daily_credits_spent was last reset to 0',
  },
  // Rate limiting
  actions_this_minute: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
    allowNull: false,
  },
  rate_limit_per_minute: {
    type: DataTypes.INTEGER,
    defaultValue: 30,
    allowNull: false,
    comment: 'Max API calls per minute',
  },
  last_rate_reset: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW,
    allowNull: false,
  },
  // Directive — high-level behavior the agent should follow
  directive: {
    type: DataTypes.ENUM('trade', 'scout', 'defend', 'mine', 'idle'),
    defaultValue: 'idle',
    allowNull: false,
    comment: 'Current high-level directive',
  },
  directive_params: {
    type: DataTypes.JSON,
    defaultValue: {},
    comment: 'Parameters for the active directive (e.g., trade route, patrol sector)',
  },
  // Telemetry
  last_action_at: {
    type: DataTypes.DATE,
    allowNull: true,
  },
  last_action_type: {
    type: DataTypes.STRING(50),
    allowNull: true,
  },
  total_actions: {
    type: DataTypes.BIGINT,
    defaultValue: 0,
  },
  total_credits_earned: {
    type: DataTypes.BIGINT,
    defaultValue: 0,
  },
  total_credits_spent: {
    type: DataTypes.BIGINT,
    defaultValue: 0,
  },
  error_message: {
    type: DataTypes.STRING(500),
    allowNull: true,
    comment: 'Last error message if status=error',
  },
  created_at: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW,
  },
}, {
  tableName: 'agent_accounts',
  timestamps: false,
});

/**
 * Generate a new API key. Returns the raw key (show once) and stores the hash.
 */
AgentAccount.prototype.generateApiKey = function () {
  const raw = `sw3k_agent_${crypto.randomBytes(24).toString('hex')}`;
  this.api_key_prefix = raw.slice(0, 8);
  this.api_key_hash = crypto.createHash('sha256').update(raw).digest('hex');
  return raw;
};

/**
 * Verify an API key against the stored hash.
 */
AgentAccount.prototype.verifyApiKey = function (key) {
  const hash = crypto.createHash('sha256').update(key).digest('hex');
  if (hash.length !== this.api_key_hash.length) return false;
  return crypto.timingSafeEqual(Buffer.from(hash), Buffer.from(this.api_key_hash));
};

/**
 * Check if a specific permission is granted.
 */
AgentAccount.prototype.hasPermission = function (action) {
  return Boolean(this.permissions && this.permissions[action]);
};

/**
 * Check and increment rate limit. Returns true if allowed, false if throttled.
 */
AgentAccount.prototype.checkRateLimit = function () {
  const now = new Date();
  const elapsed = now - new Date(this.last_rate_reset);
  if (elapsed > 60000) {
    this.actions_this_minute = 0;
    this.last_rate_reset = now;
  }
  if (this.actions_this_minute >= this.rate_limit_per_minute) {
    return false;
  }
  this.actions_this_minute += 1;
  return true;
};

/**
 * Check and debit from daily budget. Returns true if within budget.
 */
AgentAccount.prototype.checkBudget = function (amount) {
  const now = new Date();
  const elapsed = now - new Date(this.budget_reset_at);
  if (elapsed > 86400000) {
    this.daily_credits_spent = 0;
    this.budget_reset_at = now;
  }
  return (this.daily_credits_spent + amount) <= this.daily_credit_limit;
};

module.exports = AgentAccount;
