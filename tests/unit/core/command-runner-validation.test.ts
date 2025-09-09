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

vi.mock('../../../src/core/AppcircleExitError', () => ({
  AppcircleExitError: class AppcircleExitError extends Error {
    public code: number;
    constructor(message: string, code: number) {
      super(message);
      this.code = code;
    }
  }
}));

vi.mock('../../../src/constant', async (importOriginal) => {
  const actual = await importOriginal() as any;
  return {
    ...actual,
    PROGRAM_NAME: 'appcircle'
  };
});

// Mock service functions
vi.mock('../../../src/services', () => ({
  getEnterpriseProfiles: vi.fn(),
  getEnterpriseAppVersions: vi.fn(),
  getDistributionProfiles: vi.fn(),
  getTestingGroups: vi.fn(),
  getPublishProfiles: vi.fn(),
  getiOSP12Certificates: vi.fn(),
  getAndroidKeystores: vi.fn(),
  getProvisioningProfiles: vi.fn(),
  getAppVersions: vi.fn(),
  getPublishVariableGroups: vi.fn()
}));

// Mock long description function  
vi.mock('../../../src/core/commands', async (importOriginal) => {
  const actual = await importOriginal() as any;
  return {
    ...actual,
    getLongDescriptionForCommand: vi.fn().mockReturnValue('Mock command description')
  };
});

import {
  validateEnterpriseProfileParams,
  validateEnterpriseAppVersionParams,
  validateDistributionProfileParams,
  validateTestingGroupParams,
  validatePublishProfileParams,
  validatePublishAppVersionParams,
  validatePublishVariableGroupParams,
  validateCertificateParams,
  validateKeystoreParams,
  validateProvisioningProfileParams
} from '../../../src/core/command-runner';

import { ProgramError } from '../../../src/core/ProgramError';
import { AppcircleExitError } from '../../../src/core/AppcircleExitError';
import * as services from '../../../src/services';

describe('Command Runner Validation Functions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('validateEnterpriseProfileParams', () => {
    const mockCommand = {
      fullCommandName: 'appcircle-enterprise-app-store-version-list'
    };

    it('should pass when entProfileId is provided', async () => {
      const params = { entProfileId: 'profile-123' };
      
      await expect(validateEnterpriseProfileParams(mockCommand as any, params))
        .resolves.not.toThrow();
    });

    it('should pass when entProfile name is provided and found', async () => {
      const mockProfiles = [
        { id: 'profile-123', name: 'Test Profile' },
        { id: 'profile-456', name: 'Another Profile' }
      ];
      (services.getEnterpriseProfiles as any).mockResolvedValue(mockProfiles);
      
      const params = { entProfile: 'Test Profile' };
      
      await validateEnterpriseProfileParams(mockCommand as any, params);
      
      expect(params.entProfileId).toBe('profile-123');
    });

    it('should throw error when neither entProfileId nor entProfile provided', async () => {
      const params = {};
      
      await expect(validateEnterpriseProfileParams(mockCommand as any, params))
        .rejects.toThrow(ProgramError);
      await expect(validateEnterpriseProfileParams(mockCommand as any, params))
        .rejects.toThrow('Either --entProfileId or --entProfile parameter is required.');
    });

    it('should throw error when entProfile name not found', async () => {
      const mockProfiles = [
        { id: 'profile-123', name: 'Test Profile' }
      ];
      (services.getEnterpriseProfiles as any).mockResolvedValue(mockProfiles);
      
      const params = { entProfile: 'Non-existent Profile' };
      
      await expect(validateEnterpriseProfileParams(mockCommand as any, params))
        .rejects.toThrow(ProgramError);
      await expect(validateEnterpriseProfileParams(mockCommand as any, params))
        .rejects.toThrow('Enterprise profile with name "Non-existent Profile" not found.');
    });

    it('should skip validation for non-required commands', async () => {
      const nonRequiredCommand = { fullCommandName: 'appcircle-other-command' };
      const params = {};
      
      await expect(validateEnterpriseProfileParams(nonRequiredCommand as any, params))
        .resolves.not.toThrow();
    });
  });

  describe('validateEnterpriseAppVersionParams', () => {
    const mockCommand = {
      fullCommandName: 'appcircle-enterprise-app-store-version-publish'
    };

    it('should pass when entVersionId is provided', async () => {
      const params = { entVersionId: 'version-123' };
      
      await expect(validateEnterpriseAppVersionParams(mockCommand as any, params))
        .resolves.not.toThrow();
    });

    it('should resolve entVersion name to ID', async () => {
      const mockVersions = [
        { id: 'version-123', name: 'v1.0.0', version: '1.0.0' },
        { id: 'version-456', name: 'v2.0.0', version: '2.0.0' }
      ];
      (services.getEnterpriseAppVersions as any).mockResolvedValue(mockVersions);
      
      const params = { entVersion: 'v1.0.0', entProfileId: 'profile-123' };
      
      await validateEnterpriseAppVersionParams(mockCommand as any, params);
      
      expect(params.entVersionId).toBe('version-123');
    });

    it('should resolve by version number', async () => {
      const mockVersions = [
        { id: 'version-123', name: 'App Name', version: '1.0.0' }
      ];
      (services.getEnterpriseAppVersions as any).mockResolvedValue(mockVersions);
      
      const params = { entVersion: '1.0.0', entProfileId: 'profile-123' };
      
      await validateEnterpriseAppVersionParams(mockCommand as any, params);
      
      expect(params.entVersionId).toBe('version-123');
    });

    it('should throw error when entVersion not found', async () => {
      const mockVersions = [
        { id: 'version-123', name: 'v1.0.0', version: '1.0.0' }
      ];
      (services.getEnterpriseAppVersions as any).mockResolvedValue(mockVersions);
      
      const params = { entVersion: 'v3.0.0', entProfileId: 'profile-123' };
      
      await expect(validateEnterpriseAppVersionParams(mockCommand as any, params))
        .rejects.toThrow(ProgramError);
    });
  });

  describe('validateDistributionProfileParams', () => {
    const mockCommand = {
      fullCommandName: 'appcircle-testing-distribution-upload'
    };

    it('should pass when distProfileId is provided', async () => {
      const params = { distProfileId: 'dist-123' };
      
      await expect(validateDistributionProfileParams(mockCommand as any, params))
        .resolves.not.toThrow();
    });

    it('should resolve distProfile name to ID', async () => {
      const mockProfiles = [
        { id: 'dist-123', name: 'Test Distribution' },
        { id: 'dist-456', name: 'Prod Distribution' }
      ];
      (services.getDistributionProfiles as any).mockResolvedValue(mockProfiles);
      
      const params = { distProfile: 'Test Distribution' };
      
      await validateDistributionProfileParams(mockCommand as any, params);
      
      expect(params.distProfileId).toBe('dist-123');
    });

    it('should throw AppcircleExitError when neither parameter provided', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      const params = {};
      
      await expect(validateDistributionProfileParams(mockCommand as any, params))
        .rejects.toThrow(AppcircleExitError);
      
      consoleSpy.mockRestore();
    });

    it('should throw AppcircleExitError when distProfile not found', async () => {
      const mockProfiles = [
        { id: 'dist-123', name: 'Test Distribution' }
      ];
      (services.getDistributionProfiles as any).mockResolvedValue(mockProfiles);
      
      const params = { distProfile: 'Non-existent Distribution' };
      
      await expect(validateDistributionProfileParams(mockCommand as any, params))
        .rejects.toThrow(AppcircleExitError);
    });
  });

  describe('validateTestingGroupParams', () => {
    const mockCommand = {
      fullCommandName: 'appcircle-testing-distribution-testing-group-view'
    };

    it('should pass when testingGroupId is provided', async () => {
      const params = { testingGroupId: 'group-123' };
      
      await expect(validateTestingGroupParams(mockCommand as any, params))
        .resolves.not.toThrow();
    });

    it('should resolve testingGroup name to ID', async () => {
      const mockGroups = [
        { id: 'group-123', name: 'QA Team' },
        { id: 'group-456', name: 'Beta Testers' }
      ];
      (services.getTestingGroups as any).mockResolvedValue(mockGroups);
      
      const params = { testingGroup: 'QA Team' };
      
      await validateTestingGroupParams(mockCommand as any, params);
      
      expect(params.testingGroupId).toBe('group-123');
    });

    it('should throw error when testingGroup not found', async () => {
      const mockGroups = [
        { id: 'group-123', name: 'QA Team' }
      ];
      (services.getTestingGroups as any).mockResolvedValue(mockGroups);
      
      const params = { testingGroup: 'Non-existent Group' };
      
      await expect(validateTestingGroupParams(mockCommand as any, params))
        .rejects.toThrow(AppcircleExitError);
    });
  });

  describe('validatePublishProfileParams', () => {
    const mockCommand = {
      fullCommandName: 'appcircle-publish-start'
    };

    it('should pass when publishProfileId is provided', async () => {
      const params = { publishProfileId: 'pub-123' };
      
      await expect(validatePublishProfileParams(mockCommand as any, params))
        .resolves.not.toThrow();
    });

    it('should resolve publishProfile name to ID', async () => {
      const mockProfiles = [
        { id: 'pub-123', name: 'iOS App Store' },
        { id: 'pub-456', name: 'Google Play' }
      ];
      (services.getPublishProfiles as any).mockResolvedValue(mockProfiles);
      
      const params = { publishProfile: 'iOS App Store', platform: 'ios' };
      
      await validatePublishProfileParams(mockCommand as any, params);
      
      expect(params.publishProfileId).toBe('pub-123');
    });

    it('should throw error when publishProfile not found', async () => {
      const mockProfiles = [
        { id: 'pub-123', name: 'iOS App Store' }
      ];
      (services.getPublishProfiles as any).mockResolvedValue(mockProfiles);
      
      const params = { publishProfile: 'Non-existent Profile', platform: 'ios' };
      
      await expect(validatePublishProfileParams(mockCommand as any, params))
        .rejects.toThrow(ProgramError);
    });
  });

  describe('validatePublishAppVersionParams', () => {
    const mockCommand = {
      fullCommandName: 'appcircle-publish-profile-version-view'
    };

    it('should pass when appVersionId is provided', async () => {
      const params = { appVersionId: 'app-123' };
      
      await expect(validatePublishAppVersionParams(mockCommand as any, params))
        .resolves.not.toThrow();
    });

    it('should resolve appVersion name to ID', async () => {
      const mockVersions = [
        { id: 'app-123', fileName: 'MyApp.ipa', version: '1.0.0' },
        { id: 'app-456', fileName: 'MyApp_v2.ipa', version: '2.0.0' }
      ];
      (services.getAppVersions as any).mockResolvedValue(mockVersions);
      
      const params = { appVersion: 'MyApp.ipa', publishProfileId: 'pub-123', platform: 'ios' };
      
      await validatePublishAppVersionParams(mockCommand as any, params);
      
      expect(params.appVersionId).toBe('app-123');
    });

    it('should resolve by version number', async () => {
      const mockVersions = [
        { id: 'app-123', fileName: 'MyApp.ipa', version: '1.0.0' }
      ];
      (services.getAppVersions as any).mockResolvedValue(mockVersions);
      
      const params = { appVersion: '1.0.0', publishProfileId: 'pub-123', platform: 'ios' };
      
      await validatePublishAppVersionParams(mockCommand as any, params);
      
      expect(params.appVersionId).toBe('app-123');
    });
  });

  describe('validateCertificateParams', () => {
    const mockCommand = {
      fullCommandName: 'appcircle-signing-identity-certificate-view'
    };

    it('should pass when certificateBundleId is provided', async () => {
      const params = { certificateBundleId: 'cert-123' };
      
      await expect(validateCertificateParams(mockCommand as any, params))
        .resolves.not.toThrow();
    });

    it('should pass when certificateId is provided', async () => {
      const params = { certificateId: 'cert-123' };
      
      await expect(validateCertificateParams(mockCommand as any, params))
        .resolves.not.toThrow();
    });

    it('should resolve certificate name to IDs', async () => {
      const mockCertificates = [
        { id: 'cert-123', name: 'iOS Distribution' },
        { id: 'cert-456', name: 'iOS Development' }
      ];
      (services.getiOSP12Certificates as any).mockResolvedValue(mockCertificates);
      
      const params = { certificate: 'iOS Distribution' };
      
      await validateCertificateParams(mockCommand as any, params);
      
      expect(params.certificateBundleId).toBe('cert-123');
      expect(params.certificateId).toBe('cert-123');
    });

    it('should throw error when certificate name not found', async () => {
      const mockCertificates = [
        { id: 'cert-123', name: 'iOS Distribution' }
      ];
      (services.getiOSP12Certificates as any).mockResolvedValue(mockCertificates);
      
      const params = { certificate: 'Non-existent Certificate' };
      
      await expect(validateCertificateParams(mockCommand as any, params))
        .rejects.toThrow(ProgramError);
    });
  });

  describe('validateKeystoreParams', () => {
    const mockCommand = {
      fullCommandName: 'appcircle-signing-identity-keystore-view'
    };

    it('should pass when keystoreId is provided', async () => {
      const params = { keystoreId: 'keystore-123' };
      
      await expect(validateKeystoreParams(mockCommand as any, params))
        .resolves.not.toThrow();
    });

    it('should resolve keystore name to ID', async () => {
      const mockKeystores = [
        { id: 'keystore-123', name: 'Release Keystore' },
        { id: 'keystore-456', name: 'Debug Keystore' }
      ];
      (services.getAndroidKeystores as any).mockResolvedValue(mockKeystores);
      
      const params = { keystore: 'Release Keystore' };
      
      await validateKeystoreParams(mockCommand as any, params);
      
      expect(params.keystoreId).toBe('keystore-123');
    });

    it('should throw error when keystore name not found', async () => {
      const mockKeystores = [
        { id: 'keystore-123', name: 'Release Keystore' }
      ];
      (services.getAndroidKeystores as any).mockResolvedValue(mockKeystores);
      
      const params = { keystore: 'Non-existent Keystore' };
      
      await expect(validateKeystoreParams(mockCommand as any, params))
        .rejects.toThrow(ProgramError);
    });
  });

  describe('validateProvisioningProfileParams', () => {
    const mockCommand = {
      fullCommandName: 'appcircle-signing-identity-provisioning-profile-view'
    };

    it('should pass when provisioningProfileId is provided', async () => {
      const params = { provisioningProfileId: 'pp-123' };
      
      await expect(validateProvisioningProfileParams(mockCommand as any, params))
        .resolves.not.toThrow();
    });

    it('should resolve provisioning profile name to ID', async () => {
      const mockProfiles = [
        { id: 'pp-123', name: 'iOS Distribution Profile' },
        { id: 'pp-456', name: 'iOS Development Profile' }
      ];
      (services.getProvisioningProfiles as any).mockResolvedValue(mockProfiles);
      
      const params = { provisioningProfile: 'iOS Distribution Profile' };
      
      await validateProvisioningProfileParams(mockCommand as any, params);
      
      expect(params.provisioningProfileId).toBe('pp-123');
    });

    it('should throw error when provisioning profile name not found', async () => {
      const mockProfiles = [
        { id: 'pp-123', name: 'iOS Distribution Profile' }
      ];
      (services.getProvisioningProfiles as any).mockResolvedValue(mockProfiles);
      
      const params = { provisioningProfile: 'Non-existent Profile' };
      
      await expect(validateProvisioningProfileParams(mockCommand as any, params))
        .rejects.toThrow(ProgramError);
    });
  });

  describe('validatePublishVariableGroupParams', () => {
    const mockCommand = {
      fullCommandName: 'appcircle-publish-variable-group-view'
    };

    it('should pass when publishVariableGroupId is provided', async () => {
      const params = { publishVariableGroupId: 'pvg-123' };
      
      await expect(validatePublishVariableGroupParams(mockCommand as any, params))
        .resolves.not.toThrow();
    });

    it('should resolve variableGroup name to ID', async () => {
      const mockGroups = [
        { id: 'pvg-123', name: 'Production Variables' },
        { id: 'pvg-456', name: 'Staging Variables' }
      ];
      (services.getPublishVariableGroups as any).mockResolvedValue(mockGroups);
      
      const params = { variableGroup: 'Production Variables' };
      
      await validatePublishVariableGroupParams(mockCommand as any, params);
      
      expect(params.publishVariableGroupId).toBe('pvg-123');
    });

    it('should throw error when variableGroup not found', async () => {
      const mockGroups = [
        { id: 'pvg-123', name: 'Production Variables' }
      ];
      (services.getPublishVariableGroups as any).mockResolvedValue(mockGroups);
      
      const params = { variableGroup: 'Non-existent Group' };
      
      await expect(validatePublishVariableGroupParams(mockCommand as any, params))
        .rejects.toThrow(ProgramError);
    });

    it('should skip validation for non-required commands', async () => {
      const nonRequiredCommand = { fullCommandName: 'appcircle-other-command' };
      const params = {};
      
      await expect(validatePublishVariableGroupParams(nonRequiredCommand as any, params))
        .resolves.not.toThrow();
    });
  });
});