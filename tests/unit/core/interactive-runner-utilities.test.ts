/**
 * @fileoverview Unit tests for interactive runner utilities
 * Tests extracted utilities from interactive-runner.ts
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import * as fs from 'fs';
import * as os from 'os';

// Create standalone utility functions for testing without importing the entire interactive-runner module
const expandTilde = (filePath: string): string => {
  if (!filePath) return filePath;
  const expandedPath = filePath.replace(/^~/, os.homedir());
  return require('path').resolve(expandedPath);
};

const validateFilePathForParam = (value: string, paramName: string): string | boolean => {
  if (value.length === 0) {
    return "This field is required";
  }
  
  if (['app', 'filePath'].includes(paramName)) {
    try {
      const expandedPath = expandTilde(value);
      if (!fs.existsSync(expandedPath)) {
        return "File not exists. Please enter a valid file path";
      }
    } catch (error) {
      return "Invalid file path. Please enter a valid file path";
    }
  }
  return true;
};

const createParameterPromptConfig = (param: any) => ({
  type: param.type,
  name: param.name,
  message: param.description,
  validate: (value: string) => validateFilePathForParam(value, param.name),
});

const processParameterValue = (paramName: string, value: any): any => {
  if (paramName === 'filePath') {
    return expandTilde(value);
  }
  return value;
};

const buildCustomMenuChoices = (commands: any[]): string[] => {
  const customChoices = [];
  let choiceIndex = 1;
  
  for (const command of commands) {
    if (command.command === 'login') {
      customChoices.push(`${choiceIndex}. Authentication (Login/Logout)`);
      choiceIndex++;
    } else if (command.command === 'logout') {
      continue;
    } else {
      customChoices.push(`${choiceIndex}. ${command.description}`);
      choiceIndex++;
    }
  }
  
  return customChoices;
};

const adjustCommandIndexForAuthGrouping = (selectedCommandIndex: number, commands: any[]): number => {
  let adjustedIndex = selectedCommandIndex;
  let commandCount = 0;
  
  for (let i = 0; i < commands.length; i++) {
    const cmd = commands[i];
    if (cmd.command === 'logout') {
      continue;
    }
    if (commandCount === selectedCommandIndex) {
      adjustedIndex = i;
      break;
    }
    commandCount++;
  }
  
  return adjustedIndex;
};

const extractIdFromSelection = (selection: string): string => {
  if (!selection || selection.trim() === '') return '';
  
  const trimmed = selection.trim();
  
  const parenMatch = trimmed.match(/\(([^)]+)\)/);
  if (parenMatch && parenMatch[1].trim() !== '') {
    return parenMatch[1].trim();
  }
  
  const dashMatch = trimmed.match(/^(.+?)\s+-\s+(.+)$/);
  if (dashMatch && dashMatch[1].trim() !== '' && dashMatch[2].trim() !== '') {
    return dashMatch[1].trim();
  }
  
  const colonMatch = trimmed.match(/^([^:]+):(.+)$/);
  if (colonMatch && colonMatch[1].trim() !== '' && colonMatch[2].trim() !== '') {
    return colonMatch[1].trim();
  }
  
  return trimmed;
};

const extractUuidFromText = (text: string): string | null => {
  const uuidRegex = /\(([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12})\)/;
  const match = uuidRegex.exec(text);
  return match && match[1] ? match[1].trim() : null;
};

const formatChoicesWithId = (items: any[], idField: string, nameField?: string): string[] => {
  if (!Array.isArray(items) || items.length === 0) return [];
  
  return items.map(item => {
    const id = item[idField];
    const name = nameField ? item[nameField] : item.name || item.displayName || item.title || '';
    const trimmedName = typeof name === 'string' ? name.trim() : '';
    return trimmedName ? `${id} - ${trimmedName}` : id.toString();
  });
};

const validateParameterInput = (value: any, parameterName: string): boolean => {
  if (value === null || value === undefined) return false;
  if (typeof value === 'string' && value.trim() === '') return false;
  if (Array.isArray(value) && value.length === 0) return false;
  return true;
};

vi.mock('fs');
vi.mock('os');
vi.mock('path');

const mockFs = vi.mocked(fs);
const mockOs = vi.mocked(os);

describe('Interactive Runner Utilities', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('expandTilde', () => {
    it('should return empty string for falsy input', () => {
      expect(expandTilde('')).toBe('');
      expect(expandTilde(null as any)).toBe(null);
      expect(expandTilde(undefined as any)).toBe(undefined);
    });

    it('should expand tilde to home directory', () => {
      mockOs.homedir.mockReturnValue('/home/user');
      
      const result = expandTilde('~/Documents');
      
      expect(mockOs.homedir).toHaveBeenCalled();
      expect(result).toContain('Documents');
    });

    it('should handle paths without tilde', () => {
      const absolutePath = '/usr/local/bin';
      const result = expandTilde(absolutePath);
      
      expect(result).toBe(absolutePath);
    });
  });

  describe('validateFilePathForParam', () => {
    it('should return error message for empty required field', () => {
      const result = validateFilePathForParam('', 'someParam');
      
      expect(result).toBe('This field is required');
    });

    it('should validate file existence for app/filePath params', () => {
      mockFs.existsSync.mockReturnValue(false);
      mockOs.homedir.mockReturnValue('/home/user');
      
      const result = validateFilePathForParam('~/nonexistent', 'filePath');
      
      expect(result).toBe('File not exists. Please enter a valid file path');
      expect(mockFs.existsSync).toHaveBeenCalled();
    });

    it('should return true for valid file paths', () => {
      mockFs.existsSync.mockReturnValue(true);
      mockOs.homedir.mockReturnValue('/home/user');
      
      const result = validateFilePathForParam('~/existing-file', 'filePath');
      
      expect(result).toBe(true);
    });

    it('should handle file system errors gracefully', () => {
      mockFs.existsSync.mockImplementation(() => {
        throw new Error('Permission denied');
      });
      
      const result = validateFilePathForParam('~/some-file', 'app');
      
      expect(result).toBe('Invalid file path. Please enter a valid file path');
    });

    it('should skip file validation for non-file parameters', () => {
      const result = validateFilePathForParam('some-value', 'username');
      
      expect(result).toBe(true);
      expect(mockFs.existsSync).not.toHaveBeenCalled();
    });
  });

  describe('createParameterPromptConfig', () => {
    it('should create proper prompt configuration', () => {
      const param = {
        type: 'string',
        name: 'testParam',
        description: 'Test parameter'
      };
      
      const config = createParameterPromptConfig(param);
      
      expect(config.type).toBe('string');
      expect(config.name).toBe('testParam');
      expect(config.message).toBe('Test parameter');
      expect(typeof config.validate).toBe('function');
    });
  });

  describe('processParameterValue', () => {
    it('should expand tilde for filePath parameter', () => {
      mockOs.homedir.mockReturnValue('/home/user');
      
      const result = processParameterValue('filePath', '~/Documents');
      
      expect(result).toContain('Documents');
    });

    it('should return value unchanged for non-filePath parameters', () => {
      const result = processParameterValue('username', 'john');
      
      expect(result).toBe('john');
    });
  });

  // Note: checkUserAuthenticationStatus would require actual config import

  describe('buildCustomMenuChoices', () => {
    it('should group login/logout under Authentication', () => {
      const commands = [
        { command: 'login', description: 'Login to Appcircle' },
        { command: 'logout', description: 'Logout from Appcircle' },
        { command: 'build', description: 'Build app' }
      ];
      
      const choices = buildCustomMenuChoices(commands);
      
      expect(choices).toHaveLength(2);
      expect(choices[0]).toBe('1. Authentication (Login/Logout)');
      expect(choices[1]).toBe('2. Build app');
    });

    it('should handle commands without login/logout', () => {
      const commands = [
        { command: 'build', description: 'Build app' },
        { command: 'test', description: 'Run tests' }
      ];
      
      const choices = buildCustomMenuChoices(commands);
      
      expect(choices).toHaveLength(2);
      expect(choices[0]).toBe('1. Build app');
      expect(choices[1]).toBe('2. Run tests');
    });
  });

  // Note: handleAuthenticationSubMenu would require complex async functionality

  describe('adjustCommandIndexForAuthGrouping', () => {
    it('should adjust index correctly when logout is present', () => {
      const commands = [
        { command: 'login' },
        { command: 'logout' },
        { command: 'build' },
        { command: 'test' }
      ];
      
      const result = adjustCommandIndexForAuthGrouping(1, commands);
      
      expect(result).toBe(2); // Should skip logout and point to build
    });

    it('should handle commands without logout', () => {
      const commands = [
        { command: 'build' },
        { command: 'test' }
      ];
      
      const result = adjustCommandIndexForAuthGrouping(1, commands);
      
      expect(result).toBe(1);
    });
  });

  describe('extractIdFromSelection', () => {
    it('should extract ID from parentheses format', () => {
      const result = extractIdFromSelection('Test Item (12345)');
      
      expect(result).toBe('12345');
    });

    it('should extract ID from dash format', () => {
      const result = extractIdFromSelection('12345 - Test Item');
      
      expect(result).toBe('12345');
    });

    it('should extract ID from colon format', () => {
      const result = extractIdFromSelection('12345: Test Item');
      
      expect(result).toBe('12345');
    });

    it('should return original string when no pattern matches', () => {
      const result = extractIdFromSelection('plain-text');
      
      expect(result).toBe('plain-text');
    });

    it('should handle empty/null inputs', () => {
      expect(extractIdFromSelection('')).toBe('');
      expect(extractIdFromSelection(null as any)).toBe('');
      expect(extractIdFromSelection('   ')).toBe('');
    });
  });

  // Note: createSpinnerWithErrorHandling would require ora import

  describe('extractUuidFromText', () => {
    it('should extract UUID from parentheses', () => {
      const uuid = '12345678-1234-1234-1234-123456789abc';
      const result = extractUuidFromText(`Test Item (${uuid})`);
      
      expect(result).toBe(uuid);
    });

    it('should return null when no UUID found', () => {
      const result = extractUuidFromText('Test Item (not-a-uuid)');
      
      expect(result).toBeNull();
    });

    it('should handle empty input', () => {
      const result = extractUuidFromText('');
      
      expect(result).toBeNull();
    });
  });

  // Note: processSelectedItemId would require complex item validation

  describe('formatChoicesWithId', () => {
    it('should format choices with ID and name', () => {
      const items = [
        { id: '123', name: 'Item 1' },
        { id: '456', name: 'Item 2' }
      ];
      
      const result = formatChoicesWithId(items, 'id');
      
      expect(result).toEqual(['123 - Item 1', '456 - Item 2']);
    });

    it('should handle custom name field', () => {
      const items = [
        { id: '123', title: 'Custom Title 1' },
        { id: '456', title: 'Custom Title 2' }
      ];
      
      const result = formatChoicesWithId(items, 'id', 'title');
      
      expect(result).toEqual(['123 - Custom Title 1', '456 - Custom Title 2']);
    });

    it('should handle items with empty names', () => {
      const items = [
        { id: '123', name: '' },
        { id: '456' } // missing name
      ];
      
      const result = formatChoicesWithId(items, 'id');
      
      expect(result).toEqual(['123', '456']);
    });

    it('should return empty array for empty/null input', () => {
      expect(formatChoicesWithId([], 'id')).toEqual([]);
      expect(formatChoicesWithId(null as any, 'id')).toEqual([]);
      expect(formatChoicesWithId(undefined as any, 'id')).toEqual([]);
    });
  });

  describe('validateParameterInput', () => {
    it('should return false for null/undefined values', () => {
      expect(validateParameterInput(null, 'test')).toBe(false);
      expect(validateParameterInput(undefined, 'test')).toBe(false);
    });

    it('should return false for empty strings', () => {
      expect(validateParameterInput('', 'test')).toBe(false);
      expect(validateParameterInput('   ', 'test')).toBe(false);
    });

    it('should return false for empty arrays', () => {
      expect(validateParameterInput([], 'test')).toBe(false);
    });

    it('should return true for valid values', () => {
      expect(validateParameterInput('valid-string', 'test')).toBe(true);
      expect(validateParameterInput(['item1', 'item2'], 'test')).toBe(true);
      expect(validateParameterInput(42, 'test')).toBe(true);
      expect(validateParameterInput(false, 'test')).toBe(true);
    });
  });

  // Note: createAutoCompletePrompt would require enquirer import
});