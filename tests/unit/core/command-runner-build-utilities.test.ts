import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  validateBuildStartParameters,
  determineBuildWaitBehavior,
  processBuildResponseForImmediateReturn,
  validatePublishPlatform,
  validateFileSizeForUpload,
  generateArtifactFileName,
  decodeJwtToken,
  validateOrganizationId,
  checkIfUserAlreadyLoggedIn,
  checkIfUserIsLoggedIn,
  selectBuildExecutionMode,
  BuildExecutionMode
} from '../../../src/core/command-runner-utilities';

describe('Command Runner Build Utilities', () => {
  
  describe('validateBuildStartParameters', () => {
    const buildStartCommand = 'appcircle-build-start';
    
    it('should pass validation with all required parameters', () => {
      const params = {
        profileId: 'test-profile-123',
        workflowId: 'test-workflow-456'
      };
      
      const result = validateBuildStartParameters(params, buildStartCommand);
      
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
      expect(result.missingProfile).toBe(false);
      expect(result.missingWorkflow).toBe(false);
      expect(result.requiredParams).toHaveLength(0);
    });
    
    it('should accept profile name instead of profileId', () => {
      const params = {
        profile: 'My Test Profile',
        workflowId: 'test-workflow-456'
      };
      
      const result = validateBuildStartParameters(params, buildStartCommand);
      
      expect(result.isValid).toBe(true);
      expect(result.missingProfile).toBe(false);
    });
    
    it('should accept workflow name instead of workflowId', () => {
      const params = {
        profileId: 'test-profile-123',
        workflow: 'My Test Workflow'
      };
      
      const result = validateBuildStartParameters(params, buildStartCommand);
      
      expect(result.isValid).toBe(true);
      expect(result.missingWorkflow).toBe(false);
    });
    
    it('should fail validation when profile is missing', () => {
      const params = {
        workflowId: 'test-workflow-456'
      };
      
      const result = validateBuildStartParameters(params, buildStartCommand);
      
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Build profile is required. Use --profileId or --profile parameter.');
      expect(result.missingProfile).toBe(true);
      expect(result.requiredParams).toContain('profileId');
    });
    
    it('should fail validation when workflow is missing', () => {
      const params = {
        profileId: 'test-profile-123'
      };
      
      const result = validateBuildStartParameters(params, buildStartCommand);
      
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Workflow is required. Use --workflowId or --workflow parameter.');
      expect(result.missingWorkflow).toBe(true);
      expect(result.requiredParams).toContain('workflowId');
    });
    
    it('should fail validation when both profile and workflow are missing', () => {
      const params = {};
      
      const result = validateBuildStartParameters(params, buildStartCommand);
      
      expect(result.isValid).toBe(false);
      expect(result.errors).toHaveLength(2);
      expect(result.missingProfile).toBe(true);
      expect(result.missingWorkflow).toBe(true);
      expect(result.requiredParams).toEqual(['profileId', 'workflowId']);
    });
    
    it('should pass validation for non-build-start commands', () => {
      const params = {};
      const result = validateBuildStartParameters(params, 'appcircle-build-list');
      
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });
    
    it('should handle edge cases with empty strings and null values', () => {
      const params = {
        profileId: '',
        workflowId: null
      };
      
      const result = validateBuildStartParameters(params, buildStartCommand);
      
      expect(result.isValid).toBe(false);
      expect(result.missingProfile).toBe(true);
      expect(result.missingWorkflow).toBe(true);
    });
    
    it('should handle undefined values', () => {
      const params = {
        profileId: undefined,
        workflowId: undefined
      };
      
      const result = validateBuildStartParameters(params, buildStartCommand);
      
      expect(result.isValid).toBe(false);
      expect(result.missingProfile).toBe(true);
      expect(result.missingWorkflow).toBe(true);
    });
  });

  describe('determineBuildWaitBehavior', () => {
    it('should return shouldWait=true when --no-wait flag is not present', () => {
      const argv = ['node', 'script.js', '--profileId', 'test'];
      const result = determineBuildWaitBehavior(argv, 'plain');
      
      expect(result.shouldWait).toBe(true);
      expect(result.hasNoWaitFlag).toBe(false);
      expect(result.isJsonMode).toBe(false);
    });
    
    it('should return shouldWait=false when --no-wait flag is present', () => {
      const argv = ['node', 'script.js', '--no-wait', '--profileId', 'test'];
      const result = determineBuildWaitBehavior(argv, 'plain');
      
      expect(result.shouldWait).toBe(false);
      expect(result.hasNoWaitFlag).toBe(true);
      expect(result.isJsonMode).toBe(false);
    });
    
    it('should detect JSON mode correctly', () => {
      const argv = ['node', 'script.js'];
      const result = determineBuildWaitBehavior(argv, 'json');
      
      expect(result.isJsonMode).toBe(true);
    });
    
    it('should handle empty argv array', () => {
      const result = determineBuildWaitBehavior([], 'plain');
      
      expect(result.shouldWait).toBe(true);
      expect(result.hasNoWaitFlag).toBe(false);
    });
    
    it('should handle multiple --no-wait flags', () => {
      const argv = ['node', 'script.js', '--no-wait', '--profileId', 'test', '--no-wait'];
      const result = determineBuildWaitBehavior(argv, 'plain');
      
      expect(result.shouldWait).toBe(false);
      expect(result.hasNoWaitFlag).toBe(true);
    });
  });

  describe('processBuildResponseForImmediateReturn', () => {
    const mockResponseData = {
      taskId: 'task-123',
      queueItemId: 'queue-456'
    };
    
    it('should continue monitoring when shouldWait is true', () => {
      const result = processBuildResponseForImmediateReturn(
        mockResponseData,
        true,
        false
      );
      
      expect(result.shouldContinueMonitoring).toBe(true);
      expect(result.jsonOutput).toBeUndefined();
    });
    
    it('should return JSON output when shouldWait is false and in JSON mode', () => {
      const result = processBuildResponseForImmediateReturn(
        mockResponseData,
        false,
        true
      );
      
      expect(result.shouldContinueMonitoring).toBe(false);
      expect(result.jsonOutput).toEqual({
        taskId: 'task-123',
        queueItemId: 'queue-456'
      });
    });
    
    it('should not continue monitoring when shouldWait is false and not in JSON mode', () => {
      const result = processBuildResponseForImmediateReturn(
        mockResponseData,
        false,
        false
      );
      
      expect(result.shouldContinueMonitoring).toBe(false);
      expect(result.jsonOutput).toBeUndefined();
    });
    
    it('should handle missing response data', () => {
      const result = processBuildResponseForImmediateReturn(
        {},
        false,
        true
      );
      
      expect(result.shouldContinueMonitoring).toBe(false);
      expect(result.jsonOutput).toEqual({
        taskId: undefined,
        queueItemId: undefined
      });
    });
  });

  describe('validatePublishPlatform', () => {
    it('should pass for valid ios platform', () => {
      const result = validatePublishPlatform({ platform: 'ios' });
      
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
      expect(result.normalizedPlatform).toBe('ios');
    });
    
    it('should pass for valid android platform', () => {
      const result = validatePublishPlatform({ platform: 'android' });
      
      expect(result.isValid).toBe(true);
      expect(result.normalizedPlatform).toBe('android');
    });
    
    it('should pass for valid iOS platform (case insensitive)', () => {
      const result = validatePublishPlatform({ platform: 'iOS' });
      
      expect(result.isValid).toBe(true);
      expect(result.normalizedPlatform).toBe('ios');
    });
    
    it('should pass for valid Android platform (case insensitive)', () => {
      const result = validatePublishPlatform({ platform: 'Android' });
      
      expect(result.isValid).toBe(true);
      expect(result.normalizedPlatform).toBe('android');
    });
    
    it('should reject invalid platform', () => {
      const result = validatePublishPlatform({ platform: 'windows' });
      
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Invalid platform(windows). Supported platforms: ios, android');
    });
    
    it('should pass when platform is not provided', () => {
      const result = validatePublishPlatform({});
      
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });
    
    it('should handle null platform', () => {
      const result = validatePublishPlatform({ platform: null });
      
      expect(result.isValid).toBe(true);
    });
    
    it('should handle empty string platform', () => {
      const result = validatePublishPlatform({ platform: '' });
      
      expect(result.isValid).toBe(true);
    });
  });

  describe('validateFileSizeForUpload', () => {
    let mockFileSystem: any;
    
    beforeEach(() => {
      mockFileSystem = {
        statSync: vi.fn()
      };
    });
    
    it('should return valid result for file within size limit', () => {
      const mockStats = { size: 1024 * 1024 }; // 1MB
      mockFileSystem.statSync.mockReturnValue(mockStats);
      
      const result = validateFileSizeForUpload('/path/to/file.apk', 3 * 1024 * 1024 * 1024, mockFileSystem);
      
      expect(result.isValid).toBe(true);
      expect(result.stats).toEqual(mockStats);
      expect(result.maxBytes).toBe(3 * 1024 * 1024 * 1024);
    });
    
    it('should reject file exceeding size limit', () => {
      const mockStats = { size: 4 * 1024 * 1024 * 1024 }; // 4GB
      mockFileSystem.statSync.mockReturnValue(mockStats);
      
      const result = validateFileSizeForUpload('/path/to/largefile.apk', 3 * 1024 * 1024 * 1024, mockFileSystem);
      
      expect(result.isValid).toBe(false);
      expect(result.error).toContain('File size 4.00 GB exceeds the allowed limit of 3.00 GB.');
    });
    
    it('should handle no size limit (null maxBytes)', () => {
      const mockStats = { size: 5 * 1024 * 1024 * 1024 }; // 5GB
      mockFileSystem.statSync.mockReturnValue(mockStats);
      
      const result = validateFileSizeForUpload('/path/to/hugefile.apk', null, mockFileSystem);
      
      expect(result.isValid).toBe(true);
      expect(result.maxBytes).toBeNull();
    });
    
    it('should handle zero byte file', () => {
      const mockStats = { size: 0 };
      mockFileSystem.statSync.mockReturnValue(mockStats);
      
      const result = validateFileSizeForUpload('/path/to/emptyfile.apk', 3 * 1024 * 1024 * 1024, mockFileSystem);
      
      expect(result.isValid).toBe(true);
      expect(result.stats).toEqual(mockStats);
    });
    
    it('should handle exact size limit', () => {
      const mockStats = { size: 3 * 1024 * 1024 * 1024 }; // Exactly 3GB
      mockFileSystem.statSync.mockReturnValue(mockStats);
      
      const result = validateFileSizeForUpload('/path/to/exactfile.apk', 3 * 1024 * 1024 * 1024, mockFileSystem);
      
      expect(result.isValid).toBe(true);
    });
  });

  describe('generateArtifactFileName', () => {
    beforeEach(() => {
      vi.spyOn(Date, 'now').mockReturnValue(1640995200000); // Fixed timestamp
    });
    
    it('should generate filename with default prefix', () => {
      const result = generateArtifactFileName();
      
      expect(result).toBe('artifacts-1640995200000.zip');
    });
    
    it('should generate filename with custom prefix', () => {
      const result = generateArtifactFileName('my-app');
      
      expect(result).toBe('my-app-1640995200000.zip');
    });
    
    it('should handle empty prefix', () => {
      const result = generateArtifactFileName('');
      
      expect(result).toBe('-1640995200000.zip');
    });
    
    it('should handle special characters in prefix', () => {
      const result = generateArtifactFileName('my-app_v1.2.3');
      
      expect(result).toBe('my-app_v1.2.3-1640995200000.zip');
    });
    
    it('should handle null prefix', () => {
      const result = generateArtifactFileName(null as any);
      
      expect(result).toBe('null-1640995200000.zip');
    });
    
    it('should handle undefined prefix (uses default)', () => {
      const result = generateArtifactFileName(undefined);
      
      expect(result).toBe('artifacts-1640995200000.zip');
    });
  });

  describe('decodeJwtToken', () => {
    it('should decode valid JWT token', () => {
      const payload = { currentOrganizationId: 'org-123', user: 'test-user' };
      const encodedPayload = Buffer.from(JSON.stringify(payload)).toString('base64');
      const mockToken = `header.${encodedPayload}.signature`;
      
      const result = decodeJwtToken(mockToken);
      
      expect(result).toEqual(payload);
    });
    
    it('should return null for invalid JWT format', () => {
      const invalidToken = 'invalid.token';
      
      const result = decodeJwtToken(invalidToken);
      
      expect(result).toBeNull();
    });
    
    it('should return null for malformed base64', () => {
      const invalidToken = 'header.invalid-base64.signature';
      
      const result = decodeJwtToken(invalidToken);
      
      expect(result).toBeNull();
    });
    
    it('should return null for invalid JSON in payload', () => {
      const invalidJsonPayload = Buffer.from('invalid-json').toString('base64');
      const invalidToken = `header.${invalidJsonPayload}.signature`;
      
      const result = decodeJwtToken(invalidToken);
      
      expect(result).toBeNull();
    });
    
    it('should handle empty token', () => {
      const result = decodeJwtToken('');
      
      expect(result).toBeNull();
    });
    
    it('should handle null/undefined token', () => {
      expect(decodeJwtToken(null as any)).toBeNull();
      expect(decodeJwtToken(undefined as any)).toBeNull();
    });
    
    it('should handle token with no dots', () => {
      const result = decodeJwtToken('nodots');
      
      expect(result).toBeNull();
    });
    
    it('should handle token with too many parts', () => {
      const result = decodeJwtToken('part1.part2.part3.part4');
      
      expect(result).toBeNull();
    });
  });

  describe('validateOrganizationId', () => {
    let consoleSpy: any;
    
    beforeEach(() => {
      consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    });
    
    it('should return true when no organization-id provided', () => {
      const params = {};
      const responseData = { access_token: 'token' };
      
      const result = validateOrganizationId(params, responseData);
      
      expect(result).toBe(true);
    });
    
    it('should return true when no access_token provided', () => {
      const params = { 'organization-id': 'org-123' };
      const responseData = {};
      
      const result = validateOrganizationId(params, responseData);
      
      expect(result).toBe(true);
    });
    
    it('should return true when JWT decode fails', () => {
      const params = { 'organization-id': 'org-123' };
      const responseData = { access_token: 'invalid-jwt' };
      
      const result = validateOrganizationId(params, responseData);
      
      expect(result).toBe(true);
    });
    
    it('should return true when organization IDs match', () => {
      const organizationId = 'org-123';
      const payload = { currentOrganizationId: organizationId };
      const encodedPayload = Buffer.from(JSON.stringify(payload)).toString('base64');
      const mockToken = `header.${encodedPayload}.signature`;
      
      const params = { 'organization-id': organizationId };
      const responseData = { access_token: mockToken };
      
      const result = validateOrganizationId(params, responseData);
      
      expect(result).toBe(true);
    });
    
    it('should return false and log error when organization IDs do not match', () => {
      const requestedOrgId = 'org-123';
      const actualOrgId = 'org-456';
      const payload = { currentOrganizationId: actualOrgId };
      const encodedPayload = Buffer.from(JSON.stringify(payload)).toString('base64');
      const mockToken = `header.${encodedPayload}.signature`;
      
      const params = { 'organization-id': requestedOrgId };
      const responseData = { access_token: mockToken };
      
      const result = validateOrganizationId(params, responseData);
      
      expect(result).toBe(false);
      expect(consoleSpy).toHaveBeenCalledWith(
        `Login failed: Your API Key does not have access to organization "${requestedOrgId}".`
      );
    });
  });

  describe('checkIfUserAlreadyLoggedIn', () => {
    it('should return true when user has valid access token', () => {
      const mockConfigService = {
        has: vi.fn().mockReturnValue(true),
        get: vi.fn().mockReturnValue('valid-token')
      };
      
      const result = checkIfUserAlreadyLoggedIn(mockConfigService);
      
      expect(result).toBe(true);
      expect(mockConfigService.has).toHaveBeenCalledWith('AC_ACCESS_TOKEN');
      expect(mockConfigService.get).toHaveBeenCalledWith('AC_ACCESS_TOKEN');
    });
    
    it('should return false when access token does not exist', () => {
      const mockConfigService = {
        has: vi.fn().mockReturnValue(false),
        get: vi.fn().mockReturnValue(null)
      };
      
      const result = checkIfUserAlreadyLoggedIn(mockConfigService);
      
      expect(result).toBe(false);
      expect(mockConfigService.has).toHaveBeenCalledWith('AC_ACCESS_TOKEN');
    });
    
    it('should return false when access token exists but is empty', () => {
      const mockConfigService = {
        has: vi.fn().mockReturnValue(true),
        get: vi.fn().mockReturnValue('')
      };
      
      const result = checkIfUserAlreadyLoggedIn(mockConfigService);
      
      expect(result).toBe(false);
    });
    
    it('should return false when access token exists but is null', () => {
      const mockConfigService = {
        has: vi.fn().mockReturnValue(true),
        get: vi.fn().mockReturnValue(null)
      };
      
      const result = checkIfUserAlreadyLoggedIn(mockConfigService);
      
      expect(result).toBe(false);
    });
  });

  describe('checkIfUserIsLoggedIn', () => {
    it('should return true when user has valid access token', () => {
      const mockConfigService = {
        has: vi.fn().mockReturnValue(true),
        get: vi.fn().mockReturnValue('valid-token')
      };
      
      const result = checkIfUserIsLoggedIn(mockConfigService);
      
      expect(result).toBe(true);
    });
    
    it('should return false when user is not logged in', () => {
      const mockConfigService = {
        has: vi.fn().mockReturnValue(false),
        get: vi.fn().mockReturnValue(null)
      };
      
      const result = checkIfUserIsLoggedIn(mockConfigService);
      
      expect(result).toBe(false);
    });
  });

  describe('selectBuildExecutionMode', () => {
    let mockPrompt: any;

    beforeEach(() => {
      mockPrompt = {
        run: vi.fn()
      };
    });

    it('should return NORMAL mode when user selects Summary only', async () => {
      mockPrompt.run.mockResolvedValue('Summary only - Real-time build status and duration');
      
      const result = await selectBuildExecutionMode(() => mockPrompt);
      
      expect(result.mode).toBe(BuildExecutionMode.NORMAL);
      expect(result.cancelled).toBe(false);
    });

    it('should return STEP_SUMMARY mode when user selects Step-by-step', async () => {
      mockPrompt.run.mockResolvedValue('Step-by-step - Real-time progress for each build step');
      
      const result = await selectBuildExecutionMode(() => mockPrompt);
      
      expect(result.mode).toBe(BuildExecutionMode.STEP_SUMMARY);
      expect(result.cancelled).toBe(false);
    });

    it('should return DETAILED_MONITORING mode when user selects Full logs', async () => {
      mockPrompt.run.mockResolvedValue('Full logs - Real-time verbose build output streaming');
      
      const result = await selectBuildExecutionMode(() => mockPrompt);
      
      expect(result.mode).toBe(BuildExecutionMode.DETAILED_MONITORING);
      expect(result.cancelled).toBe(false);
    });

    it('should return SKIP_SHOW_TASK_ID mode when user selects Task ID only', async () => {
      mockPrompt.run.mockResolvedValue('Task ID only - No monitoring, returns task ID for async tracking');
      
      const result = await selectBuildExecutionMode(() => mockPrompt);
      
      expect(result.mode).toBe(BuildExecutionMode.SKIP_SHOW_TASK_ID);
      expect(result.cancelled).toBe(false);
    });

    it('should return NORMAL mode as default when parsing fails', async () => {
      mockPrompt.run.mockResolvedValue('Invalid selection');
      
      const result = await selectBuildExecutionMode(() => mockPrompt);
      
      expect(result.mode).toBe(BuildExecutionMode.NORMAL);
      expect(result.cancelled).toBe(false);
    });

    it('should return cancelled=true when prompt throws error', async () => {
      mockPrompt.run.mockRejectedValue(new Error('User cancelled'));
      
      const result = await selectBuildExecutionMode(() => mockPrompt);
      
      expect(result.mode).toBe(BuildExecutionMode.NORMAL);
      expect(result.cancelled).toBe(true);
    });

    it('should create prompt with correct parameters', async () => {
      let capturedPrompt: any;
      const createPrompt = vi.fn().mockImplementation((name, message, choices) => {
        capturedPrompt = { name, message, choices };
        return mockPrompt;
      });
      
      mockPrompt.run.mockResolvedValue('Summary only - Real-time build status and duration');
      
      await selectBuildExecutionMode(createPrompt);
      
      expect(createPrompt).toHaveBeenCalledWith(
        'executionMode',
        'Select build monitoring preference:',
        [
          'Summary only - Real-time build status and duration',
          'Step-by-step - Real-time progress for each build step',
          'Full logs - Real-time verbose build output streaming',
          'Task ID only - No monitoring, returns task ID for async tracking'
        ]
      );
    });
  });
});