/**
 * @fileoverview Unit tests for main-utilities.ts
 * Tests extracted utility functions from main.ts for better coverage and testability
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { CommandType } from '../../../src/core/commands';

// Mock dependencies
vi.mock('../../../src/config', () => ({
  getConsoleOutputType: vi.fn(() => 'plain')
}));

vi.mock('axios', () => ({
  default: {
    isAxiosError: vi.fn(() => false)
  },
  isAxiosError: vi.fn(() => false)
}));

// Import utilities after mocking dependencies
import {
  shouldFallbackToInteractive,
  validateSubCommand,
  handleInvalidSubCommandError,
  shouldRunInteractive,
  getOutputType,
  handleMainExecutionError,
  processCommandLineArguments,
  modifyProcessArgv,
  validateCommandStructure,
  createCommandMap
} from '../../../src/core/main-utilities';

describe('Main Utilities', () => {
  let mockConsoleError: any;
  let mockProcessExit: any;
  let originalArgv: string[];

  const mockCommands: CommandType[] = [
    {
      command: 'config',
      description: 'Configuration commands',
      params: [],
      subCommands: [
        {
          command: 'list',
          description: 'List configuration',
          params: []
        },
        {
          command: 'set',
          description: 'Set configuration',
          params: []
        }
      ]
    },
    {
      command: 'login',
      description: 'Login to Appcircle',
      params: []
    },
    {
      command: 'build',
      description: 'Build commands',
      params: [],
      subCommands: [
        {
          command: 'start',
          description: 'Start build',
          params: []
        }
      ]
    }
  ];

  beforeEach(() => {
    originalArgv = [...process.argv];
    mockConsoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
    mockProcessExit = vi.spyOn(process, 'exit').mockImplementation((code?: string | number | null | undefined) => {
      throw new Error(`Process exit with code: ${code}`);
    });
    vi.clearAllMocks();
  });

  afterEach(() => {
    process.argv = originalArgv;
    mockConsoleError.mockRestore();
    mockProcessExit.mockRestore();
  });

  describe('shouldFallbackToInteractive', () => {
    it('should return false for login with Personal Access Key', () => {
      const argv = { _: ['login'], secret: 'key123' };
      
      const result = shouldFallbackToInteractive(argv, mockCommands);
      
      expect(result).toBe(false);
    });

    it('should return false for login with PAT token (legacy)', () => {
      const argv = { _: ['login'], token: 'pat123' };
      
      const result = shouldFallbackToInteractive(argv, mockCommands);
      
      expect(result).toBe(false);
    });

    it('should return true for login without PAT token', () => {
      const argv = { _: ['login'] };
      
      const result = shouldFallbackToInteractive(argv, mockCommands);
      
      expect(result).toBe(true);
    });

    it('should return true for single valid command without special handling', () => {
      const argv = { _: ['config'] };
      
      const result = shouldFallbackToInteractive(argv, mockCommands);
      
      expect(result).toBe(true);
    });

    it('should return false for multiple arguments', () => {
      const argv = { _: ['config', 'list'] };
      
      const result = shouldFallbackToInteractive(argv, mockCommands);
      
      expect(result).toBe(false);
    });

    it('should return false for unknown single command', () => {
      const argv = { _: ['unknown'] };
      
      const result = shouldFallbackToInteractive(argv, mockCommands);
      
      expect(result).toBe(false);
    });

    it('should return false for empty arguments', () => {
      const argv = { _: [] };
      
      const result = shouldFallbackToInteractive(argv, mockCommands);
      
      expect(result).toBe(false);
    });

    it('should handle commands with uppercase', () => {
      const argv = { _: ['BUILD'] };
      
      const result = shouldFallbackToInteractive(argv, mockCommands);
      
      expect(result).toBe(false);
    });
  });

  describe('validateSubCommand', () => {
    it('should return valid for existing subcommand', () => {
      const argv = { _: ['config', 'list'] };
      
      const result = validateSubCommand(argv, mockCommands);
      
      expect(result.isValid).toBe(true);
      expect(result.errorMessage).toBeUndefined();
    });

    it('should return invalid for non-existing subcommand', () => {
      const argv = { _: ['config', 'invalid'] };
      
      const result = validateSubCommand(argv, mockCommands);
      
      expect(result.isValid).toBe(false);
      expect(result.errorMessage).toBe('Unknown subcommand "invalid" for "config".');
    });

    it('should return valid for single argument', () => {
      const argv = { _: ['config'] };
      
      const result = validateSubCommand(argv, mockCommands);
      
      expect(result.isValid).toBe(true);
    });

    it('should return valid for command without subcommands', () => {
      const argv = { _: ['login', 'anything'] };
      
      const result = validateSubCommand(argv, mockCommands);
      
      expect(result.isValid).toBe(true);
    });

    it('should return valid for empty arguments', () => {
      const argv = { _: [] };
      
      const result = validateSubCommand(argv, mockCommands);
      
      expect(result.isValid).toBe(true);
    });

    it('should return valid for unknown top-level command', () => {
      const argv = { _: ['unknown', 'subcommand'] };
      
      const result = validateSubCommand(argv, mockCommands);
      
      expect(result.isValid).toBe(true);
    });

    it('should handle command with empty second argument', () => {
      const argv = { _: ['config', ''] };
      
      const result = validateSubCommand(argv, mockCommands);
      
      expect(result.isValid).toBe(true);
    });
  });

  describe('handleInvalidSubCommandError', () => {
    it('should output correct error messages and exit', () => {
      const errorMessage = 'Unknown subcommand "invalid" for "config".';
      const command = 'config';
      
      expect(() => {
        handleInvalidSubCommandError(errorMessage, command);
      }).toThrow('Process exit with code: 1');
      
      expect(mockConsoleError).toHaveBeenCalledTimes(4);
      expect(mockConsoleError).toHaveBeenNthCalledWith(1, 'Incorrect Usage.\n');
      expect(mockConsoleError).toHaveBeenNthCalledWith(2, errorMessage);
      expect(mockConsoleError).toHaveBeenNthCalledWith(3, '\nUse --help to see available commands and options.');
      expect(mockConsoleError).toHaveBeenNthCalledWith(4, 'Example: appcircle config --help');
    });

    it('should handle different command names in help text', () => {
      const errorMessage = 'Unknown subcommand "test" for "build".';
      const command = 'build';
      
      expect(() => {
        handleInvalidSubCommandError(errorMessage, command);
      }).toThrow('Process exit with code: 1');
      
      expect(mockConsoleError).toHaveBeenCalledWith('Example: appcircle build --help');
    });
  });

  describe('shouldRunInteractive', () => {
    it('should return true when process.argv length is 2', () => {
      const originalLength = process.argv.length;
      process.argv = ['node', 'appcircle'];
      
      const result = shouldRunInteractive({}, false);
      
      expect(result).toBe(true);
      
      // Restore original length by adding back elements
      while (process.argv.length < originalLength) {
        process.argv.push('restored');
      }
    });

    it('should return true when interactive flag is set', () => {
      process.argv = ['node', 'appcircle', 'config'];
      
      const result = shouldRunInteractive({ i: true }, false);
      
      expect(result).toBe(true);
    });

    it('should return true when interactive long flag is set', () => {
      process.argv = ['node', 'appcircle', 'config'];
      
      const result = shouldRunInteractive({ interactive: true }, false);
      
      expect(result).toBe(true);
    });

    it('should return true when fallback to interactive is true', () => {
      process.argv = ['node', 'appcircle', 'config'];
      
      const result = shouldRunInteractive({}, true);
      
      expect(result).toBe(true);
    });

    it('should return false when none of the conditions are met', () => {
      process.argv = ['node', 'appcircle', 'config', 'list'];
      
      const result = shouldRunInteractive({}, false);
      
      expect(result).toBe(false);
    });

    it('should handle undefined flags', () => {
      process.argv = ['node', 'appcircle', 'config', 'list'];
      
      const result = shouldRunInteractive({ i: undefined, interactive: undefined }, false);
      
      expect(result).toBe(false);
    });
  });

  describe('getOutputType', () => {
    it('should return output flag value when present', () => {
      const argv = { output: 'json' };
      
      const result = getOutputType(argv);
      
      expect(result).toBe('json');
    });

    it('should return short output flag value when present', () => {
      const argv = { o: 'json' };
      
      const result = getOutputType(argv);
      
      expect(result).toBe('json');
    });

    it('should prefer long flag over short flag', () => {
      const argv = { output: 'json', o: 'plain' };
      
      const result = getOutputType(argv);
      
      expect(result).toBe('json');
    });

    it('should return default plain when no flags present', () => {
      const argv = {};
      
      const result = getOutputType(argv);
      
      expect(result).toBe('plain');
    });

    it('should handle empty string values', () => {
      const argv = { output: '', o: 'json' };
      
      const result = getOutputType(argv);
      
      expect(result).toBe('json');
    });
  });

  describe('handleMainExecutionError', () => {
    beforeEach(() => {
      vi.clearAllMocks();
    });

    it('should handle AppcircleExitError with code 0 and empty message in JSON mode', async () => {
      const config = await import('../../../src/config');
      vi.mocked(config.getConsoleOutputType).mockReturnValue('json');
      
      const error = {
        name: 'AppcircleExitError',
        code: 0,
        message: ''
      };
      
      expect(() => {
        handleMainExecutionError(error);
      }).toThrow('Process exit with code: 0');
      
      expect(mockConsoleError).not.toHaveBeenCalled();
    });

    it('should handle AppcircleExitError with non-zero code and message in JSON mode', async () => {
      const config = await import('../../../src/config');
      vi.mocked(config.getConsoleOutputType).mockReturnValue('json');
      
      const error = {
        name: 'AppcircleExitError',
        code: 1,
        message: 'Error occurred'
      };
      
      expect(() => {
        handleMainExecutionError(error);
      }).toThrow('Process exit with code: 1');
      
      expect(mockConsoleError).toHaveBeenCalledWith(JSON.stringify(error));
    });

    it('should handle AppcircleExitError with message in plain mode', async () => {
      const config = await import('../../../src/config');
      vi.mocked(config.getConsoleOutputType).mockReturnValue('plain');
      
      const error = {
        name: 'AppcircleExitError',
        code: 1,
        message: 'Authentication failed'
      };
      
      expect(() => {
        handleMainExecutionError(error);
      }).toThrow('Process exit with code: 1');
      
      expect(mockConsoleError).toHaveBeenCalledWith('Authentication failed');
    });

    it('should handle AppcircleExitError with code 0 in plain mode', async () => {
      const config = await import('../../../src/config');
      vi.mocked(config.getConsoleOutputType).mockReturnValue('plain');
      
      const error = {
        name: 'AppcircleExitError',
        code: 0,
        message: 'Success'
      };
      
      expect(() => {
        handleMainExecutionError(error);
      }).toThrow('Process exit with code: 0');
      
      expect(mockConsoleError).not.toHaveBeenCalled();
    });

    it('should handle Axios error in plain mode', async () => {
      const config = await import('../../../src/config');
      const axios = await import('axios');
      
      vi.mocked(config.getConsoleOutputType).mockReturnValue('plain');
      vi.mocked(axios.isAxiosError).mockReturnValue(true);
      
      const error = {
        name: 'AxiosError',
        message: 'Network Error',
        code: 'ECONNREFUSED'
      };
      
      expect(() => {
        handleMainExecutionError(error);
      }).toThrow('Process exit with code: 1');
      
      expect(mockConsoleError).toHaveBeenCalledWith(error);
    });

    it('should handle generic error in plain mode', async () => {
      const config = await import('../../../src/config');
      vi.mocked(config.getConsoleOutputType).mockReturnValue('plain');
      
      const error = new Error('Generic error');
      
      expect(() => {
        handleMainExecutionError(error);
      }).toThrow('Process exit with code: 1');
      
      expect(mockConsoleError).toHaveBeenCalledWith(error);
    });
  });

  describe('processCommandLineArguments', () => {
    it('should return valid context for valid command with subcommand', () => {
      const originalArgv = [...process.argv];
      process.argv = ['node', 'appcircle', 'config', 'list'];
      
      const argv = { _: ['config', 'list'], output: 'json' };
      
      const result = processCommandLineArguments(argv, mockCommands);
      
      expect(result.isValid).toBe(true);
      expect(result.shouldRunInteractive).toBe(false);
      expect(result.shouldFallback).toBe(false);
      
      process.argv = originalArgv;
    });

    it('should return invalid context for invalid subcommand', () => {
      const argv = { _: ['config', 'invalid'] };
      
      const result = processCommandLineArguments(argv, mockCommands);
      
      expect(result.isValid).toBe(false);
      expect(result.errorMessage).toBe('Unknown subcommand "invalid" for "config".');
      expect(result.command).toBe('config');
    });

    it('should return context with fallback for single command', () => {
      const argv = { _: ['config'] };
      
      const result = processCommandLineArguments(argv, mockCommands);
      
      expect(result.isValid).toBe(true);
      expect(result.shouldFallback).toBe(true);
      expect(result.shouldRunInteractive).toBe(true);
    });

    it('should return context with no fallback for login with Personal Access Key', () => {
      const originalArgv = [...process.argv];
      process.argv = ['node', 'appcircle', 'login', '--secret', 'key123'];
      
      const argv = { _: ['login'], secret: 'key123' };
      
      const result = processCommandLineArguments(argv, mockCommands);
      
      expect(result.isValid).toBe(true);
      expect(result.shouldFallback).toBe(false);
      expect(result.shouldRunInteractive).toBe(false);
      
      process.argv = originalArgv;
    });

    it('should handle interactive flags', () => {
      const argv = { _: ['config', 'list'], i: true };
      
      const result = processCommandLineArguments(argv, mockCommands);
      
      expect(result.isValid).toBe(true);
      expect(result.shouldRunInteractive).toBe(true);
    });
  });

  describe('modifyProcessArgv', () => {
    it('should add -i flag when shouldFallback is true', () => {
      const originalLength = process.argv.length;
      
      modifyProcessArgv(true);
      
      expect(process.argv).toHaveLength(originalLength + 1);
      expect(process.argv[process.argv.length - 1]).toBe('-i');
    });

    it('should not modify process.argv when shouldFallback is false', () => {
      const originalLength = process.argv.length;
      const originalArgv = [...process.argv];
      
      modifyProcessArgv(false);
      
      expect(process.argv).toHaveLength(originalLength);
      expect(process.argv).toEqual(originalArgv);
    });
  });

  describe('validateCommandStructure', () => {
    it('should return true for valid command structure', () => {
      const command: CommandType = {
        command: 'test',
        description: 'Test command',
        params: []
      };
      
      const result = validateCommandStructure(command);
      
      expect(result).toBe(true);
    });

    it('should return true for command with subCommands', () => {
      const command: CommandType = {
        command: 'test',
        description: 'Test command',
        params: [],
        subCommands: []
      };
      
      const result = validateCommandStructure(command);
      
      expect(result).toBe(true);
    });

    it('should return false for null command', () => {
      const result = validateCommandStructure(null as any);
      
      expect(result).toBe(false);
    });

    it('should return false for command with non-string command name', () => {
      const command = {
        command: 123,
        description: 'Test command',
        params: []
      } as any;
      
      const result = validateCommandStructure(command);
      
      expect(result).toBe(false);
    });

    it('should return false for command with non-array subCommands', () => {
      const command = {
        command: 'test',
        description: 'Test command',
        params: [],
        subCommands: 'invalid'
      } as any;
      
      const result = validateCommandStructure(command);
      
      expect(result).toBe(false);
    });
  });

  describe('createCommandMap', () => {
    it('should create map with valid commands', () => {
      const result = createCommandMap(mockCommands);
      
      expect(result.size).toBe(3);
      expect(result.has('config')).toBe(true);
      expect(result.has('login')).toBe(true);
      expect(result.has('build')).toBe(true);
      expect(result.get('config')).toEqual(mockCommands[0]);
    });

    it('should skip invalid commands', () => {
      const invalidCommands = [
        { command: 'valid', description: 'Valid', params: [] },
        { command: 123, description: 'Invalid', params: [] },
        null,
        { command: 'valid2', description: 'Valid2', params: [] }
      ] as any;
      
      const result = createCommandMap(invalidCommands);
      
      expect(result.size).toBe(2);
      expect(result.has('valid')).toBe(true);
      expect(result.has('valid2')).toBe(true);
    });

    it('should handle empty commands array', () => {
      const result = createCommandMap([]);
      
      expect(result.size).toBe(0);
    });
  });

  describe('Integration Tests', () => {
    it('should handle complete workflow for valid command', () => {
      const argv = { _: ['config', 'list'], output: 'json' };
      
      const context = processCommandLineArguments(argv, mockCommands);
      const outputType = getOutputType(argv);
      
      expect(context.isValid).toBe(true);
      expect(outputType).toBe('json');
      
      modifyProcessArgv(context.shouldFallback);
      
      // Should not modify argv since shouldFallback is false
      expect(process.argv).not.toContain('-i');
    });

    it('should handle complete workflow for single command fallback', () => {
      const argv = { _: ['config'] };
      const originalLength = process.argv.length;
      
      const context = processCommandLineArguments(argv, mockCommands);
      
      expect(context.isValid).toBe(true);
      expect(context.shouldFallback).toBe(true);
      
      modifyProcessArgv(context.shouldFallback);
      
      expect(process.argv).toHaveLength(originalLength + 1);
      expect(process.argv[process.argv.length - 1]).toBe('-i');
    });

    it('should handle complete workflow for invalid subcommand', () => {
      const argv = { _: ['config', 'invalid'] };
      
      const context = processCommandLineArguments(argv, mockCommands);
      
      expect(context.isValid).toBe(false);
      
      expect(() => {
        handleInvalidSubCommandError(context.errorMessage!, context.command!);
      }).toThrow('Process exit with code: 1');
    });
  });
});