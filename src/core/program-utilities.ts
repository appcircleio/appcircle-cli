/**
 * @fileoverview Utility functions for program.ts to improve testability
 * Extracted utilities from program.ts error handling and help generation
 */

import { CommandType } from './commands.js';

/**
 * Recursively finds a command in the command tree based on provided arguments
 * @param args Command line arguments array
 * @param commandList Available commands list
 * @returns Found command or undefined
 */
export const findCommandRecursive = (
  args: string[], 
  commandList: CommandType[]
): CommandType | undefined => {
  if (!args.length) return undefined;
  
  const [head, ...tail] = args;
  const cmd = commandList.find((c: CommandType) => c.command === head);
  
  if (cmd) {
    if (tail.length && cmd.subCommands) {
      const sub = findCommandRecursive(tail, cmd.subCommands);
      return sub || cmd;
    }
    return cmd;
  }
  
  return undefined;
};

/**
 * Handles required option errors by finding the command and showing appropriate help
 * @param inputArgs Process arguments array
 * @param commandList Available commands list
 * @param write Write function to output messages
 */
export const handleRequiredOptionError = (
  inputArgs: string[],
  commandList: CommandType[],
  write: (str: string) => void
): void => {
  const foundCommand = findCommandRecursive(inputArgs, commandList);
  if (foundCommand && foundCommand.longDescription) {
    write(foundCommand.longDescription + '\n');
  } else {
    write('Missing or invalid parameter. Please check the correct usage and examples with --help or see the documentation.\n');
  }
};

/**
 * Handles unknown command/option errors
 * @param write Write function to output messages
 */
export const handleUnknownCommandError = (write: (str: string) => void): void => {
  write('Incorrect Usage.\n\n');
  write('Use --help to see available commands and options.\n');
  write('Example: appcircle [command] [subcommand] --help\n');
};

/**
 * Main error output handler that routes to appropriate error handlers
 * @param str Error string to process
 * @param write Write function to output messages
 * @param inputArgs Process arguments array
 * @param commandList Available commands list
 */
export const handleProgramOutputError = (
  str: string,
  write: (str: string) => void,
  inputArgs: string[],
  commandList: CommandType[]
): void => {
  if (str.includes('error: required option')) {
    handleRequiredOptionError(inputArgs, commandList, write);
  } else if (str.includes('error: unknown command') || str.includes('error: unknown option')) {
    handleUnknownCommandError(write);
  } else {
    write(str);
  }
};

/**
 * Formats option information for help display
 * @param flags Option flags (e.g., "-v, --version")
 * @param description Option description
 * @param padding Left padding for alignment
 * @returns Formatted option string
 */
export const formatHelpOption = (
  flags: string, 
  description: string, 
  padding: number = 28
): string => {
  return `  ${flags.padEnd(padding)} ${description}\n`;
};

/**
 * Formats command information for help display
 * @param command Command name
 * @param description Command description
 * @param padding Left padding for alignment
 * @returns Formatted command string
 */
export const formatHelpCommand = (
  command: string, 
  description: string, 
  padding: number = 28
): string => {
  return `  ${command.padEnd(padding)} ${description}\n`;
};

/**
 * Generates the global options section of help text
 * @returns Formatted global options help text
 */
export const generateGlobalOptionsHelp = (): string => {
  let helpString = "GLOBAL OPTIONS\n";
  
  const formattedOptions = [
    { flags: "-v, --version", description: "output the version number" },
    { flags: "-i, --interactive", description: "interactive mode (AppCircle GUI)" },
    { flags: "-o, --output <type>", description: "output type (json, plain) (default: \"plain\")" },
    { flags: "-h, --help", description: "display help for command" }
  ];

  formattedOptions.forEach(opt => {
    helpString += formatHelpOption(opt.flags, opt.description);
  });
  
  return helpString + "\n";
};

/**
 * Generates the available commands section of help text
 * @param commands Commands array to display
 * @returns Formatted commands help text
 */
export const generateAvailableCommandsHelp = (commands: CommandType[]): string => {
  let helpString = "AVAILABLE COMMANDS\n";
  
  commands.filter(cmd => !cmd.ignore).forEach(command => {
    helpString += formatHelpCommand(command.command, command.description);
  });
  
  return helpString + "\n";
};

/**
 * Generates the learn more section of help text
 * @param programName Program name for help text
 * @returns Formatted learn more help text
 */
export const generateLearnMoreHelp = (programName: string): string => {
  let helpString = "LEARN MORE\n";
  helpString += `  Use '${programName} <command> --help' for more information on a specific command.\n`;
  helpString += `  Run '${programName} --interactive' for a guided experience.\n`;
  helpString += `  Visit Appcircle documentation at https://docs.appcircle.io\n`;
  
  return helpString;
};

/**
 * Generates complete help information for the program
 * @param programName Program name
 * @param version Program version
 * @param description Program description
 * @param commands Available commands
 * @returns Complete help text
 */
export const generateProgramHelp = (
  programName: string,
  version: string,
  description: string,
  commands: CommandType[]
): string => {
  let helpString = `Appcircle CLI\n\nVersion: v${version}\n\n${description}\n\n`;
  helpString += `USAGE\n  ${programName} [options] [command]\n\n`;
  helpString += generateGlobalOptionsHelp();
  helpString += generateAvailableCommandsHelp(commands);
  helpString += generateLearnMoreHelp(programName);
  
  return helpString;
};