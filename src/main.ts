import minimist from "minimist";
import { createProgram } from "./program";
import axios from "axios";
import { runCommand } from "./core/command-runner";
import { runCommandsInteractively } from "./core/interactive-runner";
import { getConsoleOutputType, setConsoleOutputType } from "./config";
import { error } from "console";

const handleError = (error: any) => {
  if (getConsoleOutputType() === "json") {
    if (axios.isAxiosError(error)) {
      console.error(JSON.stringify({ message: error.message, status: error.response?.status, statusText: error.response?.statusText }));
    } else {
      console.error(JSON.stringify(error));
    }
  } else {
    if (axios.isAxiosError(error)) {
      console.error(`${error.message} ${error.response?.statusText}`);
    } else {
      console.error(error);
    }
  }
  process.exit(1);
};

// Handle unhandledRejection and unCaughtException events
// Generic error handler for unhandled exceptions

process.on("unhandledRejection", (error) => {
  handleError(error);
});

process.on("unCaughtException", (error) => {
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
  try {
    setConsoleOutputType(argv.output || argv.o || "plain");
    if (process.argv.length === 2 || argv.i || argv.interactive) {
      runCommandsInteractively();
    } else {
      program.onCommandRun(runCommand);
      try {
        program.parse();
      } catch (err) {
        //handling command error
        process.exit(1);
      }
    }
  } catch (error) {
    if (getConsoleOutputType() === "json") {
      console.error(JSON.stringify(error));
    } else {
      if (axios.isAxiosError(error)) {
        console.error(`${error.message} ${error.code}`);
      } else {
        console.error(error);
      }
    }
  }
};

//Start the program
main();
