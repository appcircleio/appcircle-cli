import { describe, it, expect, vi, beforeEach } from 'vitest';
import os from 'os';
import path from 'path';
import fs from 'fs';

// Mock dependencies
vi.mock('fs');
vi.mock('path');
vi.mock('os');

// Mock AppcircleExitError
vi.mock('../../../src/core/AppcircleExitError', () => ({
  AppcircleExitError: class AppcircleExitError extends Error {
    public code: number;
    constructor(message: string, code: number) {
      super(message);
      this.code = code;
    }
  }
}));

// Mock size-limit utility
vi.mock('../../../src/utils/size-limit', () => ({
  getMaxUploadBytes: vi.fn().mockReturnValue(3 * 1024 * 1024 * 1024), // 3GB
  GB: 1024 * 1024 * 1024
}));

// Mock command-runner-utilities for extractVariableGroupId and new functions
vi.mock('../../../src/core/command-runner-utilities', async (importOriginal) => {
  const actual = await importOriginal() as any;
  return {
    ...actual,
    extractVariableGroupId: vi.fn((id) => id),
    expandTildeInPath: actual.expandTildeInPath, // Use the real implementation
    validateFileForUpload: vi.fn().mockReturnValue({
      isValid: true,
      resolvedPath: '/resolved/path.apk'
    }),
    validateFileSizeForUpload: vi.fn().mockReturnValue({
      isValid: true,
      stats: { size: 1024 },
      maxBytes: 3 * 1024 * 1024 * 1024
    }),
    generateArtifactFileName: vi.fn().mockReturnValue('artifacts-123456.zip')
  };
});

// Import functions to test
import {
  validateFileExists,
  ensureDirectoryAndGetFilePath,
  validateAndProcessVariableGroupFile,
  validateAndPrepareUploadFile,
  validateFileForUpload,
  validateFileSizeForUpload,
  validateVariableGroupUploadFile
} from '../../../src/core/command-runner';
import { AppcircleExitError } from '../../../src/core/AppcircleExitError';
import { getMaxUploadBytes, GB } from '../../../src/utils/size-limit';
import { extractVariableGroupId } from '../../../src/core/command-runner-utilities';

describe('Command Runner File Validation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (os.homedir as any).mockReturnValue('/home/testuser');
    (path.resolve as any).mockImplementation((p: string) => p);
    (path.join as any).mockImplementation((...parts: string[]) => parts.join('/'));
    (path.basename as any).mockImplementation((p: string) => p.split('/').pop());
  });

  describe('validateFileExists', () => {
    it('should return expanded path for valid file', () => {
      (fs.existsSync as any).mockReturnValue(true);
      (path.resolve as any).mockReturnValue('/absolute/path/file.txt');
      
      const result = validateFileExists('/path/to/file.txt', 'File not found');
      
      expect(result).toBe('/absolute/path/file.txt');
      expect(path.resolve).toHaveBeenCalledWith('/path/to/file.txt');
    });

    it('should expand tilde in path', () => {
      (fs.existsSync as any).mockReturnValue(true);
      (path.resolve as any).mockReturnValue('/home/testuser/file.txt');
      
      const result = validateFileExists('~/file.txt', 'File not found');
      
      expect(result).toBe('/home/testuser/file.txt');
      expect(path.resolve).toHaveBeenCalledWith('/home/testuser/file.txt');
    });

    it('should throw error for non-existent file', () => {
      (fs.existsSync as any).mockReturnValue(false);
      
      expect(() => validateFileExists('/nonexistent/file.txt', 'Custom error message'))
        .toThrow(AppcircleExitError);
      expect(() => validateFileExists('/nonexistent/file.txt', 'Custom error message'))
        .toThrow('Custom error message');
    });

    it('should handle multiple tildes in path', () => {
      (fs.existsSync as any).mockReturnValue(true);
      (path.resolve as any).mockReturnValue('/home/testuser/folder/file.txt');
      
      const result = validateFileExists('~/folder/~/file.txt', 'File not found');
      
      expect(path.resolve).toHaveBeenCalledWith('/home/testuser/folder/~/file.txt');
    });

    it('should handle empty file path', () => {
      (fs.existsSync as any).mockReturnValue(false);
      
      expect(() => validateFileExists('', 'Empty path error'))
        .toThrow(AppcircleExitError);
      expect(() => validateFileExists('', 'Empty path error'))
        .toThrow('Empty path error');
    });

    it('should handle paths with spaces', () => {
      (fs.existsSync as any).mockReturnValue(true);
      (path.resolve as any).mockReturnValue('/path/to/file with spaces.txt');
      
      const result = validateFileExists('/path/to/file with spaces.txt', 'File not found');
      
      expect(result).toBe('/path/to/file with spaces.txt');
    });
  });

  describe('ensureDirectoryAndGetFilePath', () => {
    it('should use default Downloads directory when no path provided', () => {
      (fs.existsSync as any).mockReturnValue(false);
      (fs.mkdirSync as any).mockImplementation(() => {});
      (fs.statSync as any).mockReturnValue({ isDirectory: () => true });
      (path.join as any)
        .mockReturnValueOnce('/home/testuser/Downloads') // For default path
        .mockReturnValueOnce('/home/testuser/Downloads/test.zip'); // For final path
      (path.resolve as any).mockReturnValue('/home/testuser/Downloads');
      
      const result = ensureDirectoryAndGetFilePath('', 'test.zip');
      
      expect(fs.mkdirSync).toHaveBeenCalledWith('/home/testuser/Downloads', { recursive: true });
      expect(result).toBe('/home/testuser/Downloads/test.zip');
    });

    it('should use provided path', () => {
      (fs.existsSync as any).mockReturnValue(false);
      (fs.mkdirSync as any).mockImplementation(() => {});
      (fs.statSync as any).mockReturnValue({ isDirectory: () => true });
      (path.resolve as any).mockReturnValue('/custom/path');
      
      const result = ensureDirectoryAndGetFilePath('/custom/path', 'test.zip');
      
      expect(fs.mkdirSync).toHaveBeenCalledWith('/custom/path', { recursive: true });
      expect(result).toBe('/custom/path/test.zip');
    });

    it('should use custom default directory', () => {
      (fs.existsSync as any).mockReturnValue(false);
      (fs.mkdirSync as any).mockImplementation(() => {});
      (fs.statSync as any).mockReturnValue({ isDirectory: () => true });
      (path.resolve as any).mockReturnValue('/custom/default');
      (path.join as any).mockImplementation((a: string, b: string) => `${a}/${b}`);
      
      const result = ensureDirectoryAndGetFilePath('', 'test.zip', '/custom/default');
      
      expect(fs.mkdirSync).toHaveBeenCalledWith('/custom/default', { recursive: true });
      expect(result).toBe('/custom/default/test.zip');
    });

    it('should expand multiple tildes in path', () => {
      (fs.existsSync as any).mockReturnValue(false);
      (fs.mkdirSync as any).mockImplementation(() => {});
      (fs.statSync as any).mockReturnValue({ isDirectory: () => true });
      (path.resolve as any).mockReturnValue('/home/testuser/folder/subfolder');
      
      const result = ensureDirectoryAndGetFilePath('~/folder/~/subfolder', 'test.zip');
      
      expect(result).toBe('/home/testuser/folder/subfolder/test.zip');
    });

    it('should not append filename if path is a file', () => {
      (fs.existsSync as any).mockReturnValue(true);
      (fs.statSync as any).mockReturnValue({ isDirectory: () => false });
      (path.resolve as any).mockReturnValue('/path/to/file.zip');
      
      const result = ensureDirectoryAndGetFilePath('/path/to/file.zip', 'ignored.zip');
      
      expect(result).toBe('/path/to/file.zip');
      expect(fs.mkdirSync).not.toHaveBeenCalled();
    });

    it('should create directory recursively if it does not exist', () => {
      (fs.existsSync as any).mockReturnValue(false);
      (fs.mkdirSync as any).mockImplementation(() => {});
      (fs.statSync as any).mockReturnValue({ isDirectory: () => true });
      (path.resolve as any).mockReturnValue('/new/nested/path');
      
      ensureDirectoryAndGetFilePath('/new/nested/path', 'test.zip');
      
      expect(fs.mkdirSync).toHaveBeenCalledWith('/new/nested/path', { recursive: true });
    });

    it('should handle empty filename', () => {
      (fs.existsSync as any).mockReturnValue(false);
      (fs.mkdirSync as any).mockImplementation(() => {});
      (fs.statSync as any).mockReturnValue({ isDirectory: () => true });
      (path.resolve as any).mockReturnValue('/path/to/dir');
      
      const result = ensureDirectoryAndGetFilePath('/path/to/dir', '');
      
      expect(result).toBe('/path/to/dir/');
    });
  });

  describe('validateAndProcessVariableGroupFile', () => {
    it('should validate and process valid JSON file', () => {
      const mockSpinner = { fail: vi.fn() };
      const mockParams = { filePath: '/path/to/file.json', variableGroupId: 'group-123' };
      
      (fs.existsSync as any).mockReturnValue(true);
      (fs.readFileSync as any).mockReturnValue('{"key": "value"}');
      (path.resolve as any).mockReturnValue('/absolute/path/file.json');
      (extractVariableGroupId as any).mockReturnValue('clean-group-123');
      
      const result = validateAndProcessVariableGroupFile(mockParams, mockSpinner);
      
      expect(result).toBe('/absolute/path/file.json');
      expect(extractVariableGroupId).toHaveBeenCalledWith('group-123');
      expect(mockParams.variableGroupId).toBe('clean-group-123');
      expect(fs.readFileSync).toHaveBeenCalledWith('/absolute/path/file.json', 'utf8');
    });

    it('should throw error when filePath is missing', () => {
      const mockSpinner = { fail: vi.fn() };
      const mockParams = {};
      
      expect(() => validateAndProcessVariableGroupFile(mockParams, mockSpinner))
        .toThrow(AppcircleExitError);
      expect(() => validateAndProcessVariableGroupFile(mockParams, mockSpinner))
        .toThrow('JSON file path is required');
      
      expect(mockSpinner.fail).toHaveBeenCalledWith('JSON file path is required');
    });

    it('should throw error for non-existent file', () => {
      const mockSpinner = { fail: vi.fn() };
      const mockParams = { filePath: '/nonexistent/file.json' };
      
      (fs.existsSync as any).mockReturnValue(false);
      (path.resolve as any).mockReturnValue('/nonexistent/file.json');
      
      expect(() => validateAndProcessVariableGroupFile(mockParams, mockSpinner))
        .toThrow(AppcircleExitError);
    });

    it('should throw error for invalid JSON file', () => {
      const mockSpinner = { fail: vi.fn() };
      const mockParams = { filePath: '/path/to/invalid.json' };
      
      (fs.existsSync as any).mockReturnValue(true);
      (fs.readFileSync as any).mockReturnValue('invalid json content');
      (path.resolve as any).mockReturnValue('/absolute/path/invalid.json');
      
      expect(() => validateAndProcessVariableGroupFile(mockParams, mockSpinner))
        .toThrow(AppcircleExitError);
      expect(() => validateAndProcessVariableGroupFile(mockParams, mockSpinner))
        .toThrow('Invalid JSON file');
      
      expect(mockSpinner.fail).toHaveBeenCalledWith('Invalid JSON file');
    });

    it('should handle file with tilde in path', () => {
      const mockSpinner = { fail: vi.fn() };
      const mockParams = { filePath: '~/file.json' };
      
      (fs.existsSync as any).mockReturnValue(true);
      (fs.readFileSync as any).mockReturnValue('{}');
      (path.resolve as any).mockReturnValue('/home/testuser/file.json');
      
      const result = validateAndProcessVariableGroupFile(mockParams, mockSpinner);
      
      expect(result).toBe('/home/testuser/file.json');
    });

    it('should handle params without variableGroupId', () => {
      const mockSpinner = { fail: vi.fn() };
      const mockParams = { filePath: '/path/to/file.json' };
      
      (fs.existsSync as any).mockReturnValue(true);
      (fs.readFileSync as any).mockReturnValue('{"test": true}');
      (path.resolve as any).mockReturnValue('/absolute/path/file.json');
      
      const result = validateAndProcessVariableGroupFile(mockParams, mockSpinner);
      
      expect(result).toBe('/absolute/path/file.json');
      expect(extractVariableGroupId).not.toHaveBeenCalled();
    });

    it('should handle empty JSON file', () => {
      const mockSpinner = { fail: vi.fn() };
      const mockParams = { filePath: '/path/to/empty.json' };
      
      (fs.existsSync as any).mockReturnValue(true);
      (fs.readFileSync as any).mockReturnValue('{}');
      (path.resolve as any).mockReturnValue('/absolute/path/empty.json');
      
      const result = validateAndProcessVariableGroupFile(mockParams, mockSpinner);
      
      expect(result).toBe('/absolute/path/empty.json');
    });
  });

  describe('validateAndPrepareUploadFile', () => {
    it('should throw error when appPath is undefined', () => {
      expect(() => {
        validateAndPrepareUploadFile(undefined as any);
      }).toThrow(AppcircleExitError);
      expect(() => {
        validateAndPrepareUploadFile(undefined as any);
      }).toThrow('The --app parameter is required');
    });

    it('should throw error when appPath is empty string', () => {
      expect(() => {
        validateAndPrepareUploadFile('');
      }).toThrow(AppcircleExitError);
      expect(() => {
        validateAndPrepareUploadFile('');
      }).toThrow('The --app parameter is required');
    });

    it('should validate and prepare file for upload', () => {
      const mockStats = { size: 1024 * 1024 }; // 1MB
      (fs.existsSync as any).mockReturnValue(true);
      (fs.statSync as any).mockReturnValue(mockStats);
      (path.resolve as any).mockReturnValue('/absolute/path/app.apk');
      (path.basename as any).mockReturnValue('app.apk');
      (getMaxUploadBytes as any).mockReturnValue(3 * GB);
      
      const result = validateAndPrepareUploadFile('/path/to/app.apk');
      
      expect(result.expandedPath).toBe('/absolute/path/app.apk');
      expect(result.fileName).toBe('app.apk');
      expect(result.stats).toBe(mockStats);
    });

    it('should expand tilde in app path', () => {
      const mockStats = { size: 1024 };
      (fs.existsSync as any).mockReturnValue(true);
      (fs.statSync as any).mockReturnValue(mockStats);
      (path.resolve as any).mockReturnValue('/home/testuser/app.apk');
      (path.basename as any).mockReturnValue('app.apk');
      (getMaxUploadBytes as any).mockReturnValue(3 * GB);
      
      const result = validateAndPrepareUploadFile('~/app.apk');
      
      expect(result.expandedPath).toBe('/home/testuser/app.apk');
      expect(path.resolve).toHaveBeenCalledWith('/home/testuser/app.apk');
    });

    it('should throw error for non-existent file', () => {
      (fs.existsSync as any).mockReturnValue(false);
      (path.resolve as any).mockReturnValue('/absolute/path/nonexistent.apk');
      
      expect(() => validateAndPrepareUploadFile('/path/to/nonexistent.apk'))
        .toThrow(AppcircleExitError);
      expect(() => validateAndPrepareUploadFile('/path/to/nonexistent.apk'))
        .toThrow('File not found: /path/to/nonexistent.apk');
    });

    it('should throw error for oversized file', () => {
      const mockStats = { size: 4 * GB }; // 4GB - over limit
      (fs.existsSync as any).mockReturnValue(true);
      (fs.statSync as any).mockReturnValue(mockStats);
      (path.resolve as any).mockReturnValue('/path/to/largefile.apk');
      (getMaxUploadBytes as any).mockReturnValue(3 * GB);
      
      expect(() => validateAndPrepareUploadFile('/path/to/largefile.apk'))
        .toThrow(AppcircleExitError);
      expect(() => validateAndPrepareUploadFile('/path/to/largefile.apk'))
        .toThrow('File size 4.00 GB exceeds the allowed limit of 3.00 GB.');
    });

    it('should handle no size limit', () => {
      const mockStats = { size: 5 * GB }; // Very large file
      (fs.existsSync as any).mockReturnValue(true);
      (fs.statSync as any).mockReturnValue(mockStats);
      (path.resolve as any).mockReturnValue('/path/to/hugefile.apk');
      (path.basename as any).mockReturnValue('hugefile.apk');
      (getMaxUploadBytes as any).mockReturnValue(null);
      
      const result = validateAndPrepareUploadFile('/path/to/hugefile.apk');
      
      expect(result.expandedPath).toBe('/path/to/hugefile.apk');
      expect(result.stats).toBe(mockStats);
    });

    it('should handle multiple tildes in path', () => {
      const mockStats = { size: 1024 };
      (fs.existsSync as any).mockReturnValue(true);
      (fs.statSync as any).mockReturnValue(mockStats);
      (path.resolve as any).mockReturnValue('/home/testuser/folder/app.apk');
      (path.basename as any).mockReturnValue('app.apk');
      (getMaxUploadBytes as any).mockReturnValue(3 * GB);
      
      const result = validateAndPrepareUploadFile('~/folder/~/app.apk');
      
      expect(result.expandedPath).toBe('/home/testuser/folder/app.apk');
    });

    it('should handle zero byte file', () => {
      const mockStats = { size: 0 };
      (fs.existsSync as any).mockReturnValue(true);
      (fs.statSync as any).mockReturnValue(mockStats);
      (path.resolve as any).mockReturnValue('/path/to/empty.apk');
      (path.basename as any).mockReturnValue('empty.apk');
      (getMaxUploadBytes as any).mockReturnValue(3 * GB);
      
      const result = validateAndPrepareUploadFile('/path/to/empty.apk');
      
      expect(result.expandedPath).toBe('/path/to/empty.apk');
      expect(result.stats.size).toBe(0);
    });

    it('should handle file at exact size limit', () => {
      const mockStats = { size: 3 * GB }; // Exactly at limit
      (fs.existsSync as any).mockReturnValue(true);
      (fs.statSync as any).mockReturnValue(mockStats);
      (path.resolve as any).mockReturnValue('/path/to/exactfile.apk');
      (path.basename as any).mockReturnValue('exactfile.apk');
      (getMaxUploadBytes as any).mockReturnValue(3 * GB);
      
      const result = validateAndPrepareUploadFile('/path/to/exactfile.apk');
      
      expect(result.expandedPath).toBe('/path/to/exactfile.apk');
      expect(result.stats).toBe(mockStats);
    });
  });

  describe.skip('validateFileForUpload', () => {
    it('should validate file and return expanded path', () => {
      (fs.existsSync as any).mockReturnValue(true);
      (path.resolve as any).mockReturnValue('/absolute/path/file.zip');
      
      const result = validateFileForUpload('/path/to/file.zip', '/original/path/file.zip');
      
      expect(result).toBe('/absolute/path/file.zip');
      expect(path.resolve).toHaveBeenCalledWith('/path/to/file.zip');
    });

    it('should expand multiple tildes in path', () => {
      (fs.existsSync as any).mockReturnValue(true);
      (path.resolve as any).mockReturnValue('/home/testuser/folder/file.zip');
      
      const result = validateFileForUpload('~/folder/~/file.zip', '~/folder/~/file.zip');
      
      expect(result).toBe('/home/testuser/folder/file.zip');
    });

    it('should throw error for non-existent file with original path', () => {
      (fs.existsSync as any).mockReturnValue(false);
      (path.resolve as any).mockReturnValue('/absolute/nonexistent.zip');
      
      expect(() => validateFileForUpload('/path/nonexistent.zip', 'original/path.zip'))
        .toThrow(AppcircleExitError);
      expect(() => validateFileForUpload('/path/nonexistent.zip', 'original/path.zip'))
        .toThrow('File not found: original/path.zip');
    });

    it('should handle empty file path', () => {
      (fs.existsSync as any).mockReturnValue(false);
      (path.resolve as any).mockReturnValue('');
      
      expect(() => validateFileForUpload('', 'empty-path'))
        .toThrow(AppcircleExitError);
      expect(() => validateFileForUpload('', 'empty-path'))
        .toThrow('File not found: empty-path');
    });

    it('should handle path with no tildes', () => {
      (fs.existsSync as any).mockReturnValue(true);
      (path.resolve as any).mockReturnValue('/absolute/regular/path.zip');
      
      const result = validateFileForUpload('/regular/path.zip', '/regular/path.zip');
      
      expect(result).toBe('/absolute/regular/path.zip');
    });
  });

  describe.skip('validateFileSizeForUpload', () => {
    it('should validate file size within limits', () => {
      const mockStats = { size: 1024 * 1024 }; // 1MB
      (fs.statSync as any).mockReturnValue(mockStats);
      (getMaxUploadBytes as any).mockReturnValue(3 * GB);
      
      const result = validateFileSizeForUpload('/path/to/file.zip');
      
      expect(result.stats).toBe(mockStats);
      expect(result.maxBytes).toBe(3 * GB);
    });

    it('should throw error for oversized file', () => {
      const mockStats = { size: 4 * GB }; // 4GB - over limit
      (fs.statSync as any).mockReturnValue(mockStats);
      (getMaxUploadBytes as any).mockReturnValue(3 * GB);
      
      expect(() => validateFileSizeForUpload('/path/to/largefile.zip'))
        .toThrow(AppcircleExitError);
      expect(() => validateFileSizeForUpload('/path/to/largefile.zip'))
        .toThrow('File size 4.00 GB exceeds the allowed limit of 3.00 GB.');
    });

    it('should handle no size limit', () => {
      const mockStats = { size: 5 * GB };
      (fs.statSync as any).mockReturnValue(mockStats);
      (getMaxUploadBytes as any).mockReturnValue(null);
      
      const result = validateFileSizeForUpload('/path/to/hugefile.zip');
      
      expect(result.stats).toBe(mockStats);
      expect(result.maxBytes).toBeNull();
    });

    it('should handle zero byte file', () => {
      const mockStats = { size: 0 };
      (fs.statSync as any).mockReturnValue(mockStats);
      (getMaxUploadBytes as any).mockReturnValue(3 * GB);
      
      const result = validateFileSizeForUpload('/path/to/empty.zip');
      
      expect(result.stats).toBe(mockStats);
      expect(result.maxBytes).toBe(3 * GB);
    });

    it('should handle file at exact size limit', () => {
      const mockStats = { size: 3 * GB };
      (fs.statSync as any).mockReturnValue(mockStats);
      (getMaxUploadBytes as any).mockReturnValue(3 * GB);
      
      const result = validateFileSizeForUpload('/path/to/exactfile.zip');
      
      expect(result.stats).toBe(mockStats);
      expect(result.maxBytes).toBe(3 * GB);
    });
  });

  describe('validateVariableGroupUploadFile', () => {
    it('should validate and process valid JSON file', () => {
      const mockSpinner = { fail: vi.fn() };
      const mockParams = { filePath: '/path/to/file.json', variableGroupId: 'group-123' };
      
      (fs.existsSync as any).mockReturnValue(true);
      (fs.readFileSync as any).mockReturnValue('{"key": "value"}');
      (path.resolve as any).mockReturnValue('/absolute/path/file.json');
      
      const result = validateVariableGroupUploadFile(mockParams, mockSpinner);
      
      expect(result).toBe('/absolute/path/file.json');
      expect(fs.readFileSync).toHaveBeenCalledWith('/absolute/path/file.json', 'utf8');
    });

    it('should extract variableGroupId from parentheses format', () => {
      const mockSpinner = { fail: vi.fn() };
      const mockParams = { 
        filePath: '/path/to/file.json', 
        variableGroupId: 'Environment Variables (abc-123-def)' 
      };
      
      (fs.existsSync as any).mockReturnValue(true);
      (fs.readFileSync as any).mockReturnValue('{}');
      (path.resolve as any).mockReturnValue('/absolute/path/file.json');
      
      const result = validateVariableGroupUploadFile(mockParams, mockSpinner);
      
      expect(result).toBe('/absolute/path/file.json');
      expect(mockParams.variableGroupId).toBe('abc-123-def');
    });

    it('should throw error when filePath is missing', () => {
      const mockSpinner = { fail: vi.fn() };
      const mockParams = {};
      
      expect(() => validateVariableGroupUploadFile(mockParams, mockSpinner))
        .toThrow(AppcircleExitError);
      expect(() => validateVariableGroupUploadFile(mockParams, mockSpinner))
        .toThrow('JSON file path is required');
      
      expect(mockSpinner.fail).toHaveBeenCalledWith('JSON file path is required');
    });

    it('should throw error for non-existent file', () => {
      const mockSpinner = { fail: vi.fn() };
      const mockParams = { filePath: '/nonexistent/file.json' };
      
      (fs.existsSync as any).mockReturnValue(false);
      (path.resolve as any).mockReturnValue('/nonexistent/file.json');
      
      expect(() => validateVariableGroupUploadFile(mockParams, mockSpinner))
        .toThrow(AppcircleExitError);
      expect(() => validateVariableGroupUploadFile(mockParams, mockSpinner))
        .toThrow('File not found');
      
      expect(mockSpinner.fail).toHaveBeenCalledWith('File not found');
    });

    it('should throw error for invalid JSON file', () => {
      const mockSpinner = { fail: vi.fn() };
      const mockParams = { filePath: '/path/to/invalid.json' };
      
      (fs.existsSync as any).mockReturnValue(true);
      (fs.readFileSync as any).mockReturnValue('invalid json content');
      (path.resolve as any).mockReturnValue('/absolute/path/invalid.json');
      
      expect(() => validateVariableGroupUploadFile(mockParams, mockSpinner))
        .toThrow(AppcircleExitError);
      expect(() => validateVariableGroupUploadFile(mockParams, mockSpinner))
        .toThrow('Invalid JSON file');
      
      expect(mockSpinner.fail).toHaveBeenCalledWith('Invalid JSON file');
    });

    it('should handle tilde in file path', () => {
      const mockSpinner = { fail: vi.fn() };
      const mockParams = { filePath: '~/file.json' };
      
      (fs.existsSync as any).mockReturnValue(true);
      (fs.readFileSync as any).mockReturnValue('{}');
      (path.resolve as any).mockReturnValue('/home/testuser/file.json');
      
      const result = validateVariableGroupUploadFile(mockParams, mockSpinner);
      
      expect(result).toBe('/home/testuser/file.json');
      expect(path.resolve).toHaveBeenCalledWith('/home/testuser/file.json');
    });

    it('should handle params without variableGroupId', () => {
      const mockSpinner = { fail: vi.fn() };
      const mockParams: any = { filePath: '/path/to/file.json' };
      
      (fs.existsSync as any).mockReturnValue(true);
      (fs.readFileSync as any).mockReturnValue('{"test": true}');
      (path.resolve as any).mockReturnValue('/absolute/path/file.json');
      
      const result = validateVariableGroupUploadFile(mockParams, mockSpinner);
      
      expect(result).toBe('/absolute/path/file.json');
      expect(mockParams.variableGroupId).toBeUndefined();
    });

    it('should handle variableGroupId without parentheses', () => {
      const mockSpinner = { fail: vi.fn() };
      const mockParams = { 
        filePath: '/path/to/file.json', 
        variableGroupId: 'simple-group-id' 
      };
      
      (fs.existsSync as any).mockReturnValue(true);
      (fs.readFileSync as any).mockReturnValue('{}');
      (path.resolve as any).mockReturnValue('/absolute/path/file.json');
      
      const result = validateVariableGroupUploadFile(mockParams, mockSpinner);
      
      expect(result).toBe('/absolute/path/file.json');
      expect(mockParams.variableGroupId).toBe('simple-group-id');
    });
  });
});