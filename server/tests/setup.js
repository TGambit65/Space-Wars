/**
 * Jest test setup - runs before all tests
 */

// Set test environment before loading any application modules.
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-secret-key-for-testing-only';

const { sequelize } = require('../src/models');

// Increase timeout for database operations
jest.setTimeout(30000);

const DB_INIT_FLAG = '__SPACE_WARS_DB_INITIALIZED__';

// Global setup before all tests
beforeAll(async () => {
  // setupFilesAfterEnv runs for every test file, so keep the sync sentinel on process.
  if (!process[DB_INIT_FLAG]) {
    await sequelize.sync({ force: true });
    process[DB_INIT_FLAG] = true;
  }
});

// Cleanup after all tests - only close connection at very end
// Note: With --runInBand, afterAll runs after EACH test file, not just at the end.
// We intentionally do not close sequelize here to avoid SQLITE_MISUSE errors.
afterAll(async () => {
  // Give pending transactions time to complete.
  await new Promise((resolve) => setTimeout(resolve, 50));
});

// Silence console during tests (optional - comment out for debugging)
// global.console = {
//   ...console,
//   log: jest.fn(),
//   info: jest.fn(),
//   warn: jest.fn(),
// };
