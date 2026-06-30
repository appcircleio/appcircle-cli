import { describe, it, expect, vi, beforeEach } from 'vitest';
import { handleProvisioningProfileIdParameter } from '../../../src/core/interactive-runner.ts';

const mockOraSpinner = {
  start: vi.fn().mockReturnThis(),
  stop: vi.fn().mockReturnThis(),
  fail: vi.fn().mockReturnThis(),
  text: ''
};

const mockCreatePrompt = vi.fn();

describe('handleProvisioningProfileIdParameter', () => {
  const mockParam = { name: 'provisioningProfileId', type: 'SELECT' };
  const mockParams = {};

  beforeEach(() => {
    vi.clearAllMocks();
    mockOraSpinner.text = '';
  });

  describe('Basic Functionality', () => {
    it('should successfully handle provisioning profile selection', async () => {
      const mockProfiles = [
        { id: 'profile-123', name: 'iOS Distribution Profile' },
        { id: 'profile-456', name: 'iOS Development Profile' }
      ];
      const mockGetProvisioningProfiles = vi.fn().mockResolvedValue(mockProfiles);

      const mockPrompt = {
        run: vi.fn().mockResolvedValue('iOS Distribution Profile (profile-123)')
      };
      mockCreatePrompt.mockReturnValue(mockPrompt);

      const result = await handleProvisioningProfileIdParameter(
        mockParam,
        mockParams,
        mockGetProvisioningProfiles,
        mockCreatePrompt,
        () => mockOraSpinner
      );

      expect(result.value).toBe('profile-123');
      expect(mockOraSpinner.start).toHaveBeenCalledTimes(1);
      expect(mockOraSpinner.stop).toHaveBeenCalledTimes(1);
    });

    it('should format provisioning profile params correctly', async () => {
      const mockProfiles = [
        { id: 'profile-123', name: 'iOS Distribution Profile' },
        { id: 'profile-456', name: 'iOS Development Profile' },
        { id: 'profile-789', name: 'iOS Ad Hoc Profile' }
      ];
      const mockGetProvisioningProfiles = vi.fn().mockResolvedValue(mockProfiles);

      const mockPrompt = {
        run: vi.fn().mockResolvedValue('iOS Distribution Profile (profile-123)')
      };
      mockCreatePrompt.mockReturnValue(mockPrompt);

      await handleProvisioningProfileIdParameter(
        mockParam,
        mockParams,
        mockGetProvisioningProfiles,
        mockCreatePrompt,
        () => mockOraSpinner
      );

      expect(mockParam.params).toEqual([
        { name: 'iOS Distribution Profile (profile-123)', message: 'iOS Distribution Profile (profile-123)' },
        { name: 'iOS Development Profile (profile-456)', message: 'iOS Development Profile (profile-456)' },
        { name: 'iOS Ad Hoc Profile (profile-789)', message: 'iOS Ad Hoc Profile (profile-789)' }
      ]);
    });

    it('should create prompt with correct parameters', async () => {
      const mockProfiles = [{ id: 'profile-123', name: 'Test Profile' }];
      const mockGetProvisioningProfiles = vi.fn().mockResolvedValue(mockProfiles);

      const mockPrompt = {
        run: vi.fn().mockResolvedValue('Test Profile (profile-123)')
      };
      mockCreatePrompt.mockReturnValue(mockPrompt);

      await handleProvisioningProfileIdParameter(
        mockParam,
        mockParams,
        mockGetProvisioningProfiles,
        mockCreatePrompt,
        () => mockOraSpinner
      );

      expect(mockCreatePrompt).toHaveBeenCalledWith(
        'provisioningProfileId',
        'Provisioning Profile (1 options)',
        ['Test Profile (profile-123)'],
        10
      );
    });

    it('should use custom description when provided', async () => {
      const customParam = { name: 'provisioningProfileId', type: 'SELECT', description: 'iOS App Store Profile' };
      const mockProfiles = [{ id: 'profile-123', name: 'Test Profile' }];
      const mockGetProvisioningProfiles = vi.fn().mockResolvedValue(mockProfiles);

      const mockPrompt = {
        run: vi.fn().mockResolvedValue('Test Profile (profile-123)')
      };
      mockCreatePrompt.mockReturnValue(mockPrompt);

      await handleProvisioningProfileIdParameter(
        customParam,
        mockParams,
        mockGetProvisioningProfiles,
        mockCreatePrompt,
        () => mockOraSpinner
      );

      expect(mockCreatePrompt).toHaveBeenCalledWith(
        'provisioningProfileId',
        'iOS App Store Profile (1 options)',
        ['Test Profile (profile-123)'],
        10
      );
    });
  });

  describe('UUID Extraction', () => {
    it('should extract UUID from provisioning profile selection', async () => {
      const mockProfiles = [{ id: 'profile-uuid-123', name: 'Test Profile' }];
      const mockGetProvisioningProfiles = vi.fn().mockResolvedValue(mockProfiles);

      const mockPrompt = {
        run: vi.fn().mockResolvedValue('Test Profile (profile-uuid-123)')
      };
      mockCreatePrompt.mockReturnValue(mockPrompt);

      const result = await handleProvisioningProfileIdParameter(
        mockParam,
        mockParams,
        mockGetProvisioningProfiles,
        mockCreatePrompt,
        () => mockOraSpinner
      );

      expect(result.value).toBe('profile-uuid-123');
    });

    it('should trim extracted UUID', async () => {
      const mockProfiles = [{ id: 'spaced-profile-uuid', name: 'Test Profile' }];
      const mockGetProvisioningProfiles = vi.fn().mockResolvedValue(mockProfiles);

      const mockPrompt = {
        run: vi.fn().mockResolvedValue('Test Profile ( spaced-profile-uuid )')
      };
      mockCreatePrompt.mockReturnValue(mockPrompt);

      const result = await handleProvisioningProfileIdParameter(
        mockParam,
        mockParams,
        mockGetProvisioningProfiles,
        mockCreatePrompt,
        () => mockOraSpinner
      );

      expect(result.value).toBe('spaced-profile-uuid');
    });

    it('should handle multiple parentheses and extract from last one', async () => {
      const mockProfiles = [{ id: 'final-profile-uuid', name: 'Test Profile' }];
      const mockGetProvisioningProfiles = vi.fn().mockResolvedValue(mockProfiles);

      const mockPrompt = {
        run: vi.fn().mockResolvedValue('Profile (Name) (Type) (final-profile-uuid)')
      };
      mockCreatePrompt.mockReturnValue(mockPrompt);

      const result = await handleProvisioningProfileIdParameter(
        mockParam,
        mockParams,
        mockGetProvisioningProfiles,
        mockCreatePrompt,
        () => mockOraSpinner
      );

      expect(result.value).toBe('final-profile-uuid');
    });

    it('should handle complex profile names', async () => {
      const mockProfiles = [{ id: 'complex-uuid', name: 'iOS Distribution: Company Inc. (Production)' }];
      const mockGetProvisioningProfiles = vi.fn().mockResolvedValue(mockProfiles);

      const mockPrompt = {
        run: vi.fn().mockResolvedValue('iOS Distribution: Company Inc. (Production) (complex-uuid)')
      };
      mockCreatePrompt.mockReturnValue(mockPrompt);

      const result = await handleProvisioningProfileIdParameter(
        mockParam,
        mockParams,
        mockGetProvisioningProfiles,
        mockCreatePrompt,
        () => mockOraSpinner
      );

      expect(result.value).toBe('complex-uuid');
    });
  });

  describe('Fallback Logic', () => {
    it('should use fallback to find profile by ID when regex fails', async () => {
      const mockProfiles = [
        { id: 'profile-123', name: 'Test Profile 1' },
        { id: 'profile-456', name: 'Test Profile 2' }
      ];
      const mockGetProvisioningProfiles = vi.fn().mockResolvedValue(mockProfiles);

      const mockPrompt = {
        run: vi.fn().mockResolvedValue('profile-456 - no parentheses')
      };
      mockCreatePrompt.mockReturnValue(mockPrompt);

      const result = await handleProvisioningProfileIdParameter(
        mockParam,
        mockParams,
        mockGetProvisioningProfiles,
        mockCreatePrompt,
        () => mockOraSpinner
      );

      expect(result.value).toBe('profile-456');
    });

    it('should return selection as-is when no profile found in fallback', async () => {
      const mockProfiles = [{ id: 'profile-123', name: 'Test Profile' }];
      const mockGetProvisioningProfiles = vi.fn().mockResolvedValue(mockProfiles);

      const mockPrompt = {
        run: vi.fn().mockResolvedValue('unknown-selection')
      };
      mockCreatePrompt.mockReturnValue(mockPrompt);

      const result = await handleProvisioningProfileIdParameter(
        mockParam,
        mockParams,
        mockGetProvisioningProfiles,
        mockCreatePrompt,
        () => mockOraSpinner
      );

      expect(result.value).toBe('unknown-selection');
    });

    it('should find profile by partial ID match in fallback', async () => {
      const mockProfiles = [
        { id: 'full-profile-uuid-123', name: 'Complete Profile' },
        { id: 'another-uuid-456', name: 'Another Profile' }
      ];
      const mockGetProvisioningProfiles = vi.fn().mockResolvedValue(mockProfiles);

      const mockPrompt = {
        run: vi.fn().mockResolvedValue('Selection contains full-profile-uuid-123 somewhere')
      };
      mockCreatePrompt.mockReturnValue(mockPrompt);

      const result = await handleProvisioningProfileIdParameter(
        mockParam,
        mockParams,
        mockGetProvisioningProfiles,
        mockCreatePrompt,
        () => mockOraSpinner
      );

      expect(result.value).toBe('full-profile-uuid-123');
    });
  });

  describe('Error Handling', () => {
    it('should return error when no provisioning profiles available', async () => {
      const mockGetProvisioningProfiles = vi.fn().mockResolvedValue([]);

      const result = await handleProvisioningProfileIdParameter(
        mockParam,
        mockParams,
        mockGetProvisioningProfiles,
        mockCreatePrompt,
        () => mockOraSpinner
      );

      expect(result).toEqual({ isError: true });
      expect(mockOraSpinner.text).toBe('No provisioning profile available');
      expect(mockOraSpinner.fail).toHaveBeenCalledTimes(1);
    });

    it('should return error when provisioning profiles list is null', async () => {
      const mockGetProvisioningProfiles = vi.fn().mockResolvedValue(null);

      const result = await handleProvisioningProfileIdParameter(
        mockParam,
        mockParams,
        mockGetProvisioningProfiles,
        mockCreatePrompt,
        () => mockOraSpinner
      );

      expect(result).toEqual({ isError: true });
      expect(mockOraSpinner.text).toBe('No provisioning profile available');
      expect(mockOraSpinner.fail).toHaveBeenCalledTimes(1);
    });

    it('should handle getProvisioningProfiles throwing an exception', async () => {
      const mockGetProvisioningProfiles = vi.fn().mockRejectedValue(new Error('API Error'));

      const result = await handleProvisioningProfileIdParameter(
        mockParam,
        mockParams,
        mockGetProvisioningProfiles,
        mockCreatePrompt,
        () => mockOraSpinner
      );

      expect(result).toEqual({ isError: true });
      expect(mockOraSpinner.text).toBe('Fetching provisioning profiles failed');
      expect(mockOraSpinner.fail).toHaveBeenCalledTimes(1);
    });
  });

  describe('Profile Data Handling', () => {
    it('should handle profiles with missing name gracefully', async () => {
      const mockProfiles = [
        { id: 'profile-123' }, // missing name
        { id: 'profile-456', name: 'Valid Profile' }
      ];
      const mockGetProvisioningProfiles = vi.fn().mockResolvedValue(mockProfiles);

      const mockPrompt = {
        run: vi.fn().mockResolvedValue('undefined (profile-123)')
      };
      mockCreatePrompt.mockReturnValue(mockPrompt);

      await handleProvisioningProfileIdParameter(
        mockParam,
        mockParams,
        mockGetProvisioningProfiles,
        mockCreatePrompt,
        () => mockOraSpinner
      );

      expect(mockParam.params[0].name).toBe('undefined (profile-123)');
      expect(mockParam.params[1].name).toBe('Valid Profile (profile-456)');
    });

    it('should handle profiles with missing ID gracefully', async () => {
      const mockProfiles = [
        { name: 'Profile Without ID' } // missing id
      ];
      const mockGetProvisioningProfiles = vi.fn().mockResolvedValue(mockProfiles);

      const mockPrompt = {
        run: vi.fn().mockResolvedValue('Profile Without ID (undefined)')
      };
      mockCreatePrompt.mockReturnValue(mockPrompt);

      await handleProvisioningProfileIdParameter(
        mockParam,
        mockParams,
        mockGetProvisioningProfiles,
        mockCreatePrompt,
        () => mockOraSpinner
      );

      expect(mockParam.params[0].name).toBe('Profile Without ID (undefined)');
    });

    it('should handle profiles with special characters in name', async () => {
      const mockProfiles = [
        { id: 'special-123', name: 'Profile: Distribution (v1.0) - Production' },
        { id: 'emoji-456', name: 'Development 📱 Profile' }
      ];
      const mockGetProvisioningProfiles = vi.fn().mockResolvedValue(mockProfiles);

      const mockPrompt = {
        run: vi.fn().mockResolvedValue('Profile: Distribution (v1.0) - Production (special-123)')
      };
      mockCreatePrompt.mockReturnValue(mockPrompt);

      await handleProvisioningProfileIdParameter(
        mockParam,
        mockParams,
        mockGetProvisioningProfiles,
        mockCreatePrompt,
        () => mockOraSpinner
      );

      expect(mockParam.params[0].name).toBe('Profile: Distribution (v1.0) - Production (special-123)');
      expect(mockParam.params[1].name).toBe('Development 📱 Profile (emoji-456)');
    });

    it('should handle completely empty profile objects', async () => {
      const mockProfiles = [
        {}, // completely empty
        { id: 'valid-123', name: 'Valid Profile' }
      ];
      const mockGetProvisioningProfiles = vi.fn().mockResolvedValue(mockProfiles);

      const mockPrompt = {
        run: vi.fn().mockResolvedValue('Valid Profile (valid-123)')
      };
      mockCreatePrompt.mockReturnValue(mockPrompt);

      await handleProvisioningProfileIdParameter(
        mockParam,
        mockParams,
        mockGetProvisioningProfiles,
        mockCreatePrompt,
        () => mockOraSpinner
      );

      expect(mockParam.params[0].name).toBe('undefined (undefined)');
      expect(mockParam.params[1].name).toBe('Valid Profile (valid-123)');
    });
  });

  describe('iOS Profile Types', () => {
    it('should handle different iOS profile types', async () => {
      const mockProfiles = [
        { id: 'dist-123', name: 'iOS Distribution Profile' },
        { id: 'dev-456', name: 'iOS Development Profile' },
        { id: 'adhoc-789', name: 'iOS Ad Hoc Profile' },
        { id: 'store-012', name: 'iOS App Store Profile' }
      ];
      const mockGetProvisioningProfiles = vi.fn().mockResolvedValue(mockProfiles);

      const mockPrompt = {
        run: vi.fn().mockResolvedValue('iOS App Store Profile (store-012)')
      };
      mockCreatePrompt.mockReturnValue(mockPrompt);

      const result = await handleProvisioningProfileIdParameter(
        mockParam,
        mockParams,
        mockGetProvisioningProfiles,
        mockCreatePrompt,
        () => mockOraSpinner
      );

      expect(result.value).toBe('store-012');
      expect(mockParam.params).toHaveLength(4);
      expect(mockParam.params[3].name).toBe('iOS App Store Profile (store-012)');
    });

    it('should handle wildcard provisioning profiles', async () => {
      const mockProfiles = [
        { id: 'wildcard-123', name: 'iOS Team Provisioning Profile: *' },
        { id: 'specific-456', name: 'iOS Team Provisioning Profile: com.example.app' }
      ];
      const mockGetProvisioningProfiles = vi.fn().mockResolvedValue(mockProfiles);

      const mockPrompt = {
        run: vi.fn().mockResolvedValue('iOS Team Provisioning Profile: * (wildcard-123)')
      };
      mockCreatePrompt.mockReturnValue(mockPrompt);

      const result = await handleProvisioningProfileIdParameter(
        mockParam,
        mockParams,
        mockGetProvisioningProfiles,
        mockCreatePrompt,
        () => mockOraSpinner
      );

      expect(result.value).toBe('wildcard-123');
    });
  });

  describe('Edge Cases and Integration', () => {
    it('should handle large numbers of provisioning profiles', async () => {
      const mockProfiles = Array.from({ length: 50 }, (_, i) => ({
        id: `profile-${i}`,
        name: `iOS Profile ${i}`
      }));
      const mockGetProvisioningProfiles = vi.fn().mockResolvedValue(mockProfiles);

      const mockPrompt = {
        run: vi.fn().mockResolvedValue('iOS Profile 25 (profile-25)')
      };
      mockCreatePrompt.mockReturnValue(mockPrompt);

      const result = await handleProvisioningProfileIdParameter(
        mockParam,
        mockParams,
        mockGetProvisioningProfiles,
        mockCreatePrompt,
        () => mockOraSpinner
      );

      expect(result.value).toBe('profile-25');
      expect(mockParam.params).toHaveLength(50);
      expect(mockCreatePrompt).toHaveBeenCalledWith(
        'provisioningProfileId',
        'Provisioning Profile (50 options)',
        expect.arrayContaining(['iOS Profile 25 (profile-25)']),
        10
      );
    });

    it('should handle profiles with very long names', async () => {
      const longName = 'iOS Distribution Profile for Company Inc Production Environment '.repeat(3);
      const mockProfiles = [
        { id: 'long-profile', name: longName }
      ];
      const mockGetProvisioningProfiles = vi.fn().mockResolvedValue(mockProfiles);

      const mockPrompt = {
        run: vi.fn().mockResolvedValue(`${longName} (long-profile)`)
      };
      mockCreatePrompt.mockReturnValue(mockPrompt);

      const result = await handleProvisioningProfileIdParameter(
        mockParam,
        mockParams,
        mockGetProvisioningProfiles,
        mockCreatePrompt,
        () => mockOraSpinner
      );

      expect(result.value).toBe('long-profile');
      expect(mockParam.params[0].name).toBe(`${longName} (long-profile)`);
    });

    it('should handle complex integration scenario', async () => {
      const mockProfiles = [
        { id: 'prod-profile-123', name: 'Production Distribution Profile' },
        { id: 'dev-profile-456', name: 'Development Profile' },
        { id: 'test-profile-789', name: 'Testing Ad Hoc Profile' }
      ];
      const mockGetProvisioningProfiles = vi.fn().mockResolvedValue(mockProfiles);

      const mockPrompt = {
        run: vi.fn().mockResolvedValue('Development Profile (dev-profile-456)')
      };
      mockCreatePrompt.mockReturnValue(mockPrompt);

      const result = await handleProvisioningProfileIdParameter(
        { name: 'provisioningProfileId', type: 'SELECT', description: 'iOS Signing Profile' },
        mockParams,
        mockGetProvisioningProfiles,
        mockCreatePrompt,
        () => mockOraSpinner
      );

      expect(result.value).toBe('dev-profile-456');
      expect(mockCreatePrompt).toHaveBeenCalledWith(
        'provisioningProfileId',
        'iOS Signing Profile (3 options)',
        [
          'Production Distribution Profile (prod-profile-123)',
          'Development Profile (dev-profile-456)',
          'Testing Ad Hoc Profile (test-profile-789)'
        ],
        10
      );
    });
  });

  describe('Dependency Injection', () => {
    it('should use custom createPrompt when provided', async () => {
      const customCreatePrompt = vi.fn();
      const mockProfiles = [{ id: 'profile-123', name: 'Test Profile' }];
      const mockGetProvisioningProfiles = vi.fn().mockResolvedValue(mockProfiles);

      const mockPrompt = {
        run: vi.fn().mockResolvedValue('Test Profile (profile-123)')
      };
      customCreatePrompt.mockReturnValue(mockPrompt);

      await handleProvisioningProfileIdParameter(
        mockParam,
        mockParams,
        mockGetProvisioningProfiles,
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
      const mockProfiles = [{ id: 'profile-123', name: 'Test Profile' }];
      const mockGetProvisioningProfiles = vi.fn().mockResolvedValue(mockProfiles);

      const mockPrompt = {
        run: vi.fn().mockResolvedValue('Test Profile (profile-123)')
      };
      mockCreatePrompt.mockReturnValue(mockPrompt);

      await handleProvisioningProfileIdParameter(
        mockParam,
        mockParams,
        mockGetProvisioningProfiles,
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
    it('should handle getProvisioningProfiles timeout', async () => {
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Provisioning Profile API Timeout')), 100);
      });
      const mockGetProvisioningProfiles = vi.fn().mockReturnValue(timeoutPromise);

      const result = await handleProvisioningProfileIdParameter(
        mockParam,
        mockParams,
        mockGetProvisioningProfiles,
        mockCreatePrompt,
        () => mockOraSpinner
      );

      expect(result).toEqual({ isError: true });
      expect(mockOraSpinner.text).toBe('Fetching provisioning profiles failed');
      expect(mockOraSpinner.fail).toHaveBeenCalledTimes(1);
    });

    it('should handle unexpected data format from API', async () => {
      const malformedData = [
        'string-profile', // Not an object
        { id: 'valid-profile', name: 'Valid Profile' },
        null, // Null profile
        { name: 'Missing ID Profile' }, // Missing ID
        { id: 'missing-name-profile' } // Missing name
      ];
      const mockGetProvisioningProfiles = vi.fn().mockResolvedValue(malformedData);

      const mockPrompt = {
        run: vi.fn().mockResolvedValue('Valid Profile (valid-profile)')
      };
      mockCreatePrompt.mockReturnValue(mockPrompt);

      const result = await handleProvisioningProfileIdParameter(
        mockParam,
        mockParams,
        mockGetProvisioningProfiles,
        mockCreatePrompt,
        () => mockOraSpinner
      );

      expect(result.value).toBe('valid-profile');
      expect(mockParam.params).toHaveLength(5);
      expect(mockOraSpinner.stop).toHaveBeenCalledTimes(1);
    });
  });
});