/**
 * Global test setup for Vitest
 */
import { beforeAll, afterAll, afterEach, beforeEach, vi } from 'vitest';
import { setupServer } from 'msw/node';
import { handlers } from './msw-handlers';
import { resetAuth } from './auth-mocks';
import { mockFileSystem } from './mock-helpers';

// MSW server for integration tests
const server = setupServer(...handlers);

// Global mocks
vi.mock('fs');
vi.mock('path');
vi.mock('os');

// Mock ora spinner to avoid issues in tests
vi.mock('../../src/utils/orahelper', () => ({
  createOra: vi.fn(() => ({
    start: vi.fn().mockReturnThis(),
    stop: vi.fn().mockReturnThis(),
    succeed: vi.fn().mockReturnThis(),
    fail: vi.fn().mockReturnThis(),
    text: ''
  }))
}));

// Global test setup
beforeAll(() => {
  // Start MSW server for integration tests
  server.listen({ onUnhandledRequest: 'warn' });
  
  // Suppress console in tests unless debugging
  if (!process.env.DEBUG_TESTS) {
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
  }
});

beforeEach(() => {
  // Reset auth state between tests
  resetAuth();
  
  // Setup common mocks
  mockFileSystem();
  
  // Reset all mocks
  vi.clearAllMocks();
});

afterEach(() => {
  // Reset MSW handlers
  server.resetHandlers();
  
  // Clean up any test artifacts
  if (global.gc) {
    global.gc();
  }
});

afterAll(() => {
  // Stop MSW server
  server.close();
  
  // Restore all mocks
  vi.restoreAllMocks();
});

// Export server for individual test control
export { server };