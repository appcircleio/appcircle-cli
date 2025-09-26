/**
 * @fileoverview Test suite for parameter handling helper functions
 * Tests the reusable helper functions used across parameter handlers
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Import the helper functions
import {
  extractIdFromSelection,
  createAutoCompletePrompt,
  formatChoicesWithId,
  validateParameterInput
} from '../../../src/core/interactive-runner';

// Mock enquirer - need to use factory function to avoid hoisting issues
vi.mock('enquirer', () => ({
  AutoComplete: vi.fn().mockImplementation((config) => ({
    name: config.name,
    message: config.message,
    choices: config.choices,
    limit: config.limit,
    run: vi.fn().mockResolvedValue('test selection')
  }))
}));

describe('Parameter Helper Functions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('extractIdFromSelection', () => {
    it('should extract ID from "ID - Name" format (space-dash-space)', () => {
      expect(extractIdFromSelection('12345 - My App')).toBe('12345');
      expect(extractIdFromSelection('abc123 - Test Project')).toBe('abc123');
      // Note: no space around dash means no extraction
      expect(extractIdFromSelection('999-Test-Build')).toBe('999-Test-Build');
    });

    it('should extract ID from "Name (ID)" format', () => {
      expect(extractIdFromSelection('My App (12345)')).toBe('12345');
      expect(extractIdFromSelection('Test Project (abc123)')).toBe('abc123');
      expect(extractIdFromSelection('Complex Name Here (999)')).toBe('999');
    });

    it('should extract ID from "ID: Name" format', () => {
      expect(extractIdFromSelection('12345: My App')).toBe('12345');
      expect(extractIdFromSelection('abc123: Test Project')).toBe('abc123');
      expect(extractIdFromSelection('999: Build Name')).toBe('999');
    });

    it('should return trimmed selection when no special format detected', () => {
      expect(extractIdFromSelection('  12345  ')).toBe('12345');
      expect(extractIdFromSelection('simple_value')).toBe('simple_value');
      expect(extractIdFromSelection('no.format.here')).toBe('no.format.here');
    });

    it('should handle edge cases', () => {
      expect(extractIdFromSelection('')).toBe('');
      expect(extractIdFromSelection('   ')).toBe('');
      expect(extractIdFromSelection('()')).toBe('()');
      expect(extractIdFromSelection('- ')).toBe('-');
      expect(extractIdFromSelection(': ')).toBe(':');
    });

    it('should prioritize parentheses format over dash format', () => {
      // Parentheses contain the actual ID, dash format is display name
      expect(extractIdFromSelection('123 - Name (456)')).toBe('456');
    });

    it('should handle complex real-world formats', () => {
      // Based on actual usage patterns in the code
      // Parentheses contain the actual IDs in real usage
      expect(extractIdFromSelection('My App (12345) - iOS')).toBe('12345');
      expect(extractIdFromSelection('AppVersion(v1.2.3) - 98765')).toBe('v1.2.3');
      // For CSR format, parentheses contain the certificate ID
      expect(extractIdFromSelection('csr: Certificate Name - email@example.com (cert-123)')).toBe('cert-123');
    });
  });

  describe('createAutoCompletePrompt', () => {
    it('should create and return AutoComplete instance', () => {
      const choices = ['Choice 1', 'Choice 2', 'Choice 3'];
      
      const prompt = createAutoCompletePrompt('testParam', 'Select option:', choices);
      
      // Test that the function returns an object (from our mock)
      expect(prompt).toBeDefined();
      expect(typeof prompt).toBe('object');
      expect(prompt).toHaveProperty('run');
    });

    it('should create prompt with custom limit when provided', () => {
      const choices = ['Choice 1', 'Choice 2'];
      
      const prompt = createAutoCompletePrompt('testParam', 'Select:', choices, 5);
      
      // Just verify it creates a prompt object
      expect(prompt).toBeDefined();
      expect(typeof prompt).toBe('object');
    });

    it('should create prompt with default limit when not specified', () => {
      const prompt = createAutoCompletePrompt('test', 'Select:', []);
      
      expect(prompt).toBeDefined();
      expect(typeof prompt).toBe('object');
    });
  });

  describe('formatChoicesWithId', () => {
    it('should format items with ID and name fields', () => {
      const items = [
        { id: '123', name: 'First Item' },
        { id: '456', name: 'Second Item' },
        { id: '789', name: 'Third Item' }
      ];

      const result = formatChoicesWithId(items, 'id');

      expect(result).toEqual([
        '123 - First Item',
        '456 - Second Item',
        '789 - Third Item'
      ]);
    });

    it('should use custom name field when provided', () => {
      const items = [
        { appId: '123', displayName: 'My App' },
        { appId: '456', displayName: 'Another App' }
      ];

      const result = formatChoicesWithId(items, 'appId', 'displayName');

      expect(result).toEqual([
        '123 - My App',
        '456 - Another App'
      ]);
    });

    it('should fallback to other name fields when name not available', () => {
      const items = [
        { id: '123', displayName: 'Display Name' },
        { id: '456', title: 'Title Field' },
        { id: '789', name: 'Name Field' }
      ];

      const result = formatChoicesWithId(items, 'id');

      expect(result).toEqual([
        '123 - Display Name',
        '456 - Title Field',
        '789 - Name Field'
      ]);
    });

    it('should return only ID when no name fields available', () => {
      const items = [
        { id: '123' },
        { id: '456' }
      ];

      const result = formatChoicesWithId(items, 'id');

      expect(result).toEqual(['123', '456']);
    });

    it('should handle empty arrays', () => {
      expect(formatChoicesWithId([], 'id')).toEqual([]);
    });

    it('should handle null/undefined arrays', () => {
      expect(formatChoicesWithId(null as any, 'id')).toEqual([]);
      expect(formatChoicesWithId(undefined as any, 'id')).toEqual([]);
    });

    it('should handle mixed data types', () => {
      const items = [
        { id: 123, name: 'Numeric ID' },
        { id: 'abc', name: 'String ID' },
        { id: null, name: 'Null ID' }
      ];

      const result = formatChoicesWithId(items, 'id');

      expect(result).toEqual([
        '123 - Numeric ID',
        'abc - String ID',
        'null - Null ID'
      ]);
    });

    it('should handle empty names gracefully', () => {
      const items = [
        { id: '123', name: '' },
        { id: '456', name: '   ' },
        { id: '789', name: 'Valid Name' }
      ];

      const result = formatChoicesWithId(items, 'id');

      expect(result).toEqual([
        '123',
        '456',
        '789 - Valid Name'
      ]);
    });
  });

  describe('validateParameterInput', () => {
    it('should return true for valid string inputs', () => {
      expect(validateParameterInput('valid-value', 'test')).toBe(true);
      expect(validateParameterInput('123', 'test')).toBe(true);
      expect(validateParameterInput('a', 'test')).toBe(true);
    });

    it('should return true for valid non-empty arrays', () => {
      expect(validateParameterInput(['item1'], 'test')).toBe(true);
      expect(validateParameterInput(['item1', 'item2'], 'test')).toBe(true);
      expect(validateParameterInput([1, 2, 3], 'test')).toBe(true);
    });

    it('should return true for valid objects', () => {
      expect(validateParameterInput({ key: 'value' }, 'test')).toBe(true);
      expect(validateParameterInput({ id: 123 }, 'test')).toBe(true);
    });

    it('should return true for numbers and booleans', () => {
      expect(validateParameterInput(123, 'test')).toBe(true);
      expect(validateParameterInput(0, 'test')).toBe(true);
      expect(validateParameterInput(true, 'test')).toBe(true);
      expect(validateParameterInput(false, 'test')).toBe(true);
    });

    it('should return false for null and undefined', () => {
      expect(validateParameterInput(null, 'test')).toBe(false);
      expect(validateParameterInput(undefined, 'test')).toBe(false);
    });

    it('should return false for empty strings', () => {
      expect(validateParameterInput('', 'test')).toBe(false);
      expect(validateParameterInput('   ', 'test')).toBe(false);
      expect(validateParameterInput('\t\n  ', 'test')).toBe(false);
    });

    it('should return false for empty arrays', () => {
      expect(validateParameterInput([], 'test')).toBe(false);
    });

    it('should handle edge case parameter names', () => {
      expect(validateParameterInput('value', '')).toBe(true);
      expect(validateParameterInput('value', 'very-long-parameter-name-here')).toBe(true);
      expect(validateParameterInput(null, 'any-parameter-name')).toBe(false);
    });
  });

  describe('Integration: Helper Functions Working Together', () => {
    it('should work together in a typical parameter processing flow', () => {
      // Step 1: Format choices
      const items = [
        { buildId: '123', name: 'Build 1' },
        { buildId: '456', name: 'Build 2' }
      ];
      
      const formattedChoices = formatChoicesWithId(items, 'buildId');
      expect(formattedChoices).toEqual(['123 - Build 1', '456 - Build 2']);
      
      // Step 2: Create prompt (would be used in real scenario)
      const prompt = createAutoCompletePrompt('buildId', 'Select build:', formattedChoices);
      expect(prompt).toBeDefined();
      
      // Step 3: Extract ID from selection
      const selectedChoice = '123 - Build 1';
      const extractedId = extractIdFromSelection(selectedChoice);
      expect(extractedId).toBe('123');
      
      // Step 4: Validate the extracted ID
      const isValid = validateParameterInput(extractedId, 'buildId');
      expect(isValid).toBe(true);
    });

    it('should handle invalid selections gracefully', () => {
      const invalidSelection = '';
      const extractedId = extractIdFromSelection(invalidSelection);
      expect(extractedId).toBe('');
      
      const isValid = validateParameterInput(extractedId, 'buildId');
      expect(isValid).toBe(false);
    });

    it('should handle empty data sets', () => {
      const items: any[] = [];
      const formattedChoices = formatChoicesWithId(items, 'id');
      expect(formattedChoices).toEqual([]);
      
      const prompt = createAutoCompletePrompt('param', 'Select:', formattedChoices);
      expect(prompt.choices).toEqual([]);
    });
  });
});