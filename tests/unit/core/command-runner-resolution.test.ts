import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock dependencies
vi.mock('../../../src/core/ProgramError', () => ({
  ProgramError: class ProgramError extends Error {
    constructor(message: string) {
      super(message);
      this.name = 'ProgramError';
    }
  }
}));

vi.mock('../../../src/constant', () => ({
  CURRENT_PARAM_VALUE: 'current',
  UNKNOWN_PARAM_VALUE: 'unknown'
}));

// Mock service functions
vi.mock('../../../src/services', () => ({
  getOrganizations: vi.fn(),
  getUserInfo: vi.fn(),
  getOrganizationUsersWithRoles: vi.fn(),
  getBuildProfiles: vi.fn(),
  getBranches: vi.fn(),
  getWorkflows: vi.fn(),
  getConfigurations: vi.fn(),
  getEnvironmentVariableGroups: vi.fn(),
  getOrganizationUserinfo: vi.fn()
}));

// Mock utilities
vi.mock('../../../src/core/command-runner-utilities', () => ({
  resolveOrganizationIdFromParams: vi.fn(),
  resolveUserIdFromUserParam: vi.fn(),
  resolveProfileIdFromName: vi.fn(),
  resolveBranchIdFromName: vi.fn(),
  resolveWorkflowIdFromName: vi.fn(),
  resolveConfigurationIdFromName: vi.fn(),
  getUserRemovalIdentifier: vi.fn()
}));

import {
  resolveOrganizationId,
  resolveUserIdFromUserParamCmd,
  getUserRemovalIdentifierAsync,
  validateAndResolveBuildProfile,
  validateAndResolveBranch,
  validateAndResolveWorkflow,
  validateAndResolveConfiguration,
  validateAndResolveVariableGroup
} from '../../../src/core/command-runner';

import { ProgramError } from '../../../src/core/ProgramError';
import { CURRENT_PARAM_VALUE, UNKNOWN_PARAM_VALUE } from '../../../src/constant';
import * as services from '../../../src/services';
import * as utilities from '../../../src/core/command-runner-utilities';

describe('Command Runner Resolution Functions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('resolveOrganizationId', () => {
    it('should resolve organization from params and return ID', async () => {
      const mockOrganizations = [
        { id: 'org-123', name: 'Test Org' },
        { id: 'org-456', name: 'Another Org' }
      ];
      const mockUser = { currentOrganizationId: 'current-org-123' };
      
      (services.getOrganizations as any).mockResolvedValue(mockOrganizations);
      (services.getUserInfo as any).mockResolvedValue(mockUser);
      (utilities.resolveOrganizationIdFromParams as any).mockReturnValue({
        isValid: true,
        organizationId: 'org-123'
      });

      const params = { organization: 'Test Org' };
      const result = await resolveOrganizationId(params, services.getOrganizations, services.getUserInfo);

      expect(result).toBe('org-123');
      expect(params.organizationId).toBe('org-123');
      expect(utilities.resolveOrganizationIdFromParams).toHaveBeenCalledWith(
        params,
        mockOrganizations,
        mockUser
      );
    });

    it('should throw ProgramError when resolution fails', async () => {
      const mockOrganizations = [];
      const mockUser = { currentOrganizationId: 'current-org-123' };
      
      (services.getOrganizations as any).mockResolvedValue(mockOrganizations);
      (services.getUserInfo as any).mockResolvedValue(mockUser);
      (utilities.resolveOrganizationIdFromParams as any).mockReturnValue({
        isValid: false,
        error: 'Organization not found'
      });

      const params = { organization: 'Non-existent Org' };

      await expect(resolveOrganizationId(params, services.getOrganizations, services.getUserInfo))
        .rejects.toThrow(ProgramError);
      await expect(resolveOrganizationId(params, services.getOrganizations, services.getUserInfo))
        .rejects.toThrow('Organization not found');
    });

    it('should handle API errors gracefully', async () => {
      (services.getOrganizations as any).mockRejectedValue(new Error('API Error'));

      const params = { organization: 'Test Org' };

      await expect(resolveOrganizationId(params, services.getOrganizations, services.getUserInfo))
        .rejects.toThrow('API Error');
    });
  });

  describe('resolveUserIdFromUserParamCmd', () => {
    it('should resolve user ID when user param provided', async () => {
      const mockUsers = [
        { id: 'user-123', email: 'test@example.com', fullName: 'Test User' },
        { id: 'user-456', email: 'admin@example.com', fullName: 'Admin User' }
      ];

      (services.getOrganizationUsersWithRoles as any).mockResolvedValue(mockUsers);
      (utilities.resolveUserIdFromUserParam as any).mockReturnValue({
        isValid: true,
        userId: 'user-123'
      });

      const params = { user: 'test@example.com', organizationId: 'org-123' };
      const result = await resolveUserIdFromUserParamCmd(params, services.getOrganizationUsersWithRoles);

      expect(result).toBe('user-123');
      expect(params.userId).toBe('user-123');
      expect(utilities.resolveUserIdFromUserParam).toHaveBeenCalledWith(params, mockUsers);
    });

    it('should return existing userId when user param not provided', async () => {
      const params = { userId: 'existing-user-123', organizationId: 'org-123' };
      const result = await resolveUserIdFromUserParamCmd(params, services.getOrganizationUsersWithRoles);

      expect(result).toBe('existing-user-123');
      expect(services.getOrganizationUsersWithRoles).not.toHaveBeenCalled();
    });

    it('should throw error when user resolution fails', async () => {
      const mockUsers = [];
      
      (services.getOrganizationUsersWithRoles as any).mockResolvedValue(mockUsers);
      (utilities.resolveUserIdFromUserParam as any).mockReturnValue({
        isValid: false,
        error: 'User not found'
      });

      const params = { user: 'nonexistent@example.com', organizationId: 'org-123' };

      await expect(resolveUserIdFromUserParamCmd(params, services.getOrganizationUsersWithRoles))
        .rejects.toThrow(ProgramError);
    });
  });

  describe('getUserRemovalIdentifierAsync', () => {
    it('should fetch user info and return removal identifier', async () => {
      const mockUserInfo = { email: 'user@example.com' };
      (services.getOrganizationUserinfo as any).mockResolvedValue(mockUserInfo);
      (utilities.getUserRemovalIdentifier as any).mockReturnValue({
        removalIdentifier: 'user@example.com',
        itemType: 'User'
      });

      const params = { userId: 'user-123', organizationId: 'org-123' };
      const result = await getUserRemovalIdentifierAsync(params, services.getOrganizationUserinfo);

      expect(result.removalIdentifier).toBe('user@example.com');
      expect(result.itemType).toBe('User');
      expect(utilities.getUserRemovalIdentifier).toHaveBeenCalledWith(params, mockUserInfo);
    });

    it('should handle UNKNOWN_PARAM_VALUE without fetching user info', async () => {
      (utilities.getUserRemovalIdentifier as any).mockReturnValue({
        removalIdentifier: UNKNOWN_PARAM_VALUE,
        itemType: 'User'
      });

      const params = { userId: UNKNOWN_PARAM_VALUE, organizationId: 'org-123' };
      const result = await getUserRemovalIdentifierAsync(params, services.getOrganizationUserinfo);

      expect(result.removalIdentifier).toBe(UNKNOWN_PARAM_VALUE);
      expect(services.getOrganizationUserinfo).not.toHaveBeenCalled();
    });

    it('should handle user info fetch failure gracefully', async () => {
      (services.getOrganizationUserinfo as any).mockRejectedValue(new Error('User not found'));
      (utilities.getUserRemovalIdentifier as any).mockReturnValue({
        removalIdentifier: 'user-123',
        itemType: 'User'
      });

      const params = { userId: 'user-123', organizationId: 'org-123' };
      const result = await getUserRemovalIdentifierAsync(params, services.getOrganizationUserinfo);

      expect(result.removalIdentifier).toBe('user-123');
      expect(utilities.getUserRemovalIdentifier).toHaveBeenCalledWith(params, undefined);
    });
  });

  describe('validateAndResolveBuildProfile', () => {
    it('should resolve profile name to ID', async () => {
      const mockProfiles = [
        { id: 'profile-123', name: 'iOS Build Profile' },
        { id: 'profile-456', name: 'Android Build Profile' }
      ];

      (services.getBuildProfiles as any).mockResolvedValue(mockProfiles);
      (utilities.resolveProfileIdFromName as any).mockReturnValue({
        isValid: true,
        profileId: 'profile-123'
      });

      const params = { profile: 'iOS Build Profile' };
      const result = await validateAndResolveBuildProfile(params, services.getBuildProfiles);

      expect(result).toBe('profile-123');
      expect(params.profileId).toBe('profile-123');
    });

    it('should return existing profileId when profile name not provided', async () => {
      const params = { profileId: 'existing-profile-123' };
      const result = await validateAndResolveBuildProfile(params, services.getBuildProfiles);

      expect(result).toBe('existing-profile-123');
      expect(services.getBuildProfiles).not.toHaveBeenCalled();
    });

    it('should throw error when profile not found', async () => {
      const mockProfiles = [];
      
      (services.getBuildProfiles as any).mockResolvedValue(mockProfiles);
      (utilities.resolveProfileIdFromName as any).mockReturnValue({
        isValid: false,
        error: 'Build profile not found'
      });

      const params = { profile: 'Non-existent Profile' };

      await expect(validateAndResolveBuildProfile(params, services.getBuildProfiles))
        .rejects.toThrow(ProgramError);
    });
  });

  describe('validateAndResolveBranch', () => {
    it('should resolve branch name to ID when profileId provided', async () => {
      const mockBranchesResponse = {
        branches: [
          { id: 'branch-123', name: 'main' },
          { id: 'branch-456', name: 'develop' }
        ]
      };

      (services.getBranches as any).mockResolvedValue(mockBranchesResponse);
      (utilities.resolveBranchIdFromName as any).mockReturnValue({
        isValid: true,
        branchId: 'branch-123'
      });

      const params = { branch: 'main', profileId: 'profile-123' };
      const result = await validateAndResolveBranch(params, services.getBranches);

      expect(result).toBe('branch-123');
      expect(params.branchId).toBe('branch-123');
      expect(services.getBranches).toHaveBeenCalledWith({ profileId: 'profile-123' });
    });

    it('should skip resolution when no profileId provided', async () => {
      const params = { branch: 'main' };
      const result = await validateAndResolveBranch(params, services.getBranches);

      expect(result).toBeUndefined();
      expect(services.getBranches).not.toHaveBeenCalled();
    });

    it('should return existing branchId', async () => {
      const params = { branchId: 'existing-branch-123', profileId: 'profile-123' };
      const result = await validateAndResolveBranch(params, services.getBranches);

      expect(result).toBe('existing-branch-123');
    });

    it('should handle empty branches array', async () => {
      const mockBranchesResponse = { branches: [] };

      (services.getBranches as any).mockResolvedValue(mockBranchesResponse);
      (utilities.resolveBranchIdFromName as any).mockReturnValue({
        isValid: false,
        error: 'Branch not found'
      });

      const params = { branch: 'non-existent', profileId: 'profile-123' };

      await expect(validateAndResolveBranch(params, services.getBranches))
        .rejects.toThrow(ProgramError);
    });

    it('should handle null branches in response', async () => {
      const mockBranchesResponse = { branches: null };

      (services.getBranches as any).mockResolvedValue(mockBranchesResponse);
      (utilities.resolveBranchIdFromName as any).mockReturnValue({
        isValid: false,
        error: 'No branches found'
      });

      const params = { branch: 'main', profileId: 'profile-123' };

      await expect(validateAndResolveBranch(params, services.getBranches))
        .rejects.toThrow(ProgramError);
    });
  });

  describe('validateAndResolveWorkflow', () => {
    it('should resolve workflow name to ID', async () => {
      const mockWorkflows = [
        { id: 'workflow-123', workflowName: 'Build iOS' },
        { id: 'workflow-456', workflowName: 'Build Android' }
      ];

      (services.getWorkflows as any).mockResolvedValue(mockWorkflows);
      (utilities.resolveWorkflowIdFromName as any).mockReturnValue({
        isValid: true,
        workflowId: 'workflow-123'
      });

      const params = { workflow: 'Build iOS', profileId: 'profile-123' };
      const result = await validateAndResolveWorkflow(params, services.getWorkflows);

      expect(result).toBe('workflow-123');
      expect(params.workflowId).toBe('workflow-123');
    });

    it('should skip resolution when no profileId provided', async () => {
      const params = { workflow: 'Build iOS' };
      const result = await validateAndResolveWorkflow(params, services.getWorkflows);

      expect(result).toBeUndefined();
      expect(services.getWorkflows).not.toHaveBeenCalled();
    });

    it('should throw error when workflow not found', async () => {
      const mockWorkflows = [];

      (services.getWorkflows as any).mockResolvedValue(mockWorkflows);
      (utilities.resolveWorkflowIdFromName as any).mockReturnValue({
        isValid: false,
        error: 'Workflow not found'
      });

      const params = { workflow: 'Non-existent Workflow', profileId: 'profile-123' };

      await expect(validateAndResolveWorkflow(params, services.getWorkflows))
        .rejects.toThrow(ProgramError);
    });
  });

  describe('validateAndResolveConfiguration', () => {
    it('should resolve configuration name to ID', async () => {
      const mockConfigurations = [
        { item1: { id: 'config-123', configurationName: 'Debug' } },
        { item1: { id: 'config-456', configurationName: 'Release' } }
      ];

      (services.getConfigurations as any).mockResolvedValue(mockConfigurations);
      (utilities.resolveConfigurationIdFromName as any).mockReturnValue({
        isValid: true,
        configurationId: 'config-123'
      });

      const params = { configuration: 'Debug', profileId: 'profile-123' };
      const result = await validateAndResolveConfiguration(params, services.getConfigurations);

      expect(result).toBe('config-123');
      expect(params.configurationId).toBe('config-123');
    });

    it('should skip resolution when no profileId provided', async () => {
      const params = { configuration: 'Debug' };
      const result = await validateAndResolveConfiguration(params, services.getConfigurations);

      expect(result).toBeUndefined();
      expect(services.getConfigurations).not.toHaveBeenCalled();
    });

    it('should return existing configurationId', async () => {
      const params = { configurationId: 'existing-config-123', profileId: 'profile-123' };
      const result = await validateAndResolveConfiguration(params, services.getConfigurations);

      expect(result).toBe('existing-config-123');
    });

    it('should throw error when configuration not found', async () => {
      const mockConfigurations = [];

      (services.getConfigurations as any).mockResolvedValue(mockConfigurations);
      (utilities.resolveConfigurationIdFromName as any).mockReturnValue({
        isValid: false,
        error: 'Configuration not found'
      });

      const params = { configuration: 'Non-existent Config', profileId: 'profile-123' };

      await expect(validateAndResolveConfiguration(params, services.getConfigurations))
        .rejects.toThrow(ProgramError);
    });
  });

  describe('validateAndResolveVariableGroup', () => {
    it('should resolve variable group name to ID', async () => {
      const mockGroups = [
        { id: 'group-123', name: 'Production Variables' },
        { id: 'group-456', name: 'Staging Variables' }
      ];

      (services.getEnvironmentVariableGroups as any).mockResolvedValue(mockGroups);

      const params = { variableGroup: 'Production Variables' };
      const result = await validateAndResolveVariableGroup(params, services.getEnvironmentVariableGroups);

      expect(result).toBe('group-123');
      expect(params.variableGroupId).toBe('group-123');
    });

    it('should return existing variableGroupId', async () => {
      const params = { variableGroupId: 'existing-group-123' };
      const result = await validateAndResolveVariableGroup(params, services.getEnvironmentVariableGroups);

      expect(result).toBe('existing-group-123');
      expect(services.getEnvironmentVariableGroups).not.toHaveBeenCalled();
    });

    it('should throw error when variable group not found', async () => {
      const mockGroups = [
        { id: 'group-123', name: 'Production Variables' }
      ];

      (services.getEnvironmentVariableGroups as any).mockResolvedValue(mockGroups);

      const params = { variableGroup: 'Non-existent Group' };

      await expect(validateAndResolveVariableGroup(params, services.getEnvironmentVariableGroups))
        .rejects.toThrow(ProgramError);
      await expect(validateAndResolveVariableGroup(params, services.getEnvironmentVariableGroups))
        .rejects.toThrow('Variable group "Non-existent Group" not found.');
    });

    it('should handle empty variable groups array', async () => {
      (services.getEnvironmentVariableGroups as any).mockResolvedValue([]);

      const params = { variableGroup: 'Any Group' };

      await expect(validateAndResolveVariableGroup(params, services.getEnvironmentVariableGroups))
        .rejects.toThrow(ProgramError);
    });

    it('should format available groups in error message', async () => {
      const mockGroups = [
        { id: 'group-123', name: 'Production Variables' },
        { id: 'group-456', name: 'Staging Variables' }
      ];

      (services.getEnvironmentVariableGroups as any).mockResolvedValue(mockGroups);

      const params = { variableGroup: 'Non-existent Group' };

      try {
        await validateAndResolveVariableGroup(params, services.getEnvironmentVariableGroups);
      } catch (error: any) {
        expect(error.message).toContain('Available variable groups:');
        expect(error.message).toContain('- Production Variables');
        expect(error.message).toContain('- Staging Variables');
      }
    });
  });
});