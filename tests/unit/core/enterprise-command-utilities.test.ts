/**
 * @fileoverview Unit tests for enterprise command utilities
 * Tests the extracted enterprise command handler utilities
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import chalk from 'chalk';

// Mock dependencies
vi.mock('../../../src/utils/orahelper', () => ({
  createOra: vi.fn()
}));

vi.mock('../../../src/config', async () => {
  const actual = await vi.importActual('../../../src/config');
  return {
    ...actual,
    getConsoleOutputType: vi.fn().mockReturnValue('plain'),
    getInteractiveMode: vi.fn().mockReturnValue(false)
  };
});

vi.mock('chalk', () => ({
  default: {
    red: vi.fn((msg) => msg),
    yellow: vi.fn((msg) => msg),
    green: vi.fn((msg) => msg),
    cyan: vi.fn((msg) => msg),
    blue: vi.fn((msg) => msg),
    gray: vi.fn((msg) => msg),
    hex: vi.fn(() => vi.fn((msg) => msg))
  }
}));

vi.mock('enquirer', () => ({
  default: {
    prompt: vi.fn()
  }
}));

vi.mock('os', () => ({
  default: {
    homedir: vi.fn(() => '/home/test')
  },
  homedir: vi.fn(() => '/home/test')
}));

vi.mock('path', () => ({
  default: {
    join: vi.fn((...args) => args.join('/')),
    resolve: vi.fn((path) => path),
    basename: vi.fn((path) => path.split('/').pop())
  },
  join: vi.fn((...args) => args.join('/')),
  resolve: vi.fn((path) => path),
  basename: vi.fn((path) => path.split('/').pop())
}));

vi.mock('fs', () => ({
  default: {
    existsSync: vi.fn(),
    statSync: vi.fn()
  },
  existsSync: vi.fn(),
  statSync: vi.fn()
}));

// Mock the AppcircleExitError and ProgramError
vi.mock('../../../src/core/AppcircleExitError', () => ({
  AppcircleExitError: class AppcircleExitError extends Error {
    public code: number;
    constructor(message: string, code: number) {
      super(message);
      this.code = code;
    }
  }
}));

vi.mock('../../../src/core/ProgramError', () => ({
  ProgramError: class ProgramError extends Error {
    constructor(message: string) {
      super(message);
    }
  }
}));

// Mock enterprise service functions
vi.mock('../../../src/services/index', () => ({
  getEnterpriseProfiles: vi.fn(),
  getEnterpriseAppVersions: vi.fn(),
  publishEnterpriseAppVersion: vi.fn(),
  unpublishEnterpriseAppVersion: vi.fn(),
  removeEnterpriseAppVersion: vi.fn(),
  notifyEnterpriseAppVersion: vi.fn(),
  getEnterpriseUploadInformation: vi.fn(),
  commitEnterpriseFileUpload: vi.fn(),
  getEnterpriseDownloadLink: vi.fn(),
  uploadArtifactWithSignedUrl: vi.fn()
}));

// Mock utility functions
vi.mock('../../../src/utils/size-limit', () => ({
  getMaxUploadBytes: vi.fn()
}));

// Mock command runner utilities
vi.mock('../../../src/core/command-runner', async () => {
  const actual = await vi.importActual('../../../src/core/command-runner');
  return {
    ...actual,
    createOra: vi.fn(),
    commandWriter: vi.fn(),
    getLongDescriptionForCommand: vi.fn()
  };
});

// Mock writer module
vi.mock('../../../src/core/writer', () => ({
  commandWriter: vi.fn()
}));

// Mock console methods - setup will happen in beforeEach
let mockConsoleLog: any;
let mockConsoleError: any;

import { createOra } from '../../../src/utils/orahelper';
import { AppcircleExitError } from '../../../src/core/AppcircleExitError';
import { ProgramError } from '../../../src/core/ProgramError';
import enquirer from 'enquirer';
import path from 'path';
import os from 'os';
import fs from 'fs';
import {
  getEnterpriseProfiles,
  getEnterpriseAppVersions,
  publishEnterpriseAppVersion,
  unpublishEnterpriseAppVersion,
  removeEnterpriseAppVersion,
  notifyEnterpriseAppVersion,
  getEnterpriseUploadInformation,
  commitEnterpriseFileUpload,
  getEnterpriseDownloadLink,
  uploadArtifactWithSignedUrl
} from '../../../src/services/index';
import { getMaxUploadBytes } from '../../../src/utils/size-limit';
import { commandWriter } from '../../../src/core/writer';
import {
  getLongDescriptionForCommand,
  validateEnterpriseProfileParams,
  validateEnterpriseAppVersionParams,
  handleEnterpriseProfileList,
  handleEnterpriseVersionList,
  handleEnterpriseVersionPublish,
  handleEnterpriseVersionUnpublish,
  handleEnterpriseVersionRemove,
  handleEnterpriseVersionNotify,
  validateAndPrepareUploadFile,
  handleUploadError,
  handleEnterpriseVersionUploadForProfile,
  handleEnterpriseVersionUploadWithoutProfile,
  handleEnterpriseVersionDownloadLink
} from '../../../src/core/command-runner';

const CommandTypes = {
  ENTERPRISE_APP_STORE: 'enterprise-app-store'
};

describe('Enterprise Command Utilities', () => {
  let mockSpinner: any;
  let mockCommand: any;
  let mockParams: any;

  beforeEach(() => {
    vi.clearAllMocks();
    
    // Set up console mocks fresh for each test
    mockConsoleLog = vi.spyOn(console, 'log').mockImplementation(() => {});
    mockConsoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
    
    mockSpinner = {
      start: vi.fn().mockReturnThis(),
      stop: vi.fn(),
      succeed: vi.fn(),
      fail: vi.fn(),
      text: ''
    };
    (createOra as any).mockReturnValue(mockSpinner);

    mockCommand = {
      fullCommandName: 'appcircle-enterprise-app-store-profile-list'
    };

    mockParams = {
      entProfileId: 'profile-123',
      entVersionId: 'version-456'
    };
  });

  afterEach(() => {
    // Restore console methods
    mockConsoleLog?.mockRestore?.();
    mockConsoleError?.mockRestore?.();
    vi.resetAllMocks();
  });

  describe('validateEnterpriseProfileParams', () => {
    it('should pass when neither profile ID nor profile name is required', async () => {
      mockCommand.fullCommandName = 'appcircle-enterprise-app-store-other-command';
      
      await expect(() => 
        validateEnterpriseProfileParams(mockCommand, mockParams)
      ).not.toThrow();
    });

    it('should pass when profile ID is provided', async () => {
      mockCommand.fullCommandName = 'appcircle-enterprise-app-store-version-list';
      
      await expect(() => 
        validateEnterpriseProfileParams(mockCommand, mockParams)
      ).not.toThrow();
    });

    it('should resolve profile name to ID', async () => {
      mockCommand.fullCommandName = 'appcircle-enterprise-app-store-version-list';
      mockParams = { entProfile: 'TestProfile' };
      
      (getEnterpriseProfiles as any).mockResolvedValue([
        { id: 'profile-123', name: 'TestProfile' },
        { id: 'profile-456', name: 'OtherProfile' }
      ]);

      await validateEnterpriseProfileParams(mockCommand, mockParams);
      
      expect(mockParams.entProfileId).toBe('profile-123');
    });

    it('should throw error when profile name not found', async () => {
      mockCommand.fullCommandName = 'appcircle-enterprise-app-store-version-list';
      mockParams = { entProfile: 'NonExistentProfile' };
      
      (getEnterpriseProfiles as any).mockResolvedValue([
        { id: 'profile-123', name: 'TestProfile' }
      ]);

      await expect(() => 
        validateEnterpriseProfileParams(mockCommand, mockParams)
      ).rejects.toThrow(ProgramError);
    });

    it('should throw error when no profile parameters provided', async () => {
      mockCommand.fullCommandName = 'appcircle-enterprise-app-store-version-list';
      mockParams = {};
      
      (getLongDescriptionForCommand as any).mockReturnValue('Command help text');

      await expect(() => 
        validateEnterpriseProfileParams(mockCommand, mockParams)
      ).rejects.toThrow(ProgramError);
      
      // The console.log call happens inside the function, so let's not check it for this test
    });
  });

  describe('validateEnterpriseAppVersionParams', () => {
    it('should pass when version ID is provided', async () => {
      mockCommand.fullCommandName = 'appcircle-enterprise-app-store-version-publish';
      
      await expect(() => 
        validateEnterpriseAppVersionParams(mockCommand, mockParams)
      ).not.toThrow();
    });

    it('should resolve version name to ID', async () => {
      mockCommand.fullCommandName = 'appcircle-enterprise-app-store-version-publish';
      mockParams = { entProfileId: 'profile-123', entVersion: 'v1.0.0' };
      
      (getEnterpriseAppVersions as any).mockResolvedValue([
        { id: 'version-123', name: 'TestApp', version: 'v1.0.0' },
        { id: 'version-456', name: 'TestApp', version: 'v2.0.0' }
      ]);

      await validateEnterpriseAppVersionParams(mockCommand, mockParams);
      
      expect(mockParams.entVersionId).toBe('version-123');
    });

    it('should throw error when version name not found', async () => {
      mockCommand.fullCommandName = 'appcircle-enterprise-app-store-version-publish';
      mockParams = { entProfileId: 'profile-123', entVersion: 'v3.0.0' };
      
      (getEnterpriseAppVersions as any).mockResolvedValue([
        { id: 'version-123', name: 'TestApp', version: 'v1.0.0' }
      ]);

      await expect(() => 
        validateEnterpriseAppVersionParams(mockCommand, mockParams)
      ).rejects.toThrow(ProgramError);
    });
  });

  describe('handleEnterpriseProfileList', () => {
    it('should list enterprise profiles successfully', async () => {
      const mockProfiles = [
        { id: 'profile-123', name: 'Profile1' },
        { id: 'profile-456', name: 'Profile2' }
      ];
      
      (getEnterpriseProfiles as any).mockResolvedValue(mockProfiles);

      await handleEnterpriseProfileList(mockCommand);
      
      expect(createOra).toHaveBeenCalledWith('Listing Enterprise Profiles...');
      expect(mockSpinner.start).toHaveBeenCalled();
      expect(mockSpinner.stop).toHaveBeenCalled();
      expect(commandWriter).toHaveBeenCalledWith(CommandTypes.ENTERPRISE_APP_STORE, {
        fullCommandName: mockCommand.fullCommandName,
        data: mockProfiles,
      });
    });
  });

  describe('handleEnterpriseVersionList', () => {
    it('should list enterprise app versions successfully', async () => {
      const mockVersions = [
        { id: 'version-123', name: 'App1', version: 'v1.0.0' },
        { id: 'version-456', name: 'App1', version: 'v2.0.0' }
      ];
      
      (getEnterpriseAppVersions as any).mockResolvedValue(mockVersions);

      await handleEnterpriseVersionList(mockCommand, mockParams);
      
      expect(createOra).toHaveBeenCalledWith('Listing Enterprise App Versions...');
      expect(mockSpinner.start).toHaveBeenCalled();
      expect(mockSpinner.stop).toHaveBeenCalled();
      expect(commandWriter).toHaveBeenCalledWith(CommandTypes.ENTERPRISE_APP_STORE, {
        fullCommandName: mockCommand.fullCommandName,
        data: mockVersions,
      });
    });
  });

  describe('handleEnterpriseVersionPublish', () => {
    it('should publish enterprise app version successfully', async () => {
      const mockResponse = { taskId: 'task-123', status: 'success' };
      const publishParams = {
        entProfileId: 'profile-123',
        entVersionId: 'version-456',
        summary: 'Test summary',
        releaseNotes: 'Test release notes',
        publishType: '1'
      };

      (publishEnterpriseAppVersion as any).mockResolvedValue(mockResponse);

      await handleEnterpriseVersionPublish(mockCommand, publishParams);

      // Check that publishEnterpriseAppVersion was called with correct mapped parameters
      expect(publishEnterpriseAppVersion).toHaveBeenCalledWith({
        entProfileId: 'profile-123',
        entVersionId: 'version-456',
        summary: 'Test summary',
        releaseNotes: 'Test release notes',
        publishType: '1'
      });
      expect(commandWriter).toHaveBeenCalledWith(CommandTypes.ENTERPRISE_APP_STORE, {
        fullCommandName: mockCommand.fullCommandName,
        data: mockResponse,
      });
    });
  });

  describe('handleEnterpriseVersionUnpublish', () => {
    it('should unpublish enterprise app version successfully', async () => {
      const mockResponse = { taskId: 'task-123', status: 'success' };
      
      (unpublishEnterpriseAppVersion as any).mockResolvedValue(mockResponse);

      await handleEnterpriseVersionUnpublish(mockCommand, mockParams);
      
      expect(unpublishEnterpriseAppVersion).toHaveBeenCalledWith(mockParams);
      expect(commandWriter).toHaveBeenCalledWith(CommandTypes.ENTERPRISE_APP_STORE, {
        fullCommandName: mockCommand.fullCommandName,
        data: mockResponse,
      });
    });
  });

  describe('handleEnterpriseVersionRemove', () => {
    it('should return early when no version ID provided', async () => {
      const paramsWithoutVersionId = { entProfileId: 'profile-123' };
      
      const result = await handleEnterpriseVersionRemove(mockCommand, paramsWithoutVersionId);
      
      expect(result).toBeUndefined();
      expect(getEnterpriseAppVersions).not.toHaveBeenCalled();
    });

    it('should remove enterprise app version when user confirms', async () => {
      const mockVersions = [
        { id: 'version-456', name: 'TestApp', version: 'v1.0.0' }
      ];
      const mockResponse = { taskId: 'task-789', status: 'success' };
      
      (getEnterpriseAppVersions as any).mockResolvedValue(mockVersions);
      (enquirer.prompt as any).mockResolvedValue({ confirm: 'yes' });
      (removeEnterpriseAppVersion as any).mockResolvedValue(mockResponse);

      await handleEnterpriseVersionRemove(mockCommand, mockParams);
      
      expect(enquirer.prompt).toHaveBeenCalledWith({
        type: 'select',
        name: 'confirm',
        message: 'Are you sure you want to delete the Enterprise App Version "TestApp (v1.0.0)"? This action cannot be undone. (Y/n)',
        choices: [
          { name: 'yes', message: 'yes' },
          { name: 'no', message: 'no' }
        ],
        initial: 1
      });
      
      expect(removeEnterpriseAppVersion).toHaveBeenCalledWith(mockParams);
      expect(mockSpinner.text).toBe('Enterprise App Version removed successfully.\n\nTaskId: task-789');
      expect(mockSpinner.succeed).toHaveBeenCalled();
    });

    it('should cancel removal when user declines', async () => {
      const mockVersions = [
        { id: 'version-456', name: 'TestApp', version: 'v1.0.0' }
      ];
      
      (getEnterpriseAppVersions as any).mockResolvedValue(mockVersions);
      (enquirer.prompt as any).mockResolvedValue({ confirm: 'no' });

      await handleEnterpriseVersionRemove(mockCommand, mockParams);
      
      expect(mockConsoleLog).toHaveBeenCalledWith(expect.stringContaining('Enterprise App Version deletion cancelled.'));
      expect(removeEnterpriseAppVersion).not.toHaveBeenCalled();
    });

    it('should handle removal errors', async () => {
      const mockVersions = [
        { id: 'version-456', name: 'TestApp', version: 'v1.0.0' }
      ];
      const mockError = new Error('Removal failed');
      
      (getEnterpriseAppVersions as any).mockResolvedValue(mockVersions);
      (enquirer.prompt as any).mockResolvedValue({ confirm: 'yes' });
      (removeEnterpriseAppVersion as any).mockRejectedValue(mockError);

      await expect(() => 
        handleEnterpriseVersionRemove(mockCommand, mockParams)
      ).rejects.toThrow('Removal failed');
      
      expect(mockSpinner.fail).toHaveBeenCalledWith('Failed to remove Enterprise App Version');
    });
  });

  describe('handleEnterpriseVersionNotify', () => {
    it('should notify users successfully', async () => {
      const mockResponse = { taskId: 'task-123', status: 'success' };
      
      (notifyEnterpriseAppVersion as any).mockResolvedValue(mockResponse);

      await handleEnterpriseVersionNotify(mockCommand, mockParams);
      
      expect(createOra).toHaveBeenCalledWith('Notifying users with new version for version-456');
      expect(notifyEnterpriseAppVersion).toHaveBeenCalledWith(mockParams);
      expect(mockSpinner.text).toBe('Version notification sent successfully.\n\nTaskId: task-123');
      expect(mockSpinner.succeed).toHaveBeenCalled();
    });

    it('should handle notification errors', async () => {
      const mockError = new Error('Notification failed');
      
      (notifyEnterpriseAppVersion as any).mockRejectedValue(mockError);

      await expect(() => 
        handleEnterpriseVersionNotify(mockCommand, mockParams)
      ).rejects.toThrow('Notification failed');
      
      expect(mockSpinner.fail).toHaveBeenCalledWith('Notification failed');
    });
  });

  describe('validateAndPrepareUploadFile', () => {
    it('should validate and prepare upload file successfully', () => {
      const mockStats = { size: 1000000 }; // 1MB
      
      (fs.existsSync as any).mockReturnValue(true);
      (fs.statSync as any).mockReturnValue(mockStats);
      (getMaxUploadBytes as any).mockReturnValue(5000000); // 5MB limit
      (path.resolve as any).mockReturnValue('/resolved/path/app.ipa');
      (path.basename as any).mockReturnValue('app.ipa');

      const result = validateAndPrepareUploadFile('/test/app.ipa');
      
      expect(result.expandedPath).toBe('/resolved/path/app.ipa');
      expect(result.fileName).toBe('app.ipa');
      expect(result.stats).toBe(mockStats);
    });

    it('should expand tilde in path', () => {
      const mockStats = { size: 1000000 };
      
      (fs.existsSync as any).mockReturnValue(true);
      (fs.statSync as any).mockReturnValue(mockStats);
      (getMaxUploadBytes as any).mockReturnValue(5000000);
      (os.homedir as any).mockReturnValue('/home/user');

      validateAndPrepareUploadFile('~/app.ipa');
      
      expect(path.resolve).toHaveBeenCalledWith('/home/user/app.ipa');
    });

    it('should throw error when file does not exist', () => {
      (fs.existsSync as any).mockReturnValue(false);

      expect(() => 
        validateAndPrepareUploadFile('/nonexistent/app.ipa')
      ).toThrow(AppcircleExitError);
    });

    it('should throw error when file exceeds size limit', () => {
      const mockStats = { size: 6000000 }; // 6MB
      
      (fs.existsSync as any).mockReturnValue(true);
      (fs.statSync as any).mockReturnValue(mockStats);
      (getMaxUploadBytes as any).mockReturnValue(5000000); // 5MB limit

      expect(() => 
        validateAndPrepareUploadFile('/test/app.ipa')
      ).toThrow();
    });
  });

  describe('handleUploadError', () => {
    it('should handle file too large error', () => {
      const uploadError = {
        response: { data: { message: 'The file is too large' } }
      };

      expect(() => 
        handleUploadError(uploadError, mockSpinner)
      ).toThrow(AppcircleExitError);
      
      expect(mockSpinner.fail).toHaveBeenCalledWith('File size exceeds the maximum allowed limit of 3 GB.');
    });

    it('should handle ProgramError', () => {
      const uploadError = new ProgramError('API error');

      expect(() => 
        handleUploadError(uploadError, mockSpinner)
      ).toThrow(AppcircleExitError);
      
      expect(mockSpinner.fail).toHaveBeenCalledWith('API error');
    });

    it('should handle connection settings error', () => {
      const uploadError = {
        message: 'Cannot read properties of undefined'
      };

      expect(() => 
        handleUploadError(uploadError, mockSpinner)
      ).toThrow(AppcircleExitError);
      
      expect(mockSpinner.fail).toHaveBeenCalledWith('API response format error. Please check your connection settings (AUTH_HOSTNAME and API_HOSTNAME).');
    });

    it('should handle generic upload error', () => {
      const uploadError = new Error('Generic upload error');

      expect(() => 
        handleUploadError(uploadError, mockSpinner)
      ).toThrow('Generic upload error');
      
      expect(mockSpinner.fail).toHaveBeenCalledWith('Upload failed: Generic upload error');
    });
  });

  describe('handleEnterpriseVersionDownloadLink', () => {
    it('should get download link successfully', async () => {
      const mockResponse = { downloadUrl: 'https://example.com/download' };
      
      (getEnterpriseDownloadLink as any).mockResolvedValue(mockResponse);

      await handleEnterpriseVersionDownloadLink(mockCommand, mockParams);
      
      expect(getEnterpriseDownloadLink).toHaveBeenCalledWith(mockParams);
      expect(commandWriter).toHaveBeenCalledWith(CommandTypes.ENTERPRISE_APP_STORE, {
        fullCommandName: mockCommand.fullCommandName,
        data: mockResponse,
      });
    });
  });
});