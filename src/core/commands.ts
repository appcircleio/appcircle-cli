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
  LIST_BUILD_PROFILES = 'listBuildProfiles',
  LIST_BUILD_PROFILE_BRANCHES = 'listBuildProfileBranches',
  LIST_BUILD_PROFILE_WORKFLOWS = 'listBuildProfileWorkflows',
  LIST_BUILD_PROFILE_CONFIGURATIONS = 'listBuildProfileConfigurations',
  LIST_BUILD_PROFILE_COMMITS = 'listBuildProfileCommits',
  LIST_BUILD_PROFILE_BUILDS_OF_COMMIT = 'listBuildProfileBuildsOfCommit',
  LIST_DISTRIBUTION_PROFILES = 'listDistributionProfiles',
  BUILD = 'build',
  DOWNLOAD = 'download',
  UPLOAD = 'upload',
  CREATE_DISTRIBUTION_PROFILE = 'createDistributionProfile',
  LIST_ENVIRONMENT_VARIABLE_GROUPS = 'listEnvironmentVariableGroups',
  CREATE_ENVIRONMENT_VARIABLE_GROUP = 'createEnvironmentVariableGroup',
  LIST_ENVIRONMENT_VARIABLES = 'listEnvironmentVariables',
  CREATE_ENVIRONMENT_VARIABLE = 'createEnvironmentVariable',
  LIST_ENTERPRISE_PROFILES = 'listEnterpriseProfiles',
  LIST_ENTERPRISE_APP_VERSIONS = 'listEnterpriseAppVersions',
  PUBLISH_ENTERPRISE_APP_VERSION = 'publishEnterpriseAppVersion',
  UNPUBLISH_ENTERPRISE_APP_VERSION = 'unpublishEnterpriseAppVersion',
  REMOVE_ENTERPRISE_APP_VERSION = 'removeEnterpriseAppVersion',
  NOTIFY_ENTERPRISE_APP_VERSION = 'notifyEnterpriseAppVersion',
  UPLOAD_ENTERPRISE_APP = 'uploadEnterpriseApp',
  UPLOAD_ENTERPRISE_APP_VERSION = 'uploadEnterpriseAppVersion',
  GET_ENTERPRISE_DOWNLOAD_LINK = 'getEnterpriseDownloadLink',
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
  paramType?: string;
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
    description: 'Config (View and set Appcircle CLI properties)',
    params: [],
    subCommands: [
      {
        command: 'list',
        description: 'List Appcircle CLI properties for all configurations',
        params: [],
      },
      {
        command: 'get',
        description: 'Get Print the value of a Appcircle CLI currently active configuration property',
        params: [],
        arguments: [
          {
            name: 'key',
            description: 'Config key [API_HOSTNAME, AUTH_HOSTMANE, AC_ACCESS_TOKEN]',
            type: CommandParameterTypes.SELECT,
            params: Object.keys(DefaultEnvironmentVariables),
          },
        ],
      },
      {
        command: 'set',
        description: 'Set a Appcircle CLI currently active configuration property',
        params: [],
        arguments: [
          {
            name: 'key',
            description: 'Config key [API_HOSTNAME, AUTH_HOSTMANE, AC_ACCESS_TOKEN]',
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
        description: 'Add a new Appcircle CLI configuration environment',
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
        description: 'Reset a Appcircle CLI configuration to default',
        params: [],
      },
      {
        command: 'trust',
        description: 'Trust the SSL certificate of the self-hosted Appcircle server',
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
            description: 'Remove user or inivation from organization',
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
            description: 'Raname publish profile',
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
                command: 'markAsRC',
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
                command: 'unmarkAsRC',
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
    command: CommandTypes.LIST_BUILD_PROFILES,
    description: 'Get list of build profiles',
    params: [],
  },
  {
    command: CommandTypes.LIST_BUILD_PROFILE_BRANCHES,
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
    command: CommandTypes.LIST_BUILD_PROFILE_WORKFLOWS,
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
    command: CommandTypes.LIST_BUILD_PROFILE_CONFIGURATIONS,
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
  {
    command: CommandTypes.LIST_BUILD_PROFILE_COMMITS,
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
  {
    command: CommandTypes.LIST_BUILD_PROFILE_BUILDS_OF_COMMIT,
    description: 'Get list of builds of a commit',
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
    command: CommandTypes.LIST_DISTRIBUTION_PROFILES,
    description: 'Get list of distribution profiles',
    params: [],
  },
  {
    command: CommandTypes.BUILD,
    description: 'Start a new build',
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
        params: [],
      },
      {
        name: 'workflow',
        description: "Workflow Name instead of 'workflow ID'",
        type: CommandParameterTypes.STRING,
        valueType: 'string',
        required: false,
        params: [],
      },
    ],
  },
  {
    command: CommandTypes.DOWNLOAD,
    description: 'Download your artifact to the given directory on your machine',
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
        description: 'Build ID',
        type: CommandParameterTypes.SELECT,
        valueType: 'uuid',
      },
    ],
  },
  {
    command: CommandTypes.UPLOAD,
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
    command: CommandTypes.CREATE_DISTRIBUTION_PROFILE,
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
    command: CommandTypes.LIST_ENVIRONMENT_VARIABLE_GROUPS,
    description: 'Get list of environment variable groups',
    params: [],
  },
  {
    command: CommandTypes.CREATE_ENVIRONMENT_VARIABLE_GROUP,
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
    command: CommandTypes.LIST_ENVIRONMENT_VARIABLES,
    description: 'Get list of environment variables',
    params: [
      {
        name: 'variableGroupId',
        description: 'Variable Groups ID',
        type: CommandParameterTypes.SELECT,
        valueType: 'uuid',
      },
    ],
  },
  {
    command: CommandTypes.CREATE_ENVIRONMENT_VARIABLE,
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
        required: false,
        paramType: 'file',
      },
    ],
  },
  {
    command: CommandTypes.LIST_ENTERPRISE_PROFILES,
    description: 'Get list of enterprise profiles',
    params: [],
  },
  {
    command: CommandTypes.LIST_ENTERPRISE_APP_VERSIONS,
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
    command: CommandTypes.PUBLISH_ENTERPRISE_APP_VERSION,
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
    command: CommandTypes.UNPUBLISH_ENTERPRISE_APP_VERSION,
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
    command: CommandTypes.REMOVE_ENTERPRISE_APP_VERSION,
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
    command: CommandTypes.NOTIFY_ENTERPRISE_APP_VERSION,
    description: 'Notify enterprise app version',
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
    command: CommandTypes.UPLOAD_ENTERPRISE_APP_VERSION,
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
    command: CommandTypes.UPLOAD_ENTERPRISE_APP,
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
    command: CommandTypes.GET_ENTERPRISE_DOWNLOAD_LINK,
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
  },
];
