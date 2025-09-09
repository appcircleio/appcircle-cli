/**
 * @fileoverview Utility functions for main.ts to improve testability
 * Extracted utilities from main.ts command validation and error handling
 */

import { CommandType } from './commands.js';
import { getConsoleOutputType, ConsoleOutputType } from '../config.js';
import axios from 'axios';

/**
 * Determines if a command should fallback to interactive mode
 * @param argv Parsed command line arguments
 * @param commands Available commands array
 * @returns Boolean indicating if should fallback to interactive
 */
export const shouldFallbackToInteractive = (
  argv: any,
  commands: CommandType[]
): boolean => {
  const knownTopLevelCommands = commands.map(cmd => cmd.command);
  
  if (argv._.length === 1 && knownTopLevelCommands.includes(argv._[0])) {
    if (argv._[0] === 'login' && argv.pat) {
      return false;
    } else {
      return true;
    }
  }
  
  return false;
};

/**
 * Validates if a subcommand exists for a given command
 * @param argv Parsed command line arguments
 * @param commands Available commands array
 * @returns Validation result object
 */
export const validateSubCommand = (
  argv: any,
  commands: CommandType[]
): { isValid: boolean; errorMessage?: string } => {
  if (argv._.length >= 2) {
    const topLevelCommand = commands.find(cmd => cmd.command === argv._[0]);
    if (topLevelCommand && argv._[1]) {
      // If command has subCommands array, validate the subcommand
      if (topLevelCommand.subCommands && topLevelCommand.subCommands.length > 0) {
        const subCommand = topLevelCommand.subCommands.find(sub => sub.command === argv._[1]);
        if (!subCommand) {
          return {
            isValid: false,
            errorMessage: `Unknown subcommand "${argv._[1]}" for "${argv._[0]}".`
          };
        }
      }
      // If command doesn't have subCommands, it's still valid (the command handles args itself)
    }
  }
  
  return { isValid: true };
};

/**
 * Handles invalid subcommand error by outputting appropriate messages
 * @param errorMessage The error message to display
 * @param command The parent command name
 */
export const handleInvalidSubCommandError = (
  errorMessage: string,
  command: string
): void => {
  console.error('Incorrect Usage.\n');
  console.error(errorMessage);
  console.error(`\nUse --help to see available commands and options.`);
  console.error(`Example: appcircle ${command} --help`);
  process.exit(1);
};

/**
 * Determines if the application should run in interactive mode
 * @param argv Parsed command line arguments
 * @param isFallbackToInteractive Whether fallback to interactive was determined
 * @returns Boolean indicating if should run in interactive mode
 */
export const shouldRunInteractive = (
  argv: any,
  isFallbackToInteractive: boolean
): boolean => {
  return process.argv.length === 2 || argv.i || argv.interactive || isFallbackToInteractive;
};

/**
 * Determines the appropriate output type from command line arguments
 * @param argv Parsed command line arguments
 * @returns Output type string
 */
export const getOutputType = (argv: any): ConsoleOutputType => {
  const outputType = argv.output || argv.o || 'plain';
  return outputType === 'json' ? 'json' : 'plain';
};

/**
 * Handles errors in the main try-catch block with appropriate output format
 * @param error The error to handle
 */
export const handleMainExecutionError = (error: any): void => {
  const err = error as any;
  
  if (getConsoleOutputType() === 'json') {
    if (!(err.name === 'AppcircleExitError' && (err.code === 0 || err.message === ''))) {
      console.error(JSON.stringify(err));
    }
  } else {
    if (err.name === 'AppcircleExitError') {
      if (err.code !== 0 && err.message) {
        console.error(err.message);
      }
    } else if (axios.isAxiosError(err)) {
      console.error(`${err.message} ${err.code}`);
    } else {
      console.error(err);
    }
  }
  
  process.exit(err.name === 'AppcircleExitError' ? err.code : 1);
};

/**
 * Processes command line arguments and sets up program execution context
 * @param argv Parsed command line arguments
 * @param commands Available commands array
 * @returns Execution context object
 */
export const processCommandLineArguments = (
  argv: any,
  commands: CommandType[]
): { 
  shouldRunInteractive: boolean;
  shouldFallback: boolean;
  isValid: boolean;
  errorMessage?: string;
  command?: string;
} => {
  const shouldFallback = shouldFallbackToInteractive(argv, commands);
  const validation = validateSubCommand(argv, commands);
  
  if (!validation.isValid) {
    return {
      shouldRunInteractive: false,
      shouldFallback: false,
      isValid: false,
      errorMessage: validation.errorMessage,
      command: argv._[0]
    };
  }
  
  const runInteractive = shouldRunInteractive(argv, shouldFallback);
  
  return {
    shouldRunInteractive: runInteractive,
    shouldFallback,
    isValid: true
  };
};

/**
 * Modifies process.argv to include interactive flag when fallback is needed
 * @param shouldFallback Boolean indicating if interactive flag should be added
 */
export const modifyProcessArgv = (shouldFallback: boolean): void => {
  if (shouldFallback) {
    process.argv.push('-i');
  }
};

/**
 * Validates that a command has the expected subcommands structure
 * @param command Command object to validate
 * @returns Boolean indicating if command structure is valid
 */
export const validateCommandStructure = (command: CommandType): boolean => {
  if (!command) return false;
  if (typeof command.command !== 'string') return false;
  if (command.subCommands && !Array.isArray(command.subCommands)) return false;
  return true;
};

/**
 * Creates a map of top level commands for quick lookup
 * @param commands Available commands array
 * @returns Map of command names to command objects
 */
export const createCommandMap = (commands: CommandType[]): Map<string, CommandType> => {
  const commandMap = new Map<string, CommandType>();
  
  commands.forEach(cmd => {
    if (validateCommandStructure(cmd)) {
      commandMap.set(cmd.command, cmd);
    }
  });
  
  return commandMap;
};