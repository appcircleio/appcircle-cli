import { describe, it, expect, vi, beforeEach } from 'vitest';
import os from 'os';

// Mock enquirer
vi.mock('enquirer', () => ({
  default: { prompt: vi.fn() },
  prompt: vi.fn()
}));

// Mock os
vi.mock('os', () => ({
  default: { homedir: vi.fn() }
}));

// Mock other dependencies to prevent command-runner.ts from failing
vi.mock('../../../src/config', async () => {
  const actual = await vi.importActual('../../../src/config');
  return {
    ...actual,
    readEnviromentConfigVariable: vi.fn(),
    writeEnviromentConfigVariable: vi.fn()
  };
});

vi.mock('../../../src/services', () => ({}));
vi.mock('../../../src/services/api', () => ({
  appcircleApi: {},
  getHeaders: vi.fn(),
  API_HOSTNAME: 'https://api.example.com',
  AUTH_HOSTNAME: 'https://auth.example.com'
}));

import { promptForPath } from '../../../src/core/command-runner';
import enquirer from 'enquirer';

describe('promptForPath', () => {
  const mockHomeDir = '/home/testuser';
  let mockPrompt: any;

  beforeEach(() => {
    vi.clearAllMocks();
    (os.homedir as any).mockReturnValue(mockHomeDir);
    mockPrompt = vi.mocked(enquirer.prompt);
  });

  describe('Basic Functionality', () => {
    it('should return user input path when provided', async () => {
      const userPath = '/custom/path/to/file';
      mockPrompt.mockResolvedValue({ path: userPath });

      const result = await promptForPath('Enter file path:', '/default/path');

      expect(result).toBe(userPath);
      expect(mockPrompt).toHaveBeenCalledWith({
        type: 'input',
        name: 'path',
        message: 'Enter file path:',
        initial: '/default/path'
      });
    });

    it('should return default path when user provides empty input', async () => {
      mockPrompt.mockResolvedValue({ path: '' });

      const result = await promptForPath('Enter file path:', '/default/path');

      expect(result).toBe('/default/path');
    });

    it('should return default path when user provides only whitespace', async () => {
      mockPrompt.mockResolvedValue({ path: '   ' });

      const result = await promptForPath('Enter file path:', '/default/path');

      expect(result).toBe('/default/path');
    });

    it('should trim whitespace from user input', async () => {
      mockPrompt.mockResolvedValue({ path: '  /custom/path  ' });

      const result = await promptForPath('Enter file path:', '/default/path');

      expect(result).toBe('/custom/path');
    });
  });

  describe('Tilde Expansion', () => {
    it('should expand tilde to home directory at the beginning', async () => {
      mockPrompt.mockResolvedValue({ path: '~/documents/file.txt' });

      const result = await promptForPath('Enter file path:', '/default/path');

      expect(result).toBe(`${mockHomeDir}/documents/file.txt`);
    });

    it('should expand tilde in default path when user provides empty input', async () => {
      mockPrompt.mockResolvedValue({ path: '' });

      const result = await promptForPath('Enter file path:', '~/default/file.txt');

      expect(result).toBe(`${mockHomeDir}/default/file.txt`);
    });

    it('should not expand tilde in the middle of path', async () => {
      mockPrompt.mockResolvedValue({ path: '/some/~middle/path' });

      const result = await promptForPath('Enter file path:', '/default/path');

      expect(result).toBe('/some/~middle/path');
    });

    it('should handle path with only tilde', async () => {
      mockPrompt.mockResolvedValue({ path: '~' });

      const result = await promptForPath('Enter file path:', '/default/path');

      expect(result).toBe(mockHomeDir);
    });

    it('should handle multiple tildes at beginning', async () => {
      mockPrompt.mockResolvedValue({ path: '~~test' });

      const result = await promptForPath('Enter file path:', '/default/path');

      expect(result).toBe(`${mockHomeDir}~test`);
    });
  });

  describe('Error Handling', () => {
    it('should return default path when enquirer throws error', async () => {
      const defaultPath = '/fallback/path';
      mockPrompt.mockRejectedValue(new Error('User cancelled'));

      const result = await promptForPath('Enter file path:', defaultPath);

      expect(result).toBe(defaultPath);
    });

    it('should return default path when enquirer throws any type of error', async () => {
      const defaultPath = '/fallback/path';
      mockPrompt.mockRejectedValue('String error');

      const result = await promptForPath('Enter file path:', defaultPath);

      expect(result).toBe(defaultPath);
    });

    it('should return default path as-is when error occurs (tilde not expanded in error case)', async () => {
      mockPrompt.mockRejectedValue(new Error('User cancelled'));

      const result = await promptForPath('Enter file path:', '~/fallback/path');

      expect(result).toBe('~/fallback/path');
    });

    it('should handle enquirer timeout error', async () => {
      const defaultPath = '/timeout/fallback';
      mockPrompt.mockRejectedValue(new Error('Prompt timeout'));

      const result = await promptForPath('Enter file path:', defaultPath);

      expect(result).toBe(defaultPath);
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty message', async () => {
      mockPrompt.mockResolvedValue({ path: '/user/path' });

      const result = await promptForPath('', '/default/path');

      expect(result).toBe('/user/path');
      expect(mockPrompt).toHaveBeenCalledWith({
        type: 'input',
        name: 'path',
        message: '',
        initial: '/default/path'
      });
    });

    it('should handle empty default path', async () => {
      mockPrompt.mockResolvedValue({ path: '/user/path' });

      const result = await promptForPath('Enter path:', '');

      expect(result).toBe('/user/path');
    });

    it('should handle empty default path with empty user input', async () => {
      mockPrompt.mockResolvedValue({ path: '' });

      const result = await promptForPath('Enter path:', '');

      expect(result).toBe('');
    });

    it('should handle very long paths', async () => {
      const longPath = '/very/long/path/' + 'a'.repeat(1000);
      mockPrompt.mockResolvedValue({ path: longPath });

      const result = await promptForPath('Enter path:', '/default');

      expect(result).toBe(longPath);
    });

    it('should handle special characters in path', async () => {
      const specialPath = '/path/with spaces/and-special_chars/file (1).txt';
      mockPrompt.mockResolvedValue({ path: specialPath });

      const result = await promptForPath('Enter path:', '/default');

      expect(result).toBe(specialPath);
    });

    it('should handle unicode characters in path', async () => {
      const unicodePath = '/path/with/unicode/文件名.txt';
      mockPrompt.mockResolvedValue({ path: unicodePath });

      const result = await promptForPath('Enter path:', '/default');

      expect(result).toBe(unicodePath);
    });
  });

  describe('Home Directory Edge Cases', () => {
    it('should handle empty home directory', async () => {
      (os.homedir as any).mockReturnValue('');
      mockPrompt.mockResolvedValue({ path: '~/test' });

      const result = await promptForPath('Enter path:', '/default');

      expect(result).toBe('/test');
    });

    it('should handle null home directory', async () => {
      (os.homedir as any).mockReturnValue(null);
      mockPrompt.mockResolvedValue({ path: '~/test' });

      const result = await promptForPath('Enter path:', '/default');

      expect(result).toBe('null/test');
    });

    it('should handle undefined home directory', async () => {
      (os.homedir as any).mockReturnValue(undefined);
      mockPrompt.mockResolvedValue({ path: '~/test' });

      const result = await promptForPath('Enter path:', '/default');

      expect(result).toBe('undefined/test');
    });

    it('should handle home directory with special characters', async () => {
      const specialHomeDir = '/home/user with spaces/folder';
      (os.homedir as any).mockReturnValue(specialHomeDir);
      mockPrompt.mockResolvedValue({ path: '~/documents' });

      const result = await promptForPath('Enter path:', '/default');

      expect(result).toBe(`${specialHomeDir}/documents`);
    });
  });

  describe('Prompt Configuration', () => {
    it('should use correct prompt configuration with different messages', async () => {
      const customMessage = 'Please select a download directory:';
      const customDefault = '/custom/default';
      mockPrompt.mockResolvedValue({ path: '/user/selection' });

      await promptForPath(customMessage, customDefault);

      expect(mockPrompt).toHaveBeenCalledWith({
        type: 'input',
        name: 'path',
        message: customMessage,
        initial: customDefault
      });
    });

    it('should handle multi-line message', async () => {
      const multiLineMessage = 'Line 1\nLine 2\nEnter path:';
      mockPrompt.mockResolvedValue({ path: '/path' });

      await promptForPath(multiLineMessage, '/default');

      expect(mockPrompt).toHaveBeenCalledWith({
        type: 'input',
        name: 'path',
        message: multiLineMessage,
        initial: '/default'
      });
    });

    it('should handle message with special characters', async () => {
      const specialMessage = 'Enter path (special chars: @#$%^&*):';
      mockPrompt.mockResolvedValue({ path: '/path' });

      await promptForPath(specialMessage, '/default');

      expect(mockPrompt).toHaveBeenCalledWith({
        type: 'input',
        name: 'path',
        message: specialMessage,
        initial: '/default'
      });
    });
  });

  describe('Response Handling', () => {
    it('should handle response object without path property', async () => {
      mockPrompt.mockResolvedValue({});

      const result = await promptForPath('Enter path:', '/default/path');

      expect(result).toBe('/default/path');
    });

    it('should handle response object with null path', async () => {
      mockPrompt.mockResolvedValue({ path: null });

      const result = await promptForPath('Enter path:', '/default/path');

      expect(result).toBe('/default/path');
    });

    it('should handle response object with undefined path', async () => {
      mockPrompt.mockResolvedValue({ path: undefined });

      const result = await promptForPath('Enter path:', '/default/path');

      expect(result).toBe('/default/path');
    });

    it('should handle response object with numeric path (trim() converts to string)', async () => {
      mockPrompt.mockResolvedValue({ path: 123 });

      const result = await promptForPath('Enter path:', '/default/path');

      // When numeric path can't be trimmed, falls back to default
      expect(result).toBe('/default/path');
    });
  });
});