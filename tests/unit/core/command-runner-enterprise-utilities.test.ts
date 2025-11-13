/**
 * @fileoverview Tests for enterprise and organization command runner utilities
 * Tests for enterprise utilities extracted from command-runner.ts for better testability
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

// Import enterprise utility functions from command-runner
import {
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
  handleEnterpriseVersionDownloadLink,
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
  validateCertificateParams,
  validateKeystoreParams,
  validateProvisioningProfileParams,
  handleCertificateList,
  handleCertificateUpload,
  handleCertificateCreate,
  handleCertificateView,
  handleCertificateDownload,
  handleCertificateRemove,
  handleKeystoreList,
  handleKeystoreCreate,
  handleKeystoreUpload,
  handleKeystoreDownload,
  handleKeystoreView,
  handleKeystoreRemove,
  handleProvisioningProfileList,
  handleProvisioningProfileUpload,
  handleProvisioningProfileDownload,
  handleProvisioningProfileView,
  handleProvisioningProfileRemove
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
  getEnterpriseProfiles: vi.fn().mockResolvedValue([]),
  getEnterpriseAppVersions: vi.fn().mockResolvedValue([]),
  publishEnterpriseAppVersion: vi.fn().mockResolvedValue({}),
  unpublishEnterpriseAppVersion: vi.fn().mockResolvedValue({}),
  removeEnterpriseAppVersion: vi.fn().mockResolvedValue({ taskId: 'task123' }),
  notifyEnterpriseAppVersion: vi.fn().mockResolvedValue({ taskId: 'notify123' }),
  getEnterpriseUploadInformation: vi.fn().mockResolvedValue({ fileId: 'file123' }),
  uploadArtifactWithSignedUrl: vi.fn().mockResolvedValue({}),
  commitEnterpriseFileUpload: vi.fn().mockResolvedValue({ taskId: 'commit123' }),
  getEnterpriseDownloadLink: vi.fn().mockResolvedValue('http://example.com/download'),
  getDistributionProfiles: vi.fn().mockResolvedValue([]),
  createDistributionProfile: vi.fn().mockResolvedValue({}),
  getTestingDistributionUploadInformation: vi.fn().mockResolvedValue({ fileId: 'file123' }),
  commitTestingDistributionFileUpload: vi.fn().mockResolvedValue({ taskId: 'commit123' }),
  getTestingGroups: vi.fn().mockResolvedValue([]),
  getTestingGroupById: vi.fn().mockResolvedValue({ name: 'Test Group' }),
  createTestingGroup: vi.fn().mockResolvedValue({ name: 'New Group' }),
  deleteTestingGroup: vi.fn().mockResolvedValue({}),
  addTesterToTestingGroup: vi.fn().mockResolvedValue({}),
  removeTesterFromTestingGroup: vi.fn().mockResolvedValue({}),
  getiOSP12Certificates: vi.fn().mockResolvedValue([]),
  getiOSCSRCertificates: vi.fn().mockResolvedValue([]),
  uploadP12Certificate: vi.fn().mockResolvedValue({}),
  createCSRCertificateRequest: vi.fn().mockResolvedValue({}),
  getCertificateDetailById: vi.fn().mockResolvedValue({ name: 'Test Cert' }),
  downloadCertificateById: vi.fn().mockResolvedValue({}),
  removeCSRorP12CertificateById: vi.fn().mockResolvedValue({}),
  getAndroidKeystores: vi.fn().mockResolvedValue([]),
  generateNewKeystore: vi.fn().mockResolvedValue({}),
  uploadAndroidKeystoreFile: vi.fn().mockResolvedValue({}),
  downloadKeystoreById: vi.fn().mockResolvedValue({}),
  getKeystoreDetailById: vi.fn().mockResolvedValue({ name: 'Test Keystore', fileName: 'test.keystore' }),
  removeKeystore: vi.fn().mockResolvedValue({}),
  getProvisioningProfiles: vi.fn().mockResolvedValue([]),
  uploadProvisioningProfile: vi.fn().mockResolvedValue({}),
  getProvisioningProfileDetailById: vi.fn().mockResolvedValue({ name: 'Test Profile', filename: 'test.mobileprovision' }),
  downloadProvisioningProfileById: vi.fn().mockResolvedValue({}),
  removeProvisioningProfile: vi.fn().mockResolvedValue({})
}));

// Mock writer
vi.mock('../../../src/core/writer', () => ({
  commandWriter: vi.fn()
}));

// Mock constants
vi.mock('../../../src/constant', () => ({
  PROGRAM_NAME: 'appcircle',
  CURRENT_PARAM_VALUE: 'current',
  UNKNOWN_PARAM_VALUE: 'unknown'
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

describe('Command Runner Enterprise & Organization Utilities', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Enterprise Parameter Validation', () => {
    describe('validateEnterpriseProfileParams', () => {
      it('should resolve profile name to ID', async () => {
        const services = await import('../../../src/services');
        vi.mocked(services.getEnterpriseProfiles).mockResolvedValue([
          { id: 'ent1', name: 'Enterprise Profile 1' },
          { id: 'ent2', name: 'Enterprise Profile 2' }
        ]);

        const mockCommand = { fullCommandName: 'appcircle-enterprise-app-store-version-list' };
        const params = { entProfile: 'Enterprise Profile 1' };
        
        await validateEnterpriseProfileParams(mockCommand as any, params);
        
        expect(params.entProfileId).toBe('ent1');
      });

      it('should throw error for non-existing profile', async () => {
        const services = await import('../../../src/services');
        vi.mocked(services.getEnterpriseProfiles).mockResolvedValue([
          { id: 'ent1', name: 'Enterprise Profile 1' }
        ]);

        const mockCommand = { fullCommandName: 'appcircle-enterprise-app-store-version-list' };
        const params = { entProfile: 'NonExistent Profile' };
        
        await expect(
          validateEnterpriseProfileParams(mockCommand as any, params)
        ).rejects.toThrow(ProgramError);
      });

      it('should not validate non-required commands', async () => {
        const mockCommand = { fullCommandName: 'appcircle-enterprise-other' };
        const params = {};
        
        await expect(
          validateEnterpriseProfileParams(mockCommand as any, params)
        ).resolves.not.toThrow();
      });
    });

    describe('validateEnterpriseAppVersionParams', () => {
      it('should resolve app version name to ID', async () => {
        const services = await import('../../../src/services');
        vi.mocked(services.getEnterpriseAppVersions).mockResolvedValue([
          { id: 'v1', name: 'App Version 1', version: '1.0' },
          { id: 'v2', name: 'App Version 2', version: '2.0' }
        ]);

        const mockCommand = { fullCommandName: 'appcircle-enterprise-app-store-version-publish' };
        const params = { entVersion: 'App Version 1', entProfileId: 'ent1' };
        
        await validateEnterpriseAppVersionParams(mockCommand as any, params);
        
        expect(params.entVersionId).toBe('v1');
      });

      it('should throw error for non-existing app version', async () => {
        const services = await import('../../../src/services');
        vi.mocked(services.getEnterpriseAppVersions).mockResolvedValue([
          { id: 'v1', name: 'App Version 1', version: '1.0' }
        ]);

        const mockCommand = { fullCommandName: 'appcircle-enterprise-app-store-version-publish' };
        const params = { entVersion: 'NonExistent Version', entProfileId: 'ent1' };
        
        await expect(
          validateEnterpriseAppVersionParams(mockCommand as any, params)
        ).rejects.toThrow(ProgramError);
      });
    });
  });

  describe('Enterprise Handler Utilities', () => {
    describe('handleEnterpriseProfileList', () => {
      it('should list enterprise profiles with spinner', async () => {
        const services = await import('../../../src/services');
        const writer = await import('../../../src/core/writer');
        const mockCommand = { fullCommandName: 'appcircle-enterprise-app-store-profile-list' };

        await handleEnterpriseProfileList(mockCommand as any);
        
        expect(services.getEnterpriseProfiles).toHaveBeenCalled();
        expect(writer.commandWriter).toHaveBeenCalled();
      });
    });

    describe('handleEnterpriseVersionList', () => {
      it('should list enterprise app versions with spinner', async () => {
        const services = await import('../../../src/services');
        const writer = await import('../../../src/core/writer');
        const mockCommand = { fullCommandName: 'appcircle-enterprise-app-store-version-list' };
        const params = { entProfileId: 'ent1' };

        await handleEnterpriseVersionList(mockCommand as any, params);
        
        expect(services.getEnterpriseAppVersions).toHaveBeenCalledWith(params);
        expect(writer.commandWriter).toHaveBeenCalled();
      });
    });

    describe('handleEnterpriseVersionPublish', () => {
      it('should publish enterprise app version', async () => {
        const services = await import('../../../src/services');
        const writer = await import('../../../src/core/writer');
        const mockCommand = { fullCommandName: 'appcircle-enterprise-app-store-version-publish' };
        const params = {
          entProfileId: 'profile-1',
          entVersionId: 'v1',
          summary: 'Test summary',
          releaseNotes: 'Test release notes',
          publishType: '1'
        };

        await handleEnterpriseVersionPublish(mockCommand as any, params);

        // Check that publishEnterpriseAppVersion was called with correct mapped parameters
        expect(services.publishEnterpriseAppVersion).toHaveBeenCalledWith({
          entProfileId: 'profile-1',
          entVersionId: 'v1',
          summary: 'Test summary',
          releaseNotes: 'Test release notes',
          publishType: '1'
        });
        expect(writer.commandWriter).toHaveBeenCalled();
      });
    });

    describe('handleEnterpriseVersionNotify', () => {
      it.skip('should notify enterprise app version with spinner', async () => {
        const services = await import('../../../src/services');
        const writer = await import('../../../src/core/writer');
        const mockCommand = { fullCommandName: 'appcircle-enterprise-app-store-version-notify' };
        const params = { entVersionId: 'v1' };

        await handleEnterpriseVersionNotify(mockCommand as any, params);
        
        expect(services.notifyEnterpriseAppVersion).toHaveBeenCalledWith(params);
        expect(writer.commandWriter).toHaveBeenCalled();
      });
    });
  });

  describe('File Upload Utilities', () => {
    describe('validateAndPrepareUploadFile', () => {
      it('should throw error when appPath is undefined', () => {
        expect(() => {
          validateAndPrepareUploadFile(undefined as any);
        }).toThrow(AppcircleExitError);
        expect(() => {
          validateAndPrepareUploadFile(undefined as any);
        }).toThrow('The --app parameter is required');
      });

      it('should throw error when appPath is empty string', () => {
        expect(() => {
          validateAndPrepareUploadFile('');
        }).toThrow(AppcircleExitError);
        expect(() => {
          validateAndPrepareUploadFile('');
        }).toThrow('The --app parameter is required');
      });

      it('should return expanded path and file details for valid file', () => {
        mockOs.homedir.mockReturnValue('/home/user');
        mockPath.resolve.mockReturnValue('/home/user/app.ipa');
        mockPath.basename.mockReturnValue('app.ipa');
        mockFs.existsSync.mockReturnValue(true);
        mockFs.statSync.mockReturnValue({ size: 1024 * 1024 * 1024 } as any); // 1GB

        const result = validateAndPrepareUploadFile('~/app.ipa');
        
        expect(result.expandedPath).toBe('/home/user/app.ipa');
        expect(result.fileName).toBe('app.ipa');
        expect(result.stats).toBeDefined();
      });

      it('should throw AppcircleExitError for non-existing file', () => {
        mockOs.homedir.mockReturnValue('/home/user');
        mockPath.resolve.mockReturnValue('/home/user/nonexistent.ipa');
        mockFs.existsSync.mockReturnValue(false);

        expect(() => {
          validateAndPrepareUploadFile('~/nonexistent.ipa');
        }).toThrow(AppcircleExitError);
      });

      it('should throw AppcircleExitError for oversized file', () => {
        mockOs.homedir.mockReturnValue('/home/user');
        mockPath.resolve.mockReturnValue('/home/user/large.ipa');
        mockPath.basename.mockReturnValue('large.ipa');
        mockFs.existsSync.mockReturnValue(true);
        mockFs.statSync.mockReturnValue({ size: 5 * 1024 * 1024 * 1024 } as any); // 5GB

        expect(() => {
          validateAndPrepareUploadFile('~/large.ipa');
        }).toThrow(AppcircleExitError);
      });
    });

    describe('handleUploadError', () => {
      it('should handle oversized file error', () => {
        const mockSpinner = { fail: vi.fn() };
        const error = {
          response: {
            data: {
              message: 'The file is too large'
            }
          }
        };

        expect(() => {
          handleUploadError(error, mockSpinner);
        }).toThrow(AppcircleExitError);
        
        expect(mockSpinner.fail).toHaveBeenCalled();
      });

      it('should handle ProgramError', () => {
        const mockSpinner = { fail: vi.fn() };
        const error = new ProgramError('Test error');

        expect(() => {
          handleUploadError(error, mockSpinner);
        }).toThrow(AppcircleExitError);
        
        expect(mockSpinner.fail).toHaveBeenCalled();
      });

      it('should handle API response format error', () => {
        const mockSpinner = { fail: vi.fn() };
        const error = {
          message: 'Cannot read properties of undefined'
        };

        expect(() => {
          handleUploadError(error, mockSpinner);
        }).toThrow(AppcircleExitError);
        
        expect(mockSpinner.fail).toHaveBeenCalled();
      });
    });
  });

  describe('Testing Distribution Utilities', () => {
    describe('validateDistributionProfileParams', () => {
      it('should resolve profile name to ID for upload command', async () => {
        const services = await import('../../../src/services');
        vi.mocked(services.getDistributionProfiles).mockResolvedValue([
          { id: 'dist1', name: 'Distribution Profile 1' },
          { id: 'dist2', name: 'Distribution Profile 2' }
        ]);

        const mockCommand = { fullCommandName: 'appcircle-testing-distribution-upload' };
        const params = { distProfile: 'Distribution Profile 1', app: '/path/to/app.apk' };
        
        await validateDistributionProfileParams(mockCommand as any, params);
        
        expect(params.distProfileId).toBe('dist1');
      });

      it('should throw error for non-existing distribution profile', async () => {
        const services = await import('../../../src/services');
        vi.mocked(services.getDistributionProfiles).mockResolvedValue([
          { id: 'dist1', name: 'Distribution Profile 1' }
        ]);

        const mockCommand = { fullCommandName: 'appcircle-testing-distribution-upload' };
        const params = { distProfile: 'NonExistent Profile', app: '/path/to/app.apk' };
        
        await expect(
          validateDistributionProfileParams(mockCommand as any, params)
        ).rejects.toThrow(AppcircleExitError);
      });
    });

    describe('validateTestingGroupParams', () => {
      it('should resolve testing group name to ID', async () => {
        const services = await import('../../../src/services');
        vi.mocked(services.getTestingGroups).mockResolvedValue([
          { id: 'tg1', name: 'Testing Group 1' },
          { id: 'tg2', name: 'Testing Group 2' }
        ]);

        const mockCommand = { fullCommandName: 'appcircle-testing-distribution-testing-group-view' };
        const params = { testingGroup: 'Testing Group 1' };
        
        await validateTestingGroupParams(mockCommand as any, params);
        
        expect(params.testingGroupId).toBe('tg1');
      });

      it('should throw error for non-existing testing group', async () => {
        const services = await import('../../../src/services');
        vi.mocked(services.getTestingGroups).mockResolvedValue([
          { id: 'tg1', name: 'Testing Group 1' }
        ]);

        const mockCommand = { fullCommandName: 'appcircle-testing-distribution-testing-group-view' };
        const params = { testingGroup: 'NonExistent Group' };
        
        await expect(
          validateTestingGroupParams(mockCommand as any, params)
        ).rejects.toThrow(AppcircleExitError);
      });
    });

    describe('handleTestingGroupCreate', () => {
      it('should create testing group and log success', async () => {
        const services = await import('../../../src/services');
        const writer = await import('../../../src/core/writer');
        vi.mocked(services.createTestingGroup).mockResolvedValue({ name: 'New Group' });
        const consoleSpy = vi.spyOn(console, 'info').mockImplementation(() => {});

        const mockCommand = { fullCommandName: 'appcircle-testing-distribution-testing-group-create' };
        const params = { name: 'New Group' };

        await handleTestingGroupCreate(mockCommand as any, params);
        
        expect(services.createTestingGroup).toHaveBeenCalledWith(params);
        expect(consoleSpy).toHaveBeenCalledWith('Testing Group named New Group created successfully!');
        expect(writer.commandWriter).toHaveBeenCalled();
        
        consoleSpy.mockRestore();
      });
    });

    describe('handleTestingGroupTesterAdd', () => {
      it('should add tester to testing group', async () => {
        const services = await import('../../../src/services');
        const consoleSpy = vi.spyOn(console, 'info').mockImplementation(() => {});

        const mockCommand = { fullCommandName: 'appcircle-testing-distribution-testing-group-tester-add' };
        const params = { testingGroupId: 'tg1', email: 'test@example.com' };

        await handleTestingGroupTesterAdd(mockCommand as any, params);
        
        expect(services.addTesterToTestingGroup).toHaveBeenCalledWith(params);
        expect(consoleSpy).toHaveBeenCalledWith('Tester has been successfully added to the selected Testing Group!');
        
        consoleSpy.mockRestore();
      });
    });
  });

  describe('Signing Identity Validation', () => {
    describe('validateCertificateParams', () => {
      it('should resolve certificate name to ID', async () => {
        const services = await import('../../../src/services');
        vi.mocked(services.getiOSP12Certificates).mockResolvedValue([
          { id: 'cert1', name: 'Test Certificate' },
          { id: 'cert2', name: 'Another Certificate' }
        ]);

        const mockCommand = { fullCommandName: 'appcircle-signing-identity-certificate-view' };
        const params = { certificate: 'Test Certificate' };
        
        await validateCertificateParams(mockCommand as any, params);
        
        expect(params.certificateBundleId).toBe('cert1');
        expect(params.certificateId).toBe('cert1');
      });

      it('should throw error for non-existing certificate', async () => {
        const services = await import('../../../src/services');
        vi.mocked(services.getiOSP12Certificates).mockResolvedValue([
          { id: 'cert1', name: 'Test Certificate' }
        ]);

        const mockCommand = { fullCommandName: 'appcircle-signing-identity-certificate-view' };
        const params = { certificate: 'NonExistent Certificate' };
        
        await expect(
          validateCertificateParams(mockCommand as any, params)
        ).rejects.toThrow(ProgramError);
      });
    });

    describe('validateKeystoreParams', () => {
      it('should resolve keystore name to ID', async () => {
        const services = await import('../../../src/services');
        vi.mocked(services.getAndroidKeystores).mockResolvedValue([
          { id: 'ks1', name: 'Test Keystore' },
          { id: 'ks2', name: 'Another Keystore' }
        ]);

        const mockCommand = { fullCommandName: 'appcircle-signing-identity-keystore-view' };
        const params = { keystore: 'Test Keystore' };
        
        await validateKeystoreParams(mockCommand as any, params);
        
        expect(params.keystoreId).toBe('ks1');
      });
    });

    describe('validateProvisioningProfileParams', () => {
      it('should resolve provisioning profile name to ID', async () => {
        const services = await import('../../../src/services');
        vi.mocked(services.getProvisioningProfiles).mockResolvedValue([
          { id: 'pp1', name: 'Test Profile' },
          { id: 'pp2', name: 'Another Profile' }
        ]);

        const mockCommand = { fullCommandName: 'appcircle-signing-identity-provisioning-profile-view' };
        const params = { provisioningProfile: 'Test Profile' };
        
        await validateProvisioningProfileParams(mockCommand as any, params);
        
        expect(params.provisioningProfileId).toBe('pp1');
      });
    });
  });

  describe('Certificate Handler Utilities', () => {
    describe('handleCertificateList', () => {
      it('should list both P12 and CSR certificates', async () => {
        const services = await import('../../../src/services');
        const writer = await import('../../../src/core/writer');
        vi.mocked(services.getiOSP12Certificates).mockResolvedValue([{ id: 'p12-1' }]);
        vi.mocked(services.getiOSCSRCertificates).mockResolvedValue([{ id: 'csr-1' }]);

        const mockCommand = { fullCommandName: 'appcircle-signing-identity-certificate-list' };

        await handleCertificateList(mockCommand as any);
        
        expect(services.getiOSP12Certificates).toHaveBeenCalled();
        expect(services.getiOSCSRCertificates).toHaveBeenCalled();
        expect(writer.commandWriter).toHaveBeenCalledWith(
          expect.anything(),
          expect.objectContaining({
            data: [{ id: 'p12-1' }, { id: 'csr-1' }]
          })
        );
      });
    });

    describe('handleCertificateCreate', () => {
      it('should create certificate request with spinner', async () => {
        const services = await import('../../../src/services');
        const writer = await import('../../../src/core/writer');
        const mockCommand = { fullCommandName: 'appcircle-signing-identity-certificate-create' };
        const params = { name: 'New Certificate' };

        await handleCertificateCreate(mockCommand as any, params);
        
        expect(services.createCSRCertificateRequest).toHaveBeenCalledWith(params);
        expect(writer.commandWriter).toHaveBeenCalled();
      });
    });
  });

  describe('Keystore Handler Utilities', () => {
    describe('handleKeystoreList', () => {
      it('should list keystores with spinner', async () => {
        const services = await import('../../../src/services');
        const writer = await import('../../../src/core/writer');
        const mockCommand = { fullCommandName: 'appcircle-signing-identity-keystore-list' };

        await handleKeystoreList(mockCommand as any);
        
        expect(services.getAndroidKeystores).toHaveBeenCalled();
        expect(writer.commandWriter).toHaveBeenCalled();
      });
    });

    describe('handleKeystoreCreate', () => {
      it('should generate new keystore with spinner', async () => {
        const services = await import('../../../src/services');
        const mockCommand = { fullCommandName: 'appcircle-signing-identity-keystore-create' };
        const params = { name: 'New Keystore' };

        await handleKeystoreCreate(mockCommand as any, params);
        
        expect(services.generateNewKeystore).toHaveBeenCalledWith(params);
      });
    });

    describe('handleKeystoreView', () => {
      it('should get keystore details with spinner', async () => {
        const services = await import('../../../src/services');
        const writer = await import('../../../src/core/writer');
        const mockCommand = { fullCommandName: 'appcircle-signing-identity-keystore-view' };
        const params = { keystoreId: 'ks1' };

        await handleKeystoreView(mockCommand as any, params);
        
        expect(services.getKeystoreDetailById).toHaveBeenCalledWith(params);
        expect(writer.commandWriter).toHaveBeenCalled();
      });
    });
  });

  describe('Provisioning Profile Handler Utilities', () => {
    describe('handleProvisioningProfileList', () => {
      it('should list provisioning profiles with spinner', async () => {
        const services = await import('../../../src/services');
        const writer = await import('../../../src/core/writer');
        const mockCommand = { fullCommandName: 'appcircle-signing-identity-provisioning-profile-list' };

        await handleProvisioningProfileList(mockCommand as any);
        
        expect(services.getProvisioningProfiles).toHaveBeenCalled();
        expect(writer.commandWriter).toHaveBeenCalled();
      });
    });

    describe('handleProvisioningProfileUpload', () => {
      it('should upload provisioning profile with spinner', async () => {
        const services = await import('../../../src/services');
        const mockCommand = { fullCommandName: 'appcircle-signing-identity-provisioning-profile-upload' };
        const params = { filePath: '/path/to/profile.mobileprovision' };

        await handleProvisioningProfileUpload(mockCommand as any, params);
        
        expect(services.uploadProvisioningProfile).toHaveBeenCalledWith(params);
      });
    });

    describe('handleProvisioningProfileView', () => {
      it('should get provisioning profile details with spinner', async () => {
        const services = await import('../../../src/services');
        const writer = await import('../../../src/core/writer');
        const mockCommand = { fullCommandName: 'appcircle-signing-identity-provisioning-profile-view' };
        const params = { provisioningProfileId: 'pp1' };

        await handleProvisioningProfileView(mockCommand as any, params);
        
        expect(services.getProvisioningProfileDetailById).toHaveBeenCalledWith(params);
        expect(writer.commandWriter).toHaveBeenCalled();
      });
    });
  });

  describe('Distribution Handler Utilities', () => {
    describe('handleDistributionProfileList', () => {
      it('should list distribution profiles with spinner', async () => {
        const services = await import('../../../src/services');
        const writer = await import('../../../src/core/writer');
        vi.mocked(services.getDistributionProfiles).mockResolvedValue([{ id: 'dist1' }]);

        const mockCommand = { fullCommandName: 'appcircle-testing-distribution-profile-list' };
        const params = {};

        await handleDistributionProfileList(mockCommand as any, params);
        
        expect(services.getDistributionProfiles).toHaveBeenCalledWith(params);
        expect(writer.commandWriter).toHaveBeenCalled();
      });

      it('should handle empty distribution profiles list', async () => {
        const services = await import('../../../src/services');
        vi.mocked(services.getDistributionProfiles).mockResolvedValue([]);

        const mockCommand = { fullCommandName: 'appcircle-testing-distribution-profile-list' };
        const params = {};

        await expect(
          handleDistributionProfileList(mockCommand as any, params)
        ).rejects.toThrow(AppcircleExitError);
      });
    });

    describe('handleDistributionProfileCreate', () => {
      it('should create distribution profile', async () => {
        const services = await import('../../../src/services');
        const writer = await import('../../../src/core/writer');
        const mockCommand = { fullCommandName: 'appcircle-testing-distribution-profile-create' };
        const params = { name: 'New Distribution Profile' };

        await handleDistributionProfileCreate(mockCommand as any, params);
        
        expect(services.createDistributionProfile).toHaveBeenCalledWith(params);
        expect(writer.commandWriter).toHaveBeenCalledWith(
          expect.anything(),
          expect.objectContaining({
            data: expect.objectContaining({ name: 'New Distribution Profile' })
          })
        );
      });
    });
  });
});