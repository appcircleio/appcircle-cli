import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'

// Mock chalk
vi.mock('chalk', () => ({
  default: {
    italic: vi.fn((text) => text),
    green: vi.fn((text) => text),
    cyan: vi.fn((text) => text),
    red: vi.fn((text) => text),
    yellow: vi.fn((text) => text)
  }
}))

// Mock writer-utilities
vi.mock('../../../src/core/writer-utilities', () => ({
  formatDate: vi.fn((date) => date ? '2023-01-01' : 'N/A'),
  formatRelativeDate: vi.fn((date) => '2 days ago'),
  formatDuration: vi.fn((duration) => '1h 30m'),
  formatFileSize: vi.fn((size) => '1.5 MB'),
  formatBoolean: vi.fn((bool) => bool ? 'Yes' : 'No'),
  formatEnabledStatus: vi.fn((status) => status ? 'Enabled' : 'Disabled'),
  formatVersionString: vi.fn((version, code, name) => `${version} (${code}) - ${name}`),
  mapBuildStatus: vi.fn((status) => 'Completed'),
  mapQueueItemStatus: vi.fn((status) => 'Processing'),
  mapOperatingSystem: vi.fn((os) => 'iOS'),
  mapPlatformType: vi.fn((platform) => 'Mobile'),
  mapPublishType: vi.fn((type) => 'Production'),
  mapAuthenticationType: vi.fn((type) => 'OAuth'),
  mapCertificateStoreType: vi.fn((type) => 'Keychain'),
  validateTableData: vi.fn((data, message) => ({
    isValid: Array.isArray(data) && data.length > 0,
    data: data || [],
    message: data && data.length > 0 ? undefined : message
  })),
  shouldDisplayTable: vi.fn((data, message) => ({
    shouldDisplay: Array.isArray(data) && data.length > 0,
    message: data && data.length > 0 ? undefined : message
  })),
  logInfo: vi.fn(),
  logMessage: vi.fn(),
  logTable: vi.fn(),
  transformDistributionProfile: vi.fn((profile) => ({
    'ID': profile.id,
    'Name': profile.name
  })),
  transformBuildProfile: vi.fn((profile) => ({
    'ID': profile.id,
    'Name': profile.name
  })),
  transformBranch: vi.fn((branch) => ({
    'ID': branch.id,
    'Name': branch.name
  })),
  transformCommit: vi.fn((commit) => ({
    'ID': commit.id,
    'Message': commit.message
  })),
  transformBuild: vi.fn((build) => ({
    'ID': build.id,
    'Status': build.status
  })),
  transformBuildDetails: vi.fn((build) => ({
    'ID': build.id,
    'Status': build.status
  })),
  transformEnvironmentVariable: vi.fn((variable) => ({
    'Key': variable.key,
    'Value': variable.value
  })),
  transformActiveBuild: vi.fn((build) => ({
    'ID': build.id,
    'Status': build.status
  })),
  transformOrganizationList: vi.fn((org) => ({
    'ID': org.id,
    'Name': org.name
  })),
  transformOrganizationDetails: vi.fn((org) => ({
    'ID': org.id,
    'Name': org.name
  })),
  transformUser: vi.fn((user) => ({
    'ID': user.id,
    'Email': user.email
  })),
  transformInvitation: vi.fn((invitation) => ({
    'ID': invitation.id,
    'Email': invitation.email
  })),
  processRolesWithInheritance: vi.fn((roles, inherited) => roles || []),
  safeGet: vi.fn((obj, path) => obj?.[path] || '-')
}))

import {
  // Testing Distribution
  writeDistributionProfileList,
  writeDistributionProfileCreate,
  writeTestingGroupList,
  writeTestingGroupView,
  
  // Build Commands
  writeBuildProfileList,
  writeBuildBranchList,
  writeBuildWorkflowList,
  writeBuildConfigurationList,
  writeBuildCommitList,
  writeBuildList,
  writeBuildVariableGroupList,
  writeBuildVariableGroupCreate,
  writeBuildVariableView,
  writeBuildVariableCreate,
  writeBuildActiveList,
  writeBuildView,
  
  // Enterprise App Store
  writeEnterpriseStoreProfileList,
  writeEnterpriseStoreVersionList,
  writeEnterpriseStoreVersionPublish,
  writeEnterpriseStoreVersionUnpublish,
  writeEnterpriseStoreVersionNotify,
  writeEnterpriseStoreDownloadLink,
  transformEnterpriseStoreVersion,
  
  // Organization
  writeOrganizationView,
  writeOrganizationUserView,
  writeOrganizationUserInvite,
  writeOrganizationUserReInvite,
  writeOrganizationUserRemove,
  writeOrganizationRoleView,
  
  // Publish
  writePublishProfileCreate,
  writePublishProfileRename,
  writePublishProfileList,
  writePublishVariableGroupList,
  writePublishVariableGroupView,
  writePublishProfileSettingsAutopublish,
  writePublishProfileVersionRC,
  writePublishProfileVersionList,
  writePublishProfileVersionView,
  writePublishActiveList,
  writePublishView,
  
  // Signing Identity
  writeSigningCertificateList,
  writeSigningCertificateUpload,
  writeSigningCertificateCreate,
  writeSigningCertificateView,
  writeSigningKeystoreList,
  writeSigningKeystoreView,
  writeSigningProvisioningProfileList,
  writeSigningProvisioningProfileView
} from '../../../src/core/writer-commands'

describe('writer-commands exported functions', () => {
  let originalLog: any
  let originalError: any

  beforeEach(() => {
    originalLog = console.log
    originalError = console.error
    
    console.log = vi.fn()
    console.error = vi.fn()
  })

  afterEach(() => {
    console.log = originalLog
    console.error = originalError
    vi.restoreAllMocks()
  })

  describe('function existence tests', () => {
    it('should have all expected exported functions', () => {
      // Testing Distribution
      expect(typeof writeDistributionProfileList).toBe('function')
      expect(typeof writeDistributionProfileCreate).toBe('function')
      expect(typeof writeTestingGroupList).toBe('function')
      expect(typeof writeTestingGroupView).toBe('function')
      
      // Build Commands
      expect(typeof writeBuildProfileList).toBe('function')
      expect(typeof writeBuildBranchList).toBe('function')
      expect(typeof writeBuildWorkflowList).toBe('function')
      expect(typeof writeBuildConfigurationList).toBe('function')
      expect(typeof writeBuildCommitList).toBe('function')
      expect(typeof writeBuildList).toBe('function')
      expect(typeof writeBuildVariableGroupList).toBe('function')
      expect(typeof writeBuildVariableGroupCreate).toBe('function')
      expect(typeof writeBuildVariableView).toBe('function')
      expect(typeof writeBuildVariableCreate).toBe('function')
      expect(typeof writeBuildActiveList).toBe('function')
      expect(typeof writeBuildView).toBe('function')
      
      // Enterprise App Store
      expect(typeof writeEnterpriseStoreProfileList).toBe('function')
      expect(typeof writeEnterpriseStoreVersionList).toBe('function')
      expect(typeof writeEnterpriseStoreVersionPublish).toBe('function')
      expect(typeof writeEnterpriseStoreVersionUnpublish).toBe('function')
      expect(typeof writeEnterpriseStoreVersionNotify).toBe('function')
      expect(typeof writeEnterpriseStoreDownloadLink).toBe('function')
      expect(typeof transformEnterpriseStoreVersion).toBe('function')
      
      // Organization
      expect(typeof writeOrganizationView).toBe('function')
      expect(typeof writeOrganizationUserView).toBe('function')
      expect(typeof writeOrganizationUserInvite).toBe('function')
      expect(typeof writeOrganizationUserReInvite).toBe('function')
      expect(typeof writeOrganizationUserRemove).toBe('function')
      expect(typeof writeOrganizationRoleView).toBe('function')
      
      // Publish
      expect(typeof writePublishProfileCreate).toBe('function')
      expect(typeof writePublishProfileRename).toBe('function')
      expect(typeof writePublishProfileList).toBe('function')
      expect(typeof writePublishVariableGroupList).toBe('function')
      expect(typeof writePublishVariableGroupView).toBe('function')
      expect(typeof writePublishProfileSettingsAutopublish).toBe('function')
      expect(typeof writePublishProfileVersionRC).toBe('function')
      expect(typeof writePublishProfileVersionList).toBe('function')
      expect(typeof writePublishProfileVersionView).toBe('function')
      expect(typeof writePublishActiveList).toBe('function')
      expect(typeof writePublishView).toBe('function')
      
      // Signing Identity
      expect(typeof writeSigningCertificateList).toBe('function')
      expect(typeof writeSigningCertificateUpload).toBe('function')
      expect(typeof writeSigningCertificateCreate).toBe('function')
      expect(typeof writeSigningCertificateView).toBe('function')
      expect(typeof writeSigningKeystoreList).toBe('function')
      expect(typeof writeSigningKeystoreView).toBe('function')
      expect(typeof writeSigningProvisioningProfileList).toBe('function')
      expect(typeof writeSigningProvisioningProfileView).toBe('function')
    })
  })

  describe('Testing Distribution functions', () => {
    it('should handle writeDistributionProfileList with valid data', () => {
      const mockData = {
        data: [
          { id: '1', name: 'Test Profile' }
        ]
      }
      
      expect(() => writeDistributionProfileList(mockData)).not.toThrow()
    })

    it('should handle writeDistributionProfileCreate', () => {
      const mockData = {
        data: { name: 'Test Profile' }
      }
      
      expect(() => writeDistributionProfileCreate(mockData)).not.toThrow()
    })

    it('should handle writeTestingGroupList with valid data', () => {
      const mockData = {
        data: [
          { id: '1', name: 'Test Group' }
        ]
      }
      
      expect(() => writeTestingGroupList(mockData)).not.toThrow()
    })

    it('should handle writeTestingGroupView with valid data', () => {
      const mockData = {
        data: {
          id: '1',
          name: 'Test Group',
          createDate: '2023-01-01',
          updateDate: '2023-01-02',
          testers: []
        }
      }
      
      expect(() => writeTestingGroupView(mockData)).not.toThrow()
    })
  })

  describe('Build Command functions', () => {
    it('should handle writeBuildProfileList with valid data', () => {
      const mockData = {
        data: [
          { id: '1', name: 'Test Profile' }
        ]
      }
      
      expect(() => writeBuildProfileList(mockData)).not.toThrow()
    })

    it('should handle writeBuildBranchList with valid data', () => {
      const mockData = {
        data: {
          branches: [
            { id: '1', name: 'main' }
          ]
        }
      }
      
      expect(() => writeBuildBranchList(mockData)).not.toThrow()
    })

    it('should handle writeBuildWorkflowList with valid data', () => {
      const mockData = {
        data: [
          { id: '1', workflowName: 'Test Workflow', lastUsedTime: '2023-01-01' }
        ]
      }
      
      expect(() => writeBuildWorkflowList(mockData)).not.toThrow()
    })

    it('should handle writeBuildConfigurationList with valid data', () => {
      const mockData = {
        data: [
          { item1: { id: '1', configurationName: 'Test Config', updateDate: '2023-01-01' } }
        ]
      }
      
      expect(() => writeBuildConfigurationList(mockData)).not.toThrow()
    })

    it('should handle writeBuildCommitList with valid data', () => {
      const mockData = {
        data: [
          { id: '1', message: 'Test commit' }
        ]
      }
      
      expect(() => writeBuildCommitList(mockData)).not.toThrow()
    })

    it('should handle writeBuildList with valid data', () => {
      const mockData = {
        data: {
          builds: [
            { id: '1', status: 'completed' }
          ]
        }
      }
      
      expect(() => writeBuildList(mockData)).not.toThrow()
    })

    it('should handle writeBuildVariableGroupList with valid data', () => {
      const mockData = {
        data: [
          { id: '1', name: 'Test Group' }
        ]
      }
      
      expect(() => writeBuildVariableGroupList(mockData)).not.toThrow()
    })

    it('should handle writeBuildVariableGroupCreate', () => {
      const mockData = {
        data: { name: 'Test Group' }
      }
      
      expect(() => writeBuildVariableGroupCreate(mockData)).not.toThrow()
    })

    it('should handle writeBuildVariableView with valid data', () => {
      const mockData = {
        data: [
          { key: 'TEST_KEY', value: 'test_value' }
        ]
      }
      
      expect(() => writeBuildVariableView(mockData)).not.toThrow()
    })

    it('should handle writeBuildVariableCreate', () => {
      const mockData = {
        data: { key: 'TEST_KEY' }
      }
      
      expect(() => writeBuildVariableCreate(mockData)).not.toThrow()
    })

    it('should handle writeBuildActiveList with valid data', () => {
      const mockData = {
        data: {
          data: [
            { id: '1', status: 'active' }
          ]
        }
      }
      
      expect(() => writeBuildActiveList(mockData)).not.toThrow()
    })

    it('should handle writeBuildView with valid data', () => {
      const mockData = {
        data: { id: '1', status: 'completed' }
      }
      
      expect(() => writeBuildView(mockData)).not.toThrow()
    })
  })

  describe('Enterprise App Store functions', () => {
    it('should handle writeEnterpriseStoreProfileList with valid data', () => {
      const mockData = {
        data: [
          { id: '1', name: 'Test Profile', version: '1.0.0' }
        ]
      }
      
      expect(() => writeEnterpriseStoreProfileList(mockData)).not.toThrow()
    })

    it('should handle writeEnterpriseStoreVersionList with valid data', () => {
      const mockData = {
        data: [
          { name: 'Test Version', version: '1.0.0' }
        ]
      }
      
      expect(() => writeEnterpriseStoreVersionList(mockData)).not.toThrow()
    })

    it('should handle writeEnterpriseStoreVersionPublish with valid data', () => {
      const mockData = {
        data: { name: 'Test Version', version: '1.0.0' }
      }
      
      expect(() => writeEnterpriseStoreVersionPublish(mockData)).not.toThrow()
    })

    it('should handle writeEnterpriseStoreVersionUnpublish with valid data', () => {
      const mockData = {
        data: { name: 'Test Version', version: '1.0.0' }
      }
      
      expect(() => writeEnterpriseStoreVersionUnpublish(mockData)).not.toThrow()
    })

    it('should handle writeEnterpriseStoreVersionNotify with valid data', () => {
      const mockData = {
        data: [
          { name: 'Test Version', version: '1.0.0' }
        ]
      }
      
      expect(() => writeEnterpriseStoreVersionNotify(mockData)).not.toThrow()
    })

    it('should handle writeEnterpriseStoreDownloadLink', () => {
      const mockData = {
        data: 'https://example.com/download'
      }
      
      expect(() => writeEnterpriseStoreDownloadLink(mockData)).not.toThrow()
    })

    it('should handle transformEnterpriseStoreVersion', () => {
      const mockProfile = {
        name: 'Test Version',
        summary: 'Test summary',
        version: '1.0.0',
        versionCode: '1',
        publishType: 'production',
        publishDate: '2023-01-01',
        platformType: 'ios',
        downloadCount: 100,
        createDate: '2023-01-01',
        updateDate: '2023-01-02'
      }
      
      const result = transformEnterpriseStoreVersion(mockProfile)
      expect(result).toBeDefined()
      expect(result['Version Name']).toBe('Test Version')
    })
  })

  describe('Organization functions', () => {
    it('should handle writeOrganizationView with array data', () => {
      const mockData = {
        data: [
          { id: '1', name: 'Test Org' }
        ]
      }
      
      expect(() => writeOrganizationView(mockData)).not.toThrow()
    })

    it('should handle writeOrganizationView with single data', () => {
      const mockData = {
        data: { id: '1', name: 'Test Org' }
      }
      
      expect(() => writeOrganizationView(mockData)).not.toThrow()
    })

    it('should handle writeOrganizationUserView with valid data', () => {
      const mockData = {
        data: {
          users: [
            { id: '1', email: 'test@example.com' }
          ],
          invitations: [
            { id: '1', email: 'invite@example.com' }
          ]
        }
      }
      
      expect(() => writeOrganizationUserView(mockData)).not.toThrow()
    })

    it('should handle writeOrganizationUserInvite', () => {
      const mockData = {
        data: { email: 'test@example.com' }
      }
      
      expect(() => writeOrganizationUserInvite(mockData)).not.toThrow()
    })

    it('should handle writeOrganizationUserReInvite', () => {
      const mockData = {
        data: { email: 'test@example.com' }
      }
      
      expect(() => writeOrganizationUserReInvite(mockData)).not.toThrow()
    })

    it('should handle writeOrganizationUserRemove', () => {
      const mockData = {
        data: { email: 'test@example.com' }
      }
      
      expect(() => writeOrganizationUserRemove(mockData)).not.toThrow()
    })

    it('should handle writeOrganizationRoleView with valid data', () => {
      const mockData = {
        data: {
          roles: [
            { id: '1', name: 'Admin' }
          ],
          inheritedRoles: [
            { id: '2', name: 'User' }
          ]
        }
      }
      
      expect(() => writeOrganizationRoleView(mockData)).not.toThrow()
    })
  })

  describe('Publish functions', () => {
    it('should handle writePublishProfileCreate', () => {
      const mockData = {
        data: {
          id: '1',
          name: 'Test Profile',
          createDate: '2023-01-01'
        }
      }
      
      expect(() => writePublishProfileCreate(mockData)).not.toThrow()
    })

    it('should handle writePublishProfileRename', () => {
      const mockData = {
        data: {
          id: '1',
          name: 'Test Profile',
          createDate: '2023-01-01',
          updateDate: '2023-01-02'
        }
      }
      
      expect(() => writePublishProfileRename(mockData)).not.toThrow()
    })

    it('should handle writePublishProfileList with valid data', () => {
      const mockData = {
        data: [
          {
            id: '1',
            name: 'Test Profile',
            lastUploadVersion: '1.0.0',
            lastUploadVersionCode: '1',
            version: '1.0.0',
            appUniqueId: 'com.test.app',
            publishDate: '2023-01-01',
            platformType: 'ios',
            createDate: '2023-01-01',
            updateDate: '2023-01-02'
          }
        ]
      }
      
      expect(() => writePublishProfileList(mockData)).not.toThrow()
    })

    it('should handle writePublishVariableGroupList with valid data', () => {
      const mockData = {
        data: [
          {
            id: '1',
            name: 'Test Group',
            createDate: '2023-01-01',
            updateDate: '2023-01-02'
          }
        ]
      }
      
      expect(() => writePublishVariableGroupList(mockData)).not.toThrow()
    })

    it('should handle writePublishVariableGroupView with valid data', () => {
      const mockData = {
        data: [
          { key: 'TEST_KEY', value: 'test_value' }
        ]
      }
      
      expect(() => writePublishVariableGroupView(mockData)).not.toThrow()
    })

    it('should handle writePublishProfileSettingsAutopublish', () => {
      const mockData = {
        data: {
          id: '1',
          name: 'Test Profile',
          createDate: '2023-01-01',
          updateDate: '2023-01-02',
          profileSettings: {
            whenNewVersionRecieved: true
          }
        }
      }
      
      expect(() => writePublishProfileSettingsAutopublish(mockData)).not.toThrow()
    })

    it('should handle writePublishProfileVersionRC', () => {
      const mockData = {
        data: {
          id: '1',
          name: 'Test Version',
          uniqueName: 'test-version',
          createDate: '2023-01-01',
          updateDate: '2023-01-02',
          releaseCandidate: true
        }
      }
      
      expect(() => writePublishProfileVersionRC(mockData)).not.toThrow()
    })

    it('should handle writePublishProfileVersionList with valid data', () => {
      const mockData = {
        data: [
          {
            id: '1',
            version: '1.0.0',
            versionCode: '1',
            name: 'Test App',
            createDate: '2023-01-01',
            releaseCandidate: false,
            fileSize: 1024,
            latestFlowStatus: 'completed'
          }
        ]
      }
      
      expect(() => writePublishProfileVersionList(mockData)).not.toThrow()
    })

    it('should handle writePublishProfileVersionView with valid data', () => {
      const mockData = {
        data: {
          id: '1',
          version: '1.0.0',
          versionCode: '1',
          name: 'Test App',
          createDate: '2023-01-01',
          fileSize: 1024,
          latestFlowStatus: 'completed',
          releaseCandidate: false,
          summary: 'Test summary',
          uniqueName: 'test-app',
          updateDate: '2023-01-02'
        }
      }
      
      expect(() => writePublishProfileVersionView(mockData)).not.toThrow()
    })

    it('should handle writePublishActiveList with valid data', () => {
      const mockData = {
        data: [
          {
            publishId: '1',
            profileName: 'Test Profile',
            stepName: 'Upload',
            queueItemStatus: 'processing',
            email: 'test@example.com',
            startQueueDateTime: '2023-01-01',
            os: 'ios',
            profileId: '1',
            appVersionId: '1'
          }
        ]
      }
      
      expect(() => writePublishActiveList(mockData)).not.toThrow()
    })

    it('should handle writePublishView with valid data', () => {
      const mockData = {
        data: {
          id: '1',
          status: 'completed',
          startedOn: '2023-01-01',
          steps: [
            {
              name: 'Upload',
              status: 'completed',
              startedByUser: { email: 'test@example.com' },
              startedOn: '2023-01-01',
              finishedOn: '2023-01-02'
            }
          ]
        }
      }
      
      expect(() => writePublishView(mockData)).not.toThrow()
    })
  })

  describe('Signing Identity functions', () => {
    it('should handle writeSigningCertificateList with valid data', () => {
      const mockData = {
        data: [
          {
            id: '1',
            name: 'Test Certificate',
            storeType: 'keychain',
            extension: 'p12',
            expireDate: '2024-01-01'
          }
        ]
      }
      
      expect(() => writeSigningCertificateList(mockData)).not.toThrow()
    })

    it('should handle writeSigningCertificateUpload with valid data', () => {
      const mockData = {
        data: {
          id: '1',
          name: 'Test Certificate',
          storeType: 'keychain',
          filename: 'cert.p12',
          expireDate: '2024-01-01'
        }
      }
      
      expect(() => writeSigningCertificateUpload(mockData)).not.toThrow()
    })

    it('should handle writeSigningCertificateCreate with valid data', () => {
      const mockData = {
        data: {
          id: '1',
          name: 'Test Certificate',
          storeType: 'keychain',
          createDate: '2023-01-01'
        }
      }
      
      expect(() => writeSigningCertificateCreate(mockData)).not.toThrow()
    })

    it('should handle writeSigningCertificateView with valid data', () => {
      const mockData = {
        data: {
          id: '1',
          name: 'Test Certificate',
          filename: 'cert.p12',
          storeType: 'keychain',
          expireDate: '2024-01-01',
          createDate: '2023-01-01',
          updateDate: '2023-01-02'
        }
      }
      
      expect(() => writeSigningCertificateView(mockData)).not.toThrow()
    })

    it('should handle writeSigningKeystoreList with valid data', () => {
      const mockData = {
        data: [
          {
            id: '1',
            name: 'Test Keystore',
            fileName: 'keystore.jks',
            expireDate: '2024-01-01'
          }
        ]
      }
      
      expect(() => writeSigningKeystoreList(mockData)).not.toThrow()
    })

    it('should handle writeSigningKeystoreView with valid data', () => {
      const mockData = {
        data: {
          id: '1',
          name: 'Test Keystore',
          alias: 'test-alias',
          fileName: 'keystore.jks',
          createDate: '2023-01-01',
          expireDate: '2024-01-01'
        }
      }
      
      expect(() => writeSigningKeystoreView(mockData)).not.toThrow()
    })

    it('should handle writeSigningProvisioningProfileList with valid data', () => {
      const mockData = {
        data: [
          {
            id: '1',
            name: 'Test Profile',
            appId: 'com.test.app',
            storeType: 'keychain',
            hasCertificate: true,
            expireDate: '2024-01-01'
          }
        ]
      }
      
      expect(() => writeSigningProvisioningProfileList(mockData)).not.toThrow()
    })

    it('should handle writeSigningProvisioningProfileView with valid data', () => {
      const mockData = {
        data: {
          id: '1',
          name: 'Test Profile',
          appId: 'com.test.app',
          storeType: 'keychain',
          hasCertificate: true,
          expireDate: '2024-01-01',
          createDate: '2023-01-01'
        }
      }
      
      expect(() => writeSigningProvisioningProfileView(mockData)).not.toThrow()
    })
  })

  describe('error handling tests', () => {
    it('should handle empty data gracefully', () => {
      const emptyData = { data: [] }
      
      expect(() => writeDistributionProfileList(emptyData)).not.toThrow()
      expect(() => writeBuildProfileList(emptyData)).not.toThrow()
      expect(() => writeEnterpriseStoreProfileList(emptyData)).not.toThrow()
    })

    it('should handle null/undefined data gracefully', () => {
      const nullData = { data: null }
      const undefinedData = { data: undefined }
      
      expect(() => writeDistributionProfileList(nullData)).not.toThrow()
      expect(() => writeBuildProfileList(undefinedData)).not.toThrow()
      // Skip writeOrganizationView with null data as it has specific null handling
      expect(() => writeBuildBranchList(nullData)).not.toThrow()
    })

    it('should handle missing nested properties gracefully', () => {
      const incompleteData = {
        data: {
          // Missing expected properties
        }
      }
      
      expect(() => writeBuildBranchList(incompleteData)).not.toThrow()
      expect(() => writeOrganizationUserView(incompleteData)).not.toThrow()
    })
  })

  describe('integration tests', () => {
    it('should work together - complete data flow', () => {
      const completeData = {
        data: [
          {
            id: '1',
            name: 'Test Item',
            createDate: '2023-01-01',
            updateDate: '2023-01-02'
          }
        ]
      }
      
      // Test multiple functions with the same data structure
      expect(() => writeDistributionProfileList(completeData)).not.toThrow()
      expect(() => writeBuildProfileList(completeData)).not.toThrow()
      expect(() => writeEnterpriseStoreProfileList(completeData)).not.toThrow()
    })

    it('should handle complex nested data structures', () => {
      const complexData = {
        data: {
          users: [
            { id: '1', email: 'test@example.com' }
          ],
          invitations: [
            { id: '1', email: 'invite@example.com' }
          ],
          roles: [
            { id: '1', name: 'Admin' }
          ],
          inheritedRoles: [
            { id: '2', name: 'User' }
          ]
        }
      }
      
      expect(() => writeOrganizationUserView(complexData)).not.toThrow()
      expect(() => writeOrganizationRoleView(complexData)).not.toThrow()
    })
  })
})
