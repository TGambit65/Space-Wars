/**
 * Jest test setup - runs before all tests
 */
const { sequelize } = require('../src/models');

// Set test environment
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-secret-key-for-testing-only';

// Increase timeout for database operations
jest.setTimeout(30000);

// Global setup before all tests
beforeAll(async () => {
  // Sync database with force to ensure clean state
  await sequelize.sync({ force: true });
});

// Cleanup after all tests
afterAll(async () => {
  // Give pending transactions time to complete
  await new Promise(resolve => setTimeout(resolve, 100));
  await sequelize.close();
});

// Silence console during tests (optional - comment out for debugging)
// global.console = {
//   ...console,
//   log: jest.fn(),
//   info: jest.fn(),
//   warn: jest.fn(),
// };

