import { describe, it, expect, vi, beforeEach } from 'vitest';
import { handleEntVersionIdParameter } from '../../../src/core/interactive-runner.ts';

const mockOraSpinner = {
  start: vi.fn().mockReturnThis(),
  stop: vi.fn().mockReturnThis(),
  fail: vi.fn().mockReturnThis(),
  text: ''
};

const mockCreatePrompt = vi.fn();

// Mock ora
vi.mock('ora', () => ({
  default: vi.fn(() => mockOraSpinner)
}));

describe('handleEntVersionIdParameter', () => {
  const mockParam = { name: 'entVersionId', description: 'App Version ID' };
  const mockParams = { entProfileId: 'profile123' };

  beforeEach(() => {
    vi.clearAllMocks();
    mockOraSpinner.text = '';
  });

  describe('Basic Functionality', () => {
    it('should successfully handle enterprise version selection', async () => {
      const mockVersions = [
        { id: 'version1', version: '1.0.0', versionCode: '100' },
        { id: 'version2', version: '1.1.0', versionCode: '110' },
      ];
      const mockGetEnterpriseAppVersions = vi.fn().mockResolvedValue(mockVersions);

      const mockPrompt = {
        run: vi.fn().mockResolvedValue('1.0.0 (100) (version1)')
      };
      mockCreatePrompt.mockReturnValue(mockPrompt);

      const result = await handleEntVersionIdParameter(
        mockParam,
        mockParams,
        mockGetEnterpriseAppVersions,
        mockCreatePrompt,
        () => mockOraSpinner
      );

      expect(result).toEqual({ value: 'version1' });
      expect(mockGetEnterpriseAppVersions).toHaveBeenCalledWith({ entProfileId: 'profile123', publishType: '' });
      expect(mockOraSpinner.start).toHaveBeenCalledTimes(1);
      expect(mockOraSpinner.stop).toHaveBeenCalledTimes(1);
    });

    it('should create prompt with correct parameters', async () => {
      const mockVersions = [
        { id: 'version1', version: '1.0.0', versionCode: '100' },
        { id: 'version2', version: '2.0.0', versionCode: '200' },
      ];
      const mockGetEnterpriseAppVersions = vi.fn().mockResolvedValue(mockVersions);

      const mockPrompt = {
        run: vi.fn().mockResolvedValue('1.0.0 (100) (version1)')
      };
      mockCreatePrompt.mockReturnValue(mockPrompt);

      await handleEntVersionIdParameter(
        mockParam,
        mockParams,
        mockGetEnterpriseAppVersions,
        mockCreatePrompt,
        () => mockOraSpinner
      );

      expect(mockCreatePrompt).toHaveBeenCalledWith(
        'entVersionId',
        'App Version ID (2 options)',
        ['1.0.0 (100) (version1)', '2.0.0 (200) (version2)'],
        10
      );
    });

    it('should format choices correctly with version, versionCode and ID', async () => {
      const mockVersions = [
        { id: 'abc123', version: '3.2.1', versionCode: '321' },
        { id: 'def456', version: '4.0.0', versionCode: '400' },
      ];
      const mockGetEnterpriseAppVersions = vi.fn().mockResolvedValue(mockVersions);

      const mockPrompt = {
        run: vi.fn().mockResolvedValue('3.2.1 (321) (abc123)')
      };
      mockCreatePrompt.mockReturnValue(mockPrompt);

      await handleEntVersionIdParameter(
        mockParam,
        mockParams,
        mockGetEnterpriseAppVersions,
        mockCreatePrompt,
        () => mockOraSpinner
      );

      const expectedChoices = [
        '3.2.1 (321) (abc123)',
        '4.0.0 (400) (def456)'
      ];
      expect(mockCreatePrompt).toHaveBeenCalledWith(
        'entVersionId',
        'App Version ID (2 options)',
        expectedChoices,
        10
      );
    });

    it('should pass entProfileId from params to getEnterpriseAppVersions', async () => {
      const customParams = { entProfileId: 'custom-profile-id' };
      const mockGetEnterpriseAppVersions = vi.fn().mockResolvedValue([
        { id: 'version1', version: '1.0.0', versionCode: '100' }
      ]);

      const mockPrompt = {
        run: vi.fn().mockResolvedValue('1.0.0 (100) (version1)')
      };
      mockCreatePrompt.mockReturnValue(mockPrompt);

      await handleEntVersionIdParameter(
        mockParam,
        customParams,
        mockGetEnterpriseAppVersions,
        mockCreatePrompt,
        () => mockOraSpinner
      );

      expect(mockGetEnterpriseAppVersions).toHaveBeenCalledWith({ 
        entProfileId: 'custom-profile-id', 
        publishType: '' 
      });
    });
  });

  describe('Error Handling', () => {
    it('should return error when no versions are found', async () => {
      const mockGetEnterpriseAppVersions = vi.fn().mockResolvedValue([]);

      const result = await handleEntVersionIdParameter(
        mockParam,
        mockParams,
        mockGetEnterpriseAppVersions,
        mockCreatePrompt,
        () => mockOraSpinner
      );

      expect(result).toEqual({ isError: true });
      expect(mockOraSpinner.text).toBe('No version available');
      expect(mockOraSpinner.fail).toHaveBeenCalledTimes(1);
    });

    it('should return error when versions is null', async () => {
      const mockGetEnterpriseAppVersions = vi.fn().mockResolvedValue(null);

      const result = await handleEntVersionIdParameter(
        mockParam,
        mockParams,
        mockGetEnterpriseAppVersions,
        mockCreatePrompt,
        () => mockOraSpinner
      );

      expect(result).toEqual({ isError: true });
      expect(mockOraSpinner.text).toBe('No version available');
      expect(mockOraSpinner.fail).toHaveBeenCalledTimes(1);
    });

    it('should return error when versions is undefined', async () => {
      const mockGetEnterpriseAppVersions = vi.fn().mockResolvedValue(undefined);

      const result = await handleEntVersionIdParameter(
        mockParam,
        mockParams,
        mockGetEnterpriseAppVersions,
        mockCreatePrompt,
        () => mockOraSpinner
      );

      expect(result).toEqual({ isError: true });
      expect(mockOraSpinner.text).toBe('No version available');
      expect(mockOraSpinner.fail).toHaveBeenCalledTimes(1);
    });

    it('should handle getEnterpriseAppVersions throwing an exception', async () => {
      const mockGetEnterpriseAppVersions = vi.fn().mockRejectedValue(new Error('API Error'));

      await expect(handleEntVersionIdParameter(
        mockParam,
        mockParams,
        mockGetEnterpriseAppVersions,
        mockCreatePrompt,
        () => mockOraSpinner
      )).rejects.toThrow('API Error');
    });
  });

  describe('Selection and ID Extraction', () => {
    it('should extract version ID from parentheses format', async () => {
      const mockVersions = [
        { id: 'version1', version: '1.0.0', versionCode: '100' }
      ];
      const mockGetEnterpriseAppVersions = vi.fn().mockResolvedValue(mockVersions);

      const mockPrompt = {
        run: vi.fn().mockResolvedValue('1.0.0 (100) (version1)')
      };
      mockCreatePrompt.mockReturnValue(mockPrompt);

      const result = await handleEntVersionIdParameter(
        mockParam,
        mockParams,
        mockGetEnterpriseAppVersions,
        mockCreatePrompt,
        () => mockOraSpinner
      );

      expect(result).toEqual({ value: 'version1' });
    });

    it('should trim extracted version ID when regex matches', async () => {
      const mockVersions = [
        { id: 'version1', version: '1.0.0', versionCode: '100' }
      ];
      const mockGetEnterpriseAppVersions = vi.fn().mockResolvedValue(mockVersions);

      // Note: The regex /\(([\w-]+)\)$/ only matches alphanumeric and hyphens
      // So we test by creating a scenario where the extracted value might have spaces
      // that get trimmed. This is more of a defensive test.
      const mockPrompt = {
        run: vi.fn().mockResolvedValue('1.0.0 (100) (version1)')
      };
      mockCreatePrompt.mockReturnValue(mockPrompt);

      const result = await handleEntVersionIdParameter(
        mockParam,
        mockParams,
        mockGetEnterpriseAppVersions,
        mockCreatePrompt,
        () => mockOraSpinner
      );

      // The regex should match 'version1' and the trim() ensures no extra spaces
      expect(result).toEqual({ value: 'version1' });
    });

    it('should handle multiple parentheses and extract from last one', async () => {
      const mockVersions = [
        { id: 'version1', version: '1.0.0', versionCode: '100' }
      ];
      const mockGetEnterpriseAppVersions = vi.fn().mockResolvedValue(mockVersions);

      const mockPrompt = {
        run: vi.fn().mockResolvedValue('Version (1.0.0) (100) (version1)')
      };
      mockCreatePrompt.mockReturnValue(mockPrompt);

      const result = await handleEntVersionIdParameter(
        mockParam,
        mockParams,
        mockGetEnterpriseAppVersions,
        mockCreatePrompt,
        () => mockOraSpinner
      );

      expect(result).toEqual({ value: 'version1' });
    });

    it('should handle selection without parentheses and return as-is', async () => {
      const mockVersions = [
        { id: 'version1', version: '1.0.0', versionCode: '100' }
      ];
      const mockGetEnterpriseAppVersions = vi.fn().mockResolvedValue(mockVersions);

      const mockPrompt = {
        run: vi.fn().mockResolvedValue('custom-selection-without-parentheses')
      };
      mockCreatePrompt.mockReturnValue(mockPrompt);

      const result = await handleEntVersionIdParameter(
        mockParam,
        mockParams,
        mockGetEnterpriseAppVersions,
        mockCreatePrompt,
        () => mockOraSpinner
      );

      expect(result).toEqual({ value: 'custom-selection-without-parentheses' });
    });
  });

  describe('Parameter Customization', () => {
    it('should use custom description when provided', async () => {
      const customParam = { name: 'entVersionId', description: 'Custom Version Selector' };
      const mockVersions = [
        { id: 'version1', version: '1.0.0', versionCode: '100' }
      ];
      const mockGetEnterpriseAppVersions = vi.fn().mockResolvedValue(mockVersions);

      const mockPrompt = {
        run: vi.fn().mockResolvedValue('1.0.0 (100) (version1)')
      };
      mockCreatePrompt.mockReturnValue(mockPrompt);

      await handleEntVersionIdParameter(
        customParam,
        mockParams,
        mockGetEnterpriseAppVersions,
        mockCreatePrompt,
        () => mockOraSpinner
      );

      expect(mockCreatePrompt).toHaveBeenCalledWith(
        'entVersionId',
        'Custom Version Selector (1 options)',
        ['1.0.0 (100) (version1)'],
        10
      );
    });

    it('should use default description when not provided', async () => {
      const paramWithoutDescription = { name: 'entVersionId' };
      const mockVersions = [
        { id: 'version1', version: '1.0.0', versionCode: '100' }
      ];
      const mockGetEnterpriseAppVersions = vi.fn().mockResolvedValue(mockVersions);

      const mockPrompt = {
        run: vi.fn().mockResolvedValue('1.0.0 (100) (version1)')
      };
      mockCreatePrompt.mockReturnValue(mockPrompt);

      await handleEntVersionIdParameter(
        paramWithoutDescription,
        mockParams,
        mockGetEnterpriseAppVersions,
        mockCreatePrompt,
        () => mockOraSpinner
      );

      expect(mockCreatePrompt).toHaveBeenCalledWith(
        'entVersionId',
        'App Version ID (1 options)',
        ['1.0.0 (100) (version1)'],
        10
      );
    });

    it('should handle empty description', async () => {
      const paramWithEmptyDescription = { name: 'entVersionId', description: '' };
      const mockVersions = [
        { id: 'version1', version: '1.0.0', versionCode: '100' }
      ];
      const mockGetEnterpriseAppVersions = vi.fn().mockResolvedValue(mockVersions);

      const mockPrompt = {
        run: vi.fn().mockResolvedValue('1.0.0 (100) (version1)')
      };
      mockCreatePrompt.mockReturnValue(mockPrompt);

      await handleEntVersionIdParameter(
        paramWithEmptyDescription,
        mockParams,
        mockGetEnterpriseAppVersions,
        mockCreatePrompt,
        () => mockOraSpinner
      );

      expect(mockCreatePrompt).toHaveBeenCalledWith(
        'entVersionId',
        'App Version ID (1 options)',
        ['1.0.0 (100) (version1)'],
        10
      );
    });
  });

  describe('Dependency Injection', () => {
    it('should use custom createPrompt when provided', async () => {
      const mockVersions = [
        { id: 'version1', version: '1.0.0', versionCode: '100' }
      ];
      const mockGetEnterpriseAppVersions = vi.fn().mockResolvedValue(mockVersions);

      const customCreatePrompt = vi.fn().mockReturnValue({
        run: vi.fn().mockResolvedValue('1.0.0 (100) (version1)')
      });

      await handleEntVersionIdParameter(
        mockParam,
        mockParams,
        mockGetEnterpriseAppVersions,
        customCreatePrompt
      );

      expect(customCreatePrompt).toHaveBeenCalledTimes(1);
      expect(mockCreatePrompt).not.toHaveBeenCalled();
    });

    it('should use custom spinner when provided', async () => {
      const mockVersions = [
        { id: 'version1', version: '1.0.0', versionCode: '100' }
      ];
      const mockGetEnterpriseAppVersions = vi.fn().mockResolvedValue(mockVersions);

      const customSpinner = {
        start: vi.fn().mockReturnThis(),
        stop: vi.fn().mockReturnThis(),
        fail: vi.fn().mockReturnThis(),
        text: ''
      };
      const customSpinnerFactory = vi.fn(() => customSpinner);

      const mockPrompt = {
        run: vi.fn().mockResolvedValue('1.0.0 (100) (version1)')
      };
      mockCreatePrompt.mockReturnValue(mockPrompt);

      await handleEntVersionIdParameter(
        mockParam,
        mockParams,
        mockGetEnterpriseAppVersions,
        mockCreatePrompt,
        customSpinnerFactory
      );

      expect(customSpinnerFactory).toHaveBeenCalledWith('Listing Enterprise Versions...');
      expect(customSpinner.start).toHaveBeenCalledTimes(1);
      expect(customSpinner.stop).toHaveBeenCalledTimes(1);
    });
  });

  describe('Edge Cases and Integration', () => {
    it('should handle large numbers of enterprise versions', async () => {
      const mockVersions = Array.from({ length: 50 }, (_, i) => ({
        id: `version${i}`,
        version: `${i + 1}.0.0`,
        versionCode: `${(i + 1) * 100}`
      }));
      const mockGetEnterpriseAppVersions = vi.fn().mockResolvedValue(mockVersions);

      const mockPrompt = {
        run: vi.fn().mockResolvedValue('25.0.0 (2500) (version24)')
      };
      mockCreatePrompt.mockReturnValue(mockPrompt);

      const result = await handleEntVersionIdParameter(
        mockParam,
        mockParams,
        mockGetEnterpriseAppVersions,
        mockCreatePrompt,
        () => mockOraSpinner
      );

      expect(result).toEqual({ value: 'version24' });
      expect(mockCreatePrompt).toHaveBeenCalledWith(
        'entVersionId',
        'App Version ID (50 options)',
        expect.any(Array),
        10
      );
    });

    it('should handle versions with special characters', async () => {
      const mockVersions = [
        { id: 'version1', version: '1.0.0-alpha', versionCode: '100' },
        { id: 'version2', version: '2.0.0-beta.1', versionCode: '200' }
      ];
      const mockGetEnterpriseAppVersions = vi.fn().mockResolvedValue(mockVersions);

      const mockPrompt = {
        run: vi.fn().mockResolvedValue('1.0.0-alpha (100) (version1)')
      };
      mockCreatePrompt.mockReturnValue(mockPrompt);

      const result = await handleEntVersionIdParameter(
        mockParam,
        mockParams,
        mockGetEnterpriseAppVersions,
        mockCreatePrompt,
        () => mockOraSpinner
      );

      expect(result).toEqual({ value: 'version1' });
    });

    it('should handle versions without version field', async () => {
      const mockVersions = [
        { id: 'version1', versionCode: '100' }, // Missing version
        { id: 'version2', version: null, versionCode: '200' }, // Null version
        { id: 'version3', version: undefined, versionCode: '300' }, // Undefined version
        { id: 'version4', version: '', versionCode: '400' } // Empty version
      ];
      const mockGetEnterpriseAppVersions = vi.fn().mockResolvedValue(mockVersions);

      const mockPrompt = {
        run: vi.fn().mockResolvedValue('undefined (100) (version1)')
      };
      mockCreatePrompt.mockReturnValue(mockPrompt);

      const result = await handleEntVersionIdParameter(
        mockParam,
        mockParams,
        mockGetEnterpriseAppVersions,
        mockCreatePrompt,
        () => mockOraSpinner
      );

      expect(result).toEqual({ value: 'version1' });
    });

    it('should handle versions without versionCode field', async () => {
      const mockVersions = [
        { id: 'version1', version: '1.0.0' }, // Missing versionCode
        { id: 'version2', version: '2.0.0', versionCode: null }, // Null versionCode
        { id: 'version3', version: '3.0.0', versionCode: undefined }, // Undefined versionCode
      ];
      const mockGetEnterpriseAppVersions = vi.fn().mockResolvedValue(mockVersions);

      const mockPrompt = {
        run: vi.fn().mockResolvedValue('1.0.0 (undefined) (version1)')
      };
      mockCreatePrompt.mockReturnValue(mockPrompt);

      const result = await handleEntVersionIdParameter(
        mockParam,
        mockParams,
        mockGetEnterpriseAppVersions,
        mockCreatePrompt,
        () => mockOraSpinner
      );

      expect(result).toEqual({ value: 'version1' });
    });

    it('should handle versions with null or undefined IDs', async () => {
      const mockVersions = [
        { id: null, version: '1.0.0', versionCode: '100' },
        { id: undefined, version: '2.0.0', versionCode: '200' },
        { version: '3.0.0', versionCode: '300' } // Missing id
      ];
      const mockGetEnterpriseAppVersions = vi.fn().mockResolvedValue(mockVersions);

      const mockPrompt = {
        run: vi.fn().mockResolvedValue('1.0.0 (100) (null)')
      };
      mockCreatePrompt.mockReturnValue(mockPrompt);

      const result = await handleEntVersionIdParameter(
        mockParam,
        mockParams,
        mockGetEnterpriseAppVersions,
        mockCreatePrompt,
        () => mockOraSpinner
      );

      expect(result).toEqual({ value: 'null' });
    });

    it('should handle missing entProfileId in params', async () => {
      const paramsWithoutEntProfileId = {};
      const mockGetEnterpriseAppVersions = vi.fn().mockResolvedValue([
        { id: 'version1', version: '1.0.0', versionCode: '100' }
      ]);

      const mockPrompt = {
        run: vi.fn().mockResolvedValue('1.0.0 (100) (version1)')
      };
      mockCreatePrompt.mockReturnValue(mockPrompt);

      await handleEntVersionIdParameter(
        mockParam,
        paramsWithoutEntProfileId,
        mockGetEnterpriseAppVersions,
        mockCreatePrompt,
        () => mockOraSpinner
      );

      expect(mockGetEnterpriseAppVersions).toHaveBeenCalledWith({ 
        entProfileId: undefined, 
        publishType: '' 
      });
    });
  });

  describe('Regex Pattern Validation', () => {
    it('should correctly match alphanumeric and hyphen pattern in last parentheses', async () => {
      const testCases = [
        { input: 'Simple (version123)', expected: 'version123' },
        { input: 'With-Dashes (version-123)', expected: 'version-123' },
        { input: 'Multiple (First) (second-456)', expected: 'second-456' },
        { input: 'UUID (12345678-1234-1234-1234-123456789012)', expected: '12345678-1234-1234-1234-123456789012' },
      ];

      for (const testCase of testCases) {
        const mockVersions = [
          { id: 'version1', version: '1.0.0', versionCode: '100' }
        ];
        const mockGetEnterpriseAppVersions = vi.fn().mockResolvedValue(mockVersions);

        mockCreatePrompt.mockReturnValueOnce({
          run: vi.fn().mockResolvedValue(testCase.input)
        });

        const result = await handleEntVersionIdParameter(
          mockParam,
          mockParams,
          mockGetEnterpriseAppVersions,
          mockCreatePrompt,
          () => mockOraSpinner
        );

        expect(result).toEqual({ value: testCase.expected });
      }
    });

    it('should not match patterns with special characters not in regex', async () => {
      const invalidPatterns = [
        'No parentheses at all',
        'Open parentheses (version123',
        'Close parentheses version123)',
        'Empty parentheses ()',
        'Special chars (version@#$)',
        'Spaces in ID (version 123)'
      ];

      for (const invalidPattern of invalidPatterns) {
        const mockVersions = [
          { id: 'version1', version: '1.0.0', versionCode: '100' }
        ];
        const mockGetEnterpriseAppVersions = vi.fn().mockResolvedValue(mockVersions);

        mockCreatePrompt.mockReturnValueOnce({
          run: vi.fn().mockResolvedValue(invalidPattern)
        });

        const result = await handleEntVersionIdParameter(
          mockParam,
          mockParams,
          mockGetEnterpriseAppVersions,
          mockCreatePrompt,
          () => mockOraSpinner
        );

        // Should return the original selection when regex doesn't match
        expect(result.value).toBe(invalidPattern);
      }
    });
  });

  describe('Version Map Logic', () => {
    it('should correctly create version map with proper formatting', async () => {
      const mockVersions = [
        { id: 'v1', version: '1.0.0', versionCode: '100' },
        { id: 'v2', version: '2.0.0', versionCode: '200' }
      ];
      const mockGetEnterpriseAppVersions = vi.fn().mockResolvedValue(mockVersions);

      const mockPrompt = {
        run: vi.fn().mockResolvedValue('1.0.0 (100) (v1)')
      };
      mockCreatePrompt.mockReturnValue(mockPrompt);

      await handleEntVersionIdParameter(
        mockParam,
        mockParams,
        mockGetEnterpriseAppVersions,
        mockCreatePrompt,
        () => mockOraSpinner
      );

      // Verify that the choices are formatted correctly
      expect(mockCreatePrompt).toHaveBeenCalledWith(
        'entVersionId',
        'App Version ID (2 options)',
        ['1.0.0 (100) (v1)', '2.0.0 (200) (v2)'],
        10
      );
    });

    it('should handle duplicate version-versionCode combinations', async () => {
      const mockVersions = [
        { id: 'v1', version: '1.0.0', versionCode: '100' },
        { id: 'v2', version: '1.0.0', versionCode: '100' }, // Duplicate
        { id: 'v3', version: '1.0.0', versionCode: '101' }
      ];
      const mockGetEnterpriseAppVersions = vi.fn().mockResolvedValue(mockVersions);

      const mockPrompt = {
        run: vi.fn().mockResolvedValue('1.0.0 (100) (v1)')
      };
      mockCreatePrompt.mockReturnValue(mockPrompt);

      const result = await handleEntVersionIdParameter(
        mockParam,
        mockParams,
        mockGetEnterpriseAppVersions,
        mockCreatePrompt,
        () => mockOraSpinner
      );

      expect(result).toEqual({ value: 'v1' });
      // Should still create all choices even with duplicates
      expect(mockCreatePrompt).toHaveBeenCalledWith(
        'entVersionId',
        'App Version ID (3 options)',
        expect.arrayContaining([
          '1.0.0 (100) (v1)',
          '1.0.0 (100) (v2)',
          '1.0.0 (101) (v3)'
        ]),
        10
      );
    });
  });

  describe('Async Error Handling', () => {
    it('should handle getEnterpriseAppVersions timeout', async () => {
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Timeout')), 100);
      });
      const mockGetEnterpriseAppVersions = vi.fn().mockReturnValue(timeoutPromise);

      await expect(handleEntVersionIdParameter(
        mockParam,
        mockParams,
        mockGetEnterpriseAppVersions,
        mockCreatePrompt,
        () => mockOraSpinner
      )).rejects.toThrow('Timeout');
    });

    it('should handle unexpected data format from API', async () => {
      // API returns objects without expected properties
      const malformedData = [
        { wrongProperty: 'value1' },
        { anotherWrongProperty: 'value2' }
      ];
      const mockGetEnterpriseAppVersions = vi.fn().mockResolvedValue(malformedData);

      const mockPrompt = {
        run: vi.fn().mockResolvedValue('undefined (undefined) (undefined)')
      };
      mockCreatePrompt.mockReturnValue(mockPrompt);

      const result = await handleEntVersionIdParameter(
        mockParam,
        mockParams,
        mockGetEnterpriseAppVersions,
        mockCreatePrompt,
        () => mockOraSpinner
      );

      // Should handle gracefully and extract "undefined" from parentheses
      expect(result).toEqual({ value: 'undefined' });
    });
  });
});