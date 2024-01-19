/**
 * Implements CRUD options from a file. Replaces the usage of a database, acts like environment variables.
 */
import fs from "fs";
import jsonfile from "jsonfile";
import path from "path";

const FILE_NAME = "../data.json";

/**
 * This variable exists only to specify which environment variables are being used.
 */
export enum EnvironmentVariables {
  AC_ACCESS_TOKEN = "AC_ACCESS_TOKEN",
  API_HOSTNAME = "API_HOSTNAME",
  AUTH_HOSTNAME = "AUTH_HOSTNAME",
  OUTPUT = "plain",
}

const DefaultEnvironmentVariables = {
  API_HOSTNAME: "https://api.appcircle.io",
  AUTH_HOSTNAME: "https://auth.appcircle.io",
  AC_ACCESS_TOKEN: "",
};

export type ConsoleOutputType = "json" | "plain"

let output_type = (process.env.CONSOLE_OUTPUT_TYPE || "plain") as ConsoleOutputType;

export const setConsoleOutputType = (type:ConsoleOutputType) => {
  output_type = type;
};
export const getConsoleOutputType = () => {
  return output_type;
};

export function writeVariable(variable: EnvironmentVariables, value: string): void {
  const currentPath = path.join(__dirname, "", FILE_NAME);
  try {
    const currentData = jsonfile.readFileSync(currentPath);
    currentData[variable] = value;
    jsonfile.writeFile(currentPath, currentData, { flag: "w+" });
  } catch {
    console.error("Could not write variable to the file.");
  }
}

export function readVariable(variable: EnvironmentVariables): string {
  const currentPath = path.join(__dirname, "", FILE_NAME);
  try {
    const currentData = jsonfile.readFileSync(currentPath);
    return currentData[variable] || "";
  } catch {
    console.error("Could not read data, returning empty.");
    return "";
  }
}

/**
 * Prioritizes environment variables over the file contents.
 */
function initializeFile() {
  const currentPath = path.join(__dirname, "", FILE_NAME);
  let currentData = { ...DefaultEnvironmentVariables };
  if (fs.existsSync(currentPath)) {
    try {
      currentData = jsonfile.readFileSync(currentPath);
    } catch (e) {
      console.info("Corrupted data.json file, rewriting it...");
    }
  }
  for (const key in EnvironmentVariables) {
    (currentData as any)[key] = process.env[key] || (currentData as any)[key] || (DefaultEnvironmentVariables as any)[key];
  }
  jsonfile.writeFileSync(currentPath, currentData, { flag: "w+" });
}

(async () => {
  initializeFile();
})();
