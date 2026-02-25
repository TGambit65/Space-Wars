/**
 * Jest test setup - runs before all tests
 */
const { sequelize } = require('../src/models');

// Set test environment
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-secret-key-for-testing-only';

// Increase timeout for database operations
jest.setTimeout(30000);

// Track if database has been initialized
let dbInitialized = false;

// Global setup before all tests
beforeAll(async () => {
  // Sync database with force to ensure clean state (only once per test run)
  if (!dbInitialized) {
    await sequelize.sync({ force: true });
    dbInitialized = true;
  }
});

// Cleanup after all tests - only close connection at very end
// Note: With --runInBand, afterAll runs after EACH test file, not just at the end
// So we don't close the connection here to avoid SQLITE_MISUSE errors
afterAll(async () => {
  // Give pending transactions time to complete
  await new Promise(resolve => setTimeout(resolve, 50));
  // Don't close sequelize here - let Jest handle cleanup
});

// Silence console during tests (optional - comment out for debugging)
// global.console = {
//   ...console,
//   log: jest.fn(),
//   info: jest.fn(),
//   warn: jest.fn(),
// };

