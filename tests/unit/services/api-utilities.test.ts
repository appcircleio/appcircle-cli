/**
 * @fileoverview Unit tests for api-utilities.ts
 * Tests extracted utility functions from api.ts for better coverage and testability
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { InternalAxiosRequestConfig } from 'axios';
import { EnvironmentVariables } from '../../../src/config';

// Mock dependencies
vi.mock('chalk', () => ({
  default: {
    green: vi.fn((text) => `green:${text}`)
  }
}));

vi.mock('../../../src/utils/curlhelper', () => ({
  default: vi.fn().mockImplementation((config) => ({
    generateCommand: vi.fn(() => `curl -X ${config.method || 'GET'} ${config.url || 'test'}`)
  }))
}));

vi.mock('../../../src/config', () => ({
  readEnviromentConfigVariable: vi.fn(),
  EnvironmentVariables: {
    API_HOSTNAME: 'API_HOSTNAME',
    AUTH_HOSTNAME: 'AUTH_HOSTNAME',
    AC_ACCESS_TOKEN: 'AC_ACCESS_TOKEN'
  },
  getConsoleOutputType: vi.fn(() => 'plain')
}));

// Import utilities after mocking dependencies
import {
  normalizeHostname,
  generateHttpHeaders,
  generateCurlCommand,
  logCurlCommand,
  createCurlLoggingInterceptor,
  setupAxiosInterceptors,
  validateEnvironmentVariable,
  getEnvironmentConfiguration,
  createAxiosConfig,
  shouldEnableCurlLogging
} from '../../../src/services/api-utilities';

describe('API Utilities', () => {
  let mockConsoleLog: any;
  const originalEnv = process.env;

  beforeEach(() => {
    vi.clearAllMocks();
    mockConsoleLog = vi.spyOn(console, 'log').mockImplementation(() => {});
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    mockConsoleLog.mockRestore();
    process.env = originalEnv;
  });

  describe('normalizeHostname', () => {
    it('should add trailing slash to hostname without slash', () => {
      const result = normalizeHostname('https://api.example.com');
      expect(result).toBe('https://api.example.com/');
    });

    it('should not modify hostname that already has trailing slash', () => {
      const result = normalizeHostname('https://api.example.com/');
      expect(result).toBe('https://api.example.com/');
    });

    it('should handle empty hostname', () => {
      const result = normalizeHostname('');
      expect(result).toBe('/');
    });

    it('should handle null hostname', () => {
      const result = normalizeHostname(null as any);
      expect(result).toBe('/');
    });

    it('should handle undefined hostname', () => {
      const result = normalizeHostname(undefined as any);
      expect(result).toBe('/');
    });

    it('should handle hostname with path', () => {
      const result = normalizeHostname('https://api.example.com/api/v1');
      expect(result).toBe('https://api.example.com/api/v1/');
    });

    it('should handle hostname with query parameters', () => {
      const result = normalizeHostname('https://api.example.com?param=value');
      expect(result).toBe('https://api.example.com?param=value/');
    });
  });

  describe('generateHttpHeaders', () => {
    beforeEach(async () => {
      const config = await import('../../../src/config');
      vi.mocked(config.readEnviromentConfigVariable).mockImplementation((envVar: string) => {
        if (envVar === 'AC_ACCESS_TOKEN') return 'test-token-123';
        return 'mock-value';
      });
    });

    it('should generate headers with token by default', () => {
      const headers = generateHttpHeaders();
      
      expect(headers).toEqual({
        accept: 'application/json',
        'User-Agent': 'Appcircle CLI/1.0.3',
        Authorization: 'Bearer test-token-123'
      });
    });

    it('should generate headers with token when withToken is true', () => {
      const headers = generateHttpHeaders(true);
      
      expect(headers).toEqual({
        accept: 'application/json',
        'User-Agent': 'Appcircle CLI/1.0.3',
        Authorization: 'Bearer test-token-123'
      });
    });

    it('should generate headers without token when withToken is false', () => {
      const headers = generateHttpHeaders(false);
      
      expect(headers).toEqual({
        accept: 'application/json',
        'User-Agent': 'Appcircle CLI/1.0.3'
      });
      expect(headers.Authorization).toBeUndefined();
    });

    it('should use custom user agent', () => {
      const customUserAgent = 'Custom Agent/2.0.0';
      const headers = generateHttpHeaders(false, customUserAgent);
      
      expect(headers['User-Agent']).toBe(customUserAgent);
    });

    it('should handle empty token', async () => {
      const config = await import('../../../src/config');
      vi.mocked(config.readEnviromentConfigVariable).mockReturnValue('');
      
      const headers = generateHttpHeaders(true);
      
      expect(headers.Authorization).toBe('Bearer ');
    });

    it('should handle undefined token', async () => {
      const config = await import('../../../src/config');
      vi.mocked(config.readEnviromentConfigVariable).mockReturnValue(undefined);
      
      const headers = generateHttpHeaders(true);
      
      expect(headers.Authorization).toBe('Bearer undefined');
    });
  });

  describe('generateCurlCommand', () => {
    it('should generate curl command from axios config', () => {
      const config: InternalAxiosRequestConfig = {
        method: 'POST',
        url: '/api/test',
        headers: { 'Content-Type': 'application/json' },
        data: { key: 'value' }
      } as any;

      const result = generateCurlCommand(config);

      expect(result).toBe('curl -X POST /api/test');
    });

    it('should handle config without method', () => {
      const config: InternalAxiosRequestConfig = {
        url: '/api/test'
      } as any;

      const result = generateCurlCommand(config);

      expect(result).toBe('curl -X GET /api/test');
    });

    it('should handle config without url', () => {
      const config: InternalAxiosRequestConfig = {
        method: 'GET'
      } as any;

      const result = generateCurlCommand(config);

      expect(result).toBe('curl -X GET test');
    });

    it('should handle CurlHelper throwing error', async () => {
      const curlHelperModule = await import('../../../src/utils/curlhelper');
      vi.mocked(curlHelperModule.default).mockImplementation(() => {
        throw new Error('CurlHelper error');
      });

      const config: InternalAxiosRequestConfig = {
        method: 'GET',
        url: '/api/test'
      } as any;

      const result = generateCurlCommand(config);

      expect(result).toBe('curl -X GET /api/test');
    });

    it('should handle empty config and use fallback when CurlHelper fails', () => {
      const config = {} as InternalAxiosRequestConfig;

      // This test actually hits the catch block because the mock CurlHelper probably 
      // fails with empty config, so we expect the fallback logic to be used
      const result = generateCurlCommand(config);

      expect(result).toBe('curl -X GET unknown');
    });
  });

  describe('logCurlCommand', () => {
    it('should log curl command in plain mode', async () => {
      const config = await import('../../../src/config');
      vi.mocked(config.getConsoleOutputType).mockReturnValue('plain');

      const curlCommand = 'curl -X GET https://api.example.com';
      logCurlCommand(curlCommand);

      expect(mockConsoleLog).toHaveBeenCalledWith('green:curl -X GET https://api.example.com');
    });

    it('should not log curl command in json mode', async () => {
      const config = await import('../../../src/config');
      vi.mocked(config.getConsoleOutputType).mockReturnValue('json');

      const curlCommand = 'curl -X GET https://api.example.com';
      logCurlCommand(curlCommand);

      expect(mockConsoleLog).not.toHaveBeenCalled();
    });

    it('should handle empty curl command', async () => {
      const config = await import('../../../src/config');
      vi.mocked(config.getConsoleOutputType).mockReturnValue('plain');

      logCurlCommand('');

      expect(mockConsoleLog).toHaveBeenCalledWith('green:');
    });
  });

  describe('createCurlLoggingInterceptor', () => {
    it('should create interceptor that logs curl and returns config', async () => {
      const config = await import('../../../src/config');
      vi.mocked(config.getConsoleOutputType).mockReturnValue('plain');

      const interceptor = createCurlLoggingInterceptor();
      const mockConfig: InternalAxiosRequestConfig = {
        method: 'GET',
        url: '/test'
      } as any;

      const result = interceptor(mockConfig);

      expect(result).toBe(mockConfig);
      expect(mockConsoleLog).toHaveBeenCalled();
    });

    it('should work with json output mode', async () => {
      const config = await import('../../../src/config');
      vi.mocked(config.getConsoleOutputType).mockReturnValue('json');

      const interceptor = createCurlLoggingInterceptor();
      const mockConfig: InternalAxiosRequestConfig = {
        method: 'POST',
        url: '/api/data'
      } as any;

      const result = interceptor(mockConfig);

      expect(result).toBe(mockConfig);
      expect(mockConsoleLog).not.toHaveBeenCalled();
    });
  });

  describe('setupAxiosInterceptors', () => {
    it('should setup interceptor when curl logging is enabled', () => {
      const mockAxiosInstance = {
        interceptors: {
          request: {
            use: vi.fn()
          }
        }
      };

      setupAxiosInterceptors(mockAxiosInstance, true);

      expect(mockAxiosInstance.interceptors.request.use).toHaveBeenCalledWith(
        expect.any(Function)
      );
    });

    it('should not setup interceptor when curl logging is disabled', () => {
      const mockAxiosInstance = {
        interceptors: {
          request: {
            use: vi.fn()
          }
        }
      };

      setupAxiosInterceptors(mockAxiosInstance, false);

      expect(mockAxiosInstance.interceptors.request.use).not.toHaveBeenCalled();
    });

    it('should not setup interceptor by default', () => {
      const mockAxiosInstance = {
        interceptors: {
          request: {
            use: vi.fn()
          }
        }
      };

      setupAxiosInterceptors(mockAxiosInstance);

      expect(mockAxiosInstance.interceptors.request.use).not.toHaveBeenCalled();
    });
  });

  describe('validateEnvironmentVariable', () => {
    beforeEach(async () => {
      const config = await import('../../../src/config');
      vi.mocked(config.readEnviromentConfigVariable).mockImplementation((envVar: string) => {
        switch (envVar) {
          case 'API_HOSTNAME': return 'https://api.example.com';
          case 'AUTH_HOSTNAME': return 'https://auth.example.com';
          case 'AC_ACCESS_TOKEN': return 'valid-token-123';
          default: return '';
        }
      });
    });

    it('should validate valid API hostname', () => {
      const result = validateEnvironmentVariable(EnvironmentVariables.API_HOSTNAME);
      
      expect(result.isValid).toBe(true);
      expect(result.value).toBe('https://api.example.com');
      expect(result.error).toBeUndefined();
    });

    it('should validate valid AUTH hostname', () => {
      const result = validateEnvironmentVariable(EnvironmentVariables.AUTH_HOSTNAME);
      
      expect(result.isValid).toBe(true);
      expect(result.value).toBe('https://auth.example.com');
      expect(result.error).toBeUndefined();
    });

    it('should validate valid access token', () => {
      const result = validateEnvironmentVariable(EnvironmentVariables.AC_ACCESS_TOKEN);
      
      expect(result.isValid).toBe(true);
      expect(result.value).toBe('valid-token-123');
      expect(result.error).toBeUndefined();
    });

    it('should invalidate empty environment variable', async () => {
      const config = await import('../../../src/config');
      vi.mocked(config.readEnviromentConfigVariable).mockReturnValue('');

      const result = validateEnvironmentVariable(EnvironmentVariables.AC_ACCESS_TOKEN);
      
      expect(result.isValid).toBe(false);
      expect(result.value).toBe('');
      expect(result.error).toBe('Environment variable AC_ACCESS_TOKEN is not set or empty');
    });

    it('should invalidate undefined environment variable', async () => {
      const config = await import('../../../src/config');
      vi.mocked(config.readEnviromentConfigVariable).mockReturnValue(undefined);

      const result = validateEnvironmentVariable(EnvironmentVariables.AC_ACCESS_TOKEN);
      
      expect(result.isValid).toBe(false);
      expect(result.value).toBe('');
      expect(result.error).toBe('Environment variable AC_ACCESS_TOKEN is not set or empty');
    });

    it('should invalidate invalid hostname URL', async () => {
      const config = await import('../../../src/config');
      vi.mocked(config.readEnviromentConfigVariable).mockReturnValue('not-a-valid-url');

      const result = validateEnvironmentVariable(EnvironmentVariables.API_HOSTNAME);
      
      expect(result.isValid).toBe(false);
      expect(result.value).toBe('not-a-valid-url');
      expect(result.error).toBe('Invalid URL format for API_HOSTNAME: not-a-valid-url');
    });

    it('should handle whitespace-only values', async () => {
      const config = await import('../../../src/config');
      vi.mocked(config.readEnviromentConfigVariable).mockReturnValue('   ');

      const result = validateEnvironmentVariable(EnvironmentVariables.AC_ACCESS_TOKEN);
      
      expect(result.isValid).toBe(false);
      expect(result.value).toBe('   ');
      expect(result.error).toBe('Environment variable AC_ACCESS_TOKEN is not set or empty');
    });
  });

  describe('getEnvironmentConfiguration', () => {
    it('should return all environment variables configuration', async () => {
      const config = await import('../../../src/config');
      vi.mocked(config.readEnviromentConfigVariable).mockImplementation((envVar: string) => {
        switch (envVar) {
          case 'API_HOSTNAME': return 'https://api.example.com';
          case 'AUTH_HOSTNAME': return 'https://auth.example.com';
          case 'AC_ACCESS_TOKEN': return 'token-123';
          default: return '';
        }
      });

      const result = getEnvironmentConfiguration();

      expect(result.apiHostname.isValid).toBe(true);
      expect(result.apiHostname.value).toBe('https://api.example.com');
      expect(result.authHostname.isValid).toBe(true);
      expect(result.authHostname.value).toBe('https://auth.example.com');
      expect(result.accessToken.isValid).toBe(true);
      expect(result.accessToken.value).toBe('token-123');
    });

    it('should return validation errors for invalid configuration', async () => {
      const config = await import('../../../src/config');
      vi.mocked(config.readEnviromentConfigVariable).mockImplementation((envVar: string) => {
        switch (envVar) {
          case 'API_HOSTNAME': return 'invalid-url';
          case 'AUTH_HOSTNAME': return '';
          case 'AC_ACCESS_TOKEN': return 'valid-token';
          default: return '';
        }
      });

      const result = getEnvironmentConfiguration();

      expect(result.apiHostname.isValid).toBe(false);
      expect(result.apiHostname.error).toContain('Invalid URL format');
      expect(result.authHostname.isValid).toBe(false);
      expect(result.authHostname.error).toContain('is not set or empty');
      expect(result.accessToken.isValid).toBe(true);
    });
  });

  describe('createAxiosConfig', () => {
    it('should create axios config with normalized baseURL', () => {
      const config = createAxiosConfig('https://api.example.com');
      
      expect(config.baseURL).toBe('https://api.example.com/');
    });

    it('should create axios config with timeout', () => {
      const config = createAxiosConfig('https://api.example.com', 5000);
      
      expect(config.baseURL).toBe('https://api.example.com/');
      expect(config.timeout).toBe(5000);
    });

    it('should not set timeout when not provided', () => {
      const config = createAxiosConfig('https://api.example.com');
      
      expect(config.timeout).toBeUndefined();
    });

    it('should not set timeout when timeout is 0', () => {
      const config = createAxiosConfig('https://api.example.com', 0);
      
      expect(config.timeout).toBeUndefined();
    });

    it('should not set timeout when timeout is negative', () => {
      const config = createAxiosConfig('https://api.example.com', -1000);
      
      expect(config.timeout).toBeUndefined();
    });

    it('should handle empty baseURL', () => {
      const config = createAxiosConfig('');
      
      expect(config.baseURL).toBe('/');
    });
  });

  describe('shouldEnableCurlLogging', () => {
    it('should return true when CURL_LOGGING is set to truthy value', () => {
      process.env.CURL_LOGGING = '1';
      
      const result = shouldEnableCurlLogging();
      
      expect(result).toBe(true);
    });

    it('should return true when CURL_LOGGING is set to "true"', () => {
      process.env.CURL_LOGGING = 'true';
      
      const result = shouldEnableCurlLogging();
      
      expect(result).toBe(true);
    });

    it('should return false when CURL_LOGGING is not set', () => {
      delete process.env.CURL_LOGGING;
      
      const result = shouldEnableCurlLogging();
      
      expect(result).toBe(false);
    });

    it('should return false when CURL_LOGGING is empty string', () => {
      process.env.CURL_LOGGING = '';
      
      const result = shouldEnableCurlLogging();
      
      expect(result).toBe(false);
    });

    it('should return true when CURL_LOGGING is "false" (Boolean treats non-empty string as truthy)', () => {
      process.env.CURL_LOGGING = 'false';
      
      const result = shouldEnableCurlLogging();
      
      expect(result).toBe(true);
    });

    it('should return true when CURL_LOGGING is "0" (Boolean treats non-empty string as truthy)', () => {
      process.env.CURL_LOGGING = '0';
      
      const result = shouldEnableCurlLogging();
      
      expect(result).toBe(true);
    });
  });

  describe('Integration Tests', () => {
    it('should work together for complete API setup', async () => {
      const config = await import('../../../src/config');
      vi.mocked(config.readEnviromentConfigVariable).mockImplementation((envVar: string) => {
        switch (envVar) {
          case 'API_HOSTNAME': return 'https://api.example.com';
          case 'AC_ACCESS_TOKEN': return 'integration-token';
          default: return '';
        }
      });
      vi.mocked(config.getConsoleOutputType).mockReturnValue('plain');

      // Test complete workflow
      const hostname = 'https://api.example.com';
      const normalizedHostname = normalizeHostname(hostname);
      const axiosConfig = createAxiosConfig(normalizedHostname, 3000);
      const headers = generateHttpHeaders(true, 'Integration Test/1.0.0');
      
      expect(axiosConfig.baseURL).toBe('https://api.example.com/');
      expect(axiosConfig.timeout).toBe(3000);
      expect(headers['User-Agent']).toBe('Integration Test/1.0.0');
      expect(headers.Authorization).toBe('Bearer integration-token');
    });

    it('should handle interceptor integration', () => {
      const mockAxiosInstance = {
        interceptors: {
          request: { use: vi.fn() }
        }
      };

      process.env.CURL_LOGGING = '1';
      const shouldEnable = shouldEnableCurlLogging();
      
      expect(shouldEnable).toBe(true);
      
      setupAxiosInterceptors(mockAxiosInstance, shouldEnable);
      
      expect(mockAxiosInstance.interceptors.request.use).toHaveBeenCalled();
    });

    it('should validate complete environment setup', async () => {
      const config = await import('../../../src/config');
      vi.mocked(config.readEnviromentConfigVariable).mockImplementation((envVar: string) => {
        switch (envVar) {
          case 'API_HOSTNAME': return 'https://api.prod.com';
          case 'AUTH_HOSTNAME': return 'https://auth.prod.com';
          case 'AC_ACCESS_TOKEN': return 'prod-token-xyz';
          default: return '';
        }
      });

      const envConfig = getEnvironmentConfiguration();
      
      expect(envConfig.apiHostname.isValid).toBe(true);
      expect(envConfig.authHostname.isValid).toBe(true);
      expect(envConfig.accessToken.isValid).toBe(true);
      
      // Should be able to use validated values
      const axiosConfig = createAxiosConfig(envConfig.apiHostname.value);
      expect(axiosConfig.baseURL).toBe('https://api.prod.com/');
    });
  });
});