import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// Mock axios
const mockAxiosInstance = {
  get: vi.fn(),
  post: vi.fn(),
  put: vi.fn(),
  delete: vi.fn()
}

const mockAxiosInterceptorUse = vi.fn()
vi.mock('axios', () => ({
  default: {
    create: vi.fn(() => mockAxiosInstance),
    interceptors: {
      request: {
        use: mockAxiosInterceptorUse
      }
    }
  }
}))

// Mock chalk
const mockChalkGreen = vi.fn((text) => text)
vi.mock('chalk', () => ({
  default: {
    green: mockChalkGreen
  }
}))

// Mock CurlHelper
const mockGenerateCommand = vi.fn(() => 'curl -X GET https://example.com/test')
vi.mock('../../../src/utils/curlhelper.js', () => ({
  default: vi.fn().mockImplementation(() => ({
    generateCommand: mockGenerateCommand
  }))
}))

// Mock config module
const mockReadConfig = vi.fn((envVar: string) => {
  switch (envVar) {
    case 'API_HOSTNAME':
      return 'https://api.test.com'
    case 'AUTH_HOSTNAME':
      return 'https://auth.test.com'
    case 'AC_ACCESS_TOKEN':
      return 'test-access-token'
    default:
      return ''
  }
})

vi.mock('../../../src/config.js', () => ({
  readEnviromentConfigVariable: mockReadConfig,
  EnvironmentVariables: {
    API_HOSTNAME: 'API_HOSTNAME',
    AUTH_HOSTNAME: 'AUTH_HOSTNAME',
    AC_ACCESS_TOKEN: 'AC_ACCESS_TOKEN'
  },
  getConsoleOutputType: vi.fn(() => 'plain')
}))

describe('API Client', () => {
  const originalEnv = process.env

  beforeEach(() => {
    vi.clearAllMocks()
    process.env = { ...originalEnv }
    delete process.env.CURL_LOGGING
  })

  afterEach(() => {
    process.env = originalEnv
  })

  describe('getHeaders function', () => {
    it('should return headers with token by default', async () => {
      const { getHeaders } = await import('../../../src/services/api.js')
      
      const headers = getHeaders()

      expect(headers).toEqual({
        accept: 'application/json',
        'User-Agent': 'Appcircle CLI/1.0.3',
        Authorization: 'Bearer test-access-token'
      })
    })

    it('should return headers with token when withToken is true', async () => {
      const { getHeaders } = await import('../../../src/services/api.js')
      
      const headers = getHeaders(true)

      expect(headers).toEqual({
        accept: 'application/json',
        'User-Agent': 'Appcircle CLI/1.0.3',
        Authorization: 'Bearer test-access-token'
      })
    })

    it('should return headers without token when withToken is false', async () => {
      const { getHeaders } = await import('../../../src/services/api.js')
      
      const headers = getHeaders(false)

      expect(headers).toEqual({
        accept: 'application/json',
        'User-Agent': 'Appcircle CLI/1.0.3'
      })
    })

    it('should read access token from environment configuration', async () => {
      const { getHeaders } = await import('../../../src/services/api.js')
      
      getHeaders(true)

      expect(mockReadConfig).toHaveBeenCalledWith('AC_ACCESS_TOKEN')
    })
  })

  describe('Constants', () => {
    it('should export API_HOSTNAME constant', async () => {
      const { API_HOSTNAME } = await import('../../../src/services/api.js')
      
      expect(API_HOSTNAME).toBe('https://api.test.com')
      expect(typeof API_HOSTNAME).toBe('string')
    })

    it('should export AUTH_HOSTNAME constant', async () => {
      const { AUTH_HOSTNAME } = await import('../../../src/services/api.js')
      
      expect(AUTH_HOSTNAME).toBe('https://auth.test.com')
      expect(typeof AUTH_HOSTNAME).toBe('string')
    })

    it('should export appcircleApi instance', async () => {
      const { appcircleApi } = await import('../../../src/services/api.js')
      
      expect(appcircleApi).toBeDefined()
      expect(typeof appcircleApi).toBe('object')
    })
  })

  describe('Type safety', () => {
    it('should return proper header types', async () => {
      const { getHeaders } = await import('../../../src/services/api.js')
      
      const headers = getHeaders()
      
      expect(typeof headers?.accept).toBe('string')
      expect(typeof headers?.['User-Agent']).toBe('string')
      expect(typeof headers?.Authorization).toBe('string')
    })

    it('should handle optional Authorization header', async () => {
      const { getHeaders } = await import('../../../src/services/api.js')
      
      const headersWithoutToken = getHeaders(false)
      const headersWithToken = getHeaders(true)
      
      expect(headersWithoutToken?.Authorization).toBeUndefined()
      expect(headersWithToken?.Authorization).toBeDefined()
    })
  })

  describe('Error handling scenarios', () => {
    it('should handle empty access token', async () => {
      // Mock empty token
      ;(mockReadConfig as any).mockImplementation((envVar: string) => {
        if (envVar === 'AC_ACCESS_TOKEN') return ''
        if (envVar === 'API_HOSTNAME') return 'https://api.test.com'
        if (envVar === 'AUTH_HOSTNAME') return 'https://auth.test.com'
        return ''
      })

      const { getHeaders } = await import('../../../src/services/api.js')
      
      const headers = getHeaders(true)

      expect(headers?.Authorization).toBe('Bearer ')
    })
  })

  describe('CURL_LOGGING interceptor', () => {
    it('should register interceptor when CURL_LOGGING environment variable is set', async () => {
      // Reset modules to test interceptor registration
      vi.resetModules()
      process.env.CURL_LOGGING = '1'
      
      await import('../../../src/services/api.js')
      
      expect(mockAxiosInterceptorUse).toHaveBeenCalledTimes(1)
      expect(mockAxiosInterceptorUse).toHaveBeenCalledWith(expect.any(Function))
    })

    it('should not register interceptor when CURL_LOGGING is not set', async () => {
      // Reset modules to test without CURL_LOGGING
      vi.resetModules()
      delete process.env.CURL_LOGGING
      
      await import('../../../src/services/api.js')
      
      expect(mockAxiosInterceptorUse).not.toHaveBeenCalled()
    })

    it('should log curl command in plain mode but not in json mode', async () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {})
      
      vi.resetModules()
      process.env.CURL_LOGGING = '1'
      
      // Mock getConsoleOutputType for different modes
      ;(mockReadConfig as any).mockImplementation((envVar: string) => {
        switch (envVar) {
          case 'API_HOSTNAME':
            return 'https://api.test.com'
          case 'AUTH_HOSTNAME':
            return 'https://auth.test.com'
          case 'AC_ACCESS_TOKEN':
            return 'test-access-token'
          default:
            return ''
        }
      })

      const mockGetConsoleOutputType = vi.fn()
      vi.doMock('../../../src/config.js', () => ({
        readEnviromentConfigVariable: mockReadConfig,
        EnvironmentVariables: {
          API_HOSTNAME: 'API_HOSTNAME',
          AUTH_HOSTNAME: 'AUTH_HOSTNAME',
          AC_ACCESS_TOKEN: 'AC_ACCESS_TOKEN'
        },
        getConsoleOutputType: mockGetConsoleOutputType
      }))
      
      await import('../../../src/services/api.js')
      
      // Get the interceptor function
      const interceptorFunction = mockAxiosInterceptorUse.mock.calls[0][0]
      const mockConfig = {
        method: 'GET',
        url: '/test',
        headers: {},
        data: {}
      }
      
      // Test plain mode - should log
      mockGetConsoleOutputType.mockReturnValue('plain')
      const result1 = interceptorFunction(mockConfig)
      
      expect(mockChalkGreen).toHaveBeenCalledWith('curl -X GET https://example.com/test')
      expect(consoleSpy).toHaveBeenCalledWith('curl -X GET https://example.com/test')
      expect(result1).toBe(mockConfig) // Should return config unchanged
      
      // Clear mocks
      consoleSpy.mockClear()
      mockChalkGreen.mockClear()
      
      // Test json mode - should not log
      mockGetConsoleOutputType.mockReturnValue('json')
      const result2 = interceptorFunction(mockConfig)
      
      expect(consoleSpy).not.toHaveBeenCalled()
      expect(result2).toBe(mockConfig) // Should return config unchanged
      
      consoleSpy.mockRestore()
    })
  })

  describe('appcircleApi baseURL normalization', () => {
    it('should add trailing slash to API_HOSTNAME without slash', async () => {
      vi.resetModules()
      
      // Mock API_HOSTNAME without trailing slash
      ;(mockReadConfig as any).mockImplementation((envVar: string) => {
        if (envVar === 'API_HOSTNAME') return 'https://api.test.com'
        if (envVar === 'AUTH_HOSTNAME') return 'https://auth.test.com'
        if (envVar === 'AC_ACCESS_TOKEN') return 'test-access-token'
        return ''
      })
      
      const { default: axios } = await import('axios')
      await import('../../../src/services/api.js')
      
      expect(axios.create).toHaveBeenCalledWith({
        baseURL: 'https://api.test.com/'
      })
    })

    it('should not add double slash when API_HOSTNAME already ends with slash', async () => {
      vi.resetModules()
      
      // Mock API_HOSTNAME with trailing slash  
      ;(mockReadConfig as any).mockImplementation((envVar: string) => {
        if (envVar === 'API_HOSTNAME') return 'https://api.test.com/'
        if (envVar === 'AUTH_HOSTNAME') return 'https://auth.test.com'
        if (envVar === 'AC_ACCESS_TOKEN') return 'test-access-token'
        return ''
      })
      
      const { default: axios } = await import('axios')
      await import('../../../src/services/api.js')
      
      expect(axios.create).toHaveBeenCalledWith({
        baseURL: 'https://api.test.com/'
      })
    })
  })

  describe('getHeaders default parameter behavior', () => {
    it('should include Authorization when called without parameters (default withToken=true)', async () => {
      const { getHeaders } = await import('../../../src/services/api.js')
      
      const headersDefault = getHeaders()
      const headersExplicitTrue = getHeaders(true)
      
      expect(headersDefault).toEqual(headersExplicitTrue)
      expect(headersDefault?.Authorization).toBe('Bearer test-access-token')
    })
  })

  describe('undefined access token behavior', () => {
    it('should handle undefined access token gracefully', async () => {
      vi.resetModules()
      
      // Mock undefined access token
      ;(mockReadConfig as any).mockImplementation((envVar: string) => {
        if (envVar === 'API_HOSTNAME') return 'https://api.test.com'
        if (envVar === 'AUTH_HOSTNAME') return 'https://auth.test.com'
        if (envVar === 'AC_ACCESS_TOKEN') return undefined as any
        return ''
      })
      
      const { getHeaders } = await import('../../../src/services/api.js')
      const headers = getHeaders(true)
      
      // Current implementation creates "Bearer undefined" - this test documents the behavior
      expect(headers?.Authorization).toBe('Bearer undefined')
    })
  })
})