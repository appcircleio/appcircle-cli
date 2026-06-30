/**
 * @fileoverview Utility functions for services/index.ts to improve testability
 * Extracted utilities from services/index.ts for authentication, build management, and file operations
 */

import qs from 'querystring';
import axios from 'axios';
import { OptionsType } from './api';
import { ProgramError } from '../core/ProgramError';

/**
 * Authentication utilities
 */

/**
 * Validates PAT token format
 * @param pat Personal Access Token to validate
 * @returns Boolean indicating if PAT format is valid
 */
export const validatePATFormat = (pat: string): boolean => {
  if (!pat || typeof pat !== 'string') {
    return false;
  }
  return pat.trim().length > 0;
};

/**
 * Creates PAT authentication request data
 * @param pat Personal Access Token
 * @returns URL-encoded string for PAT authentication
 */
export const createPATAuthData = (pat: string): string => {
  if (!validatePATFormat(pat)) {
    throw new ProgramError('Invalid PAT format provided');
  }
  return qs.stringify({ pat });
};

/**
 * Creates Personal Access Key authentication request data for v3 API
 * @param personalAccessKey Personal Access Key
 * @returns URL-encoded string for Personal Access Key authentication
 */
export const createPersonalAccessKeyAuthData = (personalAccessKey: string): string => {
  if (!validatePATFormat(personalAccessKey)) {
    throw new ProgramError('Invalid Personal Access Key format provided');
  }
  return qs.stringify({ personalAccessKey });
};

/**
 * Creates API key authentication request data
 * @param name API key name
 * @param secret API key secret
 * @param organizationId Optional organization ID
 * @returns URL-encoded string for API key authentication
 */
export const createAPIKeyAuthData = (
  name: string,
  secret: string,
  organizationId?: string
): string => {
  const requestData: any = {
    name: name?.trim(),
    secret: secret?.trim(),
  };

  if (organizationId !== undefined && organizationId?.trim()) {
    requestData.organizationId = organizationId.trim();
  }

  return qs.stringify(requestData);
};

/**
 * Validates API key parameters
 * @param name API key name
 * @param secret API key secret
 * @returns Validation result with error message if invalid
 */
export const validateAPIKeyParams = (
  name: string,
  secret: string
): { isValid: boolean; error?: string } => {
  if (!name || typeof name !== 'string' || name.trim().length === 0) {
    return { isValid: false, error: 'API key name is required and must be non-empty' };
  }
  
  if (!secret || typeof secret !== 'string' || secret.trim().length === 0) {
    return { isValid: false, error: 'API key secret is required and must be non-empty' };
  }
  
  return { isValid: true };
};

/**
 * Validates organization ID format (should be GUID)
 * @param organizationId Organization ID to validate
 * @returns Boolean indicating if format is valid GUID
 */
export const validateOrganizationIdFormat = (organizationId?: string): boolean => {
  if (!organizationId) return true; // Optional parameter
  
  const guidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return guidPattern.test(organizationId);
};

/**
 * Creates authentication headers for requests
 * @param contentType Content type for the request
 * @returns Headers object for authentication requests
 */
export const createAuthHeaders = (contentType: string = 'application/x-www-form-urlencoded') => {
  return {
    accept: 'application/json',
    'content-type': contentType,
  };
};

/**
 * Handles API key authentication errors and throws appropriate ProgramError
 * @param error Axios error from authentication request
 * @param organizationId Optional organization ID for context
 * @throws ProgramError with descriptive message
 */
export const handleAPIKeyAuthError = (error: any, organizationId?: string): never => {
  if (error.response) {
    const { status, data } = error.response;
    
    // 403 - Authorization failed (organization access)
    if (status === 403) {
      const orgId = organizationId || 'the specified organization';
      throw new ProgramError(
        `Login failed: Your API Key does not have access to organization "${orgId}".`
      );
    }
    
    // 400 - Bad Request (invalid format, etc.)
    if (status === 400) {
      if (data?.error && data.error.includes('organizationId must be a valid GUID')) {
        throw new ProgramError(
          `Invalid organization ID format: "${organizationId}"`
        );
      }
      throw new ProgramError(
        `Invalid request: ${data?.error || 'Bad request format'}`
      );
    }
    
    // 401 - Authentication failed
    if (status === 401) {
      throw new ProgramError(
        `Authentication failed: Invalid API Key credentials`
      );
    }
    
    // 500+ - Server errors
    if (status >= 500) {
      throw new ProgramError(
        `Server error occurred while processing your request (Status: ${status})`
      );
    }
  }
  
  // Network or other errors
  if (error.code === 'ECONNRESET' || error.code === 'ENOTFOUND') {
    throw new ProgramError(
      `Connection error: Unable to connect to Appcircle servers`
    );
  }
  
  throw error;
};

/**
 * Build management utilities
 */

/**
 * Validates build start parameters
 * @param options Build start options
 * @returns Validation result
 */
export const validateBuildStartParams = (
  options: OptionsType<{ 
    profileId: string; 
    branchId?: string; 
    workflowId?: string; 
    commitId?: string; 
    commitHash?: string; 
    configurationId?: string; 
  }>
): { isValid: boolean; error?: string } => {
  if (!options.profileId?.trim()) {
    return { isValid: false, error: 'Profile ID is required' };
  }

  // If no commitId provided, we need branchId or commitHash
  if (!options.commitId && !options.commitHash && !options.branchId) {
    return { 
      isValid: false, 
      error: 'Branch ID is required when commit ID is not provided. Please provide --branchId or --branch parameter.' 
    };
  }

  // If commitHash is provided, branchId is also required
  if (options.commitHash && !options.branchId) {
    return { 
      isValid: false, 
      error: 'Branch ID is required when commit hash is provided. Please provide --branchId or --branch parameter.' 
    };
  }

  return { isValid: true };
};

/**
 * Resolves commit ID from branch and optional commit hash
 * @param branchCommits Array of commits from branch
 * @param commitHash Optional commit hash to find
 * @returns Resolved commit ID
 */
export const resolveCommitId = (
  branchCommits: any[],
  commitHash?: string
): { commitId: string; error?: string } => {
  if (!branchCommits || branchCommits.length === 0) {
    return { commitId: '', error: 'No commits found' };
  }

  if (commitHash) {
    const foundCommit = branchCommits.find((c: any) => c.hash === commitHash);
    if (!foundCommit) {
      return { commitId: '', error: `Commit with hash "${commitHash}" not found` };
    }
    return { commitId: foundCommit.id };
  }

  // Return latest commit (first in array)
  return { commitId: branchCommits[0].id };
};

/**
 * Resolves configuration ID from profile configurations
 * @param configurations Array of configurations
 * @returns Configuration ID or error
 */
export const resolveConfigurationId = (
  configurations: any[]
): { configurationId: string; error?: string } => {
  if (!configurations || configurations.length === 0) {
    return { configurationId: '', error: 'No configurations found' };
  }

  const firstConfig = configurations[0];
  if (!firstConfig?.item1?.id) {
    return { configurationId: '', error: 'Invalid configuration structure' };
  }

  return { configurationId: firstConfig.item1.id };
};

/**
 * Creates build request URL and parameters
 * @param commitId Commit ID for the build
 * @param workflowId Optional workflow ID
 * @param configurationId Configuration ID
 * @returns Build request URL with query parameters
 */
export const createBuildRequestUrl = (
  commitId: string,
  workflowId: string = '',
  configurationId: string
): string => {
  const queryParams = { 
    action: 'build', 
    workflowId, 
    configurationId 
  };
  return `build/v2/commits/${commitId}?${qs.stringify(queryParams)}`;
};

/**
 * Creates build request headers
 * @param baseHeaders Base headers to extend
 * @returns Headers object for build requests
 */
export const createBuildRequestHeaders = (baseHeaders: any) => {
  return {
    headers: {
      ...baseHeaders,
      accept: '*/*',
      'content-type': 'application/x-www-form-urlencoded',
    },
  };
};

/**
 * File operation utilities
 */

/**
 * Determines build ID for artifact download
 * @param options Download options
 * @param getLatestBuildId Function to get latest build ID
 * @param getBuildsOfCommit Function to get builds of commit
 * @returns Build ID to use for download
 */
export const determineBuildIdForDownload = async (
  options: OptionsType<{ 
    buildId?: string; 
    commitId: string; 
    branchId?: string; 
    profileId?: string; 
  }>,
  getLatestBuildId: (params: { branchId: string; profileId: string }) => Promise<string | null>,
  getBuildsOfCommit: (params: { commitId: string }) => Promise<any>
): Promise<{ buildId: string; error?: string }> => {
  let buildId = options.buildId;

  // Try to get latest build if branch and profile provided
  if (options.branchId && options.profileId) {
    try {
      const latestBuildId = await getLatestBuildId({ 
        branchId: options.branchId, 
        profileId: options.profileId 
      });
      if (latestBuildId) {
        buildId = latestBuildId;
      }
    } catch (error) {
      // Continue with existing buildId or fallback
    }
  }

  // Fallback to builds from commit if no valid buildId
  if (!buildId || buildId === '00000000-0000-0000-0000-000000000000') {
    try {
      const buildsResponse = await getBuildsOfCommit({ commitId: options.commitId });
      if (buildsResponse?.builds && buildsResponse.builds.length > 0) {
        buildId = buildsResponse.builds[0].id;
      } else {
        return { buildId: '', error: `No builds found for commit ID: ${options.commitId}` };
      }
    } catch (error) {
      return { buildId: '', error: `Error fetching builds for commit: ${options.commitId}` };
    }
  }

  return { buildId: buildId! };
};

/**
 * Generates artifact filename with timestamp
 * @param customFileName Optional custom filename
 * @returns Generated filename
 */
export const generateArtifactFilename = (customFileName?: string): string => {
  if (customFileName?.trim()) {
    return customFileName.trim();
  }
  return `artifacts-${Date.now()}.zip`;
};

/**
 * Validates download path and creates directory if needed
 * @param downloadPath Path to download directory
 * @param fs File system module
 * @returns Validation result
 */
export const validateAndCreateDownloadPath = (
  downloadPath: string,
  fs: any
): { isValid: boolean; error?: string } => {
  try {
    if (!downloadPath?.trim()) {
      return { isValid: false, error: 'Download path is required' };
    }

    fs.mkdirSync(downloadPath, { recursive: true });
    return { isValid: true };
  } catch (error) {
    return { 
      isValid: false, 
      error: `Failed to create download directory: ${error}` 
    };
  }
};

/**
 * Handles download response validation
 * @param response HTTP response from download request
 * @param buildId Build ID for context
 * @returns Validation result
 */
export const validateDownloadResponse = (
  response: any,
  buildId: string
): { isValid: boolean; error?: string } => {
  if (response.status !== 200) {
    return { 
      isValid: false, 
      error: `Build artifact not found for build ID: ${buildId}` 
    };
  }

  if (!response.data) {
    return { 
      isValid: false, 
      error: 'Empty response data received' 
    };
  }

  return { isValid: true };
};

/**
 * Processes download error and returns user-friendly message
 * @param error Error from download request
 * @param buildId Build ID for context
 * @returns Processed error message
 */
export const processDownloadError = (error: any, buildId?: string): string => {
  if (error.response?.status === 404) {
    return `Build artifact not found${buildId ? ` for build ID: ${buildId}` : ''}`;
  }
  
  if (error.response?.status) {
    return `HTTP error ${error.response.status}: ${error.message}`;
  }

  if (error.code) {
    return `Network error (${error.code}): ${error.message}`;
  }

  return error.message || 'Unknown error occurred during download';
};

/**
 * Log content validation utilities
 */

/**
 * Validates log content and checks for "No Logs Available" message
 * @param logContent Log content to validate
 * @returns Validation result
 */
export const validateLogContent = (logContent: string): { isValid: boolean; error?: string } => {
  if (!logContent) {
    return { isValid: false, error: 'Empty response' };
  }

  const trimmedContent = logContent.trim();
  if (trimmedContent === '') {
    return { isValid: false, error: 'Empty response' };
  }

  if (trimmedContent === 'No Logs Available') {
    return { isValid: false, error: 'No Logs Available' };
  }

  return { isValid: true };
};

/**
 * Determines if content type is text-based for log processing
 * @param contentType Content type header value
 * @returns Boolean indicating if content is text-based
 */
export const isTextBasedContent = (contentType?: string): boolean => {
  if (!contentType) return false;
  return contentType.includes('text/') || contentType.includes('json');
};

/**
 * Handles log download errors
 * @param error Error from log download request
 * @returns User-friendly error message
 */
export const processLogDownloadError = (error: any): string => {
  if (error.response?.status === 404) {
    return 'No Logs Available (404)';
  }
  
  if (error.response?.status) {
    return `HTTP error: ${error.response.status}`;
  }

  return error.message || 'Unknown error occurred during log download';
};

/**
 * Build sorting utilities
 */

/**
 * Sorts builds by start date (newest first)
 * @param builds Array of builds to sort
 * @returns Sorted builds array
 */
export const sortBuildsByDate = (builds: any[]): any[] => {
  if (!builds || !Array.isArray(builds)) {
    return [];
  }

  return builds.sort((a, b) => {
    const dateA = a.startDate ? new Date(a.startDate) : new Date(0);
    const dateB = b.startDate ? new Date(b.startDate) : new Date(0);
    return dateB.getTime() - dateA.getTime();
  });
};

/**
 * Gets latest build ID from sorted builds
 * @param builds Array of builds
 * @returns Latest build ID or null
 */
export const getLatestBuildIdFromSorted = (builds: any[]): string | null => {
  const sortedBuilds = sortBuildsByDate(builds);
  return sortedBuilds.length > 0 ? sortedBuilds[0].id : null;
};

/**
 * Environment Variable utilities
 */

/**
 * Validates environment variable creation parameters
 * @param type Type of environment variable (TEXT or FILE)
 * @param key Variable key
 * @param value Variable value
 * @param filePath Path to file (for FILE type)
 * @returns Validation result
 */
export const validateEnvironmentVariableParams = (
  type: string,
  key: string,
  value?: string,
  filePath?: string
): { isValid: boolean; error?: string } => {
  if (!key?.trim()) {
    return { isValid: false, error: 'Environment variable key is required' };
  }

  if (type === 'FILE') {
    if (!filePath?.trim()) {
      return { isValid: false, error: 'File path is required for FILE type environment variables' };
    }
  } else if (type === 'TEXT' || !type) {
    if (!value && value !== '') {
      return { isValid: false, error: 'Value is required for TEXT type environment variables' };
    }
  }

  return { isValid: true };
};

/**
 * Upload utilities
 */

/**
 * Validates file upload parameters
 * @param filePath Path to file to upload
 * @param fs File system module
 * @returns Validation result
 */
export const validateUploadFile = (
  filePath: string,
  fs: any
): { isValid: boolean; error?: string } => {
  if (!filePath?.trim()) {
    return { isValid: false, error: 'File path is required' };
  }

  try {
    const stats = fs.statSync(filePath);
    if (!stats.isFile()) {
      return { isValid: false, error: 'Provided path is not a file' };
    }
    return { isValid: true };
  } catch (error) {
    return { isValid: false, error: `File not found: ${filePath}` };
  }
};

/**
 * Creates upload form data
 * @param message Upload message
 * @param fileStream File stream to upload
 * @param FormData FormData constructor
 * @returns Configured FormData instance
 */
export const createUploadFormData = (
  message: string,
  fileStream: any,
  FormData: any
): any => {
  const formData = new FormData();
  formData.append('Message', message);
  formData.append('File', fileStream);
  return formData;
};

/**
 * Creates upload request configuration
 * @param formData Form data to upload
 * @param headers Base headers
 * @param maxUploadBytes Maximum upload size
 * @returns Request configuration
 */
export const createUploadRequestConfig = (
  formData: any,
  headers: any,
  _maxUploadBytes?: number
) => {
  return {
    headers: {
      ...headers,
      ...formData.getHeaders(),
    },
    maxContentLength: Infinity,
    maxBodyLength: Infinity,
    timeout: 0, // No timeout for large uploads
  };
};

/**
 * Signed URL upload utilities
 */

/**
 * Validates signed URL upload information
 * @param uploadInfo Upload information from server
 * @returns Validation result
 */
export const validateSignedUrlUploadInfo = (
  uploadInfo: any
): { isValid: boolean; error?: string } => {
  if (!uploadInfo) {
    return { isValid: false, error: 'Upload information is required' };
  }

  if (!uploadInfo.uploadUrl) {
    return { isValid: false, error: 'Upload URL is missing from upload information' };
  }

  return { isValid: true };
};

/**
 * Determines HTTP method for signed URL upload
 * @param configuration Upload configuration
 * @returns HTTP method to use
 */
export const determineUploadMethod = (configuration?: any): 'PUT' | 'POST' => {
  if (!configuration || !configuration.httpMethod || configuration.httpMethod === 'PUT') {
    return 'PUT';
  }
  return 'POST';
};

/**
 * Validates file size against limits
 * @param fileSize Size of the file in bytes
 * @param maxBytes Maximum allowed bytes
 * @returns Validation result
 */
export const validateFileSize = (
  fileSize: number,
  maxBytes: number | null
): { isValid: boolean; error?: string } => {
  if (maxBytes !== null && fileSize > maxBytes) {
    const fileSizeGB = (fileSize / (1024 * 1024 * 1024)).toFixed(2);
    const maxSizeGB = (maxBytes / (1024 * 1024 * 1024)).toFixed(2);
    return {
      isValid: false,
      error: `File size ${fileSizeGB} GB exceeds the allowed limit of ${maxSizeGB} GB.`
    };
  }
  return { isValid: true };
};