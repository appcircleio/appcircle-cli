import qs from 'querystring';
import fs from 'fs';
import path from 'path';
import FormData from 'form-data';
import axios from 'axios';
import { CountriesList, EnvironmentVariableTypes } from '../constant';
import { AUTH_HOSTNAME, OptionsType, appcircleApi, getHeaders } from './api';
import { ProgramError } from '../core/ProgramError';
import os from 'os';
import { FileUploadInformation } from '../types/file-upload';
import { getMaxUploadBytes, GB } from '../utils/size-limit';

export async function getToken(options: OptionsType<{ pat: string }>) {
  const response = await axios.post(`${AUTH_HOSTNAME}/auth/v1/token`, qs.stringify({ pat: options.pat }), {
    headers: {
      accept: 'application/json',
      'content-type': 'application/x-www-form-urlencoded',
    },
  });
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

export async function getActiveBuilds() {
  const builds = await appcircleApi.get(`/build/v1/queue/my-dashboard?page=1&size=1000`, {
    headers: getHeaders(),
  });
  return builds.data;
}

export async function startBuild(
  options: OptionsType<{ profileId: string; branch?: string; workflow?: string; branchId?: string; workflowId?: string; commitId?: string, commitHash?: string}>
) {
  let branchId = options.branchId || '';
  let workflowId = options.workflowId || '';
  let commitId = options.commitId || '';
  let configurationId = options.configurationId || '';

  if (!branchId && options.branch) {
    const branchesRes = await getBranches({ profileId: options.profileId || '' });
    const branchIndex = branchesRes.branches.findIndex((element: { [key: string]: any }) => element.name === options.branch);
    branchId = branchesRes.branches[branchIndex].id;
  }
  if (!workflowId && options.workflow) {
    const workflowsRes = await getWorkflows({ profileId: options.profileId || '' });
    const workflowIndex = workflowsRes.findIndex((element: { [key: string]: any }) => element.workflowName === options.workflow);
    workflowId = workflowsRes[workflowIndex].id;
  }

  if (!commitId) {
    const allCommitsByBranchId = await getCommits({ branchId });
    if(options.commitHash)
    {
      commitId = allCommitsByBranchId?.find((commit:any) => commit?.hash == options.commitHash)?.id;
    }
    else 
    {
      commitId = allCommitsByBranchId[0].id;
    }

    if(!commitId)
    {
      throw new ProgramError("Git commit not found.");
    }
  }

  if (!configurationId) {
    const allConfigurations = await getConfigurations({ profileId: options.profileId || '' });
    configurationId = allConfigurations[0].item1.id;
  }
  const buildResponse = await appcircleApi.post(
    `build/v2/commits/${commitId}?${qs.stringify({ action: 'build', workflowId, configurationId })}`,
    '{}',
    {
      headers: {
        ...getHeaders(),
        accept: '*/*',
        'content-type': 'application/x-www-form-urlencoded',
      },
    }
  );
  return buildResponse.data;
}

export async function downloadArtifact(options: OptionsType<{ buildId: string; commitId: string }>, downloadPath: string) {
  const data = new FormData();
  data.append('Path', downloadPath);
  data.append('Build Id', options.buildId);
  data.append('Commit Id', options.commitId);

  const downloadResponse = await appcircleApi.get(`build/v2/commits/${options.commitId}/builds/${options.buildId}`, {
    responseType: 'stream',
    headers: {
      ...getHeaders(),
      ...data.getHeaders(),
    },
  });
  return new Promise((resolve, reject) => {
    const writer = fs.createWriteStream(`${downloadPath}/artifact.zip`);
    downloadResponse.data.pipe(writer);
    let error: any = null;
    writer.on('error', (err) => {
      error = err;
      writer.close();
      reject(err);
    });
    writer.on('close', () => {
      if (!error) {
        resolve(true);
      }
      //no need to call the reject here, as it will have been called in the
      //'error' stream;
    });
  });
}

export async function downloadBuildLog(options: OptionsType<{ buildId: string; commitId: string }>, downloadPath: string) {
  const data = new FormData();
  data.append('Path', downloadPath);
  data.append('Build Id', options.buildId);
  data.append('Commit Id', options.commitId);

  const downloadResponse = await appcircleApi.get(`build/v2/commits/${options.commitId}/builds/${options.buildId}/logs`, {
    responseType: 'stream',
    headers: {
      ...getHeaders(),
      ...data.getHeaders(),
    },
  });
  return new Promise((resolve, reject) => {
    const writer = fs.createWriteStream(`${downloadPath}/${options.buildId}-log.txt`);
    downloadResponse.data.pipe(writer);
    let error: any = null;
    writer.on('error', (err) => {
      error = err;
      writer.close();
      reject(err);
    });
    writer.on('close', () => {
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
  data.append('Message', options.message);
  data.append('File', fs.createReadStream(options.app));

  const uploadResponse = await appcircleApi.post(`distribution/v2/profiles/${options.distProfileId}/app-versions`, data, {
    maxContentLength: Infinity,
    maxBodyLength: Infinity,
    headers: {
      ...getHeaders(),
      ...data.getHeaders(),
      'Content-Type': 'multipart/form-data;boundary=' + data.getBoundary(),
    },
  });
  return uploadResponse.data;
}

export async function uploadArtifactWithSignedUrl(
  options: OptionsType<{ app: string; uploadInfo: FileUploadInformation }>
) {
  const { app, uploadInfo } = options;
  
  if (!uploadInfo || !uploadInfo.uploadUrl) {
    throw new ProgramError('Invalid upload information received from server');
  }
  
  const stats = fs.statSync(app);
  const maxBytes = getMaxUploadBytes();
  if (maxBytes !== null && stats.size > maxBytes) {
    throw new ProgramError(
      `File size ${(stats.size / GB).toFixed(2)} GB exceeds the allowed limit of ${(maxBytes / GB).toFixed(2)} GB.`
    );
  }

  const { uploadUrl, configuration } = uploadInfo;
  
  if (!configuration || !configuration.httpMethod || configuration.httpMethod === 'PUT') {
    const file = fs.createReadStream(app);
    return axios.put(uploadUrl, file, {
      maxContentLength: Infinity,
      maxBodyLength: Infinity,
      headers: {
        'Content-Length': stats.size,
        'Content-Type': 'application/octet-stream',
      },
      transformRequest: [(d) => d],
      responseType: 'arraybuffer',
    });
  }

  const form = new FormData();
  if (configuration.signParameters) {
    for (const [k, v] of Object.entries(configuration.signParameters)) {
      form.append(k, v);
    }
  }
  form.append('file', fs.createReadStream(app));

  return axios.post(uploadUrl, form, {
    maxContentLength: Infinity,
    maxBodyLength: Infinity,
    headers: form.getHeaders(),
  });
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
    { Key: options.key, Value: options.value, IsSecret: options.isSecret || 'false' },
    {
      headers: getHeaders(),
    }
  );
  return response.data;
}

async function createFileEnvironmentVariable(options: OptionsType<{ key: string; isSecret: boolean; filePath: string; variableGroupId: string }>) {
  const form = new FormData();
  const file = fs.createReadStream(options.filePath);
  console.log('options.filePath): ', options.filePath);
  form.append('Key', options.key);
  form.append('Value', path.basename(options.filePath));
  form.append('IsSecret', 'false');
  form.append('Binary', file);

  const uploadResponse = await appcircleApi.post(`build/v1/variable-groups/${options.variableGroupId}/variables/files`, form, {
    maxContentLength: Infinity,
    maxBodyLength: Infinity,
    headers: {
      ...getHeaders(),
      ...form.getHeaders(),
      'Content-Type': 'multipart/form-data;boundary=' + form.getBoundary(),
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
    throw new ProgramError(`Environment variable type (${options.type}) not found`);
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

export async function getTaskStatus(options: OptionsType<{ taskId: string }>) {
  const task = await appcircleApi.get(`task/v1/tasks/${options.taskId}`, {
    headers: getHeaders(),
  });
  return task.data;
}

export const getUserInfo = async () => {
  const userInfo = await axios.get(`${AUTH_HOSTNAME}/auth/realms/appcircle/protocol/openid-connect/userinfo`, {
    headers: getHeaders(),
  });
  return userInfo.data;
};


export function getCountries() : {alpha2:string, name: string}[]{
  return CountriesList.map((country: any) => ({
      alpha2: country[1],
      name: country[0]
  }));
}

export * from './organization';
export * from './publish';
export * from './signing-identity';
export * from './testing-distribution';
export * from './enterprise-store';