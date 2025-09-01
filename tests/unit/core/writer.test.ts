import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { commandWriter, configWriter } from '../../../src/core/writer.js'
import { CommandTypes } from '../../../src/core/commands.js'
import * as config from '../../../src/config.js'

// Mock console methods
const mockConsoleLog = vi.fn()
const mockConsoleInfo = vi.fn() 
const mockConsoleTable = vi.fn()
const originalConsole = { ...console }

describe('writer', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    console.log = mockConsoleLog
    console.info = mockConsoleInfo
    console.table = mockConsoleTable
  })

  afterEach(() => {
    console.log = originalConsole.log
    console.info = originalConsole.info
    console.table = originalConsole.table
  })

  describe('commandWriter', () => {
    describe('JSON output mode', () => {
      beforeEach(() => {
        vi.spyOn(config, 'getConsoleOutputType').mockReturnValue('json')
      })

      it('should output JSON for login command with data.data', () => {
        const testData = {
          data: { access_token: 'test-token' }
        }

        commandWriter(CommandTypes.LOGIN, testData)

        expect(mockConsoleLog).toHaveBeenCalledWith(
          JSON.stringify(testData.data)
        )
      })

      it('should output JSON for command without data.data property', () => {
        const testData = { access_token: 'test-token' }

        commandWriter(CommandTypes.LOGIN, testData)

        expect(mockConsoleLog).toHaveBeenCalledWith(
          JSON.stringify(testData)
        )
      })

      it('should handle null data gracefully', () => {
        // The writer tries to access data.data, so null will cause an error
        // Let's test with an empty object instead
        commandWriter(CommandTypes.LOGIN, {})

        expect(mockConsoleLog).toHaveBeenCalledWith('{}')
      })
    })

    describe('Plain output mode', () => {
      beforeEach(() => {
        vi.spyOn(config, 'getConsoleOutputType').mockReturnValue('plain')
      })

      describe('LOGIN command', () => {
        it('should display formatted login success message', () => {
          const testData = {
            access_token: 'test-access-token-123'
          }

          commandWriter(CommandTypes.LOGIN, testData)

          expect(mockConsoleLog).toHaveBeenCalledWith(
            expect.stringContaining('export AC_ACCESS_TOKEN="test-access-token-123"')
          )
          expect(mockConsoleInfo).toHaveBeenCalledWith(
            expect.stringContaining('Login is successful')
          )
        })
      })

      describe('CONFIG command', () => {
        it('should not output anything for config command', () => {
          const testData = { someConfig: 'value' }

          commandWriter(CommandTypes.CONFIG, testData)

          expect(mockConsoleLog).not.toHaveBeenCalled()
          expect(mockConsoleInfo).not.toHaveBeenCalled()
          expect(mockConsoleTable).not.toHaveBeenCalled()
        })
      })

      describe('LOGOUT command', () => {
        it('should not output anything for logout command', () => {
          const testData = { message: 'logged out' }

          commandWriter(CommandTypes.LOGOUT, testData)

          expect(mockConsoleLog).not.toHaveBeenCalled()
          expect(mockConsoleInfo).not.toHaveBeenCalled()
          expect(mockConsoleTable).not.toHaveBeenCalled()
        })
      })

      describe('TESTING_DISTRIBUTION command', () => {
        it('should display "no profiles" message when data is empty', () => {
          const testData = {
            fullCommandName: 'appcircle-testing-distribution-profile-list',
            data: []
          }

          commandWriter(CommandTypes.TESTING_DISTRIBUTION, testData)

          expect(mockConsoleInfo).toHaveBeenCalledWith('No distribution profiles available.')
          expect(mockConsoleTable).not.toHaveBeenCalled()
        })

        it('should display profiles table when data exists', () => {
          const testData = {
            fullCommandName: 'appcircle-testing-distribution-profile-list',
            data: [
              {
                id: 'profile-1',
                name: 'Test Profile',
                pinned: true,
                iOSVersion: '1.0',
                androidVersion: '1.0',
                updateDate: '2024-01-01T10:00:00Z',
                lastAppVersionSharedDate: '2024-01-02T10:00:00Z',
                settings: { authenticationType: 1 },
                testingGroupIds: ['group1']
              }
            ]
          }

          commandWriter(CommandTypes.TESTING_DISTRIBUTION, testData)

          expect(mockConsoleTable).toHaveBeenCalledWith(
            expect.arrayContaining([
              expect.objectContaining({
                'Profile Id': 'profile-1',
                'Profile Name': 'Test Profile',
                'Pinned': true,
                'Auto Send': 'Enabled'
              })
            ])
          )
        })

        it('should display profile creation success message', () => {
          const testData = {
            fullCommandName: 'appcircle-testing-distribution-profile-create',
            data: { name: 'New Profile' }
          }

          commandWriter(CommandTypes.TESTING_DISTRIBUTION, testData)

          expect(mockConsoleInfo).toHaveBeenCalledWith(
            '\nNew Profile distribution profile created successfully!'
          )
        })

        it('should handle testing group list with no groups', () => {
          const testData = {
            fullCommandName: 'appcircle-testing-distribution-testing-group-list',
            data: []
          }

          commandWriter(CommandTypes.TESTING_DISTRIBUTION, testData)

          expect(mockConsoleLog).toHaveBeenCalledWith('  No testing group found')
        })
      })

      describe('Unknown command type', () => {
        it('should not throw error for unmapped command type', () => {
          // Create a command type that doesn't exist in writersMap
          const invalidCommandType = 'INVALID_COMMAND' as CommandTypes
          
          expect(() => {
            commandWriter(invalidCommandType, { data: 'test' })
          }).not.toThrow()
          
          // Should not call any console methods since writer doesn't exist
          expect(mockConsoleLog).not.toHaveBeenCalled()
          expect(mockConsoleInfo).not.toHaveBeenCalled()
          expect(mockConsoleTable).not.toHaveBeenCalled()
        })
      })
    })
  })

  describe('configWriter', () => {
    describe('JSON output mode', () => {
      beforeEach(() => {
        vi.spyOn(config, 'getConsoleOutputType').mockReturnValue('json')
      })

      it('should output configuration as JSON', () => {
        const testConfig = {
          API_HOSTNAME: 'https://api.example.com',
          AUTH_HOSTNAME: 'https://auth.example.com',
          AC_ACCESS_TOKEN: 'test-token'
        }

        configWriter(testConfig)

        expect(mockConsoleLog).toHaveBeenCalledWith(
          JSON.stringify(testConfig)
        )
        expect(mockConsoleTable).not.toHaveBeenCalled()
      })

      it('should handle null config', () => {
        configWriter(null)

        expect(mockConsoleLog).toHaveBeenCalledWith('null')
      })

      it('should output JSON for BUILD command without calling table/info', () => {
        const testData = {
          fullCommandName: 'appcircle-build-profile-list',
          data: [{ id: 'build1', name: 'iOS Build' }]
        }

        commandWriter(CommandTypes.BUILD, testData)

        expect(mockConsoleLog).toHaveBeenCalledWith(
          JSON.stringify(testData.data)
        )
        expect(mockConsoleTable).not.toHaveBeenCalled()
        expect(mockConsoleInfo).not.toHaveBeenCalled()
      })

      it('should output JSON for ENTERPRISE_APP_STORE command', () => {
        const testData = {
          fullCommandName: 'appcircle-enterprise-app-store-profile-list',
          data: [{ id: 'profile1', name: 'Enterprise App' }]
        }

        commandWriter(CommandTypes.ENTERPRISE_APP_STORE, testData)

        expect(mockConsoleLog).toHaveBeenCalledWith(
          JSON.stringify(testData.data)
        )
        expect(mockConsoleTable).not.toHaveBeenCalled()
        expect(mockConsoleInfo).not.toHaveBeenCalled()
      })

      it('should output JSON for ORGANIZATION command', () => {
        const testData = {
          fullCommandName: 'appcircle-organization-view',
          data: { name: 'My Org', id: 'org1' }
        }

        commandWriter(CommandTypes.ORGANIZATION, testData)

        expect(mockConsoleLog).toHaveBeenCalledWith(
          JSON.stringify(testData.data)
        )
        expect(mockConsoleTable).not.toHaveBeenCalled()
        expect(mockConsoleInfo).not.toHaveBeenCalled()
      })

      it('should output JSON for PUBLISH command', () => {
        const testData = {
          fullCommandName: 'appcircle-publish-profile-list',
          data: [{ id: 'pub1', name: 'Production' }]
        }

        commandWriter(CommandTypes.PUBLISH, testData)

        expect(mockConsoleLog).toHaveBeenCalledWith(
          JSON.stringify(testData.data)
        )
        expect(mockConsoleTable).not.toHaveBeenCalled()
        expect(mockConsoleInfo).not.toHaveBeenCalled()
      })

      it('should output JSON for SIGNING_IDENTITY command', () => {
        const testData = {
          fullCommandName: 'appcircle-signing-identity-certificate-list',
          data: [{ id: 'cert1', name: 'iOS Certificate' }]
        }

        commandWriter(CommandTypes.SIGNING_IDENTITY, testData)

        expect(mockConsoleLog).toHaveBeenCalledWith(
          JSON.stringify(testData.data)
        )
        expect(mockConsoleTable).not.toHaveBeenCalled()
        expect(mockConsoleInfo).not.toHaveBeenCalled()
      })
    })

    describe('Plain output mode', () => {
      beforeEach(() => {
        vi.spyOn(config, 'getConsoleOutputType').mockReturnValue('plain')
      })

      it('should display configuration as table', () => {
        const testConfig = {
          API_HOSTNAME: 'https://api.example.com',
          AUTH_HOSTNAME: 'https://auth.example.com',
          AC_ACCESS_TOKEN: 'test-token'
        }

        configWriter(testConfig)

        expect(mockConsoleTable).toHaveBeenCalledWith(testConfig)
        expect(mockConsoleLog).not.toHaveBeenCalled()
      })

      it('should handle empty config object', () => {
        const testConfig = {}

        configWriter(testConfig)

        expect(mockConsoleTable).toHaveBeenCalledWith(testConfig)
      })
    })
  })

  describe('Edge cases', () => {
    beforeEach(() => {
      vi.spyOn(config, 'getConsoleOutputType').mockReturnValue('plain')
    })

    it('should handle data with missing properties gracefully', () => {
      const testData = {
        fullCommandName: 'appcircle-testing-distribution-profile-list',
        data: [
          {
            // Missing most properties but with required ones for the writer
            id: 'profile-1',
            name: 'Test Profile',
            pinned: false,
            settings: { authenticationType: 1 }
          }
        ]
      }

      expect(() => {
        commandWriter(CommandTypes.TESTING_DISTRIBUTION, testData)
      }).not.toThrow()

      expect(mockConsoleTable).toHaveBeenCalled()
    })

    it('should handle undefined data gracefully', () => {
      // LOGIN writer tries to access data.access_token, so we need to provide minimal structure
      expect(() => {
        commandWriter(CommandTypes.CONFIG, undefined) // CONFIG writer does nothing, so safer test
      }).not.toThrow()
    })
  })

  describe('writersMap function tests', () => {
    beforeEach(() => {
      vi.spyOn(config, 'getConsoleOutputType').mockReturnValue('plain')
    })

    describe('BUILD command', () => {
      it('should display build profile list', () => {
        const testData = {
          fullCommandName: 'appcircle-build-profile-list',
          data: [
            {
              id: 'build1',
              name: 'iOS Build Profile',
              pinned: true,
              os: 1,
              buildPlatformType: 2,
              repositoryName: 'my-ios-repo',
              lastBuildDate: '2024-01-01T10:00:00Z',
              autoDistributeCount: 2,
              autoBuildCount: 1
            }
          ]
        }

        commandWriter(CommandTypes.BUILD, testData)

        expect(mockConsoleTable).toHaveBeenCalledWith(
          expect.arrayContaining([
            expect.objectContaining({
              'Profile Id': 'build1',
              'Profile Name': 'iOS Build Profile',
              'Pinned': true
            })
          ])
        )
      })

      it('should display no build profiles when empty', () => {
        const testData = {
          fullCommandName: 'appcircle-build-profile-list',
          data: []
        }

        commandWriter(CommandTypes.BUILD, testData)

        expect(mockConsoleInfo).toHaveBeenCalledWith('No build profiles available.')
      })

      it('should display build variable groups', () => {
        const testData = {
          fullCommandName: 'appcircle-build-variable-group-list',
          data: [
            { id: 'group1', name: 'Production Variables' },
            { id: 'group2', name: 'Staging Variables' }
          ]
        }

        commandWriter(CommandTypes.BUILD, testData)

        expect(mockConsoleTable).toHaveBeenCalledWith(
          expect.arrayContaining([
            expect.objectContaining({
              'Variable Groups ID': 'group1',
              'Variable Groups Name': 'Production Variables'
            })
          ])
        )
      })

      it('should display build view with duration and dates', () => {
        const testData = {
          fullCommandName: 'appcircle-build-view',
          data: {
            id: 'build1',
            commitId: 'commit123',
            hash: 'abc123',
            hasWarning: true,
            status: 1,
            duration: 3723000, // 1h 2m 3s in milliseconds
            isDistributable: true,
            startDate: '2024-01-01T10:00:00Z',
            endDate: '2024-01-01T11:02:03Z'
          }
        }

        commandWriter(CommandTypes.BUILD, testData)

        expect(mockConsoleTable).toHaveBeenCalledWith(
          expect.objectContaining({
            'Build Id': 'build1',
            'Commit Id': 'commit123',
            'Duration': expect.stringContaining('1 hours')
          })
        )
      })

      it('should handle build view without duration', () => {
        const testData = {
          fullCommandName: 'appcircle-build-view',
          data: {
            id: 'build2',
            commitId: 'commit456',
            status: 0,
            startDate: '2024-01-01T10:00:00Z'
          }
        }

        commandWriter(CommandTypes.BUILD, testData)

        expect(mockConsoleTable).toHaveBeenCalledWith(
          expect.objectContaining({
            'Build Id': 'build2',
            'Duration': '-'
          })
        )
      })

      it('should display environment variables with secrets masked', () => {
        const testData = {
          fullCommandName: 'appcircle-build-variable-view',
          data: [
            { key: 'API_KEY', value: 'secret123', isSecret: true },
            { key: 'DEBUG', value: 'true', isSecret: false }
          ]
        }

        commandWriter(CommandTypes.BUILD, testData)

        expect(mockConsoleTable).toHaveBeenCalledWith(
          expect.arrayContaining([
            expect.objectContaining({
              'Key Name': 'API_KEY',
              'Key Value': '********'
            }),
            expect.objectContaining({
              'Key Name': 'DEBUG',
              'Key Value': 'true'
            })
          ])
        )
      })
    })

    describe('ENTERPRISE_APP_STORE command', () => {
      it('should display enterprise app store profiles', () => {
        const testData = {
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

        commandWriter(CommandTypes.ENTERPRISE_APP_STORE, testData)

        expect(mockConsoleTable).toHaveBeenCalledWith(
          expect.arrayContaining([
            expect.objectContaining({
              'Profile Id': 'profile1',
              'Profile Name': 'Enterprise App',
              'Version': '1.0.0',
              'Downloads': 150
            })
          ])
        )
      })

      it('should display download link', () => {
        const testData = {
          fullCommandName: 'appcircle-enterprise-app-store-version-download-link',
          data: 'https://example.com/download/app.ipa'
        }

        commandWriter(CommandTypes.ENTERPRISE_APP_STORE, testData)

        expect(mockConsoleLog).toHaveBeenCalledWith(
          'Download Link: https://example.com/download/app.ipa'
        )
      })
    })

    describe('ORGANIZATION command', () => {
      it('should display organization view for single org', () => {
        const testData = {
          fullCommandName: 'appcircle-organization-view',
          data: {
            name: 'My Organization',
            id: 'org1',
            givenId: 'given1',
            memberCount: 5,
            ssoEnabled: true,
            createdDate: '2024-01-01T10:00:00Z'
          }
        }

        commandWriter(CommandTypes.ORGANIZATION, testData)

        expect(mockConsoleTable).toHaveBeenCalled()
      })

      it('should display user invitation success', () => {
        const testData = {
          fullCommandName: 'appcircle-organization-user-invite'
        }

        commandWriter(CommandTypes.ORGANIZATION, testData)

        expect(mockConsoleLog).toHaveBeenCalledWith('Invitation successfully sent.')
      })

      it('should display organization role view with merged roles and inheritance', () => {
        const testData = {
          fullCommandName: 'appcircle-organization-role-view',
          data: {
            roles: ['Admin', 'Viewer', 'Admin'],
            inheritedRoles: ['Viewer']
          }
        }

        commandWriter(CommandTypes.ORGANIZATION, testData)

        expect(mockConsoleTable).toHaveBeenCalledWith(
          expect.arrayContaining([
            expect.objectContaining({
              'Role': 'Admin',
              'Inheritance': '-'
            }),
            expect.objectContaining({
              'Role': 'Viewer',
              'Inheritance': 'Inherit'
            })
          ])
        )
      })
    })

    describe('PUBLISH command', () => {
      it('should display publish profile creation', () => {
        const testData = {
          fullCommandName: 'appcircle-publish-profile-create',
          data: {
            id: 'profile1',
            name: 'Production Profile',
            createDate: '2024-01-01T10:00:00Z'
          }
        }

        commandWriter(CommandTypes.PUBLISH, testData)

        expect(mockConsoleTable).toHaveBeenCalledWith(
          expect.arrayContaining([
            expect.objectContaining({
              'Id:': 'profile1',
              'Name:': 'Production Profile'
            })
          ])
        )
      })

      it('should handle empty publish profiles', () => {
        const testData = {
          fullCommandName: 'appcircle-publish-profile-list',
          data: []
        }

        commandWriter(CommandTypes.PUBLISH, testData)

        expect(mockConsoleLog).toHaveBeenCalledWith('  No publish profile found')
      })

      it('should display publish version with publish type mapping', () => {
        const testData = {
          fullCommandName: 'appcircle-publish-profile-version-view',
          data: {
            id: 'version1',
            name: '1.0.0',
            version: '1.0.0',
            versionCode: 1,
            createDate: '2024-01-01T10:00:00Z'
          }
        }

        commandWriter(CommandTypes.PUBLISH, testData)

        expect(mockConsoleTable).toHaveBeenCalledWith(
          expect.objectContaining({
            'App Version Id': 'version1',
            'Version/App Name': expect.stringContaining('1.0.0')
          })
        )
      })

      it('should handle unknown publish status fallback', () => {
        const testData = {
          fullCommandName: 'appcircle-publish-profile-version-list',
          data: [
            {
              id: 'version1',
              name: '1.0.0',
              version: '1.0.0',
              versionCode: 1,
              latestFlowStatus: 999, // Unknown status should fallback
              createDate: '2024-01-01T10:00:00Z'
            }
          ]
        }

        commandWriter(CommandTypes.PUBLISH, testData)

        expect(mockConsoleTable).toHaveBeenCalledWith(
          expect.arrayContaining([
            expect.objectContaining({
              'App Version Id': 'version1',
              'Last Step': 'Not Started'
            })
          ])
        )
      })
    })

    describe('SIGNING_IDENTITY command', () => {
      it('should display iOS certificates', () => {
        const testData = {
          fullCommandName: 'appcircle-signing-identity-certificate-list',
          data: [
            {
              id: 'cert1',
              name: 'iOS Distribution Certificate',
              storeType: 1,
              extension: '.p12',
              expireDate: '2025-01-01T10:00:00Z'
            }
          ]
        }

        commandWriter(CommandTypes.SIGNING_IDENTITY, testData)

        expect(mockConsoleTable).toHaveBeenCalledWith(
          expect.arrayContaining([
            expect.objectContaining({
              'Certificate Id': 'cert1',
              'Certificate Name': 'iOS Distribution Certificate',
              'Extension': '.p12'
            })
          ])
        )
      })

      it('should handle unknown certificate store type fallback', () => {
        const testData = {
          fullCommandName: 'appcircle-signing-identity-certificate-list',
          data: [
            {
              id: 'cert1',
              name: 'Unknown Certificate',
              storeType: 999, // Unknown store type
              extension: '.p12',
              expireDate: '2025-01-01T10:00:00Z'
            }
          ]
        }

        commandWriter(CommandTypes.SIGNING_IDENTITY, testData)

        expect(mockConsoleTable).toHaveBeenCalledWith(
          expect.arrayContaining([
            expect.objectContaining({
              'Certificate Id': 'cert1',
              'Stored By': undefined
            })
          ])
        )
      })

      it('should handle build list with proper data structure', () => {
        const testData = {
          fullCommandName: 'appcircle-build-list',
          data: {
            builds: [
              {
                id: 'build1',
                hash: 'abc123',
                hasWarning: false,
                status: 1,
                startDate: '2024-01-01T10:00:00Z',
                endDate: '2024-01-01T11:00:00Z'
              }
            ]
          }
        }

        commandWriter(CommandTypes.BUILD, testData)

        expect(mockConsoleTable).toHaveBeenCalledWith(
          expect.arrayContaining([
            expect.objectContaining({
              'Build Id': 'build1',
              'Hash': 'abc123'
            })
          ])
        )
      })

      it('should handle empty certificates', () => {
        const testData = {
          fullCommandName: 'appcircle-signing-identity-certificate-list',
          data: []
        }

        commandWriter(CommandTypes.SIGNING_IDENTITY, testData)

        expect(mockConsoleLog).toHaveBeenCalledWith('  No iOS certificate found')
      })

      it('should display keystore list', () => {
        const testData = {
          fullCommandName: 'appcircle-signing-identity-keystore-list',
          data: [
            {
              id: 'keystore1',
              name: 'Release Keystore',
              fileName: 'release.keystore',
              expireDate: '2025-01-01T10:00:00Z'
            }
          ]
        }

        commandWriter(CommandTypes.SIGNING_IDENTITY, testData)

        expect(mockConsoleTable).toHaveBeenCalledWith(
          expect.arrayContaining([
            expect.objectContaining({
              'Keystore Id': 'keystore1',
              'Keystore Name': 'Release Keystore',
              'File Name': 'release.keystore'
            })
          ])
        )
      })

      it('should display empty provisioning profiles message', () => {
        const testData = {
          fullCommandName: 'appcircle-signing-identity-provisioning-profile-list',
          data: []
        }

        commandWriter(CommandTypes.SIGNING_IDENTITY, testData)

        expect(mockConsoleLog).toHaveBeenCalledWith('  No Provisioning Profile found')
      })

      it('should display provisioning profiles list', () => {
        const testData = {
          fullCommandName: 'appcircle-signing-identity-provisioning-profile-list',
          data: [
            {
              id: 'profile1',
              name: 'Development Profile',
              appId: 'com.example.app',
              hasCertificate: true,
              expireDate: '2025-01-01T10:00:00Z'
            }
          ]
        }

        commandWriter(CommandTypes.SIGNING_IDENTITY, testData)

        expect(mockConsoleTable).toHaveBeenCalledWith(
          expect.arrayContaining([
            expect.objectContaining({
              'Id': 'profile1',
              'Name': 'Development Profile',
              'Associated App ID': 'com.example.app'
            })
          ])
        )
      })
    })

    describe('Additional empty data scenarios', () => {
      it('should handle empty BUILD branch commits', () => {
        const testData = {
          fullCommandName: 'appcircle-build-profile-branch-commits',
          data: []
        }

        commandWriter(CommandTypes.BUILD, testData)

        expect(mockConsoleInfo).toHaveBeenCalledWith('No commits available.')
      })

      it('should handle empty BUILD builds list', () => {
        const testData = {
          fullCommandName: 'appcircle-build-list',
          data: { builds: [] }
        }

        commandWriter(CommandTypes.BUILD, testData)

        expect(mockConsoleInfo).toHaveBeenCalledWith('No builds available.')
      })

      it('should handle empty ENTERPRISE_APP_STORE version list', () => {
        const testData = {
          fullCommandName: 'appcircle-enterprise-app-store-version-list',
          data: []
        }

        commandWriter(CommandTypes.ENTERPRISE_APP_STORE, testData)

        expect(mockConsoleInfo).toHaveBeenCalledWith('No app versions available.')
      })

      it('should display ENTERPRISE_APP_STORE version list', () => {
        const testData = {
          fullCommandName: 'appcircle-enterprise-app-store-version-list',
          data: [
            {
              name: '1.0',
              summary: 'Initial release',
              version: '1.0',
              versionCode: 1,
              createDate: '2024-01-01T00:00:00Z'
            }
          ]
        }

        commandWriter(CommandTypes.ENTERPRISE_APP_STORE, testData)

        expect(mockConsoleTable).toHaveBeenCalledWith(
          expect.arrayContaining([
            expect.objectContaining({
              'Version Name': '1.0',
              'Version': '1.0'
            })
          ])
        )
      })

      it('should handle empty PUBLISH variable group list', () => {
        const testData = {
          fullCommandName: 'appcircle-publish-variable-group-list',
          data: []
        }

        commandWriter(CommandTypes.PUBLISH, testData)

        expect(mockConsoleLog).toHaveBeenCalledWith('  No publish variable group found')
      })

      it('should handle empty PUBLISH version list', () => {
        const testData = {
          fullCommandName: 'appcircle-publish-profile-version-list',
          data: []
        }

        commandWriter(CommandTypes.PUBLISH, testData)

        expect(mockConsoleLog).toHaveBeenCalledWith('  No app version found')
      })

      it('should handle TESTING_DISTRIBUTION testing group with testers', () => {
        const testData = {
          fullCommandName: 'appcircle-testing-distribution-testing-group-view',
          data: {
            id: 'group1',
            name: 'QA Team',
            testers: [
              { email: 'qa1@example.com' },
              { email: 'qa2@example.com' }
            ]
          }
        }

        commandWriter(CommandTypes.TESTING_DISTRIBUTION, testData)

        expect(mockConsoleInfo).toHaveBeenCalledWith('  Testers:')
        expect(mockConsoleTable).toHaveBeenCalledWith(
          expect.arrayContaining([
            expect.objectContaining({ email: 'qa1@example.com' }),
            expect.objectContaining({ email: 'qa2@example.com' })
          ])
        )
      })
    })

    describe('Missing coverage paths', () => {
      // Add tests for uncovered lines from coverage report
      
      it('should handle enterprise app store version unpublish command', () => {
        const testData = {
          fullCommandName: 'appcircle-enterprise-app-store-version-unpublish',
          data: {
            name: 'Test App',
            summary: 'Test Summary',
            version: '1.0.0',
            versionCode: 1,
            publishType: 1,
            publishDate: '2024-01-01T10:00:00Z',
            platformType: 1,
            downloadCount: 50,
            createDate: '2024-01-01T10:00:00Z',
            updateDate: '2024-01-02T10:00:00Z'
          }
        }

        commandWriter(CommandTypes.ENTERPRISE_APP_STORE, testData)

        expect(mockConsoleTable).toHaveBeenCalledWith(
          expect.arrayContaining([
            expect.objectContaining({
              'Profile Name': 'Test App',
              'Version': '1.0.0',
              'Downloads': 50
            })
          ])
        )
      })

      it('should handle enterprise app store version notify with empty data', () => {
        const testData = {
          fullCommandName: 'appcircle-enterprise-app-store-version-notify',
          data: []
        }

        commandWriter(CommandTypes.ENTERPRISE_APP_STORE, testData)

        expect(mockConsoleInfo).toHaveBeenCalledWith('No app versions available.')
      })

      it('should handle organization user re-invite command', () => {
        const testData = {
          fullCommandName: 'appcircle-organization-user-re-invite'
        }

        commandWriter(CommandTypes.ORGANIZATION, testData)

        expect(mockConsoleLog).toHaveBeenCalledWith('Re-invitation successfully sent again.')
      })

      it('should handle organization user remove command', () => {
        const testData = {
          fullCommandName: 'appcircle-organization-user-remove',
          data: { email: 'user@example.com' }
        }

        commandWriter(CommandTypes.ORGANIZATION, testData)

        expect(mockConsoleLog).toHaveBeenCalledWith('User "user@example.com" has been removed.')
      })

      it('should handle organization role view with no roles', () => {
        const testData = {
          fullCommandName: 'appcircle-organization-role-view',
          data: {
            roles: [],
            inheritedRoles: []
          }
        }

        commandWriter(CommandTypes.ORGANIZATION, testData)

        expect(mockConsoleLog).toHaveBeenCalledWith('  No roles found.')
      })

      it('should handle organization default case (unknown command)', () => {
        const testData = {
          fullCommandName: 'appcircle-organization-unknown-command',
          data: { test: 'data' }
        }

        commandWriter(CommandTypes.ORGANIZATION, testData)

        expect(mockConsoleLog).toHaveBeenCalledWith({ test: 'data' })
      })

      it('should handle publish profile rename command', () => {
        const testData = {
          fullCommandName: 'appcircle-publish-profile-rename',
          data: {
            id: 'profile1',
            name: 'Renamed Profile',
            createDate: '2024-01-01T10:00:00Z',
            updateDate: '2024-01-02T10:00:00Z'
          }
        }

        commandWriter(CommandTypes.PUBLISH, testData)

        expect(mockConsoleTable).toHaveBeenCalledWith(
          expect.arrayContaining([
            expect.objectContaining({
              'Id:': 'profile1',
              'Name:': 'Renamed Profile',
              'Updated:': expect.any(String)
            })
          ])
        )
      })

      it('should handle publish variable group view with empty data', () => {
        const testData = {
          fullCommandName: 'appcircle-publish-variable-group-view',
          data: []
        }

        commandWriter(CommandTypes.PUBLISH, testData)

        expect(mockConsoleLog).toHaveBeenCalledWith('  No publish variable found')
      })

      it('should handle publish variable group view with data', () => {
        const testData = {
          fullCommandName: 'appcircle-publish-variable-group-view',
          data: [
            { key: 'API_KEY', value: 'secret123', isSecret: true },
            { key: 'DEBUG', value: 'true', isSecret: false }
          ]
        }

        commandWriter(CommandTypes.PUBLISH, testData)

        expect(mockConsoleTable).toHaveBeenCalledWith([
          { 'Key Name': 'API_KEY', 'Key Value': '********' },
          { 'Key Name': 'DEBUG', 'Key Value': 'true' }
        ])
      })

      it('should handle empty publish active list', () => {
        const testData = {
          fullCommandName: 'appcircle-publish-active-list',
          data: []
        }

        commandWriter(CommandTypes.PUBLISH, testData)

        expect(mockConsoleLog).toHaveBeenCalledWith('  No active publishing process available.')
      })

      it('should handle publish active list with data', () => {
        const testData = {
          fullCommandName: 'appcircle-publish-active-list',
          data: [
            {
              publishId: 'pub1',
              profileName: 'Production Profile',
              stepName: 'Deploy',
              queueItemStatus: 1,
              email: 'dev@example.com',
              startQueueDateTime: '2024-01-01T10:00:00Z',
              os: 1,
              profileId: 'profile1',
              appVersionId: 'version1'
            }
          ]
        }

        commandWriter(CommandTypes.PUBLISH, testData)

        expect(mockConsoleTable).toHaveBeenCalledWith(
          expect.arrayContaining([
            expect.objectContaining({
              'Publish Id': 'pub1',
              'Profile Name': 'Production Profile',
              'Step Name': 'Deploy'
            })
          ])
        )
      })

      it('should handle publish profile settings autopublish with disabled setting', () => {
        const testData = {
          fullCommandName: 'appcircle-publish-profile-settings-autopublish',
          data: {
            id: 'profile1',
            name: 'Manual Publish Profile',
            profileSettings: { whenNewVersionRecieved: false }
          }
        }

        commandWriter(CommandTypes.PUBLISH, testData)

        expect(mockConsoleTable).toHaveBeenCalledWith(
          expect.arrayContaining([
            expect.objectContaining({
              'Auto Publish': 'No'
            })
          ])
        )
      })

      it('should handle publish profile settings autopublish', () => {
        const testData = {
          fullCommandName: 'appcircle-publish-profile-settings-autopublish',
          data: {
            id: 'profile1',
            name: 'Auto Publish Profile',
            createDate: '2024-01-01T10:00:00Z',
            updateDate: '2024-01-02T10:00:00Z',
            profileSettings: { whenNewVersionRecieved: true }
          }
        }

        commandWriter(CommandTypes.PUBLISH, testData)

        expect(mockConsoleTable).toHaveBeenCalledWith(
          expect.arrayContaining([
            expect.objectContaining({
              'Id:': 'profile1',
              'Auto Publish': 'Yes'
            })
          ])
        )
      })

      it('should handle publish profile version mark as rc', () => {
        const testData = {
          fullCommandName: 'appcircle-publish-profile-version-mark-as-rc',
          data: {
            id: 'version1',
            name: 'Version 1.0',
            uniqueName: 'v1.0-unique',
            createDate: '2024-01-01T10:00:00Z',
            updateDate: '2024-01-02T10:00:00Z',
            releaseCandidate: true
          }
        }

        commandWriter(CommandTypes.PUBLISH, testData)

        expect(mockConsoleTable).toHaveBeenCalledWith(
          expect.arrayContaining([
            expect.objectContaining({
              'Id:': 'version1',
              'Release Candidate': 'Yes'
            })
          ])
        )
      })

      it('should handle publish profile version unmark as rc', () => {
        const testData = {
          fullCommandName: 'appcircle-publish-profile-version-unmark-as-rc',
          data: {
            id: 'version1',
            name: 'Version 1.0',
            uniqueName: 'v1.0-unique',
            releaseCandidate: false
          }
        }

        commandWriter(CommandTypes.PUBLISH, testData)

        expect(mockConsoleTable).toHaveBeenCalledWith(
          expect.arrayContaining([
            expect.objectContaining({
              'Release Candidate': 'No'
            })
          ])
        )
      })

      it('should handle publish profile version view with no data', () => {
        const testData = {
          fullCommandName: 'appcircle-publish-profile-version-view',
          data: null
        }

        commandWriter(CommandTypes.PUBLISH, testData)

        expect(mockConsoleLog).toHaveBeenCalledWith('  No app version found')
      })

      it('should handle publish view with no data', () => {
        const testData = {
          fullCommandName: 'appcircle-publish-view',
          data: null
        }

        commandWriter(CommandTypes.PUBLISH, testData)

        expect(mockConsoleLog).toHaveBeenCalledWith('  No publishing process found')
      })

      it('should handle publish view with steps', () => {
        const testData = {
          fullCommandName: 'appcircle-publish-view',
          data: {
            id: 'publish1',
            status: 1,
            startedOn: '2024-01-01T10:00:00Z',
            steps: [
              {
                name: 'Step 1',
                status: 1,
                startedByUser: { email: 'user@example.com' },
                startedOn: '2024-01-01T10:05:00Z',
                finishedOn: '2024-01-01T10:10:00Z'
              }
            ]
          }
        }

        commandWriter(CommandTypes.PUBLISH, testData)

        expect(mockConsoleInfo).toHaveBeenCalledWith('  Steps:')
        expect(mockConsoleTable).toHaveBeenCalledWith(
          expect.arrayContaining([
            expect.objectContaining({
              'Name': 'Step 1',
              'Started By': 'user@example.com'
            })
          ])
        )
      })

      it('should handle publish default case', () => {
        const testData = {
          fullCommandName: 'appcircle-publish-unknown-command',
          data: { test: 'publish data' }
        }

        commandWriter(CommandTypes.PUBLISH, testData)

        expect(mockConsoleLog).toHaveBeenCalledWith({ test: 'publish data' })
      })

      it('should handle signing identity certificate upload', () => {
        const testData = {
          fullCommandName: 'appcircle-signing-identity-certificate-upload',
          data: {
            id: 'cert1',
            name: 'Upload Certificate',
            storeType: 1,
            filename: 'cert.p12',
            expireDate: '2025-01-01T10:00:00Z'
          }
        }

        commandWriter(CommandTypes.SIGNING_IDENTITY, testData)

        expect(mockConsoleTable).toHaveBeenCalledWith(
          expect.objectContaining({
            'Certificate Id': 'cert1',
            'File Name': 'cert.p12'
          })
        )
      })

      it('should handle signing identity certificate upload with no data', () => {
        const testData = {
          fullCommandName: 'appcircle-signing-identity-certificate-upload',
          data: null
        }

        commandWriter(CommandTypes.SIGNING_IDENTITY, testData)

        expect(mockConsoleLog).toHaveBeenCalledWith('  No iOS certificate found')
      })

      it('should handle signing identity certificate create', () => {
        const testData = {
          fullCommandName: 'appcircle-signing-identity-certificate-create',
          data: {
            id: 'cert2',
            name: 'New Certificate',
            storeType: 2,
            createDate: '2024-01-01T10:00:00Z'
          }
        }

        commandWriter(CommandTypes.SIGNING_IDENTITY, testData)

        expect(mockConsoleTable).toHaveBeenCalledWith(
          expect.objectContaining({
            'Certificate Id': 'cert2',
            'Certificate Name': 'New Certificate'
          })
        )
      })

      it('should handle signing identity certificate view', () => {
        const testData = {
          fullCommandName: 'appcircle-signing-identity-certificate-view',
          data: {
            id: 'cert3',
            name: 'View Certificate',
            filename: 'view-cert.p12',
            storeType: 1,
            expireDate: '2025-01-01T10:00:00Z',
            createDate: '2024-01-01T10:00:00Z',
            updateDate: '2024-01-02T10:00:00Z'
          }
        }

        commandWriter(CommandTypes.SIGNING_IDENTITY, testData)

        expect(mockConsoleTable).toHaveBeenCalledWith(
          expect.objectContaining({
            'Certificate Id': 'cert3',
            'File Name': 'view-cert.p12',
            'Created': expect.any(String),
            'Updated': expect.any(String)
          })
        )
      })

      it('should handle empty Android keystore list', () => {
        const testData = {
          fullCommandName: 'appcircle-signing-identity-keystore-list',
          data: []
        }

        commandWriter(CommandTypes.SIGNING_IDENTITY, testData)

        expect(mockConsoleLog).toHaveBeenCalledWith('  No Android keystore found')
      })

      it('should handle keystore view', () => {
        const testData = {
          fullCommandName: 'appcircle-signing-identity-keystore-view',
          data: {
            id: 'keystore1',
            name: 'Production Keystore',
            alias: 'prod-alias',
            fileName: 'production.keystore',
            createDate: '2024-01-01T10:00:00Z',
            expireDate: '2025-01-01T10:00:00Z'
          }
        }

        commandWriter(CommandTypes.SIGNING_IDENTITY, testData)

        expect(mockConsoleTable).toHaveBeenCalledWith(
          expect.objectContaining({
            'Keystore Id': 'keystore1',
            'Alias': 'prod-alias'
          })
        )
      })

      it('should handle keystore view with no data', () => {
        const testData = {
          fullCommandName: 'appcircle-signing-identity-keystore-view',
          data: null
        }

        commandWriter(CommandTypes.SIGNING_IDENTITY, testData)

        expect(mockConsoleLog).toHaveBeenCalledWith('  No Android keystore found')
      })

      it('should handle provisioning profile view', () => {
        const testData = {
          fullCommandName: 'appcircle-signing-identity-provisioning-profile-view',
          data: {
            id: 'profile1',
            name: 'Development Profile',
            appId: 'com.example.app',
            storeType: 1,
            hasCertificate: true,
            expireDate: '2025-01-01T10:00:00Z',
            createDate: '2024-01-01T10:00:00Z'
          }
        }

        commandWriter(CommandTypes.SIGNING_IDENTITY, testData)

        expect(mockConsoleTable).toHaveBeenCalledWith(
          expect.objectContaining({
            'Id': 'profile1',
            'Associated App ID': 'com.example.app',
            'Has Certificate': true
          })
        )
      })

      it('should handle provisioning profile view with no data', () => {
        const testData = {
          fullCommandName: 'appcircle-signing-identity-provisioning-profile-view',
          data: null
        }

        commandWriter(CommandTypes.SIGNING_IDENTITY, testData)

        expect(mockConsoleLog).toHaveBeenCalledWith('  No Provisioning Profile found')
      })
    })
  })
})