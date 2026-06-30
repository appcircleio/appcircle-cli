/**
 * @fileoverview Test suite for handleSelectedCommand helper functions
 * Tests the refactored helper functions for better coverage and testability
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock dependencies
vi.mock('enquirer', () => ({
  AutoComplete: vi.fn().mockImplementation(() => ({
    run: vi.fn().mockResolvedValue('1. Test')
  }))
}));

// Import the actual helper functions from the module
import {
  getAvailableChoices,
  shouldExecuteSingleCommand,
  buildMenuChoices,
  getBackButtonText,
  addBackButtonIfNeeded,
  createCommandSelector,
  parseCommandIndex
} from '../../../src/core/interactive-runner';

describe('HandleSelectedCommand Helper Functions', () => {
  let originalArgv: string[];

  beforeEach(() => {
    originalArgv = process.argv.slice();
    vi.clearAllMocks();
  });

  afterEach(() => {
    process.argv = originalArgv;
  });

  describe('getAvailableChoices', () => {
    it('should filter out ignored commands', () => {
      const command = {
        subCommands: [
          { command: 'cmd1', ignore: false },
          { command: 'cmd2', ignore: true },
          { command: 'cmd3', ignore: false }
        ]
      };

      const result = getAvailableChoices(command);

      expect(result).toHaveLength(2);
      expect(result[0].command).toBe('cmd1');
      expect(result[1].command).toBe('cmd3');
    });

    it('should return empty array when no subCommands', () => {
      const command = {};
      const result = getAvailableChoices(command);
      expect(result).toEqual([]);
    });

    it('should return empty array when subCommands is null', () => {
      const command = { subCommands: null };
      const result = getAvailableChoices(command);
      expect(result).toEqual([]);
    });

    it('should return empty array when all commands are ignored', () => {
      const command = {
        subCommands: [
          { command: 'cmd1', ignore: true },
          { command: 'cmd2', ignore: true }
        ]
      };

      const result = getAvailableChoices(command);
      expect(result).toEqual([]);
    });

    it('should handle commands without ignore property (default to not ignored)', () => {
      const command = {
        subCommands: [
          { command: 'cmd1' }, // no ignore property
          { command: 'cmd2', ignore: false }
        ]
      };

      const result = getAvailableChoices(command);
      expect(result).toHaveLength(2);
    });
  });

  describe('shouldExecuteSingleCommand', () => {
    it('should return true when exactly one choice available', () => {
      const availableChoices = [{ command: 'single' }];
      expect(shouldExecuteSingleCommand(availableChoices)).toBe(true);
    });

    it('should return false when no choices available', () => {
      const availableChoices: any[] = [];
      expect(shouldExecuteSingleCommand(availableChoices)).toBe(false);
    });

    it('should return false when multiple choices available', () => {
      const availableChoices = [{ command: 'cmd1' }, { command: 'cmd2' }];
      expect(shouldExecuteSingleCommand(availableChoices)).toBe(false);
    });
  });

  describe('buildMenuChoices', () => {
    it('should build numbered menu choices with descriptions', () => {
      const availableChoices = [
        { description: 'First command' },
        { description: 'Second command' },
        { description: 'Third command' }
      ];

      const result = buildMenuChoices(availableChoices);

      expect(result).toEqual([
        { name: '1. First command', message: '1. First command' },
        { name: '2. Second command', message: '2. Second command' },
        { name: '3. Third command', message: '3. Third command' }
      ]);
    });

    it('should handle empty array', () => {
      const result = buildMenuChoices([]);
      expect(result).toEqual([]);
    });

    it('should handle commands without description', () => {
      const availableChoices = [{ command: 'cmd1' }];
      const result = buildMenuChoices(availableChoices);
      expect(result).toEqual([
        { name: '1. undefined', message: '1. undefined' }
      ]);
    });
  });

  describe('getBackButtonText', () => {
    it('should return "⬅ Exit" for top-level direct command', () => {
      // Simulate direct command (non-interactive)
      process.argv = ['node', 'script.js', 'command'];
      
      const result = getBackButtonText(1);
      expect(result).toBe('⬅ Exit');
    });

    it('should return "⬅ Back" for top-level interactive command', () => {
      // Simulate interactive command
      process.argv = ['node', 'script.js', '-i'];
      
      const result = getBackButtonText(1);
      expect(result).toBe('⬅ Back');
    });

    it('should return "⬅ Back" for nested navigation', () => {
      process.argv = ['node', 'script.js', 'command'];
      
      const result = getBackButtonText(2);
      expect(result).toBe('⬅ Back');
    });

    it('should return "⬅ Back" when --interactive flag present', () => {
      process.argv = ['node', 'script.js', '--interactive', 'command'];
      
      const result = getBackButtonText(1);
      expect(result).toBe('⬅ Back');
    });

    it('should handle edge case with minimal argv', () => {
      process.argv = ['node', 'script.js'];
      
      const result = getBackButtonText(1);
      expect(result).toBe('⬅ Back');
    });
  });

  describe('addBackButtonIfNeeded', () => {
    it('should add back button when navigation stack has items', () => {
      const choices = [{ name: '1. Command', message: '1. Command' }];
      process.argv = ['node', 'script.js', 'command'];
      
      const result = addBackButtonIfNeeded(choices, 1);
      
      expect(result).toHaveLength(2);
      expect(result[1]).toEqual({ name: 'back', message: '⬅ Exit' });
    });

    it('should not add back button when navigation stack is empty', () => {
      const choices = [{ name: '1. Command', message: '1. Command' }];
      
      const result = addBackButtonIfNeeded(choices, 0);
      
      expect(result).toEqual(choices);
      expect(result).toHaveLength(1);
    });

    it('should preserve original choices array', () => {
      const choices = [{ name: '1. Command', message: '1. Command' }];
      const originalChoices = [...choices];
      
      addBackButtonIfNeeded(choices, 1);
      
      expect(choices).toEqual(originalChoices);
    });

    it('should add correct back button text for nested navigation', () => {
      const choices = [{ name: '1. Command', message: '1. Command' }];
      process.argv = ['node', 'script.js', '-i'];
      
      const result = addBackButtonIfNeeded(choices, 2);
      
      expect(result[1]).toEqual({ name: 'back', message: '⬅ Back' });
    });
  });

  describe('createCommandSelector', () => {
    it('should create selector with correct configuration', () => {
      const mockCreateSelector = vi.fn().mockReturnValue({ run: vi.fn() });
      const choices = [{ name: '1. Test', message: '1. Test' }];
      
      createCommandSelector(choices, 'Test Command', mockCreateSelector);
      
      expect(mockCreateSelector).toHaveBeenCalledWith({
        name: 'action',
        limit: 10,
        message: 'Which sub-command of "Test Command" do you want to run?',
        choices: choices,
      });
    });

    it('should use default selector when none provided', () => {
      const choices = [{ name: '1. Test', message: '1. Test' }];
      
      const result = createCommandSelector(choices, 'Test Command');
      
      expect(result).toHaveProperty('run');
    });

    it('should pass through custom selector factory', () => {
      const mockSelector = { run: vi.fn().mockResolvedValue('selection') };
      const mockCreateSelector = vi.fn().mockReturnValue(mockSelector);
      const choices = [{ name: '1. Test', message: '1. Test' }];
      
      const result = createCommandSelector(choices, 'Test Command', mockCreateSelector);
      
      expect(result).toBe(mockSelector);
    });
  });

  describe('parseCommandIndex', () => {
    it('should parse command index from numbered selection', () => {
      expect(parseCommandIndex('1. First command')).toBe(0);
      expect(parseCommandIndex('2. Second command')).toBe(1);
      expect(parseCommandIndex('10. Tenth command')).toBe(9);
    });

    it('should handle malformed input gracefully', () => {
      expect(parseCommandIndex('not a number')).toBeNaN();
      expect(parseCommandIndex('')).toBeNaN();
    });

    it('should parse only first number when multiple dots present', () => {
      expect(parseCommandIndex('3. Command with. dots.')).toBe(2);
    });

    it('should handle negative numbers', () => {
      expect(parseCommandIndex('-1. Negative')).toBe(-2);
    });
  });

  // Note: handleBackNavigation and handleForwardNavigation are internal functions
  // and not exported, so they are tested through integration tests instead

  describe('Integration: Helper Functions Working Together', () => {
    it('should work together in typical command selection flow', () => {
      // Test complete flow from command filtering to menu building
      const command = {
        subCommands: [
          { description: 'First cmd', ignore: false },
          { description: 'Second cmd', ignore: true },
          { description: 'Third cmd', ignore: false }
        ]
      };

      // Step 1: Filter commands
      const availableChoices = getAvailableChoices(command);
      expect(availableChoices).toHaveLength(2);

      // Step 2: Check if single command (should be false)
      const shouldExecuteSingle = shouldExecuteSingleCommand(availableChoices);
      expect(shouldExecuteSingle).toBe(false);

      // Step 3: Build menu choices
      const menuChoices = buildMenuChoices(availableChoices);
      expect(menuChoices).toEqual([
        { name: '1. First cmd', message: '1. First cmd' },
        { name: '2. Third cmd', message: '2. Third cmd' }
      ]);

      // Step 4: Add back button
      process.argv = ['node', 'script.js', 'command'];
      const finalChoices = addBackButtonIfNeeded(menuChoices, 1);
      expect(finalChoices).toHaveLength(3);
      expect(finalChoices[2]).toEqual({ name: 'back', message: '⬅ Exit' });
    });

    it('should handle single command execution path', () => {
      const command = {
        subCommands: [
          { description: 'Only cmd', ignore: false }
        ]
      };

      const availableChoices = getAvailableChoices(command);
      const shouldExecuteSingle = shouldExecuteSingleCommand(availableChoices);
      
      expect(shouldExecuteSingle).toBe(true);
      // In real flow, this would trigger direct execution
    });

    it('should handle command index parsing and navigation', () => {
      const selectedActionName = '2. Second command';
      const commandIndex = parseCommandIndex(selectedActionName);
      
      expect(commandIndex).toBe(1);
      // In real flow, this index would be used to select from availableChoices
    });
  });
});