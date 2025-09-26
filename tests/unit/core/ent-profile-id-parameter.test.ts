import { describe, it, expect, vi, beforeEach } from 'vitest';
import { handleEntProfileIdParameter } from '../../../src/core/interactive-runner.ts';

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

describe('handleEntProfileIdParameter', () => {
  const mockParam = { name: 'entProfileId', description: 'Enterprise Profile' };
  const mockParams = {};

  beforeEach(() => {
    vi.clearAllMocks();
    mockOraSpinner.text = '';
  });

  describe('Basic Functionality', () => {
    it('should successfully handle enterprise profile selection', async () => {
      const mockGetEnterpriseProfiles = vi.fn().mockResolvedValue([
        { id: 'profile1', name: 'Profile 1' },
        { id: 'profile2', name: 'Profile 2' },
      ]);

      const mockPrompt = {
        run: vi.fn().mockResolvedValue('Profile 1 (profile1)')
      };
      mockCreatePrompt.mockReturnValue(mockPrompt);

      const result = await handleEntProfileIdParameter(
        mockParam,
        mockParams,
        mockGetEnterpriseProfiles,
        mockCreatePrompt,
        () => mockOraSpinner
      );

      expect(result).toEqual({ value: 'profile1' });
      expect(mockGetEnterpriseProfiles).toHaveBeenCalledTimes(1);
      expect(mockOraSpinner.start).toHaveBeenCalledTimes(1);
      expect(mockOraSpinner.stop).toHaveBeenCalledTimes(1);
    });

    it('should create prompt with correct parameters', async () => {
      const profiles = [
        { id: 'profile1', name: 'Profile 1' },
        { id: 'profile2', name: 'Profile 2' },
      ];
      const mockGetEnterpriseProfiles = vi.fn().mockResolvedValue(profiles);

      const mockPrompt = {
        run: vi.fn().mockResolvedValue('Profile 1 (profile1)')
      };
      mockCreatePrompt.mockReturnValue(mockPrompt);

      await handleEntProfileIdParameter(
        mockParam,
        mockParams,
        mockGetEnterpriseProfiles,
        mockCreatePrompt,
        () => mockOraSpinner
      );

      expect(mockCreatePrompt).toHaveBeenCalledWith(
        'entProfileId',
        'Enterprise Profile (2 options)',
        ['Profile 1 (profile1)', 'Profile 2 (profile2)'],
        10
      );
    });

    it('should format choices correctly with name and ID', async () => {
      const profiles = [
        { id: 'abc123', name: 'Production Profile' },
        { id: 'def456', name: 'Development Profile' },
      ];
      const mockGetEnterpriseProfiles = vi.fn().mockResolvedValue(profiles);

      const mockPrompt = {
        run: vi.fn().mockResolvedValue('Production Profile (abc123)')
      };
      mockCreatePrompt.mockReturnValue(mockPrompt);

      await handleEntProfileIdParameter(
        mockParam,
        mockParams,
        mockGetEnterpriseProfiles,
        mockCreatePrompt,
        () => mockOraSpinner
      );

      const expectedChoices = [
        'Production Profile (abc123)',
        'Development Profile (def456)'
      ];
      expect(mockCreatePrompt).toHaveBeenCalledWith(
        'entProfileId',
        'Enterprise Profile (2 options)',
        expectedChoices,
        10
      );
    });
  });

  describe('Error Handling', () => {
    it('should return error when no profiles are found', async () => {
      const mockGetEnterpriseProfiles = vi.fn().mockResolvedValue([]);

      const result = await handleEntProfileIdParameter(
        mockParam,
        mockParams,
        mockGetEnterpriseProfiles,
        mockCreatePrompt,
        () => mockOraSpinner
      );

      expect(result).toEqual({ isError: true });
      expect(mockOraSpinner.text).toBe('No enterprise profile available');
      expect(mockOraSpinner.fail).toHaveBeenCalledTimes(1);
    });

    it('should return error when profiles is null', async () => {
      const mockGetEnterpriseProfiles = vi.fn().mockResolvedValue(null);

      const result = await handleEntProfileIdParameter(
        mockParam,
        mockParams,
        mockGetEnterpriseProfiles,
        mockCreatePrompt,
        () => mockOraSpinner
      );

      expect(result).toEqual({ isError: true });
      expect(mockOraSpinner.text).toBe('No enterprise profile available');
      expect(mockOraSpinner.fail).toHaveBeenCalledTimes(1);
    });

    it('should return error when profiles is undefined', async () => {
      const mockGetEnterpriseProfiles = vi.fn().mockResolvedValue(undefined);

      const result = await handleEntProfileIdParameter(
        mockParam,
        mockParams,
        mockGetEnterpriseProfiles,
        mockCreatePrompt,
        () => mockOraSpinner
      );

      expect(result).toEqual({ isError: true });
      expect(mockOraSpinner.text).toBe('No enterprise profile available');
      expect(mockOraSpinner.fail).toHaveBeenCalledTimes(1);
    });

    it('should handle getEnterpriseProfiles throwing an exception', async () => {
      const mockGetEnterpriseProfiles = vi.fn().mockRejectedValue(new Error('API Error'));

      await expect(handleEntProfileIdParameter(
        mockParam,
        mockParams,
        mockGetEnterpriseProfiles,
        mockCreatePrompt,
        () => mockOraSpinner
      )).rejects.toThrow('API Error');
    });
  });

  describe('Selection and ID Extraction', () => {
    it('should extract profile ID from parentheses format', async () => {
      const mockGetEnterpriseProfiles = vi.fn().mockResolvedValue([
        { id: 'profile1', name: 'Profile 1' }
      ]);

      const mockPrompt = {
        run: vi.fn().mockResolvedValue('Profile 1 (profile1)')
      };
      mockCreatePrompt.mockReturnValue(mockPrompt);

      const result = await handleEntProfileIdParameter(
        mockParam,
        mockParams,
        mockGetEnterpriseProfiles,
        mockCreatePrompt,
        () => mockOraSpinner
      );

      expect(result).toEqual({ value: 'profile1' });
    });

    it('should trim extracted profile ID', async () => {
      const mockGetEnterpriseProfiles = vi.fn().mockResolvedValue([
        { id: 'profile1', name: 'Profile 1' }
      ]);

      const mockPrompt = {
        run: vi.fn().mockResolvedValue('Profile 1 (  profile1  )')
      };
      mockCreatePrompt.mockReturnValue(mockPrompt);

      const result = await handleEntProfileIdParameter(
        mockParam,
        mockParams,
        mockGetEnterpriseProfiles,
        mockCreatePrompt,
        () => mockOraSpinner
      );

      expect(result).toEqual({ value: 'profile1' });
    });

    it('should handle multiple parentheses and extract from last one', async () => {
      const mockGetEnterpriseProfiles = vi.fn().mockResolvedValue([
        { id: 'profile1', name: 'Profile (1)' }
      ]);

      const mockPrompt = {
        run: vi.fn().mockResolvedValue('Profile (1) (profile1)')
      };
      mockCreatePrompt.mockReturnValue(mockPrompt);

      const result = await handleEntProfileIdParameter(
        mockParam,
        mockParams,
        mockGetEnterpriseProfiles,
        mockCreatePrompt,
        () => mockOraSpinner
      );

      expect(result).toEqual({ value: 'profile1' });
    });
  });

  describe('Fallback Logic', () => {
    it('should use fallback to find profile by exact name and ID match', async () => {
      const profiles = [
        { id: 'profile1', name: 'Profile 1' },
        { id: 'profile2', name: 'Profile 2' }
      ];
      const mockGetEnterpriseProfiles = vi.fn().mockResolvedValue(profiles);

      const mockPrompt = {
        run: vi.fn().mockResolvedValue('Profile 1 (profile1)')
      };
      mockCreatePrompt.mockReturnValue(mockPrompt);

      const result = await handleEntProfileIdParameter(
        mockParam,
        mockParams,
        mockGetEnterpriseProfiles,
        mockCreatePrompt,
        () => mockOraSpinner
      );

      expect(result).toEqual({ value: 'profile1' });
    });

    it('should use fallback to find profile by direct ID match', async () => {
      const profiles = [
        { id: 'profile1', name: 'Profile 1' },
        { id: 'profile2', name: 'Profile 2' }
      ];
      const mockGetEnterpriseProfiles = vi.fn().mockResolvedValue(profiles);

      const mockPrompt = {
        run: vi.fn().mockResolvedValue('profile2')
      };
      mockCreatePrompt.mockReturnValue(mockPrompt);

      const result = await handleEntProfileIdParameter(
        mockParam,
        mockParams,
        mockGetEnterpriseProfiles,
        mockCreatePrompt,
        () => mockOraSpinner
      );

      expect(result).toEqual({ value: 'profile2' });
    });

    it('should return selection as-is when no profile found in fallback', async () => {
      const profiles = [
        { id: 'profile1', name: 'Profile 1' }
      ];
      const mockGetEnterpriseProfiles = vi.fn().mockResolvedValue(profiles);

      const mockPrompt = {
        run: vi.fn().mockResolvedValue('unknown-selection')
      };
      mockCreatePrompt.mockReturnValue(mockPrompt);

      const result = await handleEntProfileIdParameter(
        mockParam,
        mockParams,
        mockGetEnterpriseProfiles,
        mockCreatePrompt,
        () => mockOraSpinner
      );

      expect(result).toEqual({ value: 'unknown-selection' });
    });

    it('should handle exact name-ID format match in fallback', async () => {
      const profiles = [
        { id: 'abc123', name: 'Test Profile' }
      ];
      const mockGetEnterpriseProfiles = vi.fn().mockResolvedValue(profiles);

      const mockPrompt = {
        run: vi.fn().mockResolvedValue('Test Profile (abc123)')
      };
      mockCreatePrompt.mockReturnValue(mockPrompt);

      const result = await handleEntProfileIdParameter(
        mockParam,
        mockParams,
        mockGetEnterpriseProfiles,
        mockCreatePrompt,
        () => mockOraSpinner
      );

      expect(result).toEqual({ value: 'abc123' });
    });

    it('should prefer parentheses extraction over fallback', async () => {
      const profiles = [
        { id: 'profile1', name: 'Profile 1' },
        { id: 'different-id', name: 'Different Profile' }
      ];
      const mockGetEnterpriseProfiles = vi.fn().mockResolvedValue(profiles);

      // This should extract 'extracted-id' from parentheses, not find 'profile1' from fallback
      const mockPrompt = {
        run: vi.fn().mockResolvedValue('Profile 1 (extracted-id)')
      };
      mockCreatePrompt.mockReturnValue(mockPrompt);

      const result = await handleEntProfileIdParameter(
        mockParam,
        mockParams,
        mockGetEnterpriseProfiles,
        mockCreatePrompt,
        () => mockOraSpinner
      );

      expect(result).toEqual({ value: 'extracted-id' });
    });
  });

  describe('Parameter Customization', () => {
    it('should use custom description when provided', async () => {
      const customParam = { name: 'entProfileId', description: 'Custom Enterprise Profile' };
      const mockGetEnterpriseProfiles = vi.fn().mockResolvedValue([
        { id: 'profile1', name: 'Profile 1' }
      ]);

      const mockPrompt = {
        run: vi.fn().mockResolvedValue('Profile 1 (profile1)')
      };
      mockCreatePrompt.mockReturnValue(mockPrompt);

      await handleEntProfileIdParameter(
        customParam,
        mockParams,
        mockGetEnterpriseProfiles,
        mockCreatePrompt,
        () => mockOraSpinner
      );

      expect(mockCreatePrompt).toHaveBeenCalledWith(
        'entProfileId',
        'Custom Enterprise Profile (1 options)',
        ['Profile 1 (profile1)'],
        10
      );
    });

    it('should use default description when not provided', async () => {
      const paramWithoutDescription = { name: 'entProfileId' };
      const mockGetEnterpriseProfiles = vi.fn().mockResolvedValue([
        { id: 'profile1', name: 'Profile 1' }
      ]);

      const mockPrompt = {
        run: vi.fn().mockResolvedValue('Profile 1 (profile1)')
      };
      mockCreatePrompt.mockReturnValue(mockPrompt);

      await handleEntProfileIdParameter(
        paramWithoutDescription,
        mockParams,
        mockGetEnterpriseProfiles,
        mockCreatePrompt,
        () => mockOraSpinner
      );

      expect(mockCreatePrompt).toHaveBeenCalledWith(
        'entProfileId',
        'Enterprise Profile (1 options)',
        ['Profile 1 (profile1)'],
        10
      );
    });

    it('should handle empty description', async () => {
      const paramWithEmptyDescription = { name: 'entProfileId', description: '' };
      const mockGetEnterpriseProfiles = vi.fn().mockResolvedValue([
        { id: 'profile1', name: 'Profile 1' }
      ]);

      const mockPrompt = {
        run: vi.fn().mockResolvedValue('Profile 1 (profile1)')
      };
      mockCreatePrompt.mockReturnValue(mockPrompt);

      await handleEntProfileIdParameter(
        paramWithEmptyDescription,
        mockParams,
        mockGetEnterpriseProfiles,
        mockCreatePrompt,
        () => mockOraSpinner
      );

      expect(mockCreatePrompt).toHaveBeenCalledWith(
        'entProfileId',
        'Enterprise Profile (1 options)',
        ['Profile 1 (profile1)'],
        10
      );
    });
  });

  describe('Dependency Injection', () => {

    it('should use custom createPrompt when provided', async () => {
      const mockGetEnterpriseProfiles = vi.fn().mockResolvedValue([
        { id: 'profile1', name: 'Profile 1' }
      ]);

      const customCreatePrompt = vi.fn().mockReturnValue({
        run: vi.fn().mockResolvedValue('Profile 1 (profile1)')
      });

      await handleEntProfileIdParameter(
        mockParam,
        mockParams,
        mockGetEnterpriseProfiles,
        customCreatePrompt
      );

      expect(customCreatePrompt).toHaveBeenCalledTimes(1);
      expect(mockCreatePrompt).not.toHaveBeenCalled();
    });

    it('should use custom spinner when provided', async () => {
      const mockGetEnterpriseProfiles = vi.fn().mockResolvedValue([
        { id: 'profile1', name: 'Profile 1' }
      ]);

      const customSpinner = {
        start: vi.fn().mockReturnThis(),
        stop: vi.fn().mockReturnThis(),
        fail: vi.fn().mockReturnThis(),
        text: ''
      };
      const customSpinnerFactory = vi.fn(() => customSpinner);

      const mockPrompt = {
        run: vi.fn().mockResolvedValue('Profile 1 (profile1)')
      };
      mockCreatePrompt.mockReturnValue(mockPrompt);

      await handleEntProfileIdParameter(
        mockParam,
        mockParams,
        mockGetEnterpriseProfiles,
        mockCreatePrompt,
        customSpinnerFactory
      );

      expect(customSpinnerFactory).toHaveBeenCalledWith('Listing Enterprise Profiles...');
      expect(customSpinner.start).toHaveBeenCalledTimes(1);
      expect(customSpinner.stop).toHaveBeenCalledTimes(1);
    });
  });

  describe('Edge Cases and Integration', () => {
    it('should handle large numbers of enterprise profiles', async () => {
      const profiles = Array.from({ length: 100 }, (_, i) => ({
        id: `profile${i}`,
        name: `Profile ${i}`
      }));
      const mockGetEnterpriseProfiles = vi.fn().mockResolvedValue(profiles);

      const mockPrompt = {
        run: vi.fn().mockResolvedValue('Profile 50 (profile50)')
      };
      mockCreatePrompt.mockReturnValue(mockPrompt);

      const result = await handleEntProfileIdParameter(
        mockParam,
        mockParams,
        mockGetEnterpriseProfiles,
        mockCreatePrompt,
        () => mockOraSpinner
      );

      expect(result).toEqual({ value: 'profile50' });
      expect(mockCreatePrompt).toHaveBeenCalledWith(
        'entProfileId',
        'Enterprise Profile (100 options)',
        expect.any(Array),
        10
      );
    });

    it('should handle profiles with special characters in names', async () => {
      const profiles = [
        { id: 'profile1', name: 'Profile (Special) & Characters!' },
        { id: 'profile2', name: 'Profile-With-Dashes_And_Underscores' }
      ];
      const mockGetEnterpriseProfiles = vi.fn().mockResolvedValue(profiles);

      const mockPrompt = {
        run: vi.fn().mockResolvedValue('Profile (Special) & Characters! (profile1)')
      };
      mockCreatePrompt.mockReturnValue(mockPrompt);

      const result = await handleEntProfileIdParameter(
        mockParam,
        mockParams,
        mockGetEnterpriseProfiles,
        mockCreatePrompt,
        () => mockOraSpinner
      );

      expect(result).toEqual({ value: 'profile1' });
    });

    it('should handle profiles without names', async () => {
      const profiles = [
        { id: 'profile1' }, // Missing name
        { id: 'profile2', name: null }, // Null name
        { id: 'profile3', name: undefined }, // Undefined name
        { id: 'profile4', name: '' } // Empty name
      ];
      const mockGetEnterpriseProfiles = vi.fn().mockResolvedValue(profiles);

      const mockPrompt = {
        run: vi.fn().mockResolvedValue('undefined (profile1)')
      };
      mockCreatePrompt.mockReturnValue(mockPrompt);

      const result = await handleEntProfileIdParameter(
        mockParam,
        mockParams,
        mockGetEnterpriseProfiles,
        mockCreatePrompt,
        () => mockOraSpinner
      );

      expect(result).toEqual({ value: 'profile1' });
    });

    it('should handle profiles with null or undefined IDs', async () => {
      const profiles = [
        { id: null, name: 'Profile 1' },
        { id: undefined, name: 'Profile 2' },
        { name: 'Profile 3' } // Missing id
      ];
      const mockGetEnterpriseProfiles = vi.fn().mockResolvedValue(profiles);

      const mockPrompt = {
        run: vi.fn().mockResolvedValue('Profile 1 (null)')
      };
      mockCreatePrompt.mockReturnValue(mockPrompt);

      const result = await handleEntProfileIdParameter(
        mockParam,
        mockParams,
        mockGetEnterpriseProfiles,
        mockCreatePrompt,
        () => mockOraSpinner
      );

      expect(result).toEqual({ value: 'null' });
    });
  });

  describe('Regex Pattern Validation', () => {
    it('should correctly match last parentheses pattern', async () => {
      const testCases = [
        'Simple (12345678-1234-1234-1234-123456789012)',
        'Multiple (First) (12345678-1234-1234-1234-123456789012)',
        'With spaces (12345678-1234-1234-1234-123456789012)',
        'Complex-Name-123 (12345678-1234-1234-1234-123456789012)',
      ];

      for (const testCase of testCases) {
        mockCreatePrompt.mockReturnValueOnce({
          run: vi.fn().mockResolvedValue(testCase)
        });

        const result = await handleEntProfileIdParameter(
          mockParam,
          mockParams,
          vi.fn().mockResolvedValue([{ id: 'profile1', name: 'Profile 1' }]),
          mockCreatePrompt,
          () => mockOraSpinner
        );

        expect(result).toEqual({ value: '12345678-1234-1234-1234-123456789012' });
      }
    });

    it('should not match partial parentheses patterns', async () => {
      const invalidPatterns = [
        'No parentheses at all',
        'Open parentheses (12345678-1234-1234-1234-123456789012',
        'Close parentheses 12345678-1234-1234-1234-123456789012)',
        'Empty parentheses ()'
      ];

      const profiles = [
        { id: 'profile1', name: 'Profile 1' },
        { id: 'fallback-id', name: 'Fallback Profile' }
      ];

      for (const invalidPattern of invalidPatterns) {
        mockCreatePrompt.mockReturnValueOnce({
          run: vi.fn().mockResolvedValue(invalidPattern)
        });

        const result = await handleEntProfileIdParameter(
          mockParam,
          mockParams,
          vi.fn().mockResolvedValue(profiles),
          mockCreatePrompt,
          () => mockOraSpinner
        );

        // Should fall back to returning the original selection or finding by name/ID
        expect(result.value).toBe(invalidPattern);
      }
    });
  });

  describe('Async Error Handling', () => {
    it('should handle getEnterpriseProfiles timeout', async () => {
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Timeout')), 100);
      });
      const mockGetEnterpriseProfiles = vi.fn().mockReturnValue(timeoutPromise);

      await expect(handleEntProfileIdParameter(
        mockParam,
        mockParams,
        mockGetEnterpriseProfiles,
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
      const mockGetEnterpriseProfiles = vi.fn().mockResolvedValue(malformedData);

      const mockPrompt = {
        run: vi.fn().mockResolvedValue('undefined (undefined)')
      };
      mockCreatePrompt.mockReturnValue(mockPrompt);

      const result = await handleEntProfileIdParameter(
        mockParam,
        mockParams,
        mockGetEnterpriseProfiles,
        mockCreatePrompt,
        () => mockOraSpinner
      );

      // Should handle gracefully and extract "undefined" from parentheses
      expect(result).toEqual({ value: 'undefined' });
    });
  });
});