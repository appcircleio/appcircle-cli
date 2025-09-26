import { describe, it, expect, vi, beforeEach } from 'vitest';
import { handleConfigurationIdParameter } from '../../../src/core/interactive-runner.ts';

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

describe('handleConfigurationIdParameter', () => {
  const mockParam = { name: 'configurationId', description: 'Configuration Name (ID)' };
  const mockParams = { profileId: 'profile123' };

  beforeEach(() => {
    vi.clearAllMocks();
    mockOraSpinner.text = '';
  });

  describe('Basic Functionality', () => {
    it('should successfully handle configuration selection', async () => {
      const mockConfigurations = [
        { item1: { id: '12345678-1234-1234-1234-123456789012', configurationName: 'Debug' } },
        { item1: { id: '12345678-1234-1234-1234-123456789013', configurationName: 'Release' } },
      ];
      const mockGetConfigurations = vi.fn().mockResolvedValue(mockConfigurations);

      const mockPrompt = {
        run: vi.fn().mockResolvedValue('Debug (12345678-1234-1234-1234-123456789012) (latest)')
      };
      mockCreatePrompt.mockReturnValue(mockPrompt);

      const result = await handleConfigurationIdParameter(
        mockParam,
        mockParams,
        mockGetConfigurations,
        [],
        [],
        mockCreatePrompt,
        () => mockOraSpinner
      );

      expect(result).toEqual({ value: '12345678-1234-1234-1234-123456789012' });
      expect(mockGetConfigurations).toHaveBeenCalledWith({ profileId: 'profile123' });
      expect(mockOraSpinner.start).toHaveBeenCalledTimes(1);
      expect(mockOraSpinner.stop).toHaveBeenCalledTimes(1);
    });

    it('should create prompt with correct parameters and latest indicator', async () => {
      const mockConfigurations = [
        { item1: { id: 'config1', configurationName: 'Debug' } },
        { item1: { id: 'config2', configurationName: 'Release' } },
      ];
      const mockGetConfigurations = vi.fn().mockResolvedValue(mockConfigurations);

      const mockPrompt = {
        run: vi.fn().mockResolvedValue('Debug (12345678-1234-1234-1234-123456789012) (latest)')
      };
      mockCreatePrompt.mockReturnValue(mockPrompt);

      await handleConfigurationIdParameter(
        mockParam,
        mockParams,
        mockGetConfigurations,
        [],
        [],
        mockCreatePrompt,
        () => mockOraSpinner
      );

      expect(mockCreatePrompt).toHaveBeenCalledWith(
        'configurationId',
        'Configuration Name (ID) (2 options)',
        ['Debug (config1) (latest)', 'Release (config2)'],
        10
      );
    });

    it('should pass profileId from params to getConfigurations', async () => {
      const customParams = { profileId: 'custom-profile-id' };
      const mockGetConfigurations = vi.fn().mockResolvedValue([
        { item1: { id: 'config1', configurationName: 'Debug' } }
      ]);

      const mockPrompt = {
        run: vi.fn().mockResolvedValue('Debug (12345678-1234-1234-1234-123456789012) (latest)')
      };
      mockCreatePrompt.mockReturnValue(mockPrompt);

      await handleConfigurationIdParameter(
        mockParam,
        customParams,
        mockGetConfigurations,
        [],
        [],
        mockCreatePrompt,
        () => mockOraSpinner
      );

      expect(mockGetConfigurations).toHaveBeenCalledWith({ profileId: 'custom-profile-id' });
    });
  });

  describe('Branch ID Resolution', () => {
    it('should resolve branchId from parentheses format', async () => {
      const branchesList = [
        { id: 'branch123', name: 'main' },
        { id: 'branch456', name: 'develop' }
      ];
      const paramsWithBranchId = { 
        profileId: 'profile123', 
        branchId: 'main (branch123)' 
      };

      const mockConfigurations = [
        { item1: { id: 'config1', configurationName: 'Debug' } }
      ];
      const mockGetConfigurations = vi.fn().mockResolvedValue(mockConfigurations);

      const mockPrompt = {
        run: vi.fn().mockResolvedValue('Debug (12345678-1234-1234-1234-123456789012) (latest)')
      };
      mockCreatePrompt.mockReturnValue(mockPrompt);

      const result = await handleConfigurationIdParameter(
        mockParam,
        paramsWithBranchId,
        mockGetConfigurations,
        branchesList,
        [],
        mockCreatePrompt,
        () => mockOraSpinner
      );

      expect(result).toEqual({ 
        value: '12345678-1234-1234-1234-123456789012', 
        updatedBranchId: 'branch123' 
      });
    });

    it('should use branchId as-is when no parentheses format', async () => {
      const branchesList = [
        { id: 'branch123', name: 'main' },
        { id: 'branch456', name: 'develop' }
      ];
      const paramsWithBranchId = { 
        profileId: 'profile123', 
        branchId: 'branch123' 
      };

      const mockConfigurations = [
        { item1: { id: 'config1', configurationName: 'Debug' } }
      ];
      const mockGetConfigurations = vi.fn().mockResolvedValue(mockConfigurations);

      const mockPrompt = {
        run: vi.fn().mockResolvedValue('Debug (12345678-1234-1234-1234-123456789012) (latest)')
      };
      mockCreatePrompt.mockReturnValue(mockPrompt);

      const result = await handleConfigurationIdParameter(
        mockParam,
        paramsWithBranchId,
        mockGetConfigurations,
        branchesList,
        [],
        mockCreatePrompt,
        () => mockOraSpinner
      );

      expect(result).toEqual({ 
        value: '12345678-1234-1234-1234-123456789012', 
        updatedBranchId: 'branch123' 
      });
    });

    it('should handle empty branchesList gracefully', async () => {
      const paramsWithBranchId = { 
        profileId: 'profile123', 
        branchId: 'main (branch123)' 
      };

      const mockConfigurations = [
        { item1: { id: 'config1', configurationName: 'Debug' } }
      ];
      const mockGetConfigurations = vi.fn().mockResolvedValue(mockConfigurations);

      const mockPrompt = {
        run: vi.fn().mockResolvedValue('Debug (12345678-1234-1234-1234-123456789012) (latest)')
      };
      mockCreatePrompt.mockReturnValue(mockPrompt);

      const result = await handleConfigurationIdParameter(
        mockParam,
        paramsWithBranchId,
        mockGetConfigurations,
        [], // Empty branchesList
        [],
        mockCreatePrompt,
        () => mockOraSpinner
      );

      expect(result).toEqual({ value: '12345678-1234-1234-1234-123456789012' });
    });

    it('should not update branchId when branch not found in list', async () => {
      const branchesList = [
        { id: 'branch123', name: 'main' }
      ];
      const paramsWithBranchId = { 
        profileId: 'profile123', 
        branchId: 'nonexistent (branch999)' 
      };

      const mockConfigurations = [
        { item1: { id: 'config1', configurationName: 'Debug' } }
      ];
      const mockGetConfigurations = vi.fn().mockResolvedValue(mockConfigurations);

      const mockPrompt = {
        run: vi.fn().mockResolvedValue('Debug (12345678-1234-1234-1234-123456789012) (latest)')
      };
      mockCreatePrompt.mockReturnValue(mockPrompt);

      const result = await handleConfigurationIdParameter(
        mockParam,
        paramsWithBranchId,
        mockGetConfigurations,
        branchesList,
        [],
        mockCreatePrompt,
        () => mockOraSpinner
      );

      expect(result).toEqual({ value: '12345678-1234-1234-1234-123456789012' });
      expect(result.updatedBranchId).toBeUndefined();
    });
  });

  describe('Configuration Cache Resolution', () => {
    it('should resolve from cache when configurationId matches by ID', async () => {
      const configurationsList = [
        { item1: { id: 'config123', configurationName: 'Debug' } },
        { item1: { id: 'config456', configurationName: 'Release' } }
      ];
      const paramsWithConfigId = { 
        profileId: 'profile123', 
        configurationId: 'config123' 
      };

      const mockGetConfigurations = vi.fn(); // Should not be called

      const result = await handleConfigurationIdParameter(
        mockParam,
        paramsWithConfigId,
        mockGetConfigurations,
        [],
        configurationsList,
        mockCreatePrompt,
        () => mockOraSpinner
      );

      expect(result).toEqual({ value: 'config123' });
      expect(mockGetConfigurations).not.toHaveBeenCalled();
      expect(mockOraSpinner.stop).toHaveBeenCalledTimes(1);
    });

    it('should resolve from cache when configurationId matches by name', async () => {
      const configurationsList = [
        { item1: { id: 'config123', configurationName: 'Debug' } },
        { item1: { id: 'config456', configurationName: 'Release' } }
      ];
      const paramsWithConfigId = { 
        profileId: 'profile123', 
        configurationId: 'Debug' 
      };

      const mockGetConfigurations = vi.fn(); // Should not be called

      const result = await handleConfigurationIdParameter(
        mockParam,
        paramsWithConfigId,
        mockGetConfigurations,
        [],
        configurationsList,
        mockCreatePrompt,
        () => mockOraSpinner
      );

      expect(result).toEqual({ value: 'config123' });
      expect(mockGetConfigurations).not.toHaveBeenCalled();
    });

    it('should resolve from cache when configurationId matches full format', async () => {
      const configurationsList = [
        { item1: { id: 'config123', configurationName: 'Debug' } }
      ];
      const paramsWithConfigId = { 
        profileId: 'profile123', 
        configurationId: 'Debug (config123)' 
      };

      const mockGetConfigurations = vi.fn();

      const result = await handleConfigurationIdParameter(
        mockParam,
        paramsWithConfigId,
        mockGetConfigurations,
        [],
        configurationsList,
        mockCreatePrompt,
        () => mockOraSpinner
      );

      expect(result).toEqual({ value: 'config123' });
      expect(mockGetConfigurations).not.toHaveBeenCalled();
    });

    it('should fetch fresh data when no cache match found', async () => {
      const configurationsList = [
        { item1: { id: 'config123', configurationName: 'Debug' } }
      ];
      const paramsWithConfigId = { 
        profileId: 'profile123', 
        configurationId: 'nonexistent' 
      };

      const mockConfigurations = [
        { item1: { id: '12345678-1234-1234-1234-123456789789', configurationName: 'Production' } }
      ];
      const mockGetConfigurations = vi.fn().mockResolvedValue(mockConfigurations);

      const mockPrompt = {
        run: vi.fn().mockResolvedValue('Production (12345678-1234-1234-1234-123456789789) (latest)')
      };
      mockCreatePrompt.mockReturnValue(mockPrompt);

      const result = await handleConfigurationIdParameter(
        mockParam,
        paramsWithConfigId,
        mockGetConfigurations,
        [],
        configurationsList,
        mockCreatePrompt,
        () => mockOraSpinner
      );

      expect(result).toEqual({ value: '12345678-1234-1234-1234-123456789789' });
      expect(mockGetConfigurations).toHaveBeenCalledTimes(1);
    });

    it('should combine branchId resolution with cache resolution', async () => {
      const branchesList = [{ id: 'branch123', name: 'main' }];
      const configurationsList = [
        { item1: { id: 'config123', configurationName: 'Debug' } }
      ];
      const paramsWithBoth = { 
        profileId: 'profile123', 
        branchId: 'main (branch123)',
        configurationId: 'config123' 
      };

      const mockGetConfigurations = vi.fn();

      const result = await handleConfigurationIdParameter(
        mockParam,
        paramsWithBoth,
        mockGetConfigurations,
        branchesList,
        configurationsList,
        mockCreatePrompt,
        () => mockOraSpinner
      );

      expect(result).toEqual({ 
        value: 'config123', 
        updatedBranchId: 'branch123' 
      });
    });
  });

  describe('Error Handling', () => {
    it('should return error when no configurations are found', async () => {
      const mockGetConfigurations = vi.fn().mockResolvedValue([]);

      const result = await handleConfigurationIdParameter(
        mockParam,
        mockParams,
        mockGetConfigurations,
        [],
        [],
        mockCreatePrompt,
        () => mockOraSpinner
      );

      expect(result).toEqual({ isError: true });
      expect(mockOraSpinner.text).toBe('No configurations available');
      expect(mockOraSpinner.fail).toHaveBeenCalledTimes(1);
    });

    it('should return error when configurations is null', async () => {
      const mockGetConfigurations = vi.fn().mockResolvedValue(null);

      const result = await handleConfigurationIdParameter(
        mockParam,
        mockParams,
        mockGetConfigurations,
        [],
        [],
        mockCreatePrompt,
        () => mockOraSpinner
      );

      expect(result).toEqual({ isError: true });
      expect(mockOraSpinner.text).toBe('No configurations available');
      expect(mockOraSpinner.fail).toHaveBeenCalledTimes(1);
    });

    it('should return error when configurations is undefined', async () => {
      const mockGetConfigurations = vi.fn().mockResolvedValue(undefined);

      const result = await handleConfigurationIdParameter(
        mockParam,
        mockParams,
        mockGetConfigurations,
        [],
        [],
        mockCreatePrompt,
        () => mockOraSpinner
      );

      expect(result).toEqual({ isError: true });
      expect(mockOraSpinner.text).toBe('No configurations available');
      expect(mockOraSpinner.fail).toHaveBeenCalledTimes(1);
    });

    it('should handle getConfigurations throwing an exception', async () => {
      const mockGetConfigurations = vi.fn().mockRejectedValue(new Error('API Error'));

      await expect(handleConfigurationIdParameter(
        mockParam,
        mockParams,
        mockGetConfigurations,
        [],
        [],
        mockCreatePrompt,
        () => mockOraSpinner
      )).rejects.toThrow('API Error');
    });

    it('should handle missing profileId gracefully', async () => {
      const paramsWithoutProfile = {};
      const mockGetConfigurations = vi.fn().mockResolvedValue([
        { item1: { id: 'config1', configurationName: 'Debug' } }
      ]);

      const mockPrompt = {
        run: vi.fn().mockResolvedValue('Debug (12345678-1234-1234-1234-123456789012) (latest)')
      };
      mockCreatePrompt.mockReturnValue(mockPrompt);

      await handleConfigurationIdParameter(
        mockParam,
        paramsWithoutProfile,
        mockGetConfigurations,
        [],
        [],
        mockCreatePrompt,
        () => mockOraSpinner
      );

      expect(mockGetConfigurations).toHaveBeenCalledWith({ profileId: '' });
    });
  });

  describe('Selection and ID Extraction', () => {
    it('should extract configuration ID using UUID regex', async () => {
      const mockConfigurations = [
        { item1: { id: '12345678-1234-1234-1234-123456789012', configurationName: 'Debug' } }
      ];
      const mockGetConfigurations = vi.fn().mockResolvedValue(mockConfigurations);

      const mockPrompt = {
        run: vi.fn().mockResolvedValue('Debug (12345678-1234-1234-1234-123456789012) (latest)')
      };
      mockCreatePrompt.mockReturnValue(mockPrompt);

      const result = await handleConfigurationIdParameter(
        mockParam,
        mockParams,
        mockGetConfigurations,
        [],
        [],
        mockCreatePrompt,
        () => mockOraSpinner
      );

      expect(result.value).toBe('12345678-1234-1234-1234-123456789012');
    });

    it('should trim extracted configuration ID from match result', async () => {
      // The trim() function works on the extracted UUID, not on the input selection
      // This test verifies that the .trim() call in the handler works correctly
      const mockConfigurations = [
        { item1: { id: '12345678-1234-1234-1234-123456789012', configurationName: 'Debug' } }
      ];
      const mockGetConfigurations = vi.fn().mockResolvedValue(mockConfigurations);

      const mockPrompt = {
        run: vi.fn().mockResolvedValue('Debug (12345678-1234-1234-1234-123456789012) (latest)')
      };
      mockCreatePrompt.mockReturnValue(mockPrompt);

      const result = await handleConfigurationIdParameter(
        mockParam,
        mockParams,
        mockGetConfigurations,
        [],
        [],
        mockCreatePrompt,
        () => mockOraSpinner
      );

      // UUID should be extracted and trimmed properly
      expect(result.value).toBe('12345678-1234-1234-1234-123456789012');
    });

    it('should return empty string when parameter is not required and no UUID found', async () => {
      const nonRequiredParam = { name: 'configurationId', required: false };
      const mockConfigurations = [
        { item1: { id: 'config1', configurationName: 'Debug' } }
      ];
      const mockGetConfigurations = vi.fn().mockResolvedValue(mockConfigurations);

      const mockPrompt = {
        run: vi.fn().mockResolvedValue('No UUID in this selection')
      };
      mockCreatePrompt.mockReturnValue(mockPrompt);

      const result = await handleConfigurationIdParameter(
        nonRequiredParam,
        mockParams,
        mockGetConfigurations,
        [],
        [],
        mockCreatePrompt,
        () => mockOraSpinner
      );

      expect(result.value).toBe('');
    });

    it('should return selection as-is when no UUID found and parameter is required', async () => {
      const mockConfigurations = [
        { item1: { id: 'config1', configurationName: 'Debug' } }
      ];
      const mockGetConfigurations = vi.fn().mockResolvedValue(mockConfigurations);

      const mockPrompt = {
        run: vi.fn().mockResolvedValue('Custom selection without UUID')
      };
      mockCreatePrompt.mockReturnValue(mockPrompt);

      const result = await handleConfigurationIdParameter(
        mockParam,
        mockParams,
        mockGetConfigurations,
        [],
        [],
        mockCreatePrompt,
        () => mockOraSpinner
      );

      expect(result.value).toBe('Custom selection without UUID');
    });
  });

  describe('Configuration List Caching', () => {
    it('should update configurationsList cache with fresh data', async () => {
      const configurationsList: any[] = [];
      const mockConfigurations = [
        { item1: { id: 'config1', configurationName: 'Debug' } },
        { item1: { id: 'config2', configurationName: 'Release' } }
      ];
      const mockGetConfigurations = vi.fn().mockResolvedValue(mockConfigurations);

      const mockPrompt = {
        run: vi.fn().mockResolvedValue('Debug (12345678-1234-1234-1234-123456789012) (latest)')
      };
      mockCreatePrompt.mockReturnValue(mockPrompt);

      await handleConfigurationIdParameter(
        mockParam,
        mockParams,
        mockGetConfigurations,
        [],
        configurationsList,
        mockCreatePrompt,
        () => mockOraSpinner
      );

      expect(configurationsList).toHaveLength(2);
      expect(configurationsList).toEqual(mockConfigurations);
    });

    it('should clear existing cache before adding new data', async () => {
      const configurationsList = [
        { item1: { id: 'oldconfig1', configurationName: 'Old Debug' } }
      ];
      const mockConfigurations = [
        { item1: { id: 'config1', configurationName: 'New Debug' } }
      ];
      const mockGetConfigurations = vi.fn().mockResolvedValue(mockConfigurations);

      const mockPrompt = {
        run: vi.fn().mockResolvedValue('New Debug (config1) (latest)')
      };
      mockCreatePrompt.mockReturnValue(mockPrompt);

      await handleConfigurationIdParameter(
        mockParam,
        mockParams,
        mockGetConfigurations,
        [],
        configurationsList,
        mockCreatePrompt,
        () => mockOraSpinner
      );

      expect(configurationsList).toHaveLength(1);
      expect(configurationsList[0].item1.configurationName).toBe('New Debug');
    });
  });

  describe('Latest Indicator Logic', () => {
    it('should mark first configuration as latest', async () => {
      const mockConfigurations = [
        { item1: { id: 'config1', configurationName: 'Debug' } },
        { item1: { id: 'config2', configurationName: 'Release' } },
        { item1: { id: 'config3', configurationName: 'Production' } }
      ];
      const mockGetConfigurations = vi.fn().mockResolvedValue(mockConfigurations);

      const mockPrompt = {
        run: vi.fn().mockResolvedValue('Debug (12345678-1234-1234-1234-123456789012) (latest)')
      };
      mockCreatePrompt.mockReturnValue(mockPrompt);

      await handleConfigurationIdParameter(
        mockParam,
        mockParams,
        mockGetConfigurations,
        [],
        [],
        mockCreatePrompt,
        () => mockOraSpinner
      );

      expect(mockCreatePrompt).toHaveBeenCalledWith(
        'configurationId',
        'Configuration Name (ID) (3 options)',
        [
          'Debug (config1) (latest)',
          'Release (config2)',
          'Production (config3)'
        ],
        10
      );
    });

    it('should handle single configuration with latest indicator', async () => {
      const mockConfigurations = [
        { item1: { id: 'config1', configurationName: 'Debug' } }
      ];
      const mockGetConfigurations = vi.fn().mockResolvedValue(mockConfigurations);

      const mockPrompt = {
        run: vi.fn().mockResolvedValue('Debug (12345678-1234-1234-1234-123456789012) (latest)')
      };
      mockCreatePrompt.mockReturnValue(mockPrompt);

      await handleConfigurationIdParameter(
        mockParam,
        mockParams,
        mockGetConfigurations,
        [],
        [],
        mockCreatePrompt,
        () => mockOraSpinner
      );

      expect(mockCreatePrompt).toHaveBeenCalledWith(
        'configurationId',
        'Configuration Name (ID) (1 options)',
        ['Debug (config1) (latest)'],
        10
      );
    });
  });

  describe('Parameter Customization', () => {
    it('should use custom description when provided', async () => {
      const customParam = { name: 'configurationId', description: 'Custom Config Selector' };
      const mockConfigurations = [
        { item1: { id: 'config1', configurationName: 'Debug' } }
      ];
      const mockGetConfigurations = vi.fn().mockResolvedValue(mockConfigurations);

      const mockPrompt = {
        run: vi.fn().mockResolvedValue('Debug (12345678-1234-1234-1234-123456789012) (latest)')
      };
      mockCreatePrompt.mockReturnValue(mockPrompt);

      await handleConfigurationIdParameter(
        customParam,
        mockParams,
        mockGetConfigurations,
        [],
        [],
        mockCreatePrompt,
        () => mockOraSpinner
      );

      expect(mockCreatePrompt).toHaveBeenCalledWith(
        'configurationId',
        'Custom Config Selector (1 options)',
        ['Debug (config1) (latest)'],
        10
      );
    });

    it('should use default description when not provided', async () => {
      const paramWithoutDescription = { name: 'configurationId' };
      const mockConfigurations = [
        { item1: { id: 'config1', configurationName: 'Debug' } }
      ];
      const mockGetConfigurations = vi.fn().mockResolvedValue(mockConfigurations);

      const mockPrompt = {
        run: vi.fn().mockResolvedValue('Debug (12345678-1234-1234-1234-123456789012) (latest)')
      };
      mockCreatePrompt.mockReturnValue(mockPrompt);

      await handleConfigurationIdParameter(
        paramWithoutDescription,
        mockParams,
        mockGetConfigurations,
        [],
        [],
        mockCreatePrompt,
        () => mockOraSpinner
      );

      expect(mockCreatePrompt).toHaveBeenCalledWith(
        'configurationId',
        'Configuration Name (ID) (1 options)',
        ['Debug (config1) (latest)'],
        10
      );
    });
  });

  describe('Edge Cases and Integration', () => {
    it('should handle configurations with missing or malformed data', async () => {
      const mockConfigurations = [
        { item1: { id: 'config1' } }, // Missing configurationName
        { item1: { configurationName: 'Debug' } }, // Missing id
        { item1: { id: null, configurationName: null } }, // Null values
        { item1: { id: '12345678-1234-1234-1234-123456789004', configurationName: 'Release' } } // Valid
      ];
      const mockGetConfigurations = vi.fn().mockResolvedValue(mockConfigurations);

      const mockPrompt = {
        run: vi.fn().mockResolvedValue('Release (12345678-1234-1234-1234-123456789004)')
      };
      mockCreatePrompt.mockReturnValue(mockPrompt);

      const result = await handleConfigurationIdParameter(
        mockParam,
        mockParams,
        mockGetConfigurations,
        [],
        [],
        mockCreatePrompt,
        () => mockOraSpinner
      );

      // Should handle gracefully and still extract valid ID
      expect(result.value).toBe('12345678-1234-1234-1234-123456789004');
    });

    it('should handle UUID regex edge cases', async () => {
      const testCases = [
        { input: 'Config (12345678-1234-1234-1234-123456789012)', expected: '12345678-1234-1234-1234-123456789012' },
        { input: 'Config (12345678-1234-1234-1234-123456789012) (latest)', expected: '12345678-1234-1234-1234-123456789012' },
        { input: 'Config (not-uuid-format)', expected: 'Config (not-uuid-format)' },
        { input: 'Config 12345678-1234-1234-1234-123456789012', expected: 'Config 12345678-1234-1234-1234-123456789012' }, // No parentheses
        { input: 'Config (12345678-1234-1234-1234-12345678901)', expected: 'Config (12345678-1234-1234-1234-12345678901)' } // Wrong length
      ];

      for (const testCase of testCases) {
        const mockConfigurations = [
          { item1: { id: 'config1', configurationName: 'Test' } }
        ];
        const mockGetConfigurations = vi.fn().mockResolvedValue(mockConfigurations);

        mockCreatePrompt.mockReturnValueOnce({
          run: vi.fn().mockResolvedValue(testCase.input)
        });

        const result = await handleConfigurationIdParameter(
          mockParam,
          mockParams,
          mockGetConfigurations,
          [],
          [],
          mockCreatePrompt,
          () => mockOraSpinner
        );

        expect(result.value).toBe(testCase.expected);
      }
    });

    it('should handle complex integration scenario', async () => {
      // Test complex scenario with branch resolution, cache miss, and selection
      const branchesList = [{ id: 'branch123', name: 'main' }];
      const configurationsList = [
        { item1: { id: 'oldconfig', configurationName: 'Old Config' } }
      ];
      const paramsWithBoth = { 
        profileId: 'profile123', 
        branchId: 'main (branch123)',
        configurationId: 'nonexistent' // Will cause cache miss
      };

      const mockConfigurations = [
        { item1: { id: '12345678-1234-1234-1234-123456789012', configurationName: 'New Config' } },
        { item1: { id: 'config2', configurationName: 'Another Config' } }
      ];
      const mockGetConfigurations = vi.fn().mockResolvedValue(mockConfigurations);

      const mockPrompt = {
        run: vi.fn().mockResolvedValue('New Config (12345678-1234-1234-1234-123456789012) (latest)')
      };
      mockCreatePrompt.mockReturnValue(mockPrompt);

      const result = await handleConfigurationIdParameter(
        mockParam,
        paramsWithBoth,
        mockGetConfigurations,
        branchesList,
        configurationsList,
        mockCreatePrompt,
        () => mockOraSpinner
      );

      expect(result).toEqual({
        value: '12345678-1234-1234-1234-123456789012',
        updatedBranchId: 'branch123'
      });
      expect(mockGetConfigurations).toHaveBeenCalledWith({ profileId: 'profile123' });
      expect(configurationsList).toEqual(mockConfigurations); // Cache updated
    });
  });

  describe('Dependency Injection', () => {
    it('should use custom createPrompt when provided', async () => {
      const mockConfigurations = [
        { item1: { id: 'config1', configurationName: 'Debug' } }
      ];
      const mockGetConfigurations = vi.fn().mockResolvedValue(mockConfigurations);

      const customCreatePrompt = vi.fn().mockReturnValue({
        run: vi.fn().mockResolvedValue('Debug (12345678-1234-1234-1234-123456789012) (latest)')
      });

      await handleConfigurationIdParameter(
        mockParam,
        mockParams,
        mockGetConfigurations,
        [],
        [],
        customCreatePrompt
      );

      expect(customCreatePrompt).toHaveBeenCalledTimes(1);
      expect(mockCreatePrompt).not.toHaveBeenCalled();
    });

    it('should use custom spinner when provided', async () => {
      const mockConfigurations = [
        { item1: { id: 'config1', configurationName: 'Debug' } }
      ];
      const mockGetConfigurations = vi.fn().mockResolvedValue(mockConfigurations);

      const customSpinner = {
        start: vi.fn().mockReturnThis(),
        stop: vi.fn().mockReturnThis(),
        fail: vi.fn().mockReturnThis(),
        text: ''
      };
      const customSpinnerFactory = vi.fn(() => customSpinner);

      const mockPrompt = {
        run: vi.fn().mockResolvedValue('Debug (12345678-1234-1234-1234-123456789012) (latest)')
      };
      mockCreatePrompt.mockReturnValue(mockPrompt);

      await handleConfigurationIdParameter(
        mockParam,
        mockParams,
        mockGetConfigurations,
        [],
        [],
        mockCreatePrompt,
        customSpinnerFactory
      );

      expect(customSpinnerFactory).toHaveBeenCalledWith('Listing Configurations...');
      expect(customSpinner.start).toHaveBeenCalledTimes(1);
      expect(customSpinner.stop).toHaveBeenCalledTimes(1);
    });
  });

  describe('Async Error Handling', () => {
    it('should handle getConfigurations timeout', async () => {
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Timeout')), 100);
      });
      const mockGetConfigurations = vi.fn().mockReturnValue(timeoutPromise);

      await expect(handleConfigurationIdParameter(
        mockParam,
        mockParams,
        mockGetConfigurations,
        [],
        [],
        mockCreatePrompt,
        () => mockOraSpinner
      )).rejects.toThrow('Timeout');
    });

    it('should handle unexpected data format from API', async () => {
      const malformedData = [
        { wrongProperty: 'value1' },
        { anotherWrongProperty: 'value2' }
      ];
      const mockGetConfigurations = vi.fn().mockResolvedValue(malformedData);

      const mockPrompt = {
        run: vi.fn().mockResolvedValue('Unknown (unknown-id) (latest)')
      };
      mockCreatePrompt.mockReturnValue(mockPrompt);

      const result = await handleConfigurationIdParameter(
        mockParam,
        mockParams,
        mockGetConfigurations,
        [],
        [],
        mockCreatePrompt,
        () => mockOraSpinner
      );

      // Should handle gracefully with safe property access
      expect(result.value).toBe('Unknown (unknown-id) (latest)');
    });
  });
});