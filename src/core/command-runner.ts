import path from 'path';
import os from 'os';
import fs from 'fs';
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
} from '../services';
import { commandWriter, configWriter } from './writer';
import { trustAppcircleCertificate } from '../security/trust-url-certificate';
import { CURRENT_PARAM_VALUE, PROGRAM_NAME, TaskStatus, UNKNOWN_PARAM_VALUE } from '../constant';
import { ProgramError } from './ProgramError';
import { getMaxUploadBytes, GB } from '../utils/size-limit';

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
    const spinner = createOra('Fetching...').start();
    const response = params.organizationId === 'all' || !params.organizationId ? await getOrganizations() : await getOrganizationDetail(params);
    spinner.succeed();
    commandWriter(CommandTypes.ORGANIZATION, {
      fullCommandName: command.fullCommandName,
      data: response,
    });
  } else if (command.fullCommandName === `${PROGRAM_NAME}-organization-user-view`) {
    const spinner = createOra('Fetching...').start();
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
      process.exit(1);
    }
    if (params.email && params.email !== UNKNOWN_PARAM_VALUE) {
      await removeInvitationFromOrganization({ organizationId: params.organizationId, email: params.email });
      commandWriter(CommandTypes.ORGANIZATION, {
        fullCommandName: command.fullCommandName,
        data: { email: params.email },
      });
    }
    if (params.userId && params.userId !== UNKNOWN_PARAM_VALUE) {
      await removeUserFromOrganization({ organizationId: params.organizationId, userId: params.userId });
      commandWriter(CommandTypes.ORGANIZATION, {
        fullCommandName: command.fullCommandName,
        data: { email: params.userId },
      });
    }
  } else if (command.fullCommandName === `${PROGRAM_NAME}-organization-role-view`) {
    const spinner = createOra('Fetching...').start();
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
    let userInfo = await getOrganizationUserinfo({ organizationId: params.organizationId, userId: params.userId });
    let difference = userInfo.roles.filter((r: any) => !params.role.includes(r));
    await assignRolesToUserInOrganitaion({ organizationId: params.organizationId, userId: params.userId, role: difference });
    userInfo = await getOrganizationUserinfo({ organizationId: params.organizationId, userId: params.userId });
    commandWriter(CommandTypes.ORGANIZATION, {
      fullCommandName: command.fullCommandName,
      data: userInfo.roles,
    });
  } else if (command.fullCommandName === `${PROGRAM_NAME}-organization-role-clear`) {
    await assignRolesToUserInOrganitaion({ organizationId: params.organizationId, userId: params.userId, role: [] });
    const userInfo = await getOrganizationUserinfo({ organizationId: params.organizationId, userId: params.userId });
    commandWriter(CommandTypes.ORGANIZATION, {
      fullCommandName: command.fullCommandName,
      data: userInfo.roles,
    });
  } else {
    const beutufiyCommandName = command.fullCommandName.split('-').join(' ');
    console.error(`"${beutufiyCommandName} ..." command not found \nRun "${beutufiyCommandName} --help" for more information`);
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
    const spinner = createOra('Fetching...').start();
    const profiles = await getPublishProfiles({ platform: params.platform });
    spinner.succeed();
    commandWriter(CommandTypes.PUBLISH, {
      fullCommandName: command.fullCommandName,
      data: profiles,
    });
  } else if (command.fullCommandName === `${PROGRAM_NAME}-publish-profile-delete`) {
    const response = await deletePublishProfile(params);
    commandWriter(CommandTypes.PUBLISH, {
      fullCommandName: command.fullCommandName,
      data: response,
    });
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
        process.exit(1);
      }
      
      let fileName = path.basename(expandedPath);
      let stats = fs.statSync(expandedPath);
      const maxBytes = getMaxUploadBytes();
      if (maxBytes !== null && stats.size > maxBytes) {
        spinner.fail(`File size ${(stats.size / GB).toFixed(2)} GB exceeds the allowed limit of ${(maxBytes / GB).toFixed(2)} GB.`);
        process.exit(1);
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
            spinner.fail('Upload failed: Please make sure that the app version number is unique in selected publish profile.');
            process.exit(1);
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
          process.exit(1);
        } else if (uploadError instanceof ProgramError) {
          spinner.fail(uploadError.message);
          process.exit(1);
        } else if (uploadError.message && uploadError.message.includes('Cannot read properties')) {
          spinner.fail(`API response format error. Please check your connection settings (AUTH_HOSTNAME and API_HOSTNAME).`);
          process.exit(1);
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
      spinner.text = `App version removed successfully.\n\nTaskId: ${responseData.taskId}`;
      spinner.succeed();
    } catch (e: any) {
      spinner.fail('Remove failed');
      throw e;
    }
  } else if (command.fullCommandName === `${PROGRAM_NAME}-publish-start`) {
    const spinner = createOra('Publish flow starting').start();
    try {
      const publish = await getPublishByAppVersion(params);
      const firstStep = publish.steps[0];
      const startResponse = await startExistingPublishFlow({ ...params, publishId: firstStep.publishId });
      commandWriter(CommandTypes.PUBLISH, startResponse);
      spinner.text = `Publish started successfully.`;
      spinner.succeed();
    } catch (error) {
      spinner.fail('Publish failed');
    } 
  }else if (command.fullCommandName === `${PROGRAM_NAME}-publish-profile-version-download`) {
      let spinner = createOra('Fetching app version download link').start();
      try {
        let downloadPath = path.resolve((params.path || '').replace('~', `${os.homedir}`));
        const responseData = await getAppVersionDownloadLink(params);
        const appVersions = await getAppVersions(params);
        const appVersion = appVersions.find((appVersion: any) => appVersion.id === params.appVersionId);
        if (!appVersion) {
          spinner.fail();
          throw new Error('App version not found');
        }
        spinner.text = `App version download link fetched successfully.`;
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
      const spinner = createOra('Fetching...').start();
      const variableGroups = await getPublishVariableGroups();
      spinner.succeed();
      commandWriter(CommandTypes.PUBLISH, {
        fullCommandName: command.fullCommandName,
        data: variableGroups,
      });
    } else if (command.fullCommandName === `${PROGRAM_NAME}-publish-variable-group-view`) {
      const spinner = createOra('Fetching...').start();
      const variables = await getPublishVariableListByGroupId(params);
      spinner.succeed();
      commandWriter(CommandTypes.PUBLISH, {
        fullCommandName: command.fullCommandName,
        data: variables.variables,
      });
    }else if(command.fullCommandName === `${PROGRAM_NAME}-publish-profile-version-list`){
      const spinner = createOra('Fetching...').start();
      const appVersions = await getAppVersions(params);
      spinner.succeed();
      commandWriter(CommandTypes.PUBLISH, {
        fullCommandName: command.fullCommandName,
        data: appVersions,
      });
    }else if(command.fullCommandName === `${PROGRAM_NAME}-publish-profile-version-view`){
      const spinner = createOra('Fetching...').start();
      const appVersion = await getAppVersionDetail(params);
      spinner.succeed();
      commandWriter(CommandTypes.PUBLISH, {
        fullCommandName: command.fullCommandName,
        data: appVersion,
      });
    }else if(command.fullCommandName === `${PROGRAM_NAME}-publish-profile-version-update-release-note`){
      const spinner = createOra('Try to update relase note of the app version').start();
      try{
        await setAppVersionReleaseNote(params);
        spinner.succeed("Release note updated successfully.");
      }catch(e: any){
        spinner.fail('Update failed');
        throw e;
      }
    }else if (command.fullCommandName === `${PROGRAM_NAME}-publish-active-list`){
      const spinner = createOra('Fetching...').start();
      const responseData = await getActivePublishes();
      spinner.succeed();
      commandWriter(CommandTypes.PUBLISH, {
        fullCommandName: command.fullCommandName,
        data: responseData,
      });
    }else if (command.fullCommandName === `${PROGRAM_NAME}-publish-view`){
      const spinner = createOra('Fetching...').start();
      const responseData = await getPublisDetailById(params);
      spinner.succeed();
      commandWriter(CommandTypes.PUBLISH, {
        fullCommandName: command.fullCommandName,
        data: responseData,
      });
    } 
    else {
      const beutufiyCommandName = command.fullCommandName.split('-').join(' ');
      console.error(`"${beutufiyCommandName} ..." command not found \nRun "${beutufiyCommandName} --help" for more information`);
    }
};

const handleBuildCommand = async (command: ProgramCommand, params:any) => {
  if (command.fullCommandName === `${PROGRAM_NAME}-build-start`) {
    if (!params.branchId && !params.branch) {
      console.error('error: You must provide either branchId or branch parameter');
      process.exit(1);
    }
    if (!params.workflowId && !params.workflow) {
      console.error('error: You must provide either workflowId or workflow parameter');
      process.exit(1);
    }
    const spinner = createOra(`Try to start a new build`).start();
    try {
      const responseData = await startBuild(params);
      commandWriter(CommandTypes.BUILD, {
        fullCommandName: command.fullCommandName,
        data: responseData,
      });
      spinner.text = `Build added to queue successfully.\n\nTaskId: ${responseData.taskId}\nQueueItemId: ${responseData.queueItemId}`;
      spinner.succeed();
    } catch (e) {
      spinner.fail('Build failed');
      throw e;
    }
  }else if(command.fullCommandName === `${PROGRAM_NAME}-build-profile-list`){
    const spinner = createOra('Fetching...').start();
    const responseData = await getBuildProfiles(params);
    spinner.succeed();
    commandWriter(CommandTypes.BUILD, {
      fullCommandName: command.fullCommandName,
      data: responseData,
    });
  }else if(command.fullCommandName === `${PROGRAM_NAME}-build-profile-branch-list`) {
    const spinner = createOra('Fetching...').start();
    const responseData = await getBranches(params);
    spinner.succeed();
    commandWriter(CommandTypes.BUILD, {
      fullCommandName: command.fullCommandName,
      data: responseData,
    });
  }else if(command.fullCommandName === `${PROGRAM_NAME}-build-profile-workflows`){
    const spinner = createOra('Fetching...').start();
    const responseData = await getWorkflows(params);
    spinner.succeed();
    commandWriter(CommandTypes.BUILD, {
      fullCommandName: command.fullCommandName,
      data: responseData,
    });
  } else if(command.fullCommandName === `${PROGRAM_NAME}-build-profile-configurations`) {
    const spinner = createOra('Fetching...').start();
    const responseData = await getConfigurations(params);
    spinner.succeed();
    commandWriter(CommandTypes.BUILD, {
      fullCommandName: command.fullCommandName,
      data: responseData,
    });
  } else if(command.fullCommandName === `${PROGRAM_NAME}-build-profile-branch-commits`){
    const spinner = createOra('Fetching...').start();
    const responseData = await getCommits(params);
    spinner.succeed();
    commandWriter(CommandTypes.BUILD, {
      fullCommandName: command.fullCommandName,
      data: responseData,
    });
  } else if(command.fullCommandName === `${PROGRAM_NAME}-build-list`){
    const spinner = createOra('Fetching...').start();
    const responseData = await getBuildsOfCommit(params);
    spinner.succeed();
    commandWriter(CommandTypes.BUILD, {
      fullCommandName: command.fullCommandName,
      data: responseData,
    });
  } else if (command.fullCommandName === `${PROGRAM_NAME}-build-download`){
    const downloadPath = path.resolve((params.path || '').replace('~', `${os.homedir}`));
    const spinner = createOra(`Downloading file artifact.zip`).start();
    try {
      const responseData = await downloadArtifact(params, downloadPath);
      commandWriter(CommandTypes.BUILD, {
        fullCommandName: command.fullCommandName,
        data: responseData,
      });
      spinner.text = `The file artifact.zip is downloaded successfully under path:\n${downloadPath}`;
      spinner.succeed();
    } catch (e) {
      spinner.text = 'The file could not be downloaded.';
      spinner.fail();
    }
  } else if (command.fullCommandName === `${PROGRAM_NAME}-build-download-log`){
    const downloadPath = path.resolve((params.path || '').replace('~', `${os.homedir}`));
    const spinner = createOra(`Downloading build log`).start();
    try {
      const responseData = await downloadBuildLog(params, downloadPath);
      commandWriter(CommandTypes.BUILD, {
        fullCommandName: command.fullCommandName,
        data: responseData,
      });
      spinner.text = `The build log is downloaded successfully under path:\n${downloadPath}/build-log.txt`;
      spinner.succeed();
    } catch (e) {
      spinner.text = 'The build log could not be downloaded.';
      spinner.fail();
    }
  } else if (command.fullCommandName === `${PROGRAM_NAME}-build-variable-group-list`){
    const spinner = createOra('Fetching...').start();
    const responseData = await getEnvironmentVariableGroups(params);
    spinner.succeed();
    commandWriter(CommandTypes.BUILD, {
      fullCommandName: command.fullCommandName,
      data: responseData,
    });
  } else if(command.fullCommandName === `${PROGRAM_NAME}-build-variable-group-create`){
    const responseData = await createEnvironmentVariableGroup(params);
    commandWriter(CommandTypes.BUILD, {
      fullCommandName: command.fullCommandName,
      data: { ...responseData, name: params.name },
    });
  } else if(command.fullCommandName === `${PROGRAM_NAME}-build-variable-view`){
    const spinner = createOra('Fetching...').start();
    const responseData = await getEnvironmentVariables(params);
    spinner.succeed();
    commandWriter(CommandTypes.BUILD, {
      fullCommandName: command.fullCommandName,
      data: responseData,
    });
  } else if(command.fullCommandName === `${PROGRAM_NAME}-build-variable-create`){
    const spinner = createOra('Creating environment variable').start();
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
      spinner.succeed('Environment variable created successfully');
      commandWriter(CommandTypes.BUILD, {
        fullCommandName: command.fullCommandName,
        data: { ...responseData, key: params.key },
      });
    } catch (e) {
      spinner.fail('Failed to create environment variable');
      throw e;
    }
  } else if (command.fullCommandName === `${PROGRAM_NAME}-build-active-list`){
    const spinner = createOra('Fetching...').start();
    const responseData = await getActiveBuilds();
    spinner.succeed();
    commandWriter(CommandTypes.BUILD, {
      fullCommandName: command.fullCommandName,
      data: responseData,
    });
  } else if (command.fullCommandName === `${PROGRAM_NAME}-build-view`){
    const spinner = createOra('Fetching...').start();
    const responseData = await getBuildsOfCommit(params);
    spinner.succeed();
    const build = responseData?.builds?.find((build: any) => build.id === params.buildId);
    commandWriter(CommandTypes.BUILD, {
      fullCommandName: command.fullCommandName,
      data: build,
    });
  }
  else {
    const beutufiyCommandName = command.fullCommandName.split('-').join(' ');
    console.error(`"${beutufiyCommandName} ..." command not found \nRun "${beutufiyCommandName} --help" for more information`);
  }

}

const handleDistributionCommand = async (command: ProgramCommand, params: any) => {
  if (command.fullCommandName === `${PROGRAM_NAME}-testing-distribution-profile-list`) {
    const spinner = createOra('Fetching...').start();
    const responseData = await getDistributionProfiles(params);
    if (!responseData || responseData.length === 0) {
      spinner.text = 'No distribution profile available';
      spinner.fail();
      process.exit(1);
    }
    spinner.succeed();
    commandWriter(CommandTypes.TESTING_DISTRIBUTION, {
      fullCommandName: command.fullCommandName,
      data: responseData,
    });
  } else if (command.fullCommandName === `${PROGRAM_NAME}-testing-distribution-profile-create`){
    const responseData = await createDistributionProfile(params);
    commandWriter(CommandTypes.TESTING_DISTRIBUTION, {
      fullCommandName: command.fullCommandName,
      data: { ...responseData, name: params.name },
    });
  }else if (command.fullCommandName === `${PROGRAM_NAME}-testing-distribution-upload`) {
    const spinner = createOra('Try to upload the app').start();
    try {
      const profiles = await getDistributionProfiles(params);
      if (!profiles || profiles.length === 0) {
        spinner.text = 'No distribution profile available';
        spinner.fail();
        process.exit(1);
      }

      let expandedPath = params.app;
      
      if (expandedPath.includes('~')) {
        expandedPath = expandedPath.replace(/~/g, os.homedir());
      }
      
      expandedPath = path.resolve(expandedPath);
      
      if (!fs.existsSync(expandedPath)) {
        spinner.fail(`File not found: ${params.app}`);
        process.exit(1);
      }

      let fileName = path.basename(expandedPath);
      let stats = fs.statSync(expandedPath);
      const maxBytes = getMaxUploadBytes();
      if (maxBytes !== null && stats.size > maxBytes) {
        spinner.fail(`File size ${(stats.size / GB).toFixed(2)} GB exceeds the allowed limit of ${(maxBytes / GB).toFixed(2)} GB.`);
        process.exit(1);
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
                spinner.fail('Warning: Upload task failed or was cancelled');
                break;
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
          process.exit(1);
        } else if (uploadError instanceof ProgramError) {
          spinner.fail(uploadError.message);
          process.exit(1);
        } else if (uploadError.message && uploadError.message.includes('Cannot read properties')) {
          spinner.fail(`API response format error. Please check your connection settings (AUTH_HOSTNAME and API_HOSTNAME).`);
          process.exit(1);
        }
        spinner.fail(`Upload failed: ${uploadError.message || 'Unknown error'}`);
        throw uploadError;
      }
    } catch (e) {
      spinner.fail('Upload failed');
      throw e;
    }
  }else if (command.fullCommandName === `${PROGRAM_NAME}-testing-distribution-profile-settings-auto-send`){
    const spinner = createOra('Testing groups saving').start();
    try{
      params.testingGroupIds = Array.isArray(params.testingGroupIds) ? params.testingGroupIds : params.testingGroupIds.split(' '); 
      await updateDistributionProfileSettings(params);
      spinner.succeed('Testing groups saved successfully.');
    }catch(e){
      spinner.fail('Saving failed');
    }
  } else if (command.fullCommandName === `${PROGRAM_NAME}-testing-distribution-testing-group-list`) {
    const spinner = createOra('Fetching...').start();
    const responseData = await getTestingGroups();
    spinner.succeed();
    commandWriter(CommandTypes.TESTING_DISTRIBUTION, {
      fullCommandName: command.fullCommandName,
      data: responseData,
    });
  }else if (command.fullCommandName === `${PROGRAM_NAME}-testing-distribution-testing-group-view`) {
    const spinner = createOra('Fetching...').start();
    const responseData = await getTestingGroupById(params);
    spinner.succeed();
    commandWriter(CommandTypes.TESTING_DISTRIBUTION, {
      fullCommandName: command.fullCommandName,
      data: responseData,
    });
  }
  else if (command.fullCommandName === `${PROGRAM_NAME}-testing-distribution-testing-group-create`) {
    const responseData = await createTestingGroup(params);
    console.info(`Testing group named ${responseData.name} created successfully!`);
  } else if (command.fullCommandName === `${PROGRAM_NAME}-testing-distribution-testing-group-remove`) {
    await deleteTestingGroup(params);
    console.info(`Selected testing group removed successfully!`);
  }else if (command.fullCommandName === `${PROGRAM_NAME}-testing-distribution-testing-group-tester-add`) {
    await addTesterToTestingGroup(params);
    console.info(`Tester has been successfully added to the selected testing group!`);
  }else if (command.fullCommandName === `${PROGRAM_NAME}-testing-distribution-testing-group-tester-remove`) {
    await removeTesterFromTestingGroup(params);
    console.info(`Tester has been successfully removed from the selected testing group!`);
  }
  else {
    const beutufiyCommandName = command.fullCommandName.split('-').join(' ');
    console.error(`"${beutufiyCommandName} ..." command not found \nRun "${beutufiyCommandName} --help" for more information`);
  }
}

const handleSigningIdentityCommand = async (command: ProgramCommand, params: any) => {
  if (command.fullCommandName === `${PROGRAM_NAME}-signing-identity-certificate-list`) {
    const spinner = createOra('Fetching...').start();
    const p12Certs = await getiOSP12Certificates();
    const csrCerts = await getiOSCSRCertificates();
    spinner.succeed();
    commandWriter(CommandTypes.SIGNING_IDENTITY, {
      fullCommandName: command.fullCommandName,
      data: [...p12Certs,...csrCerts],
    });
  }else if (command.fullCommandName === `${PROGRAM_NAME}-signing-identity-certificate-upload`){
    const spinner = createOra('Try to upload the certificate').start();
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
  }else if(command.fullCommandName === `${PROGRAM_NAME}-signing-identity-certificate-create`){
    const spinner = createOra('Try to create the certificate request').start();
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
  }else if(command.fullCommandName === `${PROGRAM_NAME}-signing-identity-certificate-view`){
    const spinner = createOra('Fetching...').start();
    const responseData = await getCertificateDetailById(params);
    spinner.succeed();
    commandWriter(CommandTypes.SIGNING_IDENTITY, {
      fullCommandName: command.fullCommandName,
      data: responseData
    });
  }else if(command.fullCommandName === `${PROGRAM_NAME}-signing-identity-certificate-download`){
    const p12Certs = await getiOSP12Certificates();
    const p12Cert = p12Certs?.find(
      (certificate: any) => certificate.id === params.certificateId
    );
    const downloadPath = path.resolve(
      (params.path || '').replace('~', `${os.homedir}`)
    );
    const fileName = p12Cert ? p12Cert.filename : 'download.cer';
    const spinner = createOra(
      `Downloading ${p12Cert ? `certificate bundle: ${p12Cert.filename}` : '.cer file'} `
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
  }else if(command.fullCommandName === `${PROGRAM_NAME}-signing-identity-certificate-remove`){
    const spinner = createOra('Try to remove the certificate').start();
    try {
      const csrCerts = await getiOSCSRCertificates();
      const csrCert = csrCerts?.find((certificate:any) => certificate.id === params.certificateId);
      await removeCSRorP12CertificateById(params, csrCert ? 'csr': 'p12');
      spinner.text = `Certificate removed successfully.\n\n`;
      spinner.succeed();
    } catch (e: any) {
      spinner.fail('Remove failed');
      throw e;
    }
  }else if(command.fullCommandName === `${PROGRAM_NAME}-signing-identity-keystore-list`){
    const spinner = createOra('Fetching...').start();
    const keystores = await getAndroidKeystores();
    spinner.succeed();
    commandWriter(CommandTypes.SIGNING_IDENTITY, {
      fullCommandName: command.fullCommandName,
      data: keystores
    });
  }else if(command.fullCommandName === `${PROGRAM_NAME}-signing-identity-keystore-create`){
    const spinner = createOra('Trying to generate new keystore.').start();
    try{
      await generateNewKeystore(params);
      spinner.text = `Keystore generated successfully.\n\n Keystore name: ${params.name}`;
      spinner.succeed();
    }catch(e: any){
      spinner.fail('Generation failed');
      throw e;
    }
  }else if(command.fullCommandName === `${PROGRAM_NAME}-signing-identity-keystore-upload`){
    const spinner = createOra('Trying to upload the keystore file').start();
    try {
      await uploadAndroidKeystoreFile(params);
      spinner.text = `Keystore file uploaded successfully.\n\n`;
      spinner.succeed();
    } catch (e) {
      spinner.fail('Upload failed: Keystore was tampered with, or password was incorrect');
    }
  }else if(command.fullCommandName === `${PROGRAM_NAME}-signing-identity-keystore-download`){
    const downloadPath = path.resolve((params.path || '').replace('~', `${os.homedir}`));
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
  }else if(command.fullCommandName === `${PROGRAM_NAME}-signing-identity-keystore-view`){
    const spinner = createOra('Fetching...').start();
    const keystore = await getKeystoreDetailById(params);
    spinner.succeed();
    commandWriter(CommandTypes.SIGNING_IDENTITY, {
      fullCommandName: command.fullCommandName,
      data: keystore
    });
  }else if(command.fullCommandName === `${PROGRAM_NAME}-signing-identity-keystore-remove`){
    const spinner = createOra('Try to remove the keystore').start();
    try {
      await removeKeystore(params);
      spinner.text = `Keystore removed successfully.\n\n`;
      spinner.succeed();
    } catch (e: any) {
      spinner.fail('Remove failed');
      throw e;
    }
  }else if(command.fullCommandName === `${PROGRAM_NAME}-signing-identity-provisioning-profile-list`) {
    const spinner = createOra('Fetching...').start();
    const profiles = await getProvisioningProfiles();
    spinner.succeed();
    commandWriter(CommandTypes.SIGNING_IDENTITY, {
      fullCommandName: command.fullCommandName,
      data: profiles
    });
  }else if(command.fullCommandName === `${PROGRAM_NAME}-signing-identity-provisioning-profile-upload`) {
    const spinner = createOra('Trying to upload the provisioning profile').start();
    try {
      await uploadProvisioningProfile(params);
      spinner.text = `Provisioning profile uploaded successfully.\n\n`;
      spinner.succeed();
    } catch (e) {
      spinner.fail('Upload failed');
      throw e;
    }
  }else if(command.fullCommandName === `${PROGRAM_NAME}-signing-identity-provisioning-profile-download`) {
    const downloadPath = path.resolve((params.path || '').replace('~', `${os.homedir}`));
    const spinner = createOra('Trying to download the provisioning profile').start();
    try {
      const profile = await getProvisioningProfileDetailById(params);
      await downloadProvisioningProfileById(params, downloadPath, profile.filename);
      spinner.text = `The file ${profile.filename} is downloaded successfully under path:\n${downloadPath}`;
      spinner.succeed();
    } catch (e) {
      spinner.fail('Download failed');
      throw e;
    }
  }else if(command.fullCommandName === `${PROGRAM_NAME}-signing-identity-provisioning-profile-view`) {
    const spinner = createOra('Fetching...').start();
    const profile = await getProvisioningProfileDetailById(params);
    spinner.succeed();
    commandWriter(CommandTypes.SIGNING_IDENTITY, {
      fullCommandName: command.fullCommandName,
      data: profile
    });
  }else if(command.fullCommandName === `${PROGRAM_NAME}-signing-identity-provisioning-profile-remove`) {
    const spinner = createOra('Try to remove the provisioning profile').start();
    try {
      await removeProvisioningProfile(params);
      spinner.text = `Provisioning profile removed successfully.\n\n`;
      spinner.succeed();
    } catch (e: any) {
      spinner.fail('Remove failed');
      throw e;
    }
  }
}
const handleEnterpriseAppStoreCommand = async (command: ProgramCommand, params: any) => {
  if (command.fullCommandName === `${PROGRAM_NAME}-enterprise-app-store-profile-list`){
    const spinner = createOra('Fetching...').start();
    const responseData = await getEnterpriseProfiles();
    spinner.succeed();
    commandWriter(CommandTypes.ENTERPRISE_APP_STORE, {
      fullCommandName: command.fullCommandName,
      data: responseData,
    });
  } else if(command.fullCommandName === `${PROGRAM_NAME}-enterprise-app-store-version-list`){
    const spinner = createOra('Fetching...').start();
    const responseData = await getEnterpriseAppVersions(params);
    spinner.succeed();
    commandWriter(CommandTypes.ENTERPRISE_APP_STORE, {
      fullCommandName: command.fullCommandName,
      data: responseData,
    });
  } else if (command.fullCommandName === `${PROGRAM_NAME}-enterprise-app-store-version-publish`){
    const responseData = await publishEnterpriseAppVersion(params);
    commandWriter(CommandTypes.ENTERPRISE_APP_STORE, {
      fullCommandName: command.fullCommandName,
      data: responseData,
    });
  } else if (command.fullCommandName === `${PROGRAM_NAME}-enterprise-app-store-version-unpublish`){
    const responseData = await unpublishEnterpriseAppVersion(params);
    commandWriter(CommandTypes.ENTERPRISE_APP_STORE, {
      fullCommandName: command.fullCommandName,
      data: responseData,
    });
  } else if (command.fullCommandName === `${PROGRAM_NAME}-enterprise-app-store-version-remove`){
    const spinner = createOra('Try to delete the app version').start();
    try {
      const responseData = await removeEnterpriseAppVersion(params);
      commandWriter(CommandTypes.ENTERPRISE_APP_STORE, {
        fullCommandName: command.fullCommandName,
        data: responseData,
      });
      spinner.text = `App version deleted successfully.\n\nTaskId: ${responseData.taskId}`;
      spinner.succeed();
    } catch (e) {
      spinner.fail('App version delete failed');
      throw e;
    }
  } else if (command.fullCommandName === `${PROGRAM_NAME}-enterprise-app-store-version-notify`){
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
  } else if (command.fullCommandName === `${PROGRAM_NAME}-enterprise-app-store-version-upload-for-profile`){
    const spinner = createOra('Try to upload the app').start();
    try {
      let expandedPath = params.app;
      
      if (expandedPath.includes('~')) {
        expandedPath = expandedPath.replace(/~/g, os.homedir());
      }
      
      expandedPath = path.resolve(expandedPath);
      
      if (!fs.existsSync(expandedPath)) {
        spinner.fail(`File not found: ${params.app}`);
        process.exit(1);
      }
      
      let fileName = path.basename(expandedPath);
      let stats = fs.statSync(expandedPath);
      const maxBytes = getMaxUploadBytes();
      if (maxBytes !== null && stats.size > maxBytes) {
        spinner.fail(`File size ${(stats.size / GB).toFixed(2)} GB exceeds the allowed limit of ${(maxBytes / GB).toFixed(2)} GB.`);
        process.exit(1);
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
          process.exit(1);
        } else if (uploadError instanceof ProgramError) {
          spinner.fail(uploadError.message);
          process.exit(1);
        } else if (uploadError.message && uploadError.message.includes('Cannot read properties')) {
          spinner.fail(`API response format error. Please check your connection settings (AUTH_HOSTNAME and API_HOSTNAME).`);
          process.exit(1);
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
  } else if (command.fullCommandName === `${PROGRAM_NAME}-enterprise-app-store-version-upload-without-profile`){
    const spinner = createOra('Try to upload the app').start();
    try {
      let expandedPath = params.app;
      
      if (expandedPath.includes('~')) {
        expandedPath = expandedPath.replace(/~/g, os.homedir());
      }
      
      expandedPath = path.resolve(expandedPath);
      
      if (!fs.existsSync(expandedPath)) {
        spinner.fail(`File not found: ${params.app}`);
        process.exit(1);
      }
      
      let fileName = path.basename(expandedPath);
      let stats = fs.statSync(expandedPath);
      const maxBytes = getMaxUploadBytes();
      if (maxBytes !== null && stats.size > maxBytes) {
        spinner.fail(`File size ${(stats.size / GB).toFixed(2)} GB exceeds the allowed limit of ${(maxBytes / GB).toFixed(2)} GB.`);
        process.exit(1);
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
          process.exit(1);
        } else if (uploadError instanceof ProgramError) {
          spinner.fail(uploadError.message);
          process.exit(1);
        } else if (uploadError.message && uploadError.message.includes('Cannot read properties')) {
          spinner.fail(`API response format error. Please check your connection settings (AUTH_HOSTNAME and API_HOSTNAME).`);
          process.exit(1);
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
      process.exit(1);
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
    console.error(`"${beutufiyCommandName} ..." command not found \nRun "${beutufiyCommandName} --help" for more information`);
  }
}
export const runCommand = async (command: ProgramCommand) => {
  const params = command.opts() as any;
  const commandName = command.name();
  let responseData;

  //console.log('Full-Command-Name: ', command.fullCommandName, params);

  //In interactive mode, if any parameters have errors, we can't continue execution.
  if (params.isError) {
    process.exit(1);
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
      console.error(`"${beutufiyCommandName} ..." command not found \nRun "${beutufiyCommandName} --help" for more information`);
      process.exit(1);
    }
  }
};
