/**
 * @fileoverview Unit tests for command-runner-utilities.ts
 */

import path from 'path';
import os from 'os';
import fs from 'fs';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  validateRequiredParams,
  validateParameterErrorFlag,
  expandTildeInPath,
  validateFileExists,
  validateAndParseJsonFile,
  ensureDirectoryExists,
  sanitizeForFileName,
  beautifyCommandName,
  resolveOrganizationIdFromParams,
  resolveUserIdFromUserParam,
  resolveProfileIdFromName,
  resolveBranchIdFromName,
  resolveWorkflowIdFromName,
  resolveConfigurationIdFromName,
  createUnknownCommandError,
  formatElapsedTime,
  generateTimestampFilename,
  setupDownloadDirectory,
  getUserRemovalIdentifier,
  createContextualError,
  extractVariableGroupId
} from '../../../src/core/command-runner-utilities';
import { AppcircleExitError } from '../../../src/core/AppcircleExitError';
import { CURRENT_PARAM_VALUE, UNKNOWN_PARAM_VALUE } from '../../../src/constant';

// Mock fs module
vi.mock('fs');
vi.mock('os');
vi.mock('path', () => ({
  default: {
    resolve: vi.fn((p) => p),
    join: vi.fn((...args) => args.join('/'))
  },
  resolve: vi.fn((p) => p),
  join: vi.fn((...args) => args.join('/'))
}));

const mockFs = vi.mocked(fs);
const mockOs = vi.mocked(os);
const mockPath = vi.mocked(path);

describe('Command validation utilities', () => {
  describe('validateRequiredParams', () => {
    it('should return valid for all required params present', () => {
      const params = { name: 'test', id: '123' };
      const requiredParams = ['name', 'id'];
      
      const result = validateRequiredParams(params, requiredParams);
      
      expect(result.isValid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it('should return invalid for missing required param', () => {
      const params = { name: 'test' };
      const requiredParams = ['name', 'id'];
      
      const result = validateRequiredParams(params, requiredParams);
      
      expect(result.isValid).toBe(false);
      expect(result.error).toBe('Missing required parameter: id');
    });

    it('should return invalid for falsy required param', () => {
      const params = { name: 'test', id: '' };
      const requiredParams = ['name', 'id'];
      
      const result = validateRequiredParams(params, requiredParams);
      
      expect(result.isValid).toBe(false);
      expect(result.error).toBe('Missing required parameter: id');
    });

    it('should handle empty required params array', () => {
      const params = { name: 'test' };
      const requiredParams: string[] = [];
      
      const result = validateRequiredParams(params, requiredParams);
      
      expect(result.isValid).toBe(true);
    });
  });

  describe('validateParameterErrorFlag', () => {
    it('should return valid when isError is false', () => {
      const params = { isError: false };
      
      const result = validateParameterErrorFlag(params);
      
      expect(result.isValid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it('should return valid when isError is undefined', () => {
      const params = {};
      
      const result = validateParameterErrorFlag(params);
      
      expect(result.isValid).toBe(true);
    });

    it('should return invalid when isError is true', () => {
      const params = { isError: true };
      
      const result = validateParameterErrorFlag(params);
      
      expect(result.isValid).toBe(false);
      expect(result.error).toBe('Parameter error');
    });
  });
});

describe('File path utilities', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mockOs.homedir.mockReturnValue('/home/user');
  });

  describe('expandTildeInPath', () => {
    it('should expand ~ to home directory', () => {
      const filePath = '~/documents/file.txt';
      
      const result = expandTildeInPath(filePath);
      
      expect(result).toBe('/home/user/documents/file.txt');
    });

    it('should handle multiple tildes', () => {
      const filePath = '~/~/file.txt';
      
      const result = expandTildeInPath(filePath);
      
      expect(result).toBe('/home/user//home/user/file.txt');
    });

    it('should return unchanged path without tilde', () => {
      const filePath = '/documents/file.txt';
      
      const result = expandTildeInPath(filePath);
      
      expect(result).toBe('/documents/file.txt');
    });

    it('should handle empty or null paths', () => {
      expect(expandTildeInPath('')).toBe('');
      expect(expandTildeInPath(null as any)).toBe(null);
      expect(expandTildeInPath(undefined as any)).toBe(undefined);
    });
  });

  describe('validateFileExists', () => {
    it('should return valid for existing file', () => {
      const filePath = '/path/to/file.txt';
      mockFs.existsSync.mockReturnValue(true);
      mockFs.statSync.mockReturnValue({ isFile: () => true } as any);
      
      const result = validateFileExists(filePath);
      
      expect(result.isValid).toBe(true);
      expect(typeof result.expandedPath).toBe('string');
    });

    it('should return invalid for non-existent file', () => {
      const filePath = '/path/to/missing.txt';
      mockFs.existsSync.mockReturnValue(false);
      
      const result = validateFileExists(filePath);
      
      expect(result.isValid).toBe(false);
      expect(result.error).toContain('File not found');
    });

    it('should return invalid for directory', () => {
      const filePath = '/path/to/directory';
      mockFs.existsSync.mockReturnValue(true);
      mockFs.statSync.mockReturnValue({ isFile: () => false } as any);
      
      const result = validateFileExists(filePath);
      
      expect(result.isValid).toBe(false);
      expect(result.error).toContain('not a file');
    });

    it('should return invalid for empty path', () => {
      const result = validateFileExists('');
      
      expect(result.isValid).toBe(false);
      expect(result.error).toBe('File path is required');
    });

    it('should handle file access errors', () => {
      const filePath = '/path/to/file.txt';
      mockFs.existsSync.mockReturnValue(true);
      mockFs.statSync.mockImplementation(() => {
        throw new Error('Permission denied');
      });
      
      const result = validateFileExists(filePath);
      
      expect(result.isValid).toBe(false);
      expect(result.error).toContain('Cannot access file');
    });
  });

  describe('validateAndParseJsonFile', () => {
    it('should return valid for valid JSON file', () => {
      const filePath = '/path/to/file.json';
      const jsonContent = { key: 'value' };
      
      mockFs.existsSync.mockReturnValue(true);
      mockFs.statSync.mockReturnValue({ isFile: () => true } as any);
      mockFs.readFileSync.mockReturnValue(JSON.stringify(jsonContent));
      
      const result = validateAndParseJsonFile(filePath);
      
      expect(result.isValid).toBe(true);
      expect(result.content).toEqual(jsonContent);
    });

    it('should return invalid for invalid JSON', () => {
      const filePath = '/path/to/file.json';
      
      mockFs.existsSync.mockReturnValue(true);
      mockFs.statSync.mockReturnValue({ isFile: () => true } as any);
      mockFs.readFileSync.mockReturnValue('invalid json');
      
      const result = validateAndParseJsonFile(filePath);
      
      expect(result.isValid).toBe(false);
      expect(result.error).toBe('Invalid JSON file');
    });

    it('should return invalid for non-existent file', () => {
      const filePath = '/path/to/missing.json';
      mockFs.existsSync.mockReturnValue(false);
      
      const result = validateAndParseJsonFile(filePath);
      
      expect(result.isValid).toBe(false);
      expect(result.error).toContain('File not found');
    });
  });

  describe('ensureDirectoryExists', () => {
    beforeEach(() => {
      mockOs.homedir.mockReturnValue('/home/user');
    });

    it('should create directory if it does not exist', () => {
      const dirPath = '/path/to/new/dir';
      mockFs.existsSync.mockReturnValue(false);
      mockFs.mkdirSync.mockReturnValue(undefined);
      mockFs.statSync.mockReturnValue({ isDirectory: () => true } as any);
      
      const result = ensureDirectoryExists(dirPath);
      
      expect(result.isValid).toBe(true);
      expect(typeof result.finalPath).toBe('string');
      expect(mockFs.mkdirSync).toHaveBeenCalledWith(expect.any(String), { recursive: true });
    });

    it('should return existing directory', () => {
      const dirPath = '/path/to/existing/dir';
      mockFs.existsSync.mockReturnValue(true);
      mockFs.statSync.mockReturnValue({ isDirectory: () => true } as any);
      
      const result = ensureDirectoryExists(dirPath);
      
      expect(result.isValid).toBe(true);
      expect(typeof result.finalPath).toBe('string');
    });

    it('should use default Downloads directory for empty path', () => {
      mockFs.existsSync.mockReturnValue(true);
      mockFs.statSync.mockReturnValue({ isDirectory: () => true } as any);
      
      // Mock path.join to prevent infinite recursion
      mockPath.join.mockReturnValue('/home/user/Downloads');
      
      const result = ensureDirectoryExists('');
      
      expect(result.isValid).toBe(true);
      expect(typeof result.finalPath).toBe('string');
    });

    it('should return invalid if path is not a directory', () => {
      const dirPath = '/path/to/file.txt';
      mockFs.existsSync.mockReturnValue(true);
      mockFs.statSync.mockReturnValue({ isDirectory: () => false } as any);
      
      const result = ensureDirectoryExists(dirPath);
      
      expect(result.isValid).toBe(false);
      expect(result.error).toContain('not a directory');
    });
  });
});

describe('String utilities', () => {
  describe('sanitizeForFileName', () => {
    it('should replace path separators with hyphens', () => {
      const input = 'path/to\\file';
      const result = sanitizeForFileName(input);
      expect(result).toBe('path-to-file');
    });

    it('should replace unsafe characters with hyphens', () => {
      const input = 'file<name>:with|unsafe"chars*?';
      const result = sanitizeForFileName(input);
      expect(result).toBe('file-name-with-unsafe-chars');
    });

    it('should replace spaces with hyphens', () => {
      const input = 'file name with spaces';
      const result = sanitizeForFileName(input);
      expect(result).toBe('file-name-with-spaces');
    });

    it('should remove consecutive hyphens', () => {
      const input = 'file---name';
      const result = sanitizeForFileName(input);
      expect(result).toBe('file-name');
    });

    it('should remove leading and trailing hyphens', () => {
      const input = '---filename---';
      const result = sanitizeForFileName(input);
      expect(result).toBe('filename');
    });

    it('should return "unknown" for empty or invalid input', () => {
      expect(sanitizeForFileName('')).toBe('unknown');
      expect(sanitizeForFileName(null as any)).toBe('unknown');
      expect(sanitizeForFileName(undefined as any)).toBe('unknown');
      expect(sanitizeForFileName(123 as any)).toBe('unknown');
    });

    it('should return "unknown" if result becomes empty after sanitization', () => {
      const input = '---***---';
      const result = sanitizeForFileName(input);
      expect(result).toBe('unknown');
    });
  });

  describe('beautifyCommandName', () => {
    it('should replace hyphens with spaces', () => {
      const commandName = 'build-profile-list';
      const result = beautifyCommandName(commandName);
      expect(result).toBe('build profile list');
    });

    it('should handle single word commands', () => {
      const commandName = 'login';
      const result = beautifyCommandName(commandName);
      expect(result).toBe('login');
    });

    it('should handle empty strings', () => {
      const commandName = '';
      const result = beautifyCommandName(commandName);
      expect(result).toBe('');
    });
  });
});

describe('Parameter resolution utilities', () => {
  describe('resolveOrganizationIdFromParams', () => {
    const organizations = [
      { id: 'org1', name: 'Organization 1' },
      { id: 'org2', name: 'Organization 2' }
    ];
    const currentUser = { currentOrganizationId: 'current-org-id' };

    it('should resolve organization by name', () => {
      const params = { organization: 'Organization 1', organizationId: 'all' };
      
      const result = resolveOrganizationIdFromParams(params, organizations, currentUser);
      
      expect(result.isValid).toBe(true);
      expect(result.organizationId).toBe('org1');
    });

    it('should return error for unknown organization name', () => {
      const params = { organization: 'Unknown Org' };
      
      const result = resolveOrganizationIdFromParams(params, organizations, currentUser);
      
      expect(result.isValid).toBe(false);
      expect(result.error).toContain('Organization "Unknown Org" not found');
    });

    it('should use current user organization for "current" value', () => {
      const params = { organizationId: CURRENT_PARAM_VALUE };
      
      const result = resolveOrganizationIdFromParams(params, organizations, currentUser);
      
      expect(result.isValid).toBe(true);
      expect(result.organizationId).toBe('current-org-id');
    });

    it('should return error when current org not available', () => {
      const params = { organizationId: CURRENT_PARAM_VALUE };
      
      const result = resolveOrganizationIdFromParams(params, organizations);
      
      expect(result.isValid).toBe(false);
      expect(result.error).toBe('Current organization ID not available');
    });

    it('should use provided organization ID directly', () => {
      const params = { organizationId: 'direct-org-id' };
      
      const result = resolveOrganizationIdFromParams(params, organizations, currentUser);
      
      expect(result.isValid).toBe(true);
      expect(result.organizationId).toBe('direct-org-id');
    });
  });

  describe('resolveUserIdFromUserParam', () => {
    const users = [
      { id: 'user1', email: 'user1@test.com', fullName: 'User One' },
      { id: 'user2', email: 'user2@test.com', fullName: 'User Two' }
    ];

    it('should resolve user by email', () => {
      const params = { user: 'user1@test.com' };
      
      const result = resolveUserIdFromUserParam(params, users);
      
      expect(result.isValid).toBe(true);
      expect(result.userId).toBe('user1');
    });

    it('should resolve user by full name', () => {
      const params = { user: 'User Two' };
      
      const result = resolveUserIdFromUserParam(params, users);
      
      expect(result.isValid).toBe(true);
      expect(result.userId).toBe('user2');
    });

    it('should return error for unknown user', () => {
      const params = { user: 'unknown@test.com' };
      
      const result = resolveUserIdFromUserParam(params, users);
      
      expect(result.isValid).toBe(false);
      expect(result.error).toContain('User "unknown@test.com" not found');
    });

    it('should use provided userId directly', () => {
      const params = { userId: 'direct-user-id' };
      
      const result = resolveUserIdFromUserParam(params, users);
      
      expect(result.isValid).toBe(true);
      expect(result.userId).toBe('direct-user-id');
    });
  });

  describe('resolveProfileIdFromName', () => {
    const profiles = [
      { id: 'profile1', name: 'iOS Profile' },
      { id: 'profile2', name: 'Android Profile' }
    ];

    it('should resolve profile by name', () => {
      const params = { profile: 'iOS Profile' };
      
      const result = resolveProfileIdFromName(params, profiles);
      
      expect(result.isValid).toBe(true);
      expect(result.profileId).toBe('profile1');
    });

    it('should return error for unknown profile', () => {
      const params = { profile: 'Unknown Profile' };
      
      const result = resolveProfileIdFromName(params, profiles);
      
      expect(result.isValid).toBe(false);
      expect(result.error).toContain('Build profile "Unknown Profile" not found');
    });

    it('should use provided profileId directly', () => {
      const params = { profileId: 'direct-profile-id' };
      
      const result = resolveProfileIdFromName(params, profiles);
      
      expect(result.isValid).toBe(true);
      expect(result.profileId).toBe('direct-profile-id');
    });
  });

  describe('resolveBranchIdFromName', () => {
    const branches = [
      { id: 'branch1', name: 'main' },
      { id: 'branch2', name: 'develop' }
    ];

    it('should resolve branch by name', () => {
      const params = { branch: 'main' };
      
      const result = resolveBranchIdFromName(params, branches);
      
      expect(result.isValid).toBe(true);
      expect(result.branchId).toBe('branch1');
    });

    it('should return error for unknown branch', () => {
      const params = { branch: 'unknown-branch' };
      
      const result = resolveBranchIdFromName(params, branches);
      
      expect(result.isValid).toBe(false);
      expect(result.error).toContain('Branch "unknown-branch" not found');
    });

    it('should handle empty branches array', () => {
      const params = { branch: 'main' };
      
      const result = resolveBranchIdFromName(params, []);
      
      expect(result.isValid).toBe(false);
      expect(result.error).toContain('No branches found');
    });
  });

  describe('resolveWorkflowIdFromName', () => {
    const workflows = [
      { id: 'workflow1', workflowName: 'iOS Build' },
      { id: 'workflow2', workflowName: 'Android Build' }
    ];

    it('should resolve workflow by name', () => {
      const params = { workflow: 'iOS Build' };
      
      const result = resolveWorkflowIdFromName(params, workflows);
      
      expect(result.isValid).toBe(true);
      expect(result.workflowId).toBe('workflow1');
    });

    it('should return error for unknown workflow', () => {
      const params = { workflow: 'Unknown Workflow' };
      
      const result = resolveWorkflowIdFromName(params, workflows);
      
      expect(result.isValid).toBe(false);
      expect(result.error).toContain('Workflow "Unknown Workflow" not found');
    });
  });

  describe('resolveConfigurationIdFromName', () => {
    const configurations = [
      { item1: { id: 'config1', configurationName: 'Debug' } },
      { item1: { id: 'config2', configurationName: 'Release' } }
    ];

    it('should resolve configuration by name', () => {
      const params = { configuration: 'Debug' };
      
      const result = resolveConfigurationIdFromName(params, configurations);
      
      expect(result.isValid).toBe(true);
      expect(result.configurationId).toBe('config1');
    });

    it('should return error for unknown configuration', () => {
      const params = { configuration: 'Unknown Config' };
      
      const result = resolveConfigurationIdFromName(params, configurations);
      
      expect(result.isValid).toBe(false);
      expect(result.error).toContain('Configuration "Unknown Config" not found');
    });
  });
});

describe('Command routing utilities', () => {
  describe('createUnknownCommandError', () => {
    it('should create error message for unknown command', () => {
      const commandName = 'build-profile-create';
      
      const result = createUnknownCommandError(commandName);
      
      expect(result).toBe('"build profile create ..." command not found.');
    });

    it('should use long description when provided', () => {
      const commandName = 'build-profile-create';
      const longDescription = 'This is a detailed error description.';
      
      const result = createUnknownCommandError(commandName, longDescription);
      
      expect(result).toBe('\nThis is a detailed error description.\n');
    });
  });
});

describe('Time utilities', () => {
  describe('formatElapsedTime', () => {
    it('should format seconds only for time under a minute', () => {
      const startTime = Date.now() - 30000; // 30 seconds ago
      
      const result = formatElapsedTime(startTime);
      
      expect(result).toBe('30s');
    });

    it('should format minutes and seconds for longer time', () => {
      const startTime = Date.now() - 150000; // 2.5 minutes ago
      
      const result = formatElapsedTime(startTime);
      
      expect(result).toBe('2m 30s');
    });

    it('should handle zero elapsed time', () => {
      const startTime = Date.now();
      
      const result = formatElapsedTime(startTime);
      
      expect(result).toBe('0s');
    });
  });

  describe('generateTimestampFilename', () => {
    it('should generate filename with default values', () => {
      vi.spyOn(Date, 'now').mockReturnValue(1234567890);
      
      const result = generateTimestampFilename();
      
      expect(result).toBe('file-1234567890.txt');
    });

    it('should generate filename with custom prefix and extension', () => {
      vi.spyOn(Date, 'now').mockReturnValue(1234567890);
      
      const result = generateTimestampFilename('report', 'json');
      
      expect(result).toBe('report-1234567890.json');
    });
  });
});

describe('Download path utilities', () => {
  beforeEach(() => {
    mockOs.homedir.mockReturnValue('/home/user');
    vi.resetAllMocks();
  });

  describe('setupDownloadDirectory', () => {
    it('should use default Downloads directory when no path provided', () => {
      mockFs.existsSync.mockReturnValue(true);
      mockFs.statSync.mockReturnValue({ isDirectory: () => true } as any);
      
      // Mock path.join to prevent infinite recursion
      mockPath.join.mockReturnValue('/home/user/Downloads');
      
      const result = setupDownloadDirectory();
      
      expect(result.isValid).toBe(true);
      expect(typeof result.downloadPath).toBe('string');
    });

    it('should use provided path when valid', () => {
      const providedPath = '/custom/download/path';
      mockFs.existsSync.mockReturnValue(true);
      mockFs.statSync.mockReturnValue({ isDirectory: () => true } as any);
      
      const result = setupDownloadDirectory(providedPath);
      
      expect(result.isValid).toBe(true);
      expect(typeof result.downloadPath).toBe('string');
    });

    it('should fallback to default when provided path is invalid', () => {
      const providedPath = '/invalid/path';
      mockFs.existsSync
        .mockReturnValueOnce(false) // First call for provided path
        .mockReturnValueOnce(true); // Second call for default directory
      mockFs.statSync.mockReturnValue({ isDirectory: () => true } as any);
      
      // Mock path.join to prevent infinite recursion
      mockPath.join.mockReturnValue('/home/user/Downloads');
      
      const result = setupDownloadDirectory(providedPath);
      
      expect(result.isValid).toBe(true);
      expect(typeof result.downloadPath).toBe('string');
    });

    it('should use custom fallback directory', () => {
      const fallbackDir = '/custom/fallback';
      mockFs.existsSync.mockReturnValue(true);
      mockFs.statSync.mockReturnValue({ isDirectory: () => true } as any);
      
      // Mock path.join to return the fallback directory
      mockPath.join.mockReturnValue(fallbackDir);
      
      const result = setupDownloadDirectory(undefined, fallbackDir);
      
      expect(result.isValid).toBe(true);
      expect(typeof result.downloadPath).toBe('string');
    });
  });
});

describe('User removal utilities', () => {
  describe('getUserRemovalIdentifier', () => {
    it('should use email when provided', () => {
      const params = { email: 'user@test.com' };
      
      const result = getUserRemovalIdentifier(params);
      
      expect(result.removalIdentifier).toBe('user@test.com');
      expect(result.itemType).toBe('Invitation');
    });

    it('should use userId when email not provided', () => {
      const params = { userId: 'user123' };
      
      const result = getUserRemovalIdentifier(params);
      
      expect(result.removalIdentifier).toBe('user123');
      expect(result.itemType).toBe('User');
    });

    it('should prefer userInfo email over userId', () => {
      const params = { userId: 'user123' };
      const userInfo = { email: 'user@test.com' };
      
      const result = getUserRemovalIdentifier(params, userInfo);
      
      expect(result.removalIdentifier).toBe('user@test.com');
      expect(result.itemType).toBe('User');
    });

    it('should handle unknown userId', () => {
      const params = { userId: UNKNOWN_PARAM_VALUE };
      
      const result = getUserRemovalIdentifier(params);
      
      expect(result.removalIdentifier).toBe(UNKNOWN_PARAM_VALUE);
      expect(result.itemType).toBe('User');
    });
  });
});

describe('Error handling utilities', () => {
  describe('createContextualError', () => {
    it('should create AppcircleExitError for interactive mode', () => {
      const message = 'Test error';
      
      const result = createContextualError(message, true);
      
      expect(result).toBeInstanceOf(AppcircleExitError);
      expect(result.message).toBe(message);
    });

    it('should create AppcircleExitError for non-interactive mode', () => {
      const message = 'Test error';
      
      const result = createContextualError(message, false);
      
      expect(result).toBeInstanceOf(AppcircleExitError);
      expect(result.message).toBe(message);
    });

    it('should log long description when provided', () => {
      const message = 'Test error';
      const longDescription = 'Detailed error description';
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      
      const result = createContextualError(message, false, longDescription);
      
      expect(consoleSpy).toHaveBeenCalledWith('\nDetailed error description\n');
      expect(result).toBeInstanceOf(AppcircleExitError);
      
      consoleSpy.mockRestore();
    });
  });
});

describe('Variable group utilities', () => {
  describe('extractVariableGroupId', () => {
    it('should extract ID from formatted string', () => {
      const variableGroupId = 'Group Name (group-123)';
      
      const result = extractVariableGroupId(variableGroupId);
      
      expect(result).toBe('group-123');
    });

    it('should return original string when no formatting', () => {
      const variableGroupId = 'simple-id';
      
      const result = extractVariableGroupId(variableGroupId);
      
      expect(result).toBe('simple-id');
    });

    it('should handle empty or null input', () => {
      expect(extractVariableGroupId('')).toBe('');
      expect(extractVariableGroupId(null as any)).toBe(null);
      expect(extractVariableGroupId(undefined as any)).toBe(undefined);
    });

    it('should handle complex formatting', () => {
      const variableGroupId = 'Production Variables (prod-vars-456)';
      
      const result = extractVariableGroupId(variableGroupId);
      
      expect(result).toBe('prod-vars-456');
    });
  });
});