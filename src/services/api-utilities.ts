/**
 * @fileoverview Utility functions for api.ts to improve testability
 * Extracted utilities from api.ts for configuration, headers, and interceptors
 */

import chalk from "chalk";
import { AxiosRequestConfig, InternalAxiosRequestConfig } from "axios";
import CurlHelper from "../utils/curlhelper";
import {
  readEnviromentConfigVariable,
  EnvironmentVariables,
  getConsoleOutputType,
} from "../config";

/**
 * Normalizes a hostname URL by ensuring it ends with a slash
 * @param hostname The hostname URL to normalize
 * @returns Normalized hostname with trailing slash
 */
export const normalizeHostname = (hostname: string): string => {
  if (!hostname) return "/";
  return hostname.endsWith("/") ? hostname : `${hostname}/`;
};

/**
 * Generates HTTP headers with optional authentication
 * @param withToken Whether to include the Authorization header
 * @param userAgent The User-Agent string to use
 * @returns Headers object for HTTP requests
 */
export const generateHttpHeaders = (
  withToken: boolean = true,
  userAgent: string = "Appcircle CLI/1.0.3"
): AxiosRequestConfig["headers"] => {
  const headers: AxiosRequestConfig["headers"] = {
    accept: "application/json",
    "User-Agent": userAgent,
  };

  if (withToken) {
    const token = readEnviromentConfigVariable(EnvironmentVariables.AC_ACCESS_TOKEN);
    headers.Authorization = `Bearer ${token}`;
  }

  return headers;
};

/**
 * Creates a curl command string from an axios request configuration
 * @param config The axios request configuration
 * @returns Generated curl command string
 */
export const generateCurlCommand = (config: InternalAxiosRequestConfig): string => {
  try {
    const curlHelper = new CurlHelper({ ...config });
    return curlHelper.generateCommand();
  } catch (error) {
    return `curl -X ${config.method?.toUpperCase() || 'GET'} ${config.url || 'unknown'}`;
  }
};

/**
 * Logs curl command based on console output type
 * @param curlCommand The curl command string to log
 */
export const logCurlCommand = (curlCommand: string): void => {
  if (getConsoleOutputType() === "json") {
    // Do nothing in JSON mode
    return;
  } else {
    console.log(chalk.green(curlCommand));
  }
};

/**
 * Creates an axios request interceptor function for CURL logging
 * @returns Interceptor function that logs curl commands
 */
export const createCurlLoggingInterceptor = () => {
  return (config: InternalAxiosRequestConfig): InternalAxiosRequestConfig => {
    const curlCommand = generateCurlCommand(config);
    logCurlCommand(curlCommand);
    return config;
  };
};

/**
 * Sets up axios interceptors conditionally based on environment
 * @param axiosInstance The axios instance to configure
 * @param enableCurlLogging Whether to enable CURL logging
 */
export const setupAxiosInterceptors = (axiosInstance: any, enableCurlLogging: boolean = false): void => {
  if (enableCurlLogging) {
    const interceptor = createCurlLoggingInterceptor();
    axiosInstance.interceptors.request.use(interceptor);
  }
};

/**
 * Validates environment configuration variables
 * @param envVar The environment variable to validate
 * @returns Validation result
 */
export const validateEnvironmentVariable = (envVar: EnvironmentVariables): {
  isValid: boolean;
  value: string;
  error?: string;
} => {
  const value = readEnviromentConfigVariable(envVar);
  
  if (!value || value.trim() === '') {
    return {
      isValid: false,
      value: value || '',
      error: `Environment variable ${envVar} is not set or empty`
    };
  }
  
  // Additional validation for hostnames
  if (envVar === EnvironmentVariables.API_HOSTNAME || envVar === EnvironmentVariables.AUTH_HOSTNAME || envVar === EnvironmentVariables.HOOK_HOSTNAME) {
    try {
      new URL(value);
      return { isValid: true, value };
    } catch (error) {
      return {
        isValid: false,
        value,
        error: `Invalid URL format for ${envVar}: ${value}`
      };
    }
  }
  
  return { isValid: true, value };
};

/**
 * Gets all required environment variables with validation
 * @returns Object containing all environment configuration
 */
export const getEnvironmentConfiguration = (): {
  apiHostname: { isValid: boolean; value: string; error?: string };
  authHostname: { isValid: boolean; value: string; error?: string };
  accessToken: { isValid: boolean; value: string; error?: string };
} => {
  return {
    apiHostname: validateEnvironmentVariable(EnvironmentVariables.API_HOSTNAME),
    authHostname: validateEnvironmentVariable(EnvironmentVariables.AUTH_HOSTNAME),
    accessToken: validateEnvironmentVariable(EnvironmentVariables.AC_ACCESS_TOKEN)
  };
};

/**
 * Creates axios configuration object with proper defaults
 * @param baseURL The base URL for the axios instance
 * @param timeout Optional timeout in milliseconds
 * @returns Axios configuration object
 */
export const createAxiosConfig = (baseURL: string, timeout?: number): any => {
  const config: any = {
    baseURL: normalizeHostname(baseURL),
  };
  
  if (timeout && timeout > 0) {
    config.timeout = timeout;
  }
  
  return config;
};

/**
 * Determines if CURL logging should be enabled
 * @returns Boolean indicating if CURL logging is enabled
 */
export const shouldEnableCurlLogging = (): boolean => {
  return Boolean(process.env.CURL_LOGGING);
};