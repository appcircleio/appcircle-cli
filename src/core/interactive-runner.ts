import fs from "fs";
import chalk from "chalk";
import ora from "ora";
import moment from "moment";
//@ts-ignore https://github.com/enquirer/enquirer/issues/212
import { prompt, Select, AutoComplete, BooleanPrompt } from "enquirer";
import { runCommand } from "./command-runner";
import { Commands, CommandParameterTypes } from "./commands";
import { APPCIRCLE_COLOR } from "../constant";
import { createOra } from "../utils/orahelper";
import {
  getBranches,
  getEnterpriseProfiles,
  getEnterpriseAppVersions,
  getWorkflows,
  getBuildProfiles,
  getCommits,
  getBuildsOfCommit,
  getDistributionProfiles,
  getEnvironmentVariableGroups,
} from "../services";
import { DefaultEnvironmentVariables, getConfigStore } from "../config";

const prepareConfigCommand = async () => {
  const commandSelect = new Select({
    name: "action",
    message: "Which action do you want?",
    choices: [
      { name: "list", message: "1. List (List CLI properties for all configurations)" },
      { name: "get", message: "2. Get (Print the value of an CLI currently active configuration property)" },
      { name: "set", message: "3. Set (Set a CLI currently active configuration property)" },
      { name: "current", message: "4. Current (Set a CLI currently active configuration property)" },
      { name: "add", message: "5. Add (Add a new CLI configuration environment)" },
      { name: "reset", message: "6. Reset (Reset a CLI configuration to default)" },
    ],
  });
  const action = await commandSelect.run();

  const configActionCommandArgs = [] as string[];
  const configActionCommand = {
    parent: { name: () => "config", args: () => [], opts: () => ({}) },
    name: () => action,
    args: () => configActionCommandArgs,
    opts: () => ({}),
  };

  const keySelect = async (questionStr: string = "Key") => {
    const keySelect = new Select({
      name: "action",
      message: questionStr,
      choices: Object.keys(DefaultEnvironmentVariables),
    });
    const key = await keySelect.run();
    configActionCommandArgs.push(key);
  };

  const valueInput = async () => {
    const valueResponse = (await prompt({
      type: "input",
      name: "value",
      message: "Value",
    })) as any;
    configActionCommandArgs.push(valueResponse.value as string);
  };

  const envSelect = async (questionStr: string = "Which key do you want?") => {
    const envSelect = new Select({
      name: "action",
      message: "Environment",
      choices: Object.keys(getConfigStore().envs),
    });
    const key = await envSelect.run();
    configActionCommandArgs.push(key);
  };

  let args = [];
  switch (action) {
    case "reset":
    case "list": {
      break;
    }
    case "get": {
      await keySelect();
      break;
    }
    case "set": {
      await keySelect();
      await valueInput();
      break;
    }
    case "current": {
      await envSelect();
      break;
    }
    case "add": {
      await valueInput();
      break;
    }
  }
  return configActionCommand;
};

export const runCommandsInteractively = async () => {
  let params: any = {};
  let selectedCommand: (typeof Commands)[number];
  let selectedCommandDescription = "";
  let selectedCommandIndex = -1;

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

  const commandSelect = new AutoComplete({
    name: "command",
    message: `What do you want to do?${` (${Commands.length} Options)`}`,
    limit: 10,
    choices: [...Commands.map((command, index) => `${index + 1}. ${command.description}`)],
  });

  selectedCommandIndex = Number((await commandSelect.run()).split(".")[0]) - 1;
  selectedCommand = Commands[selectedCommandIndex];

  //Selected command is equal config
  if (selectedCommandIndex === 0) {
    const configActionCommand = await prepareConfigCommand();
    return runCommand(configActionCommand);
  }

  for (let param of selectedCommand.params) {
    if (param.name === "branchId") {
      const spinner = ora("Branches fetching").start();

      const branches = (await getBranches({ profileId: params.profileId || "" })).branches;
      if (!branches || branches.length === 0) {
        spinner.text = "No branches available";
        spinner.fail();
        return;
      }
      //@ts-ignore
      param.params = branches.map((branch: any) => ({ name: branch.id, message: `${branch.id} (${branch.name})` }));
      spinner.text = "Branches fetched";
      spinner.succeed();
    } else if (param.name === "profileId") {
      const spinner = ora("Build Profiles fetching").start();
      const profiles = await getBuildProfiles();
      if (!profiles || profiles.length === 0) {
        spinner.text = "No build profile available";
        spinner.fail();
        return;
      }
      //@ts-ignore
      param.params = profiles.map((profile: any) => ({ name: profile.id, message: `${profile.id} (${profile.name})` }));
      spinner.text = "Build Profiles fetched";
      spinner.succeed();
    } else if (param.name === "commitId") {
      const spinner = ora("Commits fetching").start();
      const commits = await getCommits({ profileId: params.profileId || "", branchId: params.branchId || "" });
      if (!commits || commits.length === 0) {
        spinner.text = "No commits available";
        spinner.fail();
        return;
      }
      //@ts-ignore
      param.params = commits.map((commit: any) => ({
        name: commit.id,
        message: `${commit.id} (${JSON.stringify(commit.message.substring(0, 20) + "...")})`,
      }));
      spinner.text = "Commits fetched";
      spinner.succeed();
    } else if (param.name === "buildId") {
      const spinner = ora("Builds fetching").start();
      const builds = (await getBuildsOfCommit({ commitId: params.commitId })).builds;
      if (!builds || builds.length === 0) {
        spinner.text = "No builds available";
        spinner.fail();
        return;
      }
      //@ts-ignore
      param.params = builds.map((build: any) => ({ name: build.id, message: `${build.id} (${moment(build.startDate).calendar()})` }));
      spinner.text = "Builds fetched";
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
      param.params = profiles.map((profile: any) => ({ name: profile.id, message: `${profile.id} (${profile.name})` }));
      spinner.text = "Enterprise Profiles fetched";
      spinner.succeed();
    } else if (param.name === "distProfileId") {
      const spinner = ora("Distribution Profiles fetching").start();
      const profiles = await getDistributionProfiles();
      if (!profiles || profiles.length === 0) {
        spinner.text = "No distribution profile available";
        spinner.fail();
        return;
      }
      //@ts-ignore
      param.params = profiles.map((profile: any) => ({ name: profile.id, message: `${profile.id} (${profile.name})` }));
      spinner.text = "Distribution Profiles fetched";
      spinner.succeed();
    } else if (param.name === "variableGroupId") {
      const spinner = ora("Environment Variable Groups fetching").start();
      const groups = await getEnvironmentVariableGroups();
      if (!groups || groups.length === 0) {
        spinner.text = "No environment variable groups available";
        spinner.fail();
        return;
      }
      //@ts-ignore
      param.params = groups.map((group: any) => ({ name: group.id, message: `${group.id} (${group.name})` }));
      spinner.text = "Environment Variable Groups fetched";
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
    } else if (param.name === "workflowId") {
      const spinner = ora("Workflow fetching").start();
      const workflows = await getWorkflows({ profileId: params.profileId || "" });
      if (!workflows || workflows.length === 0) {
        spinner.text = "No workflows available";
        spinner.fail();
        return;
      }
      //@ts-ignore
      param.params = workflows.map((workflow: any) => ({ name: workflow.id, message: `${workflow.id} (${workflow.workflowName})` }));
      spinner.text = "Workflows fetched";
      spinner.succeed();
    } else if (param.name === "value" && params.isSecret) {
      param.type = CommandParameterTypes.PASSWORD;
    }

    // If has paramType and type  match to selected type
    if (!param.paramType || param.paramType === params.type) {
      // Prompt for parameter
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
        const selectPrompt = new AutoComplete({
          name: param.name,
          message: `${param.description}${param.params.length > 10 ?` (${param.params.length} Options)`: ''}`,
          initial: param.defaultValue,
          limit: 10,
          choices: [
            //@ts-ignore
            ...param.params.map((val: any) => val),
          ],
        });
        (params as any)[param.name] = await selectPrompt.run();
      }
    }
  }
  // debug console.log("params:", params);
  runCommand({ name: () => selectedCommand.command, opts: () => params, args: () => Object.values(params) });
};
