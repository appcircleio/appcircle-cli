import axios, { AxiosRequestConfig } from "axios";

import {
  readEnviromentConfigVariable,
  EnvironmentVariables,
} from "../config";
import {
  normalizeHostname,
  generateHttpHeaders,
  createCurlLoggingInterceptor,
  shouldEnableCurlLogging,
  createAxiosConfig
} from "./api-utilities";

export type OptionsType<T = {}> = Record<string, any> & {
  output?: "json" | "plain";
} & T;


if (shouldEnableCurlLogging()) {
  axios.interceptors.request.use(createCurlLoggingInterceptor());
}

export const API_HOSTNAME = readEnviromentConfigVariable(
  EnvironmentVariables.API_HOSTNAME
);
export const AUTH_HOSTNAME = readEnviromentConfigVariable(
  EnvironmentVariables.AUTH_HOSTNAME
);

export const appcircleApi = axios.create(
  createAxiosConfig(API_HOSTNAME)
);

export const getHeaders = (withToken = true): AxiosRequestConfig["headers"] => {
  return generateHttpHeaders(withToken);
};
