/**
 * @fileoverview Utility functions extracted from command-runner.ts to improve testability
 * These functions handle specific command processing logic that can be tested independently
 */

import path from 'path';
import os from 'os';
import fs from 'fs';
import { ProgramError } from './ProgramError';
import { AppcircleExitError } from './AppcircleExitError';
import { CURRENT_PARAM_VALUE, UNKNOWN_PARAM_VALUE, PROGRAM_NAME } from '../constant';

/**
 * Command validation utilities
 */

export interface ValidationResult {
  isValid: boolean;
  error?: string;
}

/**
 * Validates required command parameters
 * @param params Command parameters
 * @param requiredParams Array of required parameter names
 * @returns Validation result
 */
export const validateRequiredParams = (params: any, requiredParams: string[]): ValidationResult => {
  for (const param of requiredParams) {
    if (!params[param]) {
      return {
        isValid: false,
        error: `Missing required parameter: ${param}`
      };
    }
  }
  return { isValid: true };
};

/**
 * Validates parameter error flag
 * @param params Command parameters
 * @returns Validation result
 */
export const validateParameterErrorFlag = (params: any): ValidationResult => {
  if (params.isError) {
    return {
      isValid: false,
      error: 'Parameter error'
    };
  }
  return { isValid: true };
};

/**
 * File path utilities
 */

/**
 * Expands tilde (~) in file paths to home directory
 * @param filePath Path that may contain tilde
 * @returns Expanded path
 */
export const expandTildeInPath = (filePath: string): string => {
  if (!filePath) return filePath;
  
  const homeDir = os.homedir();
  if (filePath.includes('~')) {
    return filePath.replace(/~/g, homeDir);
  }
  return filePath;
};

/**
 * Validates if a file exists and is accessible
 * @param filePath Path to the file
 * @returns Validation result with expanded path
 */
export const validateFileExists = (filePath: string): ValidationResult & { expandedPath?: string } => {
  if (!filePath?.trim()) {
    return {
      isValid: false,
      error: 'File path is required'
    };
  }

  const expandedPath = path.resolve(expandTildeInPath(filePath));
  
  try {
    if (!fs.existsSync(expandedPath)) {
      return {
        isValid: false,
        error: `File not found: ${expandedPath}`,
        expandedPath
      };
    }

    const stats = fs.statSync(expandedPath);
    if (!stats.isFile()) {
      return {
        isValid: false,
        error: `Provided path is not a file: ${expandedPath}`,
        expandedPath
      };
    }

    return {
      isValid: true,
      expandedPath
    };
  } catch (error: any) {
    return {
      isValid: false,
      error: `Cannot access file: ${error.message}`,
      expandedPath
    };
  }
};

/**
 * Validates and parses JSON file content
 * @param filePath Path to JSON file
 * @returns Validation result with parsed content
 */
export const validateAndParseJsonFile = (filePath: string): ValidationResult & { content?: any } => {
  const fileValidation = validateFileExists(filePath);
  if (!fileValidation.isValid) {
    return fileValidation;
  }

  try {
    const fileContent = fs.readFileSync(fileValidation.expandedPath!, 'utf8');
    const content = JSON.parse(fileContent);
    return {
      isValid: true,
      content
    };
  } catch (error: any) {
    return {
      isValid: false,
      error: 'Invalid JSON file'
    };
  }
};

/**
 * Creates directory if it doesn't exist
 * @param dirPath Directory path to create
 * @returns Validation result with final path
 */
export const ensureDirectoryExists = (dirPath: string): ValidationResult & { finalPath?: string } => {
  if (!dirPath?.trim()) {
    const homeDir = os.homedir();
    const defaultPath = path.join(homeDir, 'Downloads');
    return ensureDirectoryExists(defaultPath);
  }

  const expandedPath = path.resolve(expandTildeInPath(dirPath));
  
  try {
    if (!fs.existsSync(expandedPath)) {
      fs.mkdirSync(expandedPath, { recursive: true });
    }

    const stats = fs.statSync(expandedPath);
    if (!stats.isDirectory()) {
      return {
        isValid: false,
        error: `Path is not a directory: ${expandedPath}`
      };
    }

    return {
      isValid: true,
      finalPath: expandedPath
    };
  } catch (error: any) {
    return {
      isValid: false,
      error: `Cannot create directory: ${error.message}`
    };
  }
};

/**
 * String utilities
 */

/**
 * Sanitizes a string to be safe for use in file names
 * @param input String to sanitize
 * @returns Safe filename string
 */
export const sanitizeForFileName = (input: string): string => {
  if (!input || typeof input !== 'string') {
    return 'unknown';
  }
  
  return input
    // Replace path separators with hyphens
    .replace(/[\/\\]/g, '-')
    // Replace other unsafe characters with hyphens  
    .replace(/[<>:"|?*]/g, '-')
    // Replace spaces with hyphens for better compatibility
    .replace(/\s+/g, '-')
    // Remove any consecutive hyphens
    .replace(/-+/g, '-')
    // Remove leading/trailing hyphens
    .replace(/^-+|-+$/g, '')
    // Fallback if string becomes empty
    || 'unknown';
};

/**
 * Beautifies command name for error messages
 * @param fullCommandName Full command name with hyphens
 * @returns Beautified command name with spaces
 */
export const beautifyCommandName = (fullCommandName: string): string => {
  return fullCommandName.split('-').join(' ');
};

/**
 * Parameter resolution utilities
 */

/**
 * Resolves organization ID from various sources
 * @param params Command parameters
 * @param organizations List of available organizations
 * @param currentUser Current user info
 * @returns Resolved organization ID
 */
export const resolveOrganizationIdFromParams = (
  params: any, 
  organizations: Array<{ id: string; name: string }>,
  currentUser?: { currentOrganizationId?: string }
): ValidationResult & { organizationId?: string } => {
  // If organization name is provided, resolve to ID
  if (params.organization && (!params.organizationId || params.organizationId === 'all' || params.organizationId === 'current')) {
    const foundOrganization = organizations.find((org: any) => org.name === params.organization);
    if (!foundOrganization) {
      return {
        isValid: false,
        error: `Organization "${params.organization}" not found.\n        \nAvailable organizations:\n${organizations.map((org: any) => `  - ${org.name}`).join('\n')}`
      };
    }
    return {
      isValid: true,
      organizationId: foundOrganization.id
    };
  }

  // If current is requested, use current user's org
  if (!params.organizationId || params.organizationId === CURRENT_PARAM_VALUE) {
    if (!currentUser?.currentOrganizationId) {
      return {
        isValid: false,
        error: 'Current organization ID not available'
      };
    }
    return {
      isValid: true,
      organizationId: currentUser.currentOrganizationId
    };
  }

  // Use provided organization ID
  return {
    isValid: true,
    organizationId: params.organizationId
  };
};

/**
 * Resolves user ID from email or name
 * @param params Command parameters
 * @param users List of available users
 * @returns Resolved user ID
 */
export const resolveUserIdFromUserParam = (
  params: any,
  users: Array<{ id: string; email: string; fullName?: string }>
): ValidationResult & { userId?: string } => {
  if (params.user && !params.userId) {
    const foundUser = users.find((user: any) => user.email === params.user || user.fullName === params.user);
    if (!foundUser) {
      return {
        isValid: false,
        error: `User "${params.user}" not found in organization.\n        \nAvailable users:\n${users.map((user: any) => `  - ${user.email} (${user.fullName || 'No name'})`).join('\n')}`
      };
    }
    return {
      isValid: true,
      userId: foundUser.id
    };
  }

  return {
    isValid: true,
    userId: params.userId
  };
};

/**
 * Build parameter resolution utilities
 */

/**
 * Resolves profile ID from profile name
 * @param params Command parameters
 * @param profiles List of available profiles
 * @returns Resolved profile ID
 */
export const resolveProfileIdFromName = (
  params: any,
  profiles: Array<{ id: string; name: string }>
): ValidationResult & { profileId?: string } => {
  if (params.profile && !params.profileId) {
    const foundProfile = profiles.find((profile: any) => profile.name === params.profile);
    if (!foundProfile) {
      return {
        isValid: false,
        error: `Build profile "${params.profile}" not found.\n        \nAvailable build profiles:\n${profiles.map((profile: any) => `  - ${profile.name}`).join('\n')}`
      };
    }
    return {
      isValid: true,
      profileId: foundProfile.id
    };
  }

  return {
    isValid: true,
    profileId: params.profileId
  };
};

/**
 * Resolves branch ID from branch name
 * @param params Command parameters
 * @param branches List of available branches
 * @returns Resolved branch ID
 */
export const resolveBranchIdFromName = (
  params: any,
  branches: Array<{ id: string; name: string }>
): ValidationResult & { branchId?: string } => {
  if (params.branch && !params.branchId) {
    const foundBranch = branches.find((branch: any) => branch.name === params.branch);
    if (!foundBranch) {
      return {
        isValid: false,
        error: `Branch "${params.branch}" not found for build profile.\n        \nAvailable branches:\n${branches?.map((branch: any) => `  - ${branch.name}`).join('\n') || 'No branches found'}`
      };
    }
    return {
      isValid: true,
      branchId: foundBranch.id
    };
  }

  return {
    isValid: true,
    branchId: params.branchId
  };
};

/**
 * Resolves workflow ID from workflow name
 * @param params Command parameters
 * @param workflows List of available workflows
 * @returns Resolved workflow ID
 */
export const resolveWorkflowIdFromName = (
  params: any,
  workflows: Array<{ id: string; workflowName: string }>
): ValidationResult & { workflowId?: string } => {
  if (params.workflow && !params.workflowId) {
    const foundWorkflow = workflows.find((workflow: any) => workflow.workflowName === params.workflow);
    if (!foundWorkflow) {
      return {
        isValid: false,
        error: `Workflow "${params.workflow}" not found for build profile.\n        \nAvailable workflows:\n${workflows.map((workflow: any) => `  - ${workflow.workflowName}`).join('\n')}`
      };
    }
    return {
      isValid: true,
      workflowId: foundWorkflow.id
    };
  }

  return {
    isValid: true,
    workflowId: params.workflowId
  };
};

/**
 * Resolves configuration ID from configuration name
 * @param params Command parameters
 * @param configurations List of available configurations
 * @returns Resolved configuration ID
 */
export const resolveConfigurationIdFromName = (
  params: any,
  configurations: Array<{ item1?: { id: string; configurationName?: string } }>
): ValidationResult & { configurationId?: string } => {
  if (params.configuration && !params.configurationId) {
    const foundConfiguration = configurations.find((config: any) => config.item1?.configurationName === params.configuration);
    if (!foundConfiguration) {
      return {
        isValid: false,
        error: `Configuration "${params.configuration}" not found for build profile.\n        \nAvailable configurations:\n${configurations.map((config: any) => `  - ${config.item1?.configurationName || 'Unknown'}`).join('\n')}`
      };
    }
    return {
      isValid: true,
      configurationId: foundConfiguration.item1!.id
    };
  }

  return {
    isValid: true,
    configurationId: params.configurationId
  };
};

/**
 * Command routing utilities
 */

/**
 * Creates error message for unknown commands
 * @param fullCommandName Full command name
 * @param longDescription Optional long description
 * @returns Error message
 */
export const createUnknownCommandError = (fullCommandName: string, longDescription?: string): string => {
  const beautifiedCommandName = beautifyCommandName(fullCommandName);
  
  if (longDescription) {
    return `\n${longDescription}\n`;
  }
  
  return `"${beautifiedCommandName} ..." command not found.`;
};

/**
 * Time utilities
 */

/**
 * Formats elapsed time in readable format
 * @param startTime Start time in milliseconds
 * @returns Formatted time string
 */
export const formatElapsedTime = (startTime: number): string => {
  const elapsedSeconds = Math.floor((Date.now() - startTime) / 1000);
  const elapsedMinutes = Math.floor(elapsedSeconds / 60);
  return elapsedMinutes > 0 ? 
    `${elapsedMinutes}m ${elapsedSeconds % 60}s` : 
    `${elapsedSeconds}s`;
};

/**
 * Generates timestamp-based filename
 * @param prefix Filename prefix
 * @param extension File extension (default: 'txt')
 * @returns Timestamped filename
 */
export const generateTimestampFilename = (prefix: string = 'file', extension: string = 'txt'): string => {
  const timestamp = Date.now();
  return `${prefix}-${timestamp}.${extension}`;
};

/**
 * Download path utilities
 */

/**
 * Sets up download directory with fallback handling
 * @param providedPath User-provided path
 * @param fallbackDir Fallback directory (default: ~/Downloads)
 * @returns Final download path
 */
export const setupDownloadDirectory = (providedPath?: string, fallbackDir?: string): ValidationResult & { downloadPath?: string } => {
  const homeDir = os.homedir();
  const defaultDownloadDir = fallbackDir || path.join(homeDir, 'Downloads');
  
  if (!providedPath) {
    const result = ensureDirectoryExists(defaultDownloadDir);
    return {
      isValid: result.isValid,
      error: result.error,
      downloadPath: result.finalPath || homeDir
    };
  }

  const result = ensureDirectoryExists(providedPath);
  if (!result.isValid) {
    // Fallback to default directory
    const fallbackResult = ensureDirectoryExists(defaultDownloadDir);
    return {
      isValid: true,
      downloadPath: fallbackResult.finalPath || homeDir
    };
  }

  return {
    isValid: true,
    downloadPath: result.finalPath
  };
};

/**
 * Gets user removal identifier (email or ID)
 * @param params Command parameters  
 * @param userInfo Optional user info for ID resolution
 * @returns Removal identifier and item type
 */
export const getUserRemovalIdentifier = (
  params: any,
  userInfo?: { email?: string }
): { removalIdentifier: string; itemType: string } => {
  let removalIdentifier = params.email || params.userId;
  let itemType = params.email ? 'Invitation' : 'User';
  
  if (params.userId && params.userId !== UNKNOWN_PARAM_VALUE) {
    itemType = 'User';
    if (userInfo?.email) {
      removalIdentifier = userInfo.email; // Prefer email over ID
    }
  }
  
  return { removalIdentifier, itemType };
};

/**
 * Error handling utilities
 */

/**
 * Creates appropriate error based on context
 * @param message Error message
 * @param isInteractiveMode Whether in interactive mode
 * @param longDescription Optional command description
 * @returns Error instance
 */
export const createContextualError = (
  message: string, 
  isInteractiveMode: boolean = false,
  longDescription?: string
): Error => {
  if (isInteractiveMode) {
    return new AppcircleExitError(message, 1);
  }
  
  if (longDescription) {
    console.error(`\n${longDescription}\n`);
  }
  
  return new AppcircleExitError(message, 1);
};

/**
 * Variable group ID extraction utility
 * @param variableGroupId Raw variable group ID that may have formatting
 * @returns Clean variable group ID
 */
export const extractVariableGroupId = (variableGroupId: string): string => {
  if (!variableGroupId) return variableGroupId;
  
  // Clean up variableGroupId if it has extra formatting like "name (id)"
  const match = /\(([^)]+)\)$/.exec(variableGroupId);
  if (match && match[1]) {
    return match[1];
  }
  
  return variableGroupId;
};

/**
 * Build command specific utilities
 */

export interface BuildValidationResult {
  isValid: boolean;
  errors: string[];
  missingProfile: boolean;
  missingWorkflow: boolean;
  requiredParams: string[];
}

export interface CommandWaitResult {
  shouldWait: boolean;
  hasNoWaitFlag: boolean;
  isJsonMode: boolean;
}

export interface BuildResponseProcessingResult {
  jsonOutput?: {
    taskId: string;
    queueItemId: string;
  };
  shouldContinueMonitoring: boolean;
}

/**
 * Monitor modes for build start
 */
export enum BuildMonitorMode {
  NONE = 'none',
  SUMMARY = 'summary',
  STEPS = 'steps',
  VERBOSE = 'verbose'
}

/**
 * @deprecated Use BuildMonitorMode instead
 */
export enum BuildExecutionMode {
  NORMAL = 'normal',
  DETAILED_MONITORING = 'detailed',
  STEP_SUMMARY = 'step-summary',
  SKIP_SHOW_TASK_ID = 'skip'
}

export interface BuildMonitorModeResult {
  mode: BuildMonitorMode;
  cancelled: boolean;
}

/**
 * @deprecated Use BuildMonitorModeResult instead
 */
export interface BuildExecutionModeResult {
  mode: BuildExecutionMode;
  cancelled: boolean;
}

/**
 * Validates build start command parameters
 * Pure function - easily testable
 */
export const validateBuildStartParameters = (
  params: any,
  commandName: string
): BuildValidationResult => {
  const errors: string[] = [];
  const missingProfile = !params.profileId && !params.profile;
  const missingWorkflow = !params.workflowId && !params.workflow;
  
  if (commandName === `${PROGRAM_NAME}-build-start`) {
    if (missingProfile) {
      errors.push('Build profile is required. Use --profileId or --profile parameter.');
    }
    if (missingWorkflow) {
      errors.push('Workflow is required. Use --workflowId or --workflow parameter.');
    }
  }
  
  return {
    isValid: errors.length === 0,
    errors,
    missingProfile,
    missingWorkflow,
    requiredParams: ['profileId', 'workflowId'].filter(param => 
      (param === 'profileId' && missingProfile) || 
      (param === 'workflowId' && missingWorkflow)
    )
  };
};

/**
 * Determines if build should wait for completion based on command line args
 * Pure function - easily testable
 */
export const determineBuildWaitBehavior = (
  processArgv: string[],
  consoleOutputType: string
): CommandWaitResult => {
  const hasNoWaitFlag = processArgv.includes('--no-wait');
  const shouldWait = !hasNoWaitFlag;
  const isJsonMode = consoleOutputType === 'json';
  
  return {
    shouldWait,
    hasNoWaitFlag,
    isJsonMode
  };
};

/**
 * Processes build response for immediate return scenarios
 * Pure function - easily testable
 */
export const processBuildResponseForImmediateReturn = (
  responseData: any,
  shouldWait: boolean,
  isJsonMode: boolean
): BuildResponseProcessingResult => {
  if (shouldWait) {
    return {
      shouldContinueMonitoring: true
    };
  }
  
  // --no-wait flag is specified, return immediately
  if (isJsonMode) {
    return {
      jsonOutput: {
        taskId: responseData.taskId,
        queueItemId: responseData.queueItemId
      },
      shouldContinueMonitoring: false
    };
  }
  
  // Plain text mode with --no-wait
  return {
    shouldContinueMonitoring: false
  };
};

/**
 * Validates publish platform parameter
 * Pure function - easily testable
 */
export const validatePublishPlatform = (params: any): { isValid: boolean; errors: string[]; normalizedPlatform?: string } => {
  if (!params.platform) {
    return { isValid: true, errors: [] }; // Platform is optional in some cases
  }
  
  const platform = params.platform.toLowerCase();
  const validPlatforms = ['ios', 'android'];
  
  if (!validPlatforms.includes(platform)) {
    return {
      isValid: false,
      errors: [`Invalid platform(${params.platform}). Supported platforms: ${validPlatforms.join(', ')}`]
    };
  }
  
  return { 
    isValid: true, 
    errors: [], 
    normalizedPlatform: platform 
  };
};

/**
 * Validates file size for upload
 * Pure function - easily testable
 */
export const validateFileSizeForUpload = (
  filePath: string,
  maxBytes: number | null = null,
  fileSystem = { statSync: fs.statSync }
): { isValid: boolean; stats: any; maxBytes: number | null; error?: string } => {
  const stats = fileSystem.statSync(filePath);
  
  if (maxBytes && stats.size > maxBytes) {
    const fileSizeGB = (stats.size / (1024 * 1024 * 1024)).toFixed(2);
    const maxSizeGB = (maxBytes / (1024 * 1024 * 1024)).toFixed(2);
    
    return {
      isValid: false,
      stats,
      maxBytes,
      error: `File size ${fileSizeGB} GB exceeds the allowed limit of ${maxSizeGB} GB.`
    };
  }
  
  return {
    isValid: true,
    stats,
    maxBytes
  };
};

/**
 * Generates artifact filename with timestamp
 * Pure function - easily testable
 */
export const generateArtifactFileName = (prefix: string = 'artifacts'): string => {
  const timestamp = Date.now();
  return `${prefix}-${timestamp}.zip`;
};

/**
 * Decodes JWT token payload
 * Pure function - easily testable
 */
export const decodeJwtToken = (token: string): any | null => {
  if (!token || typeof token !== 'string') {
    return null;
  }
  
  const parts = token.split('.');
  if (parts.length !== 3) {
    return null;
  }
  
  try {
    const payload = parts[1];
    const decoded = Buffer.from(payload, 'base64').toString('utf-8');
    return JSON.parse(decoded);
  } catch (error) {
    return null;
  }
};

/**
 * Validates organization access based on JWT token
 * Pure function - easily testable
 */
export const validateOrganizationId = (
  params: any, 
  responseData: any
): boolean => {
  if (!params['organization-id']) {
    return true; // No organization ID specified
  }
  
  if (!responseData.access_token) {
    return true; // No token to validate against
  }
  
  const decodedToken = decodeJwtToken(responseData.access_token);
  if (!decodedToken) {
    return true; // Cannot decode token
  }
  
  if (decodedToken.currentOrganizationId !== params['organization-id']) {
    console.error(`Login failed: Your API Key does not have access to organization "${params['organization-id']}".`);
    return false;
  }
  
  return true;
};

/**
 * Checks if user is already logged in
 * Pure function with dependency injection - testable
 */
export const checkIfUserAlreadyLoggedIn = (
  configService = { 
    get: (key: string) => require('../../config').default.get(key),
    has: (key: string) => require('../../config').default.has(key)
  }
): boolean => {
  return configService.has('AC_ACCESS_TOKEN') && !!configService.get('AC_ACCESS_TOKEN');
};

/**
 * Checks if user is logged in (similar to above but different usage)
 * Pure function with dependency injection - testable
 */
export const checkIfUserIsLoggedIn = (
  configService = { 
    get: (key: string) => require('../../config').default.get(key),
    has: (key: string) => require('../../config').default.has(key)
  }
): boolean => {
  return configService.has('AC_ACCESS_TOKEN') && !!configService.get('AC_ACCESS_TOKEN');
};

/**
 * Prompts user to select monitor mode for build start
 * Supports dependency injection for testing
 */
export const selectBuildMonitorMode = async (
  createPrompt = (name: string, message: string, choices: string[]) => {
    const { AutoComplete } = require('enquirer');
    return new AutoComplete({
      name,
      message,
      choices,
      limit: 10
    });
  }
): Promise<BuildMonitorModeResult> => {
  const choices = [
    'None - No monitoring, just return Task/Build ID and exit',
    'Summary - Wait until completion, show final status + total duration in one line',
    'Steps - Wait until completion, show step-by-step progress (started/finished) minimally',
    'Verbose - Wait until completion, stream detailed logs line by line in real-time'
  ];

  try {
    const selectPrompt = createPrompt(
      'monitorMode',
      'Select build monitoring preference:',
      choices
    );
    
    const selected = await selectPrompt.run();
    
    // Parse the selection
    if (selected.includes('None')) {
      return { mode: BuildMonitorMode.NONE, cancelled: false };
    } else if (selected.includes('Summary')) {
      return { mode: BuildMonitorMode.SUMMARY, cancelled: false };
    } else if (selected.includes('Steps')) {
      return { mode: BuildMonitorMode.STEPS, cancelled: false };
    } else if (selected.includes('Verbose')) {
      return { mode: BuildMonitorMode.VERBOSE, cancelled: false };
    } else {
      // Default to summary if parsing fails
      return { mode: BuildMonitorMode.SUMMARY, cancelled: false };
    }
  } catch (error) {
    // User cancelled or error occurred
    return { mode: BuildMonitorMode.SUMMARY, cancelled: true };
  }
};

/**
 * @deprecated Use selectBuildMonitorMode instead
 */
export const selectBuildExecutionMode = async (
  createPrompt = (name: string, message: string, choices: string[]) => {
    const { AutoComplete } = require('enquirer');
    return new AutoComplete({
      name,
      message,
      choices,
      limit: 10
    });
  }
): Promise<BuildExecutionModeResult> => {
  const choices = [
    'Summary only - Real-time build status and duration',
    'Step-by-step - Real-time progress for each build step',
    'Full logs - Real-time verbose build output streaming',
    'Task ID only - No monitoring, returns task ID for async tracking'
  ];

  try {
    const selectPrompt = createPrompt(
      'executionMode',
      'Select build monitoring preference:',
      choices
    );
    
    const selected = await selectPrompt.run();
    
    // Parse the selection
    if (selected.includes('Summary only')) {
      return { mode: BuildExecutionMode.NORMAL, cancelled: false };
    } else if (selected.includes('Step-by-step')) {
      return { mode: BuildExecutionMode.STEP_SUMMARY, cancelled: false };
    } else if (selected.includes('Full logs')) {
      return { mode: BuildExecutionMode.DETAILED_MONITORING, cancelled: false };
    } else if (selected.includes('Task ID only')) {
      return { mode: BuildExecutionMode.SKIP_SHOW_TASK_ID, cancelled: false };
    } else {
      // Default to normal if parsing fails
      return { mode: BuildExecutionMode.NORMAL, cancelled: false };
    }
  } catch (error) {
    // User cancelled or error occurred
    return { mode: BuildExecutionMode.NORMAL, cancelled: true };
  }
};

/**
 * Build status constants for better readability
 */
export const BuildStatus = {
  SUCCESS: 0,
  FAILED: 1,
  CANCELED: 2,
  TIMEOUT: 3,
  WAITING: 90,
  RUNNING: 91,
  COMPLETING: 92
} as const;

/**
 * Determines if a build status indicates failure
 * @param buildStatus The build status code
 * @returns True if the build failed, canceled, or timed out
 */
export const isBuildFailed = (buildStatus: number | null | undefined): boolean => {
  return buildStatus === BuildStatus.FAILED || 
         buildStatus === BuildStatus.CANCELED || 
         buildStatus === BuildStatus.TIMEOUT;
};

/**
 * Determines if a build status indicates success
 * @param buildStatus The build status code
 * @returns True if the build succeeded
 */
export const isBuildSuccessful = (buildStatus: number | null | undefined): boolean => {
  return buildStatus === BuildStatus.SUCCESS;
};

/**
 * Determines if build status is unknown or unavailable
 * @param buildStatus The build status code
 * @returns True if build status is null, undefined, or unknown
 */
export const isBuildStatusUnknown = (buildStatus: number | null | undefined): boolean => {
  return buildStatus === null || buildStatus === undefined;
};

/**
 * Generates appropriate artifact download error message based on build status
 * @param buildStatus The build status code
 * @param originalError The original error message
 * @param buildId Optional build ID for context
 * @param hasWarning Optional warning flag to provide more context
 * @returns User-friendly error message
 */
export const generateArtifactErrorMessage = (
  buildStatus: number | null | undefined,
  originalError: string,
  buildId?: string,
  hasWarning?: boolean
): string => {
  // If build actually failed, keep the original message
  if (isBuildFailed(buildStatus)) {
    return `Cannot download artifact since the build failed: ${originalError}`;
  }
  
  // If build succeeded but no artifacts found
  if (isBuildSuccessful(buildStatus)) {
    if (hasWarning) {
      return 'Build completed with warnings, but no artifacts were found.';
    }
    return 'Build succeeded, but no artifacts were found.';
  }
  
  // If build status is unknown and no artifacts found
  if (isBuildStatusUnknown(buildStatus)) {
    return 'No artifacts were found for this build.';
  }
  
  // Fallback to original message for any other status
  return `Cannot download artifact since the build failed: ${originalError}`;
};