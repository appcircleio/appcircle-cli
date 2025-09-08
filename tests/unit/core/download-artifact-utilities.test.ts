import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import chalk from 'chalk';

// Mock dependencies
vi.mock('fs', () => ({
  default: {
    existsSync: vi.fn(),
    mkdirSync: vi.fn(),
    readFileSync: vi.fn(),
    statSync: vi.fn()
  }
}));

vi.mock('path', () => ({
  default: {
    join: vi.fn(),
    resolve: vi.fn()
  }
}));

vi.mock('chalk', () => ({
  default: {
    yellow: vi.fn((msg) => msg)
  }
}));

vi.mock('../../../src/services', () => ({
  downloadArtifact: vi.fn(),
  getBuildsOfCommit: vi.fn()
}));

vi.mock('../../../src/core/AppcircleExitError', () => ({
  AppcircleExitError: class AppcircleExitError extends Error {
    public code: number;
    constructor(message: string, code: number) {
      super(message);
      this.code = code;
    }
  }
}));

// Mock console.log to avoid output during tests
const mockConsoleLog = vi.spyOn(console, 'log').mockImplementation(() => {});

import { downloadArtifact, getBuildsOfCommit } from '../../../src/services';
import { AppcircleExitError } from '../../../src/core/AppcircleExitError';
import { 
  setupDownloadDirectory,
  generateArtifactFileName,
  downloadArtifactWithRetry,
  validateAndProcessVariableGroupFile
} from '../../../src/core/command-runner';

describe('Download and Artifact Utilities', () => {
  const mockHomeDir = '/home/testuser';

  beforeEach(() => {
    vi.clearAllMocks();
    mockConsoleLog.mockClear();
    (path.join as any).mockImplementation((...args: string[]) => args.join('/'));
    (path.resolve as any).mockImplementation((p: string) => p);
  });

  describe('setupDownloadDirectory', () => {
    it('should use provided path and create directory if it does not exist', () => {
      const params = { path: '/custom/download/path' };
      (fs.existsSync as any).mockReturnValue(false);
      (fs.mkdirSync as any).mockReturnValue(undefined);

      const result = setupDownloadDirectory(params, mockHomeDir);

      expect(path.resolve).toHaveBeenCalledWith('/custom/download/path');
      expect(fs.existsSync).toHaveBeenCalled();
      expect(fs.mkdirSync).toHaveBeenCalledWith('/custom/download/path', { recursive: true });
      expect(result).toBe('/custom/download/path');
    });

    it('should use default Downloads directory when no path provided', () => {
      const params = {};
      (fs.existsSync as any).mockReturnValue(true);

      const result = setupDownloadDirectory(params, mockHomeDir);

      expect(path.join).toHaveBeenCalledWith(mockHomeDir, 'Downloads');
      expect(result).toBe('/home/testuser/Downloads');
    });

    it('should expand tilde in provided path', () => {
      const params = { path: '~/custom/path' };
      (fs.existsSync as any).mockReturnValue(true);

      const result = setupDownloadDirectory(params, mockHomeDir);

      expect(path.resolve).toHaveBeenCalledWith('/home/testuser/custom/path');
    });

    it('should fallback to home directory when mkdir fails', () => {
      const params = { path: '/restricted/path' };
      (fs.existsSync as any).mockReturnValue(false);
      (fs.mkdirSync as any).mockImplementation(() => {
        throw new Error('Permission denied');
      });

      const result = setupDownloadDirectory(params, mockHomeDir);

      expect(chalk.yellow).toHaveBeenCalledWith('Could not create directory at /restricted/path. Using home directory instead.');
      expect(result).toBe(mockHomeDir);
    });

    it('should return existing directory without creating', () => {
      const params = { path: '/existing/path' };
      (fs.existsSync as any).mockReturnValue(true);

      const result = setupDownloadDirectory(params, mockHomeDir);

      expect(fs.mkdirSync).not.toHaveBeenCalled();
      expect(result).toBe('/existing/path');
    });

    it('should handle special characters in path', () => {
      const params = { path: '/path with spaces & symbols' };
      (fs.existsSync as any).mockReturnValue(true);

      const result = setupDownloadDirectory(params, mockHomeDir);

      expect(path.resolve).toHaveBeenCalledWith('/path with spaces & symbols');
    });

    it('should handle unicode characters in path', () => {
      const params = { path: '/路径/文件夹' };
      (fs.existsSync as any).mockReturnValue(true);

      const result = setupDownloadDirectory(params, mockHomeDir);

      expect(path.resolve).toHaveBeenCalledWith('/路径/文件夹');
    });

    it('should handle empty path parameter', () => {
      const params = { path: '' };
      (fs.existsSync as any).mockReturnValue(true);

      const result = setupDownloadDirectory(params, mockHomeDir);

      expect(path.join).toHaveBeenCalledWith(mockHomeDir, 'Downloads');
    });

    it('should handle null path parameter', () => {
      const params = { path: null };
      (fs.existsSync as any).mockReturnValue(true);

      const result = setupDownloadDirectory(params, mockHomeDir);

      expect(path.join).toHaveBeenCalledWith(mockHomeDir, 'Downloads');
    });
  });

  describe('generateArtifactFileName', () => {
    beforeEach(() => {
      // Mock Date.now to return consistent timestamp
      vi.spyOn(Date, 'now').mockReturnValue(1234567890123);
    });

    afterEach(() => {
      vi.restoreAllMocks();
    });

    it('should generate filename with default prefix', () => {
      const result = generateArtifactFileName();
      expect(result).toBe('artifacts-1234567890123.zip');
    });

    it('should generate filename with custom prefix', () => {
      const result = generateArtifactFileName('build');
      expect(result).toBe('build-1234567890123.zip');
    });

    it('should generate filename with empty prefix', () => {
      const result = generateArtifactFileName('');
      expect(result).toBe('-1234567890123.zip');
    });

    it('should generate filename with special characters in prefix', () => {
      const result = generateArtifactFileName('test-build_v1');
      expect(result).toBe('test-build_v1-1234567890123.zip');
    });

    it('should generate filename with unicode characters in prefix', () => {
      const result = generateArtifactFileName('构建文件');
      expect(result).toBe('构建文件-1234567890123.zip');
    });

    it('should always include .zip extension', () => {
      const result = generateArtifactFileName('custom');
      expect(result.endsWith('.zip')).toBe(true);
    });

    it('should generate different filenames over time', () => {
      const mockNow = vi.spyOn(Date, 'now');
      
      mockNow.mockReturnValueOnce(1000);
      const result1 = generateArtifactFileName();
      
      mockNow.mockReturnValueOnce(2000);
      const result2 = generateArtifactFileName();
      
      expect(result1).toBe('artifacts-1000.zip');
      expect(result2).toBe('artifacts-2000.zip');
      expect(result1).not.toBe(result2);
    });
  });

  describe('downloadArtifactWithRetry', () => {
    let mockSpinner: any;

    beforeEach(() => {
      mockSpinner = {
        succeed: vi.fn(),
        fail: vi.fn()
      };
    });

    it('should download artifact with branchId and profileId', async () => {
      const params = { branchId: 'branch123', profileId: 'profile456', commitId: 'commit789' };
      const downloadPath = '/downloads';
      const fileName = 'test.zip';
      (downloadArtifact as any).mockResolvedValue(undefined);

      await downloadArtifactWithRetry(params, downloadPath, fileName, mockSpinner);

      expect(downloadArtifact).toHaveBeenCalledWith({
        branchId: 'branch123',
        profileId: 'profile456',
        commitId: 'commit789'
      }, downloadPath, fileName);
      expect(mockSpinner.succeed).toHaveBeenCalledWith('The file test.zip is downloaded successfully: file:///downloads/test.zip');
    });

    it('should download artifact with commitId and resolve buildId', async () => {
      const params = { commitId: 'commit123' };
      const downloadPath = '/downloads';
      const fileName = 'test.zip';
      const mockBuilds = { builds: [{ id: 'build456' }] };
      
      (getBuildsOfCommit as any).mockResolvedValue(mockBuilds);
      (downloadArtifact as any).mockResolvedValue(undefined);

      await downloadArtifactWithRetry(params, downloadPath, fileName, mockSpinner);

      expect(getBuildsOfCommit).toHaveBeenCalledWith({ commitId: 'commit123' });
      expect(params.buildId).toBe('build456');
      expect(downloadArtifact).toHaveBeenCalledWith(params, downloadPath, fileName);
      expect(mockSpinner.succeed).toHaveBeenCalled();
    });

    it('should use existing buildId if provided', async () => {
      const params = { commitId: 'commit123', buildId: 'existing-build' };
      const downloadPath = '/downloads';
      const fileName = 'test.zip';
      const mockBuilds = { builds: [{ id: 'build456' }] };
      
      (getBuildsOfCommit as any).mockResolvedValue(mockBuilds);
      (downloadArtifact as any).mockResolvedValue(undefined);

      await downloadArtifactWithRetry(params, downloadPath, fileName, mockSpinner);

      expect(params.buildId).toBe('existing-build'); // Should not change
    });

    it('should handle no builds found for commit', async () => {
      const params = { commitId: 'commit123' };
      const downloadPath = '/downloads';
      const fileName = 'test.zip';
      
      (getBuildsOfCommit as any).mockResolvedValue({ builds: [] });

      await expect(async () => {
        await downloadArtifactWithRetry(params, downloadPath, fileName, mockSpinner);
      }).rejects.toThrow('No Builds found for commit ID: commit123');

      expect(mockSpinner.fail).toHaveBeenCalledWith('Cannot download artifact: No Builds found for commit ID: commit123');
    });

    it('should handle download function failure', async () => {
      const params = { branchId: 'branch123', profileId: 'profile456' };
      const downloadPath = '/downloads';
      const fileName = 'test.zip';
      const downloadError = new Error('Download failed');
      
      (downloadArtifact as any).mockRejectedValue(downloadError);

      await expect(async () => {
        await downloadArtifactWithRetry(params, downloadPath, fileName, mockSpinner);
      }).rejects.toThrow('Download failed');

      expect(mockSpinner.fail).toHaveBeenCalledWith('Cannot download artifact: Download failed');
    });

    it('should handle download function failure without error message', async () => {
      const params = { branchId: 'branch123', profileId: 'profile456' };
      const downloadPath = '/downloads';
      const fileName = 'test.zip';
      const downloadError = new Error('');
      
      (downloadArtifact as any).mockRejectedValue(downloadError);

      await expect(async () => {
        await downloadArtifactWithRetry(params, downloadPath, fileName, mockSpinner);
      }).rejects.toThrow();

      expect(mockSpinner.fail).toHaveBeenCalledWith('Cannot download artifact: Unknown error');
    });

    it('should handle special characters in file paths', async () => {
      const params = { branchId: 'branch123', profileId: 'profile456' };
      const downloadPath = '/downloads/special folder';
      const fileName = 'file with spaces.zip';
      
      (downloadArtifact as any).mockResolvedValue(undefined);

      await downloadArtifactWithRetry(params, downloadPath, fileName, mockSpinner);

      expect(mockSpinner.succeed).toHaveBeenCalledWith('The file file with spaces.zip is downloaded successfully: file:///downloads/special folder/file with spaces.zip');
    });

    it('should handle commitId with empty builds response', async () => {
      const params = { commitId: 'commit123' };
      const downloadPath = '/downloads';
      const fileName = 'test.zip';
      
      (getBuildsOfCommit as any).mockResolvedValue(null);

      await expect(async () => {
        await downloadArtifactWithRetry(params, downloadPath, fileName, mockSpinner);
      }).rejects.toThrow();
    });

    it('should handle commitId with builds response without builds array', async () => {
      const params = { commitId: 'commit123' };
      const downloadPath = '/downloads';
      const fileName = 'test.zip';
      
      (getBuildsOfCommit as any).mockResolvedValue({ builds: null });

      await expect(async () => {
        await downloadArtifactWithRetry(params, downloadPath, fileName, mockSpinner);
      }).rejects.toThrow();
    });
  });

  describe('validateAndProcessVariableGroupFile', () => {
    let mockSpinner: any;

    beforeEach(() => {
      mockSpinner = {
        fail: vi.fn()
      };
    });

    it('should validate and process valid JSON file', () => {
      const params = { filePath: '~/variables.json', variableGroupId: 'group123' };
      const mockFileContent = '{"key": "value"}';
      
      (fs.existsSync as any).mockReturnValue(true);
      (fs.readFileSync as any).mockReturnValue(mockFileContent);

      const result = validateAndProcessVariableGroupFile(params, mockSpinner);

      expect(fs.existsSync).toHaveBeenCalled();
      expect(fs.readFileSync).toHaveBeenCalled();
      expect(result).toBeTruthy();
    });

    it('should throw error when filePath is not provided', () => {
      const params = {};

      expect(() => {
        validateAndProcessVariableGroupFile(params, mockSpinner);
      }).toThrow(AppcircleExitError);

      expect(mockSpinner.fail).toHaveBeenCalledWith('JSON file path is required');
    });

    it('should throw error when file does not exist', () => {
      const params = { filePath: '/nonexistent/file.json' };
      
      (fs.existsSync as any).mockReturnValue(false);
      (path.resolve as any).mockReturnValue('/nonexistent/file.json');

      expect(() => {
        validateAndProcessVariableGroupFile(params, mockSpinner);
      }).toThrow(AppcircleExitError);

      expect(mockSpinner.fail).toHaveBeenCalledWith('File not found');
    });

    it('should throw error for invalid JSON file', () => {
      const params = { filePath: '/path/invalid.json' };
      const expectedPath = '/path/invalid.json';
      
      (fs.existsSync as any).mockReturnValue(true);
      (fs.readFileSync as any).mockReturnValue('{ invalid json }');
      (path.resolve as any).mockReturnValue(expectedPath);

      expect(() => {
        validateAndProcessVariableGroupFile(params, mockSpinner);
      }).toThrow(AppcircleExitError);

      expect(mockSpinner.fail).toHaveBeenCalledWith('Invalid JSON file');
    });

    it('should clean up variableGroupId with extra formatting', () => {
      const params = { 
        filePath: '/path/file.json', 
        variableGroupId: 'Group Name (abc123)' 
      };
      const mockFileContent = '{}';
      
      (fs.existsSync as any).mockReturnValue(true);
      (fs.readFileSync as any).mockReturnValue(mockFileContent);
      (path.resolve as any).mockReturnValue('/path/file.json');

      validateAndProcessVariableGroupFile(params, mockSpinner);

      expect(params.variableGroupId).toBe('abc123');
    });

    it('should handle variableGroupId without extra formatting', () => {
      const params = { 
        filePath: '/path/file.json', 
        variableGroupId: 'simple-id' 
      };
      const mockFileContent = '{}';
      
      (fs.existsSync as any).mockReturnValue(true);
      (fs.readFileSync as any).mockReturnValue(mockFileContent);
      (path.resolve as any).mockReturnValue('/path/file.json');

      validateAndProcessVariableGroupFile(params, mockSpinner);

      expect(params.variableGroupId).toBe('simple-id');
    });

    it('should handle tilde expansion in file path', () => {
      const params = { filePath: '~/Documents/vars.json' };
      const expectedPath = '/home/testuser/Documents/vars.json';
      const mockFileContent = '{"test": true}';
      
      (fs.existsSync as any).mockReturnValue(true);
      (fs.readFileSync as any).mockReturnValue(mockFileContent);
      (path.resolve as any).mockReturnValue(expectedPath);

      const result = validateAndProcessVariableGroupFile(params, mockSpinner);

      expect(result).toBe(expectedPath);
    });

    it('should handle complex JSON structure', () => {
      const params = { filePath: '/path/complex.json' };
      const complexJson = JSON.stringify({
        variables: [
          { key: 'KEY1', value: 'value1', isSecret: false },
          { key: 'KEY2', value: 'value2', isSecret: true }
        ],
        metadata: { version: '1.0' }
      });
      
      (fs.existsSync as any).mockReturnValue(true);
      (fs.readFileSync as any).mockReturnValue(complexJson);
      (path.resolve as any).mockReturnValue('/path/complex.json');

      const result = validateAndProcessVariableGroupFile(params, mockSpinner);

      expect(result).toBe('/path/complex.json');
    });

    it('should handle file read error', () => {
      const params = { filePath: '/path/file.json' };
      
      (fs.existsSync as any).mockReturnValue(true);
      (fs.readFileSync as any).mockImplementation(() => {
        throw new Error('File read error');
      });
      (path.resolve as any).mockReturnValue('/path/file.json');

      expect(() => {
        validateAndProcessVariableGroupFile(params, mockSpinner);
      }).toThrow(AppcircleExitError);

      expect(mockSpinner.fail).toHaveBeenCalledWith('Invalid JSON file');
    });
  });

  describe('Integration Tests', () => {
    it('should work together for complete download flow', async () => {
      const params = { branchId: 'branch123', profileId: 'profile456' };
      const homeDir = '/home/user';
      let mockSpinner: any;

      mockSpinner = {
        succeed: vi.fn(),
        fail: vi.fn()
      };

      // Setup download directory
      (fs.existsSync as any).mockReturnValue(false);
      (fs.mkdirSync as any).mockReturnValue(undefined);
      const downloadPath = setupDownloadDirectory(params, homeDir);

      // Generate filename
      vi.spyOn(Date, 'now').mockReturnValue(1234567890);
      const fileName = generateArtifactFileName();

      // Download artifact
      (downloadArtifact as any).mockResolvedValue(undefined);
      await downloadArtifactWithRetry(params, downloadPath, fileName, mockSpinner);

      expect(fs.mkdirSync).toHaveBeenCalled();
      expect(fileName).toBe('artifacts-1234567890.zip');
      expect(downloadArtifact).toHaveBeenCalled();
      expect(mockSpinner.succeed).toHaveBeenCalled();

      vi.restoreAllMocks();
    });
  });
});