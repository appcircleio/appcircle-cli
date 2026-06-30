import { describe, it, expect, vi, beforeEach } from 'vitest';
import { handleTestingGroupIdParameter } from '../../../src/core/interactive-runner.ts';

const mockOraSpinner = {
  start: vi.fn().mockReturnThis(),
  stop: vi.fn().mockReturnThis(),
  fail: vi.fn().mockReturnThis(),
  text: ''
};

const mockCreatePrompt = vi.fn();

describe('handleTestingGroupIdParameter', () => {
  const mockParam = { name: 'testingGroupId', type: 'SELECT' };
  const mockParams = {};

  beforeEach(() => {
    vi.clearAllMocks();
    mockOraSpinner.text = '';
  });

  describe('Basic Functionality', () => {
    it('should successfully handle testing group selection', async () => {
      const mockGroups = [
        { id: 'group-123', name: 'Internal Testers' },
        { id: 'group-456', name: 'Beta Users' }
      ];
      const mockGetTestingGroups = vi.fn().mockResolvedValue(mockGroups);

      const mockPrompt = {
        run: vi.fn().mockResolvedValue('Internal Testers (group-123)')
      };
      mockCreatePrompt.mockReturnValue(mockPrompt);

      const result = await handleTestingGroupIdParameter(
        mockParam,
        mockParams,
        mockGetTestingGroups,
        mockCreatePrompt,
        () => mockOraSpinner
      );

      expect(result.value).toBe('group-123');
      expect(mockOraSpinner.start).toHaveBeenCalledTimes(1);
      expect(mockOraSpinner.stop).toHaveBeenCalledTimes(1);
    });

    it('should format testing group params correctly', async () => {
      const mockGroups = [
        { id: 'group-123', name: 'Internal Testers' },
        { id: 'group-456', name: 'Beta Users' },
        { id: 'group-789', name: 'External QA Team' }
      ];
      const mockGetTestingGroups = vi.fn().mockResolvedValue(mockGroups);

      const mockPrompt = {
        run: vi.fn().mockResolvedValue('Internal Testers (group-123)')
      };
      mockCreatePrompt.mockReturnValue(mockPrompt);

      await handleTestingGroupIdParameter(
        mockParam,
        mockParams,
        mockGetTestingGroups,
        mockCreatePrompt,
        () => mockOraSpinner
      );

      expect(mockParam.params).toEqual([
        { name: 'Internal Testers (group-123)', message: 'Internal Testers (group-123)' },
        { name: 'Beta Users (group-456)', message: 'Beta Users (group-456)' },
        { name: 'External QA Team (group-789)', message: 'External QA Team (group-789)' }
      ]);
    });

    it('should create prompt with correct parameters', async () => {
      const mockGroups = [{ id: 'group-123', name: 'Test Group' }];
      const mockGetTestingGroups = vi.fn().mockResolvedValue(mockGroups);

      const mockPrompt = {
        run: vi.fn().mockResolvedValue('Test Group (group-123)')
      };
      mockCreatePrompt.mockReturnValue(mockPrompt);

      await handleTestingGroupIdParameter(
        mockParam,
        mockParams,
        mockGetTestingGroups,
        mockCreatePrompt,
        () => mockOraSpinner
      );

      expect(mockCreatePrompt).toHaveBeenCalledWith(
        'testingGroupId',
        'Testing Group (1 options)',
        ['Test Group (group-123)'],
        10
      );
    });

    it('should use custom description when provided', async () => {
      const customParam = { name: 'testingGroupId', type: 'SELECT', description: 'QA Testing Group' };
      const mockGroups = [{ id: 'group-123', name: 'Test Group' }];
      const mockGetTestingGroups = vi.fn().mockResolvedValue(mockGroups);

      const mockPrompt = {
        run: vi.fn().mockResolvedValue('Test Group (group-123)')
      };
      mockCreatePrompt.mockReturnValue(mockPrompt);

      await handleTestingGroupIdParameter(
        customParam,
        mockParams,
        mockGetTestingGroups,
        mockCreatePrompt,
        () => mockOraSpinner
      );

      expect(mockCreatePrompt).toHaveBeenCalledWith(
        'testingGroupId',
        'QA Testing Group (1 options)',
        ['Test Group (group-123)'],
        10
      );
    });
  });

  describe('UUID Extraction', () => {
    it('should extract UUID from testing group selection', async () => {
      const mockGroups = [{ id: 'group-uuid-123', name: 'Test Group' }];
      const mockGetTestingGroups = vi.fn().mockResolvedValue(mockGroups);

      const mockPrompt = {
        run: vi.fn().mockResolvedValue('Test Group (group-uuid-123)')
      };
      mockCreatePrompt.mockReturnValue(mockPrompt);

      const result = await handleTestingGroupIdParameter(
        mockParam,
        mockParams,
        mockGetTestingGroups,
        mockCreatePrompt,
        () => mockOraSpinner
      );

      expect(result.value).toBe('group-uuid-123');
    });

    it('should trim extracted UUID', async () => {
      const mockGroups = [{ id: 'spaced-group-uuid', name: 'Test Group' }];
      const mockGetTestingGroups = vi.fn().mockResolvedValue(mockGroups);

      const mockPrompt = {
        run: vi.fn().mockResolvedValue('Test Group ( spaced-group-uuid )')
      };
      mockCreatePrompt.mockReturnValue(mockPrompt);

      const result = await handleTestingGroupIdParameter(
        mockParam,
        mockParams,
        mockGetTestingGroups,
        mockCreatePrompt,
        () => mockOraSpinner
      );

      expect(result.value).toBe('spaced-group-uuid');
    });

    it('should handle multiple parentheses and extract from last one', async () => {
      const mockGroups = [{ id: 'final-group-uuid', name: 'Test Group' }];
      const mockGetTestingGroups = vi.fn().mockResolvedValue(mockGroups);

      const mockPrompt = {
        run: vi.fn().mockResolvedValue('Group (Name) (Type) (final-group-uuid)')
      };
      mockCreatePrompt.mockReturnValue(mockPrompt);

      const result = await handleTestingGroupIdParameter(
        mockParam,
        mockParams,
        mockGetTestingGroups,
        mockCreatePrompt,
        () => mockOraSpinner
      );

      expect(result.value).toBe('final-group-uuid');
    });
  });

  describe('Fallback Logic', () => {
    it('should return selection as-is when regex fails and no fallback needed', async () => {
      const mockGroups = [{ id: 'group-123', name: 'Test Group' }];
      const mockGetTestingGroups = vi.fn().mockResolvedValue(mockGroups);

      const mockPrompt = {
        run: vi.fn().mockResolvedValue('no-parentheses-selection')
      };
      mockCreatePrompt.mockReturnValue(mockPrompt);

      const result = await handleTestingGroupIdParameter(
        mockParam,
        mockParams,
        mockGetTestingGroups,
        mockCreatePrompt,
        () => mockOraSpinner
      );

      expect(result.value).toBe('no-parentheses-selection');
    });

    it('should handle complex group names with parentheses', async () => {
      const mockGroups = [{ id: 'complex-uuid', name: 'Internal Team (QA Division)' }];
      const mockGetTestingGroups = vi.fn().mockResolvedValue(mockGroups);

      const mockPrompt = {
        run: vi.fn().mockResolvedValue('Internal Team (QA Division) (complex-uuid)')
      };
      mockCreatePrompt.mockReturnValue(mockPrompt);

      const result = await handleTestingGroupIdParameter(
        mockParam,
        mockParams,
        mockGetTestingGroups,
        mockCreatePrompt,
        () => mockOraSpinner
      );

      expect(result.value).toBe('complex-uuid');
    });
  });

  describe('Error Handling', () => {
    it('should return error when no testing groups available', async () => {
      const mockGetTestingGroups = vi.fn().mockResolvedValue([]);

      const result = await handleTestingGroupIdParameter(
        mockParam,
        mockParams,
        mockGetTestingGroups,
        mockCreatePrompt,
        () => mockOraSpinner
      );

      expect(result).toEqual({ isError: true });
      expect(mockOraSpinner.text).toBe('No testing group available');
      expect(mockOraSpinner.fail).toHaveBeenCalledTimes(1);
    });

    it('should return error when testing groups list is null', async () => {
      const mockGetTestingGroups = vi.fn().mockResolvedValue(null);

      const result = await handleTestingGroupIdParameter(
        mockParam,
        mockParams,
        mockGetTestingGroups,
        mockCreatePrompt,
        () => mockOraSpinner
      );

      expect(result).toEqual({ isError: true });
      expect(mockOraSpinner.text).toBe('No testing group available');
      expect(mockOraSpinner.fail).toHaveBeenCalledTimes(1);
    });

    it('should handle getTestingGroups throwing an exception', async () => {
      const mockGetTestingGroups = vi.fn().mockRejectedValue(new Error('API Error'));

      const result = await handleTestingGroupIdParameter(
        mockParam,
        mockParams,
        mockGetTestingGroups,
        mockCreatePrompt,
        () => mockOraSpinner
      );

      expect(result).toEqual({ isError: true });
      expect(mockOraSpinner.text).toBe('Fetching testing groups failed');
      expect(mockOraSpinner.fail).toHaveBeenCalledTimes(1);
    });
  });

  describe('Group Data Handling', () => {
    it('should handle groups with missing name gracefully', async () => {
      const mockGroups = [
        { id: 'group-123' }, // missing name
        { id: 'group-456', name: 'Valid Group' }
      ];
      const mockGetTestingGroups = vi.fn().mockResolvedValue(mockGroups);

      const mockPrompt = {
        run: vi.fn().mockResolvedValue('undefined (group-123)')
      };
      mockCreatePrompt.mockReturnValue(mockPrompt);

      await handleTestingGroupIdParameter(
        mockParam,
        mockParams,
        mockGetTestingGroups,
        mockCreatePrompt,
        () => mockOraSpinner
      );

      expect(mockParam.params[0].name).toBe('undefined (group-123)');
      expect(mockParam.params[1].name).toBe('Valid Group (group-456)');
    });

    it('should handle groups with missing ID gracefully', async () => {
      const mockGroups = [
        { name: 'Group Without ID' } // missing id
      ];
      const mockGetTestingGroups = vi.fn().mockResolvedValue(mockGroups);

      const mockPrompt = {
        run: vi.fn().mockResolvedValue('Group Without ID (undefined)')
      };
      mockCreatePrompt.mockReturnValue(mockPrompt);

      await handleTestingGroupIdParameter(
        mockParam,
        mockParams,
        mockGetTestingGroups,
        mockCreatePrompt,
        () => mockOraSpinner
      );

      expect(mockParam.params[0].name).toBe('Group Without ID (undefined)');
    });

    it('should handle completely empty group objects', async () => {
      const mockGroups = [
        {}, // completely empty
        { id: 'valid-123', name: 'Valid Group' }
      ];
      const mockGetTestingGroups = vi.fn().mockResolvedValue(mockGroups);

      const mockPrompt = {
        run: vi.fn().mockResolvedValue('Valid Group (valid-123)')
      };
      mockCreatePrompt.mockReturnValue(mockPrompt);

      await handleTestingGroupIdParameter(
        mockParam,
        mockParams,
        mockGetTestingGroups,
        mockCreatePrompt,
        () => mockOraSpinner
      );

      expect(mockParam.params[0].name).toBe('undefined (undefined)');
      expect(mockParam.params[1].name).toBe('Valid Group (valid-123)');
    });
  });

  describe('Testing Group Types', () => {
    it('should handle different types of testing groups', async () => {
      const mockGroups = [
        { id: 'internal-123', name: 'Internal Team' },
        { id: 'beta-456', name: 'Beta Testers' },
        { id: 'external-789', name: 'External QA' },
        { id: 'public-012', name: 'Public Beta' }
      ];
      const mockGetTestingGroups = vi.fn().mockResolvedValue(mockGroups);

      const mockPrompt = {
        run: vi.fn().mockResolvedValue('Beta Testers (beta-456)')
      };
      mockCreatePrompt.mockReturnValue(mockPrompt);

      const result = await handleTestingGroupIdParameter(
        mockParam,
        mockParams,
        mockGetTestingGroups,
        mockCreatePrompt,
        () => mockOraSpinner
      );

      expect(result.value).toBe('beta-456');
      expect(mockParam.params).toHaveLength(4);
      expect(mockParam.params[1].name).toBe('Beta Testers (beta-456)');
    });

    it('should handle groups with special characters in names', async () => {
      const mockGroups = [
        { id: 'special-123', name: 'QA Team: Mobile (iOS/Android)' },
        { id: 'emoji-456', name: 'Beta Testers 🚀' }
      ];
      const mockGetTestingGroups = vi.fn().mockResolvedValue(mockGroups);

      const mockPrompt = {
        run: vi.fn().mockResolvedValue('QA Team: Mobile (iOS/Android) (special-123)')
      };
      mockCreatePrompt.mockReturnValue(mockPrompt);

      const result = await handleTestingGroupIdParameter(
        mockParam,
        mockParams,
        mockGetTestingGroups,
        mockCreatePrompt,
        () => mockOraSpinner
      );

      expect(result.value).toBe('special-123');
      expect(mockParam.params[0].name).toBe('QA Team: Mobile (iOS/Android) (special-123)');
      expect(mockParam.params[1].name).toBe('Beta Testers 🚀 (emoji-456)');
    });
  });

  describe('Edge Cases and Integration', () => {
    it('should handle large numbers of testing groups', async () => {
      const mockGroups = Array.from({ length: 30 }, (_, i) => ({
        id: `group-${i}`,
        name: `Testing Group ${i}`
      }));
      const mockGetTestingGroups = vi.fn().mockResolvedValue(mockGroups);

      const mockPrompt = {
        run: vi.fn().mockResolvedValue('Testing Group 15 (group-15)')
      };
      mockCreatePrompt.mockReturnValue(mockPrompt);

      const result = await handleTestingGroupIdParameter(
        mockParam,
        mockParams,
        mockGetTestingGroups,
        mockCreatePrompt,
        () => mockOraSpinner
      );

      expect(result.value).toBe('group-15');
      expect(mockParam.params).toHaveLength(30);
      expect(mockCreatePrompt).toHaveBeenCalledWith(
        'testingGroupId',
        'Testing Group (30 options)',
        expect.arrayContaining(['Testing Group 15 (group-15)']),
        10
      );
    });

    it('should handle complex integration scenario', async () => {
      const mockGroups = [
        { id: 'qa-group-123', name: 'QA Testing Group' },
        { id: 'dev-group-456', name: 'Developer Testing Group' },
        { id: 'beta-group-789', name: 'Beta User Group' }
      ];
      const mockGetTestingGroups = vi.fn().mockResolvedValue(mockGroups);

      const mockPrompt = {
        run: vi.fn().mockResolvedValue('Developer Testing Group (dev-group-456)')
      };
      mockCreatePrompt.mockReturnValue(mockPrompt);

      const result = await handleTestingGroupIdParameter(
        { name: 'testingGroupId', type: 'SELECT', description: 'Target Testing Group' },
        mockParams,
        mockGetTestingGroups,
        mockCreatePrompt,
        () => mockOraSpinner
      );

      expect(result.value).toBe('dev-group-456');
      expect(mockCreatePrompt).toHaveBeenCalledWith(
        'testingGroupId',
        'Target Testing Group (3 options)',
        [
          'QA Testing Group (qa-group-123)',
          'Developer Testing Group (dev-group-456)',
          'Beta User Group (beta-group-789)'
        ],
        10
      );
    });
  });

  describe('Dependency Injection', () => {
    it('should use custom createPrompt when provided', async () => {
      const customCreatePrompt = vi.fn();
      const mockGroups = [{ id: 'group-123', name: 'Test Group' }];
      const mockGetTestingGroups = vi.fn().mockResolvedValue(mockGroups);

      const mockPrompt = {
        run: vi.fn().mockResolvedValue('Test Group (group-123)')
      };
      customCreatePrompt.mockReturnValue(mockPrompt);

      await handleTestingGroupIdParameter(
        mockParam,
        mockParams,
        mockGetTestingGroups,
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
      const mockGroups = [{ id: 'group-123', name: 'Test Group' }];
      const mockGetTestingGroups = vi.fn().mockResolvedValue(mockGroups);

      const mockPrompt = {
        run: vi.fn().mockResolvedValue('Test Group (group-123)')
      };
      mockCreatePrompt.mockReturnValue(mockPrompt);

      await handleTestingGroupIdParameter(
        mockParam,
        mockParams,
        mockGetTestingGroups,
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
    it('should handle getTestingGroups timeout', async () => {
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Testing Groups API Timeout')), 100);
      });
      const mockGetTestingGroups = vi.fn().mockReturnValue(timeoutPromise);

      const result = await handleTestingGroupIdParameter(
        mockParam,
        mockParams,
        mockGetTestingGroups,
        mockCreatePrompt,
        () => mockOraSpinner
      );

      expect(result).toEqual({ isError: true });
      expect(mockOraSpinner.text).toBe('Fetching testing groups failed');
      expect(mockOraSpinner.fail).toHaveBeenCalledTimes(1);
    });

    it('should handle unexpected data format from API', async () => {
      const malformedData = [
        'string-group', // Not an object
        { id: 'valid-group', name: 'Valid Group' },
        null, // Null group
        { name: 'Missing ID Group' }, // Missing ID
        { id: 'missing-name-group' } // Missing name
      ];
      const mockGetTestingGroups = vi.fn().mockResolvedValue(malformedData);

      const mockPrompt = {
        run: vi.fn().mockResolvedValue('Valid Group (valid-group)')
      };
      mockCreatePrompt.mockReturnValue(mockPrompt);

      const result = await handleTestingGroupIdParameter(
        mockParam,
        mockParams,
        mockGetTestingGroups,
        mockCreatePrompt,
        () => mockOraSpinner
      );

      expect(result.value).toBe('valid-group');
      expect(mockParam.params).toHaveLength(5);
      expect(mockOraSpinner.stop).toHaveBeenCalledTimes(1);
    });
  });
});