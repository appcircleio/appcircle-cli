import { describe, it, expect, vi, beforeEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import os from 'os';

// Mock fs and path modules
vi.mock('fs', () => ({
  default: {
    existsSync: vi.fn(),
    readFileSync: vi.fn(),
  }
}));

vi.mock('path', () => ({
  default: {
    resolve: vi.fn(),
    join: vi.fn((...args) => args.join('/'))
  }
}));

vi.mock('os', () => ({
  default: {
    homedir: vi.fn()
  }
}));

import { expandAndValidateFilePath, readAndValidateJsonFile } from '../../../src/core/command-runner';

describe('Additional File Path Utilities', () => {
  const mockHomeDir = '/home/testuser';

  beforeEach(() => {
    vi.clearAllMocks();
    (os.homedir as any).mockReturnValue(mockHomeDir);
    (path.resolve as any).mockImplementation((p: string) => p);
  });

  describe('expandAndValidateFilePath', () => {
    it('should expand tilde and validate existing file', () => {
      (fs.existsSync as any).mockReturnValue(true);
      // expandTildeInPath now uses os.homedir() internally
      (path.resolve as any).mockImplementation((p: string) => p);

      const result = expandAndValidateFilePath('~/documents/file.txt', mockHomeDir);

      expect(fs.existsSync).toHaveBeenCalled();
      expect(result).toContain('documents/file.txt');
    });

    it('should throw error for non-existent file', () => {
      (fs.existsSync as any).mockReturnValue(false);
      (path.resolve as any).mockReturnValue('/home/testuser/missing.txt');

      expect(() => {
        expandAndValidateFilePath('~/missing.txt', mockHomeDir);
      }).toThrow('File not found: /home/testuser/missing.txt');
    });

    it('should handle absolute paths without tilde', () => {
      (fs.existsSync as any).mockReturnValue(true);
      (path.resolve as any).mockReturnValue('/absolute/path/file.txt');

      const result = expandAndValidateFilePath('/absolute/path/file.txt', mockHomeDir);

      expect(path.resolve).toHaveBeenCalledWith('/absolute/path/file.txt');
      expect(result).toBe('/absolute/path/file.txt');
    });

    it('should handle relative paths', () => {
      (fs.existsSync as any).mockReturnValue(true);
      (path.resolve as any).mockReturnValue('./relative/file.txt');

      const result = expandAndValidateFilePath('./relative/file.txt', mockHomeDir);

      expect(result).toBe('./relative/file.txt');
    });

    it('should handle empty home directory', () => {
      (fs.existsSync as any).mockReturnValue(true);
      // When home directory is empty, expandTildeInPath still uses os.homedir() internally
      (path.resolve as any).mockImplementation((p: string) => p);

      const result = expandAndValidateFilePath('~/file.txt', '');

      expect(fs.existsSync).toHaveBeenCalled();
      // Result will contain the actual home directory path since expandTildeInPath uses os.homedir()
      expect(result).toContain('file.txt');
    });

    it('should handle special characters in file paths', () => {
      (fs.existsSync as any).mockReturnValue(true);
      const specialPath = '/home/testuser/file with spaces & symbols.txt';
      (path.resolve as any).mockReturnValue(specialPath);

      const result = expandAndValidateFilePath('~/file with spaces & symbols.txt', mockHomeDir);

      expect(result).toBe(specialPath);
    });

    it('should handle unicode characters in file paths', () => {
      (fs.existsSync as any).mockReturnValue(true);
      const unicodePath = '/home/testuser/文件.txt';
      (path.resolve as any).mockReturnValue(unicodePath);

      const result = expandAndValidateFilePath('~/文件.txt', mockHomeDir);

      expect(result).toBe(unicodePath);
    });
  });

  describe('readAndValidateJsonFile', () => {
    it('should read and parse valid JSON file', () => {
      const mockJsonContent = { key: 'value', number: 123, array: [1, 2, 3] };
      (fs.readFileSync as any).mockReturnValue(JSON.stringify(mockJsonContent));

      const result = readAndValidateJsonFile('/path/to/file.json');

      expect(fs.readFileSync).toHaveBeenCalledWith('/path/to/file.json', 'utf8');
      expect(result).toEqual(mockJsonContent);
    });

    it('should throw error for invalid JSON syntax', () => {
      (fs.readFileSync as any).mockReturnValue('{ invalid json }');

      expect(() => {
        readAndValidateJsonFile('/path/to/invalid.json');
      }).toThrow('Invalid JSON file');
    });

    it('should handle empty JSON file', () => {
      (fs.readFileSync as any).mockReturnValue('{}');

      const result = readAndValidateJsonFile('/path/to/empty.json');

      expect(result).toEqual({});
    });

    it('should handle JSON array', () => {
      const mockArray = [1, 2, 3, { key: 'value' }];
      (fs.readFileSync as any).mockReturnValue(JSON.stringify(mockArray));

      const result = readAndValidateJsonFile('/path/to/array.json');

      expect(result).toEqual(mockArray);
    });

    it('should handle complex nested JSON', () => {
      const complexJson = {
        level1: {
          level2: {
            array: [{ nested: true }, { nested: false }],
            value: 'test'
          }
        },
        topLevel: 'value'
      };
      (fs.readFileSync as any).mockReturnValue(JSON.stringify(complexJson));

      const result = readAndValidateJsonFile('/path/to/complex.json');

      expect(result).toEqual(complexJson);
    });

    it('should throw error when fs.readFileSync throws', () => {
      (fs.readFileSync as any).mockImplementation(() => {
        throw new Error('File read error');
      });

      expect(() => {
        readAndValidateJsonFile('/path/to/file.json');
      }).toThrow('Invalid JSON file');
    });

    it('should handle JSON with special characters', () => {
      const specialJson = { 
        message: 'Hello "World"', 
        path: 'C:\\Users\\Test', 
        unicode: '测试数据' 
      };
      (fs.readFileSync as any).mockReturnValue(JSON.stringify(specialJson));

      const result = readAndValidateJsonFile('/path/to/special.json');

      expect(result).toEqual(specialJson);
    });

    it('should handle JSON with null and undefined values', () => {
      const jsonWithNulls = { 
        nullValue: null, 
        undefinedValue: undefined, 
        emptyString: '',
        zero: 0,
        false: false
      };
      // Note: undefined values are not serialized in JSON.stringify
      const expectedResult = { 
        nullValue: null, 
        emptyString: '',
        zero: 0,
        false: false
      };
      (fs.readFileSync as any).mockReturnValue(JSON.stringify(expectedResult));

      const result = readAndValidateJsonFile('/path/to/nulls.json');

      expect(result).toEqual(expectedResult);
    });

    it('should handle very large JSON file', () => {
      const largeObject = {};
      for (let i = 0; i < 1000; i++) {
        (largeObject as any)[`key${i}`] = `value${i}`;
      }
      (fs.readFileSync as any).mockReturnValue(JSON.stringify(largeObject));

      const result = readAndValidateJsonFile('/path/to/large.json');

      expect(result).toEqual(largeObject);
      expect(Object.keys(result)).toHaveLength(1000);
    });

    it('should handle JSON with escaped characters', () => {
      const escapedJson = {
        newline: 'line1\nline2',
        tab: 'col1\tcol2',
        quote: 'He said "Hello"',
        backslash: 'path\\to\\file'
      };
      (fs.readFileSync as any).mockReturnValue(JSON.stringify(escapedJson));

      const result = readAndValidateJsonFile('/path/to/escaped.json');

      expect(result).toEqual(escapedJson);
    });
  });

  describe('Error Handling Edge Cases', () => {
    it('should handle fs.existsSync throwing error in expandAndValidateFilePath', () => {
      (fs.existsSync as any).mockImplementation(() => {
        throw new Error('Permission denied');
      });

      expect(() => {
        expandAndValidateFilePath('~/file.txt', mockHomeDir);
      }).toThrow(); // The error from fs.existsSync should propagate
    });

    it('should handle path.resolve throwing error in expandAndValidateFilePath', () => {
      (path.resolve as any).mockImplementation(() => {
        throw new Error('Path resolution failed');
      });

      expect(() => {
        expandAndValidateFilePath('~/file.txt', mockHomeDir);
      }).toThrow('Path resolution failed');
    });
  });
});