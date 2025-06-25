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
  description: 'Platform (iOS/Android)',
  type: CommandParameterTypes.SELECT,
  params: [{ name: 'iOS', message: 'iOS' }, { name: 'Android', message: 'Android' }],
  defaultValue: 'iOS',
  valueType: 'string',
  required: true,
};

export const Commands: CommandType[] = [
  {
    command: CommandTypes.CONFIG,
    description: 'Config',
    longDescription: 'View and set Appcircle CLI properties',
    params: [],
    subCommands: [
      {
        command: 'list',
        description: 'List Appcircle CLI properties for All Configurations',
        longDescription: `List all Appcircle CLI configuration properties and environments

USAGE
  appcircle config list

DESCRIPTION
  Display all configuration properties for all environments including API hostnames,
  authentication settings, and access tokens. Shows both active and inactive configurations.

EXAMPLES
  appcircle config list

LEARN MORE
  Use 'appcircle config get <key>' to get a specific configuration value.
  Use 'appcircle config set <key> <value>' to set a configuration property.
  Use 'appcircle config current <environment>' to switch between configurations.`,
        params: [],
      },
      {
        command: 'get',
        description: 'Get Print the value of a Appcircle CLI Currently Active Configuration property',
        longDescription: `Get the value of a specific configuration property from the active environment

USAGE
  appcircle config get <key>

REQUIRED ARGUMENTS
  <key>  Configuration key (API_HOSTNAME, AUTH_HOSTNAME, or AC_ACCESS_TOKEN)

DESCRIPTION
  Retrieve and display the value of a specific configuration property from the currently
  active environment. Available keys are API_HOSTNAME, AUTH_HOSTNAME, and AC_ACCESS_TOKEN.

EXAMPLES
  appcircle config get API_HOSTNAME
  appcircle config get AC_ACCESS_TOKEN
  appcircle config get AUTH_HOSTNAME

LEARN MORE
  Use 'appcircle config list' to see all configuration properties.
  Use 'appcircle config set <key> <value>' to update configuration values.
  Use 'appcircle config current <environment>' to switch environments.`,
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
        description: 'Set a Appcircle CLI Currently Active Configuration property',
        longDescription: `Set the value of a configuration property in the active environment

USAGE
  appcircle config set <key> <value>

REQUIRED ARGUMENTS
  <key>    Configuration key (API_HOSTNAME, AUTH_HOSTNAME, or AC_ACCESS_TOKEN)
  <value>  New value for the configuration property

DESCRIPTION
  Update a specific configuration property in the currently active environment.
  Changes will be saved and applied immediately to the active configuration.

EXAMPLES
  appcircle config set API_HOSTNAME "https://api.appcircle.io"
  appcircle config set AUTH_HOSTNAME "https://auth.appcircle.io" 
  appcircle config set AC_ACCESS_TOKEN "your-access-token-here"

LEARN MORE
  Use 'appcircle config get <key>' to verify the new value.
  Use 'appcircle config list' to see all configuration properties.
  Use 'appcircle login' to get a new access token.`,
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
            description: 'Config Value',
            type: CommandParameterTypes.STRING,
          },
        ],
      },
      {
        command: 'current',
        description: 'Set a Appcircle CLI Currently Active Configuration Environment',
        longDescription: `Switch to a different configuration environment

USAGE
  appcircle config current <environment>

REQUIRED ARGUMENTS
  <environment>  Name of the configuration environment to activate

DESCRIPTION
  Switch the active configuration environment. Each environment maintains its own
  set of configuration properties (API hostname, auth hostname, access token).
  This allows you to easily switch between different Appcircle instances or accounts.

EXAMPLES
  appcircle config current production
  appcircle config current staging
  appcircle config current development

LEARN MORE
  Use 'appcircle config add <name>' to create new configuration environments.
  Use 'appcircle config list' to see all available environments.
  Use 'appcircle config set <key> <value>' to configure the active environment.`,
        params: [],
        arguments: [
          {
            name: 'value',
            description: 'Current Configuration Environment Name',
            type: CommandParameterTypes.SELECT,
            params: Object.keys(getConfigStore().envs),
          },
        ],
      },
      {
        command: 'add',
        description: 'Add a New Appcircle CLI Configuration Environment',
        longDescription: `Create a new configuration environment

USAGE
  appcircle config add <environment-name>

REQUIRED ARGUMENTS
  <environment-name>  Name for the new configuration environment

DESCRIPTION
  Create a new configuration environment with default settings. Each environment
  maintains separate configuration properties, allowing you to manage multiple
  Appcircle instances or accounts independently.

EXAMPLES
  appcircle config add staging
  appcircle config add production
  appcircle config add development

LEARN MORE
  Use 'appcircle config current <environment>' to switch to the new environment.
  Use 'appcircle config set <key> <value>' to configure the new environment.
  Use 'appcircle config list' to see all available environments.`,
        params: [],
        arguments: [
          {
            name: 'value',
            description: 'New Configuration Environment Name',
            type: CommandParameterTypes.STRING,
          },
        ],
      },
      {
        command: 'reset',
        description: 'Reset a Appcircle CLI Configuration to default',
        longDescription: `Reset the current configuration environment to default values

USAGE
  appcircle config reset

DESCRIPTION
  Reset all configuration properties in the currently active environment to their
  default values. This will clear any custom API hostnames, authentication settings,
  and access tokens. Use with caution as this action cannot be undone.

EXAMPLES
  appcircle config reset

LEARN MORE
  Use 'appcircle config list' to verify the reset was successful.
  Use 'appcircle config set <key> <value>' to reconfigure after reset.
  Use 'appcircle login' to set up authentication after reset.`,
        params: [],
      },
      {
        command: 'trust',
        description: 'Trust the SSL Certificate of the self-hosted Appcircle Server',
        longDescription: `Trust SSL certificates for self-hosted Appcircle instances

USAGE
  appcircle config trust

DESCRIPTION
  Configure the CLI to trust SSL certificates for self-hosted Appcircle server instances.
  This is required when using Appcircle Enterprise with custom SSL certificates or
  when connecting to development/staging environments with self-signed certificates.

EXAMPLES
  appcircle config trust

LEARN MORE
  Use this command only for trusted self-hosted Appcircle instances.
  Contact your system administrator for SSL certificate requirements.
  Use 'appcircle config set API_HOSTNAME <url>' to set your server URL first.`,
        params: [],
      },
    ],
  },
  {
    command: CommandTypes.LOGIN,
    description: 'Login',
    longDescription: `Authenticate with Appcircle using your Personal Access Token

USAGE
  appcircle login [--pat <token>]

OPTIONAL OPTIONS
  --pat <token>  Your Personal Access Token from Appcircle dashboard

DESCRIPTION
  Authenticate with Appcircle to access your organization's resources and perform CLI operations.
  You can provide your Personal Access Token directly via the --pat option, or the command will
  prompt you to enter it interactively for security. Once authenticated, your token will be
  stored securely for future CLI operations.

EXAMPLES
  appcircle login
  appcircle login --pat "your-personal-access-token-here"

LEARN MORE
  To get your Personal Access Token:
  1. Go to Appcircle Dashboard (https://my.appcircle.io)
  2. Navigate to 'My Organization' → 'Integrations' → 'Personal API Tokens'
  3. Click 'Generate Token' and copy the generated token
  4. Use the token with this login command
  
  Use 'appcircle config set AC_ACCESS_TOKEN <token>' to update your stored token.
  Use 'appcircle config get AC_ACCESS_TOKEN' to view your current token.
  Use 'appcircle config list' to see all configuration settings.`,
    params: [
      {
        name: 'pat',
        description: 'Personal Access Token',
        longDescription: 'Your Personal Access Token from Appcircle dashboard',
        type: CommandParameterTypes.STRING,
        valueType: 'string',
        requriedForInteractiveMode: false,
      },
    ],
  },
  {
    command: CommandTypes.BUILD,
    description: 'Build',
    longDescription: 'Manage Build Actions',
    subCommands: [
      {
        command: 'start',
        description: 'Start a New Build',
        longDescription: `Trigger a new build using the selected profile, branch, and workflow

USAGE
  appcircle build start --profileId <uuid> --branchId <uuid> --workflowId <uuid>
  appcircle build start --profile <string> --branchId <uuid> --workflowId <uuid>

REQUIRED OPTIONS
  --profileId <uuid>        Build profile ID (UUID format)
  --profile <string>        Build profile name (alternative to --profileId)
  --branchId <uuid>         Branch ID (UUID format, required unless using --branch)
  --workflowId <uuid>       Workflow ID (UUID format, required unless using --workflow)

OPTIONAL OPTIONS
  --branch <string>         Branch name (alternative to --branchId)
  --workflow <string>       Workflow name (alternative to --workflowId)
  --commitId <uuid>         Commit ID (UUID format, optional)
  --commitHash <string>     Commit hash (alternative to --commitId)
  --configurationId <uuid>  Configuration ID (UUID format, optional)
  --configuration <string>  Configuration name (alternative to --configurationId)

EXAMPLES
  appcircle build start --profileId 550e8400-e29b-41d4-a716-446655440000 --branchId 6ba7b810-9dad-11d1-80b4-00c04fd430c8 --workflowId 6ba7b811-9dad-11d1-80b4-00c04fd430c8
  appcircle build start --profile "My iOS Project" --branch "main" --workflow "Default Push Workflow"
  appcircle build start --profile "My Android App" --branchId 6ba7b810-9dad-11d1-80b4-00c04fd430c8 --workflowId 6ba7b811-9dad-11d1-80b4-00c04fd430c8

LEARN MORE
  Use 'appcircle build profile list' to get available profiles with their UUIDs and names.
  Use 'appcircle build profile branch list --profileId <uuid>' to get available branches.
  Use 'appcircle build profile workflows --profileId <uuid>' to get available workflows.`,
        params: [
          {
            name: 'profileId',
            description: 'Build Profile Name (ID)',
            type: CommandParameterTypes.SELECT,
            valueType: 'uuid',
            required: false,
          },
          {
            name: 'profile',
            description: "Build Profile Name instead of 'profileId'",
            type: CommandParameterTypes.STRING,
            valueType: 'string',
            required: false,
            requriedForInteractiveMode: false,
            skipForInteractiveMode: true,
            params: [],
          },
          {
            name: 'branchId',
            description: 'Branch Name (ID)',
            type: CommandParameterTypes.SELECT,
            valueType: 'uuid',
            required: false,
            params: [],
          },
          {
            name: 'commitId',
            description: 'Commit Message (ID) [Optional]',
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
            description: 'Configuration Name (ID) [Optional]',
            type: CommandParameterTypes.SELECT,
            valueType: 'uuid',
            required: false,
            params: [],
          },
          {
            name: 'configuration',
            description: "Configuration Name instead of 'configurationId' [Optional]",
            type: CommandParameterTypes.STRING,
            valueType: 'string',
            required: false,
            requriedForInteractiveMode: false,
            skipForInteractiveMode: true,
            params: [],
          },
          {
            name: 'workflowId',
            description: 'Workflow Name (ID) [Optional]',
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
        description: 'Get a List of Active Builds in the Queue',
        longDescription: `Get a list of builds currently active and queued for processing

USAGE
  appcircle build active-list

DESCRIPTION
  View all builds that are currently in progress or waiting in the build queue.
  This command shows builds across all your build profiles.

EXAMPLES
  appcircle build active-list

LEARN MORE
  Use 'appcircle build list --profileId <uuid> --branchId <uuid> --commitId <uuid>' to see builds for a specific commit.
  Use 'appcircle build profile list' to get available profiles with their UUIDs.`,
        params: [],
      },
      {
        command: "list",
        description: 'Get List of Builds of a Commit',
        longDescription: `Get a list of builds associated with a specific commit

USAGE
  appcircle build list --profileId <uuid> --branchId <uuid> --commitId <uuid>
  appcircle build list --profile <string> --branch <string> --commitId <uuid>

REQUIRED OPTIONS
  --profileId <uuid>    Build profile ID (UUID format)
  --profile <string>    Build profile name (alternative to --profileId)
  --branchId <uuid>     Branch ID (UUID format)
  --branch <string>     Branch name (alternative to --branchId)
  --commitId <uuid>     Commit ID (UUID format)

EXAMPLES
  appcircle build list --profileId 550e8400-e29b-41d4-a716-446655440000 --branchId 6ba7b810-9dad-11d1-80b4-00c04fd430c8 --commitId 6ba7b812-9dad-11d1-80b4-00c04fd430c8
  appcircle build list --profile "My iOS Project" --branch "main" --commitId 6ba7b812-9dad-11d1-80b4-00c04fd430c8

LEARN MORE
  Use 'appcircle build profile list' to get available profiles with their UUIDs and names.
  Use 'appcircle build profile branch list --profileId <uuid>' to get available branches.
  Use 'appcircle build profile branch commits --profileId <uuid> --branchId <uuid>' to get available commits.`,
        params: [
          {
            name: 'profileId',
            description: 'Build Profile Name (ID)',
            type: CommandParameterTypes.SELECT,
            requriedForInteractiveMode: true,
            valueType: 'uuid',
            required: false,
          },
          {
            name: 'profile',
            description: "Build Profile Name instead of 'profileId'",
            type: CommandParameterTypes.STRING,
            valueType: 'string',
            required: false,
            requriedForInteractiveMode: false,
            skipForInteractiveMode: true,
            params: [],
          },
          {
            name: 'branchId',
            description: 'Branch Name (ID)',
            type: CommandParameterTypes.SELECT,
            requriedForInteractiveMode: true,
            valueType: 'uuid',
            required: false,
          },
          {
            name: 'branch',
            description: "Branch Name instead of 'branchId'",
            type: CommandParameterTypes.STRING,
            valueType: 'string',
            required: false,
            requriedForInteractiveMode: false,
            skipForInteractiveMode: true,
            params: [],
          },
          {
            name: 'commitId',
            description: 'Commit Message (ID)',
            type: CommandParameterTypes.SELECT,
            valueType: 'uuid',
            required: true,
          },
        ],
      },
      {
        command: 'view',
        description: 'View Details of a Build',
        longDescription: `View comprehensive details of a build, including its status, duration, and other relevant information

USAGE
  appcircle build view --profileId <uuid> --branchId <uuid> --commitId <uuid> --buildId <uuid>
  appcircle build view --profile <string> --branch <string> --commitId <uuid> --buildId <uuid>

REQUIRED OPTIONS
  --profileId <uuid>    Build profile ID (UUID format)
  --profile <string>    Build profile name (alternative to --profileId)
  --branchId <uuid>     Branch ID (UUID format)
  --branch <string>     Branch name (alternative to --branchId)
  --commitId <uuid>     Commit ID (UUID format)
  --buildId <uuid>      Build ID (UUID format)

EXAMPLES
  appcircle build view --profileId 550e8400-e29b-41d4-a716-446655440000 --branchId 6ba7b810-9dad-11d1-80b4-00c04fd430c8 --commitId 6ba7b812-9dad-11d1-80b4-00c04fd430c8 --buildId 6ba7b813-9dad-11d1-80b4-00c04fd430c8
  appcircle build view --profile "My iOS Project" --branch "main" --commitId 6ba7b812-9dad-11d1-80b4-00c04fd430c8 --buildId 6ba7b813-9dad-11d1-80b4-00c04fd430c8

LEARN MORE
  Use 'appcircle build profile list' to get available profiles with their UUIDs and names.
  Use 'appcircle build profile branch list --profileId <uuid>' to get available branches.
  Use 'appcircle build profile branch commits --profileId <uuid> --branchId <uuid>' to get available commits.
  Use 'appcircle build list --profileId <uuid> --branchId <uuid> --commitId <uuid>' to get available builds.`,
        params: [
          {
            name: 'profileId',
            description: 'Build Profile Name (ID)',
            type: CommandParameterTypes.SELECT,
            requriedForInteractiveMode: true,
            valueType: 'uuid',
            required: false,
          },
          {
            name: 'profile',
            description: "Build Profile Name instead of 'profileId'",
            type: CommandParameterTypes.STRING,
            valueType: 'string',
            required: false,
            requriedForInteractiveMode: false,
            skipForInteractiveMode: true,
            params: [],
          },
          {
            name: 'branchId',
            description: 'Branch Name (ID)',
            type: CommandParameterTypes.SELECT,
            valueType: 'uuid',
            requriedForInteractiveMode: true,
            required: false,
            params: [],
          },
          {
            name: 'branch',
            description: "Branch Name instead of 'branchId'",
            type: CommandParameterTypes.STRING,
            valueType: 'string',
            required: false,
            requriedForInteractiveMode: false,
            skipForInteractiveMode: true,
            params: [],
          },
          {
            name: 'commitId',
            description: 'Commit Message (ID) of your build',
            type: CommandParameterTypes.SELECT,
            valueType: 'uuid',
            required: true,
          },
          {
            name: 'buildId',
            description: 'Build ID (Date) of your profile',
            type: CommandParameterTypes.SELECT,
            valueType: 'uuid',
            required: true,
          },
        ]
      },
      {
        command: 'download',
        description: 'Download Artifacts',
        longDescription: `Download build artifacts from a completed build

USAGE
  appcircle build download --profileId <uuid> --branchId <uuid> --commitId <uuid> --buildId <uuid> [--path <directory>]
  appcircle build download --profile <string> --branch <string> --commitId <uuid> --buildId <uuid> [--path <directory>]

REQUIRED OPTIONS
  --profileId <uuid>    Build profile ID (UUID format)
  --profile <string>    Build profile name (alternative to --profileId)
  --branchId <uuid>     Branch ID (UUID format)  
  --branch <string>     Branch name (alternative to --branchId)
  --commitId <uuid>     Commit ID (UUID format)
  --buildId <uuid>      Build ID (UUID format)

OPTIONAL OPTIONS
  --path <directory>    Directory path for artifacts to be downloaded (defaults to current directory)

EXAMPLES
  appcircle build download --profileId 550e8400-e29b-41d4-a716-446655440000 --branchId 6ba7b810-9dad-11d1-80b4-00c04fd430c8 --commitId 6ba7b812-9dad-11d1-80b4-00c04fd430c8 --buildId 6ba7b813-9dad-11d1-80b4-00c04fd430c8
  appcircle build download --profile "My iOS Project" --branch "main" --commitId 6ba7b812-9dad-11d1-80b4-00c04fd430c8 --buildId 6ba7b813-9dad-11d1-80b4-00c04fd430c8 --path ./downloads

LEARN MORE
  Use 'appcircle build profile list' to get available profiles with their UUIDs and names.
  Use 'appcircle build profile branch list --profileId <uuid>' to get available branches.
  Use 'appcircle build profile branch commits --profileId <uuid> --branchId <uuid>' to get available commits.
  Use 'appcircle build list --profileId <uuid> --branchId <uuid> --commitId <uuid>' to get available builds.`,
        params: [
          {
            name: 'path',
            description: '[OPTIONAL] The Path for artifacts to be downloaded:',
            longDescription:'[OPTIONAL] The Path for artifacts to be downloaded:',
            type: CommandParameterTypes.STRING,
            valueType: 'string',
            required: false,
          },
          {
            name: 'profileId',
            description: 'Build Profile Name (ID)',
            type: CommandParameterTypes.SELECT,
            valueType: 'uuid',
            required: false,
          },
          {
            name: 'profile',
            description: "Build Profile Name instead of 'profileId'",
            type: CommandParameterTypes.STRING,
            valueType: 'string',
            required: false,
            requriedForInteractiveMode: false,
            skipForInteractiveMode: true,
            params: [],
          },
          {
            name: 'branchId',
            description: 'Branch Name (ID)',
            type: CommandParameterTypes.SELECT,
            valueType: 'uuid',
            required: false,
            params: [],
          },
          {
            name: 'branch',
            description: "Branch Name instead of 'branchId'",
            type: CommandParameterTypes.STRING,
            valueType: 'string',
            required: false,
            requriedForInteractiveMode: false,
            skipForInteractiveMode: true,
            params: [],
          },
          {
            name: 'commitId',
            description: 'Commit Message (ID) of your build',
            type: CommandParameterTypes.SELECT,
            valueType: 'uuid',
            required: true,
          },
          {
            name: 'buildId',
            description: 'Build ID (Date) of your profile',
            type: CommandParameterTypes.SELECT,
            valueType: 'uuid',
            required: true,
          },
        ],
      },
      {
        command: 'download-log',
        description: 'Download Build Logs',
        longDescription: `Download build logs from a completed build

USAGE
  appcircle build download-log --profileId <uuid> --branchId <uuid> --commitId <uuid> --buildId <uuid> [--path <directory>]
  appcircle build download-log --profile <string> --branch <string> --commitId <uuid> --buildId <uuid> [--path <directory>]

REQUIRED OPTIONS
  --profileId <uuid>    Build profile ID (UUID format)
  --profile <string>    Build profile name (alternative to --profileId)
  --branchId <uuid>     Branch ID (UUID format)  
  --branch <string>     Branch name (alternative to --branchId)
  --commitId <uuid>     Commit ID (UUID format)
  --buildId <uuid>      Build ID (UUID format)

OPTIONAL OPTIONS
  --path <directory>    Directory path for logs to be downloaded (defaults to current directory)

EXAMPLES
  appcircle build download-log --profileId 550e8400-e29b-41d4-a716-446655440000 --branchId 6ba7b810-9dad-11d1-80b4-00c04fd430c8 --commitId 6ba7b812-9dad-11d1-80b4-00c04fd430c8 --buildId 6ba7b813-9dad-11d1-80b4-00c04fd430c8
  appcircle build download-log --profile "My iOS Project" --branch "main" --commitId 6ba7b812-9dad-11d1-80b4-00c04fd430c8 --buildId 6ba7b813-9dad-11d1-80b4-00c04fd430c8 --path ./logs

LEARN MORE
  Use 'appcircle build profile list' to get available profiles with their UUIDs and names.
  Use 'appcircle build profile branch list --profileId <uuid>' to get available branches.
  Use 'appcircle build profile branch commits --profileId <uuid> --branchId <uuid>' to get available commits.
  Use 'appcircle build list --profileId <uuid> --branchId <uuid> --commitId <uuid>' to get available builds.`,
        params: [
          {
            name: 'path',
            description: '[OPTIONAL] The Path for log to be downloaded:',
            longDescription:'[OPTIONAL] The Path for log to be downloaded:',
            type: CommandParameterTypes.STRING,
            valueType: 'string',
            required: false,
          },
          {
            name: 'profileId',
            description: 'Build Profile Name (ID)',
            type: CommandParameterTypes.SELECT,
            valueType: 'uuid',
            required: false,
          },
          {
            name: 'profile',
            description: "Build Profile Name instead of 'profileId'",
            type: CommandParameterTypes.STRING,
            valueType: 'string',
            required: false,
            requriedForInteractiveMode: false,
            skipForInteractiveMode: true,
            params: [],
          },
          {
            name: 'branchId',
            description: 'Branch Name (ID)',
            type: CommandParameterTypes.SELECT,
            valueType: 'uuid',
            required: false,
            params: [],
          },
          {
            name: 'branch',
            description: "Branch Name instead of 'branchId'",
            type: CommandParameterTypes.STRING,
            valueType: 'string',
            required: false,
            requriedForInteractiveMode: false,
            skipForInteractiveMode: true,
            params: [],
          },
          {
            name: 'commitId',
            description: 'Commit Message (ID) of your build',
            type: CommandParameterTypes.SELECT,
            valueType: 'uuid',
            required: true,
          },
          {
            name: 'buildId',
            description: 'Build ID (Date) of your profile',
            type: CommandParameterTypes.SELECT,
            valueType: 'uuid',
            required: true,
          },
        ],
      },
      {
        command:'profile',
        description: 'Build Profile Actions',
        longDescription: `Manage build profiles and their settings

DESCRIPTION
  Build profiles define how your mobile applications are built.
  You can create new profiles, configure build settings, and manage build workflows.

SUBCOMMANDS
  list:           List all build profiles
  branch:         Manage branches for a build profile
  workflows:      Manage workflows for a build profile
  configurations: Manage configurations for a build profile

USAGE
  appcircle build profile <action> [flags]

EXAMPLES
  appcircle build profile list
  appcircle build profile branch list --profileId 550e8400-e29b-41d4-a716-446655440000
  appcircle build profile workflows --profileId 550e8400-e29b-41d4-a716-446655440000
  appcircle build profile configurations --profileId 550e8400-e29b-41d4-a716-446655440000

LEARN MORE
  Use 'appcircle build profile <action> --help' for detailed command help.`,
        subCommands: [
          {
            command: 'list',
            description: 'Get List of Build Profiles',
            longDescription: `Get a list of all build profiles in your organization

USAGE
  appcircle build profile list

EXAMPLES
  appcircle build profile list

LEARN MORE
  Use 'appcircle build profile list' to see all available profiles with their UUIDs.
  Use the profileId from the output for other build commands.`,
            params: [],
          },
          {
            command: 'branch',
            description: 'Build Profile Branch Actions',
            subCommands: [
              {
                command: 'list',
                description: 'Get List of Branches of a Build Profile',
                longDescription: `Get a list of all branches for a specific build profile

USAGE
  appcircle build profile branch list --profileId <uuid>
  appcircle build profile branch list --profile <string>

REQUIRED OPTIONS
  --profileId <uuid>    Build profile ID (UUID format)
  --profile <string>    Build profile name (alternative to --profileId)

EXAMPLES
  appcircle build profile branch list --profileId 550e8400-e29b-41d4-a716-446655440000
  appcircle build profile branch list --profile "My iOS Project"

LEARN MORE
  Use 'appcircle build profile list' to get available profiles with their UUIDs and names.
  Use the branchId from the output for other build commands.`,
                params: [
                  {
                    name: 'profileId',
                    description: 'Build Profile Name (ID)',
                    type: CommandParameterTypes.SELECT,
                    valueType: 'uuid',
                    required: false,
                  },
                  {
                    name: 'profile',
                    description: "Build Profile Name instead of 'profileId'",
                    type: CommandParameterTypes.STRING,
                    valueType: 'string',
                    required: false,
                    requriedForInteractiveMode: false,
                    skipForInteractiveMode: true,
                    params: [],
                  },
                ],
              },
              {
                command: 'commits',
                description: 'Get List of Commits of a Branch',
                longDescription: `Get a list of all commits for a specific branch in a build profile

USAGE
  appcircle build profile branch commits --profileId <uuid> --branchId <uuid>
  appcircle build profile branch commits --profile <string> --branch <string>

REQUIRED OPTIONS
  --profileId <uuid>    Build profile ID (UUID format)
  --profile <string>    Build profile name (alternative to --profileId)
  --branchId <uuid>     Branch ID (UUID format)
  --branch <string>     Branch name (alternative to --branchId)

EXAMPLES
  appcircle build profile branch commits --profileId 550e8400-e29b-41d4-a716-446655440000 --branchId 6ba7b810-9dad-11d1-80b4-00c04fd430c8
  appcircle build profile branch commits --profile "My iOS Project" --branch "main"

LEARN MORE
  Use 'appcircle build profile list' to get available profiles with their UUIDs and names.
  Use 'appcircle build profile branch list --profileId <uuid>' to get available branches.
  Use the commitId from the output for other build commands.`,
                params: [
                  {
                    name: 'profileId',
                    description: 'Build Profile Name (ID)',
                    type: CommandParameterTypes.SELECT,
                    requriedForInteractiveMode: true,
                    valueType: 'uuid',
                    required: false,
                  },
                  {
                    name: 'profile',
                    description: "Build Profile Name instead of 'profileId'",
                    type: CommandParameterTypes.STRING,
                    valueType: 'string',
                    required: false,
                    requriedForInteractiveMode: false,
                    skipForInteractiveMode: true,
                    params: [],
                  },
                  {
                    name: 'branchId',
                    description: 'Branch Name (ID)',
                    type: CommandParameterTypes.SELECT,
                    valueType: 'uuid',
                    required: false,
                  },
                  {
                    name: 'branch',
                    description: "Branch Name instead of 'branchId'",
                    type: CommandParameterTypes.STRING,
                    valueType: 'string',
                    required: false,
                    requriedForInteractiveMode: false,
                    skipForInteractiveMode: true,
                    params: [],
                  },
                ],
              },
            ],
            params: []
          },
          {
            command: 'workflows',
            description: 'Get List of Workflows of a Build Profile',
            longDescription: `Get a list of all workflows for a specific build profile

USAGE
  appcircle build profile workflows --profileId <uuid>
  appcircle build profile workflows --profile <string>

REQUIRED OPTIONS
  --profileId <uuid>    Build profile ID (UUID format)
  --profile <string>    Build profile name (alternative to --profileId)

EXAMPLES
  appcircle build profile workflows --profileId 550e8400-e29b-41d4-a716-446655440000
  appcircle build profile workflows --profile "My iOS Project"

LEARN MORE
  Use 'appcircle build profile list' to get available profiles with their UUIDs and names.
  Use the workflowId from the output for build start commands.`,
            params: [
              {
                name: 'profileId',
                description: 'Build Profile Name (ID)',
                type: CommandParameterTypes.SELECT,
                valueType: 'uuid',
                required: false,
              },
              {
                name: 'profile',
                description: "Build Profile Name instead of 'profileId'",
                type: CommandParameterTypes.STRING,
                valueType: 'string',
                required: false,
                requriedForInteractiveMode: false,
                skipForInteractiveMode: true,
                params: [],
              },
            ],
          },
          {
            command: 'configurations',
            description: 'Get List of Configurations of a Build Profile',
            longDescription: `Get a list of all configurations for a specific build profile

USAGE
  appcircle build profile configurations --profileId <uuid>
  appcircle build profile configurations --profile <string>

REQUIRED OPTIONS
  --profileId <uuid>    Build profile ID (UUID format)
  --profile <string>    Build profile name (alternative to --profileId)

EXAMPLES
  appcircle build profile configurations --profileId 550e8400-e29b-41d4-a716-446655440000
  appcircle build profile configurations --profile "My iOS Project"

LEARN MORE
  Use 'appcircle build profile list' to get available profiles with their UUIDs and names.
  Use the configurationId from the output for build start commands (optional).`,
            params: [
              {
                name: 'profileId',
                description: 'Build Profile Name (ID)',
                type: CommandParameterTypes.SELECT,
                valueType: 'uuid',
                required: false,
              },
              {
                name: 'profile',
                description: "Build Profile Name instead of 'profileId'",
                type: CommandParameterTypes.STRING,
                valueType: 'string',
                required: false,
                requriedForInteractiveMode: false,
                skipForInteractiveMode: true,
                params: [],
              },
            ],
          },
        ],
        params: []
      },
      {
        command: 'variable',
        description: 'Environment Variable Actions',
        subCommands: [
          {
            command: 'group',
            description: 'Group Actions',
            longDescription: 'Environment Variable Group Actions',
            params: [],
            subCommands:[
              {
                command: "list",
                description: 'List Groups',
                longDescription: `
USAGE
  appcircle build variable group list

DESCRIPTION
  List all build environment variable groups.

EXAMPLES
  appcircle build variable group list

LEARN MORE
  Use 'appcircle build variable group create --name <group-name>' to create new variable groups.`,
                params: [],
              },
              {
                command: "create",
                description: 'Create an Environment Variable Group',
                longDescription: `
USAGE
  appcircle build variable group create --name <group-name>

REQUIRED OPTIONS
  --name <group-name>    Name for the new variable group

DESCRIPTION
  Create a new build environment variable group for organizing variables.

EXAMPLES
  appcircle build variable group create --name "Production Secrets"
  appcircle build variable group create --name "Development Config"

LEARN MORE
  Use 'appcircle build variable group list' to view existing groups.
`,
                params: [
                  {
                    name: 'name',
                    description: 'Variable Group Name',
                    type: CommandParameterTypes.STRING,
                    valueType: 'string',
                    required: true,
                  },
                ],
              },
              {
                command: "upload",
                description: 'Upload Environment Variables from JSON File',
                longDescription: `
USAGE
  appcircle build variable group upload --variableGroupId <uuid> --filePath <path>
  appcircle build variable group upload --variableGroup <string> --filePath <path>

REQUIRED OPTIONS
  --variableGroupId <uuid>    Variable group ID (UUID format)
  --variableGroup <string>    Variable group name (alternative to --variableGroupId)
  --filePath <path>           Path to JSON file containing environment variables

DESCRIPTION
  Upload environment variables from a JSON file to a specified variable group.
  The JSON file should contain an array of objects with key, value, and optional isSecret properties.

EXAMPLES
  appcircle build variable group upload --variableGroupId 550e8400-e29b-41d4-a716-446655440000 --filePath ./variables.json
  appcircle build variable group upload --variableGroup "CustomScriptVariables" --filePath ~/env-vars.json

LEARN MORE
  Use 'appcircle build variable group list' to get available groups with their UUIDs and names.
  Use 'appcircle build variable group download --variableGroupId <uuid>' to download existing variables as template.
`,
                params: [
                  {
                    name: 'variableGroupId',
                    description: 'Which variable group do you want to upload the JSON to?',
                    type: CommandParameterTypes.SELECT,
                    valueType: 'uuid',
                    required: false
                  },
                  {
                    name: 'variableGroup',
                    description: "Variable Group Name instead of 'variableGroupId'",
                    type: CommandParameterTypes.STRING,
                    valueType: 'string',
                    required: false,
                    requriedForInteractiveMode: false,
                    skipForInteractiveMode: true,
                    params: [],
                  },
                  {
                    name: 'filePath',
                    description: 'JSON File Path',
                    type: CommandParameterTypes.STRING,
                    valueType: 'path',
                    required: true
                  }
                ],
              },
              {
                command: "download",
                description: 'Download Environment Variables as JSON',
                longDescription: `
USAGE
  appcircle build variable group download --variableGroupId <uuid> [--path <directory>]
  appcircle build variable group download --variableGroup <string> [--path <directory>]

REQUIRED OPTIONS
  --variableGroupId <uuid>    Variable group ID (UUID format)
  --variableGroup <string>    Variable group name (alternative to --variableGroupId)

OPTIONAL OPTIONS
  --path <directory>          Directory path for JSON file to be downloaded (defaults to current directory)

DESCRIPTION
  Download build environment variables as a JSON file from a specified variable group.

EXAMPLES
  appcircle build variable group download --variableGroupId 550e8400-e29b-41d4-a716-446655440000
  appcircle build variable group download --variableGroup "CustomScriptVariables" --path ./exports

LEARN MORE
  Use 'appcircle build variable group list' to get available groups with their UUIDs and names.
  Use 'appcircle build variable group upload --variableGroupId <uuid> --filePath <path>' to upload variables from file.
`,
                params: [
                  {
                    name: 'variableGroupId',
                    description: 'Variable Groups Name (ID)',
                    type: CommandParameterTypes.SELECT,
                    valueType: 'uuid',
                    required: false
                  },
                  {
                    name: 'variableGroup',
                    description: "Variable Group Name instead of 'variableGroupId'",
                    type: CommandParameterTypes.STRING,
                    valueType: 'string',
                    required: false,
                    requriedForInteractiveMode: false,
                    skipForInteractiveMode: true,
                    params: [],
                  },
                  {
                    name: 'path',
                    description: '[OPTIONAL] The Path for JSON file to be downloaded',
                    longDescription:'[OPTIONAL] The Path for JSON file to be downloaded (Defaults to the current directory)',
                    type: CommandParameterTypes.STRING,
                    valueType: 'string',
                    required: false,
                  }
                ],
              },
            ]
          },
          {
            command: 'create',
            description: 'Create a File or Text Environment Variable',
            longDescription: `
USAGE
  appcircle build variable create --variableGroupId <uuid> --type <type> --key <key> [options]
  appcircle build variable create --variableGroup <string> --type <type> --key <key> [options]

REQUIRED OPTIONS
  --variableGroupId <uuid>    Variable group ID (UUID format)
  --variableGroup <string>    Variable group name (alternative to --variableGroupId)
  --type <type>               Variable type ('text' or 'file')
  --key <key>                 Variable key name

CONDITIONAL OPTIONS
  --value <value>             Variable value (required for text type)
  --filePath <path>           File path (required for file type)

OPTIONAL OPTIONS
  --isSecret                  Mark variable as secret (default: false)

DESCRIPTION
  Create a new environment variable in a specified variable group.
  Variables can be either text-based or file-based.

EXAMPLES
  appcircle build variable create --variableGroupId 550e8400-e29b-41d4-a716-446655440000 --type text --key "API_KEY" --value "secret123"
  appcircle build variable create --variableGroup "CustomScriptVariables" --type file --key "CONFIG_FILE" --filePath ./config.json
  appcircle build variable create --variableGroup "CustomScriptVariables" --type text --key "DB_PASSWORD" --value "password123" --isSecret

LEARN MORE
  Use 'appcircle build variable group list' to get available groups with their UUIDs and names.
  Use 'appcircle build variable view --variableGroupId <uuid>' to see existing variables.
`,
            params: [
              {
                name: 'variableGroupId',
                description: 'Variable Group Name (ID)',
                type: CommandParameterTypes.SELECT,
                valueType: 'uuid',
                required: false,
              },
              {
                name: 'variableGroup',
                description: "Variable Group Name instead of 'variableGroupId'",
                type: CommandParameterTypes.STRING,
                valueType: 'string',
                required: false,
                requriedForInteractiveMode: false,
                skipForInteractiveMode: true,
                params: [],
              },
              {
                name: 'type',
                description: 'Type',
                type: CommandParameterTypes.SELECT,
                valueType: 'string',
                required: true,
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
                required: true,
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
            description: 'Get List of Environment Variables',
            longDescription: `
USAGE
  appcircle build variable view --variableGroupId <uuid>
  appcircle build variable view --variableGroup <string>

REQUIRED OPTIONS
  --variableGroupId <uuid>    Variable group ID (UUID format)
  --variableGroup <string>    Variable group name (alternative to --variableGroupId)

DESCRIPTION
  View all environment variables in a specified variable group.

EXAMPLES
  appcircle build variable view --variableGroupId 550e8400-e29b-41d4-a716-446655440000
  appcircle build variable view --variableGroup "CustomScriptVariables"

LEARN MORE
  Use 'appcircle build variable group list' to get available groups with their UUIDs and names.
  Use 'appcircle build variable create --variableGroupId <uuid>' to add new variables.
`,
            params: [
              {
                name: 'variableGroupId',
                description: 'Variable Groups Name (ID)',
                type: CommandParameterTypes.SELECT,
                valueType: 'uuid',
                required: false,
              },
              {
                name: 'variableGroup',
                description: "Variable Group Name instead of 'variableGroupId'",
                type: CommandParameterTypes.STRING,
                valueType: 'string',
                required: false,
                requriedForInteractiveMode: false,
                skipForInteractiveMode: true,
                params: [],
              },
            ],
          },
        ],
        params: []
      }
    ],
    params: []
  },
  {
    command: CommandTypes.SIGNING_IDENTITY,
    description: 'Signing Identities',
    longDescription: `Manage iOS certificates, provisioning profiles, and Android keystores for app signing

DESCRIPTION
  The signing-identity command helps you manage all code signing assets for your mobile applications.
  This includes iOS certificates (.p12), provisioning profiles (.mobileprovision), and Android keystores (.jks/.keystore).

SUBCOMMANDS
  certificate:         Manage iOS certificates (.p12 files)
  provisioning-profile: Manage iOS provisioning profiles (.mobileprovision files)  
  keystore:            Manage Android keystores (.jks/.keystore files)

USAGE
  appcircle signing-identity <subcommand> <action> [flags]

EXAMPLES
  appcircle signing-identity certificate list
  appcircle signing-identity provisioning-profile upload --path ./profile.mobileprovision
  appcircle signing-identity keystore create --name "MyApp" --password "secure123" --alias "myapp" --aliasPassword "alias123" --validity "25"

LEARN MORE
  Use 'appcircle signing-identity certificate --help' for iOS certificate management.
  Use 'appcircle signing-identity provisioning-profile --help' for provisioning profile management.
  Use 'appcircle signing-identity keystore --help' for Android keystore management.`,
    params: [],
    subCommands:[
      {
        command: 'certificate',
        description: 'iOS Certificate Actions',
        longDescription: `Manage iOS certificates for app signing

DESCRIPTION
  iOS certificates (.p12 files) are required for signing iOS applications during the build process.
  You can upload existing certificates, create new certificate signing requests, and manage your certificate inventory.

SUBCOMMANDS
  list:     List all uploaded iOS certificates
  upload:   Upload a new certificate bundle (.p12)
  create:   Generate a Certificate Signing Request (CSR)
  view:     View details of a certificate bundle
  download: Download a certificate file
  remove:   Remove a certificate from your organization

USAGE
  appcircle signing-identity certificate <action> [flags]

EXAMPLES
  appcircle signing-identity certificate list
  appcircle signing-identity certificate upload --path ./ios_distribution.p12 --password "mypassword"
  appcircle signing-identity certificate create --name "John Doe" --email "john@company.com" --countryCode "US"

LEARN MORE
  Use 'appcircle signing-identity certificate <action> --help' for detailed command help.`,
        params:[],
        subCommands: [
          {
            command: 'list',
            description: 'Certificates List',
            longDescription: `Get a list of all uploaded iOS certificates

USAGE
  appcircle signing-identity certificate list

DESCRIPTION
  View all iOS certificates (.p12 files) that have been uploaded to your organization.
  This includes certificates for development, distribution, and other iOS signing purposes.

EXAMPLES
  appcircle signing-identity certificate list

LEARN MORE
  Use 'appcircle signing-identity certificate upload --path <path> --password <password>' to upload new certificates.
  Use 'appcircle signing-identity certificate view --certificateBundleId <uuid>' to view certificate details.`,
            params:[],
          },
          {
            command: 'upload',
            description: 'Upload a New Certificate Bundle (.p12)',
            longDescription: `Upload a new iOS certificate bundle to your organization

USAGE
  appcircle signing-identity certificate upload --path <path> --password <password>

REQUIRED OPTIONS
  --path <path>         Path to the certificate file (.p12 format)
  --password <password> Certificate bundle password

DESCRIPTION
  Upload and install a new iOS certificate bundle (.p12 file) for code signing.
  The certificate will be available for use in your iOS build processes.

EXAMPLES
  appcircle signing-identity certificate upload --path ./ios_distribution.p12 --password "mypassword"
  appcircle signing-identity certificate upload --path ~/certificates/dev_cert.p12 --password "securepass"

LEARN MORE
  Use 'appcircle signing-identity certificate list' to view uploaded certificates.
  Use 'appcircle signing-identity certificate view --certificateBundleId <uuid>' to see certificate details.`,
            params:[
              {
                name: 'path',
                description: 'Certificate Path',
                type: CommandParameterTypes.STRING,
                valueType: 'path',
                required: true
              },
              {
                name: 'password',
                description: 'Certificate Password',
                type: CommandParameterTypes.PASSWORD,
                valueType: 'string',
                required: true
              },
            ],
          },
          {
            command: 'create',
            description: 'Generate Signing Request to Create Certificates',
            longDescription: `Generate a Certificate Signing Request (CSR) for iOS certificate creation

USAGE
  appcircle signing-identity certificate create --name <name> --email <email> --countryCode <code>

REQUIRED OPTIONS
  --name <name>             Certificate name/Common Name
  --email <email>           Email address for the certificate
  --countryCode <code>      Two-letter country code (e.g., US, TR, GB)

DESCRIPTION
  Generate a Certificate Signing Request (CSR) that can be used to create iOS certificates.
  The CSR contains your public key and identifying information.

EXAMPLES
  appcircle signing-identity certificate create --name "John Doe" --email "john@company.com" --countryCode "US"
  appcircle signing-identity certificate create --name "iOS Developer" --email "dev@myapp.com" --countryCode "TR"

LEARN MORE
  Use 'appcircle signing-identity certificate upload --path <path> --password <password>' to upload the resulting certificate.
  Use 'appcircle signing-identity certificate list' to view existing certificates.`,
            params:[
              {
                name: 'name',
                description: 'Certificate Name',
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
                description: 'Country Code',
                type: CommandParameterTypes.SELECT,
                valueType: 'string',
                required: true,
              },
            ],
          },
          {
            command: 'view',
            description: 'View Details of a Certificate Bundle. (.p12)',
            longDescription: `View detailed information about an iOS certificate bundle

USAGE
  appcircle signing-identity certificate view --certificateBundleId <uuid>
  appcircle signing-identity certificate view --certificate <string>

REQUIRED OPTIONS
  --certificateBundleId <uuid>  Certificate bundle ID (UUID format)
  --certificate <string>        Certificate name (alternative to --certificateBundleId)

DESCRIPTION
  Display detailed information about a specific iOS certificate bundle,
  including validity dates, issuer information, and certificate type.

EXAMPLES
  appcircle signing-identity certificate view --certificateBundleId 550e8400-e29b-41d4-a716-446655440000
  appcircle signing-identity certificate view --certificate "iOS Distribution Certificate"

LEARN MORE
  Use 'appcircle signing-identity certificate list' to get available certificates with their UUIDs and names.
  Use 'appcircle signing-identity certificate download --certificateId <uuid>' to download the certificate.`,
            params:[
              {
                name: 'certificateBundleId',
                description: 'Certificate Name (Bundle ID)',
                type: CommandParameterTypes.SELECT,
                valueType: 'uuid',
                required: false,
              },
              {
                name: 'certificate',
                description: "Certificate Name instead of 'certificateBundleId'",
                type: CommandParameterTypes.STRING,
                valueType: 'string',
                required: false,
                requriedForInteractiveMode: false,
                skipForInteractiveMode: true,
                params: [],
              },
            ],
          },
          {
            command: 'download',
            description: 'Download Certificate',
            longDescription: `Download an iOS certificate file to your local machine

USAGE
  appcircle signing-identity certificate download --certificateId <uuid> [--path <directory>]
  appcircle signing-identity certificate download --certificate <string> [--path <directory>]

REQUIRED OPTIONS
  --certificateId <uuid>  Certificate ID (UUID format)
  --certificate <string>  Certificate name (alternative to --certificateId)

OPTIONAL OPTIONS
  --path <directory>      Directory path for certificate to be downloaded (defaults to current directory)

DESCRIPTION
  Download a specific iOS certificate file (.p12) to your local machine for backup or use.

EXAMPLES
  appcircle signing-identity certificate download --certificateId 550e8400-e29b-41d4-a716-446655440000
  appcircle signing-identity certificate download --certificate "iOS Distribution Certificate" --path ./certificates

LEARN MORE
  Use 'appcircle signing-identity certificate list' to get available certificates with their UUIDs and names.
  Use 'appcircle signing-identity certificate view --certificateBundleId <uuid>' to see certificate details.`,
            params:[
              {
                name: 'path',
                description: '[OPTIONAL] The Path for certificate to be downloaded:',
                longDescription:'[OPTIONAL] The Path for certificate to be downloaded: (Defaults to the current directory)',
                type: CommandParameterTypes.STRING,
                valueType: 'string',
                required: false,
              },
              {
                name: 'certificateId',
                description: 'Certificate Name (Bundle ID)',
                type: CommandParameterTypes.SELECT,
                valueType: 'uuid',
                required: false,
              },
              {
                name: 'certificate',
                description: "Certificate Name instead of 'certificateId'",
                type: CommandParameterTypes.STRING,
                valueType: 'string',
                required: false,
                requriedForInteractiveMode: false,
                skipForInteractiveMode: true,
                params: [],
              },
            ],
          },
          {
            command: 'remove',
            description: 'Remove Certificate',
            longDescription: `Remove an iOS certificate from your organization

USAGE
  appcircle signing-identity certificate remove --certificateId <uuid>
  appcircle signing-identity certificate remove --certificate <string>

REQUIRED OPTIONS
  --certificateId <uuid>  Certificate ID (UUID format)
  --certificate <string>  Certificate name (alternative to --certificateId)

DESCRIPTION
  Permanently remove a specific iOS certificate from your organization.
  This action cannot be undone.

EXAMPLES
  appcircle signing-identity certificate remove --certificateId 550e8400-e29b-41d4-a716-446655440000
  appcircle signing-identity certificate remove --certificate "iOS Distribution Certificate"

LEARN MORE
  Use 'appcircle signing-identity certificate list' to get available certificates with their UUIDs and names.
  Use 'appcircle signing-identity certificate view --certificateBundleId <uuid>' to see certificate details before removal.`,
            params:[
              {
                name: 'certificateId',
                description: 'Certificate Name (Bundle ID)',
                type: CommandParameterTypes.SELECT,
                valueType: 'uuid',
                required: false,
              },
              {
                name: 'certificate',
                description: "Certificate Name instead of 'certificateId'",
                type: CommandParameterTypes.STRING,
                valueType: 'string',
                required: false,
                requriedForInteractiveMode: false,
                skipForInteractiveMode: true,
                params: [],
              },
            ],
          }
        ]
      },
      {
        command: 'provisioning-profile',
        description: 'iOS Provisioning Profile Actions',
        longDescription: `Manage iOS provisioning profiles for app signing

DESCRIPTION
  iOS provisioning profiles (.mobileprovision files) are required for signing and distributing iOS applications.
  They link your certificates, App IDs, and devices together for proper code signing.

SUBCOMMANDS
  list:     List all uploaded provisioning profiles
  upload:   Upload a new provisioning profile (.mobileprovision)
  view:     View details of a provisioning profile
  download: Download a provisioning profile file
  remove:   Remove a provisioning profile from your organization

USAGE
  appcircle signing-identity provisioning-profile <action> [flags]

EXAMPLES
  appcircle signing-identity provisioning-profile list
  appcircle signing-identity provisioning-profile upload --path ./AppStore_Distribution.mobileprovision
  appcircle signing-identity provisioning-profile view --provisioningProfileId 550e8400-e29b-41d4-a716-446655440000

LEARN MORE
  Use 'appcircle signing-identity provisioning-profile <action> --help' for detailed command help.`,
        params:[],
        subCommands: [
          {
            command: 'list',
            description: 'Provisioning Profile List',
            longDescription: `Get a list of all uploaded iOS provisioning profiles

USAGE
  appcircle signing-identity provisioning-profile list

DESCRIPTION
  View all iOS provisioning profiles (.mobileprovision files) that have been uploaded to your organization.
  This includes development, ad-hoc, and App Store distribution provisioning profiles.

EXAMPLES
  appcircle signing-identity provisioning-profile list

LEARN MORE
  Use 'appcircle signing-identity provisioning-profile upload --path <path>' to upload new profiles.
  Use 'appcircle signing-identity provisioning-profile view --provisioningProfileId <uuid>' to view profile details.`,
            params:[],
          },
          {
            command: 'upload',
            description: 'Upload a Provisioning Profile (.mobileprovision)',
            longDescription: `Upload a new iOS provisioning profile to your organization

USAGE
  appcircle signing-identity provisioning-profile upload --path <path>

REQUIRED OPTIONS
  --path <path>  Path to the provisioning profile file (.mobileprovision format)

DESCRIPTION
  Upload and install a new iOS provisioning profile (.mobileprovision file) for code signing.
  The profile will be available for use in your iOS build processes.

EXAMPLES
  appcircle signing-identity provisioning-profile upload --path ./AppStore_Distribution.mobileprovision
  appcircle signing-identity provisioning-profile upload --path ~/profiles/Development_Profile.mobileprovision

LEARN MORE
  Use 'appcircle signing-identity provisioning-profile list' to view uploaded profiles.`,
            params:[{
              name: 'path',
              description: 'Provisioning Profile Path',
              type: CommandParameterTypes.STRING,
              valueType: 'path',
              required: true
            }],
          },
          {
            command: 'download',
            description: 'Download Provisioning Profile',
            longDescription: `Download an iOS provisioning profile to your local machine

USAGE
  appcircle signing-identity provisioning-profile download --provisioningProfileId <uuid> [--path <directory>]
  appcircle signing-identity provisioning-profile download --provisioningProfile <string> [--path <directory>]

REQUIRED OPTIONS
  --provisioningProfileId <uuid>  Provisioning profile ID (UUID format)
  --provisioningProfile <string>  Provisioning profile name (alternative to --provisioningProfileId)

OPTIONAL OPTIONS
  --path <directory>              Directory path for profile to be downloaded (defaults to current directory)

DESCRIPTION
  Download a specific iOS provisioning profile (.mobileprovision) to your local machine for backup or use.

EXAMPLES
  appcircle signing-identity provisioning-profile download --provisioningProfileId 550e8400-e29b-41d4-a716-446655440000
  appcircle signing-identity provisioning-profile download --provisioningProfile "iOS Team Provisioning Profile" --path ./profiles

LEARN MORE
  Use 'appcircle signing-identity provisioning-profile list' to get available profiles with their UUIDs and names.
  Use 'appcircle signing-identity provisioning-profile view --provisioningProfileId <uuid>' to see profile details.`,
            params:[
              {
                name: 'path',
                description: '[OPTIONAL] The Path for provisioning profile to be downloaded:',
                longDescription:'[OPTIONAL] The Path for provisioning profile to be downloaded: (Defaults to the current directory)',
                type: CommandParameterTypes.STRING,
                valueType: 'string',
                required: false,
              },
              {
                name: 'provisioningProfileId',
                description: 'Provisioning Profile Name (ID)',
                type: CommandParameterTypes.SELECT,
                valueType: 'uuid',
                required: false,
              },
              {
                name: 'provisioningProfile',
                description: "Provisioning Profile Name instead of 'provisioningProfileId'",
                type: CommandParameterTypes.STRING,
                valueType: 'string',
                required: false,
                requriedForInteractiveMode: false,
                skipForInteractiveMode: true,
                params: [],
              },
            ],
          },
          {
            command: 'view',
            description: 'View Details of a Provisioning Profile',
            longDescription: `View detailed information about an iOS provisioning profile

USAGE
  appcircle signing-identity provisioning-profile view --provisioningProfileId <uuid>
  appcircle signing-identity provisioning-profile view --provisioningProfile <string>

REQUIRED OPTIONS
  --provisioningProfileId <uuid>  Provisioning profile ID (UUID format)
  --provisioningProfile <string>  Provisioning profile name (alternative to --provisioningProfileId)

DESCRIPTION
  Display detailed information about a specific iOS provisioning profile,
  including expiration date, app identifiers, devices, and certificates.

EXAMPLES
  appcircle signing-identity provisioning-profile view --provisioningProfileId 550e8400-e29b-41d4-a716-446655440000
  appcircle signing-identity provisioning-profile view --provisioningProfile "iOS Team Provisioning Profile"

LEARN MORE
  Use 'appcircle signing-identity provisioning-profile list' to get available profiles with their UUIDs and names.
  Use 'appcircle signing-identity provisioning-profile download --provisioningProfileId <uuid>' to download the profile.`,
            params:[
              {
                name: 'provisioningProfileId',
                description: 'Provisioning Profile Name (ID)',
                type: CommandParameterTypes.SELECT,
                valueType: 'uuid',
                required: false,
              },
              {
                name: 'provisioningProfile',
                description: "Provisioning Profile Name instead of 'provisioningProfileId'",
                type: CommandParameterTypes.STRING,
                valueType: 'string',
                required: false,
                requriedForInteractiveMode: false,
                skipForInteractiveMode: true,
                params: [],
              },
            ],
          },
          {
            command: 'remove',
            description: 'Remove Provisioning Profile',
            longDescription: `Remove an iOS provisioning profile from your organization

USAGE
  appcircle signing-identity provisioning-profile remove --provisioningProfileId <uuid>
  appcircle signing-identity provisioning-profile remove --provisioningProfile <string>

REQUIRED OPTIONS
  --provisioningProfileId <uuid>  Provisioning profile ID (UUID format)
  --provisioningProfile <string>  Provisioning profile name (alternative to --provisioningProfileId)

DESCRIPTION
  Permanently remove a specific iOS provisioning profile from your organization.
  This action cannot be undone.

EXAMPLES
  appcircle signing-identity provisioning-profile remove --provisioningProfileId 550e8400-e29b-41d4-a716-446655440000
  appcircle signing-identity provisioning-profile remove --provisioningProfile "iOS Team Provisioning Profile"

LEARN MORE
  Use 'appcircle signing-identity provisioning-profile list' to get available profiles with their UUIDs and names.
  Use 'appcircle signing-identity provisioning-profile view --provisioningProfileId <uuid>' to see profile details before removal.`,
            params:[
              {
                name: 'provisioningProfileId',
                description: 'Provisioning Profile Name (ID)',
                type: CommandParameterTypes.SELECT,
                valueType: 'uuid',
                required: false,
              },
              {
                name: 'provisioningProfile',
                description: "Provisioning Profile Name instead of 'provisioningProfileId'",
                type: CommandParameterTypes.STRING,
                valueType: 'string',
                required: false,
                requriedForInteractiveMode: false,
                skipForInteractiveMode: true,
                params: [],
              },
            ],
          },
        ],
      },
      {
        command: 'keystore',
        description: 'Android Keystore Actions',
        longDescription: `Manage Android keystores for app signing

DESCRIPTION
  Android keystores (.jks or .keystore files) are required for signing Android applications.
  You can upload existing keystores, create new ones, and manage your keystore inventory for Android builds.

SUBCOMMANDS
  list:     List all uploaded Android keystores
  create:   Generate a new keystore
  upload:   Upload a keystore file (.jks or .keystore)
  view:     View details of a keystore
  download: Download a keystore file
  remove:   Remove a keystore from your organization

USAGE
  appcircle signing-identity keystore <action> [flags]

EXAMPLES
  appcircle signing-identity keystore list
  appcircle signing-identity keystore create --name "MyApp Keystore" --password "secure123" --alias "myapp" --aliasPassword "alias123" --validity "25"
  appcircle signing-identity keystore upload --path ./release.jks --password "keystore123" --aliasPassword "alias123"

LEARN MORE
  Use 'appcircle signing-identity keystore <action> --help' for detailed command help.`,
        params:[],
        subCommands: [
          {
            command: 'list',
            description: 'Keystores List',
            longDescription: `Get a list of all uploaded Android keystores

USAGE
  appcircle signing-identity keystore list

DESCRIPTION
  View all Android keystores (.jks or .keystore files) that have been uploaded to your organization.
  These keystores are used for signing Android applications.

EXAMPLES
  appcircle signing-identity keystore list

LEARN MORE
  Use 'appcircle signing-identity keystore upload --path <path> --password <password> --aliasPassword <password>' to upload new keystores.
  Use 'appcircle signing-identity keystore view --keystoreId <uuid>' to view keystore details.`,
            params: [],
          },
          {
            command: 'create',
            description: 'Generate a New Keystore',
            longDescription: `Generate a new Android keystore for app signing

USAGE
  appcircle signing-identity keystore create --name <name> --password <password> --alias <alias> --aliasPassword <password> --validity <years>

REQUIRED OPTIONS
  --name <name>                   Keystore name
  --password <password>           Keystore password
  --alias <alias>                 Key alias name
  --aliasPassword <password>      Alias password
  --validity <years>              Validity period in years

DESCRIPTION
  Generate a new Android keystore (.jks) file with the specified parameters for app signing.
  The keystore will be created and stored securely in your organization.

EXAMPLES
  appcircle signing-identity keystore create --name "MyApp Keystore" --password "secure123" --alias "myapp" --aliasPassword "alias123" --validity "25"
  appcircle signing-identity keystore create --name "Release Key" --password "prod456" --alias "release" --aliasPassword "rel456" --validity "30"

LEARN MORE
  Use 'appcircle signing-identity keystore list' to view generated keystores.
  Use 'appcircle signing-identity keystore view --keystoreId <uuid>' to see keystore details.`,
                params: [
                  {
              name: 'name',
              description: 'Keystore Name',
              type: CommandParameterTypes.STRING,
              valueType: 'string',
            },
            {
              name: 'password',
              description: 'Keystore Password',
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
              description: 'Alias password',
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
            description: 'Upload Keystore File (.jks or .keystore)',
            longDescription: `Upload an Android keystore file to your organization

USAGE
  appcircle signing-identity keystore upload --path <path> --password <password> --aliasPassword <password>

REQUIRED OPTIONS
  --path <path>                   Path to the keystore file (.jks or .keystore format)
  --password <password>           Keystore password
  --aliasPassword <password>      Alias password

DESCRIPTION
  Upload and install an Android keystore (.jks or .keystore) file for app signing.
  The keystore will be available for use in your Android build processes.

EXAMPLES
  appcircle signing-identity keystore upload --path ./release.jks --password "keystore123" --aliasPassword "alias123"
  appcircle signing-identity keystore upload --path ~/keystores/myapp.keystore --password "secure456" --aliasPassword "key456"

LEARN MORE
  Use 'appcircle signing-identity keystore list' to view uploaded keystores.
  Use 'appcircle signing-identity keystore view --keystoreId <uuid>' to see keystore details.`,
            params: [
              {
                name: 'path',
                description: 'Keystore Path',
                type: CommandParameterTypes.STRING,
                valueType: 'path',
                required: true
              },
              {
                name: 'password',
                description: 'Keystore Password',
                type: CommandParameterTypes.PASSWORD,
                valueType: 'string',
                required: true
              },
              {
                name: 'aliasPassword',
                description: 'Alias Password',
                type: CommandParameterTypes.PASSWORD,
                valueType: 'string',
                required: true
              },
            ]
          },
          {
            command: 'download',
            description: 'Download Keystore File (.jks or .keystore)',
            longDescription: `Download an Android keystore file to your local machine

USAGE
  appcircle signing-identity keystore download --keystoreId <uuid> [--path <directory>]
  appcircle signing-identity keystore download --keystore <string> [--path <directory>]

REQUIRED OPTIONS
  --keystoreId <uuid>  Keystore ID (UUID format)
  --keystore <string>  Keystore name (alternative to --keystoreId)

OPTIONAL OPTIONS
  --path <directory>   Directory path for keystore to be downloaded (defaults to current directory)

DESCRIPTION
  Download a specific Android keystore file (.jks or .keystore) to your local machine for backup or use.

EXAMPLES
  appcircle signing-identity keystore download --keystoreId 550e8400-e29b-41d4-a716-446655440000
  appcircle signing-identity keystore download --keystore "MyApp Release Keystore" --path ./keystores

LEARN MORE
  Use 'appcircle signing-identity keystore list' to get available keystores with their UUIDs and names.
  Use 'appcircle signing-identity keystore view --keystoreId <uuid>' to see keystore details.`,
            params: [
              {
                name: 'path',
                description: '[OPTIONAL] The Path for keystore file to be downloaded:',
                longDescription:'[OPTIONAL] The Path for keystore file to be downloaded: (Defaults to the current directory)',
                type: CommandParameterTypes.STRING,
                valueType: 'string',
                required: false,
              },
              {
                name: 'keystoreId',
                description: 'Keystore Name (ID)',
                type: CommandParameterTypes.SELECT,
                valueType: 'uuid',
                required: false,
              },
              {
                name: 'keystore',
                description: "Keystore Name instead of 'keystoreId'",
                type: CommandParameterTypes.STRING,
                valueType: 'string',
                required: false,
                requriedForInteractiveMode: false,
                skipForInteractiveMode: true,
                params: [],
              },
            ]
          },
          {
            command: 'view',
            description: 'View Details of Keystore',
            longDescription: `View detailed information about an Android keystore

USAGE
  appcircle signing-identity keystore view --keystoreId <uuid>
  appcircle signing-identity keystore view --keystore <string>

REQUIRED OPTIONS
  --keystoreId <uuid>  Keystore ID (UUID format)
  --keystore <string>  Keystore name (alternative to --keystoreId)

DESCRIPTION
  Display detailed information about a specific Android keystore,
  including creation date, validity, and associated aliases.

EXAMPLES
  appcircle signing-identity keystore view --keystoreId 550e8400-e29b-41d4-a716-446655440000
  appcircle signing-identity keystore view --keystore "MyApp Release Keystore"

LEARN MORE
  Use 'appcircle signing-identity keystore list' to get available keystores with their UUIDs and names.
  Use 'appcircle signing-identity keystore download --keystoreId <uuid>' to download the keystore.`,
            params:[
              {
                name: 'keystoreId',
                description: 'Keystore Name (ID)',
                type: CommandParameterTypes.SELECT,
                valueType: 'uuid',
                required: false,
              },
              {
                name: 'keystore',
                description: "Keystore Name instead of 'keystoreId'",
                type: CommandParameterTypes.STRING,
                valueType: 'string',
                required: false,
                requriedForInteractiveMode: false,
                skipForInteractiveMode: true,
                params: [],
              },
            ],
          },
          {
            command: 'remove',
            description: 'Remove Keystore',
            longDescription: `Remove an Android keystore from your organization

USAGE
  appcircle signing-identity keystore remove --keystoreId <uuid>
  appcircle signing-identity keystore remove --keystore <string>

REQUIRED OPTIONS
  --keystoreId <uuid>  Keystore ID (UUID format)
  --keystore <string>  Keystore name (alternative to --keystoreId)

DESCRIPTION
  Permanently remove a specific Android keystore from your organization.
  This action cannot be undone.

EXAMPLES
  appcircle signing-identity keystore remove --keystoreId 550e8400-e29b-41d4-a716-446655440000
  appcircle signing-identity keystore remove --keystore "MyApp Release Keystore"

LEARN MORE
  Use 'appcircle signing-identity keystore list' to get available keystores with their UUIDs and names.
  Use 'appcircle signing-identity keystore view --keystoreId <uuid>' to see keystore details before removal.`,
            params:[
              {
                name: 'keystoreId',
                description: 'Keystore Name (ID)',
                type: CommandParameterTypes.SELECT,
                valueType: 'uuid',
                required: false,
              },
              {
                name: 'keystore',
                description: "Keystore Name instead of 'keystoreId'",
                type: CommandParameterTypes.STRING,
                valueType: 'string',
                required: false,
                requriedForInteractiveMode: false,
                skipForInteractiveMode: true,
                params: [],
              },
            ],
          }
        ]
      }
    ],
  },
  {
    command: CommandTypes.TESTING_DISTRIBUTION,
    description: 'Testing Distribution',
    longDescription: `Manage mobile app testing distribution to testers and testing groups

DESCRIPTION
  The testing-distribution command helps you distribute your mobile applications to testers for validation.
  You can upload apps to distribution profiles, manage testing groups, configure automated distribution,
  and organize testers for effective app testing workflows.

SUBCOMMANDS
  upload:         Upload mobile apps to distribution profiles
  profile:        Manage distribution profiles and settings
  testing-group:  Manage testing groups and testers

USAGE
  appcircle testing-distribution <subcommand> <action> [flags]

EXAMPLES
  appcircle testing-distribution upload --distProfileId 550e8400-e29b-41d4-a716-446655440000 --app ./MyApp.ipa --message "New beta version"
  appcircle testing-distribution profile list
  appcircle testing-distribution testing-group create --name "QA Team"

LEARN MORE
  Use 'appcircle testing-distribution upload --help' for app upload details.
  Use 'appcircle testing-distribution profile --help' for profile management.
  Use 'appcircle testing-distribution testing-group --help' for testing group management.`,
    params: [],
    subCommands: [
      {
        command: 'upload',
        description: 'Upload Mobile Apps to Distribution Profiles',
        longDescription: `Upload your mobile application to a testing distribution profile

USAGE
  appcircle testing-distribution upload --distProfileId <uuid> --app <path> --message <message>
  appcircle testing-distribution upload --profile <string> --app <path> --message <message>

REQUIRED OPTIONS
  --distProfileId <uuid>  Distribution profile ID (UUID format)
  --profile <string>      Distribution profile name (alternative to --distProfileId)
  --app <path>           Path to the mobile app file (.ipa for iOS, .apk/.aab for Android)
  --message <message>    Release notes for this distribution

DESCRIPTION
  Upload a mobile application binary to a specified distribution profile for testing.
  The app will be distributed to testers according to the profile's configuration.

EXAMPLES
  appcircle testing-distribution upload --distProfileId 550e8400-e29b-41d4-a716-446655440000 --app ./MyApp.ipa --message "Fixed login bug"
  appcircle testing-distribution upload --profile "Beta Testing" --app ./MyApp.apk --message "New feature release"

LEARN MORE
  Use 'appcircle testing-distribution profile list' to get available distribution profiles with their UUIDs and names.
  Use 'appcircle testing-distribution profile settings auto-send' to configure automated distribution.`,
        params: [
          {
            name: 'distProfileId',
            description: 'Distribution Profile Name (ID)',
            type: CommandParameterTypes.SELECT,
            valueType: 'uuid',
            required: false,
          },
          {
            name: 'profile',
            description: "Distribution Profile Name instead of 'distProfileId'",
            type: CommandParameterTypes.STRING,
            valueType: 'string',
            required: false,
            requriedForInteractiveMode: false,
            skipForInteractiveMode: true,
            params: [],
          },
          {
            name: 'message',
            description: 'Release Notes',
            type: CommandParameterTypes.STRING,
            valueType: 'string',
          },
          {
            name: 'app',
            description: 'App Path',
            type: CommandParameterTypes.STRING,
            valueType: 'path',
          },
        ],
      },
      {
        command:'profile',
        description: 'Distribution Profile Actions',
        longDescription: `Manage testing distribution profiles and their settings

DESCRIPTION
  Distribution profiles define how and to whom your mobile applications are distributed for testing.
  You can create new profiles, configure automated distribution settings, and manage distribution workflows.

SUBCOMMANDS
  list:     List all distribution profiles
  create:   Create a new distribution profile
  settings: Configure Distribution Profile Settings

USAGE
  appcircle testing-distribution profile <action> [flags]

EXAMPLES
  appcircle testing-distribution profile list
  appcircle testing-distribution profile create --name "Beta Testing"
  appcircle testing-distribution profile settings auto-send --distProfileId 550e8400-e29b-41d4-a716-446655440000

LEARN MORE
  Use 'appcircle testing-distribution profile <action> --help' for detailed command help.`,
        subCommands: [
          {
            command: 'list',
            description: 'Get List of Distribution Profiles',
            longDescription: `Get a list of all distribution profiles

USAGE
  appcircle testing-distribution profile list

DESCRIPTION
  View all distribution profiles that have been created for testing distribution.

EXAMPLES
  appcircle testing-distribution profile list

LEARN MORE
  Use 'appcircle testing-distribution profile create --name <name>' to create a new distribution profile.
  Use 'appcircle testing-distribution profile settings auto-send --distProfileId <uuid>' to configure automated distribution.`,
            params: [],
          },
          {
            command: 'create',
            description: 'Create a New Distribution Profile',
            longDescription: `Create a new distribution profile for testing distribution

USAGE
  appcircle testing-distribution profile create --name <name>

REQUIRED OPTIONS
  --name <name>  Name for the new distribution profile

DESCRIPTION
  Create a new distribution profile for testing distribution.

EXAMPLES
  appcircle testing-distribution profile create --name "Beta Testing"
  appcircle testing-distribution profile create --name "Staging Distribution"

LEARN MORE
  Use 'appcircle testing-distribution profile list' to see all available distribution profiles.`,
            params: [
              {
                name: 'name',
                description: 'Distribution Profile Name',
                type: CommandParameterTypes.STRING,
                valueType: 'string',
              },
            ],
          },
          {
            command: 'settings',
            description: 'Configure Distribution Profile Settings',
            longDescription: `Configure settings for a distribution profile

DESCRIPTION
  Distribution profiles can be configured to automatically send builds to testers or specific groups.
  You can also manage distribution workflows and testers for each profile.

SUBCOMMANDS
  auto-send:  Configure automated distribution settings
  add-tester: Add testers to the distribution profile
  remove-tester: Remove testers from the distribution profile
  add-group:  Add testing groups to the distribution profile
  remove-group: Remove testing groups from the distribution profile
  add-workflow: Add a distribution workflow
  remove-workflow: Remove a distribution workflow

USAGE
  appcircle testing-distribution profile settings <action> [flags]

EXAMPLES
  appcircle testing-distribution profile settings auto-send --distProfileId 550e8400-e29b-41d4-a716-446655440000
  appcircle testing-distribution profile settings add-tester --distProfileId 550e8400-e29b-41d4-a716-446655440000 --testerEmail "john@example.com"
  appcircle testing-distribution profile settings remove-tester --distProfileId 550e8400-e29b-41d4-a716-446655440000 --testerEmail "john@example.com"
  appcircle testing-distribution profile settings add-group --distProfileId 550e8400-e29b-41d4-a716-446655440000 --groupName "QA Team"
  appcircle testing-distribution profile settings remove-group --distProfileId 550e8400-e29b-41d4-a716-446655440000 --groupName "QA Team"
  appcircle testing-distribution profile settings add-workflow --distProfileId 550e8400-e29b-41d4-a716-446655440000 --workflowName "Daily Build"
  appcircle testing-distribution profile settings remove-workflow --distProfileId 550e8400-e29b-41d4-a716-446655440000 --workflowName "Daily Build"

LEARN MORE
  Use 'appcircle testing-distribution profile settings auto-send --distProfileId <uuid>' to configure automated distribution.
  Use 'appcircle testing-distribution profile settings add-tester --distProfileId <uuid> --testerEmail <email>' to add testers.
  Use 'appcircle testing-distribution profile settings remove-tester --distProfileId <uuid> --testerEmail <email>' to remove testers.
  Use 'appcircle testing-distribution profile settings add-group --distProfileId <uuid> --groupName <name>' to add testing groups.
  Use 'appcircle testing-distribution profile settings remove-group --distProfileId <uuid> --groupName <name>' to remove testing groups.
  Use 'appcircle testing-distribution profile settings add-workflow --distProfileId <uuid> --workflowName <name>' to add distribution workflows.
  Use 'appcircle testing-distribution profile settings remove-workflow --distProfileId <uuid> --workflowName <name>' to remove distribution workflows.`,
            params: [],
            subCommands: [
              {
                command: 'auto-send',
                description: 'Select the Test Groups for Automated Distribution',
                longDescription: `Configure automated distribution to testing groups

USAGE
  appcircle testing-distribution profile settings auto-send --distProfileId <uuid> --testingGroupIds <group-ids>
  appcircle testing-distribution profile settings auto-send --profile <string> --testingGroupIds <group-ids>

REQUIRED OPTIONS
  --distProfileId <uuid>      Distribution profile ID (UUID format)
  --profile <string>          Distribution profile name (alternative to --distProfileId)
  --testingGroupIds <ids>     Testing group IDs for automated distribution (multiple values supported)

DESCRIPTION
  Configure a distribution profile to automatically send builds to specified testing groups.
  When a new build is uploaded to this profile, it will be automatically distributed to the selected groups.

EXAMPLES
  appcircle testing-distribution profile settings auto-send --distProfileId 550e8400-e29b-41d4-a716-446655440000 --testingGroupIds "group1,group2"
  appcircle testing-distribution profile settings auto-send --profile "Beta Testing" --testingGroupIds "QA Team,Beta Testers"

LEARN MORE
  Use 'appcircle testing-distribution testing-group list' to get available testing groups.
  Use 'appcircle testing-distribution profile list' to get available distribution profiles with their UUIDs and names.`,
                params: [
                  {
                    name: 'distProfileId',
                    description: 'Distribution Profile Name (ID)',
                    type: CommandParameterTypes.SELECT,
                    valueType: 'uuid',
                    required: false,
                  },
                  {
                    name: 'profile',
                    description: "Distribution Profile Name instead of 'distProfileId'",
                    type: CommandParameterTypes.STRING,
                    valueType: 'string',
                    required: false,
                    requriedForInteractiveMode: false,
                    skipForInteractiveMode: true,
                    params: [],
                  },
                  {
                    name: 'testingGroupIds',
                    description: 'Testing Group Names (IDs) for automated Distribution',
                    longDescription: 'Testing Group IDs for automated Distribution',
                    type: CommandParameterTypes.MULTIPLE_SELECT,
                    valueType: 'string'
                  }
                ]
              }
            ]
          },
        ],
        params: []
      },
      {
        command: 'testing-group',
        description: 'Testing Group Actions',
        longDescription: `Manage testing groups and their testers

DESCRIPTION
  Testing groups are collections of testers who receive app distributions for testing.
  You can create groups, add/remove testers, and organize your testing workflow efficiently.

SUBCOMMANDS
  list:   List all testing groups
  view:   View details of a testing group
  create: Create a new testing group
  remove: Remove a testing group
  tester: Manage testers within testing groups

USAGE
  appcircle testing-distribution testing-group <action> [flags]

EXAMPLES
  appcircle testing-distribution testing-group list
  appcircle testing-distribution testing-group create --name "QA Team"
  appcircle testing-distribution testing-group tester add --testingGroupId 550e8400-e29b-41d4-a716-446655440000 --testerEmail "john@example.com"

LEARN MORE
  Use 'appcircle testing-distribution testing-group <action> --help' for detailed command help.`,
        params: [],
        subCommands: [
          {
            command: 'list',
            description: 'Get All Testing Group List of Current Organization',
            longDescription: `Get a list of all testing groups in your organization

USAGE
  appcircle testing-distribution testing-group list

DESCRIPTION
  View all testing groups that have been created in your organization.
  Testing groups are used to organize testers for app distribution.

EXAMPLES
  appcircle testing-distribution testing-group list

LEARN MORE
  Use 'appcircle testing-distribution testing-group create --name <name>' to create new testing groups.
  Use 'appcircle testing-distribution testing-group view --testingGroupId <uuid>' to see group details.`,
            params: [],
          },
          {
            command: 'view',
            description: 'View Details of Testing Group',
            longDescription: `View detailed information about a testing group

USAGE
  appcircle testing-distribution testing-group view --testingGroupId <uuid>
  appcircle testing-distribution testing-group view --testingGroup <string>

REQUIRED OPTIONS
  --testingGroupId <uuid>  Testing group ID (UUID format)
  --testingGroup <string>  Testing group name (alternative to --testingGroupId)

DESCRIPTION
  Display detailed information about a specific testing group,
  including the list of testers and group settings.

EXAMPLES
  appcircle testing-distribution testing-group view --testingGroupId 550e8400-e29b-41d4-a716-446655440000
  appcircle testing-distribution testing-group view --testingGroup "QA Team"

LEARN MORE
  Use 'appcircle testing-distribution testing-group list' to get available groups with their UUIDs and names.
  Use 'appcircle testing-distribution testing-group tester add' to add testers.`,
            params: [
              {
                name: 'testingGroupId',
                description: 'Testing group name (ID)',
                type: CommandParameterTypes.SELECT,
                valueType: 'uuid',
                required: false,
              },
              {
                name: 'testingGroup',
                description: "Testing Group Name instead of 'testingGroupId'",
                type: CommandParameterTypes.STRING,
                valueType: 'string',
                required: false,
                requriedForInteractiveMode: false,
                skipForInteractiveMode: true,
                params: [],
              }
            ],
          },
          {
            command: 'create',
            description: 'Create a New Testing Group',
            longDescription: `Create a new testing group for organizing testers

USAGE
  appcircle testing-distribution testing-group create --name <name>

REQUIRED OPTIONS
  --name <name>  Name for the new testing group

DESCRIPTION
  Create a new testing group to organize testers for app distribution.
  Testing groups help you manage different sets of testers for various testing scenarios.

EXAMPLES
  appcircle testing-distribution testing-group create --name "QA Team"
  appcircle testing-distribution testing-group create --name "Beta Testers"

LEARN MORE
  Use 'appcircle testing-distribution testing-group list' to view all testing groups.
  Use 'appcircle testing-distribution testing-group tester add --testingGroupId <uuid>' to add testers to the group.`,
            params: [
              {
                name: 'name',
                description: 'Testing Group Name',
                type: CommandParameterTypes.STRING,
                valueType: 'string',
              }
            ],
          },
          {
            command: 'remove',
            description: 'Remove Testing Group',
            longDescription: `Remove a testing group from your organization

USAGE
  appcircle testing-distribution testing-group remove --testingGroupId <uuid>
  appcircle testing-distribution testing-group remove --testingGroup <string>

REQUIRED OPTIONS
  --testingGroupId <uuid>  Testing group ID (UUID format)
  --testingGroup <string>  Testing group name (alternative to --testingGroupId)

DESCRIPTION
  Permanently remove a testing group from your organization.
  This action cannot be undone and will remove all testers from the group.

EXAMPLES
  appcircle testing-distribution testing-group remove --testingGroupId 550e8400-e29b-41d4-a716-446655440000
  appcircle testing-distribution testing-group remove --testingGroup "Old QA Team"

LEARN MORE
  Use 'appcircle testing-distribution testing-group list' to get available groups with their UUIDs and names.
  Use 'appcircle testing-distribution testing-group view' to see group details before removal.`,
            params: [
              {
                name: 'testingGroupId',
                description: 'Testing group name (ID)',
                type: CommandParameterTypes.SELECT,
                valueType: 'uuid',
                required: false,
              },
              {
                name: 'testingGroup',
                description: "Testing Group Name instead of 'testingGroupId'",
                type: CommandParameterTypes.STRING,
                valueType: 'string',
                required: false,
                requriedForInteractiveMode: false,
                skipForInteractiveMode: true,
                params: [],
              }
            ],
          },
          {
            command: 'tester',
            description: 'Testing Group Tester Actions',
            longDescription: `Manage testers within testing groups

DESCRIPTION
  Add or remove individual testers from testing groups to control who receives app distributions.
  Testers are identified by their email addresses.

SUBCOMMANDS
  add:    Add a tester to a testing group
  remove: Remove a tester from a testing group

USAGE
  appcircle testing-distribution testing-group tester <action> [flags]

EXAMPLES
  appcircle testing-distribution testing-group tester add --testingGroupId 550e8400-e29b-41d4-a716-446655440000 --testerEmail "john@example.com"
  appcircle testing-distribution testing-group tester remove --testingGroupId 550e8400-e29b-41d4-a716-446655440000 --testerEmail "john@example.com"

LEARN MORE
  Use 'appcircle testing-distribution testing-group tester <action> --help' for detailed command help.`,
            params:[],
            subCommands: [
              {
                command: 'add',
                description: 'Add Tester to Selected Testing Group',
                longDescription: `Add a tester to a testing group by email address

USAGE
  appcircle testing-distribution testing-group tester add --testingGroupId <uuid> --testerEmail <email>
  appcircle testing-distribution testing-group tester add --testingGroup <string> --testerEmail <email>

REQUIRED OPTIONS
  --testingGroupId <uuid>  Testing group ID (UUID format)
  --testingGroup <string>  Testing group name (alternative to --testingGroupId)
  --testerEmail <email>    Email address of the tester to add

DESCRIPTION
  Add a tester to a testing group so they will receive app distributions sent to that group.
  The tester will be notified by email when new builds are available.

EXAMPLES
  appcircle testing-distribution testing-group tester add --testingGroupId 550e8400-e29b-41d4-a716-446655440000 --testerEmail "john@example.com"
  appcircle testing-distribution testing-group tester add --testingGroup "QA Team" --testerEmail "qa-team@company.com"

LEARN MORE
  Use 'appcircle testing-distribution testing-group list' to get available testing groups with their UUIDs and names.
  Use 'appcircle testing-distribution testing-group view' to see current testers.`,
                params: [
                  {
                    name: 'testingGroupId',
                    description: 'Testing group name (ID)',
                    type: CommandParameterTypes.SELECT,
                    valueType: 'uuid',
                    required: false,
                  },
                  {
                    name: 'testingGroup',
                    description: "Testing Group Name instead of 'testingGroupId'",
                    type: CommandParameterTypes.STRING,
                    valueType: 'string',
                    required: false,
                    requriedForInteractiveMode: false,
                    skipForInteractiveMode: true,
                    params: [],
                  },
                  {
                    name: 'testerEmail',
                    description: 'Email of Tester',
                    type: CommandParameterTypes.STRING,
                    valueType: 'string',
                  }
                ]
              },
              {
                command: 'remove',
                description: 'Remove Selected Tester from Selected Testing Group',
                longDescription: `Remove a tester from a testing group

USAGE
  appcircle testing-distribution testing-group tester remove --testingGroupId <uuid> --testerEmail <email>
  appcircle testing-distribution testing-group tester remove --testingGroup <string> --testerEmail <email>

REQUIRED OPTIONS
  --testingGroupId <uuid>  Testing group ID (UUID format)
  --testingGroup <string>  Testing group name (alternative to --testingGroupId)
  --testerEmail <email>    Email address of the tester to remove

DESCRIPTION
  Remove a tester from a testing group so they will no longer receive app distributions sent to that group.

EXAMPLES
  appcircle testing-distribution testing-group tester remove --testingGroupId 550e8400-e29b-41d4-a716-446655440000 --testerEmail "john@example.com"
  appcircle testing-distribution testing-group tester remove --testingGroup "QA Team" --testerEmail "former-employee@company.com"

LEARN MORE
  Use 'appcircle testing-distribution testing-group list' to get available testing groups with their UUIDs and names.
  Use 'appcircle testing-distribution testing-group view' to see current testers.`,
                params: [
                  {
                    name: 'testingGroupId',
                    description: 'Testing group name (ID)',
                    type: CommandParameterTypes.SELECT,
                    valueType: 'uuid',
                    required: false,
                  },
                  {
                    name: 'testingGroup',
                    description: "Testing Group Name instead of 'testingGroupId'",
                    type: CommandParameterTypes.STRING,
                    valueType: 'string',
                    required: false,
                    requriedForInteractiveMode: false,
                    skipForInteractiveMode: true,
                    params: [],
                  },
                  {
                    name: 'testerEmail',
                    description: 'Email of Tester',
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
    longDescription: `Manage app publishing to app stores and distribution platforms

DESCRIPTION
  The publish command helps you distribute your mobile applications to various app stores and platforms.
  You can upload app versions, manage publishing workflows, configure auto-publishing settings,
  and track the status of your app submissions.

SUBCOMMANDS
  start:        Start a new app publishing process
  active-list:  View currently active publishing processes
  view:         View details of a publishing process
  profile:      Manage publishing profiles and app versions
  variable:     Manage publishing environment variables

USAGE
  appcircle publish <subcommand> <action> [flags]

EXAMPLES
  appcircle publish start --platform ios --publishProfileId <uuid> --appVersionId <uuid>
  appcircle publish active-list
  appcircle publish profile list --platform ios

LEARN MORE
  Use 'appcircle publish <subcommand> --help' for detailed command help.`,
    params: [],
    subCommands: [
      {
        command: 'start',
        description: 'Start a New App Publish',
        longDescription: `Start a new app publishing process to distribute your app

USAGE
  appcircle publish start --platform <platform> --publishProfileId <uuid> --appVersionId <uuid>
  appcircle publish start --platform <platform> --profile <string> --appVersion <string>

REQUIRED OPTIONS
  --platform <platform>           Platform (ios or android)
  --publishProfileId <uuid>       Publish profile ID (UUID format)
  --profile <string>              Publish profile name (alternative to --publishProfileId)
  --appVersionId <uuid>           App version ID (UUID format)
  --appVersion <string>           App version name (alternative to --appVersionId)

DESCRIPTION
  Start a new publishing process to distribute your mobile application to app stores or other platforms.
  The app version must be uploaded to the specified publish profile before starting the publishing process.

EXAMPLES
  appcircle publish start --platform ios --publishProfileId 550e8400-e29b-41d4-a716-446655440000 --appVersionId 6ba7b810-9dad-11d1-80b4-00c04fd430c8
  appcircle publish start --platform android --profile "Google Play Production" --appVersion "MyApp v2.1.0"

LEARN MORE
  Use 'appcircle publish profile list --platform <platform>' to get available publish profiles with their UUIDs and names.
  Use 'appcircle publish profile version list --platform <platform>' to get available app versions with their UUIDs and names.`,
        params: [
          platformParam,
          {
            name: 'publishProfileId',
            description: 'Publish Profile Name',
            type: CommandParameterTypes.SELECT,
            valueType: 'uuid',
            required: false
          },
          {
            name: 'profile',
            description: "Publish Profile Name instead of 'publishProfileId'",
            type: CommandParameterTypes.STRING,
            valueType: 'string',
            required: false,
            requriedForInteractiveMode: false,
            skipForInteractiveMode: true,
            params: [],
          },
          {
            name: 'appVersionId',
            description: 'App Version',
            type: CommandParameterTypes.SELECT,
            valueType: 'uuid',
            required: false
          },
          {
            name: 'appVersion',
            description: "App Version Name instead of 'appVersionId'",
            type: CommandParameterTypes.STRING,
            valueType: 'string',
            required: false,
            requriedForInteractiveMode: false,
            skipForInteractiveMode: true,
            params: [],
          }
        ],
      },
      {
        command: 'active-list',
        description: 'Get a List of Active Publishing Processes Currently in the Queue',
        longDescription: `Get a list of active publishing processes currently in the queue

USAGE
  appcircle publish active-list

DESCRIPTION
  View all publishing processes that are currently active or waiting in the publishing queue.
  This shows the status of ongoing app store submissions and distributions.

EXAMPLES
  appcircle publish active-list

LEARN MORE
  Use 'appcircle publish view --platform <platform> --publishProfileId <uuid> --appVersionId <uuid>' to see details of a specific publishing process.`,
        params: [],
      },
      {
        command: 'view',
        description: 'View Details of the Publishing Process by App Version',
        longDescription: `View detailed information about a publishing process

USAGE
  appcircle publish view --platform <platform> --publishProfileId <uuid> --appVersionId <uuid>
  appcircle publish view --platform <platform> --profile <string> --appVersion <string>

REQUIRED OPTIONS
  --platform <platform>           Platform (ios or android)
  --publishProfileId <uuid>       Publish profile ID (UUID format)
  --profile <string>              Publish profile name (alternative to --publishProfileId)
  --appVersionId <uuid>           App version ID (UUID format)
  --appVersion <string>           App version name (alternative to --appVersionId)

DESCRIPTION
  View comprehensive details about a publishing process for a specific app version,
  including submission status, review progress, and any error messages.

EXAMPLES
  appcircle publish view --platform ios --publishProfileId 550e8400-e29b-41d4-a716-446655440000 --appVersionId 6ba7b810-9dad-11d1-80b4-00c04fd430c8
  appcircle publish view --platform android --profile "Google Play Production" --appVersion "MyApp v2.1.0"

LEARN MORE
  Use 'appcircle publish profile list --platform <platform>' to get available publish profiles with their UUIDs and names.
  Use 'appcircle publish profile version list --platform <platform>' to get available app versions with their UUIDs and names.`,
        params: [
          platformParam,
          {
            name: 'publishProfileId',
            description: 'Publish Profile Name (ID)',
            type: CommandParameterTypes.SELECT,
            valueType: 'uuid',
            required: false
          },
          {
            name: 'profile',
            description: "Publish Profile Name instead of 'publishProfileId'",
            type: CommandParameterTypes.STRING,
            valueType: 'string',
            required: false,
            requriedForInteractiveMode: false,
            skipForInteractiveMode: true,
            params: [],
          },
          {
            name: 'appVersionId',
            description: 'App Version',
            type: CommandParameterTypes.SELECT,
            valueType: 'uuid',
            required: false
          },
          {
            name: 'appVersion',
            description: "App Version Name instead of 'appVersionId'",
            type: CommandParameterTypes.STRING,
            valueType: 'string',
            required: false,
            requriedForInteractiveMode: false,
            skipForInteractiveMode: true,
            params: [],
          }
        ],
      },
      {
        command: 'profile',
        description: 'Publish Profile Actions',
        longDescription: `Manage publishing profiles and app versions

DESCRIPTION
  Publishing profiles define how and where your mobile applications are distributed.
  You can create profiles for different app stores, manage app versions, and configure publishing settings.

SUBCOMMANDS
  list:     List all publishing profiles
  create:   Create a new publishing profile
  rename:   Rename an existing publishing profile
  delete:   Remove a publishing profile
  version:  Manage app versions within profiles
  settings: Configure publishing profile settings

USAGE
  appcircle publish profile <action> [flags]

EXAMPLES
  appcircle publish profile list --platform ios
  appcircle publish profile create --platform ios --name "App Store Production"
  appcircle publish profile version list --platform ios --publishProfileId 550e8400-e29b-41d4-a716-446655440000

LEARN MORE
  Use 'appcircle publish profile <action> --help' for detailed command help.`,
        params: [],
        subCommands: [
          {
            command: 'list',
            description: 'Publish Profile List',
            longDescription: `Get a list of all publishing profiles for a platform

USAGE
  appcircle publish profile list --platform <platform>

REQUIRED OPTIONS
  --platform <platform>  Platform (ios or android)

DESCRIPTION
  View all publishing profiles that have been created for the specified platform.
  Publishing profiles define distribution targets and settings for your apps.

EXAMPLES
  appcircle publish profile list --platform ios
  appcircle publish profile list --platform android

LEARN MORE
  Use 'appcircle publish profile create --platform <platform> --name <name>' to create new profiles.
  Use 'appcircle publish profile version list --platform <platform> --publishProfileId <uuid>' to see app versions.`,
            params: [platformParam],
          },
          {
            command: 'create',
            description: 'Create a Publish Profile',
            longDescription: `Create a new publish profile for a platform

DESCRIPTION
  A publish profile defines the configuration and target store for publishing your app. Use this command to create a new profile for iOS or Android platforms.

REQUIRED OPTIONS
  --platform <platform>  Platform (ios or android)
  --name <name>          Name for the new publish profile

EXAMPLES
  appcircle publish profile create --platform ios --name "App Store Production"
  appcircle publish profile create --platform android --name "Google Play Beta"

LEARN MORE
  Use 'appcircle publish profile list --platform <platform>' to see all profiles for a platform.`,
            params: [platformParam,
              {
                name: 'name',
                description: 'Profile Name',
                type: CommandParameterTypes.STRING,
                defaultValue: undefined,
                valueType: 'string',
                required: true,
              }
            ],
          },
          {
            command: 'rename',
            description: 'Rename Publish Profile',
            longDescription: `Rename an existing publish profile

DESCRIPTION
  Change the name of a publish profile for better organization or clarity.

REQUIRED OPTIONS
  --platform <platform>      Platform (ios or android)
  --publishProfileId <uuid>  Publish profile ID (UUID format)
  --name <name>              New profile name

EXAMPLES
  appcircle publish profile rename --platform ios --publishProfileId <uuid> --name "New Profile Name"

LEARN MORE
  Use 'appcircle publish profile list --platform <platform>' to get profile IDs.`,
            params: [platformParam,
              {
                name: 'publishProfileId',
                description: 'Publish Profile Name (ID)',
                type: CommandParameterTypes.SELECT,
                valueType: 'uuid',
                required: false
              },
              {
                name: 'profile',
                description: "Publish Profile Name instead of 'publishProfileId'",
                type: CommandParameterTypes.STRING,
                valueType: 'string',
                required: false,
                requriedForInteractiveMode: false,
                skipForInteractiveMode: true,
                params: [],
              },
              {
                name: 'name',
                description: 'New Profile Name',
                type: CommandParameterTypes.STRING,
                defaultValue: undefined,
                valueType: 'string',
                required: true,
              }
            ],
          },
          {
            command: 'delete',
            description: 'Remove Publish Profile',
            longDescription: `Remove a publish profile from your organization

DESCRIPTION
  Permanently deletes a publish profile and all associated configuration for the specified platform.

REQUIRED OPTIONS
  --platform <platform>      Platform (ios or android)
  --publishProfileId <uuid>  Publish profile ID (UUID format)
  --profile <string>         Publish profile name (alternative to --publishProfileId)

EXAMPLES
  appcircle publish profile delete --platform ios --publishProfileId <uuid>
  appcircle publish profile delete --platform android --profile "Google Play Production"

LEARN MORE
  Use 'appcircle publish profile list --platform <platform>' to get profile IDs and names.`,
            params: [platformParam,
              {
                name: 'publishProfileId',
                description: 'Publish Profile Name (ID)',
                type: CommandParameterTypes.SELECT,
                valueType: 'uuid',
                required: false
              },
              {
                name: 'profile',
                description: "Publish Profile Name instead of 'publishProfileId'",
                type: CommandParameterTypes.STRING,
                valueType: 'string',
                required: false,
                requriedForInteractiveMode: false,
                skipForInteractiveMode: true,
                params: [],
              }
            ],
          },
          {
            command: 'version',
            description: 'App Version Actions',
            longDescription: `Manage app versions within a publish profile

DESCRIPTION
  Use these commands to list, view, upload, download, or delete app versions associated with a publish profile.

SUBCOMMANDS
  list:     List all app versions for a profile
  view:     View details of a specific app version
  upload:   Upload a new app version to a profile
  download: Download an app version from a profile
  delete:   Remove an app version from a profile
  mark-as-rc:     Mark an app version as Release Candidate
  unmark-as-rc:   Unmark an app version as Release Candidate
  update-release-note: Update the release notes for an app version

USAGE
  appcircle publish profile version <action> [flags]

EXAMPLES
  appcircle publish profile version list --platform ios --publishProfileId <uuid>
  appcircle publish profile version upload --platform ios --publishProfileId <uuid> --app <path>

LEARN MORE
  Use 'appcircle publish profile version <action> --help' for detailed command help.`,
            params: [],
            subCommands: [
              {
                command: 'list',
                description: 'App Version List',
                longDescription: `Get a list of all app versions for a given publish profile

USAGE
  appcircle publish profile version list --platform <platform> --publishProfileId <uuid>

REQUIRED OPTIONS
  --platform <platform>      Platform (ios or android)
  --publishProfileId <uuid>  Publish profile ID (UUID format)

DESCRIPTION
  View all app versions that have been uploaded to the specified publish profile.

EXAMPLES
  appcircle publish profile version list --platform ios --publishProfileId <uuid>
  appcircle publish profile version list --platform android --publishProfileId <uuid>

LEARN MORE
  Use 'appcircle publish profile version upload' to add new versions.`,
                params: [platformParam,
                  {
                    name: 'publishProfileId',
                    description: 'Publish Profile Name (ID)',
                    type: CommandParameterTypes.SELECT,
                    valueType: 'uuid',
                    required: false
                  },
                  {
                    name: 'profile',
                    description: "Publish Profile Name instead of 'publishProfileId'",
                    type: CommandParameterTypes.STRING,
                    valueType: 'string',
                    required: false,
                    requriedForInteractiveMode: false,
                    skipForInteractiveMode: true,
                    params: [],
                  }
                ],
              },
              {
                command: 'view',
                description: 'View Details of App Version',
                longDescription: `View details of a specific app version

USAGE
  appcircle publish profile version view --platform <platform> --publishProfileId <uuid> --appVersionId <uuid>

REQUIRED OPTIONS
  --platform <platform>      Platform (ios or android)
  --publishProfileId <uuid>  Publish profile ID (UUID format)
  --appVersionId <uuid>      App version ID (UUID format)

DESCRIPTION
  View comprehensive details about a specific app version, including submission status, review progress, and error messages.

EXAMPLES
  appcircle publish profile version view --platform ios --publishProfileId <uuid> --appVersionId <uuid>

LEARN MORE
  Use 'appcircle publish profile version list' to get available app versions.`,
                params: [platformParam,
                  {
                    name: 'publishProfileId',
                    description: 'Publish Profile Name (ID)',
                    type: CommandParameterTypes.SELECT,
                    valueType: 'uuid',
                    required: false
                  },
                  {
                    name: 'profile',
                    description: "Publish Profile Name instead of 'publishProfileId'",
                    type: CommandParameterTypes.STRING,
                    valueType: 'string',
                    required: false,
                    requriedForInteractiveMode: false,
                    skipForInteractiveMode: true,
                    params: [],
                  },
                  {
                    name: 'appVersionId',
                    description: 'App Version',
                    type: CommandParameterTypes.SELECT,
                    valueType: 'uuid',
                    required: false
                  },
                  {
                    name: 'appVersion',
                    description: "App Version Name instead of 'appVersionId'",
                    type: CommandParameterTypes.STRING,
                    valueType: 'string',
                    required: false,
                    requriedForInteractiveMode: false,
                    skipForInteractiveMode: true,
                    params: [],
                  },
                ],
              },
              {
                command: 'upload',
                description: 'Upload a New App Version',
                longDescription: `Upload a new app version to a publish profile

USAGE
  appcircle publish profile version upload --platform <platform> --publishProfileId <uuid> --app <path>

REQUIRED OPTIONS
  --platform <platform>      Platform (ios or android)
  --publishProfileId <uuid>  Publish profile ID (UUID format)
  --profile <string>         Publish profile name (alternative to --publishProfileId)
  --app <path>               Path to the app binary (ipa/apk/aab)

DESCRIPTION
  Upload a new binary (IPA, APK, or AAB) as a new version to the selected publish profile. Optionally, mark as release candidate and add release notes.

EXAMPLES
  appcircle publish profile version upload --platform ios --publishProfileId <uuid> --app ./MyApp.ipa
  appcircle publish profile version upload --platform android --profile "Google Play Production" --app ./MyApp.aab

LEARN MORE
  Use 'appcircle publish profile version list' to see all versions for a profile.`,
                params: [
                  platformParam,
                  {
                    name: 'publishProfileId',
                    description: 'Publish Profile Name (ID)',
                    type: CommandParameterTypes.SELECT,
                    valueType: 'uuid',
                    required: false
                  },
                  {
                    name: 'profile',
                    description: "Publish Profile Name instead of 'publishProfileId'",
                    type: CommandParameterTypes.STRING,
                    valueType: 'string',
                    required: false,
                    requriedForInteractiveMode: false,
                    skipForInteractiveMode: true,
                    params: [],
                  },
                  {
                    name: 'app',
                    description: 'App Path',
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
                description: 'Download App Version',
                longDescription: `Download an app version from a publish profile

USAGE
  appcircle publish profile version download --platform <platform> --publishProfileId <uuid> --appVersionId <uuid> [--path <path>]

REQUIRED OPTIONS
  --platform <platform>      Platform (ios or android)
  --publishProfileId <uuid>  Publish profile ID (UUID format)
  --appVersionId <uuid>      App version ID (UUID format)
  --path <path>              (Optional) Path to save the downloaded file (defaults to current directory)

DESCRIPTION
  Download the binary file for a specific app version from the selected publish profile.

EXAMPLES
  appcircle publish profile version download --platform ios --publishProfileId <uuid> --appVersionId <uuid>
  appcircle publish profile version download --platform android --publishProfileId <uuid> --appVersionId <uuid> --path ./downloads

LEARN MORE
  Use 'appcircle publish profile version list' to get available app versions.`,
                params: [
                  platformParam,
                  {
                    name: 'publishProfileId',
                    description: 'Publish Profile Name (ID)',
                    type: CommandParameterTypes.SELECT,
                    valueType: 'uuid',
                    required: true
                  },
                  {
                    name: 'appVersionId',
                    description: 'App Version',
                    type: CommandParameterTypes.SELECT,
                    valueType: 'uuid',
                    required: true
                  },
                  {
                    name: 'path',
                    description: '[OPTIONAL] The Path for artifacts to be downloaded:',
                    longDescription:'[OPTIONAL] The Path for artifacts to be downloaded: (Defaults to the current directory)',
                    type: CommandParameterTypes.STRING,
                    valueType: 'path',
                    required: false
                  }
                ],
              },
              {
                command: 'delete',
                description: 'Remove App Version',
                longDescription: `Remove an app version from a publish profile

USAGE
  appcircle publish profile version delete --platform <platform> --publishProfileId <uuid> --appVersionId <uuid>

REQUIRED OPTIONS
  --platform <platform>      Platform (ios or android)
  --publishProfileId <uuid>  Publish profile ID (UUID format)
  --appVersionId <uuid>      App version ID (UUID format)

DESCRIPTION
  Permanently deletes the specified app version from the selected publish profile.

EXAMPLES
  appcircle publish profile version delete --platform ios --publishProfileId <uuid> --appVersionId <uuid>

LEARN MORE
  Use 'appcircle publish profile version list' to get available app versions.`,
                params: [
                  platformParam,
                  {
                    name: 'publishProfileId',
                    description: 'Publish Profile Name (ID)',
                    type: CommandParameterTypes.SELECT,
                    valueType: 'uuid',
                    required: true
                  },
                  {
                    name: 'appVersionId',
                    description: 'App Version',
                    type: CommandParameterTypes.SELECT,
                    valueType: 'uuid',
                    required: true
                  }
                ],
              },
              {
                command: 'mark-as-rc',
                description: 'Mark as Release Candidate',
                longDescription: `Mark an app version as Release Candidate

USAGE
  appcircle publish profile version mark-as-rc --platform <platform> --publishProfileId <uuid> --appVersionId <uuid>

REQUIRED OPTIONS
  --platform <platform>      Platform (ios or android)
  --publishProfileId <uuid>  Publish profile ID (UUID format)
  --appVersionId <uuid>      App version ID (UUID format)

DESCRIPTION
  Mark the specified app version as a Release Candidate for distribution or review.

EXAMPLES
  appcircle publish profile version mark-as-rc --platform ios --publishProfileId <uuid> --appVersionId <uuid>

LEARN MORE
  Use 'appcircle publish profile version list' to get available app versions.`,
                params: [
                  platformParam,
                  {
                    name: 'publishProfileId',
                    description: 'Publish Profile Name (ID)',
                    type: CommandParameterTypes.SELECT,
                    valueType: 'uuid',
                    required: true
                  },
                  {
                    name: 'appVersionId',
                    description: 'App Version',
                    type: CommandParameterTypes.SELECT,
                    valueType: 'uuid',
                    required: true
                  }
                ],
              },
              {
                command: 'unmark-as-rc',
                description: 'Unmark as Release Candidate',
                longDescription: `Unmark an app version as Release Candidate

USAGE
  appcircle publish profile version unmark-as-rc --platform <platform> --publishProfileId <uuid> --appVersionId <uuid>

REQUIRED OPTIONS
  --platform <platform>      Platform (ios or android)
  --publishProfileId <uuid>  Publish profile ID (UUID format)
  --appVersionId <uuid>      App version ID (UUID format)

DESCRIPTION
  Remove the Release Candidate status from the specified app version.

EXAMPLES
  appcircle publish profile version unmark-as-rc --platform ios --publishProfileId <uuid> --appVersionId <uuid>

LEARN MORE
  Use 'appcircle publish profile version list' to get available app versions.`,
                params: [
                  platformParam,
                  {
                    name: 'publishProfileId',
                    description: 'Publish Profile Name (ID)',
                    type: CommandParameterTypes.SELECT,
                    valueType: 'uuid',
                    required: true
                  },
                  {
                    name: 'appVersionId',
                    description: 'App Version',
                    type: CommandParameterTypes.SELECT,
                    valueType: 'uuid',
                    required: true
                  }
                ],
              },
              {
                command: 'update-release-note',
                description: 'Update the Release Notes for the App Version',
                longDescription: `Update the release notes for a specific app version

USAGE
  appcircle publish profile version update-release-note --platform <platform> --publishProfileId <uuid> --appVersionId <uuid> --summary <text>

REQUIRED OPTIONS
  --platform <platform>      Platform (ios or android)
  --publishProfileId <uuid>  Publish profile ID (UUID format)
  --appVersionId <uuid>      App version ID (UUID format)
  --summary <text>           Release notes text

DESCRIPTION
  Update or add release notes for the specified app version. The version must be marked as a release candidate.

EXAMPLES
  appcircle publish profile version update-release-note --platform ios --publishProfileId <uuid> --appVersionId <uuid> --summary "Bug fixes and improvements"

LEARN MORE
  Use 'appcircle publish profile version view' to see current release notes.`,
                params: [
                  platformParam,
                  {
                    name: 'publishProfileId',
                    description: 'Publish Profile Name (ID)',
                    type: CommandParameterTypes.SELECT,
                    valueType: 'uuid',
                    required: true
                  },
                  {
                    name: 'appVersionId',
                    description: 'App Version',
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
            description: 'Publish Profile Settings',
            longDescription: `Manage settings for a publish profile

DESCRIPTION
  Configure advanced settings for your publish profiles, such as enabling or disabling auto-publish features.

SUBCOMMANDS
  autopublish:  Enable or disable automatic publishing for a profile

USAGE
  appcircle publish profile settings <subcommand> [flags]

EXAMPLES
  appcircle publish profile settings autopublish --platform ios --publishProfileId <uuid> --enable true

LEARN MORE
  Use 'appcircle publish profile settings <subcommand> --help' for detailed command help.`,
            params: [],
            subCommands: [
              {
                command: 'autopublish',
                description: 'Set Publish Profile as Auto Publish',
                longDescription: `Enable or disable automatic publishing for a profile

USAGE
  appcircle publish profile settings autopublish --platform <platform> --publishProfileId <uuid> --enable <true|false>

REQUIRED OPTIONS
  --platform <platform>      Platform (ios or android)
  --publishProfileId <uuid>  Publish profile ID (UUID format)
  --profile <string>         Publish profile name (alternative to --publishProfileId)
  --enable <true|false>      Enable or disable auto-publish

DESCRIPTION
  When enabled, a publish process will automatically start when a new version is received for the profile.

EXAMPLES
  appcircle publish profile settings autopublish --platform ios --publishProfileId <uuid> --enable true
  appcircle publish profile settings autopublish --platform android --profile "Google Play Production" --enable false

LEARN MORE
  Use 'appcircle publish profile list --platform <platform>' to get profile IDs and names.`,
                params: [
                  platformParam,
                  {
                    name: 'publishProfileId',
                    description: 'Publish Profile Name (ID)',
                    type: CommandParameterTypes.SELECT,
                    valueType: 'uuid',
                    required: false
                  },
                  {
                    name: 'profile',
                    description: "Publish Profile Name instead of 'publishProfileId'",
                    type: CommandParameterTypes.STRING,
                    valueType: 'string',
                    required: false,
                    requriedForInteractiveMode: false,
                    skipForInteractiveMode: true,
                    params: [],
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
        longDescription: `Manage publishing environment variables

DESCRIPTION
  Publishing environment variables are used during the app publishing process to configure
  store-specific settings, API keys, and other publishing parameters. Variables are organized
  into groups for better management and reusability across different publishing profiles.

SUBCOMMANDS
  group:  Manage publishing variable groups

USAGE
  appcircle publish variable <subcommand> <action> [flags]

EXAMPLES
  appcircle publish variable group list
  appcircle publish variable group view --publishVariableGroupId <uuid>
  appcircle publish variable group upload --publishVariableGroupId <uuid> --filePath ./variables.json

LEARN MORE
  Use 'appcircle publish variable group --help' for variable group management.`,
        params: [],
        subCommands: [
          {
            command: 'group',
            description: 'Group Actions',
            longDescription: `Manage publishing environment variable groups

DESCRIPTION
  Publishing variable groups are collections of environment variables used during app publishing.
  You can create groups to organize variables by purpose (e.g., App Store, Google Play, staging).

SUBCOMMANDS
  list:     List all publishing variable groups
  view:     View variables in a specific group
  upload:   Upload variables from JSON file to a group
  download: Download variables from a group as JSON file

USAGE
  appcircle publish variable group <action> [flags]

EXAMPLES
  appcircle publish variable group list
  appcircle publish variable group view --publishVariableGroupId <uuid>
  appcircle publish variable group upload --publishVariableGroupId <uuid> --filePath ./variables.json

LEARN MORE
  Use 'appcircle publish variable group <action> --help' for detailed command help.`,
            params: [],
            subCommands:[
              {
                command: "list",
                description: 'List Groups',
                longDescription: `
USAGE
  appcircle publish variable group list

DESCRIPTION
  View all publishing environment variable groups that have been created in your organization.
  These groups contain variables used during the app publishing process.

EXAMPLES
  appcircle publish variable group list

LEARN MORE
  Use 'appcircle publish variable group view --publishVariableGroupId <uuid>' to see variables in a group.`,
                params: [],
              },
              {
                command: "view",
                description: 'View Items of Group',
                longDescription: `View variables in a specific publishing variable group

USAGE
  appcircle publish variable group view --publishVariableGroupId <uuid>

REQUIRED OPTIONS
  --publishVariableGroupId <uuid>  Variable Group ID (UUID format)

DESCRIPTION
  Display all environment variables contained in the specified group.

EXAMPLES
  appcircle publish variable group view --publishVariableGroupId <uuid>

LEARN MORE
  Use 'appcircle publish variable group list' to get available group IDs.`,
                params: [
                  {
                    name: 'publishVariableGroupId',
                    description: 'Variable Group ID',
                    type: CommandParameterTypes.SELECT,
                    valueType: 'uuid',
                    required: false
                  },
                  {
                    name: 'variableGroup',
                    description: "Variable Group Name instead of 'publishVariableGroupId'",
                    type: CommandParameterTypes.STRING,
                    valueType: 'string',
                    required: false,
                    requriedForInteractiveMode: false,
                    skipForInteractiveMode: true,
                    params: [],
                  }
                ],
              },
              {
                command: "upload",
                description: 'Upload Publish Environment Variables from JSON File',
                longDescription: `Upload environment variables from a JSON file to a variable group

USAGE
  appcircle publish variable group upload --publishVariableGroupId <uuid> --filePath <path>

REQUIRED OPTIONS
  --publishVariableGroupId <uuid>  Variable Group ID (UUID format)
  --filePath <path>                Path to the JSON file

DESCRIPTION
  Import environment variables from a JSON file into the specified variable group.

EXAMPLES
  appcircle publish variable group upload --publishVariableGroupId <uuid> --filePath ./variables.json

LEARN MORE
  Use 'appcircle publish variable group view' to see variables in a group.`,
                params: [
                  {
                    name: 'publishVariableGroupId',
                    description: 'Variable Group Name (ID)',
                    type: CommandParameterTypes.SELECT,
                    valueType: 'uuid',
                    required: false
                  },
                  {
                    name: 'variableGroup',
                    description: "Variable Group Name instead of 'publishVariableGroupId'",
                    type: CommandParameterTypes.STRING,
                    valueType: 'string',
                    required: false,
                    requriedForInteractiveMode: false,
                    skipForInteractiveMode: true,
                    params: [],
                  },
                  {
                    name: 'filePath',
                    description: 'JSON File Path',
                    type: CommandParameterTypes.STRING,
                    valueType: 'path',
                    required: true
                  }
                ],
              },
              {
                command: "download",
                description: 'Download Environment Variables as JSON',
                longDescription: `Download environment variables from a group as a JSON file

USAGE
  appcircle publish variable group download --publishVariableGroupId <uuid> [--path <path>]

REQUIRED OPTIONS
  --publishVariableGroupId <uuid>  Variable Group ID (UUID format)
  --path <path>                    (Optional) Path to save the JSON file (defaults to current directory)

DESCRIPTION
  Export all environment variables from the specified group to a JSON file.

EXAMPLES
  appcircle publish variable group download --publishVariableGroupId <uuid> --path ./output.json

LEARN MORE
  Use 'appcircle publish variable group view' to see variables in a group.`,
                params: [
                  {
                    name: 'publishVariableGroupId',
                    description: 'Variable Groups Name (ID)',
                    type: CommandParameterTypes.SELECT,
                    valueType: 'uuid',
                    required: false
                  },
                  {
                    name: 'variableGroup',
                    description: "Variable Group Name instead of 'publishVariableGroupId'",
                    type: CommandParameterTypes.STRING,
                    valueType: 'string',
                    required: false,
                    requriedForInteractiveMode: false,
                    skipForInteractiveMode: true,
                    params: [],
                  },
                  {
                    name: 'path',
                    description: '[OPTIONAL] The Path for JSON file to be downloaded',
                    longDescription:'[OPTIONAL] The Path for JSON file to be downloaded (Defaults to the current directory)',
                    type: CommandParameterTypes.STRING,
                    valueType: 'string',
                    required: false
                  }
                ],
              },
            ]
          },
        ]
      }
    ],
  },
  {
    command: CommandTypes.ENTERPRISE_APP_STORE,
    description: 'Enterprise App Store',
    longDescription: `Manage your organization's Enterprise App Store

DESCRIPTION
  The Enterprise App Store allows you to distribute internal apps securely within your organization. Use these commands to manage enterprise profiles and app versions, publish or unpublish apps, and handle app uploads and downloads.

SUBCOMMANDS
  profile-list:   List all enterprise app store profiles
  version:        Manage enterprise app versions (list, publish, unpublish, remove, notify, upload, download)

USAGE
  appcircle enterprise-app-store <subcommand> [flags]

EXAMPLES
  appcircle enterprise-app-store profile-list
  appcircle enterprise-app-store version list --entProfileId <uuid>

LEARN MORE
  Use 'appcircle enterprise-app-store <subcommand> --help' for detailed command help.`,
    params: [],
    subCommands: [
      {
        command: 'profile-list',
        description: 'Get List of Enterprise Profiles',
        longDescription: `List all enterprise app store profiles

USAGE
  appcircle enterprise-app-store profile-list

DESCRIPTION
  View all enterprise app store profiles available in your organization.

EXAMPLES
  appcircle enterprise-app-store profile-list`,
        subCommands: [],
        params: []
      },
      {
        command: 'version',
        description: 'Enterprise App Version Actions',
        longDescription: `Manage enterprise app versions

DESCRIPTION
  Use these commands to list, publish, unpublish, remove, notify, upload, or download enterprise app versions for a profile.

SUBCOMMANDS
  list:              List all app versions for a profile
  publish:           Publish an app version
  unpublish:         Unpublish an app version
  remove:            Remove an app version
  notify:            Notify users about an app version
  upload-for-profile:    Upload an app version for a profile
  upload-without-profile: Upload an app version without a profile
  download-link:         Get download link for an app version

USAGE
  appcircle enterprise-app-store version <action> [flags]

EXAMPLES
  appcircle enterprise-app-store version list --entProfileId <uuid>
  appcircle enterprise-app-store version publish --entProfileId <uuid> --entVersionId <uuid>

LEARN MORE
  Use 'appcircle enterprise-app-store version <action> --help' for detailed command help.`,
        subCommands: [
          {
            command: 'list',
            description: 'Get List of Enterprise App Versions',
            longDescription: `List all app versions for a given enterprise profile

USAGE
  appcircle enterprise-app-store version list --entProfileId <uuid> [--publishType <type>]

REQUIRED OPTIONS
  --entProfileId <uuid>  Enterprise Profile ID (UUID format)
  --profile <string>     Enterprise profile name (alternative to --entProfileId)
  --publishType <type>   (Optional) 0=All, 1=Beta, 2=Live

DESCRIPTION
  View all app versions uploaded to the specified enterprise profile.

EXAMPLES
  appcircle enterprise-app-store version list --entProfileId <uuid>
  appcircle enterprise-app-store version list --profile "Internal Apps" --publishType 2`,
            params: [
              {
                name: 'entProfileId',
                description: 'Enterprise Profile Name (ID)',
                type: CommandParameterTypes.SELECT,
                valueType: 'uuid',
                required: false
              },
              {
                name: 'profile',
                description: "Enterprise Profile Name instead of 'entProfileId'",
                type: CommandParameterTypes.STRING,
                valueType: 'string',
                required: false,
                requriedForInteractiveMode: false,
                skipForInteractiveMode: true,
                params: [],
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
            description: 'Publish Enterprise App Version',
            longDescription: `Publish an enterprise app version

USAGE
  appcircle enterprise-app-store version publish --entProfileId <uuid> --entVersionId <uuid> [--summary <text>] [--releaseNotes <text>] [--publishType <type>]

REQUIRED OPTIONS
  --entProfileId <uuid>   Enterprise Profile ID (UUID format)
  --profile <string>      Enterprise profile name (alternative to --entProfileId)
  --entVersionId <uuid>   App Version ID (UUID format)
  --appVersion <string>   App version name (alternative to --entVersionId)
  --summary <text>        (Optional) Summary text
  --releaseNotes <text>   (Optional) Release notes
  --publishType <type>    (Optional) 0=None, 1=Beta, 2=Live

DESCRIPTION
  Publish a specific app version to the enterprise app store profile.

EXAMPLES
  appcircle enterprise-app-store version publish --profile "Internal Apps" --appVersion "v1.2.3" --publishType 2`,
            params: [
              {
                name: 'entProfileId',
                description: 'Enterprise Profile Name (ID)',
                type: CommandParameterTypes.SELECT,
                valueType: 'uuid',
                required: false
              },
              {
                name: 'profile',
                description: "Enterprise Profile Name instead of 'entProfileId'",
                type: CommandParameterTypes.STRING,
                valueType: 'string',
                required: false,
                requriedForInteractiveMode: false,
                skipForInteractiveMode: true,
                params: [],
              },
              {
                name: 'entVersionId',
                description: 'App Version (ID)',
                type: CommandParameterTypes.SELECT,
                valueType: 'uuid',
                required: false
              },
              {
                name: 'appVersion',
                description: "App Version Name instead of 'entVersionId'",
                type: CommandParameterTypes.STRING,
                valueType: 'string',
                required: false,
                requriedForInteractiveMode: false,
                skipForInteractiveMode: true,
                params: [],
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
            description: 'Unpublish Enterprise App Version',
            longDescription: `Unpublish an enterprise app version

USAGE
  appcircle enterprise-app-store version unpublish --entProfileId <uuid> --entVersionId <uuid>

REQUIRED OPTIONS
  --entProfileId <uuid>   Enterprise Profile ID (UUID format)
  --profile <string>      Enterprise profile name (alternative to --entProfileId)
  --entVersionId <uuid>   App Version ID (UUID format)
  --appVersion <string>   App version name (alternative to --entVersionId)

DESCRIPTION
  Unpublish a specific app version from the enterprise app store profile.

EXAMPLES
  appcircle enterprise-app-store version unpublish --profile "Internal Apps" --appVersion "v1.2.3"`,
            params: [
              {
                name: 'entProfileId',
                description: 'Enterprise Profile Name (ID)',
                type: CommandParameterTypes.SELECT,
                valueType: 'uuid',
                required: false
              },
              {
                name: 'profile',
                description: "Enterprise Profile Name instead of 'entProfileId'",
                type: CommandParameterTypes.STRING,
                valueType: 'string',
                required: false,
                requriedForInteractiveMode: false,
                skipForInteractiveMode: true,
                params: [],
              },
              {
                name: 'entVersionId',
                description: 'App Version (ID)',
                type: CommandParameterTypes.SELECT,
                valueType: 'uuid',
                required: false
              },
              {
                name: 'appVersion',
                description: "App Version Name instead of 'entVersionId'",
                type: CommandParameterTypes.STRING,
                valueType: 'string',
                required: false,
                requriedForInteractiveMode: false,
                skipForInteractiveMode: true,
                params: [],
              },
            ],
          },
          {
            command: 'remove',
            description: 'Remove Enterprise App Version',
            longDescription: `Remove an enterprise app version

USAGE
  appcircle enterprise-app-store version remove --entProfileId <uuid> --entVersionId <uuid>

REQUIRED OPTIONS
  --entProfileId <uuid>   Enterprise Profile ID (UUID format)
  --profile <string>      Enterprise profile name (alternative to --entProfileId)
  --entVersionId <uuid>   App Version ID (UUID format)
  --appVersion <string>   App version name (alternative to --entVersionId)

DESCRIPTION
  Permanently delete a specific app version from the enterprise app store profile.

EXAMPLES
  appcircle enterprise-app-store version remove --profile "Internal Apps" --appVersion "v1.2.3"`,
            params: [
              {
                name: 'entProfileId',
                description: 'Enterprise Profile Name (ID)',
                type: CommandParameterTypes.SELECT,
                valueType: 'uuid',
                required: false
              },
              {
                name: 'profile',
                description: "Enterprise Profile Name instead of 'entProfileId'",
                type: CommandParameterTypes.STRING,
                valueType: 'string',
                required: false,
                requriedForInteractiveMode: false,
                skipForInteractiveMode: true,
                params: [],
              },
              {
                name: 'entVersionId',
                description: 'App Version (ID)',
                type: CommandParameterTypes.SELECT,
                valueType: 'uuid',
                required: false
              },
              {
                name: 'appVersion',
                description: "App Version Name instead of 'entVersionId'",
                type: CommandParameterTypes.STRING,
                valueType: 'string',
                required: false,
                requriedForInteractiveMode: false,
                skipForInteractiveMode: true,
                params: [],
              },
            ],
          },
          {
            command: 'notify',
            description: 'Notify enterprise app version',
            ignore: true,
            longDescription: `Notify users about an enterprise app version

USAGE
  appcircle enterprise-app-store version notify --entProfileId <uuid> --entVersionId <uuid> --subject <text> --message <text>

REQUIRED OPTIONS
  --entProfileId <uuid>   Enterprise Profile ID (UUID format)
  --entVersionId <uuid>   App Version ID (UUID format)
  --subject <text>        Notification subject
  --message <text>        Notification message

DESCRIPTION
  Send a notification to users about a specific enterprise app version.

EXAMPLES
  appcircle enterprise-app-store version notify --entProfileId <uuid> --entVersionId <uuid> --subject "Update" --message "A new version is available."`,
            params: [
              {
                name: 'entProfileId',
                description: 'Enterprise Profile Name (ID)',
                type: CommandParameterTypes.SELECT,
                valueType: 'uuid',
                required: false
              },
              {
                name: 'profile',
                description: "Enterprise Profile Name instead of 'entProfileId'",
                type: CommandParameterTypes.STRING,
                valueType: 'string',
                required: false,
                requriedForInteractiveMode: false,
                skipForInteractiveMode: true,
                params: [],
              },
              {
                name: 'entVersionId',
                description: 'App Version (ID)',
                type: CommandParameterTypes.SELECT,
                valueType: 'uuid',
                required: false
              },
              {
                name: 'appVersion',
                description: "App Version Name instead of 'entVersionId'",
                type: CommandParameterTypes.STRING,
                valueType: 'string',
                required: false,
                requriedForInteractiveMode: false,
                skipForInteractiveMode: true,
                params: [],
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
            description: 'Upload Enterprise App Version for a Profile',
            longDescription: `Upload an enterprise app version for a profile

USAGE
  appcircle enterprise-app-store version upload-for-profile --entProfileId <uuid> --app <path>

REQUIRED OPTIONS
  --entProfileId <uuid>   Enterprise Profile ID (UUID format)
  --profile <string>      Enterprise profile name (alternative to --entProfileId)
  --app <path>            Path to the app binary (ipa/apk/aab)

DESCRIPTION
  Upload a new app version to the specified enterprise profile.

EXAMPLES
  appcircle enterprise-app-store version upload-for-profile --profile "Internal Apps" --app ./MyApp.ipa`,
            params: [
              {
                name: 'entProfileId',
                description: 'Enterprise Profile Name (ID)',
                type: CommandParameterTypes.SELECT,
                valueType: 'uuid',
                required: false
              },
              {
                name: 'profile',
                description: "Enterprise Profile Name instead of 'entProfileId'",
                type: CommandParameterTypes.STRING,
                valueType: 'string',
                required: false,
                requriedForInteractiveMode: false,
                skipForInteractiveMode: true,
                params: [],
              },
              {
                name: 'app',
                description: 'App Path',
                type: CommandParameterTypes.STRING,
                valueType: 'string',
              },
            ],
          },
          {
            command: 'upload-without-profile',
            description: 'Upload Enterprise App Version without a Profile',
            longDescription: `Upload an enterprise app version without specifying a profile

USAGE
  appcircle enterprise-app-store version upload-without-profile --app <path>

REQUIRED OPTIONS
  --app <path>            Path to the app binary (ipa/apk/aab)

DESCRIPTION
  Upload a new app version without associating it with a specific enterprise profile.

EXAMPLES
  appcircle enterprise-app-store version upload-without-profile --app ./MyApp.ipa`,
            params: [
              {
                name: 'app',
                description: 'App Path',
                type: CommandParameterTypes.STRING,
                valueType: 'string',
              },
            ],
          },
          {
            command: 'download-link',
            description: 'Get Enterprise App Download Link',
            longDescription: `Get the download link for an enterprise app version

USAGE
  appcircle enterprise-app-store version download-link --entProfileId <uuid> --entVersionId <uuid>

REQUIRED OPTIONS
  --entProfileId <uuid>   Enterprise Profile ID (UUID format)
  --profile <string>      Enterprise profile name (alternative to --entProfileId)
  --entVersionId <uuid>   App Version ID (UUID format)
  --appVersion <string>   App version name (alternative to --entVersionId)

DESCRIPTION
  Retrieve the download link for a specific app version in the enterprise app store profile.

EXAMPLES
  appcircle enterprise-app-store version download-link --profile "Internal Apps" --appVersion "v1.2.3"`,
            params: [
              {
                name: 'entProfileId',
                description: 'Enterprise Profile Name (ID)',
                type: CommandParameterTypes.SELECT,
                valueType: 'uuid',
                required: false
              },
              {
                name: 'profile',
                description: "Enterprise Profile Name instead of 'entProfileId'",
                type: CommandParameterTypes.STRING,
                valueType: 'string',
                required: false,
                requriedForInteractiveMode: false,
                skipForInteractiveMode: true,
                params: [],
              },
              {
                name: 'entVersionId',
                description: 'App Version (ID)',
                type: CommandParameterTypes.SELECT,
                valueType: 'uuid',
                required: false
              },
              {
                name: 'appVersion',
                description: "App Version Name instead of 'entVersionId'",
                type: CommandParameterTypes.STRING,
                valueType: 'string',
                required: false,
                requriedForInteractiveMode: false,
                skipForInteractiveMode: true,
                params: [],
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
    description: 'Organization Management',
    longDescription: `Manage your organization, users, roles, and details

USAGE
  appcircle organization <subcommand> [flags]

DESCRIPTION
  Organization management commands allow you to view and manage organizations, sub-organizations, users, and roles. Use these commands to add or remove users, assign roles, and view organization details.

SUBCOMMANDS
  view:         View organization details
  create-sub:   Create a sub-organization
  role:         Manage organization roles (add, remove, view, clear)
  user:         Manage organization users (invite, remove, view, re-invite)

EXAMPLES
  appcircle organization view
  appcircle organization view --organization "My Organization"
  appcircle organization create-sub --name "Subsidiary"
  appcircle organization role add --userId <uuid> --role <role>
  appcircle organization role add --user "user@example.com" --role admin
  appcircle organization user invite --email user@example.com

LEARN MORE
  Use 'appcircle organization <subcommand> --help' for detailed command help.`,
    subCommands: [
      {
        command: 'view',
        description: 'View Organizations Details',
        longDescription: `View details of your organization or a specific organization

USAGE
  appcircle organization view [--organizationId <uuid>]
  appcircle organization view [--organization <name>]

OPTIONAL OPTIONS
  --organizationId <uuid>   Organization ID (UUID format)
  --organization <name>     Organization name (alternative to --organizationId)

DESCRIPTION
  View details of your current organization. If an organizationId or organization name is provided, view details for that specific organization.

EXAMPLES
  appcircle organization view
  appcircle organization view --organizationId 550e8400-e29b-41d4-a716-446655440000
  appcircle organization view --organization "My Organization"

LEARN MORE
  Use 'appcircle organization create-sub' to add a sub-organization.`,
        params: [{
          name: 'organizationId',
          description: 'Organization Name (ID) [Optional]',
          type: CommandParameterTypes.SELECT,
          defaultValue: 'all',
          valueType: 'uuid',
          required: false,
        },
        {
          name: 'organization',
          description: "Organization Name instead of 'organizationId'",
          type: CommandParameterTypes.STRING,
          valueType: 'string',
          required: false,
          requriedForInteractiveMode: false,
          skipForInteractiveMode: true,
          params: [],
        }],
      },
      {
        command: 'create-sub',
        description: 'Create a Sub-Organization',
        longDescription: `Create a new sub-organization under the current organization

USAGE
  appcircle organization create-sub --name <name>

REQUIRED OPTIONS
  --name <name>  Name of the sub-organization

DESCRIPTION
  Add a new sub-organization to your current organization for better structure and management.

EXAMPLES
  appcircle organization create-sub --name "Subsidiary"

LEARN MORE
  Use 'appcircle organization view' to see all organizations.`,
        params: [{
          name: 'name',
          description: 'Name of the Sub-Organization',
          type: CommandParameterTypes.STRING,
          valueType: 'string',
          required: true,
        }],
      },
      {
        command: 'user',
        description: 'User Management',
        longDescription: `Manage organization users (view, invite, re-invite, remove)

USAGE
  appcircle organization user <action> [flags]

DESCRIPTION
  Organization users management commands allow you to view, invite, re-invite, and remove users from your organization.

SUBCOMMANDS
  view:     View users of organization
  invite:   Invite user to organization
  re-invite: Re-invite user to organization
  remove:   Remove user or invitation from organization

EXAMPLES
  appcircle organization user view
  appcircle organization user invite --email user@example.com
  appcircle organization user re-invite --email user@example.com
  appcircle organization user remove --email user@example.com

LEARN MORE
  Use 'appcircle organization user <action> --help' for detailed command help.`,
        subCommands: [
          {
            command: 'view',
            description: 'View Users of Organization',
            longDescription: `View users of your organization

USAGE
  appcircle organization user view [--organizationId <uuid>]
  appcircle organization user view [--organization <name>]

OPTIONAL OPTIONS
  --organizationId <uuid>   Organization ID (UUID format)
  --organization <name>     Organization name (alternative to --organizationId)

DESCRIPTION
  View all users in your current organization or a specific organization if organizationId or organization name is provided.

EXAMPLES
  appcircle organization user view
  appcircle organization user view --organizationId 550e8400-e29b-41d4-a716-446655440000
  appcircle organization user view --organization "My Organization"

LEARN MORE
  Use 'appcircle organization user invite' to add new users.`,
            params: [ {
              name: 'organizationId',
              description: 'Organization Name (ID) [Optional]',
              type: CommandParameterTypes.SELECT,
              defaultValue: 'current',
              valueType: 'uuid',
              required: false,
            },
            {
              name: 'organization',
              description: "Organization Name instead of 'organizationId'",
              type: CommandParameterTypes.STRING,
              valueType: 'string',
              required: false,
              requriedForInteractiveMode: false,
              skipForInteractiveMode: true,
              params: [],
            }],
          },
          {
            command: 'invite',
            description: 'Invite User to Organization',
            longDescription: `Invite a user to your organization

USAGE
  appcircle organization user invite --email <email> [--organizationId <uuid>] [--role <role>]

REQUIRED OPTIONS
  --email <email>  Email address of the user to invite

DESCRIPTION
  Send an invitation to a user to join your organization. You can specify roles and organizationId optionally.

EXAMPLES
  appcircle organization user invite --email user@example.com
  appcircle organization user invite --email user@example.com --role admin

LEARN MORE
  Use 'appcircle organization user view' to see invited users.`,
            params: [{
              name: 'organizationId',
              description: 'Organization Name (ID) [Optional]',
              type: CommandParameterTypes.SELECT,
              defaultValue: 'current',
              valueType: 'uuid',
              required: false,
            },
            {
              name: 'organization',
              description: "Organization Name instead of 'organizationId'",
              type: CommandParameterTypes.STRING,
              valueType: 'string',
              required: false,
              requriedForInteractiveMode: false,
              skipForInteractiveMode: true,
              params: [],
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
            description: 'Re-invite User to Organization',
            longDescription: `Re-invite a user to your organization

USAGE
  appcircle organization user re-invite --email <email> [--organizationId <uuid>]

REQUIRED OPTIONS
  --email <email>  Email address of the user to re-invite

DESCRIPTION
  Send a re-invitation to a user who has not yet accepted the previous invitation to your organization.

EXAMPLES
  appcircle organization user re-invite --email user@example.com

LEARN MORE
  Use 'appcircle organization user view' to see invited users.`,
            params: [
              {
                name: 'organizationId',
                description: 'Organization Name (ID) [Optional]',
                type: CommandParameterTypes.SELECT,
                defaultValue: CURRENT_PARAM_VALUE,
                valueType: 'uuid',
                required: false,
              },
              {
                name: 'organization',
                description: "Organization Name instead of 'organizationId'",
                type: CommandParameterTypes.STRING,
                valueType: 'string',
                required: false,
                requriedForInteractiveMode: false,
                skipForInteractiveMode: true,
                params: [],
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
            description: 'Remove User or Invitation from Organization',
            longDescription: `Remove a user or invitation from your organization

USAGE
  appcircle organization user remove [--email <email>] [--userId <uuid>] [--organizationId <uuid>]
  appcircle organization user remove [--email <email>] [--user <email>] [--organization <name>]

OPTIONAL OPTIONS
  --organizationId <uuid>   Organization ID (UUID format)
  --organization <name>     Organization name (alternative to --organizationId)
  --userId <uuid>           User ID (UUID format)
  --user <email>            User email (alternative to --userId)
  --email <email>           Email address for invitation removal

DESCRIPTION
  Remove a user or a pending invitation from your organization. You can specify either email, userId, or user email.

EXAMPLES
  appcircle organization user remove --email user@example.com
  appcircle organization user remove --userId 550e8400-e29b-41d4-a716-446655440000
  appcircle organization user remove --user "user@example.com"
  appcircle organization user remove --user "user@example.com" --organization "My Organization"

LEARN MORE
  Use 'appcircle organization user view' to see current users and invitations.`,
            params: [{
              name: 'organizationId',
              description: 'Organization Name (ID) [Optional]',
              type: CommandParameterTypes.SELECT,
              defaultValue: CURRENT_PARAM_VALUE,
              valueType: 'uuid',
              required: false,
            },
            {
              name: 'organization',
              description: "Organization Name instead of 'organizationId'",
              type: CommandParameterTypes.STRING,
              valueType: 'string',
              required: false,
              requriedForInteractiveMode: false,
              skipForInteractiveMode: true,
              params: [],
            },{
                name: 'userId',
                description: 'User ID',
                type: CommandParameterTypes.SELECT,
                valueType: 'uuid',
              required: false,
            },
            {
              name: 'user',
              description: "User Name/Email instead of 'userId'",
              type: CommandParameterTypes.STRING,
              valueType: 'string',
              required: false,
              requriedForInteractiveMode: false,
              skipForInteractiveMode: true,
              params: [],
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
        description: 'Roles Management',
        longDescription: `Manage organization user roles (view, add, remove, clear )

USAGE
  appcircle organization role <action> [flags]

DESCRIPTION
  Organization users roles management commands allow you to view, add, remove, or clear roles for users in your organization.

SUBCOMMANDS
  view:   View roles of a user
  add:    Add roles to a user
  remove: Remove roles from a user
  clear:  Remove all roles from a user

EXAMPLES
  appcircle organization role view --userId <uuid>
  appcircle organization role view --user "user@example.com"
  appcircle organization role add --userId <uuid> --role admin
  appcircle organization role add --user "user@example.com" --role admin
  appcircle organization role remove --userId <uuid> --role admin
  appcircle organization role remove --user "user@example.com" --role admin
  appcircle organization role clear --userId <uuid>
  appcircle organization role clear --user "user@example.com"

LEARN MORE
  Use 'appcircle organization role <action> --help' for detailed command help.`,
        subCommands: [
          {
            command: 'view',
            description: 'View roles of the given userId within the organizationId',
            longDescription: `View roles of a user in your organization

USAGE
  appcircle organization role view --userId <uuid> [--organizationId <uuid>]
  appcircle organization role view --user <email> [--organization <name>]

REQUIRED OPTIONS
  --userId <uuid>           User ID (UUID format)
  --user <email>            User email (alternative to --userId)

OPTIONAL OPTIONS
  --organizationId <uuid>   Organization ID (UUID format)
  --organization <name>     Organization name (alternative to --organizationId)

DESCRIPTION
  View all roles assigned to a specific user in your organization.

EXAMPLES
  appcircle organization role view --userId 550e8400-e29b-41d4-a716-446655440000
  appcircle organization role view --user "user@example.com"
  appcircle organization role view --user "user@example.com" --organization "My Organization"

LEARN MORE
  Use 'appcircle organization user view' to see users and their emails.`,
                params: [
                  {
                    name: 'organizationId',
                    description: 'Organization Name (ID) [Optional]',
                    type: CommandParameterTypes.SELECT,
                    defaultValue: CURRENT_PARAM_VALUE,
                    valueType: 'uuid',
                    required: false,
                  },
                  {
                    name: 'organization',
                    description: "Organization Name instead of 'organizationId'",
                    type: CommandParameterTypes.STRING,
                    valueType: 'string',
                    required: false,
                    requriedForInteractiveMode: false,
                    skipForInteractiveMode: true,
                    params: [],
                  },
                  {
                    name: 'userId',
                    description: 'User Email (ID)',
                    type: CommandParameterTypes.SELECT,
                    valueType: 'uuid',
                    required: false,
                  },
                  {
                    name: 'user',
                    description: "User Name/Email instead of 'userId'",
                    type: CommandParameterTypes.STRING,
                    valueType: 'string',
                    required: false,
                    requriedForInteractiveMode: false,
                    skipForInteractiveMode: true,
                    params: [],
                  },
        ],
      },
          {
            command: 'add',
            description: 'Add roles to the given userId within the organizationId',
            longDescription: `Add roles to a user in your organization

USAGE
  appcircle organization role add --userId <uuid> --role <role> [--organizationId <uuid>]
  appcircle organization role add --user <email> --role <role> [--organization <name>]

REQUIRED OPTIONS
  --userId <uuid>           User ID (UUID format)
  --user <email>            User email (alternative to --userId)
  --role <role>             Role(s) to add

OPTIONAL OPTIONS
  --organizationId <uuid>   Organization ID (UUID format)
  --organization <name>     Organization name (alternative to --organizationId)

DESCRIPTION
  Assign one or more roles to a user in your organization.

EXAMPLES
  appcircle organization role add --userId 550e8400-e29b-41d4-a716-446655440000 --role admin
  appcircle organization role add --user "user@example.com" --role admin
  appcircle organization role add --user "user@example.com" --organization "My Organization" --role admin

LEARN MORE
  Use 'appcircle organization role view' to see current roles.`,
                params: [
                  {
                    name: 'organizationId',
                    description: 'Organization Name (ID) [Optional]',
                    type: CommandParameterTypes.SELECT,
                    defaultValue: CURRENT_PARAM_VALUE,
                    valueType: 'uuid',
                    required: false,
                  },
                  {
                    name: 'organization',
                    description: "Organization Name instead of 'organizationId'",
                    type: CommandParameterTypes.STRING,
                    valueType: 'string',
                    required: false,
                    requriedForInteractiveMode: false,
                    skipForInteractiveMode: true,
                    params: [],
                  },
                  {
                    name: 'userId',
                    description: 'User Email (ID)',
                    type: CommandParameterTypes.SELECT,
                    valueType: 'uuid',
                    required: false,
                  },
                  {
                    name: 'user',
                    description: "User Name/Email instead of 'userId'",
                    type: CommandParameterTypes.STRING,
                    valueType: 'string',
                    required: false,
                    requriedForInteractiveMode: false,
                    skipForInteractiveMode: true,
                    params: [],
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
                description: 'Remove given roles from the given userId within the organizationId',
                longDescription: `Remove roles from a user in your organization

USAGE
  appcircle organization role remove --userId <uuid> --role <role> [--organizationId <uuid>]
  appcircle organization role remove --user <email> --role <role> [--organization <name>]

REQUIRED OPTIONS
  --userId <uuid>           User ID (UUID format)
  --user <email>            User email (alternative to --userId)
  --role <role>             Role(s) to remove

OPTIONAL OPTIONS
  --organizationId <uuid>   Organization ID (UUID format)
  --organization <name>     Organization name (alternative to --organizationId)

DESCRIPTION
  Remove one or more roles from a user in your organization.

EXAMPLES
  appcircle organization role remove --userId 550e8400-e29b-41d4-a716-446655440000 --role admin
  appcircle organization role remove --user "user@example.com" --role admin
  appcircle organization role remove --user "user@example.com" --organization "My Organization" --role admin

LEARN MORE
  Use 'appcircle organization role view' to see current roles.`,
                params: [
                  {
                    name: 'organizationId',
                    description: 'Organization Name (ID) [Optional]',
                    type: CommandParameterTypes.SELECT,
                    defaultValue: CURRENT_PARAM_VALUE,
                    valueType: 'uuid',
                    required: false,
                  },
                  {
                    name: 'organization',
                    description: "Organization Name instead of 'organizationId'",
                    type: CommandParameterTypes.STRING,
                    valueType: 'string',
                    required: false,
                    requriedForInteractiveMode: false,
                    skipForInteractiveMode: true,
                    params: [],
                  },
                  {
                    name: 'userId',
                    description: 'User Email (ID)',
                    type: CommandParameterTypes.SELECT,
                    valueType: 'uuid',
                    required: false,
                  },
                  {
                    name: 'user',
                    description: "User Name/Email instead of 'userId'",
                    type: CommandParameterTypes.STRING,
                    valueType: 'string',
                    required: false,
                    requriedForInteractiveMode: false,
                    skipForInteractiveMode: true,
                    params: [],
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
                description: 'Remove all roles from the given userId within the organizationId',
                longDescription: `Remove all roles from a user in your organization

USAGE
  appcircle organization role clear --userId <uuid> [--organizationId <uuid>]
  appcircle organization role clear --user <email> [--organization <name>]

REQUIRED OPTIONS
  --userId <uuid>           User ID (UUID format)
  --user <email>            User email (alternative to --userId)

OPTIONAL OPTIONS
  --organizationId <uuid>   Organization ID (UUID format)
  --organization <name>     Organization name (alternative to --organizationId)

DESCRIPTION
  Remove all roles assigned to a user in your organization.

EXAMPLES
  appcircle organization role clear --userId 550e8400-e29b-41d4-a716-446655440000
  appcircle organization role clear --user "user@example.com"
  appcircle organization role clear --user "user@example.com" --organization "My Organization"

LEARN MORE
  Use 'appcircle organization role view' to see current roles.`,
                params: [
                  {
                    name: 'organizationId',
                    description: 'Organization Name (ID) [Optional]',
                    type: CommandParameterTypes.SELECT,
                    defaultValue: CURRENT_PARAM_VALUE,
                    valueType: 'uuid',
                    required: false,
                  },
                  {
                    name: 'organization',
                    description: "Organization Name instead of 'organizationId'",
                    type: CommandParameterTypes.STRING,
                    valueType: 'string',
                    required: false,
                    requriedForInteractiveMode: false,
                    skipForInteractiveMode: true,
                    params: [],
                  },
                  {
                    name: 'userId',
                    description: 'User Email (ID)',
                    type: CommandParameterTypes.SELECT,
                    valueType: 'uuid',
                    required: false,
                  },
                  {
                    name: 'user',
                    description: "User Name/Email instead of 'userId'",
                    type: CommandParameterTypes.STRING,
                    valueType: 'string',
                    required: false,
                    requriedForInteractiveMode: false,
                    skipForInteractiveMode: true,
                    params: [],
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
