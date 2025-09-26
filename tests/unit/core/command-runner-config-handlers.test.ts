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

// Import functions to test
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

describe('Command Runner Config Handlers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('handleConfigListAction', () => {
    it('should output store in JSON mode', () => {
      const mockStore = { current: 'default', envs: { default: { token: 'test' } } };
      const mockGetConfigStore = vi.fn().mockReturnValue(mockStore);
      const mockGetConsoleOutputType = vi.fn().mockReturnValue('json');
      const mockConfigWriter = vi.fn();
      const mockGetConfigFilePath = vi.fn().mockReturnValue('/path/to/config');
      const mockGetEnviromentsConfigToWriting = vi.fn().mockReturnValue({ environments: [] });

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
      expect(mockGetConfigFilePath).not.toHaveBeenCalled();
      expect(mockGetEnviromentsConfigToWriting).not.toHaveBeenCalled();
    });

    it('should output current config and environments in plain mode', () => {
      const mockStore = { current: 'default', envs: { default: { token: 'test' } } };
      const mockGetConfigStore = vi.fn().mockReturnValue(mockStore);
      const mockGetConsoleOutputType = vi.fn().mockReturnValue('plain');
      const mockConfigWriter = vi.fn();
      const mockGetConfigFilePath = vi.fn().mockReturnValue('/path/to/config');
      const mockGetEnviromentsConfigToWriting = vi.fn().mockReturnValue({ environments: ['default'] });

      handleConfigListAction(
        mockGetConfigStore,
        mockGetConsoleOutputType,
        mockConfigWriter,
        mockGetConfigFilePath,
        mockGetEnviromentsConfigToWriting
      );

      expect(mockGetConfigStore).toHaveBeenCalled();
      expect(mockGetConsoleOutputType).toHaveBeenCalled();
      expect(mockConfigWriter).toHaveBeenCalledWith({ current: 'default', path: '/path/to/config' });
      expect(mockConfigWriter).toHaveBeenCalledWith({ environments: ['default'] });
      expect(mockGetConfigFilePath).toHaveBeenCalled();
      expect(mockGetEnviromentsConfigToWriting).toHaveBeenCalled();
    });

    it('should handle empty store', () => {
      const mockStore = { current: null, envs: {} };
      const mockGetConfigStore = vi.fn().mockReturnValue(mockStore);
      const mockGetConsoleOutputType = vi.fn().mockReturnValue('plain');
      const mockConfigWriter = vi.fn();
      const mockGetConfigFilePath = vi.fn().mockReturnValue('/path/to/config');
      const mockGetEnviromentsConfigToWriting = vi.fn().mockReturnValue({});

      handleConfigListAction(
        mockGetConfigStore,
        mockGetConsoleOutputType,
        mockConfigWriter,
        mockGetConfigFilePath,
        mockGetEnviromentsConfigToWriting
      );

      expect(mockConfigWriter).toHaveBeenCalledWith({ current: null, path: '/path/to/config' });
      expect(mockConfigWriter).toHaveBeenCalledWith({});
    });
  });

  describe('handleConfigSetAction', () => {
    it('should set config value and output result', () => {
      const mockWriteEnviromentConfigVariable = vi.fn();
      const mockReadEnviromentConfigVariable = vi.fn().mockReturnValue('new-value');
      const mockConfigWriter = vi.fn();

      handleConfigSetAction(
        'api-token',
        'new-value',
        mockWriteEnviromentConfigVariable,
        mockReadEnviromentConfigVariable,
        mockConfigWriter
      );

      expect(mockWriteEnviromentConfigVariable).toHaveBeenCalledWith('api-token', 'new-value');
      expect(mockReadEnviromentConfigVariable).toHaveBeenCalledWith('api-token');
      expect(mockConfigWriter).toHaveBeenCalledWith({ 'api-token': 'new-value' });
    });

    it('should handle empty key', () => {
      const mockWriteEnviromentConfigVariable = vi.fn();
      const mockReadEnviromentConfigVariable = vi.fn().mockReturnValue('');
      const mockConfigWriter = vi.fn();

      handleConfigSetAction(
        '',
        'value',
        mockWriteEnviromentConfigVariable,
        mockReadEnviromentConfigVariable,
        mockConfigWriter
      );

      expect(mockWriteEnviromentConfigVariable).toHaveBeenCalledWith('', 'value');
      expect(mockReadEnviromentConfigVariable).toHaveBeenCalledWith('');
      expect(mockConfigWriter).toHaveBeenCalledWith({ '': '' });
    });

    it('should handle empty value', () => {
      const mockWriteEnviromentConfigVariable = vi.fn();
      const mockReadEnviromentConfigVariable = vi.fn().mockReturnValue('');
      const mockConfigWriter = vi.fn();

      handleConfigSetAction(
        'api-token',
        '',
        mockWriteEnviromentConfigVariable,
        mockReadEnviromentConfigVariable,
        mockConfigWriter
      );

      expect(mockWriteEnviromentConfigVariable).toHaveBeenCalledWith('api-token', '');
      expect(mockReadEnviromentConfigVariable).toHaveBeenCalledWith('api-token');
      expect(mockConfigWriter).toHaveBeenCalledWith({ 'api-token': '' });
    });

    it('should handle special characters in key and value', () => {
      const mockWriteEnviromentConfigVariable = vi.fn();
      const mockReadEnviromentConfigVariable = vi.fn().mockReturnValue('value@#$%');
      const mockConfigWriter = vi.fn();

      handleConfigSetAction(
        'key-with-dashes_and_underscores',
        'value@#$%',
        mockWriteEnviromentConfigVariable,
        mockReadEnviromentConfigVariable,
        mockConfigWriter
      );

      expect(mockWriteEnviromentConfigVariable).toHaveBeenCalledWith('key-with-dashes_and_underscores', 'value@#$%');
      expect(mockConfigWriter).toHaveBeenCalledWith({ 'key-with-dashes_and_underscores': 'value@#$%' });
    });
  });

  describe('handleConfigGetAction', () => {
    it('should get config value and output result', () => {
      const mockReadEnviromentConfigVariable = vi.fn().mockReturnValue('stored-value');
      const mockConfigWriter = vi.fn();

      handleConfigGetAction('api-token', mockReadEnviromentConfigVariable, mockConfigWriter);

      expect(mockReadEnviromentConfigVariable).toHaveBeenCalledWith('api-token');
      expect(mockConfigWriter).toHaveBeenCalledWith({ 'api-token': 'stored-value' });
    });

    it('should handle non-existent key', () => {
      const mockReadEnviromentConfigVariable = vi.fn().mockReturnValue(null);
      const mockConfigWriter = vi.fn();

      handleConfigGetAction('non-existent-key', mockReadEnviromentConfigVariable, mockConfigWriter);

      expect(mockReadEnviromentConfigVariable).toHaveBeenCalledWith('non-existent-key');
      expect(mockConfigWriter).toHaveBeenCalledWith({ 'non-existent-key': null });
    });

    it('should handle empty key', () => {
      const mockReadEnviromentConfigVariable = vi.fn().mockReturnValue(undefined);
      const mockConfigWriter = vi.fn();

      handleConfigGetAction('', mockReadEnviromentConfigVariable, mockConfigWriter);

      expect(mockReadEnviromentConfigVariable).toHaveBeenCalledWith('');
      expect(mockConfigWriter).toHaveBeenCalledWith({ '': undefined });
    });

    it('should handle undefined value', () => {
      const mockReadEnviromentConfigVariable = vi.fn().mockReturnValue(undefined);
      const mockConfigWriter = vi.fn();

      handleConfigGetAction('undefined-key', mockReadEnviromentConfigVariable, mockConfigWriter);

      expect(mockReadEnviromentConfigVariable).toHaveBeenCalledWith('undefined-key');
      expect(mockConfigWriter).toHaveBeenCalledWith({ 'undefined-key': undefined });
    });
  });

  describe('handleConfigCurrentAction', () => {
    it('should set current environment when key is valid', () => {
      const mockStore = { current: 'old-env', envs: { 'new-env': { token: 'test' } } };
      const mockGetConfigStore = vi.fn().mockReturnValue(mockStore);
      const mockSetCurrentConfigVariable = vi.fn();
      const mockGetCurrentConfigVariable = vi.fn().mockReturnValue('new-env');
      const mockConfigWriter = vi.fn();

      handleConfigCurrentAction(
        'new-env',
        mockGetConfigStore,
        mockSetCurrentConfigVariable,
        mockGetCurrentConfigVariable,
        mockConfigWriter
      );

      expect(mockGetConfigStore).toHaveBeenCalled();
      expect(mockSetCurrentConfigVariable).toHaveBeenCalledWith('new-env');
      expect(mockGetCurrentConfigVariable).toHaveBeenCalled();
      expect(mockConfigWriter).toHaveBeenCalledWith({ current: 'new-env' });
    });

    it('should throw error when key is not provided', () => {
      const mockGetConfigStore = vi.fn();
      const mockSetCurrentConfigVariable = vi.fn();
      const mockGetCurrentConfigVariable = vi.fn();
      const mockConfigWriter = vi.fn();

      expect(() => handleConfigCurrentAction(
        '',
        mockGetConfigStore,
        mockSetCurrentConfigVariable,
        mockGetCurrentConfigVariable,
        mockConfigWriter
      )).toThrow(ProgramError);

      expect(() => handleConfigCurrentAction(
        '',
        mockGetConfigStore,
        mockSetCurrentConfigVariable,
        mockGetCurrentConfigVariable,
        mockConfigWriter
      )).toThrow("Config command 'current' action requires a value");
    });

    it('should throw error when key is null', () => {
      const mockGetConfigStore = vi.fn();
      const mockSetCurrentConfigVariable = vi.fn();
      const mockGetCurrentConfigVariable = vi.fn();
      const mockConfigWriter = vi.fn();

      expect(() => handleConfigCurrentAction(
        null as any,
        mockGetConfigStore,
        mockSetCurrentConfigVariable,
        mockGetCurrentConfigVariable,
        mockConfigWriter
      )).toThrow(ProgramError);
    });

    it('should throw error when key is undefined', () => {
      const mockGetConfigStore = vi.fn();
      const mockSetCurrentConfigVariable = vi.fn();
      const mockGetCurrentConfigVariable = vi.fn();
      const mockConfigWriter = vi.fn();

      expect(() => handleConfigCurrentAction(
        undefined as any,
        mockGetConfigStore,
        mockSetCurrentConfigVariable,
        mockGetCurrentConfigVariable,
        mockConfigWriter
      )).toThrow(ProgramError);
    });

    it('should throw error when environment does not exist', () => {
      const mockStore = { current: 'default', envs: { 'default': { token: 'test' } } };
      const mockGetConfigStore = vi.fn().mockReturnValue(mockStore);
      const mockSetCurrentConfigVariable = vi.fn();
      const mockGetCurrentConfigVariable = vi.fn();
      const mockConfigWriter = vi.fn();

      expect(() => handleConfigCurrentAction(
        'non-existent-env',
        mockGetConfigStore,
        mockSetCurrentConfigVariable,
        mockGetCurrentConfigVariable,
        mockConfigWriter
      )).toThrow(ProgramError);

      expect(() => handleConfigCurrentAction(
        'non-existent-env',
        mockGetConfigStore,
        mockSetCurrentConfigVariable,
        mockGetCurrentConfigVariable,
        mockConfigWriter
      )).toThrow("Config command 'current' action requires a valid value");

      expect(mockGetConfigStore).toHaveBeenCalled();
      expect(mockSetCurrentConfigVariable).not.toHaveBeenCalled();
      expect(mockGetCurrentConfigVariable).not.toHaveBeenCalled();
    });

    it('should handle empty envs object', () => {
      const mockStore = { current: 'default', envs: {} };
      const mockGetConfigStore = vi.fn().mockReturnValue(mockStore);
      const mockSetCurrentConfigVariable = vi.fn();
      const mockGetCurrentConfigVariable = vi.fn();
      const mockConfigWriter = vi.fn();

      expect(() => handleConfigCurrentAction(
        'any-env',
        mockGetConfigStore,
        mockSetCurrentConfigVariable,
        mockGetCurrentConfigVariable,
        mockConfigWriter
      )).toThrow(ProgramError);
    });
  });

  describe('handleConfigAddAction', () => {
    it('should add new environment and output result', () => {
      const mockAddNewConfigVariable = vi.fn();
      const mockGetCurrentConfigVariable = vi.fn().mockReturnValue('new-env');
      const mockConfigWriter = vi.fn();
      const mockGetEnviromentsConfigToWriting = vi.fn().mockReturnValue({ environments: ['default', 'new-env'] });

      handleConfigAddAction(
        'new-env',
        mockAddNewConfigVariable,
        mockGetCurrentConfigVariable,
        mockConfigWriter,
        mockGetEnviromentsConfigToWriting
      );

      expect(mockAddNewConfigVariable).toHaveBeenCalledWith('new-env');
      expect(mockGetCurrentConfigVariable).toHaveBeenCalled();
      expect(mockConfigWriter).toHaveBeenCalledWith({ current: 'new-env' });
      expect(mockConfigWriter).toHaveBeenCalledWith({ environments: ['default', 'new-env'] });
      expect(mockGetEnviromentsConfigToWriting).toHaveBeenCalled();
    });

    it('should throw error when key is not provided', () => {
      const mockAddNewConfigVariable = vi.fn();
      const mockGetCurrentConfigVariable = vi.fn();
      const mockConfigWriter = vi.fn();
      const mockGetEnviromentsConfigToWriting = vi.fn();

      expect(() => handleConfigAddAction(
        '',
        mockAddNewConfigVariable,
        mockGetCurrentConfigVariable,
        mockConfigWriter,
        mockGetEnviromentsConfigToWriting
      )).toThrow(ProgramError);

      expect(() => handleConfigAddAction(
        '',
        mockAddNewConfigVariable,
        mockGetCurrentConfigVariable,
        mockConfigWriter,
        mockGetEnviromentsConfigToWriting
      )).toThrow("Config command 'add' action requires a value(key)");

      expect(mockAddNewConfigVariable).not.toHaveBeenCalled();
    });

    it('should throw error when key is null', () => {
      const mockAddNewConfigVariable = vi.fn();
      const mockGetCurrentConfigVariable = vi.fn();
      const mockConfigWriter = vi.fn();
      const mockGetEnviromentsConfigToWriting = vi.fn();

      expect(() => handleConfigAddAction(
        null as any,
        mockAddNewConfigVariable,
        mockGetCurrentConfigVariable,
        mockConfigWriter,
        mockGetEnviromentsConfigToWriting
      )).toThrow(ProgramError);
    });

    it('should throw error when key is undefined', () => {
      const mockAddNewConfigVariable = vi.fn();
      const mockGetCurrentConfigVariable = vi.fn();
      const mockConfigWriter = vi.fn();
      const mockGetEnviromentsConfigToWriting = vi.fn();

      expect(() => handleConfigAddAction(
        undefined as any,
        mockAddNewConfigVariable,
        mockGetCurrentConfigVariable,
        mockConfigWriter,
        mockGetEnviromentsConfigToWriting
      )).toThrow(ProgramError);
    });

    it('should handle special characters in environment name', () => {
      const mockAddNewConfigVariable = vi.fn();
      const mockGetCurrentConfigVariable = vi.fn().mockReturnValue('test-env_2024');
      const mockConfigWriter = vi.fn();
      const mockGetEnviromentsConfigToWriting = vi.fn().mockReturnValue({ environments: ['test-env_2024'] });

      handleConfigAddAction(
        'test-env_2024',
        mockAddNewConfigVariable,
        mockGetCurrentConfigVariable,
        mockConfigWriter,
        mockGetEnviromentsConfigToWriting
      );

      expect(mockAddNewConfigVariable).toHaveBeenCalledWith('test-env_2024');
      expect(mockConfigWriter).toHaveBeenCalledWith({ current: 'test-env_2024' });
    });

    it('should handle adding first environment', () => {
      const mockAddNewConfigVariable = vi.fn();
      const mockGetCurrentConfigVariable = vi.fn().mockReturnValue('first-env');
      const mockConfigWriter = vi.fn();
      const mockGetEnviromentsConfigToWriting = vi.fn().mockReturnValue({ environments: ['first-env'] });

      handleConfigAddAction(
        'first-env',
        mockAddNewConfigVariable,
        mockGetCurrentConfigVariable,
        mockConfigWriter,
        mockGetEnviromentsConfigToWriting
      );

      expect(mockAddNewConfigVariable).toHaveBeenCalledWith('first-env');
      expect(mockConfigWriter).toHaveBeenCalledWith({ current: 'first-env' });
      expect(mockConfigWriter).toHaveBeenCalledWith({ environments: ['first-env'] });
    });
  });

  describe('handleConfigResetAction', () => {
    it('should reset all configs and output current state', () => {
      const mockClearConfigs = vi.fn();
      const mockGetCurrentConfigVariable = vi.fn().mockReturnValue('default');
      const mockConfigWriter = vi.fn();
      const mockGetEnviromentsConfigToWriting = vi.fn().mockReturnValue({ environments: ['default'] });

      handleConfigResetAction(
        mockClearConfigs,
        mockGetCurrentConfigVariable,
        mockConfigWriter,
        mockGetEnviromentsConfigToWriting
      );

      expect(mockClearConfigs).toHaveBeenCalled();
      expect(mockGetCurrentConfigVariable).toHaveBeenCalled();
      expect(mockConfigWriter).toHaveBeenCalledWith({ current: 'default' });
      expect(mockConfigWriter).toHaveBeenCalledWith({ environments: ['default'] });
      expect(mockGetEnviromentsConfigToWriting).toHaveBeenCalled();
    });

    it('should handle reset with empty state', () => {
      const mockClearConfigs = vi.fn();
      const mockGetCurrentConfigVariable = vi.fn().mockReturnValue(null);
      const mockConfigWriter = vi.fn();
      const mockGetEnviromentsConfigToWriting = vi.fn().mockReturnValue({ environments: [] });

      handleConfigResetAction(
        mockClearConfigs,
        mockGetCurrentConfigVariable,
        mockConfigWriter,
        mockGetEnviromentsConfigToWriting
      );

      expect(mockClearConfigs).toHaveBeenCalled();
      expect(mockConfigWriter).toHaveBeenCalledWith({ current: null });
      expect(mockConfigWriter).toHaveBeenCalledWith({ environments: [] });
    });

    it('should handle reset with undefined current', () => {
      const mockClearConfigs = vi.fn();
      const mockGetCurrentConfigVariable = vi.fn().mockReturnValue(undefined);
      const mockConfigWriter = vi.fn();
      const mockGetEnviromentsConfigToWriting = vi.fn().mockReturnValue({});

      handleConfigResetAction(
        mockClearConfigs,
        mockGetCurrentConfigVariable,
        mockConfigWriter,
        mockGetEnviromentsConfigToWriting
      );

      expect(mockClearConfigs).toHaveBeenCalled();
      expect(mockConfigWriter).toHaveBeenCalledWith({ current: undefined });
      expect(mockConfigWriter).toHaveBeenCalledWith({});
    });
  });

  describe('handleConfigTrustAction', () => {
    it('should call trustAppcircleCertificate function', () => {
      const mockTrustAppcircleCertificate = vi.fn();

      handleConfigTrustAction(mockTrustAppcircleCertificate);

      expect(mockTrustAppcircleCertificate).toHaveBeenCalled();
    });

    it('should handle trust action with no side effects', () => {
      const mockTrustAppcircleCertificate = vi.fn();

      // Should not throw any errors
      expect(() => handleConfigTrustAction(mockTrustAppcircleCertificate)).not.toThrow();

      expect(mockTrustAppcircleCertificate).toHaveBeenCalledTimes(1);
    });

    it('should handle trust action multiple calls', () => {
      const mockTrustAppcircleCertificate = vi.fn();

      handleConfigTrustAction(mockTrustAppcircleCertificate);
      handleConfigTrustAction(mockTrustAppcircleCertificate);
      handleConfigTrustAction(mockTrustAppcircleCertificate);

      expect(mockTrustAppcircleCertificate).toHaveBeenCalledTimes(3);
    });
  });
});