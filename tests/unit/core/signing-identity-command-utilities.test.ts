import { describe, it, expect, vi, beforeEach } from 'vitest';
import chalk from 'chalk';

// Mock dependencies
vi.mock('../../../src/utils/orahelper', () => ({
  createOra: vi.fn()
}));

vi.mock('../../../src/config', async () => {
  const actual = await vi.importActual('../../../src/config');
  return {
    ...actual,
    getConsoleOutputType: vi.fn().mockReturnValue('plain')
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

vi.mock('enquirer', () => ({
  default: {
    prompt: vi.fn()
  }
}));

// Mock all signing-identity services
vi.mock('../../../src/services/signing-identity', () => ({
  getiOSP12Certificates: vi.fn(),
  getiOSCSRCertificates: vi.fn(),
  getAndroidKeystores: vi.fn(),
  getProvisioningProfiles: vi.fn(),
  getCertificateDetailById: vi.fn(),
  getKeystoreDetailById: vi.fn(),
  getProvisioningProfileDetailById: vi.fn(),
  uploadP12Certificate: vi.fn(),
  createCSRCertificateRequest: vi.fn(),
  downloadCertificateById: vi.fn(),
  removeCSRorP12CertificateById: vi.fn(),
  generateNewKeystore: vi.fn(),
  uploadAndroidKeystoreFile: vi.fn(),
  downloadKeystoreById: vi.fn(),
  removeKeystore: vi.fn(),
  uploadProvisioningProfile: vi.fn(),
  downloadProvisioningProfileById: vi.fn(),
  removeProvisioningProfile: vi.fn()
}));

vi.mock('../../../src/core/writer', () => ({
  commandWriter: vi.fn()
}));

import { createOra } from '../../../src/utils/orahelper';
import enquirer from 'enquirer';
import { commandWriter } from '../../../src/core/writer';
import { ProgramError } from '../../../src/core/ProgramError';
import { CommandTypes } from '../../../src/core/commands';
import { PROGRAM_NAME } from '../../../src/constant';

import {
  getiOSP12Certificates,
  getiOSCSRCertificates,
  getAndroidKeystores,
  getProvisioningProfiles,
  getCertificateDetailById,
  getKeystoreDetailById,
  getProvisioningProfileDetailById,
  uploadP12Certificate,
  createCSRCertificateRequest,
  downloadCertificateById,
  removeCSRorP12CertificateById,
  generateNewKeystore,
  uploadAndroidKeystoreFile,
  downloadKeystoreById,
  removeKeystore,
  uploadProvisioningProfile,
  downloadProvisioningProfileById,
  removeProvisioningProfile
} from '../../../src/services/signing-identity';

import {
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

describe('Signing Identity Parameter Validation Utilities', () => {
  let mockSpinner: any;
  let mockCommand: any;

  beforeEach(() => {
    vi.clearAllMocks();
    
    mockSpinner = {
      start: vi.fn().mockReturnThis(),
      stop: vi.fn(),
      succeed: vi.fn(),
      fail: vi.fn(),
      text: ''
    };
    (createOra as any).mockReturnValue(mockSpinner);
    
    mockCommand = {
      fullCommandName: '',
      name: vi.fn().mockReturnValue('mock-command'),
      args: vi.fn().mockReturnValue([])
    };
  });

  describe('validateCertificateParams', () => {
    it('should pass validation when certificateBundleId is provided', async () => {
      mockCommand.fullCommandName = `${PROGRAM_NAME}-signing-identity-certificate-view`;
      const params = { certificateBundleId: 'cert-123' };
      
      await expect(validateCertificateParams(mockCommand, params)).resolves.toBeUndefined();
    });

    it('should pass validation when certificateId is provided', async () => {
      mockCommand.fullCommandName = `${PROGRAM_NAME}-signing-identity-certificate-view`;
      const params = { certificateId: 'cert-456' };
      
      await expect(validateCertificateParams(mockCommand, params)).resolves.toBeUndefined();
    });

    it('should resolve certificate name to ID when certificate name is provided', async () => {
      mockCommand.fullCommandName = `${PROGRAM_NAME}-signing-identity-certificate-view`;
      const params = { certificate: 'My Certificate' };
      const mockCertificates = [
        { id: 'cert-123', name: 'My Certificate' },
        { id: 'cert-456', name: 'Other Certificate' }
      ];
      
      (getiOSP12Certificates as any).mockResolvedValue(mockCertificates);
      
      await validateCertificateParams(mockCommand, params);
      
      expect(getiOSP12Certificates).toHaveBeenCalled();
      expect(params.certificateBundleId).toBe('cert-123');
      expect(params.certificateId).toBe('cert-123');
    });

    it('should throw error when certificate name is not found', async () => {
      mockCommand.fullCommandName = `${PROGRAM_NAME}-signing-identity-certificate-view`;
      const params = { certificate: 'Nonexistent Certificate' };
      const mockCertificates = [{ id: 'cert-123', name: 'My Certificate' }];
      
      (getiOSP12Certificates as any).mockResolvedValue(mockCertificates);
      
      await expect(validateCertificateParams(mockCommand, params))
        .rejects.toThrow('Certificate with name "Nonexistent Certificate" not found.');
    });

    it('should throw error when no certificate parameters are provided', async () => {
      mockCommand.fullCommandName = `${PROGRAM_NAME}-signing-identity-certificate-view`;
      const params = {};
      
      await expect(validateCertificateParams(mockCommand, params))
        .rejects.toThrow('Either --certificateBundleId, --certificateId, or --certificate parameter is required.');
    });

    it('should skip validation for non-certificate commands', async () => {
      mockCommand.fullCommandName = `${PROGRAM_NAME}-signing-identity-certificate-list`;
      const params = {};
      
      await expect(validateCertificateParams(mockCommand, params)).resolves.toBeUndefined();
    });
  });

  describe('validateKeystoreParams', () => {
    it('should pass validation when keystoreId is provided', async () => {
      mockCommand.fullCommandName = `${PROGRAM_NAME}-signing-identity-keystore-view`;
      const params = { keystoreId: 'keystore-123' };
      
      await expect(validateKeystoreParams(mockCommand, params)).resolves.toBeUndefined();
    });

    it('should resolve keystore name to ID when keystore name is provided', async () => {
      mockCommand.fullCommandName = `${PROGRAM_NAME}-signing-identity-keystore-view`;
      const params = { keystore: 'My Keystore' };
      const mockKeystores = [
        { id: 'keystore-123', name: 'My Keystore' },
        { id: 'keystore-456', name: 'Other Keystore' }
      ];
      
      (getAndroidKeystores as any).mockResolvedValue(mockKeystores);
      
      await validateKeystoreParams(mockCommand, params);
      
      expect(getAndroidKeystores).toHaveBeenCalled();
      expect(params.keystoreId).toBe('keystore-123');
    });

    it('should throw error when keystore name is not found', async () => {
      mockCommand.fullCommandName = `${PROGRAM_NAME}-signing-identity-keystore-view`;
      const params = { keystore: 'Nonexistent Keystore' };
      const mockKeystores = [{ id: 'keystore-123', name: 'My Keystore' }];
      
      (getAndroidKeystores as any).mockResolvedValue(mockKeystores);
      
      await expect(validateKeystoreParams(mockCommand, params))
        .rejects.toThrow('Keystore with name "Nonexistent Keystore" not found.');
    });

    it('should throw error when no keystore parameters are provided', async () => {
      mockCommand.fullCommandName = `${PROGRAM_NAME}-signing-identity-keystore-view`;
      const params = {};
      
      await expect(validateKeystoreParams(mockCommand, params))
        .rejects.toThrow('Either --keystoreId or --keystore parameter is required.');
    });

    it('should skip validation for non-keystore commands', async () => {
      mockCommand.fullCommandName = `${PROGRAM_NAME}-signing-identity-keystore-list`;
      const params = {};
      
      await expect(validateKeystoreParams(mockCommand, params)).resolves.toBeUndefined();
    });
  });

  describe('validateProvisioningProfileParams', () => {
    it('should pass validation when provisioningProfileId is provided', async () => {
      mockCommand.fullCommandName = `${PROGRAM_NAME}-signing-identity-provisioning-profile-view`;
      const params = { provisioningProfileId: 'profile-123' };
      
      await expect(validateProvisioningProfileParams(mockCommand, params)).resolves.toBeUndefined();
    });

    it('should resolve provisioning profile name to ID when profile name is provided', async () => {
      mockCommand.fullCommandName = `${PROGRAM_NAME}-signing-identity-provisioning-profile-view`;
      const params = { provisioningProfile: 'My Profile' };
      const mockProfiles = [
        { id: 'profile-123', name: 'My Profile' },
        { id: 'profile-456', name: 'Other Profile' }
      ];
      
      (getProvisioningProfiles as any).mockResolvedValue(mockProfiles);
      
      await validateProvisioningProfileParams(mockCommand, params);
      
      expect(getProvisioningProfiles).toHaveBeenCalled();
      expect(params.provisioningProfileId).toBe('profile-123');
    });

    it('should throw error when provisioning profile name is not found', async () => {
      mockCommand.fullCommandName = `${PROGRAM_NAME}-signing-identity-provisioning-profile-view`;
      const params = { provisioningProfile: 'Nonexistent Profile' };
      const mockProfiles = [{ id: 'profile-123', name: 'My Profile' }];
      
      (getProvisioningProfiles as any).mockResolvedValue(mockProfiles);
      
      await expect(validateProvisioningProfileParams(mockCommand, params))
        .rejects.toThrow('Provisioning profile with name "Nonexistent Profile" not found.');
    });

    it('should throw error when no provisioning profile parameters are provided', async () => {
      mockCommand.fullCommandName = `${PROGRAM_NAME}-signing-identity-provisioning-profile-view`;
      const params = {};
      
      await expect(validateProvisioningProfileParams(mockCommand, params))
        .rejects.toThrow('Either --provisioningProfileId or --provisioningProfile parameter is required.');
    });

    it('should skip validation for non-provisioning-profile commands', async () => {
      mockCommand.fullCommandName = `${PROGRAM_NAME}-signing-identity-provisioning-profile-list`;
      const params = {};
      
      await expect(validateProvisioningProfileParams(mockCommand, params)).resolves.toBeUndefined();
    });
  });
});

describe('Certificate Command Utilities', () => {
  let mockSpinner: any;
  let mockCommand: any;

  beforeEach(() => {
    vi.clearAllMocks();
    
    mockSpinner = {
      start: vi.fn().mockReturnThis(),
      stop: vi.fn(),
      succeed: vi.fn(),
      fail: vi.fn(),
      text: ''
    };
    (createOra as any).mockReturnValue(mockSpinner);
    
    mockCommand = {
      fullCommandName: `${PROGRAM_NAME}-signing-identity-certificate-list`,
      name: vi.fn().mockReturnValue('certificate'),
      args: vi.fn().mockReturnValue([])
    };
  });

  describe('handleCertificateList', () => {
    it('should list both P12 and CSR certificates', async () => {
      const mockP12Certs = [{ id: 'p12-1', name: 'P12 Cert' }];
      const mockCSRCerts = [{ id: 'csr-1', name: 'CSR Cert' }];
      
      (getiOSP12Certificates as any).mockResolvedValue(mockP12Certs);
      (getiOSCSRCertificates as any).mockResolvedValue(mockCSRCerts);
      
      await handleCertificateList(mockCommand);
      
      expect(createOra).toHaveBeenCalledWith('Listing Certificates...');
      expect(mockSpinner.start).toHaveBeenCalled();
      expect(getiOSP12Certificates).toHaveBeenCalled();
      expect(getiOSCSRCertificates).toHaveBeenCalled();
      expect(mockSpinner.stop).toHaveBeenCalled();
      expect(commandWriter).toHaveBeenCalledWith(CommandTypes.SIGNING_IDENTITY, {
        fullCommandName: mockCommand.fullCommandName,
        data: [...mockP12Certs, ...mockCSRCerts]
      });
    });
  });

  describe('handleCertificateUpload', () => {
    it('should upload certificate successfully', async () => {
      const params = { path: '/path/to/cert.p12', password: 'password' };
      const mockResponse = { id: 'cert-123', message: 'Uploaded' };
      
      (uploadP12Certificate as any).mockResolvedValue(mockResponse);
      
      await handleCertificateUpload(mockCommand, params);
      
      expect(createOra).toHaveBeenCalledWith('Try to upload the Certificate');
      expect(uploadP12Certificate).toHaveBeenCalledWith(expect.objectContaining({
        password: 'password'
      }));
      expect(commandWriter).toHaveBeenCalledWith(CommandTypes.SIGNING_IDENTITY, {
        fullCommandName: mockCommand.fullCommandName,
        data: mockResponse
      });
      expect(mockSpinner.succeed).toHaveBeenCalled();
    });

    it('should expand tilde in certificate path', async () => {
      const params = { path: '~/Downloads/cert.p12', password: 'password' };
      const mockResponse = { id: 'cert-123', message: 'Uploaded' };
      
      (uploadP12Certificate as any).mockResolvedValue(mockResponse);
      
      await handleCertificateUpload(mockCommand, params);
      
      expect(uploadP12Certificate).toHaveBeenCalledWith(expect.objectContaining({
        path: expect.not.stringContaining('~'),
        password: 'password'
      }));
      expect(mockSpinner.succeed).toHaveBeenCalled();
    });

    it('should handle upload failure', async () => {
      const params = { path: '/path/to/cert.p12', password: 'password' };
      const error = new Error('Upload failed');
      
      (uploadP12Certificate as any).mockRejectedValue(error);
      
      await expect(handleCertificateUpload(mockCommand, params)).rejects.toThrow('Upload failed');
      expect(mockSpinner.fail).toHaveBeenCalledWith('Upload failed');
    });
  });

  describe('handleCertificateCreate', () => {
    it('should create CSR certificate request successfully', async () => {
      const params = { name: 'Test Cert', email: 'test@example.com', countryCode: 'US' };
      const mockResponse = { id: 'csr-123', message: 'Created' };
      
      (createCSRCertificateRequest as any).mockResolvedValue(mockResponse);
      
      await handleCertificateCreate(mockCommand, params);
      
      expect(createOra).toHaveBeenCalledWith('Try to create the Certificate request');
      expect(createCSRCertificateRequest).toHaveBeenCalledWith(params);
      expect(commandWriter).toHaveBeenCalledWith(CommandTypes.SIGNING_IDENTITY, {
        fullCommandName: mockCommand.fullCommandName,
        data: mockResponse
      });
      expect(mockSpinner.succeed).toHaveBeenCalled();
    });

    it('should handle create failure', async () => {
      const params = { name: 'Test Cert', email: 'test@example.com', countryCode: 'US' };
      const error = new Error('Create failed');
      
      (createCSRCertificateRequest as any).mockRejectedValue(error);
      
      await expect(handleCertificateCreate(mockCommand, params)).rejects.toThrow('Create failed');
      expect(mockSpinner.fail).toHaveBeenCalledWith('Create failed');
    });
  });

  describe('handleCertificateView', () => {
    it('should view certificate details', async () => {
      const params = { certificateBundleId: 'cert-123' };
      const mockCertificate = { id: 'cert-123', name: 'Test Certificate' };
      
      (getCertificateDetailById as any).mockResolvedValue(mockCertificate);
      
      await handleCertificateView(mockCommand, params);
      
      expect(createOra).toHaveBeenCalledWith('Getting Certificate details...');
      expect(getCertificateDetailById).toHaveBeenCalledWith({ certificateBundleId: params.certificateBundleId });
      expect(commandWriter).toHaveBeenCalledWith(CommandTypes.SIGNING_IDENTITY, {
        fullCommandName: mockCommand.fullCommandName,
        data: mockCertificate
      });
      expect(mockSpinner.stop).toHaveBeenCalled();
    });
  });

  describe('handleCertificateDownload', () => {
    it('should download P12 certificate successfully', async () => {
      const params = { certificateId: 'cert-123', path: '/downloads' };
      const mockP12Certs = [{ id: 'cert-123', filename: 'test.p12' }];
      
      (getiOSP12Certificates as any).mockResolvedValue(mockP12Certs);
      (downloadCertificateById as any).mockResolvedValue(undefined);
      
      await handleCertificateDownload(mockCommand, params);
      
      expect(getiOSP12Certificates).toHaveBeenCalled();
      expect(downloadCertificateById).toHaveBeenCalledWith(
        { certificateId: params.certificateId, path: params.path },
        expect.any(String),
        'test.p12',
        'p12'
      );
      expect(mockSpinner.succeed).toHaveBeenCalled();
    });

    it('should download CSR certificate when P12 not found', async () => {
      const params = { certificateId: 'cert-123', path: '/downloads' };
      const mockP12Certs: any[] = [];
      
      (getiOSP12Certificates as any).mockResolvedValue(mockP12Certs);
      (downloadCertificateById as any).mockResolvedValue(undefined);
      
      await handleCertificateDownload(mockCommand, params);
      
      expect(downloadCertificateById).toHaveBeenCalledWith(
        { certificateId: params.certificateId, path: params.path },
        expect.any(String),
        'download.cer',
        'csr'
      );
    });

    it('should handle download failure', async () => {
      const params = { certificateId: 'cert-123' };
      const mockP12Certs = [{ id: 'cert-123', filename: 'test.p12' }];
      const error = new Error('Download failed');
      
      (getiOSP12Certificates as any).mockResolvedValue(mockP12Certs);
      (downloadCertificateById as any).mockRejectedValue(error);
      
      await handleCertificateDownload(mockCommand, params);
      
      expect(mockSpinner.fail).toHaveBeenCalled();
      expect(mockSpinner.text).toBe('The file could not be downloaded.');
    });
  });

  describe('handleCertificateRemove', () => {
    it('should remove certificate after confirmation', async () => {
      const params = { certificateId: 'cert-123', certificateBundleId: 'bundle-123' };
      const mockCertDetail = { id: 'cert-123', name: 'Test Certificate' };
      const mockCSRCerts = [{ id: 'cert-123', type: 'csr' }];
      
      (getCertificateDetailById as any).mockResolvedValue(mockCertDetail);
      (getiOSCSRCertificates as any).mockResolvedValue(mockCSRCerts);
      (enquirer.prompt as any).mockResolvedValue({ confirm: 'yes' });
      (removeCSRorP12CertificateById as any).mockResolvedValue(undefined);
      
      await handleCertificateRemove(mockCommand, params);
      
      expect(enquirer.prompt).toHaveBeenCalledWith({
        type: 'select',
        name: 'confirm',
        message: 'Are you sure you want to delete the Certificate "Test Certificate"? This action cannot be undone. (Y/n)',
        choices: [
          { name: 'yes', message: 'yes' },
          { name: 'no', message: 'no' }
        ],
        initial: 1
      });
      expect(removeCSRorP12CertificateById).toHaveBeenCalledWith(
        { certificateId: params.certificateId, path: params.path },
        'csr'
      );
      expect(mockSpinner.succeed).toHaveBeenCalled();
    });

    it('should cancel removal when user selects no', async () => {
      const params = { certificateId: 'cert-123', certificateBundleId: 'bundle-123' };
      const mockCertDetail = { id: 'cert-123', name: 'Test Certificate' };
      
      (getCertificateDetailById as any).mockResolvedValue(mockCertDetail);
      (enquirer.prompt as any).mockResolvedValue({ confirm: 'no' });
      
      await handleCertificateRemove(mockCommand, params);
      
      expect(console.log).toHaveBeenCalledWith(chalk.yellow('Certificate deletion cancelled.'));
      expect(removeCSRorP12CertificateById).not.toHaveBeenCalled();
    });

    it('should handle removal failure', async () => {
      const params = { certificateId: 'cert-123', certificateBundleId: 'bundle-123' };
      const mockCertDetail = { id: 'cert-123', name: 'Test Certificate' };
      const error = new Error('Remove failed');
      
      (getCertificateDetailById as any).mockResolvedValue(mockCertDetail);
      (enquirer.prompt as any).mockResolvedValue({ confirm: 'yes' });
      (getiOSCSRCertificates as any).mockResolvedValue([]);
      (removeCSRorP12CertificateById as any).mockRejectedValue(error);
      
      await expect(handleCertificateRemove(mockCommand, params)).rejects.toThrow('Remove failed');
      expect(mockSpinner.fail).toHaveBeenCalledWith('Remove failed');
    });
  });
});

describe('Keystore Command Utilities', () => {
  let mockSpinner: any;
  let mockCommand: any;

  beforeEach(() => {
    vi.clearAllMocks();
    
    mockSpinner = {
      start: vi.fn().mockReturnThis(),
      stop: vi.fn(),
      succeed: vi.fn(),
      fail: vi.fn(),
      text: ''
    };
    (createOra as any).mockReturnValue(mockSpinner);
    
    mockCommand = {
      fullCommandName: `${PROGRAM_NAME}-signing-identity-keystore-list`,
      name: vi.fn().mockReturnValue('keystore'),
      args: vi.fn().mockReturnValue([])
    };
  });

  describe('handleKeystoreList', () => {
    it('should list Android keystores', async () => {
      const mockKeystores = [{ id: 'keystore-1', name: 'Test Keystore' }];
      
      (getAndroidKeystores as any).mockResolvedValue(mockKeystores);
      
      await handleKeystoreList(mockCommand);
      
      expect(createOra).toHaveBeenCalledWith('Listing keystores...');
      expect(getAndroidKeystores).toHaveBeenCalled();
      expect(commandWriter).toHaveBeenCalledWith(CommandTypes.SIGNING_IDENTITY, {
        fullCommandName: mockCommand.fullCommandName,
        data: mockKeystores
      });
    });
  });

  describe('handleKeystoreCreate', () => {
    it('should create new keystore successfully', async () => {
      const params = { name: 'New Keystore', password: 'password123' };
      
      (generateNewKeystore as any).mockResolvedValue(undefined);
      
      await handleKeystoreCreate(mockCommand, params);
      
      expect(createOra).toHaveBeenCalledWith('Trying to generate new Keystore.');
      expect(generateNewKeystore).toHaveBeenCalledWith(params);
      expect(mockSpinner.succeed).toHaveBeenCalled();
      expect(mockSpinner.text).toContain('New Keystore');
    });

    it('should handle keystore creation failure', async () => {
      const params = { name: 'New Keystore', password: 'password123' };
      const error = new Error('Generation failed');
      
      (generateNewKeystore as any).mockRejectedValue(error);
      
      await expect(handleKeystoreCreate(mockCommand, params)).rejects.toThrow('Generation failed');
      expect(mockSpinner.fail).toHaveBeenCalledWith('Generation failed');
    });
  });

  describe('handleKeystoreUpload', () => {
    it('should upload keystore file successfully', async () => {
      const params = { path: '/path/to/keystore.jks', password: 'password' };
      
      (uploadAndroidKeystoreFile as any).mockResolvedValue(undefined);
      
      await handleKeystoreUpload(mockCommand, params);
      
      expect(createOra).toHaveBeenCalledWith('Trying to upload the Keystore file');
      expect(uploadAndroidKeystoreFile).toHaveBeenCalledWith(expect.objectContaining({
        password: 'password'
      }));
      expect(mockSpinner.succeed).toHaveBeenCalled();
    });

    it('should handle upload failure', async () => {
      const params = { path: '/path/to/keystore.jks', password: 'password' };
      const error = new Error('Upload failed');
      
      (uploadAndroidKeystoreFile as any).mockRejectedValue(error);
      
      await handleKeystoreUpload(mockCommand, params);
      
      expect(mockSpinner.fail).toHaveBeenCalledWith('Upload failed: Keystore was tampered with, or password was incorrect');
    });
  });

  describe('handleKeystoreDownload', () => {
    it('should download keystore successfully', async () => {
      const params = { keystoreId: 'keystore-123', path: '/downloads' };
      const mockKeystoreDetail = { id: 'keystore-123', fileName: 'test.keystore' };
      
      (getKeystoreDetailById as any).mockResolvedValue(mockKeystoreDetail);
      (downloadKeystoreById as any).mockResolvedValue(undefined);
      
      await handleKeystoreDownload(mockCommand, params);
      
      expect(getKeystoreDetailById).toHaveBeenCalledWith({ keystoreId: params.keystoreId });
      expect(downloadKeystoreById).toHaveBeenCalledWith(
        { keystoreId: params.keystoreId, path: params.path },
        expect.any(String),
        'test.keystore'
      );
      expect(mockSpinner.succeed).toHaveBeenCalled();
    });

    it('should handle download failure', async () => {
      const params = { keystoreId: 'keystore-123' };
      const error = new Error('Download failed');
      
      (getKeystoreDetailById as any).mockRejectedValue(error);
      
      await handleKeystoreDownload(mockCommand, params);
      
      expect(mockSpinner.fail).toHaveBeenCalled();
      expect(mockSpinner.text).toBe('The file could not be downloaded.');
    });
  });

  describe('handleKeystoreView', () => {
    it('should view keystore details', async () => {
      const params = { keystoreId: 'keystore-123' };
      const mockKeystore = { id: 'keystore-123', name: 'Test Keystore' };
      
      (getKeystoreDetailById as any).mockResolvedValue(mockKeystore);
      
      await handleKeystoreView(mockCommand, params);
      
      expect(createOra).toHaveBeenCalledWith('Getting Keystore details...');
      expect(getKeystoreDetailById).toHaveBeenCalledWith({ keystoreId: params.keystoreId });
      expect(commandWriter).toHaveBeenCalledWith(CommandTypes.SIGNING_IDENTITY, {
        fullCommandName: mockCommand.fullCommandName,
        data: mockKeystore
      });
    });
  });

  describe('handleKeystoreRemove', () => {
    it('should remove keystore after confirmation', async () => {
      const params = { keystoreId: 'keystore-123' };
      const mockKeystoreDetails = { id: 'keystore-123', name: 'Test Keystore' };
      
      (getKeystoreDetailById as any).mockResolvedValue(mockKeystoreDetails);
      (enquirer.prompt as any).mockResolvedValue({ confirm: 'yes' });
      (removeKeystore as any).mockResolvedValue(undefined);
      
      await handleKeystoreRemove(mockCommand, params);
      
      expect(enquirer.prompt).toHaveBeenCalledWith({
        type: 'select',
        name: 'confirm',
        message: 'Are you sure you want to delete the Keystore "Test Keystore"? This action cannot be undone. (Y/n)',
        choices: [
          { name: 'yes', message: 'yes' },
          { name: 'no', message: 'no' }
        ],
        initial: 1
      });
      expect(removeKeystore).toHaveBeenCalledWith({ keystoreId: params.keystoreId });
      expect(mockSpinner.succeed).toHaveBeenCalled();
    });

    it('should cancel removal when user selects no', async () => {
      const params = { keystoreId: 'keystore-123' };
      const mockKeystoreDetails = { id: 'keystore-123', name: 'Test Keystore' };
      
      (getKeystoreDetailById as any).mockResolvedValue(mockKeystoreDetails);
      (enquirer.prompt as any).mockResolvedValue({ confirm: 'no' });
      
      await handleKeystoreRemove(mockCommand, params);
      
      expect(console.log).toHaveBeenCalledWith(chalk.yellow('Keystore deletion cancelled.'));
      expect(removeKeystore).not.toHaveBeenCalled();
    });
  });
});

describe('Provisioning Profile Command Utilities', () => {
  let mockSpinner: any;
  let mockCommand: any;

  beforeEach(() => {
    vi.clearAllMocks();
    
    mockSpinner = {
      start: vi.fn().mockReturnThis(),
      stop: vi.fn(),
      succeed: vi.fn(),
      fail: vi.fn(),
      text: ''
    };
    (createOra as any).mockReturnValue(mockSpinner);
    
    mockCommand = {
      fullCommandName: `${PROGRAM_NAME}-signing-identity-provisioning-profile-list`,
      name: vi.fn().mockReturnValue('provisioning-profile'),
      args: vi.fn().mockReturnValue([])
    };
  });

  describe('handleProvisioningProfileList', () => {
    it('should list provisioning profiles', async () => {
      const mockProfiles = [{ id: 'profile-1', name: 'Test Profile' }];
      
      (getProvisioningProfiles as any).mockResolvedValue(mockProfiles);
      
      await handleProvisioningProfileList(mockCommand);
      
      expect(createOra).toHaveBeenCalledWith('Listing Provisioning Profiles...');
      expect(getProvisioningProfiles).toHaveBeenCalled();
      expect(commandWriter).toHaveBeenCalledWith(CommandTypes.SIGNING_IDENTITY, {
        fullCommandName: mockCommand.fullCommandName,
        data: mockProfiles
      });
    });
  });

  describe('handleProvisioningProfileUpload', () => {
    it('should upload provisioning profile successfully', async () => {
      const params = { path: '/path/to/profile.mobileprovision' };
      
      (uploadProvisioningProfile as any).mockResolvedValue(undefined);
      
      await handleProvisioningProfileUpload(mockCommand, params);
      
      expect(createOra).toHaveBeenCalledWith('Trying to upload the Provisioning Profile');
      expect(uploadProvisioningProfile).toHaveBeenCalledWith(expect.objectContaining({
        path: expect.any(String)
      }));
      expect(mockSpinner.succeed).toHaveBeenCalled();
    });

    it('should handle upload failure', async () => {
      const params = { path: '/path/to/profile.mobileprovision' };
      const error = new Error('Upload failed');
      
      (uploadProvisioningProfile as any).mockRejectedValue(error);
      
      await expect(handleProvisioningProfileUpload(mockCommand, params)).rejects.toThrow('Upload failed');
      expect(mockSpinner.fail).toHaveBeenCalledWith('Upload failed');
    });
  });

  describe('handleProvisioningProfileDownload', () => {
    it('should download provisioning profile successfully', async () => {
      const params = { provisioningProfileId: 'profile-123', path: '/downloads' };
      const mockProfile = { id: 'profile-123', filename: 'test.mobileprovision' };
      
      (getProvisioningProfileDetailById as any).mockResolvedValue(mockProfile);
      (downloadProvisioningProfileById as any).mockResolvedValue(undefined);
      
      await handleProvisioningProfileDownload(mockCommand, params);
      
      expect(getProvisioningProfileDetailById).toHaveBeenCalledWith({ provisioningProfileId: params.provisioningProfileId });
      expect(downloadProvisioningProfileById).toHaveBeenCalledWith(
        { provisioningProfileId: params.provisioningProfileId },
        expect.any(String),
        'test.mobileprovision'
      );
      expect(mockSpinner.succeed).toHaveBeenCalled();
    });

    it('should handle download failure', async () => {
      const params = { provisioningProfileId: 'profile-123' };
      const error = new Error('Download failed');
      
      (getProvisioningProfileDetailById as any).mockRejectedValue(error);
      
      await expect(handleProvisioningProfileDownload(mockCommand, params)).rejects.toThrow('Download failed');
      
      expect(mockSpinner.fail).toHaveBeenCalledWith('Download failed');
    });
  });

  describe('handleProvisioningProfileView', () => {
    it('should view provisioning profile details', async () => {
      const params = { provisioningProfileId: 'profile-123' };
      const mockProfile = { id: 'profile-123', name: 'Test Profile' };
      
      (getProvisioningProfileDetailById as any).mockResolvedValue(mockProfile);
      
      await handleProvisioningProfileView(mockCommand, params);
      
      expect(createOra).toHaveBeenCalledWith('Getting Provisioning Profile details...');
      expect(getProvisioningProfileDetailById).toHaveBeenCalledWith({ provisioningProfileId: params.provisioningProfileId });
      expect(commandWriter).toHaveBeenCalledWith(CommandTypes.SIGNING_IDENTITY, {
        fullCommandName: mockCommand.fullCommandName,
        data: mockProfile
      });
    });
  });

  describe('handleProvisioningProfileRemove', () => {
    it('should remove provisioning profile after confirmation', async () => {
      const params = { provisioningProfileId: 'profile-123' };
      const mockProfileDetails = { id: 'profile-123', name: 'Test Profile' };
      
      (getProvisioningProfileDetailById as any).mockResolvedValue(mockProfileDetails);
      (enquirer.prompt as any).mockResolvedValue({ confirm: 'yes' });
      (removeProvisioningProfile as any).mockResolvedValue(undefined);
      
      await handleProvisioningProfileRemove(mockCommand, params);
      
      expect(enquirer.prompt).toHaveBeenCalledWith({
        type: 'select',
        name: 'confirm',
        message: 'Are you sure you want to delete the Provisioning Profile "Test Profile"? This action cannot be undone. (Y/n)',
        choices: [
          { name: 'yes', message: 'yes' },
          { name: 'no', message: 'no' }
        ],
        initial: 1
      });
      expect(removeProvisioningProfile).toHaveBeenCalledWith({ provisioningProfileId: params.provisioningProfileId });
      expect(mockSpinner.succeed).toHaveBeenCalled();
    });

    it('should cancel removal when user selects no', async () => {
      const params = { provisioningProfileId: 'profile-123' };
      const mockProfileDetails = { id: 'profile-123', name: 'Test Profile' };
      
      (getProvisioningProfileDetailById as any).mockResolvedValue(mockProfileDetails);
      (enquirer.prompt as any).mockResolvedValue({ confirm: 'no' });
      
      await handleProvisioningProfileRemove(mockCommand, params);
      
      expect(console.log).toHaveBeenCalledWith(chalk.yellow('Provisioning Profile deletion cancelled.'));
      expect(removeProvisioningProfile).not.toHaveBeenCalled();
    });
  });
});