import { describe, it, expect, vi, beforeEach } from 'vitest';
import { handleKeystoreIdParameter } from '../../../src/core/interactive-runner.ts';

const mockOraSpinner = {
  start: vi.fn().mockReturnThis(),
  stop: vi.fn().mockReturnThis(),
  fail: vi.fn().mockReturnThis(),
  text: ''
};

const mockCreatePrompt = vi.fn();

describe('handleKeystoreIdParameter', () => {
  const mockParam = { name: 'keystoreId', type: 'SELECT' };
  const mockParams = {};

  beforeEach(() => {
    vi.clearAllMocks();
    mockOraSpinner.text = '';
  });

  describe('Basic Functionality', () => {
    it('should successfully handle keystore selection', async () => {
      const mockKeystores = [
        { id: 'keystore-123', name: 'Production Keystore' },
        { id: 'keystore-456', name: 'Development Keystore' }
      ];
      const mockGetAndroidKeystores = vi.fn().mockResolvedValue(mockKeystores);

      const mockPrompt = {
        run: vi.fn().mockResolvedValue('Production Keystore (keystore-123)')
      };
      mockCreatePrompt.mockReturnValue(mockPrompt);

      const result = await handleKeystoreIdParameter(
        mockParam,
        mockParams,
        mockGetAndroidKeystores,
        mockCreatePrompt,
        () => mockOraSpinner
      );

      expect(result.value).toBe('keystore-123');
      expect(mockOraSpinner.start).toHaveBeenCalledTimes(1);
      expect(mockOraSpinner.stop).toHaveBeenCalledTimes(1);
    });

    it('should format keystore params correctly', async () => {
      const mockKeystores = [
        { id: 'keystore-123', name: 'Production Keystore' },
        { id: 'keystore-456', name: 'Development Keystore' },
        { id: 'keystore-789', name: 'Testing Keystore' }
      ];
      const mockGetAndroidKeystores = vi.fn().mockResolvedValue(mockKeystores);

      const mockPrompt = {
        run: vi.fn().mockResolvedValue('Production Keystore (keystore-123)')
      };
      mockCreatePrompt.mockReturnValue(mockPrompt);

      await handleKeystoreIdParameter(
        mockParam,
        mockParams,
        mockGetAndroidKeystores,
        mockCreatePrompt,
        () => mockOraSpinner
      );

      expect(mockParam.params).toEqual([
        { name: 'Production Keystore (keystore-123)', message: 'Production Keystore (keystore-123)' },
        { name: 'Development Keystore (keystore-456)', message: 'Development Keystore (keystore-456)' },
        { name: 'Testing Keystore (keystore-789)', message: 'Testing Keystore (keystore-789)' }
      ]);
    });

    it('should create prompt with correct parameters', async () => {
      const mockKeystores = [{ id: 'keystore-123', name: 'Test Keystore' }];
      const mockGetAndroidKeystores = vi.fn().mockResolvedValue(mockKeystores);

      const mockPrompt = {
        run: vi.fn().mockResolvedValue('Test Keystore (keystore-123)')
      };
      mockCreatePrompt.mockReturnValue(mockPrompt);

      await handleKeystoreIdParameter(
        mockParam,
        mockParams,
        mockGetAndroidKeystores,
        mockCreatePrompt,
        () => mockOraSpinner
      );

      expect(mockCreatePrompt).toHaveBeenCalledWith(
        'keystoreId',
        'Keystore (1 options)',
        ['Test Keystore (keystore-123)'],
        10
      );
    });

    it('should use custom description when provided', async () => {
      const customParam = { name: 'keystoreId', type: 'SELECT', description: 'Android Signing Keystore' };
      const mockKeystores = [{ id: 'keystore-123', name: 'Test Keystore' }];
      const mockGetAndroidKeystores = vi.fn().mockResolvedValue(mockKeystores);

      const mockPrompt = {
        run: vi.fn().mockResolvedValue('Test Keystore (keystore-123)')
      };
      mockCreatePrompt.mockReturnValue(mockPrompt);

      await handleKeystoreIdParameter(
        customParam,
        mockParams,
        mockGetAndroidKeystores,
        mockCreatePrompt,
        () => mockOraSpinner
      );

      expect(mockCreatePrompt).toHaveBeenCalledWith(
        'keystoreId',
        'Android Signing Keystore (1 options)',
        ['Test Keystore (keystore-123)'],
        10
      );
    });
  });

  describe('UUID Extraction', () => {
    it('should extract UUID from keystore selection', async () => {
      const mockKeystores = [{ id: 'keystore-uuid-123', name: 'Test Keystore' }];
      const mockGetAndroidKeystores = vi.fn().mockResolvedValue(mockKeystores);

      const mockPrompt = {
        run: vi.fn().mockResolvedValue('Test Keystore (keystore-uuid-123)')
      };
      mockCreatePrompt.mockReturnValue(mockPrompt);

      const result = await handleKeystoreIdParameter(
        mockParam,
        mockParams,
        mockGetAndroidKeystores,
        mockCreatePrompt,
        () => mockOraSpinner
      );

      expect(result.value).toBe('keystore-uuid-123');
    });

    it('should trim extracted UUID', async () => {
      const mockKeystores = [{ id: 'spaced-keystore-uuid', name: 'Test Keystore' }];
      const mockGetAndroidKeystores = vi.fn().mockResolvedValue(mockKeystores);

      const mockPrompt = {
        run: vi.fn().mockResolvedValue('Test Keystore ( spaced-keystore-uuid )')
      };
      mockCreatePrompt.mockReturnValue(mockPrompt);

      const result = await handleKeystoreIdParameter(
        mockParam,
        mockParams,
        mockGetAndroidKeystores,
        mockCreatePrompt,
        () => mockOraSpinner
      );

      expect(result.value).toBe('spaced-keystore-uuid');
    });

    it('should handle multiple parentheses and extract from last one', async () => {
      const mockKeystores = [{ id: 'final-keystore-uuid', name: 'Test Keystore' }];
      const mockGetAndroidKeystores = vi.fn().mockResolvedValue(mockKeystores);

      const mockPrompt = {
        run: vi.fn().mockResolvedValue('Keystore (Name) (Type) (final-keystore-uuid)')
      };
      mockCreatePrompt.mockReturnValue(mockPrompt);

      const result = await handleKeystoreIdParameter(
        mockParam,
        mockParams,
        mockGetAndroidKeystores,
        mockCreatePrompt,
        () => mockOraSpinner
      );

      expect(result.value).toBe('final-keystore-uuid');
    });

    it('should handle complex keystore names', async () => {
      const mockKeystores = [{ id: 'complex-uuid', name: 'Production Release Keystore (v2.0)' }];
      const mockGetAndroidKeystores = vi.fn().mockResolvedValue(mockKeystores);

      const mockPrompt = {
        run: vi.fn().mockResolvedValue('Production Release Keystore (v2.0) (complex-uuid)')
      };
      mockCreatePrompt.mockReturnValue(mockPrompt);

      const result = await handleKeystoreIdParameter(
        mockParam,
        mockParams,
        mockGetAndroidKeystores,
        mockCreatePrompt,
        () => mockOraSpinner
      );

      expect(result.value).toBe('complex-uuid');
    });
  });

  describe('Fallback Logic', () => {
    it('should use fallback to find keystore by ID when regex fails', async () => {
      const mockKeystores = [
        { id: 'keystore-123', name: 'Test Keystore 1' },
        { id: 'keystore-456', name: 'Test Keystore 2' }
      ];
      const mockGetAndroidKeystores = vi.fn().mockResolvedValue(mockKeystores);

      const mockPrompt = {
        run: vi.fn().mockResolvedValue('keystore-456 - no parentheses')
      };
      mockCreatePrompt.mockReturnValue(mockPrompt);

      const result = await handleKeystoreIdParameter(
        mockParam,
        mockParams,
        mockGetAndroidKeystores,
        mockCreatePrompt,
        () => mockOraSpinner
      );

      expect(result.value).toBe('keystore-456');
    });

    it('should return selection as-is when no keystore found in fallback', async () => {
      const mockKeystores = [{ id: 'keystore-123', name: 'Test Keystore' }];
      const mockGetAndroidKeystores = vi.fn().mockResolvedValue(mockKeystores);

      const mockPrompt = {
        run: vi.fn().mockResolvedValue('unknown-selection')
      };
      mockCreatePrompt.mockReturnValue(mockPrompt);

      const result = await handleKeystoreIdParameter(
        mockParam,
        mockParams,
        mockGetAndroidKeystores,
        mockCreatePrompt,
        () => mockOraSpinner
      );

      expect(result.value).toBe('unknown-selection');
    });

    it('should find keystore by partial ID match in fallback', async () => {
      const mockKeystores = [
        { id: 'full-keystore-uuid-123', name: 'Complete Keystore' },
        { id: 'another-uuid-456', name: 'Another Keystore' }
      ];
      const mockGetAndroidKeystores = vi.fn().mockResolvedValue(mockKeystores);

      const mockPrompt = {
        run: vi.fn().mockResolvedValue('Selection contains full-keystore-uuid-123 somewhere')
      };
      mockCreatePrompt.mockReturnValue(mockPrompt);

      const result = await handleKeystoreIdParameter(
        mockParam,
        mockParams,
        mockGetAndroidKeystores,
        mockCreatePrompt,
        () => mockOraSpinner
      );

      expect(result.value).toBe('full-keystore-uuid-123');
    });
  });

  describe('Error Handling', () => {
    it('should return error when no keystores available', async () => {
      const mockGetAndroidKeystores = vi.fn().mockResolvedValue([]);

      const result = await handleKeystoreIdParameter(
        mockParam,
        mockParams,
        mockGetAndroidKeystores,
        mockCreatePrompt,
        () => mockOraSpinner
      );

      expect(result).toEqual({ isError: true });
      expect(mockOraSpinner.text).toBe('No keystore available');
      expect(mockOraSpinner.fail).toHaveBeenCalledTimes(1);
    });

    it('should return error when keystores list is null', async () => {
      const mockGetAndroidKeystores = vi.fn().mockResolvedValue(null);

      const result = await handleKeystoreIdParameter(
        mockParam,
        mockParams,
        mockGetAndroidKeystores,
        mockCreatePrompt,
        () => mockOraSpinner
      );

      expect(result).toEqual({ isError: true });
      expect(mockOraSpinner.text).toBe('No keystore available');
      expect(mockOraSpinner.fail).toHaveBeenCalledTimes(1);
    });

    it('should handle getAndroidKeystores throwing an exception', async () => {
      const mockGetAndroidKeystores = vi.fn().mockRejectedValue(new Error('API Error'));

      const result = await handleKeystoreIdParameter(
        mockParam,
        mockParams,
        mockGetAndroidKeystores,
        mockCreatePrompt,
        () => mockOraSpinner
      );

      expect(result).toEqual({ isError: true });
      expect(mockOraSpinner.text).toBe('Fetching keystores failed');
      expect(mockOraSpinner.fail).toHaveBeenCalledTimes(1);
    });
  });

  describe('Keystore Data Handling', () => {
    it('should handle keystores with missing name gracefully', async () => {
      const mockKeystores = [
        { id: 'keystore-123' }, // missing name
        { id: 'keystore-456', name: 'Valid Keystore' }
      ];
      const mockGetAndroidKeystores = vi.fn().mockResolvedValue(mockKeystores);

      const mockPrompt = {
        run: vi.fn().mockResolvedValue('undefined (keystore-123)')
      };
      mockCreatePrompt.mockReturnValue(mockPrompt);

      await handleKeystoreIdParameter(
        mockParam,
        mockParams,
        mockGetAndroidKeystores,
        mockCreatePrompt,
        () => mockOraSpinner
      );

      expect(mockParam.params[0].name).toBe('undefined (keystore-123)');
      expect(mockParam.params[1].name).toBe('Valid Keystore (keystore-456)');
    });

    it('should handle keystores with missing ID gracefully', async () => {
      const mockKeystores = [
        { name: 'Keystore Without ID' } // missing id
      ];
      const mockGetAndroidKeystores = vi.fn().mockResolvedValue(mockKeystores);

      const mockPrompt = {
        run: vi.fn().mockResolvedValue('Keystore Without ID (undefined)')
      };
      mockCreatePrompt.mockReturnValue(mockPrompt);

      await handleKeystoreIdParameter(
        mockParam,
        mockParams,
        mockGetAndroidKeystores,
        mockCreatePrompt,
        () => mockOraSpinner
      );

      expect(mockParam.params[0].name).toBe('Keystore Without ID (undefined)');
    });

    it('should handle keystores with special characters in name', async () => {
      const mockKeystores = [
        { id: 'special-123', name: 'Keystore: Production (v1.0) - Main' },
        { id: 'emoji-456', name: 'Development 🔐 Keystore' }
      ];
      const mockGetAndroidKeystores = vi.fn().mockResolvedValue(mockKeystores);

      const mockPrompt = {
        run: vi.fn().mockResolvedValue('Keystore: Production (v1.0) - Main (special-123)')
      };
      mockCreatePrompt.mockReturnValue(mockPrompt);

      await handleKeystoreIdParameter(
        mockParam,
        mockParams,
        mockGetAndroidKeystores,
        mockCreatePrompt,
        () => mockOraSpinner
      );

      expect(mockParam.params[0].name).toBe('Keystore: Production (v1.0) - Main (special-123)');
      expect(mockParam.params[1].name).toBe('Development 🔐 Keystore (emoji-456)');
    });

    it('should handle completely empty keystore objects', async () => {
      const mockKeystores = [
        {}, // completely empty
        { id: 'valid-123', name: 'Valid Keystore' }
      ];
      const mockGetAndroidKeystores = vi.fn().mockResolvedValue(mockKeystores);

      const mockPrompt = {
        run: vi.fn().mockResolvedValue('Valid Keystore (valid-123)')
      };
      mockCreatePrompt.mockReturnValue(mockPrompt);

      await handleKeystoreIdParameter(
        mockParam,
        mockParams,
        mockGetAndroidKeystores,
        mockCreatePrompt,
        () => mockOraSpinner
      );

      expect(mockParam.params[0].name).toBe('undefined (undefined)');
      expect(mockParam.params[1].name).toBe('Valid Keystore (valid-123)');
    });
  });

  describe('Edge Cases and Integration', () => {
    it('should handle large numbers of keystores', async () => {
      const mockKeystores = Array.from({ length: 100 }, (_, i) => ({
        id: `keystore-${i}`,
        name: `Keystore ${i}`
      }));
      const mockGetAndroidKeystores = vi.fn().mockResolvedValue(mockKeystores);

      const mockPrompt = {
        run: vi.fn().mockResolvedValue('Keystore 50 (keystore-50)')
      };
      mockCreatePrompt.mockReturnValue(mockPrompt);

      const result = await handleKeystoreIdParameter(
        mockParam,
        mockParams,
        mockGetAndroidKeystores,
        mockCreatePrompt,
        () => mockOraSpinner
      );

      expect(result.value).toBe('keystore-50');
      expect(mockParam.params).toHaveLength(100);
      expect(mockCreatePrompt).toHaveBeenCalledWith(
        'keystoreId',
        'Keystore (100 options)',
        expect.arrayContaining(['Keystore 50 (keystore-50)']),
        10
      );
    });

    it('should handle keystores with very long names', async () => {
      const longName = 'A'.repeat(200);
      const mockKeystores = [
        { id: 'long-keystore', name: longName }
      ];
      const mockGetAndroidKeystores = vi.fn().mockResolvedValue(mockKeystores);

      const mockPrompt = {
        run: vi.fn().mockResolvedValue(`${longName} (long-keystore)`)
      };
      mockCreatePrompt.mockReturnValue(mockPrompt);

      const result = await handleKeystoreIdParameter(
        mockParam,
        mockParams,
        mockGetAndroidKeystores,
        mockCreatePrompt,
        () => mockOraSpinner
      );

      expect(result.value).toBe('long-keystore');
      expect(mockParam.params[0].name).toBe(`${longName} (long-keystore)`);
    });

    it('should handle complex integration scenario', async () => {
      const mockKeystores = [
        { id: 'prod-keystore-123', name: 'Production Keystore' },
        { id: 'dev-keystore-456', name: 'Development Keystore' },
        { id: 'test-keystore-789', name: 'Testing Keystore' }
      ];
      const mockGetAndroidKeystores = vi.fn().mockResolvedValue(mockKeystores);

      const mockPrompt = {
        run: vi.fn().mockResolvedValue('Development Keystore (dev-keystore-456)')
      };
      mockCreatePrompt.mockReturnValue(mockPrompt);

      const result = await handleKeystoreIdParameter(
        { name: 'keystoreId', type: 'SELECT', description: 'Android Signing Key' },
        mockParams,
        mockGetAndroidKeystores,
        mockCreatePrompt,
        () => mockOraSpinner
      );

      expect(result.value).toBe('dev-keystore-456');
      expect(mockCreatePrompt).toHaveBeenCalledWith(
        'keystoreId',
        'Android Signing Key (3 options)',
        [
          'Production Keystore (prod-keystore-123)',
          'Development Keystore (dev-keystore-456)',
          'Testing Keystore (test-keystore-789)'
        ],
        10
      );
    });
  });

  describe('Dependency Injection', () => {
    it('should use custom createPrompt when provided', async () => {
      const customCreatePrompt = vi.fn();
      const mockKeystores = [{ id: 'keystore-123', name: 'Test Keystore' }];
      const mockGetAndroidKeystores = vi.fn().mockResolvedValue(mockKeystores);

      const mockPrompt = {
        run: vi.fn().mockResolvedValue('Test Keystore (keystore-123)')
      };
      customCreatePrompt.mockReturnValue(mockPrompt);

      await handleKeystoreIdParameter(
        mockParam,
        mockParams,
        mockGetAndroidKeystores,
        customCreatePrompt,
        () => mockOraSpinner
      );

      expect(customCreatePrompt).toHaveBeenCalledTimes(1);
      expect(mockCreatePrompt).not.toHaveBeenCalled();
    });

    it('should use custom spinner when provided', async () => {
      const customSpinner = {
        start: vi.fn().mockReturnThis(),
        stop: vi.fn().mockReturnThis(),
        fail: vi.fn().mockReturnThis(),
        text: ''
      };
      const mockKeystores = [{ id: 'keystore-123', name: 'Test Keystore' }];
      const mockGetAndroidKeystores = vi.fn().mockResolvedValue(mockKeystores);

      const mockPrompt = {
        run: vi.fn().mockResolvedValue('Test Keystore (keystore-123)')
      };
      mockCreatePrompt.mockReturnValue(mockPrompt);

      await handleKeystoreIdParameter(
        mockParam,
        mockParams,
        mockGetAndroidKeystores,
        mockCreatePrompt,
        () => customSpinner
      );

      expect(customSpinner.start).toHaveBeenCalledTimes(1);
      expect(customSpinner.stop).toHaveBeenCalledTimes(1);
      expect(mockOraSpinner.start).not.toHaveBeenCalled();
      expect(mockOraSpinner.stop).not.toHaveBeenCalled();
    });
  });

  describe('Async Error Handling', () => {
    it('should handle getAndroidKeystores timeout', async () => {
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Keystore API Timeout')), 100);
      });
      const mockGetAndroidKeystores = vi.fn().mockReturnValue(timeoutPromise);

      const result = await handleKeystoreIdParameter(
        mockParam,
        mockParams,
        mockGetAndroidKeystores,
        mockCreatePrompt,
        () => mockOraSpinner
      );

      expect(result).toEqual({ isError: true });
      expect(mockOraSpinner.text).toBe('Fetching keystores failed');
      expect(mockOraSpinner.fail).toHaveBeenCalledTimes(1);
    });

    it('should handle unexpected data format from API', async () => {
      const malformedData = [
        'string-keystore', // Not an object
        { id: 'valid-keystore', name: 'Valid Keystore' },
        null, // Null keystore
        { name: 'Missing ID Keystore' }, // Missing ID
        { id: 'missing-name-keystore' } // Missing name
      ];
      const mockGetAndroidKeystores = vi.fn().mockResolvedValue(malformedData);

      const mockPrompt = {
        run: vi.fn().mockResolvedValue('Valid Keystore (valid-keystore)')
      };
      mockCreatePrompt.mockReturnValue(mockPrompt);

      const result = await handleKeystoreIdParameter(
        mockParam,
        mockParams,
        mockGetAndroidKeystores,
        mockCreatePrompt,
        () => mockOraSpinner
      );

      expect(result.value).toBe('valid-keystore');
      expect(mockParam.params).toHaveLength(5);
      expect(mockOraSpinner.stop).toHaveBeenCalledTimes(1);
    });
  });
});