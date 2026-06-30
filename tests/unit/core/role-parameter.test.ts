import { describe, it, expect, vi, beforeEach } from 'vitest';
import { handleRoleParameter } from '../../../src/core/interactive-runner.ts';

const mockOraSpinner = {
  start: vi.fn().mockReturnThis(),
  stop: vi.fn().mockReturnThis(),
  fail: vi.fn().mockReturnThis(),
  text: ''
};

// Mock ora
vi.mock('ora', () => ({
  default: vi.fn(() => mockOraSpinner)
}));

describe('handleRoleParameter', () => {
  const mockParam = { name: 'role' };
  const mockParams = { organizationId: 'org123' };

  beforeEach(() => {
    vi.clearAllMocks();
    mockOraSpinner.text = '';
  });

  describe('Basic Functionality', () => {
    it('should successfully handle role parameter without user context', async () => {
      const mockRoleList = [
        { key: 'admin', description: 'Administrator', isDefaultRole: false },
        { key: 'developer', description: 'Developer', isDefaultRole: true },
        { key: 'viewer', description: 'Viewer', isDefaultRole: false }
      ];
      const mockGetRoleList = vi.fn().mockResolvedValue(mockRoleList);
      const mockGetOrganizationUserinfo = vi.fn();

      const result = await handleRoleParameter(
        mockParam,
        mockParams,
        mockGetRoleList,
        mockGetOrganizationUserinfo,
        () => mockOraSpinner
      );

      expect(result).toEqual({});
      expect(mockParam.params).toEqual([
        { name: 'admin', message: 'Administrator' },
        { name: 'developer', message: 'Developer' },
        { name: 'viewer', message: 'Viewer' }
      ]);
      expect(mockGetRoleList).toHaveBeenCalledTimes(1);
      expect(mockGetOrganizationUserinfo).not.toHaveBeenCalled();
      expect(mockOraSpinner.start).toHaveBeenCalledTimes(1);
      expect(mockOraSpinner.stop).toHaveBeenCalledTimes(1);
    });

    it('should fetch user info when userId is provided', async () => {
      const paramsWithUserId = { 
        organizationId: 'org123', 
        userId: 'user456' 
      };
      const mockRoleList = [
        { key: 'admin', description: 'Administrator', isDefaultRole: false }
      ];
      const mockUserInfo = { roles: ['viewer'] };
      
      const mockGetRoleList = vi.fn().mockResolvedValue(mockRoleList);
      const mockGetOrganizationUserinfo = vi.fn().mockResolvedValue(mockUserInfo);

      await handleRoleParameter(
        mockParam,
        paramsWithUserId,
        mockGetRoleList,
        mockGetOrganizationUserinfo,
        () => mockOraSpinner
      );

      expect(mockGetOrganizationUserinfo).toHaveBeenCalledWith({
        organizationId: 'org123',
        userId: 'user456'
      });
    });

    it('should set param.params correctly with role mappings', async () => {
      const mockRoleList = [
        { key: 'custom-admin', description: 'Custom Administrator Role', isDefaultRole: false },
        { key: 'special-dev', description: 'Special Developer Role', isDefaultRole: true }
      ];
      const mockGetRoleList = vi.fn().mockResolvedValue(mockRoleList);
      const mockGetOrganizationUserinfo = vi.fn();

      await handleRoleParameter(
        mockParam,
        mockParams,
        mockGetRoleList,
        mockGetOrganizationUserinfo,
        () => mockOraSpinner
      );

      expect(mockParam.params).toEqual([
        { name: 'custom-admin', message: 'Custom Administrator Role' },
        { name: 'special-dev', message: 'Special Developer Role' }
      ]);
    });
  });

  describe('Error Handling', () => {
    it('should return error when no roles are available', async () => {
      const mockGetRoleList = vi.fn().mockResolvedValue([]);
      const mockGetOrganizationUserinfo = vi.fn();

      const result = await handleRoleParameter(
        mockParam,
        mockParams,
        mockGetRoleList,
        mockGetOrganizationUserinfo,
        () => mockOraSpinner
      );

      expect(result).toEqual({ isError: true });
      expect(mockOraSpinner.text).toBe('No roles available.');
      expect(mockOraSpinner.fail).toHaveBeenCalledTimes(1);
    });

    it('should return error when roleList is null', async () => {
      const mockGetRoleList = vi.fn().mockResolvedValue(null);
      const mockGetOrganizationUserinfo = vi.fn();

      const result = await handleRoleParameter(
        mockParam,
        mockParams,
        mockGetRoleList,
        mockGetOrganizationUserinfo,
        () => mockOraSpinner
      );

      expect(result).toEqual({ isError: true });
      expect(mockOraSpinner.text).toBe('No roles available.');
      expect(mockOraSpinner.fail).toHaveBeenCalledTimes(1);
    });

    it('should return error when roleList is undefined', async () => {
      const mockGetRoleList = vi.fn().mockResolvedValue(undefined);
      const mockGetOrganizationUserinfo = vi.fn();

      const result = await handleRoleParameter(
        mockParam,
        mockParams,
        mockGetRoleList,
        mockGetOrganizationUserinfo,
        () => mockOraSpinner
      );

      expect(result).toEqual({ isError: true });
      expect(mockOraSpinner.text).toBe('No roles available.');
      expect(mockOraSpinner.fail).toHaveBeenCalledTimes(1);
    });

    it('should handle getRoleList throwing an exception', async () => {
      const mockGetRoleList = vi.fn().mockRejectedValue(new Error('API Error'));
      const mockGetOrganizationUserinfo = vi.fn();

      await expect(handleRoleParameter(
        mockParam,
        mockParams,
        mockGetRoleList,
        mockGetOrganizationUserinfo,
        () => mockOraSpinner
      )).rejects.toThrow('API Error');
    });

    it('should handle getOrganizationUserinfo throwing an exception', async () => {
      const paramsWithUserId = { 
        organizationId: 'org123', 
        userId: 'user456' 
      };
      const mockRoleList = [
        { key: 'admin', description: 'Administrator', isDefaultRole: false }
      ];
      
      const mockGetRoleList = vi.fn().mockResolvedValue(mockRoleList);
      const mockGetOrganizationUserinfo = vi.fn().mockRejectedValue(new Error('User API Error'));

      await expect(handleRoleParameter(
        mockParam,
        paramsWithUserId,
        mockGetRoleList,
        mockGetOrganizationUserinfo,
        () => mockOraSpinner
      )).rejects.toThrow('User API Error');
    });
  });

  describe('Auto-fill Logic', () => {
    it('should set defaultValue array for auto-fill when autoFillForInteractiveMode is true', async () => {
      const paramWithAutoFill = { 
        name: 'role', 
        autoFillForInteractiveMode: true 
      };
      const mockRoleList = [
        { key: 'admin', description: 'Administrator', isDefaultRole: false },
        { key: 'developer', description: 'Developer', isDefaultRole: true },
        { key: 'viewer', description: 'Viewer', isDefaultRole: false },
        { key: 'contributor', description: 'Contributor', isDefaultRole: true }
      ];
      const mockGetRoleList = vi.fn().mockResolvedValue(mockRoleList);
      const mockGetOrganizationUserinfo = vi.fn();

      await handleRoleParameter(
        paramWithAutoFill,
        mockParams,
        mockGetRoleList,
        mockGetOrganizationUserinfo,
        () => mockOraSpinner
      );

      expect(paramWithAutoFill.defaultValue).toEqual([1, 3]); // Indices of default roles
    });

    it('should not set defaultValue when autoFillForInteractiveMode is false', async () => {
      const paramWithoutAutoFill = { 
        name: 'role', 
        autoFillForInteractiveMode: false 
      };
      const mockRoleList = [
        { key: 'developer', description: 'Developer', isDefaultRole: true }
      ];
      const mockGetRoleList = vi.fn().mockResolvedValue(mockRoleList);
      const mockGetOrganizationUserinfo = vi.fn();

      await handleRoleParameter(
        paramWithoutAutoFill,
        mockParams,
        mockGetRoleList,
        mockGetOrganizationUserinfo,
        () => mockOraSpinner
      );

      expect(paramWithoutAutoFill.defaultValue).toBeUndefined();
    });

    it('should handle empty defaultValue array when no default roles exist', async () => {
      const paramWithAutoFill = { 
        name: 'role', 
        autoFillForInteractiveMode: true 
      };
      const mockRoleList = [
        { key: 'admin', description: 'Administrator', isDefaultRole: false },
        { key: 'viewer', description: 'Viewer', isDefaultRole: false }
      ];
      const mockGetRoleList = vi.fn().mockResolvedValue(mockRoleList);
      const mockGetOrganizationUserinfo = vi.fn();

      await handleRoleParameter(
        paramWithAutoFill,
        mockParams,
        mockGetRoleList,
        mockGetOrganizationUserinfo,
        () => mockOraSpinner
      );

      expect(paramWithAutoFill.defaultValue).toEqual([]);
    });
  });

  describe('User-based Role Filtering', () => {
    it('should filter to user roles when param.from is "user"', async () => {
      const paramFromUser = { 
        name: 'role', 
        from: 'user' 
      };
      const paramsWithUserId = { 
        organizationId: 'org123', 
        userId: 'user456' 
      };
      const mockRoleList = [
        { key: 'admin', description: 'Administrator', isDefaultRole: false },
        { key: 'developer', description: 'Developer', isDefaultRole: false },
        { key: 'viewer', description: 'Viewer', isDefaultRole: false }
      ];
      const mockUserInfo = { roles: ['developer', 'viewer'] };
      
      const mockGetRoleList = vi.fn().mockResolvedValue(mockRoleList);
      const mockGetOrganizationUserinfo = vi.fn().mockResolvedValue(mockUserInfo);

      const result = await handleRoleParameter(
        paramFromUser,
        paramsWithUserId,
        mockGetRoleList,
        mockGetOrganizationUserinfo,
        () => mockOraSpinner
      );

      expect(result).toEqual({});
      expect(paramFromUser.params).toEqual([
        { name: 'developer', message: 'Developer' },
        { name: 'viewer', message: 'Viewer' }
      ]);
    });

    it('should return error when user has no matching roles and param.from is "user"', async () => {
      const paramFromUser = { 
        name: 'role', 
        from: 'user' 
      };
      const paramsWithUserId = { 
        organizationId: 'org123', 
        userId: 'user456' 
      };
      const mockRoleList = [
        { key: 'admin', description: 'Administrator', isDefaultRole: false }
      ];
      const mockUserInfo = { roles: ['viewer'] }; // User doesn't have admin role
      
      const mockGetRoleList = vi.fn().mockResolvedValue(mockRoleList);
      const mockGetOrganizationUserinfo = vi.fn().mockResolvedValue(mockUserInfo);

      const result = await handleRoleParameter(
        paramFromUser,
        paramsWithUserId,
        mockGetRoleList,
        mockGetOrganizationUserinfo,
        () => mockOraSpinner
      );

      expect(result).toEqual({ isError: true });
      expect(mockOraSpinner.text).toBe('No roles for this user.');
      expect(mockOraSpinner.fail).toHaveBeenCalledTimes(1);
    });

    it('should filter out user existing roles when param.required is not false', async () => {
      const paramRequired = { 
        name: 'role', 
        required: true 
      };
      const paramsWithUserId = { 
        organizationId: 'org123', 
        userId: 'user456' 
      };
      const mockRoleList = [
        { key: 'admin', description: 'Administrator', isDefaultRole: false },
        { key: 'developer', description: 'Developer', isDefaultRole: false },
        { key: 'viewer', description: 'Viewer', isDefaultRole: false }
      ];
      const mockUserInfo = { roles: ['viewer'] }; // User already has viewer role
      
      const mockGetRoleList = vi.fn().mockResolvedValue(mockRoleList);
      const mockGetOrganizationUserinfo = vi.fn().mockResolvedValue(mockUserInfo);

      const result = await handleRoleParameter(
        paramRequired,
        paramsWithUserId,
        mockGetRoleList,
        mockGetOrganizationUserinfo,
        () => mockOraSpinner
      );

      expect(result).toEqual({});
      expect(paramRequired.params).toEqual([
        { name: 'admin', message: 'Administrator' },
        { name: 'developer', message: 'Developer' }
        // viewer role should be filtered out
      ]);
    });

    it('should show only owner role when user is owner and param.required is not false', async () => {
      const paramRequired = { 
        name: 'role', 
        required: true 
      };
      const paramsWithUserId = { 
        organizationId: 'org123', 
        userId: 'user456' 
      };
      const mockRoleList = [
        { key: 'admin', description: 'Administrator', isDefaultRole: false },
        { key: 'developer', description: 'Developer', isDefaultRole: false },
        { key: 'owner', description: 'Owner', isDefaultRole: false }
      ];
      const mockUserInfo = { roles: ['owner', 'admin'] };
      
      const mockGetRoleList = vi.fn().mockResolvedValue(mockRoleList);
      const mockGetOrganizationUserinfo = vi.fn().mockResolvedValue(mockUserInfo);

      const result = await handleRoleParameter(
        paramRequired,
        paramsWithUserId,
        mockGetRoleList,
        mockGetOrganizationUserinfo,
        () => mockOraSpinner
      );

      expect(result).toEqual({});
      expect(paramRequired.params).toEqual([
        { name: 'owner', message: 'Owner' }
      ]);
    });

    it('should not filter roles when param.required is false', async () => {
      const paramOptional = { 
        name: 'role', 
        required: false 
      };
      const paramsWithUserId = { 
        organizationId: 'org123', 
        userId: 'user456' 
      };
      const mockRoleList = [
        { key: 'admin', description: 'Administrator', isDefaultRole: false },
        { key: 'viewer', description: 'Viewer', isDefaultRole: false }
      ];
      const mockUserInfo = { roles: ['viewer'] };
      
      const mockGetRoleList = vi.fn().mockResolvedValue(mockRoleList);
      const mockGetOrganizationUserinfo = vi.fn().mockResolvedValue(mockUserInfo);

      const result = await handleRoleParameter(
        paramOptional,
        paramsWithUserId,
        mockGetRoleList,
        mockGetOrganizationUserinfo,
        () => mockOraSpinner
      );

      expect(result).toEqual({});
      expect(paramOptional.params).toEqual([
        { name: 'admin', message: 'Administrator' },
        { name: 'viewer', message: 'Viewer' }
      ]);
    });
  });

  describe('Edge Cases and Integration', () => {
    it('should handle userinfo without roles property', async () => {
      const paramsWithUserId = { 
        organizationId: 'org123', 
        userId: 'user456' 
      };
      const mockRoleList = [
        { key: 'admin', description: 'Administrator', isDefaultRole: false }
      ];
      const mockUserInfo = {}; // No roles property
      
      const mockGetRoleList = vi.fn().mockResolvedValue(mockRoleList);
      const mockGetOrganizationUserinfo = vi.fn().mockResolvedValue(mockUserInfo);

      const result = await handleRoleParameter(
        mockParam,
        paramsWithUserId,
        mockGetRoleList,
        mockGetOrganizationUserinfo,
        () => mockOraSpinner
      );

      expect(result).toEqual({});
      expect(mockParam.params).toEqual([
        { name: 'admin', message: 'Administrator' }
      ]);
    });

    it('should handle null userinfo', async () => {
      const paramsWithUserId = { 
        organizationId: 'org123', 
        userId: 'user456' 
      };
      const mockRoleList = [
        { key: 'admin', description: 'Administrator', isDefaultRole: false }
      ];
      
      const mockGetRoleList = vi.fn().mockResolvedValue(mockRoleList);
      const mockGetOrganizationUserinfo = vi.fn().mockResolvedValue(null);

      const result = await handleRoleParameter(
        mockParam,
        paramsWithUserId,
        mockGetRoleList,
        mockGetOrganizationUserinfo,
        () => mockOraSpinner
      );

      expect(result).toEqual({});
      expect(mockParam.params).toEqual([
        { name: 'admin', message: 'Administrator' }
      ]);
    });

    it('should handle roles with missing or malformed data', async () => {
      const mockRoleList = [
        { key: 'admin', description: 'Administrator', isDefaultRole: false },
        { key: 'malformed' }, // Missing description and isDefaultRole
        { description: 'No Key Role', isDefaultRole: true }, // Missing key
        { key: 'valid', description: 'Valid Role', isDefaultRole: false }
      ];
      
      const mockGetRoleList = vi.fn().mockResolvedValue(mockRoleList);
      const mockGetOrganizationUserinfo = vi.fn();

      const result = await handleRoleParameter(
        mockParam,
        mockParams,
        mockGetRoleList,
        mockGetOrganizationUserinfo,
        () => mockOraSpinner
      );

      expect(result).toEqual({});
      // Should handle gracefully with undefined values
      expect(mockParam.params).toHaveLength(4);
      expect(mockParam.params[0]).toEqual({ name: 'admin', message: 'Administrator' });
      expect(mockParam.params[1]).toEqual({ name: 'malformed', message: undefined });
      expect(mockParam.params[2]).toEqual({ name: undefined, message: 'No Key Role' });
      expect(mockParam.params[3]).toEqual({ name: 'valid', message: 'Valid Role' });
    });

    it('should handle complex integration scenario with auto-fill and filtering', async () => {
      const complexParam = { 
        name: 'role', 
        autoFillForInteractiveMode: true,
        from: 'user'
      };
      const paramsWithUserId = { 
        organizationId: 'org123', 
        userId: 'user456' 
      };
      const mockRoleList = [
        { key: 'admin', description: 'Administrator', isDefaultRole: false },
        { key: 'developer', description: 'Developer', isDefaultRole: true },
        { key: 'viewer', description: 'Viewer', isDefaultRole: false },
        { key: 'contributor', description: 'Contributor', isDefaultRole: true }
      ];
      const mockUserInfo = { roles: ['developer', 'contributor'] };
      
      const mockGetRoleList = vi.fn().mockResolvedValue(mockRoleList);
      const mockGetOrganizationUserinfo = vi.fn().mockResolvedValue(mockUserInfo);

      const result = await handleRoleParameter(
        complexParam,
        paramsWithUserId,
        mockGetRoleList,
        mockGetOrganizationUserinfo,
        () => mockOraSpinner
      );

      expect(result).toEqual({});
      
      // Should have default values set
      expect(complexParam.defaultValue).toEqual([1, 3]);
      
      // Should be filtered to only user roles
      expect(complexParam.params).toEqual([
        { name: 'developer', message: 'Developer' },
        { name: 'contributor', message: 'Contributor' }
      ]);
    });
  });

  describe('Dependency Injection', () => {
    it('should use custom spinner when provided', async () => {
      const mockRoleList = [
        { key: 'admin', description: 'Administrator', isDefaultRole: false }
      ];
      
      const customSpinner = {
        start: vi.fn().mockReturnThis(),
        stop: vi.fn().mockReturnThis(),
        fail: vi.fn().mockReturnThis(),
        text: ''
      };
      const customSpinnerFactory = vi.fn(() => customSpinner);

      const mockGetRoleList = vi.fn().mockResolvedValue(mockRoleList);
      const mockGetOrganizationUserinfo = vi.fn();

      await handleRoleParameter(
        mockParam,
        mockParams,
        mockGetRoleList,
        mockGetOrganizationUserinfo,
        customSpinnerFactory
      );

      expect(customSpinnerFactory).toHaveBeenCalledWith('Listing Roles...');
      expect(customSpinner.start).toHaveBeenCalledTimes(1);
      expect(customSpinner.stop).toHaveBeenCalledTimes(1);
    });

    it('should work with minimal parameters', async () => {
      const mockRoleList = [
        { key: 'viewer', description: 'Viewer', isDefaultRole: false }
      ];
      
      const mockGetRoleList = vi.fn().mockResolvedValue(mockRoleList);
      const mockGetOrganizationUserinfo = vi.fn();

      const result = await handleRoleParameter(
        { name: 'role' },
        {},
        mockGetRoleList,
        mockGetOrganizationUserinfo
      );

      expect(result).toEqual({});
      expect(mockGetRoleList).toHaveBeenCalledTimes(1);
    });
  });

  describe('Async Error Handling', () => {
    it('should handle getRoleList timeout', async () => {
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Timeout')), 100);
      });
      const mockGetRoleList = vi.fn().mockReturnValue(timeoutPromise);
      const mockGetOrganizationUserinfo = vi.fn();

      await expect(handleRoleParameter(
        mockParam,
        mockParams,
        mockGetRoleList,
        mockGetOrganizationUserinfo,
        () => mockOraSpinner
      )).rejects.toThrow('Timeout');
    });

    it('should handle getOrganizationUserinfo timeout', async () => {
      const paramsWithUserId = { 
        organizationId: 'org123', 
        userId: 'user456' 
      };
      const mockRoleList = [
        { key: 'admin', description: 'Administrator', isDefaultRole: false }
      ];
      
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('User Timeout')), 100);
      });
      const mockGetRoleList = vi.fn().mockResolvedValue(mockRoleList);
      const mockGetOrganizationUserinfo = vi.fn().mockReturnValue(timeoutPromise);

      await expect(handleRoleParameter(
        mockParam,
        paramsWithUserId,
        mockGetRoleList,
        mockGetOrganizationUserinfo,
        () => mockOraSpinner
      )).rejects.toThrow('User Timeout');
    });

    it('should handle unexpected data format from APIs', async () => {
      // Role list with unexpected structure
      const malformedRoleData = [
        'string-role', // Not an object
        42, // Number instead of object
        null, // Null entry
        { key: 'valid', description: 'Valid Role', isDefaultRole: false }
      ];
      
      const mockGetRoleList = vi.fn().mockResolvedValue(malformedRoleData);
      const mockGetOrganizationUserinfo = vi.fn();

      const result = await handleRoleParameter(
        mockParam,
        mockParams,
        mockGetRoleList,
        mockGetOrganizationUserinfo,
        () => mockOraSpinner
      );

      // Should handle gracefully without crashing
      expect(result).toEqual({});
      expect(mockParam.params).toHaveLength(4);
    });
  });
});