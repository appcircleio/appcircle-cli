import { describe, it, expect, vi, beforeEach } from 'vitest';
import { handleUserIdParameter } from '../../../src/core/interactive-runner.ts';
import { UNKNOWN_PARAM_VALUE } from '../../../src/constant';

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

describe('handleUserIdParameter', () => {
  const mockParam = { name: 'userId', description: 'User' };
  const mockParams = { organizationId: 'org123' };

  beforeEach(() => {
    vi.clearAllMocks();
    mockOraSpinner.text = '';
  });

  describe('Basic Functionality', () => {
    it('should successfully handle user selection', async () => {
      const mockUserList = [
        { id: 'user1', email: 'john@example.com' },
        { id: 'user2', email: 'jane@example.com' }
      ];
      const mockGetOrganizationUsers = vi.fn().mockResolvedValue(mockUserList);

      const mockPrompt = {
        run: vi.fn().mockResolvedValue('john@example.com (user1)')
      };
      mockCreatePrompt.mockReturnValue(mockPrompt);

      const result = await handleUserIdParameter(
        mockParam,
        mockParams,
        mockGetOrganizationUsers,
        mockCreatePrompt,
        () => mockOraSpinner
      );

      expect(result).toEqual({ value: 'user1' });
      expect(mockGetOrganizationUsers).toHaveBeenCalledWith({ organizationId: 'org123' });
      expect(mockOraSpinner.start).toHaveBeenCalledTimes(1);
      expect(mockOraSpinner.stop).toHaveBeenCalledTimes(1);
    });

    it('should create prompt with correct parameters', async () => {
      const mockUserList = [
        { id: 'user1', email: 'john@example.com' },
        { id: 'user2', email: 'jane@example.com' }
      ];
      const mockGetOrganizationUsers = vi.fn().mockResolvedValue(mockUserList);

      const mockPrompt = {
        run: vi.fn().mockResolvedValue('john@example.com (user1)')
      };
      mockCreatePrompt.mockReturnValue(mockPrompt);

      await handleUserIdParameter(
        mockParam,
        mockParams,
        mockGetOrganizationUsers,
        mockCreatePrompt,
        () => mockOraSpinner
      );

      expect(mockCreatePrompt).toHaveBeenCalledWith(
        'userId',
        'User (2 options)',
        ['john@example.com (user1)', 'jane@example.com (user2)'],
        10
      );
    });

    it('should format choices correctly with email (ID) format', async () => {
      const mockUserList = [
        { id: 'abc123', email: 'admin@company.com' },
        { id: 'def456', email: 'developer@company.com' }
      ];
      const mockGetOrganizationUsers = vi.fn().mockResolvedValue(mockUserList);

      const mockPrompt = {
        run: vi.fn().mockResolvedValue('admin@company.com (abc123)')
      };
      mockCreatePrompt.mockReturnValue(mockPrompt);

      await handleUserIdParameter(
        mockParam,
        mockParams,
        mockGetOrganizationUsers,
        mockCreatePrompt,
        () => mockOraSpinner
      );

      const expectedChoices = [
        'admin@company.com (abc123)',
        'developer@company.com (def456)'
      ];
      expect(mockCreatePrompt).toHaveBeenCalledWith(
        'userId',
        'User (2 options)',
        expectedChoices,
        10
      );
    });

    it('should use organizationId from params', async () => {
      const customParams = { organizationId: 'custom-org-id' };
      const mockUserList = [
        { id: 'user1', email: 'user@example.com' }
      ];
      const mockGetOrganizationUsers = vi.fn().mockResolvedValue(mockUserList);

      const mockPrompt = {
        run: vi.fn().mockResolvedValue('user@example.com (user1)')
      };
      mockCreatePrompt.mockReturnValue(mockPrompt);

      await handleUserIdParameter(
        mockParam,
        customParams,
        mockGetOrganizationUsers,
        mockCreatePrompt,
        () => mockOraSpinner
      );

      expect(mockGetOrganizationUsers).toHaveBeenCalledWith({ organizationId: 'custom-org-id' });
    });

    it('should use currentOrganizationId when organizationId is not available', async () => {
      const paramsWithCurrentOrgId = { currentOrganizationId: 'current-org-123' };
      const mockUserList = [
        { id: 'user1', email: 'user@example.com' }
      ];
      const mockGetOrganizationUsers = vi.fn().mockResolvedValue(mockUserList);

      const mockPrompt = {
        run: vi.fn().mockResolvedValue('user@example.com (user1)')
      };
      mockCreatePrompt.mockReturnValue(mockPrompt);

      await handleUserIdParameter(
        mockParam,
        paramsWithCurrentOrgId,
        mockGetOrganizationUsers,
        mockCreatePrompt,
        () => mockOraSpinner
      );

      expect(mockGetOrganizationUsers).toHaveBeenCalledWith({ organizationId: 'current-org-123' });
    });

    it('should use empty string when no organization ID is available', async () => {
      const emptyParams = {};
      const mockUserList = [
        { id: 'user1', email: 'user@example.com' }
      ];
      const mockGetOrganizationUsers = vi.fn().mockResolvedValue(mockUserList);

      const mockPrompt = {
        run: vi.fn().mockResolvedValue('user@example.com (user1)')
      };
      mockCreatePrompt.mockReturnValue(mockPrompt);

      await handleUserIdParameter(
        mockParam,
        emptyParams,
        mockGetOrganizationUsers,
        mockCreatePrompt,
        () => mockOraSpinner
      );

      expect(mockGetOrganizationUsers).toHaveBeenCalledWith({ organizationId: '' });
    });
  });

  describe('Skip Option Handling', () => {
    it('should add skip option when parameter is not required', async () => {
      const optionalParam = { name: 'userId', required: false };
      const mockUserList = [
        { id: 'user1', email: 'john@example.com' }
      ];
      const mockGetOrganizationUsers = vi.fn().mockResolvedValue(mockUserList);

      const mockPrompt = {
        run: vi.fn().mockResolvedValue(' Skip - (No user)')
      };
      mockCreatePrompt.mockReturnValue(mockPrompt);

      const result = await handleUserIdParameter(
        optionalParam,
        mockParams,
        mockGetOrganizationUsers,
        mockCreatePrompt,
        () => mockOraSpinner
      );

      expect(result.value).toBe(UNKNOWN_PARAM_VALUE); // UNKNOWN_PARAM_VALUE
      expect(mockCreatePrompt).toHaveBeenCalledWith(
        'userId',
        'User (2 options)', // Original user + skip option
        [' Skip - (No user)', 'john@example.com (user1)'],
        10
      );
    });

    it('should not add skip option when parameter is required', async () => {
      const requiredParam = { name: 'userId', required: true };
      const mockUserList = [
        { id: 'user1', email: 'john@example.com' }
      ];
      const mockGetOrganizationUsers = vi.fn().mockResolvedValue(mockUserList);

      const mockPrompt = {
        run: vi.fn().mockResolvedValue('john@example.com (user1)')
      };
      mockCreatePrompt.mockReturnValue(mockPrompt);

      await handleUserIdParameter(
        requiredParam,
        mockParams,
        mockGetOrganizationUsers,
        mockCreatePrompt,
        () => mockOraSpinner
      );

      expect(mockCreatePrompt).toHaveBeenCalledWith(
        'userId',
        'User (1 options)',
        ['john@example.com (user1)'],
        10
      );
    });

    it('should handle skip selection correctly', async () => {
      const optionalParam = { name: 'userId', required: false };
      const mockUserList = [
        { id: 'user1', email: 'john@example.com' }
      ];
      const mockGetOrganizationUsers = vi.fn().mockResolvedValue(mockUserList);

      const mockPrompt = {
        run: vi.fn().mockResolvedValue(' Skip - (No user)')
      };
      mockCreatePrompt.mockReturnValue(mockPrompt);

      const result = await handleUserIdParameter(
        optionalParam,
        mockParams,
        mockGetOrganizationUsers,
        mockCreatePrompt,
        () => mockOraSpinner
      );

      expect(result.value).toBe(UNKNOWN_PARAM_VALUE);
    });

    it('should add skip option to empty user list when not required', async () => {
      const optionalParam = { name: 'userId', required: false };
      const mockGetOrganizationUsers = vi.fn().mockResolvedValue([]);

      const mockPrompt = {
        run: vi.fn().mockResolvedValue(' Skip - (No user)')
      };
      mockCreatePrompt.mockReturnValue(mockPrompt);

      const result = await handleUserIdParameter(
        optionalParam,
        mockParams,
        mockGetOrganizationUsers,
        mockCreatePrompt,
        () => mockOraSpinner
      );

      expect(result.value).toBe(UNKNOWN_PARAM_VALUE);
      expect(mockCreatePrompt).toHaveBeenCalledWith(
        'userId',
        'User (1 options)',
        [' Skip - (No user)'],
        10
      );
    });
  });

  describe('Error Handling', () => {
    it('should return error when no users and no skip option available', async () => {
      const requiredParam = { name: 'userId', required: true };
      const mockGetOrganizationUsers = vi.fn().mockResolvedValue([]);

      const result = await handleUserIdParameter(
        requiredParam,
        mockParams,
        mockGetOrganizationUsers,
        mockCreatePrompt,
        () => mockOraSpinner
      );

      expect(result).toEqual({ isError: true });
      expect(mockOraSpinner.text).toBe('No users in this organization');
      expect(mockOraSpinner.fail).toHaveBeenCalledTimes(1);
    });

    it('should return error when userList is null and required', async () => {
      const requiredParam = { name: 'userId', required: true };
      const mockGetOrganizationUsers = vi.fn().mockResolvedValue(null);

      const result = await handleUserIdParameter(
        requiredParam,
        mockParams,
        mockGetOrganizationUsers,
        mockCreatePrompt,
        () => mockOraSpinner
      );

      expect(result).toEqual({ isError: true });
      expect(mockOraSpinner.text).toBe('No users in this organization');
      expect(mockOraSpinner.fail).toHaveBeenCalledTimes(1);
    });

    it('should handle null userList gracefully with skip option', async () => {
      const optionalParam = { name: 'userId', required: false };
      const mockGetOrganizationUsers = vi.fn().mockResolvedValue(null);

      const mockPrompt = {
        run: vi.fn().mockResolvedValue(' Skip - (No user)')
      };
      mockCreatePrompt.mockReturnValue(mockPrompt);

      const result = await handleUserIdParameter(
        optionalParam,
        mockParams,
        mockGetOrganizationUsers,
        mockCreatePrompt,
        () => mockOraSpinner
      );

      expect(result.value).toBe(UNKNOWN_PARAM_VALUE);
    });

    it('should handle getOrganizationUsers throwing an exception', async () => {
      const mockGetOrganizationUsers = vi.fn().mockRejectedValue(new Error('API Error'));

      const result = await handleUserIdParameter(
        mockParam,
        mockParams,
        mockGetOrganizationUsers,
        mockCreatePrompt,
        () => mockOraSpinner
      );

      expect(result).toEqual({ isError: true });
      expect(mockOraSpinner.text).toBe('Fetching users failed');
      expect(mockOraSpinner.fail).toHaveBeenCalledTimes(1);
    });
  });

  describe('Selection and ID Extraction', () => {
    it('should extract user ID from email (ID) format', async () => {
      const mockUserList = [
        { id: 'user123', email: 'test@example.com' }
      ];
      const mockGetOrganizationUsers = vi.fn().mockResolvedValue(mockUserList);

      const mockPrompt = {
        run: vi.fn().mockResolvedValue('test@example.com (user123)')
      };
      mockCreatePrompt.mockReturnValue(mockPrompt);

      const result = await handleUserIdParameter(
        mockParam,
        mockParams,
        mockGetOrganizationUsers,
        mockCreatePrompt,
        () => mockOraSpinner
      );

      expect(result).toEqual({ value: 'user123' });
    });

    it('should trim extracted user ID', async () => {
      const mockUserList = [
        { id: 'user123', email: 'test@example.com' }
      ];
      const mockGetOrganizationUsers = vi.fn().mockResolvedValue(mockUserList);

      const mockPrompt = {
        run: vi.fn().mockResolvedValue('test@example.com (  user123  )')
      };
      mockCreatePrompt.mockReturnValue(mockPrompt);

      const result = await handleUserIdParameter(
        mockParam,
        mockParams,
        mockGetOrganizationUsers,
        mockCreatePrompt,
        () => mockOraSpinner
      );

      expect(result).toEqual({ value: 'user123' });
    });

    it('should handle multiple parentheses and extract from last one', async () => {
      const mockUserList = [
        { id: 'user123', email: 'test(corp)@example.com' }
      ];
      const mockGetOrganizationUsers = vi.fn().mockResolvedValue(mockUserList);

      const mockPrompt = {
        run: vi.fn().mockResolvedValue('test(corp)@example.com (user123)')
      };
      mockCreatePrompt.mockReturnValue(mockPrompt);

      const result = await handleUserIdParameter(
        mockParam,
        mockParams,
        mockGetOrganizationUsers,
        mockCreatePrompt,
        () => mockOraSpinner
      );

      expect(result).toEqual({ value: 'user123' });
    });
  });

  describe('Fallback Logic', () => {
    it('should use fallback to find user by exact email (ID) match', async () => {
      const mockUserList = [
        { id: 'user1', email: 'john@example.com' },
        { id: 'user2', email: 'jane@example.com' }
      ];
      const mockGetOrganizationUsers = vi.fn().mockResolvedValue(mockUserList);

      const mockPrompt = {
        run: vi.fn().mockResolvedValue('john@example.com (user1)')
      };
      mockCreatePrompt.mockReturnValue(mockPrompt);

      const result = await handleUserIdParameter(
        mockParam,
        mockParams,
        mockGetOrganizationUsers,
        mockCreatePrompt,
        () => mockOraSpinner
      );

      expect(result).toEqual({ value: 'user1' });
    });

    it('should use fallback to find user by direct ID match', async () => {
      const mockUserList = [
        { id: 'user1', email: 'john@example.com' },
        { id: 'user2', email: 'jane@example.com' }
      ];
      const mockGetOrganizationUsers = vi.fn().mockResolvedValue(mockUserList);

      const mockPrompt = {
        run: vi.fn().mockResolvedValue('user2')
      };
      mockCreatePrompt.mockReturnValue(mockPrompt);

      const result = await handleUserIdParameter(
        mockParam,
        mockParams,
        mockGetOrganizationUsers,
        mockCreatePrompt,
        () => mockOraSpinner
      );

      expect(result).toEqual({ value: 'user2' });
    });

    it('should return selection as-is when no user found in fallback', async () => {
      const mockUserList = [
        { id: 'user1', email: 'john@example.com' }
      ];
      const mockGetOrganizationUsers = vi.fn().mockResolvedValue(mockUserList);

      const mockPrompt = {
        run: vi.fn().mockResolvedValue('unknown-selection')
      };
      mockCreatePrompt.mockReturnValue(mockPrompt);

      const result = await handleUserIdParameter(
        mockParam,
        mockParams,
        mockGetOrganizationUsers,
        mockCreatePrompt,
        () => mockOraSpinner
      );

      expect(result).toEqual({ value: 'unknown-selection' });
    });

    it('should handle fallback with skip message selection', async () => {
      const optionalParam = { name: 'userId', required: false };
      const mockUserList = [
        { id: 'user1', email: 'john@example.com' }
      ];
      const mockGetOrganizationUsers = vi.fn().mockResolvedValue(mockUserList);

      // User modified the skip message format
      const mockPrompt = {
        run: vi.fn().mockResolvedValue(' Skip - (No user)')
      };
      mockCreatePrompt.mockReturnValue(mockPrompt);

      const result = await handleUserIdParameter(
        optionalParam,
        mockParams,
        mockGetOrganizationUsers,
        mockCreatePrompt,
        () => mockOraSpinner
      );

      expect(result.value).toBe(UNKNOWN_PARAM_VALUE);
    });
  });

  describe('User Data Handling', () => {
    it('should handle users with missing email gracefully', async () => {
      const mockUserList = [
        { id: 'user1' }, // Missing email
        { id: 'user2', email: null }, // Null email
        { id: 'user3', email: undefined }, // Undefined email
        { id: 'user4', email: 'valid@example.com' } // Valid
      ];
      const mockGetOrganizationUsers = vi.fn().mockResolvedValue(mockUserList);

      const mockPrompt = {
        run: vi.fn().mockResolvedValue('Unknown (user1)')
      };
      mockCreatePrompt.mockReturnValue(mockPrompt);

      const result = await handleUserIdParameter(
        mockParam,
        mockParams,
        mockGetOrganizationUsers,
        mockCreatePrompt,
        () => mockOraSpinner
      );

      expect(result).toEqual({ value: 'user1' });
      expect(mockCreatePrompt).toHaveBeenCalledWith(
        'userId',
        'User (4 options)',
        [
          'Unknown (user1)',
          'Unknown (user2)',
          'Unknown (user3)',
          'valid@example.com (user4)'
        ],
        10
      );
    });

    it('should handle users with missing ID gracefully', async () => {
      const mockUserList = [
        { email: 'test1@example.com' }, // Missing id
        { id: null, email: 'test2@example.com' }, // Null id
        { id: undefined, email: 'test3@example.com' }, // Undefined id
        { id: 'valid-id', email: 'test4@example.com' } // Valid
      ];
      const mockGetOrganizationUsers = vi.fn().mockResolvedValue(mockUserList);

      const mockPrompt = {
        run: vi.fn().mockResolvedValue('test1@example.com (unknown-id)')
      };
      mockCreatePrompt.mockReturnValue(mockPrompt);

      const result = await handleUserIdParameter(
        mockParam,
        mockParams,
        mockGetOrganizationUsers,
        mockCreatePrompt,
        () => mockOraSpinner
      );

      expect(result).toEqual({ value: 'unknown-id' });
    });

    it('should handle users with special characters in email', async () => {
      const mockUserList = [
        { id: 'user1', email: 'test+tag@example.com' },
        { id: 'user2', email: 'user.name+tag@sub.domain.com' }
      ];
      const mockGetOrganizationUsers = vi.fn().mockResolvedValue(mockUserList);

      const mockPrompt = {
        run: vi.fn().mockResolvedValue('test+tag@example.com (user1)')
      };
      mockCreatePrompt.mockReturnValue(mockPrompt);

      const result = await handleUserIdParameter(
        mockParam,
        mockParams,
        mockGetOrganizationUsers,
        mockCreatePrompt,
        () => mockOraSpinner
      );

      expect(result).toEqual({ value: 'user1' });
    });
  });

  describe('Parameter Customization', () => {
    it('should use custom description when provided', async () => {
      const customParam = { name: 'userId', description: 'Select Team Member' };
      const mockUserList = [
        { id: 'user1', email: 'john@example.com' }
      ];
      const mockGetOrganizationUsers = vi.fn().mockResolvedValue(mockUserList);

      const mockPrompt = {
        run: vi.fn().mockResolvedValue('john@example.com (user1)')
      };
      mockCreatePrompt.mockReturnValue(mockPrompt);

      await handleUserIdParameter(
        customParam,
        mockParams,
        mockGetOrganizationUsers,
        mockCreatePrompt,
        () => mockOraSpinner
      );

      expect(mockCreatePrompt).toHaveBeenCalledWith(
        'userId',
        'Select Team Member (1 options)',
        ['john@example.com (user1)'],
        10
      );
    });

    it('should use default description when not provided', async () => {
      const paramWithoutDescription = { name: 'userId' };
      const mockUserList = [
        { id: 'user1', email: 'john@example.com' }
      ];
      const mockGetOrganizationUsers = vi.fn().mockResolvedValue(mockUserList);

      const mockPrompt = {
        run: vi.fn().mockResolvedValue('john@example.com (user1)')
      };
      mockCreatePrompt.mockReturnValue(mockPrompt);

      await handleUserIdParameter(
        paramWithoutDescription,
        mockParams,
        mockGetOrganizationUsers,
        mockCreatePrompt,
        () => mockOraSpinner
      );

      expect(mockCreatePrompt).toHaveBeenCalledWith(
        'userId',
        'User (1 options)',
        ['john@example.com (user1)'],
        10
      );
    });
  });

  describe('Edge Cases and Integration', () => {
    it('should handle large numbers of users', async () => {
      const mockUserList = Array.from({ length: 100 }, (_, i) => ({
        id: `user${i}`,
        email: `user${i}@example.com`
      }));
      const mockGetOrganizationUsers = vi.fn().mockResolvedValue(mockUserList);

      const mockPrompt = {
        run: vi.fn().mockResolvedValue('user50@example.com (user50)')
      };
      mockCreatePrompt.mockReturnValue(mockPrompt);

      const result = await handleUserIdParameter(
        mockParam,
        mockParams,
        mockGetOrganizationUsers,
        mockCreatePrompt,
        () => mockOraSpinner
      );

      expect(result).toEqual({ value: 'user50' });
      expect(mockCreatePrompt).toHaveBeenCalledWith(
        'userId',
        'User (100 options)',
        expect.any(Array),
        10
      );
    });

    it('should handle complex integration scenario with skip option and fallback', async () => {
      const optionalParam = { name: 'userId', required: false, description: 'Project Manager' };
      const paramsWithCurrentOrg = { currentOrganizationId: 'current-org-456' };
      const mockUserList = [
        { id: 'manager1', email: 'pm@company.com' },
        { id: 'manager2', email: 'lead@company.com' }
      ];
      const mockGetOrganizationUsers = vi.fn().mockResolvedValue(mockUserList);

      // User selects a custom value that triggers fallback
      const mockPrompt = {
        run: vi.fn().mockResolvedValue('pm@company.com (manager1)')
      };
      mockCreatePrompt.mockReturnValue(mockPrompt);

      const result = await handleUserIdParameter(
        optionalParam,
        paramsWithCurrentOrg,
        mockGetOrganizationUsers,
        mockCreatePrompt,
        () => mockOraSpinner
      );

      expect(result).toEqual({ value: 'manager1' });
      expect(mockGetOrganizationUsers).toHaveBeenCalledWith({ organizationId: 'current-org-456' });
      expect(mockCreatePrompt).toHaveBeenCalledWith(
        'userId',
        'Project Manager (3 options)', // 2 users + skip
        [' Skip - (No user)', 'pm@company.com (manager1)', 'lead@company.com (manager2)'],
        10
      );
    });
  });

  describe('Dependency Injection', () => {
    it('should use custom createPrompt when provided', async () => {
      const mockUserList = [
        { id: 'user1', email: 'john@example.com' }
      ];
      const mockGetOrganizationUsers = vi.fn().mockResolvedValue(mockUserList);

      const customCreatePrompt = vi.fn().mockReturnValue({
        run: vi.fn().mockResolvedValue('john@example.com (user1)')
      });

      await handleUserIdParameter(
        mockParam,
        mockParams,
        mockGetOrganizationUsers,
        customCreatePrompt
      );

      expect(customCreatePrompt).toHaveBeenCalledTimes(1);
      expect(mockCreatePrompt).not.toHaveBeenCalled();
    });

    it('should use custom spinner when provided', async () => {
      const mockUserList = [
        { id: 'user1', email: 'john@example.com' }
      ];
      const mockGetOrganizationUsers = vi.fn().mockResolvedValue(mockUserList);

      const customSpinner = {
        start: vi.fn().mockReturnThis(),
        stop: vi.fn().mockReturnThis(),
        fail: vi.fn().mockReturnThis(),
        text: ''
      };
      const customSpinnerFactory = vi.fn(() => customSpinner);

      const mockPrompt = {
        run: vi.fn().mockResolvedValue('john@example.com (user1)')
      };
      mockCreatePrompt.mockReturnValue(mockPrompt);

      await handleUserIdParameter(
        mockParam,
        mockParams,
        mockGetOrganizationUsers,
        mockCreatePrompt,
        customSpinnerFactory
      );

      expect(customSpinnerFactory).toHaveBeenCalledWith('Listing Users...');
      expect(customSpinner.start).toHaveBeenCalledTimes(1);
      expect(customSpinner.stop).toHaveBeenCalledTimes(1);
    });
  });

  describe('Async Error Handling', () => {
    it('should handle getOrganizationUsers timeout', async () => {
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Timeout')), 100);
      });
      const mockGetOrganizationUsers = vi.fn().mockReturnValue(timeoutPromise);

      const result = await handleUserIdParameter(
        mockParam,
        mockParams,
        mockGetOrganizationUsers,
        mockCreatePrompt,
        () => mockOraSpinner
      );

      expect(result).toEqual({ isError: true });
      expect(mockOraSpinner.text).toBe('Fetching users failed');
      expect(mockOraSpinner.fail).toHaveBeenCalledTimes(1);
    });

    it('should handle unexpected data format from API', async () => {
      const malformedData = [
        'string-user', // Not an object
        42, // Number instead of object
        null, // Null entry
        { id: 'valid', email: 'valid@example.com' }
      ];
      const mockGetOrganizationUsers = vi.fn().mockResolvedValue(malformedData);

      const mockPrompt = {
        run: vi.fn().mockResolvedValue('Unknown (unknown-id)')
      };
      mockCreatePrompt.mockReturnValue(mockPrompt);

      const result = await handleUserIdParameter(
        mockParam,
        mockParams,
        mockGetOrganizationUsers,
        mockCreatePrompt,
        () => mockOraSpinner
      );

      // Should handle gracefully without crashing
      expect(result).toEqual({ value: 'unknown-id' });
    });
  });
});