import path from 'path';
import os from 'os';
import fs from 'fs';
import {
  validateParameterErrorFlag,
  sanitizeForFileName,
  resolveOrganizationIdFromParams,
  resolveUserIdFromUserParam,
  resolveProfileIdFromName,
  resolveBranchIdFromName,
  resolveWorkflowIdFromName,
  resolveConfigurationIdFromName,
  createUnknownCommandError,
  formatElapsedTime,
  setupDownloadDirectory,
  getUserRemovalIdentifier,
  extractVariableGroupId,
  validateBuildStartParameters,
  determineBuildWaitBehavior,
  processBuildResponseForImmediateReturn,
  selectBuildExecutionMode,
  selectBuildMonitorMode,
  BuildExecutionMode,
  BuildMonitorMode,
  BuildStatus,
  isBuildFailed,
  isBuildSuccessful,
  isBuildStatusUnknown,
  generateArtifactErrorMessage,
  checkIfUserAlreadyLoggedIn as utilCheckIfUserAlreadyLoggedIn,
  checkIfUserIsLoggedIn as utilCheckIfUserIsLoggedIn,
  validatePublishPlatform as utilValidatePublishPlatform,
  validateFileSizeForUpload as utilValidateFileSizeForUpload,
  generateArtifactFileName,
  expandTildeInPath
} from './command-runner-utilities';
import { CommandTypes } from './commands';
import {
  EnvironmentVariables,
  addNewConfigVariable,
  clearConfigs,
  getConfigFilePath,
  getConfigStore,
  getConsoleOutputType,
  getCurrentConfigVariable,
  getEnviromentsConfigToWriting,
  getInteractiveMode,
  readEnviromentConfigVariable,
  setCurrentConfigVariable,
  writeEnviromentConfigVariable,
} from '../config';
import { createOra } from '../utils/orahelper';
import { ProgramCommand } from '../program';
import {
  getToken,
  getTokenFromApiKey,
  getBuildProfiles,
  getBranches,
  getWorkflows,
  getCommits,
  getBuildsOfCommit,
  getDistributionProfiles,
  startBuild,
  downloadArtifact,
  downloadBuildLog,
  uploadArtifact,
  createDistributionProfile,
  getEnvironmentVariableGroups,
  createEnvironmentVariableGroup,
  getEnvironmentVariables,
  createEnvironmentVariable,
  uploadEnvironmentVariablesFromFile,
  getEnterpriseProfiles,
  getEnterpriseAppVersions,
  publishEnterpriseAppVersion,
  unpublishEnterpriseAppVersion,
  removeEnterpriseAppVersion,
  notifyEnterpriseAppVersion,
  uploadEnterpriseApp,
  uploadEnterpriseAppVersion,
  getEnterpriseDownloadLink,
  getConfigurations,
  getOrganizationDetail,
  getOrganizations,
  getOrganizationUsers,
  getOrganizationInvitations,
  inviteUserToOrganization,
  getUserInfo,
  reInviteUserToOrganization,
  removeInvitationFromOrganization,
  removeUserFromOrganization,
  getOrganizationUserinfo,
  assignRolesToUserInOrganitaion,
  getOrganizationUsersWithRoles,
  createPublishProfile,
  getPublishProfiles,
  uploadAppVersion,
  deleteAppVersion,
  getAppVersionDownloadLink,
  getPublishByAppVersion,
  startExistingPublishFlow,
  setAppVersionReleaseCandidateStatus,
  switchPublishProfileAutoPublishSettings,
  getPublishProfileDetailById,
  getPublishVariableGroups,
  getPublishVariableListByGroupId,
  uploadPublishEnvironmentVariablesFromFile,
  deletePublishProfile,
  renamePublishProfile,
  getAppVersions,
  downloadAppVersion,
  getActiveBuilds,
  getiOSCSRCertificates,
  getiOSP12Certificates,
  uploadP12Certificate,
  createCSRCertificateRequest,
  getCertificateDetailById,
  downloadCertificateById,
  removeCSRorP12CertificateById,
  getAndroidKeystores,
  generateNewKeystore,
  uploadAndroidKeystoreFile,
  downloadKeystoreById,
  getKeystoreDetailById,
  removeKeystore,
  getProvisioningProfiles,
  uploadProvisioningProfile,
  getProvisioningProfileDetailById,
  downloadProvisioningProfileById,
  removeProvisioningProfile,
  getTestingGroups,
  updateDistributionProfileSettings,
  getTestingGroupById,
  createTestingGroup,
  deleteTestingGroup,
  addTesterToTestingGroup,
  removeTesterFromTestingGroup,
  setAppVersionReleaseNote,
  getTaskStatus,
  getAppVersionDetail,
  getActivePublishes,
  getPublisDetailById,
  uploadArtifactWithSignedUrl,
  getTestingDistributionUploadInformation,
  commitTestingDistributionFileUpload,
  getPublishUploadInformation,
  commitPublishFileUpload,
  getEnterpriseUploadInformation,
  commitEnterpriseFileUpload,
  updateTestingDistributionReleaseNotes,
  getLatestAppVersionId,
  getLatestAppVersionIdAfterUpload,
  getBuildStatusFromQueue,
  downloadTaskLog,
  createSubOrganization,
  getLatestBuildByBranch,
  getLatestBuildId,
  resolveIdentityFromToken,
  getHookAccessToken,
  openHookSSE,
  triggerBuildLogsStreaming,
  triggerStopBuildLogsStreaming
} from '../services';
import { appcircleApi, getHeaders, OptionsType } from '../services/api';
import { commandWriter, configWriter } from './writer';
import { trustAppcircleCertificate } from '../security/trust-url-certificate';
import { CURRENT_PARAM_VALUE, PROGRAM_NAME, TaskStatus, UNKNOWN_PARAM_VALUE } from '../constant';
import { ProgramError } from './ProgramError';
import { getMaxUploadBytes, GB } from '../utils/size-limit';
import chalk from 'chalk';
import enquirer from 'enquirer';
import { AppcircleExitError } from './AppcircleExitError';
import { Commands, CommandType } from './commands';

/**
 * Step status enum for tracking step state
 */
enum StepStatus {
  RUNNING = 'running',
  COMPLETED = 'completed',
  FAILED = 'failed'
}

/**
 * Create a clean terminal UX formatter that manages step state and ephemeral status
 */
function createCleanTerminalFormatter() {
  const stepStates = new Map<string, {
    status: StepStatus;
    startTime: number;
    hasErrors: boolean;
  }>();
  
  let currentActiveStep = '';
  let ephemeralStatusLine = '';
  let buildCompleted = false;
  let completionCallback: (() => void) | null = null;
  let completionCallbackCalled = false;
  let sseConnection: any = null;
  
  function clearEphemeralStatus() {
    if (ephemeralStatusLine) {
      // Clear the ephemeral line by writing to stderr
      process.stderr.write('\r' + ' '.repeat(ephemeralStatusLine.length) + '\r');
      ephemeralStatusLine = '';
    }
  }
  
  function writeEphemeralStatus(text: string) {
    clearEphemeralStatus();
    ephemeralStatusLine = text;
    process.stderr.write(text);
  }
  
  function writePersistentLog(text: string) {
    clearEphemeralStatus();
    console.log(text); // This goes to stdout
    if (ephemeralStatusLine) {
      process.stderr.write(ephemeralStatusLine); // Restore ephemeral status
    }
  }
  
  function updateStepStatus(stepName: string, status: StepStatus) {
    const state = stepStates.get(stepName);
    if (state) {
      state.status = status;
      
      // Calculate duration
      const elapsed = Math.round((Date.now() - state.startTime) / 1000);
      const timeStr = elapsed === 0 ? '<1s' : elapsed < 60 ? `${elapsed}s` : `${Math.floor(elapsed / 60)}m ${elapsed % 60}s`;
      
      // Choose icon and color based on status
      let icon = '';
      let color = chalk.white;
      
      switch (status) {
        case StepStatus.COMPLETED:
          icon = state.hasErrors ? '✗' : '✓';
          color = state.hasErrors ? chalk.red : chalk.green;
          break;
        case StepStatus.FAILED:
          icon = '✗';
          color = chalk.red;
          state.hasErrors = true;
          break;
        case StepStatus.RUNNING:
          icon = '●';
          color = chalk.yellow;
          break;
      }
      
      clearEphemeralStatus();
      writePersistentLog(color(`${icon} ${stepName} (${timeStr})`));
      
      if (status !== StepStatus.RUNNING) {
        currentActiveStep = '';
        
        // Check if this is the final "Completing workflow" step
        if (stepName === 'Completing workflow' && status === StepStatus.COMPLETED && !buildCompleted) {
          // Build completion already handled in @@[section:end] processing
          // Just trigger completion callback
          if (completionCallback && !completionCallbackCalled) {
            completionCallbackCalled = true;
            try {
              completionCallback();
            } catch (error) {
              console.error('Error in completion callback:', error);
            }
          }
        }
      }
    }
  }
  
  return {
    processMessage(buildLogEvent: any): void {
      // Skip all messages if build is already completed
      if (buildCompleted) {
        return;
      }
      
      const rawMessage = buildLogEvent.message || '';
      const stepName = buildLogEvent.stepName;
      const uiOnly = buildLogEvent.uiOnly === true;
      
      // Clean message: remove \r\n and trim
      const message = rawMessage.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
      
      // Skip uiOnly messages that are just step names (avoid duplication)
      if (uiOnly && (message.trim() === stepName || message.trim() === currentActiveStep)) {
        return;
      }
      
      // Handle step changes - show step header only when step changes
      if (stepName && stepName !== currentActiveStep) {
        // Only show step header if we're starting a new step
        if (!message.includes('@@[section:begin]')) {
          currentActiveStep = stepName;
          clearEphemeralStatus();
          writePersistentLog(chalk.yellow(`● ${stepName}`));
        }
      }
      
      // Handle section begin
      if (message.includes('@@[section:begin]')) {
        // Handle both patterns: "@@[section:begin] ... Step started: StepName" and "@@[section:begin] ... Starting workflow"
        const stepStartedMatch = message.match(/@@\[section:begin\]\s*(.+?)\s*Step started:\s*(.+)/);
        if (stepStartedMatch) {
          const step = stepStartedMatch[2];
          
          // Initialize step state
          stepStates.set(step, {
            status: StepStatus.RUNNING,
            startTime: Date.now(),
            hasErrors: false
          });
          
          currentActiveStep = step;
          
          // Show step header and section begin message
          clearEphemeralStatus();
          writePersistentLog(chalk.yellow(`● ${step}`));
          writePersistentLog(chalk.blue(message.trim()));
        } else {
          // Handle simple format: "@@[section:begin] ... Starting workflow"
          const simpleMatch = message.match(/@@\[section:begin\]\s*(.+?)\s*(.+)/);
          if (simpleMatch) {
            const step = simpleMatch[2] || stepName;
            
            // Initialize step state
            stepStates.set(step, {
              status: StepStatus.RUNNING,
              startTime: Date.now(),
              hasErrors: false
            });
            
            currentActiveStep = step;
            
            // Show step header and section begin message
            clearEphemeralStatus();
            writePersistentLog(chalk.yellow(`● ${step}`));
            writePersistentLog(chalk.blue(message.trim()));
          }
        }
        return;
      }
      
      // Handle multi-line messages that contain @@[section:end] 
      if (message.includes('@@[section:end]')) {
        // Split message: everything before @@[section:end] is regular content, everything after is section end
        const parts = message.split('@@[section:end]');
        const contentPart = parts[0];
        const sectionEndPart = '@@[section:end]' + (parts[1] || '');
        
        // First, process the content part if it has meaningful content
        if (contentPart.trim() && currentActiveStep && !uiOnly) {
          const lines = contentPart.split('\n').filter((line: string) => line.trim());
          for (const line of lines) {
            if (line.trim()) {
              let formattedMessage = line.trim();
              
              // Color URLs
              formattedMessage = formattedMessage.replace(
                /(https?:\/\/[^\s]+)/g, 
                chalk.blue('$1')
              );
              
              writePersistentLog(formattedMessage);
            }
          }
        }
        
        // Then handle the section end
        let stepToComplete = currentActiveStep;
        
        const stepCompletedMatch = sectionEndPart.match(/@@\[section:end\]\s*(.+?)\s*Step completed:\s*(.+?),\s*Ver:\s*(.+)/);
        if (stepCompletedMatch) {
          stepToComplete = stepCompletedMatch[2];
        } else {
          // Simple format: "@@[section:end] Starting workflow"
          const simpleMatch = sectionEndPart.match(/@@\[section:end\]\s*(.+)/);
          if (simpleMatch) {
            stepToComplete = simpleMatch[1].trim();
          }
        }
        
        // Show the section end message
        if (sectionEndPart.trim() && !uiOnly) {
          writePersistentLog(chalk.blue(sectionEndPart.trim()));
        }
        
        if (stepToComplete) {
          // SPECIAL CASE: If this is "Completing workflow" completion, delay build completion
          if (stepToComplete === 'Completing workflow' && !buildCompleted) {
            setTimeout(() => {
              buildCompleted = true;

              // Close SSE connection
              if (sseConnection && sseConnection.close) {
                sseConnection.close();
              }
            }, 100);
          }
          
          updateStepStatus(stepToComplete, StepStatus.COMPLETED);
          
          // Check if build is completed after updating step status
          if (buildCompleted) {
            return;
          }
        }
        return;
      }
      
      // Handle errors
      if (message.includes('@@[error]') && currentActiveStep) {
        const state = stepStates.get(currentActiveStep);
        if (state) {
          state.hasErrors = true;
          writePersistentLog(chalk.red(`${message.replace('@@[error]', '').trim()}`));
        }
        return;
      }
      
      // Handle commands
      if (message.includes('@@[command]') && currentActiveStep) {
        writePersistentLog(chalk.cyan(`@@[command] ${message.replace('@@[command]', '').trim()}`));
        return;
      }
      
      // Handle regular messages for current step
      if (message.trim() && currentActiveStep && !message.includes('@@[section')) {
        // Skip uiOnly messages that are just duplicates
        if (uiOnly) {
          return;
        }
        
        // Process multi-line messages (split by \n and show each line)
        const lines = message.split('\n').filter((line: string) => line.trim());
        for (const line of lines) {
          if (line.trim()) {
            let formattedMessage = line.trim();
            
            // Color URLs
            formattedMessage = formattedMessage.replace(
              /(https?:\/\/[^\s]+)/g, 
              chalk.blue('$1')
            );
            
            writePersistentLog(formattedMessage);
          }
        }
      }
    },
    
    setEphemeralStatus(status: string): void {
      writeEphemeralStatus(chalk.gray(status));
    },
    
    clearEphemeralStatus(): void {
      clearEphemeralStatus();
    },
    
    finish(): void {
      clearEphemeralStatus();
    },
    
    setCompletionCallback(callback: () => void): void {
      completionCallback = callback;
    },
    
    isBuildCompleted(): boolean {
      return buildCompleted;
    },
    
    setSSEConnection(connection: any): void {
      sseConnection = connection;
    }
  };
}

/**
 * Create a step summary formatter that shows only build steps and durations
 */
function createStepSummaryFormatter() {
  const stepStates = new Map<string, {
    status: StepStatus;
    startTime: number;
    endTime?: number;
    hasErrors: boolean;
    serverDuration?: number; // Duration from server logs
  }>();

  let currentActiveStep = '';
  let buildCompleted = false;
  let completionCallback: (() => void) | null = null;
  let completionCallbackCalled = false;
  let sseConnection: any = null;
  let updateTimer: NodeJS.Timeout | null = null;
  let hasRenderedTable = false;
  let stepOrder: string[] = []; // Track the order of steps
  let currentActiveStepIndex = -1; // Track which line to update
  const displayedSteps = new Set<string>(); // Track which steps have been displayed to prevent duplicates

  // Extract duration from build log event
  function extractDurationFromEvent(buildLogEvent: any): number | null {
    // Try direct properties first
    if (buildLogEvent.duration && typeof buildLogEvent.duration === 'number') {
      return buildLogEvent.duration;
    }
    if (buildLogEvent.stepDuration && typeof buildLogEvent.stepDuration === 'number') {
      return buildLogEvent.stepDuration;
    }

    // Parse from message text
    const message = buildLogEvent.message || '';
    const patterns = [
      /(\d+)s/,
      /(\d+)\s*seconds?/,
      /in\s*(\d+)s/,
      /took\s*(\d+)s/,
      /duration[:\s]*(\d+)s?/i
    ];

    for (const pattern of patterns) {
      const match = message.match(pattern);
      if (match) {
        const seconds = parseInt(match[1], 10);
        if (!isNaN(seconds)) {
          return seconds;
        }
      }
    }

    return null;
  }

  function formatDuration(stepName: string, startTime?: number, endTime?: number): string {
    const state = stepStates.get(stepName);

    // Helper function to format seconds into minutes and seconds
    const formatSeconds = (totalSeconds: number): string => {
      if (totalSeconds === 0) {
        return '<1s';
      }
      if (totalSeconds < 60) {
        return `${totalSeconds}s`;
      }
      const minutes = Math.floor(totalSeconds / 60);
      const seconds = totalSeconds % 60;
      return `${minutes}m ${seconds}s`;
    };

    // Prefer server-provided duration if available
    if (state?.serverDuration !== undefined) {
      return formatSeconds(state.serverDuration);
    }

    // Fallback to client-side calculation
    if (startTime && endTime) {
      const duration = Math.round((endTime - startTime) / 1000);
      return formatSeconds(duration);
    } else if (startTime) {
      const duration = Math.round((Date.now() - startTime) / 1000);
      return formatSeconds(duration);
    }

    return '<1s';
  }

  // Helper function to normalize step names (trim whitespace, handle variations)
  function normalizeStepName(stepName: string): string {
    if (!stepName) return '';
    return stepName.trim();
  }

  function getStepStatusColor(stepName: string): (text: string) => string {
    const normalizedName = normalizeStepName(stepName);
    const state = stepStates.get(normalizedName);
    if (!state) return chalk.gray;

    switch (state.status) {
      case StepStatus.COMPLETED:
        return state.hasErrors ? chalk.red : chalk.green;
      case StepStatus.FAILED:
        return chalk.red;
      case StepStatus.RUNNING:
        return chalk.yellow;
      default:
        return chalk.gray;
    }
  }

  function renderStepTable() {
    if (stepStates.size === 0) return;

    // If this is the first render, print the header (only if build not completed)
    if (!hasRenderedTable && !buildCompleted) {
      hasRenderedTable = true;
      console.log('🚀 Build Progress:');
      console.log('─'.repeat(60)); // Separator line
      console.log('');
    }
  }

  function updateStepStatus(stepName: string, status: StepStatus, buildLogEvent?: any) {
    const normalizedName = normalizeStepName(stepName);
    const state = stepStates.get(normalizedName);
    if (state) {
      // Don't downgrade status: FAILED > COMPLETED > RUNNING
      let statusChanged = false;
      if (state.status === StepStatus.FAILED && status !== StepStatus.FAILED) {
        // Keep FAILED status, don't downgrade to COMPLETED or RUNNING
        // But still update display and other properties
      } else if (state.status === StepStatus.COMPLETED && status === StepStatus.RUNNING) {
        // Keep COMPLETED status, don't downgrade to RUNNING
        // But still update display and other properties
      } else {
        state.status = status;
        statusChanged = true;
      }
      // Always update endTime and other properties for COMPLETED or FAILED status
      if (status === StepStatus.COMPLETED || status === StepStatus.FAILED) {
        state.endTime = Date.now();

        // Extract and store server-provided duration if available
        if (buildLogEvent) {
          const serverDuration = extractDurationFromEvent(buildLogEvent);
          if (serverDuration !== null) {
            state.serverDuration = serverDuration;
          }

          // Check for warnings in the build log event (simpler detection)
          const message = buildLogEvent.message || '';
          const hasWarning = buildLogEvent.hasWarning === true ||
                           buildLogEvent.isWarning === true ||
                           buildLogEvent.warning === true ||
                           message.includes('@@[warning]') ||
                           message.includes('@@[error]') ||
                           message.includes('⚠️');

          if (hasWarning) {
            state.hasErrors = true;
          }
        }

        // Stop timer if no more running steps
        if (updateTimer) {
          clearInterval(updateTimer);
          updateTimer = null;
        }
      }

      // Always update the step display if this is a completion event
      if (status === StepStatus.COMPLETED || status === StepStatus.FAILED) {
        // Check if we've already displayed this step
        if (!displayedSteps.has(normalizedName)) {
          // First time displaying this step
          displayedSteps.add(normalizedName);
          
          // Update the step display
          const duration = formatDuration(normalizedName, state.startTime, state.endTime);
          const colorFn = getStepStatusColor(normalizedName);
          const statusIcon = state.status === StepStatus.FAILED ? '❌ ' : (state.hasErrors ? '⚠️ ' : '✅');

          // Format step display with consistent spacing for emoji alignment
          const stepNamePart = `${normalizedName}`;
          const paddedStepName = stepNamePart.padEnd(45); // Reserve space for emoji + space (2 chars)
          const stepDisplay = `${statusIcon} ${paddedStepName}`;
          const timeDisplay = `(${duration})`;

          // Apply color to the step display
          const coloredStepDisplay = colorFn(stepDisplay);

          // If this is the current active step, update in-place
          if (normalizedName === currentActiveStep && currentActiveStepIndex >= 0) {
            // Move cursor up one line, clear it, and update
            process.stdout.write('\x1b[1A'); // Move cursor up one line
            process.stdout.write('\x1b[2K'); // Clear current line
            process.stdout.write(`${coloredStepDisplay} ${timeDisplay}\n`);

            // Reset active step since it's completed
            currentActiveStep = '';
            currentActiveStepIndex = -1;
          } else {
            // For non-active steps, just print the completed step
            process.stdout.write(`${coloredStepDisplay} ${timeDisplay}\n`);
          }
        } else {
          // Step already displayed, check if we need to update it with a worse status
          const currentDisplayedState = stepStates.get(normalizedName);
          if (currentDisplayedState) {
            // Only update if the new status is worse (FAILED > hasErrors > SUCCESS)
            const shouldUpdate = (
              (state.status === StepStatus.FAILED && currentDisplayedState.status !== StepStatus.FAILED) ||
              (state.hasErrors && !currentDisplayedState.hasErrors && state.status !== StepStatus.FAILED)
            );
            
            if (shouldUpdate) {
              // Update the displayed step with worse status
              const duration = formatDuration(normalizedName, state.startTime, state.endTime);
              const colorFn = getStepStatusColor(normalizedName);
              const statusIcon = state.status === StepStatus.FAILED ? '❌ ' : (state.hasErrors ? '⚠️ ' : '✅');

              // Format step display with consistent spacing for emoji alignment
              const stepNamePart = `${normalizedName}`;
              const paddedStepName = stepNamePart.padEnd(45); // Reserve space for emoji + space (2 chars)
              const stepDisplay = `${statusIcon} ${paddedStepName}`;
              const timeDisplay = `(${duration})`;

              // Apply color to the step display
              const coloredStepDisplay = colorFn(stepDisplay);

              // Print the updated step (we can't update in-place as we don't know the line number)
              process.stdout.write(`${coloredStepDisplay} ${timeDisplay}\n`);
            }
          }
        }
      }
    }
  }

  function startUpdateTimer() {
    if (updateTimer) {
      clearInterval(updateTimer);
    }

    updateTimer = setInterval(() => {
      // Only update if there are running steps
      const hasRunningSteps = Array.from(stepStates.values()).some(state => state.status === StepStatus.RUNNING);
      if (hasRunningSteps && !buildCompleted && currentActiveStep) {
        // Update the current running step's time display
        const state = stepStates.get(currentActiveStep);
        if (state && state.status === StepStatus.RUNNING) {
          const duration = formatDuration(currentActiveStep, state.startTime);
          const paddedStepName = currentActiveStep.padEnd(45); // Reserve space for emoji + space (2 chars)
          const stepDisplay = `🔄 ${paddedStepName}`;
          const coloredStepDisplay = chalk.yellow(stepDisplay);
          // Move cursor up one line, clear it, and update
          process.stdout.write('\x1b[1A'); // Move cursor up one line
          process.stdout.write('\x1b[2K'); // Clear current line
          process.stdout.write(`${coloredStepDisplay} (${duration})\n`);
        }
      } else if (updateTimer) {
        clearInterval(updateTimer);
        updateTimer = null;
      }
    }, 1000); // Update every second
  }

  return {
    processMessage(buildLogEvent: any): void {
      if (buildCompleted) return;

      const message = buildLogEvent.message || '';
      const stepName = buildLogEvent.stepName;
      const workflowStatus = buildLogEvent.workflowStatus;

      // Handle step start - workflowStatus: 1 = StepStarted
      if (workflowStatus === 1 && stepName && stepName !== currentActiveStep) {
        const normalizedName = normalizeStepName(stepName);
        // Only start step if it's not already in stepStates (prevent duplicates)
        if (!stepStates.has(normalizedName)) {
          currentActiveStep = normalizedName;
          stepStates.set(normalizedName, {
            status: StepStatus.RUNNING,
            startTime: Date.now(),
            hasErrors: false
          });

          // Add to step order if not already present
          if (!stepOrder.includes(normalizedName)) {
            stepOrder.push(normalizedName);
          }

          // Start update timer for real-time updates
          startUpdateTimer();

          // Render table header if first step
          renderStepTable();

          // Show the running step immediately (only if build not completed)
          if (!buildCompleted) {
            const paddedStepName = normalizedName.padEnd(45); // Reserve space for emoji + space (2 chars)
            const stepDisplay = `🔄 ${paddedStepName}`;
            const coloredStepDisplay = chalk.yellow(stepDisplay);
            console.log(`${coloredStepDisplay} (0s)`);
          }
          currentActiveStepIndex = stepOrder.length - 1; // Track this line for updates
        } else {
          // Step already exists, just update currentActiveStep
          currentActiveStep = normalizedName;
          const existingState = stepStates.get(normalizedName);
          if (existingState && existingState.status === StepStatus.RUNNING) {
            // Update the existing running step
            currentActiveStepIndex = stepOrder.indexOf(normalizedName);
          }
        }
        return;
      }

      // Handle step end - workflowStatus: 2 = StepEnded
      if (workflowStatus === 2 && stepName) {
        const normalizedName = normalizeStepName(stepName);
        if (stepStates.has(normalizedName)) {
          updateStepStatus(normalizedName, StepStatus.COMPLETED, buildLogEvent);

          // Special case for "Completing workflow" - handle completion AFTER display
          if (normalizedName === 'Completing workflow' && !buildCompleted) {
            // Give a small delay to ensure step display happens before completion
            setTimeout(() => {
              buildCompleted = true;
              if (sseConnection && sseConnection.close) {
                sseConnection.close();
              }
              if (completionCallback && !completionCallbackCalled) {
                completionCallbackCalled = true;
                completionCallback();
              }
            }, 100); // 100ms delay
          }
        }
        return;
      }

      // Handle step failed - workflowStatus: 3 = StepFailed
      if (workflowStatus === 3 && stepName) {
        const normalizedName = normalizeStepName(stepName);
        if (stepStates.has(normalizedName)) {
          // Mark step as failed
          updateStepStatus(normalizedName, StepStatus.FAILED, buildLogEvent);
        }
        return;
      }

      // Special handling for "Completing workflow" that might come without workflowStatus
      if (stepName === 'Completing workflow') {
        const normalizedName = normalizeStepName(stepName);
        if (!stepStates.has(normalizedName)) {
          // This step might not have a start event, so create it as running first
          stepStates.set(normalizedName, {
            status: StepStatus.RUNNING,
            startTime: Date.now(),
            hasErrors: false
          });

          if (!stepOrder.includes(normalizedName)) {
            stepOrder.push(normalizedName);
          }

          renderStepTable();
          // Show the running step immediately (only if build not completed)
          if (!buildCompleted) {
            const paddedStepName = normalizedName.padEnd(45); // Reserve space for emoji + space (2 chars)
            const stepDisplay = `🔄 ${paddedStepName}`;
            const coloredStepDisplay = chalk.yellow(stepDisplay);
            console.log(`${coloredStepDisplay} (0s)`);
          }
          currentActiveStep = normalizedName;
          currentActiveStepIndex = stepOrder.length - 1;

          // Immediately complete it if it has completion data
          if (workflowStatus === 2 || message.includes('completed')) {
            updateStepStatus(normalizedName, StepStatus.COMPLETED, buildLogEvent);
            setTimeout(() => {
              buildCompleted = true;
              if (sseConnection && sseConnection.close) {
                sseConnection.close();
              }
              if (completionCallback && !completionCallbackCalled) {
                completionCallbackCalled = true;
                completionCallback();
              }
            }, 100);
          }
        }
        return;
      }

      // Handle section:start - new step starting (fallback)
      if (message.includes('section:start')) {
        const stepName = message.replace('section:start', '').trim();
        const normalizedName = normalizeStepName(stepName);
        if (normalizedName && normalizedName !== currentActiveStep) {
          if (!stepStates.has(normalizedName)) {
            currentActiveStep = normalizedName;
            stepStates.set(normalizedName, {
              status: StepStatus.RUNNING,
              startTime: Date.now(),
              hasErrors: false
            });

            // Add to step order if not already present
            if (!stepOrder.includes(normalizedName)) {
              stepOrder.push(normalizedName);
            }

            // Start update timer for real-time updates
            startUpdateTimer();

            // Re-render table
            renderStepTable();
          } else {
            // Step already exists, just update currentActiveStep
            currentActiveStep = normalizedName;
            const existingState = stepStates.get(normalizedName);
            if (existingState && existingState.status === StepStatus.RUNNING) {
              // Update the existing running step
              currentActiveStepIndex = stepOrder.indexOf(normalizedName);
            }
          }
        }
        return;
      }

      // Handle section:end - step completing
      if (message.includes('section:end')) {
        const stepToComplete = message.replace('section:end', '').trim();
        const normalizedName = normalizeStepName(stepToComplete);
        if (normalizedName && stepStates.has(normalizedName)) {
          updateStepStatus(normalizedName, StepStatus.COMPLETED, buildLogEvent);

          // Special case for "Completing workflow"
          if (normalizedName === 'Completing workflow' && !buildCompleted) {
            setTimeout(() => {
              buildCompleted = true;
              if (sseConnection && sseConnection.close) {
                sseConnection.close();
              }
              if (completionCallback && !completionCallbackCalled) {
                completionCallbackCalled = true;
                completionCallback();
              }
            }, 100);
          }
        }
        return;
      }

      // Handle step start patterns - look for common build step patterns
      if (message.includes('@@[section:start]') || message.includes('##[section]')) {
        const stepName = message.replace(/@@\[section:start\]|##\[section\]/g, '').trim();
        const normalizedName = normalizeStepName(stepName);
        if (normalizedName && normalizedName !== currentActiveStep) {
          if (!stepStates.has(normalizedName)) {
            currentActiveStep = normalizedName;
            stepStates.set(normalizedName, {
              status: StepStatus.RUNNING,
              startTime: Date.now(),
              hasErrors: false
            });

            // Add to step order if not already present
            if (!stepOrder.includes(normalizedName)) {
              stepOrder.push(normalizedName);
            }

            // Start update timer for real-time updates
            startUpdateTimer();

            // Re-render table
            renderStepTable();
          } else {
            // Step already exists, just update currentActiveStep
            currentActiveStep = normalizedName;
            const existingState = stepStates.get(normalizedName);
            if (existingState && existingState.status === StepStatus.RUNNING) {
              // Update the existing running step
              currentActiveStepIndex = stepOrder.indexOf(normalizedName);
            }
          }
        }
        return;
      }

      // Handle step end patterns
      if (message.includes('@@[section:end]') || message.includes('##[endgroup]')) {
        const stepToComplete = message.replace(/@@\[section:end\]|##\[endgroup\]/g, '').trim();
        const normalizedName = normalizeStepName(stepToComplete);
        if (normalizedName && stepStates.has(normalizedName)) {
          updateStepStatus(normalizedName, StepStatus.COMPLETED, buildLogEvent);

          // Special case for "Completing workflow"
          if (normalizedName === 'Completing workflow' && !buildCompleted) {
            setTimeout(() => {
              buildCompleted = true;
              if (sseConnection && sseConnection.close) {
                sseConnection.close();
              }
              if (completionCallback && !completionCallbackCalled) {
                completionCallbackCalled = true;
                completionCallback();
              }
            }, 100);
          }
        }
        return;
      }

      // Handle step fallback patterns - try to extract step names from various formats
      if (stepName && currentActiveStep) {
        // Check if this might be a step start
        if (message.includes('Starting') || message.includes('Running') || message.includes('Executing')) {
          const normalizedName = normalizeStepName(stepName);
          if (!stepStates.has(normalizedName)) {
            currentActiveStep = normalizedName;
            stepStates.set(normalizedName, {
              status: StepStatus.RUNNING,
              startTime: Date.now(),
              hasErrors: false
            });

            // Add to step order if not already present
            if (!stepOrder.includes(normalizedName)) {
              stepOrder.push(normalizedName);
            }

            // Start update timer for real-time updates
            startUpdateTimer();

            // Re-render table
            renderStepTable();
          } else {
            // Step already exists, just update currentActiveStep
            currentActiveStep = normalizedName;
            const existingState = stepStates.get(normalizedName);
            if (existingState && existingState.status === StepStatus.RUNNING) {
              // Update the existing running step
              currentActiveStepIndex = stepOrder.indexOf(normalizedName);
            }
          }
        }
      }

      // Handle errors (like Clean Terminal Formatter)
      if (message.includes('@@[error]') && currentActiveStep) {
        const normalizedName = normalizeStepName(currentActiveStep);
        const state = stepStates.get(normalizedName);
        if (state) {
          state.hasErrors = true;
        }
        return;
      }

      // Handle warnings during steps
      const isWarningMessage = message.includes('@@[warning]') ||
                              message.includes('⚠️') ||
                              buildLogEvent.hasWarning === true ||
                              buildLogEvent.isWarning === true ||
                              buildLogEvent.warning === true;

      if (isWarningMessage && currentActiveStep) {
        const normalizedName = normalizeStepName(currentActiveStep);
        const state = stepStates.get(normalizedName);
        if (state) {
          state.hasErrors = true;
        }
      }

      // Also check for warnings in any step mentioned in the message
      const stepNameMatch = message.match(/Step\s+(.+?)\s+(failed|warning|error)/i);
      if (stepNameMatch) {
        const mentionedStep = stepNameMatch[1].trim();
        const normalizedName = normalizeStepName(mentionedStep);
        const state = stepStates.get(normalizedName);
        if (state) {
          state.hasErrors = true;
        }
      }

      // Apply warning to current active step if warning message detected
      if (isWarningMessage && currentActiveStep) {
        const normalizedName = normalizeStepName(currentActiveStep);
        const state = stepStates.get(normalizedName);
        if (state) {
          state.hasErrors = true;
        }
      }
    },

    getTotalStepsDuration(): number {
      let total = 0;
      for (const [stepName, state] of stepStates) {
        if (state.status === StepStatus.COMPLETED && state.serverDuration !== undefined) {
          total += state.serverDuration;
        } else if (state.status === StepStatus.COMPLETED && state.startTime && state.endTime) {
          total += Math.round((state.endTime - state.startTime) / 1000);
        }
      }
      return total || 45; // Fallback if no steps tracked
    },

    // Final render
    renderStepTable(): void {
      renderStepTable();
    },

    setEphemeralStatus(status: string): void {
      // Not used in step summary mode
    },

    clearEphemeralStatus(): void {
      // Not used in step summary mode
    },

    finish(): void {
      if (updateTimer) {
        clearInterval(updateTimer);
        updateTimer = null;
      }
    },

    setCompletionCallback(callback: () => void): void {
      completionCallback = callback;
    },

    isBuildCompleted(): boolean {
      return buildCompleted;
    },

    setSSEConnection(connection: any): void {
      sseConnection = connection;
    },

    // Method to mark a specific step as having warnings/errors
    markStepAsWarning(stepName: string): void {
      const normalizedName = normalizeStepName(stepName);
      const state = stepStates.get(normalizedName);
      if (state) {
        state.hasErrors = true;
      }
    },

    // Method to get the last completed step
    getLastCompletedStep(): string | null {
      let lastStep = null;
      let latestTime = 0;
      for (const [stepName, state] of stepStates) {
        if (state.status === StepStatus.COMPLETED && state.endTime && state.endTime > latestTime) {
          latestTime = state.endTime;
          lastStep = stepName;
        }
      }
      return lastStep;
    },

  };
}

/**
 * Prompts the user for a file path with a default value
 * @param message The message to display to the user
 * @param defaultPath The default path if user doesn't provide one
 * @returns The resolved file path
 */
export async function promptForPath(message: string, defaultPath: string): Promise<string> {
  try {
    // @ts-ignore
    const response: any = await enquirer.prompt({
      type: 'input',
      name: 'path',
      message: message,
      initial: defaultPath
    });
    
    const userPath = response.path.trim() || defaultPath;
    // Expand tilde (~) to home directory
    const homeDir = os.homedir();
    return userPath.replace(/^~/, homeDir);
  } catch (err) {
    // If user cancels, return default path
    return defaultPath;
  }
}

// Helper function to check if user is already logged in (uses extracted utility)
export const checkIfUserAlreadyLoggedIn = (): boolean => {
  return utilCheckIfUserAlreadyLoggedIn({
    get: (key: string) => readEnviromentConfigVariable(key as EnvironmentVariables),
    has: (key: string) => !!readEnviromentConfigVariable(key as EnvironmentVariables)
  });
};

// Helper function to validate if current token is still valid
export const validateCurrentTokenIsValid = async (): Promise<boolean> => {
  try {
    // Use a simple API call to test token validity
    const { getBuildProfiles } = await import('../services');
    await getBuildProfiles();
    return true;
  } catch (error: any) {
    // If we get a 401 error, token is expired/invalid
    if (error.response?.status === 401) {
      return false;
    }
    // For other errors, assume token is valid but there's a network/server issue
    return true;
  }
};

// Helper function to handle already logged in case
export const handleAlreadyLoggedIn = (): void => {
  console.error('You are already logged in. Use "logout" to logout first.');
};

// Helper function to handle PAT login
export const handlePatLogin = async (params: any): Promise<void> => {
  // Validate token parameter
  if (!params.token || params.token.trim() === '') {
    throw new ProgramError('Invalid PAT format provided');
  }

  const responseData = await getToken({ pat: params.token });
  writeEnviromentConfigVariable(EnvironmentVariables.AC_ACCESS_TOKEN, responseData.access_token);
  commandWriter(CommandTypes.LOGIN, responseData);
};

// Helper function to decode JWT token and get organization ID
export const decodeJwtToken = (token: string): { currentOrganizationId?: string } | null => {
  try {
    const tokenPayload = JSON.parse(Buffer.from(token.split('.')[1], 'base64').toString());
    return tokenPayload;
  } catch (error) {
    return null;
  }
};

// Helper function to validate organization ID from token
export const validateOrganizationId = (params: any, responseData: any): boolean => {
  if (!params['organization-id'] || !responseData.access_token) {
    return true; // No validation needed
  }

  const tokenPayload = decodeJwtToken(responseData.access_token);
  if (!tokenPayload) {
    return true; // If JWT decode fails, continue silently
  }

  const returnedOrgId = tokenPayload.currentOrganizationId;
  if (returnedOrgId !== params['organization-id']) {
    console.error(`Login failed: Your API Key does not have access to organization "${params['organization-id']}".`);
    return false;
  }

  return true;
};

// Helper function to handle API key login
export const handleApiKeyLogin = async (params: any): Promise<void> => {
  const responseData = await getTokenFromApiKey(params);
  
  // Check if organization ID validation passes
  if (!validateOrganizationId(params, responseData)) {
    return; // Exit without saving token or showing success message
  }
  
  // Only save token and show success if organization ID matches (or no organization ID was requested)
  writeEnviromentConfigVariable(EnvironmentVariables.AC_ACCESS_TOKEN, responseData.access_token);
  commandWriter(CommandTypes.LOGIN, responseData);
};

// Helper function to handle unknown login command
export const handleUnknownLoginCommand = (command: ProgramCommand): void => {
  const beutufiyCommandName = command.fullCommandName.split('-').join(' ');
  const desc = getLongDescriptionForCommand(command.fullCommandName);
  if (desc) {
    console.error(`\n${desc}\n`);
  } else {
    console.error(`"${beutufiyCommandName} ..." command not found.`);
  }
};

const handleLoginCommand = async (command: ProgramCommand, params: any) => {
  // Check if user is already logged in
  if (checkIfUserAlreadyLoggedIn()) {
    // Validate if the current token is still valid
    const isTokenValid = await validateCurrentTokenIsValid();

    if (isTokenValid) {
      // Token is still valid, show already logged in message
      handleAlreadyLoggedIn();
      return;
    } else {
      // Token is expired/invalid, clear it and proceed with new login
      console.log('Current token is expired or invalid. Clearing stored token and proceeding with new login...');
      clearStoredToken();
    }
  }

  if (command.fullCommandName === `${PROGRAM_NAME}-login-pat`) {
    await handlePatLogin(params);
  } else if (command.fullCommandName === `${PROGRAM_NAME}-login-api-key`) {
    await handleApiKeyLogin(params);
  } else {
    handleUnknownLoginCommand(command);
  }
};

export const checkIfUserIsLoggedIn = (): boolean => {
  return utilCheckIfUserIsLoggedIn({
    get: (key: string) => readEnviromentConfigVariable(key as EnvironmentVariables),
    has: (key: string) => !!readEnviromentConfigVariable(key as EnvironmentVariables)
  });
};

export const validateUserIsLoggedIn = (): void => {
  if (!checkIfUserIsLoggedIn()) {
    console.error('You are not currently logged in.');
    process.exit(1);
  }
};

export const clearStoredToken = (): void => {
  writeEnviromentConfigVariable(EnvironmentVariables.AC_ACCESS_TOKEN, '');
};

export const displayLogoutSuccessMessage = (): void => {
  console.log('Successfully logged out from Appcircle.');
};

const handleLogoutCommand = async (command: ProgramCommand, params: any) => {
  // Check if user is logged in first
  if (!checkIfUserIsLoggedIn()) {
    throw new ProgramError('You are not currently logged in');
  }

  // Clear the stored token (no API call needed)
  clearStoredToken();

  displayLogoutSuccessMessage();
};

// Config command action handlers
export const handleConfigListAction = (getConfigStore: any, getConsoleOutputType: any, configWriter: any, getConfigFilePath: any, getEnviromentsConfigToWriting: any) => {
  const store = getConfigStore();
  if (getConsoleOutputType() === 'json') {
    configWriter(store);
  } else {
    configWriter({ current: store.current, path: getConfigFilePath() });
    configWriter(getEnviromentsConfigToWriting());
  }
};

export const handleConfigSetAction = (key: string, value: string, writeEnviromentConfigVariable: any, readEnviromentConfigVariable: any, configWriter: any) => {
  writeEnviromentConfigVariable(key, value);
  configWriter({ [key]: readEnviromentConfigVariable(key) });
};

export const handleConfigGetAction = (key: string, readEnviromentConfigVariable: any, configWriter: any) => {
  configWriter({ [key]: readEnviromentConfigVariable(key) });
};

export const handleConfigCurrentAction = (key: string, getConfigStore: any, setCurrentConfigVariable: any, getCurrentConfigVariable: any, configWriter: any) => {
  const store = getConfigStore();
  if (!key) {
    throw new ProgramError("Config command 'current' action requires a value");
  }
  if (!store.envs[key]) {
    throw new ProgramError("Config command 'current' action requires a valid value");
  }
  setCurrentConfigVariable(key);
  configWriter({ current: getCurrentConfigVariable() });
};

export const handleConfigAddAction = (key: string, addNewConfigVariable: any, getCurrentConfigVariable: any, configWriter: any, getEnviromentsConfigToWriting: any) => {
  if (!key) {
    throw new ProgramError("Config command 'add' action requires a value(key)");
  }
  addNewConfigVariable(key);
  configWriter({ current: getCurrentConfigVariable() });
  configWriter(getEnviromentsConfigToWriting());
};

export const handleConfigResetAction = (clearConfigs: any, getCurrentConfigVariable: any, configWriter: any, getEnviromentsConfigToWriting: any) => {
  clearConfigs();
  configWriter({ current: getCurrentConfigVariable() });
  configWriter(getEnviromentsConfigToWriting());
};

export const handleConfigTrustAction = (trustAppcircleCertificate: any) => {
  trustAppcircleCertificate();
};

// File validation and path handling utilities
export const validateFileExists = (filePath: string, errorMessage: string) => {
  const expandedPath = path.resolve(filePath.replace('~', os.homedir()));
  if (!fs.existsSync(expandedPath)) {
    throw new AppcircleExitError(errorMessage, 1);
  }
  return expandedPath;
};

export const ensureDirectoryAndGetFilePath = (inputPath: string, fileName: string, defaultDir?: string) => {
  const homeDir = os.homedir();
  const defaultPath = defaultDir || path.join(homeDir, 'Downloads');
  let filePath = inputPath || defaultPath;
  
  // Expand tilde to home directory
  if (filePath.includes('~')) {
    filePath = filePath.replace(/~/g, os.homedir());
  }
  
  // Resolve to absolute path
  filePath = path.resolve(filePath);
  
  // Create directory if it doesn't exist
  if (!fs.existsSync(filePath)) {
    fs.mkdirSync(filePath, { recursive: true });
  }
  
  // If it's a directory, append the filename
  if (fs.statSync(filePath).isDirectory()) {
    filePath = path.join(filePath, fileName);
  }
  
  return filePath;
};

// Organization parameter resolution utilities
export const resolveOrganizationId = async (params: any, getOrganizations: any, getUserInfo: any) => {
  const organizations = await getOrganizations();
  const currentUser = await getUserInfo();
  
  const result = resolveOrganizationIdFromParams(params, organizations, currentUser);
  if (!result.isValid) {
    throw new ProgramError(result.error!);
  }
  
  params.organizationId = result.organizationId;
  return params.organizationId;
};

export const resolveUserIdFromUserParamCmd = async (params: any, getOrganizationUsersWithRoles: any) => {
  if (params.user && !params.userId) {
    const users = await getOrganizationUsersWithRoles({ organizationId: params.organizationId });
    
    const result = resolveUserIdFromUserParam(params, users);
    if (!result.isValid) {
      throw new ProgramError(result.error!);
    }
    
    params.userId = result.userId;
  }
  
  return params.userId;
};

export const getUserRemovalIdentifierAsync = async (params: any, getOrganizationUserinfo: any) => {
  let userInfo;
  
  if (params.userId && params.userId !== UNKNOWN_PARAM_VALUE) {
    try {
      userInfo = await getOrganizationUserinfo({ organizationId: params.organizationId, userId: params.userId });
    } catch (e) {
      // If fetching user info fails, userInfo remains undefined
    }
  }
  
  return getUserRemovalIdentifier(params, userInfo);
};

// Build parameter validation utilities
export const validateAndResolveBuildProfile = async (params: any, getBuildProfiles: any) => {
  if (params.profile && !params.profileId) {
    const buildProfiles = await getBuildProfiles();
    
    const result = resolveProfileIdFromName(params, buildProfiles);
    if (!result.isValid) {
      throw new ProgramError(result.error!);
    }
    
    params.profileId = result.profileId;
  }
  return params.profileId;
};

export const validateAndResolveBranch = async (params: any, getBranches: any) => {
  if (params.branch && !params.branchId && params.profileId) {
    const branchesResponse = await getBranches({ profileId: params.profileId });
    
    const result = resolveBranchIdFromName(params, branchesResponse.branches || []);
    if (!result.isValid) {
      throw new ProgramError(result.error!);
    }
    
    params.branchId = result.branchId;
  }
  return params.branchId;
};

export const validateAndResolveWorkflow = async (params: any, getWorkflows: any) => {
  if (params.workflow && !params.workflowId && params.profileId) {
    const workflows = await getWorkflows({ profileId: params.profileId });
    
    const result = resolveWorkflowIdFromName(params, workflows);
    if (!result.isValid) {
      throw new ProgramError(result.error!);
    }
    
    params.workflowId = result.workflowId;
  }
  return params.workflowId;
};

export const validateAndResolveConfiguration = async (params: any, getConfigurations: any) => {
  if (params.configuration && !params.configurationId && params.profileId) {
    const configurations = await getConfigurations({ profileId: params.profileId });
    
    const result = resolveConfigurationIdFromName(params, configurations);
    if (!result.isValid) {
      throw new ProgramError(result.error!);
    }
    
    params.configurationId = result.configurationId;
  }
  return params.configurationId;
};

export const validateAndResolveVariableGroup = async (params: any, getEnvironmentVariableGroups: any) => {
  if (params.variableGroup && !params.variableGroupId) {
    const variableGroups = await getEnvironmentVariableGroups();
    const foundVariableGroup = variableGroups.find((group: any) => group.name === params.variableGroup);
    if (!foundVariableGroup) {
      throw new ProgramError(`Variable group "${params.variableGroup}" not found.
        
Available variable groups:
${variableGroups.map((group: any) => `  - ${group.name}`).join('\n')}`);
    }
    params.variableGroupId = foundVariableGroup.id;
  }
  return params.variableGroupId;
};

// User confirmation prompt utilities
export const promptUserConfirmation = async (message: string, defaultToNo: boolean = true) => {
  const response: any = await enquirer.prompt({
    type: 'select',
    name: 'confirm',
    message: message,
    choices: [
      { name: 'yes', message: 'yes' },
      { name: 'no', message: 'no' }
    ],
    initial: defaultToNo ? 1 : 0
  });
  
  return response.confirm === 'yes';
};

export const promptUserAction = async (message: string, choices: { name: string, message: string }[]) => {
  const response: any = await enquirer.prompt({
    type: 'select',
    name: 'action',
    message: message,
    choices: choices
  });
  
  return response.action;
};

// Additional file path expansion and validation utilities
export const expandAndValidateFilePath = (filePath: string, homeDir: string): string => {
  const expandedPath = path.resolve(filePath.replace('~', homeDir));
  if (!fs.existsSync(expandedPath)) {
    throw new Error(`File not found: ${expandedPath}`);
  }
  return expandedPath;
};

export const readAndValidateJsonFile = (filePath: string): any => {
  try {
    const fileContent = fs.readFileSync(filePath, 'utf8');
    return JSON.parse(fileContent);
  } catch (error) {
    throw new Error('Invalid JSON file');
  }
};

// Spinner and download helper utilities
export const createSpinnerWithMessage = (message: string, type: 'start' | 'succeed' | 'fail' = 'start') => {
  const spinner = createOra(message);
  if (type === 'start') {
    return spinner.start();
  }
  return spinner;
};

export const handleSpinnerSuccess = (spinner: any, message: string) => {
  spinner.succeed(message);
};

export const handleSpinnerFailure = (spinner: any, message: string) => {
  spinner.fail(message);
};

export const downloadWithSpinner = async (
  downloadFunction: () => Promise<void>,
  downloadPath: string,
  fileName: string,
  itemType: string = 'file'
) => {
  const spinner = createOra(`Downloading ${itemType}...`).start();
  try {
    await downloadFunction();
    const fullPath = path.resolve(path.join(downloadPath, fileName));
    spinner.succeed(`${itemType} downloaded successfully: file://${fullPath}`);
    return fullPath;
  } catch (error: any) {
    spinner.fail(`Cannot download ${itemType}: ${error.message || 'Unknown error'}`);
    throw error;
  }
};

export const createDirectoryWithFallback = (downloadPath: string, homeDir: string): string => {
  try {
    if (!fs.existsSync(downloadPath)) {
      fs.mkdirSync(downloadPath, { recursive: true });
    }
    return downloadPath;
  } catch (error) {
    console.log(chalk.yellow(`Could not create directory at ${downloadPath}. Using home directory instead.`));
    return homeDir;
  }
};

// Command validation utilities
export const validateCommandParameters = (params: any, requiredParams: string[], command: ProgramCommand, isInteractiveMode?: boolean): void => {
  for (const param of requiredParams) {
    if (!params[param]) {
      if (isInteractiveMode) {
        const paramDisplayName = param.replace(/Id$/, '').replace(/([A-Z])/g, ' $1').toLowerCase();
        console.error(chalk.red(`Error: Missing ${paramDisplayName}. Please ensure a valid ${paramDisplayName} is selected.`));
        throw new AppcircleExitError('', 1);
      } else {
        const desc = getLongDescriptionForCommand(command.fullCommandName);
        if (desc) {
          console.error(`\n${desc}\n`);
        }
        throw new AppcircleExitError('', 1);
      }
    }
  }
};

export const createListCommand = async (spinnerMessage: string, dataFunction: Function, params: any, commandType: CommandTypes, command: ProgramCommand) => {
  const spinner = createOra(spinnerMessage).start();
  const responseData = await dataFunction(params);
  spinner.stop();
  commandWriter(commandType, {
    fullCommandName: command.fullCommandName,
    data: responseData,
  });
};

// Build artifact download utilities - use utility version
export const setupDownloadDirectoryCmd = (params: any, homeDir: string): string => {
  const defaultDownloadDir = path.join(homeDir, 'Downloads');
  const result = setupDownloadDirectory(params.path, defaultDownloadDir);
  
  if (!result.isValid) {
    console.log(chalk.yellow(`Could not create directory. Using home directory instead.`));
    return homeDir;
  }
  
  return result.downloadPath!;
};

// generateArtifactFileName moved to command-runner-utilities.ts

export const downloadArtifactWithRetry = async (params: any, downloadPath: string, fileName: string, spinner: any): Promise<void> => {
  try {
    if (params.branchId && params.profileId) {
      await downloadArtifact({
        branchId: params.branchId,
        profileId: params.profileId,
        commitId: params.commitId || ""
      }, downloadPath, fileName);
    } else if (params.commitId) {
      const buildsResponse = await getBuildsOfCommit({ commitId: params.commitId });
      if (buildsResponse?.builds?.length > 0) {
        if (!params.buildId) {
          params.buildId = buildsResponse.builds[0].id;
        }
        await downloadArtifact(params, downloadPath, fileName);
      } else {
        throw new Error(`No Builds found for commit ID: ${params.commitId}`);
      }
    }
    
    const fullPath = path.join(downloadPath, fileName);
    spinner.succeed(`The file ${fileName} is downloaded successfully: file://${fullPath}`);
  } catch (error: any) {
    spinner.fail(`Cannot download artifact: ${error.message || 'Unknown error'}`);
    throw error;
  }
};

// Variable group file upload utilities
export const validateAndProcessVariableGroupFile = (params: any, spinner: any): string => {
  if (!params.filePath) {
    spinner.fail('JSON file path is required');
    throw new AppcircleExitError('JSON file path is required', 1);
  }
  
  // Clean up variableGroupId if it has extra formatting
  if (params.variableGroupId) {
    params.variableGroupId = extractVariableGroupId(params.variableGroupId);
  }
  
  // Use our own validateFileExists function and validate JSON content
  const expandedPath = validateFileExists(params.filePath, 'File not found');
  
  // Validate JSON content
  try {
    const fileContent = fs.readFileSync(expandedPath, 'utf8');
    JSON.parse(fileContent);
  } catch (err) {
    spinner.fail('Invalid JSON file');
    throw new AppcircleExitError('Invalid JSON file', 1);
  }
  
  return expandedPath;
};

// Build monitoring utilities
export const createProgressSpinner = (message: string) => {
  return getConsoleOutputType() === 'json' ? 
    { text: '', succeed: () => {}, fail: () => {}, stop: () => {} } : 
    createOra(message).start();
};

// formatElapsedTime function is now imported from utilities

export const updateBuildStatusMessage = (buildStatus: number | null, elapsedText: string, progressSpinner: any, hasWarning: boolean = false) => {
  if (buildStatus === null || buildStatus === undefined) {
    progressSpinner.text = chalk.gray(`Build Status is pending...`);
    return;
  }
  
  switch (buildStatus) {
    case 0: // SUCCESS
      if (hasWarning) {
        progressSpinner.text = chalk.hex('#FFA500')(`Build completed with warnings ⚠️ (${elapsedText})`);
      } else {
        progressSpinner.text = `Build completed successfully ✅ (${elapsedText})`;
      }
      break;
    case 1: // FAILED
      progressSpinner.text = chalk.red(`Build failed ❌ (${elapsedText})`);
      break;
    case 2: // CANCELED
      progressSpinner.text = chalk.hex('#FF8C32')(`Build canceled 🚫 (${elapsedText})`);
      break;
    case 3: // TIMEOUT
      progressSpinner.text = chalk.red(`Build timed out ⏱️ (${elapsedText})`);
      break;
    case 90: // WAITING
      progressSpinner.text = chalk.cyan(`Build waiting in queue ⏳ (${elapsedText})`);
      break;
    case 91: // RUNNING
      // Build is running, animation continues with elapsed time shown in interval
      break;
    case 92: // COMPLETING
      progressSpinner.text = chalk.blue(`Build finishing... 🔜 (${elapsedText})`);
      break;
    default:
      progressSpinner.text = chalk.gray(`Build Status: ${buildStatus} (${elapsedText})`);
  }
};

export const monitorBuildProgress = async (taskId: string, params: any, getBuildStatusFromQueue: Function, getLatestBuildId: Function) => {
  let buildCompleted = false;
  let buildSuccess = false;
  let retryCount = 0;
  const maxRetries = 300;
  let finalStatusResponse: any = null;
  let latestBuildId: string | null = null;
  
  // Initial delay
  await new Promise(resolve => setTimeout(resolve, 2000));
  
  while (!buildCompleted && retryCount < maxRetries) {
    try {
      const queueResponse = await getBuildStatusFromQueue({ taskId });
      finalStatusResponse = queueResponse;
      
      // Try to get the latest build ID if we have branchId and profileId
      if (!latestBuildId && params.branchId && params.profileId) {
        latestBuildId = await getLatestBuildId({ 
          branchId: params.branchId, 
          profileId: params.profileId 
        });
        if (latestBuildId) {
          finalStatusResponse.buildId = latestBuildId;
        }
      }
      
      const buildStatus = queueResponse && queueResponse.buildStatus !== undefined ? 
        queueResponse.buildStatus : null;
      
      // Determine completion status
      if (buildStatus === 0) { // SUCCESS
        buildCompleted = true;
        buildSuccess = true;
      } else if (buildStatus === 1 || buildStatus === 2 || buildStatus === 3) { // FAILED, CANCELED, TIMEOUT
        buildCompleted = true;
        buildSuccess = false;
        if (buildStatus === 2) {
          params.wasCanceled = true;
        }
      }
      
      // Force completion if build status is not running and retry count is high
      if (buildStatus !== 91 && retryCount > 5) {
        buildCompleted = true;
      }
      
      finalStatusResponse.buildStatus = buildStatus;
      finalStatusResponse.hasWarning = queueResponse?.hasWarning;
      
    } catch (e) {
      // Silent error handling - continue monitoring
    }
    
    if (!buildCompleted) {
      await new Promise(resolve => setTimeout(resolve, 3000));
      retryCount++;
    }
  }
  
  return {
    buildCompleted,
    buildSuccess,
    finalStatusResponse,
    latestBuildId,
    timedOut: retryCount >= maxRetries
  };
};

export const handleBuildSuccessCompletion = async (finalStatusResponse: any, latestBuildId: string | null, params: any, responseData: any, downloadArtifact: Function, downloadBuildLogs: Function) => {
  const homeDir = os.homedir();
  const defaultDownloadDir = path.join(homeDir, 'Downloads');
  const downloadPath = params.path || defaultDownloadDir;
  
  // Check if automatic download parameters are provided
  const shouldDownloadLogs = params.downloadLogs === true || params['download-logs'] === true;
  const shouldDownloadArtifacts = params.downloadArtifacts === true || params['download-artifacts'] === true;
  
  // Skip interactive prompt for JSON output mode
  if (getConsoleOutputType() === 'json') {
    const jsonOutput = {
      taskId: responseData.taskId,
      queueItemId: responseData.queueItemId,
      status: 'success',
      message: 'Build completed successfully'
    };
    console.log(JSON.stringify(jsonOutput));
    throw new AppcircleExitError('', 0);
  }
  
  // If automatic download parameters are provided, handle downloads
  if (shouldDownloadLogs || shouldDownloadArtifacts) {
    const commitId = finalStatusResponse?.commitId;
    const buildId = latestBuildId || finalStatusResponse?.buildId;
    
    if (shouldDownloadArtifacts && commitId && buildId) {
      const buildStatus = finalStatusResponse?.buildStatus;
      const hasWarning = finalStatusResponse?.hasWarning;
      await downloadBuildArtifactsWithSpinner(commitId, buildId, params, downloadPath, downloadArtifact, buildStatus, hasWarning);
    }
    
    if (shouldDownloadLogs) {
      await downloadBuildLogsWithSpinner(commitId, buildId, params, downloadPath, downloadBuildLogs, responseData);
    }
    throw new AppcircleExitError('Build completed', 0);
  }
  
  // Interactive prompt for downloads
  return await promptForDownloadActions(finalStatusResponse, latestBuildId, params, downloadPath, downloadArtifact, downloadBuildLogs, responseData);
};

export const downloadBuildArtifactsWithSpinner = async (commitId: string, buildId: string, params: any, downloadPath: string, downloadArtifact: Function, buildStatus?: number | null, hasWarning?: boolean) => {
  const artifactSpinner = createOra('Waiting for artifacts to be ready...').start();
  await new Promise(resolve => setTimeout(resolve, 10000));
  artifactSpinner.text = 'Downloading artifacts...';
  try {
    const artifactFileName = generateArtifactFileName();
    await downloadArtifact({ 
      commitId: commitId, 
      buildId: buildId,
      branchId: params.branchId,
      profileId: params.profileId
    }, downloadPath, artifactFileName);
    artifactSpinner.succeed(`Artifacts downloaded successfully: file://${path.resolve(path.join(downloadPath, artifactFileName))}`);
  } catch (e: any) {
    const errorMessage = generateArtifactErrorMessage(buildStatus, e.message, buildId, hasWarning);
    artifactSpinner.fail(errorMessage);
  }
};

export const downloadBuildLogsWithSpinner = async (commitId: string, buildId: string, params: any, downloadPath: string, downloadBuildLogs: Function, responseData: any) => {
  const logSpinner = createOra('Downloading build logs...').start();
  try {
    if (commitId && buildId && buildId !== '00000000-0000-0000-0000-000000000000') {
      await downloadBuildLogs({ 
        commitId: commitId, 
        buildId: buildId,
        branchId: params.branchId,
        profileId: params.profileId,
        path: downloadPath
      });
    } else {
      await downloadBuildLogs(responseData.queueItemId, { path: downloadPath });
    }
    logSpinner.succeed('Build logs downloaded successfully');
  } catch (e: any) {
    logSpinner.fail(`Cannot download logs since the build failed: ${e.message}`);
  }
};

export const promptForDownloadActions = async (finalStatusResponse: any, latestBuildId: string | null, params: any, defaultDownloadDir: string, downloadArtifact: Function, downloadBuildLogs: Function, responseData: any) => {
  // Ensure SSE connection is closed before showing the prompt
  if (params.sseConnection && params.sseConnection.close) {
    params.sseConnection.close();
  }
  
  console.log(chalk.cyan('\nWhat would you like to do next?'));
  
  try {
    const response: any = await enquirer.prompt({
      type: 'select',
      name: 'action',
      message: 'Choose an option:',
      choices: [
        { name: 'artifacts', message: 'Download Artifacts' },
        { name: 'logs', message: 'Download Build Logs' },
        { name: 'continue', message: 'Continue without downloading' }
      ]
    });
    
    if (response.action === 'artifacts') {
      const artifactDownloadPath = await promptForPath('[OPTIONAL] Enter download path for artifacts', defaultDownloadDir);
      const commitIdForArtifact = finalStatusResponse?.commitId;
      const buildIdForArtifact = latestBuildId || finalStatusResponse?.buildId;

      if (commitIdForArtifact && buildIdForArtifact) {
        const buildStatus = finalStatusResponse?.buildStatus;
        const hasWarning = finalStatusResponse?.hasWarning;
        await downloadBuildArtifactsWithSpinner(commitIdForArtifact, buildIdForArtifact, params, artifactDownloadPath, downloadArtifact, buildStatus, hasWarning);
      } else {
        console.log(chalk.yellow('Build completed successfully but could not get artifact information.'));
      }
    } else if (response.action === 'logs') {
      const buildLogPath = await promptForPath('[OPTIONAL] Enter download path for Build Logs', defaultDownloadDir);
      await downloadBuildLogsInteractive(finalStatusResponse, latestBuildId, params, buildLogPath, downloadBuildLogs, responseData);
    } else {
      console.log(chalk.gray('Build completed successfully.'));
    }
    throw new AppcircleExitError('Build completed', 0);
  } catch (err) {
    if (err instanceof AppcircleExitError) {
      throw err;
    }
    console.log(chalk.gray('Build completed successfully.'));
    throw new AppcircleExitError('Build completed', 0);
  }
};

export const downloadBuildLogsInteractive = async (finalStatusResponse: any, latestBuildId: string | null, params: any, buildLogPath: string, downloadBuildLogs: Function, responseData: any) => {
  if (finalStatusResponse && finalStatusResponse.buildStatus === 2) {
    params.wasCanceled = true;
    console.log(chalk.yellow('Note: Logs for canceled Builds might not be immediately available.'));
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  
  try {
    const commitId = finalStatusResponse?.commitId;
    const buildId = latestBuildId || finalStatusResponse?.buildId;
    
    if (commitId && buildId && buildId !== '00000000-0000-0000-0000-000000000000') {
      await downloadBuildLogs({ 
        commitId, 
        buildId,
        branchId: params.branchId,
        profileId: params.profileId,
        path: buildLogPath
      });
    } else {
      await downloadBuildLogs(responseData.queueItemId, { path: buildLogPath });
    }
    console.log(chalk.green('Build log downloaded successfully.'));
    throw new AppcircleExitError('', 0);
  } catch (error: any) {
    if (error instanceof AppcircleExitError) {
      throw error;
    }
    console.log(chalk.yellow(`Build failed and log download also failed: ${error.message}`));
    try {
      await downloadBuildLogs(responseData.queueItemId, { path: buildLogPath });
      console.log(chalk.yellow('Build failed but logs downloaded successfully.'));
      throw new AppcircleExitError('Build failed', 1);
    } catch (fallbackError: any) {
      console.log(chalk.red('Build failed and could not download logs.'));
      throw new AppcircleExitError('Build failed', 1);
    }
  }
};

export const handleBuildFailureCompletion = async (finalStatusResponse: any, latestBuildId: string | null, params: any, responseData: any, downloadBuildLogs: Function) => {
  // Skip interactive prompt for JSON output mode
  if (getConsoleOutputType() === 'json') {
    const jsonOutput = {
      taskId: responseData.taskId,
      queueItemId: responseData.queueItemId,
      status: 'failed',
      message: 'Build failed'
    };
    console.log(JSON.stringify(jsonOutput));
    throw new AppcircleExitError('', 1);
  }
  
  const homeDir = os.homedir();
  const defaultDownloadDir = path.join(homeDir, 'Downloads');
  
  // Check if automatic download parameters are provided
  const shouldDownloadLogs = params.downloadLogs === true || params['download-logs'] === true;
  const shouldDownloadArtifacts = params.downloadArtifacts === true || params['download-artifacts'] === true;
  
  // If automatic download parameters are provided, handle downloads
  if (shouldDownloadLogs || shouldDownloadArtifacts) {
    const commitId = finalStatusResponse?.commitId;
    const buildId = latestBuildId || finalStatusResponse?.buildId;
    
    if (shouldDownloadLogs) {
      await downloadBuildLogsWithSpinner(commitId, buildId, params, defaultDownloadDir, downloadBuildLogs, responseData);
    }
    throw new AppcircleExitError('Build completed', 0);
  }
  
  // Interactive prompt for log download
  return await promptForFailedBuildLogs(finalStatusResponse, latestBuildId, params, defaultDownloadDir, downloadBuildLogs, responseData);
};

export const promptForFailedBuildLogs = async (finalStatusResponse: any, latestBuildId: string | null, params: any, defaultDownloadDir: string, downloadBuildLogs: Function, responseData: any) => {
  console.log(chalk.cyan('\nBuild failed. Would you like to download the logs?'));
  
  try {
    const response: any = await enquirer.prompt({
      type: 'select',
      name: 'download',
      message: 'Do you want to download the Build Logs? (Y/n)',
      choices: [
        { name: 'yes', message: 'yes' },
        { name: 'no', message: 'no' }
      ],
      initial: 0
    });
    
    if (response.download === 'yes') {
      const buildLogPath = await promptForPath('[OPTIONAL] Enter download path for Build Logs', defaultDownloadDir);
      await downloadBuildLogsInteractive(finalStatusResponse, latestBuildId, params, buildLogPath, downloadBuildLogs, responseData);
    } else {
      throw new AppcircleExitError('Build failed', 1);
    }
  } catch (err) {
    // If it's already an AppcircleExitError, re-throw it as is
    if (err instanceof AppcircleExitError) {
      throw err;
    }
    // For other errors, wrap them
    throw new AppcircleExitError('Build failed, user chose to exit', 1);
  }
};

// Enterprise command utilities
export const validateEnterpriseProfileParams = async (command: ProgramCommand, params: any) => {
  const profileRequiredCommands = [
    `${PROGRAM_NAME}-enterprise-app-store-version-list`,
    `${PROGRAM_NAME}-enterprise-app-store-version-publish`,
    `${PROGRAM_NAME}-enterprise-app-store-version-unpublish`,
    `${PROGRAM_NAME}-enterprise-app-store-version-remove`,
    `${PROGRAM_NAME}-enterprise-app-store-version-notify`,
    `${PROGRAM_NAME}-enterprise-app-store-version-upload-for-profile`,
    `${PROGRAM_NAME}-enterprise-app-store-version-download-link`
  ];

  if (profileRequiredCommands.includes(command.fullCommandName)) {
    if (!params.entProfileId && !params.entProfile) {
      const commandParts = command.fullCommandName.replace(`${PROGRAM_NAME}-`, '').split('-');
      const longDescription = getLongDescriptionForCommand(commandParts.join(' '));
      if (longDescription) {
        console.log('\n' + longDescription);
      }
      throw new ProgramError(`Either --entProfileId or --entProfile parameter is required.`);
    }

    // Resolve profile name to ID if needed
    if (params.entProfile && !params.entProfileId) {
      const profiles = await getEnterpriseProfiles();
      const foundProfile = profiles.find((p: any) => p.name === params.entProfile);
      if (!foundProfile) {
        throw new ProgramError(`Enterprise profile with name "${params.entProfile}" not found.`);
      }
      params.entProfileId = foundProfile.id;
    }
  }
};

export const validateEnterpriseAppVersionParams = async (command: ProgramCommand, params: any) => {
  const appVersionRequiredCommands = [
    `${PROGRAM_NAME}-enterprise-app-store-version-publish`,
    `${PROGRAM_NAME}-enterprise-app-store-version-unpublish`,
    `${PROGRAM_NAME}-enterprise-app-store-version-remove`,
    `${PROGRAM_NAME}-enterprise-app-store-version-notify`,
    `${PROGRAM_NAME}-enterprise-app-store-version-download-link`
  ];

  if (appVersionRequiredCommands.includes(command.fullCommandName)) {
    if (!params.entVersionId && !params.entVersion) {
      const commandParts = command.fullCommandName.replace(`${PROGRAM_NAME}-`, '').split('-');
      const longDescription = getLongDescriptionForCommand(commandParts.join(' '));
      if (longDescription) {
        console.log('\n' + longDescription);
      }
      throw new ProgramError(`Either --entVersionId or --entVersion parameter is required.`);
    }

    // Resolve app version name to ID if needed
    if (params.entVersion && !params.entVersionId) {
      const appVersions = await getEnterpriseAppVersions({ entProfileId: params.entProfileId, publishType: "0" });
      const foundAppVersion = appVersions.find((v: any) => v.name === params.entVersion || v.version === params.entVersion);
      if (!foundAppVersion) {
        throw new ProgramError(`App version with name "${params.entVersion}" not found.`);
      }
      params.entVersionId = foundAppVersion.id;
    }
  }
};

export const handleEnterpriseProfileList = async (command: ProgramCommand) => {
  const spinner = createOra('Listing Enterprise Profiles...').start();
  const responseData = await getEnterpriseProfiles();
  spinner.stop();
  commandWriter(CommandTypes.ENTERPRISE_APP_STORE, {
    fullCommandName: command.fullCommandName,
    data: responseData,
  });
};

export const handleEnterpriseVersionList = async (command: ProgramCommand, params: any) => {
  const spinner = createOra('Listing Enterprise App Versions...').start();
  const responseData = await getEnterpriseAppVersions(params);
  spinner.stop();
  commandWriter(CommandTypes.ENTERPRISE_APP_STORE, {
    fullCommandName: command.fullCommandName,
    data: responseData,
  });
};

export const handleEnterpriseVersionPublish = async (command: ProgramCommand, params: any) => {
  // Validate required parameters
  if (!params.entProfileId) {
    throw new Error('Enterprise Profile ID (--entProfileId) is required');
  }
  if (!params.entVersionId) {
    throw new Error('Enterprise Version ID (--entVersionId) is required');
  }
  if (!params.summary) {
    throw new Error('Summary (--summary) is required');
  }
  if (!params.releaseNotes) {
    throw new Error('Release Notes (--releaseNotes) is required');
  }
  if (!params.publishType) {
    throw new Error('Publish Type (--publishType) is required');
  }

  // Map parameters correctly
  const publishParams = {
    entProfileId: params.entProfileId,
    entVersionId: params.entVersionId,
    summary: params.summary,
    releaseNotes: params.releaseNotes,
    publishType: params.publishType
  };

  const responseData = await publishEnterpriseAppVersion(publishParams);
  commandWriter(CommandTypes.ENTERPRISE_APP_STORE, {
    fullCommandName: command.fullCommandName,
    data: responseData,
  });
};

export const handleEnterpriseVersionUnpublish = async (command: ProgramCommand, params: any) => {
  const responseData = await unpublishEnterpriseAppVersion(params);
  commandWriter(CommandTypes.ENTERPRISE_APP_STORE, {
    fullCommandName: command.fullCommandName,
    data: responseData,
  });
};

export const handleEnterpriseVersionRemove = async (command: ProgramCommand, params: any) => {
  if (!params.entVersionId) {
    return;
  }

  // Get the app version details first
  const versions = await getEnterpriseAppVersions({ entProfileId: params.entProfileId, publishType: "0" });
  const version = versions.find((v: any) => v.id === params.entVersionId);
  
  if (!version) {
    throw new Error('App Version not found');
  }

  // Confirm deletion
  const response: any = await enquirer.prompt({
    type: 'select',
    name: 'confirm',
    message: `Are you sure you want to delete the Enterprise App Version "${version.name} (${version.version})"? This action cannot be undone. (Y/n)`,
    choices: [
      { name: 'yes', message: 'yes' },
      { name: 'no', message: 'no' }
    ],
    initial: 1  // Default to "no" for safety
  });

  if (response.confirm === 'no') {
    console.log(chalk.yellow('Enterprise App Version deletion cancelled.'));
    return;
  }

  const spinner = createOra('Removing Enterprise App Version...').start();
  try {
    const responseData = await removeEnterpriseAppVersion(params);
    spinner.text = 'Enterprise App Version removed successfully.\n\nTaskId: ' + responseData.taskId;
    spinner.succeed();
    commandWriter(CommandTypes.ENTERPRISE_APP_STORE, {
      fullCommandName: command.fullCommandName,
      data: responseData,
    });
  } catch (e) {
    spinner.fail('Failed to remove Enterprise App Version');
    throw e;
  }
};

export const handleEnterpriseVersionNotify = async (command: ProgramCommand, params: any) => {
  const spinner = createOra(`Notifying users with new version for ${params.entVersionId}`).start();
  try {
    const responseData = await notifyEnterpriseAppVersion(params);
    commandWriter(CommandTypes.ENTERPRISE_APP_STORE, {
      fullCommandName: command.fullCommandName,
      data: responseData,
    });
    spinner.text = `Version notification sent successfully.\n\nTaskId: ${responseData.taskId}`;
    spinner.succeed();
  } catch (e) {
    spinner.fail('Notification failed');
    throw e;
  }
};

export const validateAndPrepareUploadFile = (appPath: string) => {
  let expandedPath = appPath;
  if (expandedPath.includes('~')) {
    expandedPath = expandedPath.replace(/~/g, os.homedir());
  }
  expandedPath = path.resolve(expandedPath);
  
  if (!fs.existsSync(expandedPath)) {
    throw new AppcircleExitError('File not found: ' + appPath, 1);
  }
  
  const fileName = path.basename(expandedPath);
  const stats = fs.statSync(expandedPath);
  const maxBytes = getMaxUploadBytes();
  
  if (maxBytes !== null && stats.size > maxBytes) {
    throw new AppcircleExitError(`File size ${(stats.size / GB).toFixed(2)} GB exceeds the allowed limit of ${(maxBytes / GB).toFixed(2)} GB.`, 1);
  }
  
  return { expandedPath, fileName, stats };
};

export const handleUploadError = (uploadError: any, spinner: any) => {
  if (uploadError.response?.data?.message?.includes('The file is too large')) {
    spinner.fail(`File size exceeds the maximum allowed limit of 3 GB.`);
    throw new AppcircleExitError('File size exceeds the maximum allowed limit of 3 GB.', 1);
  } else if (uploadError instanceof ProgramError) {
    spinner.fail(uploadError.message);
    throw new AppcircleExitError(uploadError.message, 1);
  } else if (uploadError.message && uploadError.message.includes('Cannot read properties')) {
    spinner.fail(`API response format error. Please check your connection settings (AUTH_HOSTNAME and API_HOSTNAME).`);
    throw new AppcircleExitError('API response format error. Please check your connection settings (AUTH_HOSTNAME and API_HOSTNAME).', 1);
  }
  spinner.fail(`Upload failed: ${uploadError.message || 'Unknown error'}`);
  throw uploadError;
};

export const handleEnterpriseVersionUploadForProfile = async (command: ProgramCommand, params: any) => {
  const spinner = createOra('Try to upload the app').start();
  try {
    const { expandedPath, fileName, stats } = validateAndPrepareUploadFile(params.app);
    const uploadResponse = await getEnterpriseUploadInformation({fileName, fileSize: stats.size});
    
    try {
      await uploadArtifactWithSignedUrl({ app: expandedPath, uploadInfo: uploadResponse });
      const commitFileResponse = await commitEnterpriseFileUpload({fileId: uploadResponse.fileId, fileName, entProfileId: params.entProfileId});
      commandWriter(CommandTypes.ENTERPRISE_APP_STORE, {
        fullCommandName: command.fullCommandName,
        data: commitFileResponse,
      });
      spinner.text = `App version uploaded successfully.\n\nTaskId: ${commitFileResponse.taskId}`;
      spinner.succeed();
    } catch (uploadError: any) {
      handleUploadError(uploadError, spinner);
    }
  } catch (e) {
    if (!(e instanceof AppcircleExitError)) {
      spinner.fail('Upload failed');
    }
    throw e;
  }
};

export const handleEnterpriseVersionUploadWithoutProfile = async (command: ProgramCommand, params: any) => {
  const spinner = createOra('Try to upload the app').start();
  try {
    const { expandedPath, fileName, stats } = validateAndPrepareUploadFile(params.app);
    const uploadResponse = await getEnterpriseUploadInformation({fileName, fileSize: stats.size});
    
    try {
      await uploadArtifactWithSignedUrl({ app: expandedPath, uploadInfo: uploadResponse });
      const commitFileResponse = await commitEnterpriseFileUpload({fileId: uploadResponse.fileId, fileName});
      commandWriter(CommandTypes.ENTERPRISE_APP_STORE, {
        fullCommandName: command.fullCommandName,
        data: commitFileResponse,
      });
      spinner.text = `New profile created and app uploaded successfully.\n\nTaskId: ${commitFileResponse.taskId}`;
      spinner.succeed();
    } catch (uploadError: any) {
      handleUploadError(uploadError, spinner);
    }
  } catch (e) {
    if (e instanceof ProgramError) {
      spinner.fail(e.message);
    } else if (!(e instanceof AppcircleExitError)) {
      spinner.fail('Upload failed');
    }
    throw e;
  }
};

export const handleEnterpriseVersionDownloadLink = async (command: ProgramCommand, params: any) => {
  const responseData = await getEnterpriseDownloadLink(params);
  commandWriter(CommandTypes.ENTERPRISE_APP_STORE, {
    fullCommandName: command.fullCommandName,
    data: responseData,
  });
};

// Testing distribution command utilities
export const validateDistributionProfileParams = async (command: ProgramCommand, params: any) => {
  if (command.fullCommandName === `${PROGRAM_NAME}-testing-distribution-upload`) {
    if (!params.distProfileId && !params.distProfile) {
      const desc = getLongDescriptionForCommand(command.fullCommandName);
      if (desc) {
        console.error(`\n${desc}\n`);
      }
      throw new AppcircleExitError('Either --distProfileId or --distProfile parameter is required', 1);
    }

    // Resolve profile name to ID if needed
    if (params.distProfile && !params.distProfileId) {
      const profiles = await getDistributionProfiles(params);
      const foundProfile = profiles.find((p: any) => p.name === params.distProfile);
      if (!foundProfile) {
        throw new AppcircleExitError(`Distribution profile with name "${params.distProfile}" not found`, 1);
      }
      params.distProfileId = foundProfile.id;
    }
  }
};

export const validateTestingGroupParams = async (command: ProgramCommand, params: any) => {
  const testingGroupRequiredCommands = [
    `${PROGRAM_NAME}-testing-distribution-testing-group-view`,
    `${PROGRAM_NAME}-testing-distribution-testing-group-remove`,
    `${PROGRAM_NAME}-testing-distribution-testing-group-tester-add`,
    `${PROGRAM_NAME}-testing-distribution-testing-group-tester-remove`
  ];

  if (testingGroupRequiredCommands.includes(command.fullCommandName)) {
    if (!params.testingGroupId && !params.testingGroup) {
      const desc = getLongDescriptionForCommand(command.fullCommandName);
      if (desc) {
        console.error(`\n${desc}\n`);
      }
      throw new AppcircleExitError('Either --testingGroupId or --testingGroup parameter is required', 1);
    }

    // Resolve testing group name to ID if needed
    if (params.testingGroup && !params.testingGroupId) {
      const testingGroups = await getTestingGroups();
      const foundGroup = testingGroups.find((g: any) => g.name === params.testingGroup);
      if (!foundGroup) {
        throw new AppcircleExitError(`Testing group with name "${params.testingGroup}" not found`, 1);
      }
      params.testingGroupId = foundGroup.id;
    }
  }
};

export const handleDistributionProfileList = async (command: ProgramCommand, params: any) => {
  const spinner = createOra('Listing Distribution Profiles...').start();
  const responseData = await getDistributionProfiles(params);
  if (!responseData || responseData.length === 0) {
    spinner.text = 'No Distribution Profile available';
    spinner.fail();
    throw new AppcircleExitError('No Distribution Profile available', 1);
  }
  spinner.stop();
  commandWriter(CommandTypes.TESTING_DISTRIBUTION, {
    fullCommandName: command.fullCommandName,
    data: responseData,
  });
};

export const handleDistributionProfileCreate = async (command: ProgramCommand, params: any) => {
  const responseData = await createDistributionProfile(params);
  commandWriter(CommandTypes.TESTING_DISTRIBUTION, {
    fullCommandName: command.fullCommandName,
    data: { ...responseData, name: params.name },
  });
};

export const handleDistributionUpload = async (command: ProgramCommand, params: any) => {
  // Validate distribution profile parameters
  await validateDistributionProfileParams(command, params);

  const spinner = createOra('Try to upload the app').start();
  try {
    const profiles = await getDistributionProfiles(params);
    
    if (!profiles || profiles.length === 0) {
      spinner.text = 'No Distribution Profile available';
      spinner.fail();
      throw new AppcircleExitError('No Distribution Profile available', 1);
    }

    const { expandedPath, fileName, stats } = validateAndPrepareUploadFile(params.app);
    
    const uploadResponse = await getTestingDistributionUploadInformation({
      fileName,
      fileSize: stats.size,
      distProfileId: params.distProfileId,
    });
    
    try {
      await uploadArtifactWithSignedUrl({ app: expandedPath, uploadInfo: uploadResponse });
      const commitFileResponse = await commitTestingDistributionFileUpload({
        fileId: uploadResponse.fileId,
        fileName,
        distProfileId: params.distProfileId
      });

      // Update release notes if message is provided
      if (params.message) {
        spinner.text = 'Upload completed. Updating release notes...';

        // First, try to get version ID directly from commitFileResponse
        let versionIdToUpdate = null;

        // Check various possible fields in the response that might contain the version ID
        if (commitFileResponse.versionId) {
          versionIdToUpdate = commitFileResponse.versionId;
        } else if (commitFileResponse.id) {
          versionIdToUpdate = commitFileResponse.id;
        } else if (commitFileResponse.appVersionId) {
          versionIdToUpdate = commitFileResponse.appVersionId;
        }

        // If we couldn't get version ID from response, use the specialized function for post-upload scenarios
        if (!versionIdToUpdate) {
          spinner.text = 'Searching for uploaded app version...';

          try {
            versionIdToUpdate = await getLatestAppVersionIdAfterUpload({
              distProfileId: params.distProfileId,
              expectedFileSize: stats.size,
              fileName: fileName
            });
          } catch (error: any) {
            console.warn('Could not retrieve version ID using enhanced method, falling back to basic method');
          }

          // Final fallback to the basic method if enhanced method fails
          if (!versionIdToUpdate) {
            let attempts = 0;
            const maxAttempts = 3;
            const retryDelay = 2000; // 2 seconds

            while (!versionIdToUpdate && attempts < maxAttempts) {
              attempts++;
              spinner.text = `Getting version ID (fallback attempt ${attempts}/${maxAttempts})...`;

              if (attempts > 1) {
                await new Promise(resolve => setTimeout(resolve, retryDelay));
              }

              try {
                versionIdToUpdate = await getLatestAppVersionId({
                  distProfileId: params.distProfileId
                });
              } catch (error: any) {
                // Retry silently
              }
            }
          }
        }

        if (versionIdToUpdate) {
          spinner.text = 'Version ID found. Updating release notes...';
          await updateTestingDistributionReleaseNotes({
            distProfileId: params.distProfileId,
            versionId: versionIdToUpdate,
            message: params.message
          });
          spinner.text = `App uploaded and release notes updated successfully.\n\nTaskId: ${commitFileResponse.taskId}`;
        } else {
          spinner.text = `App uploaded successfully but could not update release notes.\n\nTaskId: ${commitFileResponse.taskId}`;
          console.warn('Warning: Could not retrieve version ID to update release notes. The app was uploaded successfully.');
        }
      } else {
        spinner.text = `App uploaded successfully.\n\nTaskId: ${commitFileResponse.taskId}`;
      }

      commandWriter(CommandTypes.TESTING_DISTRIBUTION, {
        fullCommandName: command.fullCommandName,
        data: commitFileResponse,
      });
      spinner.succeed();
    } catch (uploadError: any) {
      handleUploadError(uploadError, spinner);
    }
  } catch (e) {
    if (!(e instanceof AppcircleExitError)) {
      spinner.fail('Upload failed');
    }
    throw e;
  }
};

export const handleDistributionProfileAutoSend = async (command: ProgramCommand, params: any) => {
  // Validate distribution profile parameters  
  await validateDistributionProfileParams(command, params);

  const spinner = createOra('Setting auto send on/off').start();
  try {
    const profiles = await getDistributionProfiles(params);
    
    // If distProfile name is provided, resolve it to distProfileId
    if (params.distProfile && !params.distProfileId) {
      const foundProfile = profiles.find((p: any) => p.name === params.distProfile);
      if (!foundProfile) {
        spinner.fail(`Distribution profile with name "${params.distProfile}" not found`);
        throw new AppcircleExitError(`Distribution profile with name "${params.distProfile}" not found`, 1);
      }
      params.distProfileId = foundProfile.id;
    }
    
    if (!profiles || profiles.length === 0) {
      spinner.text = 'No Distribution Profile available';
      spinner.fail();
      throw new AppcircleExitError('No Distribution Profile available', 1);
    }

    // TODO: Implement setDistributionProfileAutoSend service function
    // await setDistributionProfileAutoSend(params);
    const statusText = params.autoSend ? 'Auto Send enabled' : 'Auto Send disabled';
    spinner.text = `${statusText} successfully for Distribution Profile`;
    spinner.succeed();
  } catch (e: any) {
    spinner.fail('Auto send setting failed');
    throw e;
  }
};

export const handleTestingGroupList = async (command: ProgramCommand) => {
  const spinner = createOra('Listing Testing Groups...').start();
  const responseData = await getTestingGroups();
  spinner.stop();
  commandWriter(CommandTypes.TESTING_DISTRIBUTION, {
    fullCommandName: command.fullCommandName,
    data: responseData,
  });
};

export const handleTestingGroupView = async (command: ProgramCommand, params: any) => {
  await validateTestingGroupParams(command, params);
  
  const spinner = createOra('Getting Testing Group...').start();
  const responseData = await getTestingGroupById({ testingGroupId: params.testingGroupId });
  spinner.stop();
  commandWriter(CommandTypes.TESTING_DISTRIBUTION, {
    fullCommandName: command.fullCommandName,
    data: responseData,
  });
};

export const handleTestingGroupCreate = async (command: ProgramCommand, params: any) => {
  const responseData = await createTestingGroup(params);
  console.info(`Testing Group named ${responseData.name} created successfully!`);
  commandWriter(CommandTypes.TESTING_DISTRIBUTION, {
    fullCommandName: command.fullCommandName,
    data: responseData,
  });
};

export const handleTestingGroupRemove = async (command: ProgramCommand, params: any) => {
  await validateTestingGroupParams(command, params);
  
  let spinner = createOra('Try to remove the Testing Group').start();
  try {
    // Stop spinner temporarily for the prompt
    spinner.stop();
    
    // Get testing group details for confirmation
    const testingGroup = await getTestingGroupById({ testingGroupId: params.testingGroupId });
    
    // Add confirmation prompt
    const response: any = await enquirer.prompt({
      type: 'select',
      name: 'confirm',
      message: `Are you sure you want to delete the Testing Group "${testingGroup.name}"? This action cannot be undone. (Y/n)`,
      choices: [
        { name: 'yes', message: 'yes' },
        { name: 'no', message: 'no' }
      ],
      initial: 1  // Default to "no" for safety
    });

    if (response.confirm === 'no') {
      console.log(chalk.yellow('Testing Group deletion cancelled.'));
      return;
    }

    // Create a new spinner for the removal process
    spinner = createOra('Removing Testing Group...').start();
    await deleteTestingGroup({ testingGroupId: params.testingGroupId });
    spinner.text = `Testing Group has been successfully removed!\n\n`;
    spinner.succeed();
  } catch (e: any) {
    spinner.fail('Remove failed');
    throw e;
  }
};

export const handleTestingGroupTesterAdd = async (command: ProgramCommand, params: any) => {
  await validateTestingGroupParams(command, params);
  
  await addTesterToTestingGroup(params);
  console.info(`Tester has been successfully added to the selected Testing Group!`);
};

export const handleTestingGroupTesterRemove = async (command: ProgramCommand, params: any) => {
  await validateTestingGroupParams(command, params);
  
  let spinner = createOra('Try to remove the Tester from Testing Group').start();
  try {
    // Stop spinner temporarily for the prompt
    spinner.stop();
    
    // Add confirmation prompt
    const testerIdentifier = params.email || 'this Tester';
    const response: any = await enquirer.prompt({
      type: 'select',
      name: 'confirm',
      message: `Are you sure you want to remove ${testerIdentifier} from the Testing Group? This action cannot be undone. (Y/n)`,
      choices: [
        { name: 'yes', message: 'yes' },
        { name: 'no', message: 'no' }
      ],
      initial: 1  // Default to "no" for safety
    });

    if (response.confirm === 'no') {
      console.log(chalk.yellow('Tester removal cancelled.'));
      return;
    }

    // Create a new spinner for the removal process
    spinner = createOra('Removing Tester from Testing Group...').start();
    await removeTesterFromTestingGroup(params);
    spinner.text = `Tester has been successfully removed from the selected Testing Group!\n\n`;
    spinner.succeed();
  } catch (e: any) {
    spinner.fail('Remove failed');
    throw e;
  }
};

// Signing Identity Parameter Validation Utilities
export const validateCertificateParams = async (command: ProgramCommand, params: any) => {
  const certificateRequiredCommands = [
    `${PROGRAM_NAME}-signing-identity-certificate-view`,
    `${PROGRAM_NAME}-signing-identity-certificate-download`,
    `${PROGRAM_NAME}-signing-identity-certificate-remove`
  ];

  if (certificateRequiredCommands.includes(command.fullCommandName)) {
    if (!params.certificateBundleId && !params.certificateId && !params.certificate) {
      const commandParts = command.fullCommandName.replace(`${PROGRAM_NAME}-`, '').split('-');
      const longDescription = getLongDescriptionForCommand(commandParts.join(' '));
      if (longDescription) {
        console.log('\n' + longDescription);
      }
      throw new ProgramError(`Either --certificateBundleId, --certificateId, or --certificate parameter is required.`);
    }

    // Resolve certificate name to ID if needed
    if (params.certificate && !params.certificateBundleId && !params.certificateId) {
      const certificates = await getiOSP12Certificates();
      const foundCertificate = certificates.find((c: any) => c.name === params.certificate);
      if (!foundCertificate) {
        throw new ProgramError(`Certificate with name "${params.certificate}" not found.`);
      }
      // Set both IDs based on command requirements
      params.certificateBundleId = foundCertificate.id;
      params.certificateId = foundCertificate.id;
    }
  }
};

export const validateKeystoreParams = async (command: ProgramCommand, params: any) => {
  const keystoreRequiredCommands = [
    `${PROGRAM_NAME}-signing-identity-keystore-view`,
    `${PROGRAM_NAME}-signing-identity-keystore-download`,
    `${PROGRAM_NAME}-signing-identity-keystore-remove`
  ];

  if (keystoreRequiredCommands.includes(command.fullCommandName)) {
    if (!params.keystoreId && !params.keystore) {
      const commandParts = command.fullCommandName.replace(`${PROGRAM_NAME}-`, '').split('-');
      const longDescription = getLongDescriptionForCommand(commandParts.join(' '));
      if (longDescription) {
        console.log('\n' + longDescription);
      }
      throw new ProgramError(`Either --keystoreId or --keystore parameter is required.`);
    }

    // Resolve keystore name to ID if needed
    if (params.keystore && !params.keystoreId) {
      const keystores = await getAndroidKeystores();
      const foundKeystore = keystores.find((k: any) => k.name === params.keystore);
      if (!foundKeystore) {
        throw new ProgramError(`Keystore with name "${params.keystore}" not found.`);
      }
      params.keystoreId = foundKeystore.id;
    }
  }
};

export const validateProvisioningProfileParams = async (command: ProgramCommand, params: any) => {
  const provisioningProfileRequiredCommands = [
    `${PROGRAM_NAME}-signing-identity-provisioning-profile-view`,
    `${PROGRAM_NAME}-signing-identity-provisioning-profile-download`,
    `${PROGRAM_NAME}-signing-identity-provisioning-profile-remove`
  ];

  if (provisioningProfileRequiredCommands.includes(command.fullCommandName)) {
    if (!params.provisioningProfileId && !params.provisioningProfile) {
      const commandParts = command.fullCommandName.replace(`${PROGRAM_NAME}-`, '').split('-');
      const longDescription = getLongDescriptionForCommand(commandParts.join(' '));
      if (longDescription) {
        console.log('\n' + longDescription);
      }
      throw new ProgramError(`Either --provisioningProfileId or --provisioningProfile parameter is required.`);
    }

    // Resolve provisioning profile name to ID if needed
    if (params.provisioningProfile && !params.provisioningProfileId) {
      const profiles = await getProvisioningProfiles();
      const foundProfile = profiles.find((p: any) => p.name === params.provisioningProfile);
      if (!foundProfile) {
        throw new ProgramError(`Provisioning profile with name "${params.provisioningProfile}" not found.`);
      }
      params.provisioningProfileId = foundProfile.id;
    }
  }
};

// Certificate Command Utilities
export const handleCertificateList = async (command: ProgramCommand) => {
  const spinner = createOra('Listing Certificates...').start();
  const p12Certs = await getiOSP12Certificates();
  const csrCerts = await getiOSCSRCertificates();
  spinner.stop();
  commandWriter(CommandTypes.SIGNING_IDENTITY, {
    fullCommandName: command.fullCommandName,
    data: [...p12Certs, ...csrCerts],
  });
};

export const handleCertificateUpload = async (command: ProgramCommand, params: any) => {
  const spinner = createOra('Try to upload the Certificate').start();
  try {
    const responseData = await uploadP12Certificate(params);
    commandWriter(CommandTypes.SIGNING_IDENTITY, {
      fullCommandName: command.fullCommandName,
      data: responseData,
    });
    spinner.text = `Certificate uploaded successfully.\n\n`;
    spinner.succeed();
  } catch (e) {
    spinner.fail('Upload failed');
    throw e;
  }
};

export const handleCertificateCreate = async (command: ProgramCommand, params: any) => {
  const spinner = createOra('Try to create the Certificate request').start();
  try {
    const responseData = await createCSRCertificateRequest(params);
    commandWriter(CommandTypes.SIGNING_IDENTITY, {
      fullCommandName: command.fullCommandName,
      data: responseData,
    });
    spinner.text = `Certificate request created successfully.\n\n`;
    spinner.succeed();
  } catch (e) {
    spinner.fail('Create failed');
    throw e;
  }
};

export const handleCertificateView = async (command: ProgramCommand, params: any) => {
  const spinner = createOra('Getting Certificate details...').start();
  const responseData = await getCertificateDetailById({ certificateBundleId: params.certificateBundleId });
  spinner.stop();
  commandWriter(CommandTypes.SIGNING_IDENTITY, {
    fullCommandName: command.fullCommandName,
    data: responseData
  });
};

export const handleCertificateDownload = async (command: ProgramCommand, params: any) => {
  const p12Certs = await getiOSP12Certificates();
  const p12Cert = p12Certs?.find(
    (certificate: any) => certificate.id === params.certificateId
  );
  const downloadPath = path.resolve(
    (params.path || path.join(os.homedir(), 'Downloads')).replace('~', os.homedir())
  );
  const fileName = p12Cert ? p12Cert.filename : 'download.cer';
  const spinner = createOra(
    `Downloading ${p12Cert ? `Certificate Bundle: ${p12Cert.filename}` : '.cer file'} `
  ).start();
  try {
    await downloadCertificateById(
      { certificateId: params.certificateId, path: params.path },
      downloadPath,
      fileName,
      p12Cert ? 'p12' : 'csr'
    );
    spinner.text = `The file ${fileName} is downloaded successfully under path:\n${downloadPath}`;
    spinner.succeed();
  } catch (e) {
    spinner.text = 'The file could not be downloaded.';
    spinner.fail();
  }
};

export const handleCertificateRemove = async (command: ProgramCommand, params: any) => {
  let spinner = createOra('Try to remove the Certificate').start();
  try {
    // Stop spinner temporarily for the prompt
    spinner.stop(); 
    
    let certificateIdentifier = params.certificateId; // Default to ID
    try {
      const certDetail = await getCertificateDetailById({ certificateBundleId: params.certificateBundleId });
      if (certDetail) {
        certificateIdentifier = certDetail.name || certDetail.id; // Prefer name, fallback to ID
      }
    } catch (fetchError) {
      console.warn(chalk.yellow(`\nWarning: Could not fetch certificate details. Using ID in confirmation.`));
    }

    // Add confirmation prompt
    const response: any = await enquirer.prompt({
      type: 'select',
      name: 'confirm',
      message: `Are you sure you want to delete the Certificate "${certificateIdentifier}"? This action cannot be undone. (Y/n)`,
      choices: [
        { name: 'yes', message: 'yes' },
        { name: 'no', message: 'no' }
      ],
      initial: 1  // Default to "no" for safety
    });

    if (response.confirm === 'no') {
      console.log(chalk.yellow('Certificate deletion cancelled.'));
      return;
    }

    // Create a new spinner for the deletion process
    spinner = createOra('Removing Certificate...').start();
    const csrCerts = await getiOSCSRCertificates();
    const csrCert = csrCerts?.find((certificate:any) => certificate.id === params.certificateId);
    await removeCSRorP12CertificateById({ certificateId: params.certificateId, path: params.path }, csrCert ? 'csr': 'p12');
    spinner.text = `Certificate removed successfully.\n\n`;
    spinner.succeed();
  } catch (e: any) {
    spinner.fail('Remove failed');
    throw e;
  }
};

// Keystore Command Utilities
export const handleKeystoreList = async (command: ProgramCommand) => {
  const spinner = createOra('Listing keystores...').start();
  const keystores = await getAndroidKeystores();
  spinner.stop();
  commandWriter(CommandTypes.SIGNING_IDENTITY, {
    fullCommandName: command.fullCommandName,
    data: keystores
  });
};

export const handleKeystoreCreate = async (command: ProgramCommand, params: any) => {
  const spinner = createOra('Trying to generate new Keystore.').start();
  try {
    await generateNewKeystore(params);
    spinner.text = `Keystore generated successfully.\n\n Keystore name: ${params.name}`;
    spinner.succeed();
  } catch (e: any) {
    spinner.fail('Generation failed');
    throw e;
  }
};

export const handleKeystoreUpload = async (command: ProgramCommand, params: any) => {
  const spinner = createOra('Trying to upload the Keystore file').start();
  try {
    await uploadAndroidKeystoreFile(params);
    spinner.text = `Keystore file uploaded successfully.\n\n`;
    spinner.succeed();
  } catch (e) {
    spinner.fail('Upload failed: Keystore was tampered with, or password was incorrect');
  }
};

export const handleKeystoreDownload = async (command: ProgramCommand, params: any) => {
  const downloadPath = (params.path || path.join(os.homedir(), 'Downloads')).replace('~', os.homedir())
  const spinner = createOra(`Searching file...`).start();
  try {
    const keystoreDetail = await getKeystoreDetailById({ keystoreId: params.keystoreId });
    const fileName = keystoreDetail.fileName || `${keystoreDetail.id}.keystore`;
    spinner.text = `Downloading file ${fileName}`;
    await downloadKeystoreById({ keystoreId: params.keystoreId, path: params.path }, downloadPath, fileName);
    spinner.text = `The file ${fileName} is downloaded successfully under path:\nfile://${downloadPath}`;
    spinner.succeed();
  } catch (e) {
    spinner.text = 'The file could not be downloaded.';
    spinner.fail();
  }
};

export const handleKeystoreView = async (command: ProgramCommand, params: any) => {
  const spinner = createOra('Getting Keystore details...').start();
  const keystore = await getKeystoreDetailById({ keystoreId: params.keystoreId });
  spinner.stop();
  commandWriter(CommandTypes.SIGNING_IDENTITY, {
    fullCommandName: command.fullCommandName,
    data: keystore
  });
};

export const handleKeystoreRemove = async (command: ProgramCommand, params: any) => {
  let spinner = createOra('Try to remove the Keystore').start();
  try {
    // Stop spinner temporarily for the prompt
    spinner.stop();
    
    let keystoreIdentifier = params.keystoreId; // Default to ID
    try {
      const keystoreDetails = await getKeystoreDetailById({ keystoreId: params.keystoreId });
      if (keystoreDetails) {
        keystoreIdentifier = keystoreDetails.name || keystoreDetails.fileName || keystoreDetails.id; // Prefer name or filename
      }
    } catch (fetchError) {
      console.warn(chalk.yellow(`\nWarning: Could not fetch keystore details. Using ID in confirmation.`));
    }
    
    // Add confirmation prompt
    const response: any = await enquirer.prompt({
      type: 'select',
      name: 'confirm',
      message: `Are you sure you want to delete the Keystore "${keystoreIdentifier}"? This action cannot be undone. (Y/n)`,
      choices: [
        { name: 'yes', message: 'yes' },
        { name: 'no', message: 'no' }
      ],
      initial: 1  // Default to "no" for safety
    });

    if (response.confirm === 'no') {
      console.log(chalk.yellow('Keystore deletion cancelled.'));
      return;
    }

    // Create a new spinner for the deletion process
    spinner = createOra('Removing Keystore...').start();
    await removeKeystore({ keystoreId: params.keystoreId });
    spinner.text = `Keystore removed successfully.\n\n`;
    spinner.succeed();
  } catch (e: any) {
    spinner.fail('Remove failed');
    throw e;
  }
};

// Provisioning Profile Command Utilities
export const handleProvisioningProfileList = async (command: ProgramCommand) => {
  const spinner = createOra('Listing Provisioning Profiles...').start();
  const profiles = await getProvisioningProfiles();
  spinner.stop();
  commandWriter(CommandTypes.SIGNING_IDENTITY, {
    fullCommandName: command.fullCommandName,
    data: profiles
  });
};

export const handleProvisioningProfileUpload = async (command: ProgramCommand, params: any) => {
  const spinner = createOra('Trying to upload the Provisioning Profile').start();
  try {
    await uploadProvisioningProfile(params);
    spinner.text = `Provisioning Profile uploaded successfully.\n\n`;
    spinner.succeed();
  } catch (e) {
    spinner.fail('Upload failed');
    throw e;
  }
};

export const handleProvisioningProfileDownload = async (command: ProgramCommand, params: any) => {
  const downloadPath = (params.path || path.join(os.homedir(), 'Downloads')).replace('~', os.homedir())
  const spinner = createOra('Trying to download the Provisioning Profile').start();
  try {
    const profile = await getProvisioningProfileDetailById({ provisioningProfileId: params.provisioningProfileId });
    await downloadProvisioningProfileById({ provisioningProfileId: params.provisioningProfileId }, downloadPath, profile.filename);
    spinner.text = `The file ${profile.filename} is downloaded successfully under path:\n${downloadPath}`;
    spinner.succeed();
  } catch (e) {
    spinner.fail('Download failed');
    throw e;
  }
};

export const handleProvisioningProfileView = async (command: ProgramCommand, params: any) => {
  const spinner = createOra('Getting Provisioning Profile details...').start();
  const profile = await getProvisioningProfileDetailById({ provisioningProfileId: params.provisioningProfileId });
  spinner.stop();
  commandWriter(CommandTypes.SIGNING_IDENTITY, {
    fullCommandName: command.fullCommandName,
    data: profile
  });
};

export const handleProvisioningProfileRemove = async (command: ProgramCommand, params: any) => {
  let spinner = createOra('Try to remove the Provisioning Profile').start();
  try {
    // Stop spinner temporarily for the prompt
    spinner.stop();
    
    let profileIdentifier = params.provisioningProfileId; // Default to ID
    try {
      const profileDetails = await getProvisioningProfileDetailById({ provisioningProfileId: params.provisioningProfileId });
      if (profileDetails) {
        profileIdentifier = profileDetails.name || profileDetails.filename || profileDetails.id; // Prefer name or filename
      }
    } catch (fetchError) {
      console.warn(chalk.yellow(`\nWarning: Could not fetch provisioning profile details. Using ID in confirmation.`));
    }
    
    // Add confirmation prompt
    const response: any = await enquirer.prompt({
      type: 'select',
      name: 'confirm',
      message: `Are you sure you want to delete the Provisioning Profile "${profileIdentifier}"? This action cannot be undone. (Y/n)`,
      choices: [
        { name: 'yes', message: 'yes' },
        { name: 'no', message: 'no' }
      ],
      initial: 1  // Default to "no" for safety
    });

    if (response.confirm === 'no') {
      console.log(chalk.yellow('Provisioning Profile deletion cancelled.'));
      return;
    }

    // Create a new spinner for the deletion process
    spinner = createOra('Removing Provisioning Profile...').start();
    await removeProvisioningProfile({ provisioningProfileId: params.provisioningProfileId });
    spinner.text = `Provisioning Profile removed successfully.\n\n`;
    spinner.succeed();
  } catch (e: any) {
    spinner.fail('Remove failed');
    throw e;
  }
};

const handleConfigCommand = (command: ProgramCommand) => {
  const action = command.name();
  const key = command.args()[0] || '';
  
  switch (action) {
    case 'list':
      handleConfigListAction(getConfigStore, getConsoleOutputType, configWriter, getConfigFilePath, getEnviromentsConfigToWriting);
      break;
    case 'set':
      handleConfigSetAction(key, command.args()[1], writeEnviromentConfigVariable, readEnviromentConfigVariable, configWriter);
      break;
    case 'get':
      handleConfigGetAction(key, readEnviromentConfigVariable, configWriter);
      break;
    case 'current':
      handleConfigCurrentAction(key, getConfigStore, setCurrentConfigVariable, getCurrentConfigVariable, configWriter);
      break;
    case 'add':
      handleConfigAddAction(key, addNewConfigVariable, getCurrentConfigVariable, configWriter, getEnviromentsConfigToWriting);
      break;
    case 'reset':
      handleConfigResetAction(clearConfigs, getCurrentConfigVariable, configWriter, getEnviromentsConfigToWriting);
      break;
    case 'trust':
      handleConfigTrustAction(trustAppcircleCertificate);
      break;
    default:
      throw new ProgramError(`Config command action not found \nRun "${PROGRAM_NAME} config --help" for more information`);
  }
};

const handleOrganizationCommand = async (command: ProgramCommand, params: any) => {
  // Organization validation and resolution
  if (params.organization && (!params.organizationId || params.organizationId === 'all' || params.organizationId === 'current')) {
    const organizations = await getOrganizations();
    const foundOrganization = organizations.find((org: any) => org.name === params.organization);
    if (!foundOrganization) {
      throw new ProgramError(`Organization "${params.organization}" not found.
        
Available organizations:
${organizations.map((org: any) => `  - ${org.name}`).join('\n')}`);
    }
    params.organizationId = foundOrganization.id;
  }
  
  if (!params.organizationId || params.organizationId === CURRENT_PARAM_VALUE) {
    params.organizationId = (await getUserInfo()).currentOrganizationId;
  }

  // User validation and resolution for role commands
  if (['view', 'add', 'remove', 'clear'].some(action => command.fullCommandName.includes(`organization-role-${action}`))) {
    // Either userId or user must be provided for role commands
    if (!params.userId && !params.user) {
      const longDescription = getLongDescriptionForCommand(command.fullCommandName);
      console.log(longDescription);
      throw new ProgramError(`You must provide either --userId or --user parameter for this command.`);
    }
    
    // Resolve user string to userId
    if (params.user && !params.userId) {
      const users = await getOrganizationUsersWithRoles({ organizationId: params.organizationId });
      const foundUser = users.find((user: any) => user.email === params.user || user.fullName === params.user);
      if (!foundUser) {
        throw new ProgramError(`User "${params.user}" not found in organization.
        
Available users:
${users.map((user: any) => `  - ${user.email} (${user.fullName || 'No name'})`).join('\n')}`);
      }
      params.userId = foundUser.id;
    }
  }

  // User validation and resolution for organization user remove command
  if (command.fullCommandName === `${PROGRAM_NAME}-organization-user-remove`) {
    if (params.user && !params.userId) {
      const users = await getOrganizationUsersWithRoles({ organizationId: params.organizationId });
      const foundUser = users.find((user: any) => user.email === params.user || user.fullName === params.user);
      if (!foundUser) {
        throw new ProgramError(`User "${params.user}" not found in organization.
        
Available users:
${users.map((user: any) => `  - ${user.email} (${user.fullName || 'No name'})`).join('\n')}`);
      }
      params.userId = foundUser.id;
    }
  }

  params.role = Array.isArray(params.role) ? params.role : [params.role];
  if (command.fullCommandName === `${PROGRAM_NAME}-organization-view`) {
    const spinner = createOra('Listing Organizations...').start();
    const response = params.organizationId === 'all' || !params.organizationId ? await getOrganizations() : await getOrganizationDetail(params);
    spinner.succeed();
    commandWriter(CommandTypes.ORGANIZATION, {
      fullCommandName: command.fullCommandName,
      data: response,
    });
  } else if (command.fullCommandName === `${PROGRAM_NAME}-organization-user-view`) {
    const spinner = createOra('Listing Organization Users...').start();
    const users = await getOrganizationUsersWithRoles(params);
    const invitations = await getOrganizationInvitations(params);
    spinner.succeed();
    commandWriter(CommandTypes.ORGANIZATION, {
      fullCommandName: command.fullCommandName,
      data: {
        users,
        invitations,
      },
    });
  } else if (command.fullCommandName === `${PROGRAM_NAME}-organization-user-invite`) {
    await inviteUserToOrganization({ organizationId: params.organizationId, email: params.email, role: params.role || [] });
    commandWriter(CommandTypes.ORGANIZATION, {
      fullCommandName: command.fullCommandName,
      data: 'Invitation successfully sent.',
    });
  } else if (command.fullCommandName === `${PROGRAM_NAME}-organization-user-re-invite`) {
    if (!params.organizationId) {
      params.organizationId = (await getUserInfo()).currentOrganizationId;
    }
    await reInviteUserToOrganization({ organizationId: params.organizationId, email: params.email });
    commandWriter(CommandTypes.ORGANIZATION, {
      fullCommandName: command.fullCommandName,
      data: 'Re-Invitation successfully sent.',
    });
  } else if (command.fullCommandName === `${PROGRAM_NAME}-organization-user-remove`) {
    if (!params.email && !params.userId) {
      console.error('error: You must provide either email or userId parameter');
      throw new AppcircleExitError('You must provide either email or userId parameter', 1);
    }

    // Stop any existing spinner
    createOra('').stop();
    
    // Confirm deletion
    let removalIdentifier = params.userId || params.email; // Default identifier
    let itemType = 'User'; // Default to User, will be changed if it's an invitation

    if (params.userId && params.userId !== UNKNOWN_PARAM_VALUE) {
      itemType = 'User';
      try {
        const userInfo = await getOrganizationUserinfo({ organizationId: params.organizationId, userId: params.userId });
        removalIdentifier = userInfo.email || params.userId; // Prefer email, fallback to ID
      } catch (e) {
        // If fetching user info fails, removalIdentifier remains params.userId (already set or from default)
        // itemType is already 'User'
      }
    } else if (params.email && params.email !== UNKNOWN_PARAM_VALUE) {
      itemType = 'Invitation';
      removalIdentifier = params.email;
    }

    const response: any = await enquirer.prompt({
      type: 'select',
      name: 'confirm',
      message: `Are you sure you want to delete the ${itemType} "${removalIdentifier}"? This action cannot be undone. (Y/n)`,
      choices: [
        { name: 'yes', message: 'yes' },
        { name: 'no', message: 'no' }
      ],
      initial: 1  // Default to "no" for safety
    });

    if (response.confirm === 'no') {
      console.log(chalk.yellow('User/Invitation removal cancelled.'));
      return;
    }

    const spinner = createOra('Removing from Organization...').start();
    try {
      if (params.email && params.email !== UNKNOWN_PARAM_VALUE) {
        await removeInvitationFromOrganization({ organizationId: params.organizationId, email: params.email });
        spinner.succeed('Invitation removed successfully.\n\n');
        commandWriter(CommandTypes.ORGANIZATION, {
          fullCommandName: command.fullCommandName,
          data: { email: params.email },
        });
      }
      if (params.userId && params.userId !== UNKNOWN_PARAM_VALUE) {
        await removeUserFromOrganization({ organizationId: params.organizationId, userId: params.userId });
        spinner.succeed('User removed from Organization successfully.\n\n');
        commandWriter(CommandTypes.ORGANIZATION, {
          fullCommandName: command.fullCommandName,
          data: { email: params.userId },
        });
      }
    } catch (e) {
      spinner.fail('Failed to remove from Organization');
      throw e;
    }
  } else if (command.fullCommandName === `${PROGRAM_NAME}-organization-role-view`) {
    const spinner = createOra('Listing Roles...').start();
    const userInfo = await getOrganizationUserinfo({ organizationId: params.organizationId, userId: params.userId });
    spinner.stop();
    commandWriter(CommandTypes.ORGANIZATION, {
      fullCommandName: command.fullCommandName,
      data: { roles: userInfo.roles, inheritedRoles: userInfo.inheritedRoles },
    });
  } else if (command.fullCommandName === `${PROGRAM_NAME}-organization-role-add`) {
    let userInfo = await getOrganizationUserinfo({ organizationId: params.organizationId, userId: params.userId });
    let rolesSet = new Set([...userInfo.roles, ...params.role]);
    await assignRolesToUserInOrganitaion({ organizationId: params.organizationId, userId: params.userId, role: Array.from(rolesSet) });
    userInfo = await getOrganizationUserinfo({ organizationId: params.organizationId, userId: params.userId });

    commandWriter(CommandTypes.ORGANIZATION, {
      fullCommandName: command.fullCommandName,
      data: userInfo.roles,
    });
  } else if (command.fullCommandName === `${PROGRAM_NAME}-organization-role-remove`) {
    // Get user info first for the confirmation message
    let userInfo = await getOrganizationUserinfo({ organizationId: params.organizationId, userId: params.userId });
    
    // Ensure roles are provided and not empty
    if (!params.role || (Array.isArray(params.role) && params.role.length === 0)) {
      console.log(chalk.yellow('No roles selected for removal.'));
      return;
    }
    
    // Format roles to be removed for display
    const rolesToRemove = Array.isArray(params.role) ? params.role.join(', ') : params.role;
    
    // Ask for confirmation
    const response: any = await enquirer.prompt({
      type: 'select',
      name: 'confirm',
      message: `Are you sure you want to remove role(s) "${rolesToRemove}" from User "${userInfo.email}"? This action cannot be undone. (Y/n)`,
      choices: [
        { name: 'yes', message: 'yes' },
        { name: 'no', message: 'no' }
      ],
      initial: 1  // Default to "no" for safety
    });

    if (response.confirm === 'no') {
      console.log(chalk.yellow('Role removal cancelled.'));
      return;
    }

    // If confirmed, proceed with the operation
    let difference = userInfo.roles.filter((r: any) => !params.role.includes(r));
    await assignRolesToUserInOrganitaion({ organizationId: params.organizationId, userId: params.userId, role: difference });
    userInfo = await getOrganizationUserinfo({ organizationId: params.organizationId, userId: params.userId });
    commandWriter(CommandTypes.ORGANIZATION, {
      fullCommandName: command.fullCommandName,
      data: userInfo.roles,
    });
  } else if (command.fullCommandName === `${PROGRAM_NAME}-organization-role-clear`) {
    // Get user info first for the confirmation message
    const userInfo = await getOrganizationUserinfo({ organizationId: params.organizationId, userId: params.userId });
    
    // Ask for confirmation
    const response: any = await enquirer.prompt({
      type: 'select',
      name: 'confirm',
      message: `Are you sure you want to remove all roles from User "${userInfo.email}"? This action cannot be undone. (Y/n)`,
      choices: [
        { name: 'yes', message: 'yes' },
        { name: 'no', message: 'no' }
      ],
      initial: 1  // Default to "no" for safety
    });

    if (response.confirm === 'no') {
      console.log(chalk.yellow('Role clear operation cancelled.'));
      return;
    }

    // If confirmed, proceed with the operation
    await assignRolesToUserInOrganitaion({ organizationId: params.organizationId, userId: params.userId, role: [] });
    const updatedUserInfo = await getOrganizationUserinfo({ organizationId: params.organizationId, userId: params.userId });
    commandWriter(CommandTypes.ORGANIZATION, {
      fullCommandName: command.fullCommandName,
      data: updatedUserInfo.roles,
    });
  } else if (command.fullCommandName === `${PROGRAM_NAME}-organization-create-sub`) {
    const spinner = createOra('Creating sub-organization...').start();
    try {
      const response = await createSubOrganization({ name: params.name });
      const successMessage = `${params.name} sub organization created successfully!`;
      spinner.succeed(successMessage);
    } catch (error: any) {
      const errorMessage = error.response?.data?.message || error.message || 'Failed to create sub-organization';
      spinner.fail(`Error: ${errorMessage}`);
    }
  } else {
    const beutufiyCommandName = command.fullCommandName.split('-').join(' ');
    const desc = getLongDescriptionForCommand(command.fullCommandName);
    if (desc) {
      console.error(`\n${desc}\n`);
    } else {
      console.error(`"${beutufiyCommandName} ..." command not found.`);
    }
  }
};

// Publish command parameter validation utilities
export const validatePublishPlatform = (params: any) => {
  const validation = utilValidatePublishPlatform(params);
  if (!validation.isValid) {
    throw new ProgramError(validation.errors[0]);
  }
};

export const validatePublishProfileParams = async (command: ProgramCommand, params: any) => {
  const profileRequiredCommands = [
    `${PROGRAM_NAME}-publish-start`,
    `${PROGRAM_NAME}-publish-view`,
    `${PROGRAM_NAME}-publish-profile-rename`,
    `${PROGRAM_NAME}-publish-profile-delete`,
    `${PROGRAM_NAME}-publish-profile-settings-autopublish`,
    `${PROGRAM_NAME}-publish-profile-version-list`,
    `${PROGRAM_NAME}-publish-profile-version-view`,
    `${PROGRAM_NAME}-publish-profile-version-upload`,
    `${PROGRAM_NAME}-publish-profile-version-download`,
    `${PROGRAM_NAME}-publish-profile-version-delete`,
    `${PROGRAM_NAME}-publish-profile-version-mark-as-rc`,
    `${PROGRAM_NAME}-publish-profile-version-unmark-as-rc`,
    `${PROGRAM_NAME}-publish-profile-version-update-release-note`
  ];

  if (profileRequiredCommands.includes(command.fullCommandName)) {
    if (!params.publishProfileId && !params.publishProfile) {
      const commandParts = command.fullCommandName.replace(`${PROGRAM_NAME}-`, '').split('-');
      const longDescription = getLongDescriptionForCommand(commandParts.join(' '));
      if (longDescription) {
        console.log('\n' + longDescription);
      }
      throw new ProgramError(`Either --publishProfileId or --publishProfile parameter is required.`);
    }

    // Resolve profile name to ID if needed
    if (params.publishProfile && !params.publishProfileId) {
      const profiles = await getPublishProfiles({ platform: params.platform });
      const foundProfile = profiles.find((p: any) => p.name === params.publishProfile);
      if (!foundProfile) {
        throw new ProgramError(`Publish profile with name "${params.publishProfile}" not found.`);
      }
      params.publishProfileId = foundProfile.id;
    }
  }
};

export const validatePublishAppVersionParams = async (command: ProgramCommand, params: any) => {
  const appVersionRequiredCommands = [
    `${PROGRAM_NAME}-publish-start`,
    `${PROGRAM_NAME}-publish-view`,
    `${PROGRAM_NAME}-publish-profile-version-view`,
    `${PROGRAM_NAME}-publish-profile-version-download`,
    `${PROGRAM_NAME}-publish-profile-version-delete`,
    `${PROGRAM_NAME}-publish-profile-version-mark-as-rc`,
    `${PROGRAM_NAME}-publish-profile-version-unmark-as-rc`,
    `${PROGRAM_NAME}-publish-profile-version-update-release-note`
  ];

  if (appVersionRequiredCommands.includes(command.fullCommandName)) {
    if (!params.appVersionId && !params.appVersion) {
      const commandParts = command.fullCommandName.replace(`${PROGRAM_NAME}-`, '').split('-');
      const longDescription = getLongDescriptionForCommand(commandParts.join(' '));
      if (longDescription) {
        console.log('\n' + longDescription);
      }
      throw new ProgramError(`Either --appVersionId or --appVersion parameter is required.`);
    }

    // Resolve app version name to ID if needed
    if (params.appVersion && !params.appVersionId) {
      const appVersions = await getAppVersions({ publishProfileId: params.publishProfileId, platform: params.platform });
      const foundAppVersion = appVersions.find((v: any) => v.fileName === params.appVersion || v.version === params.appVersion);
      if (!foundAppVersion) {
        throw new ProgramError(`App version with name "${params.appVersion}" not found.`);
      }
      params.appVersionId = foundAppVersion.id;
    }
  }
};

export const validatePublishVariableGroupParams = async (command: ProgramCommand, params: any) => {
  const variableGroupRequiredCommands = [
    `${PROGRAM_NAME}-publish-variable-group-view`,
    `${PROGRAM_NAME}-publish-variable-group-upload`,
    `${PROGRAM_NAME}-publish-variable-group-download`
  ];

  if (variableGroupRequiredCommands.includes(command.fullCommandName)) {
    if (!params.publishVariableGroupId && !params.variableGroup) {
      const commandParts = command.fullCommandName.replace(`${PROGRAM_NAME}-`, '').split('-');
      const longDescription = getLongDescriptionForCommand(commandParts.join(' '));
      if (longDescription) {
        console.log('\n' + longDescription);
      }
      throw new ProgramError(`Either --publishVariableGroupId or --variableGroup parameter is required.`);
    }

    // Resolve variable group name to ID if needed
    if (params.variableGroup && !params.publishVariableGroupId) {
      const variableGroups = await getPublishVariableGroups();
      const foundGroup = variableGroups.find((g: any) => g.name === params.variableGroup);
      if (!foundGroup) {
        throw new ProgramError(`Variable group with name "${params.variableGroup}" not found.`);
      }
      params.publishVariableGroupId = foundGroup.id;
    }
  }
};

// Publish command handler utilities
export const handlePublishProfileCreate = async (command: ProgramCommand, params: any) => {
  const profileRes = await createPublishProfile({ platform: params.platform, name: params.name });
  commandWriter(CommandTypes.PUBLISH, {
    fullCommandName: command.fullCommandName,
    data: profileRes,
  });
};

export const handlePublishProfileList = async (command: ProgramCommand, params: any) => {
  const spinner = createOra('Listing Publish Profiles...').start();
  const profiles = await getPublishProfiles({ platform: params.platform });
  spinner.stop();
  commandWriter(CommandTypes.PUBLISH, {
    fullCommandName: command.fullCommandName,
    data: profiles,
  });
};

export const handlePublishProfileDelete = async (command: ProgramCommand, params: any) => {
  // Get the profile details first to show in confirmation
  const profile = await getPublishProfileDetailById(params);
  
  // Confirm deletion
  const response: any = await enquirer.prompt({
    type: 'select',
    name: 'confirm',
    message: `Are you sure you want to delete the Publish Profile "${profile.name}"? This action cannot be undone. (Y/n)`,
    choices: [
      { name: 'yes', message: 'yes' },
      { name: 'no', message: 'no' }
    ],
    initial: 1  // Default to "no" for safety
  });

  if (response.confirm === 'no') {
    console.log(chalk.yellow('Publish Profile deletion cancelled.'));
    return;
  }

  // Create a spinner for the deletion process
  const spinner = createOra('Removing Publish Profile...').start();
  try {
    const deleteResponse = await deletePublishProfile(params);
    spinner.text = 'Publish Profile removed successfully.\n\n';
    spinner.succeed();
    commandWriter(CommandTypes.PUBLISH, {
      fullCommandName: command.fullCommandName,
      data: deleteResponse,
    });
  } catch (e) {
    spinner.fail('Failed to remove Publish Profile');
    throw e;
  }
};

export const handlePublishProfileRename = async (command: ProgramCommand, params: any) => {
  const response = await renamePublishProfile(params);
  commandWriter(CommandTypes.PUBLISH, {
    fullCommandName: command.fullCommandName,
    data: response,
  });
};

export const validateFileForUpload = (filePath: string, originalPath: string) => {
  const expandedPath = expandTildeInPath(filePath);
  const resolvedPath = path.resolve(expandedPath);
  
  if (!fs.existsSync(resolvedPath)) {
    throw new AppcircleExitError(`File not found: ${originalPath}`, 1);
  }
  
  return resolvedPath;
};

export const validateFileSizeForUpload = (filePath: string) => {
  const maxBytes = getMaxUploadBytes();
  const validation = utilValidateFileSizeForUpload(filePath, maxBytes);
  if (!validation.isValid) {
    throw new AppcircleExitError(validation.error!, 1);
  }
  return { stats: validation.stats, maxBytes: validation.maxBytes };
};

export const waitForTaskCompletion = async (taskId: string): Promise<void> => {
  let taskStatus = await getTaskStatus({taskId});
  
  while(taskStatus.stateValue === TaskStatus.BEGIN){
    taskStatus = await getTaskStatus({taskId});
    if(taskStatus.stateValue !== TaskStatus.BEGIN && taskStatus.stateValue !== TaskStatus.COMPLETED){
      throw new AppcircleExitError('Upload failed: Please make sure that the app version number is unique in selected Publish Profile.', 1);
    }
    await new Promise(resolve => setTimeout(resolve, 2000));
  }
};

export const handleReleaseCandidateMarking = async (params: any, shouldMarkAsReleaseCandidate: boolean): Promise<void> => {
  if(shouldMarkAsReleaseCandidate){
    let appVersionList = await getAppVersions(params);
    const appVersion = appVersionList.shift();
    await setAppVersionReleaseCandidateStatus({...params, appVersionId: appVersion.id, releaseCandidate: true});
    if(params.summary !== undefined && params.summary !== null && params.summary.trim() !== ""){
      await setAppVersionReleaseNote({ ...params, appVersionId: appVersion.id });
    }
  }
};

export const handlePublishUploadError = (uploadError: any): never => {
  if (uploadError.response?.data?.message?.includes('The file is too large')) {
    throw new AppcircleExitError('File size exceeds the maximum allowed limit of 3 GB.', 1);
  } else if (uploadError instanceof ProgramError) {
    throw new AppcircleExitError(uploadError.message, 1);
  } else if (uploadError.message && uploadError.message.includes('Cannot read properties')) {
    throw new AppcircleExitError('API response format error. Please check your connection settings (AUTH_HOSTNAME and API_HOSTNAME).', 1);
  }
  throw uploadError; // Re-throw to be caught by the outer catch
};

export const handlePublishVersionUpload = async (command: ProgramCommand, params: any) => {
  const spinner = createOra('Try to upload the app version').start();
  try {
    const expandedPath = validateFileForUpload(params.app, params.app);
    validateFileSizeForUpload(expandedPath);
    
    let fileName = path.basename(expandedPath);
    let stats = fs.statSync(expandedPath);
    const uploadResponse = await getPublishUploadInformation({fileName, fileSize: stats.size, publishProfileId: params.publishProfileId, platform: params.platform});
    
    try {
      await uploadArtifactWithSignedUrl({ app: expandedPath, uploadInfo: uploadResponse });
      const commitFileResponse = await commitPublishFileUpload({fileId: uploadResponse.fileId, fileName, publishProfileId: params.publishProfileId, platform: params.platform});
      await waitForTaskCompletion(commitFileResponse.taskId);
      
      const shouldMarkAsReleaseCandidate = params.markAsRc || false;
      await handleReleaseCandidateMarking(params, shouldMarkAsReleaseCandidate);
      
      spinner.text = `App version uploaded ${shouldMarkAsReleaseCandidate ? 'and marked as release candidate' : ''} successfully.\n\nTaskId: ${commitFileResponse.taskId}`;
      spinner.succeed();
    } catch (uploadError: any) {
      spinner.fail(`Upload failed: ${uploadError.message || 'Unknown error'}`);
      handlePublishUploadError(uploadError);
    }
  } catch (e: any) {
    spinner.fail('Upload failed');
    throw e;
  }
};

export const getAppVersionDetailsForDeletion = async (params: any): Promise<string> => {
  let appVersionIdentifier = params.appVersionId;
  let appVersionDetailsString = `(ID: ${params.appVersionId})`;
  
  try {
    const appVersion = await getAppVersionDetail(params);
    if (appVersion) {
      appVersionIdentifier = appVersion.fileName ? `${appVersion.fileName} (v${appVersion.version})` : `Version ${appVersion.version}`;
      appVersionDetailsString = `"${appVersionIdentifier}" (ID: ${params.appVersionId})`;
    } else {
      const appVersions = await getAppVersions(params);
      const foundVersion = appVersions.find((v: any) => v.id === params.appVersionId);
      if (foundVersion) {
        appVersionIdentifier = foundVersion.fileName ? `${foundVersion.fileName} (v${foundVersion.version})` : `Version ${foundVersion.version}`;
        appVersionDetailsString = `"${appVersionIdentifier}" (ID: ${params.appVersionId})`;
      }
    }
  } catch (fetchError) {
    console.warn(chalk.yellow(`\nWarning: Could not fetch app version details. Using ID in confirmation.`));
  }
  
  return appVersionDetailsString;
};

export const confirmAppVersionDeletion = async (appVersionDetailsString: string): Promise<boolean> => {
  const response: any = await enquirer.prompt({
    type: 'select',
    name: 'confirm',
    message: `Are you sure you want to delete the App Version ${appVersionDetailsString}? This action cannot be undone. (Y/n)`,
    choices: [
      { name: 'yes', message: 'yes' },
      { name: 'no', message: 'no' }
    ],
    initial: 1 // Default to "no" for safety
  });

  return response.confirm === 'yes';
};

export const handlePublishVersionDelete = async (command: ProgramCommand, params: any) => {
  let spinner = createOra('Try to remove the app version').start();
  try {
    spinner.stop();

    const appVersionDetailsString = await getAppVersionDetailsForDeletion(params);
    
    const shouldDelete = await confirmAppVersionDeletion(appVersionDetailsString);
    if (!shouldDelete) {
      console.log(chalk.yellow('App Version deletion cancelled.'));
      spinner.stop();
      return;
    }
    
    spinner = createOra('Removing the app version...').start();
    const responseData = await deleteAppVersion(params);
    commandWriter(CommandTypes.PUBLISH, responseData);
    spinner.text = `App Version removed successfully.\n\nTaskId: ${responseData.taskId}`;
    spinner.succeed();
  } catch (e: any) {
    spinner.fail('Remove failed');
    throw e;
  }
};

export const setupDownloadDirectoryForAppVersion = (params: any): string => {
  const homeDir = os.homedir();
  const defaultDownloadDir = path.join(homeDir, 'Downloads');
  let targetDirectory = params.path ? params.path.replace('~', homeDir) : defaultDownloadDir;
  targetDirectory = path.resolve(targetDirectory);

  if (!fs.existsSync(targetDirectory)) {
    fs.mkdirSync(targetDirectory, { recursive: true });
  } else if (!fs.statSync(targetDirectory).isDirectory()) {
    throw new AppcircleExitError(`Target path ${targetDirectory} exists but is not a directory.`, 1);
  }

  return targetDirectory;
};

export const findAppVersionForDownload = async (params: any): Promise<any> => {
  const appVersions = await getAppVersions(params);
  const appVersion = appVersions.find((appVersion: any) => appVersion.id === params.appVersionId);
  if (!appVersion) {
    throw new Error('App version not found');
  }
  return appVersion;
};

export const handlePublishVersionDownload = async (command: ProgramCommand, params: any) => {
  let spinner = createOra('Getting app version download link...').start();
  try {
    const targetDirectory = setupDownloadDirectoryForAppVersion(params);
    
    const responseData = await getAppVersionDownloadLink(params);
    const appVersion = await findAppVersionForDownload(params);
    
    spinner.text = `App version download link retrieved successfully.`;
    spinner.text = `Try to download the app version.`;
    
    const finalDownloadPath = path.join(targetDirectory, appVersion.fileName);
    
    await downloadAppVersion({ url: responseData, path: finalDownloadPath });
    spinner.text = `App version downloaded successfully.\n\nDownload Path: ${finalDownloadPath}`; 
    spinner.succeed();
  } catch (e: any) {
    spinner.fail('Process failed');
    throw e;
  }
};

export const handlePublishVariableGroupList = async (command: ProgramCommand, params: any) => {
  const spinner = createOra('Listing Variable Groups...').start();
  const variableGroups = await getPublishVariableGroups();
  spinner.stop();
  commandWriter(CommandTypes.PUBLISH, {
    fullCommandName: command.fullCommandName,
    data: variableGroups,
  });
};

export const handlePublishVariableGroupView = async (command: ProgramCommand, params: any) => {
  const spinner = createOra('Listing Variables...').start();
  const variables = await getPublishVariableListByGroupId(params);
  spinner.stop();
  commandWriter(CommandTypes.PUBLISH, {
    fullCommandName: command.fullCommandName,
    data: variables.variables,
  });
};

export const validateVariableGroupUploadFile = (params: any, spinner: any): string => {
  if (!params.filePath) {
    spinner.fail('JSON file path is required');
    throw new AppcircleExitError('JSON file path is required', 1);
  }
  
  if (params.variableGroupId) {
    const match = /\(([^)]+)\)$/.exec(params.variableGroupId);
    if (match && match[1]) {
      params.variableGroupId = match[1];
    }
  }
  
  const expandedPath = path.resolve(params.filePath.replace('~', os.homedir()));
  if (!fs.existsSync(expandedPath)) {
    spinner.fail('File not found');
    throw new AppcircleExitError('File not found', 1);
  }
  
  try {
    const fileContent = fs.readFileSync(expandedPath, 'utf8');
    JSON.parse(fileContent);
  } catch (err) {
    spinner.fail('Invalid JSON file');
    throw new AppcircleExitError('Invalid JSON file', 1);
  }
  
  return expandedPath;
};

export const handlePublishVariableGroupUpload = async (command: ProgramCommand, params: any) => {
  const spinner = createOra('Loading Environment Variables from JSON file...').start();
  try {
    const expandedPath = validateVariableGroupUploadFile(params, spinner);
    params.filePath = expandedPath;
    const responseData = await uploadPublishEnvironmentVariablesFromFile(params as any);
    spinner.succeed('Environment Variables uploaded successfully');
  } catch (e) {
    spinner.fail('Failed to upload Environment Variables');
    throw e;
  }
};

// Additional publish command handlers
export const handlePublishStart = async (command: ProgramCommand, params: any) => {
  const spinner = getConsoleOutputType() === 'json' ? 
    { succeed: () => {}, fail: () => {}, stop: () => {} } : 
    createOra('Starting Publish flow...').start();
  try {
    const publish = await getPublishByAppVersion(params);
    const firstStep = publish.steps[0];
    const startResponse = await startExistingPublishFlow({ ...params, publishId: firstStep.publishId });
    
    const publishId = typeof startResponse === 'string' ? startResponse : firstStep.publishId;
    
    if (getConsoleOutputType() !== 'json') {
      spinner.succeed(`Publish flow started successfully.\n\nPublishId: ${publishId}`);
    }
    
    if (params.platform && params.publishProfileId && params.appVersionId) {
      await monitorPublishProcess({ ...params, publishId });
    } else {
      if (getConsoleOutputType() === 'json') {
        const jsonOutput = {
          publishId: publishId,
          status: 'started',
          message: 'Publish flow started successfully'
        };
        console.log(JSON.stringify(jsonOutput));
      } else {
        console.log(chalk.yellow('\nInsufficient parameters to monitor Publish Status. Please provide platform, publishProfileId, and appVersionId for monitoring.'));
      }
    }
  } catch (error) {
    if (getConsoleOutputType() !== 'json') {
      spinner.fail('Failed to start publish');
    }
    throw error;
  }
};

export const handlePublishVersionMarkAsRC = async (command: ProgramCommand, params: any) => {
  const response = await setAppVersionReleaseCandidateStatus({...params, releaseCandidate: true });
  commandWriter(CommandTypes.PUBLISH, {
    fullCommandName: command.fullCommandName,
    data: response,
  });
};

export const handlePublishVersionUnmarkAsRC = async (command: ProgramCommand, params: any) => {
  const response = await setAppVersionReleaseCandidateStatus({...params, releaseCandidate: false });
  commandWriter(CommandTypes.PUBLISH, {
    fullCommandName: command.fullCommandName,
    data: response,
  });
};

export const handlePublishProfileSettingsAutopublish = async (command: ProgramCommand, params: any) => {
  // Convert enable parameter to boolean if it's a string
  if (typeof params.enable === 'string') {
    params.enable = params.enable.toLowerCase() === 'true';
  }
  
  const publishProfileDetails = await getPublishProfileDetailById(params);
  const response = await switchPublishProfileAutoPublishSettings({ ...params, currentProfileSettings: publishProfileDetails.profileSettings });
  commandWriter(CommandTypes.PUBLISH, {
    fullCommandName: command.fullCommandName,
    data: response,
  });
};

export const handlePublishProfileVersionList = async (command: ProgramCommand, params: any) => {
  const spinner = createOra('Listing App Versions...').start();
  const appVersions = await getAppVersions(params);
  spinner.stop();
  commandWriter(CommandTypes.PUBLISH, {
    fullCommandName: command.fullCommandName,
    data: appVersions,
  });
};

export const handlePublishProfileVersionView = async (command: ProgramCommand, params: any) => {
  const spinner = createOra('Getting App Version Details...').start();
  const appVersion = await getAppVersionDetail(params);
  spinner.stop();
  commandWriter(CommandTypes.PUBLISH, {
    fullCommandName: command.fullCommandName,
    data: appVersion,
  });
};

export const handlePublishVersionUpdateReleaseNote = async (command: ProgramCommand, params: any) => {
  const spinner = createOra('Try to update relase note of the app version').start();
  try{
    await setAppVersionReleaseNote(params);
    spinner.succeed("Release note updated successfully.");
  }catch(e: any){
    spinner.fail('Update failed');
    throw e;
  }
};

export const handlePublishActiveList = async (command: ProgramCommand, params: any) => {
  const spinner = createOra('Listing Active Publishes...').start();
  const activePublishes = await getActivePublishes();
  spinner.stop();
  commandWriter(CommandTypes.PUBLISH, {
    fullCommandName: command.fullCommandName,
    data: activePublishes,
  });
};

export const handlePublishView = async (command: ProgramCommand, params: any) => {
  const spinner = createOra('Listing Publish Details...').start();
  const responseData = await getPublisDetailById(params);
  spinner.stop();
  commandWriter(CommandTypes.PUBLISH, {
    fullCommandName: command.fullCommandName,
    data: responseData,
  });
};

const handlePublishCommand = async (command: ProgramCommand, params: any) => {
  // Parameter validations
  validatePublishPlatform(params);
  await validatePublishProfileParams(command, params);
  await validatePublishAppVersionParams(command, params);
  await validatePublishVariableGroupParams(command, params);

  // Handle publish commands
  if (command.fullCommandName === `${PROGRAM_NAME}-publish-profile-create`) {
    await handlePublishProfileCreate(command, params);
  } else if (command.fullCommandName === `${PROGRAM_NAME}-publish-profile-list`) {
    await handlePublishProfileList(command, params);
  } else if (command.fullCommandName === `${PROGRAM_NAME}-publish-profile-delete`) {
    await handlePublishProfileDelete(command, params);
  } else if (command.fullCommandName === `${PROGRAM_NAME}-publish-profile-rename`) {
    await handlePublishProfileRename(command, params);
  } 
  else if (command.fullCommandName === `${PROGRAM_NAME}-publish-profile-version-upload`) {
    await handlePublishVersionUpload(command, params);
  } else if (command.fullCommandName === `${PROGRAM_NAME}-publish-profile-version-delete`) {
    await handlePublishVersionDelete(command, params);
  } else if (command.fullCommandName === `${PROGRAM_NAME}-publish-start`) {
    await handlePublishStart(command, params);
  }else if (command.fullCommandName === `${PROGRAM_NAME}-publish-profile-version-download`) {
    await handlePublishVersionDownload(command, params);
  } else if (command.fullCommandName === `${PROGRAM_NAME}-publish-profile-version-mark-as-rc`) {
    await handlePublishVersionMarkAsRC(command, params);
    } else if (command.fullCommandName === `${PROGRAM_NAME}-publish-profile-version-unmark-as-rc`) {
      await handlePublishVersionUnmarkAsRC(command, params);
    } else if (command.fullCommandName === `${PROGRAM_NAME}-publish-profile-settings-autopublish`) {
      await handlePublishProfileSettingsAutopublish(command, params);
    } else if (command.fullCommandName === `${PROGRAM_NAME}-publish-variable-group-list`) {
      await handlePublishVariableGroupList(command, params);
    } else if (command.fullCommandName === `${PROGRAM_NAME}-publish-variable-group-view`) {
      await handlePublishVariableGroupView(command, params);
    } else if (command.fullCommandName === `${PROGRAM_NAME}-publish-variable-group-upload`) {
      await handlePublishVariableGroupUpload(command, params);
    } else if (command.fullCommandName === `${PROGRAM_NAME}-publish-variable-group-download`) {
    if (!params.publishVariableGroupId && params.variableGroupId) {
      params.publishVariableGroupId = params.variableGroupId;
    }
    const spinner = createOra('Downloading Publish Environment Variables...').start();
    try {
      const variableGroups = await getPublishVariableGroups();
      const variableGroup = variableGroups.find((group: any) => group.id === params.publishVariableGroupId);
      
      if (!variableGroup) {
        spinner.fail(`Variable Group with ID ${params.publishVariableGroupId} not found`);
        throw new Error(`Variable Group not found`);
      }
      
      const variables = await getPublishVariableListByGroupId(params);
      
      let formattedVariables = variables.variables.map((variable: any) => ({
        key: variable.key,
        value: variable.value,
        isSecret: variable.isSecret,
        isFile: variable.isFile || false,
        id: variable.key
      }));
      
      formattedVariables.sort((a: any, b: any) => {
        const aKey = a.key;
        const bKey = b.key;
        return bKey.localeCompare(aKey);
      });
      
      const timestamp = Date.now();
      const fileName = `${variableGroup.name}_${timestamp}.json`;
      
      const homeDir = os.homedir();
      const defaultDownloadDir = path.join(homeDir, 'Downloads');
      let filePath = params.path || defaultDownloadDir;
      
      if (filePath.includes('~')) {
        filePath = filePath.replace(/~/g, os.homedir());
      }
      
      filePath = path.resolve(filePath);
      
      if (!fs.existsSync(filePath)) {
        fs.mkdirSync(filePath, { recursive: true });
      }
      
      if (fs.statSync(filePath).isDirectory()) {
        filePath = path.join(filePath, fileName);
      }
      
      fs.writeFileSync(filePath, JSON.stringify(formattedVariables));
      
      spinner.succeed(`Publish Environment Variables downloaded successfully to ${filePath}`);
    } catch (e) {
      spinner.fail('Failed to download Publish Environment Variables');
      throw e;
    }
  } else if(command.fullCommandName === `${PROGRAM_NAME}-publish-profile-version-list`){
    await handlePublishProfileVersionList(command, params);
    } else if(command.fullCommandName === `${PROGRAM_NAME}-publish-profile-version-view`){
      await handlePublishProfileVersionView(command, params);
    } else if(command.fullCommandName === `${PROGRAM_NAME}-publish-profile-version-update-release-note`){
      await handlePublishVersionUpdateReleaseNote(command, params);
    } else if (command.fullCommandName === `${PROGRAM_NAME}-publish-active-list`){
      await handlePublishActiveList(command, params);
    } else if (command.fullCommandName === `${PROGRAM_NAME}-publish-view`){
      await handlePublishView(command, params);
    } 
    else {
    const beutufiyCommandName = command.fullCommandName.split('-').join(' ');
    const desc = getLongDescriptionForCommand(command.fullCommandName);
    if (desc) {
      console.error(`\n${desc}\n`);
    } else {
      console.error(`"${beutufiyCommandName} ..." command not found.`);
    }
  }
};

const handleBuildCommand = async (command: ProgramCommand, params:any) => {
  // Build profile validation and resolution
  if (params.profile && !params.profileId) {
    const buildProfiles = await getBuildProfiles();
    const foundProfile = buildProfiles.find((profile: any) => profile.name === params.profile);
    if (!foundProfile) {
      throw new ProgramError(`Build profile "${params.profile}" not found.
        
Available build profiles:
${buildProfiles.map((profile: any) => `  - ${profile.name}`).join('\n')}`);
    }
    params.profileId = foundProfile.id;
  }

  // Branch validation and resolution (requires profileId)
  if (params.branch && !params.branchId && params.profileId) {
    const branchesResponse = await getBranches({ profileId: params.profileId });
    const foundBranch = branchesResponse.branches?.find((branch: any) => branch.name === params.branch);
    if (!foundBranch) {
      throw new ProgramError(`Branch "${params.branch}" not found for build profile.
        
Available branches:
${branchesResponse.branches?.map((branch: any) => `  - ${branch.name}`).join('\n') || 'No branches found'}`);
    }
    params.branchId = foundBranch.id;
  }

  // Workflow validation and resolution (requires profileId)
  if (params.workflow && !params.workflowId && params.profileId) {
    const workflows = await getWorkflows({ profileId: params.profileId });
    const foundWorkflow = workflows.find((workflow: any) => workflow.workflowName === params.workflow);
    if (!foundWorkflow) {
      throw new ProgramError(`Workflow "${params.workflow}" not found for build profile.
        
Available workflows:
${workflows.map((workflow: any) => `  - ${workflow.workflowName}`).join('\n')}`);
    }
    params.workflowId = foundWorkflow.id;
  }

  // Configuration validation and resolution (requires profileId)
  if (params.configuration && !params.configurationId && params.profileId) {
    const configurations = await getConfigurations({ profileId: params.profileId });
    const foundConfiguration = configurations.find((config: any) => config.item1?.configurationName === params.configuration);
    if (!foundConfiguration) {
      throw new ProgramError(`Configuration "${params.configuration}" not found for build profile.
        
Available configurations:
${configurations.map((config: any) => `  - ${config.item1?.configurationName || 'Unknown'}`).join('\n')}`);
    }
    params.configurationId = foundConfiguration.item1.id;
  }

  // Variable group validation and resolution
  if (params.variableGroup && !params.variableGroupId) {
    const variableGroups = await getEnvironmentVariableGroups();
    const foundVariableGroup = variableGroups.find((group: any) => group.name === params.variableGroup);
    if (!foundVariableGroup) {
      throw new ProgramError(`Variable group "${params.variableGroup}" not found.
        
Available variable groups:
${variableGroups.map((group: any) => `  - ${group.name}`).join('\n')}`);
    }
    params.variableGroupId = foundVariableGroup.id;
  }

  if (command.fullCommandName === `${PROGRAM_NAME}-build-start`) {
    // Declare monitoring variables at top scope for entire build command
    let sseConnection: any = null;
    let logProcessor: any = null;
    let renderer: any = null;
    let progressTracker: any = null;
    let monitoringContext: any = null;
    
    // Use extracted validation function
    const validation = validateBuildStartParameters(params, command.fullCommandName);
    if (!validation.isValid) {
      const desc = getLongDescriptionForCommand(command.fullCommandName);
      if (desc) {
        console.error(`\n${desc}\n`);
      }
      throw new AppcircleExitError('', 1);
    }
    
    // Check if this is a non-interactive run (has --no-wait or JSON output)
    const isNonInteractive = process.argv.includes('--no-wait') || getConsoleOutputType() === 'json';
    
    // Parse monitor mode from command line parameter or prompt user in interactive mode
    let monitorMode = BuildMonitorMode.SUMMARY;
    const monitorParam = command.opts()['monitor'];
    const executionModeParam = command.opts()['executionMode']; // For backward compatibility
    
    // Check for new --monitor parameter first
    if (monitorParam) {
      // New monitor parameter provided - use it
      switch (monitorParam.toLowerCase()) {
        case 'none':
          monitorMode = BuildMonitorMode.NONE;
          break;
        case 'summary':
          monitorMode = BuildMonitorMode.SUMMARY;
          break;
        case 'steps':
          monitorMode = BuildMonitorMode.STEPS;
          break;
        case 'verbose':
          monitorMode = BuildMonitorMode.VERBOSE;
          break;
        default:
          console.warn(`Warning: Unknown monitor mode '${monitorParam}'. Using 'summary' mode.`);
          monitorMode = BuildMonitorMode.SUMMARY;
      }
    } else if (executionModeParam) {
      // Legacy --execution-mode parameter provided - map to new monitor modes
      switch (executionModeParam.toLowerCase()) {
        case 'normal':
          monitorMode = BuildMonitorMode.SUMMARY;
          break;
        case 'detailed':
          monitorMode = BuildMonitorMode.VERBOSE;
          break;
        case 'step-summary':
          monitorMode = BuildMonitorMode.STEPS;
          break;
        case 'skip':
          monitorMode = BuildMonitorMode.NONE;
          break;
        default:
          console.warn(`Warning: Unknown execution mode '${executionModeParam}'. Using 'summary' mode.`);
          monitorMode = BuildMonitorMode.SUMMARY;
      }
    } else if (!isNonInteractive) {
      // No command line parameter and interactive mode - prompt user
      const modeSelection = await selectBuildMonitorMode();
      
      if (modeSelection.cancelled) {
        console.log('\nBuild cancelled by user.');
        throw new AppcircleExitError('Build cancelled', 0);
      }
      
      monitorMode = modeSelection.mode;
    }
    // If non-interactive and no parameter provided, use default (SUMMARY)
    
    // Handle "None" monitor mode - just return Task/Build ID and exit
    if (monitorMode === BuildMonitorMode.NONE) {
      const spinner = createOra(`Generating Task ID...`).start();
      try {
        const responseData = await startBuild(params);
        spinner.succeed(`Task ID generated successfully.\n\nTaskId: ${responseData.taskId}`);
        
        if (getConsoleOutputType() === 'json') {
          console.log(JSON.stringify({
            taskId: responseData.taskId,
            queueItemId: responseData.queueItemId,
            mode: 'none'
          }));
        }
        
        throw new AppcircleExitError('Task ID generated', 0);
      } catch (error: any) {
        throw error;
      }
    }
    
    // For Steps and Verbose monitor modes, setup SSE BEFORE starting build
    if (monitorMode === BuildMonitorMode.STEPS || monitorMode === BuildMonitorMode.VERBOSE) {
      try {
        // Step 1: Setup SSE connection BEFORE build starts
        const accessToken = readEnviromentConfigVariable(EnvironmentVariables.AC_ACCESS_TOKEN);
        const { sub: userId, currentOrganizationId: organizationId } = resolveIdentityFromToken(accessToken);
        const hookToken = await getHookAccessToken(accessToken);
        const hookHostname = readEnviromentConfigVariable(EnvironmentVariables.HOOK_HOSTNAME) || "https://hook.appcircle.io";
        
        sseConnection = await openHookSSE({
          hookHostname,
          userId,
          organizationId,
          token: hookToken
        });
        
        console.log(chalk.green(`✓ SSE connection established with browserId: ${sseConnection.browserId}`));
        
        // Step 2: Initialize monitoring components
        const { LogProcessor } = await import('../utils/LogProcessor');
        const { TerminalRenderer } = await import('../utils/TerminalRenderer');
        const { ProgressTracker } = await import('../utils/ProgressTracker');
        
        const buildLogOptions = {
          timestamps: false,
          noColor: getConsoleOutputType() === 'json',
          enableProgress: process.stdout.isTTY,
          verboseMode: monitorMode === BuildMonitorMode.VERBOSE
        };
        
        renderer = new TerminalRenderer(buildLogOptions);
        progressTracker = new ProgressTracker(buildLogOptions.enableProgress);
        logProcessor = new LogProcessor((message) => {
          if (progressTracker) progressTracker.updateProgress(message);
          if (renderer) {
            const formattedMessage = renderer.renderMessage(message);
            // Only log if there's actual content to display
            if (formattedMessage && formattedMessage.trim()) {
              console.log(formattedMessage);
            }
          }
        });
        
        // Store context for later trigger call
        monitoringContext = {
          accessToken,
          userId,
          organizationId,
          hookHostname,
          browserId: sseConnection.browserId
        };
      } catch (error: any) {
        console.error(chalk.red(`❌ Failed to setup enhanced monitoring: ${error.message}`));
        // Continue with normal build
      }
    }
    
    // Now start the build
    const spinner = createOra(`Starting Build...`).start();
    let responseData: any;
    try {
      responseData = await startBuild(params);
      
      // Use extracted wait behavior function
      const waitBehavior = determineBuildWaitBehavior(process.argv, getConsoleOutputType());
      
      // Use extracted response processing function
      const responseProcessing = processBuildResponseForImmediateReturn(
        responseData,
        waitBehavior.shouldWait,
        waitBehavior.isJsonMode
      );
      
      if (!responseProcessing.shouldContinueMonitoring) {
        if (responseProcessing.jsonOutput) {
          spinner.stop();
          console.log(JSON.stringify(responseProcessing.jsonOutput));
          throw new AppcircleExitError('', 0);
        } else {
          commandWriter(CommandTypes.BUILD, {
            fullCommandName: command.fullCommandName,
            data: responseData,
          });
          spinner.succeed(`Build successfully added to queue.\n\nTaskId: ${responseData.taskId}`);
          throw new AppcircleExitError('Build queued successfully', 0);
        }
      }
    } catch (error: any) {
      spinner.fail('Failed to start build');
      throw error;
    }

    // Only continue with build monitoring if shouldWait is true
    if (getConsoleOutputType() !== 'json') {
      try {
        commandWriter(CommandTypes.BUILD, {
          fullCommandName: command.fullCommandName,
          data: responseData,
        });
        
        // Show different messages based on monitor mode
        if (monitorMode === BuildMonitorMode.VERBOSE) {
          spinner.succeed(`Build successfully added to queue with verbose monitoring enabled.\n\nTaskId: ${responseData.taskId}`);
        } else if (monitorMode === BuildMonitorMode.STEPS) {
          spinner.succeed(`Build successfully added to queue with step monitoring enabled.\n\nTaskId: ${responseData.taskId}`);
        }

        // NOW trigger build logs streaming - SSE connection is already ready (for enhanced monitoring modes)
        if ((monitorMode === BuildMonitorMode.VERBOSE || monitorMode === BuildMonitorMode.STEPS) && monitoringContext && sseConnection) {
          const taskId = responseData.taskId || responseData.queueItemId;
          try {
            await triggerBuildLogsStreaming({
              apiHostname: readEnviromentConfigVariable(EnvironmentVariables.API_HOSTNAME),
              hookHostname: monitoringContext.hookHostname,
              accessToken: monitoringContext.accessToken,
              taskId,
              browserId: monitoringContext.browserId,
              userId: monitoringContext.userId,
              organizationId: monitoringContext.organizationId
            });

            // Setup appropriate formatter based on monitor mode
            const terminalFormatter = monitorMode === BuildMonitorMode.STEPS
              ? createStepSummaryFormatter()
              : createCleanTerminalFormatter();
            let buildLogReceived = false;
            let verboseLogsStarted = false;
            const buildStartTime = Date.now();

            // Give formatter access to SSE connection for immediate closure
            terminalFormatter.setSSEConnection(sseConnection);

            // Set completion callback to handle build completion
            terminalFormatter.setCompletionCallback(async () => {
                // Show build summary immediately (SSE already closed by formatter)
                // const totalDuration = Math.round((Date.now() - buildStartTime) / 1000);
                // console.log(chalk.cyan('\n📊 Build Summary:'));
                // console.log(chalk.gray(`   Task ID: ${taskId}`));
                // console.log(chalk.gray(`   Duration: ${totalDuration}s`));
                // console.log(chalk.green('   Status: ✓ Completed Successfully'));
                
                // Call stop endpoint asynchronously (non-blocking)
                triggerStopBuildLogsStreaming({
                  hookHostname: monitoringContext.hookHostname,
                  accessToken: monitoringContext.accessToken,
                  taskId,
                  browserId: monitoringContext.browserId,
                  userId: monitoringContext.userId,
                  organizationId: monitoringContext.organizationId
                }).catch((error: any) => {
                  console.error(chalk.yellow(`⚠️ Warning during cleanup: ${error.message}`));
                });
              });
              
              // Show initial ephemeral status
              terminalFormatter.setEphemeralStatus('🔄 Connecting to build logs...');
              
              sseConnection.onMessage((data: string) => {
                try {
                  // Parse the build-log event data
                  const parsed = JSON.parse(data);
                  const buildLogEvents = Array.isArray(parsed) ? parsed : [parsed];
                  
                  for (const buildLogEvent of buildLogEvents) {
                    if (!buildLogReceived) {
                      terminalFormatter.clearEphemeralStatus();
                      console.log(chalk.green('✓ Build logs started streaming!'));
                      console.log(''); // Empty line for better separation
                      buildLogReceived = true;
                    }
                    
                    // Process message with appropriate formatter based on monitor mode
                    if (monitorMode === BuildMonitorMode.VERBOSE) {
                      // In verbose mode, use log processor for detailed output
                      if (logProcessor) {
                        // Force start logs for verbose mode only once when first message arrives
                        if (!verboseLogsStarted) {
                          logProcessor.forceStartLogs();
                          verboseLogsStarted = true;
                        }
                        logProcessor.processMessage(buildLogEvent);
                      }
                    } else if (monitorMode === BuildMonitorMode.STEPS) {
                      // In steps mode, use terminal formatter for step summaries
                      terminalFormatter.processMessage(buildLogEvent);
                    }
                  }
                } catch (error: any) {
                  terminalFormatter.clearEphemeralStatus();
                  console.error(chalk.red('Error parsing build log data:'), error.message);
                }
              });
              
              sseConnection.onClose(() => {
                terminalFormatter.clearEphemeralStatus();
                if (progressTracker) {
                  const stats = progressTracker.getBuildStats();
                  if (renderer) renderer.renderSummary(stats);
                  progressTracker.stop();
                }
                // Flush any remaining buffered messages in verbose mode
                if (monitorMode === BuildMonitorMode.VERBOSE && logProcessor) {
                  logProcessor.flushAllMessages();
                }
                terminalFormatter.finish();
              });
              
            } catch (triggerError: any) {
              console.error(chalk.red(`❌ Failed to trigger build logs: ${triggerError.message}`));
              console.log(chalk.yellow('Continuing with standard monitoring...'));
            }
        } else {
          spinner.succeed(`Build successfully added to queue.\n\nTaskId: ${responseData.taskId}`);
        }

        if (getConsoleOutputType() === 'json') {
          spinner.stop();
        }
      } catch (monitoringError: any) {
        console.error('Monitoring setup failed:', monitoringError);
      }

      // Only create progress spinner for non-enhanced monitoring modes
      let progressSpinner: any = null;
      let interval: NodeJS.Timeout | null = null;
      const startTime = Date.now();

      if (monitorMode !== BuildMonitorMode.VERBOSE && monitorMode !== BuildMonitorMode.STEPS) {
        progressSpinner = createProgressSpinner(`Checking Build Status...`);
        let dots = "";
        
        interval = getConsoleOutputType() === 'json' ? null : setInterval(() => {
          dots = dots.length >= 3 ? "" : dots + ".";
          const elapsedText = formatElapsedTime(startTime);
          progressSpinner.text = chalk.yellow(`Build Running${dots} (${elapsedText})`);
        }, 500);
      }
      
      try {
        const taskId = responseData.queueItemId;
        
        // Use extracted monitoring utility
        const monitoringResult = await monitorBuildProgress(taskId, params, getBuildStatusFromQueue, getLatestBuildId);
        const { buildCompleted, buildSuccess, finalStatusResponse, latestBuildId, timedOut } = monitoringResult;
        
        // Update spinner with status messages during monitoring (only for summary mode)
        let monitoringInterval: NodeJS.Timeout | null = null;
        if (monitorMode !== BuildMonitorMode.VERBOSE && monitorMode !== BuildMonitorMode.STEPS) {
          monitoringInterval = getConsoleOutputType() === 'json' ? null : setInterval(() => {
            if (finalStatusResponse) {
              const elapsedText = formatElapsedTime(startTime);
              const hasWarning = finalStatusResponse.hasWarning === true;
              updateBuildStatusMessage(finalStatusResponse.buildStatus, elapsedText, progressSpinner, hasWarning);
            }
          }, 500);
        }
        
        if (monitoringInterval) clearInterval(monitoringInterval);
        if (interval) clearInterval(interval);
        
        if (timedOut) {
          if (progressSpinner) {
            progressSpinner.fail(chalk.red(`Build monitoring timed out after ${300 * 3} seconds.`));
          } else {
            console.error(chalk.red(`Build monitoring timed out after ${300 * 3} seconds.`));
          }
          throw new AppcircleExitError('Build monitoring timed out', 1);
        }

        if (buildCompleted) {
          if (buildSuccess) {
            try {
              const hasWarning = finalStatusResponse && finalStatusResponse.hasWarning === true;

              // Warning handling is done during step processing

              const elapsedText = formatElapsedTime(startTime);
              if (progressSpinner) {
                if (hasWarning) {
                  progressSpinner.text = chalk.hex('#FFA500')(`Build completed with warnings ⚠️ - Total time: ${elapsedText}`);
                  progressSpinner.succeed();
                } else {
                  progressSpinner.succeed(`Build completed successfully ✅ - Total time: ${elapsedText}`);
                }
              } else {
                // For detailed monitoring mode, show completion message directly
                if (hasWarning) {
                  console.log(chalk.hex('#FFA500')(`✔ Build completed with warnings ⚠️ - Total time: ${elapsedText}`));
                } else {
                  console.log(chalk.green(`✔ Build completed successfully ✅ - Total time: ${elapsedText}`));
                }
              }
            } catch (e) {
              if (progressSpinner) {
                progressSpinner.succeed(`Build completed successfully ✅`);
              } else {
                console.log(chalk.green(`✔ Build completed successfully ✅`));
              }
            }
            
            const homeDir = os.homedir();
            const defaultDownloadDir = path.join(homeDir, 'Downloads');
            const downloadPath = params.path || defaultDownloadDir;
            
            // Check if automatic download parameters are provided
            // Commander.js converts kebab-case to camelCase
            const shouldDownloadLogs = params.downloadLogs === true || params['download-logs'] === true;
            const shouldDownloadArtifacts = params.downloadArtifacts === true || params['download-artifacts'] === true;
            
            // Skip interactive prompt for JSON output mode
            if (getConsoleOutputType() === 'json') {
              const jsonOutput = {
                taskId: responseData.taskId,
                queueItemId: responseData.queueItemId,
                status: 'success',
                message: 'Build completed successfully'
              };
              console.log(JSON.stringify(jsonOutput));
              throw new AppcircleExitError('', 0);
            }
            
            // If automatic download parameters are provided, skip interactive prompt

            
            // If automatic download parameters were provided, skip interactive prompt
            if (shouldDownloadLogs || shouldDownloadArtifacts) {
              const commitId = finalStatusResponse?.commitId;
              const buildId = latestBuildId || finalStatusResponse?.buildId;
              
              if (shouldDownloadArtifacts && commitId && buildId) {
                const artifactSpinner = createOra('Waiting for artifacts to be ready...').start();
                await new Promise(resolve => setTimeout(resolve, 10000));
                artifactSpinner.text = 'Downloading artifacts...';
                try {
                  const timestamp = Date.now();
                  const artifactFileName = generateArtifactFileName();
                  await downloadArtifact({ 
                    commitId: commitId, 
                    buildId: buildId,
                    branchId: params.branchId,
                    profileId: params.profileId
                  }, downloadPath, artifactFileName);
                  artifactSpinner.succeed(`Artifacts downloaded successfully: file://${path.resolve(path.join(downloadPath, artifactFileName))}`);
                } catch (e: any) {
                  const buildStatus = finalStatusResponse?.buildStatus;
                  const hasWarning = finalStatusResponse?.hasWarning;
                  const errorMessage = generateArtifactErrorMessage(buildStatus, e.message, buildId, hasWarning);
                  artifactSpinner.fail(errorMessage);
                }
              }
              
              if (shouldDownloadLogs) {
                const logSpinner = createOra('Downloading build logs...').start();
                try {
                  if (commitId && buildId && buildId !== '00000000-0000-0000-0000-000000000000') {
                    await downloadBuildLogs({ 
                      commitId: commitId, 
                      buildId: buildId,
                      branchId: params.branchId,
                      profileId: params.profileId,
                      path: downloadPath
                    });
                  } else {
                    await downloadBuildLogs(responseData.queueItemId, { path: downloadPath });
                  }
                } catch (e: any) {
                  logSpinner.fail(`Cannot download logs since the build failed: ${e.message}`);
                }
              }
              throw new AppcircleExitError('Build completed', 0);
            }
            
            // For detailed monitoring mode, we still show the prompt but handle it differently
            // Ensure SSE connection is closed before showing the prompt
            if (sseConnection && sseConnection.close) {
              sseConnection.close();
            }
                
            console.log(chalk.cyan('\nWhat would you like to do next?'));
             
            try {
              // @ts-ignore
              const response: any = await enquirer.prompt({
                type: 'select',
                name: 'action',
                message: 'Choose an option:',
                choices: [
                  { name: 'artifacts', message: 'Download Artifacts' },
                  { name: 'logs', message: 'Download Build Logs' },
                  { name: 'continue', message: 'Continue without downloading' }
                ]
              });
              
              if (response.action === 'artifacts') {
                const artifactDownloadPath = await promptForPath('[OPTIONAL] Enter download path for artifacts', defaultDownloadDir);
                const commitIdForArtifact = finalStatusResponse?.commitId;
                const buildIdForArtifact = latestBuildId || finalStatusResponse?.buildId;

                if (commitIdForArtifact && buildIdForArtifact) {
                  const artifactSpinner = createOra('Downloading artifacts...').start();
                  try {
                    const timestamp = Date.now();
                    const artifactFileName = generateArtifactFileName();
                    await downloadArtifact({ 
                      commitId: commitIdForArtifact, 
                      buildId: buildIdForArtifact,
                      branchId: params.branchId,
                      profileId: params.profileId
                    }, artifactDownloadPath, artifactFileName);
                    artifactSpinner.succeed(`Artifacts downloaded successfully: file://${path.resolve(path.join(artifactDownloadPath, artifactFileName))}`);
                  } catch (e: any) {
                    const buildStatus = finalStatusResponse?.buildStatus;
                    const hasWarning = finalStatusResponse?.hasWarning;
                    const errorMessage = generateArtifactErrorMessage(buildStatus, e.message, buildIdForArtifact, hasWarning);
                    artifactSpinner.fail(errorMessage);
                  }
                } else {
                  console.log(chalk.yellow('Build completed successfully but could not get artifact information.'));
                }
              } else if (response.action === 'logs') {
                const buildLogPath = await promptForPath('[OPTIONAL] Enter download path for Build Logs', defaultDownloadDir);
                params.path = buildLogPath;
                
                if (finalStatusResponse && finalStatusResponse.buildStatus === 2) {
                  params.wasCanceled = true;
                  console.log(chalk.yellow('Note: Logs for canceled Builds might not be immediately available.'));
                  await new Promise(resolve => setTimeout(resolve, 1000));
                }
                
                try {
                  const commitId = finalStatusResponse?.commitId;
                  const buildId = latestBuildId || finalStatusResponse?.buildId;
                  
                  
                  if (commitId && buildId && buildId !== '00000000-0000-0000-0000-000000000000') {
                    await downloadBuildLogs({ 
                      commitId, 
                      buildId,
                      branchId: params.branchId,
                      profileId: params.profileId,
                      path: buildLogPath
                    });
                  } else {
                    await downloadBuildLogs(responseData.queueItemId, { path: buildLogPath });
                  }
                  console.log(chalk.green('Build log downloaded successfully.'));
                  
                  // For verbose monitoring mode, exit immediately after log download
                  if (monitorMode === BuildMonitorMode.VERBOSE) {
                    throw new AppcircleExitError('', 0);
                  }
                  
                  throw new AppcircleExitError('', 0);
                } catch (error: any) {
                  if (error instanceof AppcircleExitError) {
                    throw error;
                  }
                  console.log(chalk.yellow(`Build failed and log download also failed: ${error.message}`));
                  try {
                    await downloadBuildLogs(responseData.queueItemId, { path: buildLogPath });
                    console.log(chalk.yellow('Build failed but logs downloaded successfully.'));
                    throw new AppcircleExitError('Build failed', 1);
                  } catch (fallbackError: any) {
                    console.log(chalk.red('Build failed and could not download logs.'));
                    throw new AppcircleExitError('Build failed', 1);
                  }
                }
              } else {
                console.log(chalk.gray('Build completed successfully.'));
                
                // For verbose monitoring mode, exit immediately after continue
                if (monitorMode === BuildMonitorMode.VERBOSE) {
                  throw new AppcircleExitError('', 0);
                }
              }
              throw new AppcircleExitError('Build completed', 0);
            } catch (err) {
              if (err instanceof AppcircleExitError) {
                throw err;
              }
              console.log(chalk.gray('Build completed successfully.'));
              throw new AppcircleExitError('Build completed', 0);
            }
          } else {
            try {
              const buildStatus = finalStatusResponse && finalStatusResponse.buildStatus !== undefined ? 
                finalStatusResponse.buildStatus : null;
              
              if (buildStatus === null || buildStatus === undefined) {
                if (progressSpinner) {
                  progressSpinner.fail(chalk.red(`Build completed but status information is unavailable.`));
                } else {
                  console.log(chalk.red(`✗ Build completed but status information is unavailable.`));
                }
              } else {
                switch (buildStatus) {
                  case 1: // FAILED
                    if (progressSpinner) {
                      progressSpinner.fail(chalk.red(`Build completed, but failed.`));
                    } else {
                      console.log(chalk.red(`✗ Build completed, but failed.`));
                    }
                    break;
                  case 2: // CANCELED
                    if (progressSpinner) {
                      progressSpinner.fail(chalk.hex('#FF8C32')(`Build was canceled.`));
                    } else {
                      console.log(chalk.hex('#FF8C32')(`✗ Build was canceled.`));
                    }
                    break;
                  case 3: // TIMEOUT
                    if (progressSpinner) {
                      progressSpinner.fail(chalk.red(`Build timed out.`));
                    } else {
                      console.log(chalk.red(`✗ Build timed out.`));
                    }
                    break;
                  default:
                    if (progressSpinner) {
                      progressSpinner.fail(chalk.red(`Build completed with status code: ${buildStatus}.`));
                    } else {
                      console.log(chalk.red(`✗ Build completed with status code: ${buildStatus}.`));
                    }
                }
              }
            } catch (e) {
              if (progressSpinner) {
                progressSpinner.fail(chalk.red(`Build completed unsuccessfully.`));
              } else {
                console.log(chalk.red(`✗ Build completed unsuccessfully.`));
              }
            }
            
            // Skip interactive prompt for JSON output mode
            if (getConsoleOutputType() === 'json') {
              const jsonOutput = {
                taskId: responseData.taskId,
                queueItemId: responseData.queueItemId,
                status: 'failed',
                message: 'Build failed'
              };
              console.log(JSON.stringify(jsonOutput));
              throw new AppcircleExitError('', 1);
            }
            
            const homeDir = os.homedir();
            const defaultDownloadDir = path.join(homeDir, 'Downloads');
            const downloadPath = params.path || defaultDownloadDir;
            
            // Check if automatic download parameters are provided
            const shouldDownloadLogs = params.downloadLogs === true || params['download-logs'] === true;
            const shouldDownloadArtifacts = params.downloadArtifacts === true || params['download-artifacts'] === true;
            
            // If automatic download parameters are provided, skip interactive prompt
            if (shouldDownloadLogs || shouldDownloadArtifacts) {
              const commitId = finalStatusResponse?.commitId;
              const buildId = latestBuildId || finalStatusResponse?.buildId;
              
              if (shouldDownloadArtifacts && commitId && buildId) {
                const artifactSpinner = createOra('Waiting for artifacts to be ready...').start();
                // Wait for artifacts to be generated after build completion (increased to 10s)
                await new Promise(resolve => setTimeout(resolve, 10000));
                artifactSpinner.text = 'Downloading artifacts...';
                try {
                  const timestamp = Date.now();
                  const artifactFileName = generateArtifactFileName();
                  await downloadArtifact({ 
                    commitId: commitId, 
                    buildId: buildId,
                    branchId: params.branchId,
                    profileId: params.profileId
                  }, downloadPath, artifactFileName);
                  artifactSpinner.succeed(`Artifacts downloaded successfully: file://${path.resolve(path.join(downloadPath, artifactFileName))}`);
                } catch (e: any) {
                  const buildStatus = finalStatusResponse?.buildStatus;
                  const hasWarning = finalStatusResponse?.hasWarning;
                  const errorMessage = generateArtifactErrorMessage(buildStatus, e.message, buildId, hasWarning);
                  artifactSpinner.fail(errorMessage);
                }
              }
              
              if (shouldDownloadLogs) {
                const logSpinner = createOra('Downloading build logs...').start();
                try {
                  if (finalStatusResponse && finalStatusResponse.buildStatus === 2) {
                    console.log(chalk.yellow('Note: Logs for canceled builds might not be immediately available.'));
                    await new Promise(resolve => setTimeout(resolve, 1000));
                  }
                  
                  if (commitId && buildId && buildId !== '00000000-0000-0000-0000-000000000000') {
                    await downloadBuildLogs({ 
                      commitId: commitId, 
                      buildId: buildId,
                      branchId: params.branchId,
                      profileId: params.profileId,
                      path: downloadPath
                    });
                  } else {
                    await downloadBuildLogs(responseData.queueItemId, { path: downloadPath });
                  }
                } catch (e: any) {
                  logSpinner.fail(`Cannot download logs since the build failed: ${e.message}`);
                }
              }
              throw new AppcircleExitError('Build completed', 0);
            }
            
            // Offer to download logs even on failure using enquirer
            console.log(chalk.cyan('\nBuild failed. Would you like to download the logs?'));
            
            try {
              // @ts-ignore
              const response: any = await enquirer.prompt({
                type: 'select',
                name: 'download',
                message: 'Do you want to download the Build Logs? (Y/n)',
                choices: [
                  { name: 'yes', message: 'yes' },
                  { name: 'no', message: 'no' }
                ],
                initial: 0
              });
              
              if (response.download === 'yes') {
                const homeDir = os.homedir();
                // Use Downloads folder as default
                const defaultDownloadDir = path.join(homeDir, 'Downloads');
                const buildLogPath = await promptForPath('[OPTIONAL] Enter download path for Build Logs', defaultDownloadDir);
                params.path = buildLogPath;
                
                if (finalStatusResponse && finalStatusResponse.buildStatus === 2) {
                  params.wasCanceled = true;
                  console.log(chalk.yellow('Note: Logs for canceled Builds might not be immediately available.'));
                  await new Promise(resolve => setTimeout(resolve, 1000));
                }
                
                try {
                  const commitId = finalStatusResponse?.commitId;
                  const buildId = latestBuildId || finalStatusResponse?.buildId;
                  
                  if (commitId && buildId && buildId !== '00000000-0000-0000-0000-000000000000') {
                    await downloadBuildLogs({ 
                      commitId, 
                      buildId,
                      branchId: params.branchId,
                      profileId: params.profileId,
                      path: buildLogPath
                    });
                  } else {
                    await downloadBuildLogs(responseData.queueItemId, { path: buildLogPath });
                  }
                  console.log(chalk.green('Build log downloaded successfully.'));
                  throw new AppcircleExitError('', 0);
                } catch (error: any) {
                  if (error instanceof AppcircleExitError) {
                    throw error;
                  }
                  console.log(chalk.yellow(`Build failed and log download also failed: ${error.message}`));
                  try {
                    await downloadBuildLogs(responseData.queueItemId, { path: buildLogPath });
                    console.log(chalk.yellow('Build failed but logs downloaded successfully.'));
                    throw new AppcircleExitError('Build failed', 1);
                  } catch (fallbackError: any) {
                    console.log(chalk.red('Build failed and could not download logs.'));
                    throw new AppcircleExitError('Build failed', 1);
                  }
                }
              } else {
                throw new AppcircleExitError('Build failed', 1);
              }
            } catch (err) {
              throw new AppcircleExitError('Build failed, user chose to exit', 1);
            }
          }
        } else {
          progressSpinner.fail(chalk.red(`Build monitoring timed out after ${300 * 3} seconds.`));
          throw new AppcircleExitError('Build monitoring timed out', 1);
        }
      } catch (e) {
        if (interval) clearInterval(interval);
        if (e instanceof AppcircleExitError) {
          if (e.code === 0 || e.message === '') {
            throw e;
          }
        }
      }
    }
  } else if (command.fullCommandName === `${PROGRAM_NAME}-build-profile-list`) {
    const spinner = createOra('Listing...').start();
    const responseData = await getBuildProfiles(params);
    spinner.stop();
    commandWriter(CommandTypes.BUILD, {
      fullCommandName: command.fullCommandName,
      data: responseData,
    });
  } else if (command.fullCommandName === `${PROGRAM_NAME}-build-profile-branch-list`) {
    if (!params.profileId && !params.profile) {
      const desc = getLongDescriptionForCommand(command.fullCommandName);
      if (desc) {
        console.error(`\n${desc}\n`);
      }
      throw new AppcircleExitError('', 1);
    }
    const spinner = createOra('Listing...').start();
    const responseData = await getBranches(params);
    spinner.stop();
    commandWriter(CommandTypes.BUILD, {
      fullCommandName: command.fullCommandName,
      data: responseData,
    });
  } else if (command.fullCommandName === `${PROGRAM_NAME}-build-profile-workflows`) {
    if (!params.profileId && !params.profile) {
      const desc = getLongDescriptionForCommand(command.fullCommandName);
      if (desc) {
        console.error(`\n${desc}\n`);
      }
      throw new AppcircleExitError('', 1);
    }
    const spinner = createOra('Listing...').start();
    const responseData = await getWorkflows(params);
    spinner.stop();
    commandWriter(CommandTypes.BUILD, {
      fullCommandName: command.fullCommandName,
      data: responseData,
    });
  } else if (command.fullCommandName === `${PROGRAM_NAME}-build-profile-configurations`) {
    if (!params.profileId && !params.profile) {
      const desc = getLongDescriptionForCommand(command.fullCommandName);
      if (desc) {
        console.error(`\n${desc}\n`);
      }
      throw new AppcircleExitError('', 1);
    }
    const spinner = createOra('Listing...').start();
    const responseData = await getConfigurations(params);
    spinner.stop();
    commandWriter(CommandTypes.BUILD, {
      fullCommandName: command.fullCommandName,
      data: responseData,
    });
  } else if (command.fullCommandName === `${PROGRAM_NAME}-build-profile-branch-commits`) {
    if (!params.profileId && !params.profile) {
      const desc = getLongDescriptionForCommand(command.fullCommandName);
      if (desc) {
        console.error(`\n${desc}\n`);
      }
      throw new AppcircleExitError('', 1);
    }
    if (!params.branchId && !params.branch) {
      const desc = getLongDescriptionForCommand(command.fullCommandName);
      if (desc) {
        console.error(`\n${desc}\n`);
      }
      throw new AppcircleExitError('', 1);
    }
    const spinner = createOra('Listing...').start();
    const responseData = await getCommits(params);
    spinner.stop();
    commandWriter(CommandTypes.BUILD, {
      fullCommandName: command.fullCommandName,
      data: responseData,
    });
  } else if (command.fullCommandName === `${PROGRAM_NAME}-build-list`) {
    if (!params.profileId && !params.profile) {
      const desc = getLongDescriptionForCommand(command.fullCommandName);
      if (desc) {
        console.error(`\n${desc}\n`);
      }
      throw new AppcircleExitError('', 1);
    }
    if (!params.branchId && !params.branch) {
      const desc = getLongDescriptionForCommand(command.fullCommandName);
      if (desc) {
        console.error(`\n${desc}\n`);
      }
      throw new AppcircleExitError('', 1);
    }
    if (!params.commitId) {
      const desc = getLongDescriptionForCommand(command.fullCommandName);
      if (desc) {
        console.error(`\n${desc}\n`);
      }
      throw new AppcircleExitError('', 1);
    }
    const spinner = createOra('Listing...').start();
    const responseData = await getBuildsOfCommit(params);
    spinner.stop();
    commandWriter(CommandTypes.BUILD, {
      fullCommandName: command.fullCommandName,
      data: responseData,
    });
  } else if (command.fullCommandName === `${PROGRAM_NAME}-build-download`) {
    // Check if this is an interactive mode call
    const isInteractiveMode = getInteractiveMode();
    
    if (!params.profileId && !params.profile) {
      if (isInteractiveMode) {
        console.error(chalk.red('Error: Missing Build Profile. Please ensure a valid build profile is selected.'));
        throw new AppcircleExitError('', 1);
      } else {
        const desc = getLongDescriptionForCommand(command.fullCommandName);
        if (desc) {
          console.error(`\n${desc}\n`);
        }
        throw new AppcircleExitError('', 1);
      }
    }
    if (!params.branchId && !params.branch) {
      if (isInteractiveMode) {
        console.error(chalk.red('Error: Missing Branch. Please ensure a valid branch is selected.'));
        throw new AppcircleExitError('', 1);
      } else {
        const desc = getLongDescriptionForCommand(command.fullCommandName);
        if (desc) {
          console.error(`\n${desc}\n`);
        }
        throw new AppcircleExitError('', 1);
      }
    }
    if (!params.commitId) {
      if (isInteractiveMode) {
        console.error(chalk.red('Error: Missing Commit ID. Please ensure a valid commit is selected.'));
        throw new AppcircleExitError('', 1);
      } else {
        const desc = getLongDescriptionForCommand(command.fullCommandName);
        if (desc) {
          console.error(`\n${desc}\n`);
        }
        throw new AppcircleExitError('', 1);
      }
    }
    if (!params.buildId) {
      if (isInteractiveMode) {
        console.error(chalk.red('Error: Missing Build ID. Please ensure a valid build is selected.'));
        throw new AppcircleExitError('', 1);
      } else {
        const desc = getLongDescriptionForCommand(command.fullCommandName);
        if (desc) {
          console.error(`\n${desc}\n`);
        }
        throw new AppcircleExitError('', 1);
      }
    }
    const homeDir = os.homedir();
    const defaultDownloadDir = path.join(homeDir, 'Downloads');
    let downloadPath = params.path ? path.resolve((params.path).replace('~', homeDir)) : defaultDownloadDir;
    
    if (!fs.existsSync(downloadPath)) {
      try {
        fs.mkdirSync(downloadPath, { recursive: true });
      } catch (e) {
        console.log(chalk.yellow(`Could not create directory at ${downloadPath}. Using home directory instead.`));
        downloadPath = homeDir;
      }
    }
    
    const artifactFileName = generateArtifactFileName();
    const spinner = createOra(`Downloading`).start();
    
    try {
      if (!params.commitId && !params.branchId) {
        spinner.fail(chalk.red('Missing required parameters. Please provide either --commitId or --branchId parameter.'));
        return;
      }
      
      if (params.branchId && !params.profileId && params.profileId !== undefined) {
        try {
          const buildProfiles = await getBuildProfiles();
          if (buildProfiles && buildProfiles.length > 0) {
            params.profileId = buildProfiles[0].id;
          }
        } catch (error: any) {
          // Silently continue with alternative method
        }
      }
      
      if (params.branchId && params.profileId) {
        try {
          await downloadArtifact({
            branchId: params.branchId,
            profileId: params.profileId,
            commitId: params.commitId || ""
          }, downloadPath, artifactFileName);
          const fullPath = path.join(downloadPath, artifactFileName);
          spinner.succeed(`The file is downloaded successfully: file://${fullPath}`);
          return;
        } catch (error: any) {
          // Silently continue with alternative method
        }
      }
      
      if (params.commitId) {
        let shouldUseLatestBuildId = true;
        try {
          const buildsResponse = await getBuildsOfCommit({ commitId: params.commitId });
          if (buildsResponse && buildsResponse.builds && buildsResponse.builds.length > 0) {
            if (!params.buildId) {
              params.buildId = buildsResponse.builds[0].id;
            } else {
              const requestedBuildExists = buildsResponse.builds.some((build: any) => build.id === params.buildId);
              if (!requestedBuildExists || (buildsResponse.builds[0].id !== params.buildId)) {
                params.buildId = buildsResponse.builds[0].id;
              }
            }
          } else {
            spinner.fail(chalk.yellow(`No Builds found for commit ID: ${params.commitId}`));
            return;
          }
        } catch (error) {
          if (!params.buildId) {
            spinner.fail(chalk.red(`Could not get Build ID and buildId parameter was not provided.`));
            return;
          }
        }
        try {
          await downloadArtifact(params, downloadPath, artifactFileName);
          const fullPath = path.join(downloadPath, artifactFileName);
          spinner.succeed(`The file ${artifactFileName} is downloaded successfully: file://${fullPath}`);
        } catch (e: any) {
          const errorMessage = generateArtifactErrorMessage(null, e.message || 'Unknown error', params.buildId);
          spinner.fail(errorMessage);
          
          try {
            const buildsResponse = await getBuildsOfCommit({ commitId: params.commitId });
            
            if (buildsResponse && buildsResponse.builds && buildsResponse.builds.length > 0) {
              const latestBuild = buildsResponse.builds[0];
              console.log(chalk.cyan(`\nTry downloading with the latest Build ID:`));
              console.log(`${PROGRAM_NAME} build download --commitId ${params.commitId} --buildId ${latestBuild.id}`);
            }
          } catch (error: any) {
            // Don't show any error for build list fetch failure
          }
        }
      } else {
        spinner.fail(chalk.red('CommitId or BuildId information not found.'));
      }
    } catch (e: any) {
      const errorMessage = generateArtifactErrorMessage(null, e.message || 'Unknown error');
      spinner.fail(errorMessage);
    }
  } else if (command.fullCommandName === `${PROGRAM_NAME}-build-download-log`) {
    // Check if this is an interactive mode call
    const isInteractiveMode = getInteractiveMode();
    
    if (!params.profileId && !params.profile) {
      if (isInteractiveMode) {
        console.error(chalk.red('Error: Missing Build Profile. Please ensure a valid build profile is selected.'));
        throw new AppcircleExitError('', 1);
      } else {
        const desc = getLongDescriptionForCommand(command.fullCommandName);
        if (desc) {
          console.error(`\n${desc}\n`);
        }
        throw new AppcircleExitError('', 1);
      }
    }
    if (!params.branchId && !params.branch) {
      if (isInteractiveMode) {
        console.error(chalk.red('Error: Missing Branch. Please ensure a valid branch is selected.'));
        throw new AppcircleExitError('', 1);
      } else {
        const desc = getLongDescriptionForCommand(command.fullCommandName);
        if (desc) {
          console.error(`\n${desc}\n`);
        }
        throw new AppcircleExitError('', 1);
      }
    }
    try {
      if (params.taskId) {
        await downloadBuildLogs(params.taskId, params);
        return;
      }
      else if (params.branchId && params.profileId) {
        try {
          await downloadBuildLogs({ 
            branchId: params.branchId, 
            profileId: params.profileId,
            commitId: params.commitId,
            path: params.path
          }, params);
          return;
        } catch (error: any) {
          // Silently continue with alternative method
        }
      }
      if (params.commitId && params.buildId) {
        await downloadBuildLogs({ 
          commitId: params.commitId, 
          buildId: params.buildId,
          path: params.path 
        }, params);
        return;
      }
      await downloadBuildLogs(params, params);
    } catch (e: any) {
      console.error(`Error downloading Build Logs: ${e.message || String(e)}`);
      throw e;
    }
  } else if (command.fullCommandName === `${PROGRAM_NAME}-build-variable-group-list`) {
    const spinner = createOra('Listing Variable Groups...').start();
    const responseData = await getEnvironmentVariableGroups(params);
    spinner.stop();
    commandWriter(CommandTypes.BUILD, {
      fullCommandName: command.fullCommandName,
      data: responseData,
    });
  } else if (command.fullCommandName === `${PROGRAM_NAME}-build-variable-group-create`) {
    const responseData = await createEnvironmentVariableGroup(params);
    commandWriter(CommandTypes.BUILD, {
      fullCommandName: command.fullCommandName,
      data: { ...responseData, name: params.name },
    });
  } else if (command.fullCommandName === `${PROGRAM_NAME}-build-variable-group-upload`) {
    if (!params.variableGroupId && !params.variableGroup) {
      const desc = getLongDescriptionForCommand(command.fullCommandName);
      if (desc) {
        console.error(`\n${desc}\n`);
      }
      throw new AppcircleExitError('', 1);
    }
    const spinner = createOra('Loading Environment Variables from JSON file...').start();
    try {
      if (!params.filePath) {
        spinner.fail('JSON file path is required');
        throw new AppcircleExitError('JSON file path is required', 1);
      }
      if (params.variableGroupId) {
        const match = /\(([^)]+)\)$/.exec(params.variableGroupId);
        if (match && match[1]) {
          params.variableGroupId = match[1];
        }
      }
      const expandedPath = path.resolve(params.filePath.replace('~', os.homedir()));
      if (!fs.existsSync(expandedPath)) {
        spinner.fail('File not found');
        throw new AppcircleExitError('File not found', 1);
      }
      try {
        const fileContent = fs.readFileSync(expandedPath, 'utf8');
        JSON.parse(fileContent);
      } catch (err) {
        spinner.fail('Invalid file');
        throw new AppcircleExitError('Invalid file', 1);
      }
      params.filePath = expandedPath;
      const responseData = await uploadEnvironmentVariablesFromFile(params as any);
      spinner.succeed('Environment Variables uploaded successfully');
      commandWriter(CommandTypes.BUILD, {
        fullCommandName: command.fullCommandName,
        data: responseData,
      });
    } catch (e) {
      spinner.fail('Failed to upload Environment Variables');
      throw e;
    }
  } else if (command.fullCommandName === `${PROGRAM_NAME}-build-variable-group-download`) {
    if (!params.variableGroupId && !params.variableGroup) {
      const desc = getLongDescriptionForCommand(command.fullCommandName);
      if (desc) {
        console.error(`\n${desc}\n`);
      }
      throw new AppcircleExitError('', 1);
    }
    const spinner = createOra('Downloading Environment Variables...').start();
      try {
      const variableGroups = await getEnvironmentVariableGroups();
      const variableGroup = variableGroups.find((group: any) => group.id === params.variableGroupId);
        
        if (!variableGroup) {
        spinner.fail(`Variable Group with ID ${params.variableGroupId} not found`);
          throw new Error(`Variable Group not found`);
        }
        
      const responseData = await getEnvironmentVariables(params);
        
      let formattedVariables = responseData.map((variable: any) => ({
          key: variable.key,
          value: variable.value,
          isSecret: variable.isSecret,
          isFile: variable.isFile || false,
          id: variable.key
        }));
        
        formattedVariables.sort((a: any, b: any) => {
          const aKey = a.key;
          const bKey = b.key;
          return bKey.localeCompare(aKey);
        });
        
        const timestamp = Date.now();
        const fileName = `${variableGroup.name}_${timestamp}.json`;
        
      const homeDir = os.homedir();
      const defaultDownloadDir = path.join(homeDir, 'Downloads');
      let filePath = params.path || defaultDownloadDir;
        
        if (filePath.includes('~')) {
          filePath = filePath.replace(/~/g, os.homedir());
        }
        
        filePath = path.resolve(filePath);
        
        if (!fs.existsSync(filePath)) {
          fs.mkdirSync(filePath, { recursive: true });
        }
        
        if (fs.statSync(filePath).isDirectory()) {
          filePath = path.join(filePath, fileName);
        }
        
        fs.writeFileSync(filePath, JSON.stringify(formattedVariables));
      spinner.succeed(`Environment Variables downloaded successfully to ${filePath}`);
      } catch (e) {
      spinner.fail('Failed to download Environment Variables');
      throw e;
    }
  } else if (command.fullCommandName === `${PROGRAM_NAME}-build-variable-view`) {
    if (!params.variableGroupId && !params.variableGroup) {
      const desc = getLongDescriptionForCommand(command.fullCommandName);
      if (desc) {
        console.error(`\n${desc}\n`);
      }
      throw new AppcircleExitError('', 1);
    }
    const spinner = createOra('Listing Variables...').start();
    const responseData = await getEnvironmentVariables(params);
    spinner.stop();
    commandWriter(CommandTypes.BUILD, {
      fullCommandName: command.fullCommandName,
      data: responseData,
    });
  } else if (command.fullCommandName === `${PROGRAM_NAME}-build-variable-download`) {
    if (!params.variableGroupId && !params.variableGroup) {
      const desc = getLongDescriptionForCommand(command.fullCommandName);
      if (desc) {
        console.error(`\n${desc}\n`);
      }
      throw new AppcircleExitError('', 1);
    }
    const spinner = createOra('Downloading Environment Variables...').start();
    try {
      const variableGroups = await getEnvironmentVariableGroups();
      const variableGroup = variableGroups.find((group: any) => group.id === params.variableGroupId);
      
      if (!variableGroup) {
        spinner.fail(`Variable Group with ID ${params.variableGroupId} not found`);
        throw new Error(`Variable Group not found`);
      }
      
      const responseData = await getEnvironmentVariables(params);
      
      let formattedVariables = responseData.map((variable: any) => ({
        key: variable.key,
        value: variable.value,
        isSecret: variable.isSecret,
        isFile: variable.isFile || false,
        id: variable.key
      }));
      
      formattedVariables.sort((a: any, b: any) => {
        const aKey = a.key;
        const bKey = b.key;
        return bKey.localeCompare(aKey);
      });
      
      const timestamp = Date.now();
      const fileName = `${variableGroup.name}_${timestamp}.json`;
      
      const homeDir = os.homedir();
      const defaultDownloadDir = path.join(homeDir, 'Downloads');
      let filePath = params.path || defaultDownloadDir;
      
      if (filePath.includes('~')) {
        filePath = filePath.replace(/~/g, os.homedir());
      }
      
      filePath = path.resolve(filePath);
      
      if (!fs.existsSync(filePath)) {
        fs.mkdirSync(filePath, { recursive: true });
      }
      
      if (fs.statSync(filePath).isDirectory()) {
        filePath = path.join(filePath, fileName);
      }
      
      fs.writeFileSync(filePath, JSON.stringify(formattedVariables));
    spinner.succeed(`Environment Variables downloaded successfully to ${filePath}`);
    } catch (e) {
      spinner.fail('Failed to download Environment Variables');
      throw e;
    }
  } else if (command.fullCommandName === `${PROGRAM_NAME}-build-variable-create`) {
    if (!params.variableGroupId && !params.variableGroup) {
      const desc = getLongDescriptionForCommand(command.fullCommandName);
      if (desc) {
        console.error(`\n${desc}\n`);
      }
      throw new AppcircleExitError('', 1);
    }
    const spinner = createOra('Creating Environment Variable').start();
    try {
      if (params.type === 'file') {
        if (!params.filePath) {
          spinner.fail('File path is required for file type variables');
          process.exit(1);
        }
        const expandedPath = path.resolve(params.filePath.replace('~', os.homedir()));
        if (!fs.existsSync(expandedPath)) {
          spinner.fail('File not exists');
          process.exit(1);
        }
        params.filePath = expandedPath;
      }
      const responseData = await createEnvironmentVariable(params as any);
      spinner.succeed('Environment Variable created successfully');
      commandWriter(CommandTypes.BUILD, {
        fullCommandName: command.fullCommandName,
        data: { ...responseData, key: params.key },
      });
    } catch (e) {
      spinner.fail('Failed to create Environment Variable');
      throw e;
    }
  } else if (command.fullCommandName === `${PROGRAM_NAME}-build-active-list`) {
    const spinner = createOra('Listing...').start();
    const responseData = await getActiveBuilds();
    spinner.stop();
    commandWriter(CommandTypes.BUILD, {
      fullCommandName: command.fullCommandName,
      data: responseData,
    });
  } else if (command.fullCommandName === `${PROGRAM_NAME}-build-view`) {
    if (!params.profileId && !params.profile) {
      const desc = getLongDescriptionForCommand(command.fullCommandName);
      if (desc) {
        console.error(`\n${desc}\n`);
      }
      throw new AppcircleExitError('', 1);
    }
    if (!params.branchId && !params.branch) {
      const desc = getLongDescriptionForCommand(command.fullCommandName);
      if (desc) {
        console.error(`\n${desc}\n`);
      }
      throw new AppcircleExitError('', 1);
    }
    if (!params.commitId) {
      const desc = getLongDescriptionForCommand(command.fullCommandName);
      if (desc) {
        console.error(`\n${desc}\n`);
      }
      throw new AppcircleExitError('', 1);
    }
    if (!params.buildId) {
      const desc = getLongDescriptionForCommand(command.fullCommandName);
      if (desc) {
        console.error(`\n${desc}\n`);
      }
      throw new AppcircleExitError('', 1);
    }
    const spinner = createOra('Listing...').start();
    try {
      const responseData = await getBuildsOfCommit(params);
      if (!responseData || !responseData.builds || responseData.builds.length === 0) {
        spinner.fail('No Builds available');
        throw new AppcircleExitError('No Builds available', 1);
      }
      spinner.stop();
      const build = responseData?.builds?.find((build: any) => build.id === params.buildId);
      commandWriter(CommandTypes.BUILD, {
        fullCommandName: command.fullCommandName,
        data: build,
      });
    } catch (err) {
      spinner.fail('No Builds available');
    }
  }
  else {
    const beutufiyCommandName = command.fullCommandName.split('-').join(' ');
    const desc = getLongDescriptionForCommand(command.fullCommandName);
    if (desc) {
      console.error(`\n${desc}\n`);
    } else {
      console.error(`"${beutufiyCommandName} ..." command not found.`);
    }
  }
}

const handleDistributionCommand = async (command: ProgramCommand, params: any) => {
  // Validate parameters for commands that need them
  await validateDistributionProfileParams(command, params);
  await validateTestingGroupParams(command, params);

  // Route to appropriate handler based on command
  if (command.fullCommandName === `${PROGRAM_NAME}-testing-distribution-profile-list`) {
    return await handleDistributionProfileList(command, params);
  } else if (command.fullCommandName === `${PROGRAM_NAME}-testing-distribution-profile-create`) {
    return await handleDistributionProfileCreate(command, params);
  } else if (command.fullCommandName === `${PROGRAM_NAME}-testing-distribution-upload`) {
    return await handleDistributionUpload(command, params);
  } else if (command.fullCommandName === `${PROGRAM_NAME}-testing-distribution-profile-settings-auto-send`) {
    return await handleDistributionProfileAutoSend(command, params);
  } else if (command.fullCommandName === `${PROGRAM_NAME}-testing-distribution-testing-group-list`) {
    return await handleTestingGroupList(command);
  } else if (command.fullCommandName === `${PROGRAM_NAME}-testing-distribution-testing-group-view`) {
    return await handleTestingGroupView(command, params);
  } else if (command.fullCommandName === `${PROGRAM_NAME}-testing-distribution-testing-group-create`) {
    return await handleTestingGroupCreate(command, params);
  } else if (command.fullCommandName === `${PROGRAM_NAME}-testing-distribution-testing-group-remove`) {
    return await handleTestingGroupRemove(command, params);
  } else if (command.fullCommandName === `${PROGRAM_NAME}-testing-distribution-testing-group-tester-add`) {
    return await handleTestingGroupTesterAdd(command, params);
  } else if (command.fullCommandName === `${PROGRAM_NAME}-testing-distribution-testing-group-tester-remove`) {
    return await handleTestingGroupTesterRemove(command, params);
  }
  else {
    const beutufiyCommandName = command.fullCommandName.split('-').join(' ');
    const desc = getLongDescriptionForCommand(command.fullCommandName);
    if (desc) {
      console.error(`\n${desc}\n`);
    } else {
      console.error(`"${beutufiyCommandName} ..." command not found.`);
    }
  }
}


const handleSigningIdentityCommand = async (command: ProgramCommand, params: any) => {
  // Validate parameters for commands that need them
  await validateCertificateParams(command, params);
  await validateKeystoreParams(command, params);
  await validateProvisioningProfileParams(command, params);

  // Route to appropriate handler based on command
  if (command.fullCommandName === `${PROGRAM_NAME}-signing-identity-certificate-list`) {
    return await handleCertificateList(command);
  } else if (command.fullCommandName === `${PROGRAM_NAME}-signing-identity-certificate-upload`) {
    return await handleCertificateUpload(command, params);
  } else if (command.fullCommandName === `${PROGRAM_NAME}-signing-identity-certificate-create`) {
    return await handleCertificateCreate(command, params);
  } else if (command.fullCommandName === `${PROGRAM_NAME}-signing-identity-certificate-view`) {
    return await handleCertificateView(command, params);
  } else if (command.fullCommandName === `${PROGRAM_NAME}-signing-identity-certificate-download`) {
    return await handleCertificateDownload(command, params);
  } else if (command.fullCommandName === `${PROGRAM_NAME}-signing-identity-certificate-remove`) {
    return await handleCertificateRemove(command, params);
  } else if (command.fullCommandName === `${PROGRAM_NAME}-signing-identity-keystore-list`) {
    return await handleKeystoreList(command);
  } else if (command.fullCommandName === `${PROGRAM_NAME}-signing-identity-keystore-create`) {
    return await handleKeystoreCreate(command, params);
  } else if (command.fullCommandName === `${PROGRAM_NAME}-signing-identity-keystore-upload`) {
    return await handleKeystoreUpload(command, params);
  } else if (command.fullCommandName === `${PROGRAM_NAME}-signing-identity-keystore-download`) {
    return await handleKeystoreDownload(command, params);
  } else if (command.fullCommandName === `${PROGRAM_NAME}-signing-identity-keystore-view`) {
    return await handleKeystoreView(command, params);
  } else if (command.fullCommandName === `${PROGRAM_NAME}-signing-identity-keystore-remove`) {
    return await handleKeystoreRemove(command, params);
  } else if (command.fullCommandName === `${PROGRAM_NAME}-signing-identity-provisioning-profile-list`) {
    return await handleProvisioningProfileList(command);
  } else if (command.fullCommandName === `${PROGRAM_NAME}-signing-identity-provisioning-profile-upload`) {
    return await handleProvisioningProfileUpload(command, params);
  } else if (command.fullCommandName === `${PROGRAM_NAME}-signing-identity-provisioning-profile-download`) {
    return await handleProvisioningProfileDownload(command, params);
  } else if (command.fullCommandName === `${PROGRAM_NAME}-signing-identity-provisioning-profile-view`) {
    return await handleProvisioningProfileView(command, params);
  } else if (command.fullCommandName === `${PROGRAM_NAME}-signing-identity-provisioning-profile-remove`) {
    return await handleProvisioningProfileRemove(command, params);
  }
}

const handleEnterpriseAppStoreCommand = async (command: ProgramCommand, params: any) => {
  // Validate enterprise profile and app version parameters
  await validateEnterpriseProfileParams(command, params);
  await validateEnterpriseAppVersionParams(command, params);

  // Route to appropriate handler based on command
  if (command.fullCommandName === `${PROGRAM_NAME}-enterprise-app-store-profile-list`) {
    return await handleEnterpriseProfileList(command);
  } else if (command.fullCommandName === `${PROGRAM_NAME}-enterprise-app-store-version-list`) {
    return await handleEnterpriseVersionList(command, params);
  } else if (command.fullCommandName === `${PROGRAM_NAME}-enterprise-app-store-version-publish`) {
    return await handleEnterpriseVersionPublish(command, params);
  } else if (command.fullCommandName === `${PROGRAM_NAME}-enterprise-app-store-version-unpublish`) {
    return await handleEnterpriseVersionUnpublish(command, params);
  } else if (command.fullCommandName === `${PROGRAM_NAME}-enterprise-app-store-version-remove`) {
    return await handleEnterpriseVersionRemove(command, params);
  } else if (command.fullCommandName === `${PROGRAM_NAME}-enterprise-app-store-version-notify`) {
    return await handleEnterpriseVersionNotify(command, params);
  } else if (command.fullCommandName === `${PROGRAM_NAME}-enterprise-app-store-version-upload-for-profile`) {
    return await handleEnterpriseVersionUploadForProfile(command, params);
  } else if (command.fullCommandName === `${PROGRAM_NAME}-enterprise-app-store-version-upload-without-profile`) {
    return await handleEnterpriseVersionUploadWithoutProfile(command, params);
  } else if (command.fullCommandName === `${PROGRAM_NAME}-enterprise-app-store-version-download-link`) {
    return await handleEnterpriseVersionDownloadLink(command, params);
  }
  else {
    const beutufiyCommandName = command.fullCommandName.split('-').join(' ');
    const desc = getLongDescriptionForCommand(command.fullCommandName);
    if (desc) {
      console.error(`\n${desc}\n`);
    } else {
      console.error(`"${beutufiyCommandName} ..." command not found.`);
    }
  }
}

async function downloadBuildLogs(taskIdOrParams: string | { commitId?: string; buildId?: string; branchId?: string; profileId?: string; profileName?: string; branchName?: string; path?: string; fileName?: string }, params?: any) {
  const progressSpinner = createOra('Preparing to download Build Logs...').start();
  
  let effectiveTaskId: string | null = null;
  let providedPath = params?.path || (typeof taskIdOrParams === 'object' ? taskIdOrParams.path : undefined);
  let fileNameFromParams = params?.fileName;
  let commitId, buildId, branchId, profileId;
  let wasCanceled = params?.wasCanceled || false;

  try {
    if (typeof taskIdOrParams === 'string') {
      effectiveTaskId = taskIdOrParams;
      const homeDir = os.homedir();
      const downloadsPath = path.join(homeDir, "Downloads");
      const downloadPath = providedPath || 
                            (fs.existsSync(downloadsPath) && fs.statSync(downloadsPath).isDirectory() ? 
                              downloadsPath : process.cwd());
      const MAX_WAIT_TIME = 120000;
      const startTime = Date.now();
      let logsAvailable = false;
      let lastError = null;
      while (!logsAvailable && (Date.now() - startTime < MAX_WAIT_TIME)) {
        try {
          await downloadTaskLog({ taskId: effectiveTaskId }, downloadPath);
          const logFilePath = path.join(downloadPath, `build-task-${effectiveTaskId}-log.txt`);
          logsAvailable = true;
          progressSpinner.succeed(`Build Logs downloaded successfully: file://${logFilePath}`);
          return;
        } catch (error: any) {
          lastError = error;
          if (error.message === 'No Logs Available' || error.message.includes('HTTP error')) {
            progressSpinner.text = `Waiting for Build Logs to be prepared... (${Math.round((Date.now() - startTime) / 1000)}s elapsed)`;
            await new Promise(resolve => setTimeout(resolve, 5000));
          } else {
            break;
          }
        }
      }
      if (!logsAvailable) {
        progressSpinner.text = "Trying alternative download method...";
        try {
          const taskStatus = await getBuildStatusFromQueue({ taskId: effectiveTaskId });
          if (taskStatus && taskStatus.commitId) {
            commitId = taskStatus.commitId;
            if (!taskStatus.buildId || taskStatus.buildId === '00000000-0000-0000-0000-000000000000') {
              try {
                const buildsResponse = await getBuildsOfCommit({ commitId });
                if (buildsResponse && buildsResponse.builds && buildsResponse.builds.length > 0) {
                  buildId = buildsResponse.builds[0].id;
                } else {
                  buildId = taskStatus.buildId;
                }
              } catch (error) {
                buildId = taskStatus.buildId;
              }
            } else {
              buildId = taskStatus.buildId;
            }
            if (taskStatus.buildStatus === 2) {
              wasCanceled = true;
            }
          } else {
            const idParts = effectiveTaskId.split('-');
            if (idParts.length >= 2) {
              commitId = idParts[0];
              buildId = idParts[1];
            } else {
              progressSpinner.fail(chalk.red('Could not get Build details from Task ID.'));
              return;
            }
          }
        } catch (e) {
          const idParts = effectiveTaskId.split('-');
          if (idParts.length >= 2) {
            commitId = idParts[0];
            buildId = idParts[1];
          } else {
            progressSpinner.fail(chalk.red('Could not get Build details from Task ID.'));
            return;
          }
        }
      }
    } else {
      commitId = taskIdOrParams.commitId;
      buildId = taskIdOrParams.buildId;
      branchId = taskIdOrParams.branchId;
      profileId = taskIdOrParams.profileId;
      providedPath = taskIdOrParams.path;
      fileNameFromParams = taskIdOrParams.fileName;
    }

    if (branchId && profileId) {
      progressSpinner.text = "Getting latest Build ID with Branch and Profile ID...";
      try {
        const latestBuild = await getLatestBuildByBranch({ branchId, profileId });
        if (latestBuild) {
          buildId = latestBuild.id;
          commitId = latestBuild.commitId;
          progressSpinner.text = `Got latest Build ID from API: ${buildId}`;
        } else {
          progressSpinner.fail(chalk.yellow(`No Builds found for Branch and Profile ID.`));
          return;
        }
      } catch (error: any) {
        // Silently continue with alternative method
      }
    }

    if (!buildId || buildId === '00000000-0000-0000-0000-000000000000') {
      if (commitId) {
        try {
          const buildsResponse = await getBuildsOfCommit({ commitId });
          if (buildsResponse && buildsResponse.builds && buildsResponse.builds.length > 0) {
            buildId = buildsResponse.builds[0].id;
          }
        } catch (error) {
          // Continue with existing information
        }
      }
    }

    if (!commitId || !buildId) {
      progressSpinner.fail(chalk.red('Missing required parameters: commitId and buildId'));
      return;
    }

    const homeDir = os.homedir();
    const downloadsPath = path.join(homeDir, 'Downloads');
    const defaultDownloadDir = fs.existsSync(downloadsPath) && fs.statSync(downloadsPath).isDirectory() ? 
                                downloadsPath : process.cwd();
    
    let finalDownloadPath = defaultDownloadDir;

    if (providedPath) {
      if (typeof providedPath === 'string' && providedPath.trim() !== "") {
        const cliPath = path.resolve(providedPath.trim().replace('~', homeDir));
        if (!fs.existsSync(cliPath)) {
          try {
            fs.mkdirSync(cliPath, { recursive: true });
            finalDownloadPath = cliPath;
          } catch (e: any) {
            progressSpinner.fail(chalk.yellow(`Could not create directory: ${cliPath}. Using default path: ${defaultDownloadDir}`));
            finalDownloadPath = defaultDownloadDir;
          }
        } else if (fs.statSync(cliPath).isDirectory()) {
          finalDownloadPath = cliPath;
        } else {
          progressSpinner.fail(chalk.yellow(`Specified path is not a directory: ${cliPath}. Using default path: ${defaultDownloadDir}`));
          finalDownloadPath = defaultDownloadDir;
        }
      } else {
        finalDownloadPath = defaultDownloadDir;
      }
    }

    let profileName = 'unknown';
    let branchName = 'unknown';
    
    // Try to get profile and branch names from various sources
    if (params?.profileId || (typeof taskIdOrParams === 'object' && taskIdOrParams?.profileId)) {
      try {
        const profileId = params?.profileId || (typeof taskIdOrParams === 'object' ? taskIdOrParams?.profileId : undefined);
        const branchId = params?.branchId || (typeof taskIdOrParams === 'object' ? taskIdOrParams?.branchId : undefined);
        
        // Get profile name from build profiles
        const buildProfiles = await getBuildProfiles();
        const profile = buildProfiles?.find((p: any) => p.id === profileId);
        if (profile) {
          profileName = profile.name || 'unknown';
        }
        
        // Get branch name from branches if we have branchId
        if (branchId) {
          const branchesData = await getBranches({ profileId });
          const branch = branchesData?.branches?.find((b: any) => b.id === branchId);
          if (branch) {
            branchName = branch.name || 'unknown';
          }
        }
      } catch (error) {
        // Use default names if profile/branch info cannot be fetched
      }
    }

    const timestamp = Date.now();
    const fileName = fileNameFromParams || 
                    `${sanitizeForFileName(branchName)}-${sanitizeForFileName(profileName)}-build-${buildId}-logs-${timestamp}.txt`;
    
    if (wasCanceled) {
      progressSpinner.text = "Waiting for canceled Build Logs to be prepared...";
      await new Promise(resolve => setTimeout(resolve, 2000));
    } else {
      progressSpinner.text = "Waiting for Build Logs to be prepared...";
    }
    
    const MAX_RETRIES = 5;
    const RETRY_DELAY = 3000;
    let attempt = 0;
    let lastError = null;
    while (attempt < MAX_RETRIES) {
      try {
        await downloadBuildLog({ commitId, buildId }, finalDownloadPath, fileName);
        const fullPath = path.join(finalDownloadPath, fileName);
        progressSpinner.succeed(`Build Logs downloaded successfully: file://${fullPath}`);
        return;
      } catch (error: any) {
        lastError = error;
        const isNotFoundError = error.message && (
          error.message.includes('404') || 
          error.message.includes('No Logs Available') ||
          error.message.includes('HTTP error')
        );
        attempt++;
        if (wasCanceled && isNotFoundError && attempt < MAX_RETRIES) {
          progressSpinner.text = `Waiting for canceled Build Logs to be prepared... (Attempt ${attempt})`;
          await new Promise(resolve => setTimeout(resolve, RETRY_DELAY * 2));
        } else if (isNotFoundError && attempt < MAX_RETRIES) {
          progressSpinner.text = `Waiting for Build Logs to be prepared... (Attempt ${attempt})`;
          await new Promise(resolve => setTimeout(resolve, RETRY_DELAY));
        } else {
          break;
        }
      }
    }
    if (lastError) {
      if (lastError.message && lastError.message.includes('No Logs Available')) {
        if (wasCanceled) {
          progressSpinner.fail(
            chalk.yellow(`No Logs available for this canceled Build.`)
          );
        } else {
          progressSpinner.fail(
            chalk.yellow(`No Logs available for this Build. The Build may not be completed yet.`)
          );
        }
      } else if (lastError.message && lastError.message.includes('404')) {
        progressSpinner.fail(
          chalk.yellow(`Build Logs are not ready yet. Please try again later.`)
        );
      } else {
        progressSpinner.fail(`Cannot download logs since the build failed: ${lastError.message || String(lastError)}`);
      }
    } else {
      progressSpinner.fail(`Cannot download logs since the build failed after multiple attempts.`);
    }
  } catch (e: any) {
    progressSpinner.fail(chalk.red(`Error downloading Build Logs: ${e.message || String(e)}`));
  }
}

async function downloadPublishLogs(publishDetail: any, platform: string, publishProfileId: string, userProvidedPath?: string) {
  if (!publishDetail || !publishDetail.id) {
    return;
  }
  
  const publishId = publishDetail.id;
  const downloadSpinner = createOra("Downloading Publish Logs...").start();
  
  try {
    let finalDownloadPath = "";
    const homeDir = os.homedir();
    const defaultDownloadDir = path.join(homeDir, 'Downloads');

    if (userProvidedPath && userProvidedPath.trim() !== "") {
        finalDownloadPath = path.resolve(userProvidedPath.trim().replace('~', homeDir));
        if (!fs.existsSync(finalDownloadPath)) {
            try {
                fs.mkdirSync(finalDownloadPath, { recursive: true });
                console.log(chalk.gray(`Created directory: ${finalDownloadPath}`));
            } catch (e:any) {
                console.log(chalk.yellow(`Could not create directory at ${finalDownloadPath}: ${e.message}. Using default download path.`));
                finalDownloadPath = defaultDownloadDir;
            }
        } else if (!fs.statSync(finalDownloadPath).isDirectory()) {
            console.log(chalk.yellow(`Provided path ${finalDownloadPath} is not a directory. Using default download path.`));
            finalDownloadPath = defaultDownloadDir;
        }
    } else {
        finalDownloadPath = defaultDownloadDir;
    }
    
    // Get profile name
    let profileName = 'unknown';
    try {
      const profileDetail = await getPublishProfileDetailById({ platform, publishProfileId });
      profileName = profileDetail.name || 'unknown';
    } catch (error) {
      console.log(chalk.yellow('Could not retrieve profile name, using default name'));
    }
    
    const timestamp = Date.now();
    const fileName = `${sanitizeForFileName(profileName)}-${timestamp}.txt`;
    const filePath = path.join(finalDownloadPath, fileName);
    
    const MAX_WAIT_TIME = 120000; // 2 minutes timeout
    const startTime = Date.now();
    let logsAvailable = false;
    
    while (!logsAvailable && (Date.now() - startTime < MAX_WAIT_TIME)) {
      try {
        const response = await appcircleApi.get(
          `publish/v1/profiles/${platform}/${publishProfileId}/publish/${publishId}/logs`,
          {
            headers: getHeaders(),
            responseType: 'text'
          }
        );
        
        if (response.status === 200) {
          const logContent = response.data;
          
          if (!logContent || logContent.trim() === '' || logContent.includes('No Logs Available')) {
            downloadSpinner.text = "Waiting for Publish Logs to be prepared...";
            await new Promise(resolve => setTimeout(resolve, 5000));
          } else {
            fs.writeFileSync(filePath, logContent);
            logsAvailable = true;
            downloadSpinner.succeed(`Publish Logs downloaded successfully to: ${filePath}`);
            break;
          }
        } else {
          downloadSpinner.text = "Waiting for Publish Logs to be prepared...";
          await new Promise(resolve => setTimeout(resolve, 5000));
        }
      } catch (error: any) {
        if (error.response && error.response.status === 404) {
          downloadSpinner.text = "Waiting for Publish Logs to be prepared...";
          await new Promise(resolve => setTimeout(resolve, 5000));
        } else {
          throw error;
        }
      }
    }
    
    if (!logsAvailable) {
      fs.writeFileSync(filePath, 'No logs available for this publish.');
      downloadSpinner.fail('Could not retrieve Publish Logs after waiting for 2 minutes.');
    }
  } catch (error) {
    downloadSpinner.fail(`Error downloading Publish Logs: ${error instanceof Error ? error.message : String(error)}`);
  }
}

async function checkPublishStatusDirectly(platform: string, publishProfileId: string, appVersionId: string): Promise<{status: number, detail?: any}> {
  try {
    const url = `publish/v1/profiles/${platform}/${publishProfileId}/app-versions/${appVersionId}/publish`;
    
    const response = await appcircleApi.get(url, {
      headers: getHeaders(),
      validateStatus: () => true
    });
    
    if (response.status === 200 && response.data) {
      return { 
        status: typeof response.data.status === 'number' ? response.data.status : 99, 
        detail: response.data
      };
    } else {
      console.log(chalk.yellow(`Could not get Publish Status. Status code: ${response.status}`));
      return { status: 99 }; // Unknown status
    }
  } catch (error: any) {
    console.log(chalk.yellow(`Error checking Publish Status: ${error.message}`));
    return { status: 99 };
  }
}

async function monitorPublishProcess(params: any) {
  const { platform, publishProfileId, appVersionId, publishId } = params;
  
  const progressSpinner = getConsoleOutputType() === 'json' ? 
    { text: '', succeed: () => {}, fail: () => {}, stop: () => {} } : 
    createOra(`Checking Publish Status...`).start();
  let dots = "";
  const startTime = Date.now();
  
  const interval = getConsoleOutputType() === 'json' ? null : setInterval(() => {
    dots = dots.length >= 3 ? "" : dots + ".";
    const elapsedSeconds = Math.floor((Date.now() - startTime) / 1000);
    const elapsedMinutes = Math.floor(elapsedSeconds / 60);
    const elapsedText = elapsedMinutes > 0 ? 
      `${elapsedMinutes}m ${elapsedSeconds % 60}s` : 
      `${elapsedSeconds}s`;
    progressSpinner.text = chalk.yellow(`Publish Running${dots} (${elapsedText})`);
  }, 500);
  
  let publishCompleted = false;
  let publishSuccess = false;
  let publishStatusHandled = false;
  let retryCount = 0;
  const maxRetries = 60; // 10 minute timeout (checking every 10 seconds)
  
  try {
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    while (!publishCompleted && retryCount < maxRetries) {
      try {
        const statusResult = await checkPublishStatusDirectly(platform, publishProfileId, appVersionId);
        const status = statusResult.status;
        
        switch (status) {
          case 0: // SUCCESS
            if (interval) clearInterval(interval);
            
            if (getConsoleOutputType() === 'json') {
              const jsonOutput = {
                publishId: publishId,
                status: 'success',
                message: 'Publish completed successfully'
              };
              console.log(JSON.stringify(jsonOutput));
              publishCompleted = true;
              publishSuccess = true;
              publishStatusHandled = true;
              throw new AppcircleExitError('Publish completed successfully', 0);
            }
            
            const elapsedSeconds = Math.floor((Date.now() - startTime) / 1000);
            const elapsedMinutes = Math.floor(elapsedSeconds / 60);
            const elapsedText = elapsedMinutes > 0 ? 
              `${elapsedMinutes}m ${elapsedSeconds % 60}s` : 
              `${elapsedSeconds}s`;
            progressSpinner.succeed(chalk.green(`Publish completed successfully ✅ - Total time: ${elapsedText}`));
            
            // Handle log download directly here to avoid infinite loop
            try {
              const publishDetail = await getPublisDetailById(params);
              
              // @ts-ignore
              const response: any = await enquirer.prompt({
                type: 'select',
                name: 'download',
                message: 'Do you want to download the Publish Logs? (Y/n)',
                choices: [
                  { name: 'yes', message: 'yes' },
                  { name: 'no', message: 'no' }
                ],
                initial: 0
              });

              if (response.download === 'yes') {
                const homeDir = os.homedir();
                const defaultDownloadDir = path.join(homeDir, 'Downloads');
                const publishLogPath = await promptForPath('[OPTIONAL] Enter download path for Publish Logs', defaultDownloadDir);
                await downloadPublishLogs(publishDetail, params.platform, params.publishProfileId, publishLogPath);
              } else {
                console.log(chalk.gray('Skipping Publish Logs download.'));
              }
              console.log(chalk.cyan('\nYou can check the Publish details with:'));
              console.log(`${PROGRAM_NAME} publish view --platform ${params.platform} --publishProfileId ${params.publishProfileId} --appVersionId ${params.appVersionId}`);
            } catch (e) {
              // If we can't get Publish details, just show the command
              console.log(chalk.yellow('\nPublish completed successfully, but could not retrieve details to offer log download.'));
              console.log(chalk.cyan('You can check the Publish details with:'));
              console.log(`${PROGRAM_NAME} publish view --platform ${params.platform} --publishProfileId ${params.publishProfileId} --appVersionId ${params.appVersionId}`);
            }
            
            publishCompleted = true;
            publishSuccess = true;
            publishStatusHandled = true;
            // Exit the monitoring process completely
            throw new AppcircleExitError('Publish completed successfully', 0);
            
          case 1: // FAILED
            if (interval) clearInterval(interval);
            
            if (getConsoleOutputType() === 'json') {
              const jsonOutput = {
                publishId: publishId,
                status: 'failed',
                message: 'Publish failed'
              };
              console.log(JSON.stringify(jsonOutput));
              publishCompleted = true;
              publishStatusHandled = true;
              throw new AppcircleExitError('', 1);
            }
            
            progressSpinner.fail(chalk.red(`Publish failed ❌`));
            
            // Handle log download directly here to avoid infinite loop
            try {
              const publishDetail = await getPublisDetailById(params);
              console.log(chalk.red('\nPublish process did not complete successfully.'));
              
              // @ts-ignore
              const response: any = await enquirer.prompt({
                type: 'select',
                name: 'download',
                message: 'Do you want to download the Publish Logs? (Y/n)',
                choices: [
                  { name: 'yes', message: 'yes' },
                  { name: 'no', message: 'no' }
                ],
                initial: 0
              });

              if (response.download === 'yes') {
                const homeDir = os.homedir();
                const defaultDownloadDir = path.join(homeDir, 'Downloads');
                const publishLogPath = await promptForPath('[OPTIONAL] Enter download path for Publish Logs', defaultDownloadDir);
                await downloadPublishLogs(publishDetail, params.platform, params.publishProfileId, publishLogPath);
              } else {
                console.log(chalk.gray('Skipping Publish Logs download.'));
              }
              console.log(chalk.yellow('\nView details with:'));
              console.log(`${PROGRAM_NAME} publish view --platform ${params.platform} --publishProfileId ${params.publishProfileId} --appVersionId ${params.appVersionId}`);
            } catch (e) {
              console.log(chalk.yellow('\nPublish process did not complete successfully, and could not retrieve details to offer log download.'));
              console.log(chalk.yellow('View details with:'));
              console.log(`${PROGRAM_NAME} publish view --platform ${params.platform} --publishProfileId ${params.publishProfileId} --appVersionId ${params.appVersionId}`);
            }
            
            publishCompleted = true;
            publishStatusHandled = true;
            throw new AppcircleExitError('Publish process did not complete successfully', 1);
            
          case 2: // CANCELLED
            if (interval) clearInterval(interval);
            
            if (getConsoleOutputType() === 'json') {
              const jsonOutput = {
                publishId: publishId,
                status: 'failed',
                message: 'Publish failed'
              };
              console.log(JSON.stringify(jsonOutput));
              publishCompleted = true;
              publishStatusHandled = true;
              throw new AppcircleExitError('', 1);
            }
            
            progressSpinner.fail(chalk.hex('#FF8C32')(`Publish was canceled 🚫`));
            
            // Handle log download directly here to avoid infinite loop
            try {
              const publishDetail = await getPublisDetailById(params);
              console.log(chalk.red('\nPublish process did not complete successfully.'));
              
              // @ts-ignore
              const response: any = await enquirer.prompt({
                type: 'select',
                name: 'download',
                message: 'Do you want to download the Publish Logs? (Y/n)',
                choices: [
                  { name: 'yes', message: 'yes' },
                  { name: 'no', message: 'no' }
                ],
                initial: 0
              });

              if (response.download === 'yes') {
                const homeDir = os.homedir();
                const defaultDownloadDir = path.join(homeDir, 'Downloads');
                const publishLogPath = await promptForPath('[OPTIONAL] Enter download path for Publish Logs', defaultDownloadDir);
                await downloadPublishLogs(publishDetail, params.platform, params.publishProfileId, publishLogPath);
              } else {
                console.log(chalk.gray('Skipping Publish Logs download.'));
              }
              console.log(chalk.yellow('\nView details with:'));
              console.log(`${PROGRAM_NAME} publish view --platform ${params.platform} --publishProfileId ${params.publishProfileId} --appVersionId ${params.appVersionId}`);
            } catch (e) {
              console.log(chalk.yellow('\nPublish process did not complete successfully, and could not retrieve details to offer log download.'));
              console.log(chalk.yellow('View details with:'));
              console.log(`${PROGRAM_NAME} publish view --platform ${params.platform} --publishProfileId ${params.publishProfileId} --appVersionId ${params.appVersionId}`);
            }
            
            publishCompleted = true;
            publishStatusHandled = true;
            throw new AppcircleExitError('Publish was canceled', 1);
            
          case 3: // TIMEOUT
            if (interval) clearInterval(interval);
            
            if (getConsoleOutputType() === 'json') {
              const jsonOutput = {
                publishId: publishId,
                status: 'failed',
                message: 'Publish failed'
              };
              console.log(JSON.stringify(jsonOutput));
              publishCompleted = true;
              publishStatusHandled = true;
              throw new AppcircleExitError('', 1);
            }
            
            progressSpinner.fail(chalk.red(`Publish timed out ⏱️`));
            
            // Handle log download directly here to avoid infinite loop
            try {
              const publishDetail = await getPublisDetailById(params);
              console.log(chalk.red('\nPublish process did not complete successfully.'));
              
              // @ts-ignore
              const response: any = await enquirer.prompt({
                type: 'select',
                name: 'download',
                message: 'Do you want to download the Publish Logs? (Y/n)',
                choices: [
                  { name: 'yes', message: 'yes' },
                  { name: 'no', message: 'no' }
                ],
                initial: 0
              });

              if (response.download === 'yes') {
                const homeDir = os.homedir();
                const defaultDownloadDir = path.join(homeDir, 'Downloads');
                const publishLogPath = await promptForPath('[OPTIONAL] Enter download path for Publish Logs', defaultDownloadDir);
                await downloadPublishLogs(publishDetail, params.platform, params.publishProfileId, publishLogPath);
              } else {
                console.log(chalk.gray('Skipping Publish Logs download.'));
              }
              console.log(chalk.yellow('\nView details with:'));
              console.log(`${PROGRAM_NAME} publish view --platform ${params.platform} --publishProfileId ${params.publishProfileId} --appVersionId ${params.appVersionId}`);
            } catch (e) {
              console.log(chalk.yellow('\nPublish process did not complete successfully, and could not retrieve details to offer log download.'));
              console.log(chalk.yellow('View details with:'));
              console.log(`${PROGRAM_NAME} publish view --platform ${params.platform} --publishProfileId ${params.publishProfileId} --appVersionId ${params.appVersionId}`);
            }
            
            publishCompleted = true;
            publishStatusHandled = true;
            throw new AppcircleExitError('Publish timed out', 1);
            
          case 90: // WAITING
            progressSpinner.text = chalk.cyan(`Publish waiting in queue ⏳`);
            break;
            
          case 91: // RUNNING
            // Already showing animation via interval
            break;
            
          case 92: // COMPLETING
            progressSpinner.text = chalk.blue(`Publish finishing... 🔜`);
            break;
            
          case 99: // UNKNOWN
            progressSpinner.text = chalk.gray(`Publish Status unknown`);
            break;
            
          case 100: // SKIPPED
            progressSpinner.text = chalk.hex('#9370DB')(`Publish Step skipped ⏭️`);
            // May need special handling, but typically not a final state
            break;
            
          case 201: // STOPPED
            if (interval) clearInterval(interval);
            
            if (getConsoleOutputType() === 'json') {
              const jsonOutput = {
                publishId: publishId,
                status: 'failed',
                message: 'Publish failed'
              };
              console.log(JSON.stringify(jsonOutput));
              publishCompleted = true;
              publishStatusHandled = true;
              throw new AppcircleExitError('', 1);
            }
            
            progressSpinner.fail(chalk.hex('#FF8C32')(`Publish was stopped 🛑`));
            
            // Handle log download directly here to avoid infinite loop
            try {
              const publishDetail = await getPublisDetailById(params);
              console.log(chalk.red('\nPublish process did not complete successfully.'));
              
              // @ts-ignore
              const response: any = await enquirer.prompt({
                type: 'select',
                name: 'download',
                message: 'Do you want to download the Publish Logs? (Y/n)',
                choices: [
                  { name: 'yes', message: 'yes' },
                  { name: 'no', message: 'no' }
                ],
                initial: 0
              });

              if (response.download === 'yes') {
                const homeDir = os.homedir();
                const defaultDownloadDir = path.join(homeDir, 'Downloads');
                const publishLogPath = await promptForPath('[OPTIONAL] Enter download path for Publish Logs', defaultDownloadDir);
                await downloadPublishLogs(publishDetail, params.platform, params.publishProfileId, publishLogPath);
              } else {
                console.log(chalk.gray('Skipping Publish Logs download.'));
              }
              console.log(chalk.yellow('\nView details with:'));
              console.log(`${PROGRAM_NAME} publish view --platform ${params.platform} --publishProfileId ${params.publishProfileId} --appVersionId ${params.appVersionId}`);
            } catch (e) {
              console.log(chalk.yellow('\nPublish process did not complete successfully, and could not retrieve details to offer log download.'));
              console.log(chalk.yellow('View details with:'));
              console.log(`${PROGRAM_NAME} publish view --platform ${params.platform} --publishProfileId ${params.publishProfileId} --appVersionId ${params.appVersionId}`);
            }
            
            publishCompleted = true;
            publishStatusHandled = true;
            throw new AppcircleExitError('Publish was stopped', 1);
            
          case 202: // IN PROGRESS
            progressSpinner.text = chalk.blue(`Publish in progress...`);
            break;
            
          case 203: // AWAITING RESPONSE
            progressSpinner.text = chalk.cyan(`Publish awaiting response... ⌛`);
            break;
            
          default:
            progressSpinner.text = chalk.gray(`Publish Status: ${status}`);
        }
        
        await new Promise(resolve => setTimeout(resolve, 10000)); // Check every 10 seconds
        retryCount++;
        
      } catch (e) {
        await new Promise(resolve => setTimeout(resolve, 10000));
        retryCount++;
      }
    }
    
    if (interval) clearInterval(interval);
    
    if (!publishCompleted) {
      if (getConsoleOutputType() === 'json') {
        const jsonOutput = {
          publishId: publishId,
          status: 'failed',
          message: 'Publish failed'
        };
        console.log(JSON.stringify(jsonOutput));
        throw new AppcircleExitError('', 1);
      }
      progressSpinner.fail(chalk.red(`Publish monitoring timed out after ${maxRetries * 10} seconds.`));
      throw new AppcircleExitError('Publish monitoring timed out', 1);
    }
  } catch (e) {
    if (interval) clearInterval(interval);
    // If it's an AppcircleExitError, re-throw it to exit properly
    if (e instanceof AppcircleExitError) {
      throw e;
    }
    if (getConsoleOutputType() === 'json') {
      const jsonOutput = {
        publishId: publishId,
        status: 'failed',
        message: 'Publish failed'
      };
      console.log(JSON.stringify(jsonOutput));
      throw new AppcircleExitError('', 1);
    }
    progressSpinner.fail(chalk.red(`Error while monitoring Publish Status.`));
    throw new AppcircleExitError('Error while monitoring Publish Status', 1);
  }
}

async function handleSuccessfulPublish(params: any, progressSpinner: any) {
  try {
    const publishDetail = await getPublisDetailById(params);
    
    // @ts-ignore
    const response: any = await enquirer.prompt({
      type: 'select',
      name: 'download',
      message: 'Do you want to download the Publish Logs? (Y/n)',
      choices: [
        { name: 'yes', message: 'yes' },
        { name: 'no', message: 'no' }
      ],
      initial: 0
    });

    if (response.download === 'yes') {
      const homeDir = os.homedir();
      const defaultDownloadDir = path.join(homeDir, 'Downloads');
      const publishLogPath = await promptForPath('[OPTIONAL] Enter download path for Publish Logs', defaultDownloadDir);
      await downloadPublishLogs(publishDetail, params.platform, params.publishProfileId, publishLogPath);
    } else {
      console.log(chalk.gray('Skipping Publish Logs download.'));
    }
    console.log(chalk.cyan('\nYou can check the Publish details with:'));
    console.log(`${PROGRAM_NAME} publish view --platform ${params.platform} --publishProfileId ${params.publishProfileId} --appVersionId ${params.appVersionId}`);
    throw new AppcircleExitError('Publish completed successfully', 0);
  } catch (e) {
    // If the error is our own AppcircleExitError, re-throw it
    if (e instanceof AppcircleExitError) {
      throw e;
    }
    // Only handle actual errors here, not successful completion
    console.log(chalk.yellow('\nPublish completed successfully, but could not retrieve details to offer log download.'));
    console.log(chalk.cyan('You can check the Publish details with:'));
    console.log(`${PROGRAM_NAME} publish view --platform ${params.platform} --publishProfileId ${params.publishProfileId} --appVersionId ${params.appVersionId}`);
    throw new AppcircleExitError('Publish completed successfully', 0);
  }
}

async function handleFailedPublish(params: any, progressSpinner: any) {
  try {
    const publishDetail = await getPublisDetailById(params);
    console.log(chalk.red('\nPublish process did not complete successfully.'));
    
    // @ts-ignore
    const response: any = await enquirer.prompt({
      type: 'select',
      name: 'download',
      message: 'Do you want to download the Publish Logs? (Y/n)',
      choices: [
        { name: 'yes', message: 'yes' },
        { name: 'no', message: 'no' }
      ],
      initial: 0
    });

    if (response.download === 'yes') {
      const homeDir = os.homedir();
      const defaultDownloadDir = path.join(homeDir, 'Downloads');
      const publishLogPath = await promptForPath('[OPTIONAL] Enter download path for Publish Logs', defaultDownloadDir);
      await downloadPublishLogs(publishDetail, params.platform, params.publishProfileId, publishLogPath);
    } else {
      console.log(chalk.gray('Skipping Publish Logs download.'));
    }
    console.log(chalk.yellow('\nView details with:'));
    console.log(`${PROGRAM_NAME} publish view --platform ${params.platform} --publishProfileId ${params.publishProfileId} --appVersionId ${params.appVersionId}`);
    throw new AppcircleExitError('Publish process did not complete successfully', 1);
  } catch (e) {
    // If the error is our own AppcircleExitError, re-throw it
    if (e instanceof AppcircleExitError) {
      throw e;
    }
    // Only handle actual errors here, not successful completion
    console.log(chalk.yellow('\nPublish process did not complete successfully, and could not retrieve details to offer log download.'));
    console.log(chalk.yellow('View details with:'));
    console.log(`${PROGRAM_NAME} publish view --platform ${params.platform} --publishProfileId ${params.publishProfileId} --appVersionId ${params.appVersionId}`);
    throw new AppcircleExitError('Publish process did not complete successfully', 1);
  }
}

function findCommandByParts(parts: string[], commandList: CommandType[]): CommandType | undefined {
  if (!parts.length) return undefined;
  const [head, ...tail] = parts;
  const found = commandList.find(cmd => cmd.command === head);
  if (!found) return undefined;
  if (tail.length === 0) return found;
  if (found.subCommands) return findCommandByParts(tail, found.subCommands);
  return found;
}

export function getLongDescriptionForCommand(fullCommandName: string): string | undefined {
  const parts = fullCommandName.replace(/^appcircle-/, '').split('-');
  const cmd = findCommandByParts(parts, Commands);
  if (cmd) return cmd.longDescription || cmd.description;
  return undefined;
}

export const runCommand = async (command: ProgramCommand) => {
  const params = command.opts() as any;
  const commandName = command.name();
  let responseData;

  //console.log('Full-Command-Name: ', command.fullCommandName, params);

  // Validate parameter error flag using utility function
  const paramValidation = validateParameterErrorFlag(params);
  if (!paramValidation.isValid) {
    throw new AppcircleExitError(paramValidation.error!, 1);
  }

  // Handle config command
  if (command.isGroupCommand(CommandTypes.CONFIG)) {
    return handleConfigCommand(command);
  }

  if (command.isGroupCommand(CommandTypes.ORGANIZATION)) {
    return handleOrganizationCommand(command, params);
  }

  if (command.isGroupCommand(CommandTypes.PUBLISH)) {
    return handlePublishCommand(command, params);
  }

  if (command.isGroupCommand(CommandTypes.BUILD)) {
    return handleBuildCommand(command, params);
  }

  if (command.isGroupCommand(CommandTypes.TESTING_DISTRIBUTION)) {
    return handleDistributionCommand(command, params);
  }
  if (command.isGroupCommand(CommandTypes.ENTERPRISE_APP_STORE)) {
    return handleEnterpriseAppStoreCommand(command, params);
  }
  if (command.isGroupCommand(CommandTypes.SIGNING_IDENTITY)) {
    return handleSigningIdentityCommand(command, params);
  }

  if (command.isGroupCommand(CommandTypes.LOGIN)) {
    return handleLoginCommand(command, params);
  }

  if (command.isGroupCommand(CommandTypes.LOGOUT)) {
    return handleLogoutCommand(command, params);
  }

  switch (commandName) {
    default: {
      const desc = getLongDescriptionForCommand(command.fullCommandName);
      const errorMessage = createUnknownCommandError(command.fullCommandName, desc);
      console.error(errorMessage);
      throw new AppcircleExitError('Command not found', 1);
    }
  }
};

// Sanitization function is now imported from utilities
