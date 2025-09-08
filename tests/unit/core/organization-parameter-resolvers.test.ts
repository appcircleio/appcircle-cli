import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock ProgramError
vi.mock('../../../src/core/ProgramError', () => ({
  ProgramError: class ProgramError extends Error {
    constructor(message: string) {
      super(message);
      this.name = 'ProgramError';
    }
  }
}));

// Mock constants
vi.mock('../../../src/constant', () => ({
  CURRENT_PARAM_VALUE: 'current',
  UNKNOWN_PARAM_VALUE: 'unknown'
}));

import { 
  resolveOrganizationId, 
  resolveUserIdFromUserParam, 
  getUserRemovalIdentifier 
} from '../../../src/core/command-runner';
import { ProgramError } from '../../../src/core/ProgramError';
import { CURRENT_PARAM_VALUE, UNKNOWN_PARAM_VALUE } from '../../../src/constant';

describe('Organization Parameter Resolvers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('resolveOrganizationId', () => {
    it('should resolve organization by name when organization param is provided', async () => {
      const params = { 
        organization: 'Test Org',
        organizationId: 'all'
      };
      const mockOrganizations = [
        { id: 'org-123', name: 'Test Org' },
        { id: 'org-456', name: 'Other Org' }
      ];
      const mockGetOrganizations = vi.fn().mockResolvedValue(mockOrganizations);
      const mockGetUserInfo = vi.fn();

      const result = await resolveOrganizationId(params, mockGetOrganizations, mockGetUserInfo);

      expect(result).toBe('org-123');
      expect(params.organizationId).toBe('org-123');
      expect(mockGetOrganizations).toHaveBeenCalledTimes(1);
      expect(mockGetUserInfo).not.toHaveBeenCalled();
    });

    it('should throw ProgramError when organization is not found', async () => {
      const params = { 
        organization: 'Nonexistent Org',
        organizationId: 'current'
      };
      const mockOrganizations = [
        { id: 'org-123', name: 'Test Org' },
        { id: 'org-456', name: 'Other Org' }
      ];
      const mockGetOrganizations = vi.fn().mockResolvedValue(mockOrganizations);
      const mockGetUserInfo = vi.fn();

      await expect(async () => {
        await resolveOrganizationId(params, mockGetOrganizations, mockGetUserInfo);
      }).rejects.toThrow(ProgramError);

      await expect(async () => {
        await resolveOrganizationId(params, mockGetOrganizations, mockGetUserInfo);
      }).rejects.toThrow('Organization "Nonexistent Org" not found.');
    });

    it('should use current user organization when organizationId is CURRENT_PARAM_VALUE', async () => {
      const params = { organizationId: CURRENT_PARAM_VALUE };
      const mockUserInfo = { currentOrganizationId: 'user-org-123' };
      const mockGetOrganizations = vi.fn();
      const mockGetUserInfo = vi.fn().mockResolvedValue(mockUserInfo);

      const result = await resolveOrganizationId(params, mockGetOrganizations, mockGetUserInfo);

      expect(result).toBe('user-org-123');
      expect(params.organizationId).toBe('user-org-123');
      expect(mockGetUserInfo).toHaveBeenCalledTimes(1);
      expect(mockGetOrganizations).not.toHaveBeenCalled();
    });

    it('should use current user organization when organizationId is not provided', async () => {
      const params = {};
      const mockUserInfo = { currentOrganizationId: 'user-org-456' };
      const mockGetOrganizations = vi.fn();
      const mockGetUserInfo = vi.fn().mockResolvedValue(mockUserInfo);

      const result = await resolveOrganizationId(params, mockGetOrganizations, mockGetUserInfo);

      expect(result).toBe('user-org-456');
      expect(params.organizationId).toBe('user-org-456');
    });

    it('should return existing organizationId when already set and valid', async () => {
      const params = { organizationId: 'existing-org-123' };
      const mockGetOrganizations = vi.fn();
      const mockGetUserInfo = vi.fn();

      const result = await resolveOrganizationId(params, mockGetOrganizations, mockGetUserInfo);

      expect(result).toBe('existing-org-123');
      expect(mockGetOrganizations).not.toHaveBeenCalled();
      expect(mockGetUserInfo).not.toHaveBeenCalled();
    });

    it('should handle organization resolution when organizationId is "all"', async () => {
      const params = { 
        organization: 'My Org',
        organizationId: 'all'
      };
      const mockOrganizations = [
        { id: 'org-789', name: 'My Org' }
      ];
      const mockGetOrganizations = vi.fn().mockResolvedValue(mockOrganizations);
      const mockGetUserInfo = vi.fn();

      const result = await resolveOrganizationId(params, mockGetOrganizations, mockGetUserInfo);

      expect(result).toBe('org-789');
      expect(params.organizationId).toBe('org-789');
    });

    it('should handle organization resolution when organizationId is "current"', async () => {
      const params = { 
        organization: 'Current Org',
        organizationId: 'current'
      };
      const mockOrganizations = [
        { id: 'org-current', name: 'Current Org' }
      ];
      const mockGetOrganizations = vi.fn().mockResolvedValue(mockOrganizations);
      const mockGetUserInfo = vi.fn();

      const result = await resolveOrganizationId(params, mockGetOrganizations, mockGetUserInfo);

      expect(result).toBe('org-current');
      expect(params.organizationId).toBe('org-current');
    });

    it('should include available organizations in error message', async () => {
      const params = { 
        organization: 'Missing Org',
        organizationId: 'all'
      };
      const mockOrganizations = [
        { id: 'org-1', name: 'First Org' },
        { id: 'org-2', name: 'Second Org' }
      ];
      const mockGetOrganizations = vi.fn().mockResolvedValue(mockOrganizations);
      const mockGetUserInfo = vi.fn();

      try {
        await resolveOrganizationId(params, mockGetOrganizations, mockGetUserInfo);
      } catch (error: any) {
        expect(error.message).toContain('Available organizations:');
        expect(error.message).toContain('- First Org');
        expect(error.message).toContain('- Second Org');
      }
    });

    it('should handle empty organizations list', async () => {
      const params = { 
        organization: 'Any Org',
        organizationId: 'all'
      };
      const mockOrganizations: any[] = [];
      const mockGetOrganizations = vi.fn().mockResolvedValue(mockOrganizations);
      const mockGetUserInfo = vi.fn();

      await expect(async () => {
        await resolveOrganizationId(params, mockGetOrganizations, mockGetUserInfo);
      }).rejects.toThrow('Organization "Any Org" not found.');
    });
  });

  describe('resolveUserIdFromUserParam', () => {
    it('should resolve user ID by email', async () => {
      const params = { 
        user: 'test@example.com',
        organizationId: 'org-123'
      };
      const mockUsers = [
        { id: 'user-123', email: 'test@example.com', fullName: 'Test User' },
        { id: 'user-456', email: 'other@example.com', fullName: 'Other User' }
      ];
      const mockGetOrganizationUsersWithRoles = vi.fn().mockResolvedValue(mockUsers);

      const result = await resolveUserIdFromUserParam(params, mockGetOrganizationUsersWithRoles);

      expect(result).toBe('user-123');
      expect(params.userId).toBe('user-123');
      expect(mockGetOrganizationUsersWithRoles).toHaveBeenCalledWith({ organizationId: 'org-123' });
    });

    it('should resolve user ID by full name', async () => {
      const params = { 
        user: 'John Doe',
        organizationId: 'org-456'
      };
      const mockUsers = [
        { id: 'user-789', email: 'john@example.com', fullName: 'John Doe' },
        { id: 'user-101', email: 'jane@example.com', fullName: 'Jane Doe' }
      ];
      const mockGetOrganizationUsersWithRoles = vi.fn().mockResolvedValue(mockUsers);

      const result = await resolveUserIdFromUserParam(params, mockGetOrganizationUsersWithRoles);

      expect(result).toBe('user-789');
      expect(params.userId).toBe('user-789');
    });

    it('should throw ProgramError when user is not found', async () => {
      const params = { 
        user: 'nonexistent@example.com',
        organizationId: 'org-123'
      };
      const mockUsers = [
        { id: 'user-123', email: 'test@example.com', fullName: 'Test User' }
      ];
      const mockGetOrganizationUsersWithRoles = vi.fn().mockResolvedValue(mockUsers);

      await expect(async () => {
        await resolveUserIdFromUserParam(params, mockGetOrganizationUsersWithRoles);
      }).rejects.toThrow(ProgramError);

      await expect(async () => {
        await resolveUserIdFromUserParam(params, mockGetOrganizationUsersWithRoles);
      }).rejects.toThrow('User "nonexistent@example.com" not found in organization.');
    });

    it('should return existing userId when already set', async () => {
      const params = { 
        user: 'test@example.com',
        userId: 'existing-user-123',
        organizationId: 'org-123'
      };
      const mockGetOrganizationUsersWithRoles = vi.fn();

      const result = await resolveUserIdFromUserParam(params, mockGetOrganizationUsersWithRoles);

      expect(result).toBe('existing-user-123');
      expect(mockGetOrganizationUsersWithRoles).not.toHaveBeenCalled();
    });

    it('should return undefined when no user param provided', async () => {
      const params = { organizationId: 'org-123' };
      const mockGetOrganizationUsersWithRoles = vi.fn();

      const result = await resolveUserIdFromUserParam(params, mockGetOrganizationUsersWithRoles);

      expect(result).toBeUndefined();
      expect(mockGetOrganizationUsersWithRoles).not.toHaveBeenCalled();
    });

    it('should include available users in error message', async () => {
      const params = { 
        user: 'missing@example.com',
        organizationId: 'org-123'
      };
      const mockUsers = [
        { id: 'user-1', email: 'first@example.com', fullName: 'First User' },
        { id: 'user-2', email: 'second@example.com', fullName: null }
      ];
      const mockGetOrganizationUsersWithRoles = vi.fn().mockResolvedValue(mockUsers);

      try {
        await resolveUserIdFromUserParam(params, mockGetOrganizationUsersWithRoles);
      } catch (error: any) {
        expect(error.message).toContain('Available users:');
        expect(error.message).toContain('- first@example.com (First User)');
        expect(error.message).toContain('- second@example.com (No name)');
      }
    });

    it('should handle users with null fullName', async () => {
      const params = { 
        user: 'test@example.com',
        organizationId: 'org-123'
      };
      const mockUsers = [
        { id: 'user-123', email: 'test@example.com', fullName: null }
      ];
      const mockGetOrganizationUsersWithRoles = vi.fn().mockResolvedValue(mockUsers);

      const result = await resolveUserIdFromUserParam(params, mockGetOrganizationUsersWithRoles);

      expect(result).toBe('user-123');
      expect(params.userId).toBe('user-123');
    });

    it('should handle empty users list', async () => {
      const params = { 
        user: 'any@example.com',
        organizationId: 'org-123'
      };
      const mockUsers: any[] = [];
      const mockGetOrganizationUsersWithRoles = vi.fn().mockResolvedValue(mockUsers);

      await expect(async () => {
        await resolveUserIdFromUserParam(params, mockGetOrganizationUsersWithRoles);
      }).rejects.toThrow('User "any@example.com" not found in organization.');
    });
  });

  describe('getUserRemovalIdentifier', () => {
    it('should return email identifier for invitation removal', async () => {
      const params = { 
        email: 'test@example.com',
        organizationId: 'org-123'
      };
      const mockGetOrganizationUserinfo = vi.fn();

      const result = await getUserRemovalIdentifier(params, mockGetOrganizationUserinfo);

      expect(result).toEqual({
        removalIdentifier: 'test@example.com',
        itemType: 'Invitation'
      });
      expect(mockGetOrganizationUserinfo).not.toHaveBeenCalled();
    });

    it('should return user email identifier when userId is provided and user info is fetched', async () => {
      const params = { 
        userId: 'user-123',
        organizationId: 'org-123'
      };
      const mockUserInfo = { email: 'user@example.com', id: 'user-123' };
      const mockGetOrganizationUserinfo = vi.fn().mockResolvedValue(mockUserInfo);

      const result = await getUserRemovalIdentifier(params, mockGetOrganizationUserinfo);

      expect(result).toEqual({
        removalIdentifier: 'user@example.com',
        itemType: 'User'
      });
      expect(mockGetOrganizationUserinfo).toHaveBeenCalledWith({
        organizationId: 'org-123',
        userId: 'user-123'
      });
    });

    it('should fallback to userId when user info fetch fails', async () => {
      const params = { 
        userId: 'user-456',
        organizationId: 'org-123'
      };
      const mockGetOrganizationUserinfo = vi.fn().mockRejectedValue(new Error('User not found'));

      const result = await getUserRemovalIdentifier(params, mockGetOrganizationUserinfo);

      expect(result).toEqual({
        removalIdentifier: 'user-456',
        itemType: 'User'
      });
    });

    it('should not fetch user info when userId is UNKNOWN_PARAM_VALUE', async () => {
      const params = { 
        userId: UNKNOWN_PARAM_VALUE,
        email: 'fallback@example.com',
        organizationId: 'org-123'
      };
      const mockGetOrganizationUserinfo = vi.fn();

      const result = await getUserRemovalIdentifier(params, mockGetOrganizationUserinfo);

      expect(result).toEqual({
        removalIdentifier: 'fallback@example.com',
        itemType: 'Invitation'
      });
      expect(mockGetOrganizationUserinfo).not.toHaveBeenCalled();
    });

    it('should return userId as identifier when user info has no email', async () => {
      const params = { 
        userId: 'user-789',
        organizationId: 'org-123'
      };
      const mockUserInfo = { id: 'user-789' }; // No email
      const mockGetOrganizationUserinfo = vi.fn().mockResolvedValue(mockUserInfo);

      const result = await getUserRemovalIdentifier(params, mockGetOrganizationUserinfo);

      expect(result).toEqual({
        removalIdentifier: 'user-789',
        itemType: 'User'
      });
    });

    it('should prefer email when both email and userId are provided but still treat as User', async () => {
      const params = { 
        email: 'priority@example.com',
        userId: 'user-123',
        organizationId: 'org-123'
      };
      const mockUserInfo = { email: 'user@example.com', id: 'user-123' };
      const mockGetOrganizationUserinfo = vi.fn().mockResolvedValue(mockUserInfo);

      const result = await getUserRemovalIdentifier(params, mockGetOrganizationUserinfo);

      // When userId is present, itemType becomes 'User' and fetches user info
      expect(result).toEqual({
        removalIdentifier: 'user@example.com',
        itemType: 'User'
      });
      expect(mockGetOrganizationUserinfo).toHaveBeenCalledWith({
        organizationId: 'org-123',
        userId: 'user-123'
      });
    });

    it('should handle undefined params gracefully', async () => {
      const params = { organizationId: 'org-123' };
      const mockGetOrganizationUserinfo = vi.fn();

      const result = await getUserRemovalIdentifier(params, mockGetOrganizationUserinfo);

      // When no email or userId, removalIdentifier is undefined but itemType is 'User' (default from logic)
      expect(result).toEqual({
        removalIdentifier: undefined,
        itemType: 'User'
      });
    });

    it('should handle null user info response', async () => {
      const params = { 
        userId: 'user-null',
        organizationId: 'org-123'
      };
      const mockGetOrganizationUserinfo = vi.fn().mockResolvedValue(null);

      const result = await getUserRemovalIdentifier(params, mockGetOrganizationUserinfo);

      expect(result).toEqual({
        removalIdentifier: 'user-null',
        itemType: 'User'
      });
    });
  });

  describe('Integration Tests', () => {
    it('should work together for complete organization and user resolution', async () => {
      const params = { 
        organization: 'Test Org',
        user: 'test@example.com',
        organizationId: 'all'
      };

      // Mock organization resolution
      const mockOrganizations = [{ id: 'org-123', name: 'Test Org' }];
      const mockGetOrganizations = vi.fn().mockResolvedValue(mockOrganizations);
      const mockGetUserInfo = vi.fn();

      // Resolve organization first
      await resolveOrganizationId(params, mockGetOrganizations, mockGetUserInfo);

      // Mock user resolution
      const mockUsers = [{ id: 'user-456', email: 'test@example.com', fullName: 'Test User' }];
      const mockGetOrganizationUsersWithRoles = vi.fn().mockResolvedValue(mockUsers);

      // Resolve user
      await resolveUserIdFromUserParam(params, mockGetOrganizationUsersWithRoles);

      // Get removal identifier
      const mockUserInfo = { email: 'test@example.com', id: 'user-456' };
      const mockGetOrganizationUserinfo = vi.fn().mockResolvedValue(mockUserInfo);
      const removalInfo = await getUserRemovalIdentifier(params, mockGetOrganizationUserinfo);

      expect(params.organizationId).toBe('org-123');
      expect(params.userId).toBe('user-456');
      expect(removalInfo).toEqual({
        removalIdentifier: 'test@example.com',
        itemType: 'User'
      });
    });

    it('should handle errors gracefully during resolution chain', async () => {
      const params = { 
        organization: 'Missing Org',
        organizationId: 'all'
      };

      const mockGetOrganizations = vi.fn().mockResolvedValue([]);
      const mockGetUserInfo = vi.fn();

      await expect(async () => {
        await resolveOrganizationId(params, mockGetOrganizations, mockGetUserInfo);
      }).rejects.toThrow(ProgramError);

      // Organization ID should not be set due to error
      expect(params.organizationId).toBe('all');
    });
  });

  describe('Error Handling', () => {
    it('should handle API errors gracefully', async () => {
      const params = { organizationId: CURRENT_PARAM_VALUE };
      const mockGetOrganizations = vi.fn();
      const mockGetUserInfo = vi.fn().mockRejectedValue(new Error('API Error'));

      await expect(async () => {
        await resolveOrganizationId(params, mockGetOrganizations, mockGetUserInfo);
      }).rejects.toThrow('API Error');
    });

    it('should handle network timeouts', async () => {
      const params = { user: 'test@example.com', organizationId: 'org-123' };
      const mockGetOrganizationUsersWithRoles = vi.fn().mockRejectedValue(new Error('Network timeout'));

      await expect(async () => {
        await resolveUserIdFromUserParam(params, mockGetOrganizationUsersWithRoles);
      }).rejects.toThrow('Network timeout');
    });

    it('should handle malformed API responses', async () => {
      const params = { organization: 'Test Org', organizationId: 'all' };
      const mockGetOrganizations = vi.fn().mockResolvedValue(null);
      const mockGetUserInfo = vi.fn();

      await expect(async () => {
        await resolveOrganizationId(params, mockGetOrganizations, mockGetUserInfo);
      }).rejects.toThrow();
    });
  });

  describe('Edge Cases', () => {
    it('should handle very long organization names', async () => {
      const longOrgName = 'A'.repeat(1000);
      const params = { organization: longOrgName, organizationId: 'all' };
      const mockOrganizations = [{ id: 'org-long', name: longOrgName }];
      const mockGetOrganizations = vi.fn().mockResolvedValue(mockOrganizations);
      const mockGetUserInfo = vi.fn();

      const result = await resolveOrganizationId(params, mockGetOrganizations, mockGetUserInfo);

      expect(result).toBe('org-long');
    });

    it('should handle special characters in user names', async () => {
      const params = { 
        user: 'user@domain.co.uk',
        organizationId: 'org-123'
      };
      const mockUsers = [{ id: 'user-special', email: 'user@domain.co.uk', fullName: 'User & Co.' }];
      const mockGetOrganizationUsersWithRoles = vi.fn().mockResolvedValue(mockUsers);

      const result = await resolveUserIdFromUserParam(params, mockGetOrganizationUsersWithRoles);

      expect(result).toBe('user-special');
    });

    it('should handle unicode characters in organization names', async () => {
      const params = { organization: '组织名称', organizationId: 'all' };
      const mockOrganizations = [{ id: 'org-unicode', name: '组织名称' }];
      const mockGetOrganizations = vi.fn().mockResolvedValue(mockOrganizations);
      const mockGetUserInfo = vi.fn();

      const result = await resolveOrganizationId(params, mockGetOrganizations, mockGetUserInfo);

      expect(result).toBe('org-unicode');
    });
  });
});