import path from 'path';
import os from 'os';
import fs from 'fs';
import readline from 'readline'; // Added readline for user prompt
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
  readEnviromentConfigVariable,
  setCurrentConfigVariable,
  writeEnviromentConfigVariable,
} from '../config';
import { createOra } from '../utils/orahelper';
import { ProgramCommand } from '../program';
import {
  getToken,
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
  getBuildStatusFromQueue,
  downloadTaskLog,
  createSubOrganization,
  getLatestBuildByBranch,
  getLatestBuildId
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
 * Prompts the user for a file path with a default value
 * @param message The message to display to the user
 * @param defaultPath The default path if user doesn't provide one
 * @returns The resolved file path
 */
async function promptForPath(message: string, defaultPath: string): Promise<string> {
  try {
    // @ts-ignore
    const response: any = await enquirer.prompt({
      type: 'input',
      name: 'path',
      message: message,
      initial: defaultPath
    });
    
    return response.path.trim() || defaultPath;
  } catch (err) {
    // If user cancels, return default path
    return defaultPath;
  }
}

const handleConfigCommand = (command: ProgramCommand) => {
  const action = command.name();
  const key = command.args()[0] || '';
  if (action === 'list') {
    const store = getConfigStore();
    if (getConsoleOutputType() === 'json') {
      configWriter(store);
    } else {
      configWriter({ current: store.current, path: getConfigFilePath() });
      configWriter(getEnviromentsConfigToWriting());
    }
  } else if (action === 'set') {
    writeEnviromentConfigVariable(key, command.args()[1]);
    configWriter({ [key]: readEnviromentConfigVariable(key) });
  } else if (action === 'get') {
    configWriter({ [key]: readEnviromentConfigVariable(key) });
  } else if (action === 'current') {
    const store = getConfigStore();
    if (key) {
      if (store.envs[key]) {
        setCurrentConfigVariable(key);
        configWriter({ current: getCurrentConfigVariable() });
      } else {
        throw new ProgramError("Config command 'current' action requires a valid value");
      }
    } else {
      throw new ProgramError("Config command 'current' action requires a value");
    }
  } else if (action === 'add') {
    if (key) {
      addNewConfigVariable(key);
      configWriter({ current: getCurrentConfigVariable() });
      configWriter(getEnviromentsConfigToWriting());
    } else {
      throw new ProgramError("Config command 'add' action requires a value(key)");
    }
  } else if (action === 'reset') {
    clearConfigs();
    configWriter({ current: getCurrentConfigVariable() });
    configWriter(getEnviromentsConfigToWriting());
  } else if (action === 'trust') {
    trustAppcircleCertificate();
  } else {
    throw new ProgramError(`Config command action not found \nRun "${PROGRAM_NAME} config --help" for more information`);
  }
};

const handleOrganizationCommand = async (command: ProgramCommand, params: any) => {
  if (!params.organizationId || params.organizationId === CURRENT_PARAM_VALUE) {
    params.organizationId = (await getUserInfo()).currentOrganizationId;
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
    const response: any = await enquirer.prompt({
      type: 'select',
      name: 'confirm',
      message: `Are you sure you want to remove ${params.email || params.userId} from the Organization? This action cannot be undone. (Y/n)`,
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
    spinner.succeed();
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

const handlePublishCommand = async (command: ProgramCommand, params: any) => {
  if (params.platform && !['ios', 'android'].includes(params.platform)) {
    throw new ProgramError(`Invalid platform(${params.platform}). Supported platforms: ios, android`);
  }
  if (command.fullCommandName === `${PROGRAM_NAME}-publish-profile-create`) {
    const profileRes = await createPublishProfile({ platform: params.platform, name: params.name });
    commandWriter(CommandTypes.PUBLISH, {
      fullCommandName: command.fullCommandName,
      data: profileRes,
    });
  } else if (command.fullCommandName === `${PROGRAM_NAME}-publish-profile-list`) {
    const spinner = createOra('Listing Publish Profiles...').start();
    const profiles = await getPublishProfiles({ platform: params.platform });
    spinner.stop();
    commandWriter(CommandTypes.PUBLISH, {
      fullCommandName: command.fullCommandName,
      data: profiles,
    });
  } else if (command.fullCommandName === `${PROGRAM_NAME}-publish-profile-delete`) {
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
  }
  else if (command.fullCommandName === `${PROGRAM_NAME}-publish-profile-rename`) {
    const response = await renamePublishProfile(params);
    commandWriter(CommandTypes.PUBLISH, {
      fullCommandName: command.fullCommandName,
      data: response,
    });
  } 
  else if (command.fullCommandName === `${PROGRAM_NAME}-publish-profile-version-upload`) {
    const spinner = createOra('Try to upload the app version').start();
    try {
      let expandedPath = params.app;
      
      if (expandedPath.includes('~')) {
        expandedPath = expandedPath.replace(/~/g, os.homedir());
      }
      
      expandedPath = path.resolve(expandedPath);
      
      if (!fs.existsSync(expandedPath)) {
        spinner.fail(`File not found: ${params.app}`);
        throw new AppcircleExitError('File not found: ' + params.app, 1);
      }
      
      let fileName = path.basename(expandedPath);
      let stats = fs.statSync(expandedPath);
      const maxBytes = getMaxUploadBytes();
      if (maxBytes !== null && stats.size > maxBytes) {
        spinner.fail(`File size ${(stats.size / GB).toFixed(2)} GB exceeds the allowed limit of ${(maxBytes / GB).toFixed(2)} GB.`);
        throw new AppcircleExitError('File size exceeds the allowed limit', 1);
      }
      const uploadResponse = await getPublishUploadInformation({fileName, fileSize: stats.size, publishProfileId: params.publishProfileId, platform: params.platform});
      try {
        await uploadArtifactWithSignedUrl({ app: expandedPath, uploadInfo: uploadResponse });
        const commitFileResponse = await commitPublishFileUpload({fileId: uploadResponse.fileId, fileName, publishProfileId: params.publishProfileId, platform: params.platform});
        let taskStatus = await getTaskStatus({taskId: commitFileResponse.taskId});
        const shouldMarkAsReleaseCandidate = params.markAsRc || false;
        // Wait for the task to complete
        while(taskStatus.stateValue === TaskStatus.BEGIN){
          taskStatus = await getTaskStatus({taskId: commitFileResponse.taskId});
          if(taskStatus.stateValue !== TaskStatus.BEGIN && taskStatus.stateValue !== TaskStatus.COMPLETED){
            spinner.fail('Upload failed: Please make sure that the app version number is unique in selected Publish Profile.');
            throw new AppcircleExitError('Upload failed: Please make sure that the app version number is unique in selected Publish Profile.', 1);
          }
          await new Promise(resolve => setTimeout(resolve, 2000));
        }
        if(shouldMarkAsReleaseCandidate){
          let appVersionList = await getAppVersions(params);
          const appVersion = appVersionList.shift();
          await setAppVersionReleaseCandidateStatus({...params, appVersionId: appVersion.id, releaseCandidate: true});
          if(params.summary !== undefined && params.summary !== null && params.summary.trim() !== ""){
            await setAppVersionReleaseNote({ ...params, appVersionId: appVersion.id });
          }
        }
        spinner.text = `App version uploaded ${shouldMarkAsReleaseCandidate ? 'and marked as release candidate' : ''} successfully.\n\nTaskId: ${commitFileResponse.taskId}`;
        spinner.succeed();
      } catch (uploadError: any) {
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
        throw uploadError; // Re-throw to be caught by the outer catch
      }
    } catch (e: any) {
      spinner.fail('Upload failed');
      throw e;
    }
  } else if (command.fullCommandName === `${PROGRAM_NAME}-publish-profile-version-delete`) {
    const spinner = createOra('Try to remove the app version').start();
    try {
      const responseData = await deleteAppVersion(params);
      commandWriter(CommandTypes.PUBLISH, responseData);
      spinner.text = `App Version removed successfully.\n\nTaskId: ${responseData.taskId}`;
      spinner.succeed();
    } catch (e: any) {
      spinner.fail('Remove failed');
      throw e;
    }
  } else if (command.fullCommandName === `${PROGRAM_NAME}-publish-start`) {
    const spinner = createOra('Starting Publish flow...').start();
    try {
      const publish = await getPublishByAppVersion(params);
      const firstStep = publish.steps[0];
      const startResponse = await startExistingPublishFlow({ ...params, publishId: firstStep.publishId });
      
      const publishId = typeof startResponse === 'string' ? startResponse : firstStep.publishId;
      spinner.succeed(`Publish flow started successfully.\n\nPublishId: ${publishId}`);
      
      if (params.platform && params.publishProfileId && params.appVersionId) {
        await monitorPublishProcess(params);
      } else {
        console.log(chalk.yellow('\nInsufficient parameters to monitor Publish Status. Please provide platform, publishProfileId, and appVersionId for monitoring.'));
      }
    } catch (error) {
      spinner.fail('Failed to start publish');
      throw error;
    }
  }else if (command.fullCommandName === `${PROGRAM_NAME}-publish-profile-version-download`) {
      let spinner = createOra('Getting app version download link...').start();
      try {
        let downloadPath = path.resolve((params.path || '').replace('~', `${os.homedir}`));
        const responseData = await getAppVersionDownloadLink(params);
        const appVersions = await getAppVersions(params);
        const appVersion = appVersions.find((appVersion: any) => appVersion.id === params.appVersionId);
        if (!appVersion) {
          spinner.fail();
          throw new Error('App version not found');
        }
        spinner.text = `App version download link retrieved successfully.`;
        spinner.text = `Try to download the app version.`;
        downloadPath = path.join(downloadPath, appVersion.fileName);
        await downloadAppVersion({ url: responseData, path:downloadPath });
        spinner.text = `App version downloaded successfully.\n\nDownload Path: ${downloadPath}`; 
        spinner.succeed();
      } catch (e: any) {
        spinner.fail('Process failed');
        throw e;
      }
  } else if (command.fullCommandName === `${PROGRAM_NAME}-publish-profile-version-mark-as-rc`) {
      const response = await setAppVersionReleaseCandidateStatus({...params, releaseCandidate: true });
      commandWriter(CommandTypes.PUBLISH, {
        fullCommandName: command.fullCommandName,
        data: response,
      });
    } else if (command.fullCommandName === `${PROGRAM_NAME}-publish-profile-version-unmark-as-rc`) {
      const response = await setAppVersionReleaseCandidateStatus({...params, releaseCandidate: false });
      commandWriter(CommandTypes.PUBLISH, {
        fullCommandName: command.fullCommandName,
        data: response,
      });
    } else if (command.fullCommandName === `${PROGRAM_NAME}-publish-profile-settings-autopublish`) {
      const publishProfileDetails = await getPublishProfileDetailById(params);
      const response = await switchPublishProfileAutoPublishSettings({ ...params, currentProfileSettings: publishProfileDetails.profileSettings });
      commandWriter(CommandTypes.PUBLISH, {
        fullCommandName: command.fullCommandName,
        data: response,
      });
    } else if (command.fullCommandName === `${PROGRAM_NAME}-publish-variable-group-list`) {
      const spinner = createOra('Listing Variable Groups...').start();
      const variableGroups = await getPublishVariableGroups();
      spinner.stop();
      commandWriter(CommandTypes.PUBLISH, {
        fullCommandName: command.fullCommandName,
        data: variableGroups,
      });
    } else if (command.fullCommandName === `${PROGRAM_NAME}-publish-variable-group-view`) {
      const spinner = createOra('Listing Variables...').start();
      const variables = await getPublishVariableListByGroupId(params);
      spinner.stop();
      commandWriter(CommandTypes.PUBLISH, {
        fullCommandName: command.fullCommandName,
        data: variables.variables,
      });
    } else if (command.fullCommandName === `${PROGRAM_NAME}-publish-variable-group-upload`) {
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
        const responseData = await uploadPublishEnvironmentVariablesFromFile(params as any);
        spinner.succeed('Environment Variables uploaded successfully');
      } catch (e) {
        spinner.fail('Failed to upload Environment Variables');
        throw e;
      }
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
      const spinner = createOra('Listing App Versions...').start();
      const appVersions = await getAppVersions(params);
      spinner.stop();
      commandWriter(CommandTypes.PUBLISH, {
        fullCommandName: command.fullCommandName,
        data: appVersions,
      });
    } else if(command.fullCommandName === `${PROGRAM_NAME}-publish-profile-version-view`){
      const spinner = createOra('Getting App Version Details...').start();
      const appVersion = await getAppVersionDetail(params);
      spinner.stop();
      commandWriter(CommandTypes.PUBLISH, {
        fullCommandName: command.fullCommandName,
        data: appVersion,
      });
    } else if(command.fullCommandName === `${PROGRAM_NAME}-publish-profile-version-update-release-note`){
      const spinner = createOra('Try to update relase note of the app version').start();
      try{
        await setAppVersionReleaseNote(params);
        spinner.succeed("Release note updated successfully.");
      }catch(e: any){
        spinner.fail('Update failed');
        throw e;
      }
    } else if (command.fullCommandName === `${PROGRAM_NAME}-publish-active-list`){
      const spinner = createOra('Listing Active Publishes...').start();
      const responseData = await getActivePublishes();
      spinner.stop();
      commandWriter(CommandTypes.PUBLISH, {
        fullCommandName: command.fullCommandName,
        data: responseData,
      });
    } else if (command.fullCommandName === `${PROGRAM_NAME}-publish-view`){
      const spinner = createOra('Listing Publish Details...').start();
      const responseData = await getPublisDetailById(params);
        spinner.stop();
      commandWriter(CommandTypes.PUBLISH, {
        fullCommandName: command.fullCommandName,
        data: responseData,
      });
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
  if (command.fullCommandName === `${PROGRAM_NAME}-build-start`) {
    if (!params.branchId && !params.branch) {
      console.error('error: You must provide either branchId or branch parameter');
      throw new AppcircleExitError('You must provide either branchId or branch parameter', 1);
    }
    if (!params.workflowId && !params.workflow) {
      console.error('error: You must provide either workflowId or workflow parameter');
      throw new AppcircleExitError('You must provide either workflowId or workflow parameter', 1);
    }
    const spinner = createOra(`Starting Build...`).start();
    try {
      const responseData = await startBuild(params);
      commandWriter(CommandTypes.BUILD, {
        fullCommandName: command.fullCommandName,
        data: responseData,
      });
      
      spinner.succeed(`Build successfully added to queue.\n\nTaskId: ${responseData.taskId}`);
      
      const progressSpinner = createOra(`Checking Build Status...`).start();
      let dots = "";
      const startTime = Date.now();
      
      const interval = setInterval(() => {
        dots = dots.length >= 3 ? "" : dots + ".";
        const elapsedSeconds = Math.floor((Date.now() - startTime) / 1000);
        const elapsedMinutes = Math.floor(elapsedSeconds / 60);
        const elapsedText = elapsedMinutes > 0 ? 
          `${elapsedMinutes}m ${elapsedSeconds % 60}s` : 
          `${elapsedSeconds}s`;
        progressSpinner.text = chalk.yellow(`Build Running${dots} (${elapsedText})`);
      }, 500);
      
      let buildCompleted = false;
      let buildSuccess = false;
      let retryCount = 0;
      const maxRetries = 300;
      let finalStatusResponse: any = null;
      let latestBuildId: string | null = null;
      
      try {
        const taskId = responseData.queueItemId;
        
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
            
            if (buildStatus === null || buildStatus === undefined) {
              progressSpinner.text = chalk.gray(`Build Status is pending...`);
            } else {
              const elapsedSeconds = Math.floor((Date.now() - startTime) / 1000);
              const elapsedMinutes = Math.floor(elapsedSeconds / 60);
              const elapsedText = elapsedMinutes > 0 ? 
                `${elapsedMinutes}m ${elapsedSeconds % 60}s` : 
                `${elapsedSeconds}s`;
              
              switch (buildStatus) {
                case 0: // SUCCESS
                  const hasWarning = queueResponse && queueResponse.hasWarning === true;
                  if (hasWarning) {
                    progressSpinner.text = chalk.hex('#FFA500')(`Build completed with warnings ⚠️ (${elapsedText})`);
                  } else {
                    progressSpinner.text = `Build completed successfully ✅ (${elapsedText})`;
                  }
                  buildCompleted = true;
                  buildSuccess = true;
                  break;
                case 1: // FAILED
                  progressSpinner.text = chalk.red(`Build failed ❌ (${elapsedText})`);
                  buildCompleted = true;
                  break;
                case 2: // CANCELED
                  progressSpinner.text = chalk.hex('#FF8C32')(`Build canceled 🚫 (${elapsedText})`);
                  buildCompleted = true;
                  // Let's specifically set a flag to indicate this was a canceled build
                  params.wasCanceled = true;
                  break;
                case 3: // TIMEOUT
                  progressSpinner.text = chalk.red(`Build timed out ⏱️ (${elapsedText})`);
                  buildCompleted = true;
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
            }
            
            if (buildStatus !== 91 && retryCount > 5) {
              buildCompleted = true;
            }
          } catch (e) { }
          
          if (!buildCompleted) {
            await new Promise(resolve => setTimeout(resolve, 3000));
            retryCount++;
          }
        }
        
        clearInterval(interval);
        
        if (buildCompleted) {
          if (buildSuccess) {
            try {
              const hasWarning = finalStatusResponse && finalStatusResponse.hasWarning === true;
              const elapsedSeconds = Math.floor((Date.now() - startTime) / 1000);
              const elapsedMinutes = Math.floor(elapsedSeconds / 60);
              const elapsedText = elapsedMinutes > 0 ? 
                `${elapsedMinutes}m ${elapsedSeconds % 60}s` : 
                `${elapsedSeconds}s`;
              if (hasWarning) {
                progressSpinner.text = chalk.hex('#FFA500')(`Build completed with warnings ⚠️ - Total time: ${elapsedText}`);
                progressSpinner.succeed();
              } else {
                progressSpinner.succeed(`Build completed successfully ✅ - Total time: ${elapsedText}`);
              }
            } catch (e) {
              progressSpinner.succeed(`Build completed successfully ✅`);
            }
            
            const homeDir = os.homedir();
            const defaultDownloadDir = path.join(homeDir, 'Downloads');
                
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
                    const artifactFileName = `artifacts-${timestamp}.zip`;
                    await downloadArtifact({ 
                      commitId: commitIdForArtifact, 
                      buildId: buildIdForArtifact,
                      branchId: params.branchId,
                      profileId: params.profileId
                    }, artifactDownloadPath, artifactFileName);
                    artifactSpinner.succeed(`Artifacts downloaded successfully to ${path.join(artifactDownloadPath, artifactFileName)}`);
                    console.log(chalk.green('Build completed successfully with artifacts downloaded.'));
                  } catch (e: any) {
                    artifactSpinner.fail(`Failed to download artifacts: ${e.message}`);
                    console.log(chalk.yellow('Build completed successfully but artifact download failed.'));
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
                      profileId: params.profileId
                    }, buildLogPath);
                  } else {
                    await downloadBuildLogs(responseData.queueItemId, buildLogPath);
                  }
                  console.log(chalk.green('Build completed successfully with logs downloaded.'));
                  throw new AppcircleExitError('Build completed', 0);
                } catch (error: any) {
                  if (error instanceof AppcircleExitError) {
                    throw error;
                  }
                  console.log(chalk.yellow(`Build failed and log download also failed: ${error.message}`));
                  try {
                    await downloadBuildLogs(responseData.queueItemId, buildLogPath);
                    console.log(chalk.yellow('Build failed but logs downloaded successfully.'));
                    throw new AppcircleExitError('Build failed', 1);
                  } catch (fallbackError: any) {
                    console.log(chalk.red('Build failed and could not download logs.'));
                    throw new AppcircleExitError('Build failed', 1);
                  }
                }
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
          } else {
            try {
              const buildStatus = finalStatusResponse && finalStatusResponse.buildStatus !== undefined ? 
                finalStatusResponse.buildStatus : null;
              
              if (buildStatus === null || buildStatus === undefined) {
                progressSpinner.fail(chalk.red(`Build completed but status information is unavailable.`));
              } else {
                switch (buildStatus) {
                  case 1: // FAILED
                    progressSpinner.fail(chalk.red(`Build completed, but failed.`));
                    break;
                  case 2: // CANCELED
                    progressSpinner.fail(chalk.hex('#FF8C32')(`Build was canceled.`));
                    break;
                  case 3: // TIMEOUT
                    progressSpinner.fail(chalk.red(`Build timed out.`));
                    break;
                  default:
                    progressSpinner.fail(chalk.red(`Build completed with status code: ${buildStatus}.`));
                }
              }
            } catch (e) {
              progressSpinner.fail(chalk.red(`Build completed unsuccessfully.`));
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
                      profileId: params.profileId
                    }, buildLogPath);
                  } else {
                    await downloadBuildLogs(responseData.queueItemId, buildLogPath);
                  }
                  console.log(chalk.green('Build completed successfully with logs downloaded.'));
                  throw new AppcircleExitError('Build completed', 0);
                } catch (error: any) {
                  if (error instanceof AppcircleExitError) {
                    throw error;
                  }
                  console.log(chalk.yellow(`Build failed and log download also failed: ${error.message}`));
                  try {
                    await downloadBuildLogs(responseData.queueItemId, buildLogPath);
                    console.log(chalk.yellow('Build failed but logs downloaded successfully.'));
                    throw new AppcircleExitError('Build failed', 1);
                  } catch (fallbackError: any) {
                    console.log(chalk.red('Build failed and could not download logs.'));
                    throw new AppcircleExitError('Build failed', 1);
                  }
                }
              } else {
                console.log(chalk.gray('Build failed, skipping log download.'));
                throw new AppcircleExitError('Build failed', 1);
              }
            } catch (err) {
              console.log(chalk.gray('Skipping log download.'));
              throw new AppcircleExitError('Build failed, user chose to exit', 1);
            }
          }
        } else {
          progressSpinner.fail(chalk.red(`Build monitoring timed out after ${maxRetries * 3} seconds.`));
          throw new AppcircleExitError('Build monitoring timed out', 1);
        }
      } catch (e) {
        clearInterval(interval);
        if (e instanceof AppcircleExitError) {
          if (e.code === 0) {
            throw e;
          }
        }
        progressSpinner.fail(chalk.red(`Error while monitoring Build.`));
        throw new AppcircleExitError('Build monitoring failed', 1);
      }
    } catch (e) {
      if (e instanceof AppcircleExitError) {
        if (e.code === 0) {
          throw e;
        }
      }
      spinner.fail('Failed to start Build');
      throw e;
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
    const spinner = createOra('Listing...').start();
    const responseData = await getBranches(params);
    spinner.stop();
    commandWriter(CommandTypes.BUILD, {
      fullCommandName: command.fullCommandName,
      data: responseData,
    });
  } else if (command.fullCommandName === `${PROGRAM_NAME}-build-profile-workflows`) {
    const spinner = createOra('Listing...').start();
    const responseData = await getWorkflows(params);
    spinner.stop();
    commandWriter(CommandTypes.BUILD, {
      fullCommandName: command.fullCommandName,
      data: responseData,
    });
  } else if (command.fullCommandName === `${PROGRAM_NAME}-build-profile-configurations`) {
    const spinner = createOra('Listing...').start();
    const responseData = await getConfigurations(params);
    spinner.stop();
    commandWriter(CommandTypes.BUILD, {
      fullCommandName: command.fullCommandName,
      data: responseData,
    });
  } else if (command.fullCommandName === `${PROGRAM_NAME}-build-profile-branch-commits`) {
    const spinner = createOra('Listing...').start();
    const responseData = await getCommits(params);
    spinner.stop();
    commandWriter(CommandTypes.BUILD, {
      fullCommandName: command.fullCommandName,
      data: responseData,
    });
  } else if (command.fullCommandName === `${PROGRAM_NAME}-build-list`) {
    const spinner = createOra('Listing...').start();
    const responseData = await getBuildsOfCommit(params);
    spinner.stop();
    commandWriter(CommandTypes.BUILD, {
      fullCommandName: command.fullCommandName,
      data: responseData,
    });
  } else if (command.fullCommandName === `${PROGRAM_NAME}-build-download`) {
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
    
    const timestamp = Date.now();
    const artifactFileName = `artifacts-${timestamp}.zip`;
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
          spinner.fail(`Failed to download artifact: ${e.message || 'Unknown error'}`);
          
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
      spinner.fail(`Failed to download artifact: ${e.message || 'Unknown error'}`);
    }
  } else if (command.fullCommandName === `${PROGRAM_NAME}-build-download-log`) {
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
            commitId: params.commitId
          }, params);
          return;
        } catch (error: any) {
          // Silently continue with alternative method
        }
      }
      if (params.commitId && params.buildId) {
        await downloadBuildLogs({ commitId: params.commitId, buildId: params.buildId }, params);
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
    const spinner = createOra('Listing Variables...').start();
    const responseData = await getEnvironmentVariables(params);
    spinner.stop();
    commandWriter(CommandTypes.BUILD, {
      fullCommandName: command.fullCommandName,
      data: responseData,
    });
  } else if (command.fullCommandName === `${PROGRAM_NAME}-build-variable-download`) {
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
  if (command.fullCommandName === `${PROGRAM_NAME}-testing-distribution-profile-list`) {
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
  } else if (command.fullCommandName === `${PROGRAM_NAME}-testing-distribution-profile-create`) {
    const responseData = await createDistributionProfile(params);
    commandWriter(CommandTypes.TESTING_DISTRIBUTION, {
      fullCommandName: command.fullCommandName,
      data: { ...responseData, name: params.name },
    });
  } else if (command.fullCommandName === `${PROGRAM_NAME}-testing-distribution-upload`) {
    const spinner = createOra('Try to upload the app').start();
    try {
      const profiles = await getDistributionProfiles(params);
      if (!profiles || profiles.length === 0) {
        spinner.text = 'No Distribution Profile available';
        spinner.fail();
        throw new AppcircleExitError('No Distribution Profile available', 1);
      }

      let expandedPath = params.app;
      
      if (expandedPath.includes('~')) {
        expandedPath = expandedPath.replace(/~/g, os.homedir());
      }
      
      expandedPath = path.resolve(expandedPath);
      
      if (!fs.existsSync(expandedPath)) {
        spinner.fail(`File not found: ${params.app}`);
        throw new AppcircleExitError('File not found: ' + params.app, 1);
      }

      let fileName = path.basename(expandedPath);
      let stats = fs.statSync(expandedPath);
      const maxBytes = getMaxUploadBytes();
      if (maxBytes !== null && stats.size > maxBytes) {
        spinner.fail(`File size ${(stats.size / GB).toFixed(2)} GB exceeds the allowed limit of ${(maxBytes / GB).toFixed(2)} GB.`);
        throw new AppcircleExitError('File size exceeds the allowed limit', 1);
      }
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
        
        commandWriter(CommandTypes.TESTING_DISTRIBUTION, {
          fullCommandName: command.fullCommandName,
          data: commitFileResponse,
        });
        
        if (params.message) {
          try {
            spinner.text = 'Waiting for upload to complete...';
            
            let taskStatus = await getTaskStatus({taskId: commitFileResponse.taskId});
            while(taskStatus.stateValue === TaskStatus.BEGIN){
              taskStatus = await getTaskStatus({taskId: commitFileResponse.taskId});
              if(taskStatus.stateValue !== TaskStatus.BEGIN && taskStatus.stateValue !== TaskStatus.COMPLETED){
                spinner.fail('Upload failed: Please make sure that the app version number is unique in selected Testing Distribution Profile.');
                throw new AppcircleExitError('Upload failed: Please make sure that the app version number is unique in selected Testing Distribution Profile.', 1);
              }
              await new Promise(resolve => setTimeout(resolve, 2000));
            }
            
            if (taskStatus.stateValue === TaskStatus.COMPLETED) {
              spinner.text = 'Upload completed. Updating release notes...';
              
              const latestVersionId = await getLatestAppVersionId({
                distProfileId: params.distProfileId
              });
              
              if (latestVersionId) {
                const cleanMessage = params.message.replace(/^["']|["']$/g, '');
                
                await updateTestingDistributionReleaseNotes({
                  distProfileId: params.distProfileId,
                  versionId: latestVersionId,
                  message: cleanMessage
                });
                spinner.text = `App uploaded and release notes updated successfully.\n\nTaskId: ${commitFileResponse.taskId}`;
              } else {
                spinner.text = `App uploaded successfully, but couldn't update release notes (version ID not found).\n\nTaskId: ${commitFileResponse.taskId}`;
              }
            } else {
              spinner.text = `App uploaded successfully, but couldn't update release notes (upload task not completed).\n\nTaskId: ${commitFileResponse.taskId}`;
            }
          } catch (error: any) {
            spinner.fail('Warning: Failed to update release notes');
            spinner.text = `App uploaded successfully, but couldn't update release notes.\n\nTaskId: ${commitFileResponse.taskId}`;
          }
        } else {
          spinner.text = `App uploaded successfully.\n\nTaskId: ${commitFileResponse.taskId}`;
        }      
        spinner.succeed();
      } catch (uploadError: any) {
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
      }
    } catch (e) {
      spinner.fail('Upload failed');
      throw e;
    }
  } else if (command.fullCommandName === `${PROGRAM_NAME}-testing-distribution-profile-settings-auto-send`) {
    const spinner = createOra('Testing Groups saving').start();
    try {
      params.testingGroupIds = Array.isArray(params.testingGroupIds) ? params.testingGroupIds : params.testingGroupIds.split(' '); 
      await updateDistributionProfileSettings(params);
      spinner.succeed('Testing Groups saved successfully.');
    } catch (e) {
      spinner.fail('Saving failed');
    }
  } else if (command.fullCommandName === `${PROGRAM_NAME}-testing-distribution-testing-group-list`) {
    const spinner = createOra('Listing Testing Groups...').start();
    const responseData = await getTestingGroups();
    spinner.stop();
    commandWriter(CommandTypes.TESTING_DISTRIBUTION, {
      fullCommandName: command.fullCommandName,
      data: responseData,
    });
  } else if (command.fullCommandName === `${PROGRAM_NAME}-testing-distribution-testing-group-view`) {
    const spinner = createOra('Listing Testing Group details...').start();
    const responseData = await getTestingGroupById(params);
    spinner.stop();
    commandWriter(CommandTypes.TESTING_DISTRIBUTION, {
      fullCommandName: command.fullCommandName,
      data: responseData,
    });
  } else if (command.fullCommandName === `${PROGRAM_NAME}-testing-distribution-testing-group-create`) {
    const responseData = await createTestingGroup(params);
    console.info(`Testing Group named ${responseData.name} created successfully!`);
  } else if (command.fullCommandName === `${PROGRAM_NAME}-testing-distribution-testing-group-remove`) {
    let spinner = createOra('Try to remove the Testing Group').start();
    try {
      // Stop spinner temporarily for the prompt
      spinner.stop();
      
      // Add confirmation prompt
      const response: any = await enquirer.prompt({
        type: 'select',
        name: 'confirm',
        message: 'Are you sure you want to delete this Testing Group? This action cannot be undone. (Y/n)',
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

      // Create a new spinner for the deletion process
      spinner = createOra('Removing Testing Group...').start();
      await deleteTestingGroup(params);
      spinner.text = `Selected Testing Group removed successfully!\n\n`;
      spinner.succeed();
    } catch (e: any) {
      spinner.fail('Remove failed');
      throw e;
    }
  } else if (command.fullCommandName === `${PROGRAM_NAME}-testing-distribution-testing-group-tester-add`) {
    await addTesterToTestingGroup(params);
    console.info(`Tester has been successfully added to the selected Testing Group!`);
  } else if (command.fullCommandName === `${PROGRAM_NAME}-testing-distribution-testing-group-tester-remove`) {
    let spinner = createOra('Try to remove the Tester from Testing Group').start();
    try {
      // Stop spinner temporarily for the prompt
      spinner.stop();
      
      // Add confirmation prompt
      const response: any = await enquirer.prompt({
        type: 'select',
        name: 'confirm',
        message: 'Are you sure you want to remove this Tester from the Testing Group? (Y/n)',
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
  if (command.fullCommandName === `${PROGRAM_NAME}-signing-identity-certificate-list`) {
    const spinner = createOra('Listing Certificates...').start();
    const p12Certs = await getiOSP12Certificates();
    const csrCerts = await getiOSCSRCertificates();
    spinner.stop();
    commandWriter(CommandTypes.SIGNING_IDENTITY, {
      fullCommandName: command.fullCommandName,
      data: [...p12Certs,...csrCerts],
    });
  } else if (command.fullCommandName === `${PROGRAM_NAME}-signing-identity-certificate-upload`) {
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
  } else if (command.fullCommandName === `${PROGRAM_NAME}-signing-identity-certificate-create`) {
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
  } else if (command.fullCommandName === `${PROGRAM_NAME}-signing-identity-certificate-view`) {
    const spinner = createOra('Getting Certificate details...').start();
    const responseData = await getCertificateDetailById(params);
    spinner.stop();
    commandWriter(CommandTypes.SIGNING_IDENTITY, {
      fullCommandName: command.fullCommandName,
      data: responseData
    });
  } else if (command.fullCommandName === `${PROGRAM_NAME}-signing-identity-certificate-download`) {
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
        params,
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
  } else if (command.fullCommandName === `${PROGRAM_NAME}-signing-identity-certificate-remove`) {
    let spinner = createOra('Try to remove the Certificate').start();
    try {
      // Stop spinner temporarily for the prompt
      spinner.stop(); 
      
      // Add confirmation prompt
      const response: any = await enquirer.prompt({
        type: 'select',
        name: 'confirm',
        message: 'Are you sure you want to delete this Certificate? This action cannot be undone. (Y/n)',
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
      await removeCSRorP12CertificateById(params, csrCert ? 'csr': 'p12');
      spinner.text = `Certificate removed successfully.\n\n`;
      spinner.succeed();
    } catch (e: any) {
      spinner.fail('Remove failed');
      throw e;
    }
  } else if (command.fullCommandName === `${PROGRAM_NAME}-signing-identity-keystore-list`) {
    const spinner = createOra('Listing keystores...').start();
    const keystores = await getAndroidKeystores();
    spinner.stop();
    commandWriter(CommandTypes.SIGNING_IDENTITY, {
      fullCommandName: command.fullCommandName,
      data: keystores
    });
  } else if (command.fullCommandName === `${PROGRAM_NAME}-signing-identity-keystore-create`) {
    const spinner = createOra('Trying to generate new Keystore.').start();
    try {
      await generateNewKeystore(params);
      spinner.text = `Keystore generated successfully.\n\n Keystore name: ${params.name}`;
      spinner.succeed();
    } catch (e: any) {
      spinner.fail('Generation failed');
      throw e;
    }
  } else if (command.fullCommandName === `${PROGRAM_NAME}-signing-identity-keystore-upload`) {
    const spinner = createOra('Trying to upload the Keystore file').start();
    try {
      await uploadAndroidKeystoreFile(params);
      spinner.text = `Keystore file uploaded successfully.\n\n`;
      spinner.succeed();
    } catch (e) {
      spinner.fail('Upload failed: Keystore was tampered with, or password was incorrect');
    }
  } else if (command.fullCommandName === `${PROGRAM_NAME}-signing-identity-keystore-download`) {
    const downloadPath = (params.path || path.join(os.homedir(), 'Downloads')).replace('~', os.homedir())
    const spinner = createOra(`Searching file...`).start();
    try {
      const keystoreDetail = await getKeystoreDetailById(params);
      const fileName = keystoreDetail.fileName || `${keystoreDetail.id}.keystore`;
      spinner.text = `Downloading file ${fileName}`;
      await downloadKeystoreById(params, downloadPath, fileName);
      spinner.text = `The file ${fileName} is downloaded successfully under path:\nfile://${downloadPath}`;
      spinner.succeed();
    } catch (e) {
      spinner.text = 'The file could not be downloaded.';
      spinner.fail();
    }
  } else if (command.fullCommandName === `${PROGRAM_NAME}-signing-identity-keystore-view`) {
    const spinner = createOra('Getting Keystore details...').start();
    const keystore = await getKeystoreDetailById(params);
    spinner.stop();
    commandWriter(CommandTypes.SIGNING_IDENTITY, {
      fullCommandName: command.fullCommandName,
      data: keystore
    });
  } else if (command.fullCommandName === `${PROGRAM_NAME}-signing-identity-keystore-remove`) {
    let spinner = createOra('Try to remove the Keystore').start();
    try {
      // Stop spinner temporarily for the prompt
      spinner.stop();
      
      // Add confirmation prompt
      const response: any = await enquirer.prompt({
        type: 'select',
        name: 'confirm',
        message: 'Are you sure you want to delete this Keystore? This action cannot be undone. (Y/n)',
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
      await removeKeystore(params);
      spinner.text = `Keystore removed successfully.\n\n`;
      spinner.succeed();
    } catch (e: any) {
      spinner.fail('Remove failed');
      throw e;
    }
  } else if (command.fullCommandName === `${PROGRAM_NAME}-signing-identity-provisioning-profile-list`) {
    const spinner = createOra('Listing Provisioning Profiles...').start();
    const profiles = await getProvisioningProfiles();
    spinner.stop();
    commandWriter(CommandTypes.SIGNING_IDENTITY, {
      fullCommandName: command.fullCommandName,
      data: profiles
    });
  } else if (command.fullCommandName === `${PROGRAM_NAME}-signing-identity-provisioning-profile-upload`) {
    const spinner = createOra('Trying to upload the Provisioning Profile').start();
    try {
      await uploadProvisioningProfile(params);
      spinner.text = `Provisioning Profile uploaded successfully.\n\n`;
      spinner.succeed();
    } catch (e) {
      spinner.fail('Upload failed');
      throw e;
    }
  } else if (command.fullCommandName === `${PROGRAM_NAME}-signing-identity-provisioning-profile-download`) {
    const downloadPath = (params.path || path.join(os.homedir(), 'Downloads')).replace('~', os.homedir())
    const spinner = createOra('Trying to download the Provisioning Profile').start();
    try {
      const profile = await getProvisioningProfileDetailById(params);
      await downloadProvisioningProfileById(params, downloadPath, profile.filename);
      spinner.text = `The file ${profile.filename} is downloaded successfully under path:\n${downloadPath}`;
      spinner.succeed();
    } catch (e) {
      spinner.fail('Download failed');
      throw e;
    }
  } else if (command.fullCommandName === `${PROGRAM_NAME}-signing-identity-provisioning-profile-view`) {
    const spinner = createOra('Getting Provisioning Profile details...').start();
    const profile = await getProvisioningProfileDetailById(params);
    spinner.stop();
    commandWriter(CommandTypes.SIGNING_IDENTITY, {
      fullCommandName: command.fullCommandName,
      data: profile
    });
  } else if (command.fullCommandName === `${PROGRAM_NAME}-signing-identity-provisioning-profile-remove`) {
    let spinner = createOra('Try to remove the Provisioning Profile').start();
    try {
      // Stop spinner temporarily for the prompt
      spinner.stop();
      
      // Add confirmation prompt
      const response: any = await enquirer.prompt({
        type: 'select',
        name: 'confirm',
        message: 'Are you sure you want to delete this Provisioning Profile? This action cannot be undone. (Y/n)',
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
      await removeProvisioningProfile(params);
      spinner.text = `Provisioning Profile removed successfully.\n\n`;
      spinner.succeed();
    } catch (e: any) {
      spinner.fail('Remove failed');
      throw e;
    }
  }
}

const handleEnterpriseAppStoreCommand = async (command: ProgramCommand, params: any) => {
  if (command.fullCommandName === `${PROGRAM_NAME}-enterprise-app-store-profile-list`) {
    const spinner = createOra('Listing Enterprise Profiles...').start();
    const responseData = await getEnterpriseProfiles();
    spinner.stop();
    commandWriter(CommandTypes.ENTERPRISE_APP_STORE, {
      fullCommandName: command.fullCommandName,
      data: responseData,
    });
  } else if (command.fullCommandName === `${PROGRAM_NAME}-enterprise-app-store-version-list`) {
    const spinner = createOra('Listing Enterprise App Versions...').start();
    const responseData = await getEnterpriseAppVersions(params);
    spinner.stop();
    commandWriter(CommandTypes.ENTERPRISE_APP_STORE, {
      fullCommandName: command.fullCommandName,
      data: responseData,
    });
  } else if (command.fullCommandName === `${PROGRAM_NAME}-enterprise-app-store-version-publish`) {
    const responseData = await publishEnterpriseAppVersion(params);
    commandWriter(CommandTypes.ENTERPRISE_APP_STORE, {
      fullCommandName: command.fullCommandName,
      data: responseData,
    });
  } else if (command.fullCommandName === `${PROGRAM_NAME}-enterprise-app-store-version-unpublish`) {
    const responseData = await unpublishEnterpriseAppVersion(params);
    commandWriter(CommandTypes.ENTERPRISE_APP_STORE, {
      fullCommandName: command.fullCommandName,
      data: responseData,
    });
  } else if (command.fullCommandName === `${PROGRAM_NAME}-enterprise-app-store-version-remove`) {
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
      message: `Are you sure you want to delete Enterprise App Version "${version.name}" (${version.version})? This action cannot be undone. (Y/n)`,
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
  } else if (command.fullCommandName === `${PROGRAM_NAME}-enterprise-app-store-version-notify`) {
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
  } else if (command.fullCommandName === `${PROGRAM_NAME}-enterprise-app-store-version-upload-for-profile`) {
    const spinner = createOra('Try to upload the app').start();
    try {
      let expandedPath = params.app;
      if (expandedPath.includes('~')) {
        expandedPath = expandedPath.replace(/~/g, os.homedir());
      }
      expandedPath = path.resolve(expandedPath);
      if (!fs.existsSync(expandedPath)) {
        spinner.fail(`File not found: ${params.app}`);
        throw new AppcircleExitError('File not found: ' + params.app, 1);
      }
      let fileName = path.basename(expandedPath);
      let stats = fs.statSync(expandedPath);
      const maxBytes = getMaxUploadBytes();
      if (maxBytes !== null && stats.size > maxBytes) {
        spinner.fail(`File size ${(stats.size / GB).toFixed(2)} GB exceeds the allowed limit of ${(maxBytes / GB).toFixed(2)} GB.`);
        throw new AppcircleExitError('File size exceeds the allowed limit', 1);
      }
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
      }
    } catch (e) {
      spinner.fail('Upload failed');
      throw e;
    }
  } else if (command.fullCommandName === `${PROGRAM_NAME}-enterprise-app-store-version-upload-without-profile`) {
    const spinner = createOra('Try to upload the app').start();
    try {
      let expandedPath = params.app;
      if (expandedPath.includes('~')) {
        expandedPath = expandedPath.replace(/~/g, os.homedir());
      }
      expandedPath = path.resolve(expandedPath);
      if (!fs.existsSync(expandedPath)) {
        spinner.fail(`File not found: ${params.app}`);
        throw new AppcircleExitError('File not found: ' + params.app, 1);
      }
      let fileName = path.basename(expandedPath);
      let stats = fs.statSync(expandedPath);
      const maxBytes = getMaxUploadBytes();
      if (maxBytes !== null && stats.size > maxBytes) {
        spinner.fail(`File size ${(stats.size / GB).toFixed(2)} GB exceeds the allowed limit of ${(maxBytes / GB).toFixed(2)} GB.`);
        throw new AppcircleExitError('File size exceeds the allowed limit', 1);
      }
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
      }
    } catch (e) {
      if (e instanceof ProgramError) {
        spinner.fail(e.message);
      } else {
        spinner.fail('Upload failed');
      }
      throw e;
    }  
  } else if (command.fullCommandName === `${PROGRAM_NAME}-enterprise-app-store-version-download-link`) {
    const responseData = await getEnterpriseDownloadLink(params);
    commandWriter(CommandTypes.ENTERPRISE_APP_STORE, {
      fullCommandName: command.fullCommandName,
      data: responseData,
    });
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
  let providedPath = params?.path;
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
                    `${branchName}-${profileName}-build-${buildId}-logs-${timestamp}.txt`;
    
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
        progressSpinner.fail(`Failed to download logs: ${lastError.message || String(lastError)}`);
      }
    } else {
      progressSpinner.fail(`Failed to download logs after multiple attempts.`);
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
    const fileName = `${profileName}-${timestamp}.txt`;
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
  const { platform, publishProfileId, appVersionId } = params;
  
  const progressSpinner = createOra(`Checking Publish Status...`).start();
  let dots = "";
  const startTime = Date.now();
  
  const interval = setInterval(() => {
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
            clearInterval(interval);
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
            clearInterval(interval);
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
            clearInterval(interval);
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
            clearInterval(interval);
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
            clearInterval(interval);
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
    
    clearInterval(interval);
    
    if (!publishCompleted) {
      progressSpinner.fail(chalk.red(`Publish monitoring timed out after ${maxRetries * 10} seconds.`));
      throw new AppcircleExitError('Publish monitoring timed out', 1);
    }
  } catch (e) {
    clearInterval(interval);
    // If it's an AppcircleExitError, re-throw it to exit properly
    if (e instanceof AppcircleExitError) {
      throw e;
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

function getLongDescriptionForCommand(fullCommandName: string): string | undefined {
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

  //In interactive mode, if any parameters have errors, we can't continue execution.
  if (params.isError) {
    throw new AppcircleExitError('Parameter error', 1);
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
  switch (commandName) {
    case CommandTypes.LOGIN: {
      responseData = await getToken(params);
      writeEnviromentConfigVariable(EnvironmentVariables.AC_ACCESS_TOKEN, responseData.access_token);
      commandWriter(CommandTypes.LOGIN, responseData);
      break;
    }
    default: {
      const beutufiyCommandName = command.fullCommandName.split('-').join(' ');
      const desc = getLongDescriptionForCommand(command.fullCommandName);
      if (desc) {
        console.error(`\n${desc}\n`);
      } else {
        console.error(`"${beutufiyCommandName} ..." command not found.`);
      }
      throw new AppcircleExitError('Command not found', 1);
    }
  }
};
