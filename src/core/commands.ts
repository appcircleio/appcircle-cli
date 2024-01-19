import chalk from "chalk";
import { APPCIRCLE_COLOR } from "../constant";

export const CommandParameterTypes = {
  SELECT: "select",
  BOOLEAN: "boolean",
  STRING: "input",
  PASSWORD: "password",
};

export enum CommandTypes {
  LOGIN = "login",
  LIST_BUILD_PROFILES = "listBuildProfiles",
  LIST_BUILD_PROFILE_BRANCHES = "listBuildProfileBranches",
  LIST_BUILD_PROFILE_WORKFLOWS = "listBuildProfileWorkflows",
  LIST_BUILD_PROFILE_COMMITS = "listBuildProfileCommits",
  LIST_BUILD_PROFILE_BUILDS_OF_COMMIT = "listBuildProfileBuildsOfCommit",
  LIST_DISTRIBUTION_PROFILES = "listDistributionProfiles",
  BUILD = "build",
  DOWNLOAD = "download",
  UPLOAD = "upload",
  CREATE_DISTRIBUTION_PROFILE = "createDistributionProfile",
  LIST_ENVIRONMENT_VARIABLE_GROUPS = "listEnvironmentVariableGroups",
  CREATE_ENVIRONMENT_VARIABLE_GROUP = "createEnvironmentVariableGroup",
  LIST_ENVIRONMENT_VARIABLES = "listEnvironmentVariables",
  CREATE_ENVIRONMENT_VARIABLE = "createEnvironmentVariable",
  LIST_ENTERPRISE_PROFILES = "listEnterpriseProfiles",
  LIST_ENTERPRISE_APP_VERSIONS = "listEnterpriseAppVersions",
  PUBLISH_ENTERPRISE_APP_VERSION = "publishEnterpriseAppVersion",
  UNPUBLISH_ENTERPRISE_APP_VERSION = "unpublishEnterpriseAppVersion",
  REMOVE_ENTERPRISE_APP_VERSION = "removeEnterpriseAppVersion",
  NOTIFY_ENTERPRISE_APP_VERSION = "notifyEnterpriseAppVersion",
  UPLOAD_ENTERPRISE_APP = "uploadEnterpriseApp",
  UPLOAD_ENTERPRISE_APP_VERSION = "uploadEnterpriseAppVersion",
  GET_ENTERPRISE_DOWNLOAD_LINK = "getEnterpriseDownloadLink",
}

export const Commands: {
  command: string;
  description: string;
  params: { name: string; description: string; type: string; valueType: string; required?: boolean; params?: any }[];
}[] = [
  {
    command: CommandTypes.LOGIN,
    description: "Login",
    params: [
      {
        name: "pat",
        description: "Personal Access Token",
        type: CommandParameterTypes.STRING,
        valueType: "string",
      },
    ],
  },
  {
    command: CommandTypes.LIST_BUILD_PROFILES,
    description: "Get list of build profiles",
    params: [],
  },
  {
    command: CommandTypes.LIST_BUILD_PROFILE_BRANCHES,
    description: "Get list of branches of a build profile",
    params: [
      {
        name: "profileId",
        description: "Build profile ID",
        type: CommandParameterTypes.STRING,
        valueType: "uuid",
      },
    ],
  },
  {
    command: CommandTypes.LIST_BUILD_PROFILE_WORKFLOWS,
    description: "Get list of workflows of a build profile",
    params: [
      {
        name: "profileId",
        description: "Build profile ID",
        type: CommandParameterTypes.STRING,
        valueType: "uuid",
      },
    ],
  },
  {
    command: CommandTypes.LIST_BUILD_PROFILE_COMMITS,
    description: "Get list of commits of a branch",
    params: [
      {
        name: "branchId",
        description: "Branch ID",
        type: CommandParameterTypes.STRING,
        valueType: "uuid",
      },
    ],
  },
  {
    command: CommandTypes.LIST_BUILD_PROFILE_BUILDS_OF_COMMIT,
    description: "Get list of builds of a commit",
    params: [
      {
        name: "commitId",
        description: "Commit ID",
        type: CommandParameterTypes.STRING,
        valueType: "uuid",
      },
    ],
  },
  {
    command: CommandTypes.LIST_DISTRIBUTION_PROFILES,
    description: "Get list of distribution profiles",
    params: [],
  },
  {
    command: CommandTypes.BUILD,
    description: "Start a new build",
    params: [
      {
        name: "profileId",
        description: "Build profile ID",
        type: CommandParameterTypes.STRING,
        valueType: "uuid",
      },
      {
        name: "branch",
        description: "Branch",
        type: CommandParameterTypes.SELECT,
        valueType: "string",
        params: [],
      },
      {
        name: "workflow",
        description: "Workflow",
        type: CommandParameterTypes.SELECT,
        valueType: "string",
        params: [],
      },
    ],
  },
  {
    command: CommandTypes.DOWNLOAD,
    description: "Download your artifact to the given directory on your machine",
    params: [
      {
        name: "path",
        description: "[OPTIONAL] The path for artifacts to be downloaded: (Defaults to the current directory)",
        type: CommandParameterTypes.STRING,
        valueType: "string",
        required: false,
      },
      {
        name: "commitId",
        description: "Commit ID of your build",
        type: CommandParameterTypes.STRING,
        valueType: "uuid",
      },
      {
        name: "buildId",
        description: "Build ID of your commit. This can be retrieved from builds of commit",
        type: CommandParameterTypes.STRING,
        valueType: "uuid",
      },
    ],
  },
  {
    command: CommandTypes.UPLOAD,
    description: "Upload your mobile app to selected distribution profile",
    params: [
      {
        name: "app",
        description: "App path",
        type: CommandParameterTypes.STRING,
        valueType: "path",
      },
      {
        name: "message",
        description: "Release notes",
        type: CommandParameterTypes.STRING,
        valueType: "string",
      },
      {
        name: "profileId",
        description: "Distribution profile ID",
        type: CommandParameterTypes.STRING,
        valueType: "uuid",
      },
    ],
  },
  {
    command: CommandTypes.CREATE_DISTRIBUTION_PROFILE,
    description: "Create a distribution profile",
    params: [
      {
        name: "name",
        description: "Profile name",
        type: CommandParameterTypes.STRING,
        valueType: "string",
      },
    ],
  },
  {
    command: CommandTypes.LIST_ENVIRONMENT_VARIABLE_GROUPS,
    description: "Get list of environment variable groups",
    params: [],
  },
  {
    command: CommandTypes.CREATE_ENVIRONMENT_VARIABLE_GROUP,
    description: "Create an environment variable group",
    params: [
      {
        name: "name",
        description: "Variable group name",
        type: CommandParameterTypes.STRING,
        valueType: "string",
      },
    ],
  },
  {
    command: CommandTypes.LIST_ENVIRONMENT_VARIABLES,
    description: "Get list of environment variables",
    params: [
      {
        name: "variableGroupId",
        description: "Variable Groups ID",
        type: CommandParameterTypes.STRING,
        valueType: "uuid",
      },
    ],
  },
  {
    command: CommandTypes.CREATE_ENVIRONMENT_VARIABLE,
    description: "Create a file or text environment variable",
    params: [
      {
        name: "type",
        description: "Type",
        type: CommandParameterTypes.SELECT,
        valueType: "string",
        params: [
          {
            name: "file",
            description: "File",
          },
          {
            name: "text",
            description: "Text",
          },
        ],
      },
      {
        name: "isSecret",
        description: "Secret",
        type: CommandParameterTypes.BOOLEAN,
        valueType: "boolean",
      },
      {
        name: "variableGroupId",
        description: "Variable group ID",
        type: CommandParameterTypes.STRING,
        valueType: "uuid",
      },
      {
        name: "key",
        description: "Key Name",
        type: CommandParameterTypes.STRING,
        valueType: "string",
      },
      {
        name: "value",
        description: `Key Value (You can skip this if you selected type of ${chalk.hex(APPCIRCLE_COLOR)("file")})`,
        type: CommandParameterTypes.STRING,
        valueType: "string",
      },
      {
        name: "filePath",
        description: `File path (You can skip this if you selected type of ${chalk.hex(APPCIRCLE_COLOR)("text")})`,
        type: CommandParameterTypes.STRING,
        valueType: "string",
      },
    ],
  },
  {
    command: CommandTypes.LIST_ENTERPRISE_PROFILES,
    description: "Get list of enterprise profiles",
    params: [],
  },
  {
    command: CommandTypes.LIST_ENTERPRISE_APP_VERSIONS,
    description: "Get list of enterprise app versions",
    params: [
      {
        name: "entProfileId",
        description: "Enterprise Profile ID",
        type: CommandParameterTypes.SELECT,
        valueType: "uuid",
      },
      {
        name: "publishType",
        description: "[OPTIONAL] Publish Type Empty,0=All,1=Beta,2=Live",
        type: CommandParameterTypes.STRING,
        required: false,
        valueType: "number",
      },
    ],
  },
  {
    command: CommandTypes.PUBLISH_ENTERPRISE_APP_VERSION,
    description: "Publish enterprise app version",
    params: [
      {
        name: "entProfileId",
        description: "Enterprise Profile ID",
        type: CommandParameterTypes.SELECT,
        valueType: "uuid",
      },
      {
        name: "entVersionId",
        description: "App Version ID",
        type: CommandParameterTypes.SELECT,
        valueType: "uuid",
      },
      {
        name: "summary",
        description: "Summary",
        type: CommandParameterTypes.STRING,
        valueType: "string",
      },
      {
        name: "releaseNotes",
        description: "Release Notes",
        type: CommandParameterTypes.STRING,
        valueType: "string",
      },
      {
        name: "publishType",
        description: "Publish Type 0=None,1=Beta,2=Live",
        type: CommandParameterTypes.STRING,
        valueType: "number",
      },
    ],
  },
  {
    command: CommandTypes.UNPUBLISH_ENTERPRISE_APP_VERSION,
    description: "Unpublish enterprise app version",
    params: [
      {
        name: "entProfileId",
        description: "Enterprise Profile ID",
        type: CommandParameterTypes.SELECT,
        valueType: "uuid",
      },
      {
        name: "entVersionId",
        description: "App Version ID",
        type: CommandParameterTypes.SELECT,
        valueType: "uuid",
      },
    ],
  },
  {
    command: CommandTypes.REMOVE_ENTERPRISE_APP_VERSION,
    description: "Remove enterprise app version",
    params: [
      {
        name: "entProfileId",
        description: "Enterprise Profile ID",
        type: CommandParameterTypes.SELECT,
        valueType: "uuid",
      },
      {
        name: "entVersionId",
        description: "App Version ID",
        type: CommandParameterTypes.SELECT,
        valueType: "uuid",
      },
    ],
  },
  {
    command: CommandTypes.NOTIFY_ENTERPRISE_APP_VERSION,
    description: "Notify enterprise app version",
    params: [
      {
        name: "entProfileId",
        description: "Enterprise Profile ID",
        type: CommandParameterTypes.SELECT,
        valueType: "uuid",
      },
      {
        name: "entVersionId",
        description: "App Version ID",
        type: CommandParameterTypes.SELECT,
        valueType: "uuid",
      },
      {
        name: "subject",
        description: "Subject",
        type: CommandParameterTypes.STRING,
        valueType: "string",
      },
      {
        name: "message",
        description: "Message",
        type: CommandParameterTypes.STRING,
        valueType: "string",
      },
    ],
  },
  {
    command: CommandTypes.UPLOAD_ENTERPRISE_APP_VERSION,
    description: "Upload enterprise app version for a profile",
    params: [
      {
        name: "entProfileId",
        description: "Enterprise Profile Id",
        type: CommandParameterTypes.SELECT,
        valueType: "uuid",
      },
      {
        name: "app",
        description: "App path",
        type: CommandParameterTypes.STRING,
        valueType: "string",
      },
    ],
  },
  {
    command: CommandTypes.UPLOAD_ENTERPRISE_APP,
    description: "Upload enterprise app version without a profile",
    params: [
      {
        name: "app",
        description: "App path",
        type: CommandParameterTypes.STRING,
        valueType: "string",
      },
    ],
  },
  {
    command: CommandTypes.GET_ENTERPRISE_DOWNLOAD_LINK,
    description: "Get enterprise app download link",
    params: [
      {
        name: "entProfileId",
        description: "Enterprise Profile Id",
        type: CommandParameterTypes.SELECT,
        valueType: "uuid",
      },
      {
        name: "entVersionId",
        description: "App Version ID",
        type: CommandParameterTypes.SELECT,
        valueType: "uuid",
      },
    ],
  },
];
