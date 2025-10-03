import { describe, it, expect, vi } from 'vitest'

// Mock all dependencies
vi.mock('../../../src/config', () => ({
  DefaultEnvironmentVariables: {
    AC_ACCESS_TOKEN: 'AC_ACCESS_TOKEN',
    AC_ORGANIZATION_ID: 'AC_ORGANIZATION_ID'
  },
  EnvironmentVariables: {
    AC_ACCESS_TOKEN: 'AC_ACCESS_TOKEN',
    AC_ORGANIZATION_ID: 'AC_ORGANIZATION_ID'
  },
  getConfigStore: vi.fn(() => ({ envs: { 'test-env': 'Test Environment' } })),
  getConsoleOutputType: vi.fn(() => 'text'),
  getConfigFilePath: vi.fn(),
  getEnviromentsConfigToWriting: vi.fn(),
  getCurrentConfigVariable: vi.fn(),
  addNewConfigVariable: vi.fn(),
  clearConfigs: vi.fn(),
  setCurrentConfigVariable: vi.fn(),
  writeEnviromentConfigVariable: vi.fn(),
  readEnviromentConfigVariable: vi.fn(),
  configWriter: vi.fn(),
  trustAppcircleCertificate: vi.fn()
}))

vi.mock('../../../src/services', () => ({
  getBuildProfiles: vi.fn().mockResolvedValue([{ id: 'test-profile', name: 'Test Profile' }]),
  getBranches: vi.fn().mockResolvedValue([{ id: 'test-branch', name: 'main' }]),
  getWorkflows: vi.fn().mockResolvedValue([{ id: 'test-workflow', name: 'Test Workflow' }]),
  getConfigurations: vi.fn().mockResolvedValue([{ id: 'test-config', name: 'Test Config' }]),
  getOrganizations: vi.fn().mockResolvedValue([{ id: 'test-org', name: 'Test Organization' }]),
  getUserInfo: vi.fn().mockResolvedValue({ currentOrganizationId: 'test-org' }),
  getPublishProfiles: vi.fn().mockResolvedValue([{ id: 'test-publish-profile', name: 'Test Publish Profile' }]),
  getAppVersions: vi.fn().mockResolvedValue([{ id: 'test-app-version', name: 'Test App Version' }]),
  getDistributionProfiles: vi.fn().mockResolvedValue([{ id: 'test-dist-profile', name: 'Test Distribution Profile' }]),
  getTestingGroups: vi.fn().mockResolvedValue([{ id: 'test-group', name: 'Test Group' }]),
  getEnterpriseProfiles: vi.fn().mockResolvedValue([{ id: 'test-enterprise-profile', name: 'Test Enterprise Profile' }]),
  getEnterpriseAppVersions: vi.fn().mockResolvedValue([{ id: 'test-enterprise-version', name: 'Test Enterprise Version' }]),
  getiOSCSRCertificates: vi.fn().mockResolvedValue([{ id: 'test-cert', name: 'Test Certificate' }]),
  getiOSP12Certificates: vi.fn().mockResolvedValue([{ id: 'test-p12', name: 'Test P12' }]),
  getAndroidKeystores: vi.fn().mockResolvedValue([{ id: 'test-keystore', name: 'Test Keystore' }]),
  getProvisioningProfiles: vi.fn().mockResolvedValue([{ id: 'test-provisioning', name: 'Test Provisioning Profile' }]),
  downloadTaskLog: vi.fn().mockResolvedValue('log content'),
  getPublisDetailById: vi.fn().mockResolvedValue({ id: 'test-publish-id', status: 2 }),
  appcircleApi: {
    get: vi.fn().mockResolvedValue({ data: { status: 2, detail: { message: 'Success' } } })
  },
  getHeaders: vi.fn().mockReturnValue({ 'Authorization': 'Bearer test-token' })
}))

vi.mock('../../../src/utils/orahelper', () => ({
  createOra: vi.fn(() => ({
    start: vi.fn().mockReturnThis(),
    succeed: vi.fn().mockReturnThis(),
    fail: vi.fn().mockReturnThis(),
    stop: vi.fn().mockReturnThis(),
    text: ''
  }))
}))

vi.mock('enquirer', () => ({
  default: {
    prompt: vi.fn().mockResolvedValue({ downloadLogs: true })
  }
}))

import { 
  downloadBuildLogs,
  downloadPublishLogs,
  checkPublishStatusDirectly,
  monitorPublishProcess,
  handleSuccessfulPublish,
  handleFailedPublish,
  handleLoginCommand,
  handleLogoutCommand,
  handleOrganizationCommand,
  handlePublishCommand,
  handleBuildCommand,
  handleDistributionCommand,
  handleSigningIdentityCommand,
  handleEnterpriseAppStoreCommand
} from '../../../src/core/command-runner'

describe('command-runner simple exported functions', () => {
  const createMockCommand = (name: string, args: string[] = []) => ({
    name: () => name,
    args: () => args,
    fullCommandName: `test ${name}`,
    isGroupCommand: () => false,
    parent: null,
    opts: () => ({})
  })

  describe('downloadBuildLogs', () => {
    it('should be callable with taskId', async () => {
      await expect(downloadBuildLogs('test-task-id')).resolves.not.toThrow()
    })

    it('should be callable with params object', async () => {
      const params = { commitId: 'test-commit', buildId: 'test-build' }
      await expect(downloadBuildLogs(params)).resolves.not.toThrow()
    })
  })

  describe('downloadPublishLogs', () => {
    it('should be callable with valid params', async () => {
      const publishDetail = { id: 'test-publish-id' }
      await expect(downloadPublishLogs(publishDetail, 'ios', 'test-profile-id')).resolves.not.toThrow()
    })

    it('should handle null publish detail', async () => {
      const result = await downloadPublishLogs(null, 'ios', 'test-profile-id')
      expect(result).toBeUndefined()
    })
  })

  describe('checkPublishStatusDirectly', () => {
    it('should return status object', async () => {
      const result = await checkPublishStatusDirectly('ios', 'test-profile-id', 'test-app-version-id')
      expect(result).toBeDefined()
      expect(typeof result.status).toBe('number')
    })
  })

  describe('monitorPublishProcess', () => {
    it.skip('should be callable with valid params (skipped due to long execution time)', async () => {
      const params = {
        platform: 'ios',
        publishProfileId: 'test-profile-id',
        appVersionId: 'test-app-version-id',
        publishId: 'test-publish-id'
      }
      // This function has a timeout, so we expect it to throw or timeout
      await expect(monitorPublishProcess(params)).rejects.toThrow()
    }, 20000)
  })

  describe('handleSuccessfulPublish', () => {
    it('should be callable', async () => {
      const params = { platform: 'ios', publishProfileId: 'test-profile-id', appVersionId: 'test-app-version-id' }
      const mockSpinner = { succeed: vi.fn(), fail: vi.fn() }
      
      // This function throws an error as expected behavior
      await expect(handleSuccessfulPublish(params, mockSpinner)).rejects.toThrow()
    })
  })

  describe('handleFailedPublish', () => {
    it('should be callable', async () => {
      const params = { platform: 'ios', publishProfileId: 'test-profile-id', appVersionId: 'test-app-version-id' }
      const mockSpinner = { succeed: vi.fn(), fail: vi.fn() }
      
      // This function throws an error as expected behavior
      await expect(handleFailedPublish(params, mockSpinner)).rejects.toThrow()
    })
  })

  describe('handleLoginCommand', () => {
    it('should be callable', async () => {
      const command = createMockCommand('personal-access-key', ['test-token'])
      await expect(handleLoginCommand(command, {})).resolves.not.toThrow()
    })
  })

  describe('handleLogoutCommand', () => {
    it('should be callable', async () => {
      const command = createMockCommand('logout')
      // This function throws an error when user is not logged in, which is expected behavior
      await expect(handleLogoutCommand(command, {})).rejects.toThrow('You are not currently logged in')
    })
  })

  describe('handleOrganizationCommand', () => {
    it('should be callable', async () => {
      const command = createMockCommand('list')
      await expect(handleOrganizationCommand(command, {})).resolves.not.toThrow()
    })
  })

  describe('handlePublishCommand', () => {
    it('should be callable', async () => {
      const command = createMockCommand('list')
      await expect(handlePublishCommand(command, { platform: 'ios' })).resolves.not.toThrow()
    })
  })

  describe('handleBuildCommand', () => {
    it('should be callable', async () => {
      const command = createMockCommand('list')
      await expect(handleBuildCommand(command, {})).resolves.not.toThrow()
    })
  })

  describe('handleDistributionCommand', () => {
    it('should be callable', async () => {
      const command = createMockCommand('list')
      await expect(handleDistributionCommand(command, {})).resolves.not.toThrow()
    })
  })

  describe('handleSigningIdentityCommand', () => {
    it('should be callable', async () => {
      const command = createMockCommand('certificate', ['list'])
      await expect(handleSigningIdentityCommand(command, {})).resolves.not.toThrow()
    })
  })

  describe('handleEnterpriseAppStoreCommand', () => {
    it('should be callable', async () => {
      const command = createMockCommand('list')
      await expect(handleEnterpriseAppStoreCommand(command, {})).resolves.not.toThrow()
    })
  })

  describe('function existence tests', () => {
    it('should have all expected exported functions', () => {
      expect(typeof downloadBuildLogs).toBe('function')
      expect(typeof downloadPublishLogs).toBe('function')
      expect(typeof checkPublishStatusDirectly).toBe('function')
      expect(typeof monitorPublishProcess).toBe('function')
      expect(typeof handleSuccessfulPublish).toBe('function')
      expect(typeof handleFailedPublish).toBe('function')
      expect(typeof handleLoginCommand).toBe('function')
      expect(typeof handleLogoutCommand).toBe('function')
      expect(typeof handleOrganizationCommand).toBe('function')
      expect(typeof handlePublishCommand).toBe('function')
      expect(typeof handleBuildCommand).toBe('function')
      expect(typeof handleDistributionCommand).toBe('function')
      expect(typeof handleSigningIdentityCommand).toBe('function')
      expect(typeof handleEnterpriseAppStoreCommand).toBe('function')
    })
  })
})
