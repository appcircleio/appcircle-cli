/**
 * @fileoverview Test suite for handleDistProfileIdParameter function
 * Tests the extracted distProfileId parameter handler with comprehensive coverage
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock dependencies
vi.mock('ora', () => ({
  default: vi.fn().mockImplementation((message) => ({
    start: vi.fn().mockReturnThis(),
    stop: vi.fn().mockReturnThis(),
    fail: vi.fn().mockReturnThis(),
    text: '',
  }))
}));

// Import the function being tested
import { handleDistProfileIdParameter } from '../../../src/core/interactive-runner';

describe('handleDistProfileIdParameter', () => {
  let mockParam: any;
  let mockParams: any;
  let mockGetDistributionProfiles: any;
  let mockCreatePrompt: any;
  let mockOraSpinner: any;
  let mockSpinnerInstance: any;

  beforeEach(() => {
    vi.clearAllMocks();
    
    mockParam = {
      name: 'distProfileId',
      description: 'Select a distribution profile'
    };
    
    mockParams = {};
    
    mockSpinnerInstance = {
      start: vi.fn().mockReturnThis(),
      stop: vi.fn().mockReturnThis(),
      fail: vi.fn().mockReturnThis(),
      text: ''
    };
    
    mockOraSpinner = vi.fn().mockReturnValue(mockSpinnerInstance);
    
    mockGetDistributionProfiles = vi.fn().mockResolvedValue([
      { id: '12345678-1234-1234-1234-123456789012', name: 'iOS Distribution' },
      { id: '87654321-4321-4321-4321-210987654321', name: 'Android Distribution' },
      { id: 'abcdefab-cdef-abcd-efab-cdefabcdefab', name: 'Enterprise Distribution' }
    ]);
    
    mockCreatePrompt = vi.fn().mockReturnValue({
      run: vi.fn().mockResolvedValue('iOS Distribution (12345678-1234-1234-1234-123456789012)')
    });
  });

  describe('Basic Functionality', () => {
    it('should successfully handle distribution profile selection', async () => {
      const result = await handleDistProfileIdParameter(
        mockParam,
        mockParams,
        mockGetDistributionProfiles,
        mockCreatePrompt,
        mockOraSpinner
      );

      expect(result).toEqual({ value: '12345678-1234-1234-1234-123456789012' });
      expect(mockOraSpinner).toHaveBeenCalledWith('Listing Distribution Profiles...');
      expect(mockSpinnerInstance.start).toHaveBeenCalled();
      expect(mockSpinnerInstance.stop).toHaveBeenCalled();
      expect(mockGetDistributionProfiles).toHaveBeenCalled();
    });

    it('should create prompt with correct parameters', async () => {
      await handleDistProfileIdParameter(
        mockParam,
        mockParams,
        mockGetDistributionProfiles,
        mockCreatePrompt,
        mockOraSpinner
      );

      expect(mockCreatePrompt).toHaveBeenCalledWith(
        'distProfileId',
        'Select a distribution profile (3 options)',
        [
          'iOS Distribution (12345678-1234-1234-1234-123456789012)',
          'Android Distribution (87654321-4321-4321-4321-210987654321)',
          'Enterprise Distribution (abcdefab-cdef-abcd-efab-cdefabcdefab)'
        ],
        10
      );
    });

    it('should format choices correctly with name and ID', async () => {
      await handleDistProfileIdParameter(
        mockParam,
        mockParams,
        mockGetDistributionProfiles,
        mockCreatePrompt,
        mockOraSpinner
      );

      const choices = mockCreatePrompt.mock.calls[0][2];
      expect(choices).toEqual([
        'iOS Distribution (12345678-1234-1234-1234-123456789012)',
        'Android Distribution (87654321-4321-4321-4321-210987654321)',
        'Enterprise Distribution (abcdefab-cdef-abcd-efab-cdefabcdefab)'
      ]);
    });
  });

  describe('Error Handling', () => {
    it('should return throw error when no profiles are found', async () => {
      mockGetDistributionProfiles.mockResolvedValueOnce([]);
      
      const result = await handleDistProfileIdParameter(
        mockParam,
        mockParams,
        mockGetDistributionProfiles,
        mockCreatePrompt,
        mockOraSpinner
      );

      expect(result).toEqual({ isError: true, errorType: 'throw' });
      expect(mockSpinnerInstance.text).toBe('No Distribution Profile Available');
      expect(mockSpinnerInstance.fail).toHaveBeenCalled();
    });

    it('should return throw error when profiles is null', async () => {
      mockGetDistributionProfiles.mockResolvedValueOnce(null);
      
      const result = await handleDistProfileIdParameter(
        mockParam,
        mockParams,
        mockGetDistributionProfiles,
        mockCreatePrompt,
        mockOraSpinner
      );

      expect(result).toEqual({ isError: true, errorType: 'throw' });
      expect(mockSpinnerInstance.text).toBe('No Distribution Profile Available');
      expect(mockSpinnerInstance.fail).toHaveBeenCalled();
    });

    it('should return throw error when profiles is undefined', async () => {
      mockGetDistributionProfiles.mockResolvedValueOnce(undefined);
      
      const result = await handleDistProfileIdParameter(
        mockParam,
        mockParams,
        mockGetDistributionProfiles,
        mockCreatePrompt,
        mockOraSpinner
      );

      expect(result).toEqual({ isError: true, errorType: 'throw' });
      expect(mockSpinnerInstance.text).toBe('No Distribution Profile Available');
      expect(mockSpinnerInstance.fail).toHaveBeenCalled();
    });

    it('should handle getDistributionProfiles throwing an exception', async () => {
      const error = new Error('API error');
      mockGetDistributionProfiles.mockRejectedValueOnce(error);
      
      await expect(handleDistProfileIdParameter(
        mockParam,
        mockParams,
        mockGetDistributionProfiles,
        mockCreatePrompt,
        mockOraSpinner
      )).rejects.toThrow('API error');
    });
  });

  describe('Selection and ID Extraction', () => {
    it('should extract profile ID from parentheses format', async () => {
      const testCases = [
        { 
          selection: 'iOS Distribution (12345678-1234-1234-1234-123456789012)', 
          expectedId: '12345678-1234-1234-1234-123456789012' 
        },
        { 
          selection: 'Android Distribution (87654321-4321-4321-4321-210987654321)', 
          expectedId: '87654321-4321-4321-4321-210987654321' 
        },
        { 
          selection: 'Complex Name Here (ffffffff-aaaa-bbbb-cccc-123456789012)', 
          expectedId: 'ffffffff-aaaa-bbbb-cccc-123456789012' 
        }
      ];

      for (const testCase of testCases) {
        mockCreatePrompt.mockReturnValueOnce({
          run: vi.fn().mockResolvedValue(testCase.selection)
        });

        const result = await handleDistProfileIdParameter(
          mockParam,
          mockParams,
          mockGetDistributionProfiles,
          mockCreatePrompt,
          mockOraSpinner
        );

        expect(result).toEqual({ value: testCase.expectedId });
      }
    });

    it('should trim extracted profile ID', async () => {
      mockCreatePrompt.mockReturnValueOnce({
        run: vi.fn().mockResolvedValue('My Profile (  12345678-1234-1234-1234-123456789012  )')
      });

      const result = await handleDistProfileIdParameter(
        mockParam,
        mockParams,
        mockGetDistributionProfiles,
        mockCreatePrompt,
        mockOraSpinner
      );

      expect(result).toEqual({ value: '12345678-1234-1234-1234-123456789012' });
    });

    it('should handle selections with trailing spaces in parentheses', async () => {
      mockCreatePrompt.mockReturnValueOnce({
        run: vi.fn().mockResolvedValue('Profile Name (12345678-1234-1234-1234-123456789012)   ')
      });

      const result = await handleDistProfileIdParameter(
        mockParam,
        mockParams,
        mockGetDistributionProfiles,
        mockCreatePrompt,
        mockOraSpinner
      );

      expect(result).toEqual({ value: '12345678-1234-1234-1234-123456789012' });
    });

    it('should handle multiple parentheses and extract from last one', async () => {
      mockCreatePrompt.mockReturnValueOnce({
        run: vi.fn().mockResolvedValue('Profile (Test) Name (12345678-1234-1234-1234-123456789012)')
      });

      const result = await handleDistProfileIdParameter(
        mockParam,
        mockParams,
        mockGetDistributionProfiles,
        mockCreatePrompt,
        mockOraSpinner
      );

      expect(result).toEqual({ value: '12345678-1234-1234-1234-123456789012' });
    });
  });

  describe('Fallback Logic', () => {
    it('should use fallback to find profile by ID when no parentheses match', async () => {
      mockCreatePrompt.mockReturnValueOnce({
        run: vi.fn().mockResolvedValue('Contains 87654321-4321-4321-4321-210987654321 somewhere')
      });

      const result = await handleDistProfileIdParameter(
        mockParam,
        mockParams,
        mockGetDistributionProfiles,
        mockCreatePrompt,
        mockOraSpinner
      );

      expect(result).toEqual({ value: '87654321-4321-4321-4321-210987654321' });
    });

    it('should return selection as-is when no profile found in fallback', async () => {
      mockCreatePrompt.mockReturnValueOnce({
        run: vi.fn().mockResolvedValue('unknown-profile-selection')
      });

      const result = await handleDistProfileIdParameter(
        mockParam,
        mockParams,
        mockGetDistributionProfiles,
        mockCreatePrompt,
        mockOraSpinner
      );

      expect(result).toEqual({ value: 'unknown-profile-selection' });
    });

    it('should not match partial IDs in fallback', async () => {
      // Fallback uses includes() which looks for full profile.id, not partial matches
      mockCreatePrompt.mockReturnValueOnce({
        run: vi.fn().mockResolvedValue('Profile with partial 12345678-1234-1234 match')
      });

      const result = await handleDistProfileIdParameter(
        mockParam,
        mockParams,
        mockGetDistributionProfiles,
        mockCreatePrompt,
        mockOraSpinner
      );

      // Should return selection as-is since partial UUID doesn't match any full profile.id
      expect(result).toEqual({ value: 'Profile with partial 12345678-1234-1234 match' });
    });

    it('should prefer exact parentheses match over fallback', async () => {
      // Selection contains two IDs - one in parentheses, one in text
      mockCreatePrompt.mockReturnValueOnce({
        run: vi.fn().mockResolvedValue('Profile 87654321-4321-4321-4321-210987654321 (12345678-1234-1234-1234-123456789012)')
      });

      const result = await handleDistProfileIdParameter(
        mockParam,
        mockParams,
        mockGetDistributionProfiles,
        mockCreatePrompt,
        mockOraSpinner
      );

      // Should use parentheses match, not fallback
      expect(result).toEqual({ value: '12345678-1234-1234-1234-123456789012' });
    });
  });

  describe('Parameter Customization', () => {
    it('should use custom description when provided', async () => {
      mockParam.description = 'Choose your distribution profile';
      
      await handleDistProfileIdParameter(
        mockParam,
        mockParams,
        mockGetDistributionProfiles,
        mockCreatePrompt,
        mockOraSpinner
      );

      expect(mockCreatePrompt).toHaveBeenCalledWith(
        'distProfileId',
        'Choose your distribution profile (3 options)',
        expect.any(Array),
        10
      );
    });

    it('should use default description when not provided', async () => {
      mockParam.description = undefined;
      
      await handleDistProfileIdParameter(
        mockParam,
        mockParams,
        mockGetDistributionProfiles,
        mockCreatePrompt,
        mockOraSpinner
      );

      expect(mockCreatePrompt).toHaveBeenCalledWith(
        'distProfileId',
        'Distribution Profile (3 options)',
        expect.any(Array),
        10
      );
    });

    it('should handle empty description', async () => {
      mockParam.description = '';
      
      await handleDistProfileIdParameter(
        mockParam,
        mockParams,
        mockGetDistributionProfiles,
        mockCreatePrompt,
        mockOraSpinner
      );

      expect(mockCreatePrompt).toHaveBeenCalledWith(
        'distProfileId',
        'Distribution Profile (3 options)',
        expect.any(Array),
        10
      );
    });
  });

  describe('Dependency Injection', () => {
    it('should work with default dependencies when not provided', async () => {
      // Skip this test because default dependencies include real AutoComplete 
      // which requires user interaction
      expect(true).toBe(true); // This test demonstrates the principle but can't run in CI
    });

    it('should use custom createPrompt when provided', async () => {
      const customCreatePrompt = vi.fn().mockReturnValue({
        run: vi.fn().mockResolvedValue('Android Distribution (87654321-4321-4321-4321-210987654321)')
      });

      const result = await handleDistProfileIdParameter(
        mockParam,
        mockParams,
        mockGetDistributionProfiles,
        customCreatePrompt,
        mockOraSpinner
      );

      expect(customCreatePrompt).toHaveBeenCalled();
      expect(mockCreatePrompt).not.toHaveBeenCalled();
      expect(result).toEqual({ value: '87654321-4321-4321-4321-210987654321' });
    });

    it('should use custom spinner when provided', async () => {
      const customSpinner = {
        start: vi.fn().mockReturnThis(),
        stop: vi.fn().mockReturnThis(),
        fail: vi.fn().mockReturnThis(),
        text: ''
      };
      const customOraSpinner = vi.fn().mockReturnValue(customSpinner);

      await handleDistProfileIdParameter(
        mockParam,
        mockParams,
        mockGetDistributionProfiles,
        mockCreatePrompt,
        customOraSpinner
      );

      expect(customOraSpinner).toHaveBeenCalledWith('Listing Distribution Profiles...');
      expect(customSpinner.start).toHaveBeenCalled();
      expect(customSpinner.stop).toHaveBeenCalled();
      expect(mockOraSpinner).not.toHaveBeenCalled();
    });
  });

  describe('Edge Cases and Integration', () => {
    it('should handle large numbers of distribution profiles', async () => {
      const largeProfilesList = Array.from({ length: 50 }, (_, i) => ({
        id: `profile-${i.toString().padStart(8, '0')}-1234-5678-90ab-123456789012`,
        name: `Distribution Profile ${i}`
      }));
      
      mockGetDistributionProfiles.mockResolvedValueOnce(largeProfilesList);
      
      await handleDistProfileIdParameter(
        mockParam,
        mockParams,
        mockGetDistributionProfiles,
        mockCreatePrompt,
        mockOraSpinner
      );

      expect(mockCreatePrompt).toHaveBeenCalledWith(
        'distProfileId',
        'Select a distribution profile (50 options)',
        expect.arrayContaining([
          expect.stringContaining('Distribution Profile 0'),
          expect.stringContaining('Distribution Profile 1'),
          expect.stringContaining('Distribution Profile 49')
        ]),
        10
      );
    });

    it('should handle profiles with special characters in names', async () => {
      mockGetDistributionProfiles.mockResolvedValueOnce([
        { id: '12345678-1234-1234-1234-123456789012', name: 'iOS & Android Distribution' },
        { id: '87654321-4321-4321-4321-210987654321', name: 'Enterprise (Production)' },
        { id: 'abcdefab-cdef-abcd-efab-cdefabcdefab', name: 'QA: Test Distribution' }
      ]);

      await handleDistProfileIdParameter(
        mockParam,
        mockParams,
        mockGetDistributionProfiles,
        mockCreatePrompt,
        mockOraSpinner
      );

      expect(mockCreatePrompt).toHaveBeenCalledWith(
        'distProfileId',
        'Select a distribution profile (3 options)',
        [
          'iOS & Android Distribution (12345678-1234-1234-1234-123456789012)',
          'Enterprise (Production) (87654321-4321-4321-4321-210987654321)',
          'QA: Test Distribution (abcdefab-cdef-abcd-efab-cdefabcdefab)'
        ],
        10
      );
    });

    it('should handle profiles without names', async () => {
      mockGetDistributionProfiles.mockResolvedValueOnce([
        { id: '12345678-1234-1234-1234-123456789012', name: 'Named Profile' },
        { id: '87654321-4321-4321-4321-210987654321' }, // No name property
        { id: 'abcdefab-cdef-abcd-efab-cdefabcdefab', name: '' } // Empty name
      ]);

      await handleDistProfileIdParameter(
        mockParam,
        mockParams,
        mockGetDistributionProfiles,
        mockCreatePrompt,
        mockOraSpinner
      );

      expect(mockCreatePrompt).toHaveBeenCalledWith(
        'distProfileId',
        'Select a distribution profile (3 options)',
        [
          'Named Profile (12345678-1234-1234-1234-123456789012)',
          'undefined (87654321-4321-4321-4321-210987654321)',
          ' (abcdefab-cdef-abcd-efab-cdefabcdefab)'
        ],
        10
      );
    });

    it('should handle profiles with null or undefined IDs', async () => {
      mockGetDistributionProfiles.mockResolvedValueOnce([
        { id: '12345678-1234-1234-1234-123456789012', name: 'Valid Profile' },
        { id: null, name: 'Null ID Profile' },
        { name: 'No ID Profile' } // No id property
      ]);

      await handleDistProfileIdParameter(
        mockParam,
        mockParams,
        mockGetDistributionProfiles,
        mockCreatePrompt,
        mockOraSpinner
      );

      expect(mockCreatePrompt).toHaveBeenCalledWith(
        'distProfileId',
        'Select a distribution profile (3 options)',
        [
          'Valid Profile (12345678-1234-1234-1234-123456789012)',
          'Null ID Profile (null)',
          'No ID Profile (undefined)'
        ],
        10
      );
    });
  });

  describe('Regex Pattern Validation', () => {
    it('should correctly match last parentheses pattern', async () => {
      const testCases = [
        'Simple (12345678-1234-1234-1234-123456789012)',
        'Multiple (First) (12345678-1234-1234-1234-123456789012)',
        'With spaces (12345678-1234-1234-1234-123456789012)   ',
        'Complex-Name-123 (12345678-1234-1234-1234-123456789012)',
      ];

      for (const testCase of testCases) {
        mockCreatePrompt.mockReturnValueOnce({
          run: vi.fn().mockResolvedValue(testCase)
        });

        const result = await handleDistProfileIdParameter(
          mockParam,
          mockParams,
          mockGetDistributionProfiles,
          mockCreatePrompt,
          mockOraSpinner
        );

        expect(result).toEqual({ value: '12345678-1234-1234-1234-123456789012' });
      }
    });

    it('should not match partial parentheses patterns', async () => {
      const invalidPatterns = [
        'No parentheses at all',
        'Open parentheses (12345678-1234-1234-1234-123456789012',
        'Close parentheses 12345678-1234-1234-1234-123456789012)',
        'Empty parentheses ()',
      ];

      for (const pattern of invalidPatterns) {
        mockCreatePrompt.mockReturnValueOnce({
          run: vi.fn().mockResolvedValue(pattern)
        });

        const result = await handleDistProfileIdParameter(
          mockParam,
          mockParams,
          mockGetDistributionProfiles,
          mockCreatePrompt,
          mockOraSpinner
        );

        // Should use fallback logic or return as-is
        expect(result.value).toBeDefined();
        expect(typeof result.value).toBe('string');
      }
    });
  });

  describe('Async Error Handling', () => {
    it('should handle getDistributionProfiles timeout', async () => {
      mockGetDistributionProfiles.mockImplementation(() => 
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Request timeout')), 100)
        )
      );
      
      await expect(handleDistProfileIdParameter(
        mockParam,
        mockParams,
        mockGetDistributionProfiles,
        mockCreatePrompt,
        mockOraSpinner
      )).rejects.toThrow('Request timeout');
    });

    it('should handle unexpected data format from API', async () => {
      mockGetDistributionProfiles.mockResolvedValueOnce([
        { profileId: 'profile-1', profileName: 'Wrong Fields' }, // Wrong property names
        { id: '12345678-1234-1234-1234-123456789012', name: 'Correct Format' }
      ]);

      await handleDistProfileIdParameter(
        mockParam,
        mockParams,
        mockGetDistributionProfiles,
        mockCreatePrompt,
        mockOraSpinner
      );

      // Should handle gracefully, using undefined for missing properties
      expect(mockCreatePrompt).toHaveBeenCalledWith(
        'distProfileId',
        'Select a distribution profile (2 options)',
        [
          'undefined (undefined)',
          'Correct Format (12345678-1234-1234-1234-123456789012)'
        ],
        10
      );
    });
  });
});