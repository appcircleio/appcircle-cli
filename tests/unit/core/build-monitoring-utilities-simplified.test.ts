import { describe, it, expect, vi, beforeEach } from 'vitest';
import chalk from 'chalk';

// Mock dependencies
vi.mock('../../../src/utils/orahelper', () => ({
  createOra: vi.fn()
}));

vi.mock('../../../src/config', async () => {
  const actual = await vi.importActual('../../../src/config');
  return {
    ...actual,
    getConsoleOutputType: vi.fn().mockReturnValue('plain'),
    getInteractiveMode: vi.fn().mockReturnValue(false)
  };
});

vi.mock('chalk', () => ({
  default: {
    red: vi.fn((msg) => msg),
    yellow: vi.fn((msg) => msg),
    green: vi.fn((msg) => msg),
    cyan: vi.fn((msg) => msg),
    blue: vi.fn((msg) => msg),
    gray: vi.fn((msg) => msg),
    hex: vi.fn(() => vi.fn((msg) => msg))
  }
}));

// Mock the AppcircleExitError
vi.mock('../../../src/core/AppcircleExitError', () => ({
  AppcircleExitError: class AppcircleExitError extends Error {
    public code: number;
    constructor(message: string, code: number) {
      super(message);
      this.code = code;
    }
  }
}));

import { createOra } from '../../../src/utils/orahelper';
import { getConsoleOutputType } from '../../../src/config';

import {
  createProgressSpinner,
  updateBuildStatusMessage
} from '../../../src/core/command-runner';
import { formatElapsedTime } from '../../../src/core/command-runner-utilities';

describe('Build Monitoring Utilities - Core Functions', () => {
  let mockSpinner: any;

  beforeEach(() => {
    vi.clearAllMocks();
    
    mockSpinner = {
      start: vi.fn().mockReturnThis(),
      stop: vi.fn(),
      succeed: vi.fn(),
      fail: vi.fn(),
      text: ''
    };
    (createOra as any).mockReturnValue(mockSpinner);
  });

  describe('createProgressSpinner', () => {
    it('should return actual spinner in non-JSON mode', () => {
      (getConsoleOutputType as any).mockReturnValue('plain');
      
      const result = createProgressSpinner('Test message');
      
      expect(createOra).toHaveBeenCalledWith('Test message');
      expect(result).toBe(mockSpinner);
    });

    it('should return mock spinner in JSON mode', () => {
      (getConsoleOutputType as any).mockReturnValue('json');
      
      const result = createProgressSpinner('Test message');
      
      expect(createOra).not.toHaveBeenCalled();
      expect(result).toEqual({
        text: '',
        succeed: expect.any(Function),
        fail: expect.any(Function),
        stop: expect.any(Function)
      });
    });
  });

  describe('formatElapsedTime', () => {
    it('should format time under 1 minute correctly', () => {
      const now = Date.now();
      const startTime = now - 30000; // 30 seconds ago
      vi.spyOn(Date, 'now').mockReturnValue(now);
      
      const result = formatElapsedTime(startTime);
      
      expect(result).toBe('30s');
    });

    it('should format time over 1 minute correctly', () => {
      const now = Date.now();
      const startTime = now - 125000; // 2 minutes 5 seconds ago
      vi.spyOn(Date, 'now').mockReturnValue(now);
      
      const result = formatElapsedTime(startTime);
      
      expect(result).toBe('2m 5s');
    });

    it('should handle exactly 1 minute', () => {
      const now = Date.now();
      const startTime = now - 60000; // 1 minute ago
      vi.spyOn(Date, 'now').mockReturnValue(now);
      
      const result = formatElapsedTime(startTime);
      
      expect(result).toBe('1m 0s');
    });

    it('should handle zero elapsed time', () => {
      const now = Date.now();
      vi.spyOn(Date, 'now').mockReturnValue(now);
      
      const result = formatElapsedTime(now);
      
      expect(result).toBe('0s');
    });

    it('should handle exactly 2 hours', () => {
      const now = Date.now();
      const startTime = now - 7200000; // 2 hours ago
      vi.spyOn(Date, 'now').mockReturnValue(now);
      
      const result = formatElapsedTime(startTime);
      
      expect(result).toBe('120m 0s');
    });
  });

  describe('updateBuildStatusMessage', () => {
    beforeEach(() => {
      mockSpinner.text = '';
    });

    it('should handle null/undefined build status (pending)', () => {
      updateBuildStatusMessage(null, '30s', mockSpinner);
      
      expect(mockSpinner.text).toContain('Build Status is pending...');
      expect(chalk.gray).toHaveBeenCalled();
    });

    it('should handle undefined build status (pending)', () => {
      updateBuildStatusMessage(undefined, '45s', mockSpinner);
      
      expect(mockSpinner.text).toContain('Build Status is pending...');
      expect(chalk.gray).toHaveBeenCalled();
    });

    it('should handle success status without warning', () => {
      updateBuildStatusMessage(0, '2m 30s', mockSpinner);
      
      expect(mockSpinner.text).toContain('Build completed successfully ✅ (2m 30s)');
    });

    it('should handle success status with warning', () => {
      updateBuildStatusMessage(0, '2m 30s', mockSpinner, true);
      
      expect(mockSpinner.text).toContain('Build completed with warnings ⚠️ (2m 30s)');
      expect(chalk.hex).toHaveBeenCalledWith('#FFA500');
    });

    it('should handle failed status (1)', () => {
      updateBuildStatusMessage(1, '1m 15s', mockSpinner);
      
      expect(mockSpinner.text).toContain('Build failed ❌ (1m 15s)');
      expect(chalk.red).toHaveBeenCalled();
    });

    it('should handle canceled status (2)', () => {
      updateBuildStatusMessage(2, '45s', mockSpinner);
      
      expect(mockSpinner.text).toContain('Build canceled 🚫 (45s)');
      expect(chalk.hex).toHaveBeenCalledWith('#FF8C32');
    });

    it('should handle timeout status (3)', () => {
      updateBuildStatusMessage(3, '10m 0s', mockSpinner);
      
      expect(mockSpinner.text).toContain('Build timed out ⏱️ (10m 0s)');
      expect(chalk.red).toHaveBeenCalled();
    });

    it('should handle waiting status (90)', () => {
      updateBuildStatusMessage(90, '1m 0s', mockSpinner);
      
      expect(mockSpinner.text).toContain('Build waiting in queue ⏳ (1m 0s)');
      expect(chalk.cyan).toHaveBeenCalled();
    });

    it('should handle running status (91) without changing text', () => {
      const originalText = 'Original running text';
      mockSpinner.text = originalText;
      
      updateBuildStatusMessage(91, '2m 0s', mockSpinner);
      
      // Running status should not change the spinner text
      expect(mockSpinner.text).toBe(originalText);
    });

    it('should handle completing status (92)', () => {
      updateBuildStatusMessage(92, '3m 30s', mockSpinner);
      
      expect(mockSpinner.text).toContain('Build finishing... 🔜 (3m 30s)');
      expect(chalk.blue).toHaveBeenCalled();
    });

    it('should handle unknown/unexpected status codes', () => {
      updateBuildStatusMessage(999, '1m 30s', mockSpinner);
      
      expect(mockSpinner.text).toContain('Build Status: 999 (1m 30s)');
      expect(chalk.gray).toHaveBeenCalled();
    });

    it('should handle negative status codes', () => {
      updateBuildStatusMessage(-1, '2m 0s', mockSpinner);
      
      expect(mockSpinner.text).toContain('Build Status: -1 (2m 0s)');
      expect(chalk.gray).toHaveBeenCalled();
    });

    it('should handle zero elapsed time', () => {
      updateBuildStatusMessage(0, '0s', mockSpinner);
      
      expect(mockSpinner.text).toContain('Build completed successfully ✅ (0s)');
    });

    it('should handle very long elapsed time', () => {
      updateBuildStatusMessage(0, '120m 45s', mockSpinner);
      
      expect(mockSpinner.text).toContain('Build completed successfully ✅ (120m 45s)');
    });

    it('should preserve warning status when hasWarning is explicitly false', () => {
      updateBuildStatusMessage(0, '1m 0s', mockSpinner, false);
      
      expect(mockSpinner.text).toContain('Build completed successfully ✅ (1m 0s)');
      expect(mockSpinner.text).not.toContain('warnings');
    });

    it('should handle all status codes correctly', () => {
      const testCases = [
        { status: 0, expectedText: 'Build completed successfully ✅', color: null },
        { status: 1, expectedText: 'Build failed ❌', color: chalk.red },
        { status: 2, expectedText: 'Build canceled 🚫', color: null }, // Uses hex
        { status: 3, expectedText: 'Build timed out ⏱️', color: chalk.red },
        { status: 90, expectedText: 'Build waiting in queue ⏳', color: chalk.cyan },
        { status: 92, expectedText: 'Build finishing... 🔜', color: chalk.blue },
      ];

      testCases.forEach(({ status, expectedText, color }) => {
        vi.clearAllMocks();
        mockSpinner.text = '';
        
        updateBuildStatusMessage(status, '1m 0s', mockSpinner);
        
        expect(mockSpinner.text).toContain(expectedText);
        if (color) {
          expect(color).toHaveBeenCalled();
        }
      });
    });
  });
});