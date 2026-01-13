import { jest, beforeAll, afterAll } from '@jest/globals';
import { setupTestDB, teardownTestDB } from './mongodb-memory-server.js';

// Increase timeout for database operations
jest.setTimeout(30000);

// Setup database before all tests
beforeAll(async () => {
  await setupTestDB();
});

// Teardown database after all tests
afterAll(async () => {
  await teardownTestDB();
});

// Suppress console.log during tests (optional - comment out for debugging)
// global.console = {
//   ...console,
//   log: jest.fn(),
//   debug: jest.fn(),
//   info: jest.fn(),
// };
