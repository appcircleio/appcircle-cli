/**
 * @fileoverview Test suite for interactive-runner helper functions
 * Tests the refactored helper functions for better coverage and testability
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock dependencies
vi.mock('../../../src/services', () => ({}));
vi.mock('../../../src/core/command-runner', () => ({}));
vi.mock('../../../src/core/commands', () => ({ Commands: [] }));
vi.mock('../../../src/config', () => ({}));
vi.mock('../../../src/constant', () => ({}));
vi.mock('../../../src/program', () => ({
  createCommandActionCallback: vi.fn()
}));

// Import the actual helper functions from the module
import {
  isHaltOrError,
  getInteractiveValues,
  buildActionCallbackInput
} from '../../../src/core/interactive-runner';

describe('Interactive Runner Helper Functions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('isHaltOrError', () => {
    it('should return true when result has _AC_INTERACTIVE_HALT_', () => {
      const result = { _AC_INTERACTIVE_HALT_: true };
      expect(isHaltOrError(result)).toBe(true);
    });

    it('should return true when result has isError', () => {
      const result = { isError: true };
      expect(isHaltOrError(result)).toBe(true);
    });

    it('should return true when result has both halt and error', () => {
      const result = { _AC_INTERACTIVE_HALT_: true, isError: true };
      expect(isHaltOrError(result)).toBe(true);
    });

    it('should return falsy when result has neither halt nor error', () => {
      const result = { someOtherProp: true };
      expect(isHaltOrError(result)).toBeFalsy();
    });

    it('should return falsy when result is null', () => {
      expect(isHaltOrError(null)).toBeFalsy();
    });

    it('should return falsy when result is undefined', () => {
      expect(isHaltOrError(undefined)).toBeFalsy();
    });

    it('should return falsy when result is empty object', () => {
      const result = {};
      expect(isHaltOrError(result)).toBeFalsy();
    });

    it('should return false when halt/error properties are false', () => {
      const result = { _AC_INTERACTIVE_HALT_: false, isError: false };
      expect(isHaltOrError(result)).toBe(false);
    });
  });

  describe('getInteractiveValues', () => {
    it('should call run with items || [] and return result || {}', async () => {
      const mockRun = vi.fn().mockResolvedValue({ key: 'value' });
      const items = [{ name: 'param1' }];

      const result = await getInteractiveValues(items, mockRun);

      expect(mockRun).toHaveBeenCalledWith(items);
      expect(result).toEqual({ key: 'value' });
    });

    it('should return undefined when run result has halt flag', async () => {
      const mockRun = vi.fn().mockResolvedValue({ _AC_INTERACTIVE_HALT_: true });
      const items = [{ name: 'param1' }];

      const result = await getInteractiveValues(items, mockRun);

      expect(result).toBeUndefined();
    });

    it('should return undefined when run result has error flag', async () => {
      const mockRun = vi.fn().mockResolvedValue({ isError: true });
      const items = [{ name: 'param1' }];

      const result = await getInteractiveValues(items, mockRun);

      expect(result).toBeUndefined();
    });

    it('should return empty object when run returns null', async () => {
      const mockRun = vi.fn().mockResolvedValue(null);
      const items = [{ name: 'param1' }];

      const result = await getInteractiveValues(items, mockRun);

      expect(result).toEqual({});
    });

    it('should return empty object when run returns undefined', async () => {
      const mockRun = vi.fn().mockResolvedValue(undefined);
      const items = [{ name: 'param1' }];

      const result = await getInteractiveValues(items, mockRun);

      expect(result).toEqual({});
    });

    it('should call run with empty array when items is null', async () => {
      const mockRun = vi.fn().mockResolvedValue({});
      
      await getInteractiveValues(null, mockRun);

      expect(mockRun).toHaveBeenCalledWith([]);
    });

    it('should call run with empty array when items is undefined', async () => {
      const mockRun = vi.fn().mockResolvedValue({});
      
      await getInteractiveValues(undefined, mockRun);

      expect(mockRun).toHaveBeenCalledWith([]);
    });

    it('should use default runner when no run function provided', async () => {
      // This tests the DI default behavior - we can't easily test the actual default
      // but we can verify the structure works
      const items = [];
      
      const result = await getInteractiveValues(items);
      
      expect(result).toEqual({});
    });
  });

  describe('buildActionCallbackInput', () => {
    it('should create correct callback input structure', () => {
      const selectedCommand = { command: 'test-command' };
      const parentCommand = { name: 'parent' };
      const params = { param1: 'value1', param2: 'value2' };
      const args = { arg1: 'argValue1', arg2: 'argValue2' };

      const result = buildActionCallbackInput(selectedCommand, parentCommand, params, args);

      expect(result.parent).toBe(parentCommand);
      expect(result.name()).toBe('test-command');
      expect(result.opts()).toBe(params);
      expect(result.args()).toEqual(['argValue1', 'argValue2']);
    });

    it('should set parent to null when parentCommand is null', () => {
      const selectedCommand = { command: 'test-command' };
      const params = {};
      const args = {};

      const result = buildActionCallbackInput(selectedCommand, null, params, args);

      expect(result.parent).toBeNull();
    });

    it('should set parent to null when parentCommand is undefined', () => {
      const selectedCommand = { command: 'test-command' };
      const params = {};
      const args = {};

      const result = buildActionCallbackInput(selectedCommand, undefined, params, args);

      expect(result.parent).toBeNull();
    });

    it('should return exact Object.values(args) for args function', () => {
      const selectedCommand = { command: 'test-command' };
      const params = {};
      const args = { first: 'a', second: 'b', third: 'c' };

      const result = buildActionCallbackInput(selectedCommand, null, params, args);
      
      // Verify that args() returns exactly Object.values(args)
      expect(result.args()).toEqual(Object.values(args));
      expect(result.args()).toEqual(['a', 'b', 'c']);
    });

    it('should handle empty args correctly', () => {
      const selectedCommand = { command: 'test-command' };
      const params = {};
      const args = {};

      const result = buildActionCallbackInput(selectedCommand, null, params, args);

      expect(result.args()).toEqual([]);
    });

    it('should preserve argument order from Object.values', () => {
      const selectedCommand = { command: 'test-command' };
      const params = {};
      const args = { z: 'last', a: 'first', m: 'middle' };

      const result = buildActionCallbackInput(selectedCommand, null, params, args);
      
      // Object.values preserves property insertion order
      expect(result.args()).toEqual(['last', 'first', 'middle']);
    });

    it('should return functions that can be called multiple times', () => {
      const selectedCommand = { command: 'test-command' };
      const params = { key: 'value' };
      const args = { arg: 'argValue' };

      const result = buildActionCallbackInput(selectedCommand, null, params, args);

      // Test that closures work correctly on multiple calls
      expect(result.name()).toBe('test-command');
      expect(result.name()).toBe('test-command');
      expect(result.opts()).toBe(params);
      expect(result.opts()).toBe(params);
      expect(result.args()).toEqual(['argValue']);
      expect(result.args()).toEqual(['argValue']);
    });
  });

  describe('Integration: Helper Functions Working Together', () => {
    it('should work together in typical success flow', async () => {
      const mockRun = vi.fn()
        .mockResolvedValueOnce({ param1: 'value1' }) // for params
        .mockResolvedValueOnce({ arg1: 'argValue1' }); // for args

      const selectedCommand = { 
        command: 'test-command', 
        params: [{ name: 'param1' }],
        arguments: [{ name: 'arg1' }]
      };
      const parentCommand = { name: 'parent' };

      // Simulate the main function's flow
      const params = await getInteractiveValues(selectedCommand.params, mockRun);
      expect(params).toEqual({ param1: 'value1' });

      const args = await getInteractiveValues(selectedCommand.arguments, mockRun);
      expect(args).toEqual({ arg1: 'argValue1' });

      const callbackInput = buildActionCallbackInput(selectedCommand, parentCommand, params!, args!);
      
      expect(callbackInput.parent).toBe(parentCommand);
      expect(callbackInput.name()).toBe('test-command');
      expect(callbackInput.opts()).toEqual({ param1: 'value1' });
      expect(callbackInput.args()).toEqual(['argValue1']);
    });

    it('should halt on params error', async () => {
      const mockRun = vi.fn().mockResolvedValue({ _AC_INTERACTIVE_HALT_: true });

      const params = await getInteractiveValues([{ name: 'param1' }], mockRun);
      
      expect(params).toBeUndefined();
      // Should not proceed to args or callback creation
    });

    it('should halt on args error', async () => {
      const mockRun = vi.fn()
        .mockResolvedValueOnce({ param1: 'value1' }) // params succeed
        .mockResolvedValueOnce({ isError: true }); // args fail

      const params = await getInteractiveValues([{ name: 'param1' }], mockRun);
      expect(params).toEqual({ param1: 'value1' });

      const args = await getInteractiveValues([{ name: 'arg1' }], mockRun);
      expect(args).toBeUndefined();
      // Should not proceed to callback creation
    });
  });
});