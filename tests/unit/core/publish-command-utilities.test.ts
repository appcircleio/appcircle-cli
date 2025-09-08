import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as fs from 'fs';
import {
  validatePublishPlatform,
  validatePublishProfileParams,
  validatePublishAppVersionParams,
  validatePublishVariableGroupParams,
  handlePublishProfileCreate,
  handlePublishProfileList,
  handlePublishProfileDelete,
  handlePublishProfileRename,
  validateFileForUpload,
  validateFileSizeForUpload,
  waitForTaskCompletion,
  handleReleaseCandidateMarking,
  handlePublishUploadError,
  handlePublishVersionUpload,
  getAppVersionDetailsForDeletion,
  confirmAppVersionDeletion,
  handlePublishVersionDelete,
  setupDownloadDirectoryForAppVersion,
  findAppVersionForDownload,
  handlePublishVersionDownload,
  handlePublishVariableGroupList,
  handlePublishVariableGroupView,
  validateVariableGroupUploadFile,
  handlePublishVariableGroupUpload,
  handlePublishStart,
  handlePublishVersionMarkAsRC,
  handlePublishVersionUnmarkAsRC,
  handlePublishProfileSettingsAutopublish,
  handlePublishProfileVersionList,
  handlePublishProfileVersionView,
  handlePublishVersionUpdateReleaseNote,
  handlePublishActiveList,
  handlePublishView
} from '../../../src/core/command-runner.ts';
import { ProgramError } from '../../../src/core/ProgramError.ts';

// Mock dependencies
vi.mock('fs');

vi.mock('../../../src/services', () => ({
  getPublishProfiles: vi.fn(),
  getAppVersions: vi.fn(),
  getPublishVariableGroups: vi.fn(),
  createPublishProfile: vi.fn(),
  getPublishProfileDetailById: vi.fn(),
  deletePublishProfile: vi.fn(),
  renamePublishProfile: vi.fn(),
  getTaskStatus: vi.fn(),
  setAppVersionReleaseCandidateStatus: vi.fn(),
  setAppVersionReleaseNote: vi.fn(),
  getPublishUploadInformation: vi.fn(),
  uploadArtifactWithSignedUrl: vi.fn(),
  commitPublishFileUpload: vi.fn(),
  getAppVersionDetail: vi.fn(),
  deleteAppVersion: vi.fn(),
  getAppVersionDownloadLink: vi.fn(),
  downloadAppVersion: vi.fn(),
  getPublishVariableListByGroupId: vi.fn(),
  uploadPublishEnvironmentVariablesFromFile: vi.fn(),
  getPublishByAppVersion: vi.fn(),
  startExistingPublishFlow: vi.fn(),
  monitorPublishProcess: vi.fn(),
  switchPublishProfileAutoPublishSettings: vi.fn(),
  getActivePublishes: vi.fn(),
  getPublisDetailById: vi.fn()
}));

vi.mock('../../../src/core/writer', () => ({
  commandWriter: vi.fn()
}));

vi.mock('../../../src/utils/orahelper', () => ({
  createOra: vi.fn(() => ({
    start: vi.fn().mockReturnThis(),
    stop: vi.fn().mockReturnThis(),
    succeed: vi.fn().mockReturnThis(),
    fail: vi.fn().mockReturnThis(),
    text: ''
  }))
}));

vi.mock('enquirer', () => ({
  default: {
    prompt: vi.fn()
  }
}));

vi.mock('chalk', () => ({
  default: {
    yellow: vi.fn(msg => msg)
  }
}));

// Mock console methods
vi.mock('console', () => ({
  log: vi.fn(),
  error: vi.fn()
}));

vi.mock('../../../src/utils/size-limit', () => ({
  getMaxUploadBytes: vi.fn(),
  GB: 1024 * 1024 * 1024
}));

const mockCommand = (fullCommandName: string) => ({
  fullCommandName,
  name: vi.fn(),
  args: vi.fn().mockReturnValue([])
});

describe('Publish Command Utilities', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('validatePublishPlatform', () => {
    it('should pass validation for ios platform', () => {
      const params = { platform: 'ios' };
      expect(() => validatePublishPlatform(params)).not.toThrow();
    });

    it('should pass validation for android platform', () => {
      const params = { platform: 'android' };
      expect(() => validatePublishPlatform(params)).not.toThrow();
    });

    it('should pass validation when no platform provided', () => {
      const params = {};
      expect(() => validatePublishPlatform(params)).not.toThrow();
    });

    it('should throw ProgramError for invalid platform', () => {
      const params = { platform: 'windows' };
      expect(() => validatePublishPlatform(params)).toThrow(ProgramError);
      expect(() => validatePublishPlatform(params)).toThrow('Invalid platform(windows). Supported platforms: ios, android');
    });

    it('should be case insensitive for valid platforms', () => {
      expect(() => validatePublishPlatform({ platform: 'IOS' })).not.toThrow();
      expect(() => validatePublishPlatform({ platform: 'ANDROID' })).not.toThrow();
      expect(() => validatePublishPlatform({ platform: 'iOS' })).not.toThrow();
      expect(() => validatePublishPlatform({ platform: 'Android' })).not.toThrow();
    });
  });

  describe('validatePublishProfileParams', () => {
    it('should skip validation for non-required commands', async () => {
      const command = mockCommand('appcircle-some-other-command');
      const params = {};
      await expect(validatePublishProfileParams(command, params)).resolves.toBeUndefined();
    });

    it('should pass validation when publishProfileId is provided', async () => {
      const command = mockCommand('appcircle-publish-start');
      const params = { publishProfileId: 'profile-123' };
      await expect(validatePublishProfileParams(command, params)).resolves.toBeUndefined();
    });

    it('should resolve publishProfile name to ID successfully', async () => {
      const { getPublishProfiles } = await import('../../../src/services');
      const command = mockCommand('appcircle-publish-start');
      const params = { publishProfile: 'MyProfile', platform: 'ios' };
      const mockProfiles = [
        { id: 'profile-123', name: 'MyProfile' },
        { id: 'profile-456', name: 'OtherProfile' }
      ];
      
      vi.mocked(getPublishProfiles).mockResolvedValue(mockProfiles);
      
      await validatePublishProfileParams(command, params);
      expect(params.publishProfileId).toBe('profile-123');
      expect(getPublishProfiles).toHaveBeenCalledWith({ platform: 'ios' });
    });

    it('should throw ProgramError when profile name not found', async () => {
      const { getPublishProfiles } = await import('../../../src/services');
      const command = mockCommand('appcircle-publish-start');
      const params = { publishProfile: 'NonExistentProfile', platform: 'ios' };
      const mockProfiles = [
        { id: 'profile-123', name: 'MyProfile' }
      ];
      
      vi.mocked(getPublishProfiles).mockResolvedValue(mockProfiles);
      
      await expect(validatePublishProfileParams(command, params)).rejects.toThrow(ProgramError);
      await expect(validatePublishProfileParams(command, params)).rejects.toThrow('Publish profile with name "NonExistentProfile" not found.');
    });

    it('should throw ProgramError when neither publishProfileId nor publishProfile provided', async () => {
      const command = mockCommand('appcircle-publish-start');
      const params = {};
      
      await expect(validatePublishProfileParams(command, params)).rejects.toThrow(ProgramError);
      await expect(validatePublishProfileParams(command, params)).rejects.toThrow('Either --publishProfileId or --publishProfile parameter is required.');
    });
  });

  describe('validatePublishAppVersionParams', () => {

    it('should skip validation for non-required commands', async () => {
      const command = mockCommand('appcircle-publish-profile-list');
      const params = {};
      await expect(validatePublishAppVersionParams(command, params)).resolves.toBeUndefined();
    });

    it('should pass validation when appVersionId is provided', async () => {
      const command = mockCommand('appcircle-publish-start');
      const params = { appVersionId: 'version-123' };
      await expect(validatePublishAppVersionParams(command, params)).resolves.toBeUndefined();
    });

    it('should resolve appVersion name to ID successfully by fileName', async () => {
      const { getAppVersions } = await import('../../../src/services');
      const command = mockCommand('appcircle-publish-start');
      const params = { appVersion: 'MyApp.apk', publishProfileId: 'profile-123', platform: 'android' };
      const mockVersions = [
        { id: 'version-123', fileName: 'MyApp.apk', version: '1.0.0' },
        { id: 'version-456', fileName: 'OtherApp.apk', version: '2.0.0' }
      ];
      
      vi.mocked(getAppVersions).mockResolvedValue(mockVersions);
      
      await validatePublishAppVersionParams(command, params);
      expect(params.appVersionId).toBe('version-123');
      expect(getAppVersions).toHaveBeenCalledWith({ publishProfileId: 'profile-123', platform: 'android' });
    });

    it('should resolve appVersion name to ID successfully by version', async () => {
      const { getAppVersions } = await import('../../../src/services');
      const command = mockCommand('appcircle-publish-start');
      const params = { appVersion: '1.0.0', publishProfileId: 'profile-123', platform: 'ios' };
      const mockVersions = [
        { id: 'version-123', fileName: 'MyApp.ipa', version: '1.0.0' }
      ];
      
      vi.mocked(getAppVersions).mockResolvedValue(mockVersions);
      
      await validatePublishAppVersionParams(command, params);
      expect(params.appVersionId).toBe('version-123');
    });

    it('should throw ProgramError when app version not found', async () => {
      const { getAppVersions } = await import('../../../src/services');
      const command = mockCommand('appcircle-publish-start');
      const params = { appVersion: 'NonExistentApp.apk', publishProfileId: 'profile-123', platform: 'android' };
      const mockVersions = [
        { id: 'version-123', fileName: 'MyApp.apk', version: '1.0.0' }
      ];
      
      vi.mocked(getAppVersions).mockResolvedValue(mockVersions);
      
      await expect(validatePublishAppVersionParams(command, params)).rejects.toThrow(ProgramError);
      await expect(validatePublishAppVersionParams(command, params)).rejects.toThrow('App version with name "NonExistentApp.apk" not found.');
    });
  });

  describe('validatePublishVariableGroupParams', () => {

    it('should skip validation for non-required commands', async () => {
      const command = mockCommand('appcircle-publish-start');
      const params = {};
      await expect(validatePublishVariableGroupParams(command, params)).resolves.toBeUndefined();
    });

    it('should pass validation when publishVariableGroupId is provided', async () => {
      const command = mockCommand('appcircle-publish-variable-group-view');
      const params = { publishVariableGroupId: 'group-123' };
      await expect(validatePublishVariableGroupParams(command, params)).resolves.toBeUndefined();
    });

    it('should resolve variableGroup name to ID successfully', async () => {
      const { getPublishVariableGroups } = await import('../../../src/services');
      const command = mockCommand('appcircle-publish-variable-group-view');
      const params = { variableGroup: 'MyGroup' };
      const mockGroups = [
        { id: 'group-123', name: 'MyGroup' },
        { id: 'group-456', name: 'OtherGroup' }
      ];
      
      vi.mocked(getPublishVariableGroups).mockResolvedValue(mockGroups);
      
      await validatePublishVariableGroupParams(command, params);
      expect(params.publishVariableGroupId).toBe('group-123');
      expect(getPublishVariableGroups).toHaveBeenCalled();
    });

    it('should throw ProgramError when variable group not found', async () => {
      const { getPublishVariableGroups } = await import('../../../src/services');
      const command = mockCommand('appcircle-publish-variable-group-view');
      const params = { variableGroup: 'NonExistentGroup' };
      const mockGroups = [
        { id: 'group-123', name: 'MyGroup' }
      ];
      
      vi.mocked(getPublishVariableGroups).mockResolvedValue(mockGroups);
      
      await expect(validatePublishVariableGroupParams(command, params)).rejects.toThrow(ProgramError);
      await expect(validatePublishVariableGroupParams(command, params)).rejects.toThrow('Variable group with name "NonExistentGroup" not found.');
    });
  });

  describe('handlePublishProfileCreate', () => {

    it('should create publish profile successfully', async () => {
      const { createPublishProfile } = await import('../../../src/services');
      const { commandWriter } = await import('../../../src/core/writer');
      
      const command = mockCommand('appcircle-publish-profile-create');
      const params = { platform: 'ios', name: 'NewProfile' };
      const mockProfileRes = { id: 'profile-123', name: 'NewProfile' };
      
      vi.mocked(createPublishProfile).mockResolvedValue(mockProfileRes);
      
      await handlePublishProfileCreate(command, params);
      
      expect(createPublishProfile).toHaveBeenCalledWith({ platform: 'ios', name: 'NewProfile' });
      expect(commandWriter).toHaveBeenCalledWith('publish', {
        fullCommandName: command.fullCommandName,
        data: mockProfileRes
      });
    });
  });

  describe('handlePublishProfileList', () => {

    it('should list publish profiles successfully', async () => {
      const { getPublishProfiles } = await import('../../../src/services');
      const { commandWriter } = await import('../../../src/core/writer');
      const { createOra } = await import('../../../src/utils/orahelper');
      
      const command = mockCommand('appcircle-publish-profile-list');
      const params = { platform: 'android' };
      const mockProfiles = [
        { id: 'profile-123', name: 'Profile1' },
        { id: 'profile-456', name: 'Profile2' }
      ];
      
      vi.mocked(getPublishProfiles).mockResolvedValue(mockProfiles);
      
      await handlePublishProfileList(command, params);
      
      expect(createOra).toHaveBeenCalledWith('Listing Publish Profiles...');
      expect(getPublishProfiles).toHaveBeenCalledWith({ platform: 'android' });
      expect(commandWriter).toHaveBeenCalledWith('publish', {
        fullCommandName: command.fullCommandName,
        data: mockProfiles
      });
    });
  });

  describe('handlePublishProfileDelete', () => {

    it('should delete publish profile successfully when confirmed', async () => {
      const { getPublishProfileDetailById, deletePublishProfile } = await import('../../../src/services');
      const { commandWriter } = await import('../../../src/core/writer');
      const enquirer = await import('enquirer');
      
      const command = mockCommand('appcircle-publish-profile-delete');
      const params = { publishProfileId: 'profile-123' };
      const mockProfile = { id: 'profile-123', name: 'TestProfile' };
      const mockDeleteResponse = { success: true };
      
      vi.mocked(getPublishProfileDetailById).mockResolvedValue(mockProfile);
      vi.mocked(enquirer.default.prompt).mockResolvedValue({ confirm: 'yes' });
      vi.mocked(deletePublishProfile).mockResolvedValue(mockDeleteResponse);
      
      await handlePublishProfileDelete(command, params);
      
      expect(getPublishProfileDetailById).toHaveBeenCalledWith(params);
      expect(enquirer.default.prompt).toHaveBeenCalled();
      expect(deletePublishProfile).toHaveBeenCalledWith(params);
      expect(commandWriter).toHaveBeenCalledWith('publish', {
        fullCommandName: command.fullCommandName,
        data: mockDeleteResponse
      });
    });

    it('should cancel deletion when user chooses no', async () => {
      const { getPublishProfileDetailById, deletePublishProfile } = await import('../../../src/services');
      const enquirer = await import('enquirer');
      
      const command = mockCommand('appcircle-publish-profile-delete');
      const params = { publishProfileId: 'profile-123' };
      const mockProfile = { id: 'profile-123', name: 'TestProfile' };
      
      vi.mocked(getPublishProfileDetailById).mockResolvedValue(mockProfile);
      vi.mocked(enquirer.default.prompt).mockResolvedValue({ confirm: 'no' });
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      
      await handlePublishProfileDelete(command, params);
      
      expect(consoleSpy).toHaveBeenCalledWith('Publish Profile deletion cancelled.');
      expect(deletePublishProfile).not.toHaveBeenCalled();
      
      consoleSpy.mockRestore();
    });
  });

  describe('handlePublishProfileRename', () => {

    it('should rename publish profile successfully', async () => {
      const { renamePublishProfile } = await import('../../../src/services');
      const { commandWriter } = await import('../../../src/core/writer');
      
      const command = mockCommand('appcircle-publish-profile-rename');
      const params = { publishProfileId: 'profile-123', name: 'RenamedProfile' };
      const mockResponse = { id: 'profile-123', name: 'RenamedProfile' };
      
      vi.mocked(renamePublishProfile).mockResolvedValue(mockResponse);
      
      await handlePublishProfileRename(command, params);
      
      expect(renamePublishProfile).toHaveBeenCalledWith(params);
      expect(commandWriter).toHaveBeenCalledWith('publish', {
        fullCommandName: command.fullCommandName,
        data: mockResponse
      });
    });
  });

  describe('validateFileForUpload', () => {
    it('should return expanded path for valid input', () => {
      // Mock fs.existsSync to return true for valid file
      vi.mocked(fs.existsSync).mockReturnValue(true);
      
      expect(() => validateFileForUpload('./package.json', './package.json')).not.toThrow();
    });
  });

  describe('validateFileSizeForUpload', () => {
    it('should throw AppcircleExitError if file size exceeds limit', async () => {
      const { AppcircleExitError } = await import('../../../src/core/AppcircleExitError');
      const { getMaxUploadBytes } = await import('../../../src/utils/size-limit');
      
      // Mock very small file size limit to trigger the error  
      vi.mocked(getMaxUploadBytes).mockReturnValue(1); // 1 byte limit
      
      // Mock fs.statSync to return a file size larger than the limit
      const mockStats = { size: 1000 };
      vi.mocked(fs.statSync).mockReturnValue(mockStats as any);
      
      expect(() => validateFileSizeForUpload(__filename)).toThrow(AppcircleExitError);
    });
  });

  describe('waitForTaskCompletion', () => {
    it('should complete when task status is not BEGIN', async () => {
      const { getTaskStatus } = await import('../../../src/services');
      
      vi.mocked(getTaskStatus).mockResolvedValue({ stateValue: 3 }); // COMPLETED
      
      await expect(waitForTaskCompletion('task-123')).resolves.toBeUndefined();
      expect(getTaskStatus).toHaveBeenCalledWith({ taskId: 'task-123' });
    });

    it('should throw error if task fails', async () => {
      const { getTaskStatus } = await import('../../../src/services');
      
      vi.mocked(getTaskStatus)
        .mockResolvedValueOnce({ stateValue: 1 }) // BEGIN
        .mockResolvedValueOnce({ stateValue: 2 }); // CANCELED (not BEGIN and not COMPLETED)
      
      await expect(waitForTaskCompletion('task-123')).rejects.toThrow();
    });
  });

  describe('handleReleaseCandidateMarking', () => {
    it('should not do anything when shouldMarkAsReleaseCandidate is false', async () => {
      const { getAppVersions } = await import('../../../src/services');
      
      await handleReleaseCandidateMarking({}, false);
      
      expect(getAppVersions).not.toHaveBeenCalled();
    });
  });

  describe('handlePublishUploadError', () => {
    it('should throw AppcircleExitError for file too large', () => {
      const error = {
        response: {
          data: {
            message: 'The file is too large'
          }
        }
      };
      
      expect(() => handlePublishUploadError(error)).toThrow('File size exceeds the maximum allowed limit of 3 GB.');
    });

    it('should throw AppcircleExitError for ProgramError', async () => {
      const { ProgramError } = await import('../../../src/core/ProgramError');
      const error = new ProgramError('Test error');
      
      expect(() => handlePublishUploadError(error)).toThrow('Test error');
    });

    it('should throw AppcircleExitError for API response error', () => {
      const error = { message: 'Cannot read properties of undefined' };
      
      expect(() => handlePublishUploadError(error)).toThrow('API response format error');
    });

    it('should re-throw other errors', () => {
      const error = new Error('Generic error');
      
      expect(() => handlePublishUploadError(error)).toThrow('Generic error');
    });
  });

  describe('handlePublishVersionUpload', () => {
    it('should fail for missing file', async () => {
      const command = mockCommand('appcircle-publish-profile-version-upload');
      const params = { app: 'nonexistent.apk', publishProfileId: 'profile-123', platform: 'android' };
      
      await expect(handlePublishVersionUpload(command, params)).rejects.toThrow();
    });
  });

  describe('getAppVersionDetailsForDeletion', () => {
    it('should return app version details when available', async () => {
      const { getAppVersionDetail } = await import('../../../src/services');
      const params = { appVersionId: 'app-123' };
      const mockAppVersion = { fileName: 'test.apk', version: '1.0.0' };
      
      vi.mocked(getAppVersionDetail).mockResolvedValue(mockAppVersion);
      
      const result = await getAppVersionDetailsForDeletion(params);
      
      expect(result).toBe('"test.apk (v1.0.0)" (ID: app-123)');
      expect(getAppVersionDetail).toHaveBeenCalledWith(params);
    });

    it('should return ID when app version details not found', async () => {
      const { getAppVersionDetail, getAppVersions } = await import('../../../src/services');
      const params = { appVersionId: 'app-123' };
      
      vi.mocked(getAppVersionDetail).mockResolvedValue(null);
      vi.mocked(getAppVersions).mockResolvedValue([]);
      
      const result = await getAppVersionDetailsForDeletion(params);
      
      expect(result).toBe('(ID: app-123)');
    });
  });

  describe('confirmAppVersionDeletion', () => {
    it('should return true when user confirms deletion', async () => {
      const enquirer = await import('enquirer');
      vi.mocked(enquirer.default.prompt).mockResolvedValue({ confirm: 'yes' });
      
      const result = await confirmAppVersionDeletion('test app');
      
      expect(result).toBe(true);
      expect(enquirer.default.prompt).toHaveBeenCalled();
    });

    it('should return false when user cancels deletion', async () => {
      const enquirer = await import('enquirer');
      vi.mocked(enquirer.default.prompt).mockResolvedValue({ confirm: 'no' });
      
      const result = await confirmAppVersionDeletion('test app');
      
      expect(result).toBe(false);
    });
  });

  describe('setupDownloadDirectoryForAppVersion', () => {
    it('should return default directory when no path provided', () => {
      // Mock fs.statSync to return directory stats
      const mockStats = { isDirectory: () => true };
      vi.mocked(fs.statSync).mockReturnValue(mockStats as any);
      
      const result = setupDownloadDirectoryForAppVersion({});
      
      expect(result).toContain('Downloads');
    });

    it('should throw error if target path is not a directory', () => {
      const params = { path: __filename }; // Use current test file
      
      // Mock fs.existsSync to return true and fs.statSync to return non-directory
      vi.mocked(fs.existsSync).mockReturnValue(true);
      const mockStats = { isDirectory: () => false };
      vi.mocked(fs.statSync).mockReturnValue(mockStats as any);
      
      expect(() => setupDownloadDirectoryForAppVersion(params)).toThrow();
    });
  });

  describe('findAppVersionForDownload', () => {
    it('should find and return app version', async () => {
      const { getAppVersions } = await import('../../../src/services');
      const params = { appVersionId: 'app-123' };
      const mockVersions = [
        { id: 'app-123', fileName: 'test.apk' },
        { id: 'app-456', fileName: 'other.apk' }
      ];
      
      vi.mocked(getAppVersions).mockResolvedValue(mockVersions);
      
      const result = await findAppVersionForDownload(params);
      
      expect(result).toEqual({ id: 'app-123', fileName: 'test.apk' });
    });

    it('should throw error when app version not found', async () => {
      const { getAppVersions } = await import('../../../src/services');
      const params = { appVersionId: 'nonexistent' };
      
      vi.mocked(getAppVersions).mockResolvedValue([]);
      
      await expect(findAppVersionForDownload(params)).rejects.toThrow('App version not found');
    });
  });

  describe('handlePublishVariableGroupList', () => {
    it('should list variable groups successfully', async () => {
      const { getPublishVariableGroups } = await import('../../../src/services');
      const { commandWriter } = await import('../../../src/core/writer');
      const { createOra } = await import('../../../src/utils/orahelper');
      
      const command = mockCommand('appcircle-publish-variable-group-list');
      const params = {};
      const mockGroups = [{ id: 'group-1', name: 'Group 1' }];
      
      vi.mocked(getPublishVariableGroups).mockResolvedValue(mockGroups);
      
      await handlePublishVariableGroupList(command, params);
      
      expect(createOra).toHaveBeenCalledWith('Listing Variable Groups...');
      expect(getPublishVariableGroups).toHaveBeenCalled();
      expect(commandWriter).toHaveBeenCalledWith('publish', {
        fullCommandName: command.fullCommandName,
        data: mockGroups
      });
    });
  });

  describe('handlePublishVariableGroupView', () => {
    it('should view variable group variables successfully', async () => {
      const { getPublishVariableListByGroupId } = await import('../../../src/services');
      const { commandWriter } = await import('../../../src/core/writer');
      const { createOra } = await import('../../../src/utils/orahelper');
      
      const command = mockCommand('appcircle-publish-variable-group-view');
      const params = { variableGroupId: 'group-123' };
      const mockVariables = { variables: [{ key: 'TEST_VAR', value: 'test' }] };
      
      vi.mocked(getPublishVariableListByGroupId).mockResolvedValue(mockVariables);
      
      await handlePublishVariableGroupView(command, params);
      
      expect(createOra).toHaveBeenCalledWith('Listing Variables...');
      expect(getPublishVariableListByGroupId).toHaveBeenCalledWith(params);
      expect(commandWriter).toHaveBeenCalledWith('publish', {
        fullCommandName: command.fullCommandName,
        data: mockVariables.variables
      });
    });
  });

  describe('validateVariableGroupUploadFile', () => {
    it('should throw error when file path is not provided', () => {
      const params = {};
      const mockSpinner = { fail: vi.fn() };
      
      expect(() => validateVariableGroupUploadFile(params, mockSpinner)).toThrow('JSON file path is required');
      expect(mockSpinner.fail).toHaveBeenCalledWith('JSON file path is required');
    });

    it('should throw error when file does not exist', () => {
      const params = { filePath: '/nonexistent/file.json' };
      const mockSpinner = { fail: vi.fn() };
      
      // Mock fs.existsSync to return false for the nonexistent file
      vi.mocked(fs.existsSync).mockReturnValue(false);
      
      expect(() => validateVariableGroupUploadFile(params, mockSpinner)).toThrow('File not found');
      expect(mockSpinner.fail).toHaveBeenCalledWith('File not found');
    });

    it('should process valid file path', () => {
      const params = { filePath: './package.json' };
      const mockSpinner = { fail: vi.fn() };
      
      // Mock fs.existsSync to return true for the valid file
      vi.mocked(fs.existsSync).mockReturnValue(true);
      // Mock fs.readFileSync to return valid JSON content
      vi.mocked(fs.readFileSync).mockReturnValue('{"key": "value"}');
      
      expect(() => validateVariableGroupUploadFile(params, mockSpinner)).not.toThrow();
    });
  });

  describe('handlePublishVariableGroupUpload', () => {
    it('should upload variables successfully', async () => {
      const { uploadPublishEnvironmentVariablesFromFile } = await import('../../../src/services');
      const { createOra } = await import('../../../src/utils/orahelper');
      
      const command = mockCommand('appcircle-publish-variable-group-upload');
      const params = { filePath: './package.json' };
      
      // Mock fs operations for file validation 
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.readFileSync).mockReturnValue('{"key": "value"}');
      vi.mocked(uploadPublishEnvironmentVariablesFromFile).mockResolvedValue({});
      
      await handlePublishVariableGroupUpload(command, params);
      
      expect(createOra).toHaveBeenCalledWith('Loading Environment Variables from JSON file...');
      expect(uploadPublishEnvironmentVariablesFromFile).toHaveBeenCalled();
    });
  });

  describe('handlePublishStart', () => {
    it('should start publish flow successfully without monitoring', async () => {
      const { getPublishByAppVersion, startExistingPublishFlow } = await import('../../../src/services');
      const command = mockCommand('appcircle-publish-start');
      const params = { platform: 'android' }; // Missing required params for monitoring
      const mockPublish = { steps: [{ publishId: 'publish-123' }] };
      
      vi.mocked(getPublishByAppVersion).mockResolvedValue(mockPublish);
      vi.mocked(startExistingPublishFlow).mockResolvedValue('publish-123');
      
      await handlePublishStart(command, params);
      
      expect(getPublishByAppVersion).toHaveBeenCalledWith(params);
      expect(startExistingPublishFlow).toHaveBeenCalledWith({ ...params, publishId: 'publish-123' });
    });

    it('should handle error during publish start', async () => {
      const { getPublishByAppVersion } = await import('../../../src/services');
      const command = mockCommand('appcircle-publish-start');
      const params = { platform: 'android' };
      
      vi.mocked(getPublishByAppVersion).mockRejectedValue(new Error('API Error'));
      
      await expect(handlePublishStart(command, params)).rejects.toThrow('API Error');
      expect(getPublishByAppVersion).toHaveBeenCalledWith(params);
    });
  });

  describe('handlePublishVersionMarkAsRC', () => {
    it('should mark version as release candidate', async () => {
      const { setAppVersionReleaseCandidateStatus } = await import('../../../src/services');
      const { commandWriter } = await import('../../../src/core/writer');
      
      const command = mockCommand('appcircle-publish-profile-version-mark-as-rc');
      const params = { appVersionId: 'app-123' };
      const mockResponse = { success: true };
      
      vi.mocked(setAppVersionReleaseCandidateStatus).mockResolvedValue(mockResponse);
      
      await handlePublishVersionMarkAsRC(command, params);
      
      expect(setAppVersionReleaseCandidateStatus).toHaveBeenCalledWith({ ...params, releaseCandidate: true });
      expect(commandWriter).toHaveBeenCalledWith('publish', {
        fullCommandName: command.fullCommandName,
        data: mockResponse
      });
    });
  });

  describe('handlePublishVersionUnmarkAsRC', () => {
    it('should unmark version as release candidate', async () => {
      const { setAppVersionReleaseCandidateStatus } = await import('../../../src/services');
      const { commandWriter } = await import('../../../src/core/writer');
      
      const command = mockCommand('appcircle-publish-profile-version-unmark-as-rc');
      const params = { appVersionId: 'app-123' };
      const mockResponse = { success: true };
      
      vi.mocked(setAppVersionReleaseCandidateStatus).mockResolvedValue(mockResponse);
      
      await handlePublishVersionUnmarkAsRC(command, params);
      
      expect(setAppVersionReleaseCandidateStatus).toHaveBeenCalledWith({ ...params, releaseCandidate: false });
      expect(commandWriter).toHaveBeenCalledWith('publish', {
        fullCommandName: command.fullCommandName,
        data: mockResponse
      });
    });
  });

  describe('handlePublishProfileSettingsAutopublish', () => {
    it('should handle autopublish settings with string enable parameter', async () => {
      const { getPublishProfileDetailById, switchPublishProfileAutoPublishSettings } = await import('../../../src/services');
      const { commandWriter } = await import('../../../src/core/writer');
      
      const command = mockCommand('appcircle-publish-profile-settings-autopublish');
      const params = { publishProfileId: 'profile-123', enable: 'true' };
      const mockProfileDetails = { profileSettings: { autopublish: false } };
      const mockResponse = { success: true };
      
      vi.mocked(getPublishProfileDetailById).mockResolvedValue(mockProfileDetails);
      vi.mocked(switchPublishProfileAutoPublishSettings).mockResolvedValue(mockResponse);
      
      await handlePublishProfileSettingsAutopublish(command, params);
      
      expect(params.enable).toBe(true); // Should convert string to boolean
      expect(getPublishProfileDetailById).toHaveBeenCalledWith(params);
      expect(switchPublishProfileAutoPublishSettings).toHaveBeenCalledWith({ 
        ...params, 
        currentProfileSettings: mockProfileDetails.profileSettings 
      });
      expect(commandWriter).toHaveBeenCalledWith('publish', {
        fullCommandName: command.fullCommandName,
        data: mockResponse
      });
    });
  });

  describe('handlePublishProfileVersionList', () => {
    it('should list app versions', async () => {
      const { getAppVersions } = await import('../../../src/services');
      const { commandWriter } = await import('../../../src/core/writer');
      const { createOra } = await import('../../../src/utils/orahelper');
      
      const command = mockCommand('appcircle-publish-profile-version-list');
      const params = { publishProfileId: 'profile-123' };
      const mockVersions = [{ id: 'version-1', name: 'v1.0' }];
      
      vi.mocked(getAppVersions).mockResolvedValue(mockVersions);
      
      await handlePublishProfileVersionList(command, params);
      
      expect(createOra).toHaveBeenCalledWith('Listing App Versions...');
      expect(getAppVersions).toHaveBeenCalledWith(params);
      expect(commandWriter).toHaveBeenCalledWith('publish', {
        fullCommandName: command.fullCommandName,
        data: mockVersions
      });
    });
  });

  describe('handlePublishProfileVersionView', () => {
    it('should view app version details', async () => {
      const { getAppVersionDetail } = await import('../../../src/services');
      const { commandWriter } = await import('../../../src/core/writer');
      const { createOra } = await import('../../../src/utils/orahelper');
      
      const command = mockCommand('appcircle-publish-profile-version-view');
      const params = { appVersionId: 'app-123' };
      const mockVersion = { id: 'app-123', version: '1.0.0' };
      
      vi.mocked(getAppVersionDetail).mockResolvedValue(mockVersion);
      
      await handlePublishProfileVersionView(command, params);
      
      expect(createOra).toHaveBeenCalledWith('Getting App Version Details...');
      expect(getAppVersionDetail).toHaveBeenCalledWith(params);
      expect(commandWriter).toHaveBeenCalledWith('publish', {
        fullCommandName: command.fullCommandName,
        data: mockVersion
      });
    });
  });

  describe('handlePublishVersionUpdateReleaseNote', () => {
    it('should update release note successfully', async () => {
      const { setAppVersionReleaseNote } = await import('../../../src/services');
      const { createOra } = await import('../../../src/utils/orahelper');
      
      const command = mockCommand('appcircle-publish-profile-version-update-release-note');
      const params = { appVersionId: 'app-123', releaseNotes: 'Updated notes' };
      
      vi.mocked(setAppVersionReleaseNote).mockResolvedValue({});
      
      await handlePublishVersionUpdateReleaseNote(command, params);
      
      expect(createOra).toHaveBeenCalledWith('Try to update relase note of the app version');
      expect(setAppVersionReleaseNote).toHaveBeenCalledWith(params);
    });

    it('should handle release note update failure', async () => {
      const { setAppVersionReleaseNote } = await import('../../../src/services');
      const { createOra } = await import('../../../src/utils/orahelper');
      
      const command = mockCommand('appcircle-publish-profile-version-update-release-note');
      const params = { appVersionId: 'app-123', releaseNotes: 'Updated notes' };
      
      vi.mocked(setAppVersionReleaseNote).mockRejectedValue(new Error('Update failed'));
      
      await expect(handlePublishVersionUpdateReleaseNote(command, params)).rejects.toThrow('Update failed');
      expect(createOra).toHaveBeenCalledWith('Try to update relase note of the app version');
    });
  });

  describe('handlePublishActiveList', () => {
    it('should list active publishes', async () => {
      const { getActivePublishes } = await import('../../../src/services');
      const { commandWriter } = await import('../../../src/core/writer');
      const { createOra } = await import('../../../src/utils/orahelper');
      
      const command = mockCommand('appcircle-publish-active-list');
      const params = {};
      const mockActivePublishes = [{ id: 'publish-1', status: 'active' }];
      
      vi.mocked(getActivePublishes).mockResolvedValue(mockActivePublishes);
      
      await handlePublishActiveList(command, params);
      
      expect(createOra).toHaveBeenCalledWith('Listing Active Publishes...');
      expect(getActivePublishes).toHaveBeenCalledWith();
      expect(commandWriter).toHaveBeenCalledWith('publish', {
        fullCommandName: command.fullCommandName,
        data: mockActivePublishes
      });
    });
  });

  describe('handlePublishView', () => {
    it('should view publish details', async () => {
      const { getPublisDetailById } = await import('../../../src/services');
      const { commandWriter } = await import('../../../src/core/writer');
      const { createOra } = await import('../../../src/utils/orahelper');
      
      const command = mockCommand('appcircle-publish-view');
      const params = { publishId: 'publish-123' };
      const mockPublishDetails = { id: 'publish-123', status: 'completed' };
      
      vi.mocked(getPublisDetailById).mockResolvedValue(mockPublishDetails);
      
      await handlePublishView(command, params);
      
      expect(createOra).toHaveBeenCalledWith('Listing Publish Details...');
      expect(getPublisDetailById).toHaveBeenCalledWith(params);
      expect(commandWriter).toHaveBeenCalledWith('publish', {
        fullCommandName: command.fullCommandName,
        data: mockPublishDetails
      });
    });
  });
});