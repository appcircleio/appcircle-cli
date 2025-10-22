#!/usr/bin/env node

import minimist from 'minimist';
import { createProgram } from './program.js';
import axios from 'axios';
import { runCommand } from './core/command-runner.js';
import { runCommandsInteractively } from './core/interactive-runner.js';
import { getConsoleOutputType, setConsoleOutputType, setInteractiveMode } from './config.js';
import { ProgramError } from './core/ProgramError.js';
import { AppcircleExitError } from "./core/AppcircleExitError.js";
import { PROGRAM_NAME } from './constant.js';
import chalk from 'chalk';
import { Commands } from './core/commands.js';
import { 
  processCommandLineArguments,
  modifyProcessArgv,
  handleInvalidSubCommandError,
  getOutputType,
  handleMainExecutionError
} from './core/main-utilities.js';

export const collectErrorMessageFromData = (data: any) => {
  if(data && (typeof data === 'string' || data instanceof String || data instanceof ArrayBuffer)) {
    return data;
  }
  return data ?  '\n↳ ' + Object.keys(data).filter(k => k !== 'stackTrace').map(key =>  ' -' +key +': ' + data[key]).join('\n↳ '): '';
}

export const handleError = (error: any) => {
  // Handle AppcircleExitError specially
  if (error.name === 'AppcircleExitError') {
    if (error.code === 0 && (!error.message || error.message === '')) {
      // Silent exit for successful completion
      process.exit(0);
    } else if (error.code !== 0 && error.message === '') {
      // Silent exit for failed completion when message is empty (JSON mode already output)
      process.exit(error.code);
    } else if (error.code !== 0 && error.message) {
      // Only show error message for actual failures
      if (getConsoleOutputType() === 'json') {
        console.error(JSON.stringify(error));
      } else {
        console.error(error.message);
      }
    }
    process.exit(error.code);
  }

  if (getConsoleOutputType() === 'json') {
    if (axios.isAxiosError(error)) {
      const statusText = error.response?.status === 403 ? 'Permission Denied. You are not authorized to perform this operation. Ensure your API key has the required permissions or contact your organization administrator.' : error.response?.statusText;
      console.error(JSON.stringify({ message: error.message, status: error.response?.status, statusText: statusText, data: error.response?.data }));
    } else {
      console.error(JSON.stringify(error));
    }
  } else {
    if (axios.isAxiosError(error)) {
      const data = error.response?.data as any;
      const statusText = error.response?.status === 403 ? 'Permission Denied. You are not authorized to perform this operation. Ensure your API key has the required permissions or contact your organization administrator.' : error.response?.statusText;
      console.error(`\n${chalk.red('✖')} ${error.message} ${chalk.red(statusText)}${collectErrorMessageFromData(data)}`);
      if(error.response?.status === 401) {
        console.error(`Run ${chalk.cyan(`"${PROGRAM_NAME} login --help"`)} command for more information.`);
      }
    } else if (error instanceof ProgramError) {
      console.error(chalk.red('✖'), error.message);
    } else {
      console.error(error);
    }
  }
  process.exit(1);
};

// Handle unhandledRejection and unCaughtException events
// Generic error handler for unhandled exceptions

process.on('unhandledRejection', (error) => {
  handleError(error);
});

process.on('unCaughtException', (error) => {
  handleError(error);
});

/**
 * Executes the given command and performs the appropriate action based on the command type.
 *
 * @param {ProgramCommand} command - The command to be executed.
 * @return {Promise<void>} - This function does not return anything.
 */

export const main = async () => {
  const program = createProgram();
  const argv = minimist(process.argv.slice(2));
  
  const context = processCommandLineArguments(argv, Commands);
  
  if (!context.isValid) {
    handleInvalidSubCommandError(context.errorMessage!, context.command!);
    return;
  }
  
  modifyProcessArgv(context.shouldFallback);

  try {
    setConsoleOutputType(getOutputType(argv));
    if (context.shouldRunInteractive) {
      setInteractiveMode(true);
      runCommandsInteractively();
    } else {
      setInteractiveMode(false);
      program.onCommandRun(runCommand);
      await program.parseAsync();
    }
  } catch (error) {
    handleMainExecutionError(error);
  }
};

//Start the program
main();
