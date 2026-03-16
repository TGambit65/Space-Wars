const { Sequelize } = require('sequelize');
const path = require('path');
require('dotenv').config();

// Use SQLite for development, PostgreSQL for production
const usePostgres = process.env.DB_DIALECT === 'postgres' || process.env.NODE_ENV === 'production';

let sequelize;

if (usePostgres) {
  sequelize = new Sequelize(
    process.env.DB_NAME,
    process.env.DB_USER,
    process.env.DB_PASSWORD,
    {
      host: process.env.DB_HOST,
      port: process.env.DB_PORT,
      dialect: 'postgres',
      logging: process.env.NODE_ENV === 'development' ? console.log : false,
      pool: {
        max: parseInt(process.env.DB_POOL_MAX) || 50,
        min: parseInt(process.env.DB_POOL_MIN) || 5,
        acquire: 60000,
        idle: 10000
      }
    }
  );
} else {
  // SQLite for development
  sequelize = new Sequelize({
    dialect: 'sqlite',
    storage: path.join(__dirname, '../../data/spacewars.sqlite'),
    logging: false,  // Disable verbose SQL logging for cleaner output
    // SQLite handles concurrent writes poorly; keep a single connection and retry briefly on lock contention.
    pool: {
      max: 1,
      min: 1,
      idle: 10000,
      acquire: 60000
    },
    retry: {
      match: [/SQLITE_BUSY/],
      max: 5
    },
    hooks: {
      afterConnect: async (connection) => {
        await new Promise((resolve, reject) => {
          connection.run('PRAGMA journal_mode = WAL;', (err) => {
            if (err) reject(err);
            else resolve();
          });
        });
        await new Promise((resolve, reject) => {
          connection.run('PRAGMA busy_timeout = 5000;', (err) => {
            if (err) reject(err);
            else resolve();
          });
        });
      }
    }
  });
}

const connectDatabase = async () => {
  try {
    await sequelize.authenticate();
    console.log('✓ Database connection established successfully.');
    return true;
  } catch (error) {
    console.error('✗ Unable to connect to the database:', error.message);
    throw error;
  }
};

const syncDatabase = async (options = {}) => {
  try {
    await sequelize.sync(options);
    console.log('✓ Database synchronized successfully.');
    return true;
  } catch (error) {
    console.error('✗ Database sync failed:', error.message);
    throw error;
  }
};

module.exports = {
  sequelize,
  connectDatabase,
  syncDatabase
};
