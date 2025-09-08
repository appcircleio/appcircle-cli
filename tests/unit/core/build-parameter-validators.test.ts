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

import { 
  validateAndResolveBuildProfile,
  validateAndResolveBranch,
  validateAndResolveWorkflow,
  validateAndResolveConfiguration,
  validateAndResolveVariableGroup
} from '../../../src/core/command-runner';
import { ProgramError } from '../../../src/core/ProgramError';

describe('Build Parameter Validators', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('validateAndResolveBuildProfile', () => {
    it('should resolve build profile by name when profile param is provided', async () => {
      const params = { profile: 'iOS Build', profileId: undefined };
      const mockBuildProfiles = [
        { id: 'profile-123', name: 'iOS Build' },
        { id: 'profile-456', name: 'Android Build' }
      ];
      const mockGetBuildProfiles = vi.fn().mockResolvedValue(mockBuildProfiles);

      const result = await validateAndResolveBuildProfile(params, mockGetBuildProfiles);

      expect(result).toBe('profile-123');
      expect(params.profileId).toBe('profile-123');
      expect(mockGetBuildProfiles).toHaveBeenCalledTimes(1);
    });

    it('should return existing profileId when already set', async () => {
      const params = { profile: 'iOS Build', profileId: 'existing-profile-123' };
      const mockGetBuildProfiles = vi.fn();

      const result = await validateAndResolveBuildProfile(params, mockGetBuildProfiles);

      expect(result).toBe('existing-profile-123');
      expect(mockGetBuildProfiles).not.toHaveBeenCalled();
    });

    it('should return undefined when no profile param provided', async () => {
      const params = {};
      const mockGetBuildProfiles = vi.fn();

      const result = await validateAndResolveBuildProfile(params, mockGetBuildProfiles);

      expect(result).toBeUndefined();
      expect(mockGetBuildProfiles).not.toHaveBeenCalled();
    });

    it('should throw ProgramError when profile not found', async () => {
      const params = { profile: 'NonExistent Profile' };
      const mockBuildProfiles = [
        { id: 'profile-123', name: 'iOS Build' },
        { id: 'profile-456', name: 'Android Build' }
      ];
      const mockGetBuildProfiles = vi.fn().mockResolvedValue(mockBuildProfiles);

      await expect(async () => {
        await validateAndResolveBuildProfile(params, mockGetBuildProfiles);
      }).rejects.toThrow(ProgramError);

      await expect(async () => {
        await validateAndResolveBuildProfile(params, mockGetBuildProfiles);
      }).rejects.toThrow('Build profile "NonExistent Profile" not found.');
    });

    it('should include available profiles in error message', async () => {
      const params = { profile: 'Missing Profile' };
      const mockBuildProfiles = [
        { id: 'profile-1', name: 'Profile One' },
        { id: 'profile-2', name: 'Profile Two' }
      ];
      const mockGetBuildProfiles = vi.fn().mockResolvedValue(mockBuildProfiles);

      try {
        await validateAndResolveBuildProfile(params, mockGetBuildProfiles);
      } catch (error: any) {
        expect(error.message).toContain('Available build profiles:');
        expect(error.message).toContain('- Profile One');
        expect(error.message).toContain('- Profile Two');
      }
    });

    it('should handle empty build profiles list', async () => {
      const params = { profile: 'Any Profile' };
      const mockBuildProfiles: any[] = [];
      const mockGetBuildProfiles = vi.fn().mockResolvedValue(mockBuildProfiles);

      await expect(async () => {
        await validateAndResolveBuildProfile(params, mockGetBuildProfiles);
      }).rejects.toThrow('Build profile "Any Profile" not found.');
    });
  });

  describe('validateAndResolveBranch', () => {
    it('should resolve branch by name when branch param is provided and profileId exists', async () => {
      const params = { branch: 'main', branchId: undefined, profileId: 'profile-123' };
      const mockBranchesResponse = {
        branches: [
          { id: 'branch-123', name: 'main' },
          { id: 'branch-456', name: 'develop' }
        ]
      };
      const mockGetBranches = vi.fn().mockResolvedValue(mockBranchesResponse);

      const result = await validateAndResolveBranch(params, mockGetBranches);

      expect(result).toBe('branch-123');
      expect(params.branchId).toBe('branch-123');
      expect(mockGetBranches).toHaveBeenCalledWith({ profileId: 'profile-123' });
    });

    it('should not resolve branch when profileId is missing', async () => {
      const params = { branch: 'main' };
      const mockGetBranches = vi.fn();

      const result = await validateAndResolveBranch(params, mockGetBranches);

      expect(result).toBeUndefined();
      expect(mockGetBranches).not.toHaveBeenCalled();
    });

    it('should return existing branchId when already set', async () => {
      const params = { branch: 'main', branchId: 'existing-branch-123', profileId: 'profile-123' };
      const mockGetBranches = vi.fn();

      const result = await validateAndResolveBranch(params, mockGetBranches);

      expect(result).toBe('existing-branch-123');
      expect(mockGetBranches).not.toHaveBeenCalled();
    });

    it('should throw ProgramError when branch not found', async () => {
      const params = { branch: 'nonexistent', profileId: 'profile-123' };
      const mockBranchesResponse = {
        branches: [
          { id: 'branch-123', name: 'main' },
          { id: 'branch-456', name: 'develop' }
        ]
      };
      const mockGetBranches = vi.fn().mockResolvedValue(mockBranchesResponse);

      await expect(async () => {
        await validateAndResolveBranch(params, mockGetBranches);
      }).rejects.toThrow(ProgramError);

      await expect(async () => {
        await validateAndResolveBranch(params, mockGetBranches);
      }).rejects.toThrow('Branch "nonexistent" not found for build profile.');
    });

    it('should handle empty branches list', async () => {
      const params = { branch: 'main', profileId: 'profile-123' };
      const mockBranchesResponse = { branches: [] };
      const mockGetBranches = vi.fn().mockResolvedValue(mockBranchesResponse);

      try {
        await validateAndResolveBranch(params, mockGetBranches);
      } catch (error: any) {
        expect(error.message).toContain('No branches found');
      }
    });

    it('should handle null branches response', async () => {
      const params = { branch: 'main', profileId: 'profile-123' };
      const mockBranchesResponse = { branches: null };
      const mockGetBranches = vi.fn().mockResolvedValue(mockBranchesResponse);

      try {
        await validateAndResolveBranch(params, mockGetBranches);
      } catch (error: any) {
        expect(error.message).toContain('No branches found');
      }
    });
  });

  describe('validateAndResolveWorkflow', () => {
    it('should resolve workflow by name when workflow param is provided and profileId exists', async () => {
      const params = { workflow: 'Build iOS', workflowId: undefined, profileId: 'profile-123' };
      const mockWorkflows = [
        { id: 'workflow-123', workflowName: 'Build iOS' },
        { id: 'workflow-456', workflowName: 'Build Android' }
      ];
      const mockGetWorkflows = vi.fn().mockResolvedValue(mockWorkflows);

      const result = await validateAndResolveWorkflow(params, mockGetWorkflows);

      expect(result).toBe('workflow-123');
      expect(params.workflowId).toBe('workflow-123');
      expect(mockGetWorkflows).toHaveBeenCalledWith({ profileId: 'profile-123' });
    });

    it('should not resolve workflow when profileId is missing', async () => {
      const params = { workflow: 'Build iOS' };
      const mockGetWorkflows = vi.fn();

      const result = await validateAndResolveWorkflow(params, mockGetWorkflows);

      expect(result).toBeUndefined();
      expect(mockGetWorkflows).not.toHaveBeenCalled();
    });

    it('should throw ProgramError when workflow not found', async () => {
      const params = { workflow: 'NonExistent Workflow', profileId: 'profile-123' };
      const mockWorkflows = [
        { id: 'workflow-123', workflowName: 'Build iOS' }
      ];
      const mockGetWorkflows = vi.fn().mockResolvedValue(mockWorkflows);

      await expect(async () => {
        await validateAndResolveWorkflow(params, mockGetWorkflows);
      }).rejects.toThrow('Workflow "NonExistent Workflow" not found for build profile.');
    });

    it('should include available workflows in error message', async () => {
      const params = { workflow: 'Missing', profileId: 'profile-123' };
      const mockWorkflows = [
        { id: 'workflow-1', workflowName: 'Workflow One' },
        { id: 'workflow-2', workflowName: 'Workflow Two' }
      ];
      const mockGetWorkflows = vi.fn().mockResolvedValue(mockWorkflows);

      try {
        await validateAndResolveWorkflow(params, mockGetWorkflows);
      } catch (error: any) {
        expect(error.message).toContain('Available workflows:');
        expect(error.message).toContain('- Workflow One');
        expect(error.message).toContain('- Workflow Two');
      }
    });
  });

  describe('validateAndResolveConfiguration', () => {
    it('should resolve configuration by name when configuration param is provided and profileId exists', async () => {
      const params = { configuration: 'Release', configurationId: undefined, profileId: 'profile-123' };
      const mockConfigurations = [
        { item1: { id: 'config-123', configurationName: 'Release' } },
        { item1: { id: 'config-456', configurationName: 'Debug' } }
      ];
      const mockGetConfigurations = vi.fn().mockResolvedValue(mockConfigurations);

      const result = await validateAndResolveConfiguration(params, mockGetConfigurations);

      expect(result).toBe('config-123');
      expect(params.configurationId).toBe('config-123');
      expect(mockGetConfigurations).toHaveBeenCalledWith({ profileId: 'profile-123' });
    });

    it('should not resolve configuration when profileId is missing', async () => {
      const params = { configuration: 'Release' };
      const mockGetConfigurations = vi.fn();

      const result = await validateAndResolveConfiguration(params, mockGetConfigurations);

      expect(result).toBeUndefined();
      expect(mockGetConfigurations).not.toHaveBeenCalled();
    });

    it('should throw ProgramError when configuration not found', async () => {
      const params = { configuration: 'NonExistent', profileId: 'profile-123' };
      const mockConfigurations = [
        { item1: { id: 'config-123', configurationName: 'Release' } }
      ];
      const mockGetConfigurations = vi.fn().mockResolvedValue(mockConfigurations);

      await expect(async () => {
        await validateAndResolveConfiguration(params, mockGetConfigurations);
      }).rejects.toThrow('Configuration "NonExistent" not found for build profile.');
    });

    it('should handle configurations with null item1', async () => {
      const params = { configuration: 'Release', profileId: 'profile-123' };
      const mockConfigurations = [
        { item1: null },
        { item1: { id: 'config-123', configurationName: 'Release' } }
      ];
      const mockGetConfigurations = vi.fn().mockResolvedValue(mockConfigurations);

      const result = await validateAndResolveConfiguration(params, mockGetConfigurations);

      expect(result).toBe('config-123');
    });

    it('should handle configurations with missing configurationName', async () => {
      const params = { configuration: 'Missing', profileId: 'profile-123' };
      const mockConfigurations = [
        { item1: { id: 'config-1' } }, // No configurationName
        { item1: { id: 'config-2', configurationName: null } }
      ];
      const mockGetConfigurations = vi.fn().mockResolvedValue(mockConfigurations);

      try {
        await validateAndResolveConfiguration(params, mockGetConfigurations);
      } catch (error: any) {
        expect(error.message).toContain('- Unknown');
      }
    });
  });

  describe('validateAndResolveVariableGroup', () => {
    it('should resolve variable group by name when variableGroup param is provided', async () => {
      const params = { variableGroup: 'Production Vars', variableGroupId: undefined };
      const mockVariableGroups = [
        { id: 'group-123', name: 'Production Vars' },
        { id: 'group-456', name: 'Development Vars' }
      ];
      const mockGetEnvironmentVariableGroups = vi.fn().mockResolvedValue(mockVariableGroups);

      const result = await validateAndResolveVariableGroup(params, mockGetEnvironmentVariableGroups);

      expect(result).toBe('group-123');
      expect(params.variableGroupId).toBe('group-123');
      expect(mockGetEnvironmentVariableGroups).toHaveBeenCalledTimes(1);
    });

    it('should return existing variableGroupId when already set', async () => {
      const params = { variableGroup: 'Production Vars', variableGroupId: 'existing-group-123' };
      const mockGetEnvironmentVariableGroups = vi.fn();

      const result = await validateAndResolveVariableGroup(params, mockGetEnvironmentVariableGroups);

      expect(result).toBe('existing-group-123');
      expect(mockGetEnvironmentVariableGroups).not.toHaveBeenCalled();
    });

    it('should throw ProgramError when variable group not found', async () => {
      const params = { variableGroup: 'NonExistent Group' };
      const mockVariableGroups = [
        { id: 'group-123', name: 'Production Vars' }
      ];
      const mockGetEnvironmentVariableGroups = vi.fn().mockResolvedValue(mockVariableGroups);

      await expect(async () => {
        await validateAndResolveVariableGroup(params, mockGetEnvironmentVariableGroups);
      }).rejects.toThrow('Variable group "NonExistent Group" not found.');
    });
  });

  describe('Error Handling', () => {
    it('should handle API errors gracefully', async () => {
      const params = { profile: 'Test Profile' };
      const mockGetBuildProfiles = vi.fn().mockRejectedValue(new Error('API Error'));

      await expect(async () => {
        await validateAndResolveBuildProfile(params, mockGetBuildProfiles);
      }).rejects.toThrow('API Error');
    });

    it('should handle network timeouts', async () => {
      const params = { workflow: 'Test Workflow', profileId: 'profile-123' };
      const mockGetWorkflows = vi.fn().mockRejectedValue(new Error('Network timeout'));

      await expect(async () => {
        await validateAndResolveWorkflow(params, mockGetWorkflows);
      }).rejects.toThrow('Network timeout');
    });

    it('should handle malformed API responses', async () => {
      const params = { branch: 'main', profileId: 'profile-123' };
      const mockGetBranches = vi.fn().mockResolvedValue(null);

      await expect(async () => {
        await validateAndResolveBranch(params, mockGetBranches);
      }).rejects.toThrow();
    });
  });

  describe('Integration Tests', () => {
    it('should work together for complete build parameter resolution', async () => {
      const params = { 
        profile: 'iOS App',
        branch: 'main',
        workflow: 'Build and Test',
        configuration: 'Release',
        variableGroup: 'Production'
      };

      // Mock all services
      const mockGetBuildProfiles = vi.fn().mockResolvedValue([
        { id: 'profile-123', name: 'iOS App' }
      ]);
      const mockGetBranches = vi.fn().mockResolvedValue({
        branches: [{ id: 'branch-456', name: 'main' }]
      });
      const mockGetWorkflows = vi.fn().mockResolvedValue([
        { id: 'workflow-789', workflowName: 'Build and Test' }
      ]);
      const mockGetConfigurations = vi.fn().mockResolvedValue([
        { item1: { id: 'config-101', configurationName: 'Release' } }
      ]);
      const mockGetEnvironmentVariableGroups = vi.fn().mockResolvedValue([
        { id: 'group-202', name: 'Production' }
      ]);

      // Resolve in sequence
      await validateAndResolveBuildProfile(params, mockGetBuildProfiles);
      await validateAndResolveBranch(params, mockGetBranches);
      await validateAndResolveWorkflow(params, mockGetWorkflows);
      await validateAndResolveConfiguration(params, mockGetConfigurations);
      await validateAndResolveVariableGroup(params, mockGetEnvironmentVariableGroups);

      expect(params.profileId).toBe('profile-123');
      expect(params.branchId).toBe('branch-456');
      expect(params.workflowId).toBe('workflow-789');
      expect(params.configurationId).toBe('config-101');
      expect(params.variableGroupId).toBe('group-202');
    });
  });

  describe('Edge Cases', () => {
    it('should handle very long parameter names', async () => {
      const longName = 'A'.repeat(1000);
      const params = { profile: longName };
      const mockBuildProfiles = [{ id: 'profile-long', name: longName }];
      const mockGetBuildProfiles = vi.fn().mockResolvedValue(mockBuildProfiles);

      const result = await validateAndResolveBuildProfile(params, mockGetBuildProfiles);

      expect(result).toBe('profile-long');
    });

    it('should handle special characters in parameter names', async () => {
      const params = { workflow: 'Build & Test (iOS)' };
      const mockWorkflows = [
        { id: 'workflow-special', workflowName: 'Build & Test (iOS)' }
      ];
      const mockGetWorkflows = vi.fn().mockResolvedValue(mockWorkflows);
      params.profileId = 'profile-123';

      const result = await validateAndResolveWorkflow(params, mockGetWorkflows);

      expect(result).toBe('workflow-special');
    });

    it('should handle unicode characters in parameter names', async () => {
      const params = { variableGroup: '环境变量组' };
      const mockVariableGroups = [
        { id: 'group-unicode', name: '环境变量组' }
      ];
      const mockGetEnvironmentVariableGroups = vi.fn().mockResolvedValue(mockVariableGroups);

      const result = await validateAndResolveVariableGroup(params, mockGetEnvironmentVariableGroups);

      expect(result).toBe('group-unicode');
    });
  });
});