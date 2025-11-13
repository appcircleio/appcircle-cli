/**
 * @fileoverview Unit tests for testing distribution command utilities
 * Tests the extracted testing distribution command handler utilities
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

// Mock testing distribution service functions
vi.mock('../../../src/services/index', () => ({
  getDistributionProfiles: vi.fn(),
  createDistributionProfile: vi.fn(),
  getTestingDistributionUploadInformation: vi.fn(),
  commitTestingDistributionFileUpload: vi.fn(),
  setDistributionProfileAutoSend: vi.fn(),
  getTestingGroups: vi.fn(),
  getTestingGroup: vi.fn(),
  getTestingGroupById: vi.fn(),
  createTestingGroup: vi.fn(),
  deleteTestingGroup: vi.fn(),
  addTesterToTestingGroup: vi.fn(),
  removeTesterFromTestingGroup: vi.fn(),
  uploadArtifactWithSignedUrl: vi.fn()
}));

// Mock utility functions
vi.mock('../../../src/utils/size-limit', () => ({
  getMaxUploadBytes: vi.fn()
}));

// Mock writer module
vi.mock('../../../src/core/writer', () => ({
  commandWriter: vi.fn()
}));

// Mock getLongDescriptionForCommand function
vi.mock('../../../src/core/command-runner', async () => {
  const actual = await vi.importActual('../../../src/core/command-runner');
  return {
    ...actual,
    getLongDescriptionForCommand: vi.fn().mockReturnValue('Mocked command description')
  };
});

// Mock console methods - setup will happen in beforeEach
let mockConsoleLog: any;
let mockConsoleError: any;
let mockConsoleInfo: any;

import { createOra } from '../../../src/utils/orahelper';
import { AppcircleExitError } from '../../../src/core/AppcircleExitError';
import { ProgramError } from '../../../src/core/ProgramError';
import enquirer from 'enquirer';
import path from 'path';
import os from 'os';
import fs from 'fs';
import {
  getDistributionProfiles,
  createDistributionProfile,
  getTestingDistributionUploadInformation,
  commitTestingDistributionFileUpload,
  setDistributionProfileAutoSend,
  getTestingGroups,
  getTestingGroupById,
  createTestingGroup,
  deleteTestingGroup,
  addTesterToTestingGroup,
  removeTesterFromTestingGroup,
  uploadArtifactWithSignedUrl
} from '../../../src/services/index';
import { getMaxUploadBytes } from '../../../src/utils/size-limit';
import { commandWriter } from '../../../src/core/writer';
import {
  getLongDescriptionForCommand,
  validateDistributionProfileParams,
  validateTestingGroupParams,
  handleDistributionProfileList,
  handleDistributionProfileCreate,
  handleDistributionUpload,
  handleDistributionProfileAutoSend,
  handleTestingGroupList,
  handleTestingGroupView,
  handleTestingGroupCreate,
  handleTestingGroupRemove,
  handleTestingGroupTesterAdd,
  handleTestingGroupTesterRemove,
  validateAndPrepareUploadFile,
  handleUploadError
} from '../../../src/core/command-runner';

const CommandTypes = {
  TESTING_DISTRIBUTION: 'testing-distribution'
};

describe('Testing Distribution Command Utilities', () => {
  let mockSpinner: any;
  let mockCommand: any;
  let mockParams: any;

  beforeEach(() => {
    vi.clearAllMocks();
    
    // Set up console mocks fresh for each test
    mockConsoleLog = vi.spyOn(console, 'log').mockImplementation(() => {});
    mockConsoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
    mockConsoleInfo = vi.spyOn(console, 'info').mockImplementation(() => {});
    
    mockSpinner = {
      start: vi.fn().mockReturnThis(),
      stop: vi.fn(),
      succeed: vi.fn(),
      fail: vi.fn(),
      text: ''
    };
    (createOra as any).mockReturnValue(mockSpinner);

    mockCommand = {
      fullCommandName: 'appcircle-testing-distribution-profile-list'
    };

    mockParams = {
      distProfileId: 'profile-123',
      testingGroupId: 'group-456',
      app: '/path/to/app.apk'
    };
  });

  afterEach(() => {
    // Restore console methods
    mockConsoleLog?.mockRestore?.();
    mockConsoleError?.mockRestore?.();
    mockConsoleInfo?.mockRestore?.();
    vi.resetAllMocks();
  });

  describe('validateDistributionProfileParams', () => {
    it('should pass when profile validation not needed', async () => {
      mockCommand.fullCommandName = 'appcircle-testing-distribution-other-command';
      
      await expect(() => 
        validateDistributionProfileParams(mockCommand, mockParams)
      ).not.toThrow();
    });

    it('should pass when profile ID is provided for upload command', async () => {
      mockCommand.fullCommandName = 'appcircle-testing-distribution-upload';
      
      await expect(() => 
        validateDistributionProfileParams(mockCommand, mockParams)
      ).not.toThrow();
    });

    it('should resolve profile name to ID for upload command', async () => {
      mockCommand.fullCommandName = 'appcircle-testing-distribution-upload';
      mockParams = { distProfile: 'TestProfile', app: '/path/to/app.apk' };
      
      (getDistributionProfiles as any).mockResolvedValue([
        { id: 'profile-123', name: 'TestProfile' },
        { id: 'profile-456', name: 'OtherProfile' }
      ]);

      await validateDistributionProfileParams(mockCommand, mockParams);
      
      expect(mockParams.distProfileId).toBe('profile-123');
    });

    it('should throw error when profile name not found', async () => {
      mockCommand.fullCommandName = 'appcircle-testing-distribution-upload';
      mockParams = { distProfile: 'NonExistentProfile', app: '/path/to/app.apk' };
      
      (getDistributionProfiles as any).mockResolvedValue([
        { id: 'profile-123', name: 'TestProfile' }
      ]);

      await expect(() => 
        validateDistributionProfileParams(mockCommand, mockParams)
      ).rejects.toThrow(AppcircleExitError);
    });

    it('should throw error when no profile parameters provided for upload', async () => {
      mockCommand.fullCommandName = 'appcircle-testing-distribution-upload';
      mockParams = {};
      
      (getLongDescriptionForCommand as any).mockReturnValue('Command help text');

      await expect(() => 
        validateDistributionProfileParams(mockCommand, mockParams)
      ).rejects.toThrow(AppcircleExitError);
    });
  });

  describe('validateTestingGroupParams', () => {
    it('should pass when testing group validation not needed', async () => {
      mockCommand.fullCommandName = 'appcircle-testing-distribution-other-command';
      
      await expect(() => 
        validateTestingGroupParams(mockCommand, mockParams)
      ).not.toThrow();
    });

    it('should pass when testing group ID is provided', async () => {
      mockCommand.fullCommandName = 'appcircle-testing-distribution-testing-group-view';
      
      await expect(() => 
        validateTestingGroupParams(mockCommand, mockParams)
      ).not.toThrow();
    });

    it('should resolve testing group name to ID', async () => {
      mockCommand.fullCommandName = 'appcircle-testing-distribution-testing-group-view';
      mockParams = { testingGroup: 'TestGroup' };
      
      (getTestingGroups as any).mockResolvedValue([
        { id: 'group-123', name: 'TestGroup' },
        { id: 'group-456', name: 'OtherGroup' }
      ]);

      await validateTestingGroupParams(mockCommand, mockParams);
      
      expect(mockParams.testingGroupId).toBe('group-123');
    });

    it('should throw error when testing group name not found', async () => {
      mockCommand.fullCommandName = 'appcircle-testing-distribution-testing-group-view';
      mockParams = { testingGroup: 'NonExistentGroup' };
      
      (getTestingGroups as any).mockResolvedValue([
        { id: 'group-123', name: 'TestGroup' }
      ]);

      await expect(() => 
        validateTestingGroupParams(mockCommand, mockParams)
      ).rejects.toThrow(AppcircleExitError);
    });
  });

  describe('handleDistributionProfileList', () => {
    it('should list distribution profiles successfully', async () => {
      const mockProfiles = [
        { id: 'profile-123', name: 'Profile1' },
        { id: 'profile-456', name: 'Profile2' }
      ];
      
      (getDistributionProfiles as any).mockResolvedValue(mockProfiles);

      await handleDistributionProfileList(mockCommand, mockParams);
      
      expect(createOra).toHaveBeenCalledWith('Listing Distribution Profiles...');
      expect(mockSpinner.start).toHaveBeenCalled();
      expect(mockSpinner.stop).toHaveBeenCalled();
      expect(commandWriter).toHaveBeenCalledWith(CommandTypes.TESTING_DISTRIBUTION, {
        fullCommandName: mockCommand.fullCommandName,
        data: mockProfiles,
      });
    });

    it('should handle empty profile list', async () => {
      (getDistributionProfiles as any).mockResolvedValue([]);

      await expect(() => 
        handleDistributionProfileList(mockCommand, mockParams)
      ).rejects.toThrow(AppcircleExitError);
      
      expect(mockSpinner.fail).toHaveBeenCalled();
    });
  });

  describe('handleDistributionProfileCreate', () => {
    it('should create distribution profile successfully', async () => {
      const mockResponse = { id: 'new-profile-123' };
      mockParams = { name: 'NewProfile' };
      
      (createDistributionProfile as any).mockResolvedValue(mockResponse);

      await handleDistributionProfileCreate(mockCommand, mockParams);
      
      expect(createDistributionProfile).toHaveBeenCalledWith(mockParams);
      expect(commandWriter).toHaveBeenCalledWith(CommandTypes.TESTING_DISTRIBUTION, {
        fullCommandName: mockCommand.fullCommandName,
        data: { ...mockResponse, name: mockParams.name },
      });
    });
  });

  describe('handleDistributionUpload', () => {
    it('should upload app successfully', async () => {
      const mockProfiles = [{ id: 'profile-123', name: 'TestProfile' }];
      const mockUploadResponse = { fileId: 'file-123' };
      const mockCommitResponse = { taskId: 'task-456' };
      
      mockParams = { distProfileId: 'profile-123', app: '/test/app.ipa', message: 'Release notes' };
      
      (getDistributionProfiles as any).mockResolvedValue(mockProfiles);
      (getTestingDistributionUploadInformation as any).mockResolvedValue(mockUploadResponse);
      (uploadArtifactWithSignedUrl as any).mockResolvedValue({});
      (commitTestingDistributionFileUpload as any).mockResolvedValue(mockCommitResponse);
      
      // Mock file validation utilities
      const mockStats = { size: 1000000 }; // 1MB
      (fs.existsSync as any).mockReturnValue(true);
      (fs.statSync as any).mockReturnValue(mockStats);
      (getMaxUploadBytes as any).mockReturnValue(5000000); // 5MB limit
      (path.resolve as any).mockReturnValue('/resolved/test/app.ipa');
      (path.basename as any).mockReturnValue('app.ipa');

      await handleDistributionUpload(mockCommand, mockParams);
      
      expect(getTestingDistributionUploadInformation).toHaveBeenCalledWith({
        fileName: 'app.ipa',
        fileSize: 1000000,
        distProfileId: 'profile-123',
      });
      expect(uploadArtifactWithSignedUrl).toHaveBeenCalled();
      expect(commitTestingDistributionFileUpload).toHaveBeenCalledWith({
        fileId: 'file-123',
        fileName: 'app.ipa',
        distProfileId: 'profile-123'
      });
      expect(mockSpinner.succeed).toHaveBeenCalled();
    });

    it('should handle upload errors', async () => {
      const mockProfiles = [{ id: 'profile-123', name: 'TestProfile' }];
      const mockUploadResponse = { fileId: 'file-123' };
      const uploadError = new Error('Upload failed');
      
      mockParams = { distProfileId: 'profile-123', app: '/test/app.ipa' };
      
      (getDistributionProfiles as any).mockResolvedValue(mockProfiles);
      (getTestingDistributionUploadInformation as any).mockResolvedValue(mockUploadResponse);
      (uploadArtifactWithSignedUrl as any).mockRejectedValue(uploadError);
      
      // Mock file validation utilities
      const mockStats = { size: 1000000 };
      (fs.existsSync as any).mockReturnValue(true);
      (fs.statSync as any).mockReturnValue(mockStats);
      (getMaxUploadBytes as any).mockReturnValue(5000000);
      (path.resolve as any).mockReturnValue('/resolved/test/app.ipa');
      (path.basename as any).mockReturnValue('app.ipa');

      await expect(() => 
        handleDistributionUpload(mockCommand, mockParams)
      ).rejects.toThrow('Upload failed');
    });
  });

  describe('handleTestingGroupList', () => {
    it('should list testing groups successfully', async () => {
      const mockGroups = [
        { id: 'group-123', name: 'Group1' },
        { id: 'group-456', name: 'Group2' }
      ];
      
      (getTestingGroups as any).mockResolvedValue(mockGroups);

      await handleTestingGroupList(mockCommand);
      
      expect(createOra).toHaveBeenCalledWith('Listing Testing Groups...');
      expect(mockSpinner.start).toHaveBeenCalled();
      expect(mockSpinner.stop).toHaveBeenCalled();
      expect(commandWriter).toHaveBeenCalledWith(CommandTypes.TESTING_DISTRIBUTION, {
        fullCommandName: mockCommand.fullCommandName,
        data: mockGroups,
      });
    });
  });

  describe('handleTestingGroupView', () => {
    it('should view testing group successfully', async () => {
      const mockGroup = { id: 'group-123', name: 'TestGroup', testers: [] };
      
      (getTestingGroupById as any).mockResolvedValue(mockGroup);

      await handleTestingGroupView(mockCommand, mockParams);
      
      expect(createOra).toHaveBeenCalledWith('Getting Testing Group...');
      expect(getTestingGroupById).toHaveBeenCalledWith({ testingGroupId: mockParams.testingGroupId });
      expect(commandWriter).toHaveBeenCalledWith(CommandTypes.TESTING_DISTRIBUTION, {
        fullCommandName: mockCommand.fullCommandName,
        data: mockGroup,
      });
    });
  });

  describe('handleTestingGroupCreate', () => {
    it('should create testing group successfully', async () => {
      const mockResponse = { id: 'new-group-123', name: 'NewGroup' };
      mockParams = { name: 'NewGroup' };
      
      (createTestingGroup as any).mockResolvedValue(mockResponse);

      await handleTestingGroupCreate(mockCommand, mockParams);
      
      expect(createTestingGroup).toHaveBeenCalledWith(mockParams);
      expect(mockConsoleInfo).toHaveBeenCalledWith(expect.stringContaining('Testing Group named NewGroup created successfully!'));
    });
  });

  describe('handleTestingGroupRemove', () => {
    it('should remove testing group when user confirms', async () => {
      const mockGroup = { id: 'group-456', name: 'TestGroup' };
      
      (getTestingGroupById as any).mockResolvedValue(mockGroup);
      (enquirer.prompt as any).mockResolvedValue({ confirm: 'yes' });
      (deleteTestingGroup as any).mockResolvedValue({});

      await handleTestingGroupRemove(mockCommand, mockParams);
      
      expect(enquirer.prompt).toHaveBeenCalledWith({
        type: 'select',
        name: 'confirm',
        message: 'Are you sure you want to delete the Testing Group "TestGroup"? This action cannot be undone. (Y/n)',
        choices: [
          { name: 'yes', message: 'yes' },
          { name: 'no', message: 'no' }
        ],
        initial: 1
      });
      expect(deleteTestingGroup).toHaveBeenCalledWith({ testingGroupId: mockParams.testingGroupId });
      expect(mockSpinner.succeed).toHaveBeenCalled();
    });

    it('should cancel removal when user declines', async () => {
      const mockGroup = { id: 'group-456', name: 'TestGroup' };
      
      (getTestingGroupById as any).mockResolvedValue(mockGroup);
      (enquirer.prompt as any).mockResolvedValue({ confirm: 'no' });

      await handleTestingGroupRemove(mockCommand, mockParams);
      
      expect(mockConsoleLog).toHaveBeenCalledWith(expect.stringContaining('Testing Group deletion cancelled.'));
      expect(deleteTestingGroup).not.toHaveBeenCalled();
    });
  });

  describe('handleTestingGroupTesterAdd', () => {
    it('should add tester to testing group successfully', async () => {
      mockParams = { testingGroupId: 'group-456', email: 'test@example.com' };
      
      (addTesterToTestingGroup as any).mockResolvedValue({});

      await handleTestingGroupTesterAdd(mockCommand, mockParams);
      
      expect(addTesterToTestingGroup).toHaveBeenCalledWith(mockParams);
      expect(mockConsoleInfo).toHaveBeenCalledWith(expect.stringContaining('Tester has been successfully added'));
    });
  });

  describe('handleTestingGroupTesterRemove', () => {
    it('should remove tester when user confirms', async () => {
      mockParams = { testingGroupId: 'group-456', email: 'test@example.com' };
      
      (enquirer.prompt as any).mockResolvedValue({ confirm: 'yes' });
      (removeTesterFromTestingGroup as any).mockResolvedValue({});

      await handleTestingGroupTesterRemove(mockCommand, mockParams);
      
      expect(enquirer.prompt).toHaveBeenCalledWith({
        type: 'select',
        name: 'confirm',
        message: 'Are you sure you want to remove test@example.com from the Testing Group? This action cannot be undone. (Y/n)',
        choices: [
          { name: 'yes', message: 'yes' },
          { name: 'no', message: 'no' }
        ],
        initial: 1
      });
      expect(removeTesterFromTestingGroup).toHaveBeenCalledWith(mockParams);
      expect(mockSpinner.succeed).toHaveBeenCalled();
    });

    it('should cancel removal when user declines', async () => {
      mockParams = { testingGroupId: 'group-456', email: 'test@example.com' };
      
      (enquirer.prompt as any).mockResolvedValue({ confirm: 'no' });

      await handleTestingGroupTesterRemove(mockCommand, mockParams);
      
      expect(mockConsoleLog).toHaveBeenCalledWith(expect.stringContaining('Tester removal cancelled.'));
      expect(removeTesterFromTestingGroup).not.toHaveBeenCalled();
    });
  });
});