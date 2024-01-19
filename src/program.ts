import { Commands } from "./core/commands";

const { createCommand } = require("commander");

export type ProgramCommand = { name: () => string; args: any; opts: () => { [key: string]: any } };

export const createProgram = () => {
  const program = createCommand();
  let actionCb = (cmd: ProgramCommand) => {};

  program.version(require("../package.json").version, "-v, --version", "output the version number");
  program.option("-i, --interactive", "interactive mode (AppCircle GUI)");
  program.option("-o, --output <type>", "output type (json, plain)", "plain");

  Commands.forEach((command) => {
    let comandPrg = program.command(command.command).description(command.description);
    command.params.forEach((param) => {
      param.required !== false
        ? comandPrg.requiredOption(`--${param.name} <${param.valueType}>`, param.description)
        : comandPrg.option(`--${param.name} <${param.valueType}>`, param.description);
    });
    comandPrg.action(() => actionCb);
  });

  program.exitOverride();
  program.hook("preAction", (thisCommand: any, actionCommand: ProgramCommand) => {
    actionCb({
      name: () => actionCommand.name(),
      args: () => actionCommand.args(),
      opts: () => ({ ...thisCommand.opts(), ...actionCommand.opts() }),
    });
  });
  return {
    parse: () => program.parse(process.argv),
    onCommandRun: (cb: typeof actionCb) => (actionCb = cb),
  };
};
