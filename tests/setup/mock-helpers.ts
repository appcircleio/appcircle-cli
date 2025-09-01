/**
 * Common mock helpers and utilities for tests
 */
import { vi } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

/**
 * Mock file system operations
 */
export const mockFileSystem = () => {
  vi.mocked(fs.existsSync).mockReturnValue(true);
  vi.mocked(fs.readFileSync).mockReturnValue('{"test": "data"}');
  vi.mocked(fs.writeFileSync).mockReturnValue(undefined);
  vi.mocked(fs.statSync).mockReturnValue({ 
    isDirectory: () => false, 
    size: 1000 
  } as any);
  vi.mocked(fs.mkdirSync).mockReturnValue(undefined);
  
  vi.mocked(path.resolve).mockImplementation((p) => `/mock/resolved/${p}`);
  vi.mocked(path.basename).mockReturnValue('mock-file.json');
  vi.mocked(path.join).mockImplementation((...parts) => parts.join('/'));
  vi.mocked(os.homedir).mockReturnValue('/mock/home/user');
  vi.mocked(os.tmpdir).mockReturnValue('/mock/tmp');
};

/**
 * Mock network responses
 */
export const mockNetworkSuccess = (data = { success: true }) => {
  return {
    data,
    status: 200,
    statusText: 'OK',
    headers: {},
    config: {}
  };
};

export const mockNetworkError = (status = 500, message = 'Internal Server Error') => {
  const error = new Error(message) as any;
  error.response = {
    status,
    statusText: message,
    data: { error: message }
  };
  return error;
};

/**
 * Mock console operations
 */
export const mockConsole = () => {
  const consoleMocks = {
    log: vi.spyOn(console, 'log').mockImplementation(() => {}),
    error: vi.spyOn(console, 'error').mockImplementation(() => {}),
    warn: vi.spyOn(console, 'warn').mockImplementation(() => {}),
    info: vi.spyOn(console, 'info').mockImplementation(() => {})
  };

  return {
    ...consoleMocks,
    restore: () => {
      Object.values(consoleMocks).forEach(mock => mock.mockRestore());
    }
  };
};

/**
 * Create mock command object for Commander.js
 */
export const createMockCommand = (
  fullCommandName: string, 
  params: any = {}, 
  groupType: string | null = null,
  argsArray: string[] = []
) => ({
  fullCommandName,
  isGroupCommand: vi.fn().mockImplementation((commandType: string) => {
    if (groupType === commandType) return true;
    return false;
  }),
  parent: null,
  name: vi.fn().mockReturnValue(fullCommandName.split('-').pop() || ''),
  opts: vi.fn().mockReturnValue(params),
  args: vi.fn().mockReturnValue(argsArray)
});

/**
 * Wait for promises to resolve (useful for async testing)
 */
export const waitForPromises = () => new Promise(resolve => setImmediate(resolve));

/**
 * Create temporary directory for tests
 */
export const createTempDir = async (): Promise<string> => {
  const tempDir = path.join(os.tmpdir(), `appcircle-test-${Date.now()}`);
  await fs.promises.mkdir(tempDir, { recursive: true });
  return tempDir;
};

/**
 * Clean up temporary directory
 */
export const cleanupTempDir = async (tempDir: string): Promise<void> => {
  try {
    await fs.promises.rmdir(tempDir, { recursive: true });
  } catch {
    // Ignore cleanup errors
  }
};