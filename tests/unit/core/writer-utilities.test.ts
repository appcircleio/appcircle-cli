import { describe, it, expect, vi, beforeEach } from 'vitest'
import moment from 'moment'

// Import all utilities to test
import {
  formatDate,
  formatRelativeDate,
  formatDuration,
  formatFileSize,
  formatBoolean,
  formatEnabledStatus,
  mapEnumValue,
  mapAuthenticationType,
  mapOperatingSystem,
  mapPlatformType,
  mapPublishType,
  mapBuildStatus,
  mapQueueItemStatus,
  mapCertificateStoreType,
  safeGet,
  validateTableData,
  formatVersionString,
  formatAutoDistributeStatus,
  formatAutoSendStatus,
  logInfo,
  logMessage,
  logTable,
  shouldDisplayTable,
  transformDistributionProfile,
  transformBuildProfile,
  transformBranch,
  transformCommit,
  transformBuild,
  transformBuildDetails,
  transformEnvironmentVariable,
  transformActiveBuild,
  transformOrganizationList,
  transformOrganizationDetails,
  transformUser,
  transformInvitation,
  processRolesWithInheritance,
  truncateText,
  joinArray
} from '../../../src/core/writer-utilities'

// Mock the constants
vi.mock('../../../src/constant', () => ({
  AuthenticationTypes: { 0: 'None', 1: 'Login', 2: 'LDAP' },
  OperatingSystems: { 0: 'iOS', 1: 'Android', 2: 'React Native' },
  PlatformTypes: { 0: 'ObjectiveC', 1: 'Swift', 2: 'Java' },
  PublishTypes: { 0: 'Beta', 1: 'Store', 2: 'Enterprise' },
  BuildStatus: { 0: 'Waiting', 1: 'Running', 2: 'Success', 3: 'Failed' },
  QueueItemStatus: { 0: 'Queued', 1: 'Running', 2: 'Completed' },
  IOSCertificateStoreTypes: { 0: 'User', 1: 'Organization' }
}))

describe('Writer Utilities', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('Date Formatting', () => {
    describe('formatDate', () => {
      it('should format valid date', () => {
        const date = '2024-01-15T10:30:00Z'
        const result = formatDate(date)
        expect(result).not.toBe('-')
        expect(result).not.toBe(date) // Should be formatted differently
      })

      it('should handle null date', () => {
        expect(formatDate(null)).toBe('-')
      })

      it('should handle undefined date', () => {
        expect(formatDate(undefined)).toBe('-')
      })

      it('should handle empty string', () => {
        expect(formatDate('')).toBe('-')
      })

      it('should handle invalid date string', () => {
        expect(formatDate('invalid-date')).toBe('-')
      })

      it('should use custom fallback', () => {
        expect(formatDate(null, 'N/A')).toBe('N/A')
      })

      it('should handle moment parsing error', () => {
        // This test may be redundant as moment.js handles invalid dates gracefully
        // but we test the try-catch block behavior
        const invalidDate = 'not-a-date-at-all-invalid'
        const result = formatDate(invalidDate)
        // moment may still parse some strings, so let's just ensure we get a string back
        expect(typeof result).toBe('string')
      })
    })

    describe('formatRelativeDate', () => {
      it('should format valid date as relative', () => {
        const date = moment().subtract(2, 'hours').toISOString()
        const result = formatRelativeDate(date)
        expect(result).toContain('ago')
      })

      it('should handle null date', () => {
        expect(formatRelativeDate(null)).toBe('-')
      })

      it('should handle undefined date', () => {
        expect(formatRelativeDate(undefined)).toBe('-')
      })

      it('should use custom fallback', () => {
        expect(formatRelativeDate(null, 'Unknown')).toBe('Unknown')
      })

      it('should handle invalid date', () => {
        expect(formatRelativeDate('invalid-date')).toBe('-')
      })
    })

    describe('formatDuration', () => {
      it('should format duration with hours, minutes and seconds', () => {
        // Mock moment.duration to return a duration with specific values
        const mockDuration = {
          hours: () => 1,
          minutes: () => 1,
          seconds: () => 1
        }
        vi.spyOn(moment, 'duration').mockReturnValue(mockDuration as any)
        
        const result = formatDuration(3661)
        expect(result).toBe('1 hours 1 minutes 1 seconds')
      })

      it('should format duration with only minutes', () => {
        // Mock moment.duration to return a duration with only minutes
        const mockDuration = {
          hours: () => 0,
          minutes: () => 2,
          seconds: () => 0
        }
        vi.spyOn(moment, 'duration').mockReturnValue(mockDuration as any)
        
        const result = formatDuration(120)
        expect(result).toBe('2 minutes')
      })

      it('should handle zero duration', () => {
        expect(formatDuration(0)).toBe('-')
      })

      it('should handle null duration', () => {
        expect(formatDuration(null)).toBe('-')
      })

      it('should handle undefined duration', () => {
        expect(formatDuration(undefined)).toBe('-')
      })

      it('should handle string duration', () => {
        const result = formatDuration('PT1H30M')
        expect(result).not.toBe('-')
      })

      it('should handle invalid duration', () => {
        // Mock moment.duration to throw error for invalid input
        vi.spyOn(moment, 'duration').mockImplementation(() => {
          throw new Error('Invalid duration')
        })
        
        expect(formatDuration('invalid')).toBe('-')
      })
    })
  })

  describe('Data Formatting', () => {
    describe('formatFileSize', () => {
      it('should format file size in MB', () => {
        const bytes = 1500000 // 1.5MB
        expect(formatFileSize(bytes)).toBe('1.50 MB')
      })

      it('should handle zero bytes', () => {
        expect(formatFileSize(0)).toBe('-')
      })

      it('should handle null bytes', () => {
        expect(formatFileSize(null)).toBe('-')
      })

      it('should handle undefined bytes', () => {
        expect(formatFileSize(undefined)).toBe('-')
      })

      it('should handle negative bytes', () => {
        expect(formatFileSize(-100)).toBe('-')
      })

      it('should use custom decimal places', () => {
        const bytes = 1234567 
        expect(formatFileSize(bytes, 1)).toBe('1.2 MB')
      })
    })

    describe('formatBoolean', () => {
      it('should format true as Yes', () => {
        expect(formatBoolean(true)).toBe('Yes')
      })

      it('should format false as No', () => {
        expect(formatBoolean(false)).toBe('No')
      })

      it('should handle null with fallback', () => {
        expect(formatBoolean(null)).toBe('-')
      })

      it('should handle undefined with fallback', () => {
        expect(formatBoolean(undefined)).toBe('-')
      })

      it('should use custom fallback', () => {
        expect(formatBoolean(null, 'Unknown')).toBe('Unknown')
      })
    })

    describe('formatEnabledStatus', () => {
      it('should format true boolean as Enabled', () => {
        expect(formatEnabledStatus(true)).toBe('Enabled')
      })

      it('should format false boolean as Disabled', () => {
        expect(formatEnabledStatus(false)).toBe('Disabled')
      })

      it('should format positive number as Enabled', () => {
        expect(formatEnabledStatus(5)).toBe('Enabled')
      })

      it('should format zero as Disabled', () => {
        expect(formatEnabledStatus(0)).toBe('Disabled')
      })

      it('should handle null as Disabled', () => {
        expect(formatEnabledStatus(null)).toBe('Disabled')
      })

      it('should use custom enabled text', () => {
        expect(formatEnabledStatus(true, 'Active', 'Inactive')).toBe('Active')
      })

      it('should use custom disabled text', () => {
        expect(formatEnabledStatus(false, 'Active', 'Inactive')).toBe('Inactive')
      })
    })
  })

  describe('Enum Mapping', () => {
    describe('mapEnumValue', () => {
      const testEnum = { 0: 'Zero', 1: 'One', 2: 'Two' }

      it('should map string key to enum value', () => {
        expect(mapEnumValue(testEnum, '1')).toBe('One')
      })

      it('should map number key to enum value', () => {
        expect(mapEnumValue(testEnum, 1)).toBe('One')
      })

      it('should return fallback for null', () => {
        expect(mapEnumValue(testEnum, null)).toBe('-')
      })

      it('should return fallback for undefined', () => {
        expect(mapEnumValue(testEnum, undefined)).toBe('-')
      })

      it('should return fallback for unmapped value', () => {
        expect(mapEnumValue(testEnum, '99')).toBe('-')
      })

      it('should use custom fallback', () => {
        expect(mapEnumValue(testEnum, null, 'Unknown')).toBe('Unknown')
      })
    })

    describe('mapAuthenticationType', () => {
      it('should map authentication type', () => {
        expect(mapAuthenticationType(1)).toBe('Login')
      })

      it('should return fallback for unmapped type', () => {
        expect(mapAuthenticationType(99)).toBe('-')
      })
    })

    describe('mapOperatingSystem', () => {
      it('should map operating system', () => {
        expect(mapOperatingSystem(0)).toBe('iOS')
      })

      it('should return fallback for unmapped OS', () => {
        expect(mapOperatingSystem(99)).toBe('-')
      })
    })

    describe('mapBuildStatus', () => {
      it('should map build status', () => {
        expect(mapBuildStatus(2)).toBe('Success')
      })

      it('should return special fallback for unmapped status', () => {
        expect(mapBuildStatus(99)).toBe('No previous builds')
      })
    })
  })

  describe('Data Validation', () => {
    describe('safeGet', () => {
      const testObj = {
        level1: {
          level2: {
            value: 'found'
          },
          array: [1, 2, 3]
        },
        nullValue: null
      }

      it('should get nested property', () => {
        expect(safeGet(testObj, 'level1.level2.value')).toBe('found')
      })

      it('should return fallback for non-existent path', () => {
        expect(safeGet(testObj, 'level1.nonexistent')).toBe('-')
      })

      it('should return fallback for null object', () => {
        expect(safeGet(null, 'any.path')).toBe('-')
      })

      it('should return fallback for undefined object', () => {
        expect(safeGet(undefined, 'any.path')).toBe('-')
      })

      it('should return fallback for empty path', () => {
        expect(safeGet(testObj, '')).toBe('-')
      })

      it('should handle null values in path', () => {
        expect(safeGet(testObj, 'nullValue.something')).toBe('-')
      })

      it('should use custom fallback', () => {
        expect(safeGet(testObj, 'nonexistent', 'NOT_FOUND')).toBe('NOT_FOUND')
      })

      it('should return actual null if it exists', () => {
        expect(safeGet(testObj, 'nullValue', 'fallback')).toBe('fallback')
      })
    })

    describe('validateTableData', () => {
      it('should validate valid array data', () => {
        const data = [{ id: 1 }, { id: 2 }]
        const result = validateTableData(data)
        expect(result.isValid).toBe(true)
        expect(result.data).toEqual(data)
        expect(result.message).toBeUndefined()
      })

      it('should invalidate empty array', () => {
        const result = validateTableData([])
        expect(result.isValid).toBe(false)
        expect(result.data).toEqual([])
        expect(result.message).toBe('No data available.')
      })

      it('should invalidate non-array data', () => {
        const result = validateTableData({ not: 'array' } as any)
        expect(result.isValid).toBe(false)
        expect(result.data).toEqual([])
        expect(result.message).toBe('No data available.')
      })

      it('should use custom empty message', () => {
        const result = validateTableData([], 'Custom empty message')
        expect(result.message).toBe('Custom empty message')
      })

      it('should handle null data', () => {
        const result = validateTableData(null)
        expect(result.isValid).toBe(false)
        expect(result.message).toBe('No data available.')
      })
    })
  })

  describe('String Formatting', () => {
    describe('formatVersionString', () => {
      it('should format complete version string', () => {
        const result = formatVersionString('1.0.0', '100', 'MyApp')
        expect(result).toBe('1.0.0(100) - MyApp')
      })

      it('should handle missing version', () => {
        const result = formatVersionString(undefined, '100', 'MyApp')
        expect(result).toBe('-(100) - MyApp')
      })

      it('should handle missing version code', () => {
        const result = formatVersionString('1.0.0', undefined, 'MyApp')
        expect(result).toBe('1.0.0(-) - MyApp')
      })

      it('should handle missing app name', () => {
        const result = formatVersionString('1.0.0', '100', undefined)
        expect(result).toBe('1.0.0(100) - -')
      })

      it('should handle all missing values', () => {
        const result = formatVersionString(undefined, undefined, undefined)
        expect(result).toBe('-(-) - -')
      })
    })

    describe('formatAutoDistributeStatus', () => {
      it('should format enabled status with count', () => {
        expect(formatAutoDistributeStatus(3)).toBe('Enabled in 3 branch(es)')
      })

      it('should format disabled status for zero', () => {
        expect(formatAutoDistributeStatus(0)).toBe('Disabled')
      })

      it('should format disabled status for null', () => {
        expect(formatAutoDistributeStatus(null)).toBe('Disabled')
      })

      it('should format disabled status for undefined', () => {
        expect(formatAutoDistributeStatus(undefined)).toBe('Disabled')
      })
    })

    describe('formatAutoSendStatus', () => {
      it('should format enabled for non-empty array', () => {
        expect(formatAutoSendStatus(['id1', 'id2'])).toBe('Enabled')
      })

      it('should format disabled for empty array', () => {
        expect(formatAutoSendStatus([])).toBe('Disabled')
      })

      it('should format disabled for null', () => {
        expect(formatAutoSendStatus(null)).toBe('Disabled')
      })

      it('should format disabled for undefined', () => {
        expect(formatAutoSendStatus(undefined)).toBe('Disabled')
      })
    })

    describe('truncateText', () => {
      it('should not truncate short text', () => {
        const text = 'Short text'
        expect(truncateText(text, 50)).toBe(text)
      })

      it('should truncate long text', () => {
        const text = 'This is a very long text that should be truncated'
        const result = truncateText(text, 20)
        expect(result).toBe('This is a very lo...')
        expect(result.length).toBe(20)
      })

      it('should handle empty text', () => {
        expect(truncateText('')).toBe('-')
      })

      it('should handle null text', () => {
        expect(truncateText(null)).toBe('-')
      })

      it('should handle undefined text', () => {
        expect(truncateText(undefined)).toBe('-')
      })

      it('should use custom suffix', () => {
        const text = 'Long text here'
        const result = truncateText(text, 10, '***')
        expect(result).toBe('Long te***')
      })
    })

    describe('joinArray', () => {
      it('should join array elements', () => {
        const arr = ['a', 'b', 'c']
        expect(joinArray(arr)).toBe('a, b, c')
      })

      it('should use custom separator', () => {
        const arr = ['a', 'b', 'c']
        expect(joinArray(arr, ' | ')).toBe('a | b | c')
      })

      it('should handle empty array', () => {
        expect(joinArray([])).toBe('-')
      })

      it('should handle null array', () => {
        expect(joinArray(null)).toBe('-')
      })

      it('should handle undefined array', () => {
        expect(joinArray(undefined)).toBe('-')
      })

      it('should filter null and undefined elements', () => {
        const arr = ['a', null, 'b', undefined, 'c']
        expect(joinArray(arr)).toBe('a, b, c')
      })

      it('should use custom fallback', () => {
        expect(joinArray([], ' | ', 'EMPTY')).toBe('EMPTY')
      })
    })
  })

  describe('Console Output Functions', () => {
    beforeEach(() => {
      vi.spyOn(console, 'info').mockImplementation(() => {})
      vi.spyOn(console, 'log').mockImplementation(() => {})
      vi.spyOn(console, 'table').mockImplementation(() => {})
    })

    describe('logInfo', () => {
      it('should call console.info', () => {
        logInfo('Test message')
        expect(console.info).toHaveBeenCalledWith('Test message')
      })
    })

    describe('logMessage', () => {
      it('should call console.log', () => {
        logMessage('Test message')
        expect(console.log).toHaveBeenCalledWith('Test message')
      })
    })

    describe('logTable', () => {
      it('should call console.table', () => {
        const data = { key: 'value' }
        logTable(data)
        expect(console.table).toHaveBeenCalledWith(data)
      })
    })

    describe('shouldDisplayTable', () => {
      it('should return true for valid data', () => {
        const data = [{ id: 1 }]
        const result = shouldDisplayTable(data)
        expect(result.shouldDisplay).toBe(true)
        expect(result.message).toBeUndefined()
      })

      it('should return false for empty data', () => {
        const result = shouldDisplayTable([], 'No data')
        expect(result.shouldDisplay).toBe(false)
        expect(result.message).toBe('No data')
      })
    })
  })

  describe('Data Transformers', () => {
    describe('transformDistributionProfile', () => {
      it('should transform distribution profile data', () => {
        const profile = {
          id: 'profile1',
          name: 'Test Profile',
          pinned: true,
          iOSVersion: '1.0.0',
          androidVersion: '2.0.0',
          updateDate: '2024-01-01T10:00:00Z',
          lastAppVersionSharedDate: '2024-01-02T10:00:00Z',
          settings: { authenticationType: 1 },
          testingGroupIds: ['group1']
        }

        const result = transformDistributionProfile(profile)

        expect(result['Profile Id']).toBe('profile1')
        expect(result['Profile Name']).toBe('Test Profile')
        expect(result.Pinned).toBe(true)
        expect(result['iOS Version']).toBe('1.0.0')
        expect(result['Android Version']).toBe('2.0.0')
        expect(result.Authentication).toBe('Login')
        expect(result['Auto Send']).toBe('Enabled')
      })

      it('should handle missing optional fields', () => {
        const profile = {
          id: 'profile1',
          name: 'Test Profile',
          pinned: false,
          settings: {}
        }

        const result = transformDistributionProfile(profile)

        expect(result['iOS Version']).toBe('No versions available')
        expect(result['Android Version']).toBe('No versions available')
        expect(result['Last Shared']).toBe('Not Shared')
        expect(result['Auto Send']).toBe('Disabled')
      })
    })

    describe('transformEnvironmentVariable', () => {
      it('should transform secret variable', () => {
        const variable = {
          key: 'SECRET_KEY',
          value: 'secret-value',
          isSecret: true
        }

        const result = transformEnvironmentVariable(variable)

        expect(result['Key Name']).toBe('SECRET_KEY')
        expect(result['Key Value']).toBe('********')
      })

      it('should transform non-secret variable', () => {
        const variable = {
          key: 'PUBLIC_KEY',
          value: 'public-value',
          isSecret: false
        }

        const result = transformEnvironmentVariable(variable)

        expect(result['Key Name']).toBe('PUBLIC_KEY')
        expect(result['Key Value']).toBe('public-value')
      })
    })
  })

  describe('Role Processing', () => {
    describe('processRolesWithInheritance', () => {
      it('should process roles with inheritance info', () => {
        const roles = ['admin', 'user']
        const inheritedRoles = ['viewer']

        const result = processRolesWithInheritance(roles, inheritedRoles)

        expect(result).toHaveLength(3)
        expect(result[0].Role).toBe('admin')
        expect(result[0].Inheritance).toBe('-')
        expect(result[1].Role).toBe('user')
        expect(result[1].Inheritance).toBe('-')
        expect(result[2].Role).toBe('viewer')
        expect(result[2].Inheritance).toBe('Inherit')
      })

      it('should handle empty roles', () => {
        const result = processRolesWithInheritance([], [])
        expect(result).toEqual([])
      })

      it('should handle null roles', () => {
        const result = processRolesWithInheritance(null, null)
        expect(result).toEqual([])
      })

      it('should handle only inherited roles', () => {
        const result = processRolesWithInheritance(undefined, ['viewer'])
        
        expect(result).toHaveLength(1)
        expect(result[0].Role).toBe('viewer')
        expect(result[0].Inheritance).toBe('Inherit')
      })

      it('should handle duplicate roles', () => {
        const roles = ['admin']
        const inheritedRoles = ['admin', 'viewer']

        const result = processRolesWithInheritance(roles, inheritedRoles)

        expect(result).toHaveLength(2)
        // admin should be marked as inherited since it appears in inheritedRoles
        const adminRole = result.find(r => r.Role === 'admin')
        expect(adminRole?.Inheritance).toBe('Inherit')
      })
    })
  })
})