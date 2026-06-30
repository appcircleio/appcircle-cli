/**
 * @fileoverview Unit tests for program-utilities.ts
 * Tests extracted utility functions from program.ts for better coverage and testability
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  findCommandRecursive,
  handleRequiredOptionError,
  handleUnknownCommandError,
  handleProgramOutputError,
  formatHelpOption,
  formatHelpCommand,
  generateGlobalOptionsHelp,
  generateAvailableCommandsHelp,
  generateLearnMoreHelp,
  generateProgramHelp
} from '../../../src/core/program-utilities';
import { CommandType } from '../../../src/core/commands';

describe('Program Utilities', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('findCommandRecursive', () => {
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
        command: 'build',
        description: 'Build commands',
        params: []
      }
    ];

    it('should return undefined for empty args', () => {
      const result = findCommandRecursive([], mockCommands);
      expect(result).toBeUndefined();
    });

    it('should find top-level command', () => {
      const result = findCommandRecursive(['build'], mockCommands);
      expect(result?.command).toBe('build');
    });

    it('should find subcommand', () => {
      const result = findCommandRecursive(['config', 'list'], mockCommands);
      expect(result?.command).toBe('list');
    });

    it('should return parent command when subcommand not found', () => {
      const result = findCommandRecursive(['config', 'nonexistent'], mockCommands);
      expect(result?.command).toBe('config');
    });

    it('should return undefined for non-existent command', () => {
      const result = findCommandRecursive(['nonexistent'], mockCommands);
      expect(result).toBeUndefined();
    });

    it('should handle commands without subCommands', () => {
      const result = findCommandRecursive(['build', 'extra'], mockCommands);
      expect(result?.command).toBe('build');
    });

    it('should handle deep nesting', () => {
      const deepCommands: CommandType[] = [
        {
          command: 'parent',
          description: 'Parent command',
          params: [],
          subCommands: [
            {
              command: 'child',
              description: 'Child command',
              params: [],
              subCommands: [
                {
                  command: 'grandchild',
                  description: 'Grandchild command',
                  params: []
                }
              ]
            }
          ]
        }
      ];

      const result = findCommandRecursive(['parent', 'child', 'grandchild'], deepCommands);
      expect(result?.command).toBe('grandchild');
    });
  });

  describe('handleRequiredOptionError', () => {
    const mockCommands: CommandType[] = [
      {
        command: 'test',
        description: 'Test command',
        params: [],
        longDescription: 'This is a detailed description of the test command.'
      },
      {
        command: 'other',
        description: 'Other command',
        params: []
      }
    ];

    it('should write longDescription when command found and has longDescription', () => {
      const mockWrite = vi.fn();
      const inputArgs = ['test'];

      handleRequiredOptionError(inputArgs, mockCommands, mockWrite);

      expect(mockWrite).toHaveBeenCalledWith('This is a detailed description of the test command.\n');
    });

    it('should write default message when command found but no longDescription', () => {
      const mockWrite = vi.fn();
      const inputArgs = ['other'];

      handleRequiredOptionError(inputArgs, mockCommands, mockWrite);

      expect(mockWrite).toHaveBeenCalledWith('Missing or invalid parameter. Please check the correct usage and examples with --help or see the documentation.\n');
    });

    it('should write default message when command not found', () => {
      const mockWrite = vi.fn();
      const inputArgs = ['nonexistent'];

      handleRequiredOptionError(inputArgs, mockCommands, mockWrite);

      expect(mockWrite).toHaveBeenCalledWith('Missing or invalid parameter. Please check the correct usage and examples with --help or see the documentation.\n');
    });

    it('should handle empty inputArgs', () => {
      const mockWrite = vi.fn();
      const inputArgs: string[] = [];

      handleRequiredOptionError(inputArgs, mockCommands, mockWrite);

      expect(mockWrite).toHaveBeenCalledWith('Missing or invalid parameter. Please check the correct usage and examples with --help or see the documentation.\n');
    });
  });

  describe('handleUnknownCommandError', () => {
    it('should write correct error messages', () => {
      const mockWrite = vi.fn();

      handleUnknownCommandError(mockWrite);

      expect(mockWrite).toHaveBeenCalledTimes(3);
      expect(mockWrite).toHaveBeenNthCalledWith(1, 'Incorrect Usage.\n\n');
      expect(mockWrite).toHaveBeenNthCalledWith(2, 'Use --help to see available commands and options.\n');
      expect(mockWrite).toHaveBeenNthCalledWith(3, 'Example: appcircle [command] [subcommand] --help\n');
    });
  });

  describe('handleProgramOutputError', () => {
    const mockCommands: CommandType[] = [
      {
        command: 'test',
        description: 'Test command',
        params: [],
        longDescription: 'Test long description'
      }
    ];

    it('should handle required option error', () => {
      const mockWrite = vi.fn();
      const str = 'error: required option --param not specified';
      const inputArgs = ['test'];

      handleProgramOutputError(str, mockWrite, inputArgs, mockCommands);

      expect(mockWrite).toHaveBeenCalledWith('Test long description\n');
    });

    it('should handle unknown command error', () => {
      const mockWrite = vi.fn();
      const str = 'error: unknown command nonexistent';
      const inputArgs = ['nonexistent'];

      handleProgramOutputError(str, mockWrite, inputArgs, mockCommands);

      expect(mockWrite).toHaveBeenCalledWith('Incorrect Usage.\n\n');
    });

    it('should handle unknown option error', () => {
      const mockWrite = vi.fn();
      const str = 'error: unknown option --invalid';
      const inputArgs = ['test'];

      handleProgramOutputError(str, mockWrite, inputArgs, mockCommands);

      expect(mockWrite).toHaveBeenCalledWith('Incorrect Usage.\n\n');
    });

    it('should pass through other errors unchanged', () => {
      const mockWrite = vi.fn();
      const str = 'Some other error message';
      const inputArgs = ['test'];

      handleProgramOutputError(str, mockWrite, inputArgs, mockCommands);

      expect(mockWrite).toHaveBeenCalledWith('Some other error message');
    });
  });

  describe('formatHelpOption', () => {
    it('should format option with default padding', () => {
      const result = formatHelpOption('-v, --version', 'output version');
      expect(result).toBe('  -v, --version                output version\n');
    });

    it('should format option with custom padding', () => {
      const result = formatHelpOption('-v, --version', 'output version', 20);
      expect(result).toBe('  -v, --version        output version\n');
    });

    it('should handle long flags that exceed padding', () => {
      const result = formatHelpOption('--very-long-option-name', 'description', 10);
      expect(result).toBe('  --very-long-option-name description\n');
    });

    it('should handle empty flags and description', () => {
      const result = formatHelpOption('', '');
      expect(result).toBe('                               \n');
    });
  });

  describe('formatHelpCommand', () => {
    it('should format command with default padding', () => {
      const result = formatHelpCommand('build', 'Build application');
      expect(result).toBe('  build                        Build application\n');
    });

    it('should format command with custom padding', () => {
      const result = formatHelpCommand('build', 'Build application', 15);
      expect(result).toBe('  build           Build application\n');
    });

    it('should handle long commands that exceed padding', () => {
      const result = formatHelpCommand('very-long-command-name', 'description', 10);
      expect(result).toBe('  very-long-command-name description\n');
    });

    it('should handle empty command and description', () => {
      const result = formatHelpCommand('', '');
      expect(result).toBe('                               \n');
    });
  });

  describe('generateGlobalOptionsHelp', () => {
    it('should generate correct global options help text', () => {
      const result = generateGlobalOptionsHelp();

      expect(result).toContain('GLOBAL OPTIONS\n');
      expect(result).toContain('-v, --version');
      expect(result).toContain('output the version number');
      expect(result).toContain('-i, --interactive');
      expect(result).toContain('interactive mode (AppCircle GUI)');
      expect(result).toContain('-o, --output <type>');
      expect(result).toContain('output type (json, plain)');
      expect(result).toContain('-h, --help');
      expect(result).toContain('display help for command');
      expect(result.endsWith('\n\n')).toBe(true);
    });

    it('should have consistent formatting', () => {
      const result = generateGlobalOptionsHelp();
      const lines = result.split('\n');
      
      // Check that option lines have proper indentation
      const optionLines = lines.filter(line => line.startsWith('  -'));
      expect(optionLines).toHaveLength(4); // 4 options
      
      // Each option line should have proper spacing
      optionLines.forEach(line => {
        expect(line).toMatch(/^  -[\w\s,<>-]+\s+\w/);
      });
    });
  });

  describe('generateAvailableCommandsHelp', () => {
    const mockCommands: CommandType[] = [
      {
        command: 'build',
        description: 'Build application',
        params: []
      },
      {
        command: 'test',
        description: 'Run tests',
        params: []
      },
      {
        command: 'ignored',
        description: 'This should be ignored',
        params: [],
        ignore: true
      }
    ];

    it('should generate correct available commands help text', () => {
      const result = generateAvailableCommandsHelp(mockCommands);

      expect(result).toContain('AVAILABLE COMMANDS\n');
      expect(result).toContain('build');
      expect(result).toContain('Build application');
      expect(result).toContain('test');
      expect(result).toContain('Run tests');
      expect(result).not.toContain('ignored');
      expect(result).not.toContain('This should be ignored');
      expect(result.endsWith('\n\n')).toBe(true);
    });

    it('should handle empty commands list', () => {
      const result = generateAvailableCommandsHelp([]);

      expect(result).toBe('AVAILABLE COMMANDS\n\n');
    });

    it('should handle all ignored commands', () => {
      const ignoredCommands: CommandType[] = [
        {
          command: 'ignored1',
          description: 'Ignored command 1',
          params: [],
          ignore: true
        },
        {
          command: 'ignored2',
          description: 'Ignored command 2',
          params: [],
          ignore: true
        }
      ];

      const result = generateAvailableCommandsHelp(ignoredCommands);

      expect(result).toBe('AVAILABLE COMMANDS\n\n');
    });

    it('should have consistent formatting', () => {
      const result = generateAvailableCommandsHelp(mockCommands);
      const lines = result.split('\n');
      
      // Check that command lines have proper indentation
      const commandLines = lines.filter(line => line.startsWith('  ') && line !== '  ');
      expect(commandLines.length).toBeGreaterThan(0);
      
      // Each command line should have proper spacing
      commandLines.forEach(line => {
        expect(line).toMatch(/^  \w+\s+\w/);
      });
    });
  });

  describe('generateLearnMoreHelp', () => {
    it('should generate correct learn more help text', () => {
      const programName = 'appcircle';
      const result = generateLearnMoreHelp(programName);

      expect(result).toContain('LEARN MORE\n');
      expect(result).toContain(`Use '${programName} <command> --help'`);
      expect(result).toContain(`Run '${programName} --interactive'`);
      expect(result).toContain('Visit Appcircle documentation at https://docs.appcircle.io');
    });

    it('should handle different program names', () => {
      const programName = 'my-custom-cli';
      const result = generateLearnMoreHelp(programName);

      expect(result).toContain(`Use '${programName} <command> --help'`);
      expect(result).toContain(`Run '${programName} --interactive'`);
    });

    it('should handle empty program name', () => {
      const result = generateLearnMoreHelp('');

      expect(result).toContain("Use ' <command> --help'");
      expect(result).toContain("Run ' --interactive'");
    });
  });

  describe('generateProgramHelp', () => {
    const mockCommands: CommandType[] = [
      {
        command: 'build',
        description: 'Build application',
        params: []
      },
      {
        command: 'test',
        description: 'Run tests',
        params: []
      }
    ];

    it('should generate complete program help text', () => {
      const programName = 'appcircle';
      const version = '2.7.3';
      const description = 'A CLI for Appcircle';
      
      const result = generateProgramHelp(programName, version, description, mockCommands);

      // Check header section
      expect(result).toContain('Appcircle CLI');
      expect(result).toContain(`Version: v${version}`);
      expect(result).toContain(description);
      
      // Check usage section
      expect(result).toContain('USAGE');
      expect(result).toContain(`${programName} [options] [command]`);
      
      // Check sections are included
      expect(result).toContain('GLOBAL OPTIONS');
      expect(result).toContain('AVAILABLE COMMANDS');
      expect(result).toContain('LEARN MORE');
      
      // Check commands are included
      expect(result).toContain('build');
      expect(result).toContain('test');
      
      // Check global options are included
      expect(result).toContain('--version');
      expect(result).toContain('--interactive');
      expect(result).toContain('--output');
      expect(result).toContain('--help');
    });

    it('should handle empty inputs', () => {
      const result = generateProgramHelp('', '', '', []);

      expect(result).toContain('Appcircle CLI');
      expect(result).toContain('Version: v');
      expect(result).toContain('USAGE');
      expect(result).toContain('GLOBAL OPTIONS');
      expect(result).toContain('AVAILABLE COMMANDS');
      expect(result).toContain('LEARN MORE');
    });

    it('should maintain consistent structure', () => {
      const result = generateProgramHelp('test', '1.0.0', 'Test CLI', mockCommands);
      
      // Check the order of sections
      const sections = ['USAGE', 'GLOBAL OPTIONS', 'AVAILABLE COMMANDS', 'LEARN MORE'];
      let lastIndex = -1;
      
      sections.forEach(section => {
        const index = result.indexOf(section);
        expect(index).toBeGreaterThan(lastIndex);
        lastIndex = index;
      });
    });

    it('should properly format version with v prefix', () => {
      const result = generateProgramHelp('test', '1.2.3', 'description', []);
      expect(result).toContain('Version: v1.2.3');
    });
  });

  describe('Integration Tests', () => {
    it('should work together for typical error scenarios', () => {
      const mockCommands: CommandType[] = [
        {
          command: 'config',
          description: 'Configuration commands',
          params: [],
          longDescription: 'Configuration command help text',
          subCommands: [
            {
              command: 'set',
              description: 'Set configuration',
              params: [],
              longDescription: 'Set configuration help text'
            }
          ]
        }
      ];

      const mockWrite = vi.fn();

      // Test required option error with subcommand
      handleProgramOutputError(
        'error: required option --token not specified',
        mockWrite,
        ['config', 'set'],
        mockCommands
      );

      expect(mockWrite).toHaveBeenCalledWith('Set configuration help text\n');
    });

    it('should handle complex command hierarchy in error handling', () => {
      const mockCommands: CommandType[] = [
        {
          command: 'enterprise',
          description: 'Enterprise commands',
          params: [],
          subCommands: [
            {
              command: 'app',
              description: 'App management',
              params: [],
              subCommands: [
                {
                  command: 'upload',
                  description: 'Upload app',
                  params: [],
                  longDescription: 'Upload enterprise app help'
                }
              ]
            }
          ]
        }
      ];

      const mockWrite = vi.fn();

      handleProgramOutputError(
        'error: required option --app not specified',
        mockWrite,
        ['enterprise', 'app', 'upload'],
        mockCommands
      );

      expect(mockWrite).toHaveBeenCalledWith('Upload enterprise app help\n');
    });
  });
});