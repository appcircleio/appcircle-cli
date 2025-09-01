/**
 * @fileoverview Unit tests for config.ts
 * Tests configuration management, output types, and environment variable handling
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// Create a test-specific mock store
let testMockStore: any;

function resetMockStore() {
  testMockStore = {
    current: 'default',
    envs: {
      default: {
        API_HOSTNAME: 'https://api.appcircle.io',
        AUTH_HOSTNAME: 'https://auth.appcircle.io',
        AC_ACCESS_TOKEN: ''
      }
    }
  };
}

// Mock the conf module
vi.mock('conf', () => {
  return {
    default: vi.fn().mockImplementation(() => ({
      get store() { return testMockStore; },
      path: '/mock/config/path.json',
      get: vi.fn((key: string) => {
        if (key === 'current') return testMockStore.current;
        const keys = key.split('.');
        let value = testMockStore as any;
        for (const k of keys) {
          value = value?.[k];
        }
        return value || '';
      }),
      set: vi.fn((key: string, val: any) => {
        if (key === 'current') {
          testMockStore.current = val;
        } else {
          const keys = key.split('.');
          let obj = testMockStore as any;
          for (let i = 0; i < keys.length - 1; i++) {
            if (!obj[keys[i]]) obj[keys[i]] = {};
            obj = obj[keys[i]];
          }
          obj[keys[keys.length - 1]] = val;
        }
      }),
      clear: vi.fn(() => {
        resetMockStore();
      })
    }))
  };
});

describe('Config Module', () => {
  let mockConsoleError: any;

  beforeEach(() => {
    resetMockStore();
    delete process.env.CONSOLE_OUTPUT_TYPE;
    mockConsoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.resetModules();
  });

  afterEach(() => {
    vi.clearAllMocks();
    mockConsoleError.mockRestore();
    delete process.env.CONSOLE_OUTPUT_TYPE;
  });

  describe('Console Output Type Management', () => {
    it('should set and get console output type', async () => {
      const { setConsoleOutputType, getConsoleOutputType } = await import('../../src/config');
      
      expect(getConsoleOutputType()).toBe('plain');
      
      setConsoleOutputType('json');
      expect(getConsoleOutputType()).toBe('json');
      
      setConsoleOutputType('plain');
      expect(getConsoleOutputType()).toBe('plain');
    });

    it('should respect CONSOLE_OUTPUT_TYPE environment variable', async () => {
      process.env.CONSOLE_OUTPUT_TYPE = 'json';
      vi.resetModules();
      
      const { getConsoleOutputType } = await import('../../src/config');
      expect(getConsoleOutputType()).toBe('json');
    });

    it('should return plain when in interactive mode regardless of output type', async () => {
      const { setConsoleOutputType, setInteractiveMode, getConsoleOutputType } = await import('../../src/config');
      
      setConsoleOutputType('json');
      expect(getConsoleOutputType()).toBe('json');
      
      setInteractiveMode(true);
      expect(getConsoleOutputType()).toBe('plain');
      
      setInteractiveMode(false);
      expect(getConsoleOutputType()).toBe('json');
    });
  });

  describe('Interactive Mode Management', () => {
    it('should set and get interactive mode', async () => {
      const { setInteractiveMode, getInteractiveMode } = await import('../../src/config');
      
      expect(getInteractiveMode()).toBe(false);
      
      setInteractiveMode(true);
      expect(getInteractiveMode()).toBe(true);
      
      setInteractiveMode(false);
      expect(getInteractiveMode()).toBe(false);
    });
  });

  describe('Config Store and Path Functions', () => {
    it('should get config store copy', async () => {
      const { getConfigStore } = await import('../../src/config');
      
      const store = getConfigStore();
      expect(store).toBeDefined();
      expect(store.current).toBe('default');
      expect(store.envs).toBeDefined();
      expect(store.envs.default).toBeDefined();
    });

    it('should get config file path', async () => {
      const { getConfigFilePath } = await import('../../src/config');
      
      const path = getConfigFilePath();
      expect(path).toBe('/mock/config/path.json');
    });
  });

  describe('Current Config Variable Management', () => {
    it('should get current config variable', async () => {
      const { getCurrentConfigVariable } = await import('../../src/config');
      
      const current = getCurrentConfigVariable();
      expect(current).toBe('default');
    });

    it('should set current config variable', async () => {
      const { setCurrentConfigVariable, getCurrentConfigVariable } = await import('../../src/config');
      
      setCurrentConfigVariable('test-env');
      expect(getCurrentConfigVariable()).toBe('test-env');
      
      setCurrentConfigVariable();
      expect(getCurrentConfigVariable()).toBe('default');
    });

    it('should handle null current value', async () => {
      testMockStore.current = null;
      
      const { getCurrentConfigVariable } = await import('../../src/config');
      
      const current = getCurrentConfigVariable();
      expect(current).toBe('default');
    });
  });

  describe('Add New Config Variable', () => {
    it('should add new config variable with default name', async () => {
      const { addNewConfigVariable, getCurrentConfigVariable } = await import('../../src/config');
      
      addNewConfigVariable();
      expect(getCurrentConfigVariable()).toBe('new');
      expect(testMockStore.envs.new).toBeDefined();
      expect(testMockStore.envs.new.API_HOSTNAME).toBe('https://api.appcircle.io');
      expect(testMockStore.envs.new.AUTH_HOSTNAME).toBe('https://auth.appcircle.io');
      expect(testMockStore.envs.new.AC_ACCESS_TOKEN).toBe('');
    });

    it('should add new config variable with custom name', async () => {
      const { addNewConfigVariable, getCurrentConfigVariable } = await import('../../src/config');
      
      addNewConfigVariable('staging');
      expect(getCurrentConfigVariable()).toBe('staging');
      expect(testMockStore.envs.staging).toBeDefined();
      expect(testMockStore.envs.staging.API_HOSTNAME).toBe('https://api.appcircle.io');
    });
  });

  describe('Environment Config for Writing', () => {
    it('should get environments config with masked tokens', async () => {
      const { addNewConfigVariable, writeEnviromentConfigVariable, getEnviromentsConfigToWriting, EnvironmentVariables } = await import('../../src/config');
      
      addNewConfigVariable('test-env');
      writeEnviromentConfigVariable(EnvironmentVariables.AC_ACCESS_TOKEN, 'very-long-secret-token-12345');
      
      const envs = getEnviromentsConfigToWriting();
      expect(envs['test-env']).toBeDefined();
      expect(envs['test-env'].AC_ACCESS_TOKEN).toBe('very-long-...');
    });

    it('should handle empty tokens when masking', async () => {
      const { getEnviromentsConfigToWriting } = await import('../../src/config');
      
      const envs = getEnviromentsConfigToWriting();
      expect(envs.default.AC_ACCESS_TOKEN).toBe('...');
    });

    it('should handle short tokens when masking', async () => {
      testMockStore.envs.default.AC_ACCESS_TOKEN = 'short';
      
      const { getEnviromentsConfigToWriting } = await import('../../src/config');
      
      const envs = getEnviromentsConfigToWriting();
      expect(envs.default.AC_ACCESS_TOKEN).toBe('short...');
    });
  });

  describe('Write Environment Config Variable', () => {
    it('should write environment config variable successfully', async () => {
      const { writeEnviromentConfigVariable, readEnviromentConfigVariable, EnvironmentVariables } = await import('../../src/config');
      
      writeEnviromentConfigVariable(EnvironmentVariables.AC_ACCESS_TOKEN, 'test-token');
      const value = readEnviromentConfigVariable(EnvironmentVariables.AC_ACCESS_TOKEN);
      expect(value).toBe('test-token');
    });

    it('should write API_HOSTNAME environment variable', async () => {
      const { writeEnviromentConfigVariable, readEnviromentConfigVariable, EnvironmentVariables } = await import('../../src/config');
      
      writeEnviromentConfigVariable(EnvironmentVariables.API_HOSTNAME, 'https://custom-api.example.com');
      const value = readEnviromentConfigVariable(EnvironmentVariables.API_HOSTNAME);
      expect(value).toBe('https://custom-api.example.com');
    });

    it('should write AUTH_HOSTNAME environment variable', async () => {
      const { writeEnviromentConfigVariable, readEnviromentConfigVariable, EnvironmentVariables } = await import('../../src/config');
      
      writeEnviromentConfigVariable(EnvironmentVariables.AUTH_HOSTNAME, 'https://custom-auth.example.com');
      const value = readEnviromentConfigVariable(EnvironmentVariables.AUTH_HOSTNAME);
      expect(value).toBe('https://custom-auth.example.com');
    });

    it('should write to current environment context', async () => {
      const { addNewConfigVariable, writeEnviromentConfigVariable, readEnviromentConfigVariable, EnvironmentVariables } = await import('../../src/config');
      
      addNewConfigVariable('prod');
      writeEnviromentConfigVariable(EnvironmentVariables.AC_ACCESS_TOKEN, 'prod-token');
      
      const value = readEnviromentConfigVariable(EnvironmentVariables.AC_ACCESS_TOKEN);
      expect(value).toBe('prod-token');
    });
  });

  describe('Read Environment Config Variable', () => {
    it('should read environment config variable successfully', async () => {
      const { writeEnviromentConfigVariable, readEnviromentConfigVariable, EnvironmentVariables } = await import('../../src/config');
      
      writeEnviromentConfigVariable(EnvironmentVariables.AC_ACCESS_TOKEN, 'read-test-token');
      const value = readEnviromentConfigVariable(EnvironmentVariables.AC_ACCESS_TOKEN);
      expect(value).toBe('read-test-token');
    });

    it('should return empty string for non-existent variable', async () => {
      // Reset to clean state
      resetMockStore();
      
      const { readEnviromentConfigVariable, EnvironmentVariables } = await import('../../src/config');
      
      const value = readEnviromentConfigVariable(EnvironmentVariables.AC_ACCESS_TOKEN);
      expect(value).toBe('');
    });

    it('should read from current environment', async () => {
      const { addNewConfigVariable, writeEnviromentConfigVariable, readEnviromentConfigVariable, EnvironmentVariables } = await import('../../src/config');
      
      addNewConfigVariable('prod');
      writeEnviromentConfigVariable(EnvironmentVariables.API_HOSTNAME, 'https://prod-api.example.com');
      
      const value = readEnviromentConfigVariable(EnvironmentVariables.API_HOSTNAME);
      expect(value).toBe('https://prod-api.example.com');
    });
  });

  describe('Clear Configs', () => {
    it('should clear all configurations', async () => {
      const { addNewConfigVariable, writeEnviromentConfigVariable, clearConfigs, getCurrentConfigVariable, getConfigStore, EnvironmentVariables } = await import('../../src/config');
      
      addNewConfigVariable('test1');
      writeEnviromentConfigVariable(EnvironmentVariables.AC_ACCESS_TOKEN, 'token1');
      
      addNewConfigVariable('test2');
      writeEnviromentConfigVariable(EnvironmentVariables.AC_ACCESS_TOKEN, 'token2');
      
      clearConfigs();
      
      expect(getCurrentConfigVariable()).toBe('default');
      const store = getConfigStore();
      expect(Object.keys(store.envs)).toContain('default');
      expect(store.envs.default.AC_ACCESS_TOKEN).toBe('');
    });
  });

  describe('Environment Variables Enum', () => {
    it('should have correct enum values', async () => {
      const { EnvironmentVariables } = await import('../../src/config');
      
      expect(EnvironmentVariables.AC_ACCESS_TOKEN).toBe('AC_ACCESS_TOKEN');
      expect(EnvironmentVariables.API_HOSTNAME).toBe('API_HOSTNAME');
      expect(EnvironmentVariables.AUTH_HOSTNAME).toBe('AUTH_HOSTNAME');
    });
  });

  describe('Default Environment Variables', () => {
    it('should have correct default values', async () => {
      const { DefaultEnvironmentVariables } = await import('../../src/config');
      
      expect(DefaultEnvironmentVariables.API_HOSTNAME).toBe('https://api.appcircle.io');
      expect(DefaultEnvironmentVariables.AUTH_HOSTNAME).toBe('https://auth.appcircle.io');
      expect(DefaultEnvironmentVariables.AC_ACCESS_TOKEN).toBe('');
    });
  });

  describe('Edge Cases', () => {
    it('should handle null current in write operation', async () => {
      testMockStore.current = null;
      
      const { writeEnviromentConfigVariable, readEnviromentConfigVariable, EnvironmentVariables } = await import('../../src/config');
      
      writeEnviromentConfigVariable(EnvironmentVariables.AC_ACCESS_TOKEN, 'null-test-token');
      
      // Should write to 'default' environment when current is null
      const value = readEnviromentConfigVariable(EnvironmentVariables.AC_ACCESS_TOKEN);
      expect(value).toBe('null-test-token');
    });

    it('should handle null current in read operation', async () => {
      // Set up test data
      testMockStore.envs.default.AC_ACCESS_TOKEN = 'default-token';
      testMockStore.current = null;
      
      const { readEnviromentConfigVariable, EnvironmentVariables } = await import('../../src/config');
      
      // Should read from 'default' environment when current is null
      const value = readEnviromentConfigVariable(EnvironmentVariables.AC_ACCESS_TOKEN);
      expect(value).toBe('default-token');
    });

    it('should handle various environment variable types', async () => {
      const { writeEnviromentConfigVariable, readEnviromentConfigVariable, EnvironmentVariables } = await import('../../src/config');
      
      // Test all environment variable types
      writeEnviromentConfigVariable(EnvironmentVariables.AC_ACCESS_TOKEN, 'token-value');
      writeEnviromentConfigVariable(EnvironmentVariables.API_HOSTNAME, 'api-host-value');
      writeEnviromentConfigVariable(EnvironmentVariables.AUTH_HOSTNAME, 'auth-host-value');
      
      expect(readEnviromentConfigVariable(EnvironmentVariables.AC_ACCESS_TOKEN)).toBe('token-value');
      expect(readEnviromentConfigVariable(EnvironmentVariables.API_HOSTNAME)).toBe('api-host-value');
      expect(readEnviromentConfigVariable(EnvironmentVariables.AUTH_HOSTNAME)).toBe('auth-host-value');
    });

    it('should create multiple config environments', async () => {
      const { addNewConfigVariable, getCurrentConfigVariable } = await import('../../src/config');
      
      // Create multiple environments
      addNewConfigVariable('dev');
      expect(getCurrentConfigVariable()).toBe('dev');
      
      addNewConfigVariable('staging');
      expect(getCurrentConfigVariable()).toBe('staging');
      
      addNewConfigVariable('prod');
      expect(getCurrentConfigVariable()).toBe('prod');
      
      // Verify all environments exist in store
      expect(testMockStore.envs.dev).toBeDefined();
      expect(testMockStore.envs.staging).toBeDefined();
      expect(testMockStore.envs.prod).toBeDefined();
    });
  });
});