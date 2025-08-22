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

const collectErrorMessageFromData = (data: any) => {
  if(data && (typeof data === 'string' || data instanceof String || data instanceof ArrayBuffer)) {
    return data;
  }
  return data ?  '\n↳ ' + Object.keys(data).filter(k => k !== 'stackTrace').map(key =>  ' -' +key +': ' + data[key]).join('\n↳ '): '';
}

const handleError = (error: any) => {
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
      console.error(JSON.stringify({ message: error.message, status: error.response?.status, statusText: error.response?.statusText, data: error.response?.data }));
    } else {
      console.error(JSON.stringify(error));
    }
  } else {
    if (axios.isAxiosError(error)) {
      const data = error.response?.data as any;
      console.error(`\n${chalk.red('✖')} ${error.message} ${chalk.red(error.response?.statusText)}${collectErrorMessageFromData(data)}`);
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

const main = async () => {
  const program = createProgram();
  const argv = minimist(process.argv.slice(2));
  
  const knownTopLevelCommands = Commands.map(cmd => cmd.command);
  
  let isFallbackToInteractive = false;
  
  if (argv._.length === 1 && knownTopLevelCommands.includes(argv._[0])) {
    if (argv._[0] === 'login' && argv.pat) {
      isFallbackToInteractive = false;
    } else {
      isFallbackToInteractive = true;
    }
  } else if (argv._.length >= 2) {
    const topLevelCommand = Commands.find(cmd => cmd.command === argv._[0]);
    if (topLevelCommand && argv._[1]) {
      const subCommand = topLevelCommand.subCommands?.find(sub => sub.command === argv._[1]);
      if (!subCommand) {
        console.error('Incorrect Usage.\n');
        console.error(`Unknown subcommand "${argv._[1]}" for "${argv._[0]}".`);
        console.error(`\nUse --help to see available commands and options.`);
        console.error(`Example: appcircle ${argv._[0]} --help`);
        process.exit(1);
      }
    }
  }

  if (isFallbackToInteractive) {
    process.argv.push('-i');
  }

  try {
    setConsoleOutputType(argv.output || argv.o || 'plain');
    if (process.argv.length === 2 || argv.i || argv.interactive || isFallbackToInteractive) {
      setInteractiveMode(true);
      runCommandsInteractively();
    } else {
      setInteractiveMode(false);
      program.onCommandRun(runCommand);
      await program.parseAsync();
    }
  } catch (error) {
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
  }
};

//Start the program
main();
