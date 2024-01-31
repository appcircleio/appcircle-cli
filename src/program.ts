import { Commands } from "./core/commands";

const { createCommand } = require("commander");

export type ProgramCommand = { parent?: ProgramCommand; name: () => string; args: any; opts: () => { [key: string]: any } };

export const createProgram = () => {
  const program = createCommand();
  let actionCb = (cmd: ProgramCommand) => {};

  program.version(require("../package.json").version, "-v, --version", "output the version number");
  program.option("-i, --interactive", "interactive mode (AppCircle GUI)");
  program.option("-o, --output <type>", "output type (json, plain)", "plain");

  //Add config command with subcommands
  const configCommand = program
    .command("config")
    .description("View and edit Appcircle CLI properties")
    .action(() => {});
  configCommand
    .command("list")
    .description("List Appcircle CLI properties for all configurations")
    .action(() => {});
  configCommand
    .command("get")
    .argument("[key]", "Config key [API_HOSTNAME, AUTH_HOSTMANE, AC_ACCESS_TOKEN]")
    .description("Get Print the value of a Appcircle CLI currently active configuration property")
    .action(() => {});
  configCommand
    .command("set")
    .argument("[key]", "Config key [API_HOSTNAME, AUTH_HOSTMANE, AC_ACCESS_TOKEN]")
    .argument("[value]", "Config value")
    .description("Set a Appcircle CLI currently active configuration property")
    .action(() => {});
  configCommand
    .command("current")
    .argument("[value]", "Current configuration environment name")
    .description("Set a Appcircle CLI currently active configuration environment")
    .action(() => {});
  configCommand
    .command("add")
    .argument("[value]", "New configuration environment name")
    .description("Add a new Appcircle CLI configuration environment")
    .action(() => {});
  configCommand
    .command("reset")
    .description("Reset a Appcircle CLI configuration to default")
    .action(() => {});
  configCommand
    .command("trust")
    .description("Trust the SSL certificate of the self-hosted Appcircle server")
    .action(()=> {});
  configCommand.action(() => {});

  Commands.filter((c) => !c.ignore).forEach((command) => {
    let comandPrg = program.command(command.command).description(command.description);
    command.params
      .filter((p) => !p.requriedForInteractiveMode)
      .forEach((param) => {
        param.required !== false
          ? comandPrg.requiredOption(`--${param.name} <${param.valueType}>`, param.description)
          : comandPrg.option(`--${param.name} <${param.valueType}>`, param.description);
      });
    comandPrg.action(() => actionCb);
  });
  program.executeSubCommand = () => false;

  program.hook("preAction", (thisCommand: any, actionCommand: ProgramCommand) => {
    //console.log(thisCommand.name(), thisCommand.args , actionCommand.parent?.name())
    actionCb({
      parent: {
        name: () => actionCommand.parent?.name() || "",
        args: () => actionCommand.parent?.args(),
        opts: () => ({ ...actionCommand.parent?.opts() }),
      },
      name: () => actionCommand.name(),
      args: () => (Array.isArray(actionCommand.args) ? actionCommand.args : actionCommand.args()),
      opts: () => ({ ...thisCommand.opts(), ...actionCommand.opts() }),
    });
  });
  return {
    parse: () => program.parse(process.argv),
    onCommandRun: (cb: typeof actionCb) => (actionCb = cb),
  };
};
