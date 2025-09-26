import { describe, it, expect, vi, beforeEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import chalk from 'chalk';

// Mock dependencies
vi.mock('../../../src/utils/orahelper', () => ({
  createOra: vi.fn()
}));

vi.mock('fs', () => ({
  default: {
    existsSync: vi.fn(),
    mkdirSync: vi.fn()
  }
}));

vi.mock('path', () => ({
  default: {
    resolve: vi.fn(),
    join: vi.fn()
  }
}));

vi.mock('chalk', () => ({
  default: {
    yellow: vi.fn((msg) => msg)
  }
}));

// Mock console.log to avoid output during tests
const mockConsoleLog = vi.spyOn(console, 'log').mockImplementation(() => {});

import { createOra } from '../../../src/utils/orahelper';
import { 
  createSpinnerWithMessage, 
  handleSpinnerSuccess, 
  handleSpinnerFailure, 
  downloadWithSpinner,
  createDirectoryWithFallback
} from '../../../src/core/command-runner';

describe('Spinner and Download Utilities', () => {
  let mockSpinner: any;

  beforeEach(() => {
    vi.clearAllMocks();
    mockSpinner = {
      start: vi.fn().mockReturnThis(),
      succeed: vi.fn(),
      fail: vi.fn(),
      stop: vi.fn()
    };
    (createOra as any).mockReturnValue(mockSpinner);
  });

  describe('createSpinnerWithMessage', () => {
    it('should create and start spinner by default', () => {
      const result = createSpinnerWithMessage('Loading...');

      expect(createOra).toHaveBeenCalledWith('Loading...');
      expect(mockSpinner.start).toHaveBeenCalled();
      expect(result).toBe(mockSpinner);
    });

    it('should create and start spinner when type is "start"', () => {
      const result = createSpinnerWithMessage('Processing...', 'start');

      expect(createOra).toHaveBeenCalledWith('Processing...');
      expect(mockSpinner.start).toHaveBeenCalled();
      expect(result).toBe(mockSpinner);
    });

    it('should create spinner without starting when type is not "start"', () => {
      const result = createSpinnerWithMessage('Done!', 'succeed');

      expect(createOra).toHaveBeenCalledWith('Done!');
      expect(mockSpinner.start).not.toHaveBeenCalled();
      expect(result).toBe(mockSpinner);
    });

    it('should handle empty message', () => {
      const result = createSpinnerWithMessage('');

      expect(createOra).toHaveBeenCalledWith('');
      expect(mockSpinner.start).toHaveBeenCalled();
      expect(result).toBe(mockSpinner);
    });

    it('should handle special characters in message', () => {
      const specialMessage = 'Loading file "test & data" (50%)...';
      const result = createSpinnerWithMessage(specialMessage);

      expect(createOra).toHaveBeenCalledWith(specialMessage);
      expect(result).toBe(mockSpinner);
    });

    it('should handle unicode characters in message', () => {
      const unicodeMessage = '正在加载...';
      const result = createSpinnerWithMessage(unicodeMessage);

      expect(createOra).toHaveBeenCalledWith(unicodeMessage);
      expect(result).toBe(mockSpinner);
    });

    it('should handle very long messages', () => {
      const longMessage = 'A'.repeat(1000);
      const result = createSpinnerWithMessage(longMessage);

      expect(createOra).toHaveBeenCalledWith(longMessage);
      expect(result).toBe(mockSpinner);
    });
  });

  describe('handleSpinnerSuccess', () => {
    it('should call succeed on spinner with message', () => {
      handleSpinnerSuccess(mockSpinner, 'Operation completed successfully');

      expect(mockSpinner.succeed).toHaveBeenCalledWith('Operation completed successfully');
    });

    it('should handle empty success message', () => {
      handleSpinnerSuccess(mockSpinner, '');

      expect(mockSpinner.succeed).toHaveBeenCalledWith('');
    });

    it('should handle special characters in success message', () => {
      const specialMessage = 'File "test & data.txt" downloaded (100%)!';
      handleSpinnerSuccess(mockSpinner, specialMessage);

      expect(mockSpinner.succeed).toHaveBeenCalledWith(specialMessage);
    });

    it('should handle unicode characters in success message', () => {
      const unicodeMessage = '操作成功完成！';
      handleSpinnerSuccess(mockSpinner, unicodeMessage);

      expect(mockSpinner.succeed).toHaveBeenCalledWith(unicodeMessage);
    });

    it('should handle null spinner gracefully', () => {
      // This would throw in real usage, but we test the call
      expect(() => {
        handleSpinnerSuccess(null, 'Success');
      }).toThrow();
    });
  });

  describe('handleSpinnerFailure', () => {
    it('should call fail on spinner with message', () => {
      handleSpinnerFailure(mockSpinner, 'Operation failed');

      expect(mockSpinner.fail).toHaveBeenCalledWith('Operation failed');
    });

    it('should handle empty failure message', () => {
      handleSpinnerFailure(mockSpinner, '');

      expect(mockSpinner.fail).toHaveBeenCalledWith('');
    });

    it('should handle special characters in failure message', () => {
      const specialMessage = 'Failed to download "test & data.txt" (error: 404)';
      handleSpinnerFailure(mockSpinner, specialMessage);

      expect(mockSpinner.fail).toHaveBeenCalledWith(specialMessage);
    });

    it('should handle unicode characters in failure message', () => {
      const unicodeMessage = '操作失败！';
      handleSpinnerFailure(mockSpinner, unicodeMessage);

      expect(mockSpinner.fail).toHaveBeenCalledWith(unicodeMessage);
    });

    it('should handle null spinner gracefully', () => {
      // This would throw in real usage, but we test the call
      expect(() => {
        handleSpinnerFailure(null, 'Failed');
      }).toThrow();
    });
  });

  describe('downloadWithSpinner', () => {
    beforeEach(() => {
      (path.resolve as any).mockImplementation((p1: string) => p1);
      (path.join as any).mockImplementation((p1: string, p2: string) => `${p1}/${p2}`);
    });

    it('should successfully download with spinner', async () => {
      const mockDownloadFunction = vi.fn().mockResolvedValue(undefined);
      const downloadPath = '/downloads';
      const fileName = 'test.zip';

      const result = await downloadWithSpinner(mockDownloadFunction, downloadPath, fileName);

      expect(createOra).toHaveBeenCalledWith('Downloading file...');
      expect(mockSpinner.start).toHaveBeenCalled();
      expect(mockDownloadFunction).toHaveBeenCalled();
      expect(mockSpinner.succeed).toHaveBeenCalledWith('file downloaded successfully: file:///downloads/test.zip');
      expect(result).toBe('/downloads/test.zip');
    });

    it('should download with custom item type', async () => {
      const mockDownloadFunction = vi.fn().mockResolvedValue(undefined);

      await downloadWithSpinner(mockDownloadFunction, '/downloads', 'artifact.zip', 'artifact');

      expect(createOra).toHaveBeenCalledWith('Downloading artifact...');
      expect(mockSpinner.succeed).toHaveBeenCalledWith('artifact downloaded successfully: file:///downloads/artifact.zip');
    });

    it('should handle download function failure', async () => {
      const downloadError = new Error('Network error');
      const mockDownloadFunction = vi.fn().mockRejectedValue(downloadError);

      await expect(async () => {
        await downloadWithSpinner(mockDownloadFunction, '/downloads', 'test.zip');
      }).rejects.toThrow('Network error');

      expect(mockSpinner.fail).toHaveBeenCalledWith('Cannot download file: Network error');
    });

    it('should handle download function failure without message', async () => {
      const downloadError = new Error('');
      const mockDownloadFunction = vi.fn().mockRejectedValue(downloadError);

      await expect(async () => {
        await downloadWithSpinner(mockDownloadFunction, '/downloads', 'test.zip');
      }).rejects.toThrow();

      expect(mockSpinner.fail).toHaveBeenCalledWith('Cannot download file: Unknown error');
    });

    it('should handle download function failure with non-Error object', async () => {
      const downloadError = 'String error';
      const mockDownloadFunction = vi.fn().mockRejectedValue(downloadError);

      await expect(async () => {
        await downloadWithSpinner(mockDownloadFunction, '/downloads', 'test.zip');
      }).rejects.toBe('String error');

      expect(mockSpinner.fail).toHaveBeenCalledWith('Cannot download file: Unknown error');
    });

    it('should handle special characters in file paths', async () => {
      const mockDownloadFunction = vi.fn().mockResolvedValue(undefined);
      const specialPath = '/downloads/special folder';
      const specialFileName = 'file with spaces & symbols.txt';
      const expectedPath = '/downloads/special folder/file with spaces & symbols.txt';
      (path.resolve as any).mockReturnValue(expectedPath);
      (path.join as any).mockReturnValue(expectedPath);

      const result = await downloadWithSpinner(mockDownloadFunction, specialPath, specialFileName);

      expect(result).toBe(expectedPath);
    });

    it('should handle unicode characters in file paths', async () => {
      const mockDownloadFunction = vi.fn().mockResolvedValue(undefined);
      const unicodePath = '/downloads/文件夹';
      const unicodeFileName = '文件.txt';
      const expectedPath = '/downloads/文件夹/文件.txt';
      (path.resolve as any).mockReturnValue(expectedPath);
      (path.join as any).mockReturnValue(expectedPath);

      const result = await downloadWithSpinner(mockDownloadFunction, unicodePath, unicodeFileName);

      expect(result).toBe(expectedPath);
    });

    it('should handle empty file name', async () => {
      const mockDownloadFunction = vi.fn().mockResolvedValue(undefined);
      const expectedPath = '/downloads/';
      (path.resolve as any).mockReturnValue(expectedPath);
      (path.join as any).mockReturnValue(expectedPath);

      const result = await downloadWithSpinner(mockDownloadFunction, '/downloads', '');

      expect(result).toBe(expectedPath);
    });

    it('should handle very long file paths', async () => {
      const mockDownloadFunction = vi.fn().mockResolvedValue(undefined);
      const longFileName = 'very_long_filename_' + 'x'.repeat(200) + '.zip';
      const longPath = '/very/long/path/' + 'a'.repeat(100);
      const fullPath = `${longPath}/${longFileName}`;
      (path.resolve as any).mockReturnValue(fullPath);
      (path.join as any).mockReturnValue(fullPath);

      const result = await downloadWithSpinner(mockDownloadFunction, longPath, longFileName);

      expect(result).toBe(fullPath);
    });
  });

  describe('createDirectoryWithFallback', () => {
    beforeEach(() => {
      mockConsoleLog.mockClear();
    });

    it('should create directory when it does not exist', () => {
      (fs.existsSync as any).mockReturnValue(false);
      (fs.mkdirSync as any).mockReturnValue(undefined);
      const homeDir = '/home/user';
      const downloadPath = '/downloads/new';

      const result = createDirectoryWithFallback(downloadPath, homeDir);

      expect(fs.existsSync).toHaveBeenCalledWith(downloadPath);
      expect(fs.mkdirSync).toHaveBeenCalledWith(downloadPath, { recursive: true });
      expect(result).toBe(downloadPath);
      expect(mockConsoleLog).not.toHaveBeenCalled();
    });

    it('should return path when directory already exists', () => {
      (fs.existsSync as any).mockReturnValue(true);
      const homeDir = '/home/user';
      const downloadPath = '/downloads/existing';

      const result = createDirectoryWithFallback(downloadPath, homeDir);

      expect(fs.existsSync).toHaveBeenCalledWith(downloadPath);
      expect(fs.mkdirSync).not.toHaveBeenCalled();
      expect(result).toBe(downloadPath);
      expect(mockConsoleLog).not.toHaveBeenCalled();
    });

    it('should fallback to home directory when mkdir fails', () => {
      (fs.existsSync as any).mockReturnValue(false);
      (fs.mkdirSync as any).mockImplementation(() => {
        throw new Error('Permission denied');
      });
      const homeDir = '/home/user';
      const downloadPath = '/restricted/path';

      const result = createDirectoryWithFallback(downloadPath, homeDir);

      expect(fs.mkdirSync).toHaveBeenCalledWith(downloadPath, { recursive: true });
      expect(chalk.yellow).toHaveBeenCalledWith(`Could not create directory at ${downloadPath}. Using home directory instead.`);
      expect(result).toBe(homeDir);
    });

    it('should handle empty download path', () => {
      (fs.existsSync as any).mockReturnValue(false);
      (fs.mkdirSync as any).mockReturnValue(undefined);
      const homeDir = '/home/user';
      const downloadPath = '';

      const result = createDirectoryWithFallback(downloadPath, homeDir);

      expect(fs.existsSync).toHaveBeenCalledWith('');
      expect(result).toBe('');
    });

    it('should handle special characters in directory path', () => {
      (fs.existsSync as any).mockReturnValue(false);
      (fs.mkdirSync as any).mockReturnValue(undefined);
      const homeDir = '/home/user';
      const specialPath = '/downloads/folder with spaces & symbols';

      const result = createDirectoryWithFallback(specialPath, homeDir);

      expect(fs.mkdirSync).toHaveBeenCalledWith(specialPath, { recursive: true });
      expect(result).toBe(specialPath);
    });

    it('should handle unicode characters in directory path', () => {
      (fs.existsSync as any).mockReturnValue(false);
      (fs.mkdirSync as any).mockReturnValue(undefined);
      const homeDir = '/home/用户';
      const unicodePath = '/downloads/文件夹';

      const result = createDirectoryWithFallback(unicodePath, homeDir);

      expect(fs.mkdirSync).toHaveBeenCalledWith(unicodePath, { recursive: true });
      expect(result).toBe(unicodePath);
    });

    it('should handle fs.existsSync throwing error', () => {
      (fs.existsSync as any).mockImplementation(() => {
        throw new Error('File system error');
      });
      const homeDir = '/home/user';
      const downloadPath = '/downloads';

      const result = createDirectoryWithFallback(downloadPath, homeDir);

      expect(chalk.yellow).toHaveBeenCalledWith(`Could not create directory at ${downloadPath}. Using home directory instead.`);
      expect(result).toBe(homeDir);
    });

    it('should handle very long directory paths', () => {
      (fs.existsSync as any).mockReturnValue(false);
      (fs.mkdirSync as any).mockReturnValue(undefined);
      const homeDir = '/home/user';
      const longPath = '/downloads/' + 'very_long_directory_name_'.repeat(10);

      const result = createDirectoryWithFallback(longPath, homeDir);

      expect(fs.mkdirSync).toHaveBeenCalledWith(longPath, { recursive: true });
      expect(result).toBe(longPath);
    });
  });

  describe('Integration Tests', () => {
    it('should work together in a complete download flow', async () => {
      const mockDownloadFunction = vi.fn().mockResolvedValue(undefined);
      (fs.existsSync as any).mockReturnValue(false);
      (fs.mkdirSync as any).mockReturnValue(undefined);
      const expectedPath = '/downloads/test.zip';
      (path.resolve as any).mockReturnValue(expectedPath);
      (path.join as any).mockReturnValue(expectedPath);
      
      // First create directory
      const downloadPath = createDirectoryWithFallback('/downloads', '/home/user');
      
      // Then download with spinner
      const result = await downloadWithSpinner(mockDownloadFunction, downloadPath, 'test.zip');
      
      expect(fs.mkdirSync).toHaveBeenCalledWith('/downloads', { recursive: true });
      expect(createOra).toHaveBeenCalledWith('Downloading file...');
      expect(mockDownloadFunction).toHaveBeenCalled();
      expect(mockSpinner.succeed).toHaveBeenCalled();
      expect(result).toBe(expectedPath);
    });
  });
});