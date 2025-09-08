import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock ProgramError
vi.mock('../../../src/core/ProgramError', () => ({
  ProgramError: class ProgramError extends Error {
    constructor(message: string) {
      super(message);
      this.name = 'ProgramError';
    }
  }
}));

import {
  handleConfigListAction,
  handleConfigSetAction,
  handleConfigGetAction,
  handleConfigCurrentAction,
  handleConfigAddAction,
  handleConfigResetAction,
  handleConfigTrustAction
} from '../../../src/core/command-runner';
import { ProgramError } from '../../../src/core/ProgramError';

describe('Config Action Handlers', () => {
  let mockGetConfigStore: any;
  let mockGetConsoleOutputType: any;
  let mockConfigWriter: any;
  let mockGetConfigFilePath: any;
  let mockGetEnviromentsConfigToWriting: any;
  let mockWriteEnviromentConfigVariable: any;
  let mockReadEnviromentConfigVariable: any;
  let mockSetCurrentConfigVariable: any;
  let mockGetCurrentConfigVariable: any;
  let mockAddNewConfigVariable: any;
  let mockClearConfigs: any;
  let mockTrustAppcircleCertificate: any;

  beforeEach(() => {
    vi.clearAllMocks();
    
    mockGetConfigStore = vi.fn();
    mockGetConsoleOutputType = vi.fn();
    mockConfigWriter = vi.fn();
    mockGetConfigFilePath = vi.fn();
    mockGetEnviromentsConfigToWriting = vi.fn();
    mockWriteEnviromentConfigVariable = vi.fn();
    mockReadEnviromentConfigVariable = vi.fn();
    mockSetCurrentConfigVariable = vi.fn();
    mockGetCurrentConfigVariable = vi.fn();
    mockAddNewConfigVariable = vi.fn();
    mockClearConfigs = vi.fn();
    mockTrustAppcircleCertificate = vi.fn();
  });

  describe('handleConfigListAction', () => {
    it('should handle list action in JSON mode', () => {
      const mockStore = { current: 'default', envs: { default: {} } };
      mockGetConfigStore.mockReturnValue(mockStore);
      mockGetConsoleOutputType.mockReturnValue('json');

      handleConfigListAction(
        mockGetConfigStore,
        mockGetConsoleOutputType,
        mockConfigWriter,
        mockGetConfigFilePath,
        mockGetEnviromentsConfigToWriting
      );

      expect(mockGetConfigStore).toHaveBeenCalled();
      expect(mockGetConsoleOutputType).toHaveBeenCalled();
      expect(mockConfigWriter).toHaveBeenCalledWith(mockStore);
      expect(mockConfigWriter).toHaveBeenCalledTimes(1);
    });

    it('should handle list action in plain mode', () => {
      const mockStore = { current: 'default', envs: { default: {} } };
      const mockPath = '/config/path';
      const mockEnvConfig = { env: 'data' };
      
      mockGetConfigStore.mockReturnValue(mockStore);
      mockGetConsoleOutputType.mockReturnValue('plain');
      mockGetConfigFilePath.mockReturnValue(mockPath);
      mockGetEnviromentsConfigToWriting.mockReturnValue(mockEnvConfig);

      handleConfigListAction(
        mockGetConfigStore,
        mockGetConsoleOutputType,
        mockConfigWriter,
        mockGetConfigFilePath,
        mockGetEnviromentsConfigToWriting
      );

      expect(mockGetConfigStore).toHaveBeenCalled();
      expect(mockGetConsoleOutputType).toHaveBeenCalled();
      expect(mockGetConfigFilePath).toHaveBeenCalled();
      expect(mockGetEnviromentsConfigToWriting).toHaveBeenCalled();
      expect(mockConfigWriter).toHaveBeenCalledWith({ current: 'default', path: mockPath });
      expect(mockConfigWriter).toHaveBeenCalledWith(mockEnvConfig);
      expect(mockConfigWriter).toHaveBeenCalledTimes(2);
    });

    it('should handle empty store in JSON mode', () => {
      const emptyStore = {};
      mockGetConfigStore.mockReturnValue(emptyStore);
      mockGetConsoleOutputType.mockReturnValue('json');

      handleConfigListAction(
        mockGetConfigStore,
        mockGetConsoleOutputType,
        mockConfigWriter,
        mockGetConfigFilePath,
        mockGetEnviromentsConfigToWriting
      );

      expect(mockConfigWriter).toHaveBeenCalledWith(emptyStore);
    });

    it('should handle null store gracefully', () => {
      mockGetConfigStore.mockReturnValue(null);
      mockGetConsoleOutputType.mockReturnValue('json');

      handleConfigListAction(
        mockGetConfigStore,
        mockGetConsoleOutputType,
        mockConfigWriter,
        mockGetConfigFilePath,
        mockGetEnviromentsConfigToWriting
      );

      expect(mockConfigWriter).toHaveBeenCalledWith(null);
    });
  });

  describe('handleConfigSetAction', () => {
    it('should set configuration variable and write output', () => {
      const key = 'API_HOSTNAME';
      const value = 'https://api.example.com';
      const readValue = 'https://api.example.com';
      
      mockReadEnviromentConfigVariable.mockReturnValue(readValue);

      handleConfigSetAction(
        key,
        value,
        mockWriteEnviromentConfigVariable,
        mockReadEnviromentConfigVariable,
        mockConfigWriter
      );

      expect(mockWriteEnviromentConfigVariable).toHaveBeenCalledWith(key, value);
      expect(mockReadEnviromentConfigVariable).toHaveBeenCalledWith(key);
      expect(mockConfigWriter).toHaveBeenCalledWith({ [key]: readValue });
    });

    it('should handle empty value', () => {
      const key = 'TEST_KEY';
      const value = '';
      
      mockReadEnviromentConfigVariable.mockReturnValue('');

      handleConfigSetAction(
        key,
        value,
        mockWriteEnviromentConfigVariable,
        mockReadEnviromentConfigVariable,
        mockConfigWriter
      );

      expect(mockWriteEnviromentConfigVariable).toHaveBeenCalledWith(key, value);
      expect(mockConfigWriter).toHaveBeenCalledWith({ [key]: '' });
    });

    it('should handle null value', () => {
      const key = 'NULL_KEY';
      const value = null;
      
      mockReadEnviromentConfigVariable.mockReturnValue(null);

      handleConfigSetAction(
        key,
        value as any,
        mockWriteEnviromentConfigVariable,
        mockReadEnviromentConfigVariable,
        mockConfigWriter
      );

      expect(mockWriteEnviromentConfigVariable).toHaveBeenCalledWith(key, null);
      expect(mockConfigWriter).toHaveBeenCalledWith({ [key]: null });
    });

    it('should handle undefined value', () => {
      const key = 'UNDEFINED_KEY';
      const value = undefined;
      
      mockReadEnviromentConfigVariable.mockReturnValue(undefined);

      handleConfigSetAction(
        key,
        value as any,
        mockWriteEnviromentConfigVariable,
        mockReadEnviromentConfigVariable,
        mockConfigWriter
      );

      expect(mockWriteEnviromentConfigVariable).toHaveBeenCalledWith(key, undefined);
      expect(mockConfigWriter).toHaveBeenCalledWith({ [key]: undefined });
    });

    it('should handle special characters in key and value', () => {
      const key = 'SPECIAL_KEY_@#$%';
      const value = 'value with spaces and symbols !@#$%^&*()';
      
      mockReadEnviromentConfigVariable.mockReturnValue(value);

      handleConfigSetAction(
        key,
        value,
        mockWriteEnviromentConfigVariable,
        mockReadEnviromentConfigVariable,
        mockConfigWriter
      );

      expect(mockWriteEnviromentConfigVariable).toHaveBeenCalledWith(key, value);
      expect(mockConfigWriter).toHaveBeenCalledWith({ [key]: value });
    });
  });

  describe('handleConfigGetAction', () => {
    it('should get configuration variable and write output', () => {
      const key = 'API_HOSTNAME';
      const value = 'https://api.example.com';
      
      mockReadEnviromentConfigVariable.mockReturnValue(value);

      handleConfigGetAction(key, mockReadEnviromentConfigVariable, mockConfigWriter);

      expect(mockReadEnviromentConfigVariable).toHaveBeenCalledWith(key);
      expect(mockConfigWriter).toHaveBeenCalledWith({ [key]: value });
    });

    it('should handle empty key', () => {
      const key = '';
      const value = 'default-value';
      
      mockReadEnviromentConfigVariable.mockReturnValue(value);

      handleConfigGetAction(key, mockReadEnviromentConfigVariable, mockConfigWriter);

      expect(mockReadEnviromentConfigVariable).toHaveBeenCalledWith(key);
      expect(mockConfigWriter).toHaveBeenCalledWith({ [key]: value });
    });

    it('should handle non-existent key', () => {
      const key = 'NON_EXISTENT_KEY';
      
      mockReadEnviromentConfigVariable.mockReturnValue(undefined);

      handleConfigGetAction(key, mockReadEnviromentConfigVariable, mockConfigWriter);

      expect(mockReadEnviromentConfigVariable).toHaveBeenCalledWith(key);
      expect(mockConfigWriter).toHaveBeenCalledWith({ [key]: undefined });
    });

    it('should handle null value', () => {
      const key = 'NULL_KEY';
      
      mockReadEnviromentConfigVariable.mockReturnValue(null);

      handleConfigGetAction(key, mockReadEnviromentConfigVariable, mockConfigWriter);

      expect(mockReadEnviromentConfigVariable).toHaveBeenCalledWith(key);
      expect(mockConfigWriter).toHaveBeenCalledWith({ [key]: null });
    });
  });

  describe('handleConfigCurrentAction', () => {
    it('should set current configuration successfully', () => {
      const key = 'production';
      const mockStore = { envs: { production: { API_HOSTNAME: 'prod.api.com' } } };
      const currentConfig = 'production';
      
      mockGetConfigStore.mockReturnValue(mockStore);
      mockGetCurrentConfigVariable.mockReturnValue(currentConfig);

      handleConfigCurrentAction(
        key,
        mockGetConfigStore,
        mockSetCurrentConfigVariable,
        mockGetCurrentConfigVariable,
        mockConfigWriter
      );

      expect(mockGetConfigStore).toHaveBeenCalled();
      expect(mockSetCurrentConfigVariable).toHaveBeenCalledWith(key);
      expect(mockGetCurrentConfigVariable).toHaveBeenCalled();
      expect(mockConfigWriter).toHaveBeenCalledWith({ current: currentConfig });
    });

    it('should throw error when key is empty', () => {
      const key = '';
      
      expect(() => {
        handleConfigCurrentAction(
          key,
          mockGetConfigStore,
          mockSetCurrentConfigVariable,
          mockGetCurrentConfigVariable,
          mockConfigWriter
        );
      }).toThrow(ProgramError);
      expect(() => {
        handleConfigCurrentAction(
          key,
          mockGetConfigStore,
          mockSetCurrentConfigVariable,
          mockGetCurrentConfigVariable,
          mockConfigWriter
        );
      }).toThrow("Config command 'current' action requires a value");
    });

    it('should throw error when key is null', () => {
      const key = null;
      
      expect(() => {
        handleConfigCurrentAction(
          key as any,
          mockGetConfigStore,
          mockSetCurrentConfigVariable,
          mockGetCurrentConfigVariable,
          mockConfigWriter
        );
      }).toThrow(ProgramError);
      expect(() => {
        handleConfigCurrentAction(
          key as any,
          mockGetConfigStore,
          mockSetCurrentConfigVariable,
          mockGetCurrentConfigVariable,
          mockConfigWriter
        );
      }).toThrow("Config command 'current' action requires a value");
    });

    it('should throw error when key is undefined', () => {
      const key = undefined;
      
      expect(() => {
        handleConfigCurrentAction(
          key as any,
          mockGetConfigStore,
          mockSetCurrentConfigVariable,
          mockGetCurrentConfigVariable,
          mockConfigWriter
        );
      }).toThrow(ProgramError);
    });

    it('should throw error when key is not valid environment', () => {
      const key = 'invalid-env';
      const mockStore = { envs: { production: {}, staging: {} } };
      
      mockGetConfigStore.mockReturnValue(mockStore);

      expect(() => {
        handleConfigCurrentAction(
          key,
          mockGetConfigStore,
          mockSetCurrentConfigVariable,
          mockGetCurrentConfigVariable,
          mockConfigWriter
        );
      }).toThrow(ProgramError);
      expect(() => {
        handleConfigCurrentAction(
          key,
          mockGetConfigStore,
          mockSetCurrentConfigVariable,
          mockGetCurrentConfigVariable,
          mockConfigWriter
        );
      }).toThrow("Config command 'current' action requires a valid value");
    });

    it('should handle empty envs object', () => {
      const key = 'test';
      const mockStore = { envs: {} };
      
      mockGetConfigStore.mockReturnValue(mockStore);

      expect(() => {
        handleConfigCurrentAction(
          key,
          mockGetConfigStore,
          mockSetCurrentConfigVariable,
          mockGetCurrentConfigVariable,
          mockConfigWriter
        );
      }).toThrow(ProgramError);
    });

    it('should handle null envs', () => {
      const key = 'test';
      const mockStore = { envs: null };
      
      mockGetConfigStore.mockReturnValue(mockStore);

      expect(() => {
        handleConfigCurrentAction(
          key,
          mockGetConfigStore,
          mockSetCurrentConfigVariable,
          mockGetCurrentConfigVariable,
          mockConfigWriter
        );
      }).toThrow(TypeError);
    });
  });

  describe('handleConfigAddAction', () => {
    it('should add new configuration successfully', () => {
      const key = 'staging';
      const currentConfig = 'staging';
      const envConfig = { staging: {} };
      
      mockGetCurrentConfigVariable.mockReturnValue(currentConfig);
      mockGetEnviromentsConfigToWriting.mockReturnValue(envConfig);

      handleConfigAddAction(
        key,
        mockAddNewConfigVariable,
        mockGetCurrentConfigVariable,
        mockConfigWriter,
        mockGetEnviromentsConfigToWriting
      );

      expect(mockAddNewConfigVariable).toHaveBeenCalledWith(key);
      expect(mockGetCurrentConfigVariable).toHaveBeenCalled();
      expect(mockGetEnviromentsConfigToWriting).toHaveBeenCalled();
      expect(mockConfigWriter).toHaveBeenCalledWith({ current: currentConfig });
      expect(mockConfigWriter).toHaveBeenCalledWith(envConfig);
      expect(mockConfigWriter).toHaveBeenCalledTimes(2);
    });

    it('should throw error when key is empty', () => {
      const key = '';
      
      expect(() => {
        handleConfigAddAction(
          key,
          mockAddNewConfigVariable,
          mockGetCurrentConfigVariable,
          mockConfigWriter,
          mockGetEnviromentsConfigToWriting
        );
      }).toThrow(ProgramError);
      expect(() => {
        handleConfigAddAction(
          key,
          mockAddNewConfigVariable,
          mockGetCurrentConfigVariable,
          mockConfigWriter,
          mockGetEnviromentsConfigToWriting
        );
      }).toThrow("Config command 'add' action requires a value(key)");
    });

    it('should throw error when key is null', () => {
      const key = null;
      
      expect(() => {
        handleConfigAddAction(
          key as any,
          mockAddNewConfigVariable,
          mockGetCurrentConfigVariable,
          mockConfigWriter,
          mockGetEnviromentsConfigToWriting
        );
      }).toThrow(ProgramError);
    });

    it('should throw error when key is undefined', () => {
      const key = undefined;
      
      expect(() => {
        handleConfigAddAction(
          key as any,
          mockAddNewConfigVariable,
          mockGetCurrentConfigVariable,
          mockConfigWriter,
          mockGetEnviromentsConfigToWriting
        );
      }).toThrow(ProgramError);
    });

    it('should handle whitespace-only key as valid (implementation allows it)', () => {
      const key = '   ';
      const currentConfig = 'default';
      const envConfig = {};
      
      mockGetCurrentConfigVariable.mockReturnValue(currentConfig);
      mockGetEnviromentsConfigToWriting.mockReturnValue(envConfig);
      
      // Implementation doesn't trim, so whitespace-only keys are allowed
      expect(() => {
        handleConfigAddAction(
          key,
          mockAddNewConfigVariable,
          mockGetCurrentConfigVariable,
          mockConfigWriter,
          mockGetEnviromentsConfigToWriting
        );
      }).not.toThrow();
      
      expect(mockAddNewConfigVariable).toHaveBeenCalledWith(key);
    });

    it('should handle valid key with special characters', () => {
      const key = 'env-with-dashes_and_underscores';
      const currentConfig = 'default';
      const envConfig = {};
      
      mockGetCurrentConfigVariable.mockReturnValue(currentConfig);
      mockGetEnviromentsConfigToWriting.mockReturnValue(envConfig);

      handleConfigAddAction(
        key,
        mockAddNewConfigVariable,
        mockGetCurrentConfigVariable,
        mockConfigWriter,
        mockGetEnviromentsConfigToWriting
      );

      expect(mockAddNewConfigVariable).toHaveBeenCalledWith(key);
      expect(mockConfigWriter).toHaveBeenCalledTimes(2);
    });
  });

  describe('handleConfigResetAction', () => {
    it('should reset configuration successfully', () => {
      const currentConfig = 'default';
      const envConfig = { default: {} };
      
      mockGetCurrentConfigVariable.mockReturnValue(currentConfig);
      mockGetEnviromentsConfigToWriting.mockReturnValue(envConfig);

      handleConfigResetAction(
        mockClearConfigs,
        mockGetCurrentConfigVariable,
        mockConfigWriter,
        mockGetEnviromentsConfigToWriting
      );

      expect(mockClearConfigs).toHaveBeenCalled();
      expect(mockGetCurrentConfigVariable).toHaveBeenCalled();
      expect(mockGetEnviromentsConfigToWriting).toHaveBeenCalled();
      expect(mockConfigWriter).toHaveBeenCalledWith({ current: currentConfig });
      expect(mockConfigWriter).toHaveBeenCalledWith(envConfig);
      expect(mockConfigWriter).toHaveBeenCalledTimes(2);
    });

    it('should handle reset even when current config is null', () => {
      const currentConfig = null;
      const envConfig = {};
      
      mockGetCurrentConfigVariable.mockReturnValue(currentConfig);
      mockGetEnviromentsConfigToWriting.mockReturnValue(envConfig);

      handleConfigResetAction(
        mockClearConfigs,
        mockGetCurrentConfigVariable,
        mockConfigWriter,
        mockGetEnviromentsConfigToWriting
      );

      expect(mockClearConfigs).toHaveBeenCalled();
      expect(mockConfigWriter).toHaveBeenCalledWith({ current: currentConfig });
      expect(mockConfigWriter).toHaveBeenCalledWith(envConfig);
    });

    it('should handle reset even when env config is empty', () => {
      const currentConfig = 'default';
      const envConfig = {};
      
      mockGetCurrentConfigVariable.mockReturnValue(currentConfig);
      mockGetEnviromentsConfigToWriting.mockReturnValue(envConfig);

      handleConfigResetAction(
        mockClearConfigs,
        mockGetCurrentConfigVariable,
        mockConfigWriter,
        mockGetEnviromentsConfigToWriting
      );

      expect(mockClearConfigs).toHaveBeenCalled();
      expect(mockConfigWriter).toHaveBeenCalledWith({ current: currentConfig });
      expect(mockConfigWriter).toHaveBeenCalledWith(envConfig);
    });

    it('should call functions in correct order', () => {
      const currentConfig = 'default';
      const envConfig = {};
      
      mockGetCurrentConfigVariable.mockReturnValue(currentConfig);
      mockGetEnviromentsConfigToWriting.mockReturnValue(envConfig);

      handleConfigResetAction(
        mockClearConfigs,
        mockGetCurrentConfigVariable,
        mockConfigWriter,
        mockGetEnviromentsConfigToWriting
      );

      // Verify call order
      expect(mockClearConfigs).toHaveBeenCalledBefore(mockGetCurrentConfigVariable);
      expect(mockGetCurrentConfigVariable).toHaveBeenCalledBefore(mockGetEnviromentsConfigToWriting);
    });
  });

  describe('handleConfigTrustAction', () => {
    it('should call trust certificate function', () => {
      handleConfigTrustAction(mockTrustAppcircleCertificate);

      expect(mockTrustAppcircleCertificate).toHaveBeenCalled();
      expect(mockTrustAppcircleCertificate).toHaveBeenCalledTimes(1);
    });

    it('should handle null trust function gracefully', () => {
      const nullTrustFn = null;

      expect(() => {
        handleConfigTrustAction(nullTrustFn);
      }).toThrow();
    });

    it('should handle undefined trust function gracefully', () => {
      const undefinedTrustFn = undefined;

      expect(() => {
        handleConfigTrustAction(undefinedTrustFn);
      }).toThrow();
    });

    it('should propagate errors from trust function', () => {
      const errorMessage = 'Certificate trust failed';
      mockTrustAppcircleCertificate.mockImplementation(() => {
        throw new Error(errorMessage);
      });

      expect(() => {
        handleConfigTrustAction(mockTrustAppcircleCertificate);
      }).toThrow(errorMessage);
    });

    it('should handle sync and async trust functions', async () => {
      // Test sync function
      const syncTrustFn = vi.fn();
      handleConfigTrustAction(syncTrustFn);
      expect(syncTrustFn).toHaveBeenCalled();

      // Test async function (though not awaited in the handler)
      const asyncTrustFn = vi.fn().mockResolvedValue(true);
      handleConfigTrustAction(asyncTrustFn);
      expect(asyncTrustFn).toHaveBeenCalled();
    });
  });

  describe('Integration Tests', () => {
    it('should handle complete config workflow', () => {
      // Add a new environment
      const newEnvKey = 'staging';
      mockGetCurrentConfigVariable.mockReturnValue('staging');
      mockGetEnviromentsConfigToWriting.mockReturnValue({ staging: {} });

      handleConfigAddAction(
        newEnvKey,
        mockAddNewConfigVariable,
        mockGetCurrentConfigVariable,
        mockConfigWriter,
        mockGetEnviromentsConfigToWriting
      );

      // Set current environment to the new one
      const mockStore = { envs: { staging: {} } };
      mockGetConfigStore.mockReturnValue(mockStore);

      handleConfigCurrentAction(
        newEnvKey,
        mockGetConfigStore,
        mockSetCurrentConfigVariable,
        mockGetCurrentConfigVariable,
        mockConfigWriter
      );

      // Set a value in the new environment
      handleConfigSetAction(
        'API_HOSTNAME',
        'https://staging.api.com',
        mockWriteEnviromentConfigVariable,
        mockReadEnviromentConfigVariable,
        mockConfigWriter
      );

      expect(mockAddNewConfigVariable).toHaveBeenCalledWith(newEnvKey);
      expect(mockSetCurrentConfigVariable).toHaveBeenCalledWith(newEnvKey);
      expect(mockWriteEnviromentConfigVariable).toHaveBeenCalledWith('API_HOSTNAME', 'https://staging.api.com');
    });

    it('should handle error recovery', () => {
      // Try to set current to invalid environment
      const invalidKey = 'invalid';
      const mockStore = { envs: { production: {} } };
      mockGetConfigStore.mockReturnValue(mockStore);

      expect(() => {
        handleConfigCurrentAction(
          invalidKey,
          mockGetConfigStore,
          mockSetCurrentConfigVariable,
          mockGetCurrentConfigVariable,
          mockConfigWriter
        );
      }).toThrow(ProgramError);

      // Should not have called set functions
      expect(mockSetCurrentConfigVariable).not.toHaveBeenCalled();
      expect(mockConfigWriter).not.toHaveBeenCalled();
    });
  });

  describe('Edge Cases', () => {
    it('should handle functions throwing errors', () => {
      // Test error from getConfigStore
      mockGetConfigStore.mockImplementation(() => {
        throw new Error('Config store error');
      });

      expect(() => {
        handleConfigListAction(
          mockGetConfigStore,
          mockGetConsoleOutputType,
          mockConfigWriter,
          mockGetConfigFilePath,
          mockGetEnviromentsConfigToWriting
        );
      }).toThrow('Config store error');
    });

    it('should handle very long keys and values', () => {
      const longKey = 'A'.repeat(1000);
      const longValue = 'B'.repeat(5000);
      
      mockReadEnviromentConfigVariable.mockReturnValue(longValue);

      handleConfigSetAction(
        longKey,
        longValue,
        mockWriteEnviromentConfigVariable,
        mockReadEnviromentConfigVariable,
        mockConfigWriter
      );

      expect(mockWriteEnviromentConfigVariable).toHaveBeenCalledWith(longKey, longValue);
      expect(mockConfigWriter).toHaveBeenCalledWith({ [longKey]: longValue });
    });

    it('should handle unicode keys and values', () => {
      const unicodeKey = '配置键名';
      const unicodeValue = 'https://配置值.com/测试';
      
      mockReadEnviromentConfigVariable.mockReturnValue(unicodeValue);

      handleConfigSetAction(
        unicodeKey,
        unicodeValue,
        mockWriteEnviromentConfigVariable,
        mockReadEnviromentConfigVariable,
        mockConfigWriter
      );

      expect(mockWriteEnviromentConfigVariable).toHaveBeenCalledWith(unicodeKey, unicodeValue);
      expect(mockConfigWriter).toHaveBeenCalledWith({ [unicodeKey]: unicodeValue });
    });
  });
});