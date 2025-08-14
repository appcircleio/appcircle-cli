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

export async function getTokenFromApiKey(options: OptionsType<{ name: string; secret: string; organizationId?: string }>) {
  const requestData = {
    name: options.name,
    secret: options.secret,
  };

  if (options.organizationId !== undefined) {
    (requestData as any).organizationId = options.organizationId;
  }

  try {
    const response = await axios.post(`${AUTH_HOSTNAME}/auth/v1/api-key/token`, qs.stringify(requestData), {
      headers: {
        accept: 'application/json',
        'content-type': 'application/x-www-form-urlencoded',
      },
    });
    return response.data;
  } catch (error: any) {
    throw error;
  }
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
  options: OptionsType<{ profileId: string; branchId?: string; workflowId?: string; commitId?: string, commitHash?: string, configurationId?: string }>
) {
  let workflowId = options.workflowId || '';
  let commitId = options.commitId || '';
  let configurationId = options.configurationId || '';
  let branchId = options.branchId;

  // branchId is only required if commitId is not provided
  if (!commitId && !options.commitHash) {
    if (!branchId) {
      throw new ProgramError(`Branch ID is required when commit ID is not provided. Please provide --branchId or --branch parameter.`);
    }
    const allCommitsByBranchId = await getCommits({ branchId: branchId! });
    if (allCommitsByBranchId && allCommitsByBranchId.length > 0) {
      commitId = allCommitsByBranchId[0].id;
    } else {
      throw new ProgramError(`No commits found for branch ID "${branchId}".`);
    }
  } else if (!commitId && options.commitHash) {
    if (!branchId) {
      throw new ProgramError(`Branch ID is required when commit hash is provided. Please provide --branchId or --branch parameter.`);
    }
    const allCommitsByBranchId = await getCommits({ branchId: branchId! });
    const foundCommit = allCommitsByBranchId?.find((c:any) => c.hash == options.commitHash);
    if (foundCommit) {
      commitId = foundCommit.id;
    } else {
      throw new ProgramError(`Commit with hash "${options.commitHash}" not found for branch ID "${branchId}".`);
    }
  }

  if (!configurationId) {
    const allConfigurations = await getConfigurations({ profileId: options.profileId });
    if (allConfigurations && allConfigurations.length > 0 && allConfigurations[0].item1 && allConfigurations[0].item1.id) {
      configurationId = allConfigurations[0].item1.id;
    } else {
      throw new ProgramError(`No configurations found for profile ID "${options.profileId}".`);
    }
  }
  
  const postUrl = `build/v2/commits/${commitId}?${qs.stringify({ action: 'build', workflowId, configurationId })}`;
  const postBody = '{}';
  const postHeaders = {
    headers: {
      ...getHeaders(),
      accept: '*/*',
      'content-type': 'application/x-www-form-urlencoded',
    },
  };

  const buildResponse = await appcircleApi.post(
    postUrl,
    postBody,
    postHeaders
  );
  return buildResponse.data;
}

export async function downloadArtifact(options: OptionsType<{ buildId?: string; commitId: string; branchId?: string; profileId?: string }>, downloadPath: string, artifactFileName?: string) {
  try {
    let buildId = options.buildId;
    if (options.branchId && options.profileId) {
      const latestBuildId = await getLatestBuildId({ 
        branchId: options.branchId, 
        profileId: options.profileId 
      });
      if (latestBuildId) {
        buildId = latestBuildId;
      }
    }
    else if (!buildId || buildId === '00000000-0000-0000-0000-000000000000') {
      const buildsResponse = await getBuildsOfCommit({ commitId: options.commitId });
      if (buildsResponse && buildsResponse.builds && buildsResponse.builds.length > 0) {
        buildId = buildsResponse.builds[0].id;
      } else {
        throw new Error(`No builds found for commit ID: ${options.commitId}`);
      }
    }
    const endpoint = `build/v1/commits/${options.commitId}/builds/${buildId}`;
    const response = await appcircleApi.get(
      endpoint,
      {
        headers: getHeaders(),
        responseType: 'arraybuffer',
      }
    );
    if (response.status === 200) {
      const fileName = artifactFileName || `artifacts-${Date.now()}.zip`;
      const artifactPath = path.join(downloadPath, fileName);
      // Ensure directory exists before writing file
      fs.mkdirSync(downloadPath, { recursive: true });
      fs.writeFileSync(artifactPath, response.data);
    } else {
      throw new Error('Build artifact not found');
    }
  } catch (error: any) {
    if (error.response?.status === 404) {
      throw new Error(`Build artifact not found. No artifact available for latest build ID (${options.buildId}).`);
    }
    throw error;
  }
}

export async function downloadBuildLog(options: OptionsType<{ buildId?: string; commitId: string; branchId?: string; profileId?: string }>, downloadPath: string, fileName?: string) {
  let buildId = options.buildId;
  
  try {
    if (options.branchId && options.profileId) {
      console.log(`Getting latest build ID with Branch and Profile ID...`);
      const latestBuildId = await getLatestBuildId({ 
        branchId: options.branchId, 
        profileId: options.profileId 
      });
      
      if (latestBuildId) {
        console.log(`Got latest build ID from API: ${latestBuildId}`);
        buildId = latestBuildId;
      } else {
        console.log(`Could not get build ID from API, trying alternative method.`);
      }
    }
    else if (!buildId || buildId === '00000000-0000-0000-0000-000000000000') {
      console.log(`Invalid build ID, searching for build ID from commit...`);
      const buildsResponse = await getBuildsOfCommit({ commitId: options.commitId });
      
      if (buildsResponse && buildsResponse.builds && buildsResponse.builds.length > 0) {
        buildId = buildsResponse.builds[0].id;
        console.log(`Found latest build ID from commit: ${buildId}`);
      } else {
        throw new Error(`No builds found for commit ID: ${options.commitId}`);
      }
    }
  } catch (apiError: any) {
    if (!buildId) {
      throw new Error(`Could not get build ID: ${apiError.message}`);
    }
    console.log(`API error: ${apiError.message}. Continuing with existing build ID: ${buildId}`);
  }
  
  const data = new FormData();
  data.append('Path', downloadPath);
  data.append('Build Id', buildId);
  data.append('Commit Id', options.commitId);
  
  const endpoint = `build/v1/commits/${options.commitId}/builds/${buildId}/logs`;
  
  try {
    const downloadResponse = await appcircleApi.get(endpoint, {
      responseType: 'text',
      headers: {
        ...getHeaders(),
        ...data.getHeaders(),
      },
    });

    if (downloadResponse.data && 
        (downloadResponse.data.includes('No Logs Available') || 
         downloadResponse.data.trim() === '')) {
      throw new Error('No Logs Available');
    }
    
    const writer = fs.createWriteStream(`${downloadPath}/${fileName || `${buildId}-log.txt`}`);
    writer.write(downloadResponse.data);
    writer.end();
    
    return new Promise<boolean>((resolve, reject) => {
      writer.on('finish', () => {
        resolve(true);
      });
      writer.on('error', (err) => {
        reject(err);
      });
    });
  } catch (error: any) {
    if (error.response && error.response.status === 404) {
      throw new Error('No Logs Available (404)');
    } else if (error.response && error.response.status) {
      throw new Error(`HTTP error: ${error.response.status}`);
    }
    throw error;
  }
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

export async function uploadEnvironmentVariablesFromFile(options: OptionsType<{ variableGroupId: string; filePath: string }>) {
  const form = new FormData();
  form.append('variableGroupId', options.variableGroupId);
  form.append('envVariablesFile', fs.createReadStream(options.filePath));

  const response = await appcircleApi.post(
    `build/v1/variable-groups/${options.variableGroupId}/upload-variables-file`,
    form,
    {
      maxContentLength: Infinity,
      maxBodyLength: Infinity,
      headers: {
        ...getHeaders(),
        ...form.getHeaders(),
      },
    }
  );
  return response.data;
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
  const branchResponse = await appcircleApi.get(`build/v1/profiles/${options.profileId}`, {
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

export async function getBuildStatusFromQueue(options: OptionsType<{ taskId: string }>) {
  const queueResponse = await appcircleApi.get(`build/v1/queue/${options.taskId}`, {
    headers: getHeaders(),
  });
  return queueResponse.data;
}

export async function getBuildStatus(options: OptionsType<{ commitId: string; buildId: string }>) {
  const statusResponse = await appcircleApi.get(`build/v2/commits/${options.commitId}/builds/${options.buildId}/status`, {
    headers: getHeaders(),
  });
  return statusResponse.data;
}

export async function downloadTaskLog(options: OptionsType<{ taskId: string }>, downloadPath: string, fileName?: string) {
  try {
    const endpoint = `build/v1/queue/logs/${options.taskId}`;
    
    const downloadResponse = await appcircleApi.get(endpoint, {
      responseType: 'stream',
      headers: getHeaders()
    });
    
    if (downloadResponse.status !== 200) {
      throw new Error(`HTTP error: ${downloadResponse.status}`);
    }
    
    return new Promise((resolve, reject) => {
      if (downloadResponse.headers['content-type'] && downloadResponse.headers['content-type'].includes('text/plain')) {
        let responseText = '';
        downloadResponse.data.on('data', (chunk: Buffer) => {
          responseText += chunk.toString('utf8');
        });
        
        downloadResponse.data.on('end', () => {
          if (responseText.includes('No Logs Available')) {
            reject(new Error('No Logs Available'));
          } else if (responseText.trim() === '') {
            reject(new Error('Empty response'));
          } else {
            const targetFile = `${downloadPath}/${fileName || `build-task-${options.taskId}-log.txt`}`;
            const writer = fs.createWriteStream(targetFile);
            writer.write(responseText);
            writer.end();
            writer.on('finish', () => {
              resolve(true);
            });
            writer.on('error', (err) => {
              reject(err);
            });
          }
        });
        
        downloadResponse.data.on('error', (err: any) => {
          reject(err);
        });
      } else {
        const targetFile = `${downloadPath}/${fileName || `build-task-${options.taskId}-log.txt`}`;
        const writer = fs.createWriteStream(targetFile);
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
        });
      }
    });
  } catch (error: any) {
    if (error.response && error.response.status === 404) {
      throw new Error('HTTP error: 404');
    }
    throw error;
  }
}

export async function getLatestBuildByBranch(options: OptionsType<{ branchId: string; profileId: string }>) {
  try {
    const response = await appcircleApi.get(`build/v1/builds?branchId=${options.branchId}&profileId=${options.profileId}`, {
      headers: getHeaders(),
    });
    
    if (response.data && Array.isArray(response.data) && response.data.length > 0) {
      return response.data[0];
    }
    return null;
  } catch (error) {
    console.log(`Builds listing error: ${error}`);
    return null;
  }
}

export async function getLatestBuildId(options: OptionsType<{ branchId: string; profileId: string }>) {
  try {
    const response = await appcircleApi.get(
      `build/v1/builds?branchId=${options.branchId}&profileId=${options.profileId}`,
      {
        headers: getHeaders(),
      }
    );

    if (response.data && Array.isArray(response.data) && response.data.length > 0) {
      const sortedBuilds = response.data.sort((a: any, b: any) => {
        return new Date(b.startDate).getTime() - new Date(a.startDate).getTime();
      });
      
      return sortedBuilds[0].id;
    }
    return null;
  } catch (error) {
    console.error('Error getting latest build ID:', error);
    return null;
  }
}