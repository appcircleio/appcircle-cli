import { Command, createCommand } from "commander";
import { PROGRAM_NAME } from "./constant.js";
import { CommandTypes, Commands, CommandParameterTypes } from "./core/commands.js";
import { 
  handleProgramOutputError, 
  generateProgramHelp 
} from "./core/program-utilities.js";

export type ProgramCommand = { fullCommandName: string, isGroupCommand: (commandName: CommandTypes) => boolean,  parent:  Command | null; name: () => string; args: any; opts: () => { [key: string]: any } };

export const createCommands = (program: any, commands: typeof Commands, actionCb: any) => {
  commands.filter((c) => !c.ignore).forEach((command) => {
    let comandPrg = program.command(command.command).description(command.description);

    if (command.longDescription) {
      comandPrg.addHelpText('after', `\n${command.longDescription}\n`);
    }

    //Create arguments
    command.arguments?.forEach((arg) => {
      comandPrg.argument(`[${arg.name}]`, arg.longDescription || arg.description);
    });

    //Create sub commands.
    createCommands(comandPrg, command.subCommands || [], actionCb);

    command.params
      .forEach((param) => {
        if (param.type === CommandParameterTypes.BOOLEAN) {
          // Boolean parameters don't need value type specification
          comandPrg.option(`--${param.name}`, param.longDescription || param.description, param.defaultValue);
        } else {
          // Use optional syntax [type] for all non-boolean parameters to allow custom validation
          // This lets us provide better error messages for missing or invalid values
          // Required parameters are validated in our custom validation logic
          comandPrg.option(`--${param.name} [${param.valueType}]`, param.longDescription || param.description, param.defaultValue);
        }
      });
    comandPrg.action(() => actionCb);
  });
};

export const prepareFullCommandName = (command: Command | any): string => {
  if (!command || typeof command.name !== 'function') {
    return PROGRAM_NAME;
  }

  const commandNameString = command.name();

  let parentFullName = PROGRAM_NAME;

  if (command.parent && typeof command.parent === 'object') {
      parentFullName = prepareFullCommandName(command.parent);
  }

  if (parentFullName === PROGRAM_NAME) {
    if (commandNameString && commandNameString !== PROGRAM_NAME) {
      return PROGRAM_NAME + "-" + commandNameString;
    } else {
      return PROGRAM_NAME;
    }
  } else {
    if (commandNameString) {
      return parentFullName + "-" + commandNameString;
    } else {
      return parentFullName;
    }
  }
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
  
  const version = require("../package.json").version;
  const cliDescription = `Appcircle CLI is a command-line interface to interact with the Appcircle platform, enabling you to manage your CI/CD workflows, builds, testing distribution, and more, directly from your terminal.`;
  
  program.name(PROGRAM_NAME);
  program.version(`v${version}`, "-v, --version", "output the version number");
  
  program.option("-i, --interactive", "interactive mode (AppCircle GUI)");
  program.option("-o, --output <type>", "output type (json, plain)", "plain");
  
  program.helpInformation = () => {
    return generateProgramHelp(PROGRAM_NAME, version, cliDescription, Commands);
  };
  
  createCommands(program, Commands, actionCb);

  program.configureOutput({
    outputError: (str, write) => {
      const inputArgs = process.argv.slice(2);
      handleProgramOutputError(str, write, inputArgs, Commands);
    }
  });

  program.hook("preAction", (thisCommand: any, actionCommand: any) => {
    //console.log(thisCommand.name(), thisCommand.args , actionCommand.parent?.name())
    actionCb(createCommandActionCallback(actionCommand, thisCommand));
  });
  return {
    parseAsync: () => program.parseAsync(process.argv),
    onCommandRun: (cb: typeof actionCb) => (actionCb = cb),
  };
};