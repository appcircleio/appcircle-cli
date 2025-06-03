import { Command, createCommand } from "commander";
import { PROGRAM_NAME } from "./constant.js";
import { CommandTypes, Commands } from "./core/commands.js";

export type ProgramCommand = { fullCommandName: string, isGroupCommand: (commandName: CommandTypes) => boolean,  parent:  Command | null; name: () => string; args: any; opts: () => { [key: string]: any } };

const createCommands = (program: any, commands: typeof Commands, actionCb: any) => {
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
      .filter((p) => !p.requriedForInteractiveMode)
      .forEach((param) => {
        param.required !== false
          ? comandPrg.requiredOption(`--${param.name} <${param.valueType}>`, param.longDescription || param.description)
          : comandPrg.option(`--${param.name} <${param.valueType}>`, param.longDescription || param.description, param.defaultValue);
      });
    comandPrg.action(() => actionCb);
  });
};

const prepareFullCommandName = (command: Command | any): string => {
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
  
  program.version(`v${version}`, "-v, --version", "output the version number");
  
  program.option("-i, --interactive", "interactive mode (AppCircle GUI)");
  program.option("-o, --output <type>", "output type (json, plain)", "plain");
  
  program.helpInformation = () => {
    let helpString = `Appcircle CLI\n\nVersion: v${version}\n\n${cliDescription}\n\n`;
    helpString += `USAGE\n  ${PROGRAM_NAME} [options] [command]\n\n`;

    helpString += "GLOBAL OPTIONS\n";
    // Commander stores its default help option description, let's ensure it's included.
    // We'll reconstruct the options list to ensure consistent formatting and inclusion of help.
    const optionsToShow = [...program.options];
    if (!optionsToShow.find(opt => opt.flags.includes('-h, --help'))) {
        // Manually add help option details if not already captured in a customizable way
        // This depends on how commander exposes the default help option.
        // For now, assuming program.options includes it or that Commander adds it separately.
        // A safer bet for consistent display is to define it explicitly if needed.
        // However, Commander usually handles displaying its own help option.
        // The user wants to *mimic* the subcommand style. Let's list explicit options.
    }

    // Explicitly list known global options for consistent formatting
    const formattedOptions = [
      { flags: "-v, --version", description: "output the version number" },
      { flags: "-i, --interactive", description: "interactive mode (AppCircle GUI)" },
      { flags: "-o, --output <type>", description: "output type (json, plain) (default: \"plain\")" },
      { flags: "-h, --help", description: "display help for command" } // Assuming this is the standard help option
    ];

    formattedOptions.forEach(opt => {
      helpString += `  ${opt.flags.padEnd(28)} ${opt.description}\n`;
    });
    helpString += "\n";

    helpString += "AVAILABLE COMMANDS\n";
    Commands.filter(cmd => !cmd.ignore) 
      .forEach(command => {
        helpString += `  ${command.command.padEnd(28)} ${command.description}\n`;
    });
    helpString += "\n";

    helpString += "LEARN MORE\n";
    helpString += `  Use '${PROGRAM_NAME} <command> --help' for more information on a specific command.\n`;
    helpString += `  Run '${PROGRAM_NAME} --interactive' for a guided experience.\n`;
    helpString += `  Visit Appcircle documentation at https://docs.appcircle.io\n`; 

    return helpString;
  };
  
  createCommands(program, Commands, actionCb);

  program.configureOutput({
    outputError: (str, write) => {
      if (str.includes('error: required option')) {
        const inputArgs = process.argv.slice(2);
        function findCommandRecursive(args: string[], commandList: import('./core/commands').CommandType[]): import('./core/commands').CommandType | undefined {
          if (!args.length) return undefined;
          const [head, ...tail] = args;
          const cmd = commandList.find((c: import('./core/commands').CommandType) => c.command === head);
          if (cmd) {
            if (tail.length && cmd.subCommands) {
              const sub = findCommandRecursive(tail, cmd.subCommands);
              return sub || cmd;
            }
            return cmd;
          }
          return undefined;
        }
        const foundCommand = findCommandRecursive(inputArgs, Commands);
        if (foundCommand && foundCommand.longDescription) {
          write(foundCommand.longDescription + '\n');
        } else {
          write('Missing or invalid parameter. Please check the correct usage and examples with --help or see the documentation.\n');
        }
      } else if (str.includes('error: unknown command') || str.includes('error: unknown option')) {
        write('Incorrect Usage.\n\n');
        write('Use --help to see available commands and options.\n');
        write('Example: appcircle [command] [subcommand] --help\n');
      } else {
        write(str);
      }
    }
  });

  program.hook("preAction", (thisCommand: any, actionCommand: any) => {
    //console.log(thisCommand.name(), thisCommand.args , actionCommand.parent?.name())
    actionCb(createCommandActionCallback(actionCommand, thisCommand));
  });
  return {
    parse: () => program.parse(process.argv),
    onCommandRun: (cb: typeof actionCb) => (actionCb = cb),
  };
};