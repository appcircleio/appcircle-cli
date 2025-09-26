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

// Mock the config variables to use test URLs
vi.mock('../../src/services/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../src/services/api')>();
  return {
    ...actual,
    AUTH_HOSTNAME: 'https://auth.appcircle.io',
    API_HOSTNAME: 'https://api.appcircle.io',
  };
});

// Global test setup
beforeAll(() => {
  // Set required environment variables for integration tests
  process.env.AUTH_HOSTNAME = 'https://auth.appcircle.io';
  process.env.API_HOSTNAME = 'https://api.appcircle.io';
  
  // Start MSW server for integration tests
  server.listen({ onUnhandledRequest: 'warn' });
  
  // Suppress console in tests unless debugging
  if (!process.env.DEBUG_TESTS) {
    vi.spyOn(console, 'log').mockImplementation(() => {});
    
    // Ensure console methods exist before mocking them
    if (!console.error) {
      console.error = () => {};
    }
    if (!console.warn) {
      console.warn = () => {};
    }
    if (!console.info) {
      console.info = () => {};
    }
    if (!console.table) {
      console.table = () => {};
    }
    
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(console, 'info').mockImplementation(() => {});
    vi.spyOn(console, 'table').mockImplementation(() => {});
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