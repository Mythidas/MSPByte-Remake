/**
 * Global test setup file
 * Runs before all tests to configure the test environment
 */

import { beforeAll, afterEach, vi } from 'vitest';

// Setup environment variables for testing
beforeAll(() => {
  process.env.CONVEX_API_KEY = 'test-api-key';
  process.env.NATS_URL = 'nats://localhost:4222';
});

// Clean up mocks after each test to prevent test pollution
afterEach(() => {
  vi.clearAllMocks();
});
