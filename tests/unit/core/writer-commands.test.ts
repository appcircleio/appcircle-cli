import { describe, it, expect, vi, beforeEach } from 'vitest'
import chalk from 'chalk'

// Mock chalk to return plain text
vi.mock('chalk', () => ({
  default: {
    italic: vi.fn((text: string) => text),
    green: vi.fn((text: string) => text)
  }
}))

// Mock console methods
const mockConsoleInfo = vi.fn()
const mockConsoleLog = vi.fn()
const mockConsoleTable = vi.fn()

vi.stubGlobal('console', {
  info: mockConsoleInfo,
  log: mockConsoleLog,
  table: mockConsoleTable
})

// Mock the constant
vi.mock('../../../src/constant', () => ({
  PROGRAM_NAME: 'appcircle',
  AuthenticationTypes: { 
    LDAP: 0, 
    STATIC: 1 
  },
  OperatingSystems: { 
    IOS: 0, 
    ANDROID: 1 
  },
  PlatformTypes: { 
    NATIVE: 0, 
    HYBRID: 1 
  },
  PublishTypes: { 
    BETA: 0, 
    LIVE: 1 
  },
  BuildStatus: { 
    SUCCESS: 'success',
    FAILED: 'failed',
    CANCELLED: 'cancelled',
    RUNNING: 'running'
  },
  QueueItemStatus: { 
    WAITING: 0,
    RUNNING: 1,
    SUCCESS: 2,
    FAILED: 3
  },
  IOSCertificateStoreTypes: {
    DEVELOPMENT: 'development',
    DISTRIBUTION: 'distribution'
  }
}))

// Mock writer-utilities functions
vi.mock('../../../src/core/writer-utilities', () => ({
  logInfo: vi.fn((text: string) => {
    mockConsoleInfo(text)
    return text
  }),
  logMessage: vi.fn((text: string) => {
    mockConsoleLog(text)
    return text
  }),  
  logTable: vi.fn((data: any) => {
    mockConsoleTable(data)
    return data
  }),
  shouldDisplayTable: vi.fn((data: any, message: string) => ({
    shouldDisplay: Array.isArray(data) && data.length > 0,
    message: Array.isArray(data) && data.length > 0 ? '' : message
  })),
  validateTableData: vi.fn((data: any, message: string) => ({
    isValid: Array.isArray(data) && data.length > 0,
    data: data || [],
    message: Array.isArray(data) && data.length > 0 ? null : message
  })),
  safeGet: vi.fn((obj: any, path: string, fallback: string = '-') => {
    // Simple mock implementation that tries to get nested properties
    const keys = path.split('.');
    let current = obj;
    for (const key of keys) {
      if (current && typeof current === 'object' && key in current) {
        current = current[key];
      } else {
        return fallback;
      }
    }
    return current || fallback;
  }),
  formatDate: vi.fn((date: string) => date || '-'),
  formatRelativeDate: vi.fn((date: string) => date || '-'),
  formatFileSize: vi.fn((size: number) => {
    if (!size || size === 0) return '-';
    const mb = size / (1024 * 1024);
    return `${mb.toFixed(2)} MB`;
  }),
  formatBoolean: vi.fn((val: boolean) => val ? 'Yes' : 'No'),
  formatEnabledStatus: vi.fn((val: boolean) => val ? 'Enabled' : 'Disabled'),
  mapAuthenticationType: vi.fn((type: number) => 'LDAP'),
  mapOperatingSystem: vi.fn((os: number) => 'iOS'),
  mapPlatformType: vi.fn((platform: number) => 'Native'),
  mapPublishType: vi.fn((type: number) => 'Beta'),
  mapBuildStatus: vi.fn((status: string) => status),
  mapQueueItemStatus: vi.fn((status: number) => 'Success'),
  mapIOSCertificateStoreType: vi.fn((type: string) => {
    if (type === 'development') return 'Development';
    if (type === 'distribution') return 'Distribution';
    return type || 'User';
  }),
  mapCertificateStoreType: vi.fn((type: string) => {
    if (type === 'development') return 'Development';
    if (type === 'distribution') return 'Distribution';
    return type || 'Organization';
  }),
  formatVersionString: vi.fn((version: string, code: string, name: string) => `${version}(${code}) - ${name}`),
  formatAutoDistributeStatus: vi.fn((count: number) => `Enabled in ${count} branch(es)`),
  formatAutoSendStatus: vi.fn((enabled: boolean) => enabled ? 'Enabled' : 'Disabled'),
  truncateText: vi.fn((text: string) => text),
  joinArray: vi.fn((arr: string[]) => arr?.join(', ') || '-'),
  transformDistributionProfile: vi.fn((profile: any) => ({
    'Profile Id': profile.id,
    'Profile Name': profile.name,
    'Pinned': profile.pinned,
    'iOS Version': profile.iOSVersion || 'No versions available',
    'Android Version': profile.androidVersion || 'No versions available',
    'Last Updated': profile.updateDate || '-',
    'Last Shared': profile.lastAppVersionSharedDate || 'Not Shared',
    'Authentication': 'LDAP',
    'Auto Send': 'Enabled'
  })),
  transformBuildProfile: vi.fn((build: any) => ({
    'Profile Id': build.id,
    'Profile Name': build.name,
    'Pinned': build.pinned,
    'Target OS': 'iOS',
    'Target Platform': 'Native',
    'Repository': build.repositoryName || 'No repository connected',
    'Last Build': build.lastBuildDate || 'No previous builds',
    'Auto Distribute': build.autoDistributeCount ? `Enabled in ${build.autoDistributeCount} branch(es)` : 'Disabled',
    'Auto Build': 'Enabled'
  })),
  transformBranch: vi.fn((branch: any) => ({
    'Branch Id': branch.id,
    'Branch Name': branch.name,
    'Last Commit': branch.lastCommit || '-'
  })),
  transformCommit: vi.fn((commit: any) => ({
    'Commit Id': commit.id,
    'Author': commit.author,
    'Hash': commit.hash,
    'Message': commit.message,
    'Date': commit.date || '-'
  })),
  transformBuild: vi.fn((build: any) => ({
    'Build Id': build.id,
    'Hash': build.hash,
    'Has Warning': build.hasWarning || false,
    'Status': 'Success',
    'Commit': build.commit || '-'
  })),
  transformBuildDetails: vi.fn((build: any) => ({
    'Build Id': build.id,
    'Commit Id': build.commitId,
    'Hash': build.hash,
    'Has Warning': build.hasWarning || false,
    'Status': 'Success',
    'Duration': build.duration
  })),
  transformEnvironmentVariable: vi.fn((variable: any) => ({
    'Key Name': variable.key,
    'Key Value': variable.isSecret ? '********' : variable.value
  })),
  transformActiveBuild: vi.fn((build: any) => ({
    'Build Id': build.id,
    'Commit Id': build.commitId,
    'Profile Name': build.profileName,
    'Status': 'Running'
  })),
  transformOrganizationList: vi.fn((org: any) => ({
    'Name': org.name,
    'Disabled': org.disabled ? 'Yes' : 'No',
    'SSO Enabled': org.ssoEnabled ? 'Yes' : 'No'
  })),
  transformOrganizationDetails: vi.fn((org: any) => ({
    'Name': org.name,
    'Id': org.id,
    'Members': org.members || 5,
    'SSO': org.sso ? 'Yes' : 'No'
  })),
  transformUser: vi.fn((user: any) => ({
    'User Id': user.id,
    'Email': user.email,
    'Role': user.role || '-'
  })),
  transformInvitation: vi.fn((invitation: any) => ({
    'Email': invitation.email,
    'Status': invitation.status,
    'Role': invitation.role || '-'
  })),
  processRolesWithInheritance: vi.fn((roles?: string[], inheritedRoles?: string[]) => {
    if (!roles && !inheritedRoles) return [];
    
    const regularRoles = roles || [];
    const inherited = inheritedRoles || [];
    const allRoles = Array.from(new Set([...regularRoles, ...inherited]));
    
    return allRoles.map(role => ({
      Role: role,
      Inheritance: inherited.includes(role) ? 'Inherit' : '-'
    }));
  })
}))

// Import functions to test
import {
  writeLoginCommand,
  writeLogoutCommand,
  writeConfigCommand,
  writeTestingDistributionCommand,
  writeBuildCommand,
  writeEnterpriseAppStoreCommand,
  writeOrganizationCommand,
  writePublishCommand,
  writeSigningIdentityCommand
} from '../../../src/core/writer-commands'

describe('Writer Commands', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('Authentication Commands', () => {
    describe('writeLoginCommand', () => {
      it('should write login success message with token export', () => {
        const data = { access_token: 'test-token-123' }
        
        writeLoginCommand(data)
        
        expect(mockConsoleLog).toHaveBeenCalledWith('export AC_ACCESS_TOKEN="test-token-123"\n')
        expect(mockConsoleInfo).toHaveBeenCalledWith(
          expect.stringContaining('Login is successful')
        )
      })

      it('should handle empty access token', () => {
        const data = { access_token: '' }
        
        writeLoginCommand(data)
        
        expect(mockConsoleLog).toHaveBeenCalledWith('export AC_ACCESS_TOKEN=""\n')
      })
    })

    describe('writeLogoutCommand', () => {
      it('should not output anything for logout', () => {
        writeLogoutCommand({})
        
        expect(mockConsoleLog).not.toHaveBeenCalled()
        expect(mockConsoleInfo).not.toHaveBeenCalled()
        expect(mockConsoleTable).not.toHaveBeenCalled()
      })
    })

    describe('writeConfigCommand', () => {
      it('should not output anything for config', () => {
        writeConfigCommand({})
        
        expect(mockConsoleLog).not.toHaveBeenCalled()
        expect(mockConsoleInfo).not.toHaveBeenCalled()
        expect(mockConsoleTable).not.toHaveBeenCalled()
      })
    })
  })

  describe('Testing Distribution Commands', () => {
    describe('writeTestingDistributionCommand', () => {
      it('should write distribution profile list', () => {
        const data = {
          fullCommandName: 'appcircle-testing-distribution-profile-list',
          data: [
            {
              id: 'profile1',
              name: 'Test Profile',
              pinned: true,
              iOSVersion: '1.0.0',
              androidVersion: '2.0.0',
              updateDate: '2024-01-01T10:00:00Z',
              settings: { authenticationType: 1 },
              testingGroupIds: ['group1']
            }
          ]
        }

        writeTestingDistributionCommand(data)

        expect(mockConsoleTable).toHaveBeenCalledWith(
          expect.arrayContaining([
            expect.objectContaining({
              'Profile Id': 'profile1',
              'Profile Name': 'Test Profile'
            })
          ])
        )
      })

      it('should write empty distribution profile list message', () => {
        const data = {
          fullCommandName: 'appcircle-testing-distribution-profile-list',
          data: []
        }

        writeTestingDistributionCommand(data)

        expect(mockConsoleInfo).toHaveBeenCalledWith('No distribution profiles available.')
      })

      it('should write profile create success message', () => {
        const data = {
          fullCommandName: 'appcircle-testing-distribution-profile-create',
          data: { name: 'New Profile' }
        }

        writeTestingDistributionCommand(data)

        expect(mockConsoleInfo).toHaveBeenCalledWith('\nNew Profile distribution profile created successfully!')
      })

      it('should write testing group list', () => {
        const data = {
          fullCommandName: 'appcircle-testing-distribution-testing-group-list',
          data: [
            { id: 'group1', name: 'Test Group' },
            { id: 'group2', name: 'Another Group' }
          ]
        }

        writeTestingDistributionCommand(data)

        expect(mockConsoleTable).toHaveBeenCalledWith([
          { 'ID': 'group1', 'Name': 'Test Group' },
          { 'ID': 'group2', 'Name': 'Another Group' }
        ])
      })

      it('should write empty testing group list message', () => {
        const data = {
          fullCommandName: 'appcircle-testing-distribution-testing-group-list',
          data: []
        }

        writeTestingDistributionCommand(data)

        expect(mockConsoleLog).toHaveBeenCalledWith('  No testing group found')
      })

      it('should write testing group view with testers', () => {
        const data = {
          fullCommandName: 'appcircle-testing-distribution-testing-group-view',
          data: {
            id: 'group1',
            name: 'Test Group',
            createDate: '2024-01-01T10:00:00Z',
            updateDate: '2024-01-02T10:00:00Z',
            testers: [
              { email: 'test1@example.com' },
              { email: 'test2@example.com' }
            ]
          }
        }

        writeTestingDistributionCommand(data)

        expect(mockConsoleTable).toHaveBeenCalledTimes(2) // Group table + testers table
        expect(mockConsoleLog).toHaveBeenCalledWith('*************')
        expect(mockConsoleInfo).toHaveBeenCalledWith('  Testers:')
      })

      it('should write testing group view without testers', () => {
        const data = {
          fullCommandName: 'appcircle-testing-distribution-testing-group-view',
          data: {
            id: 'group1',
            name: 'Test Group',
            testers: []
          }
        }

        writeTestingDistributionCommand(data)

        expect(mockConsoleLog).toHaveBeenCalledWith('  No tester available')
      })

      it('should handle missing testing group', () => {
        const data = {
          fullCommandName: 'appcircle-testing-distribution-testing-group-view',
          data: null
        }

        writeTestingDistributionCommand(data)

        expect(mockConsoleLog).toHaveBeenCalledWith('  No testing group found')
      })
    })
  })

  describe('Build Commands', () => {
    describe('writeBuildCommand', () => {
      it('should write build profile list', () => {
        const data = {
          fullCommandName: 'appcircle-build-profile-list',
          data: [
            {
              id: 'profile1',
              name: 'iOS Build',
              pinned: true,
              os: 0,
              buildPlatformType: 1,
              repositoryName: 'my-repo',
              lastBuildDate: '2024-01-01T10:00:00Z',
              autoDistributeCount: 2,
              autoBuildCount: 1
            }
          ]
        }

        writeBuildCommand(data)

        expect(mockConsoleTable).toHaveBeenCalledWith(
          expect.arrayContaining([
            expect.objectContaining({
              'Profile Id': 'profile1',
              'Profile Name': 'iOS Build'
            })
          ])
        )
      })

      it('should write empty build profile list', () => {
        const data = {
          fullCommandName: 'appcircle-build-profile-list',
          data: []
        }

        writeBuildCommand(data)

        expect(mockConsoleInfo).toHaveBeenCalledWith('No build profiles available.')
      })

      it('should write build branch list', () => {
        const data = {
          fullCommandName: 'appcircle-build-profile-branch-list',
          data: {
            branches: [
              {
                id: 'branch1',
                name: 'main',
                lastBuildDate: '2024-01-01T10:00:00Z',
                buildStatus: 2
              }
            ]
          }
        }

        writeBuildCommand(data)

        expect(mockConsoleTable).toHaveBeenCalledWith(
          expect.arrayContaining([
            expect.objectContaining({
              'Branch Id': 'branch1',
              'Branch Name': 'main'
            })
          ])
        )
      })

      it('should write workflow list', () => {
        const data = {
          fullCommandName: 'appcircle-build-profile-workflow-list',
          data: [
            {
              id: 'workflow1',
              workflowName: 'iOS Workflow',
              lastUsedTime: '2024-01-01T10:00:00Z'
            }
          ]
        }

        writeBuildCommand(data)

        expect(mockConsoleTable).toHaveBeenCalledWith([
          {
            'Workflow Id': 'workflow1',
            'Workflow Name': 'iOS Workflow',
            'Last Used': expect.any(String)
          }
        ])
      })

      it('should write configuration list', () => {
        const data = {
          fullCommandName: 'appcircle-build-profile-configurations',
          data: [
            {
              item1: {
                id: 'config1',
                configurationName: 'Debug Config',
                updateDate: '2024-01-01T10:00:00Z'
              }
            }
          ]
        }

        writeBuildCommand(data)

        expect(mockConsoleTable).toHaveBeenCalledWith([
          {
            'Configuration Id': 'config1',
            'Configuration Name': 'Debug Config',
            'Update Date': expect.any(String)
          }
        ])
      })

      it('should write commit list', () => {
        const data = {
          fullCommandName: 'appcircle-build-profile-branch-commits',
          data: [
            {
              id: 'commit1',
              hash: 'abc123',
              commitDate: '2024-01-01T10:00:00Z',
              author: 'John Doe',
              message: 'Initial commit'
            }
          ]
        }

        writeBuildCommand(data)

        expect(mockConsoleTable).toHaveBeenCalledWith(
          expect.arrayContaining([
            expect.objectContaining({
              'Commit Id': 'commit1',
              'Hash': 'abc123',
              'Author': 'John Doe',
              'Message': 'Initial commit'
            })
          ])
        )
      })

      it('should write empty commit list', () => {
        const data = {
          fullCommandName: 'appcircle-build-profile-branch-commits',
          data: []
        }

        writeBuildCommand(data)

        expect(mockConsoleInfo).toHaveBeenCalledWith('No commits available.')
      })

      it('should write build list', () => {
        const data = {
          fullCommandName: 'appcircle-build-list',
          data: {
            builds: [
              {
                id: 'build1',
                hash: 'abc123',
                hasWarning: true,
                status: 'Success',
                startDate: '2024-01-01T10:00:00Z',
                endDate: '2024-01-01T11:00:00Z'
              }
            ]
          }
        }

        writeBuildCommand(data)

        expect(mockConsoleTable).toHaveBeenCalledWith(
          expect.arrayContaining([
            expect.objectContaining({
              'Build Id': 'build1',
              'Hash': 'abc123',
              'Has Warning': true
            })
          ])
        )
      })

      it('should write variable group list', () => {
        const data = {
          fullCommandName: 'appcircle-build-variable-group-list',
          data: [
            { id: 'group1', name: 'Environment Variables' }
          ]
        }

        writeBuildCommand(data)

        expect(mockConsoleTable).toHaveBeenCalledWith([
          { 'Variable Groups ID': 'group1', 'Variable Groups Name': 'Environment Variables' }
        ])
      })

      it('should write variable group create success', () => {
        const data = {
          fullCommandName: 'appcircle-build-variable-group-create',
          data: { name: 'New Variables' }
        }

        writeBuildCommand(data)

        expect(mockConsoleInfo).toHaveBeenCalledWith('\nNew Variables environment variable group created successfully!')
      })

      it('should write variable list', () => {
        const data = {
          fullCommandName: 'appcircle-build-variable-view',
          data: [
            { key: 'PUBLIC_KEY', value: 'public-value', isSecret: false },
            { key: 'SECRET_KEY', value: 'secret-value', isSecret: true }
          ]
        }

        writeBuildCommand(data)

        expect(mockConsoleTable).toHaveBeenCalledWith([
          { 'Key Name': 'PUBLIC_KEY', 'Key Value': 'public-value' },
          { 'Key Name': 'SECRET_KEY', 'Key Value': '********' }
        ])
      })

      it('should write variable create success', () => {
        const data = {
          fullCommandName: 'appcircle-build-variable-create',
          data: { key: 'NEW_VAR' }
        }

        writeBuildCommand(data)

        expect(mockConsoleInfo).toHaveBeenCalledWith('\nNEW_VAR environment variable created successfully!')
      })

      it('should write active builds list', () => {
        const data = {
          fullCommandName: 'appcircle-build-active-list',
          data: {
            data: [
              {
                id: 'build1',
                commitId: 'commit1',
                commitHash: 'abc123',
                profileName: 'iOS Profile',
                branchName: 'main',
                queueItemStatus: 1
              }
            ]
          }
        }

        writeBuildCommand(data)

        expect(mockConsoleTable).toHaveBeenCalledWith(
          expect.arrayContaining([
            expect.objectContaining({
              'Build Id': 'build1',
              'Commit Id': 'commit1',
              'Profile Name': 'iOS Profile'
            })
          ])
        )
      })

      it('should write empty active builds list', () => {
        const data = {
          fullCommandName: 'appcircle-build-active-list',
          data: { data: [] }
        }

        writeBuildCommand(data)

        expect(mockConsoleInfo).toHaveBeenCalledWith('No active builds available.')
      })

      it('should write build details view', () => {
        const data = {
          fullCommandName: 'appcircle-build-view',
          data: {
            id: 'build1',
            commitId: 'commit1',
            hash: 'abc123',
            hasWarning: false,
            status: 2,
            duration: 3600,
            isDistributable: true,
            startDate: '2024-01-01T10:00:00Z',
            endDate: '2024-01-01T11:00:00Z'
          }
        }

        writeBuildCommand(data)

        expect(mockConsoleTable).toHaveBeenCalledWith(
          expect.objectContaining({
            'Build Id': 'build1',
            'Commit Id': 'commit1',
            'Hash': 'abc123',
            'Has Warning': false
          })
        )
      })

      it('should handle missing build data', () => {
        const data = {
          fullCommandName: 'appcircle-build-view',
          data: null
        }

        writeBuildCommand(data)

        expect(mockConsoleInfo).toHaveBeenCalledWith('No builds available.')
      })
    })
  })

  describe('Enterprise App Store Commands', () => {
    describe('writeEnterpriseAppStoreCommand', () => {
      it('should write enterprise store profile list', () => {
        const data = {
          fullCommandName: 'appcircle-enterprise-app-store-profile-list',
          data: [
            {
              id: 'profile1',
              name: 'Enterprise App',
              version: '1.0.0',
              totalDownloadCount: 150,
              latestPublishDate: '2024-01-01T10:00:00Z',
              lastBinaryReceivedDate: '2024-01-02T10:00:00Z'
            }
          ]
        }

        writeEnterpriseAppStoreCommand(data)

        expect(mockConsoleTable).toHaveBeenCalledWith([
          {
            'Profile Id': 'profile1',
            'Profile Name': 'Enterprise App',
            Version: '1.0.0',
            Downloads: 150,
            'Latest Publish': expect.any(String),
            'Last Received': expect.any(String)
          }
        ])
      })

      it('should write empty enterprise store profile list', () => {
        const data = {
          fullCommandName: 'appcircle-enterprise-app-store-profile-list',
          data: []
        }

        writeEnterpriseAppStoreCommand(data)

        expect(mockConsoleInfo).toHaveBeenCalledWith('No build profiles available.')
      })

      it('should write enterprise store version list', () => {
        const data = {
          fullCommandName: 'appcircle-enterprise-app-store-version-list',
          data: [
            {
              name: 'App Version 1',
              summary: 'Bug fixes',
              version: '1.0.1',
              versionCode: '101',
              publishType: 0,
              publishDate: '2024-01-01T10:00:00Z',
              platformType: 0,
              downloadCount: 50,
              createDate: '2024-01-01T09:00:00Z',
              updateDate: '2024-01-01T10:00:00Z'
            }
          ]
        }

        writeEnterpriseAppStoreCommand(data)

        expect(mockConsoleTable).toHaveBeenCalledWith(
          expect.arrayContaining([
            expect.objectContaining({
              'Version Name': 'App Version 1',
              'Summary': 'Bug fixes',
              'Version': '1.0.1',
              'Version Code': '101'
            })
          ])
        )
      })

      it('should write download link', () => {
        const data = {
          fullCommandName: 'appcircle-enterprise-app-store-version-download-link',
          data: 'https://example.com/download'
        }

        writeEnterpriseAppStoreCommand(data)

        expect(mockConsoleLog).toHaveBeenCalledWith('Download Link: https://example.com/download')
      })

      it('should write version publish result', () => {
        const data = {
          fullCommandName: 'appcircle-enterprise-app-store-version-publish',
          data: {
            name: 'Published App',
            version: '1.0.0',
            publishType: 1
          }
        }

        writeEnterpriseAppStoreCommand(data)

        expect(mockConsoleTable).toHaveBeenCalledWith(
          expect.arrayContaining([
            expect.objectContaining({
              'Version Name': 'Published App',
              'Version': '1.0.0'
            })
          ])
        )
      })
    })
  })

  describe('Organization Commands', () => {
    describe('writeOrganizationCommand', () => {
      it('should write organization view for single organization', () => {
        const data = {
          fullCommandName: 'appcircle-organization-view',
          data: {
            name: 'Test Org',
            id: 'org1',
            givenId: 'test-org',
            memberCount: 5,
            ssoEnabled: true,
            createdDate: '2024-01-01T10:00:00Z',
            rootOrganizationName: 'Root Org'
          }
        }

        writeOrganizationCommand(data)

        expect(mockConsoleTable).toHaveBeenCalledWith([
          {
            Name: 'Test Org',
            Id: 'org1',
            Members: 5,
            SSO: 'No'
          }
        ])
      })

      it('should write organization view for multiple organizations', () => {
        const data = {
          fullCommandName: 'appcircle-organization-view',
          data: [
            {
              name: 'Org 1',
              id: 'org1',
              ssoEnabled: false,
              disabled: false
            },
            {
              name: 'Org 2',
              id: 'org2',
              ssoEnabled: true,
              disabled: true
            }
          ]
        }

        writeOrganizationCommand(data)

        expect(mockConsoleTable).toHaveBeenCalledWith([
          expect.objectContaining({
            Name: 'Org 1',
            'SSO Enabled': 'No',
            Disabled: 'No'
          }),
          expect.objectContaining({
            Name: 'Org 2',
            'SSO Enabled': 'Yes',
            Disabled: 'Yes'
          })
        ])
      })

      it('should write organization user view', () => {
        const data = {
          fullCommandName: 'appcircle-organization-user-view',
          data: {
            users: [
              {
                username: 'john.doe',
                id: 'user1',
                email: 'john@example.com',
                isSubOrganizationMember: false,
                roles: ['admin', 'user']
              }
            ],
            invitations: [
              {
                userEmail: 'jane@example.com',
                rootOrganizationId: 'root1',
                isSubOrganizationMember: true,
                organizationsAndRoles: [{ roles: ['user'] }],
                status: 'pending'
              }
            ]
          }
        }

        writeOrganizationCommand(data)

        expect(mockConsoleLog).toHaveBeenCalledWith('\n- Users ↴ ')
        expect(mockConsoleLog).toHaveBeenCalledWith('\n- Invitations ↴ ')
        expect(mockConsoleTable).toHaveBeenCalledTimes(2)
      })

      it('should write organization user invite success', () => {
        const data = {
          fullCommandName: 'appcircle-organization-user-invite',
          data: {}
        }

        writeOrganizationCommand(data)

        expect(mockConsoleLog).toHaveBeenCalledWith('Invitation successfully sent.')
      })

      it('should write organization user remove success', () => {
        const data = {
          fullCommandName: 'appcircle-organization-user-remove',
          data: { email: 'user@example.com' }
        }

        writeOrganizationCommand(data)

        expect(mockConsoleLog).toHaveBeenCalledWith('User "user@example.com" has been removed.')
      })

      it('should write organization roles view', () => {
        const data = {
          fullCommandName: 'appcircle-organization-role-view',
          data: {
            roles: ['admin', 'user'],
            inheritedRoles: ['viewer']
          }
        }

        writeOrganizationCommand(data)

        expect(mockConsoleLog).toHaveBeenCalledWith('\n- Roles ↴ ')
        expect(mockConsoleTable).toHaveBeenCalledWith([
          { Role: 'admin', Inheritance: '-' },
          { Role: 'user', Inheritance: '-' },
          { Role: 'viewer', Inheritance: 'Inherit' }
        ])
      })

      it('should write no roles message', () => {
        const data = {
          fullCommandName: 'appcircle-organization-role-view',
          data: { roles: [], inheritedRoles: [] }
        }

        writeOrganizationCommand(data)

        expect(mockConsoleLog).toHaveBeenCalledWith('  No roles found.')
      })

      it('should write unknown command data directly', () => {
        const data = {
          fullCommandName: 'appcircle-organization-unknown-command',
          data: { message: 'Test data' }
        }

        writeOrganizationCommand(data)

        expect(mockConsoleLog).toHaveBeenCalledWith({ message: 'Test data' })
      })
    })
  })

  describe('Publish Commands', () => {
    describe('writePublishCommand', () => {
      it('should write publish profile create', () => {
        const data = {
          fullCommandName: 'appcircle-publish-profile-create',
          data: {
            id: 'profile1',
            name: 'iOS Store Profile',
            createDate: '2024-01-01T10:00:00Z'
          }
        }

        writePublishCommand(data)

        expect(mockConsoleTable).toHaveBeenCalledWith([
          {
            'Id:': 'profile1',
            'Name:': 'iOS Store Profile',
            'Created:': expect.any(String)
          }
        ])
      })

      it('should write publish profile list', () => {
        const data = {
          fullCommandName: 'appcircle-publish-profile-list',
          data: [
            {
              id: 'profile1',
              name: 'iOS Profile',
              lastUploadVersion: '1.0.0',
              lastUploadVersionCode: '100',
              version: '1.0',
              appUniqueId: 'com.example.app',
              publishDate: '2024-01-01T10:00:00Z',
              platformType: 0,
              createDate: '2024-01-01T09:00:00Z',
              updateDate: '2024-01-01T10:00:00Z'
            }
          ]
        }

        writePublishCommand(data)

        expect(mockConsoleTable).toHaveBeenCalledWith([
          expect.objectContaining({
            'Id': 'profile1',
            'Name': 'iOS Profile',
            'Last Version': '1.0.0',
            'App Unique Id': 'com.example.app'
          })
        ])
      })

      it('should write empty publish profile list', () => {
        const data = {
          fullCommandName: 'appcircle-publish-profile-list',
          data: []
        }

        writePublishCommand(data)

        expect(mockConsoleLog).toHaveBeenCalledWith('  No publish profile found')
      })

      it('should write publish version list', () => {
        const data = {
          fullCommandName: 'appcircle-publish-profile-version-list',
          data: [
            {
              id: 'version1',
              version: '1.0.0',
              versionCode: '100',
              name: 'Release 1',
              createDate: '2024-01-01T10:00:00Z',
              releaseCandidate: true,
              fileSize: 5000000,
              latestFlowStatus: 2
            }
          ]
        }

        writePublishCommand(data)

        expect(mockConsoleTable).toHaveBeenCalledWith([
          {
            'App Version Id': 'version1',
            'Version/App Name': '1.0.0(100) - Release 1',
            'Release Candidate': 'Yes',
            'File Size': '4.77 MB',
            'Binary Received': '2024-01-01T10:00:00Z',
            'Last Step': 2
          }
        ])
      })

      it('should write publish active list', () => {
        const data = {
          fullCommandName: 'appcircle-publish-active-list',
          data: [
            {
              publishId: 'publish1',
              profileName: 'iOS Store',
              stepName: 'Upload to Store',
              queueItemStatus: 1,
              email: 'user@example.com',
              startQueueDateTime: '2024-01-01T10:00:00Z',
              os: 0,
              profileId: 'profile1',
              appVersionId: 'version1'
            }
          ]
        }

        writePublishCommand(data)

        expect(mockConsoleTable).toHaveBeenCalledWith([
          expect.objectContaining({
            'Publish Id': 'publish1',
            'Profile Name': 'iOS Store',
            'Step Name': 'Upload to Store',
            'Started By': 'user@example.com'
          })
        ])
      })

      it('should write publish view with steps', () => {
        const data = {
          fullCommandName: 'appcircle-publish-view',
          data: {
            id: 'publish1',
            status: 2,
            startedOn: '2024-01-01T10:00:00Z',
            steps: [
              {
                name: 'Upload',
                status: 2,
                startedByUser: { email: 'user@example.com' },
                startedOn: '2024-01-01T10:00:00Z',
                finishedOn: '2024-01-01T10:05:00Z'
              }
            ]
          }
        }

        writePublishCommand(data)

        expect(mockConsoleTable).toHaveBeenCalledTimes(2) // Main table + steps table
        expect(mockConsoleLog).toHaveBeenCalledWith('*************')
        expect(mockConsoleInfo).toHaveBeenCalledWith('  Steps:')
      })

      it('should handle unknown publish command', () => {
        const data = {
          fullCommandName: 'appcircle-publish-unknown-command',
          data: { message: 'Unknown data' }
        }

        writePublishCommand(data)

        expect(mockConsoleLog).toHaveBeenCalledWith({ message: 'Unknown data' })
      })
    })
  })

  describe('Signing Identity Commands', () => {
    describe('writeSigningIdentityCommand', () => {
      it('should write certificate list', () => {
        const data = {
          fullCommandName: 'appcircle-signing-identity-certificate-list',
          data: [
            {
              id: 'cert1',
              name: 'iOS Certificate',
              storeType: 0,
              extension: '.p12',
              expireDate: '2024-12-31T23:59:59Z'
            }
          ]
        }

        writeSigningIdentityCommand(data)

        expect(mockConsoleTable).toHaveBeenCalledWith([
          {
            'Certificate Id': 'cert1',
            'Certificate Name': 'iOS Certificate',
            'Stored By': 'Organization',
            'Extension': '.p12',
            'Expire Date': '2024-12-31T23:59:59Z'
          }
        ])
      })

      it('should write empty certificate list', () => {
        const data = {
          fullCommandName: 'appcircle-signing-identity-certificate-list',
          data: []
        }

        writeSigningIdentityCommand(data)

        expect(mockConsoleLog).toHaveBeenCalledWith('  No iOS certificate found')
      })

      it('should write certificate upload result', () => {
        const data = {
          fullCommandName: 'appcircle-signing-identity-certificate-upload',
          data: {
            id: 'cert1',
            name: 'New Certificate',
            storeType: 1,
            filename: 'cert.p12',
            expireDate: '2024-12-31T23:59:59Z'
          }
        }

        writeSigningIdentityCommand(data)

        expect(mockConsoleTable).toHaveBeenCalledWith({
          'Certificate Id': 'cert1',
          'Certificate Name': 'New Certificate',
          'Stored By': 1,
          'File Name': 'cert.p12',
          'Expire Date': '2024-12-31T23:59:59Z'
        })
      })

      it('should write keystore list', () => {
        const data = {
          fullCommandName: 'appcircle-signing-identity-keystore-list',
          data: [
            {
              id: 'keystore1',
              name: 'Android Keystore',
              fileName: 'app.jks',
              expireDate: '2024-12-31T23:59:59Z'
            }
          ]
        }

        writeSigningIdentityCommand(data)

        expect(mockConsoleTable).toHaveBeenCalledWith([
          {
            'Keystore Id': 'keystore1',
            'Keystore Name': 'Android Keystore',
            'File Name': 'app.jks',
            'Expires': expect.any(String)
          }
        ])
      })

      it('should write provisioning profile list', () => {
        const data = {
          fullCommandName: 'appcircle-signing-identity-provisioning-profile-list',
          data: [
            {
              id: 'profile1',
              name: 'iOS Provisioning Profile',
              appId: 'com.example.app',
              storeType: 0,
              hasCertificate: true,
              expireDate: '2024-12-31T23:59:59Z'
            }
          ]
        }

        writeSigningIdentityCommand(data)

        expect(mockConsoleTable).toHaveBeenCalledWith([
          {
            'Id': 'profile1',
            'Name': 'iOS Provisioning Profile',
            'Associated App ID': 'com.example.app',
            'Stored By': 'Organization',
            'Has Certificate': true,
            'Expires': '2024-12-31T23:59:59Z'
          }
        ])
      })

      it('should handle missing certificate data', () => {
        const data = {
          fullCommandName: 'appcircle-signing-identity-certificate-upload',
          data: null
        }

        writeSigningIdentityCommand(data)

        expect(mockConsoleLog).toHaveBeenCalledWith('  No iOS certificate found')
      })
    })
  })
})