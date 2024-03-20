import { Command } from "commander";
import { PROGRAM_NAME } from "./constant";
import { CommandTypes, Commands } from "./core/commands";

const { createCommand } = require("commander");

export type ProgramCommand = { fullCommandName: string, isGroupCommand: (commandName: CommandTypes) => boolean,  parent:  Command | null; name: () => string; args: any; opts: () => { [key: string]: any } };

const createCommands = (program: any, commands: typeof Commands, actionCb: any) => {
  commands.filter((c) => !c.ignore).forEach((command) => {
    let comandPrg = program.command(command.command).description(command.description);

    //Create arguments
    command.arguments?.forEach((arg) => {
      comandPrg.argument(`[${arg.name}]`, arg.description);
    });

    //Create sub commands.
    createCommands(comandPrg, command.subCommands || [], actionCb);

    command.params
      .filter((p) => !p.requriedForInteractiveMode)
      .forEach((param) => {
        param.required !== false
          ? comandPrg.requiredOption(`--${param.name} <${param.valueType}>`, param.description)
          : comandPrg.option(`--${param.name} <${param.valueType}>`, param.description);
      });
    comandPrg.action(() => actionCb);
  });
};

const prepareFullCommandName = (command: Command): string => {
  if (command.parent) {
    return prepareFullCommandName(command.parent) + "-" + command.name();
  }
  return PROGRAM_NAME;
};

export const createCommandActionCallback = (actionCommand: any, thisCommand?: any): ProgramCommand => {
  
const fullCommandName = prepareFullCommandName(actionCommand);

return ({
  fullCommandName: prepareFullCommandName(actionCommand),
  isGroupCommand: (commandName: string) => fullCommandName.includes(`${PROGRAM_NAME}-${commandName}`),
  parent: actionCommand.parent,
  name: () => actionCommand.name(),
  args: () => (Array.isArray(actionCommand.args) ? actionCommand.args : actionCommand.args()),
  opts: () => ({ ...thisCommand?.opts(), ...actionCommand.opts() }),
});
};

export const createProgram = () => {
  const program = createCommand();
  let actionCb = (cmd: ProgramCommand) => {};

  program.version(require("../package.json").version, "-v, --version", "output the version number");
  program.option("-i, --interactive", "interactive mode (AppCircle GUI)");
  program.option("-o, --output <type>", "output type (json, plain)", "plain");
  
  program.executeSubCommand = () => false;

  createCommands(program, Commands, actionCb);

  program.hook("preAction", (thisCommand: any, actionCommand: any) => {
    //console.log(thisCommand.name(), thisCommand.args , actionCommand.parent?.name())
    actionCb(createCommandActionCallback(actionCommand, thisCommand));
  });
  return {
    parse: () => program.parse(process.argv),
    onCommandRun: (cb: typeof actionCb) => (actionCb = cb),
  };
};