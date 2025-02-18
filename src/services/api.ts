import chalk from "chalk";
import axios, { AxiosRequestConfig, InternalAxiosRequestConfig } from "axios";

import CurlHelper from "../utils/curlhelper";
import {
  readEnviromentConfigVariable,
  EnvironmentVariables,
  getConsoleOutputType,
} from "../config";

export type OptionsType<T = {}> = Record<string, any> & {
  output?: "json" | "plain";
} & T;


if (process.env.CURL_LOGGING) {
  axios.interceptors.request.use((config: InternalAxiosRequestConfig) => {
    const data = new CurlHelper({
      ...config
    });
    let curl = data.generateCommand();
    if (getConsoleOutputType() === "json") {
      //Do nothing
      //console.log(JSON.stringify(curl));
    } else {
      console.log(chalk.green(curl));
    }
    return config;
  });
}

export const API_HOSTNAME = readEnviromentConfigVariable(
  EnvironmentVariables.API_HOSTNAME
);
export const AUTH_HOSTNAME = readEnviromentConfigVariable(
  EnvironmentVariables.AUTH_HOSTNAME
);

export const appcircleApi = axios.create({
  baseURL: API_HOSTNAME.endsWith("/") ? API_HOSTNAME : `${API_HOSTNAME}/`,
});

export const getHeaders = (withToken = true): AxiosRequestConfig["headers"] => {
  let response: AxiosRequestConfig["headers"] = {
    accept: "application/json",
    "User-Agent": "Appcircle CLI/1.0.3",
  };
  if (withToken) {
    response.Authorization = `Bearer ${readEnviromentConfigVariable(
      EnvironmentVariables.AC_ACCESS_TOKEN
    )}`;
  }
  return response;
};
