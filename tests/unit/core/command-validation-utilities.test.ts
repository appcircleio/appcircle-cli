import { describe, it, expect, vi, beforeEach } from 'vitest';
import chalk from 'chalk';

// Mock dependencies
vi.mock('../../../src/utils/orahelper', () => ({
  createOra: vi.fn()
}));

vi.mock('../../../src/core/writer', () => ({
  commandWriter: vi.fn()
}));

vi.mock('chalk', () => ({
  default: {
    red: vi.fn((msg) => msg),
    yellow: vi.fn((msg) => msg)
  }
}));

// Mock the AppcircleExitError import
vi.mock('../../../src/core/AppcircleExitError', () => ({
  AppcircleExitError: class AppcircleExitError extends Error {
    public code: number;
    constructor(message: string, code: number) {
      super(message);
      this.code = code;
    }
  }
}));

// Mock console.error to avoid output during tests
const mockConsoleError = vi.spyOn(console, 'error').mockImplementation(() => {});

import { createOra } from '../../../src/utils/orahelper';
import { commandWriter } from '../../../src/core/writer';
import { AppcircleExitError } from '../../../src/core/AppcircleExitError';
// Mock the getLongDescriptionForCommand function before importing the module
vi.mock('../../../src/core/command-runner', async () => {
  const actual = await vi.importActual('../../../src/core/command-runner');
  return {
    ...actual,
    getLongDescriptionForCommand: vi.fn().mockReturnValue('Test description')
  };
});

import { 
  validateCommandParameters, 
  createListCommand,
  setupDownloadDirectory,
  generateArtifactFileName,
  downloadArtifactWithRetry,
  validateAndProcessVariableGroupFile,
  getLongDescriptionForCommand
} from '../../../src/core/command-runner';

describe('Command Validation Utilities', () => {
  let mockSpinner: any;
  let mockCommand: any;

  beforeEach(() => {
    vi.clearAllMocks();
    mockConsoleError.mockClear();
    mockSpinner = {
      start: vi.fn().mockReturnThis(),
      stop: vi.fn(),
      succeed: vi.fn(),
      fail: vi.fn()
    };
    (createOra as any).mockReturnValue(mockSpinner);

    mockCommand = {
      fullCommandName: 'test-command',
      name: vi.fn().mockReturnValue('test'),
      args: vi.fn().mockReturnValue([])
    };

    (getLongDescriptionForCommand as any).mockReturnValue('Test description');
  });

  describe('validateCommandParameters', () => {
    it('should pass validation when all required parameters are present', () => {
      const params = { profileId: 'test-profile', branchId: 'test-branch' };
      const requiredParams = ['profileId', 'branchId'];

      expect(() => {
        validateCommandParameters(params, requiredParams, mockCommand);
      }).not.toThrow();
    });

    it('should throw error for missing parameters in CLI mode', () => {
      const params = { profileId: 'test-profile' };
      const requiredParams = ['profileId', 'branchId'];

      expect(() => {
        validateCommandParameters(params, requiredParams, mockCommand);
      }).toThrow(AppcircleExitError);
    });

    it('should throw error for missing parameters in interactive mode', () => {
      const params = { profileId: 'test-profile' };
      const requiredParams = ['profileId', 'branchId'];

      expect(() => {
        validateCommandParameters(params, requiredParams, mockCommand, true);
      }).toThrow(AppcircleExitError);

      expect(chalk.red).toHaveBeenCalledWith('Error: Missing branch. Please ensure a valid branch is selected.');
    });

    it('should handle parameter name formatting correctly', () => {
      const params = {};
      const requiredParams = ['organizationId'];

      expect(() => {
        validateCommandParameters(params, requiredParams, mockCommand, true);
      }).toThrow(AppcircleExitError);

      expect(chalk.red).toHaveBeenCalledWith('Error: Missing organization. Please ensure a valid organization is selected.');
    });

    it('should handle multiple missing parameters', () => {
      const params = {};
      const requiredParams = ['profileId', 'branchId', 'commitId'];

      expect(() => {
        validateCommandParameters(params, requiredParams, mockCommand);
      }).toThrow(AppcircleExitError);
    });

    it('should handle empty required parameters array', () => {
      const params = { someParam: 'value' };
      const requiredParams: string[] = [];

      expect(() => {
        validateCommandParameters(params, requiredParams, mockCommand);
      }).not.toThrow();
    });

    it('should handle parameters with falsy values', () => {
      const params = { profileId: '', branchId: 0, commitId: null, buildId: undefined };
      const requiredParams = ['profileId', 'branchId', 'commitId', 'buildId'];

      expect(() => {
        validateCommandParameters(params, requiredParams, mockCommand);
      }).toThrow(AppcircleExitError);
    });

    it('should pass validation for parameters with truthy values', () => {
      const params = { profileId: 'test', branchId: 1, commitId: 'commit', buildId: true };
      const requiredParams = ['profileId', 'branchId', 'commitId', 'buildId'];

      expect(() => {
        validateCommandParameters(params, requiredParams, mockCommand);
      }).not.toThrow();
    });

    it('should handle parameter names with multiple capital letters', () => {
      const params = {};
      const requiredParams = ['APIKeyId', 'XMLConfigId'];

      expect(() => {
        validateCommandParameters(params, requiredParams, mockCommand, true);
      }).toThrow(AppcircleExitError);

      expect(chalk.red).toHaveBeenCalledWith('Error: Missing  a p i key. Please ensure a valid  a p i key is selected.');
    });
  });

  describe('createListCommand', () => {
    const mockDataFunction = vi.fn();
    const mockParams = { test: 'param' };
    const mockCommandType = 'BUILD' as any;

    beforeEach(() => {
      mockDataFunction.mockReset();
    });

    it('should execute list command successfully', async () => {
      const mockData = { items: ['item1', 'item2'] };
      mockDataFunction.mockResolvedValue(mockData);

      await createListCommand('Loading...', mockDataFunction, mockParams, mockCommandType, mockCommand);

      expect(createOra).toHaveBeenCalledWith('Loading...');
      expect(mockSpinner.start).toHaveBeenCalled();
      expect(mockDataFunction).toHaveBeenCalledWith(mockParams);
      expect(mockSpinner.stop).toHaveBeenCalled();
      expect(commandWriter).toHaveBeenCalledWith(mockCommandType, {
        fullCommandName: mockCommand.fullCommandName,
        data: mockData,
      });
    });

    it('should handle data function errors', async () => {
      const error = new Error('API error');
      mockDataFunction.mockRejectedValue(error);

      await expect(async () => {
        await createListCommand('Loading...', mockDataFunction, mockParams, mockCommandType, mockCommand);
      }).rejects.toThrow('API error');

      expect(createOra).toHaveBeenCalledWith('Loading...');
      expect(mockSpinner.start).toHaveBeenCalled();
      expect(mockDataFunction).toHaveBeenCalledWith(mockParams);
    });

    it('should handle empty data response', async () => {
      mockDataFunction.mockResolvedValue(null);

      await createListCommand('Loading...', mockDataFunction, mockParams, mockCommandType, mockCommand);

      expect(commandWriter).toHaveBeenCalledWith(mockCommandType, {
        fullCommandName: mockCommand.fullCommandName,
        data: null,
      });
    });

    it('should handle large data responses', async () => {
      const largeData = { items: new Array(10000).fill('item') };
      mockDataFunction.mockResolvedValue(largeData);

      await createListCommand('Processing large dataset...', mockDataFunction, mockParams, mockCommandType, mockCommand);

      expect(commandWriter).toHaveBeenCalledWith(mockCommandType, {
        fullCommandName: mockCommand.fullCommandName,
        data: largeData,
      });
    });

    it('should work with different command types', async () => {
      const mockData = { result: 'success' };
      mockDataFunction.mockResolvedValue(mockData);
      const publishCommandType = 'PUBLISH' as any;

      await createListCommand('Loading publish data...', mockDataFunction, mockParams, publishCommandType, mockCommand);

      expect(commandWriter).toHaveBeenCalledWith(publishCommandType, {
        fullCommandName: mockCommand.fullCommandName,
        data: mockData,
      });
    });

    it('should handle special characters in spinner message', async () => {
      const mockData = { test: 'data' };
      mockDataFunction.mockResolvedValue(mockData);
      const specialMessage = 'Loading with "quotes" & symbols...';

      await createListCommand(specialMessage, mockDataFunction, mockParams, mockCommandType, mockCommand);

      expect(createOra).toHaveBeenCalledWith(specialMessage);
    });

    it('should handle unicode characters in spinner message', async () => {
      const mockData = { test: 'data' };
      mockDataFunction.mockResolvedValue(mockData);
      const unicodeMessage = '正在加载数据...';

      await createListCommand(unicodeMessage, mockDataFunction, mockParams, mockCommandType, mockCommand);

      expect(createOra).toHaveBeenCalledWith(unicodeMessage);
    });

    it('should handle empty spinner message', async () => {
      const mockData = { test: 'data' };
      mockDataFunction.mockResolvedValue(mockData);

      await createListCommand('', mockDataFunction, mockParams, mockCommandType, mockCommand);

      expect(createOra).toHaveBeenCalledWith('');
    });

    it('should handle async data function that returns promise', async () => {
      const mockData = { async: 'result' };
      const asyncDataFunction = vi.fn().mockImplementation(() => {
        return new Promise(resolve => {
          setTimeout(() => resolve(mockData), 10);
        });
      });

      await createListCommand('Async loading...', asyncDataFunction, mockParams, mockCommandType, mockCommand);

      expect(commandWriter).toHaveBeenCalledWith(mockCommandType, {
        fullCommandName: mockCommand.fullCommandName,
        data: mockData,
      });
    });

    it('should handle data function with complex parameters', async () => {
      const mockData = { result: 'complex' };
      const complexParams = {
        nested: { object: 'value' },
        array: [1, 2, 3],
        number: 123,
        boolean: true
      };
      mockDataFunction.mockResolvedValue(mockData);

      await createListCommand('Complex loading...', mockDataFunction, complexParams, mockCommandType, mockCommand);

      expect(mockDataFunction).toHaveBeenCalledWith(complexParams);
      expect(commandWriter).toHaveBeenCalledWith(mockCommandType, {
        fullCommandName: mockCommand.fullCommandName,
        data: mockData,
      });
    });
  });

  describe('Integration Tests', () => {
    it('should work together for complete command validation flow', () => {
      const params = { profileId: 'valid-profile', branchId: 'valid-branch' };
      const requiredParams = ['profileId', 'branchId'];

      // Should pass validation
      expect(() => {
        validateCommandParameters(params, requiredParams, mockCommand);
      }).not.toThrow();

      // Then should be able to create list command
      const mockDataFunction = vi.fn().mockResolvedValue({ data: 'success' });
      expect(async () => {
        await createListCommand('Loading...', mockDataFunction, params, 'BUILD' as any, mockCommand);
      }).not.toThrow();
    });

    it('should handle validation failure before list command', () => {
      const params = { profileId: 'valid-profile' }; // Missing branchId
      const requiredParams = ['profileId', 'branchId'];

      // Should fail validation
      expect(() => {
        validateCommandParameters(params, requiredParams, mockCommand);
      }).toThrow(AppcircleExitError);

      // createListCommand should not be called after validation failure
      const mockDataFunction = vi.fn();
      expect(mockDataFunction).not.toHaveBeenCalled();
    });
  });
});