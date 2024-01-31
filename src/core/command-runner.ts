import path from "path";
import os from "os";
import { CommandTypes } from "./commands";
import {
  EnvironmentVariables,
  addNewConfigVariable,
  clearConfigs,
  getConfigFilePath,
  getConfigStore,
  getConsoleOutputType,
  getCurrentConfigVariable,
  getEnviromentsConfigToWriting,
  readEnviromentConfigVariable,
  setCurrentConfigVariable,
  writeEnviromentConfigVariable,
} from "../config";
import { createOra } from "../utils/orahelper";
import { ProgramCommand } from "../program";
import {
  getToken,
  getBuildProfiles,
  getBranches,
  getWorkflows,
  getCommits,
  getBuildsOfCommit,
  getDistributionProfiles,
  startBuild,
  downloadArtifact,
  uploadArtifact,
  createDistributionProfile,
  getEnvironmentVariableGroups,
  createEnvironmentVariableGroup,
  getEnvironmentVariables,
  createEnvironmentVariable,
  getEnterpriseProfiles,
  getEnterpriseAppVersions,
  publishEnterpriseAppVersion,
  unpublishEnterpriseAppVersion,
  removeEnterpriseAppVersion,
  notifyEnterpriseAppVersion,
  uploadEnterpriseApp,
  uploadEnterpriseAppVersion,
  getEnterpriseDownloadLink,
  getConfigurations,
  trustAppcircleCertificate,
} from "../services";
import { commandWriter, configWriter } from "./writer";

const handleConfigCommand = (command: ProgramCommand) => {
  const action = command.name();
  const key = (command.args()[0] || "");
  if (action === "list") {
    const store = getConfigStore();
    if (getConsoleOutputType() === "json") {
      configWriter(store);
    } else {
      configWriter({ "current": store.current, path: getConfigFilePath() });
      configWriter(getEnviromentsConfigToWriting());
    }
  } else if (action === "set") {
    writeEnviromentConfigVariable(key, command.args()[1]);
    configWriter({ [key]: readEnviromentConfigVariable(key)});
  } else if (action === "get") {
    configWriter({ [key]: readEnviromentConfigVariable(key)});
  }  else if (action === "current") {
    const store = getConfigStore();
    if(key){
      if(store.envs[key]){
        setCurrentConfigVariable(key);
        configWriter({ "current": getCurrentConfigVariable() });
      }else{
        throw new Error("Config command 'current' action requires a valid value");
      }
    }else{
      throw new Error("Config command 'current' action requires a value");
    }
  }else if (action === "add") {
    if(key){
      addNewConfigVariable(key);
      configWriter({ "current": getCurrentConfigVariable() });
      configWriter(getEnviromentsConfigToWriting());
    }else{
      throw new Error("Config command 'add' action requires a value(key)");
    }
  }else if (action === "reset") {
      clearConfigs()
      configWriter({ "current": getCurrentConfigVariable() });
      configWriter(getEnviromentsConfigToWriting());
  }else if (action == "trust"){
      trustAppcircleCertificate()
  }
  else {
    throw new Error("Config command action not found");
  }
};

export const runCommand = async (command: ProgramCommand) => {
  const params = command.opts() as any;
  const commandName = command.name();
  let responseData;
  

  if(command.parent?.name() === 'config'){
    return handleConfigCommand(command);
  }

  switch (commandName) {
    case CommandTypes.LOGIN: {
      responseData = await getToken(params);
      writeEnviromentConfigVariable(EnvironmentVariables.AC_ACCESS_TOKEN, responseData.access_token);
      commandWriter(CommandTypes.LOGIN, responseData);
      break;
    }
    case CommandTypes.LIST_BUILD_PROFILES: {
      responseData = await getBuildProfiles(params);
      commandWriter(CommandTypes.LIST_BUILD_PROFILES, responseData);
      break;
    }
    case CommandTypes.LIST_BUILD_PROFILE_BRANCHES: {
      responseData = await getBranches(params);
      commandWriter(CommandTypes.LIST_BUILD_PROFILE_BRANCHES, responseData);
      break;
    }
    case CommandTypes.LIST_BUILD_PROFILE_WORKFLOWS: {
      responseData = await getWorkflows(params);
      commandWriter(CommandTypes.LIST_BUILD_PROFILE_WORKFLOWS, responseData);
      break;
    }
    case CommandTypes.LIST_BUILD_PROFILE_CONFIGURATIONS: {
      responseData = await getConfigurations(params);
      commandWriter(CommandTypes.LIST_BUILD_PROFILE_CONFIGURATIONS, responseData);
      break;
    }
    
    case CommandTypes.LIST_BUILD_PROFILE_COMMITS: {
      responseData = await getCommits(params);
      commandWriter(CommandTypes.LIST_BUILD_PROFILE_COMMITS, responseData);
      break;
    }
    case CommandTypes.LIST_BUILD_PROFILE_BUILDS_OF_COMMIT: {
      responseData = await getBuildsOfCommit(params);
      commandWriter(CommandTypes.LIST_BUILD_PROFILE_BUILDS_OF_COMMIT, responseData);
      break;
    }
    case CommandTypes.LIST_DISTRIBUTION_PROFILES: {
      responseData = await getDistributionProfiles(params);
      commandWriter(CommandTypes.LIST_DISTRIBUTION_PROFILES, responseData);
      break;
    }
    case CommandTypes.BUILD: {
      //Check optional params if need one of them
      if(!params.branchId && !params.branch){
        console.error("error: You must provide either branchId or branch parameter");
        process.exit(1);
      }
      if(!params.workflowId && !params.workflow){
        console.error("error: You must provide either workflowId or workflow parameter");
        process.exit(1);
      }
      const spinner = createOra(`Try to start a new build`).start();
      try {
        responseData = await startBuild(params);
        commandWriter(CommandTypes.BUILD, responseData);
        spinner.text = `Build added to queue successfully.\n\nTaskId: ${responseData.taskId}\nQueueItemId: ${responseData.queueItemId}`;
        spinner.succeed();
      } catch (e) {
        spinner.fail("Build failed");
        throw e;
      }
      break;
    }
    case CommandTypes.DOWNLOAD: {
      const downloadPath = path.resolve((params.path || "").replace("~", `${os.homedir}`));
      const spinner = createOra(`Downloading file artifact.zip`).start();
      try {
        responseData = await downloadArtifact(params, downloadPath);
        commandWriter(CommandTypes.DOWNLOAD, responseData);
        spinner.text = `The file artifact.zip is downloaded successfully under path:\n${downloadPath}`;
        spinner.succeed();
      } catch (e) {
        spinner.text = "The file could not be downloaded.";
        spinner.fail();
      }
      break;
    }
    case CommandTypes.UPLOAD: {
      const spinner = createOra("Try to upload the app").start();
      try {
        responseData = await uploadArtifact(params);
        commandWriter(CommandTypes.UPLOAD, responseData);
        spinner.text = `App uploaded successfully.\n\nTaskId: ${responseData.taskId}`;
        spinner.succeed();
      } catch (e) {
        spinner.fail("Upload failed");
      }
      break;
    }
    case CommandTypes.CREATE_DISTRIBUTION_PROFILE: {
      responseData = await createDistributionProfile(params);
      commandWriter(CommandTypes.CREATE_DISTRIBUTION_PROFILE, { ...responseData, name: params.name });
      break;
    }
    case CommandTypes.LIST_ENVIRONMENT_VARIABLE_GROUPS: {
      responseData = await getEnvironmentVariableGroups(params);
      commandWriter(CommandTypes.LIST_ENVIRONMENT_VARIABLE_GROUPS, responseData);
      break;
    }
    case CommandTypes.CREATE_ENVIRONMENT_VARIABLE_GROUP: {
      responseData = await createEnvironmentVariableGroup(params);
      commandWriter(CommandTypes.CREATE_ENVIRONMENT_VARIABLE_GROUP, { ...responseData, name: params.name });
      break;
    }
    case CommandTypes.LIST_ENVIRONMENT_VARIABLES: {
      responseData = await getEnvironmentVariables(params);
      commandWriter(CommandTypes.LIST_ENVIRONMENT_VARIABLES, responseData);
      break;
    }
    case CommandTypes.CREATE_ENVIRONMENT_VARIABLE: {
      responseData = await createEnvironmentVariable(params as any);
      commandWriter(CommandTypes.CREATE_ENVIRONMENT_VARIABLE, { ...responseData, key: params.key });
      break;
    }
    case CommandTypes.LIST_ENTERPRISE_PROFILES: {
      responseData = await getEnterpriseProfiles();
      commandWriter(CommandTypes.LIST_ENTERPRISE_PROFILES, responseData);
      break;
    }
    case CommandTypes.LIST_ENTERPRISE_APP_VERSIONS: {
      responseData = await getEnterpriseAppVersions(params);
      commandWriter(CommandTypes.LIST_ENTERPRISE_APP_VERSIONS, responseData);
      break;
    }
    case CommandTypes.PUBLISH_ENTERPRISE_APP_VERSION: {
      responseData = await publishEnterpriseAppVersion(params);
      commandWriter(CommandTypes.PUBLISH_ENTERPRISE_APP_VERSION, responseData);
      break;
    }
    case CommandTypes.UNPUBLISH_ENTERPRISE_APP_VERSION: {
      responseData = await unpublishEnterpriseAppVersion(params);
      commandWriter(CommandTypes.UNPUBLISH_ENTERPRISE_APP_VERSION, responseData);
      break;
    }
    case CommandTypes.REMOVE_ENTERPRISE_APP_VERSION: {
      const spinner = createOra("Try to delete the app version").start();
      try {
        responseData = await removeEnterpriseAppVersion(params);
        commandWriter(CommandTypes.REMOVE_ENTERPRISE_APP_VERSION, responseData);
        spinner.text = `App version deleted successfully.\n\nTaskId: ${responseData.taskId}`;
        spinner.succeed();
      } catch (e) {
        spinner.fail("App version delete failed");
      }
      break;
    }
    case CommandTypes.NOTIFY_ENTERPRISE_APP_VERSION: {
      const spinner = createOra(`Notifying users with new version for ${params.entVersionId}`).start();
      try {
        responseData = await notifyEnterpriseAppVersion(params);
        commandWriter(CommandTypes.NOTIFY_ENTERPRISE_APP_VERSION, responseData);
        spinner.text = `Version notification sent successfully.\n\nTaskId: ${responseData.taskId}`;
        spinner.succeed();
      } catch (e) {
        spinner.fail("Notification failed");
      }
      break;
    }
    case CommandTypes.UPLOAD_ENTERPRISE_APP: {
      const spinner = createOra("Try to upload the app").start();
      try {
        responseData = await uploadEnterpriseApp(params);
        commandWriter(CommandTypes.UPLOAD_ENTERPRISE_APP, responseData);
        spinner.text = `New profile created and app uploaded successfully.\n\nTaskId: ${responseData.taskId}`;
        spinner.succeed();
      } catch (e) {
        spinner.fail("Upload failed");
      }
      break;
    }
    case CommandTypes.UPLOAD_ENTERPRISE_APP_VERSION: {
      const spinner = createOra("Try to upload the app").start();
      try {
        responseData = await uploadEnterpriseAppVersion(params);
        commandWriter(CommandTypes.UPLOAD_ENTERPRISE_APP_VERSION, responseData);
        spinner.text = `App version uploaded successfully.\n\nTaskId: ${responseData.taskId}`;
        spinner.succeed();
      } catch (e) {
        spinner.fail("Upload failed");
      }
      break;
    }
    case CommandTypes.GET_ENTERPRISE_DOWNLOAD_LINK: {
      responseData = await getEnterpriseDownloadLink(params);
      commandWriter(CommandTypes.GET_ENTERPRISE_DOWNLOAD_LINK, responseData);
      break;
    }
    case "config":
      handleConfigCommand(command);
      break;
    default: {
      console.error("Command not found: ", commandName );
      process.exit(1);
    }
  }
};
