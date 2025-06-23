/**
 * Implements CRUD options from a file. Replaces the usage of a database, acts like environment variables.
 */
import Conf from 'conf';

/**
 * This variable exists only to specify which environment variables are being used.
 */
export enum EnvironmentVariables {
  AC_ACCESS_TOKEN = "AC_ACCESS_TOKEN",
  API_HOSTNAME = "API_HOSTNAME",
  AUTH_HOSTNAME = "AUTH_HOSTNAME",
}

export const DefaultEnvironmentVariables = {
  API_HOSTNAME: "https://api.appcircle.io",
  AUTH_HOSTNAME: "https://auth.appcircle.io",
  AC_ACCESS_TOKEN: "",
};

interface ConfigData extends Record<string, any> {
  current: string;
  envs: { [key: string]: typeof DefaultEnvironmentVariables };
}

const config = new Conf<ConfigData>({
  defaults: { current: "default", envs: { default: DefaultEnvironmentVariables } },
});

export type ConsoleOutputType = "json" | "plain";

let output_type = (process.env.CONSOLE_OUTPUT_TYPE || "plain") as ConsoleOutputType;
let is_interactive_mode = false;

export const setConsoleOutputType = (type: ConsoleOutputType) => {
  output_type = type;
};
export const getConsoleOutputType = () => {
  // In interactive mode, always return 'plain' to ignore JSON output
  return is_interactive_mode ? "plain" : output_type;
};

export const setInteractiveMode = (isInteractive: boolean) => {
  is_interactive_mode = isInteractive;
};
export const getInteractiveMode = () => {
  return is_interactive_mode;
};

export function getConfigStore(): any {
  return { ...config.store };
}

export function getConfigFilePath(): any {
  return config.path;
}


export function getCurrentConfigVariable(): string {
  return config.get('current') || 'default';
}

export function setCurrentConfigVariable(val: string = 'default'): void {
  config.set('current', val);
}


export function addNewConfigVariable(val: string = 'new'): void {
  config.set('current', val);
  config.set(`envs.${val}`, DefaultEnvironmentVariables);
}

export const getEnviromentsConfigToWriting = () => {
  let resEnvs = {} as any;
  Object.keys(config.store.envs).forEach( (key) => {
    resEnvs[key]  = { ...config.store.envs[key], AC_ACCESS_TOKEN: (config.store.envs[key].AC_ACCESS_TOKEN||'').substring(0,10)+"..." };
  });
  return resEnvs;
}

export function writeEnviromentConfigVariable(variable: EnvironmentVariables, value: string): void {
  const current = config.get('current') || 'default';
  try {
    config.set(`envs.${current}.${variable}`, value);
  } catch {
    console.error("Could not write variable to the config file.");
  }
}

export function readEnviromentConfigVariable(variable: EnvironmentVariables): string {
  const current = config.get('current') || 'default';
  try {
    return config.get(`envs.${current}.${variable}`) || "";
  } catch {
    console.error("Could not read data, returning empty.");
    return "";
  }
}

export function clearConfigs() {
  config.clear();
}
