//@ts-ignore https://github.com/enquirer/enquirer/issues/212
import { prompt, Select, BooleanPrompt } from "enquirer";
import ora from "ora";
import chalk from "chalk";
import fs from "fs";
import minimist from "minimist";
import {
  getToken,
  getDistributionProfiles,
  createDistributionProfile,
  downloadArtifact,
  uploadArtifact,
  getBuildProfiles,
  startBuild,
  getEnvironmentVariableGroups,
  createEnvironmentVariableGroup,
  getEnvironmentVariables,
  createEnvironmentVariable,
  getBranches,
  getWorkflows,
  getCommits,
  getBuildsOfCommit,
  getEnterpriseProfiles,
  getEnterpriseAppVersions,
  publishEnterpriseAppVersion,
  unpublishEnterpriseAppVersion,
  removeEnterpriseAppVersion,
  notifyEnterpriseAppVersion,
  uploadEnterpriseApp,
  uploadEnterpriseAppVersion,
  getEnterpriseDownloadLink,
} from "./services";

import { CommandParameterTypes, CommandTypes, Commands } from "./command";
import { APPCIRCLE_COLOR } from "./constant";
import { ProgramCommand, createProgram } from "./program";

const runCommandHelper = (command: ProgramCommand) => {
  const params = command.opts() as any;
  switch (command.name()) {
    case CommandTypes.LOGIN:
      getToken(params);
      break;
    case CommandTypes.LIST_BUILD_PROFILES:
      getBuildProfiles(params);
      break;
    case CommandTypes.LIST_BUILD_PROFILE_BRANCHES:
      getBranches(params);
      break;
    case CommandTypes.LIST_BUILD_PROFILE_WORKFLOWS:
      getWorkflows(params);
      break;
    case CommandTypes.LIST_BUILD_PROFILE_COMMITS:
      getCommits(params);
      break;
    case CommandTypes.LIST_BUILD_PROFILE_BUILDS_OF_COMMIT:
      getBuildsOfCommit(params);
      break;
    case CommandTypes.LIST_DISTRIBUTION_PROFILES:
      getDistributionProfiles(params);
      break;
    case CommandTypes.BUILD:
      startBuild(params);
      break;
    case CommandTypes.DOWNLOAD:
      downloadArtifact(params);
      break;
    case CommandTypes.UPLOAD:
      uploadArtifact(params);
      break;
    case CommandTypes.CREATE_DISTRIBUTION_PROFILE:
      createDistributionProfile(params);
      break;
    case CommandTypes.LIST_ENVIRONMENT_VARIABLE_GROUPS:
      getEnvironmentVariableGroups(params);
      break;
    case CommandTypes.CREATE_ENVIRONMENT_VARIABLE_GROUP:
      createEnvironmentVariableGroup(params);
      break;
    case CommandTypes.LIST_ENVIRONMENT_VARIABLES:
      getEnvironmentVariables(params);
      break;
    case CommandTypes.CREATE_ENVIRONMENT_VARIABLE:
      createEnvironmentVariable(params as any);
      break;
    case CommandTypes.LIST_ENTERPRISE_PROFILES:
      getEnterpriseProfiles();
      break;
    case CommandTypes.LIST_ENTERPRISE_APP_VERSIONS:
      getEnterpriseAppVersions(params);
      break;
    case CommandTypes.PUBLISH_ENTERPRISE_APP_VERSION:
      publishEnterpriseAppVersion(params);
      break;
    case CommandTypes.UNPUBLISH_ENTERPRISE_APP_VERSION:
      unpublishEnterpriseAppVersion(params);
      break;
    case CommandTypes.REMOVE_ENTERPRISE_APP_VERSION:
      removeEnterpriseAppVersion(params);
      break;
    case CommandTypes.NOTIFY_ENTERPRISE_APP_VERSION:
      notifyEnterpriseAppVersion(params);
      break;
    case CommandTypes.UPLOAD_ENTERPRISE_APP:
      uploadEnterpriseApp(params);
      break;
    case CommandTypes.UPLOAD_ENTERPRISE_APP_VERSION:
      uploadEnterpriseAppVersion(params);
      break;
    case CommandTypes.GET_ENTERPRISE_DOWNLOAD_LINK:
      getEnterpriseDownloadLink(params);
      break;
    default:
      console.error("Command not found");
      break;
  }
};

(async () => {
  const program = createProgram();
  const argv = minimist(process.argv.slice(2));
  let params: any = {};
  let selectedCommand: (typeof Commands)[number];
  let selectedCommandDescription = "";
  let selectedCommandIndex = -1;
  if (process.argv.length === 2 || argv.i || argv.interactive) {
    console.info(
      chalk.hex(APPCIRCLE_COLOR)(
        `
    ███████ ██████╗ ██████╗  ██████╗██╗██████╗  ██████╗██╗     ███████╗
    ██╔══██╗██╔══██╗██╔══██╗██╔════╝██║██╔══██╗██╔════╝██║     ██╔════╝
    ███████║██████╔╝██████╔╝██║     ██║██████╔╝██║     ██║     █████╗  
    ██╔══██║██╔═══╝ ██╔═══╝ ██║     ██║██╔══██╗██║     ██║     ██╔══╝  
    ██║  ██║██║     ██║     ╚██████╗██║██║  ██║╚██████╗███████╗███████╗
    ╚═╝  ╚═╝╚═╝     ╚═╝      ╚═════╝╚═╝╚═╝  ╚═╝ ╚═════╝╚══════╝╚══════╝             
                `
      )
    );

    const commandSelect = new Select({
      name: "command",
      message: "What do you want to do?",
      choices: [...Commands.map((command, index) => `${index + 1}. ${command.description}`)],
    });

    selectedCommandDescription = await commandSelect.run();
    selectedCommandIndex = Number(selectedCommandDescription.split(".")[0]) - 1;
    selectedCommand = Commands[selectedCommandIndex];

    for (let param of selectedCommand.params) {
      if (param.name === "branch") {
        const spinner = ora("Branches fetching").start();

        const branches = await getBranches({ profileId: params.profileId || "" });
        if (!branches || branches.length === 0) {
          spinner.text = "No branches available";
          spinner.fail();
          return;
        }
        //@ts-ignore
        param.params = branches.map((branch: any) => ({ name: branch.name, description: branch.name }));

        spinner.text = "Branches fetched";
        spinner.succeed();
      } else if (param.name === "entProfileId") {
        const spinner = ora("Enterprise Profiles fetching").start();
        const profiles = await getEnterpriseProfiles();
        if (!profiles || profiles.length === 0) {
          spinner.text = "No enterprise profile available";
          spinner.fail();
          return;
        }
        //@ts-ignore
        param.params = profiles.map((profile: any) => ({ name: profile.id, message: profile.name }));
        spinner.text = "Enterprise Profiles fetched";
        spinner.succeed();
      } else if (param.name === "entVersionId") {
        const spinner = ora("Enterprise Versions fetching").start();
        const profiles = await getEnterpriseAppVersions({ entProfileId: params.entProfileId, publishType: "" });
        if (!profiles || profiles.length === 0) {
          spinner.text = "No version available";
          spinner.fail();
          return;
        }
        //@ts-ignore
        param.params = profiles.map((profile: any) => ({ name: profile.id, message: `${profile.version} (${profile.versionCode})` }));
        spinner.text = "Enterprise Versions fetched";
        spinner.succeed();
      } else if (param.name === "workflow") {
        const spinner = ora("Workflow fetching").start();
        const workflows = await getWorkflows({ profileId: params.profileId || "" });
        if (!workflows || workflows.length === 0) {
          spinner.text = "No workflows available";
          spinner.fail();
          return;
        }
        //@ts-ignore
        param.params = workflows.map((workflow: any) => ({ name: workflow.workflowName, description: workflow.workflowName }));
        spinner.text = "Workflows fetched";
        spinner.succeed();
      } else if (param.name === "value" && params.isSecret) {
        param.type = CommandParameterTypes.PASSWORD;
      }

      if ([CommandParameterTypes.STRING, CommandParameterTypes.PASSWORD].includes(param.type)) {
        const stringPrompt = await prompt([
          {
            type: param.type,
            name: param.name,
            message: param.description,
            validate(value) {
              //@ts-ignore
              if (value.length === 0 && param.required !== false) {
                return "This field is required";
              } else if (["app"].includes(param.name)) {
                return fs.existsSync(value) ? true : "File not exists";
              }
              return true;
            },
          },
        ]);
        (params as any)[param.name] = (stringPrompt as any)[Object.keys(stringPrompt)[0]];
      } else if (param.type === CommandParameterTypes.BOOLEAN) {
        const booleanPrompt = new BooleanPrompt({
          name: param.name,
          message: param.description,
        });
        //@ts-ignore
        params[param.name] = await booleanPrompt.run();
      } else if (param.type === CommandParameterTypes.SELECT) {
        const selectPrompt = new Select({
          name: param.name,
          message: param.description,
          choices: [
            //@ts-ignore
            ...param.params.map((val: any) => val),
          ],
        });
        (params as any)[param.name] = await selectPrompt.run();
      }
    }
    runCommandHelper({ name: () => selectedCommand.command, args: [], opts: () => params });
  } else {
    program.onCommandRun(runCommandHelper);
    try {
      program.parse();
    } catch (err) {
      //hadnling command error
      process.exit(1);
    }
  }
})().catch(() => {});
