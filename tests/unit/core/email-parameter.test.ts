import { describe, it, expect, vi, beforeEach } from 'vitest';
import { handleEmailParameter } from '../../../src/core/interactive-runner.ts';
import { UNKNOWN_PARAM_VALUE } from '../../../src/constant';

const mockOraSpinner = {
  start: vi.fn().mockReturnThis(),
  stop: vi.fn().mockReturnThis(),
  fail: vi.fn().mockReturnThis(),
  text: ''
};

describe('handleEmailParameter', () => {
  const mockParam = { name: 'email', required: true, type: 'SELECT' };
  const mockParams = { 
    organizationId: 'org-123',
    currentOrganizationId: 'current-org-456'
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockOraSpinner.text = '';
  });

  describe('Basic Functionality', () => {
    it('should successfully handle invitation selection', async () => {
      const mockInvitations = [
        { userEmail: 'user1@example.com' },
        { userEmail: 'user2@example.com' }
      ];
      const mockGetOrganizationInvitations = vi.fn().mockResolvedValue(mockInvitations);

      const result = await handleEmailParameter(
        mockParam,
        mockParams,
        mockGetOrganizationInvitations,
        () => mockOraSpinner
      );

      expect(result).toEqual({});
      expect(mockParam.params).toEqual([
        { name: 'user1@example.com', message: 'user1@example.com' },
        { name: 'user2@example.com', message: 'user2@example.com' }
      ]);
      expect(mockOraSpinner.start).toHaveBeenCalledTimes(1);
      expect(mockOraSpinner.stop).toHaveBeenCalledTimes(1);
    });

    it('should use organizationId from params', async () => {
      const mockInvitations = [{ userEmail: 'test@example.com' }];
      const mockGetOrganizationInvitations = vi.fn().mockResolvedValue(mockInvitations);

      await handleEmailParameter(
        mockParam,
        mockParams,
        mockGetOrganizationInvitations,
        () => mockOraSpinner
      );

      expect(mockGetOrganizationInvitations).toHaveBeenCalledWith({
        organizationId: 'org-123'
      });
    });

    it('should use currentOrganizationId when organizationId is not available', async () => {
      const mockInvitations = [{ userEmail: 'test@example.com' }];
      const mockGetOrganizationInvitations = vi.fn().mockResolvedValue(mockInvitations);
      const paramsWithoutOrgId = { currentOrganizationId: 'current-org-456' };

      await handleEmailParameter(
        mockParam,
        paramsWithoutOrgId,
        mockGetOrganizationInvitations,
        () => mockOraSpinner
      );

      expect(mockGetOrganizationInvitations).toHaveBeenCalledWith({
        organizationId: 'current-org-456'
      });
    });

    it('should use empty string when no organization ID is available', async () => {
      const mockInvitations = [{ userEmail: 'test@example.com' }];
      const mockGetOrganizationInvitations = vi.fn().mockResolvedValue(mockInvitations);

      await handleEmailParameter(
        mockParam,
        {},
        mockGetOrganizationInvitations,
        () => mockOraSpinner
      );

      expect(mockGetOrganizationInvitations).toHaveBeenCalledWith({
        organizationId: ''
      });
    });

    it('should format invitations with _message when available', async () => {
      const mockInvitations = [
        { userEmail: 'user1@example.com', _message: 'John Doe - user1@example.com' },
        { userEmail: 'user2@example.com' }
      ];
      const mockGetOrganizationInvitations = vi.fn().mockResolvedValue(mockInvitations);

      await handleEmailParameter(
        mockParam,
        mockParams,
        mockGetOrganizationInvitations,
        () => mockOraSpinner
      );

      expect(mockParam.params).toEqual([
        { name: 'user1@example.com', message: 'John Doe - user1@example.com' },
        { name: 'user2@example.com', message: 'user2@example.com' }
      ]);
    });
  });

  describe('Skip Option Handling', () => {
    it('should add skip option when parameter is not required', async () => {
      const optionalParam = { name: 'email', required: false, type: 'SELECT' };
      const mockInvitations = [{ userEmail: 'user1@example.com' }];
      const mockGetOrganizationInvitations = vi.fn().mockResolvedValue(mockInvitations);

      await handleEmailParameter(
        optionalParam,
        mockParams,
        mockGetOrganizationInvitations,
        () => mockOraSpinner
      );

      expect(optionalParam.params).toEqual([
        { name: UNKNOWN_PARAM_VALUE, message: 'Skip - (No email)' },
        { name: 'user1@example.com', message: 'user1@example.com' }
      ]);
    });

    it('should not add skip option when parameter is required', async () => {
      const mockInvitations = [{ userEmail: 'user1@example.com' }];
      const mockGetOrganizationInvitations = vi.fn().mockResolvedValue(mockInvitations);

      await handleEmailParameter(
        mockParam,
        mockParams,
        mockGetOrganizationInvitations,
        () => mockOraSpinner
      );

      expect(mockParam.params).toEqual([
        { name: 'user1@example.com', message: 'user1@example.com' }
      ]);
    });

    it('should add skip option to empty invitation list when not required', async () => {
      const optionalParam = { name: 'email', required: false, type: 'SELECT' };
      const mockGetOrganizationInvitations = vi.fn().mockResolvedValue([]);

      await handleEmailParameter(
        optionalParam,
        mockParams,
        mockGetOrganizationInvitations,
        () => mockOraSpinner
      );

      expect(optionalParam.params).toEqual([
        { name: UNKNOWN_PARAM_VALUE, message: 'Skip - (No email)' }
      ]);
    });
  });

  describe('Error Handling', () => {
    it('should return error when no invitations and no skip option available', async () => {
      const mockGetOrganizationInvitations = vi.fn().mockResolvedValue([]);

      const result = await handleEmailParameter(
        mockParam,
        mockParams,
        mockGetOrganizationInvitations,
        () => mockOraSpinner
      );

      expect(result).toEqual({ isError: true });
      expect(mockOraSpinner.text).toBe('No invitations available');
      expect(mockOraSpinner.fail).toHaveBeenCalledTimes(1);
    });

    it('should return error when invitationsList is null and required', async () => {
      const mockGetOrganizationInvitations = vi.fn().mockResolvedValue(null);

      const result = await handleEmailParameter(
        mockParam,
        mockParams,
        mockGetOrganizationInvitations,
        () => mockOraSpinner
      );

      expect(result).toEqual({ isError: true });
      expect(mockOraSpinner.text).toBe('No invitations available');
      expect(mockOraSpinner.fail).toHaveBeenCalledTimes(1);
    });

    it('should handle null invitationsList gracefully with skip option', async () => {
      const optionalParam = { name: 'email', required: false, type: 'SELECT' };
      const mockGetOrganizationInvitations = vi.fn().mockResolvedValue(null);

      const result = await handleEmailParameter(
        optionalParam,
        mockParams,
        mockGetOrganizationInvitations,
        () => mockOraSpinner
      );

      expect(result).toEqual({});
      expect(optionalParam.params).toEqual([
        { name: UNKNOWN_PARAM_VALUE, message: 'Skip - (No email)' }
      ]);
    });

    it('should handle getOrganizationInvitations throwing an exception', async () => {
      const mockGetOrganizationInvitations = vi.fn().mockRejectedValue(new Error('API Error'));

      const result = await handleEmailParameter(
        mockParam,
        mockParams,
        mockGetOrganizationInvitations,
        () => mockOraSpinner
      );

      expect(result).toEqual({ isError: true });
      expect(mockOraSpinner.text).toBe('Fetching invitations failed');
      expect(mockOraSpinner.fail).toHaveBeenCalledTimes(1);
    });
  });

  describe('Invitation Data Handling', () => {
    it('should handle invitations with missing userEmail gracefully', async () => {
      const mockInvitations = [
        { userEmail: 'user1@example.com' },
        { /* missing userEmail */ },
        { userEmail: 'user3@example.com' }
      ];
      const mockGetOrganizationInvitations = vi.fn().mockResolvedValue(mockInvitations);

      await handleEmailParameter(
        mockParam,
        mockParams,
        mockGetOrganizationInvitations,
        () => mockOraSpinner
      );

      expect(mockParam.params).toEqual([
        { name: 'user1@example.com', message: 'user1@example.com' },
        { name: undefined, message: undefined },
        { name: 'user3@example.com', message: 'user3@example.com' }
      ]);
    });

    it('should handle invitations with special characters in email', async () => {
      const mockInvitations = [
        { userEmail: 'user+test@example.com' },
        { userEmail: 'user.name@example-domain.co.uk' }
      ];
      const mockGetOrganizationInvitations = vi.fn().mockResolvedValue(mockInvitations);

      await handleEmailParameter(
        mockParam,
        mockParams,
        mockGetOrganizationInvitations,
        () => mockOraSpinner
      );

      expect(mockParam.params).toEqual([
        { name: 'user+test@example.com', message: 'user+test@example.com' },
        { name: 'user.name@example-domain.co.uk', message: 'user.name@example-domain.co.uk' }
      ]);
    });

    it('should handle invitations with custom messages', async () => {
      const mockInvitations = [
        { 
          userEmail: 'admin@example.com', 
          _message: 'Administrator - admin@example.com (Pending)' 
        },
        { 
          userEmail: 'user@example.com', 
          _message: 'Regular User - user@example.com (Active)' 
        }
      ];
      const mockGetOrganizationInvitations = vi.fn().mockResolvedValue(mockInvitations);

      await handleEmailParameter(
        mockParam,
        mockParams,
        mockGetOrganizationInvitations,
        () => mockOraSpinner
      );

      expect(mockParam.params).toEqual([
        { name: 'admin@example.com', message: 'Administrator - admin@example.com (Pending)' },
        { name: 'user@example.com', message: 'Regular User - user@example.com (Active)' }
      ]);
    });
  });

  describe('Edge Cases and Integration', () => {
    it('should handle large numbers of invitations', async () => {
      const mockInvitations = Array.from({ length: 100 }, (_, i) => ({
        userEmail: `user${i}@example.com`,
        _message: `User ${i} - user${i}@example.com`
      }));
      const mockGetOrganizationInvitations = vi.fn().mockResolvedValue(mockInvitations);

      const result = await handleEmailParameter(
        mockParam,
        mockParams,
        mockGetOrganizationInvitations,
        () => mockOraSpinner
      );

      expect(result).toEqual({});
      expect(mockParam.params).toHaveLength(100);
      expect(mockParam.params[0]).toEqual({
        name: 'user0@example.com',
        message: 'User 0 - user0@example.com'
      });
      expect(mockParam.params[99]).toEqual({
        name: 'user99@example.com',
        message: 'User 99 - user99@example.com'
      });
    });

    it('should handle complex integration scenario with skip option', async () => {
      const optionalParam = { name: 'email', required: false, type: 'SELECT' };
      const mockInvitations = [
        { userEmail: 'manager@example.com', _message: 'Project Manager - manager@example.com' }
      ];
      const mockGetOrganizationInvitations = vi.fn().mockResolvedValue(mockInvitations);

      const result = await handleEmailParameter(
        optionalParam,
        { currentOrganizationId: 'test-org' },
        mockGetOrganizationInvitations,
        () => mockOraSpinner
      );

      expect(result).toEqual({});
      expect(optionalParam.params).toEqual([
        { name: UNKNOWN_PARAM_VALUE, message: 'Skip - (No email)' },
        { name: 'manager@example.com', message: 'Project Manager - manager@example.com' }
      ]);
      expect(mockGetOrganizationInvitations).toHaveBeenCalledWith({
        organizationId: 'test-org'
      });
    });
  });

  describe('Dependency Injection', () => {
    it('should use custom spinner when provided', async () => {
      const customSpinner = {
        start: vi.fn().mockReturnThis(),
        stop: vi.fn().mockReturnThis(),
        fail: vi.fn().mockReturnThis(),
        text: ''
      };
      const mockInvitations = [{ userEmail: 'test@example.com' }];
      const mockGetOrganizationInvitations = vi.fn().mockResolvedValue(mockInvitations);

      await handleEmailParameter(
        mockParam,
        mockParams,
        mockGetOrganizationInvitations,
        () => customSpinner
      );

      expect(customSpinner.start).toHaveBeenCalledTimes(1);
      expect(customSpinner.stop).toHaveBeenCalledTimes(1);
      expect(mockOraSpinner.start).not.toHaveBeenCalled();
      expect(mockOraSpinner.stop).not.toHaveBeenCalled();
    });
  });

  describe('Async Error Handling', () => {
    it('should handle getOrganizationInvitations timeout', async () => {
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Timeout')), 100);
      });
      const mockGetOrganizationInvitations = vi.fn().mockReturnValue(timeoutPromise);

      const result = await handleEmailParameter(
        mockParam,
        mockParams,
        mockGetOrganizationInvitations,
        () => mockOraSpinner
      );

      expect(result).toEqual({ isError: true });
      expect(mockOraSpinner.text).toBe('Fetching invitations failed');
      expect(mockOraSpinner.fail).toHaveBeenCalledTimes(1);
    });

    it('should handle unexpected data format from API', async () => {
      const malformedData = [
        'string-invitation', // Not an object
        { userEmail: 'valid@example.com' },
        null, // Null invitation
        { userEmail: 'another@example.com', _message: null } // Null message
      ];
      const mockGetOrganizationInvitations = vi.fn().mockResolvedValue(malformedData);

      const result = await handleEmailParameter(
        mockParam,
        mockParams,
        mockGetOrganizationInvitations,
        () => mockOraSpinner
      );

      expect(result).toEqual({});
      expect(mockParam.params).toHaveLength(4);
      // Should handle malformed data gracefully
      expect(mockOraSpinner.stop).toHaveBeenCalledTimes(1);
    });
  });
});