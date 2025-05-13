import { DefaultEnvironmentVariables, getConfigStore } from '../config';
import { CURRENT_PARAM_VALUE } from '../constant';

export enum CommandParameterTypes {
  SELECT = 'select',
  BOOLEAN = 'boolean',
  STRING = 'input',
  PASSWORD = 'password',
  MULTIPLE_SELECT = 'multipleSelect',
}

export enum CommandTypes {
  CONFIG = 'config',
  LOGIN = 'login',
  ORGANIZATION = 'organization',
  PUBLISH = 'publish',
  BUILD = 'build',
  TESTING_DISTRIBUTION= 'testing-distribution',
  ENTERPRISE_APP_STORE= 'enterprise-app-store',
  SIGNING_IDENTITY= 'signing-identity',
}

export type ParamType = {
  name: string;
  description: string;
  longDescription?: string
  type: CommandParameterTypes;
  valueType?: string;
  required?: boolean;
  params?: any[];
  requriedForInteractiveMode?: boolean;
  skipForInteractiveMode?: boolean;
  paramType?: string;
  autoFillForInteractiveMode?: boolean;
  defaultValue?: any;
  from?: 'user' | 'default';
};

export type CommandType = {
  command: string;
  description: string;
  longDescription?: string;
  ignore?: boolean;
  subCommands?: CommandType[];
  arguments?: ParamType[];
  params: ParamType[];
};

const platformParam = {
  name: 'platform',
  description: 'Platform (ios/android)',
  type: CommandParameterTypes.SELECT,
  params: [{ name: 'ios' , message: 'iOS' }, { name: 'android', message: 'Android' }],
  defaultValue: 'ios',
  valueType: 'string',
  required: true,
};

export const Commands: CommandType[] = [
  {
    command: CommandTypes.CONFIG,
    description: 'Config',
    longDescription: 'View and set Appcircle CLI properties.',
    params: [],
    subCommands: [
      {
        command: 'list',
        description: 'List Appcircle CLI properties for all configurations.',
        params: [],
      },
      {
        command: 'get',
        description: 'Get Print the value of a Appcircle CLI currently active configuration property.',
        params: [],
        arguments: [
          {
            name: 'key',
            description: 'Config key [API_HOSTNAME, AUTH_HOSTNAME, AC_ACCESS_TOKEN]',
            type: CommandParameterTypes.SELECT,
            params: Object.keys(DefaultEnvironmentVariables),
          },
        ],
      },
      {
        command: 'set',
        description: 'Set a Appcircle CLI currently active configuration property.',
        params: [],
        arguments: [
          {
            name: 'key',
            description: 'Config key [API_HOSTNAME, AUTH_HOSTNAME, AC_ACCESS_TOKEN]',
            type: CommandParameterTypes.SELECT,
            params: Object.keys(DefaultEnvironmentVariables),
          },
          {
            name: 'value',
            description: 'Config value',
            type: CommandParameterTypes.STRING,
          },
        ],
      },
      {
        command: 'current',
        description: 'Set a Appcircle CLI currently active configuration environment',
        params: [],
        arguments: [
          {
            name: 'value',
            description: 'Current configuration environment name',
            type: CommandParameterTypes.SELECT,
            params: Object.keys(getConfigStore().envs),
          },
        ],
      },
      {
        command: 'add',
        description: 'Add a new Appcircle CLI configuration environment.',
        params: [],
        arguments: [
          {
            name: 'value',
            description: 'New configuration environment name',
            type: CommandParameterTypes.STRING,
          },
        ],
      },
      {
        command: 'reset',
        description: 'Reset a Appcircle CLI configuration to default.',
        params: [],
      },
      {
        command: 'trust',
        description: 'Trust the SSL certificate of the self-hosted Appcircle server.',
        params: [],
      },
    ],
  },
  {
    command: CommandTypes.LOGIN,
    description: 'Login',
    longDescription: 'Log in to obtain your access token.',
    params: [
      {
        name: 'pat',
        description: 'Personal Access Token',
        type: CommandParameterTypes.STRING,
        valueType: 'string',
      },
    ],
  },
  {
    command: CommandTypes.BUILD,
    description: 'Build',
    longDescription: 'Manage build actions.',
    subCommands: [
      {
        command: 'start',
        description: 'Start a new build.',
        params: [
          {
            name: 'profileId',
            description: 'Build profile ID',
            type: CommandParameterTypes.SELECT,
            valueType: 'uuid',
          },
          {
            name: 'branchId',
            description: 'Branch ID',
            type: CommandParameterTypes.SELECT,
            valueType: 'uuid',
            required: false,
            params: [],
          },
          {
            name: 'commitId',
            description: 'Commit ID [Optional]',
            type: CommandParameterTypes.SELECT,
            valueType: 'uuid',
            required: false,
            params: [],
          },
          {
            name: 'commitHash',
            description: "Commit Hash instead of 'Commit ID' [Optional]",
            type: CommandParameterTypes.STRING,
            valueType: 'string',
            required: false,
            requriedForInteractiveMode: false,
            skipForInteractiveMode:true,
            params: [],
          },
          {
            name: 'configurationId',
            description: 'Configuration ID [Optional]',
            type: CommandParameterTypes.SELECT,
            valueType: 'uuid',
            required: false,
            params: [],
          },
          {
            name: 'workflowId',
            description: 'Workflow ID',
            type: CommandParameterTypes.SELECT,
            valueType: 'uuid',
            required: false,
            params: [],
          },
          {
            name: 'branch',
            description: "Branch Name instead of 'branch ID'",
            type: CommandParameterTypes.STRING,
            valueType: 'string',
            required: false,
            requriedForInteractiveMode: false,
            skipForInteractiveMode:true,
            params: [],
          },
          {
            name: 'workflow',
            description: "Workflow Name instead of 'workflow ID'",
            type: CommandParameterTypes.STRING,
            valueType: 'string',
            required: false,
            requriedForInteractiveMode: false,
            skipForInteractiveMode:true,
            params: [],
          },
        ],
      },
      {
        command: 'active-list',
        description: 'Get a list of active builds in the queue.',
        params: [],
      },
      {
        command: "list",
        description: 'Get list of builds of a commit.',
        params: [
          {
            name: 'profileId',
            description: 'Build profile ID',
            type: CommandParameterTypes.SELECT,
            requriedForInteractiveMode: true,
            valueType: 'uuid',
          },
          {
            name: 'branchId',
            description: 'Branch ID',
            type: CommandParameterTypes.SELECT,
            requriedForInteractiveMode: true,
            valueType: 'uuid',
          },
          {
            name: 'commitId',
            description: 'Commit ID',
            type: CommandParameterTypes.SELECT,
            valueType: 'uuid',
          },
        ],
      },
      {
        command: 'view',
        description: 'View details of a build.',
        longDescription: 'View comprehensive details of a build, including its status, duration, and other relevant information.',
        params: [
          {
            name: 'profileId',
            description: 'Build profile ID',
            type: CommandParameterTypes.SELECT,
            requriedForInteractiveMode: true,
            valueType: 'uuid',
          },
          {
            name: 'branchId',
            description: 'Branch ID',
            type: CommandParameterTypes.SELECT,
            valueType: 'string',
            requriedForInteractiveMode: true,
            params: [],
          },
          {
            name: 'commitId',
            description: 'Commit ID of your build',
            type: CommandParameterTypes.SELECT,
            valueType: 'uuid',
          },
          {
            name: 'buildId',
            description: 'Build ID of your profile',
            type: CommandParameterTypes.SELECT,
            valueType: 'uuid',
          },
        ]
      },
      {
        command: 'download',
        description: 'Download your artifact to the given directory on your machine.',
        params: [
          {
            name: 'path',
            description: '[OPTIONAL] The path for artifacts to be downloaded:',
            longDescription:'[OPTIONAL] The path for artifacts to be downloaded: (Defaults to the current directory)',
            type: CommandParameterTypes.STRING,
            valueType: 'string',
            required: false,
          },
          {
            name: 'profileId',
            description: 'Build profile ID',
            type: CommandParameterTypes.SELECT,
            requriedForInteractiveMode: true,
            valueType: 'uuid',
          },
          {
            name: 'branchId',
            description: 'Branch ID',
            type: CommandParameterTypes.SELECT,
            valueType: 'string',
            requriedForInteractiveMode: true,
            params: [],
          },
          {
            name: 'commitId',
            description: 'Commit ID of your build',
            type: CommandParameterTypes.SELECT,
            valueType: 'uuid',
          },
          {
            name: 'buildId',
            description: 'Build ID of your profile',
            type: CommandParameterTypes.SELECT,
            valueType: 'uuid',
          },
        ],
      },
      {
        command: 'download-log',
        description: 'Download build log to the given directory on your machine.',
        params: [
          {
            name: 'path',
            description: '[OPTIONAL] The path for log to be downloaded:',
            longDescription:'[OPTIONAL] The path for log to be downloaded: (Defaults to the current directory)',
            type: CommandParameterTypes.STRING,
            valueType: 'string',
            required: false,
          },
          {
            name: 'profileId',
            description: 'Build profile ID',
            type: CommandParameterTypes.SELECT,
            requriedForInteractiveMode: true,
            valueType: 'uuid',
          },
          {
            name: 'branchId',
            description: 'Branch ID',
            type: CommandParameterTypes.SELECT,
            valueType: 'string',
            requriedForInteractiveMode: true,
            params: [],
          },
          {
            name: 'commitId',
            description: 'Commit ID of your build',
            type: CommandParameterTypes.SELECT,
            valueType: 'uuid',
          },
          {
            name: 'buildId',
            description: 'Build ID of your profile',
            type: CommandParameterTypes.SELECT,
            valueType: 'uuid',
          },
        ],
      },
      {
        command:'profile',
        description: 'Build profile actions.',
        subCommands: [
          {
            command: 'list',
            description: 'Build profile list',
            longDescription: 'Get list of build profiles.',
            params: [],
          },
          {
            command: 'branch',
            description: 'Build profile branch actions',
            subCommands: [
              {
                command: 'list',
                description: 'Get list of branches of a build profile',
                params: [
                  {
                    name: 'profileId',
                    description: 'Build profile ID',
                    type: CommandParameterTypes.SELECT,
                    valueType: 'uuid',
                  },
                ],
              },
              {
                command: 'commits',
                description: 'Get list of commits of a branch',
                params: [
                  {
                    name: 'profileId',
                    description: 'Build profile ID',
                    type: CommandParameterTypes.SELECT,
                    requriedForInteractiveMode: true,
                    valueType: 'uuid',
                  },
                  {
                    name: 'branchId',
                    description: 'Branch ID',
                    type: CommandParameterTypes.SELECT,
                    valueType: 'uuid',
                  },
                ],
              },
            ],
            params: []
          },
          {
            command: 'workflows',
            description: 'Get list of workflows of a build profile',
            params: [
              {
                name: 'profileId',
                description: 'Build profile ID',
                type: CommandParameterTypes.SELECT,
                valueType: 'uuid',
              },
            ],
          },
          {
            command: 'configurations',
            description: 'Get list of configurations of a build profile',
            params: [
              {
                name: 'profileId',
                description: 'Build profile ID',
                type: CommandParameterTypes.SELECT,
                valueType: 'uuid',
              },
            ],
          },
        ],
        params: []
      },
      {
        command: 'variable',
        description: 'Environment variable actions',
        subCommands: [
          {
            command: 'group',
            description: 'Group Actions',
            longDescription: 'Environment variable group actions',
            params: [],
            subCommands:[
              {
                command: "list",
                description: 'List groups',
                params: [],
              },
              {
                command: "create",
                description: 'Create an environment variable group',
                params: [
                  {
                    name: 'name',
                    description: 'Variable group name',
                    type: CommandParameterTypes.STRING,
                    valueType: 'string',
                  },
                ],
              },
              {
                command: "upload",
                description: 'Upload environment variables from JSON file',
                longDescription: 'Upload environment variables from a JSON file to a variable group',
                params: [
                  {
                    name: 'variableGroupId',
                    description: 'Variable Group ID',
                    type: CommandParameterTypes.SELECT,
                    valueType: 'uuid',
                    required: true
                  },
                  {
                    name: 'filePath',
                    description: 'JSON file path',
                    type: CommandParameterTypes.STRING,
                    valueType: 'path',
                    required: true
                  }
                ],
              }
            ]
          },
          {
            command: 'create',
            description: 'Create a file or text environment variable',
            params: [
              {
                name: 'variableGroupId',
                description: 'Variable group ID',
                type: CommandParameterTypes.SELECT,
                valueType: 'uuid',
              },
              {
                name: 'type',
                description: 'Type',
                type: CommandParameterTypes.SELECT,
                valueType: 'string',
                params: [
                  {
                    name: 'file',
                    description: 'File',
                  },
                  {
                    name: 'text',
                    description: 'Text',
                  },
                ],
              },
              {
                name: 'isSecret',
                description: 'Secret',
                type: CommandParameterTypes.BOOLEAN,
                valueType: 'boolean',
                required: false,
              },
              {
                name: 'key',
                description: 'Key Name',
                type: CommandParameterTypes.STRING,
                valueType: 'string',
              },
              {
                name: 'value',
                description: `Key Value`,
                type: CommandParameterTypes.STRING,
                valueType: 'string',
                required: false,
                paramType: 'text',
              },
              {
                name: 'filePath',
                description: `File Path`,
                type: CommandParameterTypes.STRING,
                valueType: 'string',
                required: true,
                paramType: 'file',
              },
            ],
          },
          {
            command: "view",
            description: 'Get list of environment variables',
            params: [
              {
                name: 'variableGroupId',
                description: 'Variable Groups ID',
                type: CommandParameterTypes.SELECT,
                valueType: 'uuid',
              },
            ],
          }
        ],
        params: []
      }
    ],
    params: []
  },
  {
    command: CommandTypes.SIGNING_IDENTITY,
    description: 'Signing Identities',
    longDescription: 'Signing Identities management',
    params: [],
    subCommands:[
      {
        command: 'certificate',
        description: 'iOS Certificate actions',
        longDescription: 'iOS Certificate actions',
        params:[],
        subCommands: [
          {
            command: 'list',
            description: 'Certificates list',
            longDescription: 'Get list of uploaded/installed certificates',
            params:[],
          },
          {
            command: 'upload',
            description: 'Upload a new certificate bundle (.p12)',
            longDescription: 'Upload a new certificate bundle (.p12)',
            params:[
              {
                name: 'path',
                description: 'Certificate path',
                type: CommandParameterTypes.STRING,
                valueType: 'path',
                required: true
              },
              {
                name: 'password',
                description: 'Certificate password',
                type: CommandParameterTypes.PASSWORD,
                valueType: 'string',
                required: true
              },
            ],
          },
          {
            command: 'create',
            description: 'Generate signing request to create certificates.',
            longDescription: 'Generate signing request to create certificates.',
            params:[
              {
                name: 'name',
                description: 'Certificate name',
                type: CommandParameterTypes.STRING,
                valueType: 'string',
                required: true,
              },
              {
                name: 'email',
                description: 'Email',
                type: CommandParameterTypes.STRING,
                valueType: 'string',
                required: true,
              },
              {
                name: 'countryCode',
                description: 'Country code',
                type: CommandParameterTypes.SELECT,
                valueType: 'string',
                required: true,
              },
            ],
          },
          {
            command: 'view',
            description: 'View details of a certificate bundle. (.p12)',
            longDescription: 'View details of a certificate bundle. (.p12)',
            params:[
              {
                name: 'certificateBundleId',
                description: 'Certificate Bundle ID',
                type: CommandParameterTypes.SELECT,
                valueType: 'uuid',
                required: true,
              }
            ],
          },
          {
            command: 'download',
            description: 'Download certificate.',
            longDescription: 'Download certificate to the given directory on your machine.',
            params:[
              {
                name: 'path',
                description: '[OPTIONAL] The path for certificate to be downloaded:',
                longDescription:'[OPTIONAL] The path for certificate to be downloaded: (Defaults to the current directory)',
                type: CommandParameterTypes.STRING,
                valueType: 'string',
                required: false,
              },
              {
                name: 'certificateId',
                description: 'Certificate ID',
                type: CommandParameterTypes.SELECT,
                valueType: 'uuid',
                required: true,
              }
            ],
          },
          {
            command: 'remove',
            description: 'Remove certificate.',
            longDescription: 'Remove certificate.',
            params:[
              {
                name: 'certificateId',
                description: 'Certificate ID',
                type: CommandParameterTypes.SELECT,
                valueType: 'uuid',
                required: true,
              }
            ],
          }
        ]
      },
      {
        command: 'provisioning-profile',
        description: 'iOS Provisioning Profile actions',
        longDescription: 'iOS Provisioning Profile actions',
        params:[],
        subCommands: [
          {
            command: 'list',
            description: 'Provisioning profile list',
            longDescription: 'Get list of uploaded/installed provisioning profiles.',
            params:[],
          },
          {
            command: 'upload',
            description: 'Upload a provisioning profile (.mobileprovision).',
            longDescription: 'Upload and create a new provisioning profile (.mobileprovision).',
            params:[{
              name: 'path',
              description: 'Provisioning profile path',
              type: CommandParameterTypes.STRING,
              valueType: 'path',
              required: true
            }],
          },
          {
            command: 'download',
            description: 'Download provisioning profile.',
            longDescription: 'Download provisioning profile to the given directory on your machine.',
            params:[
              {
                name: 'path',
                description: '[OPTIONAL] The path for provisioning profile to be downloaded:',
                longDescription:'[OPTIONAL] The path for provisioning profile to be downloaded: (Defaults to the current directory)',
                type: CommandParameterTypes.STRING,
                valueType: 'string',
                required: false,
              },
              {
                name: 'provisioningProfileId',
                description: 'Provisioning Profile ID',
                type: CommandParameterTypes.SELECT,
                valueType: 'uuid',
                required: true,
              }
            ],
          },
          {
            command: 'view',
            description: 'View details of a provisioning profile.',
            longDescription: 'View details of a provisioning profile.',
            params:[
              {
                name: 'provisioningProfileId',
                description: 'Provisioning Profile ID',
                type: CommandParameterTypes.SELECT,
                valueType: 'uuid',
                required: true,
              }
            ],
          },
          {
            command: 'remove',
            description: 'Remove provisioning profile.',
            longDescription: 'Remove provisioning profile.',
            params:[
              {
                name: 'provisioningProfileId',
                description: 'Provisioning Profile ID',
                type: CommandParameterTypes.SELECT,
                valueType: 'uuid',
                required: true,
              }
            ],
          },
        ],
      },
      {
        command: 'keystore',
        description: 'Android Keystore actions',
        longDescription: 'Android Keystore actions',
        params:[],
        subCommands: [
          {
            command: 'list',
            description: 'Keystores list',
            longDescription: 'Get list of uploaded/installed keystores',
            params: [],
          },
          {
            command: 'create',
            description: 'Generate a new keystore.',
            longDescription: 'Generate a new keystore.',
            params: [
            {
              name: 'name',
              description: 'Keystore name',
              type: CommandParameterTypes.STRING,
              valueType: 'string',
            },
            {
              name: 'password',
              description: 'Keystore password',
              type: CommandParameterTypes.PASSWORD,
              valueType: 'string',
            },
            {
              name: 'alias',
              description: 'Alias',
              type: CommandParameterTypes.STRING,
              valueType: 'string',
            },
            {
              name: 'aliasPassword',
              description: 'Alias password.',
              type: CommandParameterTypes.PASSWORD,
              valueType: 'string',
            },
            {
              name: 'validity',
              description: 'Validity (Years)',
              type: CommandParameterTypes.STRING,
              valueType: 'string',
            }
            ],
          },
          {
            command: 'upload',
            description: 'Upload keystore file (.jks or .keystore)',
            longDescription: 'Upload keystore file (.jks or .keystore)',
            params: [
              {
                name: 'path',
                description: 'Keystore path',
                type: CommandParameterTypes.STRING,
                valueType: 'path',
                required: true
              },
              {
                name: 'password',
                description: 'Keystore password',
                type: CommandParameterTypes.PASSWORD,
                valueType: 'string',
                required: true
              },
              {
                name: 'aliasPassword',
                description: 'Alias password',
                type: CommandParameterTypes.PASSWORD,
                valueType: 'string',
                required: true
              },
            ]
          },
          {
            command: 'download',
            description: 'Download keystore file (.jks or .keystore)',
            longDescription: 'Download keystore file (.jks or .keystore) to the given directory on your machine.',
            params: [
              {
                name: 'path',
                description: '[OPTIONAL] The path for keystore file to be downloaded:',
                longDescription:'[OPTIONAL] The path for keystore file to be downloaded: (Defaults to the current directory)',
                type: CommandParameterTypes.STRING,
                valueType: 'string',
                required: false,
              },
              {
                name: 'keystoreId',
                description: 'Keystore ID',
                type: CommandParameterTypes.SELECT,
                valueType: 'uuid',
                required: true,
              }
            ]
          },
          {
            command: 'view',
            description: 'View detais of keystore.',
            longDescription: 'View details of keystore.',
            params:[
              {
                name: 'keystoreId',
                description: 'Keystore ID',
                type: CommandParameterTypes.SELECT,
                valueType: 'uuid',
                required: true,
              }
            ],
          },
          {
            command: 'remove',
            description: 'Remove keystore.',
            longDescription: 'Remove keystore.',
            params:[
              {
                name: 'keystoreId',
                description: 'Keystore ID',
                type: CommandParameterTypes.SELECT,
                valueType: 'uuid',
                required: true,
              }
            ],
          }
        ]
      }
    ]
  },
  {
    command: CommandTypes.TESTING_DISTRIBUTION,
    description: 'Testing Distribution',
    longDescription: 'Testing Distribution management',
    params: [],
    subCommands: [
      {
        command: 'upload',
        description: 'Upload your mobile app to selected distribution profile',
        params: [
          {
            name: 'distProfileId',
            description: 'Distribution profile ID',
            type: CommandParameterTypes.SELECT,
            valueType: 'uuid',
          },
          {
            name: 'message',
            description: 'Release notes',
            type: CommandParameterTypes.STRING,
            valueType: 'string',
          },
          {
            name: 'app',
            description: 'App path',
            type: CommandParameterTypes.STRING,
            valueType: 'path',
          },
        ],
      },
      {
        command:'profile',
        description: 'Distribution profile actions',
        subCommands: [
          {
            command: 'list',
            description: 'Get list of distribution profiles',
            params: [],
          },
          {
            command: 'create',
            description: 'Create a distribution profile',
            params: [
              {
                name: 'name',
                description: 'Profile name',
                type: CommandParameterTypes.STRING,
                valueType: 'string',
              },
            ],
          },
          {
            command: 'settings',
            description: 'Distribution profile settings',
            params: [],
            subCommands:[
              {
                command: 'auto-send',
                description: 'Select the test groups for automated distribution.',
                params: [
                  {
                    name: 'distProfileId',
                    description: 'Distribution profile ID',
                    type: CommandParameterTypes.SELECT,
                    valueType: 'uuid',
                  },
                  {
                    name: 'testingGroupIds',
                    description: 'Testing group IDs for automated distribution.',
                    longDescription: 'Testing group IDs for automated distribution.',
                    type: CommandParameterTypes.MULTIPLE_SELECT,
                    valueType: 'string'
                  }
                ],
              }
            ]
          },
        ],
        params: []
      },
      {
        command: 'testing-group',
        description: 'Testing group actions',
        longDescription: 'Testing group actions',
        params: [],
        subCommands: [
          {
            command: 'list',
            description: 'Get all testing group list of current organization.',
            longDescription:'Get all testing group list of current organization.',
            params: [],
          },
          {
            command: 'view',
            description: 'View detais of testing group.',
            longDescription:'View detais of testing group.',
            params: [
              {
                name: 'testingGroupId',
                description: 'Testing group ID',
                type: CommandParameterTypes.SELECT,
                valueType: 'uuid',
              }
            ],
          },
          {
            command: 'create',
            description: 'Create a new testing group.',
            longDescription:'Create a new testing group.',
            params: [
              {
                name: 'name',
                description: 'Testing group name',
                type: CommandParameterTypes.STRING,
                valueType: 'string',
              }
            ],
          },
          {
            command: 'remove',
            description: 'Remove testing group.',
            longDescription:'Remove testing group.',
            params: [
              {
                name: 'testingGroupId',
                description: 'Testing group ID',
                type: CommandParameterTypes.SELECT,
                valueType: 'uuid',
              }
            ],
          },
          {
            command: 'tester',
            description: 'Testing group tester actions.',
            longDescription: 'Testing group tester actions.',
            params:[],
            subCommands: [
              {
                command: 'add',
                description: 'Add tester to selected testing group.',
                longDescription: 'Add tester to selected testing group.',
                params: [
                  {
                    name: 'testingGroupId',
                    description: 'Testing group ID',
                    type: CommandParameterTypes.SELECT,
                    valueType: 'uuid',
                  },
                  {
                    name: 'testerEmail',
                    description: 'Email of tester',
                    type: CommandParameterTypes.STRING,
                    valueType: 'string',
                  }
                ]
              },
              {
                command: 'remove',
                description: 'Remove selected tester from selected testing group.',
                longDescription: 'Remove selected tester from selected testing group.',
                params: [
                  {
                    name: 'testingGroupId',
                    description: 'Testing group ID',
                    type: CommandParameterTypes.SELECT,
                    valueType: 'uuid',
                  },
                  {
                    name: 'testerEmail',
                    description: 'Email of tester',
                    type: CommandParameterTypes.SELECT,
                    valueType: 'string',
                  }
                ]
              }
            ]
          }
        ]
      }
    ]
  },
  {
    command: CommandTypes.PUBLISH,
    description: 'Publish',
    longDescription: 'Manage publish module actions.',
    subCommands: [
      {
        command: 'start',
        description: 'Start a publish',
        longDescription: 'Starts a publish',
        params: [
          platformParam,
          {
            name: 'publishProfileId',
            description: 'Publish Profile ID',
            type: CommandParameterTypes.SELECT,
            valueType: 'uuid',
            required: true
          },
          {
            name: 'appVersionId',
            description: 'App version',
            type: CommandParameterTypes.SELECT,
            valueType: 'uuid',
            required: true
          }
        ],
      },
      {
        command: 'active-list',
        description: 'Get a list of active publishing processes currently in the queue.',
        params: [],
      },
      {
        command: 'view',
        description: 'View details of the publishing process by app version.',
        params: [
          platformParam,
          {
            name: 'publishProfileId',
            description: 'Publish Profile ID',
            type: CommandParameterTypes.SELECT,
            valueType: 'uuid',
            required: true
          },
          {
            name: 'appVersionId',
            description: 'App version',
            type: CommandParameterTypes.SELECT,
            valueType: 'uuid',
            required: true
          }
        ],
      },
      {
        command: 'profile',
        description: 'Publish profile actions',
        longDescription: 'Publish profile actions',
        params: [],
        subCommands: [
          {
            command: 'list',
            description: 'Publish profile list',
            longDescription: 'Get list of publish profile',
            params: [platformParam],
          },
          {
            command: 'create',
            description: 'Create a publish profile',
            longDescription: 'Create a new publish profile',
            params: [platformParam,
            {
              name: 'name',
              description: 'Profile name',
              type: CommandParameterTypes.STRING,
              defaultValue: undefined,
              valueType: 'string',
              required: true,
            }
          ],
          },
          {
            command: 'rename',
            description: 'Rename publish profile',
            longDescription: 'Rename publish profile',
            params: [platformParam,
              {
                name: 'publishProfileId',
                description: 'Publish Profile ID',
                type: CommandParameterTypes.SELECT,
                valueType: 'uuid',
                required: true
              },
              {
                name: 'name',
                description: 'New profile name',
                type: CommandParameterTypes.STRING,
                defaultValue: undefined,
                valueType: 'string',
                required: true,
              }
          ],
          },
          {
            command: 'delete',
            description: 'Remove publish profile',
            longDescription: 'Remove publish profile',
            params: [platformParam,
              {
                name: 'publishProfileId',
                description: 'Publish Profile ID',
                type: CommandParameterTypes.SELECT,
                valueType: 'uuid',
                required: true
              }
          ],
          },
          {
            command: 'version',
            description: 'App version actions',
            longDescription: 'App version actions',
            params: [],
            subCommands: [
              {
                command: 'list',
                description: 'App version list',
                longDescription: 'Get list of app versions by given publish profile.',
                params: [platformParam,
                  {
                    name: 'publishProfileId',
                    description: 'Publish Profile ID',
                    type: CommandParameterTypes.SELECT,
                    valueType: 'uuid',
                    required: true
                  }
                ],
              },
              {
                command: 'view',
                description: 'View detais of app version.',
                longDescription: 'View detais of app version.',
                params: [platformParam,
                  {
                    name: 'publishProfileId',
                    description: 'Publish Profile ID',
                    type: CommandParameterTypes.SELECT,
                    valueType: 'uuid',
                    required: true
                  },
                  {
                    name: 'appVersionId',
                    description: 'App version',
                    type: CommandParameterTypes.SELECT,
                    valueType: 'uuid',
                    required: true
                  },
                ],
              },
              {
                command: 'upload',
                description: 'Upload a new app version',
                longDescription: 'Upload a new version to given publish profile',
                params: [
                  platformParam,
                  {
                    name: 'publishProfileId',
                    description: 'Publish Profile ID',
                    type: CommandParameterTypes.SELECT,
                    valueType: 'uuid',
                    required: true
                  },
                  {
                    name: 'app',
                    description: 'App path',
                    type: CommandParameterTypes.STRING,
                    valueType: 'path',
                    required: true
                  },
                  {
                    name: 'markAsRc',
                    description: 'Mark binary as release candidate automatically. [OPTIONAL]',
                    longDescription: 'Mark binary as release candidate automatically. [OPTIONAL]',
                    type: CommandParameterTypes.BOOLEAN,
                    valueType: 'boolean',
                    defaultValue: false,
                    required: false
                  },
                  {
                    name: 'summary',
                    description: 'Release Notes (To add a release note to the app version, you need to mark the version as a release candidate.) [OPTIONAL]',
                    longDescription: 'Release Notes (To add a release note to the app version, you need to mark the version as a release candidate.) [OPTIONAL]',
                    type: CommandParameterTypes.STRING,
                    valueType: 'string',
                    required: false
                  }
                ],
              },
              {
                command: 'download',
                description: 'Download app version',
                longDescription: 'Download app version from selected publish profile',
                params: [
                  platformParam,
                  {
                    name: 'publishProfileId',
                    description: 'Publish Profile ID',
                    type: CommandParameterTypes.SELECT,
                    valueType: 'uuid',
                    required: true
                  },
                  {
                    name: 'appVersionId',
                    description: 'App version',
                    type: CommandParameterTypes.SELECT,
                    valueType: 'uuid',
                    required: true
                  },
                  {
                    name: 'path',
                    description: '[OPTIONAL] The path for artifacts to be downloaded:',
                    longDescription:'[OPTIONAL] The path for artifacts to be downloaded: (Defaults to the current directory)',
                    type: CommandParameterTypes.STRING,
                    valueType: 'path',
                    required: false
                  }
                ],
              },
              {
                command: 'delete',
                description: 'Remove app version',
                longDescription: 'Remove app version from selected publish profile',
                params: [
                  platformParam,
                  {
                    name: 'publishProfileId',
                    description: 'Publish Profile ID',
                    type: CommandParameterTypes.SELECT,
                    valueType: 'uuid',
                    required: true
                  },
                  {
                    name: 'appVersionId',
                    description: 'App version',
                    type: CommandParameterTypes.SELECT,
                    valueType: 'uuid',
                    required: true
                  }
                ],
              },
              {
                command: 'mark-as-rc',
                description: 'Mark as Release Candidate',
                longDescription: 'Mark an app version as Release Candidate',
                params: [
                  platformParam,
                  {
                    name: 'publishProfileId',
                    description: 'Publish Profile ID',
                    type: CommandParameterTypes.SELECT,
                    valueType: 'uuid',
                    required: true
                  },
                  {
                    name: 'appVersionId',
                    description: 'App version',
                    type: CommandParameterTypes.SELECT,
                    valueType: 'uuid',
                    required: true
                  }
                ],
              },
              {
                command: 'unmark-as-rc',
                description: 'Unmark as Release Candidate',
                longDescription: 'Unmark an app version as Release Candidate',
                params: [
                  platformParam,
                  {
                    name: 'publishProfileId',
                    description: 'Publish Profile ID',
                    type: CommandParameterTypes.SELECT,
                    valueType: 'uuid',
                    required: true
                  },
                  {
                    name: 'appVersionId',
                    description: 'App version',
                    type: CommandParameterTypes.SELECT,
                    valueType: 'uuid',
                    required: true
                  }
                ],
              },
              {
                command: 'update-release-note',
                description: 'Update the release notes for the app version.',
                longDescription: 'Update the release notes for the app version.',
                params: [
                  platformParam,
                  {
                    name: 'publishProfileId',
                    description: 'Publish Profile ID',
                    type: CommandParameterTypes.SELECT,
                    valueType: 'uuid',
                    required: true
                  },
                  {
                    name: 'appVersionId',
                    description: 'App version',
                    type: CommandParameterTypes.SELECT,
                    valueType: 'uuid',
                    required: true
                  },
                  {
                    name: 'summary',
                    description: 'Release Notes (To add a release note to the app version, you need to mark the version as a release candidate.)',
                    longDescription: 'Release Notes (To add a release note to the app version, you need to mark the version as a release candidate.)',
                    type: CommandParameterTypes.STRING,
                    valueType: 'string',
                    required: true
                  }
                ],
              },
            ]
          },
          {
            command: 'settings',
            description: 'Publish profile settings',
            longDescription: 'Publish profile settings',
            params: [],
            subCommands: [
              {
                command: 'autopublish',
                description: 'Set Publish Profile as Auto Publish',
                longDescription: 'Start a publish process when a new version is received.',
                params: [
                  platformParam,
                  {
                    name: 'publishProfileId',
                    description: 'Publish Profile ID',
                    type: CommandParameterTypes.SELECT,
                    valueType: 'uuid',
                    required: true
                  },
                  {
                    name: 'enable',
                    description: 'Enable Auto Publish',
                    type: CommandParameterTypes.BOOLEAN,
                    valueType: 'boolean',
                    required: true
                  }
                ],
              },
            ]
          }
        ]
      },
      {
        command: 'variable',
        description: 'Publish Variables',
        longDescription: 'Publish Variables',
        params: [],
        subCommands: [
          {
            command: 'group',
            description: 'Group Actions',
            longDescription: 'Publish variable group actions',
            params: [],
            subCommands:[
              {
                command: "list",
                description: 'List groups',
                longDescription: 'Publish variable group actions',
                params: [],
              },
              // {
              //   command: "create",
              //   description: 'Create new group',
              //   longDescription: 'Create a new publish variable group',
              //   params: [{
              //     name: 'name',
              //     description: 'Group name',
              //     type: CommandParameterTypes.STRING,
              //     defaultValue: undefined,
              //     valueType: 'string',
              //     required: true,
              //   }],
              // },
              {
                command: "view",
                description: 'View items of group',
                longDescription: 'View items of publish variable group',
                params: [
                  {
                    name: 'publishVariableGroupId',
                    description: 'Variable Group ID',
                    type: CommandParameterTypes.SELECT,
                    valueType: 'uuid',
                    required: true
                  }
                ],
              }
            ]
          }
        ]
      }
    ],
    params: [],
  },
  {
    command: CommandTypes.ENTERPRISE_APP_STORE,
    description: 'Enterprise App Store',
    params: [],
    subCommands: [
      {
        command: 'profile',
        description: 'Enterprise profile actions',
        subCommands: [
          {
            command: 'list',
            description: 'Get list of enterprise profiles',
            params: [],
          }
        ],
        params: []
      },
      {
        command: 'version',
        description: 'Enterprise app version actions',
        subCommands: [
          {
            command: 'list',
            description: 'Get list of enterprise app versions',
            params: [
              {
                name: 'entProfileId',
                description: 'Enterprise Profile ID',
                type: CommandParameterTypes.SELECT,
                valueType: 'uuid',
              },
              {
                name: 'publishType',
                description: 'Publish Type Empty,0=All,1=Beta,2=Live',
                type: CommandParameterTypes.SELECT,
                defaultValue: '0',
                params: [
                  {
                    name: '0',
                    message: 'All',
                  },
                  {
                    name: '1',
                    message: 'Beta',
                  },
                  {
                    name: '2',
                    message: 'Live',
                  },
                ],
                required: false,
                valueType: 'number',
              },
            ],
          },
          {
            command: 'publish',
            description: 'Publish enterprise app version',
            params: [
              {
                name: 'entProfileId',
                description: 'Enterprise Profile ID',
                type: CommandParameterTypes.SELECT,
                valueType: 'uuid',
              },
              {
                name: 'entVersionId',
                description: 'App Version ID',
                type: CommandParameterTypes.SELECT,
                valueType: 'uuid',
              },
              {
                name: 'summary',
                description: 'Summary',
                type: CommandParameterTypes.STRING,
                valueType: 'string',
              },
              {
                name: 'releaseNotes',
                description: 'Release Notes',
                type: CommandParameterTypes.STRING,
                valueType: 'string',
              },
              {
                name: 'publishType',
                description: 'Publish Type 0=None,1=Beta,2=Live',
                type: CommandParameterTypes.SELECT,
                defaultValue: '0',
                params: [
                  {
                    name: '0',
                    message: 'None',
                  },
                  {
                    name: '1',
                    message: 'Beta',
                  },
                  {
                    name: '2',
                    message: 'Live',
                  },
                ],
                valueType: 'number',
              },
            ],
          },
          {
            command: 'unpublish',
            description: 'Unpublish enterprise app version',
            params: [
              {
                name: 'entProfileId',
                description: 'Enterprise Profile ID',
                type: CommandParameterTypes.SELECT,
                valueType: 'uuid',
              },
              {
                name: 'entVersionId',
                description: 'App Version ID',
                type: CommandParameterTypes.SELECT,
                valueType: 'uuid',
              },
            ],
          },
          {
            command: 'remove',
            description: 'Remove enterprise app version',
            params: [
              {
                name: 'entProfileId',
                description: 'Enterprise Profile ID',
                type: CommandParameterTypes.SELECT,
                valueType: 'uuid',
              },
              {
                name: 'entVersionId',
                description: 'App Version ID',
                type: CommandParameterTypes.SELECT,
                valueType: 'uuid',
              },
            ],
          },
          {
            command: 'notify',
            description: 'Notify enterprise app version',
            ignore: true,
            params: [
              {
                name: 'entProfileId',
                description: 'Enterprise Profile ID',
                type: CommandParameterTypes.SELECT,
                valueType: 'uuid',
              },
              {
                name: 'entVersionId',
                description: 'App Version ID',
                type: CommandParameterTypes.SELECT,
                valueType: 'uuid',
              },
              {
                name: 'subject',
                description: 'Subject',
                type: CommandParameterTypes.STRING,
                valueType: 'string',
              },
              {
                name: 'message',
                description: 'Message',
                type: CommandParameterTypes.STRING,
                valueType: 'string',
              },
            ],
          },
          {
            command: 'upload-for-profile',
            description: 'Upload enterprise app version for a profile',
            params: [
              {
                name: 'entProfileId',
                description: 'Enterprise Profile Id',
                type: CommandParameterTypes.SELECT,
                valueType: 'uuid',
              },
              {
                name: 'app',
                description: 'App path',
                type: CommandParameterTypes.STRING,
                valueType: 'string',
              },
            ],
          },
          {
            command: 'upload-without-profile',
            description: 'Upload enterprise app version without a profile',
            params: [
              {
                name: 'app',
                description: 'App path',
                type: CommandParameterTypes.STRING,
                valueType: 'string',
              },
            ],
          },
          {
            command: 'download-link',
            description: 'Get enterprise app download link',
            params: [
              {
                name: 'entProfileId',
                description: 'Enterprise Profile Id',
                type: CommandParameterTypes.SELECT,
                valueType: 'uuid',
              },
              {
                name: 'entVersionId',
                description: 'App Version ID',
                type: CommandParameterTypes.SELECT,
                valueType: 'uuid',
              },
            ],
          }
        ],
        params: []
      }
    ]
  },
  {
    command: CommandTypes.ORGANIZATION,
    description: 'Organization management',
    longDescription: 'Manage organization users, roles, and details.',
    subCommands: [
      {
        command: 'view',
        description: 'View organizations details',
        longDescription: 'View organization details. If "organizationId" not provided, will list all organizations.',
        params: [{
          name: 'organizationId',
          description: 'Organization ID [Optional]',
          type: CommandParameterTypes.SELECT,
          defaultValue: 'all',
          valueType: 'uuid',
          required: false,
        }],
      },
      {
        command: 'user',
        description: 'User management',
        longDescription: 'Organization users management (view, invite, re-invite, remove ).',
        subCommands: [
          {
            command: 'view',
            description: 'View users of organization',
            params: [ {
              name: 'organizationId',
              description: 'Organization ID [Optional]',
              type: CommandParameterTypes.SELECT,
              defaultValue: 'current',
              valueType: 'uuid',
              required: false,
            }],
          },
          {
            command: 'invite',
            description: 'Invite user to organization',
            params: [{
              name: 'organizationId',
              description: 'Organization ID [Optional]',
              type: CommandParameterTypes.SELECT,
              defaultValue: 'current',
              valueType: 'uuid',
              required: false,
            },{
              name: 'email',
              description: 'Email',
              type: CommandParameterTypes.STRING,
              defaultValue: '',
              valueType: 'string',
              required: true,
            },{
              name: 'role',
              description: 'Role',
              type: CommandParameterTypes.MULTIPLE_SELECT,
              valueType: 'string',
              required: false,
              autoFillForInteractiveMode: true,
            }],
          },
          {
            command: 're-invite',
            description: 'Re-invite user to organization',
            params: [
              {
                name: 'organizationId',
                description: 'Organization ID [Optional]',
                type: CommandParameterTypes.SELECT,
                defaultValue: CURRENT_PARAM_VALUE,
                valueType: 'uuid',
                required: false,
              },{
                name: 'email',
                description: 'Email',
                type: CommandParameterTypes.SELECT,
                defaultValue: '',
                valueType: 'string',
                required: true,
              }
            ],
          },
          {
            command: 'remove',
            description: 'Remove user or invitation from organization',
            params: [{
              name: 'organizationId',
              description: 'Organization ID [Optional]',
              type: CommandParameterTypes.SELECT,
              defaultValue: CURRENT_PARAM_VALUE,
              valueType: 'uuid',
              required: false,
            },{
              name: 'userId',
              description: 'User ID',
              type: CommandParameterTypes.SELECT,
              valueType: 'uuid',
              required: false,
            },{
              name: 'email',
              description: 'Email',
              type: CommandParameterTypes.SELECT,
              defaultValue: '',
              valueType: 'string',
              required: false,
            }],
          },
        ],
        params: [],
      },
      {
        command: 'role',
        description: 'Roles management',
        longDescription: 'Organization users roles management (view, add, remove, clear ).',
        subCommands: [
          {
            command: 'view',
            description: 'View roles of the given userId within the organizationId.',
            params: [
              {
                name: 'organizationId',
                description: 'Organization ID [Optional]',
                type: CommandParameterTypes.SELECT,
                defaultValue: CURRENT_PARAM_VALUE,
                valueType: 'uuid',
                required: false,
              },
              {
                name: 'userId',
                description: 'User ID',
                type: CommandParameterTypes.SELECT,
                valueType: 'uuid',
                required: true,
              },
            ],
          },
          {
            command: 'add',
            description: 'Add roles to the given userId within the organizationId.',
            params: [
              {
                name: 'organizationId',
                description: 'Organization ID [Optional]',
                type: CommandParameterTypes.SELECT,
                defaultValue: CURRENT_PARAM_VALUE,
                valueType: 'uuid',
                required: false,
              },
              {
                name: 'userId',
                description: 'User ID',
                type: CommandParameterTypes.SELECT,
                valueType: 'uuid',
                required: true,
              },
              {
                name: 'role',
                description: 'Roles',
                type: CommandParameterTypes.MULTIPLE_SELECT,
                valueType: 'string',
                required: true,
              },
            ],
          },
          {
            command: 'remove',
            description: 'Remove given roles from the given userId within the organizationId.',
            params: [
              {
                name: 'organizationId',
                description: 'Organization ID [Optional]',
                type: CommandParameterTypes.SELECT,
                defaultValue: CURRENT_PARAM_VALUE,
                valueType: 'uuid',
                required: false,
              },
              {
                name: 'userId',
                description: 'User ID',
                type: CommandParameterTypes.SELECT,
                valueType: 'uuid',
                required: true,
              },
              {
                name: 'role',
                description: 'Roles',
                type: CommandParameterTypes.MULTIPLE_SELECT,
                from: 'user',
                valueType: 'string',
                required: true,
              },
            ],
          },
          {
            command: 'clear',
            description: 'Remove all roles from the given userId within the organizationId.',
            params: [
              {
                name: 'organizationId',
                description: 'Organization ID [Optional]',
                type: CommandParameterTypes.SELECT,
                defaultValue: CURRENT_PARAM_VALUE,
                valueType: 'uuid',
                required: false,
              },
              {
                name: 'userId',
                description: 'User ID',
                type: CommandParameterTypes.SELECT,
                valueType: 'uuid',
                required: true,
              }
            ],
          }
        ],
        params: [],
      },
    ],
    params: [],
  }
];
