/**
 * @fileoverview Command-specific writer functions extracted from writer.ts
 * Each command type has its dedicated writer with proper data transformation
 */

import chalk from 'chalk';
import { PROGRAM_NAME } from '../constant';
import {
  formatDate,
  formatRelativeDate,
  formatDuration,
  formatFileSize,
  formatBoolean,
  formatEnabledStatus,
  formatVersionString,
  mapBuildStatus,
  mapQueueItemStatus,
  mapOperatingSystem,
  mapPlatformType,
  mapPublishType,
  mapAuthenticationType,
  mapCertificateStoreType,
  validateTableData,
  shouldDisplayTable,
  logInfo,
  logMessage,
  logTable,
  transformDistributionProfile,
  transformBuildProfile,
  transformBranch,
  transformCommit,
  transformBuild,
  transformBuildDetails,
  transformEnvironmentVariable,
  transformActiveBuild,
  transformOrganizationList,
  transformOrganizationDetails,
  transformUser,
  transformInvitation,
  processRolesWithInheritance,
  safeGet
} from './writer-utilities';

/**
 * Authentication command writers
 */
export const writeLoginCommand = (data: any): void => {
  logMessage(chalk.italic(`export AC_ACCESS_TOKEN="${data.access_token}"\n`));
  logInfo(
    chalk.green(
      `Login is successful. If you keep getting 401 error, execute the command above to set your token manually to your environment variable`
    )
  );
};

export const writeLogoutCommand = (data: any): void => {
  // Logout doesn't need special output, handled in command runner
};

export const writeConfigCommand = (data: any): void => {
  // Config command has no specific output
};

/**
 * Testing Distribution command writers
 */
export const writeTestingDistributionCommand = (data: any): void => {
  const { fullCommandName } = data;
  
  if (fullCommandName === `${PROGRAM_NAME}-testing-distribution-profile-list`) {
    writeDistributionProfileList(data);
  } else if (fullCommandName === `${PROGRAM_NAME}-testing-distribution-profile-create`) {
    writeDistributionProfileCreate(data);
  } else if (fullCommandName === `${PROGRAM_NAME}-testing-distribution-testing-group-list`) {
    writeTestingGroupList(data);
  } else if (fullCommandName === `${PROGRAM_NAME}-testing-distribution-testing-group-view`) {
    writeTestingGroupView(data);
  }
};

export const writeDistributionProfileList = (data: any): void => {
  const validation = validateTableData(data?.data, 'No distribution profiles available.');
  if (!validation.isValid) {
    logInfo(validation.message!);
    return;
  }
  
  const tableData = validation.data.map(transformDistributionProfile);
  logTable(tableData);
};

export const writeDistributionProfileCreate = (data: any): void => {
  logInfo(`\n${data.data.name} distribution profile created successfully!`);
};

export const writeTestingGroupList = (data: any): void => {
  const { shouldDisplay, message } = shouldDisplayTable(data.data, '  No testing group found');
  
  if (shouldDisplay) {
    const tableData = data.data.map((group: any) => ({
      'ID': group.id || '-',
      'Name': group.name || '-',
    }));
    logTable(tableData);
  } else {
    logMessage(message!);
  }
};

export const writeTestingGroupView = (data: any): void => {
  const group = data?.data;
  
  if (!group) {
    logMessage('  No testing group found');
    return;
  }
  
  const groupData = {
    'ID': group.id || '-',
    'Name': group.name || '-',
    'Created': formatDate(group.createDate),
    'Updated': formatDate(group.updateDate),
  };
  
  logTable(groupData);
  logMessage('*************');
  logInfo('  Testers:');
  
  const { shouldDisplay, message } = shouldDisplayTable(group?.testers, '  No tester available');
  if (shouldDisplay) {
    logTable(group.testers.map((tester: any) => tester));
  } else {
    logMessage(message!);
  }
  logMessage('*************');
};

/**
 * Build command writers
 */
export const writeBuildCommand = (data: any): void => {
  const { fullCommandName } = data;
  
  if (fullCommandName === `${PROGRAM_NAME}-build-profile-list`) {
    writeBuildProfileList(data);
  } else if (fullCommandName === `${PROGRAM_NAME}-build-profile-branch-list`) {
    writeBuildBranchList(data);
  } else if (fullCommandName === `${PROGRAM_NAME}-build-profile-workflows`) {
    writeBuildWorkflowList(data);
  } else if (fullCommandName === `${PROGRAM_NAME}-build-profile-configurations`) {
    writeBuildConfigurationList(data);
  } else if (fullCommandName === `${PROGRAM_NAME}-build-profile-branch-commits`) {
    writeBuildCommitList(data);
  } else if (fullCommandName === `${PROGRAM_NAME}-build-list`) {
    writeBuildList(data);
  } else if (fullCommandName === `${PROGRAM_NAME}-build-variable-group-list`) {
    writeBuildVariableGroupList(data);
  } else if (fullCommandName === `${PROGRAM_NAME}-build-variable-group-create`) {
    writeBuildVariableGroupCreate(data);
  } else if (fullCommandName === `${PROGRAM_NAME}-build-variable-view`) {
    writeBuildVariableView(data);
  } else if (fullCommandName === `${PROGRAM_NAME}-build-variable-create`) {
    writeBuildVariableCreate(data);
  } else if (fullCommandName === `${PROGRAM_NAME}-build-active-list`) {
    writeBuildActiveList(data);
  } else if (fullCommandName === `${PROGRAM_NAME}-build-view`) {
    writeBuildView(data);
  }
};

export const writeBuildProfileList = (data: any): void => {
  const validation = validateTableData(data?.data, 'No build profiles available.');
  if (!validation.isValid) {
    logInfo(validation.message!);
    return;
  }
  
  const tableData = validation.data.map(transformBuildProfile);
  logTable(tableData);
};

export const writeBuildBranchList = (data: any): void => {
  const tableData = data?.data?.branches?.map(transformBranch) || [];
  logTable(tableData);
};

export const writeBuildWorkflowList = (data: any): void => {
  const tableData = data?.data?.map((workflow: any) => ({
    'Workflow Id': workflow.id,
    'Workflow Name': workflow.workflowName,
    'Last Used': formatDate(workflow.lastUsedTime, 'No previous builds'),
  })) || [];
  logTable(tableData);
};

export const writeBuildConfigurationList = (data: any): void => {
  const tableData = data?.data?.map((configuration: any) => ({
    'Configuration Id': safeGet(configuration, 'item1.id'),
    'Configuration Name': safeGet(configuration, 'item1.configurationName'),
    'Update Date': formatDate(safeGet(configuration, 'item1.updateDate'), 'No updated before'),
  })) || [];
  logTable(tableData);
};

export const writeBuildCommitList = (data: any): void => {
  const validation = validateTableData(data?.data, 'No commits available.');
  if (!validation.isValid) {
    logInfo(validation.message!);
    return;
  }
  
  const tableData = validation.data.map(transformCommit);
  logTable(tableData);
};

export const writeBuildList = (data: any): void => {
  const validation = validateTableData(data?.data?.builds, 'No builds available.');
  if (!validation.isValid) {
    logInfo(validation.message!);
    return;
  }
  
  const tableData = validation.data.map(transformBuild);
  logTable(tableData);
};

export const writeBuildVariableGroupList = (data: any): void => {
  const tableData = data?.data?.map((x: any) => ({ 
    'Variable Groups ID': x.id, 
    'Variable Groups Name': x.name 
  })) || [];
  logTable(tableData);
};

export const writeBuildVariableGroupCreate = (data: any): void => {
  logInfo(`\n${data?.data?.name} environment variable group created successfully!`);
};

export const writeBuildVariableView = (data: any): void => {
  const tableData = data?.data?.map(transformEnvironmentVariable) || [];
  logTable(tableData);
};

export const writeBuildVariableCreate = (data: any): void => {
  logInfo(`\n${data?.data?.key} environment variable created successfully!`);
};

export const writeBuildActiveList = (data: any): void => {
  const validation = validateTableData(data?.data?.data, 'No active builds available.');
  if (!validation.isValid) {
    logInfo(validation.message!);
    return;
  }
  
  const tableData = validation.data.map(transformActiveBuild);
  logTable(tableData);
};

export const writeBuildView = (data: any): void => {
  const build = data?.data;
  if (!build) {
    logInfo('No builds available.');
    return;
  }
  
  const tableData = transformBuildDetails(build);
  logTable(tableData);
};

/**
 * Enterprise App Store command writers
 */
export const writeEnterpriseAppStoreCommand = (data: any): void => {
  const { fullCommandName } = data;
  
  if (fullCommandName === `${PROGRAM_NAME}-enterprise-app-store-profile-list`) {
    writeEnterpriseStoreProfileList(data);
  } else if (fullCommandName === `${PROGRAM_NAME}-enterprise-app-store-version-list`) {
    writeEnterpriseStoreVersionList(data);
  } else if (fullCommandName === `${PROGRAM_NAME}-enterprise-app-store-version-publish`) {
    writeEnterpriseStoreVersionPublish(data);
  } else if (fullCommandName === `${PROGRAM_NAME}-enterprise-app-store-version-unpublish`) {
    writeEnterpriseStoreVersionUnpublish(data);
  } else if (fullCommandName === `${PROGRAM_NAME}-enterprise-app-store-version-notify`) {
    writeEnterpriseStoreVersionNotify(data);
  } else if (fullCommandName === `${PROGRAM_NAME}-enterprise-app-store-version-download-link`) {
    writeEnterpriseStoreDownloadLink(data);
  }
};

export const writeEnterpriseStoreProfileList = (data: any): void => {
  const validation = validateTableData(data?.data, 'No build profiles available.');
  if (!validation.isValid) {
    logInfo(validation.message!);
    return;
  }
  
  const tableData = validation.data.map((buildProfile: any) => ({
    'Profile Id': buildProfile.id,
    'Profile Name': buildProfile.name,
    Version: buildProfile.version,
    Downloads: buildProfile.totalDownloadCount,
    'Latest Publish': formatDate(buildProfile.latestPublishDate),
    'Last Received': formatDate(buildProfile.lastBinaryReceivedDate),
  }));
  logTable(tableData);
};

export const writeEnterpriseStoreVersionList = (data: any): void => {
  const validation = validateTableData(data?.data, 'No app versions available.');
  if (!validation.isValid) {
    logInfo(validation.message!);
    return;
  }
  
  const tableData = validation.data.map(transformEnterpriseStoreVersion);
  logTable(tableData);
};

export const writeEnterpriseStoreVersionPublish = (data: any): void => {
  const tableData = [data?.data].map(transformEnterpriseStoreVersion);
  logTable(tableData);
};

export const writeEnterpriseStoreVersionUnpublish = (data: any): void => {
  const validation = validateTableData([data?.data], 'No app versions available.');
  if (!validation.isValid) {
    logInfo(validation.message!);
    return;
  }
  
  const tableData = validation.data.map(transformEnterpriseStoreVersion);
  logTable(tableData);
};

export const writeEnterpriseStoreVersionNotify = (data: any): void => {
  const validation = validateTableData(data?.data, 'No app versions available.');
  if (!validation.isValid) {
    logInfo(validation.message!);
    return;
  }
  // Notification doesn't output table, just validates data
};

export const writeEnterpriseStoreDownloadLink = (data: any): void => {
  logMessage(`Download Link: ${data?.data}`);
};

export const transformEnterpriseStoreVersion = (buildProfile: any) => {
  return {
    'Version Name': buildProfile.name,
    Summary: buildProfile.summary,
    Version: buildProfile.version,
    'Version Code': buildProfile.versionCode,
    'Publish Type': mapPublishType(buildProfile.publishType),
    'Latest Publish': formatDate(buildProfile.publishDate),
    'Target Platform': mapOperatingSystem(buildProfile.platformType),
    Downloads: buildProfile.downloadCount,
    Created: formatDate(buildProfile.createDate),
    Updated: formatDate(buildProfile.updateDate)
  };
};

/**
 * Organization command writers
 */
export const writeOrganizationCommand = (data: any): void => {
  const { fullCommandName } = data;
  
  if (fullCommandName === `${PROGRAM_NAME}-organization-view`) {
    writeOrganizationView(data);
  } else if (fullCommandName === `${PROGRAM_NAME}-organization-user-view`) {
    writeOrganizationUserView(data);
  } else if (fullCommandName === `${PROGRAM_NAME}-organization-user-invite`) {
    writeOrganizationUserInvite(data);
  } else if (fullCommandName === `${PROGRAM_NAME}-organization-user-re-invite`) {
    writeOrganizationUserReInvite(data);
  } else if (fullCommandName === `${PROGRAM_NAME}-organization-user-remove`) {
    writeOrganizationUserRemove(data);
  } else if (fullCommandName === `${PROGRAM_NAME}-organization-role-view`) {
    writeOrganizationRoleView(data);
  } else {
    logMessage(data.data);
  }
};

export const writeOrganizationView = (data: any): void => {
  const isAll = Array.isArray(data.data);
  const tableData = isAll ? data.data : [data.data];
  
  const transformedData = isAll 
    ? tableData.map(transformOrganizationList)
    : tableData.map(transformOrganizationDetails);
  
  logTable(transformedData);
};

export const writeOrganizationUserView = (data: any): void => {
  logMessage('\n- Users ↴ ');
  
  const users = data.data.users;
  const { shouldDisplay: shouldDisplayUsers, message: usersMessage } = shouldDisplayTable(users, '  No users found.');
  
  if (shouldDisplayUsers) {
    const userTableData = users.map(transformUser);
    logTable(userTableData);
  } else {
    logMessage(usersMessage!);
  }
  
  logMessage('\n- Invitations ↴ ');
  
  const invitations = data.data.invitations;
  const { shouldDisplay: shouldDisplayInvitations, message: invitationsMessage } = shouldDisplayTable(invitations, '  No invitations found');
  
  if (shouldDisplayInvitations) {
    const invitationTableData = invitations.map(transformInvitation);
    logTable(invitationTableData);
  } else {
    logMessage(invitationsMessage!);
  }
};

export const writeOrganizationUserInvite = (data: any): void => {
  logMessage('Invitation successfully sent.');
};

export const writeOrganizationUserReInvite = (data: any): void => {
  logMessage('Re-invitation successfully sent again.');
};

export const writeOrganizationUserRemove = (data: any): void => {
  logMessage(`User "${data.data.email}" has been removed.`);
};

export const writeOrganizationRoleView = (data: any): void => {
  logMessage('\n- Roles ↴ ');
  
  const roles = data.data?.roles;
  const inheritedRoles = data.data?.inheritedRoles;
  
  if (roles?.length || inheritedRoles?.length) {
    const processedRoles = processRolesWithInheritance(roles, inheritedRoles);
    logTable(processedRoles);
  } else {
    logMessage('  No roles found.');
  }
};

/**
 * Publish command writers
 */
export const writePublishCommand = (data: any): void => {
  const { fullCommandName } = data;
  
  if (fullCommandName === `${PROGRAM_NAME}-publish-profile-create`) {
    writePublishProfileCreate(data);
  } else if (fullCommandName === `${PROGRAM_NAME}-publish-profile-rename`) {
    writePublishProfileRename(data);
  } else if (fullCommandName === `${PROGRAM_NAME}-publish-profile-list`) {
    writePublishProfileList(data);
  } else if (fullCommandName === `${PROGRAM_NAME}-publish-variable-group-list`) {
    writePublishVariableGroupList(data);
  } else if (fullCommandName === `${PROGRAM_NAME}-publish-variable-group-view`) {
    writePublishVariableGroupView(data);
  } else if (fullCommandName === `${PROGRAM_NAME}-publish-profile-settings-autopublish`) {
    writePublishProfileSettingsAutopublish(data);
  } else if (fullCommandName === `${PROGRAM_NAME}-publish-profile-version-mark-as-rc` || 
             fullCommandName === `${PROGRAM_NAME}-publish-profile-version-unmark-as-rc`) {
    writePublishProfileVersionRC(data);
  } else if (fullCommandName === `${PROGRAM_NAME}-publish-profile-version-list`) {
    writePublishProfileVersionList(data);
  } else if (fullCommandName === `${PROGRAM_NAME}-publish-profile-version-view`) {
    writePublishProfileVersionView(data);
  } else if (fullCommandName === `${PROGRAM_NAME}-publish-active-list`) {
    writePublishActiveList(data);
  } else if (fullCommandName === `${PROGRAM_NAME}-publish-view`) {
    writePublishView(data);
  } else {
    logMessage(data.data);
  }
};

export const writePublishProfileCreate = (data: any): void => {
  const tableData = [{
    'Id:': data.data.id,
    'Name:': data.data.name,
    'Created:': formatDate(data.data.createDate),
  }];
  logTable(tableData);
};

export const writePublishProfileRename = (data: any): void => {
  const tableData = [{
    'Id:': data.data.id,
    'Name:': data.data.name,
    'Created:': formatDate(data.data.createDate),
    'Updated:': formatDate(data.data.updateDate),
  }];
  logTable(tableData);
};

export const writePublishProfileList = (data: any): void => {
  const { shouldDisplay, message } = shouldDisplayTable(data.data, '  No publish profile found');
  
  if (shouldDisplay) {
    const tableData = data.data.map((publishProfile: any) => ({
      'Id': publishProfile.id,
      'Name': publishProfile.name,
      'Last Version': publishProfile.lastUploadVersion,
      'Last Version Code': publishProfile.lastUploadVersionCode,
      'Version Code': publishProfile.version,
      'App Unique Id': publishProfile.appUniqueId,
      'Latest Publish': formatDate(publishProfile.publishDate),
      'Platform': mapOperatingSystem(publishProfile.platformType),
      Created: formatDate(publishProfile.createDate),
      Updated: formatDate(publishProfile.updateDate),
    }));
    logTable(tableData);
  } else {
    logMessage(message!);
  }
};

export const writePublishVariableGroupList = (data: any): void => {
  const { shouldDisplay, message } = shouldDisplayTable(data.data, '  No publish variable group found');
  
  if (shouldDisplay) {
    const tableData = data.data.map((group: any) => ({
      'Group Id': group.id,
      'Group Name': group.name,
      Created: formatDate(group.createDate),
      Updated: formatDate(group.updateDate),
    }));
    logTable(tableData);
  } else {
    logMessage(message!);
  }
};

export const writePublishVariableGroupView = (data: any): void => {
  const { shouldDisplay, message } = shouldDisplayTable(data.data, '  No publish variable found');
  
  if (shouldDisplay) {
    const tableData = data.data.map(transformEnvironmentVariable);
    logTable(tableData);
  } else {
    logMessage(message!);
  }
};

export const writePublishProfileSettingsAutopublish = (data: any): void => {
  const tableData = [{
    'Id:': data.data.id,
    'Name:': data.data.name,
    'Created:': formatDate(data.data.createDate),
    'Updated:': formatDate(data.data.updateDate),
    'Auto Publish': formatBoolean(data.data.profileSettings?.whenNewVersionRecieved),
  }];
  logTable(tableData);
};

export const writePublishProfileVersionRC = (data: any): void => {
  const tableData = [{
    'Id:': data.data.id,
    'Name:': data.data.name,
    'Unique Name': data.data.uniqueName,
    'Created:': formatDate(data.data.createDate),
    'Updated:': formatDate(data.data.updateDate),
    'Release Candidate': formatBoolean(data.data.releaseCandidate),
  }];
  logTable(tableData);
};

export const writePublishProfileVersionList = (data: any): void => {
  const { shouldDisplay, message } = shouldDisplayTable(data.data, '  No app version found');
  
  if (shouldDisplay) {
    const tableData = data.data.map((version: any) => ({
      'App Version Id': version.id || '-',
      'Version/App Name': formatVersionString(version.version, version.versionCode, version.name),
      'Binary Received': formatDate(version.createDate),
      'Release Candidate': formatBoolean(version.releaseCandidate),
      'File Size': formatFileSize(version.fileSize),
      'Last Step': mapBuildStatus(version.latestFlowStatus) || 'Not Started',
    }));
    logTable(tableData);
  } else {
    logMessage(message!);
  }
};

export const writePublishProfileVersionView = (data: any): void => {
  const version = data.data;
  
  if (!version) {
    logMessage('  No app version found');
    return;
  }
  
  const tableData = {
    'App Version Id': version.id || '-',
    'Version/App Name': formatVersionString(version.version, version.versionCode, version.name),
    'Binary Received': formatDate(version.createDate),
    'File Size': formatFileSize(version.fileSize),
    'Last Step': mapBuildStatus(version.latestFlowStatus) || 'Not Started',
    'Release Candidate': formatBoolean(version.releaseCandidate),
    'ReleaseNotes': version.summary || '-',
    'Unique Name': version.uniqueName || '-',
    'Updated': formatDate(version.updateDate),
  };
  logTable(tableData);
};

export const writePublishActiveList = (data: any): void => {
  const { shouldDisplay, message } = shouldDisplayTable(data.data, '  No active publishing process available.');
  
  if (shouldDisplay) {
    const tableData = data.data.map((publish: any) => ({
      'Publish Id': publish.publishId || '-',
      'Profile Name': publish.profileName,
      'Step Name': publish.stepName || '-',
      'Status': mapQueueItemStatus(publish.queueItemStatus),
      'Started By': publish.email || '-',
      'Started': formatDate(publish.startQueueDateTime),
      'Target OS': mapOperatingSystem(publish.os),
      'Profile Id': publish.profileId || '-',
      'App Version Id': publish.appVersionId || '-',
    }));
    logTable(tableData);
  } else {
    logMessage(message!);
  }
};

export const writePublishView = (data: any): void => {
  const publish = data.data;
  
  if (!publish) {
    logMessage('  No publishing process found');
    return;
  }
  
  const tableData = {
    'Publish Id': publish.id || '-',
    'Status': mapBuildStatus(publish.status) || 'Not Started',
    'Started On': formatDate(publish.startedOn),
  };
  logTable(tableData);
  
  if (publish) {
    logMessage('*************');
    logInfo('  Steps:');
    
    const { shouldDisplay, message } = shouldDisplayTable(publish?.steps, '  No step available');
    if (shouldDisplay) {
      const stepsTableData = publish.steps.map((step: any) => ({
        'Name': step.name || '-',
        'Status': mapBuildStatus(step.status) || 'Not Started',
        'Started By': safeGet(step, 'startedByUser.email'),
        'Started On': formatDate(step.startedOn),
        'Finished On': formatDate(step.finishedOn),
      }));
      logTable(stepsTableData);
    } else {
      logMessage(message!);
    }
    logMessage('*************');
  }
};

/**
 * Signing Identity command writers
 */
export const writeSigningIdentityCommand = (data: any): void => {
  const { fullCommandName } = data;
  
  if (fullCommandName === `${PROGRAM_NAME}-signing-identity-certificate-list`) {
    writeSigningCertificateList(data);
  } else if (fullCommandName === `${PROGRAM_NAME}-signing-identity-certificate-upload`) {
    writeSigningCertificateUpload(data);
  } else if (fullCommandName === `${PROGRAM_NAME}-signing-identity-certificate-create`) {
    writeSigningCertificateCreate(data);
  } else if (fullCommandName === `${PROGRAM_NAME}-signing-identity-certificate-view`) {
    writeSigningCertificateView(data);
  } else if (fullCommandName === `${PROGRAM_NAME}-signing-identity-keystore-list`) {
    writeSigningKeystoreList(data);
  } else if (fullCommandName === `${PROGRAM_NAME}-signing-identity-keystore-view`) {
    writeSigningKeystoreView(data);
  } else if (fullCommandName === `${PROGRAM_NAME}-signing-identity-provisioning-profile-list`) {
    writeSigningProvisioningProfileList(data);
  } else if (fullCommandName === `${PROGRAM_NAME}-signing-identity-provisioning-profile-view`) {
    writeSigningProvisioningProfileView(data);
  }
};

export const writeSigningCertificateList = (data: any): void => {
  const { shouldDisplay, message } = shouldDisplayTable(data.data, '  No iOS certificate found');
  
  if (shouldDisplay) {
    const tableData = data.data.map((certificate: any) => ({
      'Certificate Id': certificate.id || '-',
      'Certificate Name': certificate.name || '-',
      'Stored By': mapCertificateStoreType(certificate.storeType),
      'Extension': certificate.extension || '-',
      'Expire Date': formatDate(certificate.expireDate),
    }));
    logTable(tableData);
  } else {
    logMessage(message!);
  }
};

export const writeSigningCertificateUpload = (data: any): void => {
  if (data.data) {
    const tableData = {
      'Certificate Id': data.data.id || '-',
      'Certificate Name': data.data.name || '-',
      'Stored By': mapCertificateStoreType(data.data.storeType),
      'File Name': data.data.filename || '-',
      'Expire Date': formatDate(data.data.expireDate),
    };
    logTable(tableData);
  } else {
    logMessage('  No iOS certificate found');
  }
};

export const writeSigningCertificateCreate = (data: any): void => {
  if (data.data) {
    const tableData = {
      'Certificate Id': data.data.id || '-',
      'Certificate Name': data.data.name || '-',
      'Stored By': mapCertificateStoreType(data.data.storeType),
      'Created': formatDate(data.data.createDate),
    };
    logTable(tableData);
  } else {
    logMessage('  No iOS certificate found');
  }
};

export const writeSigningCertificateView = (data: any): void => {
  if (data.data) {
    const tableData = {
      'Certificate Id': data.data.id || '-',
      'Certificate Name': data.data.name || '-',
      'File Name': data.data.filename || '-',
      'Stored By': mapCertificateStoreType(data.data.storeType),
      'Expire Date': formatDate(data.data.expireDate),
      'Created': formatDate(data.data.createDate),
      'Updated': formatDate(data.data.updateDate),
    };
    logTable(tableData);
  } else {
    logMessage('  No iOS certificate found');
  }
};

export const writeSigningKeystoreList = (data: any): void => {
  const { shouldDisplay, message } = shouldDisplayTable(data.data, '  No Android keystore found');
  
  if (shouldDisplay) {
    const tableData = data.data.map((keystore: any) => ({
      'Keystore Id': keystore.id || '-',
      'Keystore Name': keystore.name || '-',
      'File Name': keystore.fileName || '-',
      'Expires': formatDate(keystore.expireDate),
    }));
    logTable(tableData);
  } else {
    logMessage(message!);
  }
};

export const writeSigningKeystoreView = (data: any): void => {
  if (data.data) {
    const tableData = {
      'Keystore Id': data.data.id || '-',
      'Keystore Name': data.data.name || '-',
      'Alias': data.data.alias || '-',
      'File Name': data.data.fileName || '-',
      'Created': formatDate(data.data.createDate),
      'Expires': formatDate(data.data.expireDate),
    };
    logTable(tableData);
  } else {
    logMessage('  No Android keystore found');
  }
};

export const writeSigningProvisioningProfileList = (data: any): void => {
  const { shouldDisplay, message } = shouldDisplayTable(data.data, '  No Provisioning Profile found');
  
  if (shouldDisplay) {
    const tableData = data.data.map((profile: any) => ({
      'Id': profile.id || '-',
      'Name': profile.name || '-',
      'Associated App ID': profile.appId || '-',
      'Stored By': mapCertificateStoreType(profile.storeType),
      'Has Certificate': profile.hasCertificate || false,
      'Expires': formatDate(profile.expireDate),
    }));
    logTable(tableData);
  } else {
    logMessage(message!);
  }
};

export const writeSigningProvisioningProfileView = (data: any): void => {
  const profile = data.data;
  
  if (profile) {
    const tableData = {
      'Id': profile.id || '-',
      'Name': profile.name || '-',
      'Associated App ID': profile.appId || '-',
      'Stored By': mapCertificateStoreType(profile.storeType),
      'Has Certificate': profile.hasCertificate || false,
      'Expires': formatDate(profile.expireDate),
      'Created': formatDate(profile.createDate),
    };
    logTable(tableData);
  } else {
    logMessage('  No Provisioning Profile found');
  }
};