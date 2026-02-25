const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');
const bcrypt = require('bcryptjs');
const config = require('../config');

const User = sequelize.define('User', {
  user_id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  username: {
    type: DataTypes.STRING(50),
    allowNull: false,
    unique: true,
    validate: {
      len: [3, 50],
      isAlphanumeric: true
    }
  },
  email: {
    type: DataTypes.STRING(255),
    allowNull: false,
    unique: true,
    validate: {
      isEmail: true
    }
  },
  hashed_password: {
    type: DataTypes.STRING(255),
    allowNull: false
  },
  credits: {
    type: DataTypes.BIGINT,
    defaultValue: 10000,
    allowNull: false,
    validate: {
      min: 0  // Credits cannot go negative
    }
  },
  is_admin: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
    allowNull: false,
    comment: 'Admin users can access admin endpoints'
  },
  // Phase 4: Crew salary tracking
  crew_salary_due: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
    comment: 'Accumulated crew salary debt'
  },
  last_salary_tick: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW,
    comment: 'Last time crew salaries were calculated'
  },
  created_at: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW
  },
  last_login: {
    type: DataTypes.DATE,
    allowNull: true
  }
}, {
  tableName: 'users',
  timestamps: false,
  hooks: {
    beforeCreate: async (user) => {
      if (user.hashed_password) {
        const salt = await bcrypt.genSalt(config.security.bcryptRounds);
        user.hashed_password = await bcrypt.hash(user.hashed_password, salt);
      }
    }
  }
});

// Instance method to check password
User.prototype.validatePassword = async function(password) {
  return bcrypt.compare(password, this.hashed_password);
};

// Remove sensitive fields from JSON output
User.prototype.toJSON = function() {
  const values = { ...this.get() };
  delete values.hashed_password;
  return values;
};

module.exports = User;

