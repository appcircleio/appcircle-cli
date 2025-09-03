import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createOra } from '../../../src/utils/orahelper';
import { getConsoleOutputType } from '../../../src/config';

vi.mock('../../../src/config');
vi.mock('ora', () => ({
  default: vi.fn(() => ({
    fail: vi.fn(),
    succeed: vi.fn(),
    stop: vi.fn(),
    start: vi.fn(),
    text: 'mocked'
  }))
}));

describe('orahelper', () => {
  const mockGetConsoleOutputType = vi.mocked(getConsoleOutputType);

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('createOra', () => {
    it('should return mock spinner when output type is json', () => {
      mockGetConsoleOutputType.mockReturnValue('json');

      const spinner = createOra('Test message');

      expect(typeof spinner.fail).toBe('function');
      expect(typeof spinner.succeed).toBe('function');
      expect(typeof spinner.stop).toBe('function');
      expect(typeof spinner.start).toBe('function');
      expect(spinner.text).toBe('');
    });

    it('should return real ora spinner when output type is not json', () => {
      mockGetConsoleOutputType.mockReturnValue('plain');

      const spinner = createOra('Test message');

      expect(typeof spinner.fail).toBe('function');
      expect(typeof spinner.succeed).toBe('function');
      expect(typeof spinner.stop).toBe('function');
      expect(typeof spinner.start).toBe('function');
    });

    it('should mock spinner methods do nothing when output type is json', () => {
      mockGetConsoleOutputType.mockReturnValue('json');

      const spinner = createOra('Test message');

      expect(() => {
        spinner.fail();
        spinner.succeed();
        spinner.stop();
      }).not.toThrow();

      expect(spinner.text).toBe('');
    });

    it('should mock spinner start method returns mock object when output type is json', () => {
      mockGetConsoleOutputType.mockReturnValue('json');

      const spinner = createOra('Test message');
      const startedSpinner = spinner.start();

      expect(typeof startedSpinner.fail).toBe('function');
      expect(typeof startedSpinner.succeed).toBe('function');
      expect(typeof startedSpinner.stop).toBe('function');
      expect(startedSpinner.text).toBe('');

      expect(() => {
        startedSpinner.fail();
        startedSpinner.succeed();
        startedSpinner.stop();
      }).not.toThrow();
    });

    it('should handle different console output types correctly', () => {
      // Test with 'json'
      mockGetConsoleOutputType.mockReturnValue('json');
      const jsonSpinner = createOra('JSON message');
      expect(jsonSpinner.text).toBe('');

      // Test with 'plain'
      mockGetConsoleOutputType.mockReturnValue('plain');
      const plainSpinner = createOra('Plain message');
      expect(typeof plainSpinner).toBe('object');

      // Test with undefined
      mockGetConsoleOutputType.mockReturnValue(undefined as any);
      const undefinedSpinner = createOra('Undefined message');
      expect(typeof undefinedSpinner).toBe('object');
    });

    it('should return consistent mock structure for json output', () => {
      mockGetConsoleOutputType.mockReturnValue('json');

      const spinner1 = createOra('Message 1');
      const spinner2 = createOra('Message 2');

      expect(typeof spinner1.fail).toBe('function');
      expect(typeof spinner1.succeed).toBe('function');
      expect(typeof spinner1.stop).toBe('function');
      expect(typeof spinner1.start).toBe('function');
      expect(spinner1.text).toBe('');
      
      expect(typeof spinner2.fail).toBe('function');
      expect(typeof spinner2.succeed).toBe('function');
      expect(typeof spinner2.stop).toBe('function');
      expect(typeof spinner2.start).toBe('function');
      expect(spinner2.text).toBe('');
    });

  });
});