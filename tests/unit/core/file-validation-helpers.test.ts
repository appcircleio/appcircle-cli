import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import os from 'os';
import fs from 'fs';
import path from 'path';

// Mock dependencies
vi.mock('os', () => ({
  default: { homedir: vi.fn() }
}));

vi.mock('fs', () => ({
  default: { 
    existsSync: vi.fn(),
    mkdirSync: vi.fn(),
    statSync: vi.fn()
  }
}));

vi.mock('path', () => ({
  default: { 
    resolve: vi.fn(),
    join: vi.fn()
  }
}));

vi.mock('../../../src/core/AppcircleExitError', () => ({
  AppcircleExitError: class AppcircleExitError extends Error {
    constructor(message: string, exitCode: number) {
      super(message);
      this.name = 'AppcircleExitError';
      this.exitCode = exitCode;
    }
    exitCode: number;
  }
}));

import { validateFileExists, ensureDirectoryAndGetFilePath } from '../../../src/core/command-runner';
import { AppcircleExitError } from '../../../src/core/AppcircleExitError';

describe('File Validation Helpers', () => {
  const mockHomeDir = '/home/testuser';
  
  beforeEach(() => {
    vi.clearAllMocks();
    (os.homedir as any).mockReturnValue(mockHomeDir);
    (path.resolve as any).mockImplementation((p) => p.startsWith('/') ? p : `/${p}`);
    (path.join as any).mockImplementation((...parts) => parts.join('/'));
  });

  describe('validateFileExists', () => {
    it('should return expanded path when file exists', () => {
      const inputPath = '~/documents/file.txt';
      const expandedPath = `/home/testuser/documents/file.txt`;
      
      (path.resolve as any).mockReturnValue(expandedPath);
      (fs.existsSync as any).mockReturnValue(true);

      const result = validateFileExists(inputPath, 'File not found');

      expect(result).toBe(expandedPath);
      expect(path.resolve).toHaveBeenCalledWith('/home/testuser/documents/file.txt');
      expect(fs.existsSync).toHaveBeenCalledWith(expandedPath);
    });

    it('should throw AppcircleExitError when file does not exist', () => {
      const inputPath = '/non/existent/file.txt';
      const errorMessage = 'File not found';
      
      (path.resolve as any).mockReturnValue(inputPath);
      (fs.existsSync as any).mockReturnValue(false);

      expect(() => {
        validateFileExists(inputPath, errorMessage);
      }).toThrow(AppcircleExitError);
      
      try {
        validateFileExists(inputPath, errorMessage);
      } catch (error: any) {
        expect(error.message).toBe(errorMessage);
        expect(error.exitCode).toBe(1);
      }
    });

    it('should expand tilde to home directory', () => {
      const inputPath = '~/test.txt';
      const expandedPath = '/home/testuser/test.txt';
      
      (path.resolve as any).mockReturnValue(expandedPath);
      (fs.existsSync as any).mockReturnValue(true);

      validateFileExists(inputPath, 'Error');

      expect(path.resolve).toHaveBeenCalledWith(expandedPath);
    });

    it('should handle paths without tilde', () => {
      const inputPath = '/absolute/path/file.txt';
      
      (path.resolve as any).mockReturnValue(inputPath);
      (fs.existsSync as any).mockReturnValue(true);

      const result = validateFileExists(inputPath, 'Error');

      expect(result).toBe(inputPath);
      expect(path.resolve).toHaveBeenCalledWith(inputPath);
    });

    it('should handle empty file paths', () => {
      const inputPath = '';
      const resolvedPath = '/';
      
      (path.resolve as any).mockReturnValue(resolvedPath);
      (fs.existsSync as any).mockReturnValue(false);

      expect(() => {
        validateFileExists(inputPath, 'Empty path error');
      }).toThrow(AppcircleExitError);
    });

    it('should handle custom error messages', () => {
      const inputPath = '/test.txt';
      const customError = 'Custom error message';
      
      (path.resolve as any).mockReturnValue(inputPath);
      (fs.existsSync as any).mockReturnValue(false);

      expect(() => {
        validateFileExists(inputPath, customError);
      }).toThrow(customError);
    });

    it('should handle multiple tilde replacements', () => {
      const inputPath = '~/folder/~backup/file.txt';
      const partiallyExpanded = '/home/testuser/folder/~backup/file.txt';
      
      (path.resolve as any).mockReturnValue(partiallyExpanded);
      (fs.existsSync as any).mockReturnValue(true);

      validateFileExists(inputPath, 'Error');

      expect(path.resolve).toHaveBeenCalledWith(partiallyExpanded);
    });
  });

  describe('ensureDirectoryAndGetFilePath', () => {
    beforeEach(() => {
      (fs.statSync as any).mockReturnValue({ isDirectory: () => true });
    });

    it('should use default Downloads directory when no input path provided', () => {
      const fileName = 'test.json';
      const expectedDefaultDir = '/home/testuser/Downloads';
      const expectedFilePath = '/home/testuser/Downloads/test.json';
      
      (fs.existsSync as any).mockReturnValue(true);
      (path.resolve as any).mockReturnValue(expectedDefaultDir);
      (path.join as any).mockReturnValueOnce(expectedDefaultDir).mockReturnValueOnce(expectedFilePath);

      const result = ensureDirectoryAndGetFilePath('', fileName);

      expect(result).toBe(expectedFilePath);
      expect(path.resolve).toHaveBeenCalledWith(expectedDefaultDir);
      expect(path.join).toHaveBeenCalledWith(expectedDefaultDir, fileName);
    });

    it('should use provided input path', () => {
      const inputPath = '/custom/path';
      const fileName = 'test.json';
      const expectedFilePath = '/custom/path/test.json';
      
      (fs.existsSync as any).mockReturnValue(true);
      (path.resolve as any).mockReturnValue(inputPath);
      (path.join as any).mockReturnValue(expectedFilePath);

      const result = ensureDirectoryAndGetFilePath(inputPath, fileName);

      expect(result).toBe(expectedFilePath);
      expect(path.resolve).toHaveBeenCalledWith(inputPath);
    });

    it('should expand tilde in input path', () => {
      const inputPath = '~/Documents';
      const fileName = 'test.json';
      const expandedPath = '/home/testuser/Documents';
      const expectedFilePath = '/home/testuser/Documents/test.json';
      
      (fs.existsSync as any).mockReturnValue(true);
      (path.resolve as any).mockReturnValue(expandedPath);
      (path.join as any).mockReturnValue(expectedFilePath);

      const result = ensureDirectoryAndGetFilePath(inputPath, fileName);

      expect(result).toBe(expectedFilePath);
      expect(path.resolve).toHaveBeenCalledWith(expandedPath);
    });

    it('should expand multiple tildes in input path', () => {
      const inputPath = '~/folder/~backup';
      const fileName = 'test.json';
      // The replace(/~/g, homedir()) will replace ALL tildes, so ~backup becomes /home/testuserbackup
      const expandedPath = '/home/testuser/folder//home/testuserbackup';
      
      (fs.existsSync as any).mockReturnValue(true);
      (path.resolve as any).mockReturnValue(expandedPath);
      (path.join as any).mockReturnValue('/home/testuser/folder//home/testuserbackup/test.json');

      ensureDirectoryAndGetFilePath(inputPath, fileName);

      expect(path.resolve).toHaveBeenCalledWith(expandedPath);
    });

    it('should create directory if it does not exist', () => {
      const inputPath = '/new/directory';
      const fileName = 'test.json';
      
      (fs.existsSync as any).mockReturnValue(false);
      (path.resolve as any).mockReturnValue(inputPath);
      (path.join as any).mockReturnValue('/new/directory/test.json');
      (fs.statSync as any).mockReturnValue({ isDirectory: () => true });

      ensureDirectoryAndGetFilePath(inputPath, fileName);

      expect(fs.mkdirSync).toHaveBeenCalledWith(inputPath, { recursive: true });
    });

    it('should not create directory if it already exists', () => {
      const inputPath = '/existing/directory';
      const fileName = 'test.json';
      
      (fs.existsSync as any).mockReturnValue(true);
      (path.resolve as any).mockReturnValue(inputPath);
      (path.join as any).mockReturnValue('/existing/directory/test.json');

      ensureDirectoryAndGetFilePath(inputPath, fileName);

      expect(fs.mkdirSync).not.toHaveBeenCalled();
    });

    it('should append filename when path is a directory', () => {
      const inputPath = '/some/directory';
      const fileName = 'output.json';
      const expectedFilePath = '/some/directory/output.json';
      
      (fs.existsSync as any).mockReturnValue(true);
      (path.resolve as any).mockReturnValue(inputPath);
      (fs.statSync as any).mockReturnValue({ isDirectory: () => true });
      (path.join as any).mockReturnValue(expectedFilePath);

      const result = ensureDirectoryAndGetFilePath(inputPath, fileName);

      expect(result).toBe(expectedFilePath);
      expect(fs.statSync).toHaveBeenCalledWith(inputPath);
      expect(path.join).toHaveBeenCalledWith(inputPath, fileName);
    });

    it('should not append filename when path is a file', () => {
      const inputPath = '/some/file.json';
      const fileName = 'output.json';
      
      (fs.existsSync as any).mockReturnValue(true);
      (path.resolve as any).mockReturnValue(inputPath);
      (fs.statSync as any).mockReturnValue({ isDirectory: () => false });
      // Still need to mock path.join for the default path creation
      (path.join as any).mockReturnValue('/home/testuser/Downloads');

      const result = ensureDirectoryAndGetFilePath(inputPath, fileName);

      expect(result).toBe(inputPath);
      // path.join is called once for creating the default Downloads path, but not for appending filename
      expect(path.join).toHaveBeenCalledTimes(1);
      expect(path.join).toHaveBeenCalledWith('/home/testuser', 'Downloads');
    });

    it('should use custom default directory', () => {
      const fileName = 'test.json';
      const customDefault = '/custom/default';
      const expectedFilePath = '/custom/default/test.json';
      
      (fs.existsSync as any).mockReturnValue(true);
      (path.resolve as any).mockReturnValue(customDefault);
      (path.join as any).mockReturnValue(expectedFilePath);

      const result = ensureDirectoryAndGetFilePath('', fileName, customDefault);

      expect(result).toBe(expectedFilePath);
      expect(path.resolve).toHaveBeenCalledWith(customDefault);
    });

    it('should handle empty filename', () => {
      const inputPath = '/test/path';
      const fileName = '';
      const expectedFilePath = '/test/path/';
      
      (fs.existsSync as any).mockReturnValue(true);
      (path.resolve as any).mockReturnValue(inputPath);
      (path.join as any).mockReturnValue(expectedFilePath);

      const result = ensureDirectoryAndGetFilePath(inputPath, fileName);

      expect(result).toBe(expectedFilePath);
    });

    it('should handle special characters in filename', () => {
      const inputPath = '/test/path';
      const fileName = 'file with spaces & symbols!.json';
      const expectedFilePath = '/test/path/file with spaces & symbols!.json';
      
      (fs.existsSync as any).mockReturnValue(true);
      (path.resolve as any).mockReturnValue(inputPath);
      (path.join as any).mockReturnValue(expectedFilePath);

      const result = ensureDirectoryAndGetFilePath(inputPath, fileName);

      expect(result).toBe(expectedFilePath);
    });

    it('should handle unicode characters in paths', () => {
      const inputPath = '/测试/路径';
      const fileName = '文件.json';
      const expectedFilePath = '/测试/路径/文件.json';
      
      (fs.existsSync as any).mockReturnValue(true);
      (path.resolve as any).mockReturnValue(inputPath);
      (path.join as any).mockReturnValue(expectedFilePath);

      const result = ensureDirectoryAndGetFilePath(inputPath, fileName);

      expect(result).toBe(expectedFilePath);
    });
  });

  describe('Integration Tests', () => {
    it('should work together for complete file operations', () => {
      const inputPath = '~/Documents/existing.txt';
      const expandedPath = '/home/testuser/Documents/existing.txt';
      
      // Test validateFileExists
      (path.resolve as any).mockReturnValue(expandedPath);
      (fs.existsSync as any).mockReturnValue(true);
      
      const validatedPath = validateFileExists(inputPath, 'File error');
      expect(validatedPath).toBe(expandedPath);
      
      // Test ensureDirectoryAndGetFilePath
      const outputDir = '~/Output';
      const fileName = 'result.json';
      const expandedOutputDir = '/home/testuser/Output';
      const finalPath = '/home/testuser/Output/result.json';
      
      (path.resolve as any).mockReturnValue(expandedOutputDir);
      (fs.existsSync as any).mockReturnValue(false);
      (fs.statSync as any).mockReturnValue({ isDirectory: () => true });
      (path.join as any).mockReturnValue(finalPath);
      
      const resultPath = ensureDirectoryAndGetFilePath(outputDir, fileName);
      
      expect(resultPath).toBe(finalPath);
      expect(fs.mkdirSync).toHaveBeenCalledWith(expandedOutputDir, { recursive: true });
    });
  });

  describe('Error Handling', () => {
    it('should handle fs.existsSync throwing error', () => {
      const inputPath = '/test/path';
      
      (path.resolve as any).mockReturnValue(inputPath);
      (fs.existsSync as any).mockImplementation(() => {
        throw new Error('File system error');
      });

      expect(() => {
        validateFileExists(inputPath, 'Error message');
      }).toThrow('File system error');
    });

    it('should handle fs.mkdirSync throwing error', () => {
      const inputPath = '/test/path';
      const fileName = 'test.json';
      
      (fs.existsSync as any).mockReturnValue(false);
      (path.resolve as any).mockReturnValue(inputPath);
      (fs.mkdirSync as any).mockImplementation(() => {
        throw new Error('Permission denied');
      });

      expect(() => {
        ensureDirectoryAndGetFilePath(inputPath, fileName);
      }).toThrow('Permission denied');
    });

    it('should handle fs.statSync throwing error', () => {
      const inputPath = '/test/path';
      const fileName = 'test.json';
      
      (fs.existsSync as any).mockReturnValue(true);
      (path.resolve as any).mockReturnValue(inputPath);
      (fs.statSync as any).mockImplementation(() => {
        throw new Error('Stat error');
      });

      expect(() => {
        ensureDirectoryAndGetFilePath(inputPath, fileName);
      }).toThrow('Stat error');
    });

    it('should handle os.homedir throwing error', () => {
      const inputPath = '~/test';
      
      (os.homedir as any).mockImplementation(() => {
        throw new Error('Home directory error');
      });

      expect(() => {
        ensureDirectoryAndGetFilePath(inputPath, 'test.json');
      }).toThrow('Home directory error');
    });

    it('should handle path.resolve throwing error', () => {
      const inputPath = '/test/path';
      
      (path.resolve as any).mockImplementation(() => {
        throw new Error('Path resolution error');
      });

      expect(() => {
        validateFileExists(inputPath, 'Error');
      }).toThrow('Path resolution error');
    });
  });

  describe('Edge Cases', () => {
    it('should handle null and undefined inputs gracefully', () => {
      // validateFileExists with null
      expect(() => {
        validateFileExists(null as any, 'Error');
      }).toThrow();

      // ensureDirectoryAndGetFilePath with undefined
      (path.resolve as any).mockReturnValue('/home/testuser/Downloads');
      (fs.existsSync as any).mockReturnValue(true);
      (fs.statSync as any).mockReturnValue({ isDirectory: () => true });
      (path.join as any).mockReturnValueOnce('/home/testuser/Downloads').mockReturnValueOnce('/home/testuser/Downloads/test.json');

      expect(() => {
        ensureDirectoryAndGetFilePath(undefined as any, 'test.json');
      }).not.toThrow();
    });

    it('should handle very long paths', () => {
      const longPath = '/very/long/path/' + 'a'.repeat(1000);
      const fileName = 'test.json';
      
      (fs.existsSync as any).mockReturnValue(true);
      (path.resolve as any).mockReturnValue(longPath);
      (fs.statSync as any).mockReturnValue({ isDirectory: () => true });
      (path.join as any).mockReturnValue(longPath + '/test.json');

      const result = ensureDirectoryAndGetFilePath(longPath, fileName);

      expect(result).toBe(longPath + '/test.json');
    });

    it('should handle empty home directory', () => {
      (os.homedir as any).mockReturnValue('');
      const inputPath = '~/test';
      const fileName = 'file.json';
      
      (fs.existsSync as any).mockReturnValue(true);
      (path.resolve as any).mockReturnValue('/test');
      (fs.statSync as any).mockReturnValue({ isDirectory: () => true });
      (path.join as any).mockReturnValue('/test/file.json');

      const result = ensureDirectoryAndGetFilePath(inputPath, fileName);

      expect(result).toBe('/test/file.json');
    });
  });
});