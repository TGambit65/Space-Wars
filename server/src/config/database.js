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
        max: 10,
        min: 0,
        acquire: 30000,
        idle: 10000
      }
    }
  );
} else {
  // SQLite for development
  sequelize = new Sequelize({
    dialect: 'sqlite',
    storage: path.join(__dirname, '../../data/spacewars.sqlite'),
    logging: false  // Disable verbose SQL logging for cleaner output
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

