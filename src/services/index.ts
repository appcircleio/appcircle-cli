import qs from 'querystring';
import fs from 'fs';
import path from 'path';
import FormData from 'form-data';
import axios from 'axios';
import chalk from 'chalk';
import { CountriesList, EnvironmentVariableTypes } from '../constant';
import { AUTH_HOSTNAME, HOOK_HOSTNAME, OptionsType, appcircleApi, getHeaders } from './api';
import { ProgramError } from '../core/ProgramError';
import { FileUploadInformation } from '../types/file-upload';
import { getMaxUploadBytes } from '../utils/size-limit';
import {
  createPATAuthData,
  createAPIKeyAuthData,
  validateAPIKeyParams,
  createAuthHeaders,
  handleAPIKeyAuthError,
  validateBuildStartParams,
  resolveCommitId,
  resolveConfigurationId,
  createBuildRequestUrl,
  createBuildRequestHeaders,
  determineBuildIdForDownload,
  generateArtifactFilename,
  validateAndCreateDownloadPath,
  validateDownloadResponse,
  processDownloadError,
  validateLogContent,
  isTextBasedContent,
  processLogDownloadError,
  sortBuildsByDate,
  getLatestBuildIdFromSorted,
  validateUploadFile,
  createUploadFormData,
  createUploadRequestConfig,
  validateEnvironmentVariableParams,
  validateSignedUrlUploadInfo,
  determineUploadMethod,
  validateFileSize
} from './index-utilities';

export class DetailedMonitoringError extends Error {
  constructor(
    public code: string,
    message: string,
    public originalError?: Error
  ) {
    super(message);
    this.name = 'DetailedMonitoringError';
  }
}

export const ErrorCodes = {
  E_HOOK_AUTH_FAILED: 'E_HOOK_AUTH_FAILED',
  E_SSE_CONNECT_FAILED: 'E_SSE_CONNECT_FAILED',
  E_TOKEN_MALFORMED: 'E_TOKEN_MALFORMED',
  E_TOKEN_DECODE_FAILED: 'E_TOKEN_DECODE_FAILED',
  E_CLAIM_MISSING_SUB: 'E_CLAIM_MISSING_SUB',
  E_CLAIM_MISSING_ORG: 'E_CLAIM_MISSING_ORG',
  E_IDENTITY_RESOLVE_FAILED: 'E_IDENTITY_RESOLVE_FAILED',
} as const;

// Retry utility for API calls
async function retryApiCall<T>(
  operation: () => Promise<T>,
  maxRetries: number = 2,
  timeoutMs: number = 15000
): Promise<T> {
  let lastError: Error | null = null;
  
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error('Request timeout')), timeoutMs);
      });
      
      return await Promise.race([operation(), timeoutPromise]);
    } catch (error: any) {
      lastError = error;
      
      // Don't retry on 4xx errors (client errors)
      if (error.response && error.response.status >= 400 && error.response.status < 500) {
        throw error;
      }
      
      // Don't retry on the last attempt
      if (attempt === maxRetries) {
        break;
      }
      
      // Wait before retry (exponential backoff)
      const delay = Math.min(1000 * Math.pow(2, attempt), 5000);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  
  throw lastError || new Error('Max retries exceeded');
}

// JWT Decoding utilities
function base64UrlDecode(input: string): string {
  input = input.replace(/-/g, '+').replace(/_/g, '/');
  const pad = input.length % 4 ? 4 - (input.length % 4) : 0;
  const padded = input + '='.repeat(pad);
  return Buffer.from(padded, 'base64').toString('utf8');
}

/**
 * Decodes JWT payload without signature verification
 * @param token JWT token string
 * @returns Decoded payload as object
 */
export function decodeJwtPayload(token: string): Record<string, any> {
  const parts = token.split('.');
  if (parts.length < 2) {
    throw new Error('E_TOKEN_MALFORMED');
  }
  
  try {
    const payloadJson = base64UrlDecode(parts[1]);
    const payload = JSON.parse(payloadJson);    
    return payload;
  } catch (error) {
    throw new Error('E_TOKEN_DECODE_FAILED');
  }
}

/**
 * Extracts identity claims from JWT access token
 * @param accessToken JWT access token
 * @returns Object with sub and currentOrganizationId
 */
export function resolveIdentityFromToken(accessToken: string): { sub: string; currentOrganizationId: string } {  
  try {
    const payload = decodeJwtPayload(accessToken);
    
    // Extract sub claim
    const sub = payload.sub;
    if (!sub || typeof sub !== 'string' || sub.trim() === '') {
      throw new DetailedMonitoringError(
        ErrorCodes.E_CLAIM_MISSING_SUB,
        'Missing or invalid "sub" claim in access token. Please re-authenticate.'
      );
    }
    
    // Extract organization claim (with configurable key)
    const orgClaimKey = process.env.CLAIM_ORG_KEY || 'currentOrganizationId';
    const currentOrganizationId = payload[orgClaimKey];
    
    if (!currentOrganizationId || typeof currentOrganizationId !== 'string' || currentOrganizationId.trim() === '') {
      throw new DetailedMonitoringError(
        ErrorCodes.E_CLAIM_MISSING_ORG,
        `Missing or invalid "${orgClaimKey}" claim in access token. Please ensure you have access to an organization.`
      );
    }
     
    return { sub, currentOrganizationId };
    
  } catch (error: any) {
    if (error instanceof DetailedMonitoringError) {
      throw error;
    }
    
    throw new DetailedMonitoringError(
      ErrorCodes.E_IDENTITY_RESOLVE_FAILED,
      'Unable to extract identity from access token. Consider re-authenticating.',
      error
    );
  }
}

export async function getToken(options: OptionsType<{ pat: string }>) {
  const authData = createPATAuthData(options.pat);
  const headers = createAuthHeaders();
  
  const response = await axios.post(`${AUTH_HOSTNAME}/auth/v1/token`, authData, {
    headers,
  });
  return response.data;
}

export async function getTokenFromApiKey(options: OptionsType<{ name: string; secret: string; organizationId?: string }>) {
  const validation = validateAPIKeyParams(options.name, options.secret);
  if (!validation.isValid) {
    throw new ProgramError(validation.error!);
  }

  const requestData = createAPIKeyAuthData(options.name, options.secret, options.organizationId);
  const headers = createAuthHeaders();

  try {
    const response = await axios.post(`${AUTH_HOSTNAME}/auth/v1/api-key/token`, requestData, {
      headers,
    });
    return response.data;
  } catch (error: any) {
    handleAPIKeyAuthError(error, options.organizationId);
  }
}

export async function getBuildProfiles(_options: OptionsType = {}) {
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
  const validation = validateBuildStartParams(options);
  if (!validation.isValid) {
    throw new ProgramError(validation.error!);
  }

  let workflowId = options.workflowId || '';
  let commitId = options.commitId || '';
  let configurationId = options.configurationId || '';
  const branchId = options.branchId;

  // Resolve commit ID if not provided
  if (!commitId) {
    const allCommitsByBranchId = await getCommits({ branchId: branchId! });
    const result = resolveCommitId(allCommitsByBranchId, options.commitHash);
    if (result.error) {
      throw new ProgramError(`${result.error} for branch ID "${branchId}".`);
    }
    commitId = result.commitId;
  }

  // Resolve configuration ID if not provided
  if (!configurationId) {
    const allConfigurations = await getConfigurations({ profileId: options.profileId });
    const result = resolveConfigurationId(allConfigurations);
    if (result.error) {
      throw new ProgramError(`${result.error} for profile ID "${options.profileId}".`);
    }
    configurationId = result.configurationId;
  }
  
  const postUrl = createBuildRequestUrl(commitId, workflowId, configurationId);
  const postBody = '{}';
  const postHeaders = createBuildRequestHeaders(getHeaders());

  const buildResponse = await appcircleApi.post(
    postUrl,
    postBody,
    postHeaders
  );
  return buildResponse.data;
}

export async function downloadArtifact(options: OptionsType<{ buildId?: string; commitId: string; branchId?: string; profileId?: string }>, downloadPath: string, artifactFileName?: string) {
  try {
    const buildResult = await determineBuildIdForDownload(options, getLatestBuildId, getBuildsOfCommit);
    if (buildResult.error) {
      throw new ProgramError(buildResult.error);
    }

    const pathValidation = validateAndCreateDownloadPath(downloadPath, fs);
    if (!pathValidation.isValid) {
      throw new ProgramError(pathValidation.error!);
    }

    const endpoint = `build/v1/commits/${options.commitId}/builds/${buildResult.buildId}`;
    const response = await appcircleApi.get(
      endpoint,
      {
        headers: getHeaders(),
        responseType: 'arraybuffer',
      }
    );
    
    const responseValidation = validateDownloadResponse(response, buildResult.buildId);
    if (!responseValidation.isValid) {
      throw new Error(responseValidation.error);
    }

    const fileName = generateArtifactFilename(artifactFileName);
    const artifactPath = path.join(downloadPath, fileName);
    fs.writeFileSync(artifactPath, response.data);
  } catch (error: any) {
    const errorMessage = processDownloadError(error, options.buildId);
    throw new Error(errorMessage);
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
        throw new ProgramError(`No builds found for commit ID: ${options.commitId}`);
      }
    }
  } catch (apiError: any) {
    if (!buildId) {
      throw new ProgramError(`Could not get build ID: ${apiError.message}`);
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

    const logValidation = validateLogContent(downloadResponse.data);
    if (!logValidation.isValid) {
      throw new ProgramError(logValidation.error!);
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
    const errorMessage = processLogDownloadError(error);
    throw new ProgramError(errorMessage);
  }
}

export async function uploadArtifact(options: OptionsType<{ message: string; app: string; distProfileId: string }>) {
  const fileValidation = validateUploadFile(options.app, fs);
  if (!fileValidation.isValid) {
    throw new ProgramError(fileValidation.error!);
  }

  const fileStream = fs.createReadStream(options.app);
  const data = createUploadFormData(options.message, fileStream, FormData);
  const config = createUploadRequestConfig(data, getHeaders(), getMaxUploadBytes());

  const uploadResponse = await appcircleApi.post(
    `distribution/v2/profiles/${options.distProfileId}/app-versions`, 
    data, 
    config
  );
  return uploadResponse.data;
}

async function putUploadWithRetry(url: string, file: fs.ReadStream, headers: any, maxRetries = 5) {
  let attempt = 0;
  let delay = 1000;

  while (true) {
    try {
      return await axios.put(url, file, {
        maxContentLength: Infinity,
        maxBodyLength: Infinity,
        headers,
        transformRequest: [(d) => d],
        responseType: 'arraybuffer',
      });
    } catch (error: any) {
      const status = error?.response?.status;
      const retryable =
        status === 503 ||
        error?.code === 'ECONNRESET' ||
        error?.message?.includes('socket hang up');

      if (!retryable || attempt >= maxRetries) {
        throw error;
      }
      attempt++;
      const jitter = Math.floor(Math.random() * 300);

      await new Promise((resolve) => setTimeout(resolve, delay + jitter)); // SLEEP

      delay *= 2;
    }
  }

}

export async function uploadArtifactWithSignedUrl(
  options: OptionsType<{ app: string; uploadInfo: FileUploadInformation }>
) {
  const { app, uploadInfo } = options;
  
  const uploadInfoValidation = validateSignedUrlUploadInfo(uploadInfo);
  if (!uploadInfoValidation.isValid) {
    throw new ProgramError(uploadInfoValidation.error!);
  }
  
  const stats = fs.statSync(app);
  const maxBytes = getMaxUploadBytes();
  const fileSizeValidation = validateFileSize(stats.size, maxBytes);
  if (!fileSizeValidation.isValid) {
    throw new ProgramError(fileSizeValidation.error!);
  }

  const { uploadUrl, configuration } = uploadInfo;
  const uploadMethod = determineUploadMethod(configuration);
  
  if (uploadMethod === 'PUT') {
    const file = fs.createReadStream(app);
    return putUploadWithRetry(uploadUrl,file, {
        'Content-Length': stats.size,
        'Content-Type': 'application/octet-stream',  
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

export async function getEnvironmentVariableGroups(_options: OptionsType = {}) {
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
  const validation = validateEnvironmentVariableParams(
    options.type,
    options.key,
    options.value,
    options.filePath
  );
  
  if (!validation.isValid) {
    throw new ProgramError(validation.error!);
  }

  if (options.type === EnvironmentVariableTypes.FILE) {
    return createFileEnvironmentVariable(options);
  } else if (!options.type || options.type === EnvironmentVariableTypes.TEXT) {
    return createTextEnvironmentVariable(options);
  } else if (options.type) {
    throw new ProgramError(`Environment variable type (${options.type}) not found`);
  }
}

export async function getBranches(options: OptionsType<{ profileId: string }>, _showConsole: boolean = true) {
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


/**
 * Trigger build logs streaming
 */
export const triggerBuildLogsStreaming = async (params: {
  apiHostname: string;
  hookHostname?: string;
  accessToken: string;
  taskId: string;
  browserId: string;
  userId: string;
  organizationId: string;
}): Promise<void> => {
  const { apiHostname, accessToken, taskId, browserId } = params;
  
  // Use hook hostname with query parameters (as shown in the curl example)
  const triggerUrl = `${params.hookHostname || apiHostname}/build/log/trigger-events-receiving`;
  
  try {
    const url = new URL(triggerUrl);
    url.searchParams.set('taskId', taskId);
    url.searchParams.set('browserId', browserId);
    url.searchParams.set('userId', params.userId);
    url.searchParams.set('organizationId', params.organizationId);
    
    const response = await axios.post(url.toString(), null, {
      headers: {
        'Authorization': `Bearer ${accessToken}`
      },
      timeout: 15000
    });
  } catch (error: any) {
    console.error(chalk.red(`❌ Trigger API Failed: ${error.message}`));
    if (error.response) {
      console.error(chalk.red(`   Status: ${error.response.status} ${error.response.statusText}`));
      console.error(chalk.red(`   Response: ${JSON.stringify(error.response.data)}`));
    }
  }
};

/**
 * Stops build logs streaming by calling the stop endpoint
 */
export const triggerStopBuildLogsStreaming = async (params: {
  hookHostname: string;
  accessToken: string;
  taskId: string;
  browserId: string;
  userId: string;
  organizationId: string;
}): Promise<void> => {
  const { hookHostname, accessToken, taskId, browserId } = params;
  
  const stopUrl = `${hookHostname}/build/log/trigger-stop-events-receiving`;
  
  try {
    const url = new URL(stopUrl);
    url.searchParams.set('taskId', taskId);
    url.searchParams.set('browserId', browserId);
    url.searchParams.set('userId', params.userId);
    url.searchParams.set('organizationId', params.organizationId);
    
    const response = await axios.post(url.toString(), null, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Accept': '*/*'
      },
      timeout: 10000
    });
    
  } catch (error: any) {
    console.error(chalk.yellow(`⚠️ Stop API Warning: ${error.message}`));
    if (error.response) {
      console.error(chalk.yellow(`   Status: ${error.response.status} ${error.response.statusText}`));
    }
    // Don't throw - this is cleanup, not critical
  }
};

/**
 * Obtains a short-lived hook token from the hook service
 */
export const getHookAccessToken = async (accessToken: string): Promise<string> => {
  try {
    const response = await retryApiCall(async () => {
      return await axios.post(`${HOOK_HOSTNAME}/auth/token`, {}, {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
      });
    }, 2, 15000);
    
    const { access_token: hookToken, expires_in } = response.data;
    
    if (!hookToken || typeof hookToken !== 'string' || hookToken.trim() === '') {
      throw new DetailedMonitoringError(
        ErrorCodes.E_HOOK_AUTH_FAILED,
        'Invalid or empty access token received from hook service. Please re-login and try again.'
      );
    }
    
    return hookToken;
  } catch (error: any) {
    if (error instanceof DetailedMonitoringError) {
      throw error;
    }
    
    if (error.response) {
      const status = error.response.status;
      if (status === 401) {
        throw new DetailedMonitoringError(
          ErrorCodes.E_HOOK_AUTH_FAILED,
          'Authentication failed with hook service. Please re-login to refresh your credentials.',
          error
        );
      } else if (status === 403) {
        throw new DetailedMonitoringError(
          ErrorCodes.E_HOOK_AUTH_FAILED,
          'Access denied to hook service. Please ensure you have the required permissions.',
          error
        );
      } else {
        throw new DetailedMonitoringError(
          ErrorCodes.E_HOOK_AUTH_FAILED,
          `Hook authentication failed: ${status} - ${error.response.statusText}. Please check your network connection.`,
          error
        );
      }
    } else if (error.request || error.message.includes('timeout')) {
      throw new DetailedMonitoringError(
        ErrorCodes.E_HOOK_AUTH_FAILED,
        'Hook authentication failed: Network error or timeout. Please check your network connection or proxy settings.',
        error
      );
    } else {
      throw new DetailedMonitoringError(
        ErrorCodes.E_HOOK_AUTH_FAILED,
        `Hook authentication failed: ${error.message}`,
        error
      );
    }
  }
};

// SSE connection interface for type safety
export interface SSEConnection {
  stream: NodeJS.ReadableStream;
  browserId: string;
  close: () => void;
  onMessage: (callback: (data: string) => void) => void;
  onError: (callback: (error: Error) => void) => void;
  onClose: (callback: () => void) => void;
}

/**
 * Opens a Server-Sent Events connection to the hook service
 */
export const openHookSSE = async (params: {
  hookHostname: string;
  userId: string;
  organizationId: string;
  token: string;
}): Promise<SSEConnection> => {
  const { hookHostname, userId, organizationId, token } = params;
  
  // Construct the URL with query parameters
  // Try multiple possible endpoints for build logs
  const url = `${hookHostname}/v2/hooks`;
  
  // Use a consistent browser ID for CLI (as shown in curl example)
  const browserId = 'cli-' + Math.random().toString(36).substring(2, 15);
  
  const queryParams = new URLSearchParams({
    userId,
    organizationId,
    token,
    browserId // Add browser ID to track this specific connection
  });
  const fullUrl = `${url}?${queryParams}`;
  
  // SSE connection setup
  
  let lastError: Error | null = null;
  const maxRetries = 3;
  const retryDelays = [1000, 2000, 5000]; // 1s, 2s, 5s
  
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const response = await axios({
        method: 'get',
        url: fullUrl,
        headers: {
          'accept': 'text/event-stream',
          'user-agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36',
          'cache-control': 'no-cache',
        },
        responseType: 'stream',
        timeout: 15000,
      });
      
      if (response.status !== 200) {
        throw new Error(`SSE connection failed with status: ${response.status}`);
      }
      
      const stream = response.data;
      let isClosed = false;
      const messageCallbacks: ((data: string) => void)[] = [];
      const errorCallbacks: ((error: Error) => void)[] = [];
      const closeCallbacks: (() => void)[] = [];
      
      // Handle stream data and parse SSE format
      let buffer = '';
      let currentEvent: string | null = null;
      let currentData: string[] = [];
      
      stream.on('data', (chunk: Buffer) => {
        const chunkStr = chunk.toString();
        buffer += chunkStr;
        const lines = buffer.split('\n');
        buffer = lines.pop() || ''; // Keep incomplete line in buffer
        
        // Process each line and handle SSE format properly
        for (const line of lines) {
          if (line.startsWith('event:')) {
            currentEvent = line.substring(6).trim();
            currentData = [];
          } else if (line.startsWith('data:')) {
            const data = line.substring(5);
            currentData.push(data);
          } else if (line.trim() === '') {
            // Empty line indicates end of SSE event
            if (currentEvent && currentData.length > 0) {
              const eventData = currentData.join('\n');
              
              // Only process build-log events
              if (currentEvent === 'build-log') {
                messageCallbacks.forEach(callback => {
                  try {
                    callback(eventData);
                  } catch (error) {
                    console.error('Error in SSE message callback:', error);
                  }
                });
              }
              // Reset for next event
              currentEvent = null;
              currentData = [];
            }
          }
          // Ignore other line types (id:, retry:, etc.)
        }
      });
      
      stream.on('error', (error: Error) => {
        if (!isClosed) {
          errorCallbacks.forEach(callback => {
            try {
              callback(error);
            } catch (err) {
              console.error('Error in SSE error callback:', err);
            }
          });
        }
      });
      
      stream.on('end', () => {
        if (!isClosed) {
          isClosed = true;
          closeCallbacks.forEach(callback => {
            try {
              callback();
            } catch (error) { }
          });
        }
      });
      
      stream.on('close', () => {
        // Stream closed - no logging needed
      });
      
      // Return SSE connection interface
      return {
        stream,
        browserId, // Return the browser ID for triggering logs
        close: () => {
          if (!isClosed) {
            isClosed = true;
            stream.destroy();
            closeCallbacks.forEach(callback => {
              try {
                callback();
              } catch (error) { }
            });
          }
        },
        onMessage: (callback: (data: string) => void) => {
          messageCallbacks.push(callback);
        },
        onError: (callback: (error: Error) => void) => {
          errorCallbacks.push(callback);
        },
        onClose: (callback: () => void) => {
          closeCallbacks.push(callback);
        }
      };
      
    } catch (error: any) {
      lastError = error;
      
      // Don't retry on the last attempt
      if (attempt === maxRetries) {
        break;
      }
      
      // Wait before retry
      const delay = retryDelays[attempt] || 5000;
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  
  // All retries failed
  throw new DetailedMonitoringError(
    ErrorCodes.E_SSE_CONNECT_FAILED,
    `Failed to establish SSE connection after ${maxRetries + 1} attempts. Please check your network connection and hook service availability.`,
    lastError || undefined
  );
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
      if (isTextBasedContent(downloadResponse.headers['content-type'])) {
        let responseText = '';
        downloadResponse.data.on('data', (chunk: Buffer) => {
          responseText += chunk.toString('utf8');
        });
        
        downloadResponse.data.on('end', () => {
          const logValidation = validateLogContent(responseText);
          if (!logValidation.isValid) {
            reject(new ProgramError(logValidation.error!));
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
    const errorMessage = processLogDownloadError(error);
    throw new ProgramError(errorMessage);
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
      return getLatestBuildIdFromSorted(response.data);
    }
    return null;
  } catch (error) {
    console.error('Error getting latest build ID:', error);
    return null;
  }
}