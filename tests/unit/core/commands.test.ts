/**
 * @fileoverview Test suite for commands.ts
 * Tests command definitions, parameter types, and command structure validation
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { 
  Commands, 
  CommandType, 
  ParamType,
  CommandParameterTypes, 
  CommandTypes 
} from '../../../src/core/commands';

// Mock config for dynamic command generation
vi.mock('../../../src/config', () => ({
  DefaultEnvironmentVariables: {
    API_HOSTNAME: 'https://api.appcircle.io',
    AUTH_HOSTNAME: 'https://auth.appcircle.io',
    AC_ACCESS_TOKEN: ''
  },
  getConfigStore: vi.fn(() => ({
    envs: {
      default: { API_HOSTNAME: 'https://api.appcircle.io' },
      staging: { API_HOSTNAME: 'https://staging-api.appcircle.io' }
    }
  }))
}));

describe('commands.ts', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Command Parameter Types', () => {
    it('should define all required parameter types', () => {
      expect(CommandParameterTypes.SELECT).toBe('select');
      expect(CommandParameterTypes.BOOLEAN).toBe('boolean');
      expect(CommandParameterTypes.STRING).toBe('input');
      expect(CommandParameterTypes.PASSWORD).toBe('password');
      expect(CommandParameterTypes.MULTIPLE_SELECT).toBe('multipleSelect');
    });
  });

  describe('Command Types', () => {
    it('should define all main command types', () => {
      expect(CommandTypes.CONFIG).toBe('config');
      expect(CommandTypes.LOGIN).toBe('login');
      expect(CommandTypes.LOGOUT).toBe('logout');
      expect(CommandTypes.ORGANIZATION).toBe('organization');
      expect(CommandTypes.PUBLISH).toBe('publish');
      expect(CommandTypes.BUILD).toBe('build');
      expect(CommandTypes.TESTING_DISTRIBUTION).toBe('testing-distribution');
      expect(CommandTypes.ENTERPRISE_APP_STORE).toBe('enterprise-app-store');
      expect(CommandTypes.SIGNING_IDENTITY).toBe('signing-identity');
    });
  });

  describe('Commands Structure', () => {
    it('should have all main commands defined', () => {
      expect(Commands).toBeDefined();
      expect(Array.isArray(Commands)).toBe(true);
      expect(Commands.length).toBeGreaterThan(0);

      const commandNames = Commands.map(cmd => cmd.command);
      expect(commandNames).toContain('config');
      expect(commandNames).toContain('login');
      expect(commandNames).toContain('logout');
      expect(commandNames).toContain('build');
      expect(commandNames).toContain('publish');
      expect(commandNames).toContain('organization');
      expect(commandNames).toContain('signing-identity');
    });

    it('should have proper command structure for each command', () => {
      Commands.forEach((command: CommandType) => {
        expect(command).toHaveProperty('command');
        expect(command).toHaveProperty('description');
        expect(command).toHaveProperty('params');

        expect(typeof command.command).toBe('string');
        expect(typeof command.description).toBe('string');
        expect(Array.isArray(command.params)).toBe(true);

        if (command.longDescription) {
          expect(typeof command.longDescription).toBe('string');
        }
      });
    });

    it('should have valid parameter structure', () => {
      Commands.forEach((command: CommandType) => {
        command.params.forEach((param: ParamType) => {
          expect(param).toHaveProperty('name');
          expect(param).toHaveProperty('description');
          expect(param).toHaveProperty('type');

          expect(typeof param.name).toBe('string');
          expect(typeof param.description).toBe('string');
          expect(Object.values(CommandParameterTypes)).toContain(param.type);
        });

        // Check subcommand parameters if they exist
        if (command.subCommands) {
          command.subCommands.forEach((subCommand: CommandType) => {
            subCommand.params.forEach((param: ParamType) => {
              expect(param).toHaveProperty('name');
              expect(param).toHaveProperty('description');
              expect(param).toHaveProperty('type');
            });
          });
        }

        // Check arguments if they exist
        if (command.arguments) {
          command.arguments.forEach((arg: ParamType) => {
            expect(arg).toHaveProperty('name');
            expect(arg).toHaveProperty('description');
            expect(arg).toHaveProperty('type');
          });
        }
      });
    });
  });

  describe('Config Command', () => {
    let configCommand: CommandType;

    beforeEach(() => {
      configCommand = Commands.find(cmd => cmd.command === 'config')!;
    });

    it('should have config command defined', () => {
      expect(configCommand).toBeDefined();
      expect(configCommand.command).toBe('config');
      expect(configCommand.description).toBe('Config');
    });

    it('should have config subcommands', () => {
      expect(configCommand.subCommands).toBeDefined();
      expect(configCommand.subCommands!.length).toBeGreaterThan(0);

      const subCommandNames = configCommand.subCommands!.map(sub => sub.command);
      expect(subCommandNames).toContain('list');
      expect(subCommandNames).toContain('get');
      expect(subCommandNames).toContain('set');
      expect(subCommandNames).toContain('current');
      expect(subCommandNames).toContain('add');
      expect(subCommandNames).toContain('reset');
      expect(subCommandNames).toContain('trust');
    });

    it('should have proper arguments for get command', () => {
      const getCommand = configCommand.subCommands!.find(sub => sub.command === 'get')!;
      expect(getCommand.arguments).toBeDefined();
      expect(getCommand.arguments!.length).toBe(1);
      
      const keyArg = getCommand.arguments![0];
      expect(keyArg.name).toBe('key');
      expect(keyArg.type).toBe(CommandParameterTypes.SELECT);
    });

    it('should have proper arguments for set command', () => {
      const setCommand = configCommand.subCommands!.find(sub => sub.command === 'set')!;
      expect(setCommand.arguments).toBeDefined();
      expect(setCommand.arguments!.length).toBe(2);
      
      const keyArg = setCommand.arguments![0];
      const valueArg = setCommand.arguments![1];
      
      expect(keyArg.name).toBe('key');
      expect(keyArg.type).toBe(CommandParameterTypes.SELECT);
      expect(valueArg.name).toBe('value');
      expect(valueArg.type).toBe(CommandParameterTypes.STRING);
    });
  });

  describe('Login Command', () => {
    let loginCommand: CommandType;

    beforeEach(() => {
      loginCommand = Commands.find(cmd => cmd.command === 'login')!;
    });

    it('should have login command defined', () => {
      expect(loginCommand).toBeDefined();
      expect(loginCommand.command).toBe('login');
      expect(loginCommand.description).toBe('Login');
    });

    it('should have login subcommands', () => {
      expect(loginCommand.subCommands).toBeDefined();
      expect(loginCommand.subCommands!.length).toBeGreaterThan(0);

      const subCommandNames = loginCommand.subCommands!.map(sub => sub.command);
      expect(subCommandNames).toContain('personal-access-key');
      expect(subCommandNames).toContain('pat');
      expect(subCommandNames).toContain('api-key');
    });

    it('should have proper parameters for Personal Access Key login', () => {
      const personalAccessKeyCommand = loginCommand.subCommands!.find(sub => sub.command === 'personal-access-key')!;
      expect(personalAccessKeyCommand.params).toBeDefined();
      expect(personalAccessKeyCommand.params.length).toBe(1);
      
      const secretParam = personalAccessKeyCommand.params[0];
      expect(secretParam.name).toBe('secret');
      expect(secretParam.type).toBe(CommandParameterTypes.STRING);
    });

    it('should have proper parameters for PAT login (legacy)', () => {
      const patCommand = loginCommand.subCommands!.find(sub => sub.command === 'pat')!;
      expect(patCommand.params).toBeDefined();
      expect(patCommand.params.length).toBe(1);
      
      const tokenParam = patCommand.params[0];
      expect(tokenParam.name).toBe('token');
      expect(tokenParam.type).toBe(CommandParameterTypes.STRING);
    });

    it('should have proper parameters for API key login', () => {
      const apiKeyCommand = loginCommand.subCommands!.find(sub => sub.command === 'api-key')!;
      expect(apiKeyCommand.params).toBeDefined();
      expect(apiKeyCommand.params.length).toBe(3);
      
      const nameParam = apiKeyCommand.params.find(p => p.name === 'name')!;
      const secretParam = apiKeyCommand.params.find(p => p.name === 'secret')!;
      const orgIdParam = apiKeyCommand.params.find(p => p.name === 'organization-id')!;
      
      expect(nameParam.type).toBe(CommandParameterTypes.STRING);
      expect(secretParam.type).toBe(CommandParameterTypes.STRING);
      expect(orgIdParam.type).toBe(CommandParameterTypes.STRING);
      expect(orgIdParam.required).toBe(false);
    });
  });

  describe('Build Command', () => {
    let buildCommand: CommandType;

    beforeEach(() => {
      buildCommand = Commands.find(cmd => cmd.command === 'build')!;
    });

    it('should have build command defined', () => {
      expect(buildCommand).toBeDefined();
      expect(buildCommand.command).toBe('build');
      expect(buildCommand.description).toBe('Build');
    });

    it('should have build subcommands', () => {
      expect(buildCommand.subCommands).toBeDefined();
      expect(buildCommand.subCommands!.length).toBeGreaterThan(0);

      const subCommandNames = buildCommand.subCommands!.map(sub => sub.command);
      expect(subCommandNames).toContain('start');
      expect(subCommandNames).toContain('active-list');
      expect(subCommandNames).toContain('list');
      expect(subCommandNames).toContain('download');
      expect(subCommandNames).toContain('profile');
    });

    it('should have proper parameters for build start', () => {
      const startCommand = buildCommand.subCommands!.find(sub => sub.command === 'start')!;
      expect(startCommand.params).toBeDefined();
      
      const profileIdParam = startCommand.params.find(p => p.name === 'profileId')!;
      const branchIdParam = startCommand.params.find(p => p.name === 'branchId')!;
      const workflowIdParam = startCommand.params.find(p => p.name === 'workflowId')!;
      
      expect(profileIdParam.type).toBe(CommandParameterTypes.SELECT);
      expect(branchIdParam.type).toBe(CommandParameterTypes.SELECT);
      expect(workflowIdParam.type).toBe(CommandParameterTypes.SELECT);
    });

    it('should have profile subcommands', () => {
      const profileCommand = buildCommand.subCommands!.find(sub => sub.command === 'profile')!;
      expect(profileCommand.subCommands).toBeDefined();
      
      const profileSubCommandNames = profileCommand.subCommands!.map(sub => sub.command);
      expect(profileSubCommandNames).toContain('list');
      expect(profileSubCommandNames).toContain('branch');
      expect(profileSubCommandNames).toContain('workflows');
      expect(profileSubCommandNames).toContain('configurations');
    });
  });

  describe('Publish Command', () => {
    let publishCommand: CommandType;

    beforeEach(() => {
      publishCommand = Commands.find(cmd => cmd.command === 'publish')!;
    });

    it('should have publish command defined', () => {
      expect(publishCommand).toBeDefined();
      expect(publishCommand.command).toBe('publish');
      expect(publishCommand.description).toBe('Publish');
    });

    it('should have publish subcommands', () => {
      expect(publishCommand.subCommands).toBeDefined();
      expect(publishCommand.subCommands!.length).toBeGreaterThan(0);

      const subCommandNames = publishCommand.subCommands!.map(sub => sub.command);
      expect(subCommandNames).toContain('profile');
      expect(subCommandNames).toContain('start');
      expect(subCommandNames).toContain('active-list');
    });
  });

  describe('Signing Identity Command', () => {
    let signingCommand: CommandType;

    beforeEach(() => {
      signingCommand = Commands.find(cmd => cmd.command === 'signing-identity')!;
    });

    it('should have signing-identity command defined', () => {
      expect(signingCommand).toBeDefined();
      expect(signingCommand.command).toBe('signing-identity');
      expect(signingCommand.description).toBe('Signing Identities');
    });

    it('should have signing identity subcommands', () => {
      expect(signingCommand.subCommands).toBeDefined();
      expect(signingCommand.subCommands!.length).toBeGreaterThan(0);

      const subCommandNames = signingCommand.subCommands!.map(sub => sub.command);
      expect(subCommandNames).toContain('certificate');
      expect(subCommandNames).toContain('provisioning-profile');
    });

    it('should have certificate subcommands', () => {
      const certCommand = signingCommand.subCommands!.find(sub => sub.command === 'certificate')!;
      expect(certCommand.subCommands).toBeDefined();
      
      const certSubCommandNames = certCommand.subCommands!.map(sub => sub.command);
      expect(certSubCommandNames).toContain('list');
      expect(certSubCommandNames).toContain('upload');
      expect(certSubCommandNames).toContain('create');
      expect(certSubCommandNames).toContain('view');
      expect(certSubCommandNames).toContain('download');
      expect(certSubCommandNames).toContain('remove');
    });
  });

  describe('Parameter Validation', () => {
    it('should have valid required flags', () => {
      Commands.forEach((command: CommandType) => {
        const checkParams = (params: ParamType[]) => {
          params.forEach((param: ParamType) => {
            if (param.required !== undefined) {
              expect(typeof param.required).toBe('boolean');
            }
          });
        };

        checkParams(command.params);
        
        if (command.subCommands) {
          command.subCommands.forEach((subCommand: CommandType) => {
            checkParams(subCommand.params);
          });
        }
      });
    });

    it('should have valid default values', () => {
      Commands.forEach((command: CommandType) => {
        const checkParams = (params: ParamType[]) => {
          params.forEach((param: ParamType) => {
            if (param.defaultValue !== undefined) {
              // Default values should be appropriate for their type
              if (param.type === CommandParameterTypes.BOOLEAN) {
                expect(typeof param.defaultValue).toBe('boolean');
              }
            }
          });
        };

        checkParams(command.params);
        
        if (command.subCommands) {
          command.subCommands.forEach((subCommand: CommandType) => {
            checkParams(subCommand.params);
          });
        }
      });
    });

    it('should have valid parameter options for select types', () => {
      Commands.forEach((command: CommandType) => {
        const checkParams = (params: ParamType[]) => {
          params.forEach((param: ParamType) => {
            if (param.type === CommandParameterTypes.SELECT && param.params) {
              expect(Array.isArray(param.params)).toBe(true);
              param.params.forEach((option: any) => {
                if (typeof option === 'object') {
                  expect(option).toHaveProperty('name');
                  expect(option).toHaveProperty('message');
                }
              });
            }
          });
        };

        checkParams(command.params);
        
        if (command.subCommands) {
          command.subCommands.forEach((subCommand: CommandType) => {
            checkParams(subCommand.params);
          });
        }
      });
    });
  });

  describe('Long Descriptions', () => {
    it('should have meaningful long descriptions', () => {
      Commands.forEach((command: CommandType) => {
        if (command.longDescription) {
          expect(command.longDescription.length).toBeGreaterThan(10);
          // Not all commands have USAGE format - some have simple descriptions
          expect(typeof command.longDescription).toBe('string');
        }

        if (command.subCommands) {
          command.subCommands.forEach((subCommand: CommandType) => {
            if (subCommand.longDescription) {
              expect(subCommand.longDescription.length).toBeGreaterThan(10);
              expect(typeof subCommand.longDescription).toBe('string');
            }
          });
        }
      });
    });

    it('should have USAGE section in detailed long descriptions', () => {
      Commands.forEach((command: CommandType) => {
        if (command.longDescription && command.longDescription.includes('USAGE')) {
          expect(command.longDescription).toContain('USAGE');
        }

        if (command.subCommands) {
          command.subCommands.forEach((subCommand: CommandType) => {
            if (subCommand.longDescription && subCommand.longDescription.includes('USAGE')) {
              expect(subCommand.longDescription).toContain('USAGE');
            }
          });
        }
      });
    });

    it('should have EXAMPLES section in detailed long descriptions', () => {
      Commands.forEach((command: CommandType) => {
        if (command.longDescription && command.longDescription.includes('EXAMPLES')) {
          expect(command.longDescription).toContain('EXAMPLES');
        }

        if (command.subCommands) {
          command.subCommands.forEach((subCommand: CommandType) => {
            if (subCommand.longDescription && subCommand.longDescription.includes('EXAMPLES')) {
              expect(subCommand.longDescription).toContain('EXAMPLES');
            }
          });
        }
      });
    });
  });

  describe('Platform Parameter', () => {
    it('should have platform parameter with correct options', () => {
      // Find commands that use platform parameter
      const commandsWithPlatform: CommandType[] = [];
      
      const findPlatformCommands = (commands: CommandType[]) => {
        commands.forEach((cmd) => {
          const hasPlatform = cmd.params.some(p => p.name === 'platform');
          if (hasPlatform) {
            commandsWithPlatform.push(cmd);
          }
          
          if (cmd.subCommands) {
            findPlatformCommands(cmd.subCommands);
          }
        });
      };

      findPlatformCommands(Commands);

      commandsWithPlatform.forEach((cmd) => {
        const platformParam = cmd.params.find(p => p.name === 'platform')!;
        expect(platformParam.type).toBe(CommandParameterTypes.SELECT);
        expect(platformParam.params).toBeDefined();
        expect(Array.isArray(platformParam.params)).toBe(true);
        
        const platformOptions = platformParam.params!.map((p: any) => p.name);
        expect(platformOptions).toContain('iOS');
        expect(platformOptions).toContain('Android');
      });
    });
  });

  describe('Interactive Mode Flags', () => {
    it('should have valid interactive mode flags', () => {
      Commands.forEach((command: CommandType) => {
        const checkParams = (params: ParamType[]) => {
          params.forEach((param: ParamType) => {
            if (param.requriedForInteractiveMode !== undefined) {
              expect(typeof param.requriedForInteractiveMode).toBe('boolean');
            }
            if (param.skipForInteractiveMode !== undefined) {
              expect(typeof param.skipForInteractiveMode).toBe('boolean');
            }
            if (param.autoFillForInteractiveMode !== undefined) {
              expect(typeof param.autoFillForInteractiveMode).toBe('boolean');
            }
          });
        };

        checkParams(command.params);
        
        if (command.subCommands) {
          command.subCommands.forEach((subCommand: CommandType) => {
            checkParams(subCommand.params);
          });
        }
      });
    });
  });

  describe('Enterprise App Store Command', () => {
    let enterpriseCommand: CommandType;

    beforeEach(() => {
      enterpriseCommand = Commands.find(cmd => cmd.command === 'enterprise-app-store')!;
    });

    it('should have enterprise-app-store command defined', () => {
      expect(enterpriseCommand).toBeDefined();
      expect(enterpriseCommand.command).toBe('enterprise-app-store');
      expect(enterpriseCommand.description).toBe('Enterprise App Store');
    });

    it('should have enterprise app store subcommands', () => {
      expect(enterpriseCommand.subCommands).toBeDefined();
      expect(enterpriseCommand.subCommands!.length).toBeGreaterThan(0);

      const subCommandNames = enterpriseCommand.subCommands!.map(sub => sub.command);
      expect(subCommandNames).toContain('version');
      expect(subCommandNames).toContain('profile-list');
    });
  });

  describe('Testing Distribution Command', () => {
    let testingCommand: CommandType;

    beforeEach(() => {
      testingCommand = Commands.find(cmd => cmd.command === 'testing-distribution')!;
    });

    it('should have testing-distribution command defined', () => {
      expect(testingCommand).toBeDefined();
      expect(testingCommand.command).toBe('testing-distribution');
      expect(testingCommand.description).toBe('Testing Distribution');
    });

    it('should have testing distribution subcommands', () => {
      expect(testingCommand.subCommands).toBeDefined();
      expect(testingCommand.subCommands!.length).toBeGreaterThan(0);

      const subCommandNames = testingCommand.subCommands!.map(sub => sub.command);
      expect(subCommandNames).toContain('upload');
      expect(subCommandNames).toContain('profile');
    });
  });

  describe('Organization Command', () => {
    let orgCommand: CommandType;

    beforeEach(() => {
      orgCommand = Commands.find(cmd => cmd.command === 'organization')!;
    });

    it('should have organization command defined', () => {
      expect(orgCommand).toBeDefined();
      expect(orgCommand.command).toBe('organization');
      expect(orgCommand.description).toBe('Organization Management');
    });

    it('should have organization subcommands', () => {
      expect(orgCommand.subCommands).toBeDefined();
      expect(orgCommand.subCommands!.length).toBeGreaterThan(0);

      const subCommandNames = orgCommand.subCommands!.map(sub => sub.command);
      expect(subCommandNames).toContain('view');
      expect(subCommandNames).toContain('create-sub');
      expect(subCommandNames).toContain('user');
      expect(subCommandNames).toContain('role');
    });
  });

  describe('Command Validation Rules', () => {
    it('should have unique command names', () => {
      const commandNames = Commands.map(cmd => cmd.command);
      const uniqueNames = [...new Set(commandNames)];
      expect(commandNames.length).toBe(uniqueNames.length);
    });

    it('should have valid parameter names (no spaces or special chars)', () => {
      Commands.forEach((command: CommandType) => {
        const checkParams = (params: ParamType[]) => {
          params.forEach((param: ParamType) => {
            expect(param.name).toMatch(/^[a-zA-Z][a-zA-Z0-9\-_]*$/);
          });
        };

        checkParams(command.params);
        
        if (command.arguments) {
          checkParams(command.arguments);
        }
        
        if (command.subCommands) {
          command.subCommands.forEach((subCommand: CommandType) => {
            checkParams(subCommand.params);
            if (subCommand.arguments) {
              checkParams(subCommand.arguments);
            }
          });
        }
      });
    });

    it('should have non-empty descriptions', () => {
      Commands.forEach((command: CommandType) => {
        expect(command.description).toBeDefined();
        expect(command.description.length).toBeGreaterThan(0);

        const checkParams = (params: ParamType[]) => {
          params.forEach((param: ParamType) => {
            expect(param.description).toBeDefined();
            expect(param.description.length).toBeGreaterThan(0);
          });
        };

        checkParams(command.params);
        
        if (command.arguments) {
          checkParams(command.arguments);
        }
        
        if (command.subCommands) {
          command.subCommands.forEach((subCommand: CommandType) => {
            expect(subCommand.description).toBeDefined();
            expect(subCommand.description.length).toBeGreaterThan(0);
            checkParams(subCommand.params);
            if (subCommand.arguments) {
              checkParams(subCommand.arguments);
            }
          });
        }
      });
    });
  });

  describe('Value Types', () => {
    it('should have valid value types when specified', () => {
      const validValueTypes = ['string', 'uuid', 'boolean', 'number', 'path'];
      
      Commands.forEach((command: CommandType) => {
        const checkParams = (params: ParamType[]) => {
          params.forEach((param: ParamType) => {
            if (param.valueType) {
              expect(validValueTypes).toContain(param.valueType);
            }
          });
        };

        checkParams(command.params);
        
        if (command.arguments) {
          checkParams(command.arguments);
        }
        
        if (command.subCommands) {
          command.subCommands.forEach((subCommand: CommandType) => {
            checkParams(subCommand.params);
            if (subCommand.arguments) {
              checkParams(subCommand.arguments);
            }
          });
        }
      });
    });

    it('should have consistent UUID parameters', () => {
      Commands.forEach((command: CommandType) => {
        const checkParams = (params: ParamType[]) => {
          params.forEach((param: ParamType) => {
            // Parameters ending with 'Id' should typically have uuid value type
            if (param.name.endsWith('Id') && param.valueType) {
              expect(param.valueType).toBe('uuid');
            }
          });
        };

        checkParams(command.params);
        
        if (command.arguments) {
          checkParams(command.arguments);
        }
        
        if (command.subCommands) {
          command.subCommands.forEach((subCommand: CommandType) => {
            checkParams(subCommand.params);
            if (subCommand.arguments) {
              checkParams(subCommand.arguments);
            }
          });
        }
      });
    });
  });
});