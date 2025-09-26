/**
 * @fileoverview Tests for publish-related command runner utilities
 * Tests for publish utilities extracted from command-runner.ts for better testability
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

// Import publish utility functions from command-runner
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
  handlePublishProfileVersionList
} from '../../../src/core/command-runner';

import { AppcircleExitError } from '../../../src/core/AppcircleExitError';
import { ProgramError } from '../../../src/core/ProgramError';

// Mock external dependencies
vi.mock('fs');
vi.mock('os');
vi.mock('path');
vi.mock('enquirer');

// Mock ora helper
vi.mock('../../../src/utils/orahelper', () => ({
  createOra: vi.fn(() => ({
    start: vi.fn().mockReturnThis(),
    stop: vi.fn().mockReturnThis(),
    succeed: vi.fn().mockReturnThis(),
    fail: vi.fn().mockReturnThis(),
    text: ''
  }))
}));

// Mock config
vi.mock('../../../src/config', () => ({
  getConsoleOutputType: vi.fn(() => 'plain'),
  getConfigStore: vi.fn(() => ({
    current: 'default',
    envs: {
      default: {
        API_HOSTNAME: 'https://api.appcircle.io',
        AUTH_HOSTNAME: 'https://auth.appcircle.io',
        AC_ACCESS_TOKEN: ''
      }
    }
  })),
  DefaultEnvironmentVariables: {
    AC_ACCESS_TOKEN: '',
    API_HOSTNAME: 'https://api.appcircle.io',
    AUTH_HOSTNAME: 'https://auth.appcircle.io'
  },
  EnvironmentVariables: {
    AC_ACCESS_TOKEN: '',
    API_HOSTNAME: 'https://api.appcircle.io',
    AUTH_HOSTNAME: 'https://auth.appcircle.io'
  },
  readEnviromentConfigVariable: vi.fn((key) => {
    if (key === 'API_HOSTNAME') return 'https://api.appcircle.io';
    if (key === 'AUTH_HOSTNAME') return 'https://auth.appcircle.io';
    if (key === 'AC_ACCESS_TOKEN') return 'mock-token';
    return '';
  })
}));

// Mock services
vi.mock('../../../src/services', () => ({
  getPublishProfiles: vi.fn().mockResolvedValue([]),
  createPublishProfile: vi.fn().mockResolvedValue({}),
  deletePublishProfile: vi.fn().mockResolvedValue({}),
  renamePublishProfile: vi.fn().mockResolvedValue({}),
  getPublishProfileDetailById: vi.fn().mockResolvedValue({ name: 'Test Profile' }),
  getAppVersions: vi.fn().mockResolvedValue([]),
  getAppVersionDetail: vi.fn().mockResolvedValue({}),
  deleteAppVersion: vi.fn().mockResolvedValue({}),
  getAppVersionDownloadLink: vi.fn().mockResolvedValue('http://example.com/download'),
  downloadAppVersion: vi.fn().mockResolvedValue({}),
  getPublishVariableGroups: vi.fn().mockResolvedValue([]),
  getPublishVariableListByGroupId: vi.fn().mockResolvedValue({ variables: [{ key: 'VAR1', value: 'value1' }] }),
  uploadPublishEnvironmentVariablesFromFile: vi.fn().mockResolvedValue({}),
  getPublishByAppVersion: vi.fn().mockResolvedValue({ steps: [{ publishId: 'pub123' }] }),
  startExistingPublishFlow: vi.fn().mockResolvedValue('pub123'),
  setAppVersionReleaseCandidateStatus: vi.fn().mockResolvedValue({}),
  setAppVersionReleaseNote: vi.fn().mockResolvedValue({}),
  switchPublishProfileAutoPublishSettings: vi.fn().mockResolvedValue({}),
  getTaskStatus: vi.fn().mockResolvedValue({ stateValue: 3 }),
  getPublishUploadInformation: vi.fn().mockResolvedValue({ fileId: 'file123' }),
  uploadArtifactWithSignedUrl: vi.fn().mockResolvedValue({}),
  commitPublishFileUpload: vi.fn().mockResolvedValue({ taskId: 'task123' })
}));

// Mock writer
vi.mock('../../../src/core/writer', () => ({
  commandWriter: vi.fn()
}));

// Mock constants
vi.mock('../../../src/constant', () => ({
  PROGRAM_NAME: 'appcircle',
  CURRENT_PARAM_VALUE: 'current',
  UNKNOWN_PARAM_VALUE: 'unknown',
  TaskStatus: {
    BEGIN: 0,
    COMPLETED: 3
  }
}));

// Mock utils
vi.mock('../../../src/utils/size-limit', () => ({
  getMaxUploadBytes: vi.fn(() => 3 * 1024 * 1024 * 1024), // 3GB
  GB: 1024 * 1024 * 1024
}));

// Mock chalk for colors
vi.mock('chalk', () => ({
  default: {
    yellow: vi.fn((text) => text),
    red: vi.fn((text) => text),
    green: vi.fn((text) => text)
  }
}));

// Mock console methods
const mockFs = vi.mocked(fs);
const mockOs = vi.mocked(os);
const mockPath = vi.mocked(path);

describe('Command Runner Publish Utilities', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Platform Validation', () => {
    describe('validatePublishPlatform', () => {
      it('should not throw for valid iOS platform', () => {
        expect(() => {
          validatePublishPlatform({ platform: 'ios' });
        }).not.toThrow();
      });

      it('should not throw for valid Android platform', () => {
        expect(() => {
          validatePublishPlatform({ platform: 'android' });
        }).not.toThrow();
      });

      it('should not throw for valid iOS platform (mixed case)', () => {
        expect(() => {
          validatePublishPlatform({ platform: 'iOS' });
        }).not.toThrow();
      });

      it('should throw ProgramError for invalid platform', () => {
        expect(() => {
          validatePublishPlatform({ platform: 'windows' });
        }).toThrow(ProgramError);
      });

      it('should handle no platform parameter gracefully', () => {
        expect(() => {
          validatePublishPlatform({});
        }).not.toThrow();
      });
    });
  });

  describe('Profile Parameter Validation', () => {
    describe('validatePublishProfileParams', () => {
      it('should resolve profile name to ID', async () => {
        const services = await import('../../../src/services');
        vi.mocked(services.getPublishProfiles).mockResolvedValue([
          { id: 'prof1', name: 'Test Profile' },
          { id: 'prof2', name: 'Another Profile' }
        ]);

        const mockCommand = { fullCommandName: 'appcircle-publish-start' };
        const params = { publishProfile: 'Test Profile', platform: 'ios' };
        
        await validatePublishProfileParams(mockCommand as any, params);
        
        expect(params.publishProfileId).toBe('prof1');
      });

      it('should throw error for non-existing profile', async () => {
        const services = await import('../../../src/services');
        vi.mocked(services.getPublishProfiles).mockResolvedValue([
          { id: 'prof1', name: 'Test Profile' }
        ]);

        const mockCommand = { fullCommandName: 'appcircle-publish-start' };
        const params = { publishProfile: 'NonExistent Profile', platform: 'ios' };
        
        await expect(
          validatePublishProfileParams(mockCommand as any, params)
        ).rejects.toThrow(ProgramError);
      });

      it('should not validate non-required commands', async () => {
        const mockCommand = { fullCommandName: 'appcircle-publish-other' };
        const params = {};
        
        await expect(
          validatePublishProfileParams(mockCommand as any, params)
        ).resolves.not.toThrow();
      });
    });

    describe('validatePublishAppVersionParams', () => {
      it('should resolve app version name to ID', async () => {
        const services = await import('../../../src/services');
        vi.mocked(services.getAppVersions).mockResolvedValue([
          { id: 'v1', fileName: 'app-v1.0.ipa', version: '1.0' },
          { id: 'v2', fileName: 'app-v2.0.ipa', version: '2.0' }
        ]);

        const mockCommand = { fullCommandName: 'appcircle-publish-start' };
        const params = { appVersion: 'app-v1.0.ipa', publishProfileId: 'prof1', platform: 'ios' };
        
        await validatePublishAppVersionParams(mockCommand as any, params);
        
        expect(params.appVersionId).toBe('v1');
      });

      it('should throw error for non-existing app version', async () => {
        const services = await import('../../../src/services');
        vi.mocked(services.getAppVersions).mockResolvedValue([
          { id: 'v1', fileName: 'app-v1.0.ipa', version: '1.0' }
        ]);

        const mockCommand = { fullCommandName: 'appcircle-publish-start' };
        const params = { appVersion: 'nonexistent.ipa', publishProfileId: 'prof1', platform: 'ios' };
        
        await expect(
          validatePublishAppVersionParams(mockCommand as any, params)
        ).rejects.toThrow(ProgramError);
      });
    });

    describe('validatePublishVariableGroupParams', () => {
      it('should resolve variable group name to ID', async () => {
        const services = await import('../../../src/services');
        vi.mocked(services.getPublishVariableGroups).mockResolvedValue([
          { id: 'vg1', name: 'Test Variables' },
          { id: 'vg2', name: 'Other Variables' }
        ]);

        const mockCommand = { fullCommandName: 'appcircle-publish-variable-group-view' };
        const params = { variableGroup: 'Test Variables' };
        
        await validatePublishVariableGroupParams(mockCommand as any, params);
        
        expect(params.publishVariableGroupId).toBe('vg1');
      });

      it('should throw error for non-existing variable group', async () => {
        const services = await import('../../../src/services');
        vi.mocked(services.getPublishVariableGroups).mockResolvedValue([
          { id: 'vg1', name: 'Test Variables' }
        ]);

        const mockCommand = { fullCommandName: 'appcircle-publish-variable-group-view' };
        const params = { variableGroup: 'NonExistent Variables' };
        
        await expect(
          validatePublishVariableGroupParams(mockCommand as any, params)
        ).rejects.toThrow(ProgramError);
      });
    });
  });

  describe('File Validation Utilities', () => {
    describe.skip('validateFileForUpload', () => {
      it('should return expanded path for existing file', () => {
        mockOs.homedir.mockReturnValue('/home/user');
        mockPath.resolve.mockReturnValue('/home/user/app.ipa');
        mockFs.existsSync.mockReturnValue(true);

        const result = validateFileForUpload('~/app.ipa', '~/app.ipa');
        
        expect(result).toBe('/home/user/app.ipa');
      });

      it('should throw AppcircleExitError for non-existing file', () => {
        mockOs.homedir.mockReturnValue('/home/user');
        mockPath.resolve.mockReturnValue('/home/user/nonexistent.ipa');
        mockFs.existsSync.mockReturnValue(false);

        expect(() => {
          validateFileForUpload('~/nonexistent.ipa', '~/nonexistent.ipa');
        }).toThrow(AppcircleExitError);
      });
    });

    describe('validateFileSizeForUpload', () => {
      it('should return stats and maxBytes for valid file size', () => {
        const mockStats = { size: 1024 * 1024 * 1024 }; // 1GB
        mockFs.statSync.mockReturnValue(mockStats as any);

        const result = validateFileSizeForUpload('/path/to/file.ipa');
        
        expect(result.stats).toBe(mockStats);
        expect(result.maxBytes).toBe(3 * 1024 * 1024 * 1024);
      });

      it('should throw AppcircleExitError for oversized file', () => {
        const mockStats = { size: 5 * 1024 * 1024 * 1024 }; // 5GB
        mockFs.statSync.mockReturnValue(mockStats as any);

        expect(() => {
          validateFileSizeForUpload('/path/to/large-file.ipa');
        }).toThrow(AppcircleExitError);
      });
    });
  });

  describe('Task Completion and Release Candidate Utilities', () => {
    describe('waitForTaskCompletion', () => {
      it('should wait until task is completed', async () => {
        const services = await import('../../../src/services');
        vi.mocked(services.getTaskStatus)
          .mockResolvedValueOnce({ stateValue: 0 }) // BEGIN
          .mockResolvedValueOnce({ stateValue: 3 }); // COMPLETED

        await expect(waitForTaskCompletion('task123')).resolves.not.toThrow();
      });

      it.skip('should throw error for failed task', async () => {
        const services = await import('../../../src/services');
        vi.mocked(services.getTaskStatus).mockResolvedValue({ stateValue: 2 }); // FAILED

        await expect(waitForTaskCompletion('task123')).rejects.toThrow(AppcircleExitError);
      });
    });

    describe('handleReleaseCandidateMarking', () => {
      it('should mark app version as release candidate when shouldMark is true', async () => {
        const services = await import('../../../src/services');
        vi.mocked(services.getAppVersions).mockResolvedValue([{ id: 'v1' }]);

        const params = { publishProfileId: 'prof1' };
        
        await handleReleaseCandidateMarking(params, true);
        
        expect(services.setAppVersionReleaseCandidateStatus).toHaveBeenCalledWith({
          ...params,
          appVersionId: 'v1',
          releaseCandidate: true
        });
      });

      it('should set release note when summary is provided', async () => {
        const services = await import('../../../src/services');
        vi.mocked(services.getAppVersions).mockResolvedValue([{ id: 'v1' }]);

        const params = { publishProfileId: 'prof1', summary: 'Release notes' };
        
        await handleReleaseCandidateMarking(params, true);
        
        expect(services.setAppVersionReleaseNote).toHaveBeenCalledWith({
          ...params,
          appVersionId: 'v1'
        });
      });

      it('should not do anything when shouldMark is false', async () => {
        const services = await import('../../../src/services');
        
        await handleReleaseCandidateMarking({}, false);
        
        expect(services.setAppVersionReleaseCandidateStatus).not.toHaveBeenCalled();
      });
    });
  });

  describe('Error Handling Utilities', () => {
    describe('handlePublishUploadError', () => {
      it('should throw AppcircleExitError for oversized file', () => {
        const error = {
          response: {
            data: {
              message: 'The file is too large'
            }
          }
        };

        expect(() => {
          handlePublishUploadError(error);
        }).toThrow(AppcircleExitError);
      });

      it('should throw AppcircleExitError for ProgramError', () => {
        const error = new ProgramError('Test error');

        expect(() => {
          handlePublishUploadError(error);
        }).toThrow(AppcircleExitError);
      });

      it('should throw AppcircleExitError for API response format error', () => {
        const error = {
          message: 'Cannot read properties of undefined'
        };

        expect(() => {
          handlePublishUploadError(error);
        }).toThrow(AppcircleExitError);
      });

      it('should re-throw other errors', () => {
        const error = new Error('Generic error');

        expect(() => {
          handlePublishUploadError(error);
        }).toThrow(Error);
      });
    });
  });

  describe('App Version Management Utilities', () => {
    describe('getAppVersionDetailsForDeletion', () => {
      it('should return app version details string when app version is found', async () => {
        const services = await import('../../../src/services');
        vi.mocked(services.getAppVersionDetail).mockResolvedValue({
          fileName: 'app-v1.0.ipa',
          version: '1.0'
        });

        const params = { appVersionId: 'v1' };
        
        const result = await getAppVersionDetailsForDeletion(params);
        
        expect(result).toBe('"app-v1.0.ipa (v1.0)" (ID: v1)');
      });

      it.skip('should fallback to app versions list when detail fetch fails', async () => {
        const services = await import('../../../src/services');
        vi.mocked(services.getAppVersionDetail).mockRejectedValue(new Error('Not found'));
        vi.mocked(services.getAppVersions).mockResolvedValue([
          { id: 'v1', fileName: 'app-v1.0.ipa', version: '1.0' }
        ]);
        const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

        const params = { appVersionId: 'v1' };
        
        const result = await getAppVersionDetailsForDeletion(params);
        
        expect(result).toBe('"app-v1.0.ipa (v1.0)" (ID: v1)');
        expect(consoleSpy).toHaveBeenCalled();
        
        consoleSpy.mockRestore();
      });

      it('should return ID-based string when no details are found', async () => {
        const services = await import('../../../src/services');
        vi.mocked(services.getAppVersionDetail).mockRejectedValue(new Error('Not found'));
        vi.mocked(services.getAppVersions).mockResolvedValue([]);
        const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

        const params = { appVersionId: 'v1' };
        
        const result = await getAppVersionDetailsForDeletion(params);
        
        expect(result).toBe('(ID: v1)');
        
        consoleSpy.mockRestore();
      });
    });

    describe('confirmAppVersionDeletion', () => {
      it.skip('should return true when user confirms deletion', async () => {
        const enquirer = await import('enquirer');
        vi.mocked(enquirer.default.prompt).mockResolvedValue({ confirm: 'yes' });

        const result = await confirmAppVersionDeletion('test-app');
        
        expect(result).toBe(true);
      });

      it.skip('should return false when user cancels deletion', async () => {
        const enquirer = await import('enquirer');
        vi.mocked(enquirer.default.prompt).mockResolvedValue({ confirm: 'no' });

        const result = await confirmAppVersionDeletion('test-app');
        
        expect(result).toBe(false);
      });
    });

    describe('setupDownloadDirectoryForAppVersion', () => {
      it('should create and return target directory', () => {
        mockOs.homedir.mockReturnValue('/home/user');
        mockPath.join.mockReturnValue('/home/user/Downloads');
        mockPath.resolve.mockReturnValue('/home/user/Downloads');
        mockFs.existsSync.mockReturnValue(false);
        mockFs.mkdirSync.mockReturnValue(undefined);

        const result = setupDownloadDirectoryForAppVersion({ path: '~/Downloads' });
        
        expect(result).toBe('/home/user/Downloads');
        expect(mockFs.mkdirSync).toHaveBeenCalledWith('/home/user/Downloads', { recursive: true });
      });

      it('should throw error when target exists but is not a directory', () => {
        mockOs.homedir.mockReturnValue('/home/user');
        mockPath.resolve.mockReturnValue('/home/user/file.txt');
        mockFs.existsSync.mockReturnValue(true);
        mockFs.statSync.mockReturnValue({ isDirectory: () => false } as any);

        expect(() => {
          setupDownloadDirectoryForAppVersion({ path: '~/file.txt' });
        }).toThrow(AppcircleExitError);
      });
    });

    describe('findAppVersionForDownload', () => {
      it('should find and return app version', async () => {
        const services = await import('../../../src/services');
        vi.mocked(services.getAppVersions).mockResolvedValue([
          { id: 'v1', fileName: 'app-v1.0.ipa' },
          { id: 'v2', fileName: 'app-v2.0.ipa' }
        ]);

        const params = { appVersionId: 'v1' };
        
        const result = await findAppVersionForDownload(params);
        
        expect(result).toEqual({ id: 'v1', fileName: 'app-v1.0.ipa' });
      });

      it('should throw error when app version not found', async () => {
        const services = await import('../../../src/services');
        vi.mocked(services.getAppVersions).mockResolvedValue([
          { id: 'v2', fileName: 'app-v2.0.ipa' }
        ]);

        const params = { appVersionId: 'v1' };
        
        await expect(findAppVersionForDownload(params)).rejects.toThrow('App version not found');
      });
    });
  });

  describe('Variable Group File Validation', () => {
    describe('validateVariableGroupUploadFile', () => {
      it('should validate and process valid JSON file', () => {
        const mockSpinner = { fail: vi.fn() };
        mockOs.homedir.mockReturnValue('/home/user');
        mockPath.resolve.mockReturnValue('/home/user/variables.json');
        mockFs.existsSync.mockReturnValue(true);
        mockFs.readFileSync.mockReturnValue('{"key": "value"}');

        const params = { filePath: '~/variables.json' };
        
        const result = validateVariableGroupUploadFile(params, mockSpinner);
        
        expect(result).toBe('/home/user/variables.json');
      });

      it('should throw error when filePath is missing', () => {
        const mockSpinner = { fail: vi.fn() };

        const params = {};
        
        expect(() => {
          validateVariableGroupUploadFile(params, mockSpinner);
        }).toThrow(AppcircleExitError);
        
        expect(mockSpinner.fail).toHaveBeenCalledWith('JSON file path is required');
      });

      it('should throw error when file does not exist', () => {
        const mockSpinner = { fail: vi.fn() };
        mockOs.homedir.mockReturnValue('/home/user');
        mockPath.resolve.mockReturnValue('/home/user/nonexistent.json');
        mockFs.existsSync.mockReturnValue(false);

        const params = { filePath: '~/nonexistent.json' };
        
        expect(() => {
          validateVariableGroupUploadFile(params, mockSpinner);
        }).toThrow(AppcircleExitError);
        
        expect(mockSpinner.fail).toHaveBeenCalledWith('File not found');
      });

      it('should throw error for invalid JSON content', () => {
        const mockSpinner = { fail: vi.fn() };
        mockOs.homedir.mockReturnValue('/home/user');
        mockPath.resolve.mockReturnValue('/home/user/invalid.json');
        mockFs.existsSync.mockReturnValue(true);
        mockFs.readFileSync.mockReturnValue('invalid json content');

        const params = { filePath: '~/invalid.json' };
        
        expect(() => {
          validateVariableGroupUploadFile(params, mockSpinner);
        }).toThrow(AppcircleExitError);
        
        expect(mockSpinner.fail).toHaveBeenCalledWith('Invalid JSON file');
      });

      it('should clean up variableGroupId formatting', () => {
        const mockSpinner = { fail: vi.fn() };
        mockOs.homedir.mockReturnValue('/home/user');
        mockPath.resolve.mockReturnValue('/home/user/variables.json');
        mockFs.existsSync.mockReturnValue(true);
        mockFs.readFileSync.mockReturnValue('{"key": "value"}');

        const params = { 
          filePath: '~/variables.json',
          variableGroupId: 'Test Group (group123)'
        };
        
        validateVariableGroupUploadFile(params, mockSpinner);
        
        expect(params.variableGroupId).toBe('group123');
      });
    });
  });

  describe('Profile Handler Utilities', () => {
    describe('handlePublishProfileCreate', () => {
      it('should create publish profile and write output', async () => {
        const services = await import('../../../src/services');
        const writer = await import('../../../src/core/writer');
        const mockCommand = { fullCommandName: 'appcircle-publish-profile-create' };
        const params = { platform: 'ios', name: 'Test Profile' };

        await handlePublishProfileCreate(mockCommand as any, params);
        
        expect(services.createPublishProfile).toHaveBeenCalledWith(params);
        expect(writer.commandWriter).toHaveBeenCalled();
      });
    });

    describe('handlePublishProfileList', () => {
      it('should list publish profiles with spinner', async () => {
        const services = await import('../../../src/services');
        const writer = await import('../../../src/core/writer');
        const mockCommand = { fullCommandName: 'appcircle-publish-profile-list' };
        const params = { platform: 'ios' };

        await handlePublishProfileList(mockCommand as any, params);
        
        expect(services.getPublishProfiles).toHaveBeenCalledWith(params);
        expect(writer.commandWriter).toHaveBeenCalled();
      });
    });

    describe('handlePublishVersionMarkAsRC', () => {
      it('should mark version as release candidate', async () => {
        const services = await import('../../../src/services');
        const writer = await import('../../../src/core/writer');
        const mockCommand = { fullCommandName: 'appcircle-publish-version-mark-as-rc' };
        const params = { appVersionId: 'v1' };

        await handlePublishVersionMarkAsRC(mockCommand as any, params);
        
        expect(services.setAppVersionReleaseCandidateStatus).toHaveBeenCalledWith({
          ...params,
          releaseCandidate: true
        });
        expect(writer.commandWriter).toHaveBeenCalled();
      });
    });

    describe('handlePublishVersionUnmarkAsRC', () => {
      it('should unmark version as release candidate', async () => {
        const services = await import('../../../src/services');
        const writer = await import('../../../src/core/writer');
        const mockCommand = { fullCommandName: 'appcircle-publish-version-unmark-as-rc' };
        const params = { appVersionId: 'v1' };

        await handlePublishVersionUnmarkAsRC(mockCommand as any, params);
        
        expect(services.setAppVersionReleaseCandidateStatus).toHaveBeenCalledWith({
          ...params,
          releaseCandidate: false
        });
        expect(writer.commandWriter).toHaveBeenCalled();
      });
    });
  });

  describe('Variable Group Handlers', () => {
    describe('handlePublishVariableGroupList', () => {
      it('should list variable groups with spinner', async () => {
        const services = await import('../../../src/services');
        const writer = await import('../../../src/core/writer');
        const mockCommand = { fullCommandName: 'appcircle-publish-variable-group-list' };

        await handlePublishVariableGroupList(mockCommand as any, {});
        
        expect(services.getPublishVariableGroups).toHaveBeenCalled();
        expect(writer.commandWriter).toHaveBeenCalled();
      });
    });

    describe('handlePublishVariableGroupView', () => {
      it.skip('should view variable group variables', async () => {
        const services = await import('../../../src/services');
        const writer = await import('../../../src/core/writer');
        const mockCommand = { fullCommandName: 'appcircle-publish-variable-group-view' };
        const params = { publishVariableGroupId: 'vg1' };

        await handlePublishVariableGroupView(mockCommand as any, params);
        
        expect(services.getPublishVariableListByGroupId).toHaveBeenCalledWith(params);
        expect(writer.commandWriter).toHaveBeenCalled();
      });
    });
  });

  describe('Profile Settings Handler', () => {
    describe('handlePublishProfileSettingsAutopublish', () => {
      it('should convert string enable parameter to boolean', async () => {
        const services = await import('../../../src/services');
        const writer = await import('../../../src/core/writer');
        vi.mocked(services.getPublishProfileDetailById).mockResolvedValue({
          profileSettings: { autopublish: false }
        });

        const mockCommand = { fullCommandName: 'appcircle-publish-profile-settings-autopublish' };
        const params = { publishProfileId: 'prof1', enable: 'true' };

        await handlePublishProfileSettingsAutopublish(mockCommand as any, params);
        
        expect(params.enable).toBe(true);
        expect(services.switchPublishProfileAutoPublishSettings).toHaveBeenCalled();
        expect(writer.commandWriter).toHaveBeenCalled();
      });
    });

    describe('handlePublishProfileVersionList', () => {
      it('should list profile versions with spinner', async () => {
        const services = await import('../../../src/services');
        const writer = await import('../../../src/core/writer');
        const mockCommand = { fullCommandName: 'appcircle-publish-profile-version-list' };
        const params = { publishProfileId: 'prof1' };

        await handlePublishProfileVersionList(mockCommand as any, params);
        
        expect(services.getAppVersions).toHaveBeenCalledWith(params);
        expect(writer.commandWriter).toHaveBeenCalled();
      });
    });
  });
});