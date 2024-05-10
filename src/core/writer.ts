import chalk from 'chalk';
import { CommandTypes } from './commands';
import { AuthenticationTypes, OperatingSystems, PlatformTypes, PublishTypes, BuildStatus, PROGRAM_NAME, QueueItemStatus, IOSCertificateStoreTypes } from '../constant';
import moment from 'moment';
import { getConsoleOutputType } from '../config';

const writersMap: { [key in CommandTypes]: (data: any) => void } = {
  [CommandTypes.CONFIG]: (data: any) => {},
  [CommandTypes.LOGIN]: (data: any) => {
    console.log(chalk.italic(`export AC_ACCESS_TOKEN="${data.access_token}"\n`));
    console.info(
      chalk.green(
        `Login is successful. If you keep getting 401 error, execute the command above to set your token manually to your environment variable`
      )
    );
  },
  [CommandTypes.TESTING_DISTRIBUTION]: (data: any) => {
    if(data.fullCommandName === `${PROGRAM_NAME}-testing-distribution-profile-list`){
      if (data?.data?.length === 0) {
        console.info('No distribution profiles available.');
        return;
      }
      console.table(
        data?.data?.map((distributionProfile: any) => ({
          'Profile Id': distributionProfile.id,
          'Profile Name': distributionProfile.name,
          Pinned: distributionProfile.pinned,
          'iOS Version': distributionProfile.iOSVersion ? distributionProfile.iOSVersion : 'No versions available',
          'Android Version': distributionProfile.androidVersion ? distributionProfile.androidVersion : 'No versions available',
          'Last Updated': moment(distributionProfile.updateDate).fromNow(),
          'Last Shared': distributionProfile.lastAppVersionSharedDate ? moment(distributionProfile.lastAppVersionSharedDate).fromNow() : 'Not Shared',
          Authentication: (AuthenticationTypes as any)[distributionProfile.settings.authenticationType],
          'Auto Send': distributionProfile.testingGroupIds ? 'Enabled' : 'Disabled',
        }))
      );
    } else if(data.fullCommandName === `${PROGRAM_NAME}-testing-distribution-profile-create`){
      console.info(`\n${data.data.name} distribution profile created successfully!`);
    }else if (data.fullCommandName === `${PROGRAM_NAME}-testing-distribution-testing-group-list`){
      data.data.length > 0 ?  
      console.table(
        data.data.map((group: any) => ({
          'ID': group.id || '-',
          'Name': group.name || '-',
        }))
      ) : console.log('  No testing group found');
    }else if (data.fullCommandName === `${PROGRAM_NAME}-testing-distribution-testing-group-view`){
      const group = data?.data;
      group ?  
      console.table(
        {
          'ID': group.id || '-',
          'Name': group.name || '-',
          'Created': group.createDate ? moment(group.createDate).calendar() : '-',
          'Updated': group.updateDate ? moment(group.updateDate).calendar() : '-',
        }
      ) : console.log('  No testing group found');
      if(group){
        console.log('*************');
        console.info('  Testers:');
        group?.testers?.length > 0 ? console.table(group.testers.map((tester : any) => tester)) : console.log('  No tester available')
        console.log('*************');
      }
    }
  },
  [CommandTypes.BUILD]: (data: any) => {
    if(data.fullCommandName === `${PROGRAM_NAME}-build-profile-list`){
      if (data?.data?.length === 0) {
        console.info('No build profiles available.');
        return;
      }
      console.table(
        data?.data?.map((buildProfile: any) => ({
          'Profile Id': buildProfile.id,
          'Profile Name': buildProfile.name,
          Pinned: buildProfile.pinned,
          'Target OS': (OperatingSystems as any)[buildProfile.os],
          'Target Platform': (PlatformTypes as any)[buildProfile.buildPlatformType],
          Repository: buildProfile.repositoryName ? buildProfile.repositoryName : 'No repository connected',
          'Last Build': buildProfile.lastBuildDate ? moment(buildProfile.lastBuildDate).calendar() : 'No previous builds',
          'Auto Distribute': buildProfile.autoDistributeCount === 0 ? 'Disabled' : `Enabled in ${buildProfile.autoDistributeCount} branch(es)`,
          'Auto Build': buildProfile.autoBuildCount === 0 ? 'Disabled' : 'Enabled',
        }))
      );
    } else if(data.fullCommandName === `${PROGRAM_NAME}-build-profile-branch-list`) {
      console.table(
        data?.data?.branches.map((branch: any) => ({
          'Branch Id': branch.id,
          'Branch Name': branch.name,
          'Last Build': branch.lastBuildDate ? moment(branch.lastBuildDate).calendar() : 'No previous builds',
          //@ts-ignore
          'Build Status': BuildStatus[String(branch.buildStatus)] || 'No previous builds',
        }))
      );
    } else if(data.fullCommandName === `${PROGRAM_NAME}-build-profile-workflows`) {
      console.table(
        data?.data?.map((workflow: any) => ({
          'Workflow Id': workflow.id,
          'Workflow Name': workflow.workflowName,
          'Last Used': workflow.lastUsedTime ? moment(workflow.lastUsedTime).calendar() : 'No previous builds',
        }))
      );
    } else if(data.fullCommandName === `${PROGRAM_NAME}-build-profile-configurations`){
      console.table(
        data?.data?.map((configuration: any) => ({
          'Configuration Id': configuration.item1.id,
          'Configuration Name': configuration.item1.configurationName,
          'Update Date': configuration.item1.updateDate ? moment(configuration.item1.updateDate).calendar() : 'No updated before',
        }))
      );
    } else if (data.fullCommandName === `${PROGRAM_NAME}-build-profile-branch-commits`){
      if (data?.data?.length === 0) {
        console.info('No commits available.');
        return;
      }
      console.table(
        data?.data?.map((commit: any) => ({
          'Commit Id': commit.id,
          Hash: commit.hash,
          Date: commit.commitDate ? moment(commit.commitDate).calendar() : 'Could not find date',
          Author: commit.author || '',
          Message: commit.message || '',
        }))
      );
    } else if (data.fullCommandName === `${PROGRAM_NAME}-build-list`){
      if (data?.data?.builds?.length === 0) {
        console.info('No builds available.');
        return;
      }
      console.table(
        data?.data?.builds?.map((build: any) => ({
          'Build Id': build.id,
          Hash: build.hash,
          'Has Warning': !!build.hasWarning,
          Status: build.status,
          'Start Date': build.startDate ? moment(build.startDate).calendar() : 'Could not find date',
          'End Date': build.endDate ? moment(build.endDate).calendar() : 'Could not find date',
        }))
      );
    } else if(data.fullCommandName === `${PROGRAM_NAME}-build-variable-group-list`){
      console.table(data?.data?.map((x: any) => ({ 'Variable Groups ID': x.id, 'Variable Groups Name': x.name })));
    } else if(data.fullCommandName === `${PROGRAM_NAME}-build-variable-group-create`){
      console.info(`\n${data?.data?.name} environment variable group created successfully!`);
    } else if(data.fullCommandName === `${PROGRAM_NAME}-build-variable-view`){
      console.table(
        data?.data?.map((environmentVariable: any) => ({
          'Key Name': environmentVariable.key,
          'Key Value': environmentVariable.isSecret ? '********' : environmentVariable.value,
        }))
      );
    } else if(data.fullCommandName === `${PROGRAM_NAME}-build-variable-create`){
      console.info(`\n${data?.data?.key} environment variable created successfully!`);
    } else if (data.fullCommandName === `${PROGRAM_NAME}-build-active-list` ) {
      if(data?.data?.data?.length === 0) {
        console.info('No active builds available.');
        return;
      }
      console.table(
        data?.data?.data?.map((build: any) => ({
          'Build Id': build.id,
          'Commit Id': build.commitId,
          'Commit Hash': build.commitHash || '-',
          'Profile Name': build.profileName || '-',
          'Branch Name': build.branchName || '-',
          'Status': build.queueItemStatus !== null || build.queueItemStatus !== undefined ? (QueueItemStatus as any )[String(build.queueItemStatus)] : '-',
        }))
      );
    }
    else if (data.fullCommandName === `${PROGRAM_NAME}-build-view` ) {
      const build =  data?.data;
      if(!build){
        console.info('No builds available.');
        return;
      }
      const parsedDuration = moment.duration(build.duration);
      const minutes = parsedDuration.minutes() !== 0 ? `${parsedDuration.minutes()} minutes ` : '';
      const seconds = parsedDuration.seconds() !== 0 ? `${parsedDuration.seconds()} seconds ` : '';
      const hours = parsedDuration.hours() !== 0 ? `${parsedDuration.hours()} hours ` : '';
      console.table(
        {
          'Build Id': build.id,
          'Commit Id': build.commitId,
          'Hash': build.hash || '-',
          'Has Warning': !!build.hasWarning,
          'Status': build.status !== null || build.status !== undefined ? (BuildStatus as any)[String(build.status)] : '-',
          'Duration': build.duration ? `${hours}${minutes}${seconds}` : '-',
          'Is Distributable': build.isDistributable || '-',
          'Start Date': build.startDate ? moment(build.startDate).calendar() : 'Could not find date',
          'End Date': build.endDate ? moment(build.endDate).calendar() : 'Could not find date',
        }
      );
    }
  },
  [CommandTypes.ENTERPRISE_APP_STORE]: (data: any) => {
    if(data.fullCommandName === `${PROGRAM_NAME}-enterprise-app-store-profile-list`) {
      if (data?.data?.length === 0) {
        console.info('No build profiles available.');
        return;
      }
      console.table(
        data?.data?.map((buildProfile: any) => ({
          'Profile Id': buildProfile.id,
          'Profile Name': buildProfile.name,
          Version: buildProfile.version,
          Downloads: buildProfile.totalDownloadCount,
          'Latest Publish': buildProfile.latestPublishDate ? moment(buildProfile.latestPublishDate).calendar() : '-',
          'Last Received': buildProfile.lastBinaryReceivedDate ? moment(buildProfile.lastBinaryReceivedDate).calendar() : '-',
        }))
      );
    } else if (data.fullCommandName === `${PROGRAM_NAME}-enterprise-app-store-version-list`){
      if (data?.data?.length === 0) {
        console.info('No app versions available.');
        return;
      }
      console.table(
        data?.data?.map((buildProfile: any) => ({
          'Version Name': buildProfile.name,
          Summary: buildProfile.summary,
          Version: buildProfile.version,
          'Version Code': buildProfile.versionCode,
          'Publish Type': (PublishTypes as any)[buildProfile.publishType],
          'Latest Publish': buildProfile.publishDate ? moment(buildProfile.publishDate).calendar() : '-',
          'Target Platform': (OperatingSystems as any)[buildProfile.platformType],
          Downloads: buildProfile.downloadCount,
          Created: buildProfile.createDate ? moment(buildProfile.createDate).calendar() : '-',
          Updated: buildProfile.updateDate ? moment(buildProfile.updateDate).calendar() : '-',
        }))
      );
    } else if (data.fullCommandName === `${PROGRAM_NAME}-enterprise-app-store-version-publish`){
      console.table(
        [data?.data]?.map((buildProfile: any) => ({
          'Profile Name': buildProfile.name,
          Summary: buildProfile.summary,
          Version: buildProfile.version,
          'Version Code': buildProfile.versionCode,
          'Publish Type': (PublishTypes as any)[buildProfile.publishType],
          'Latest Publish': buildProfile.publishDate ? moment(buildProfile.publishDate).calendar() : '-',
          'Target Platform': (OperatingSystems as any)[buildProfile.platformType],
          Downloads: buildProfile.downloadCount,
          Created: buildProfile.createDate ? moment(buildProfile.createDate).calendar() : '-',
          Updated: buildProfile.updateDate ? moment(buildProfile.updateDate).calendar() : '-',
        }))
      );
    } else if (data.fullCommandName === `${PROGRAM_NAME}-enterprise-app-store-version-unpublish`){
      console.table(
        [data?.data]?.map((buildProfile: any) => ({
          'Profile Name': buildProfile.name,
          Summary: buildProfile.summary,
          Version: buildProfile.version,
          'Version Code': buildProfile.versionCode,
          'Publish Type': (PublishTypes as any)[buildProfile.publishType],
          'Latest Publish': buildProfile.publishDate ? moment(buildProfile.publishDate).calendar() : '-',
          'Target Platform': (OperatingSystems as any)[buildProfile.platformType],
          Downloads: buildProfile.downloadCount,
          Created: buildProfile.createDate ? moment(buildProfile.createDate).calendar() : '-',
          Updated: buildProfile.updateDate ? moment(buildProfile.updateDate).calendar() : '-',
        }))
      );
    } else if (data.fullCommandName === `${PROGRAM_NAME}-enterprise-app-store-version-unpublish`) {
      if (data?.data?.length === 0) {
        console.info('No app versions available.');
        return;
      }
      console.table(
        [data?.data]?.map((buildProfile: any) => ({
          'Profile Name': buildProfile.name,
          Summary: buildProfile.summary,
          Version: buildProfile.version,
          'Version Code': buildProfile.versionCode,
          'Publish Type': (PublishTypes as any)[buildProfile.publishType],
          'Latest Publish': buildProfile.publishDate ? moment(buildProfile.publishDate).calendar() : '-',
          'Target Platform': (OperatingSystems as any)[buildProfile.platformType],
          Downloads: buildProfile.downloadCount,
          Created: buildProfile.createDate ? moment(buildProfile.createDate).calendar() : '-',
          Updated: buildProfile.updateDate ? moment(buildProfile.updateDate).calendar() : '-',
        }))
      );
    } else if (data.fullCommandName === `${PROGRAM_NAME}-enterprise-app-store-version-notify`){
      if (data?.data?.length === 0) {
        console.info('No app versions available.');
        return;
      }
    } else if (data.fullCommandName === `${PROGRAM_NAME}-enterprise-app-store-version-download-link`) {
      console.log(`Download Link: ${data?.data}`);
    }
  },
  [CommandTypes.ORGANIZATION]: (data: any) => {
    if (data.fullCommandName === `${PROGRAM_NAME}-organization-view`) {
      let isAll = Array.isArray(data.data);
      let tableData = isAll ? data.data : [data.data];
      console.table(
        isAll
          ? tableData.map((organization: any) => ({
              Name: organization.name,
              Id: organization.id,
              'Given Id': organization.givenId || '-',
              'SSO Enabled': organization.ssoEnabled ? 'Yes' : 'No',
              Disabled: organization.disabled ? 'Yes' : 'No',
              'Root Organization': organization.rootOrganizationName || '-',
              'Root Organization Id': organization.rootOrganizationId || '-',
              'Created Date': organization.createdDate ? moment(organization.createdDate).calendar() : '-',
            }))
          : tableData.map((organization: any) => ({
              Name: organization.name,
              Id: organization.id,
              'Given Id': organization.givenId,
              Members: organization.memberCount || '-',
              SSO: organization.ssoEnabled ? 'Yes' : 'No',
              'Created': organization.createdDate ? moment(organization.createdDate).calendar() : '-',
              'Root Org.': organization.rootOrganizationName || '-',
              'Root Org. Id': organization.rootOrganizationId || '-',
              'Logo Url': organization.logoUrl || '-',
            }))
      );
    } else if (data.fullCommandName === `${PROGRAM_NAME}-organization-user-view`) {
      console.log('\n- Users ↴ ');
      data.data.users?.length
        ? console.table(
            data.data.users
              .map((user: any) => ({
                'User Name': user.username,
                Id: user.id,
                'InRootOrg': !user.isSubOrganizationMember ? 'Yes' : 'No',
                Email: user.email || '-',
                Roles: user.roles.join(',') || '-',
              }))
          )
        : console.log('  No users found.');

      console.log('\n- Invitations ↴ ');
      data.data.invitations?.length
        ? console.table(
            data.data.invitations.map((user: any) => ({
              'User Email': user.userEmail,
              'Root Organization ID': user.rootOrganizationId,
              'InRootOrg': !user.isSubOrganizationMember ? 'Yes' : 'No',
              Roles: user.organizationsAndRoles?.[0]?.roles?.join(',') || '-',
              Status: user.status || '-',
            }))
          )
        : console.log('  No invitations found');
    } else if (data.fullCommandName === `${PROGRAM_NAME}-organization-user-invite`) {
      console.log('Invitation successfully sent.');
    } else if (data.fullCommandName === `${PROGRAM_NAME}-organization-user-re-invite`) {
      console.log('Re-invitation successfully sent again.');
    } else if (data.fullCommandName === `${PROGRAM_NAME}-organization-user-remove`) {
      console.log(`User "${data.data.email}" has been removed.`);
    } else if (data.fullCommandName === `${PROGRAM_NAME}-organization-role-view`) {
      console.log('\n- Roles ↴ ');
      data.data.length ? console.table(data.data) : console.log('  No roles found.');
    } else {
      console.log(data.data);
    }
  }, 
  [CommandTypes.PUBLISH]: (data: any) => {
    if(data.fullCommandName === `${PROGRAM_NAME}-publish-profile-create`){
      console.table(
        [{ 'Id:': data.data.id,
          'Name:': data.data.name,
          'Created:': data.data.createDate ? moment(data.data.createDate).calendar() : '-',
        }]
      )
    }else if(data.fullCommandName === `${PROGRAM_NAME}-publish-profile-rename`){
      console.table(
        [{ 'Id:': data.data.id,
          'Name:': data.data.name,
          'Created:': data.data.createDate ? moment(data.data.createDate).calendar() : '-',
          'Updated:': data.data.updateDate ? moment(data.data.updateDate).calendar() : '-',
        }]
      )
    }
    else if(data.fullCommandName === `${PROGRAM_NAME}-publish-profile-list`){
      data.data.length > 0 ?  
      console.table(
        data.data.map((publishProfile: any) => ({
          'Id': publishProfile.id,
          'Name': publishProfile.name,
          'Last Version': publishProfile.lastUploadVersion,
          'Last Version Code': publishProfile.lastUploadVersionCode,
          'Version Code': publishProfile.version,
          'App Unique Id': publishProfile.appUniqueId ,
          'Latest Publish': publishProfile.latestPublishDate ? moment(publishProfile.publishDate).calendar() : '-',
          'Platform': (OperatingSystems as any)[publishProfile.platformType],
          Created: publishProfile.createDate ? moment(publishProfile.createDate).calendar() : '-',
          Updated: publishProfile.updateDate ? moment(publishProfile.updateDate).calendar() : '-',
        }))
      ) : console.log('  No publish profile found');
    }else if(data.fullCommandName === `${PROGRAM_NAME}-publish-variable-group-list`){
      data.data.length > 0 ? console.table(
        data.data.map((group: any) => ({
          'Group Id': group.id,
          'Group Name': group.name,
          Created: group.createDate ? moment(group.createDate).calendar() : '-',
          Updated: group.updateDate ? moment(group.updateDate).calendar() : '-',
        }))
      ) : console.log('  No publish variable group found');
    }else if(data.fullCommandName === `${PROGRAM_NAME}-publish-variable-group-view`){
      data.data.length > 0 ? console.table(
        data.data.map((variable: any) => ({
          'Key Name': variable.key,
          'Key Value': variable.isSecret ? '********' : variable.value,
        }))
      ) : console.log('  No publish variable found');
    }else if(data.fullCommandName ===`${PROGRAM_NAME}-publish-profile-settings-autopublish`){
      console.table(
        [{ 'Id:': data.data.id,
          'Name:': data.data.name,
          'Created:': data.data.createDate ? moment(data.data.createDate).calendar() : '-',
          'Updated:': data.data.updateDate ? moment(data.data.updateDate).calendar() : '-',
          'Auto Publish': data.data.profileSettings.whenNewVersionRecieved ? 'Yes' : 'No',
        }]
      )
    }else if(data.fullCommandName ===`${PROGRAM_NAME}-publish-profile-version-mark-as-rc` || data.fullCommandName ===`${PROGRAM_NAME}-publish-profile-version-unmark-as-rc`){
      console.table(
        [{ 'Id:': data.data.id,
          'Name:': data.data.name,
          'Unique Name': data.data.uniqueName,
          'Created:': data.data.createDate ? moment(data.data.createDate).calendar() : '-',
          'Updated:': data.data.updateDate ? moment(data.data.updateDate).calendar() : '-',
          'Release Candidate': data.data.releaseCandidate ? 'Yes' : 'No',
        }]
      )
    }
    else {
      console.log(data.data)
    }
  },
  [CommandTypes.SIGNING_IDENTITY]: (data: any) => {
    if(data.fullCommandName === `${PROGRAM_NAME}-signing-identity-certificate-list`){
      data.data.length > 0 ?  
      console.table(
        data.data.map((certificate: any) => ({
          'Certificate Id': certificate.id || '-',
          'Certificate Name': certificate.name || '-',
          'Stored By': certificate.storeType?.toString() ? (IOSCertificateStoreTypes as any)[certificate.storeType.toString()]  :'-',
          'Extension': certificate.extension || '-',
          'Expire Date': certificate.expireDate ? moment(certificate.expireDate).calendar() : '-',
        }))
      ) : console.log('  No iOS certificate found');
    }else if(data.fullCommandName === `${PROGRAM_NAME}-signing-identity-certificate-upload`){
      data.data ? console.table({
        'Certificate Id': data.data.id || '-',
        'Certificate Name': data.data.name || '-',
        'Stored By': data.data.storeType?.toString() ? (IOSCertificateStoreTypes as any)[data.data.storeType.toString()]  :'-',
        'File Name': data.data.filename || '-',
        'Expire Date': data.data.expireDate ? moment(data.data.expireDate).calendar() : '-',
      }):console.log('  No iOS certificate found')
    }else if(data.fullCommandName === `${PROGRAM_NAME}-signing-identity-certificate-create`){
      data.data ? console.table({
        'Certificate Id': data.data.id || '-',
        'Certificate Name': data.data.name || '-',
        'Stored By': data.data.storeType?.toString() ? (IOSCertificateStoreTypes as any)[data.data.storeType.toString()]  :'-',
        'Created': data.data.createDate ? moment(data.data.createDate).calendar() : '-',
      }):console.log('  No iOS certificate found')
    }else if(data.fullCommandName === `${PROGRAM_NAME}-signing-identity-certificate-view`){
      data.data ? console.table({
        'Certificate Id': data.data.id || '-',
        'Certificate Name': data.data.name || '-',
        'File Name': data.data.filename || '-',
        'Stored By': data.data.storeType?.toString() ? (IOSCertificateStoreTypes as any)[data.data.storeType.toString()]  :'-',
        'Expire Date': data.data.expireDate ? moment(data.data.expireDate).calendar() : '-',
        'Created': data.data.createDate ? moment(data.data.createDate).calendar() : '-',
        'Updated': data.data.updateDate ? moment(data.data.updateDate).calendar() : '-',
      }):console.log('  No iOS certificate found')
    }else if(data.fullCommandName === `${PROGRAM_NAME}-signing-identity-keystore-list`){
      data.data?.length > 0 ? console.table(
        data.data?.map((keystore:any) => ({
          'Keystore Id': keystore.id || '-',
          'Keystore Name': keystore.name || '-',
          'File Name': keystore.fileName || '-',
          'Expires': keystore.expireDate ? moment(keystore.expireDate).calendar() : '-',
        }))
      ):console.log('  No Android keystore found')
    }else if(data.fullCommandName === `${PROGRAM_NAME}-signing-identity-keystore-view`){
      data.data ? console.table(
        {
          'Keystore Id': data.data.id || '-',
          'Keystore Name': data.data.name || '-',
          'Alias': data.data.alias || '-',
          'File Name': data.data.fileName || '-',
          'Created': data.data.createDate ? moment(data.data.createDate).calendar() : '-',
          'Expires': data.data.expireDate ? moment(data.data.expireDate).calendar() : '-',
        }
      ):console.log('  No Android keystore found')
    }else if(data.fullCommandName === `${PROGRAM_NAME}-signing-identity-provisioning-profile-list`){
      data.data?.length > 0 ? console.table(
        data.data?.map((profile:any) => ({
          'Id': profile.id || '-',
          'Name': profile.name || '-',
          'Associated App ID': profile.appId || '-',
          'Stored By': profile.storeType?.toString() ? (IOSCertificateStoreTypes as any)[profile.storeType.toString()]  :'-',
          'Has Certificate': profile.hasCertificate || false,
          'Expires': profile.expireDate ? moment(profile.expireDate).calendar() : '-',
        }))
      ):console.log('  No Provisioning Profile found')
    }else if(data.fullCommandName === `${PROGRAM_NAME}-signing-identity-provisioning-profile-view`){
      const profile = data.data;
      profile ? console.table(
        {
          'Id': profile.id || '-',
          'Name': profile.name || '-',
          'Associated App ID': profile.appId || '-',
          'Stored By': profile.storeType?.toString() ? (IOSCertificateStoreTypes as any)[profile.storeType.toString()]  :'-',
          'Has Certificate': profile.hasCertificate || false,
          'Expires': profile.expireDate ? moment(profile.expireDate).calendar() : '-',
          'Created': profile.createDate ? moment(profile.createDate).calendar() : '-',
        }
      ):console.log('  No Provisioning Profile found')
    }
  }
};

export const commandWriter = (command: CommandTypes, data: any) => {
  if (getConsoleOutputType() === 'json') {
    console.log(JSON.stringify(data.data || data));
  } else {
    const writer = writersMap[command];
    if (writer) {
      writer(data);
    }
  }
};

export const configWriter = (config: any) => {
  if (getConsoleOutputType() === 'json') {
    console.log(JSON.stringify(config));
  } else {
    console.table(config);
  }
};
