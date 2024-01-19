import fs from "fs";
import chalk from "chalk";
import ora from "ora";
//@ts-ignore https://github.com/enquirer/enquirer/issues/212
import { prompt, Select, BooleanPrompt } from "enquirer";
import { runCommand } from "./command-runner";
import { Commands, CommandParameterTypes } from "./commands";
import { APPCIRCLE_COLOR } from "../constant";
import { createOra } from "../utils/orahelper";
import { getBranches, getEnterpriseProfiles, getEnterpriseAppVersions, getWorkflows } from "../services";
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

      const branches = (await getBranches({ profileId: params.profileId || "" })).branches;
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
      const spinner = createOra("Enterprise Profiles fetching").start();
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
      const spinner = createOra("Enterprise Versions fetching").start();
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
      const spinner = createOra("Workflow fetching").start();
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
  runCommand({ name: () => selectedCommand.command, args: [], opts: () => params });
};
