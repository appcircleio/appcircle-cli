import qs from "querystring";
import fs from "fs";
import path from "path";
import FormData from "form-data";
import axios, { AxiosRequestConfig } from "axios";
import moment from "moment";
import chalk from "chalk";
import CurlHelper from "../utils/curlhelper";
import { readEnviromentConfigVariable, EnvironmentVariables, getConsoleOutputType } from "../config";
import { EnvironmentVariableTypes } from "../constant";
import { exec, spawn } from 'child_process';

if (process.env.CURL_LOGGING) {
  axios.interceptors.request.use((config) => {
    const data = new CurlHelper(config);
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

const API_HOSTNAME = readEnviromentConfigVariable(EnvironmentVariables.API_HOSTNAME);
const AUTH_HOSTNAME = readEnviromentConfigVariable(EnvironmentVariables.AUTH_HOSTNAME);

const appcircleApi = axios.create({
  baseURL: API_HOSTNAME.endsWith("/") ? API_HOSTNAME : `${API_HOSTNAME}/`,
});

function getHeaders(withToken = true): AxiosRequestConfig["headers"] {
  let response: AxiosRequestConfig["headers"] = {
    accept: "application/json",
    "User-Agent": "Appcircle CLI/1.0.3",
  };
  if (withToken) {
    response.Authorization = `Bearer ${readEnviromentConfigVariable(EnvironmentVariables.AC_ACCESS_TOKEN)}`;
  }
  return response;
}

export type OptionsType<T = {}> = Record<string, any> & { output?: "json" | "plain" } & T;

export async function getToken(options: OptionsType<{ pat: string }>) {
  const response = await axios.post(`${AUTH_HOSTNAME}/auth/v1/token`, qs.stringify({ pat: options.pat }), {
    headers: {
      accept: "application/json",
      "content-type": "application/x-www-form-urlencoded",
    },
  });
  return response.data;
}

export async function getDistributionProfiles(options: OptionsType = {}) {
  const distributionProfiles = await appcircleApi.get(`distribution/v2/profiles`, {
    headers: getHeaders(),
  });
  return distributionProfiles.data;
}

export async function createDistributionProfile(options: OptionsType<{ name: string }>) {
  const response = await appcircleApi.post(
    `distribution/v1/profiles`,
    { name: options.name },
    {
      headers: getHeaders(),
    }
  );
  return response.data;
}

export async function getTestingGroups(options: OptionsType) {
  const response = await appcircleApi.get(`distribution/v2/testing-groups`, {
    headers: getHeaders(),
  });
  if (options.output === "json") {
    console.log(JSON.stringify(response.data));
  } else {
    console.table(
      response.data.map((testingGroup: any) => ({
        ID: testingGroup.id,
        Name: testingGroup.name,
        "Organization ID": testingGroup.organizationId,
        Created: testingGroup.createDate ? moment(testingGroup.createDate).calendar() : "No created data",
        "Last Updated": testingGroup.createDate ? moment(testingGroup.createDate).fromNow() : "No update data",
      }))
    );
  }
  return response.data;
}

export async function getBuildProfiles(options: OptionsType = {}) {
  const buildProfiles = await appcircleApi.get(`build/v2/profiles`, {
    headers: getHeaders(),
  });
  return buildProfiles.data;
}

export async function getCommits(options: OptionsType<{ branchId: string }>) {
  const commits = await appcircleApi.get(`build/v2/commits?branchId=${options.branchId}`, {
    headers: getHeaders(),
  });
  return commits.data;
}

export async function getBuildsOfCommit(options: OptionsType<{ commitId: string }>) {
  const commits = await appcircleApi.get(`build/v2/commits/${options.commitId}`, {
    headers: getHeaders(),
  });
  return commits.data;
}

export async function startBuild(
  options: OptionsType<{ profileId: string; branch?: string; workflow?: string; branchId?: string; workflowId?: string; commitId?: string }>
) {
  let branchId = options.branchId || "";
  let workflowId = options.workflowId || "";
  let commitId = options.commitId || "";
  let configurationId = options.configurationId || "";


  if (!branchId && options.branch) {
    const branchesRes = await getBranches({ profileId: options.profileId || "" });
    const branchIndex = branchesRes.branches.findIndex((element: { [key: string]: any }) => element.name === options.branch);
    branchId = branchesRes.branches[branchIndex].id;
  }
  if (!workflowId && options.workflow) {
    const workflowsRes = await getWorkflows({ profileId: options.profileId || "" });
    const workflowIndex = workflowsRes.workflows.findIndex((element: { [key: string]: any }) => element.workflowName === options.workflow);
    workflowId = workflowsRes.workflows[workflowIndex].id;
  }
  if (!commitId) {
    const allCommitsByBranchId = await getCommits({ branchId });
    commitId = allCommitsByBranchId[0].id;
  }
  if (!configurationId) {
    const allConfigurations = await getConfigurations({ profileId: options.profileId || "" });
    configurationId = allConfigurations[0].item1.id;
  }
  const buildResponse = await appcircleApi.post(`build/v2/commits/${commitId}?${qs.stringify({  action: 'build', workflowId, configurationId })}`, '{}', {
    headers: {
      ...getHeaders(),
      accept: "*/*",
      "content-type": "application/x-www-form-urlencoded",
    },
  });
  return buildResponse.data;
}

export async function downloadArtifact(options: OptionsType<{ buildId: string; commitId: string }>, downloadPath: string) {
  const data = new FormData();
  data.append("Path", downloadPath);
  data.append("Build Id", options.buildId);
  data.append("Commit Id", options.commitId);

  const downloadResponse = await appcircleApi.get(`build/v2/commits/${options.commitId}/builds/${options.buildId}`, {
    responseType: "stream",
    headers: {
      ...getHeaders(),
      ...data.getHeaders(),
    },
  });
  return new Promise((resolve, reject) => {
    const writer = fs.createWriteStream(`${downloadPath}/artifact.zip`);
    downloadResponse.data.pipe(writer);
    let error: any = null;
    writer.on("error", (err) => {
      error = err;
      writer.close();
      reject(err);
    });
    writer.on("close", () => {
      if (!error) {
        resolve(true);
      }
      //no need to call the reject here, as it will have been called in the
      //'error' stream;
    });
  });
}

export async function uploadArtifact(options: OptionsType<{ message: string; app: string; distProfileId: string }>) {
  const data = new FormData();
  data.append("Message", options.message);
  data.append("File", fs.createReadStream(options.app));

  const uploadResponse = await appcircleApi.post(`distribution/v2/profiles/${options.distProfileId}/app-versions`, data, {
    maxContentLength: Infinity,
    maxBodyLength: Infinity,
    headers: {
      ...getHeaders(),
      ...data.getHeaders(),
      "Content-Type": "multipart/form-data;boundary=" + data.getBoundary(),
    },
  });
  return uploadResponse.data;
}

export async function getEnvironmentVariableGroups(options: OptionsType = {}) {
  const environmentVariableGroups = await appcircleApi.get(`build/v1/variable-groups`, {
    headers: getHeaders(),
  });
  return environmentVariableGroups.data;
}

export async function createEnvironmentVariableGroup(options: OptionsType<{ name: string }>) {
  const response = await appcircleApi.post(
    `build/v1/variable-groups`,
    { name: options.name, variables: [] },
    {
      headers: getHeaders(),
    }
  );
  return response.data;
}

export async function getEnvironmentVariables(options: OptionsType<{ variableGroupId: string }>) {
  const environmentVariables = await appcircleApi.get(`build/v1/variable-groups/${options.variableGroupId}/variables`, {
    headers: getHeaders(),
  });
  return environmentVariables.data;
}

async function createTextEnvironmentVariable(options: OptionsType<{ variableGroupId: string; value: string; isSecret: boolean; key: string }>) {
  const response = await appcircleApi.post(
    `build/v1/variable-groups/${options.variableGroupId}/variables`,
    { Key: options.key, Value: options.value, IsSecret: options.isSecret || "false" },
    {
      headers: getHeaders(),
    }
  );
  return response.data;
}

async function createFileEnvironmentVariable(options: OptionsType<{ key: string; isSecret: boolean; filePath: string; variableGroupId: string }>) {
  const form = new FormData();
  const file = fs.createReadStream(options.filePath);
  console.log("options.filePath): ", options.filePath);
  form.append("Key", options.key);
  form.append("Value", path.basename(options.filePath));
  form.append("IsSecret", options.isSecret || "false");
  form.append("Binary", file);

  const uploadResponse = await appcircleApi.post(`build/v1/variable-groups/${options.variableGroupId}/variables/files`, form, {
    maxContentLength: Infinity,
    maxBodyLength: Infinity,
    headers: {
      ...getHeaders(),
      ...form.getHeaders(),
      "Content-Type": "multipart/form-data;boundary=" + form.getBoundary(),
    },
  });
  return uploadResponse.data;
}

export async function createEnvironmentVariable(
  options: OptionsType<{
    type: keyof typeof EnvironmentVariableTypes;
    variableGroupId: string;
    key: string;
    value: string;
    filePath: string;
    isSecret: boolean;
  }>
) {
  if (options.type === EnvironmentVariableTypes.FILE) {
    return createFileEnvironmentVariable(options);
  } else if (!options.type || options.type === EnvironmentVariableTypes.TEXT) {
    return createTextEnvironmentVariable(options);
  } else if (options.type) {
    throw new Error("Environment variable type not found");
  }
}

export async function getBranches(options: OptionsType<{ profileId: string }>, showConsole: boolean = true) {
  const branchResponse = await appcircleApi.get(`build/v2/profiles/${options.profileId}`, {
    headers: getHeaders(),
  });
  return branchResponse.data;
}

export async function getWorkflows(options: OptionsType<{ profileId: string }>) {
  const workflowResponse = await appcircleApi.get(`build/v2/profiles/${options.profileId}/workflows`, {
    headers: getHeaders(),
  });
  return workflowResponse.data;
}

export async function getConfigurations(options: OptionsType<{ profileId: string }>) {
  const configurationsResponse = await appcircleApi.get(`build/v2/profiles/${options.profileId}/configurations`, {
    headers: getHeaders(),
  });
  return configurationsResponse.data;
}

/*
export async function getBuildTaskStatus(options: OptionsType<{ latestCommitId: string; taskId: string }>) {
  const taskStatus = await appcircleApi.get(`build/v2/commits/${options.latestCommitId}/builds/${options.taskId}/status`, {
    headers: getHeaders(),
  });
  return taskStatus.data;
}
*/

export async function getEnterpriseProfiles(options: OptionsType = {}) {
  const buildProfiles = await appcircleApi.get(`store/v2/profiles`, {
    headers: getHeaders(),
  });
  return buildProfiles.data;
}

export async function getEnterpriseAppVersions(options: { entProfileId: string; publishType: string }) {
  let versionType = "";
  switch (options.publishType) {
    case "1":
      versionType = "?publishtype=Beta";
      break;
    case "2":
      versionType = "?publishtype=Live";
    default:
      break;
  }

  const profileResponse = await appcircleApi.get(`store/v2/profiles/${options.entProfileId}/app-versions${versionType}`, {
    headers: getHeaders(),
  });
  return profileResponse.data;
}

export async function publishEnterpriseAppVersion(options: {
  entProfileId: string;
  entVersionId: string;
  summary: string;
  releaseNotes: string;
  publishType: string;
}) {
  const versionResponse = await appcircleApi.patch(
    `store/v2/profiles/${options.entProfileId}/app-versions/${options.entVersionId}?action=publish`,
    { summary: options.summary, releaseNotes: options.releaseNotes, publishType: options.publishType },
    {
      headers: getHeaders(),
    }
  );
  return versionResponse.data;
}

export async function unpublishEnterpriseAppVersion(options: OptionsType<{ entProfileId: string; entVersionId: string }>) {
  const versionResponse = await appcircleApi.patch(
    `store/v2/profiles/${options.entProfileId}/app-versions/${options.entVersionId}?action=unpublish`,
    {},
    {
      headers: getHeaders(),
    }
  );
  return versionResponse.data;
}

export async function removeEnterpriseAppVersion(options: { entProfileId: string; entVersionId: string }) {
  const versionResponse = await appcircleApi.delete(`store/v2/profiles/${options.entProfileId}/app-versions/${options.entVersionId}`, {
    headers: getHeaders(),
  });
  if (versionResponse.data.length === 0) {
    console.info("No app versions available.");
    return;
  }
  return versionResponse.data;
}

export async function notifyEnterpriseAppVersion(
  options: OptionsType<{ entProfileId: string; entVersionId: string; subject: string; message: string }>
) {
  const versionResponse = await appcircleApi.post(
    `store/v2/profiles/${options.entProfileId}/app-versions/${options.entVersionId}?action=notify`,
    { subject: options.subject, message: options.message },
    {
      headers: getHeaders(),
    }
  );
  return versionResponse.data;
}

export async function uploadEnterpriseAppVersion(options: OptionsType<{ entProfileId: string; app: string }>) {
  const data = new FormData();
  data.append("File", fs.createReadStream(options.app));

  const uploadResponse = await appcircleApi.post(`store/v2/profiles/${options.entProfileId}/app-versions`, data, {
    maxContentLength: Infinity,
    maxBodyLength: Infinity,
    headers: {
      ...getHeaders(),
      ...data.getHeaders(),
      "Content-Type": "multipart/form-data;boundary=" + data.getBoundary(),
    },
  });
  return uploadResponse.data;
}

export async function uploadEnterpriseApp(options: { app: string }) {
  const data = new FormData();
  data.append("File", fs.createReadStream(options.app));
  const uploadResponse = await appcircleApi.post(`store/v2/profiles/app-versions`, data, {
    maxContentLength: Infinity,
    maxBodyLength: Infinity,
    headers: {
      ...getHeaders(),
      ...data.getHeaders(),
      "Content-Type": "multipart/form-data;boundary=" + data.getBoundary(),
    },
  });
  return uploadResponse.data;
}

export async function getEnterpriseDownloadLink(options: OptionsType<{ entProfileId: string; entVersionId: string }>) {
  const qrcodeStatus = await appcircleApi.get(`store/v2/profiles/${options.entProfileId}/app-versions/${options.entVersionId}?action=download`, {
    headers: getHeaders(),
  });
  return qrcodeStatus.data;
}

export async function trustAppcircleCertificate() {
  const bashScriptPath = 'src/scripts/install_cert.sh';

  const appcircleUrl = API_HOSTNAME;

  // Use 'bash' as the command to spawn a new shell process
  const childProcess = spawn('bash', [bashScriptPath, appcircleUrl]);

  // Handle output stream
  childProcess.stdout.on('data', data => {
    console.log(`${data}`);
  });

  // Handle error stream
  childProcess.stderr.on('data', data => {
    console.error(`${data}`);
  });

  // Handle when the process needs input (e.g., sudo password)
  childProcess.stdin.write('\n');
  childProcess.stdin.end();

  // Handle when the process exits
  childProcess.on('exit', (code, signal) => {
    if (signal !== null) {
      console.log(`Bash script process killed with signal ${signal}`);
    }
  });
}