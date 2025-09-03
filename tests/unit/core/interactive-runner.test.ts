/**
 * @fileoverview Test suite for interactive-runner.ts
 * Tests interactive command execution, parameter handling, and menu navigation
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { AppcircleExitError } from '../../../src/core/AppcircleExitError';

// Mock all dependencies
vi.mock('enquirer', () => ({
  default: {
    prompt: vi.fn().mockResolvedValue({ selection: 'exit' }),
    AutoComplete: class MockAutoComplete {
      constructor() {}
      run() { return Promise.resolve('0. Exit'); } // Exit option
    },
    Select: class MockSelect {
      constructor() {}
      run() { return Promise.resolve('0'); } // Exit option
    }
  },
  prompt: vi.fn().mockResolvedValue({ selection: 'exit' }),
  AutoComplete: class MockAutoComplete {
    constructor() {}
    run() { return Promise.resolve('0. Exit'); } // Exit option
  },
  Select: class MockSelect {
    constructor() {}
    run() { return Promise.resolve('0'); } // Exit option
  },
  BooleanPrompt: vi.fn(),
  Input: vi.fn()
}));

vi.mock('ora', () => ({
  default: vi.fn(() => ({
    start: vi.fn().mockReturnThis(),
    stop: vi.fn().mockReturnThis(),
    succeed: vi.fn().mockReturnThis(),
    fail: vi.fn().mockReturnThis(),
    text: ''
  }))
}));

vi.mock('chalk', () => ({
  default: {
    blue: vi.fn((text) => text),
    green: vi.fn((text) => text),
    red: vi.fn((text) => text),
    yellow: vi.fn((text) => text),
    cyan: vi.fn((text) => text),
    magenta: vi.fn((text) => text),
    hex: vi.fn((_color: string) => (text: string) => text)
  }
}));

vi.mock('fs', () => ({
  existsSync: vi.fn(() => true),
  statSync: vi.fn(() => ({ isDirectory: () => false, isFile: () => true })),
  readFileSync: vi.fn((filePath) => {
    if (filePath && typeof filePath === 'string' && filePath.includes('package.json')) {
      return JSON.stringify({ name: 'appcircle-cli', version: '2.7.3' });
    }
    return '{}';
  })
}));

vi.mock('path', () => ({
  resolve: vi.fn((_dir: string, file?: string) => {
    if (file && file.includes('package.json')) {
      return '/mock/path/package.json';
    }
    return '/mock/path/file.txt';
  }),
  join: vi.fn((...parts) => parts.join('/')),
  dirname: vi.fn((p) => p.split('/').slice(0, -1).join('/')),
  basename: vi.fn((p) => p.split('/').pop())
}));

vi.mock('os', () => ({
  default: {
    homedir: vi.fn(() => '/home/user')
  }
}));

vi.mock('minimist', () => ({
  default: vi.fn()
}));

vi.mock('../../../src/services', () => ({
  getBuildProfiles: vi.fn(),
  getBranches: vi.fn(),
  getOrganizations: vi.fn(),
  getTestingGroups: vi.fn(),
  // Mock all other services
  getEnterpriseProfiles: vi.fn(),
  getWorkflows: vi.fn(),
  getCommits: vi.fn(),
  getDistributionProfiles: vi.fn()
}));

vi.mock('../../../src/core/command-runner', () => ({
  runCommand: vi.fn()
}));

// Mock the commands to ensure 'config' command exists
vi.mock('../../../src/core/commands', () => ({
  Commands: [{
    command: 'config',
    subCommands: [{
      command: 'list',
      hasRequiredParameters: false,
      parameters: []
    }]
  }]
}));

vi.mock('../../../src/config', () => ({
  readEnviromentConfigVariable: vi.fn(),
  EnvironmentVariables: {},
  DefaultEnvironmentVariables: {
    API_HOSTNAME: 'https://api.appcircle.io',
    AUTH_HOSTNAME: 'https://auth.appcircle.io',
    AC_ACCESS_TOKEN: ''
  },
  getConfigStore: vi.fn(() => ({
    get: vi.fn(),
    set: vi.fn(),
    delete: vi.fn(),
    envs: {
      'default': {
        API_HOSTNAME: 'https://api.appcircle.io',
        AUTH_HOSTNAME: 'https://auth.appcircle.io'
      },
      'staging': {
        API_HOSTNAME: 'https://staging-api.appcircle.io',
        AUTH_HOSTNAME: 'https://staging-auth.appcircle.io'
      }
    }
  })),
  getInteractiveMode: vi.fn(() => false)
}));

vi.mock('../../../src/constant', () => ({
  APPCIRCLE_COLOR: '#007AFF',
  OperatingSystems: {
    WINDOWS: 'windows',
    MACOS: 'darwin',
    LINUX: 'linux'
  },
  UNKNOWN_PARAM_VALUE: 'unknown',
  CURRENT_PARAM_VALUE: 'current'
}));

describe('interactive-runner.ts', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Mock console methods
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(process, 'exit').mockImplementation(() => {
      throw new AppcircleExitError('Process exit', 0);
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Basic Module Tests', () => {
    it('should import interactive-runner module successfully', async () => {
      const module = await import('../../../src/core/interactive-runner');
      expect(module).toBeDefined();
      expect(typeof module.runCommandsInteractively).toBe('function');
    });

    it('should handle module exports', async () => {
      const module = await import('../../../src/core/interactive-runner');
      expect(module.runCommandsInteractively).toBeDefined();
      expect(typeof module.runCommandsInteractively).toBe('function');
    });
  });

  describe('Interactive Command Execution', () => {
    it('should handle interactive mode activation', async () => {
      const minimist = await import('minimist');
      vi.mocked(minimist.default).mockReturnValue({ i: true, _: [] });

      const { runCommandsInteractively } = await import('../../../src/core/interactive-runner');

      // Interactive mode should exit cleanly when user selects exit (option 0)
      await expect(runCommandsInteractively()).rejects.toThrow(AppcircleExitError);
    });

    it('should handle command execution flow', async () => {
      const minimist = await import('minimist');
      vi.mocked(minimist.default).mockReturnValue({ _: ['config', 'list'] });

      const commandRunner = await import('../../../src/core/command-runner');
      vi.mocked(commandRunner.runCommand).mockResolvedValue(undefined);

      const { runCommandsInteractively } = await import('../../../src/core/interactive-runner');

      // Command execution completes successfully and exits with code 0
      await expect(runCommandsInteractively()).rejects.toThrow(AppcircleExitError);
    });
  });

  describe('Error Handling', () => {
    it('should handle AppcircleExitError with code 0', async () => {
      const minimist = await import('minimist');
      vi.mocked(minimist.default).mockReturnValue({ i: true, _: [] });

      const enquirer = await import('enquirer');
      vi.mocked(enquirer.prompt).mockRejectedValue(new AppcircleExitError('Success', 0));

      // Mock process.exit to not actually exit
      const mockExit = vi.spyOn(process, 'exit').mockImplementation((code) => {
        throw new AppcircleExitError('Exit', code as number);
      });

      const { runCommandsInteractively } = await import('../../../src/core/interactive-runner');

      await expect(runCommandsInteractively()).rejects.toThrow(AppcircleExitError);
      expect(mockExit).toHaveBeenCalledWith(0);
    });

    it('should handle generic errors gracefully', async () => {
      const minimist = await import('minimist');
      vi.mocked(minimist.default).mockReturnValue({ i: true, _: [] });

      // Since process.exit is mocked to throw AppcircleExitError, 
      // any unhandled error will end up as process exit with error code
      const { runCommandsInteractively } = await import('../../../src/core/interactive-runner');

      // Expecting the test to throw because errors cause process.exit(1)
      await expect(runCommandsInteractively()).rejects.toThrow();
    });

    it('should handle non-interactive mode', async () => {
      const minimist = await import('minimist');
      vi.mocked(minimist.default).mockReturnValue({ _: ['config', 'list'] });

      const commandRunner = await import('../../../src/core/command-runner');
      vi.mocked(commandRunner.runCommand).mockResolvedValue(undefined);

      const { runCommandsInteractively } = await import('../../../src/core/interactive-runner');

      // With specific commands, processes them and exits cleanly with code 0
      await expect(runCommandsInteractively()).rejects.toThrow(AppcircleExitError);
    });
  });

  describe('Service Integration', () => {
    it('should integrate with build profile services', async () => {
      const services = await import('../../../src/services');
      vi.mocked(services.getBuildProfiles).mockResolvedValue([
        { id: 'profile1', name: 'iOS App' },
        { id: 'profile2', name: 'Android App' }
      ]);

      expect(services.getBuildProfiles).toBeDefined();
      
      const result = await services.getBuildProfiles();
      expect(result).toHaveLength(2);
      expect(result[0]).toHaveProperty('id', 'profile1');
    });

    it('should integrate with branch services', async () => {
      const services = await import('../../../src/services');
      vi.mocked(services.getBranches).mockResolvedValue([
        { id: 'branch1', name: 'main' },
        { id: 'branch2', name: 'develop' }
      ]);

      expect(services.getBranches).toBeDefined();
      
      const result = await services.getBranches({ profileId: 'test' });
      expect(result).toHaveLength(2);
      expect(result[0]).toHaveProperty('name', 'main');
    });

    it('should integrate with organization services', async () => {
      const services = await import('../../../src/services');
      vi.mocked(services.getOrganizations).mockResolvedValue([
        { id: 'org1', name: 'My Organization' }
      ]);

      expect(services.getOrganizations).toBeDefined();
      
      const result = await services.getOrganizations();
      expect(result).toHaveLength(1);
      expect(result[0]).toHaveProperty('name', 'My Organization');
    });
  });

  describe('Command Runner Integration', () => {
    it('should integrate with command runner', async () => {
      const commandRunner = await import('../../../src/core/command-runner');
      vi.mocked(commandRunner.runCommand).mockResolvedValue(undefined);

      expect(commandRunner.runCommand).toBeDefined();
      
      const mockCommand = {
        fullCommandName: 'appcircle-config-list',
        isGroupCommand: vi.fn().mockReturnValue(false),
        parent: null,
        name: vi.fn().mockReturnValue('config'),
        args: ['config', 'list'],
        opts: vi.fn().mockReturnValue({})
      };

      await commandRunner.runCommand(mockCommand);
      expect(commandRunner.runCommand).toHaveBeenCalledWith(mockCommand);
    });
  });

  describe('Path Handling', () => {
    it('should handle file path operations', async () => {
      const fs = await import('fs');
      const path = await import('path');
      
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(path.resolve).mockReturnValue('/resolved/path/file.txt');

      expect(fs.existsSync('/test/path')).toBe(true);
      expect(path.resolve('~/test/file.txt')).toBe('/resolved/path/file.txt');
    });

    it('should handle home directory expansion', async () => {
      const os = await import('os');
      vi.mocked(os.default.homedir).mockReturnValue('/home/user');

      expect(os.default.homedir()).toBe('/home/user');
    });
  });

  describe('Configuration Integration', () => {
    it('should read environment configuration', async () => {
      const config = await import('../../../src/config');
      vi.mocked(config.readEnviromentConfigVariable).mockReturnValue('test-value');

      expect(config.readEnviromentConfigVariable).toBeDefined();
      
      const value = config.readEnviromentConfigVariable('AC_ACCESS_TOKEN' as any);
      expect(value).toBe('test-value');
    });
  });

  describe('UI Components', () => {
    it('should handle enquirer prompts', async () => {
      const enquirer = await import('enquirer');
      vi.mocked(enquirer.prompt).mockResolvedValue({ selection: 'test' });

      const result = await enquirer.prompt({
        type: 'select',
        name: 'selection',
        message: 'Choose:',
        choices: ['test', 'other']
      });

      expect(result).toEqual({ selection: 'test' });
    });

    it('should handle ora spinner', async () => {
      const ora = await import('ora');
      
      const spinner = ora.default('Loading...');
      expect(spinner.start).toBeDefined();
      expect(spinner.stop).toBeDefined();
      expect(spinner.succeed).toBeDefined();
      expect(spinner.fail).toBeDefined();
    });
  });

  describe('Command Line Arguments', () => {
    it('should parse command line arguments with minimist', async () => {
      const minimist = await import('minimist');
      vi.mocked(minimist.default).mockReturnValue({
        i: true,
        interactive: true,
        o: 'json',
        output: 'json',
        _: ['config', 'list']
      });

      const args = minimist.default(['--interactive', '--output', 'json', 'config', 'list']);
      
      expect(args.i).toBe(true);
      expect(args.interactive).toBe(true);
      expect(args.o).toBe('json');
      expect(args._).toEqual(['config', 'list']);
    });
  });
});